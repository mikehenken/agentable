import * as React from "react";
import { Icon, Pill, type IconName } from "../../general";

interface PhaseBoxProps {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub: string;
  items: string[];
  tone: "info" | "warn" | "positive";
}

const PhaseBox: React.FC<PhaseBoxProps> = ({ x, y, w, h, title, sub, items, tone }) => {
  const toneFill =
    tone === "info" ? "var(--info-soft)" : tone === "warn" ? "var(--warn-soft)" : "var(--positive-soft)";
  const toneStroke = tone === "info" ? "var(--info)" : tone === "warn" ? "var(--warn)" : "var(--positive)";
  const toneFg = tone === "info" ? "var(--info-fg)" : tone === "warn" ? "var(--warn-fg)" : "var(--positive-fg)";
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill="var(--bg-panel)" stroke={toneStroke} strokeWidth={1.5} />
      <rect x={x} y={y} width={w} height={42} rx={8} fill={toneFill} />
      <rect x={x} y={y + 36} width={w} height={6} fill={toneFill} />
      <text
        x={x + 14}
        y={y + 20}
        fontSize="10"
        fill={toneFg}
        fontFamily="var(--font-mono)"
        letterSpacing="0.08em"
        fontWeight="600"
      >
        {title}
      </text>
      <text x={x + 14} y={y + 36} fontSize="11" fill={toneFg} fontFamily="var(--font-mono)">
        {sub}
      </text>
      {items.map((it, i) => (
        <g key={i}>
          <circle cx={x + 18} cy={y + 70 + i * 28} r="2.5" fill={toneStroke} />
          <text x={x + 28} y={y + 74 + i * 28} fontSize="13" fill="var(--fg-strong)" fontFamily="var(--font-sans)">
            {it}
          </text>
        </g>
      ))}
    </g>
  );
};

const TOOL_ICONS: IconName[] = ["sliders", "list", "table", "spark", "expand"];

/** Faux infinite canvas — phase architecture board (matches the prototype 1:1). */
export const TldrawViewer: React.FC = () => (
  <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-panel)" }}>
    <div
      style={{
        padding: "10px 16px",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontFamily: "var(--font-mono)",
        fontSize: 11.5,
        color: "var(--fg-muted)",
      }}
    >
      <Icon name="board" size={13} style={{ color: "var(--accent)" }} />
      <span style={{ color: "var(--fg-strong)" }}>architecture-sketch.tldr</span>
      <span>·</span>
      <span>3-phase rollout</span>
      <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <Pill tone="ghost">read-only</Pill>
        <Pill tone="ghost">snapshot</Pill>
      </span>
    </div>

    <div
      style={{
        flex: 1,
        overflow: "hidden",
        position: "relative",
        backgroundColor: "var(--bg-sunken)",
        backgroundImage: `radial-gradient(circle, var(--border-subtle) 1px, transparent 1px)`,
        backgroundSize: "24px 24px",
      }}
    >
      <div style={{ position: "absolute", inset: 0, padding: 40, overflow: "auto" }}>
        <svg width="1100" height="540" style={{ display: "block" }}>
          <defs>
            <marker
              id="arr"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--fg-muted)" />
            </marker>
          </defs>

          <PhaseBox
            x={20}
            y={140}
            w={300}
            h={260}
            title="PHASE 1 · MVP"
            sub="US-hosted · public data"
            items={["CT log monitoring", "SERP scraper (Google, Bing)", "Phone reverse lookup", "Allowlist classifier", "Watchtower MVP"]}
            tone="info"
          />
          <PhaseBox
            x={400}
            y={140}
            w={300}
            h={260}
            title="PHASE 2 · BACKSTOP"
            sub="Non-US · paid feeds"
            items={["Commercial DRP vendor", "SERP API (paid tier)", "Takedown workflow", "Evidence packager", "Boundary controls"]}
            tone="warn"
          />
          <PhaseBox
            x={780}
            y={140}
            w={300}
            h={260}
            title="PHASE 3 · FULL"
            sub="Non-US · internal corr."
            items={["IOC ↔ telemetry correlate", "E-chat / call signal", "Chargeback feed", "Audit log (7y)", "Section 10 attestation"]}
            tone="positive"
          />

          <text x={20} y={50} fontSize="20" fill="var(--fg-strong)" fontFamily="var(--font-serif)" fontWeight="500">
            Brand Monitoring · phased architecture
          </text>
          <text x={20} y={75} fontSize="12" fill="var(--fg-muted)" fontFamily="var(--font-mono)">
            non-US boundary enforced from Phase 2 onwards · Section 10 of Fraud Catalog
          </text>

          <line x1={320} y1={270} x2={400} y2={270} stroke="var(--fg-muted)" strokeWidth="1.5" markerEnd="url(#arr)" />
          <line x1={700} y1={270} x2={780} y2={270} stroke="var(--fg-muted)" strokeWidth="1.5" markerEnd="url(#arr)" />

          <line x1={370} y1={120} x2={370} y2={430} stroke="var(--warn)" strokeWidth="2" strokeDasharray="6 4" />
          <text x={376} y={120} fontSize="10" fill="var(--warn-fg)" fontFamily="var(--font-mono)">
            ▲ non-US boundary
          </text>

          <rect x={20} y={440} width={1060} height={70} rx={6} fill="var(--bg-panel)" stroke="var(--border-subtle)" />
          <text x={36} y={462} fontSize="11" fill="var(--fg-faint)" fontFamily="var(--font-mono)" letterSpacing="0.06em">
            CRITICAL DEPENDENCIES
          </text>
          <text x={36} y={482} fontSize="13" fill="var(--fg-base)">
            → Phase 2 cannot start without provisioned non-US env (BC-007)
          </text>
          <text x={36} y={500} fontSize="13" fill="var(--fg-base)">
            → Phase 3 requires both non-US infra + signal maturity from P1/P2
          </text>
        </svg>
      </div>

      <div
        style={{
          position: "absolute",
          left: 16,
          top: 16,
          background: "var(--bg-panel)",
          borderRadius: 6,
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-1)",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: 4,
        }}
      >
        {TOOL_ICONS.map((i) => (
          <button
            key={i}
            style={{
              width: 28,
              height: 28,
              display: "grid",
              placeItems: "center",
              color: "var(--fg-muted)",
              borderRadius: 4,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
          >
            <Icon name={i} size={14} />
          </button>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          right: 16,
          bottom: 16,
          background: "var(--bg-panel)",
          padding: "5px 10px",
          borderRadius: 6,
          border: "1px solid var(--border-subtle)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--fg-muted)",
        }}
      >
        100% · 1100 × 540
      </div>
    </div>
  </div>
);
