import * as React from "react";

export interface LogLine {
  t: string;
  lvl: "INFO" | "DEBUG" | "WARN" | "ERROR";
  agent: string;
  msg: string;
  /** R2 key of the underlying LLM call log — drives `get_llm_call`. */
  logKey?: string;
}

export interface LogsTabProps {
  lines: LogLine[];
  /**
   * Called when the user clicks a log line. Receives the line's
   * `logKey` if present. Hosts that wire `get_llm_call` use this to
   * open a detail drawer with the full prompt + response. Optional —
   * when omitted, lines render as static (un-clickable) text.
   */
  onSelect?: (line: LogLine) => void;
  /** Currently-selected line key — drives the highlight. */
  selectedKey?: string;
}

const LVL_COLOR: Record<LogLine["lvl"], string> = {
  INFO: "var(--info-fg)",
  DEBUG: "var(--fg-faint)",
  WARN: "var(--warn-fg)",
  ERROR: "var(--negative-fg)",
};

export const LogsTab: React.FC<LogsTabProps> = ({ lines, onSelect, selectedKey }) => (
  <div style={{ height: "100%", overflow: "auto", background: "var(--bg-panel)", padding: "16px 24px" }}>
    <pre
      style={{
        margin: 0,
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        lineHeight: 1.65,
        color: "var(--code-fg)",
        whiteSpace: "pre",
      }}
    >
      {lines.map((l, i) => {
        const clickable = !!onSelect && !!l.logKey;
        const selected = !!selectedKey && l.logKey === selectedKey;
        return (
          <div
            key={i}
            onClick={clickable ? () => onSelect!(l) : undefined}
            style={{
              display: "grid",
              gridTemplateColumns: "70px 56px 130px 1fr",
              gap: 12,
              padding: "1px 6px",
              margin: "0 -6px",
              borderRadius: 3,
              cursor: clickable ? "pointer" : "default",
              background: selected ? "var(--bg-active)" : "transparent",
            }}
            onMouseEnter={(e) => {
              if (clickable && !selected)
                (e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)";
            }}
            onMouseLeave={(e) => {
              if (clickable && !selected)
                (e.currentTarget as HTMLDivElement).style.background = "transparent";
            }}
          >
            <span style={{ color: "var(--fg-faint)" }}>{l.t}</span>
            <span style={{ color: LVL_COLOR[l.lvl], fontWeight: 500 }}>{l.lvl}</span>
            <span style={{ color: "var(--accent-fg)" }}>{l.agent}</span>
            <span style={{ color: "var(--fg-base)", whiteSpace: "pre-wrap" }}>{l.msg}</span>
          </div>
        );
      })}
    </pre>
  </div>
);
