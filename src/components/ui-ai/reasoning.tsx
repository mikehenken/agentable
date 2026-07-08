import * as React from "react";

/**
 * shadcn.io/ai-style Reasoning — a collapsible "thinking" disclosure. While
 * `streaming` is true it shows a shimmering label; once complete the trigger
 * summarizes the elapsed duration and the body can be expanded to read the
 * chain-of-thought. Presentation-only, inline-styled with `--vibe-*` vars.
 * Mirrors https://www.shadcn.io/ai/reasoning.
 */
export interface ReasoningProps {
  children?: React.ReactNode;
  streaming?: boolean;
  /** Auto-collapse when streaming finishes (default: follows `streaming`). */
  defaultOpen?: boolean;
  durationSeconds?: number;
}

export const Reasoning: React.FC<ReasoningProps> = ({
  children,
  streaming = false,
  defaultOpen,
  durationSeconds,
}) => {
  const [open, setOpen] = React.useState<boolean>(defaultOpen ?? streaming);

  React.useEffect(() => {
    if (streaming) setOpen(true);
    else if (defaultOpen == null) setOpen(false);
  }, [streaming, defaultOpen]);

  const label = streaming
    ? "Thinking"
    : durationSeconds != null
      ? `Thought for ${durationSeconds}s`
      : "Reasoning";

  const hasBody = children != null && children !== "";

  return (
    <div style={{ width: "100%" }}>
      <style>{`@keyframes landiVibeShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <button
        type="button"
        aria-expanded={open ? 'true' : 'false'}
        onClick={() => hasBody && setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 4px",
          background: "transparent",
          border: 0,
          cursor: hasBody ? "pointer" : "default",
          fontSize: 12,
          color: "var(--vibe-text-muted, #9a9a9a)",
          fontFamily: "inherit",
        }}
      >
        <span
          style={
            streaming
              ? {
                  backgroundImage:
                    "linear-gradient(90deg, var(--vibe-text-muted, #9a9a9a) 0%, var(--vibe-text, #eaeaea) 50%, var(--vibe-text-muted, #9a9a9a) 100%)",
                  backgroundSize: "200% 100%",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  animation: "landiVibeShimmer 1.4s linear infinite",
                }
              : undefined
          }
        >
          {label}
        </span>
        {hasBody && (
          <span
            style={{
              display: "inline-block",
              transform: open ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform .15s ease",
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            ›
          </span>
        )}
      </button>
      {open && hasBody && (
        <div
          style={{
            marginTop: 4,
            paddingLeft: 10,
            borderLeft: "2px solid var(--vibe-border, rgba(255,255,255,0.12))",
            fontSize: 12.5,
            lineHeight: 1.55,
            color: "var(--vibe-text-muted, #9a9a9a)",
            whiteSpace: "pre-wrap",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};
