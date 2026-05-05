import * as React from "react";
import { Eyebrow, Icon, Pill } from "../../general";
import type { GapAnalysis, GapComponent } from "../types";

export type GapTreatment = "scorecard" | "verdict" | "dashboard" | "weighted";

export interface GapViewerProps {
  gap: GapAnalysis;
  treatment: GapTreatment;
}

export const GapViewer: React.FC<GapViewerProps> = ({ gap, treatment }) => (
  <div style={{ height: "100%", overflow: "auto", background: "var(--bg-panel)" }}>
    {treatment === "scorecard" && <GapScorecard g={gap} />}
    {treatment === "verdict" && <GapVerdict g={gap} />}
    {treatment === "dashboard" && <GapDashboard g={gap} />}
    {treatment === "weighted" && <GapWeighted g={gap} />}
  </div>
);

const ComponentBar: React.FC<{ c: GapComponent }> = ({ c }) => {
  const delta = c.raw - c.prev;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "200px 60px 1fr 70px 80px",
        alignItems: "center",
        gap: 12,
        padding: "6px 0",
      }}
    >
      <span style={{ fontSize: 13, color: "var(--fg-strong)" }}>{c.label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)", textAlign: "right" }}>
        w {c.weight}%
      </span>
      <div style={{ height: 8, background: "var(--bg-sunken)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, width: `${c.prev}%`, background: "var(--border-base)", borderRadius: 4 }}></div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${c.raw}%`,
            background: c.raw >= 90 ? "var(--positive)" : c.raw >= 80 ? "var(--accent)" : "var(--warn)",
            borderRadius: 4,
          }}
        ></div>
      </div>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--fg-strong)",
          fontVariantNumeric: "tabular-nums",
          textAlign: "right",
        }}
      >
        {c.raw}/100
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: delta > 0 ? "var(--positive-fg)" : delta < 0 ? "var(--negative-fg)" : "var(--fg-faint)",
          textAlign: "right",
        }}
      >
        {delta >= 0 ? "+" : ""}
        {delta} pts
      </span>
    </div>
  );
};

