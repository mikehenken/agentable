import * as React from "react";
import { Icon } from "../../general";
import type { Workspace, Project } from "../types";

const PICK_EMOJI = ["🏢", "🌐", "🛰️", "🧭", "🔬", "🪴", "📊", "🛒", "🚚", "🏗️", "🎯", "🧱"];
const PROJECT_EMOJI = "📁";

interface InlineCreateValue {
  name: string;
  tag?: string;
  emoji: string;
}

interface InlineCreateProps {
  kind: "client" | "project";
  defaultEmoji?: string;
  indent?: number;
  onSubmit: (value: InlineCreateValue) => void;
  onCancel: () => void;
}

const InlineCreate: React.FC<InlineCreateProps> = ({ kind, defaultEmoji = "🏢", indent = 0, onSubmit, onCancel }) => {
  const [name, setName] = React.useState("");
  const [tag, setTag] = React.useState("");
  const [emoji, setEmoji] = React.useState(defaultEmoji);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      tag:
        kind === "client"
          ? tag.trim().toUpperCase().slice(0, 4) || name.trim().slice(0, 3).toUpperCase()
          : undefined,
      emoji,
    });
  };

  return (
    <div
      style={{
        margin: "2px 4px",
        padding: "6px 8px",
        paddingLeft: 8 + indent,
        background: "var(--bg-panel)",
        border: "1px solid var(--border-base)",
        borderRadius: 6,
        boxShadow: "var(--shadow-1)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          onClick={() => setPickerOpen((o) => !o)}
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            fontSize: 14,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            background: "var(--bg-sunken)",
          }}
          title="Choose emoji"
        >
          {emoji}
        </button>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onCancel();
          }}
          placeholder={kind === "client" ? "Client name" : "Project name"}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 12.5,
            padding: "3px 6px",
            background: "var(--bg-sunken)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 4,
            color: "var(--fg-strong)",
            outline: "none",
            fontFamily: "var(--font-sans)",
          }}
        />
        {kind === "client" && (
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value.toUpperCase().slice(0, 4))}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") onCancel();
            }}
            placeholder="TAG"
            style={{
              width: 50,
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              padding: "3px 6px",
              textAlign: "center",
              background: "var(--bg-sunken)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 4,
              color: "var(--fg-strong)",
              outline: "none",
              letterSpacing: ".04em",
            }}
          />
        )}
      </div>
      {pickerOpen && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 2, padding: "4px 0 2px" }}>
          {PICK_EMOJI.map((e) => (
            <button
              key={e}
              onClick={() => {
                setEmoji(e);
                setPickerOpen(false);
              }}
              style={{
                width: 22,
                height: 22,
                fontSize: 13,
                cursor: "pointer",
                borderRadius: 3,
                background: e === emoji ? "var(--bg-active)" : "transparent",
              }}
              onMouseEnter={(ev) => {
                if (e !== emoji) (ev.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
              }}
              onMouseLeave={(ev) => {
                if (e !== emoji) (ev.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
        <button
          onClick={onCancel}
          style={{
            fontSize: 11.5,
            padding: "3px 8px",
            borderRadius: 4,
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
          disabled={!name.trim()}
          style={{
            fontSize: 11.5,
            padding: "3px 9px",
            borderRadius: 4,
            cursor: name.trim() ? "pointer" : "default",
            color: name.trim() ? "var(--fg-on-accent)" : "var(--fg-ghost)",
            background: name.trim() ? "var(--accent)" : "var(--bg-sunken)",
            fontWeight: 500,
          }}
        >
          Create
        </button>
      </div>
    </div>
  );
};

const InlinePlus: React.FC<{ onClick: () => void; title: string; visible: boolean }> = ({
  onClick,
  title,
  visible,
}) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    title={title}
    style={{
      width: 18,
      height: 18,
      borderRadius: 3,
      display: "grid",
      placeItems: "center",
      color: "var(--fg-faint)",
      cursor: "pointer",
      flexShrink: 0,
      opacity: visible ? 1 : 0,
      transition: "opacity .12s, background .12s",
    }}
    onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-active)")}
    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
  >
    <Icon name="plus" size={11} />
  </button>
);

export interface LeftRailProps {
  workspaces: Workspace[];
  activeRunId: string | null;
  setActiveRunId: (id: string) => void;
  onNewRun?: (workspace: Workspace, project: Project) => void;
  onCreateClient?: (value: InlineCreateValue) => void;
  onCreateProject?: (workspaceId: string, value: InlineCreateValue) => void;
  /** Footer status. Defaults to "Orchestrator healthy". */
  health?: { ok: boolean; label: string; version?: string };
  /** When true, renders a skeleton in place of the workspace tree. */
  loading?: boolean;
}

const SKELETON_KEYFRAMES = `
@keyframes orchPulse { 0%,100% { opacity: 0.45 } 50% { opacity: 1 } }
`;

const SkeletonRow: React.FC<{ indent?: number; w?: number }> = ({ indent = 0, w = 140 }) => (
  <div
    style={{
      padding: "4px 8px",
      paddingLeft: 8 + indent,
      display: "flex",
      alignItems: "center",
      gap: 6,
    }}
  >
    <span
      style={{
        width: 14,
        height: 14,
        borderRadius: 3,
        background: "var(--bg-sunken)",
        animation: "orchPulse 1.4s ease-in-out infinite",
      }}
    />
    <span
      style={{
        width: w,
        height: 10,
        borderRadius: 3,
        background: "var(--bg-sunken)",
        animation: "orchPulse 1.4s ease-in-out infinite",
        animationDelay: ".15s",
      }}
    />
  </div>
);

/** Notion-style page tree of Workspace → Project → Run. */
export const LeftRail: React.FC<LeftRailProps> = ({
  workspaces,
  activeRunId,
  setActiveRunId,
  onNewRun,
  onCreateClient,
  onCreateProject,
  health = { ok: true, label: "Orchestrator healthy", version: "v0.4.2" },
  loading = false,
}) => {
  // Walk the tree to find which workspace + project contains the
  // active run, so those paths can be auto-expanded.
  const activePath = React.useMemo(() => {
    if (!activeRunId) return null;
    for (const w of workspaces) {
      for (const p of w.projects) {
        if (p.runs.some((r) => r.id === activeRunId)) {
          return { workspaceId: w.id, projectId: p.id };
        }
      }
    }
    return null;
  }, [workspaces, activeRunId]);

  const initialOpenClients = React.useMemo(() => {
    const s: Record<string, boolean> = {};
    if (activePath) s[activePath.workspaceId] = true;
    else if (workspaces[0]) s[workspaces[0].id] = true;
    return s;
  }, [workspaces, activePath]);
  const initialOpenProjects = React.useMemo(() => {
    const s: Record<string, boolean> = {};
    if (activePath) s[`${activePath.workspaceId}/${activePath.projectId}`] = true;
    else {
      const w0 = workspaces[0];
      const p0 = w0?.projects?.[0];
      if (w0 && p0) s[`${w0.id}/${p0.id}`] = true;
    }
    return s;
  }, [workspaces, activePath]);

  const [openClients, setOpenClients] = React.useState<Record<string, boolean>>(initialOpenClients);
  const [openProjects, setOpenProjects] = React.useState<Record<string, boolean>>(initialOpenProjects);

  // Re-expand parents whenever activePath changes (e.g. user kicks off
  // a new run and we set activeRunId to the new id).
  React.useEffect(() => {
    if (!activePath) return;
    setOpenClients((s) => ({ ...s, [activePath.workspaceId]: true }));
    setOpenProjects((s) => ({ ...s, [`${activePath.workspaceId}/${activePath.projectId}`]: true }));
  }, [activePath]);
  const [hoverKey, setHoverKey] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState<{ kind: "client" } | { kind: "project"; clientId: string } | null>(null);

  return (
    <aside
      style={{
        width: 260,
        flexShrink: 0,
        background: "var(--bg-app)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "12px 12px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--fg-faint)" }}>Workspace</span>
        <button
          onClick={() => setCreating({ kind: "client" })}
          title="New client"
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            display: "grid",
            placeItems: "center",
            color: "var(--fg-faint)",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
        >
          <Icon name="plus" size={12} />
        </button>
      </div>

      <div style={{ overflowY: "auto", flex: 1, padding: "0 4px 8px" }}>
        {loading && workspaces.length === 0 && (
          <>
            <style>{SKELETON_KEYFRAMES}</style>
            {[180, 150, 165, 140].map((w, i) => (
              <SkeletonRow key={i} w={w} />
            ))}
            <SkeletonRow w={120} indent={18} />
            <SkeletonRow w={130} indent={18} />
          </>
        )}
        {workspaces.map((c) => {
          const open = !!openClients[c.id];
          const hover = hoverKey === `c:${c.id}`;
          return (
            <div key={c.id} style={{ marginBottom: 1 }}>
              <div
                onMouseEnter={() => setHoverKey(`c:${c.id}`)}
                onMouseLeave={() => setHoverKey(null)}
                onClick={() => setOpenClients((s) => ({ ...s, [c.id]: !s[c.id] }))}
                style={{
                  padding: "4px 8px",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  background: hover ? "var(--bg-hover)" : "transparent",
                }}
              >
                <span style={{ color: "var(--fg-ghost)", fontSize: 9, width: 10, textAlign: "center", flexShrink: 0 }}>
                  {open ? "▾" : "▸"}
                </span>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{c.emoji ?? "🏢"}</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--fg-strong)",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.name}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--fg-faint)",
                    letterSpacing: ".04em",
                    flexShrink: 0,
                  }}
                >
                  {c.tag}
                </span>
                <InlinePlus
                  visible={hover}
                  title="New project"
                  onClick={() => {
                    setOpenClients((s) => ({ ...s, [c.id]: true }));
                    setCreating({ kind: "project", clientId: c.id });
                  }}
                />
              </div>

              {open &&
                c.projects.map((p) => {
                  const pkey = `${c.id}/${p.id}`;
                  const popen = !!openProjects[pkey];
                  const phover = hoverKey === `p:${pkey}`;
                  return (
                    <div key={p.id}>
                      <div
                        onMouseEnter={() => setHoverKey(`p:${pkey}`)}
                        onMouseLeave={() => setHoverKey(null)}
                        onClick={() => setOpenProjects((s) => ({ ...s, [pkey]: !s[pkey] }))}
                        style={{
                          padding: "3px 8px 3px 26px",
                          borderRadius: 4,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          cursor: "pointer",
                          background: phover ? "var(--bg-hover)" : "transparent",
                        }}
                      >
                        <span style={{ color: "var(--fg-ghost)", fontSize: 9, width: 10, textAlign: "center", flexShrink: 0 }}>
                          {popen ? "▾" : "▸"}
                        </span>
                        <span style={{ fontSize: 12, opacity: 0.85, flexShrink: 0 }}>{p.emoji || PROJECT_EMOJI}</span>
                        <span
                          style={{
                            fontSize: 12.5,
                            color: "var(--fg-base)",
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.name}
                        </span>
                        {p.status === "active" && (
                          <span title="active" style={{ width: 6, height: 6, borderRadius: 3, background: "var(--positive)", flexShrink: 0 }}></span>
                        )}
                        {p.status === "draft" && (
                          <span title="draft" style={{ width: 6, height: 6, borderRadius: 3, background: "var(--fg-ghost)", flexShrink: 0 }}></span>
                        )}
                        {p.status === "paused" && (
                          <span title="paused" style={{ width: 6, height: 6, borderRadius: 3, background: "var(--warn)", flexShrink: 0 }}></span>
                        )}
                        <InlinePlus
                          visible={phover}
                          title="New run"
                          onClick={() => {
                            setOpenProjects((s) => ({ ...s, [pkey]: true }));
                            onNewRun?.(c, p);
                          }}
                        />
                      </div>

                      {popen &&
                        p.runs.map((r) => {
                          const active = r.id === activeRunId;
                          return (
                            <button
                              key={r.id}
                              onClick={() => setActiveRunId(r.id)}
                              style={{
                                width: "100%",
                                padding: "3px 8px 3px 44px",
                                borderRadius: 4,
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                cursor: "pointer",
                                background: active ? "var(--bg-active)" : "transparent",
                                position: "relative",
                              }}
                              onMouseEnter={(e) => {
                                if (!active) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
                              }}
                              onMouseLeave={(e) => {
                                if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                              }}
                            >
                              {active && (
                                <span
                                  style={{
                                    position: "absolute",
                                    left: 36,
                                    top: 5,
                                    bottom: 5,
                                    width: 2,
                                    borderRadius: 2,
                                    background: "var(--fg-base)",
                                  }}
                                ></span>
                              )}
                              <span
                                style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: 11.5,
                                  color: active ? "var(--fg-strong)" : "var(--fg-muted)",
                                  flex: 1,
                                  textAlign: "left",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {r.name}
                              </span>
                              {r.status === "complete" && r.verdict === "PASS" && (
                                <Icon name="check" size={12} style={{ color: "var(--positive)", flexShrink: 0 }} />
                              )}
                              {r.status === "complete" && r.verdict === "FAIL" && (
                                <Icon name="close" size={12} style={{ color: "var(--negative)", flexShrink: 0 }} />
                              )}
                              {r.status === "running" && (
                                <span style={{ width: 6, height: 6, borderRadius: 3, background: "var(--accent)", flexShrink: 0 }}></span>
                              )}
                              {r.status === "superseded" && (
                                <span style={{ fontSize: 10, color: "var(--fg-ghost)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>—</span>
                              )}
                            </button>
                          );
                        })}
                      {popen && p.runs.length === 0 && (
                        <div style={{ padding: "3px 8px 3px 44px", fontSize: 11.5, color: "var(--fg-ghost)", fontStyle: "italic" }}>
                          no runs yet
                        </div>
                      )}
                      {popen && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNewRun?.(c, p);
                          }}
                          style={{
                            width: "calc(100% - 8px)",
                            margin: "1px 4px 2px",
                            padding: "3px 8px 3px 44px",
                            borderRadius: 4,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            color: "var(--fg-faint)",
                            fontSize: 11.5,
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
                            (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-muted)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                            (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-faint)";
                          }}
                        >
                          <Icon name="plus" size={10} />
                          <span style={{ fontFamily: "var(--font-mono)" }}>New run</span>
                        </button>
                      )}
                    </div>
                  );
                })}

              {open && creating?.kind === "project" && creating.clientId === c.id && (
                <InlineCreate
                  kind="project"
                  defaultEmoji={PROJECT_EMOJI}
                  indent={18}
                  onSubmit={(d) => {
                    onCreateProject?.(c.id, d);
                    setCreating(null);
                  }}
                  onCancel={() => setCreating(null)}
                />
              )}
            </div>
          );
        })}

        {creating?.kind === "client" && (
          <InlineCreate
            kind="client"
            defaultEmoji="🏢"
            onSubmit={(d) => {
              onCreateClient?.(d);
              setCreating(null);
            }}
            onCancel={() => setCreating(null)}
          />
        )}

        {!creating && (
          <button
            onClick={() => setCreating({ kind: "client" })}
            style={{
              width: "calc(100% - 8px)",
              margin: "6px 4px 0",
              padding: "4px 8px",
              borderRadius: 4,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "var(--fg-faint)",
              fontSize: 12,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-muted)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-faint)";
            }}
          >
            <Icon name="plus" size={11} />
            <span>New client</span>
          </button>
        )}
      </div>

      <div
        style={{
          borderTop: "1px solid var(--border-subtle)",
          padding: "10px 14px",
          fontSize: 11,
          color: "var(--fg-faint)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            background: health.ok ? "var(--positive)" : "var(--negative)",
            boxShadow: `0 0 0 3px ${health.ok ? "var(--positive-soft)" : "var(--negative-soft)"}`,
          }}
        ></span>
        <span>{health.label}</span>
        {health.version && (
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-ghost)" }}>
            {health.version}
          </span>
        )}
      </div>
    </aside>
  );
};
