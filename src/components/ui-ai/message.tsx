import * as React from "react";

export type MessageRole = "user" | "assistant" | "system";

export interface MessageProps {
  from: MessageRole;
  /** Optional header content (e.g. avatar + meta). Rendered above the bubble. */
  header?: React.ReactNode;
  /** Optional footer (timestamp, status). Rendered below the bubble. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Single-message wrapper. Lays out role-aware alignment, the optional
 * header/footer slots, and the bubble itself. Intentionally
 * presentation-only — content rendering is delegated to MessageContent
 * (or a custom child) so the same shell works for plain text, rich
 * markdown, marker blocks, attachments, and any future block kind.
 */
export const Message: React.FC<MessageProps> = ({ from, header, footer, children }) => {
  if (from === "system") {
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
        {children}
      </div>
    );
  }

  const align = from === "user" ? "flex-end" : "flex-start";
  return (
    <div style={{ alignSelf: align, maxWidth: from === "user" ? "88%" : "94%", display: "flex", flexDirection: "column" }}>
      {header && <div style={{ marginBottom: 4 }}>{header}</div>}
      {children}
      {footer && <div style={{ marginTop: 2 }}>{footer}</div>}
    </div>
  );
};

export interface MessageContentProps {
  from: MessageRole;
  children: React.ReactNode;
  /** Override default bubble styling. */
  style?: React.CSSProperties;
}

/**
 * Bubble shell for message body. Role-aware default styling; can be
 * overridden via `style` for marker blocks that want to break out
 * of the bubble (e.g. a plan card that occupies the full width).
 */
export const MessageContent: React.FC<MessageContentProps> = ({ from, children, style }) => {
  if (from === "user") {
    return (
      <div
        style={{
          padding: "8px 12px",
          borderRadius: 12,
          borderBottomRightRadius: 4,
          background: "var(--accent)",
          color: "var(--fg-on-accent)",
          fontSize: 13,
          lineHeight: 1.45,
          ...style,
        }}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        borderTopLeftRadius: 4,
        background: "var(--bg-panel)",
        border: "1px solid var(--border-subtle)",
        fontSize: 13,
        lineHeight: 1.6,
        color: "var(--fg-base)",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
