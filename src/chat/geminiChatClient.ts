/**
 * Gemini text chat client - companion to `geminiLiveClient` for the
 * non-voice modality. Uses the same `@google/genai` SDK and the same
 * canvas tool registry, so a chat user has the same agent capabilities
 * as a voice user.
 *
 * Why a thin module instead of CopilotKit:
 *   M2.5 ships without the CopilotKit runtime (deferred to M3 per plan).
 *   We want functional chat now - and the registry boundary we're putting
 *   between `canvasTools` and the model wrapper means the eventual
 *   CopilotKit adapter is a small refactor, not a rewrite.
 *
 * Flow:
 *   1. Caller sends conversation history + new user message.
 *   2. We call `ai.models.generateContent` with `tools: [{functionDeclarations}]`.
 *   3. If the model returns a `functionCall` part, we execute it via
 *      `executeTool`, append a `functionResponse`, and call generate again.
 *      Loop up to MAX_TOOL_ROUND_TRIPS to bound run-away tool loops.
 *   4. Return the final text response.
 *
 * The credential resolution mirrors `geminiLiveClient`: static API key OR
 * thunk that mints a token. Phase A worker mint applies to both modalities.
 */
import { GoogleGenAI, type Content, type Part } from '@google/genai';
import {
  executeTool,
  getFunctionDeclarations,
  type ToolDeclaration,
} from '../agents/tools/canvasTools';
import {
  withAgentToolContextAsync,
  type AgentToolExecutionContext,
} from '../agents/agentContext';
// Import the event name from the constants module directly (not the
// choreography barrel, which re-exports engine-specific helpers) so this
// engine-agnostic chat client stays free of any tldraw import.
import { FIT_AGENT_DRAWING_EVENT } from '../choreography/constants';
import {
  CANVAS_DRAW_TOOLS,
  captureCanvasCheck,
  CLEAR_FORBIDDEN_LAYOUT_FIX_ERROR,
  dropStaleCanvasChecks,
  runLayoutProbe,
  runPostDrawExitGate,
  stripFalseLayoutClaims,
} from './postDrawCanvasReview';
import {
  autoGroupCreatedShapes,
  filterGroupableSiblingIds,
  resolvePostDrawArrangeLayout,
} from './postDrawCanvasGrouping';
export { resolvePostDrawArrangeLayout } from './postDrawCanvasGrouping';
import {
  filterBenignNestedDiagramLints,
  shouldCompleteNestedDiagramReview,
} from './postDrawNestedDiagram';
export {
  filterBenignNestedDiagramLints,
  shouldCompleteNestedDiagramReview,
} from './postDrawNestedDiagram';
import type { AgentDiagramLayoutMode } from '../engine/agentDrawingTypes';
import { withDrawUserMessageAsync } from './drawIntentContext';
import {
  setTurnCanvasShapeIds,
  withTurnCanvasShapeIdsAsync,
} from './turnCanvasContext';

/**
 * Stable acting-agent identity for chat-driven tool calls (both the live
 * Gemini path here and the offline draw fallback in `offlineDrawFallback.ts`
 * reuse this same context so provenance-stamped marks are attributed
 * consistently regardless of which path executed the tool).
 */
export const CHAT_AGENT_TOOL_CONTEXT: AgentToolExecutionContext = {
  agentId: 'agentable-chat-agent',
  agentLabel: 'Chat Agent',
};

/** Merge draw_shapes tool output into operator-visible args for post-verify. */
function enrichDrawShapesToolArgs(
  args: Record<string, unknown>,
  result: { ok: boolean; result?: unknown },
): Record<string, unknown> {
  if (!result.ok || result.result === undefined || typeof result.result !== 'object') {
    return args;
  }
  const payload = result.result as { createdShapeIds?: unknown; _store?: unknown };
  const createdShapeIds = Array.isArray(payload.createdShapeIds)
    ? payload.createdShapeIds.filter((id): id is string => typeof id === 'string')
    : [];
  if (createdShapeIds.length === 0) {
    return args;
  }
  const enriched: Record<string, unknown> = { ...args, _createdShapeIds: createdShapeIds };
  if (
    payload._store !== undefined &&
    typeof payload._store === 'object' &&
    payload._store !== null
  ) {
    enriched._store = payload._store;
  }
  return enriched;
}

/**
 * Per-turn ledger of canvas mutations. Enforces the single-clear budget and
 * remembers the scene a clear wiped, so the client can restore it when a
 * turn would otherwise end with the model having deleted its own finished
 * work (observed live: clear, draw, clear, draw, clear, then "the sketch is
 * on the whiteboard" over an empty canvas).
 */
