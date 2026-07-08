import * as React from "react";

/**
 * shadcn.io/ai-style Suggestions — a wrapping row of quick-reply pills the
 * user can click to seed the composer or send directly. Presentation-only,
 * styled with inline styles + `--vibe-*` CSS vars (dark fallbacks). Mirrors
 * https://www.shadcn.io/ai/suggestion.
 */
export interface SuggestionItem {
  /** Stable key + the text sent/seeded when clicked. */
  text: string;
  /** Optional leading glyph (emoji or short label). */
  icon?: React.ReactNode;
  /** Optional visible label when it differs from `text`. */
  label?: string;
}

export interface SuggestionsProps {
  items: SuggestionItem[];
  onSelect: (text: string) => void;
  style?: React.CSSProperties;
}

const Pill: React.FC<{ item: SuggestionItem; onSelect: (t: string) => void }> = ({ item, onSelect }) => {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() => onSelect(item.text)}
      title={item.label ?? item.text}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 11px",
        borderRadius: 999,
        cursor: "pointer",
        whiteSpace: "nowrap",
        fontSize: 12,
        fontFamily: "inherit",
        color: hover ? "var(--vibe-accent, #ff6b57)" : "var(--vibe-text-muted, #b7b7b7)",
        background: hover
          ? "color-mix(in srgb, var(--vibe-accent, #ff6b57) 12%, transparent)"
          : "var(--vibe-surface, #1a1a1a)",
        border: `1px solid ${hover ? "var(--vibe-accent, #ff6b57)" : "var(--vibe-border, rgba(255,255,255,0.09))"}`,
        transition: "all .14s ease",
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {item.icon != null && <span style={{ lineHeight: 1 }}>{item.icon}</span>}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.label ?? item.text}</span>
    </button>
  );
};

export const Suggestions: React.FC<SuggestionsProps> = ({ items, onSelect, style }) => {
  if (items.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, ...style }}>
      {items.map((s) => (
        <Pill key={s.text} item={s} onSelect={onSelect} />
      ))}
    </div>
  );
};