const Sparkline: React.FC<{ values: number[]; threshold: number }> = ({ values, threshold }) => {
  const W = 240;
  const H = 60;
  const pad = 6;
  const min = 50;
  const max = 100;
  const x = (i: number) => pad + (i * (W - pad * 2)) / (values.length - 1);
  const y = (v: number) => pad + ((max - v) / (max - min)) * (H - pad * 2);
  const tY = y(threshold);
  const path = values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      <line x1={pad} x2={W - pad} y1={tY} y2={tY} stroke="var(--border-base)" strokeWidth="1" strokeDasharray="3 3" />
      <text x={W - pad} y={tY - 4} textAnchor="end" fontSize="9" fontFamily="var(--font-mono)" fill="var(--fg-faint)">
        threshold {threshold}
      </text>
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r="3.5" fill="var(--bg-sunken)" stroke="var(--accent)" strokeWidth="2" />
          <text
            x={x(i)}
            y={y(v) - 10}
            textAnchor="middle"
            fontSize="10"
            fontFamily="var(--font-mono)"
            fill="var(--fg-strong)"
            fontWeight="500"
          >
            {v}
          </text>
          <text x={x(i)} y={H + 4} textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="var(--fg-faint)">
            iter-{i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
};

const GapScorecard: React.FC<{ g: GapAnalysis }> = ({ g }) => (
  <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 0, minHeight: "100%" }}>
    <div
      style={{
        padding: "44px 32px",
        borderRight: "1px solid var(--border-subtle)",
        background: "var(--bg-sunken)",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <Eyebrow>Iteration {g.iteration} · gap analysis</Eyebrow>

      <div>
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 96,
            lineHeight: 1,
            fontWeight: 500,
            color: "var(--fg-strong)",
            letterSpacing: "-0.04em",
            display: "flex",
            alignItems: "baseline",
            gap: 4,
          }}
        >
          {g.totalScore}
          <span style={{ fontSize: 24, color: "var(--fg-faint)", fontWeight: 400 }}>/100</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 6, fontFamily: "var(--font-mono)" }}>
          threshold {g.threshold} · margin{" "}
          <span style={{ color: "var(--positive-fg)" }}>+{g.totalScore - g.threshold}</span>
        </div>
      </div>

      <div>
        <Pill tone="positive" size="sm">
          {g.verdict}
        </Pill>
        <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 10, fontFamily: "var(--font-mono)" }}>
          iter-1 → iter-3:&nbsp;
          <span style={{ color: "var(--negative-fg)" }}>{g.prevScore}</span>
          <span style={{ color: "var(--fg-faint)" }}> → </span>
          <span style={{ color: "var(--positive-fg)" }}>{g.totalScore}</span>
          <span style={{ color: "var(--fg-faint)" }}> (+{g.totalScore - g.prevScore})</span>
        </div>
      </div>

      <div>
        <div
          style={{
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            letterSpacing: ".06em",
            color: "var(--fg-faint)",
            marginBottom: 8,
          }}
        >
          Score progression
        </div>
        <Sparkline values={[g.prevScore, 79, g.totalScore]} threshold={g.threshold} />
      </div>

      <div
        style={{
          marginTop: "auto",
          paddingTop: 20,
          borderTop: "1px solid var(--border-subtle)",
          fontSize: 11,
          color: "var(--fg-faint)",
          fontFamily: "var(--font-mono)",
        }}
      >
        Ready for downstream agents:
        <br />
        <span style={{ color: "var(--positive-fg)" }}>Architecture · System design · UC dispatch</span>
      </div>
    </div>

    <div style={{ padding: "32px 36px" }}>
      <Eyebrow style={{ marginBottom: 18 }}>Component breakdown</Eyebrow>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {g.components.map((c) => (
          <ComponentBar key={c.id} c={c} />
        ))}
      </div>

      <Eyebrow style={{ marginTop: 36, marginBottom: 14 }}>Findings</Eyebrow>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {g.critical.map((cr, i) => (
          <div
            key={i}
            style={{
              padding: "12px 14px",
              borderRadius: 6,
              background: cr.severity === "warn" ? "var(--warn-soft)" : "var(--info-soft)",
              borderLeft: `3px solid ${cr.severity === "warn" ? "var(--warn)" : "var(--info)"}`,
            }}
          >
            <div style={{ fontSize: 13, color: "var(--fg-strong)", fontWeight: 500 }}>{cr.title}</div>
            <div style={{ fontSize: 12.5, color: "var(--fg-base)", marginTop: 4, lineHeight: 1.45 }}>{cr.text}</div>
          </div>
        ))}
      </div>

      <Eyebrow style={{ marginTop: 28, marginBottom: 12 }}>Remediation queued for iter-4</Eyebrow>
      <ol style={{ margin: 0, paddingLeft: 20, color: "var(--fg-base)", fontSize: 13, lineHeight: 1.6 }}>
        {g.remediation.map((r, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            {r}
          </li>
        ))}
      </ol>
    </div>
  </div>
);

const GapVerdict: React.FC<{ g: GapAnalysis }> = ({ g }) => (
  <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 56px 80px" }}>
    <div style={{ textAlign: "center", paddingBottom: 30, borderBottom: "1px solid var(--border-base)" }}>
      <Eyebrow style={{ justifyContent: "center" }}>Run 0142 · iteration {g.iteration} · gap analysis</Eyebrow>
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 80,
          fontWeight: 500,
          color: "var(--positive-fg)",
          letterSpacing: "-0.03em",
          margin: "16px 0 8px",
        }}
      >
        {g.verdict}
      </h1>
      <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 18, color: "var(--fg-muted)" }}>
        score {g.totalScore} of 100 — threshold {g.threshold}, margin +{g.totalScore - g.threshold}
      </div>
    </div>

    <p
      style={{
        fontFamily: "var(--font-serif)",
        fontSize: 18,
        lineHeight: 1.6,
        color: "var(--fg-base)",
        marginTop: 32,
      }}
    >
      Iteration {g.iteration} of the analysis run on Acme's Brand Monitoring System BRD passes the gating
      threshold. <strong>{g.totalScore}</strong> aggregates six weighted dimensions — extraction completeness, quote
      traceability, priority calibration, category consistency, deduplication, and schema compliance — against the
      iteration-1 baseline of {g.prevScore}. The largest gain came from re-anchoring the four flagged intents to
      verbatim source quotes, eliminating interpretive drift.
    </p>

    <p
      style={{
        fontFamily: "var(--font-serif)",
        fontSize: 18,
        lineHeight: 1.6,
        color: "var(--fg-base)",
        marginBottom: 36,
      }}
    >
      Two soft findings remain. <em>section_refs</em> is empty across all 35 intents — sufficient for downstream
      agents but reduces auditor traceability. The category taxonomy at 26 labels is over-fragmented; consolidation
      to seven functional domains is queued for iter-4. Neither blocks dispatch.
    </p>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, margin: "8px 0 32px" }}>
      {g.components.map((c) => (
        <div
          key={c.id}
          style={{
            padding: "12px 14px",
            borderRadius: 6,
            border: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--fg-base)" }}>{c.label}</span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "var(--fg-strong)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {c.raw}
          </span>
        </div>
      ))}
    </div>

    <div
      style={{
        paddingTop: 24,
        borderTop: "1px solid var(--border-base)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 11.5,
        color: "var(--fg-faint)",
        fontFamily: "var(--font-mono)",
      }}
    >
      <span>signed: orchestrator · gap-analyzer-agent v0.4</span>
      <span>{new Date().toISOString().slice(0, 10)}</span>
    </div>
  </div>
);