export interface TurnCanvasLedger {
  /** True when a clear call arriving now must be refused (budget: one per turn). */
  shouldRefuseClear(): boolean;
  /** Record an executed call so the ledger tracks what is on the canvas. */
  record(name: string, args: Record<string, unknown>, ok: boolean): void;
  /**
   * Calls to replay, oldest first, when the turn is ending and the canvas
   * holds nothing drawn this turn because a clear wiped it. Empty when the
   * canvas still has live drawings or nothing was drawn this turn at all.
   */
  wipedScene(): ReadonlyArray<{ name: string; args: Record<string, unknown> }>;
  /** True when at least one drawing from this turn is still on the canvas. */
  hasLiveDrawing(): boolean;
  /** Shape ids created successfully during this turn (for scoped clear). */
  getTurnShapeIds(): readonly string[];
}

export function createTurnCanvasLedger(): TurnCanvasLedger {
  let clears = 0;
  let sinceClear: Array<{ name: string; args: Record<string, unknown> }> = [];
  let wiped: Array<{ name: string; args: Record<string, unknown> }> = [];
  let turnShapeIds: string[] = [];
  return {
    shouldRefuseClear: () => clears >= 1,
    record(name, args, ok) {
      if (!ok) return;
      if (name === 'clear_agent_drawings') {
        clears += 1;
        wiped = sinceClear;
        sinceClear = [];
        const removed = args._removedShapeIds;
        if (Array.isArray(removed)) {
          const removedSet = new Set(
            removed.filter((id): id is string => typeof id === 'string'),
          );
          turnShapeIds = turnShapeIds.filter((id) => !removedSet.has(id));
          setTurnCanvasShapeIds(turnShapeIds);
        }
        return;
      }
      if (CANVAS_DRAW_TOOLS.has(name)) {
        sinceClear.push({ name, args });
        const created = args._createdShapeIds;
        if (Array.isArray(created)) {
          turnShapeIds.push(...created.filter((id): id is string => typeof id === 'string'));
          setTurnCanvasShapeIds(turnShapeIds);
        }
      }
    },
    wipedScene: () => (sinceClear.length > 0 ? [] : wiped),
    hasLiveDrawing: () => sinceClear.length > 0,
    getTurnShapeIds: () => [...turnShapeIds],
  };
}

function dispatchFitChatDrawing(
  executedCalls: readonly { name: string; ok: boolean }[],
  agentId: string,
): void {
  if (typeof window === 'undefined') return;
  if (!executedCalls.some((call) => call.ok && CANVAS_DRAW_TOOLS.has(call.name))) {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(FIT_AGENT_DRAWING_EVENT, {
      detail: { agentId },
    }),
  );
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  /** Plain-text body. Voice transcripts are stored as text too. */
  text: string;
  /** Source - distinguishes voice transcript echoes from typed messages. */
  source?: 'text' | 'voice' | 'tool';
  /** When source === 'tool', this carries the call summary. */
  toolCall?: { name: string; args: Record<string, unknown>; ok: boolean };
  /** ISO timestamp. */
  createdAt: string;
}

export type ApiKeySource = string | (() => Promise<string>);

export interface ChatClientOptions {
  /**
   * API credential source (static key or token thunk). Optional when
   * `proxyUrl` is set - the server-side proxy holds the credential instead.
   */
  apiKeySource?: ApiKeySource;
  /**
   * Server-side text-chat proxy URL. When set, the client POSTs
   * `{ model, contents, config }` to this endpoint instead of calling the
   * Gemini API directly from the browser, so no key/token ships to the client.
   */
  proxyUrl?: string;
  /** System instruction passed to every generation. */
  systemInstruction: string;
  /** Model id. Defaults to `gemini-3.1-pro-preview`. */
  model?: string;
  /** Max tool-call → response → generate loops per turn. Default 4. */
  maxToolRoundTrips?: number;
  /** Acting-agent context for tool execution and declaration filtering. */
  toolContext?: AgentToolExecutionContext;
}

/** Minimal generate result shape shared by the SDK and the proxy path. */
interface GenerateResult {
  candidates?: Array<{ content?: { parts?: Part[] } }>;
}

export interface ChatTurnResult {
  /** Final assistant text. Empty string if the model only emitted tool calls. */
  text: string;
  /** Tool calls executed during this turn (in order). */
  toolCalls: Array<{ name: string; args: Record<string, unknown>; ok: boolean }>;
  /** Model text emitted alongside tool calls (chain-of-thought / pre-tool reasoning). */
  reasoning?: string;
}

