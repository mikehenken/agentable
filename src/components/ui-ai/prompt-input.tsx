import * as React from "react";

/**
 * shadcn.io/ai-style Prompt Input — an auto-resizing composer with a toolbar
 * row. Enter submits; Shift+Enter inserts a newline. Presentation-only and
 * self-contained: styled with inline styles + `--vibe-*` CSS vars (with dark
 * fallbacks) so it renders correctly whether or not the host defines a token
 * theme. Mirrors https://www.shadcn.io/ai/prompt-input.
 */
export interface PromptInputProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  /** Left-aligned toolbar controls (attach, mic, etc.). */
  toolbar?: React.ReactNode;
  /** Right-aligned actions (send button). */
  actions?: React.ReactNode;
  /** Chip row rendered above the textarea (e.g. attachments). */
  header?: React.ReactNode;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  maxRows?: number;
}

export const PromptInput: React.FC<PromptInputProps> = ({
  value,
  onValueChange,
  onSubmit,
  placeholder,
  disabled = false,
  toolbar,
  actions,
  header,
  textareaRef,
  maxRows = 8,
}) => {
  const innerRef = React.useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? innerRef;
  const [focused, setFocused] = React.useState(false);

  // Auto-resize: grow the textarea with content up to `maxRows`.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 20;
    const maxHeight = lineHeight * maxRows;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value, maxRows, ref]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled) onSubmit();
    }
  };

  return (
    <div
      style={{
        background: "var(--vibe-surface, #1a1a1a)",
        border: `1px solid ${focused ? "var(--vibe-accent, #ff6b57)" : "var(--vibe-border, rgba(255,255,255,0.09))"}`,
        borderRadius: 14,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        boxShadow: focused
          ? "0 0 0 3px color-mix(in srgb, var(--vibe-accent, #ff6b57) 18%, transparent)": "none",
        transition: "border-color .15s ease, box-shadow .15s ease",
      }}
    >
      {header}
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        style={{
          border: 0,
          outline: "none",
          resize: "none",
          width: "100%",
          background: "transparent",
          color: "var(--vibe-text, #eaeaea)",
          fontFamily: "inherit",
          fontSize: 13.5,
          lineHeight: "20px",
          padding: "2px 0",
          maxHeight: maxRows * 20,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>{toolbar}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>{actions}</div>
      </div>
    </div>
  );
};
