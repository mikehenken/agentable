import * as React from "react";
import { Icon, type IconName } from "../../general";
import { ModalShell } from "./modal-shell";
import type { Artifact, ArtifactKind, Workspace } from "../types";

const ARTIFACT_KIND_ICON: Record<ArtifactKind, IconName> = {
  markdown: "doc",
  yaml: "yaml",
  "yaml-cite": "yaml",
  gap: "spark",
  tldraw: "board",
  source: "artifact",
};

export interface FlatArtifact extends Artifact {
  clientId: string;
  clientName: string;
  clientTag: string;
  projectId: string;
  projectName: string;
  runId: string;
  runName: string;
  runVerdict?: string | null;
  isCurrentRun: boolean;
}

export function flattenArtifacts(workspaces: Workspace[], activeRunId: string): FlatArtifact[] {
  const rows: FlatArtifact[] = [];
  workspaces.forEach((c) => {
    c.projects.forEach((p) => {
      p.runs.forEach((r) => {
        (r.artifacts || []).forEach((a) => {
          rows.push({
            ...a,
            clientId: c.id,
            clientName: c.name,
            clientTag: c.tag,
            projectId: p.id,
            projectName: p.name,
            runId: r.id,
            runName: r.name,
            runVerdict: r.verdict,
            isCurrentRun: r.id === activeRunId,
          });
        });
      });
    });
  });
  return rows;
}

export interface ContextPickerModalProps {
  workspaces: Workspace[];
  activeRunId: string;
  currentContext: FlatArtifact[];
  onAdd: (adds: FlatArtifact[]) => void;
  onClose: () => void;
  /**
   * Optional: bulk-fetch artifact lists for the runs in the current
   * scope. Live adapters typically only have artifacts cached for
   * the active run; this lets the picker hydrate the rest on demand.
   * Called once per scope change, with a `runIds` filtered to that scope.
   */
  onPrefetch?: (runIds: string[]) => Promise<void>;
}

type Scope = "current-run" | "this-project" | "this-client" | "all";

const SCOPES: { id: Scope; label: string }[] = [
  { id: "current-run", label: "This run" },
  { id: "this-project", label: "This project" },
  { id: "this-client", label: "This client" },
  { id: "all", label: "All clients" },
];

