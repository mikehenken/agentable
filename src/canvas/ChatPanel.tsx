import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip, Mic, Send, Sparkles, Wrench, Volume2, AlertTriangle, Copy, Check } from 'lucide-react';
import { Streamdown } from 'streamdown';
import { DraggablePanel } from './DraggablePanel';
import { useLayoutStore } from '../stores/layoutStore';
import { useCanvasConfig } from './CanvasContext';
import { createChatClient, type ChatMessage } from './chat/geminiChatClient';
import { PromptInput, Suggestions, Reasoning, type SuggestionItem } from '../components/ui-ai';

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

/**
 * shadcn.io/ai-style persona halo avatar — a coral gradient disc with a soft
 * glow ring. `size="lg"` is used in the empty state; `sm` beside messages.
 * Mirrors https://www.shadcn.io/ai/persona.
 */
function PersonaHalo({ size = 'sm', initial }: { size?: 'sm' | 'lg'; initial: string }) {
  const dim = size === 'lg' ? 60 : 30;
  const font = size === 'lg' ? 24 : 13;
  return (
    <div
      style={{
        width: dim,
        height: dim,
        flexShrink: 0,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        color: '#fff',
        fontWeight: 700,
        fontSize: font,
        background:
          'linear-gradient(135deg, var(--vibe-accent, #ff6b57) 0%, var(--vibe-accent-2, #ff8f6b) 55%, #ffb199 100%)',
        boxShadow:
          size === 'lg'
            ? '0 0 0 6px color-mix(in srgb, var(--vibe-accent, #ff6b57) 14%, transparent), 0 8px 30px color-mix(in srgb, var(--vibe-accent, #ff6b57) 35%, transparent)': '0 0 0 3px color-mix(in srgb, var(--vibe-accent, #ff6b57) 12%, transparent)',
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

/** Copy-to-clipboard message toolbar action — https://www.shadcn.io/ai/toolbar */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={copied ? 'Copied' : 'Copy message'}
      aria-label="Copy message"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        });
      }}
      style={{
        display: 'grid',
        placeItems: 'center',
        width: 22,
        height: 22,
        borderRadius: 6,
        border: 0,
        background: 'transparent',
        color: copied ? 'var(--vibe-accent, #ff6b57)' : 'var(--vibe-text-muted, #8a8a8a)',
        cursor: 'pointer',
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
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
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const layout = panels.chat;

  // Construct the chat client lazily and stably across renders. Persona +
  // creds change rarely (only on tenant config swap), so a memo on those
  // primitives keeps a single client across the panel's lifetime.
  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY ?? '') as string;
  const tokenEndpoint = (
    persona.tokenEndpoint ??
    (import.meta.env.VITE_VOICE_TOKEN_ENDPOINT as string | undefined) ??
    (import.meta.env.VITE_TOKEN_MINT_URL as string | undefined) ??
    ''
  ).trim();
  // Preferred text-chat path: a keyless server proxy. Ephemeral tokens are
  // Live-API (voice) only and do NOT authorize `generateContent`, so text
  // chat must route through the proxy (or a static dev key) rather than the
  // voice token mint.
  const chatProxyUrl = (
    persona.chatProxyUrl ??
    (import.meta.env.VITE_LANDI_CHAT_PROXY_URL as string | undefined) ??
    ''
  ).trim();
  const isProd = (import.meta.env.MODE ?? import.meta.env.NODE_ENV) === 'production';
  const useMock =
    (import.meta.env.VITE_LANDI_MOCK ?? '') === '1' ||
    (!apiKey && !chatProxyUrl && !isProd);

  const chatClient = useMemo(() => {
    if (useMock) return null;
    if (chatProxyUrl) {
      return createChatClient({
        proxyUrl: chatProxyUrl,
        systemInstruction: persona.systemPrompt,
      });
    }
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
          }: apiKey,
      systemInstruction: persona.systemPrompt,
    });
  }, [useMock, apiKey, tokenEndpoint, chatProxyUrl, persona.systemPrompt]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isAwaitingReply]);

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
              ? {...m, text: `${m.text} ${detail.text}`.trim(), createdAt: detail.timestamp }: m);
        }
        return [...prev,
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
      setMessages((prev) => [...prev,
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
        setMessages((prev) => [...prev,
          {
            id: `a-${Date.now().toString(36)}`,
            role: 'assistant',
            text: useMock
              ? '(Mock chat — set VITE_LANDI_CHAT_PROXY_URL or VITE_GEMINI_API_KEY to enable live responses.)': '(Chat is not configured for this preview.)',
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
        trimmed);
      setMessages((prev) => [...prev,
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
      setMessages((prev) => [...prev,
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

  // Visibility gate skipped in chromeless mode — host (e.g. WhiteboardShell)
  // owns when the surface is mounted. Placed after all hooks so hook order
  // stays stable across renders (react-hooks/rules-of-hooks).
  if (!chromeless && !layout?.visible) return null;

  const isEmpty = messages.length === 0;
  const canSend = inputValue.trim().length > 0 && !isAwaitingReply;

  // Quick-reply pills (shadcn Suggestion) shown above the composer once the
  // conversation has started — derived from the persona's starter prompts.
  const quickReplies: SuggestionItem[] = starterPrompts.slice(0, 4).map((p) => ({
    text: p.text,
    icon: p.emoji,
  }));

  const body = (
    <div
      style={
        {
          // Dark vibe theme surface — shared `--vibe-*` tokens drive the
          // ui-ai primitives (prompt input, suggestions, reasoning, persona).
          '--vibe-accent': 'var(--landi-color-primary, #ff6b57)',
          '--vibe-accent-2': 'var(--landi-color-primary-light, #ff8f6b)',
          '--vibe-surface': '#1a1a1a',
          '--vibe-border': 'rgba(255,255,255,0.09)',
          '--vibe-text': '#ececec',
          '--vibe-text-muted': '#9a9a9a',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: '#121212',
          color: 'var(--vibe-text)',
        } as React.CSSProperties
      }
    >
      {isEmpty ? (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '40px 24px 24px',
              textAlign: 'center',
            }}
          >
            <PersonaHalo size="lg" initial={avatarInitial} />
            <h2 style={{ marginTop: 20, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--vibe-text)' }}>
              Hi, I&apos;m {assistantName}.
            </h2>
            <p style={{ marginTop: 6, fontSize: 13.5, color: 'var(--vibe-text-muted)', maxWidth: 340, lineHeight: 1.5 }}>
              Ask me anything, or start with one of these:
            </p>

            <div style={{ marginTop: 24, width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {starterPrompts.map((p) => (
                <StarterCard key={p.text} emoji={p.emoji} text={p.text} onClick={() => void sendMessage(p.text)} />
              ))}
            </div>

            <p style={{ marginTop: 24, fontSize: 11, color: '#6f6f6f' }}>
              {chatClient
                ? `Live ${assistantName} · responses are real`: useMock
                  ? `Mock ${assistantName} · set VITE_LANDI_CHAT_PROXY_URL for live responses`: `${assistantName} chat unavailable`}
            </p>
          </div>
        </div>
      ) : (
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages.map((msg) => {
            if (msg.source === 'tool' && msg.toolCall) {
              const ok = msg.toolCall.ok;
              return (
                <div key={msg.id} style={{ display: 'flex', gap: 10 }}>
                  <PersonaHalo initial={avatarInitial} />
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 11px',
                      borderRadius: 12,
                      borderTopLeftRadius: 4,
                      fontSize: 12,
                      fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                      background: ok ? 'color-mix(in srgb, var(--vibe-accent) 12%, #1a1a1a)' : 'rgba(244,63,94,0.12)',
                      border: `1px solid ${ok ? 'color-mix(in srgb, var(--vibe-accent) 30%, transparent)' : 'rgba(244,63,94,0.35)'}`,
                      color: ok ? 'var(--vibe-accent)' : '#fb7185',
                    }}
                  >
                    {ok ? <Wrench size={12} /> : <AlertTriangle size={12} />}
                    <span>{msg.text}</span>
                  </div>
                </div>
              );
            }
            if (msg.role === 'assistant') {
              return (
                <div key={msg.id} className="landi-msg" style={{ display: 'flex', gap: 10 }}>
                  <PersonaHalo initial={avatarInitial} />
                  <div style={{ flex: 1, minWidth: 0, maxWidth: '88%' }}>
                    <div
                      style={{
                        background: 'var(--vibe-surface)',
                        border: '1px solid var(--vibe-border)',
                        borderRadius: 14,
                        borderTopLeftRadius: 4,
                        padding: '10px 14px',
                        fontSize: 13.5,
                        lineHeight: 1.6,
                        color: 'var(--vibe-text)',
                      }}
                    >
                      {msg.source === 'voice' && (
                        <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--vibe-text-muted)', marginBottom: 4 }}>
                          <Volume2 size={10} /> via voice
                        </p>
                      )}
                      <div className="landi-md">
                        <Streamdown>{msg.text}</Streamdown>
                      </div>
                    </div>
                    <div className="landi-msg__toolbar" style={{ display: 'flex', gap: 2, marginTop: 2, opacity: 0, transition: 'opacity .12s ease' }}>
                      <CopyButton text={msg.text} />
                    </div>
                  </div>
                </div>
              );
            }
            // user
            return (
              <div key={msg.id} className="landi-msg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div
                  style={{
                    maxWidth: '82%',
                    padding: '9px 14px',
                    borderRadius: 14,
                    borderTopRightRadius: 4,
                    color: '#fff',
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    background: 'linear-gradient(135deg, var(--vibe-accent) 0%, var(--vibe-accent-2) 100%)',
                    boxShadow: '0 4px 16px color-mix(in srgb, var(--vibe-accent) 30%, transparent)',
                  }}
                >
                  {msg.source === 'voice' && (
                    <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.75)', marginBottom: 2 }}>
                      <Volume2 size={10} /> via voice
                    </p>
                  )}
                  <span style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</span>
                </div>
                <div className="landi-msg__toolbar" style={{ opacity: 0, transition: 'opacity .12s ease' }}>
                  <CopyButton text={msg.text} />
                </div>
              </div>
            );
          })}
          {isAwaitingReply && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }} role="status" aria-live="polite">
              <PersonaHalo initial={avatarInitial} />
              <div
                style={{
                  background: 'var(--vibe-surface)',
                  border: '1px solid var(--vibe-border)',
                  borderRadius: 14,
                  borderTopLeftRadius: 4,
                  padding: '8px 14px',
                }}
              >
                <Reasoning streaming />
              </div>
            </div>
          )}
          {error && (
            <p
              role="alert"
              style={{
                fontSize: 12,
                color: '#fb7185',
                background: 'rgba(244,63,94,0.1)',
                border: '1px solid rgba(244,63,94,0.3)',
                borderRadius: 8,
                padding: '8px 12px',
              }}
            >
              {error}
            </p>
          )}
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--vibe-border)', padding: 12, background: '#141414', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!isEmpty && quickReplies.length > 0 && (
          <Suggestions items={quickReplies} onSelect={(t) => void sendMessage(t)} />
        )}
        <PromptInput
          value={inputValue}
          onValueChange={setInputValue}
          onSubmit={handleSend}
          placeholder={`Ask ${assistantName} anything…`}
          disabled={isAwaitingReply}
          textareaRef={inputRef}
          toolbar={
            <>
              <IconButton title="Attach file" ariaLabel="Attach file">
                <Paperclip size={16} />
              </IconButton>
              <IconButton
                title="Voice conversation"
                ariaLabel="Open voice conversation"
                onClick={() => showPanel('voice')}
                accentOnHover
              >
                <Mic size={16} />
              </IconButton>
            </>
          }
          actions={
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              aria-label={labels.sendMessage}
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 32,
                height: 32,
                borderRadius: 9,
                border: 0,
                color: '#fff',
                cursor: canSend ? 'pointer' : 'not-allowed',
                opacity: canSend ? 1 : 0.4,
                transition: 'opacity .15s ease',
                background: canSend
                  ? 'linear-gradient(135deg, var(--vibe-accent) 0%, var(--vibe-accent-2) 100%)': '#3a3a3a',
              }}
            >
              <Send size={15} />
            </button>
          }
        />
      </div>

      {/* Hover-reveal message toolbars + markdown spacing for the dark theme. */}
      <style>{`.landi-msg:hover.landi-msg__toolbar { opacity: 1 !important; }.landi-md > *:first-child { margin-top: 0; }.landi-md > *:last-child { margin-bottom: 0; }.landi-md p { margin: 0 0 8px; }.landi-md ul,.landi-md ol { margin: 0 0 8px; padding-left: 18px; }.landi-md code { background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 4px; font-size: 12px; }.landi-md pre { background: #0d0d0d; border: 1px solid var(--vibe-border); border-radius: 8px; padding: 10px; overflow-x: auto; }.landi-md a { color: var(--vibe-accent); }
      `}</style>
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

