/**
 * Operator chat bridge — sends composer messages through the operator agent
 * tool context (scope). Does not publish into page session.
 */
import { createChatClient, type ChatMessage, type ChatSendProgressEvent, formatToolReasoningStatus } from '../../chat/geminiChatClient';
import { formatToolCallLabel } from '../../chat/toolCallLabels';
import { runSharedPostDrawRepairPipeline, resolvePostDrawArrangeLayout } from '../../chat/postDrawCanvasGrouping';
import type { AgentDiagramLayoutMode } from '../../engine/agentDrawingTypes';
import {
  buildDiagramIntentHint,
  CANVAS_DRAW_QUALITY_INSTRUCTIONS,
} from '../../chat/canvasDrawQualityInstructions';
import { createWhiteboardChatClientOptions } from '../../chat/whiteboardChatCredentials';
import { withDrawUserMessageAsync } from '../../chat/drawIntentContext';
import { withAgentToolContextAsync } from '../agentContext';
import { OPERATOR_TOOL_CONTEXT } from './operatorRegistrationBridge';
import type { OperatorOutboundAttachment } from './operatorAttachments';
import { resolveOperatorLiveChatEnabled } from './operatorChatEndpoint';
import { runOperatorOfflineFallback } from './operatorOfflineFallback';
import { summarizeCanvasViaWhiteboardHost } from './operatorCanvasSummary';
import { runOperatorModeOfflineAction, isOperatorDrawIntent } from './operatorModeOfflineActions';
import { isOperatorDrawCapableMode } from './operatorModeScope';
import {
  dispatchFitOperatorDrawing,
  readOperatorDrawShapeEvidence,
  resolveOperatorProbeReadRegion,
  verifyOperatorDrawVisibility,
  waitForDrawCameraSettle,
  buildDrawFailureMessage,
} from './operatorDrawVerification';
import { countOperatorPageShapes } from './operatorDrawPersistence';
import type {
  OperatorAttachmentRef,
  OperatorMessage,
  OperatorReasoningMessage,
  OperatorTextMessage,
  OperatorThread,
  OperatorToolMessage,
  OperatorMode,
} from './types';
import { isOperatorTextMessage } from './types';

const DEFAULT_OPERATOR_SYSTEM =
  'You are the canvas-wide operator agent. Respect Auto/Ask/Build/Draw mode tool scope. Be concise.';

/** Per-thread abort controllers for in-flight live chat turns. */
const activeAbortControllers = new Map<string, AbortController>();

/** Abort an in-flight operator message for the given thread (Stop button). */
export function abortOperatorMessage(threadId: string): void {
  activeAbortControllers.get(threadId)?.abort();
}

/** Abort in-flight generation and return threads with `generating: false` for immediate UI. */
export function forceStopOperatorThread(
  threadId: string,
  threads: readonly OperatorThread[],
): OperatorThread[] {
  abortOperatorMessage(threadId);
  return setThreadGenerating([...threads], threadId, false);
}

function beginThreadAbortController(threadId: string): AbortController {
  activeAbortControllers.get(threadId)?.abort();
  const controller = new AbortController();
  activeAbortControllers.set(threadId, controller);
  return controller;
}

function endThreadAbortController(threadId: string): void {
  activeAbortControllers.delete(threadId);
}

function setThreadGenerating(
  threads: OperatorThread[],
  threadId: string,
  generating: boolean,
): OperatorThread[] {
  return threads.map((thread) =>
    thread.id === threadId ? { ...thread, generating } : thread,
  );
}

/** Gallery-safe tools that bypass live chat (deterministic whiteboard host path). */
const DETERMINISTIC_OPERATOR_TOOL_NAMES = new Set(['read_canvas', 'open_panel']);

