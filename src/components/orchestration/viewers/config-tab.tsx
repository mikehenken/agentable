import * as React from "react";
import { Eyebrow } from "../../general";

export interface ConfigTabProps {
  filename?: string;
  /** Pre-formatted YAML body. Host can pass any string; component renders it inside a sunken pre. */
  body?: React.ReactNode;
}

export const ConfigTab: React.FC<ConfigTabProps> = ({
  filename = "run-0142.config.yaml",
  body,
}) => (
  <div style={{ height: "100%", overflow: "auto", background: "var(--bg-canvas)", padding: "32px 36px" }}>
    <div style={{ maxWidth: 720 }}>
      <Eyebrow>Run config</Eyebrow>
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 24,
          fontWeight: 500,
          color: "var(--fg-strong)",
          margin: "8px 0 24px",
          letterSpacing: "-0.01em",
        }}
      >
        {filename}
      </h1>
      <pre
        style={{
          margin: 0,
          padding: "20px 24px",
          borderRadius: 10,
          background: "var(--bg-panel)",
          border: "1px solid var(--border-subtle)",
          fontFamily: "var(--font-mono)",
          fontSize: 12.5,
          lineHeight: 1.7,
          color: "var(--code-fg)",
        }}
      >
        {body ?? <DefaultConfig />}
      </pre>
    </div>
  </div>
);

const k = (s: string) => <span style={{ color: "var(--code-key)" }}>{s}</span>;
const str = (s: React.ReactNode) => <span style={{ color: "var(--code-string)" }}>{s}</span>;
const num = (n: React.ReactNode) => <span style={{ color: "var(--code-number)" }}>{n}</span>;
const kw = (s: string) => <span style={{ color: "var(--code-keyword)" }}>{s}</span>;
const cm = (s: string) => <span style={{ color: "var(--code-comment)" }}>{s}</span>;

const DefaultConfig: React.FC = () => (
  <>
    {`# run-0142 — Acme brand monitoring intake\n`}
    {k("client")}: {str("acme")}
    {`\n`}
    {k("project")}: {str("brand-mon")}
    {`\n`}
    {k("use_case")}: {str("UC-01")}
    {`\n\n`}
    {k("pipeline")}:{`\n`}
    {`  `}
    {kw("- ")}
    {k("agent")}: {str("intake-agent")}
    {`\n`}
    {`  `}
    {kw("- ")}
    {k("agent")}: {str("analyst-agent")}
    {`\n`}
    {`    `}
    {k("max_iterations")}: {num(3)}
    {`\n`}
    {`    `}
    {k("review_after_each")}: {num("true")}
    {`\n`}
    {`  `}
    {kw("- ")}
    {k("agent")}: {str("gap-analyzer")}
    {`\n`}
    {`    `}
    {k("threshold")}: {num(85)}
    {`\n\n`}
    {k("downstream")}: [{str("architecture-agent")}, {str("system-design-agent")}]
    {`\n`}
    {k("region")}: {str("ca-central-1")} {cm("# Section 10 compliance")}
    {`\n`}
  </>
);