/** Dark-vibe starter-prompt card used in the empty state. */
function StarterCard({ emoji, text, onClick }: { emoji: string; text: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '12px 14px',
        borderRadius: 12,
        cursor: 'pointer',
        textAlign: 'left',
        background: hover ? 'color-mix(in srgb, var(--vibe-accent) 8%, #1a1a1a)' : '#1a1a1a',
        border: `1px solid ${hover ? 'color-mix(in srgb, var(--vibe-accent) 45%, transparent)' : 'var(--vibe-border)'}`,
        transition: 'all .15s ease',
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1 }}>{emoji}</span>
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: hover ? 'var(--vibe-accent)' : 'var(--vibe-text)' }}>{text}</span>
      <Sparkles size={14} style={{ color: hover ? 'var(--vibe-accent)' : '#5a5a5a' }} />
    </button>
  );
}

/** Small ghost icon button used in the composer toolbar. */
function IconButton({
  children,
  title,
  ariaLabel,
  onClick,
  accentOnHover = false,
}: {
  children: React.ReactNode;
  title: string;
  ariaLabel: string;
  onClick?: () => void;
  accentOnHover?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        placeItems: 'center',
        width: 30,
        height: 30,
        borderRadius: 8,
        border: 0,
        cursor: 'pointer',
        background: hover ? 'rgba(255,255,255,0.06)' : 'transparent',
        color: hover ? (accentOnHover ? 'var(--vibe-accent, #ff6b57)' : 'var(--vibe-text, #ececec)') : 'var(--vibe-text-muted, #8a8a8a)',
        transition: 'all .14s ease',
      }}
    >
      {children}
    </button>
  );
}
