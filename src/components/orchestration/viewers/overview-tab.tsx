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

/**
 * Live phase row for the run-state overview. Mirrors the shape the
 * worker's list_phases tool returns; consumers shouldn't have to
 * remap fields.
 */
export interface OverviewPhaseRow {
  id: string;
  name?: string;
  status: string;
  iterationCount?: number;
  lastQualityScore?: number | null;
  dependencies?: string[];
  dependenciesMet?: boolean;
  blockedReason?: string;
  lastEventAt?: string | null;
}

/**
 * Single input file uploaded to the run (BRD, transcript, asset).
 */
export interface OverviewInput {
  key: string;
  name: string;
  type?: string;
  size?: number;
}

/**
 * Single output artifact produced by the run. `key` is the R2 key;
 * the consumer wires `onArtifactClick` to open it.
 */
export interface OverviewArtifact {
  key: string;
  name: string;
  phaseId?: string;
  kind?: string;
  size?: number;
}

/**
 * Aggregate run-state payload. When set, OverviewTab renders the
 * comprehensive orchestration overview instead of the Phase-02
 * intent-analysis report layout.
 *
 * The contract is intentionally permissive — every field is optional
 * so consumers can populate what they have without juggling required
 * shapes during early data load. The component degrades gracefully:
 * missing counts become 0, missing dates collapse to "—", missing
 * sections disappear entirely.
 */
export interface RunOverviewState {
  runId: string;
  workflow?: string;
  workspaceName?: string;
  projectName?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  phases?: OverviewPhaseRow[];
  inputs?: OverviewInput[];
  /** Highlighted outputs — surfaced above the bulk artifact list with deep links. */
  keyOutputs?: OverviewArtifact[];
  /** All artifacts (R2 keys). Rendered as a collapsible bulk list. */
  artifacts?: OverviewArtifact[];
  /** Completion-gates summary as returned by get_completion_gates. */
  gates?: Record<string, unknown> | null;
  /** External resources — links to dashboards, repos, docs. */
  resources?: Array<{ label: string; href: string; note?: string }>;
  /** HITM stops defined in the workflow YAML + their current state. */
  hitmStops?: Array<{ phaseId: string; purpose?: string; state: "pending" | "approved" | "skipped" | "blocked" }>;
  /** Total LLM-call count if observability returned it. */
  llmCallCount?: number;
  /** Loading flag — when true, shows skeletons. */
  loading?: boolean;
  /** Optional action handlers — buttons render only when handler is present. */
  onPhaseClick?: (phaseId: string) => void;
  onArtifactClick?: (artifactKey: string) => void;
  onPause?: () => void | Promise<void>;
  onResume?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
  onRunRemaining?: () => void | Promise<void>;
  onMaterializeJournal?: () => void | Promise<void>;
  onEditPhasePlan?: () => void;
  onRerunPhase?: (phaseId: string) => void | Promise<void>;
}

export interface OverviewTabProps {
  /**
   * Phase-02 intent-analysis report. When provided, the original
   * intent-extraction layout (verbatim coverage, critical-path
   * intents, score) renders. When omitted, the run-state overview
   * (driven by `runState`) renders instead.
   */
  report?: AnalysisReport;
  artifacts?: Artifact[];
  criticalIntents?: Intent[];
  timeline?: AgentTimelineEntry[];
  /** Verdict pill + run metadata for the header (report mode only). */
  verdict?: { label: string; tone?: "positive" | "warn" | "negative" };
  runMeta?: string;
  /** HITM banner — when set, shown above the header card. */
  hitm?: { phaseId: string; onApprove?: () => void } | null;
  /**
   * Run-state payload — renders the comprehensive orchestration
   * overview when present. Required for any non-Phase-02 run.
   */
  runState?: RunOverviewState;
}