function shouldBypassLiveChatForModeAction(
  action: Awaited<ReturnType<typeof runOperatorModeOfflineAction>>,
  liveChatEnabled: boolean,
  mode: OperatorMode,
  userText: string,
): action is NonNullable<Awaited<ReturnType<typeof runOperatorModeOfflineAction>>> {
  if (action === null) {
    return false;
  }
  if (mode === 'ask' && isOperatorDrawIntent(userText) && action.toolName === undefined) {
    return true;
  }
  if (
    action.toolName !== undefined &&
    DETERMINISTIC_OPERATOR_TOOL_NAMES.has(action.toolName)
  ) {
    return true;
  }
  if (isOperatorDrawCapableMode(mode) && action.toolName === 'clear_agent_drawings') {
    return true;
  }
  if (isOperatorDrawCapableMode(mode) && action.toolName === 'draw_shapes' && action.toolOk === false) {
    return true;
  }
  return !liveChatEnabled;
}

interface WhiteboardScriptedHost extends HTMLElement {
  runScriptedTool?: (
    toolName: 'read_canvas',
    args?: Record<string, unknown>,
  ) => Promise<{ ok: boolean; result?: unknown; error?: string }>;
  whenReady?: (timeoutMs?: number) => Promise<boolean>;
}

async function resolveWhiteboardHostForDrawVerify(): Promise<{
  host: WhiteboardScriptedHost;
  ready: boolean;
} | null> {
  const whiteboard = document.querySelector('agentable-whiteboard');
  if (!(whiteboard instanceof HTMLElement)) {
    return null;
  }
  const host = whiteboard as WhiteboardScriptedHost;
  if (typeof host.whenReady !== 'function') {
    return { host, ready: false };
  }
  const ready = await host.whenReady(10_000);
  return { host, ready };
}

async function appendPostDrawLayoutReviewMessages(
  toolMessages: OperatorToolMessage[],
  drawIndex: number,
): Promise<OperatorToolMessage[]> {
  const drawMessage = toolMessages[drawIndex];
  const createdFromArgs = Array.isArray(drawMessage?.args._createdShapeIds)
    ? drawMessage.args._createdShapeIds.filter((id): id is string => typeof id === 'string')
    : [];

  const drawLayout =
    typeof drawMessage?.args.layout === 'string'
      ? (drawMessage.args.layout as AgentDiagramLayoutMode)
      : undefined;
  const repairLayout = resolvePostDrawArrangeLayout(drawLayout);

  const repair = await runSharedPostDrawRepairPipeline(
    OPERATOR_TOOL_CONTEXT,
    createdFromArgs,
    undefined,
    repairLayout,
  );

  const extraMessages: OperatorToolMessage[] = repair.steps.map((step) => ({
    id: createMessageId('op_tool'),
    role: 'assistant',
    kind: 'tool',
    toolName: step.toolName,
    args: step.args,
    ok: step.ok,
    timestamp: new Date().toISOString(),
  }));

  return [
    ...toolMessages.slice(0, drawIndex + 1),
    ...extraMessages,
    ...toolMessages.slice(drawIndex + 1),
  ];
}

