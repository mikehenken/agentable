import * as React from "react";
import { useStickToBottom } from "use-stick-to-bottom";

export interface ConversationProps {
  /** Messages slot. The component owns the scroll; children render flat. */
  children: React.ReactNode;
  /** Optional className for the outer scroll container. */
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Auto-scrolling chat container. Sticks to the bottom while new
 * messages arrive but yields gracefully when the user scrolls up to
 * read history (the `use-stick-to-bottom` hook tracks user intent).
 *
 * When the user has scrolled away, a "scroll to bottom" pill appears
 * bottom-right so they can re-anchor without dragging the scrollbar.
 */
export const Conversation: React.FC<ConversationProps> = ({ children, className, style }) => {
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom({
    initial: "instant",
    resize: "smooth",
  });

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        ref={scrollRef}
        className={className}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "14px 14px 12px",
          ...style,
        }}
      >
        <div
          ref={contentRef}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          {children}
        </div>
      </div>

      {!isAtBottom && (
        <button
          onClick={() => void scrollToBottom()}
          title="Scroll to latest"
          aria-label="Scroll to latest message"
          style={{
            position: "absolute",
            bottom: 12,
            right: 12,
            padding: "5px 10px",
            borderRadius: 999,
            background: "var(--bg-panel)",
            border: "1px solid var(--border-base)",
            boxShadow: "0 4px 12px rgba(0,0,0,.18)",
            fontSize: 11,
            fontWeight: 500,
            color: "var(--fg-strong)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 13, lineHeight: 0 }}>↓</span>
          <span>Latest</span>
        </button>
      )}
    </div>
  );
};