export const ContextPickerModal: React.FC<ContextPickerModalProps> = ({
  workspaces,
  activeRunId,
  currentContext,
  onAdd,
  onClose,
  onPrefetch,
}) => {
  const [scope, setScope] = React.useState<Scope>("current-run");
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const activeRow = React.useMemo(() => {
    for (const c of workspaces)
      for (const p of c.projects)
        for (const r of p.runs) if (r.id === activeRunId) return { clientId: c.id, projectId: p.id };
    return { clientId: undefined, projectId: undefined };
  }, [workspaces, activeRunId]);

  // Compute the runIds in the current scope so we can prefetch their
  // artifact lists. Without this, the picker walks the workspaces
  // tree and finds empty `r.artifacts` for every run except the
  // currently-active one.
  const scopeRunIds = React.useMemo(() => {
    const ids: string[] = [];
    for (const c of workspaces) {
      if (scope === "this-client" && c.id !== activeRow.clientId) continue;
      for (const p of c.projects) {
        if (scope === "this-project" && p.id !== activeRow.projectId) continue;
        for (const r of p.runs) {
          if (scope === "current-run" && r.id !== activeRunId) continue;
          ids.push(r.id);
        }
      }
    }
    return ids;
  }, [workspaces, scope, activeRunId, activeRow.clientId, activeRow.projectId]);

  // Hydrate artifacts for the in-scope runs whenever the scope
  // changes. The adapter caches results so re-opening the picker is
  // free; first open at a wider scope shows a brief spinner.
  React.useEffect(() => {
    if (!onPrefetch || scopeRunIds.length === 0) return;
    let cancelled = false;
    setLoading(true);
    onPrefetch(scopeRunIds).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [onPrefetch, scopeRunIds]);

  const all = React.useMemo(() => flattenArtifacts(workspaces, activeRunId), [workspaces, activeRunId]);

  const filtered = all.filter((a) => {
    if (scope === "current-run" && a.runId !== activeRunId) return false;
    if (scope === "this-project" && a.projectId !== activeRow.projectId) return false;
    if (scope === "this-client" && a.clientId !== activeRow.clientId) return false;
    if (query) {
      const q = query.toLowerCase();
      if (
        !a.name.toLowerCase().includes(q) &&
        !a.runName.toLowerCase().includes(q) &&
        !a.projectName.toLowerCase().includes(q) &&
        !a.clientName.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const grouped: Record<string, FlatArtifact[]> = {};
  filtered.forEach((a) => {
    const k = `${a.clientTag} · ${a.projectName} · ${a.runName}`;
    (grouped[k] ||= []).push(a);
  });

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const inContext = (id: string) => currentContext.some((c) => c.id === id);

  const submit = () => {
    const adds = filtered.filter((a) => selected.has(a.id) && !inContext(a.id));
    onAdd(adds);
    onClose();
  };

  return (
    <ModalShell onClose={onClose} width={680} maxHeight="78vh">
      <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="artifact" size={16} style={{ color: "var(--accent)" }} />
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--fg-strong)" }}>Add context</h2>
          <span style={{ fontSize: 11.5, color: "var(--fg-faint)" }}>{selected.size} selected</span>
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto",
              width: 24,
              height: 24,
              borderRadius: 5,
              cursor: "pointer",
              color: "var(--fg-muted)",
              display: "grid",
              placeItems: "center",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
          >
            <Icon name="close" size={13} />
          </button>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center" }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artifacts…"
            style={{
              flex: 1,
              fontSize: 12.5,
              padding: "6px 10px",
              background: "var(--bg-sunken)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 6,
              color: "var(--fg-strong)",
              outline: "none",
              fontFamily: "var(--font-sans)",
            }}
          />
          <div style={{ display: "flex", gap: 1, padding: 2, background: "var(--bg-sunken)", borderRadius: 6 }}>
            {SCOPES.map((s) => {
              const on = s.id === scope;
              return (
                <button
                  key={s.id}
                  onClick={() => setScope(s.id)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 4,
                    fontSize: 11.5,
                    cursor: "pointer",
                    background: on ? "var(--bg-panel)" : "transparent",
                    color: on ? "var(--fg-strong)" : "var(--fg-muted)",
                    fontWeight: on ? 500 : 400,
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "8px 14px 12px" }}>
        {Object.keys(grouped).length === 0 && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--fg-faint)", fontSize: 12.5 }}>
            {loading
              ? "Loading artifacts…"
              : query
                ? "No artifacts match."
                : scopeRunIds.length === 0
                  ? "No runs in scope yet."
                  : "No artifacts in this scope yet."}
          </div>
        )}
        {Object.entries(grouped).map(([groupLabel, items]) => (
          <div key={groupLabel} style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 10.5,
                fontFamily: "var(--font-mono)",
                color: "var(--fg-faint)",
                textTransform: "uppercase",
                letterSpacing: ".06em",
                padding: "8px 4px 4px",
              }}
            >
              {groupLabel}
            </div>
            {items.map((a) => {
              const sel = selected.has(a.id);
              const already = inContext(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => !already && toggle(a.id)}
                  disabled={already}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: 5,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: already ? "default" : "pointer",
                    background: sel ? "var(--accent-soft)" : already ? "var(--bg-sunken)" : "transparent",
                    border: `1px solid ${sel ? "var(--accent)" : "transparent"}`,
                    opacity: already ? 0.55 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!already && !sel) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!already && !sel) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      flexShrink: 0,
                      border: `1.5px solid ${sel ? "var(--accent)" : "var(--border-base)"}`,
                      background: sel ? "var(--accent)" : "transparent",
                      color: "var(--fg-on-accent)",
                      fontSize: 10,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {sel ? "✓" : ""}
                  </span>
                  <Icon
                    name={ARTIFACT_KIND_ICON[a.kind] || "doc"}
                    size={13}
                    style={{ color: "var(--accent)", flexShrink: 0 }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--fg-strong)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                      textAlign: "left",
                    }}
                  >
                    {a.name}
                  </span>
                  <span
                    style={{
                      fontSize: 10.5,
                      color: "var(--fg-faint)",
                      fontFamily: "var(--font-mono)",
                      flexShrink: 0,
                    }}
                  >
                    {a.size}
                  </span>
                  {already && (
                    <span style={{ fontSize: 10, color: "var(--fg-faint)", fontStyle: "italic", flexShrink: 0 }}>
                      in context
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div
        style={{
          padding: "10px 16px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
        }}
      >
        <button
          onClick={onClose}
          style={{
            padding: "6px 12px",
            borderRadius: 5,
            fontSize: 12,
            cursor: "pointer",
            color: "var(--fg-muted)",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={selected.size === 0}
          style={{
            padding: "6px 14px",
            borderRadius: 5,
            fontSize: 12,
            fontWeight: 500,
            cursor: selected.size ? "pointer" : "default",
            background: selected.size ? "var(--accent)" : "var(--bg-sunken)",
            color: selected.size ? "var(--fg-on-accent)" : "var(--fg-ghost)",
          }}
        >
          Add{selected.size ? ` (${selected.size})` : ""}
        </button>
      </div>
    </ModalShell>
  );
};