async function postVerifyDrawToolMessages(
  toolMessages: OperatorToolMessage[],
): Promise<OperatorToolMessage[]> {
  const drawIndex = toolMessages.findIndex(
    (message) => message.toolName === 'draw_shapes' && message.ok,
  );
  if (drawIndex < 0) {
    return toolMessages;
  }

  const hostResolved = await resolveWhiteboardHostForDrawVerify();
  const drawMessage = toolMessages[drawIndex];
  if (drawMessage === undefined) {
    return toolMessages;
  }

  if (hostResolved === null || !hostResolved.ready) {
    const failedMessage: OperatorToolMessage = {
      ...drawMessage,
      ok: false,
      args: {
        ...drawMessage.args,
        _whiteboardNotReady: true,
      },
    };
    return toolMessages.map((message, index) => (index === drawIndex ? failedMessage : message));
  }

  const host = hostResolved.host;

  dispatchFitOperatorDrawing();
  await waitForDrawCameraSettle();

  const readRegion = await resolveOperatorProbeReadRegion(host);
  const shapesAfterDraw = await readOperatorDrawShapeEvidence(host, readRegion);
  const createdFromArgs = Array.isArray(drawMessage.args._createdShapeIds)
    ? drawMessage.args._createdShapeIds.filter((id): id is string => typeof id === 'string')
    : [];
  const shapesBeforeDraw =
    drawMessage.args._shapesBeforeDraw &&
    typeof drawMessage.args._shapesBeforeDraw === 'object' &&
    drawMessage.args._shapesBeforeDraw !== null &&
    typeof (drawMessage.args._shapesBeforeDraw as { count?: unknown }).count === 'number'
      ? {
          count: (drawMessage.args._shapesBeforeDraw as { count: number }).count,
          blueGeo:
            typeof (drawMessage.args._shapesBeforeDraw as { blueGeo?: unknown }).blueGeo === 'number'
              ? (drawMessage.args._shapesBeforeDraw as { blueGeo: number }).blueGeo
              : 0,
        }
      : null;
  const pageShapeCountBefore =
    typeof drawMessage.args._pageShapeCountBefore === 'number'
      ? drawMessage.args._pageShapeCountBefore
      : undefined;
  const storeFromArgs = drawMessage.args._store;
  const drawResult = {
    ok: drawMessage.ok,
    result: {
      createdShapeIds: createdFromArgs,
      ...(storeFromArgs !== undefined &&
      typeof storeFromArgs === 'object' &&
      storeFromArgs !== null
        ? { _store: storeFromArgs }
        : {}),
    },
  };

  const verdict = verifyOperatorDrawVisibility({
    drawResult,
    shapesBeforeDraw,
    shapesAfterDraw,
    pageShapeCountBefore,
  });

  if (verdict.visibleOnCanvas) {
    const drawLayout =
      typeof drawMessage.args.layout === 'string'
        ? (drawMessage.args.layout as AgentDiagramLayoutMode)
        : undefined;
    if (drawLayout === 'nested') {
      // Live chat already ran group/read/screenshot for nested diagrams.
      return toolMessages;
    }
    return appendPostDrawLayoutReviewMessages(toolMessages, drawIndex);
  }

  const failedMessage: OperatorToolMessage = {
    ...drawMessage,
    ok: false,
    args: {
      ...drawMessage.args,
      _createdShapeIds: verdict.createdShapeIds.length > 0 ? verdict.createdShapeIds : createdFromArgs,
      _shapesAfterDraw: shapesAfterDraw,
      _store: verdict.storeEvidence,
      _verifyFailure: buildDrawFailureMessage(drawResult, verdict),
    },
  };

  return toolMessages.map((message, index) => (index === drawIndex ? failedMessage : message));
}

async function appendVerifiedAssistantReply(
  threads: OperatorThread[],
  activeThreadId: string,
  assistantText: string,
  toolMessages: OperatorToolMessage[],
): Promise<OperatorThread[]> {
  const verifiedTools = await postVerifyDrawToolMessages(toolMessages);
  const drawFailed = verifiedTools.some(
    (message) => message.toolName === 'draw_shapes' && !message.ok,
  );
  const drawSucceeded = verifiedTools.some(
    (message) => message.toolName === 'draw_shapes' && message.ok,
  );

  let text = assistantText;
  if (drawFailed && drawSucceeded === false && /drew|draw_shapes|rectangle|visible on the canvas/i.test(text)) {
    text = assistantText.toLowerCase().includes('draw failed')
      ? assistantText
      : 'Draw failed: shape was created but is not visible in the viewport.';
  }

  return appendAssistantReply(threads, activeThreadId, text, verifiedTools);
}

function createMessageId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

const DRAW_MODE_SYSTEM_LINES = CANVAS_DRAW_QUALITY_INSTRUCTIONS;

