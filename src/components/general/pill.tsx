import * as React from "react";

export type PillTone = "neutral" | "accent" | "positive" | "negative" | "warn" | "info" | "ghost";
export type PillSize = "xs" | "sm";

export interface PillProps {
  tone?: PillTone;
  size?: PillSize;
  mono?: boolean;
  children: React.ReactNode;
}

const TONE_STYLES: Record<PillTone, { bg: string; fg: string; bd: string }> = {
  neutral:  { bg: "var(--bg-sunken)",     fg: "var(--fg-muted)",   bd: "var(--border-subtle)" },
  accent:   { bg: "var(--accent-soft)",   fg: "var(--accent-fg)",  bd: "transparent" },
  positive: { bg: "var(--positive-soft)", fg: "var(--positive-fg)", bd: "transparent" },
  negative: { bg: "var(--negative-soft)", fg: "var(--negative-fg)", bd: "transparent" },
  warn:     { bg: "var(--warn-soft)",     fg: "var(--warn-fg)",    bd: "transparent" },
  info:     { bg: "var(--info-soft)",     fg: "var(--info-fg)",    bd: "transparent" },
  ghost:    { bg: "transparent",          fg: "var(--fg-faint)",   bd: "var(--border-subtle)" },
};

/**
 * Tone-driven status pill. Uses the orchestration token vocabulary
 * (`--bg-sunken`, `--accent-soft`, `--positive-soft`, etc.) so it adopts
 * the host theme without any class wiring.
 */
export const Pill: React.FC<PillProps> = ({ tone = "neutral", size = "sm", mono = true, children }) => {
  const c = TONE_STYLES[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
        fontSize: size === "xs" ? "10px" : "10.5px",
        letterSpacing: ".04em",
        textTransform: mono ? "uppercase" : "none",
        padding: size === "xs" ? "1px 6px" : "2px 7px",
        borderRadius: "var(--r-pill)",
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.bd}`,
        lineHeight: 1.4,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
};
