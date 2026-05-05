import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip, Mic, Send, Sparkles, Wrench, Volume2, AlertTriangle } from 'lucide-react';
import { DraggablePanel } from './DraggablePanel';
import { useLayoutStore } from '../stores/layoutStore';
import { useCanvasConfig } from './CanvasContext';
import { createChatClient, type ChatMessage } from './chat/geminiChatClient';

interface ToolCallEvent {
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
  source: 'voice' | 'chat';
  timestamp: string;
}

interface VoiceTranscriptEvent {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

function AssistantAvatar({
  size = 'sm',
  initial,
}: {
  size?: 'sm' | 'lg';
  initial: string;
}) {
  const dims = size === 'lg' ? 'w-16 h-16 text-2xl' : 'w-8 h-8 text-sm';
  return (
    <div
      className={`${dims} rounded-full flex items-center justify-center text-white font-bold shrink-0 shadow-canvas-primary-intense`}
      style={{
        background:
          'linear-gradient(135deg, var(--landi-color-primary, #0D7377) 0%, var(--landi-color-primary-light, #14B8A6) 60%, var(--landi-color-primary-soft, #2DD4BF) 100%)',
      }}
    >
      {initial}
    </div>
  );
}

/**
 * Format tool args for an inline chat-card. Shows "open_positions(department=IT)"
 * style for quick scanning. Long values are truncated.
 */
function summarizeToolArgs(args: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(args)) {
    let str = typeof v === 'string' ? v : JSON.stringify(v);
    if (str.length > 40) str = str.slice(0, 37) + '…';
    parts.push(`${k}=${str}`);
  }
  return parts.join(', ');
}

export interface ChatPanelProps {
  /**
   * When true, render only the chat body — no `<DraggablePanel>` wrapper
   * and no `useLayoutStore` visibility gate. Use when the host (e.g.
   * the whiteboard chat column) provides its own positioning chrome.
   * The chat machinery (Gemini client, voice transcripts, tool echo,
   * focus events) works identically in both modes.
   */
  chromeless?: boolean;
}

