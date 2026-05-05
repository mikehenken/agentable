import * as React from "react";
import { Icon, type IconName } from "../../general";
import type { ArtifactKind, ChatMessage, ChatMessages, ChatMode, ChatSessionAdapter } from "../types";
import { ChatBubble } from "./chat-bubble";
import { SettingsDrawer, type ChatModeDef, type ProfileOption, type ModelOption } from "./settings-drawer";
import type { FlatArtifact } from "../modals/context-picker-modal";

const ARTIFACT_KIND_ICON: Record<ArtifactKind, IconName> = {
  markdown: "doc",
  yaml: "yaml",
  "yaml-cite": "yaml",
  gap: "spark",
  tldraw: "board",
  source: "artifact",
};

export interface ChatPanelProps {
  /** Adapter wired to the host's transport (REST chat, mock, etc.). */
  session: ChatSessionAdapter;
  modes: ChatModeDef[];
  profiles: ProfileOption[];
  models: ModelOption[];
  /** Initial mode/profile/model. */
  defaults?: { mode?: ChatMode; profile?: string; model?: string };
  /** Hook for the "+" button — host opens the context picker and returns added items. */
  onOpenContextPicker?: () => void;
  /** Pinned context — host owns the list. */
  context?: FlatArtifact[];
  /** Remove a context item by id. */
  onRemoveContext?: (id: string) => void;
  /** Open a context artifact in the host's viewer modal. */
  onOpenContextArtifact?: (artifact: FlatArtifact) => void;
  /** True when the chat session is reachable. Drives the header status dot. */
  connected?: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  session,
  modes,
  profiles,
  models,
  defaults = {},
  onOpenContextPicker,
  context = [],
  onRemoveContext,
  onOpenContextArtifact,
  connected = true,
}) => {
  const [mode, setMode] = React.useState<ChatMode>(defaults.mode ?? "conductor");
  const [profile, setProfile] = React.useState(defaults.profile ?? profiles[0]?.id ?? "");
  const [model, setModel] = React.useState(defaults.model ?? models[0]?.id ?? "");
  const [customPrompt, setCustomPrompt] = React.useState("");
  const [showSettings, setShowSettings] = React.useState(false);

  const [messages, setMessages] = React.useState<ChatMessages>(session.seed);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, mode]);

  // Patch the session whenever mode/profile/model swaps. Fire-and-forget; host
  // is responsible for surfacing errors via toasts.
  React.useEffect(() => {
    void session.patch({ mode, profile, model }).catch(() => {});
  }, [mode, profile, model, session]);

  const modeDef = modes.find((m) => m.id === mode) ?? modes[0];
  const profileDef = profiles.find((p) => p.id === profile);
  const modelDef = models.find((m) => m.id === model);

  const send = async () => {
    if (!input.trim() || sending) return;
    const text = input;
    setInput("");
    setSending(true);
    setMessages((m) => [...m, { role: "user", text } as ChatMessage]);
    try {
      const reply = await session.send(text, { mode, profile, model });
      setMessages((m) => [...m, reply]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: `Failed to reach the orchestrator: ${err instanceof Error ? err.message : String(err)}`,
          meta: { mode, profile, model },
        } as ChatMessage,
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <aside
      style={{
        width: 360,
        flexShrink: 0,
        background: "var(--bg-app)",
        borderLeft: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>{modeDef?.icon}</span>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, flex: 1, minWidth: 0 }}>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--fg-strong)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {modeDef?.label}
            </span>
            <span
              style={{
                fontSize: 10.5,
                color: "var(--fg-faint)",
                fontFamily: "var(--font-mono)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {profileDef?.label} · {modelDef?.label}
            </span>
          </div>
          <button
            onClick={() => setShowSettings((s) => !s)}
            title="Configure"
            style={{
              width: 24,
              height: 24,
              borderRadius: 5,
              display: "grid",
              placeItems: "center",
              color: showSettings ? "var(--fg-strong)" : "var(--fg-muted)",
              background: showSettings ? "var(--bg-active)" : "transparent",
              cursor: "pointer",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!showSettings) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
            }}
            onMouseLeave={(e) => {
              if (!showSettings) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <Icon name="sliders" size={13} />
          </button>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10.5,
              color: connected ? "var(--positive-fg)" : "var(--fg-faint)",
              fontFamily: "var(--font-mono)",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: connected ? "var(--positive)" : "var(--fg-ghost)",
                boxShadow: connected ? "0 0 0 2px var(--positive-soft)" : "none",
              }}
            ></span>
            {connected ? "ready" : "offline"}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            gap: 2,
            marginTop: 8,
            padding: 2,
            background: "var(--bg-sunken)",
            borderRadius: 6,
          }}
        >
          {modes.map((m) => {
            const on = m.id === mode;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id as ChatMode)}
                title={m.blurb}
                style={{
                  flex: 1,
                  padding: "4px 4px",
                  borderRadius: 4,
                  cursor: "pointer",
                  background: on ? "var(--bg-panel)" : "transparent",
                  boxShadow: on ? "0 1px 1px rgba(0,0,0,.04)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  fontSize: 11,
                  color: on ? "var(--fg-strong)" : "var(--fg-muted)",
                  fontWeight: on ? 500 : 400,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
              >
                <span style={{ fontSize: 12 }}>{m.icon}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {showSettings && modeDef && (
        <SettingsDrawer
          modeDef={modeDef}
          profile={profile}
          setProfile={setProfile}
          profiles={profiles}
          model={model}
          setModel={setModel}
          models={models}
          customPrompt={customPrompt}
          setCustomPrompt={setCustomPrompt}
        />
      )}

      {!showSettings && (
        <div
          style={{
            padding: "7px 12px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            flexWrap: "wrap",
            gap: 5,
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              color: "var(--fg-faint)",
              fontFamily: "var(--font-mono)",
              textTransform: "uppercase",
              letterSpacing: ".06em",
              marginRight: 2,
            }}
          >
            Context:
          </span>
          {context.length === 0 && (
            <span style={{ fontSize: 11, color: "var(--fg-ghost)", fontStyle: "italic" }}>nothing pinned</span>
          )}
          {context.map((a) => (
            <button
              key={a.id}
              onClick={() => onOpenContextArtifact?.(a)}
              title="Open in viewer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 4px 2px 6px",
                borderRadius: 4,
                cursor: "pointer",
                background: "var(--bg-sunken)",
                border: "1px solid var(--border-subtle)",
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: "var(--fg-muted)",
                maxWidth: 200,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-strong)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-sunken)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-muted)";
              }}
            >
              <Icon
                name={ARTIFACT_KIND_ICON[a.kind] || "doc"}
                size={10}
                style={{ color: "var(--accent)", flexShrink: 0 }}
              />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveContext?.(a.id);
                }}
                style={{
                  width: 13,
                  height: 13,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 2,
                  color: "var(--fg-ghost)",
                  flexShrink: 0,
                }}
              >
                ×
              </span>
            </button>
          ))}
          <button
            title="Add context"
            onClick={() => onOpenContextPicker?.()}
            style={{
              width: 18,
              height: 18,
              borderRadius: 3,
              color: "var(--fg-faint)",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
          >
            <Icon name="plus" size={11} />
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "14px 14px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {messages.map((m, i) => (
          <ChatBubble
            key={i}
            m={m}
            modeLabel={(s) => modes.find((x) => x.id === s)?.label ?? "orchestrator"}
            profileLabel={(s) => profiles.find((p) => p.id === s)?.label ?? ""}
            modelLabel={(s) => models.find((m) => m.id === s)?.label ?? ""}
          />
        ))}
        {sending && (
          <div style={{ alignSelf: "flex-start", color: "var(--fg-faint)", fontSize: 11, fontFamily: "var(--font-mono)" }}>
            …thinking
          </div>
        )}
      </div>

      <div style={{ padding: "0 12px 8px", display: "flex", flexWrap: "wrap", gap: 4 }}>
        {modeDef?.suggestions.slice(0, 2).map((s) => (
          <button
            key={s}
            onClick={() => setInput(s)}
            style={{
              fontSize: 11,
              padding: "3px 8px",
              borderRadius: 999,
              background: "var(--bg-sunken)",
              border: "1px solid var(--border-subtle)",
              color: "var(--fg-muted)",
              cursor: "pointer",
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-sunken)")}
          >
            {s}
          </button>
        ))}
      </div>

      <div style={{ borderTop: "1px solid var(--border-subtle)", padding: 10 }}>
        <div
          style={{
            background: "var(--bg-panel)",
            border: "1px solid var(--border-base)",
            borderRadius: 8,
            padding: "8px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
            }}
            placeholder={
              mode === "conductor"
                ? "Ask the conductor — e.g. 'kick off iter-4'"
                : mode === "agent"
                  ? "Ask the agent — anything about this project"
                  : mode === "workflow-builder"
                    ? "Describe a workflow to build…"
                    : "Describe what you want to plan…"
            }
            rows={2}
            style={{
              border: 0,
              outline: "none",
              resize: "none",
              width: "100%",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              color: "var(--fg-base)",
              background: "transparent",
              padding: 2,
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={() => void send()}
              disabled={!input.trim() || sending}
              style={{
                marginLeft: "auto",
                padding: "5px 10px",
                borderRadius: 5,
                background: input.trim() && !sending ? "var(--accent)" : "var(--bg-sunken)",
                color: input.trim() && !sending ? "var(--fg-on-accent)" : "var(--fg-ghost)",
                fontSize: 12,
                fontWeight: 500,
                cursor: input.trim() && !sending ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span>Send</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, opacity: 0.7 }}>⌘↵</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
