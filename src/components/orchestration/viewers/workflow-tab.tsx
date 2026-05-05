import * as React from "react";
import type { Board, WorkflowDef } from "../types";
import { OutlineRail, WorkflowGraph } from "../workflow-graph";

export interface WorkflowTabProps {
  workflows: WorkflowDef[];
  /** Map workflow id → board layout. */
  boards: Record<string, Board>;
  activeWorkflow: string;
  setActiveWorkflow: (id: string) => void;
  onOpenArtifact?: (artifactId: string) => void;
}

export const WorkflowTab: React.FC<WorkflowTabProps> = ({
  workflows,
  boards,
  activeWorkflow,
  setActiveWorkflow,
  onOpenArtifact,
}) => {
  const wf = workflows.find((w) => w.id === activeWorkflow) || workflows[0];
  const board = boards[activeWorkflow];
  const [focusNodeId, setFocusNodeId] = React.useState<string | null>(null);

  React.useEffect(() => setFocusNodeId(null), [activeWorkflow]);

  if (!wf || !board) {
    return (
      <div style={{ padding: 40, color: "var(--fg-faint)", fontStyle: "italic" }}>
        No workflow selected.
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg-canvas)" }}>
      <div
        style={{
          padding: "20px 28px 14px",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 22 }}>{wf.emoji}</span>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontSize: 26,
              fontWeight: 500,
              color: "var(--fg-strong)",
              letterSpacing: "-0.015em",
            }}
          >
            {wf.label}
          </h1>
          <span
            style={{
              marginLeft: 6,
              fontSize: 11.5,
              color: "var(--fg-faint)",
              fontWeight: 500,
              padding: "2px 8px",
              background: "var(--bg-sunken)",
              borderRadius: 10,
            }}
          >
            {wf.status}
          </span>
          <span style={{ fontSize: 12, color: "var(--fg-faint)" }}>
            · {wf.runs} run{wf.runs === 1 ? "" : "s"}
          </span>
        </div>
        <div style={{ fontSize: 14, color: "var(--fg-muted)", maxWidth: 720, lineHeight: 1.5 }}>{wf.note}</div>
        <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
          {workflows.map((w) => {
            const on = w.id === activeWorkflow;
            return (
              <button
                key={w.id}
                onClick={() => setActiveWorkflow(w.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px",
                  borderRadius: 6,
                  color: on ? "var(--fg-strong)" : "var(--fg-muted)",
                  background: on ? "var(--bg-sunken)" : "transparent",
                  fontSize: 12.5,
                  cursor: "pointer",
                  fontWeight: on ? 500 : 400,
                  border: `1px solid ${on ? "var(--border-base)" : "transparent"}`,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  if (!on) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!on) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <span style={{ fontSize: 13 }}>{w.emoji}</span>
                <span>{w.label}</span>
                <span style={{ fontSize: 10.5, color: "var(--fg-faint)" }}>· {w.status}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <OutlineRail
          board={board}
          focusNodeId={focusNodeId}
          setFocusNodeId={setFocusNodeId}
          onOpenArtifact={onOpenArtifact}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <WorkflowGraph
            board={board}
            focusNodeId={focusNodeId}
            onOpenArtifact={onOpenArtifact}
            onOpenWorkflow={(id) => {
              setActiveWorkflow(id);
              setFocusNodeId(null);
            }}
          />
        </div>
      </div>
    </div>
  );
};