const SmallStat: React.FC<{ label: string; value: string; sub?: string; tone?: "neutral" | "positive" | "warn" | "info" | "negative" }> = ({ label, value, sub, tone = "neutral" }) => {
  const color =
    tone === "positive" ? "var(--positive-fg)"
    : tone === "warn" ? "var(--warn-fg)"
    : tone === "info" ? "var(--info-fg)"
    : tone === "negative" ? "var(--negative-fg)"
    : "var(--fg-strong)";
  return (
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
          color,
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
};

const KIND_ICON: Record<ArtifactKind, IconName> = {
  markdown: "doc",
  yaml: "yaml",
  "yaml-cite": "yaml",
  gap: "spark",
  tldraw: "board",
  source: "doc",
};

const DEFAULT_TIMELINE: AgentTimelineEntry[] = [];

/** Pretty-print bytes for display. */
function fmtBytes(n: number | undefined): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Format ISO timestamp as "May 11, 06:28 UTC" for the header. */
function fmtTs(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const opts: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      hour12: false,
    };
    return `${new Intl.DateTimeFormat("en-US", opts).format(d)} UTC`;
  } catch {
    return iso;
  }
}

/** Tone for a phase status badge. */
function statusTone(status: string): "positive" | "info" | "warn" | "negative" | "neutral" {
  if (status === "completed" || status === "complete") return "positive";
  if (status === "running" || status === "queued") return "info";
  if (status === "awaiting_hitm" || status === "paused") return "warn";
  if (status === "failed" || status === "cancelled") return "negative";
  return "neutral";
}

/** Compact button used in the run-state header toolbar. */
const ToolbarButton: React.FC<{
  icon?: IconName;
  label: string;
  onClick: () => void;
  title?: string;
  tone?: "accent" | "warn" | "danger" | "default";
}> = ({ icon, label, onClick, title, tone = "default" }) => {
  const bg =
    tone === "accent" ? "var(--accent)"
    : tone === "warn" ? "var(--warn)"
    : tone === "danger" ? "var(--negative)"
    : "var(--bg-sunken)";
  const fg = tone === "default" ? "var(--fg-strong)" : "var(--fg-on-accent)";
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 6,
        border: "1px solid var(--border-subtle)",
        background: bg,
        color: fg,
        fontSize: 12,
        fontFamily: "var(--font-mono)",
        cursor: "pointer",
      }}
    >
      {icon && <Icon name={icon} size={12} />}
      {label}
    </button>
  );
};

/**
 * Run-state overview — comprehensive orchestration info for any run,
 * regardless of workflow type. Used when `runState` is provided.
 */
