import * as React from "react";
import { Icon, type IconName } from "../general";
import type { MarkerBlock } from "./parse-markers";

/**
 * Shared collapsible card layout used by Tool, Task, and Reasoning
 * markers. Each shows a glyph + title + optional meta row, then an
 * expandable body. Style language matches the rest of orchestration —
 * `var(--bg-panel)` cards on `var(--border-subtle)` borders.
 */
const Card: React.FC<{
  icon: IconName;
  iconColor?: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  accent?: string;
}> = ({ icon, iconColor = "var(--accent)", title, meta, defaultOpen = true, children, accent }) => {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div
      style={{
        margin: "8px 0",
        background: "var(--bg-panel)",
        border: "1px solid var(--border-subtle)",
        borderLeft: accent ? `2px solid ${accent}` : "1px solid var(--border-subtle)",
        borderRadius: 8,
        overflow: "hidden",
        fontSize: 12.5,
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          background: "transparent",
          border: 0,
          cursor: "pointer",
          textAlign: "left",
          color: "var(--fg-strong)",
        }}
      >
        <Icon name={icon} size={13} style={{ color: iconColor, flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </span>
        {meta && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: "var(--fg-faint)",
              flexShrink: 0,
            }}
          >
            {meta}
          </span>
        )}
        <Icon
          name="chevron"
          size={11}
          style={{
            color: "var(--fg-faint)",
            flexShrink: 0,
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform .12s",
          }}
        />
      </button>
      {open && (
        <div style={{ padding: "0 12px 10px", color: "var(--fg-base)" }}>
          {children}
        </div>
      )}
    </div>
  );
};

const codePre: React.CSSProperties = {
  margin: 0,
  padding: "8px 10px",
  borderRadius: 6,
  background: "var(--bg-sunken)",
  fontFamily: "var(--font-mono)",
  fontSize: 11.5,
  lineHeight: 1.5,
  color: "var(--code-fg)",
  overflow: "auto",
  whiteSpace: "pre",
};

// ── Tool ────────────────────────────────────────────────────────────
export const ToolMarker: React.FC<{ block: MarkerBlock }> = ({ block }) => {
  const json = (block.json ?? {}) as { name?: string; input?: unknown; output?: unknown; status?: string };
  const name = json.name ?? "tool";
  const status = json.status ?? (block.partial ? "running" : "complete");
  return (
    <Card
      icon="layers"
      iconColor="var(--accent)"
      title={
        <>
          <span style={{ color: "var(--fg-faint)", fontSize: 10.5, fontFamily: "var(--font-mono)", marginRight: 6 }}>
            tool
          </span>
          <span style={{ fontFamily: "var(--font-mono)" }}>{name}</span>
        </>
      }
      meta={status}
    >
      {json.input !== undefined && (
        <>
          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-faint)", margin: "6px 0 4px", textTransform: "uppercase", letterSpacing: ".06em" }}>
            input
          </div>
          <pre style={codePre}>{JSON.stringify(json.input, null, 2)}</pre>
        </>
      )}
      {json.output !== undefined && (
        <>
          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-faint)", margin: "8px 0 4px", textTransform: "uppercase", letterSpacing: ".06em" }}>
            output
          </div>
          <pre style={codePre}>
            {typeof json.output === "string" ? json.output : JSON.stringify(json.output, null, 2)}
          </pre>
        </>
      )}
      {json.input === undefined && json.output === undefined && (
        <pre style={codePre}>{block.body.trim()}</pre>
      )}
    </Card>
  );
};

