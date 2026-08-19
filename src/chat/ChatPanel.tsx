import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Paperclip, Mic, Send, Volume2, AlertTriangle, Copy, Check, Wrench } from 'lucide-react';
import { Streamdown } from 'streamdown';
import { useCanvasConfig } from '../config/CanvasContext';
import { createChatClient, type ChatMessage } from './geminiChatClient';
import { runOfflineDrawFallback } from './offlineDrawFallback';
import { openPanelInCanvas } from '../engines/tldraw/shapes/panelShapeApi';
import { PromptInput, Reasoning } from '../components/ui-ai';
import {
  AiPersona,
  useAiPersonaState,
  type AiPersonaSize,
} from '../components/ai-persona';
import { StarterChips } from '../components/chrome/StarterChips';
import { CHAT_PROMPT_EVENT, CHAT_TRANSCRIPT_INJECT_EVENT, type ChatPromptDetail } from '../choreography';
import { ensurePageSession } from '../session/pageSession';
import { applyVoiceTranscriptToMessages } from '../session/applyVoiceTranscript';
import { useOverlayScrollbar } from '../hooks/useOverlayScrollbar';
import { formatToolCallLabel, formatToolCallSignature } from './toolCallLabels';
import { executeTool } from '../agents/tools/canvasTools';

interface ToolCallEvent {
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
  source: 'voice' | 'chat' | 'p8-scripted-demo';
  timestamp: string;
}

interface ChatTranscriptInjectDetail {
  role: 'user' | 'assistant';
  text: string;
  source?: ChatMessage['source'];
  toolCall?: { name: string; args: Record<string, unknown>; ok: boolean };
  createdAt?: string;
}

interface VoiceTranscriptEvent {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

/**
 * Letter-initial fallback when `persona.visual` is not configured for chat.
 */
function LetterAvatar({ size = 'sm', initial }: { size?: 'sm' | 'lg'; initial: string }): ReactElement {
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

interface ChatPersonaAvatarProps {
  size?: AiPersonaSize;
  initial: string;
  assistantName: string;
  showVisual: boolean;
  visualType: string;
  isAwaitingReply: boolean;
}

function ChatPersonaAvatar({
  size = 'sm',
  initial,
  assistantName,
  showVisual,
  visualType,
  isAwaitingReply,
}: ChatPersonaAvatarProps): ReactElement {
  const { state, level } = useAiPersonaState({ isAwaitingReply });
  if (!showVisual) {
    return <LetterAvatar size={size === 'lg' ? 'lg' : 'sm'} initial={initial} />;
  }
  return (
    <AiPersona
      type={visualType}
      state={state}
      size={size}
      level={level}
      initial={initial}
      label={assistantName}
      data-testid={size === 'lg' ? 'ai-persona-chat-hero' : 'ai-persona-chat-avatar'}
    />
  );
}

/**
 * Treat obvious placeholder markers (e.g. "<SET_IN_config.local.json>") as
 * unset. Committed example configs ship placeholders like this so
 * `config.example.json` never carries a real endpoint; a real endpoint
 * never looks like this, so the check is safe for genuine values.
 */
function isConfiguredEndpoint(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !(trimmed.startsWith('<') && trimmed.endsWith('>'));
}

/** Copy-to-clipboard message toolbar action - https://www.shadcn.io/ai/toolbar */
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
   * When true, render only the chat body - no `<DraggablePanel>` wrapper
   * and no `useLayoutStore` visibility gate. Use when the host (e.g.
   * the whiteboard chat column) provides its own positioning chrome.
   * The chat machinery (Gemini client, voice transcripts, tool echo,
   * focus events) works identically in both modes.
   */
  chromeless?: boolean;
}

export function ChatPanel({ chromeless: _chromeless = true }: ChatPanelProps = {}) {
  const { persona, labels, welcomeMessage } = useCanvasConfig();
  const assistantName = persona.assistantName ?? 'Assistant';
  const tenantTitle = persona.tenantTitle ?? 'AI Assistant';
  const starterPrompts = persona.starterPrompts ?? [];
  const emptyStateWelcome =
    welcomeMessage?.trim() ||
    'Ask me anything, or start with one of these:';
  const avatarInitial = assistantName.charAt(0).toUpperCase() || 'A';
  const visual = persona.visual;
  const showPersonaVisual = visual?.showInChat === true;
  const visualType = visual?.type ?? 'halo';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isAwaitingReply, setIsAwaitingReply] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useOverlayScrollbar(scrollRef);