const RunStateView: React.FC<{
  runState: RunOverviewState;
  hitm: OverviewTabProps["hitm"];
}> = ({ runState, hitm }) => {
  const rs = runState;
  const phases = rs.phases ?? [];
  const counts = {
    total: phases.length,
    completed: phases.filter((p) => p.status === "completed" || p.status === "complete").length,
    running: phases.filter((p) => p.status === "running").length,
    awaiting: phases.filter((p) => p.status === "awaiting_hitm").length,
    failed: phases.filter((p) => p.status === "failed").length,
  };
  const pctDone = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;
  const statusToneValue = statusTone(rs.status ?? "");

  return (
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
                The phase is parked via <code style={{ fontFamily: "var(--font-mono)" }}>step.waitForEvent</code> —
                durable, no compute consumed. Will resume only when explicitly approved.
              </div>
            </div>
            {hitm.onApprove && (
              <ToolbarButton icon="play" label="Approve" tone="warn" onClick={hitm.onApprove} />
            )}
          </div>
        )}

        {/* Header card — run identity + lifecycle toolbar */}
        <div
          style={{
            padding: "24px 28px",
            borderRadius: 12,
            background: "var(--bg-panel)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                {rs.status && <Pill tone={statusToneValue === "neutral" ? "info" : statusToneValue}>{rs.status}</Pill>}
                {rs.workflow && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-muted)" }}>
                    {rs.workflow}
                  </span>
                )}
                {(rs.workspaceName || rs.projectName) && (
                  <span style={{ fontSize: 11.5, color: "var(--fg-faint)" }}>
                    {[rs.workspaceName, rs.projectName].filter(Boolean).join(" / ")}
                  </span>
                )}
              </div>
              <h1
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 18,
                  fontWeight: 500,
                  color: "var(--fg-strong)",
                  margin: "0 0 8px",
                  wordBreak: "break-all",
                }}
              >
                {rs.runId}
              </h1>
              <div style={{ display: "flex", gap: 18, fontSize: 11.5, color: "var(--fg-muted)", flexWrap: "wrap" }}>
                <span>
                  <span style={{ color: "var(--fg-faint)" }}>created</span>{" "}
                  <span style={{ fontFamily: "var(--font-mono)" }}>{fmtTs(rs.createdAt)}</span>
                </span>
                <span>
                  <span style={{ color: "var(--fg-faint)" }}>updated</span>{" "}
                  <span style={{ fontFamily: "var(--font-mono)" }}>{fmtTs(rs.updatedAt)}</span>
                </span>
                {rs.llmCallCount != null && (
                  <span>
                    <span style={{ color: "var(--fg-faint)" }}>llm calls</span>{" "}
                    <span style={{ fontFamily: "var(--font-mono)" }}>{rs.llmCallCount}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Lifecycle toolbar */}
            {(rs.onPause || rs.onResume || rs.onRunRemaining || rs.onEditPhasePlan || rs.onMaterializeJournal || rs.onCancel) && (
              <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {rs.onPause && (rs.status === "running" || rs.status === "queued") && (
                  <ToolbarButton icon="pause" label="Pause" onClick={rs.onPause} title="Pause after current phase" />
                )}
                {rs.onResume && rs.status === "paused" && (
                  <ToolbarButton icon="play" label="Resume" onClick={rs.onResume} tone="accent" />
                )}
                {rs.onRunRemaining && rs.status !== "running" && (
                  <ToolbarButton
                    icon="play"
                    label="Run remaining"
                    onClick={rs.onRunRemaining}
                    title="Dispatch every phase that hasn't completed yet"
                  />
                )}
                {rs.onEditPhasePlan && (
                  <ToolbarButton icon="yaml" label="Phase plan" onClick={rs.onEditPhasePlan} />
                )}
                {rs.onMaterializeJournal && (
                  <ToolbarButton icon="doc" label="Journal" onClick={rs.onMaterializeJournal} />
                )}
                {rs.onCancel &&
                  rs.status !== "complete" &&
                  rs.status !== "completed" &&
                  rs.status !== "cancelled" &&
                  rs.status !== "failed" && (
                    <ToolbarButton icon="close" label="Cancel" onClick={rs.onCancel} tone="danger" />
                  )}
              </div>
            )}
          </div>

          {/* Progress bar */}
          {counts.total > 0 && (
            <div style={{ marginTop: 18 }}>
              <div
                style={{
                  height: 6,
                  background: "var(--bg-sunken)",
                  borderRadius: 3,
                  overflow: "hidden",
                  display: "flex",
                }}
              >
                <div style={{ width: `${(counts.completed / counts.total) * 100}%`, background: "var(--positive)" }} />
                <div style={{ width: `${(counts.running / counts.total) * 100}%`, background: "var(--accent)" }} />
                <div style={{ width: `${(counts.awaiting / counts.total) * 100}%`, background: "var(--warn)" }} />
                <div style={{ width: `${(counts.failed / counts.total) * 100}%`, background: "var(--negative)" }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-faint)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
                {pctDone}% complete · {counts.completed}/{counts.total} phases
              </div>
            </div>
          )}

          {/* Stat strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginTop: 16 }}>
            <SmallStat label="Phases" value={String(counts.total)} />
            <SmallStat label="Completed" value={String(counts.completed)} tone="positive" />
            <SmallStat label="Running" value={String(counts.running)} tone="info" />
            <SmallStat label="Awaiting HITM" value={String(counts.awaiting)} tone="warn" />
            <SmallStat label="Failed" value={String(counts.failed)} tone="negative" />
          </div>
        </div>

        {/* HITM stops list */}
        {rs.hitmStops && rs.hitmStops.length > 0 && (
          <SectionCard title="HITM gates">
            {rs.hitmStops.map((h) => (
              <div
                key={h.phaseId}
                style={{
                  display: "grid",
                  gridTemplateColumns: "12px 1fr auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    background:
                      h.state === "approved" ? "var(--positive)"
                      : h.state === "blocked" ? "var(--warn)"
                      : h.state === "skipped" ? "var(--fg-ghost)"
                      : "var(--border-base)",
                    justifySelf: "center",
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-strong)" }}>
                    {h.phaseId}
                  </div>
                  {h.purpose && (
                    <div style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 2 }}>{h.purpose}</div>
                  )}
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)" }}>
                  {h.state}
                </span>
              </div>
            ))}
          </SectionCard>
        )}

        {/* Completion gates */}
        {rs.gates && typeof rs.gates === "object" && Object.keys(rs.gates as object).length > 0 && (
          <SectionCard title="Completion gates">
            {Object.entries(rs.gates as Record<string, unknown>).map(([k, v]) => {
              const passed = typeof v === "object" && v && "passed" in (v as Record<string, unknown>)
                ? Boolean((v as { passed: boolean }).passed)
                : Boolean(v);
              return (
                <div
                  key={k}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "12px 1fr auto",
                    gap: 12,
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      background: passed ? "var(--positive)" : "var(--negative)",
                      justifySelf: "center",
                    }}
                  />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-strong)" }}>{k}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: passed ? "var(--positive-fg)" : "var(--negative-fg)" }}>
                    {passed ? "PASS" : "FAIL"}
                  </span>
                </div>
              );
            })}
          </SectionCard>
        )}

        {/* Phases list */}
        <SectionCard title={`Phases (${phases.length})`}>
          {rs.loading && phases.length === 0 && (
            <div style={{ color: "var(--fg-faint)", fontSize: 13, fontStyle: "italic" }}>
              Fetching phase status…
            </div>
          )}
          {!rs.loading && phases.length === 0 && (
            <div style={{ color: "var(--fg-faint)", fontSize: 13 }}>
              No phase records yet. The run isn't bound to a workflow, or its <code>state.json</code> hasn't been
              written.
            </div>
          )}
          {phases.map((p) => {
            const tone = statusTone(p.status);
            const dotColor =
              tone === "positive" ? "var(--positive)"
              : tone === "info" ? "var(--accent)"
              : tone === "warn" ? "var(--warn)"
              : tone === "negative" ? "var(--negative)"
              : "var(--border-base)";
            const detailable = !!rs.onPhaseClick;
            const canRerun = !!rs.onRerunPhase && p.status !== "running" && p.status !== "queued" && p.status !== "awaiting_hitm";
            return (
              <div
                key={p.id}
                onClick={detailable ? () => rs.onPhaseClick!(p.id) : undefined}
                style={{
                  display: "grid",
                  gridTemplateColumns: "12px 1fr 110px 90px 90px",
                  alignItems: "center",
                  gap: 12,
                  padding: "8px 6px",
                  margin: "0 -6px",
                  borderBottom: "1px solid var(--border-subtle)",
                  cursor: detailable ? "pointer" : "default",
                  borderRadius: 4,
                }}
                onMouseEnter={(e) => {
                  if (detailable) (e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                  if (detailable) (e.currentTarget as HTMLDivElement).style.background = "transparent";
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 4, background: dotColor, justifySelf: "center" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-strong)" }}>
                  {p.id}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-muted)" }}>
                  {p.status}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--fg-faint)",
                    textAlign: "right",
                  }}
                >
                  {p.iterationCount ? `iter ${p.iterationCount}` : ""}
                  {p.lastQualityScore != null ? ` · ${p.lastQualityScore}` : ""}
                </span>
                <span style={{ justifySelf: "end" }} onClick={(e) => e.stopPropagation()}>
                  {canRerun && (
                    <ToolbarButton
                      icon="refresh"
                      label="Rerun"
                      onClick={() => rs.onRerunPhase!(p.id)}
                      title={`Re-run phase ${p.id}`}
                    />
                  )}
                </span>
              </div>
            );
          })}
        </SectionCard>

        {/* Key outputs — surfaced above bulk artifacts */}
        {rs.keyOutputs && rs.keyOutputs.length > 0 && (
          <SectionCard title="Key outputs">
            {rs.keyOutputs.map((a) => (
              <div
                key={a.key}
                onClick={rs.onArtifactClick ? () => rs.onArtifactClick!(a.key) : undefined}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: "1px solid var(--border-subtle)",
                  cursor: rs.onArtifactClick ? "pointer" : "default",
                  borderRadius: 4,
                }}
                onMouseEnter={(e) => {
                  if (rs.onArtifactClick) (e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                  if (rs.onArtifactClick) (e.currentTarget as HTMLDivElement).style.background = "transparent";
                }}
              >
                <Icon name="doc" size={14} style={{ color: "var(--accent)" }} />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--fg-strong)",
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.name}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-faint)", marginTop: 2 }}>
                    {a.phaseId ? `${a.phaseId} · ` : ""}
                    {a.kind ?? ""}
                    {a.size != null ? ` · ${fmtBytes(a.size)}` : ""}
                  </div>
                </div>
                <Icon name="arrowR" size={12} style={{ color: "var(--fg-ghost)" }} />
              </div>
            ))}
          </SectionCard>
        )}

        {/* Inputs */}
        {rs.inputs && rs.inputs.length > 0 && (
          <SectionCard title={`Inputs (${rs.inputs.length})`}>
            {rs.inputs.map((i) => (
              <div
                key={i.key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 80px",
                  gap: 12,
                  alignItems: "center",
                  padding: "5px 0",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--fg-base)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {i.name}
                </span>
                {i.type && (
                  <span
                    style={{
                      fontSize: 10.5,
                      color: "var(--fg-faint)",
                      textTransform: "uppercase",
                      letterSpacing: ".06em",
                    }}
                  >
                    {i.type}
                  </span>
                )}
                {i.size != null && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10.5,
                      color: "var(--fg-faint)",
                      textAlign: "right",
                    }}
                  >
                    {fmtBytes(i.size)}
                  </span>
                )}
              </div>
            ))}
          </SectionCard>
        )}

        {/* Resources */}
        {rs.resources && rs.resources.length > 0 && (
          <SectionCard title="Resources">
            {rs.resources.map((r) => (
              <a
                key={r.href}
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--border-subtle)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <Icon name="arrowR" size={12} style={{ color: "var(--accent)" }} />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--fg-strong)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.label}
                  </div>
                  {r.note && (
                    <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 2 }}>{r.note}</div>
                  )}
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-ghost)" }}>
                  open ↗
                </span>
              </a>
            ))}
          </SectionCard>
        )}

        {/* All artifacts — collapsible */}
        {rs.artifacts && rs.artifacts.length > 0 && <ArtifactsCard artifacts={rs.artifacts} onClick={rs.onArtifactClick} />}
      </div>
    </div>
  );
};

