/**
 * Gemini text chat client — companion to `geminiLiveClient` for the
 * non-voice modality. Uses the same `@google/genai` SDK and the same
 * canvas tool registry, so a chat user has the same agent capabilities
 * as a voice user.
 *
 * Why a thin module instead of CopilotKit:
 *   M2.5 ships without the CopilotKit runtime (deferred to M3 per plan).
 *   We want functional chat now — and the registry boundary we're putting
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
} from '../tools/canvasTools';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  /** Plain-text body. Voice transcripts are stored as text too. */
  text: string;
  /** Source — distinguishes voice transcript echoes from typed messages. */
  source?: 'text' | 'voice' | 'tool';
  /** When source === 'tool', this carries the call summary. */
  toolCall?: { name: string; args: Record<string, unknown>; ok: boolean };
  /** ISO timestamp. */
  createdAt: string;
}

export type ApiKeySource = string | (() => Promise<string>);

export interface ChatClientOptions {
  /** API credential source (static key or token thunk). */
  apiKeySource: ApiKeySource;
  /** System instruction passed to every generation. */
  systemInstruction: string;
  /** Model id. Defaults to `gemini-2.5-flash`. */
  model?: string;
  /** Max tool-call → response → generate loops per turn. Default 4. */
  maxToolRoundTrips?: number;
}

export interface ChatTurnResult {
  /** Final assistant text. Empty string if the model only emitted tool calls. */
  text: string;
  /** Tool calls executed during this turn (in order). */
  toolCalls: Array<{ name: string; args: Record<string, unknown>; ok: boolean }>;
}

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_MAX_ROUND_TRIPS = 4;

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
      // Skip — tool calls are already in the history as model functionCall
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

  // Convert canvas tool declarations to Gemini's FunctionDeclaration shape.
  // Cached at module init — declarations don't change at runtime.
  const functionDeclarations = getFunctionDeclarations().map((d: ToolDeclaration) => ({
    name: d.name,
    description: d.description,
    parametersJsonSchema: d.parameters,
  }));

  async function send(
    history: ChatMessage[],
    userMessage: string,
  ): Promise<ChatTurnResult> {
    const apiKey =
      typeof options.apiKeySource === 'function'
        ? await options.apiKeySource()
        : options.apiKeySource;
    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });

    // Working contents: history → user message, then we may append model
    // turns + tool responses across the round-trip loop.
    const contents: Content[] = [
      ...buildContents(history),
      { role: 'user', parts: [{ text: userMessage }] },
    ];

    const toolCalls: ChatTurnResult['toolCalls'] = [];

    for (let round = 0; round < maxRoundTrips; round++) {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: options.systemInstruction,
          tools: [{ functionDeclarations }],
        },
      });

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

      // No tool calls → final answer, return.
      if (functionCalls.length === 0) {
        return { text: textOut.trim(), toolCalls };
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
      for (const fc of functionCalls) {
        const result = await executeTool(fc.name, fc.args);
        toolCalls.push({ name: fc.name, args: fc.args, ok: result.ok });
        // Mirror to host page so chat UI can render an inline tool-call
        // card. Voice path dispatches the same event from the live
        // client; chat-side unifies the surface.
        window.dispatchEvent(
          new CustomEvent('landi:tool-call', {
            detail: { name: fc.name, args: fc.args, ok: result.ok, source: 'chat' },
            bubbles: true,
            composed: true,
          }),
        );
        responseParts.push({
          functionResponse: {
            id: fc.id,
            name: fc.name,
            response: result.ok
              ? { output: result.result }
              : { error: result.error },
          },
        });
      }

      // Append the function responses so the next generate call has them.
      contents.push({
        role: 'user',
        parts: responseParts,
      });
    }

    // Hit the round-trip cap — return what we have. The transcript will
    // include the tool calls so the user sees what happened, even if the
    // final text is empty.
    return { text: '(tool round-trip limit reached)', toolCalls };
  }

  return { send };
}