export type ChatSendProgressEvent =
  | { type: 'reasoning'; text: string; streaming: boolean }
  | { type: 'tool-start'; name: string; args: Record<string, unknown> }
  | { type: 'tool-complete'; name: string; args: Record<string, unknown>; ok: boolean; error?: string }
  | { type: 'text-chunk'; text: string; final: boolean };

export interface ChatSendOptions {
  attachmentInlineData?: ReadonlyArray<{ mimeType: string; data: string }>;
  /** Incremental turn updates for operator / chat UI (P13-T7 iter-12). */
  onProgress?: (event: ChatSendProgressEvent) => void;
  /** When aborted, in-flight fetch and tool rounds stop with AbortError. */
  signal?: AbortSignal;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }
}

// The strongest pro-tier model this project's key can call: the API has no
// "gemini-3.5-pro" (a turn against it fails with model NOT_FOUND before any
// tool runs), so quality-first drawing uses the newest pro preview instead.
const DEFAULT_MODEL = 'gemini-3.1-pro-preview';
/** Hard cap on every tool execution (model + programmatic) per user send(). */
export const MAX_TOOLS_PER_TURN = 10;
// Room for draw, one repair pass, and a text-only close — not unbounded redraw loops.
export const DEFAULT_MAX_ROUND_TRIPS = 8;
const MAX_CONSECUTIVE_DRAW_FAILURES = 3;

const DIAGRAM_REPAIR_TOOLS: ReadonlySet<string> = new Set([
  'read_canvas',
  'arrange',
  'group_shapes',
]);

const CLEAR_FORBIDDEN_REST_OF_TURN_ERROR =
  'clear_agent_drawings is forbidden for the rest of this turn. Patch shapes in place instead.';

const DIAGRAM_ALREADY_DRAWN_ERROR =
  'Diagram already placed this turn. Use arrange or draw_shapes with existing shape ids to patch.';

/** True when draw_shapes succeeded via diagram + layout (not hand-placed shapes). */
export function isSuccessfulDiagramDraw(
  name: string,
  args: Record<string, unknown>,
  ok: boolean,
): boolean {
  if (name !== 'draw_shapes' || !ok) {
    return false;
  }
  const layout = args.layout;
  if (
    layout === 'flow' ||
    layout === 'timeline' ||
    layout === 'radial' ||
    layout === 'nested'
  ) {
    return true;
  }
  const diagram = args.diagram;
  return typeof diagram === 'object' && diagram !== null && !Array.isArray(diagram);
}

export function formatToolReasoningStatus(toolName: string): string {
  return `Calling ${toolName.replace(/_/g, ' ')}…`;
}

export interface TurnToolRefusalInput {
  name: string;
  layoutFixActive: boolean;
  postDrawReviewComplete: boolean;
  hasLiveDrawing: boolean;
  diagramDrawnThisTurn: boolean;
  repairToolsUsed: ReadonlySet<string>;
  clearForbiddenRestOfTurn: boolean;
  ledgerShouldRefuseClear: boolean;
}

export function evaluateTurnToolRefusal(input: TurnToolRefusalInput): {
  refuse: boolean;
  error?: string;
  forbidClearRestOfTurn?: boolean;
} {
  if (input.name === 'clear_agent_drawings') {
    if (input.clearForbiddenRestOfTurn) {
      return {
        refuse: true,
        error: CLEAR_FORBIDDEN_REST_OF_TURN_ERROR,
        forbidClearRestOfTurn: true,
      };
    }
    if (input.layoutFixActive || (input.hasLiveDrawing && !input.postDrawReviewComplete)) {
      return {
        refuse: true,
        error: CLEAR_FORBIDDEN_LAYOUT_FIX_ERROR,
        forbidClearRestOfTurn: true,
      };
    }
    if (input.diagramDrawnThisTurn) {
      return {
        refuse: true,
        error: DIAGRAM_ALREADY_DRAWN_ERROR,
        forbidClearRestOfTurn: true,
      };
    }
    if (input.ledgerShouldRefuseClear) {
      return {
        refuse: true,
        error:
          'The canvas was already cleared this turn. Adjust or add shapes instead of clearing again.',
        forbidClearRestOfTurn: true,
      };
    }
  }
  if (input.diagramDrawnThisTurn && input.name === 'draw_shapes') {
    return { refuse: true, error: DIAGRAM_ALREADY_DRAWN_ERROR };
  }
  if (input.diagramDrawnThisTurn && DIAGRAM_REPAIR_TOOLS.has(input.name)) {
    if (input.repairToolsUsed.has(input.name)) {
      return {
        refuse: true,
        error: `${input.name} was already used for repair this turn.`,
      };
    }
  }
  return { refuse: false };
}