const AUTO_MODE_SYSTEM_LINES = [
  'Auto mode: you may ask (read-only), build (panels/structure), OR draw on the canvas as user intent requires.',
  CANVAS_DRAW_QUALITY_INSTRUCTIONS,
].join(' ');

function resolveOperatorSystemInstruction(mode: OperatorMode, userText?: string): string {
  const whiteboard = document.querySelector('agentable-whiteboard');
  const modeLine = `Current operator mode: ${mode}. Only use tools allowed in this mode.`;
  const diagramHint =
    userText !== undefined && (mode === 'auto' || mode === 'draw')
      ? buildDiagramIntentHint(userText)
      : '';
  const capabilityLines =
    mode === 'auto'
      ? `\n\n${AUTO_MODE_SYSTEM_LINES}${diagramHint}`
      : mode === 'draw'
        ? `\n\n${DRAW_MODE_SYSTEM_LINES}${diagramHint}`
        : '';
  if (!(whiteboard instanceof HTMLElement)) {
    return `${DEFAULT_OPERATOR_SYSTEM}\n\n${modeLine}${capabilityLines}`;
  }
  const prompt = whiteboard.getAttribute('system-prompt')?.trim();
  if (prompt && prompt.length > 0) {
    return `${DEFAULT_OPERATOR_SYSTEM}\n\n${modeLine}${capabilityLines}\n\n${prompt}`;
  }
  return `${DEFAULT_OPERATOR_SYSTEM}\n\n${modeLine}${capabilityLines}`;
}

function appendMessage(
  threads: readonly OperatorThread[],
  activeThreadId: string,
  message: OperatorMessage,
): OperatorThread[] {
  return threads.map((thread) =>
    thread.id === activeThreadId
      ? { ...thread, messages: [...thread.messages, message] }
      : thread,
  );
}

function operatorMessagesToChatHistory(messages: readonly OperatorMessage[]): ChatMessage[] {
  const history: ChatMessage[] = [];
  for (const message of messages) {
    if (!isOperatorTextMessage(message)) {
      continue;
    }
    if (message.role === 'system') {
      continue;
    }
    history.push({
      id: message.id,
      role: message.role === 'assistant' ? 'assistant' : 'user',
      text: message.text,
      source: 'text',
      createdAt: message.timestamp,
    });
  }
  return history;
}

function appendAssistantReply(
  threads: OperatorThread[],
  activeThreadId: string,
  assistantText: string,
  toolMessages?: readonly OperatorToolMessage[],
  reasoningMessage?: OperatorReasoningMessage,
): OperatorThread[] {
  let nextThreads = threads;
  if (reasoningMessage !== undefined) {
    nextThreads = appendMessage(nextThreads, activeThreadId, reasoningMessage);
  }
  for (const toolMessage of toolMessages ?? []) {
    nextThreads = appendMessage(nextThreads, activeThreadId, toolMessage);
  }
  const assistantMessage: OperatorTextMessage = {
    id: createMessageId('op_a'),
    role: 'assistant',
    kind: 'text',
    text: assistantText,
    timestamp: new Date().toISOString(),
  };
  return appendMessage(nextThreads, activeThreadId, assistantMessage);
}

async function resolveOfflineAssistantReply(
  userText: string,
  mode: OperatorMode,
): Promise<{
  text: string;
  toolMessages: OperatorToolMessage[];
}> {
  const fallback = await runOperatorOfflineFallback({ userText, mode });
  const toolMessages: OperatorToolMessage[] = [];
  if (fallback.toolName !== undefined) {
    toolMessages.push({
      id: createMessageId('op_tool'),
      role: 'assistant',
      kind: 'tool',
      toolName: fallback.toolName,
      args: fallback.toolArgs ?? {},
      ok: fallback.toolOk === true,
      timestamp: new Date().toISOString(),
    });
  }
  return { text: fallback.text, toolMessages };
}

