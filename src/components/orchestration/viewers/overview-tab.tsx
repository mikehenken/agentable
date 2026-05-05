import * as React from "react";
import { Eyebrow, Icon, Pill, type IconName } from "../../general";
import type { AnalysisReport, Artifact, ArtifactKind, Intent } from "../types";

export interface AgentTimelineEntry {
  agent: string;
  status: "ok" | "warn" | "fail";
  time: string;
  duration: string;
  note: string;
}

export interface OverviewTabProps {
  report: AnalysisReport;
  artifacts: Artifact[];
  criticalIntents: Intent[];
  timeline?: AgentTimelineEntry[];
  /** Verdict pill + run metadata for the header. */
  verdict?: { label: string; tone?: "positive" | "warn" | "negative" };
  runMeta?: string;
  /** HITM banner — when set, shown above the header card. */
  hitm?: { phaseId: string; onApprove?: () => void } | null;
}

const SmallStat: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div
    style={{
      padding: "12px 14px",
      borderRadius: 10,
      background: "var(--bg-panel)",
      border: "1px solid var(--border-subtle)",
    }}
  >
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9.5,
        color: "var(--fg-faint)",
        textTransform: "uppercase",
        letterSpacing: ".06em",
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: 20,
        fontWeight: 500,
        color: "var(--fg-strong)",
        marginTop: 4,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.01em",
      }}
    >
      {value}
    </div>
    {sub && (
      <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 1, fontFamily: "var(--font-mono)" }}>{sub}</div>
    )}
  </div>
);

const KIND_ICON: Record<ArtifactKind, IconName> = {
  markdown: "doc",
  yaml: "yaml",
  "yaml-cite": "yaml",
  gap: "spark",
  tldraw: "board",
  source: "doc",
};

const DEFAULT_TIMELINE: AgentTimelineEntry[] = [
  { agent: "intake-agent", status: "ok", time: "00:00", duration: "2m", note: "BRD parsed · 47 pp · 9,400 tokens" },
  { agent: "analyst-agent", status: "ok", time: "00:02", duration: "11m", note: "iter-1 · 29 intents · 71 pts FAIL" },
  { agent: "self-review", status: "ok", time: "00:13", duration: "3m", note: "4 interpretive-drift findings" },
  { agent: "analyst-agent", status: "ok", time: "00:16", duration: "9m", note: "iter-2 · 33 intents · 79 pts FAIL" },
  { agent: "self-review", status: "ok", time: "00:25", duration: "2m", note: "section_refs gap noted" },
  { agent: "analyst-agent", status: "ok", time: "00:27", duration: "12m", note: "iter-3 · 35 intents · 88 pts" },
  { agent: "gap-analyzer", status: "ok", time: "00:39", duration: "4m", note: "PASS · margin +3" },
  { agent: "orchestrator", status: "ok", time: "00:43", duration: "4m", note: "Artifacts published · run dispatched" },
];