const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';

function extractBase64Png(dataUrl: unknown): string | null {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
    return null;
  }
  const data = dataUrl.slice(PNG_DATA_URL_PREFIX.length);
  return data.length > 0 ? data : null;
}

/**
 * Convert ChatMessage history into Gemini Content[] format. We collapse
 * voice transcripts into the same flow as typed messages (the agent
 * doesn't need to know they came from a different modality). Tool
 * messages map to
 * `functionResponse` parts on a `'function'`-role content (Gemini's API
 * uses 'user' role for function responses by convention).
 */
function buildContents(history: ChatMessage[]): Content[] {
  const out: Content[] = [];
  for (const msg of history) {
    if (msg.source === 'tool' && msg.toolCall) {
      // Skip - tool calls are already in the history as model functionCall
      // parts paired with our functionResponse parts. Re-injecting here
      // would double-count and confuse the model.
      continue;
    }
    out.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.text }],
    });
  }
  return out;
}

export function createChatClient(options: ChatClientOptions) {
  const model = options.model ?? DEFAULT_MODEL;
  const maxRoundTrips = options.maxToolRoundTrips ?? DEFAULT_MAX_ROUND_TRIPS;
  const toolContext = options.toolContext ?? CHAT_AGENT_TOOL_CONTEXT;

  // Convert canvas tool declarations to Gemini's FunctionDeclaration shape.
  // Cached at module init - declarations don't change at runtime.
  const functionDeclarations = getFunctionDeclarations({ agentId: toolContext.agentId }).map(
    (d: ToolDeclaration) => ({
      name: d.name,
      description: d.description,
      parametersJsonSchema: d.parameters,
    }),
  );

  const generationConfig = {
    systemInstruction: options.systemInstruction,
    tools: [{ functionDeclarations }],
  };

  /**
   * Run one `generateContent` round via the server proxy (preferred, keyless)
   * or the browser SDK (when a credential source is supplied). Pass
   * `includeTools: false` for a text-only closing round.
   */
  async function runGenerate(
    contents: Content[],
    { includeTools = true, signal }: { includeTools?: boolean; signal?: AbortSignal } = {},
  ): Promise<GenerateResult> {
    throwIfAborted(signal);
    const config = includeTools
      ? generationConfig
      : { systemInstruction: options.systemInstruction };
    if (options.proxyUrl) {
      const res = await fetch(options.proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, contents, config }),
        signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(
          `Chat proxy responded ${res.status}${detail ? `: ${detail}` : ''}`,
        );
      }
      return (await res.json()) as GenerateResult;
    }

    if (!options.apiKeySource) {
      throw new Error('Chat client has no credential source or proxy URL.');
    }
    const apiKey =
      typeof options.apiKeySource === 'function'
        ? await options.apiKeySource()
        : options.apiKeySource;
    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
    return ai.models.generateContent({
      model,
      contents,
      config:
        signal !== undefined
          ? { ...config, abortSignal: signal }
          : config,
    });
  }

  async function send(
    history: ChatMessage[],
    userMessage: string,
    sendOptions?: ChatSendOptions,
  ): Promise<ChatTurnResult> {
    return withDrawUserMessageAsync(userMessage, async () =>
      withTurnCanvasShapeIdsAsync([], async () => {
    const onProgress = sendOptions?.onProgress;
    const signal = sendOptions?.signal;
    throwIfAborted(signal);
    const userParts: Part[] = [{ text: userMessage }];
    for (const attachment of sendOptions?.attachmentInlineData ?? []) {
      if (attachment.mimeType.trim().length === 0 || attachment.data.trim().length === 0) {
        continue;
      }
      userParts.push({
        inlineData: {
          mimeType: attachment.mimeType,
          data: attachment.data,
        },
      });
    }

    // Working contents: history → user message, then we may append model
    // turns + tool responses across the round-trip loop.
    const contents: Content[] = [
      ...buildContents(history),
      { role: 'user', parts: userParts },
    ];

    const toolCalls: ChatTurnResult['toolCalls'] = [];
    const reasoningSegments: string[] = [];
    // Room for between-round checks, exit-gate probe, fix round, and verify probe.
    let canvasChecksLeft = 2;
    let postDrawReviewComplete = false;
    let layoutFixActive = false;
    let lastDrawCreatedIds: string[] = [];
    let lastDiagramLayout: AgentDiagramLayoutMode | undefined;
    let consecutiveDrawFailures = 0;
    let toolsExecutedThisTurn = 0;
    let diagramDrawnThisTurn = false;
    const repairToolsUsed = new Set<string>();
    let clearForbiddenRestOfTurn = false;
    let clearBanInjected = false;
    const ledger = createTurnCanvasLedger();

    const toolCapReached = (): boolean => toolsExecutedThisTurn >= MAX_TOOLS_PER_TURN;

    const recordToolExecution = (): void => {
      toolsExecutedThisTurn += 1;
    };

    const emitToolReasoningIfNeeded = (toolName: string): void => {
      const status = formatToolReasoningStatus(toolName);
      reasoningSegments.push(status);
      onProgress?.({ type: 'reasoning', text: status, streaming: true });
    };

    const injectClearBanIfNeeded = (): void => {
      if (!clearForbiddenRestOfTurn || clearBanInjected) {
        return;
      }
      clearBanInjected = true;
      contents.push({
        role: 'user',
        parts: [
          {
            text:
              'clear_agent_drawings is forbidden for the rest of this turn. Do not call it again. Patch the diagram in place with draw_shapes (existing ids) or arrange.',
          },
        ],
      });
    };

    const evaluateRefusal = (name: string): ReturnType<typeof evaluateTurnToolRefusal> =>
      evaluateTurnToolRefusal({
        name,
        layoutFixActive,
        postDrawReviewComplete,
        hasLiveDrawing: ledger.hasLiveDrawing(),
        diagramDrawnThisTurn,
        repairToolsUsed,
        clearForbiddenRestOfTurn,
        ledgerShouldRefuseClear: ledger.shouldRefuseClear(),
      });

    async function finishWithTextOnlyClosing(hint: string): Promise<ChatTurnResult> {
      throwIfAborted(signal);
      await restoreWipedScene();
      dispatchFitChatDrawing(toolCalls, toolContext.agentId);
      try {
        contents.push({
          role: 'user',
          parts: [{ text: hint }],
        });
        const closing = await runGenerate(contents, { includeTools: false, signal });
        const closingText = (closing.candidates?.[0]?.content?.parts ?? [])
          .map((part) => (typeof part.text === 'string' ? part.text : ''))
          .join('')
          .trim();
        if (closingText.length > 0) {
          return buildTurnResult(closingText);
        }
      } catch {
        throwIfAborted(signal);
      }
      return buildTurnResult(
        ledger.hasLiveDrawing()
          ? 'The sketch is on the whiteboard.'
          : 'I could not finish that sketch. Ask me to try again.',
      );
    }

    const postDrawProgressHooks = {
      onToolStart: (name: string, args: Record<string, unknown>): void => {
        onProgress?.({ type: 'tool-start', name, args });
      },
      onToolComplete: (
        name: string,
        args: Record<string, unknown>,
        ok: boolean,
        error?: string,
      ): void => {
        recordToolExecution();
        toolCalls.push({ name, args, ok });
        onProgress?.({ type: 'tool-complete', name, args, ok, error });
        // Programmatic probe/repair hooks must not consume the model repair budget.
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('landi:tool-call', {
              detail: { name, args, ok, source: 'chat' },
              bubbles: true,
              composed: true,
            }),
          );
        }
      },
    };

    // If the turn is ending with this turn's drawings wiped by a clear,
    // replay the wiped scene so the user never gets "the sketch is on the
    // whiteboard" over an empty canvas.
    async function restoreWipedScene(): Promise<void> {
      for (const call of ledger.wipedScene()) {
        const result = await withAgentToolContextAsync(toolContext, () =>
          executeTool(call.name, call.args),
        );
        ledger.record(call.name, call.args, result.ok);
        toolCalls.push({ name: call.name, args: call.args, ok: result.ok });
      }
    }

    function buildTurnResult(text: string): ChatTurnResult {
      const reasoning = reasoningSegments
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0)
        .join('\n\n');
      onProgress?.({ type: 'text-chunk', text, final: true });
      return {
        text,
        toolCalls,
        reasoning: reasoning.length > 0 ? reasoning : undefined,
      };
    }

    async function finishAfterDrawFailures(lastError: string | undefined): Promise<ChatTurnResult> {
      throwIfAborted(signal);
      const errorHint =
        lastError !== undefined && lastError.trim().length > 0
          ? ` Last error: ${lastError.trim()}`
          : '';
      contents.push({
        role: 'user',
        parts: [
          {
            text:
              `draw_shapes failed ${MAX_CONSECUTIVE_DRAW_FAILURES} times in a row.${errorHint} ` +
              'Stop calling draw_shapes. In one or two sentences, tell the user what went wrong and suggest they rephrase or try again.',
          },
        ],
      });
      try {
        const closing = await runGenerate(contents, { includeTools: false, signal });
        const closingText = (closing.candidates?.[0]?.content?.parts ?? [])
          .map((part) => (typeof part.text === 'string' ? part.text : ''))
          .join('')
          .trim();
        if (closingText.length > 0) {
          await restoreWipedScene();
          dispatchFitChatDrawing(toolCalls, toolContext.agentId);
          return buildTurnResult(closingText);
        }
      } catch {
        throwIfAborted(signal);
        // Fall through to generic message below.
      }
      await restoreWipedScene();
      dispatchFitChatDrawing(toolCalls, toolContext.agentId);
      return buildTurnResult(
        'I could not draw that diagram after several attempts. Please try rephrasing the request.',
      );
    }

    for (let round = 0; round < maxRoundTrips; round++) {
      throwIfAborted(signal);
      if (toolCapReached()) {
        return finishWithTextOnlyClosing(
          'Stop calling tools now. In one short sentence, tell the user what you sketched.',
        );
      }
      injectClearBanIfNeeded();
      const response = await runGenerate(contents, { signal });

      // Pull the first candidate's content. Defensive: SDK shapes can
      // include / omit candidates depending on safety filters.
      const candidate = response.candidates?.[0];
      const parts = (candidate?.content?.parts ?? []) as Part[];

      // Collect text + functionCall parts. Gemini may return both in a
      // single response (a "thinking" line then a tool call).
      let textOut = '';
      const functionCalls: Array<{ name: string; args: Record<string, unknown>; id?: string }> = [];
      for (const part of parts) {
        if (typeof part.text === 'string') {
          textOut += part.text;
        } else if (part.functionCall && typeof part.functionCall.name === 'string') {
          functionCalls.push({
            name: part.functionCall.name,
            args: (part.functionCall.args ?? {}) as Record<string, unknown>,
            id: part.functionCall.id,
          });
        }
      }

      // No tool calls → hard post-draw gate before final answer.
      if (functionCalls.length === 0) {
        throwIfAborted(signal);
        const exitGate = await runPostDrawExitGate({
          contents,
          toolContext,
          hasLiveDrawing: ledger.hasLiveDrawing(),
          postDrawReviewComplete,
          canvasChecksLeft,
          hooks: postDrawProgressHooks,
        });
        throwIfAborted(signal);
        postDrawReviewComplete = exitGate.postDrawReviewComplete;
        canvasChecksLeft = exitGate.canvasChecksLeft;
        layoutFixActive = exitGate.layoutFixActive;
        if (exitGate.shouldContinue) {
          continue;
        }

        throwIfAborted(signal);
        await restoreWipedScene();
        dispatchFitChatDrawing(toolCalls, toolContext.agentId);
        const finalText = stripFalseLayoutClaims(textOut.trim(), postDrawReviewComplete);
        return buildTurnResult(finalText);
      }

      const preToolReasoning = textOut.trim();
      if (preToolReasoning.length > 0) {
        reasoningSegments.push(preToolReasoning);
        onProgress?.({ type: 'reasoning', text: preToolReasoning, streaming: true });
      }

      // Append model turn (with the function-call parts the SDK returned)
      // so the next round sees the call in the history.
      contents.push({
        role: 'model',
        parts: parts as Content['parts'],
      });

      // Execute each tool call sequentially. Sequential because tools may
      // mutate canvas state (e.g. open positions then select job) and
      // ordering matters; parallel would race the panel intent store.
      const responseParts: Part[] = [];
      const roundResults: Array<{ name: string; ok: boolean }> = [];
      const screenshotParts: Part[] = [];
      for (const fc of functionCalls) {
        throwIfAborted(signal);
        if (toolCapReached()) {
          responseParts.push({
            functionResponse: {
              id: fc.id,
              name: fc.name,
              response: {
                error: `Tool budget exhausted (${MAX_TOOLS_PER_TURN} per turn). Reply to the user without more tools.`,
              },
            },
          });
          break;
        }

        onProgress?.({ type: 'tool-start', name: fc.name, args: fc.args });
        if (preToolReasoning.length === 0) {
          emitToolReasoningIfNeeded(fc.name);
        }

        const refusal = evaluateRefusal(fc.name);
        if (refusal.forbidClearRestOfTurn === true) {
          clearForbiddenRestOfTurn = true;
        }

        const result = refusal.refuse
          ? {
              ok: false as const,
              error: refusal.error ?? 'Tool call refused for this turn.',
            }
          : await withAgentToolContextAsync(toolContext, () =>
              executeTool(fc.name, fc.args),
            );
        recordToolExecution();
        const completeArgs =
          fc.name === 'draw_shapes'
            ? enrichDrawShapesToolArgs(fc.args, result)
            : fc.name === 'clear_agent_drawings' && result.ok && result.result !== undefined
              ? {
                  ...fc.args,
                  _removedShapeIds: (result.result as { removedShapeIds?: unknown }).removedShapeIds,
                }
              : fc.args;
        ledger.record(fc.name, completeArgs, result.ok);
        toolCalls.push({ name: fc.name, args: completeArgs, ok: result.ok });
        onProgress?.({
          type: 'tool-complete',
          name: fc.name,
          args: completeArgs,
          ok: result.ok,
          error: result.ok ? undefined : result.error,
        });
        roundResults.push({ name: fc.name, ok: result.ok });

        if (result.ok && DIAGRAM_REPAIR_TOOLS.has(fc.name)) {
          repairToolsUsed.add(fc.name);
        }

        if (isSuccessfulDiagramDraw(fc.name, completeArgs, result.ok)) {
          diagramDrawnThisTurn = true;
          const layout = completeArgs.layout;
          if (
            layout === 'flow' ||
            layout === 'timeline' ||
            layout === 'radial' ||
            layout === 'nested'
          ) {
            lastDiagramLayout = layout;
          }
        }

        if (fc.name === 'draw_shapes') {
          if (result.ok) {
            consecutiveDrawFailures = 0;
          } else {
            consecutiveDrawFailures += 1;
            if (consecutiveDrawFailures >= MAX_CONSECUTIVE_DRAW_FAILURES) {
              return finishAfterDrawFailures(result.error);
            }
          }
        }

        if (fc.name === 'draw_shapes' && result.ok) {
          const createdIds = Array.isArray(completeArgs._createdShapeIds)
            ? completeArgs._createdShapeIds.filter((id): id is string => typeof id === 'string')
            : [];
          lastDrawCreatedIds = createdIds;
          const groupableIds = filterGroupableSiblingIds(createdIds);
          if (groupableIds.length >= 2) {
            const groupArgs = { shapeIds: groupableIds };
            const groupResult = await autoGroupCreatedShapes(
              toolContext,
              groupableIds,
              postDrawProgressHooks,
            );
            ledger.record('group_shapes', groupArgs, groupResult.ok);
          }
        }
        // Mirror to host page so chat UI can render an inline tool-call
        // card. Voice path dispatches the same event from the live
        // client; chat-side unifies the surface.
        window.dispatchEvent(
          new CustomEvent('landi:tool-call', {
            detail: { name: fc.name, args: completeArgs, ok: result.ok, source: 'chat' },
            bubbles: true,
            composed: true,
          }),
        );
        let responsePayload: Record<string, unknown> = result.ok
          ? { output: result.result }
          : { error: result.error };
        // A screenshot result is an image, not text: base64 inside the
        // functionResponse JSON is invisible to the model and enormous.
        // Strip it there and attach it as a real inlineData image part so
        // the model actually sees the canvas it asked about.
        if (fc.name === 'screenshot_canvas' && result.ok) {
          const base64 = extractBase64Png(
            (result.result as { dataUrl?: unknown } | undefined)?.dataUrl,
          );
          if (base64 !== null) {
            screenshotParts.push({
              inlineData: { mimeType: 'image/png', data: base64 },
            });
            responsePayload = {
              output: {
                ...(result.result as Record<string, unknown>),
                dataUrl: '(attached as an image in the next message)',
              },
            };
          }
        }
        responseParts.push({
          functionResponse: {
            id: fc.id,
            name: fc.name,
            response: responsePayload,
          },
        });
      }

      // Append the function responses so the next generate call has them.
      contents.push({
        role: 'user',
        parts: responseParts,
      });

      // Deliver any model-requested screenshots as real images.
      if (screenshotParts.length > 0) {
        contents.push({
          role: 'user',
          parts: [
            { text: '[Screenshot] The requested canvas capture is attached.' },
            ...screenshotParts,
          ],
        });
      }

      // See-and-fix loop: after a round that drew on the canvas, show the
      // model its own work (screenshot plus layout lints) so it can correct
      // overlap, chat collisions, and cut-off shapes before replying.
      // Skipped when the model already requested a screenshot this round, or
      // when a diagram path already succeeded with a clean layout probe.
      const drewThisRound = roundResults.some(
        (entry) => entry.ok && CANVAS_DRAW_TOOLS.has(entry.name),
      );
      if (drewThisRound) {
        postDrawReviewComplete = false;
      }
      if (toolCapReached()) {
        return finishWithTextOnlyClosing(
          'Stop calling tools now. In one short sentence, tell the user what you sketched.',
        );
      }
      if (
        drewThisRound &&
        screenshotParts.length === 0 &&
        canvasChecksLeft > 0 &&
        round < maxRoundTrips - 1
      ) {
        throwIfAborted(signal);
        if (lastDiagramLayout === 'nested') {
          dispatchFitChatDrawing(toolCalls, toolContext.agentId);
        }
        let probe = await runLayoutProbe(toolContext, postDrawProgressHooks);
        throwIfAborted(signal);
        if (lastDiagramLayout === 'nested') {
          const repairLayout = resolvePostDrawArrangeLayout(lastDiagramLayout, userMessage);
          const filteredLints = filterBenignNestedDiagramLints(probe.lints, probe.graph);
          if (shouldCompleteNestedDiagramReview(lastDiagramLayout, filteredLints, repairLayout)) {
            postDrawReviewComplete = true;
            layoutFixActive = false;
            continue;
          }
          probe = { ...probe, lints: filteredLints };
        }
        if (probe.lints.length === 0) {
          postDrawReviewComplete = true;
          layoutFixActive = false;
        } else if (diagramDrawnThisTurn) {
          layoutFixActive = true;
          const repairIds = filterGroupableSiblingIds(lastDrawCreatedIds);
          const repairLayout = resolvePostDrawArrangeLayout(lastDiagramLayout, userMessage);
          if (repairIds.length >= 2 && !repairToolsUsed.has('arrange') && repairLayout !== 'skip') {
            const arrangeArgs: Record<string, unknown> = { shapeIds: repairIds, layout: repairLayout };
            if (!toolCapReached()) {
              postDrawProgressHooks.onToolStart('arrange', arrangeArgs);
              const arrangeResult = await withAgentToolContextAsync(toolContext, () =>
                executeTool('arrange', arrangeArgs),
              );
              recordToolExecution();
              postDrawProgressHooks.onToolComplete('arrange', arrangeArgs, arrangeResult.ok);
              ledger.record('arrange', arrangeArgs, arrangeResult.ok);
              repairToolsUsed.add('arrange');
              if (arrangeResult.ok) {
                probe = await runLayoutProbe(toolContext, postDrawProgressHooks);
                if (probe.lints.length === 0) {
                  layoutFixActive = false;
                  postDrawReviewComplete = true;
                }
              }
            }
          }
          if (postDrawReviewComplete) {
            continue;
          }
          if (canvasChecksLeft > 0 && !toolCapReached()) {
            const check = await captureCanvasCheck(toolContext, postDrawProgressHooks, probe);
            if (check !== null) {
              canvasChecksLeft -= 1;
              dropStaleCanvasChecks(contents);
              contents.push(check);
            }
          }
        } else {
          layoutFixActive = true;
          const repairIds = filterGroupableSiblingIds(lastDrawCreatedIds);
          const repairLayout = resolvePostDrawArrangeLayout(undefined, userMessage);
          if (repairIds.length >= 2 && repairLayout !== 'skip') {
            const arrangeArgs: Record<string, unknown> = { shapeIds: repairIds, layout: repairLayout };
            postDrawProgressHooks.onToolStart('arrange', arrangeArgs);
            const arrangeResult = await withAgentToolContextAsync(toolContext, () =>
              executeTool('arrange', arrangeArgs),
            );
            recordToolExecution();
            postDrawProgressHooks.onToolComplete('arrange', arrangeArgs, arrangeResult.ok);
            ledger.record('arrange', arrangeArgs, arrangeResult.ok);
            if (arrangeResult.ok) {
              probe = await runLayoutProbe(toolContext, postDrawProgressHooks);
              if (probe.lints.length === 0) {
                layoutFixActive = false;
                postDrawReviewComplete = true;
              }
            }
          }
          const check = await captureCanvasCheck(toolContext, postDrawProgressHooks, probe);
          if (check !== null) {
            canvasChecksLeft -= 1;
            dropStaleCanvasChecks(contents);
            contents.push(check);
          }
        }
      }
    }

    // Hit the round-trip cap. Close the turn with one text-only round so the
    // user gets a real sentence about what was drawn instead of an internal
    // limit message.
    return finishWithTextOnlyClosing(
      'Stop drawing now. In one short sentence, tell the user what you sketched.',
    );
    }),
    );
  }

  return { send };
}