const KpiCard: React.FC<{ label: string; value: number; unit: string; delta: number }> = ({
  label,
  value,
  unit,
  delta,
}) => (
  <div
    style={{
      padding: "14px 16px",
      borderRadius: 10,
      background: "var(--bg-panel)",
      border: "1px solid var(--border-subtle)",
    }}
  >
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9.5,
        textTransform: "uppercase",
        letterSpacing: ".08em",
        color: "var(--fg-faint)",
      }}
    >
      {label}
    </div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 6 }}>
      <span
        style={{
          fontSize: 28,
          fontWeight: 500,
          color: "var(--fg-strong)",
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 14, color: "var(--fg-faint)" }}>{unit}</span>
    </div>
    <div
      style={{
        marginTop: 4,
        fontSize: 11,
        fontFamily: "var(--font-mono)",
        color: delta > 0 ? "var(--positive-fg)" : delta < 0 ? "var(--negative-fg)" : "var(--fg-faint)",
      }}
    >
      {delta >= 0 ? "▲ +" : "▼ "}
      {delta} pts vs iter-1
    </div>
  </div>
);

const GapDashboard: React.FC<{ g: GapAnalysis }> = ({ g }) => (
  <div style={{ padding: "20px 20px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: 12 }}>
      <div
        style={{
          padding: "18px 20px",
          borderRadius: 10,
          background: "var(--positive-soft)",
          gridRow: "1 / span 2",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: ".08em",
            color: "var(--positive-fg)",
          }}
        >
          verdict
        </div>
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 72,
            fontWeight: 500,
            color: "var(--positive-fg)",
            letterSpacing: "-0.03em",
            lineHeight: 1,
            marginTop: 8,
          }}
        >
          {g.totalScore}
        </div>
        <div style={{ fontSize: 13, color: "var(--positive-fg)", fontFamily: "var(--font-mono)", marginTop: 6 }}>
          PASS · margin +{g.totalScore - g.threshold}
        </div>
        <div style={{ marginTop: "auto", paddingTop: 16 }}>
          <Sparkline values={[g.prevScore, 79, g.totalScore]} threshold={g.threshold} />
        </div>
      </div>

      {g.components.map((c) => (
        <KpiCard
          key={c.id}
          label={c.label.split(" ")[0]}
          value={c.raw}
          unit="%"
          delta={c.raw - c.prev}
        />
      ))}
    </div>

    <div
      style={{
        padding: "16px 18px",
        borderRadius: 10,
        background: "var(--bg-panel)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Eyebrow>Component breakdown</Eyebrow>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)" }}>
          weighted Σ = {g.totalScore.toFixed(1)}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {g.components.map((c) => (
          <ComponentBar key={c.id} c={c} />
        ))}
      </div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 10,
          background: "var(--bg-panel)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <Eyebrow style={{ marginBottom: 10 }}>Findings ({g.critical.length})</Eyebrow>
        {g.critical.map((cr, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 10,
              padding: "8px 0",
              borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none",
            }}
          >
            <span style={{ flexShrink: 0, marginTop: 3 }}>
              <Pill tone={cr.severity === "warn" ? "warn" : "info"} size="xs">
                {cr.severity}
              </Pill>
            </span>
            <div>
              <div style={{ fontSize: 12.5, color: "var(--fg-strong)", fontWeight: 500 }}>{cr.title}</div>
              <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2, lineHeight: 1.4 }}>{cr.text}</div>
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 10,
          background: "var(--bg-panel)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <Eyebrow style={{ marginBottom: 10 }}>Remediation queue · iter-4</Eyebrow>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--fg-base)", lineHeight: 1.55 }}>
          {g.remediation.map((r, i) => (
            <li key={i} style={{ marginBottom: 8 }}>
              {r}
            </li>
          ))}
        </ol>
      </div>
    </div>
  </div>
);