export const OverviewTab: React.FC<OverviewTabProps> = ({
  report: r,
  artifacts,
  criticalIntents,
  timeline = DEFAULT_TIMELINE,
  verdict = { label: "complete · PASS", tone: "positive" },
  runMeta = "run-0142 · iteration 3 · 47 min",
  hitm = null,
}) => (
  <div style={{ height: "100%", overflow: "auto", background: "var(--bg-canvas)" }}>
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 32px 60px" }}>
      {hitm && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 10,
            background: "var(--warn-soft)",
            borderLeft: "3px solid var(--warn)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Icon name="pause" size={14} style={{ color: "var(--warn-fg)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--warn-fg)" }}>
              Awaiting human review on phase {hitm.phaseId}
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>
              The phase is paused via <code style={{ fontFamily: "var(--font-mono)" }}>step.waitForEvent</code> and will
              resume only when explicitly approved.
            </div>
          </div>
          {hitm.onApprove && (
            <button
              onClick={hitm.onApprove}
              style={{
                padding: "6px 12px",
                borderRadius: 5,
                background: "var(--warn)",
                color: "var(--fg-on-accent)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Approve
            </button>
          )}
        </div>
      )}

      <div
        style={{
          padding: "24px 28px",
          borderRadius: 12,
          background: "var(--bg-panel)",
          border: "1px solid var(--border-subtle)",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 24,
          alignItems: "center",
          boxShadow: "var(--shadow-1)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <Pill tone={verdict.tone ?? "positive"}>{verdict.label}</Pill>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-muted)" }}>{runMeta}</span>
          </div>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 28,
              fontWeight: 500,
              color: "var(--fg-strong)",
              margin: "4px 0 6px",
              letterSpacing: "-0.01em",
            }}
          >
            {r.title}
          </h1>
          <div style={{ fontSize: 13.5, color: "var(--fg-muted)", lineHeight: 1.5 }}>
            {r.meta.intentsExtracted} intents extracted · {criticalIntents.length} critical-path · 100% verbatim-quote
            coverage. {artifacts.length} artifacts ready for downstream agents.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 56,
              fontWeight: 500,
              color: "var(--positive-fg)",
              lineHeight: 1,
              letterSpacing: "-0.03em",
            }}
          >
            88
          </div>
          <div style={{ fontSize: 11, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>
            score / 100 · threshold 85
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 14 }}>
        <SmallStat label="Source" value={`${r.meta.sourceDocs} doc · ${r.meta.sourcePages}pp`} />
        <SmallStat label="Intents" value={String(r.meta.intentsExtracted)} sub="100% verbatim" />
        <SmallStat label="Critical-path" value={String(criticalIntents.length)} sub={`of ${r.meta.intentsExtracted}`} />
        <SmallStat label="Iterations" value={String(r.meta.iteration)} sub="71 → 79 → 88" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, marginTop: 22 }}>
        <div
          style={{
            padding: "20px 22px",
            borderRadius: 12,
            background: "var(--bg-panel)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <Eyebrow style={{ marginBottom: 14 }}>Agent timeline</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
            {timeline.map((s, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 16px 130px 1fr 50px",
                  alignItems: "center",
                  gap: 12,
                  padding: "8px 0",
                  position: "relative",
                }}
              >
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)" }}>{s.time}</span>
                <div style={{ position: "relative", height: "100%" }}>
                  <div
                    style={{
                      position: "absolute",
                      left: 7,
                      top: -4,
                      bottom: -4,
                      width: 1,
                      background: "var(--border-subtle)",
                    }}
                  ></div>
                  <span
                    style={{
                      position: "relative",
                      display: "block",
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      background:
                        s.status === "ok"
                          ? "var(--positive)"
                          : s.status === "warn"
                            ? "var(--warn)"
                            : "var(--negative)",
                      boxShadow: `0 0 0 3px var(--bg-panel), 0 0 0 4px ${s.status === "ok" ? "var(--positive-soft)" : s.status === "warn" ? "var(--warn-soft)" : "var(--negative-soft)"}`,
                      marginTop: 4,
                    }}
                  ></span>
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--fg-strong)",
                    fontWeight: 500,
                  }}
                >
                  {s.agent}
                </span>
                <span style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>{s.note}</span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--fg-faint)",
                    textAlign: "right",
                  }}
                >
                  {s.duration}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            padding: "20px 22px",
            borderRadius: 12,
            background: "var(--bg-panel)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <Eyebrow style={{ marginBottom: 14 }}>Artifacts published</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {artifacts.map((a, i) => (
              <div
                key={a.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: 10,
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: i < artifacts.length - 1 ? "1px solid var(--border-subtle)" : "none",
                }}
              >
                <Icon name={KIND_ICON[a.kind]} size={14} style={{ color: "var(--accent)" }} />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--fg-strong)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.name}
                  </div>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: "var(--fg-faint)",
                      fontFamily: "var(--font-mono)",
                      marginTop: 1,
                    }}
                  >
                    {a.kind} {a.size && ` · ${a.size}`}
                  </div>
                </div>
                <Icon name="arrowR" size={12} style={{ color: "var(--fg-ghost)" }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 22,
          padding: "20px 24px",
          borderRadius: 12,
          background: "var(--bg-panel)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <Eyebrow style={{ marginBottom: 14 }}>
          Critical-path intents · top {Math.min(4, criticalIntents.length)} of {criticalIntents.length}
        </Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {criticalIntents.slice(0, 4).map((it) => (
            <div
              key={it.id}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-sunken)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--accent-fg)",
                    fontWeight: 600,
                  }}
                >
                  {it.id}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    color: "var(--fg-faint)",
                  }}
                >
                  {it.section}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--fg-strong)", lineHeight: 1.4 }}>{it.paraphrase}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
