import * as React from "react";

export interface LogLine {
  t: string;
  lvl: "INFO" | "DEBUG" | "WARN" | "ERROR";
  agent: string;
  msg: string;
}

export interface LogsTabProps {
  lines: LogLine[];
}

const LVL_COLOR: Record<LogLine["lvl"], string> = {
  INFO: "var(--info-fg)",
  DEBUG: "var(--fg-faint)",
  WARN: "var(--warn-fg)",
  ERROR: "var(--negative-fg)",
};

export const LogsTab: React.FC<LogsTabProps> = ({ lines }) => (
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
      {lines.map((l, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "70px 56px 130px 1fr", gap: 12 }}>
          <span style={{ color: "var(--fg-faint)" }}>{l.t}</span>
          <span style={{ color: LVL_COLOR[l.lvl], fontWeight: 500 }}>{l.lvl}</span>
          <span style={{ color: "var(--accent-fg)" }}>{l.agent}</span>
          <span style={{ color: "var(--fg-base)", whiteSpace: "pre-wrap" }}>{l.msg}</span>
        </div>
      ))}
    </pre>
  </div>
);
