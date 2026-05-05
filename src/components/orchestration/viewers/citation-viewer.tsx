import * as React from "react";
import { Icon } from "../../general";
import type { Citation } from "../types";

export interface CitationViewerProps {
  citations: Citation[];
}

export const CitationViewer: React.FC<CitationViewerProps> = ({ citations }) => (
  <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-panel)" }}>
    <div
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontFamily: "var(--font-mono)",
        fontSize: 11.5,
        color: "var(--fg-muted)",
      }}
    >
      <Icon name="yaml" size={13} style={{ color: "var(--accent)" }} />
      <span style={{ color: "var(--fg-strong)" }}>citation-record.yaml</span>
      <span>·</span>
      <span>{citations.length} sources</span>
      <span>·</span>
      <span>AMA format</span>
      <span style={{ marginLeft: "auto" }}>UTF-8</span>
    </div>
    <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
      <pre
        style={{
          margin: 0,
          fontFamily: "var(--font-mono)",
          fontSize: 12.5,
          lineHeight: 1.65,
          color: "var(--code-fg)",
          whiteSpace: "pre",
        }}
      >
        <span style={{ color: "var(--code-comment)" }}>
          {`# citation-record.yaml — run-0142 · iter 3\n# AMA format · self-reviewed · all anchors verified\n\n`}
        </span>
        <span style={{ color: "var(--code-key)" }}>citations</span>
        <span style={{ color: "var(--fg-base)" }}>:</span>
        {`\n`}
        {citations.map((c, i) => (
          <React.Fragment key={c.id}>
            <span style={{ color: "var(--code-keyword)" }}>{`  - `}</span>
            <span style={{ color: "var(--code-key)" }}>id</span>
            <span>: </span>
            <span style={{ color: "var(--code-string)" }}>{c.id}</span>
            {`\n`}
            {`    `}
            <span style={{ color: "var(--code-key)" }}>source</span>
            <span>: </span>
            <span style={{ color: "var(--code-string)" }}>{`"${c.source}"`}</span>
            {`\n`}
            {`    `}
            <span style={{ color: "var(--code-key)" }}>page</span>
            <span>: </span>
            <span style={{ color: "var(--code-string)" }}>{c.page}</span>
            {`\n`}
            {`    `}
            <span style={{ color: "var(--code-key)" }}>anchored_intents</span>
            <span>: </span>
            <span style={{ color: "var(--code-string)" }}>{`[${c.anchor}]`}</span>
            {`\n`}
            {`    `}
            <span style={{ color: "var(--code-key)" }}>retrieved_at</span>
            <span>: </span>
            <span style={{ color: "var(--code-number)" }}>{c.retrieved}</span>
            {`\n`}
            {i < citations.length - 1 && `\n`}
          </React.Fragment>
        ))}
      </pre>
    </div>
  </div>
);