  // Construct the chat client lazily and stably across renders. Persona +
  // creds change rarely (only on tenant config swap), so a memo on those
  // primitives keeps a single client across the panel's lifetime.
  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY ?? '') as string;
  const tokenEndpointRaw = (
    persona.tokenEndpoint ??
    (import.meta.env.VITE_VOICE_TOKEN_ENDPOINT as string | undefined) ??
    (import.meta.env.VITE_TOKEN_MINT_URL as string | undefined) ??
    ''
  ).trim();
  // Preferred text-chat path: a keyless server proxy. Ephemeral tokens are
  // Live-API (voice) only and do NOT authorize `generateContent`, so text
  // chat must route through the proxy (or a static dev key) rather than the
  // voice token mint.
  const chatProxyUrlRaw = (
    persona.chatProxyUrl ??
    (import.meta.env.VITE_LANDI_CHAT_PROXY_URL as string | undefined) ??
    ''
  ).trim();
  // Committed example configs (config.example.json) ship placeholder
  // endpoint strings so no real URL is ever committed. Treat those as
  // "not configured" rather than attempting to fetch a literal placeholder.
  const tokenEndpoint = isConfiguredEndpoint(tokenEndpointRaw) ? tokenEndpointRaw : '';
  const chatProxyUrl = isConfiguredEndpoint(chatProxyUrlRaw) ? chatProxyUrlRaw : '';
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

  // Handback / prompt-action choreography - insert prompt and scroll to reply.
  useEffect(() => {
    const onChatPrompt = (e: Event) => {
      const detail = (e as CustomEvent<ChatPromptDetail>).detail;
      if (!detail?.prompt?.trim()) return;
      void sendMessage(detail.prompt);
    };
    window.addEventListener(CHAT_PROMPT_EVENT, onChatPrompt as EventListener);
    return () => {
      window.removeEventListener(CHAT_PROMPT_EVENT, onChatPrompt as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatClient, messages, useMock]);

 // --- Voice transcript ingestion (page session + window event) ---
  // The agent's voice transcripts get mirrored into the chat thread so
  // the user has one unified history. Tagged `source: 'voice'` so the
  // chip styling can differentiate from typed messages.
  useEffect(() => {
    const pageSession = ensurePageSession();
    const surfaceId = `chat-${Math.random().toString(36).slice(2, 8)}`;
    const unregisterSurface = pageSession.registerChatSurface(surfaceId);

    const ingest = (detail: VoiceTranscriptEvent): void => {
      if (!detail || typeof detail.text !== 'string' || !detail.text.trim()) return;
      setMessages((prev) => applyVoiceTranscriptToMessages(prev, detail));
    };

    const unsubscribe = pageSession.subscribeTranscripts((entry) => {
 // voice-only mirror — operator/chat publishes must not appear here.
      if (entry.source !== 'voice') {
        return;
      }
      ingest({
        role: entry.role,
        text: entry.text,
        timestamp: entry.timestamp,
      });
    });

    return () => {
      unsubscribe();
      unregisterSurface();
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
          text: formatToolCallLabel(detail.name, detail.args, detail.ok),
          source: 'tool',
          toolCall: { name: detail.name, args: detail.args, ok: detail.ok },
          createdAt: detail.timestamp,
        },
      ]);
      setIsAwaitingReply(false);
    };
    window.addEventListener('landi:tool-call', onToolCall as EventListener);
    return () => {
      window.removeEventListener('landi:tool-call', onToolCall as EventListener);
    };
  }, []);

  // Scripted demo completion — user-readable assistant line, not Thinking.
  useEffect(() => {
    const onAssistantMessage = (e: Event) => {
      const detail = (e as CustomEvent<{ text?: string }>).detail;
      const text = detail?.text?.trim();
      if (!text) return;
      setIsAwaitingReply(false);
      setMessages((prev) => [...prev,
        {
          id: `a-script-${Date.now().toString(36)}`,
          role: 'assistant',
          text,
          source: 'text',
          createdAt: new Date().toISOString(),
        },
      ]);
    };
    window.addEventListener('landi:assistant-message', onAssistantMessage as EventListener);
    return () => {
      window.removeEventListener('landi:assistant-message', onAssistantMessage as EventListener);
    };
  }, []);

  // Scripted demo transcript lines (P8) — no LLM, no Thinking spinner.
  useEffect(() => {
    const onInject = (e: Event) => {
      const detail = (e as CustomEvent<ChatTranscriptInjectDetail>).detail;
      if (!detail?.text?.trim()) return;
      setIsAwaitingReply(false);
      setMessages((prev) => [...prev,
        {
          id: `inj-${Date.now().toString(36)}`,
          role: detail.role,
          text: detail.text.trim(),
          source: detail.source ?? (detail.toolCall ? 'tool' : 'text'),
          toolCall: detail.toolCall,
          createdAt: detail.createdAt ?? new Date().toISOString(),
        },
      ]);
    };
    window.addEventListener(CHAT_TRANSCRIPT_INJECT_EVENT, onInject as EventListener);
    return () => {
      window.removeEventListener(CHAT_TRANSCRIPT_INJECT_EVENT, onInject as EventListener);
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
      // No live credential configured. On a draw-capable engine (the
      // tldraw whiteboard), run the deterministic offline chat-to-draw
      // fallback instead of a static mock string, so the draw pipeline
      // still visibly works end to end. Non-drawing hosts (most gallery
      // examples use the legacy CanvasShell substrate) fall back to the
      // previous plain-text notice - `runOfflineDrawFallback` returns that
      // itself when `isDrawCapabilityAvailable()` is false.
      setIsAwaitingReply(true);
      try {
        const fallback = await runOfflineDrawFallback();
        setMessages((prev) => [...prev,
          {
            id: `a-${Date.now().toString(36)}`,
            role: 'assistant',
            text: fallback.text,
            source: 'text',
            createdAt: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        const msg = (err as Error).message ?? 'offline demo draw failed';
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
      return;
    }

    setIsAwaitingReply(true);
    try {
      const result = await chatClient.send(
        // Send the history WITHOUT the just-appended user message - the
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

  const prefetchGuardRef = useRef<string | null>(null);

  const handleStarterSelect = useCallback((prompt: { text: string; prefetchTool?: { name: string; args?: Record<string, unknown> } }) => {
    if (prompt.prefetchTool?.name) {
      const prefetchKey = `${prompt.prefetchTool.name}:${JSON.stringify(prompt.prefetchTool.args ?? {})}`;
      if (prefetchGuardRef.current !== prefetchKey) {
        prefetchGuardRef.current = prefetchKey;
        void executeTool(prompt.prefetchTool.name, prompt.prefetchTool.args ?? {}).finally(() => {
          if (prefetchGuardRef.current === prefetchKey) {
            prefetchGuardRef.current = null;
          }
        });
      }
    }
    void sendMessage(prompt.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isEmpty = messages.length === 0;
  const canSend = inputValue.trim().length > 0 && !isAwaitingReply;

  const body = (
    <div
      data-testid="landi-chat-panel"
      style={
        {
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: 'var(--vibe-background)',
          color: 'var(--vibe-text)',
        } as React.CSSProperties
      }
    >
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: isEmpty ? 0 : '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: isEmpty ? 0 : 14,
        }}
      >
      {isEmpty ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '40px 24px 24px',
              textAlign: 'center',
            }}
          >
            <ChatPersonaAvatar
              size="lg"
              initial={avatarInitial}
              assistantName={assistantName}
              showVisual={showPersonaVisual}
              visualType={visualType}
              isAwaitingReply={isAwaitingReply}
            />
            <h2 style={{ marginTop: 20, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--vibe-text)' }}>
              Hi, I&apos;m {assistantName}.
            </h2>
            <p style={{ marginTop: 6, fontSize: 13.5, color: 'var(--vibe-text-muted)', maxWidth: 340, lineHeight: 1.5 }}>
              {emptyStateWelcome}
            </p>

            <div style={{ marginTop: 24, width: '100%', display: 'flex', justifyContent: 'center' }}>
              <StarterChips
                prompts={starterPrompts}
                variant="cards"
                onSelect={handleStarterSelect}
              />
            </div>

            <p style={{ marginTop: 24, fontSize: 11, color: 'var(--vibe-text-faint)' }}>
              {chatClient
                ? `Live ${assistantName} · responses are real`: useMock
                  ? `Mock ${assistantName} · set VITE_LANDI_CHAT_PROXY_URL for live responses`: `${assistantName} chat unavailable`}
            </p>
          </div>
      ): (
        <>
          {messages.map((msg) => {
            if (msg.source === 'tool' && msg.toolCall) {
              const ok = msg.toolCall.ok;
              const signature = formatToolCallSignature(msg.toolCall.name, msg.toolCall.args);
              return (
                <div key={msg.id} style={{ display: 'flex', gap: 10 }}>
                  <ChatPersonaAvatar
                    initial={avatarInitial}
                    assistantName={assistantName}
                    showVisual={showPersonaVisual}
                    visualType={visualType}
                    isAwaitingReply={false}
                  />
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      maxWidth: '92%',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--vibe-text-faint)',
                        marginBottom: 4,
                      }}
                    >
                      Tool call
                    </div>
                    <div
                      style={{
                        display: 'block',
                        padding: '10px 12px',
                        borderRadius: 10,
                        borderTopLeftRadius: 4,
                        fontSize: 12.5,
                        fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
                        background: ok
                          ? 'color-mix(in srgb, var(--vibe-accent) 8%, var(--vibe-surface))': 'rgba(244,63,94,0.08)',
                        border: `1px solid ${ok ? 'color-mix(in srgb, var(--vibe-accent) 35%, var(--vibe-border))' : 'rgba(244,63,94,0.35)'}`,
                        color: ok ? 'var(--vibe-text)' : '#fb7185',
                        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                      }}
                      data-testid="chat-tool-call-block"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        {ok ? <Wrench size={13} style={{ color: 'var(--vibe-accent)' }} /> : <AlertTriangle size={13} />}
                        <code style={{ fontSize: 12, fontWeight: 600, color: 'var(--vibe-accent)' }}>{signature}</code>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--vibe-text-muted)' }}>{msg.text}</span>
                    </div>
                  </div>
                </div>
              );
            }
            if (msg.role === 'assistant') {
              return (
                <div key={msg.id} className="landi-msg" style={{ display: 'flex', gap: 10 }}>
                  <ChatPersonaAvatar
                    initial={avatarInitial}
                    assistantName={assistantName}
                    showVisual={showPersonaVisual}
                    visualType={visualType}
                    isAwaitingReply={false}
                  />
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
              <ChatPersonaAvatar
                initial={avatarInitial}
                assistantName={assistantName}
                showVisual={showPersonaVisual}
                visualType={visualType}
                isAwaitingReply
              />
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
        </>
      )}
      </div>

      <div style={{ borderTop: '1px solid var(--vibe-border)', padding: 12, background: 'var(--vibe-composer-bg)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!isEmpty && starterPrompts.length > 0 && (
          <StarterChips
            prompts={starterPrompts.slice(0, 4)}
            variant="compact"
            showPinAffordance
            onSelect={handleStarterSelect}
          />
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
                onClick={() => {
                  openPanelInCanvas('voice', { focus: true, preserveZoom: true });
                }}
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
                  ? 'linear-gradient(135deg, var(--vibe-accent) 0%, var(--vibe-accent-2) 100%)': 'var(--vibe-disabled-bg)',
              }}
            >
              <Send size={15} />
            </button>
          }
        />
      </div>

      {/* Hover-reveal message toolbars + markdown spacing for chat theme tokens. */}
      <style>{`.landi-msg:hover .landi-msg__toolbar { opacity: 1 !important; }.landi-md > *:first-child { margin-top: 0; }.landi-md > *:last-child { margin-bottom: 0; }.landi-md p { margin: 0 0 8px; }.landi-md ul,.landi-md ol { margin: 0 0 8px; padding-left: 18px; }.landi-md code { background: var(--vibe-code-inline-bg); padding: 1px 5px; border-radius: 4px; font-size: 12px; }.landi-md pre { background: var(--vibe-code-block-bg); border: 1px solid var(--vibe-border); border-radius: 8px; padding: 10px; overflow-x: auto; }.landi-md a { color: var(--vibe-accent); }
      `}</style>
    </div>
  );

  return body;
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
        background: hover ? 'var(--vibe-hover-bg)' : 'transparent',
        color: hover ? (accentOnHover ? 'var(--vibe-accent, #ff6b57)' : 'var(--vibe-text, #1A1A1A)') : 'var(--vibe-text-muted, #9CA3AF)',
        transition: 'all .14s ease',
      }}
    >
      {children}
    </button>
  );
}