/** Generic card wrapper for sections in the run-state view. */
const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div
    style={{
      marginTop: 16,
      padding: "20px 22px",
      borderRadius: 12,
      background: "var(--bg-panel)",
      border: "1px solid var(--border-subtle)",
    }}
  >
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        textTransform: "uppercase",
        letterSpacing: ".08em",
        color: "var(--fg-faint)",
        marginBottom: 14,
      }}
    >
      {title}
    </div>
    {children}
  </div>
);

/**
 * Collapsible bulk artifacts list — for runs with hundreds of artifacts,
 * we don't want to render them all by default. Initially shows the first
 * 8; "Show all N" expands.
 */
const ArtifactsCard: React.FC<{ artifacts: OverviewArtifact[]; onClick?: (key: string) => void }> = ({
  artifacts,
  onClick,
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const visible = expanded ? artifacts : artifacts.slice(0, 8);
  return (
    <SectionCard title={`All artifacts (${artifacts.length})`}>
      {visible.map((a) => (
        <div
          key={a.key}
          onClick={onClick ? () => onClick(a.key) : undefined}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--fg-muted)",
            padding: "4px 6px",
            margin: "0 -6px",
            borderBottom: "1px solid var(--border-subtle)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            cursor: onClick ? "pointer" : "default",
            borderRadius: 4,
          }}
          onMouseEnter={(e) => {
            if (onClick) (e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)";
          }}
          onMouseLeave={(e) => {
            if (onClick) (e.currentTarget as HTMLDivElement).style.background = "transparent";
          }}
        >
          {a.name}
        </div>
      ))}
      {artifacts.length > 8 && (
        <button
          onClick={() => setExpanded((x) => !x)}
          style={{
            marginTop: 10,
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-sunken)",
            color: "var(--fg-strong)",
            fontSize: 11.5,
            fontFamily: "var(--font-mono)",
            cursor: "pointer",
          }}
        >
          {expanded ? "Show less" : `Show all ${artifacts.length}`}
        </button>
      )}
    </SectionCard>
  );
};

