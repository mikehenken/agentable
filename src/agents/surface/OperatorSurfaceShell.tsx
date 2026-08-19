import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type ReactElement,
} from 'react';
import { Paperclip, X } from 'lucide-react';

import {
  Agent,
  Attachments,
  ChainOfThought,
  Context,
  ModelSelector,
  ModeSelector,
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  Reasoning,
  Response,
  Suggestion,
  Suggestions,
  Task,
  Tool,
  type AttachmentItem,
} from '../../components/ai';

import { Conversation } from '../../components/ui-ai/conversation';

import { Loader } from '../../components/ui-ai/loader';

import { Message, MessageContent } from '../../components/ui-ai/message';

import { cn } from '../../lib/utils';
import { formatToolCallLabel } from '../../chat/toolCallLabels';

import { OperatorA2UITranscriptLite } from './OperatorA2UITranscriptLite';

import { submitOperatorComposerMessage } from './operatorComposer';
import { forceStopOperatorThread } from './operatorChatBridge';
import { OperatorVoiceInput } from './OperatorVoiceInput';
import { OperatorVoiceMount } from './OperatorVoiceMount';

import {
  createOperatorPendingAttachment,
  encodeOperatorAttachments,
  extractImageFilesFromClipboard,
  pendingAttachmentToItem,
  revokeOperatorAttachmentPreviews,
  type OperatorPendingAttachment,
} from './operatorAttachments';

import { OPERATOR_MODE_LABELS, OPERATOR_MODES } from './constants';

import type { AgentableOperatorSurfaceElement } from './operator-surface';

import type {
  OperatorMessage,
  OperatorMode,
  OperatorModelOption,
  OperatorThread,
} from './types';

import {
  isOperatorA2UIMessage,
  isOperatorTextMessage,
} from './types';

import type { AgentChatStatus } from '../../components/ai/types';

export interface OperatorSurfaceShellProps {
  host: AgentableOperatorSurfaceElement;
  activeThreadId: string;
  mode: OperatorMode;
  model: string;
  threads: readonly OperatorThread[];
  modelOptions: readonly OperatorModelOption[];
  modelBridgeActive: boolean;
}

const OPERATOR_SUGGESTIONS = [
  'Summarize the canvas',
  'Wireframe the onboarding flow',
  'Draft a product brief block',
] as const;

const REASONING_PLACEHOLDER = 'Working…';

const shellSurfaceClass =
  'bg-[var(--vibe-background,#121212)] text-[var(--vibe-text,#ececec)]';
const shellBorderClass = 'border-[var(--vibe-border,rgb(255_255_255/0.09))]';
const shellMutedClass = 'text-[var(--vibe-text-muted,#9a9a9a)]';
const shellFaintClass = 'text-[var(--vibe-text-faint,#6f6f6f)]';

function toModeOptions(): import('../../components/ai').ModeOption[] {
  return OPERATOR_MODES.map((entry) => ({
    id: entry,
    label: OPERATOR_MODE_LABELS[entry],
  }));
}

function toModelOptions(options: readonly OperatorModelOption[]): import('../../components/ai').ModelOption[] {
  return options.map((option) => ({
    id: option.alias,
    label: option.label,
    disabled: option.disabled === true,
  }));
}

function composerStatus(busy: boolean): AgentChatStatus {
  return busy ? 'submitted' : 'ready';
}

