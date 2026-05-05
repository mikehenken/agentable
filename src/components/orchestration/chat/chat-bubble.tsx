import * as React from "react";
import type { ChatMessage } from "../types";

export interface ChatBubbleProps {
  m: ChatMessage;
  /** Map a chat mode id → human label (e.g. for mode tag in assistant header). */
  modeLabel?: (mode: string | undefined) => string;
  /** Map a profile id → human label. */
  profileLabel?: (profile: string | undefined) => string;
  /** Map a model id → human label. */
  modelLabel?: (model: string | undefined) => string;
}

const MODE_INITIAL: Record<string, string> = {
  agent: "A",
  "workflow-builder": "W",
  planning: "P",
  conductor: "O",
};

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  m,
  modeLabel = (s) => s ?? "orchestrator",
  profileLabel = (s) => s ?? "",
  modelLabel = (s) => s ?? "",
}) => {
  if (m.role === "system")
    return (
      <div
        style={{
          alignSelf: "center",
          padding: "5px 10px",
          borderRadius: 999,
          background: "var(--positive-soft)",
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          color: "var(--positive-fg)",
          letterSpacing: ".02em",
        }}
      >
        {m.text}
      </div>
    );

  if (m.role === "user")
    return (
      <div style={{ alignSelf: "flex-end", maxWidth: "88%" }}>
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 12,
            borderBottomRightRadius: 4,
            background: "var(--accent)",
            color: "var(--fg-on-accent)",
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          {m.text}
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--fg-faint)",
            textAlign: "right",
            marginTop: 2,
            fontFamily: "var(--font-mono)",
          }}
        >
          you · just now
        </div>
      </div>
    );

  const meta = m.meta;
  return (
    <div style={{ alignSelf: "flex-start", maxWidth: "92%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            background: "var(--bg-sunken)",
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 9.5,
            color: "var(--accent-fg)",
            fontWeight: 600,
          }}
        >
          {MODE_INITIAL[meta?.mode ?? "conductor"] ?? "O"}
        </div>
        <span style={{ fontSize: 10.5, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>
          {modeLabel(meta?.mode).toLowerCase()}
        </span>
        {meta && (
          <>
            <span style={{ fontSize: 10, color: "var(--fg-ghost)" }}>·</span>
            <span style={{ fontSize: 10, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>
              {profileLabel(meta.profile)} · {modelLabel(meta.model)}
            </span>
          </>
        )}
      </div>
      <div
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          borderTopLeftRadius: 4,
          background: "var(--bg-panel)",
          border: "1px solid var(--border-subtle)",
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--fg-base)",
          fontFamily: "var(--font-serif)",
        }}
      >
        {m.text}
      </div>
    </div>
  );
};