function toAttachmentRefs(
  attachments: readonly OperatorOutboundAttachment[],
): OperatorAttachmentRef[] {
  return attachments.map((attachment) => ({
    id: createMessageId('op_att'),
    name: attachment.label,
    mimeType: attachment.mimeType,
  }));
}

const REASONING_PLACEHOLDER = 'Working…';

function buildReasoningMessage(text: string, streaming: boolean): OperatorReasoningMessage {
  return {
    id: createMessageId('op_r'),
    role: 'assistant',
    kind: 'reasoning',
    text,
    timestamp: new Date().toISOString(),
    streaming,
  };
}

export interface SendOperatorMessageInput {
  text: string;
  threads: readonly OperatorThread[];
  activeThreadId: string;
  mode: OperatorMode;
  attachments?: readonly OperatorOutboundAttachment[];
 /** Push partial thread state during live chat (streaming UX). */
  onThreadsUpdate?: (threads: OperatorThread[]) => void;
}

export interface SendOperatorMessageResult {
  threads: OperatorThread[];
  error?: string;
}

/** Append a user turn to the active thread and attempt an operator-scoped reply. */
export async function sendOperatorMessage(
  input: SendOperatorMessageInput,
): Promise<SendOperatorMessageResult> {
  const trimmed = input.text.trim();
  const hasAttachments = (input.attachments?.length ?? 0) > 0;
  if (!trimmed && !hasAttachments) {
    return { threads: [...input.threads] };
  }

  const activeThread = input.threads.find((thread) => thread.id === input.activeThreadId);
  if (activeThread === undefined) {
    return { threads: [...input.threads], error: 'Active thread not found.' };
  }

  const timestamp = new Date().toISOString();
  const userMessage: OperatorTextMessage = {
    id: createMessageId('op_u'),
    role: 'user',
    kind: 'text',
    text: trimmed || '(attachment)',
    timestamp,
    attachments:
      input.attachments && input.attachments.length > 0
        ? toAttachmentRefs(input.attachments)
        : undefined,
  };

  let nextThreads = appendMessage(input.threads, input.activeThreadId, userMessage);

  const abortController = beginThreadAbortController(input.activeThreadId);
  const signal = abortController.signal;
  let reasoningRevealHandle: ReturnType<typeof setTimeout> | null = null;

  const clearReasoningRevealHandle = (): void => {
    if (reasoningRevealHandle !== null) {
      clearTimeout(reasoningRevealHandle);
      reasoningRevealHandle = null;
    }
  };

  const markGenerating = (generating: boolean): void => {
    nextThreads = setThreadGenerating(nextThreads, input.activeThreadId, generating);
    input.onThreadsUpdate?.([...nextThreads]);
  };

  const finish = (result: SendOperatorMessageResult): SendOperatorMessageResult => ({
    ...result,
    threads: setThreadGenerating(result.threads, input.activeThreadId, false),
  });

  markGenerating(true);

  try {
    const liveChatEnabled = resolveOperatorLiveChatEnabled();
    const modeAction = await withDrawUserMessageAsync(trimmed, () =>
      runOperatorModeOfflineAction(trimmed, input.mode),
    );
    if (shouldBypassLiveChatForModeAction(modeAction, liveChatEnabled, input.mode, trimmed)) {
      const toolMessages: OperatorToolMessage[] = [];
      if (modeAction.toolName !== undefined) {
        toolMessages.push({
          id: createMessageId('op_tool'),
          role: 'assistant',
          kind: 'tool',
          toolName: modeAction.toolName,
          args: modeAction.toolArgs ?? {},
          ok: modeAction.toolOk === true,
          timestamp: new Date().toISOString(),
        });
      }
      nextThreads = await appendVerifiedAssistantReply(
        nextThreads,
        input.activeThreadId,
        modeAction.text,
        toolMessages,
      );
      return finish({ threads: nextThreads });
    }

    const localSummary = await summarizeCanvasViaWhiteboardHost(trimmed);
    if (localSummary !== null) {
      nextThreads = appendAssistantReply(nextThreads, input.activeThreadId, localSummary, [
        {
          id: createMessageId('op_tool'),
          role: 'assistant',
          kind: 'tool',
          toolName: 'read_canvas',
          args: {},
          ok: true,
          timestamp: new Date().toISOString(),
        },
      ]);
      return finish({ threads: nextThreads });
    }

    if (!resolveOperatorLiveChatEnabled()) {
      const offline = await resolveOfflineAssistantReply(trimmed, input.mode);
      nextThreads = appendAssistantReply(
        nextThreads,
        input.activeThreadId,
        offline.text,
        offline.toolMessages,
      );
      return finish({ threads: nextThreads });
    }

    const clientOptions = createWhiteboardChatClientOptions({
      systemInstruction: resolveOperatorSystemInstruction(input.mode, trimmed),
      toolContext: OPERATOR_TOOL_CONTEXT,
    });

    if (clientOptions === null) {
      const offline = await resolveOfflineAssistantReply(trimmed, input.mode);
      nextThreads = appendAssistantReply(
        nextThreads,
        input.activeThreadId,
        offline.text,
        offline.toolMessages,
      );
      return finish({ threads: nextThreads });
    }

    const chatClient = createChatClient(clientOptions);
    const history = operatorMessagesToChatHistory(activeThread.messages);

    const drawPageCountBefore =
      isOperatorDrawCapableMode(input.mode) && isOperatorDrawIntent(trimmed)
        ? countOperatorPageShapes()
        : undefined;

    const streamingReasoning = buildReasoningMessage(REASONING_PLACEHOLDER, true);
    nextThreads = appendMessage(nextThreads, input.activeThreadId, streamingReasoning);
    input.onThreadsUpdate?.([...nextThreads]);

    const pushThreads = (threads: OperatorThread[]): void => {
      nextThreads = threads;
      input.onThreadsUpdate?.([...threads]);
    };

    const pendingToolMessageIds: string[] = [];

    const patchReasoningMessage = (text: string, streaming: boolean): void => {
      pushThreads(
        nextThreads.map((thread) =>
          thread.id === input.activeThreadId
            ? {
                ...thread,
                messages: thread.messages.map((message) =>
                  message.id === streamingReasoning.id && message.kind === 'reasoning'
                    ? {
                        ...message,
                        text,
                        streaming,
                      }
                    : message,
                ),
              }
            : thread,
        ),
      );
    };

    const revealReasoningIncrementally = (fullText: string, streaming: boolean): void => {
      clearReasoningRevealHandle();
      const normalized = fullText.trim();
      if (!streaming || normalized.length === 0) {
        patchReasoningMessage(normalized.length > 0 ? normalized : REASONING_PLACEHOLDER, streaming);
        return;
      }
      // Stream model text immediately — word-chunk reveal only for long prose.
      if (normalized.length <= 96) {
        patchReasoningMessage(normalized, streaming);
        return;
      }
      const tokens = normalized.match(/\S+\s*/g) ?? [normalized];
      let index = 0;
      let shown = '';
      const tick = (): void => {
        if (signal.aborted) {
          return;
        }
        if (index >= tokens.length) {
          patchReasoningMessage(normalized, streaming);
          return;
        }
        shown += tokens[index] ?? '';
        index += 1;
        patchReasoningMessage(shown, true);
        if (index < tokens.length) {
          reasoningRevealHandle = setTimeout(tick, 28);
        } else {
          patchReasoningMessage(normalized, streaming);
        }
      };
      tick();
    };

    const appendToolReasoningStatus = (toolName: string): void => {
      const status = formatToolReasoningStatus(toolName);
      const active = nextThreads.find((thread) => thread.id === input.activeThreadId);
      const currentReasoning = active?.messages.find(
        (message) => message.id === streamingReasoning.id && message.kind === 'reasoning',
      );
      const prior =
        currentReasoning?.kind === 'reasoning' &&
        currentReasoning.text.trim().length > 0 &&
        currentReasoning.text !== REASONING_PLACEHOLDER
          ? currentReasoning.text.trim()
          : '';
      const merged = prior.length > 0 ? `${prior}\n${status}` : status;
      patchReasoningMessage(merged, true);
    };

    const applyChatProgress = (event: ChatSendProgressEvent): void => {
      if (signal.aborted) {
        return;
      }
      if (event.type === 'reasoning') {
        revealReasoningIncrementally(event.text, event.streaming);
        return;
      }

      if (event.type === 'tool-start') {
        appendToolReasoningStatus(event.name);
        const toolMessage: OperatorToolMessage = {
          id: createMessageId('op_tool'),
          role: 'assistant',
          kind: 'tool',
          toolName: event.name,
          args: event.args,
          ok: true,
          timestamp: new Date().toISOString(),
        };
        pendingToolMessageIds.push(toolMessage.id);
        pushThreads(appendMessage(nextThreads, input.activeThreadId, toolMessage));
        return;
      }

      if (event.type === 'tool-complete') {
        const targetId = pendingToolMessageIds.shift();
        if (targetId === undefined) {
          return;
        }
        pushThreads(
          nextThreads.map((thread) =>
            thread.id === input.activeThreadId
              ? {
                  ...thread,
                  messages: thread.messages.map((message) => {
                    if (message.id !== targetId || message.kind !== 'tool') {
                      return message;
                    }
                    return {
                      ...message,
                      ok: event.ok,
                      error: event.error,
                      args:
                        event.name === 'draw_shapes' && drawPageCountBefore !== undefined
                          ? { ...event.args, _pageShapeCountBefore: drawPageCountBefore }
                          : event.args,
                    };
                  }),
                }
              : thread,
          ),
        );
        return;
      }

      if (event.type === 'text-chunk' && event.text.trim().length > 0 && !event.final) {
        pushThreads(
          nextThreads.map((thread) =>
            thread.id === input.activeThreadId
              ? {
                  ...thread,
                  messages: thread.messages.flatMap((message) => {
                    if (message.id !== streamingReasoning.id || message.kind !== 'reasoning') {
                      return [message];
                    }
                    return [
                      {
                        ...message,
                        streaming: false,
                        text: event.text,
                      } satisfies OperatorReasoningMessage,
                    ];
                  }),
                }
              : thread,
          ),
        );
      }
    };

    try {
      const result = await withAgentToolContextAsync(OPERATOR_TOOL_CONTEXT, () =>
        chatClient.send(history, trimmed || 'Review the attached file.', {
          attachmentInlineData: input.attachments?.map((attachment) => ({
            mimeType: attachment.mimeType,
            data: attachment.data,
          })),
          onProgress: applyChatProgress,
          signal,
        }),
      );

      const reasoningText = result.reasoning?.trim() ?? '';
      nextThreads = nextThreads.map((thread) =>
        thread.id === input.activeThreadId
          ? {
              ...thread,
              messages: thread.messages.flatMap((message) => {
                if (message.id !== streamingReasoning.id || message.kind !== 'reasoning') {
                  return [message];
                }
                const streamedText = message.text.trim();
                const finalText =
                  reasoningText.length > 0
                    ? reasoningText
                    : streamedText.length > 0 && streamedText !== REASONING_PLACEHOLDER
                      ? streamedText
                      : '';
                if (finalText.length === 0) {
                  return [];
                }
                return [
                  {
                    ...message,
                    streaming: false,
                    text: finalText,
                  } satisfies OperatorReasoningMessage,
                ];
              }),
            }
          : thread,
      );

      const activeAfterStream = nextThreads.find((thread) => thread.id === input.activeThreadId);
      const streamedToolMessages: OperatorToolMessage[] =
        activeAfterStream?.messages.filter(
          (message): message is OperatorToolMessage =>
            message.kind === 'tool' && message.timestamp >= streamingReasoning.timestamp,
        ) ?? [];

      const fallbackToolMessages: OperatorToolMessage[] = result.toolCalls.map((toolCall) => ({
        id: createMessageId('op_tool'),
        role: 'assistant' as const,
        kind: 'tool' as const,
        toolName: toolCall.name,
        args:
          toolCall.name === 'draw_shapes' && drawPageCountBefore !== undefined
            ? { ...toolCall.args, _pageShapeCountBefore: drawPageCountBefore }
            : toolCall.args,
        ok: toolCall.ok,
        timestamp: new Date().toISOString(),
      }));

      const toolMessagesForVerify =
        streamedToolMessages.length > 0 ? streamedToolMessages : fallbackToolMessages;

      const lastToolCall = result.toolCalls[result.toolCalls.length - 1];
      const assistantText =
        result.text.trim() ||
        formatToolCallLabel(
          lastToolCall?.name ?? 'tool',
          lastToolCall?.args ?? {},
          lastToolCall?.ok ?? true,
        );

      if (streamedToolMessages.length > 0) {
        const verifiedTools = await postVerifyDrawToolMessages(toolMessagesForVerify);
        const drawFailed = verifiedTools.some(
          (message) => message.toolName === 'draw_shapes' && !message.ok,
        );
        const drawSucceeded = verifiedTools.some(
          (message) => message.toolName === 'draw_shapes' && message.ok,
        );
        let text = assistantText;
        if (
          drawFailed &&
          drawSucceeded === false &&
          /drew|draw_shapes|rectangle|visible on the canvas/i.test(text)
        ) {
          text = assistantText.toLowerCase().includes('draw failed')
            ? assistantText
            : 'Draw failed: shape was created but is not visible in the viewport.';
        }

        nextThreads = nextThreads.map((thread) => {
          if (thread.id !== input.activeThreadId) {
            return thread;
          }
          const withoutStreamedTools = thread.messages.filter(
            (message) =>
              !(message.kind === 'tool' && message.timestamp >= streamingReasoning.timestamp),
          );
          const assistantMessage: OperatorTextMessage = {
            id: createMessageId('op_a'),
            role: 'assistant',
            kind: 'text',
            text,
            timestamp: new Date().toISOString(),
          };
          return {
            ...thread,
            messages: [...withoutStreamedTools, ...verifiedTools, assistantMessage],
          };
        });
        input.onThreadsUpdate?.([...nextThreads]);
        return finish({ threads: nextThreads });
      }

      nextThreads = await appendVerifiedAssistantReply(
        nextThreads,
        input.activeThreadId,
        assistantText,
        toolMessagesForVerify,
      );
      return finish({ threads: nextThreads });
    } catch (err) {
      clearReasoningRevealHandle();
      if (signal.aborted) {
        markGenerating(false);
        nextThreads = nextThreads.map((thread) =>
          thread.id === input.activeThreadId
            ? {
                ...thread,
                messages: thread.messages.filter(
                  (message) =>
                    !(
                      message.kind === 'reasoning' &&
                      message.id === streamingReasoning.id &&
                      message.streaming === true
                    ),
                ),
              }
            : thread,
        );
        return finish({ threads: nextThreads, error: 'Generation stopped.' });
      }

      nextThreads = nextThreads.filter(
        (thread) =>
          thread.id !== input.activeThreadId ||
          !thread.messages.some(
            (message) => message.id === streamingReasoning.id && message.kind === 'reasoning',
          ),
      );

      const offline = await resolveOfflineAssistantReply(trimmed, input.mode);
      nextThreads = appendAssistantReply(
        nextThreads,
        input.activeThreadId,
        offline.text,
        offline.toolMessages,
      );

      const message = err instanceof Error ? err.message : 'Operator chat failed';
      return finish({ threads: nextThreads, error: message });
    }
  } finally {
    clearReasoningRevealHandle();
    markGenerating(false);
    endThreadAbortController(input.activeThreadId);
  }
}