const thStyle = (align: "left" | "right" = "left"): React.CSSProperties => ({
  padding: "10px 12px",
  textAlign: align,
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: ".06em",
  color: "var(--fg-faint)",
});
const tdStyle = (
  align: "left" | "right" = "left",
  ...mods: Array<"mono" | "strong" | "faint">
): React.CSSProperties => ({
  padding: "10px 12px",
  textAlign: align,
  fontFamily: mods.includes("mono") ? "var(--font-mono)" : "var(--font-sans)",
  color: mods.includes("strong") ? "var(--fg-strong)" : mods.includes("faint") ? "var(--fg-faint)" : "var(--fg-base)",
  fontVariantNumeric: mods.includes("mono") ? "tabular-nums" : undefined,
});

const GapWeighted: React.FC<{ g: GapAnalysis }> = ({ g }) => {
  const sumW = g.components.reduce((s, c) => s + c.weight, 0);
  const sumScore = g.components.reduce((s, c) => s + c.weighted, 0);
  return (
    <div style={{ padding: "32px 36px 60px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: "1px solid var(--border-base)",
        }}
      >
        <div>
          <Eyebrow>Weighted score ledger · iter {g.iteration}</Eyebrow>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 26,
              fontWeight: 500,
              color: "var(--fg-strong)",
              margin: "8px 0 0",
              letterSpacing: "-0.01em",
            }}
          >
            Final score: {g.totalScore} / 100 — <span style={{ color: "var(--positive-fg)" }}>{g.verdict}</span>
          </h1>
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--fg-faint)",
            fontFamily: "var(--font-mono)",
            textAlign: "right",
          }}
        >
          threshold {g.threshold}
          <br />
          margin +{(g.totalScore - g.threshold).toFixed(1)}
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-base)" }}>
            <th style={thStyle()}>Component</th>
            <th style={thStyle("right")}>Weight</th>
            <th style={thStyle("right")}>Raw</th>
            <th style={thStyle("right")}>Iter-1</th>
            <th style={thStyle("right")}>Δ</th>
            <th style={thStyle("right")}>Weighted</th>
            <th style={thStyle()}>Note</th>
          </tr>
        </thead>
        <tbody>
          {g.components.map((c) => (
            <tr key={c.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <td style={tdStyle()}>{c.label}</td>
              <td style={tdStyle("right", "mono")}>{c.weight}%</td>
              <td style={tdStyle("right", "mono")}>{c.raw}</td>
              <td style={tdStyle("right", "mono", "faint")}>{c.prev}</td>
              <td
                style={{
                  ...tdStyle("right", "mono"),
                  color: c.raw > c.prev ? "var(--positive-fg)" : "var(--negative-fg)",
                }}
              >
                {c.raw - c.prev >= 0 ? "+" : ""}
                {c.raw - c.prev}
              </td>
              <td style={tdStyle("right", "mono", "strong")}>{c.weighted.toFixed(2)}</td>
              <td style={{ ...tdStyle(), color: "var(--fg-muted)", fontSize: 12 }}>{c.note}</td>
            </tr>
          ))}
          <tr style={{ borderTop: "2px solid var(--fg-strong)", borderBottom: "1px solid var(--fg-strong)" }}>
            <td style={{ ...tdStyle(), fontWeight: 600 }}>Σ Total</td>
            <td style={tdStyle("right", "mono", "strong")}>{sumW}%</td>
            <td></td>
            <td></td>
            <td></td>
            <td style={tdStyle("right", "mono", "strong")}>{sumScore.toFixed(2)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <div
        style={{
          marginTop: 28,
          padding: "14px 16px",
          borderRadius: 6,
          background: "var(--positive-soft)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Icon name="check" size={16} style={{ color: "var(--positive-fg)" }} />
        <div style={{ fontSize: 13, color: "var(--positive-fg)" }}>
          <strong>{g.totalScore}</strong> ≥ threshold {g.threshold}. Run dispatched to downstream agents
          (Architecture, System Design).
        </div>
      </div>
    </div>
  );
};