export function ChatPanel({ chromeless = false }: ChatPanelProps = {}) {
  const { panels, showPanel } = useLayoutStore();
  const { persona, labels } = useCanvasConfig();
  const assistantName = persona.assistantName ?? 'Assistant';
  const tenantTitle = persona.tenantTitle ?? 'AI Assistant';
  const starterPrompts = persona.starterPrompts ?? [];
  const avatarInitial = assistantName.charAt(0).toUpperCase() || 'A';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isAwaitingReply, setIsAwaitingReply] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const layout = panels.chat;

  // Construct the chat client lazily and stably across renders. Persona +
  // creds change rarely (only on tenant config swap), so a memo on those
  // primitives keeps a single client across the panel's lifetime.
  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY ?? '') as string;
  const tokenEndpoint = ((import.meta.env.VITE_VOICE_TOKEN_ENDPOINT as string | undefined) ?? '').trim();
  const isProd = (import.meta.env.MODE ?? import.meta.env.NODE_ENV) === 'production';
  const useMock = (import.meta.env.VITE_LANDI_MOCK ?? '') === '1' || (!apiKey && !tokenEndpoint && !isProd);

  const chatClient = useMemo(() => {
    if (useMock) return null;
    if (!apiKey && !tokenEndpoint) return null;
    return createChatClient({
      apiKeySource: tokenEndpoint
        ? async () => {
            const response = await fetch(tokenEndpoint, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({}),
            });
            if (!response.ok) {
              throw new Error(`token mint failed: ${response.status}`);
            }
            const data = (await response.json()) as { token?: string };
            if (!data.token) throw new Error('token mint missing token field');
            return data.token;
          }
        : apiKey,
      systemInstruction: persona.systemPrompt,
    });
  }, [useMock, apiKey, tokenEndpoint, persona.systemPrompt]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // --- Voice transcript ingestion ---
  // The agent's voice transcripts get mirrored into the chat thread so
  // the user has one unified history. Tagged `source: 'voice'` so the
  // chip styling can differentiate from typed messages.
  useEffect(() => {
    const onTranscript = (e: Event) => {
      const detail = (e as CustomEvent<VoiceTranscriptEvent>).detail;
      if (!detail || typeof detail.text !== 'string' || !detail.text.trim()) return;
      // De-duplicate: Gemini Live emits transcript fragments incrementally.
      // We coalesce same-role transcripts arriving within 1.5s of the last
      // one into a single chat bubble (otherwise the thread fills with
      // 3-word fragments).
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        const now = Date.now();
        const lastTime = last ? new Date(last.createdAt).getTime() : 0;
        if (
          last &&
          last.source === 'voice' &&
          last.role === detail.role &&
          now - lastTime < 1500
        ) {
          // Append to the previous fragment instead of pushing a new one.
          return prev.map((m, i) =>
            i === prev.length - 1
              ? { ...m, text: `${m.text} ${detail.text}`.trim(), createdAt: detail.timestamp }
              : m,
          );
        }
        return [
          ...prev,
          {
            id: `voice-${detail.role}-${now.toString(36)}`,
            role: detail.role,
            text: detail.text,
            source: 'voice',
            createdAt: detail.timestamp,
          },
        ];
      });
    };
    window.addEventListener('landi:voice-transcript', onTranscript as EventListener);
    return () => {
      window.removeEventListener('landi:voice-transcript', onTranscript as EventListener);
    };
  }, []);

  // --- Tool call echo ---
  // Both voice + chat tool calls dispatch `landi:tool-call`. Render an
  // inline card so the user sees what the agent did to the canvas.
  useEffect(() => {
    const onToolCall = (e: Event) => {
      const detail = (e as CustomEvent<ToolCallEvent>).detail;
      if (!detail) return;
      setMessages((prev) => [
        ...prev,
        {
          id: `tool-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'assistant',
          text: `${detail.name}(${summarizeToolArgs(detail.args)})`,
          source: 'tool',
          toolCall: { name: detail.name, args: detail.args, ok: detail.ok },
          createdAt: detail.timestamp,
        },
      ]);
    };
    window.addEventListener('landi:tool-call', onToolCall as EventListener);
    return () => {
      window.removeEventListener('landi:tool-call', onToolCall as EventListener);
    };
  }, []);

  // --- Focus from agent ---
  useEffect(() => {
    const onFocus = () => {
      inputRef.current?.focus();
    };
    window.addEventListener('landi:focus-chat-input', onFocus);
    return () => {
      window.removeEventListener('landi:focus-chat-input', onFocus);
    };
  }, []);

  // Visibility gate skipped in chromeless mode — host (e.g. WhiteboardShell)
  // owns when the surface is mounted.
  if (!chromeless && !layout?.visible) return null;

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);

    const userMsg: ChatMessage = {
      id: `u-${Date.now().toString(36)}`,
      role: 'user',
      text: trimmed,
      source: 'text',
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');

    if (!chatClient) {
      // Mock fallback when no credential is configured. Honest copy — the
      // earlier random one-liners from the OSS canvas were misleading
      // because they implied a working assistant when there wasn't one.
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now().toString(36)}`,
            role: 'assistant',
            text: useMock
              ? '(Mock chat — set VITE_GEMINI_API_KEY or VITE_VOICE_TOKEN_ENDPOINT to enable real responses.)'
              : '(Chat is not configured for this preview.)',
            source: 'text',
            createdAt: new Date().toISOString(),
          },
        ]);
      }, 400);
      return;
    }

    setIsAwaitingReply(true);
    try {
      const result = await chatClient.send(
        // Send the history WITHOUT the just-appended user message — the
        // chat client appends `userMessage` itself. We capture state with
        // a functional setter to avoid stale-closure on rapid sends.
        messages,
        trimmed,
      );
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now().toString(36)}`,
          role: 'assistant',
          text: result.text || '(no response)',
          source: 'text',
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      const msg = (err as Error).message ?? 'chat failed';
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now().toString(36)}`,
          role: 'assistant',
          text: `(error: ${msg})`,
          source: 'text',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsAwaitingReply(false);
    }
  };

  const handleSend = useCallback(() => {
    void sendMessage(inputValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = messages.length === 0;
  const canSend = inputValue.trim().length > 0 && !isAwaitingReply;

  const body = (
    <div className="flex flex-col h-full bg-gradient-to-b from-white via-white to-[#F7F9F9]">
        {isEmpty ? (
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col items-center justify-center px-6 pt-10 pb-6 text-center">
              <AssistantAvatar size="lg" initial={avatarInitial} />
              <h2 className="mt-5 text-[22px] font-semibold text-canvas tracking-tight">
                Hi, I&apos;m {assistantName}.
              </h2>
              <p className="mt-1.5 text-sm text-[#6B7280] max-w-[340px] leading-relaxed">
                Ask me anything, or start with one of these:
              </p>

              <div className="mt-6 w-full max-w-[380px] space-y-2">
                {starterPrompts.map((p) => (
                  <button
                    key={p.text}
                    type="button"
                    onClick={() => void sendMessage(p.text)}
                    className="group w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-canvas-border bg-canvas-surface hover:border-canvas-primary/40 hover:bg-canvas-surface-subtle hover:shadow-canvas-primary-soft transition-all text-left"
                  >
                    <span className="text-[20px] leading-none">{p.emoji}</span>
                    <span className="flex-1 text-sm text-canvas font-medium group-hover:text-canvas-primary">
                      {p.text}
                    </span>
                    <Sparkles size={14} className="text-canvas-faint group-hover:text-canvas-primary transition-colors" />
                  </button>
                ))}
              </div>

              <p className="mt-6 text-[11px] text-[#9CA3AF]">
                {chatClient
                  ? `Live ${assistantName} · responses are real`
                  : useMock
                    ? `Mock ${assistantName} · set VITE_GEMINI_API_KEY for live responses`
                    : `${assistantName} chat unavailable`}
              </p>
            </div>
          </div>
        ) : (
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg) => {
              if (msg.source === 'tool' && msg.toolCall) {
                return (
                  <div key={msg.id} className="flex gap-2.5">
                    <AssistantAvatar initial={avatarInitial} />
                    <div className="flex-1 max-w-[85%]">
                      <div className={`rounded-2xl rounded-tl-sm px-3 py-2 border text-xs flex items-center gap-2 ${
                        msg.toolCall.ok
                          ? 'bg-canvas-primary-tint border-canvas-primary/20 text-canvas-primary'
                          : 'bg-rose-50 border-rose-200 text-rose-700'
                      }`}>
                        {msg.toolCall.ok
                          ? <Wrench size={12} />
                          : <AlertTriangle size={12} />}
                        <span className="font-mono">{msg.text}</span>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div key={msg.id}>
                  {msg.role === 'assistant' ? (
                    <div className="flex gap-2.5">
                      <AssistantAvatar initial={avatarInitial} />
                      <div className="flex-1 max-w-[85%]">
                        <div className="bg-canvas-surface-subtle border border-canvas-primary/10 rounded-2xl rounded-tl-sm px-4 py-3">
                          {msg.source === 'voice' && (
                            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-canvas-faint mb-1">
                              <Volume2 size={10} /> via voice
                            </p>
                          )}
                          <p className="text-sm text-canvas leading-relaxed">{msg.text}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <div
                        className="text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] shadow-sm"
                        style={{ background: 'linear-gradient(135deg, var(--landi-color-primary, #0D7377) 0%, var(--landi-color-primary-hover, #095C5F) 100%)' }}
                      >
                        {msg.source === 'voice' && (
                          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/70 mb-0.5">
                            <Volume2 size={10} /> via voice
                          </p>
                        )}
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {isAwaitingReply && (
              <div className="flex gap-2.5" role="status" aria-live="polite">
                <AssistantAvatar initial={avatarInitial} />
                <div className="bg-canvas-surface-subtle border border-canvas-primary/10 rounded-2xl rounded-tl-sm px-4 py-3 inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-canvas-primary/60 animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-canvas-primary/60 animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-canvas-primary/60 animate-pulse" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            )}
            {error && (
              <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
                {error}
              </p>
            )}
          </div>
        )}

        <div className="border-t border-canvas-border px-3 py-2.5 shrink-0 bg-canvas-surface">
          <div className="flex items-center gap-1.5 bg-canvas-surface-subtle border border-canvas-border rounded-xl px-2.5 py-1.5 focus-within:border-canvas-primary/40 focus-within:ring-2 focus-within:ring-canvas-primary/10 transition-all">
            <button
              type="button"
              className="p-1.5 rounded-lg hover:bg-canvas-surface-subtle text-canvas-faint hover:text-canvas-muted transition-colors shrink-0"
              aria-label="Attach file"
            >
              <Paperclip size={16} />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask ${assistantName} anything…`}
              disabled={isAwaitingReply}
              className="flex-1 bg-transparent text-sm text-canvas placeholder:text-canvas-faint outline-none min-w-0 py-1 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => showPanel('voice')}
              className="p-1.5 rounded-lg hover:bg-canvas-surface-subtle text-canvas-faint hover:text-canvas-primary transition-colors shrink-0"
              aria-label="Open voice conversation"
              title="Voice conversation"
            >
              <Mic size={16} />
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className="p-2 rounded-lg text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              style={{
                background: canSend
                  ? 'linear-gradient(135deg, var(--landi-color-primary, #0D7377) 0%, var(--landi-color-primary-light, #14B8A6) 100%)'
                  : '#D1D5DB',
              }}
              aria-label={labels.sendMessage}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
  );

  if (chromeless) {
    return body;
  }

  return (
    <DraggablePanel id="chat" title={`${assistantName} — ${tenantTitle}`}>
      {body}
    </DraggablePanel>
  );
}