/**
 * OverviewTab — dual-mode overview component.
 *
 * - **Report mode** (when `report` is passed): renders the Phase-02
 *   intent-analysis layout with verdict, score, critical-path intents,
 *   agent timeline, and artifact list.
 * - **Run mode** (when `runState` is passed): renders the comprehensive
 *   orchestration overview with run identity, progress, HITM gates,
 *   completion gates, phases, key outputs, inputs, resources, and a
 *   collapsible bulk artifacts list.
 *
 * When neither prop is passed, renders an empty-state placeholder.
 */
export const OverviewTab: React.FC<OverviewTabProps> = ({
  report,
  artifacts,
  criticalIntents,
  timeline = DEFAULT_TIMELINE,
  verdict = { label: "complete · PASS", tone: "positive" },
  runMeta,
  hitm = null,
  runState,
}) => {
  // Run mode — render the rich orchestration overview.
  if (runState) {
    return <RunStateView runState={runState} hitm={hitm} />;
  }

  // No data at all — empty state.
  if (!report) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--fg-faint)",
          background: "var(--bg-canvas)",
          fontSize: 13,
        }}
      >
        No overview data yet.
      </div>
    );
  }

  // Report mode — Phase-02 intent-analysis layout (original).
  const r = report;
  const artifactList = artifacts ?? [];
  const intents = criticalIntents ?? [];
  const headerMeta = runMeta ?? `${r.meta.iteration ? `iteration ${r.meta.iteration}` : ""}`.trim();
  // AnalysisReportMeta doesn't expose a score field; consumers
  // pass score via `verdict.label` if they want one in the header.
  const score: number | null = null;

  return (
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
                The phase is paused via <code style={{ fontFamily: "var(--font-mono)" }}>step.waitForEvent</code> and
                will resume only when explicitly approved.
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
              {headerMeta && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-muted)" }}>{headerMeta}</span>
              )}
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
              {r.meta.intentsExtracted} intents extracted · {intents.length} critical-path · 100% verbatim-quote
              coverage. {artifactList.length} artifacts ready for downstream agents.
            </div>
          </div>
          {score != null && (
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
                {score}
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>
                score / 100 · threshold 85
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 14 }}>
          <SmallStat label="Source" value={`${r.meta.sourceDocs} doc · ${r.meta.sourcePages}pp`} />
          <SmallStat label="Intents" value={String(r.meta.intentsExtracted)} sub="100% verbatim" />
          <SmallStat label="Critical-path" value={String(intents.length)} sub={`of ${r.meta.intentsExtracted}`} />
          <SmallStat label="Iterations" value={String(r.meta.iteration)} />
        </div>

        {timeline.length > 0 && (
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
                    <span
                      style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)" }}
                    >
                      {s.time}
                    </span>
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
                      />
                      <span
                        style={{
                          position: "relative",
                          display: "block",
                          width: 14,
                          height: 14,
                          borderRadius: 7,
                          background:
                            s.status === "ok" ? "var(--positive)"
                            : s.status === "warn" ? "var(--warn)"
                            : "var(--negative)",
                          boxShadow: `0 0 0 3px var(--bg-panel), 0 0 0 4px ${
                            s.status === "ok" ? "var(--positive-soft)"
                            : s.status === "warn" ? "var(--warn-soft)"
                            : "var(--negative-soft)"
                          }`,
                          marginTop: 4,
                        }}
                      />
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
                {artifactList.map((a, i) => (
                  <div
                    key={a.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 0",
                      borderBottom: i < artifactList.length - 1 ? "1px solid var(--border-subtle)" : "none",
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
        )}

        {intents.length > 0 && (
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
              Critical-path intents · top {Math.min(4, intents.length)} of {intents.length}
            </Eyebrow>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {intents.slice(0, 4).map((it) => (
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
        )}
      </div>
    </div>
  );
};