// ── Task ────────────────────────────────────────────────────────────
type TaskItem = { title: string; status?: "pending" | "running" | "complete" | "failed"; detail?: string };
export const TaskMarker: React.FC<{ block: MarkerBlock }> = ({ block }) => {
  let items: TaskItem[] = [];
  if (Array.isArray(block.json)) {
    items = block.json as TaskItem[];
  } else if (block.json && typeof block.json === "object" && Array.isArray((block.json as Record<string, unknown>).items)) {
    items = (block.json as { items: TaskItem[] }).items;
  } else {
    // Fallback: parse plain bullet lines
    items = block.body
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => ({ title: line.replace(/^[-*]\s*/, "") }));
  }
  const dot = (status?: string) =>
    status === "complete"
      ? "var(--positive)"
      : status === "running"
        ? "var(--accent)"
        : status === "failed"
          ? "var(--negative)"
          : "var(--border-base)";
  return (
    <Card icon="logs" iconColor="var(--accent)" title="Activity" meta={`${items.length} step${items.length === 1 ? "" : "s"}`} accent="var(--accent)">
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: dot(it.status),
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1 }}>{it.title}</span>
            {it.detail && (
              <span style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--fg-faint)" }}>{it.detail}</span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};

// ── Reasoning ───────────────────────────────────────────────────────
export const ReasoningMarker: React.FC<{ block: MarkerBlock }> = ({ block }) => {
  const dur = block.meta.duration_s;
  const meta = dur ? `Thought for ${dur}s` : block.partial ? "thinking…" : "thought";
  return (
    <Card
      icon="spark"
      iconColor="var(--fg-faint)"
      title={<span style={{ color: "var(--fg-muted)", fontStyle: "italic" }}>Reasoning</span>}
      meta={meta}
      defaultOpen={false}
      accent="var(--fg-ghost)"
    >
      <pre style={{ ...codePre, fontFamily: "var(--font-serif)", whiteSpace: "pre-wrap", color: "var(--fg-muted)" }}>
        {block.body.trim()}
      </pre>
    </Card>
  );
};

// ── Plan ────────────────────────────────────────────────────────────
type PlanStep = { title: string; status?: "pending" | "in-progress" | "done"; detail?: string };
export interface PlanData { title?: string; steps: PlanStep[]; planId?: string }

export const PlanMarker: React.FC<{
  block: MarkerBlock;
  onRun?: (plan: PlanData) => void;
  onRefine?: (plan: PlanData) => void;
}> = ({ block, onRun, onRefine }) => {
  let title = "Plan";
  let planId: string | undefined;
  let steps: PlanStep[] = [];
  if (block.json && typeof block.json === "object" && !Array.isArray(block.json)) {
    const obj = block.json as { title?: string; steps?: PlanStep[]; planId?: string };
    if (obj.title) title = obj.title;
    if (obj.planId) planId = obj.planId;
    if (Array.isArray(obj.steps)) steps = obj.steps;
  } else if (Array.isArray(block.json)) {
    steps = block.json as PlanStep[];
  } else {
    // Fallback: each line as a step.
    steps = block.body
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((l) => l)
      .map((line) => {
        const m = line.match(/^[-*]\s*\[([ x])\]\s*(.*)$/);
        if (m) return { title: m[2], status: m[1] === "x" ? "done" : "pending" };
        return { title: line.replace(/^[-*0-9.]+\s*/, "") };
      });
  }
  const glyph = (s?: string) =>
    s === "done"
      ? "✓"
      : s === "in-progress"
        ? "•"
        : "·";
  const color = (s?: string) =>
    s === "done"
      ? "var(--positive-fg)"
      : s === "in-progress"
        ? "var(--accent-fg)"
        : "var(--fg-faint)";
  const planData: PlanData = { title, steps, planId };
  return (
    <Card
      icon="board"
      iconColor="var(--accent-fg)"
      title={title}
      meta={`${steps.length} step${steps.length === 1 ? "" : "s"}`}
      accent="var(--accent)"
    >
      <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
        {steps.map((s, i) => (
          <li key={i} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              style={{
                width: 16,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: color(s.status),
                textAlign: "center",
                flexShrink: 0,
              }}
            >
              {glyph(s.status)}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-faint)", flexShrink: 0 }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span style={{ flex: 1, color: s.status === "done" ? "var(--fg-muted)" : "var(--fg-base)", textDecoration: s.status === "done" ? "line-through" : "none" }}>
              {s.title}
            </span>
            {s.detail && <span style={{ fontSize: 10.5, color: "var(--fg-faint)" }}>{s.detail}</span>}
          </li>
        ))}
      </ol>
      {(onRun || onRefine) && steps.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
          {onRun && (
            <button
              onClick={() => onRun(planData)}
              style={{
                padding: "5px 12px",
                borderRadius: 5,
                background: "var(--accent)",
                color: "var(--fg-on-accent)",
                fontSize: 12,
                fontWeight: 500,
                border: 0,
                cursor: "pointer",
              }}
            >
              Run as coordinator
            </button>
          )}
          {onRefine && (
            <button
              onClick={() => onRefine(planData)}
              style={{
                padding: "5px 12px",
                borderRadius: 5,
                background: "transparent",
                border: "1px solid var(--border-base)",
                color: "var(--fg-muted)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Refine
            </button>
          )}
        </div>
      )}
    </Card>
  );
};

// ── Actions ─────────────────────────────────────────────────────────
type ActionItem = { label: string; id: string; style?: "primary" | "ghost" | "warn"; payload?: unknown };
export const ActionsMarker: React.FC<{
  block: MarkerBlock;
  onAction?: (action: ActionItem) => void;
}> = ({ block, onAction }) => {
  let items: ActionItem[] = [];
  if (Array.isArray(block.json)) items = block.json as ActionItem[];
  else if (block.json && typeof block.json === "object" && Array.isArray((block.json as Record<string, unknown>).actions)) {
    items = (block.json as { actions: ActionItem[] }).actions;
  }
  if (items.length === 0) return null;
  const styleFor = (s?: string): React.CSSProperties => {
    if (s === "primary")
      return {
        background: "var(--accent)",
        color: "var(--fg-on-accent)",
        border: 0,
      };
    if (s === "warn")
      return {
        background: "var(--warn)",
        color: "var(--fg-on-accent)",
        border: 0,
      };
    return {
      background: "transparent",
      color: "var(--fg-strong)",
      border: "1px solid var(--border-base)",
    };
  };
  return (
    <div style={{ margin: "10px 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((a, i) => (
        <button
          key={i}
          onClick={() => onAction?.(a)}
          disabled={!onAction}
          style={{
            padding: "5px 12px",
            borderRadius: 5,
            fontSize: 12,
            fontWeight: 500,
            cursor: onAction ? "pointer" : "default",
            opacity: onAction ? 1 : 0.6,
            ...styleFor(a.style),
          }}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
};

// ── Question (model asks user to pick) ───────────────────────────────
type QuestionOption = { label: string; value: string };
export const QuestionMarker: React.FC<{
  block: MarkerBlock;
  onAnswer?: (answer: string, label: string) => void;
}> = ({ block, onAnswer }) => {
  const json = (block.json ?? {}) as { prompt?: string; options?: QuestionOption[]; allow_freeform?: boolean };
  const prompt = json.prompt ?? block.body.split("\n")[0] ?? "Pick one";
  const options = Array.isArray(json.options) ? json.options : [];
  const [free, setFree] = React.useState("");
  return (
    <div
      style={{
        margin: "8px 0",
        padding: "10px 12px",
        background: "var(--bg-panel)",
        border: "1px solid var(--border-subtle)",
        borderLeft: "2px solid var(--accent)",
        borderRadius: 8,
      }}
    >
      <div style={{ fontWeight: 500, fontSize: 13, color: "var(--fg-strong)", marginBottom: 8 }}>{prompt}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map((opt, i) => (
          <button
            key={i}
            onClick={() => onAnswer?.(opt.value, opt.label)}
            disabled={!onAnswer}
            style={{
              padding: "5px 12px",
              borderRadius: 5,
              fontSize: 12,
              border: "1px solid var(--border-base)",
              background: "var(--bg-sunken)",
              color: "var(--fg-strong)",
              cursor: onAnswer ? "pointer" : "default",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {json.allow_freeform && (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input
            value={free}
            onChange={(e) => setFree(e.target.value)}
            placeholder="Or type your own…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && free.trim() && onAnswer) {
                onAnswer(free.trim(), free.trim());
                setFree("");
              }
            }}
            style={{
              flex: 1,
              padding: "5px 8px",
              borderRadius: 5,
              border: "1px solid var(--border-base)",
              background: "var(--bg-sunken)",
              color: "var(--fg-base)",
              fontSize: 12,
            }}
          />
        </div>
      )}
    </div>
  );
};

// ── Suggestion (clickable prompt suggestions) ────────────────────────
export const SuggestionMarker: React.FC<{
  block: MarkerBlock;
  onSuggest?: (suggestion: string) => void;
}> = ({ block, onSuggest }) => {
  let items: string[] = [];
  if (Array.isArray(block.json)) {
    items = (block.json as unknown[]).map((s) => String(s));
  } else if (block.json && typeof block.json === "object" && Array.isArray((block.json as Record<string, unknown>).suggestions)) {
    items = (block.json as { suggestions: unknown[] }).suggestions.map((s) => String(s));
  } else {
    items = block.body.split(/\n+/).map((s) => s.trim().replace(/^[-*]\s*/, "")).filter(Boolean);
  }
  if (items.length === 0) return null;
  return (
    <div style={{ margin: "8px 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((s, i) => (
        <button
          key={i}
          onClick={() => onSuggest?.(s)}
          disabled={!onSuggest}
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: 12,
            border: "1px solid var(--border-base)",
            background: "var(--bg-sunken)",
            color: "var(--fg-muted)",
            cursor: onSuggest ? "pointer" : "default",
          }}
        >
          {s}
        </button>
      ))}
    </div>
  );
};

// ── Confirmation (HITM) ─────────────────────────────────────────────
export const ConfirmationMarker: React.FC<{
  block: MarkerBlock;
  onApprove?: (phaseId: string) => void;
  onReject?: (phaseId: string) => void;
}> = ({ block, onApprove, onReject }) => {
  const json = (block.json ?? {}) as { phaseId?: string; runId?: string; summary?: string };
  const phaseId = json.phaseId ?? block.meta.phaseId ?? "";
  const summary = json.summary ?? block.body.trim();
  return (
    <div
      style={{
        margin: "8px 0",
        padding: "12px 14px",
        background: "var(--warn-soft)",
        borderLeft: "3px solid var(--warn)",
        borderRadius: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 14 }}>⏸️</span>
        <span style={{ fontWeight: 500, fontSize: 13, color: "var(--warn-fg)" }}>
          Awaiting approval{phaseId ? ` · phase ${phaseId}` : ""}
        </span>
      </div>
      {summary && (
        <div style={{ fontSize: 12.5, color: "var(--fg-base)", marginBottom: 10, lineHeight: 1.5 }}>{summary}</div>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={() => phaseId && onApprove?.(phaseId)}
          disabled={!phaseId || !onApprove}
          style={{
            padding: "5px 12px",
            borderRadius: 5,
            background: "var(--warn)",
            color: "var(--fg-on-accent)",
            fontSize: 12,
            fontWeight: 500,
            cursor: phaseId && onApprove ? "pointer" : "default",
            opacity: phaseId && onApprove ? 1 : 0.5,
          }}
        >
          Approve
        </button>
        {onReject && (
          <button
            onClick={() => phaseId && onReject(phaseId)}
            disabled={!phaseId}
            style={{
              padding: "5px 12px",
              borderRadius: 5,
              background: "transparent",
              border: "1px solid var(--border-base)",
              color: "var(--fg-muted)",
              fontSize: 12,
              cursor: phaseId ? "pointer" : "default",
            }}
          >
            Reject
          </button>
        )}
      </div>
    </div>
  );
};

// ── Sources ─────────────────────────────────────────────────────────
type Source = { n?: number; title?: string; url?: string; quote?: string };
export const SourcesMarker: React.FC<{ block: MarkerBlock }> = ({ block }) => {
  let items: Source[] = [];
  if (Array.isArray(block.json)) {
    items = block.json as Source[];
  } else if (block.json && typeof block.json === "object" && Array.isArray((block.json as Record<string, unknown>).items)) {
    items = (block.json as { items: Source[] }).items;
  }
  return (
    <Card
      icon="quote"
      iconColor="var(--fg-faint)"
      title="Sources"
      meta={`${items.length} cited`}
      defaultOpen={false}
    >
      <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((s, i) => (
          <li key={i} style={{ fontSize: 12 }}>
            {s.url ? (
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--accent-fg)", textDecoration: "none" }}
              >
                {s.title ?? s.url}
              </a>
            ) : (
              <span style={{ color: "var(--fg-muted)" }}>{s.title ?? "(untitled)"}</span>
            )}
            {s.quote && (
              <div style={{ fontSize: 11, color: "var(--fg-faint)", fontStyle: "italic", marginTop: 2 }}>
                “{s.quote}”
              </div>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
};