export function OperatorSurfaceShell({
  host,
  activeThreadId,
  mode,
  model,
  threads,
  modelOptions,
}: OperatorSurfaceShellProps): ReactElement {
  const [draft, setDraft] = useState('');
  const [toastError, setToastError] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<OperatorPendingAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? threads[0],
    [activeThreadId, threads],
  );

  const activeThreadBusy = activeThread?.generating === true;
  const anyThreadGenerating = threads.some((thread) => thread.generating === true);

  const chatAutoScrollKey = useMemo(() => {
    const last = activeThread?.messages[activeThread.messages.length - 1];
    if (!last) {
      return 'empty';
    }
    if (last.kind === 'text') {
      return `${last.id}:${last.text.length}`;
    }
    if (last.kind === 'reasoning') {
      return `${last.id}:${last.streaming ? 'stream' : 'done'}`;
    }
    return last.id;
  }, [activeThread?.messages]);

  const pendingAttachmentItems = useMemo<AttachmentItem[]>(
    () => pendingAttachments.map(pendingAttachmentToItem),
    [pendingAttachments],
  );

  const toolSteps = useMemo(() => {
    if (!activeThread) {
      return [];
    }
    return activeThread.messages
      .filter((message) => message.kind === 'tool')
      .map((message) => ({
        id: message.id,
        toolName: message.toolName,
        status: message.ok ? ('succeeded' as const) : ('failed' as const),
        error: message.error,
        resultSummary: formatToolCallLabel(
          message.toolName,
          message.args,
          message.ok,
          message.error,
        ),
      }));
  }, [activeThread?.messages]);

  const taskItems = useMemo(
    () =>
      toolSteps.map((step) => ({
        id: step.id,
        label: step.toolName.replace(/_/g, ' '),
        status:
          step.status === 'succeeded'
            ? ('done' as const)
            : step.status === 'failed'
              ? ('failed' as const)
              : ('running' as const),
      })),
    [toolSteps],
  );

  const estimatedContextTokens = useMemo(() => {
    if (!activeThread) {
      return 0;
    }
    return activeThread.messages.reduce((total, message) => {
      if (message.kind === 'text') {
        return total + Math.ceil(message.text.length / 4);
      }
      if (message.kind === 'reasoning') {
        return total + Math.ceil(message.text.length / 4);
      }
      if (message.kind === 'tool') {
        return total + 48;
      }
      return total;
    }, 0);
  }, [activeThread]);

  const handleSelectThread = useCallback(
    (threadId: string) => {
      host.selectThread(threadId);
    },
    [host],
  );

  const handleCreateThread = useCallback(() => {
    host.createThread();
  }, [host]);

  const handleCloseThread = useCallback(
    (threadId: string) => {
      if (threads.length <= 1) {
        return;
      }
      const thread = threads.find((entry) => entry.id === threadId);
      const hasMessages = (thread?.messages.length ?? 0) > 0;
      if (hasMessages) {
        const confirmed = window.confirm(
          `Close "${thread?.title ?? 'thread'}"? This conversation will be removed from this device.`,
        );
        if (!confirmed) {
          return;
        }
      }
      host.closeThread(threadId);
    },
    [host, threads],
  );

  const handleSelectMode = useCallback(
    (nextMode: OperatorMode) => {
      host.selectMode(nextMode);
    },
    [host],
  );

  const handleSelectModel = useCallback(
    (nextAlias: string) => {
      void host.selectModel(nextAlias);
    },
    [host],
  );

  const handleRemoveAttachment = useCallback((id: string) => {
    setPendingAttachments((current) => {
      const target = current.find((entry) => entry.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((entry) => entry.id !== id);
    });
  }, []);

  const handleFileInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }
    const next: OperatorPendingAttachment[] = [];
    for (const file of Array.from(files)) {
      const pending = createOperatorPendingAttachment(file);
      if (pending) {
        next.push(pending);
      }
    }
    if (next.length > 0) {
      setPendingAttachments((current) => [...current, ...next]);
    }
    event.target.value = '';
  }, []);

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      if (activeThreadBusy) {
        return;
      }
      const pastedImages = extractImageFilesFromClipboard(event.clipboardData);
      if (pastedImages.length === 0) {
        return;
      }
      event.preventDefault();
      const next = pastedImages
        .map((file) => createOperatorPendingAttachment(file))
        .filter((entry): entry is OperatorPendingAttachment => entry !== null);
      if (next.length > 0) {
        setPendingAttachments((current) => [...current, ...next]);
      }
    },
    [activeThreadBusy],
  );

  const handleStop = useCallback(() => {
    host.setThreads(forceStopOperatorThread(activeThreadId, threads));
  }, [activeThreadId, host, threads]);

  const handleSubmit = useCallback(async () => {
    const text = draft.trim();
    if ((!text && pendingAttachments.length === 0) || activeThreadBusy) {
      return;
    }

    setDraft('');
    setToastError(null);

    const encodedAttachments =
      pendingAttachments.length > 0
        ? await encodeOperatorAttachments(pendingAttachments)
        : undefined;

    try {
      const result = await submitOperatorComposerMessage({
        text,
        threads,
        activeThreadId,
        mode,
        attachments: encodedAttachments,
        onThreadsUpdate: (partialThreads) => {
          host.setThreads(partialThreads);
        },
      });
      host.setThreads(result.threads);
      if (result.error) {
        setToastError(result.error);
      }
    } finally {
      revokeOperatorAttachmentPreviews(pendingAttachments);
      setPendingAttachments([]);
    }
  }, [activeThreadBusy, activeThreadId, draft, host, mode, pendingAttachments, threads]);

  const renderMessage = (message: OperatorMessage): ReactElement | null => {
    if (message.kind === 'reasoning') {
      const body =
        message.text.trim().length > 0 ? message.text : REASONING_PLACEHOLDER;
      return (
        <div key={message.id} className="px-1">
          <Reasoning streaming={message.streaming === true} defaultOpen={message.streaming === true}>
            {body}
          </Reasoning>
        </div>
      );
    }

    if (message.kind === 'tool') {
      return (
        <div key={message.id} className="px-1">
          <Tool
            toolName={message.toolName}
            status={message.ok ? 'succeeded' : 'failed'}
            args={message.args}
            error={message.error}
            defaultOpen={!message.ok}
            resultSummary={formatToolCallLabel(
              message.toolName,
              message.args,
              message.ok,
              message.error,
            )}
          />
        </div>
      );
    }

    if (isOperatorTextMessage(message)) {
      const attachmentItems: AttachmentItem[] =
        message.attachments?.map((attachment) => ({
          id: attachment.id,
          name: attachment.name,
          mime: attachment.mimeType,
        })) ?? [];

      return (
        <Message key={message.id} from={message.role === 'user' ? 'user' : 'assistant'}>
          <MessageContent from={message.role === 'user' ? 'user' : 'assistant'}>
            {attachmentItems.length > 0 ? (
              <Attachments items={attachmentItems} compact />
            ) : null}
            {message.role === 'assistant' ? (
              <Response>{message.text}</Response>
            ) : (
              message.text
            )}
          </MessageContent>
        </Message>
      );
    }

    if (isOperatorA2UIMessage(message)) {
      return (
        <Message key={message.id} from={message.role === 'user' ? 'user' : 'assistant'}>
          <MessageContent
            from={message.role === 'user' ? 'user' : 'assistant'}
            style={{ padding: 0, border: 'none', background: 'transparent' }}
          >
            <OperatorA2UITranscriptLite envelopes={message.envelopes} messageId={message.id} />
          </MessageContent>
        </Message>
      );
    }

    return null;
  };

  return (
    <div
      className={cn(
        'operator-surface-shell flex h-full min-h-0 flex-1 flex-col overflow-hidden',
        shellSurfaceClass,
      )}
      data-testid="operator-surface-shell"
    >
      <OperatorVoiceMount />
      <header
        part="header"
        className={cn(
          'operator-header flex shrink-0 items-center gap-3 border-b px-3 py-2.5',
          shellBorderClass,
        )}
      >
        <Agent
          part="title"
          name="Operator"
          description="Canvas-wide agent · Auto / Ask / Build / Draw"
          initials="OP"
          active={anyThreadGenerating}
          className="min-w-0 flex-1"
        />
        <div part="controls" className="operator-controls flex items-center gap-2">
          <ModeSelector
            value={mode}
            options={toModeOptions()}
            onChange={(nextMode) => handleSelectMode(nextMode as OperatorMode)}
          />
          <ModelSelector
            value={model}
            options={toModelOptions(modelOptions)}
            onChange={handleSelectModel}
          />
        </div>
      </header>

      <div
        part="thread-tabs"
        className={cn(
          'thread-tabs operator-overlay-scroll flex items-center gap-1 overflow-x-auto border-b px-2 pt-2',
          shellBorderClass,
        )}
        role="tablist"
        aria-label="Conversation threads"
      >
        {threads.map((thread) => {
          const selected = thread.id === activeThreadId;
          const threadBusy = thread.generating === true;
          return (
            <div
              key={thread.id}
              className={cn(
                'thread-tab-group inline-flex items-stretch rounded-t-md',
                selected && cn('border border-b-0', shellBorderClass, shellSurfaceClass),
              )}
            >
              <button
                part="thread-tab"
                type="button"
                role="tab"
                className={cn(
                  'thread-tab inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vibe-accent,#ff6b57)]',
                  selected
                    ? 'text-[var(--vibe-text,#ececec)]'
                    : cn('border border-transparent', shellMutedClass, 'hover:text-[var(--vibe-text,#ececec)]'),
                )}
                id={`operator-thread-tab-${thread.id}`}
                data-thread-tab={thread.id}
                aria-selected={selected ? 'true' : 'false'}
                aria-controls={`operator-thread-panel-${thread.id}`}
                onClick={() => handleSelectThread(thread.id)}
              >
                {threadBusy ? (
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--vibe-accent,#ff6b57)]"
                    aria-hidden
                  />
                ) : null}
                <span>{thread.title}</span>
              </button>
              {threads.length > 1 ? (
                <button
                  part="thread-tab-close"
                  type="button"
                  data-testid={`operator-close-thread-${thread.id}`}
                  aria-label={`Close ${thread.title}`}
                  className={cn(
                    'thread-tab-close inline-flex w-6 items-center justify-center text-[var(--vibe-text-faint,#6f6f6f)] hover:text-[var(--vibe-text,#ececec)]',
                  )}
                  onClick={() => handleCloseThread(thread.id)}
                >
                  <X size={12} />
                </button>
              ) : null}
            </div>
          );
        })}
        <button
          part="thread-tab-new"
          type="button"
          className={cn(
            'thread-tab-new ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-base leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vibe-accent,#ff6b57)]',
            shellBorderClass,
            shellMutedClass,
            'hover:bg-[var(--vibe-hover-bg,rgb(255_255_255/0.06))] hover:text-[var(--vibe-text,#ececec)]',
          )}
          data-testid="operator-new-thread"
          aria-label="New conversation"
          title="New conversation"
          onClick={handleCreateThread}
        >
          +
        </button>
      </div>

      <div part="thread-panels" className="thread-panels flex min-h-0 flex-1 flex-col">
        {(activeThread ? [activeThread] : []).map((thread) => {
          const isActive = thread.id === activeThreadId;
          return (
            <section
              key={thread.id}
              part="thread-panel"
              className={cn('thread-panel flex min-h-0 flex-1 flex-col', isActive && 'active')}
              role="tabpanel"
              id={`operator-thread-panel-${thread.id}`}
              aria-labelledby={`operator-thread-tab-${thread.id}`}
              data-thread-panel={thread.id}
              hidden={!isActive}
            >
              <Conversation
                part="transcript"
                className="transcript operator-overlay-scroll min-h-0 flex-1"
                style={{ background: 'transparent' }}
              >
                {thread.messages.length === 0 && !activeThreadBusy ? (
                  <div
                    part="empty-transcript"
                    className={cn(
                      'empty-transcript flex h-full min-h-[180px] flex-col items-center justify-center gap-3 p-6 text-center',
                      shellFaintClass,
                    )}
                  >
                    <span className="text-lg" aria-hidden>
                      ◎
                    </span>
                    <div>
                      <p className="text-sm font-medium text-[var(--vibe-text,#ececec)]">
                        Operator ready
                      </p>
                      <p className={cn('mt-1 max-w-xs text-xs', shellMutedClass)}>
                        Ask about the canvas, build panels, or draw — Auto picks scope from intent.
                      </p>
                    </div>
                    <Suggestions className="mt-1">
                      {OPERATOR_SUGGESTIONS.map((suggestion) => (
                        <Suggestion
                          key={suggestion}
                          suggestion={suggestion}
                          onSelect={setDraft}
                        />
                      ))}
                    </Suggestions>
                  </div>
                ) : (
                  <div
                    className="flex flex-col gap-3.5 px-3 pb-2 pt-3"
                    data-auto-scroll-key={chatAutoScrollKey}
                  >
                    {toolSteps.length > 0 ? (
                      <>
                        <Task title="Operator tools" tasks={taskItems} />
                        <ChainOfThought steps={toolSteps} title="Tool trace" />
                      </>
                    ) : null}
                    {estimatedContextTokens > 0 ? (
                      <Context usedTokens={estimatedContextTokens} maxTokens={128_000} label="Session context" />
                    ) : null}
                    {thread.messages.map((message) => renderMessage(message))}
                    {thread.generating === true && isActive ? (
                      <div className={cn('flex items-center gap-2 px-1 text-xs', shellMutedClass)}>
                        <Loader />
                        <span>Generating response…</span>
                      </div>
                    ) : null}
                  </div>
                )}
              </Conversation>
            </section>
          );
        })}
      </div>

      <footer
        part="composer"
        className={cn(
          'composer-shell shrink-0 border-t p-3',
          shellBorderClass,
          'bg-[var(--vibe-composer-bg,#141414)]',
        )}
      >
        {toastError ? (
          <div
            role="alert"
            data-testid="operator-error-toast"
            className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
          >
            {toastError}
          </div>
        ) : null}
        {pendingAttachmentItems.length > 0 ? (
          <Attachments
            items={pendingAttachmentItems}
            onRemove={handleRemoveAttachment}
            compact
          />
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.txt,.md,.csv,text/plain,text/markdown,text/csv,application/pdf"
          className="hidden"
          data-testid="operator-attachment-input"
          onChange={handleFileInputChange}
        />
        <PromptInput onSubmit={() => void handleSubmit()} className="operator-overlay-scroll">
          <PromptInputTextarea
            data-testid="operator-composer-textarea"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onPaste={handlePaste}
            placeholder="Message the operator…"
            disabled={activeThreadBusy}
            onEnterSubmit={() => void handleSubmit()}
          />
          <PromptInputToolbar>
            <button
              type="button"
              data-testid="operator-attachment-button"
              aria-label="Add attachment"
              disabled={activeThreadBusy}
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-md border',
                shellBorderClass,
                shellMutedClass,
                'hover:text-[var(--vibe-text,#ececec)]',
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip size={15} />
            </button>
            <OperatorVoiceInput
              onTranscript={(text) => setDraft((current) => (current ? `${current} ${text}` : text))}
            />
            <PromptInputSubmit
              status={composerStatus(activeThreadBusy)}
              disabled={
                activeThreadBusy || (draft.trim().length === 0 && pendingAttachments.length === 0)
              }
              onStop={activeThreadBusy ? handleStop : undefined}
            />
          </PromptInputToolbar>
        </PromptInput>
      </footer>
    </div>
  );
}
