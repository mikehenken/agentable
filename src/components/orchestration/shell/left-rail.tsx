import * as React from "react";
import { Icon, useResizableSidebar } from "../../general";
import type { Workspace, Project } from "../types";

const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 520;
const COLLAPSED_WIDTH = 36;

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

/**
 * Hover-revealed refresh button. Sits in the same row affordance slot
 * as `InlinePlus` — same visual weight, same opacity-on-hover pattern,
 * so the discovery model matches and we don't introduce competing
 * affordances. Spins while `busy` is true to acknowledge the click.
 */
const InlineRefresh: React.FC<{ onClick: () => void; title: string; visible: boolean; busy?: boolean }> = ({
  onClick,
  title,
  visible,
  busy = false,
}) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      if (!busy) onClick();
    }}
    title={busy ? "Refreshing…" : title}
    style={{
      width: 18,
      height: 18,
      borderRadius: 3,
      display: "grid",
      placeItems: "center",
      color: busy ? "var(--accent)" : "var(--fg-faint)",
      cursor: busy ? "default" : "pointer",
      flexShrink: 0,
      opacity: visible || busy ? 1 : 0,
      transition: "opacity .12s, background .12s",
    }}
    onMouseEnter={(e) => {
      if (!busy) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-active)";
    }}
    onMouseLeave={(e) => {
      if (!busy) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
    }}
  >
    <span
      style={{
        display: "inline-grid",
        placeItems: "center",
        animation: busy ? "orchSpin .9s linear infinite" : undefined,
      }}
    >
      <Icon name="refresh" size={10} />
    </span>
  </button>
);

export interface LeftRailProps {
  workspaces: Workspace[];
  activeRunId: string | null;
  setActiveRunId: (id: string) => void;
  /**
   * Currently-selected workspace, if any. Drives the highlighted row
   * and lets the host show a workspace overview in the center pane
   * when no run is selected.
   */
  activeWorkspaceId?: string | null;
  /** Same as `activeWorkspaceId` for projects. */
  activeProjectId?: string | null;
  /**
   * Called when the user clicks a workspace row. Receives the new
   * selection (or null to clear). Hosts that don't need workspace-
   * level selection can omit this — the row will still expand/collapse.
   */
  onSelectWorkspace?: (workspaceId: string | null) => void;
  /** Same as `onSelectWorkspace` for projects. */
  onSelectProject?: (workspaceId: string, projectId: string | null) => void;
  onNewRun?: (workspace: Workspace, project: Project) => void;
  onCreateClient?: (value: InlineCreateValue) => void;
  onCreateProject?: (workspaceId: string, value: InlineCreateValue) => void;
  /**
   * Refresh handlers for each scope. Each is wrapped to spin its own
   * inline icon while resolving so the user sees acknowledgement of
   * the click. All optional — when omitted, the icon is hidden.
   */
  onRefreshTree?: () => Promise<void> | void;
  onRefreshWorkspace?: (workspaceId: string) => Promise<void> | void;
  onRefreshProject?: (workspaceId: string, projectId: string) => Promise<void> | void;
  onRefreshRun?: (runId: string) => Promise<void> | void;
  /**
   * CRUD handlers — when wired, a kebab menu appears on hover next to
   * the inline plus / refresh icons. Optional; rows with no handlers
   * keep the read-only chrome they had before.
   */
  onRenameWorkspace?: (workspaceId: string, current: string) => void;
  onArchiveWorkspace?: (workspaceId: string) => Promise<void> | void;
  onDeleteWorkspace?: (workspaceId: string) => Promise<void> | void;
  onRenameProject?: (workspaceId: string, projectId: string, current: string) => void;
  onArchiveProject?: (workspaceId: string, projectId: string) => Promise<void> | void;
  onDeleteProject?: (workspaceId: string, projectId: string) => Promise<void> | void;
  /** Knowledge-base modal opener — surfaces a tool button in the rail header. */
  onOpenKnowledge?: () => void;
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

/**
 * Hover-revealed three-dot kebab + dropdown menu used on workspace
 * and project rows for rename/archive/delete. Closes on any outside
 * click via the menuKey state in the parent.
 */
const KebabMenu: React.FC<{
  visible: boolean;
  open: boolean;
  onToggle: () => void;
  items: { label: string; onClick: () => void; danger?: boolean }[];
}> = ({ visible, open, onToggle, items }) => (
  <span style={{ position: "relative", flexShrink: 0 }}>
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      title="Actions"
      aria-label="Actions"
      style={{
        width: 18,
        height: 18,
        borderRadius: 3,
        background: open ? "var(--bg-active)" : "transparent",
        border: 0,
        cursor: "pointer",
        color: "var(--fg-faint)",
        display: "grid",
        placeItems: "center",
        opacity: visible || open ? 1 : 0,
        transition: "opacity .12s, background .12s",
        fontSize: 14,
        lineHeight: 0.5,
        padding: 0,
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-active)")}
      onMouseLeave={(e) => {
        if (!open) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      ⋯
    </button>
    {open && (
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 22,
          right: 0,
          minWidth: 160,
          background: "var(--bg-panel)",
          border: "1px solid var(--border-base)",
          borderRadius: 6,
          boxShadow: "0 8px 24px rgba(0,0,0,.18)",
          padding: "4px 0",
          zIndex: 20,
        }}
      >
        {items.map((it, i) => (
          <button
            key={i}
            onClick={() => {
              it.onClick();
              onToggle();
            }}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "5px 10px",
              fontSize: 12,
              color: it.danger ? "var(--negative-fg)" : "var(--fg-base)",
              background: "transparent",
              border: 0,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
          >
            {it.label}
          </button>
        ))}
      </div>
    )}
  </span>
);

/** Notion-style page tree of Workspace → Project → Run. */
export const LeftRail: React.FC<LeftRailProps> = ({
  workspaces,
  activeRunId,
  setActiveRunId,
  activeWorkspaceId = null,
  activeProjectId = null,
  onSelectWorkspace,
  onSelectProject,
  onNewRun,
  onCreateClient,
  onCreateProject,
  onRefreshTree,
  onRefreshWorkspace,
  onRefreshProject,
  onRefreshRun,
  onRenameWorkspace,
  onArchiveWorkspace,
  onDeleteWorkspace,
  onRenameProject,
  onArchiveProject,
  onDeleteProject,
  onOpenKnowledge,
  health = { ok: true, label: "Orchestrator healthy", version: "v0.4.2" },
  loading = false,
}) => {
  // Single open-context-menu key — only one can be open at a time.
  const [menuKey, setMenuKey] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!menuKey) return;
    const close = () => setMenuKey(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuKey]);
  // Resize + collapse. Persisted under `agentable-orch:leftrail` so the
  // user's preferred width survives reloads.
  const sidebar = useResizableSidebar({
    side: "left",
    defaultWidth: DEFAULT_WIDTH,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    collapsedWidth: COLLAPSED_WIDTH,
    storageKey: "agentable-orch:leftrail",
  });
  // Track which row's refresh is currently in flight so its icon spins.
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const runRefresh = React.useCallback(
    async (key: string, fn: () => Promise<void> | void) => {
      setBusyKey(key);
      try {
        await fn();
      } finally {
        setBusyKey(null);
      }
    },
    [],
  );
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

  // Collapsed state: show a thin vertical strip with the section
  // glyph + an outward chevron. Click anywhere on the strip expands —
  // generous Fitts's-law target so the user doesn't have to land on a
  // tiny icon. The strip preserves the same right-border so the
  // chrome continues to read as a panel boundary.
  if (sidebar.collapsed) {
    return (
      <aside
        style={{
          width: sidebar.width,
          flexShrink: 0,
          background: "var(--bg-app)",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "8px 0",
          position: "relative",
        }}
      >
        <button
          onClick={sidebar.toggleCollapse}
          title="Expand workspace sidebar"
          aria-label="Expand workspace sidebar"
          style={{
            width: 28,
            height: 28,
            borderRadius: 5,
            display: "grid",
            placeItems: "center",
            color: "var(--fg-muted)",
            cursor: "pointer",
            background: "transparent",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
        >
          <Icon name="chright" size={14} />
        </button>
        <button
          onClick={sidebar.toggleCollapse}
          title="Expand workspace sidebar"
          aria-label="Workspaces (collapsed) — click to expand"
          style={{
            marginTop: 6,
            flex: 1,
            width: "100%",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            color: "var(--fg-faint)",
            background: "transparent",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
        >
          <Icon name="layers" size={14} />
        </button>
        {/* Health dot pinned at the bottom — keeps the connection
            indicator readable even in the collapsed state. */}
        <span
          title={health.label}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            background: health.ok ? "var(--positive)" : "var(--negative)",
            boxShadow: `0 0 0 3px ${health.ok ? "var(--positive-soft)" : "var(--negative-soft)"}`,
            marginBottom: 8,
          }}
        />
      </aside>
    );
  }

  return (
    <aside
      style={{
        width: sidebar.width,
        flexShrink: 0,
        background: "var(--bg-app)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <style>{`@keyframes orchSpin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ padding: "12px 12px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
        <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--fg-faint)" }}>Workspace</span>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {onOpenKnowledge && (
            <button
              onClick={onOpenKnowledge}
              title="Knowledge base"
              aria-label="Open knowledge base"
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                display: "grid",
                placeItems: "center",
                color: "var(--fg-faint)",
                cursor: "pointer",
                background: "transparent",
                border: 0,
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
            >
              <Icon name="layers" size={11} />
            </button>
          )}
          {onRefreshTree && (
            <button
              onClick={() => runRefresh("__tree__", onRefreshTree)}
              title={busyKey === "__tree__" ? "Refreshing workspaces…" : "Refresh workspaces"}
              disabled={busyKey === "__tree__"}
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                display: "grid",
                placeItems: "center",
                color: busyKey === "__tree__" ? "var(--accent)" : "var(--fg-faint)",
                cursor: busyKey === "__tree__" ? "default" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (busyKey !== "__tree__")
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                if (busyKey !== "__tree__")
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              <span
                style={{
                  display: "inline-grid",
                  placeItems: "center",
                  animation: busyKey === "__tree__" ? "orchSpin .9s linear infinite" : undefined,
                }}
              >
                <Icon name="refresh" size={11} />
              </span>
            </button>
          )}
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
          <button
            onClick={sidebar.toggleCollapse}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
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
            <Icon name="chevron" size={12} style={{ transform: "rotate(90deg)" }} />
          </button>
        </div>
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
          const wsActive = activeWorkspaceId === c.id;
          return (
            <div key={c.id} style={{ marginBottom: 1 }}>
              <div
                onMouseEnter={() => setHoverKey(`c:${c.id}`)}
                onMouseLeave={() => setHoverKey(null)}
                onClick={() => {
                  // Always toggle open state. If host wired selection,
                  // also flip active workspace: clicking the active row
                  // clears the selection (matching the run-row pattern).
                  setOpenClients((s) => ({ ...s, [c.id]: !s[c.id] }));
                  if (onSelectWorkspace) {
                    onSelectWorkspace(activeWorkspaceId === c.id ? null : c.id);
                  }
                }}
                style={{
                  padding: "4px 8px",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  background: wsActive ? "var(--bg-active)" : hover ? "var(--bg-hover)" : "transparent",
                  position: "relative",
                }}
              >
                {wsActive && (
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 4,
                      bottom: 4,
                      width: 2,
                      borderRadius: 2,
                      background: "var(--fg-base)",
                    }}
                  />
                )}
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
                {onRefreshWorkspace && (
                  <InlineRefresh
                    visible={hover}
                    busy={busyKey === `ws:${c.id}`}
                    title="Refresh workspace"
                    onClick={() => runRefresh(`ws:${c.id}`, () => onRefreshWorkspace(c.id))}
                  />
                )}
                <InlinePlus
                  visible={hover}
                  title="New project"
                  onClick={() => {
                    setOpenClients((s) => ({ ...s, [c.id]: true }));
                    setCreating({ kind: "project", clientId: c.id });
                  }}
                />
                {(onRenameWorkspace || onArchiveWorkspace || onDeleteWorkspace) && (
                  <KebabMenu
                    visible={hover}
                    open={menuKey === `ws-menu:${c.id}`}
                    onToggle={() => setMenuKey(menuKey === `ws-menu:${c.id}` ? null : `ws-menu:${c.id}`)}
                    items={[
                      ...(onRenameWorkspace
                        ? [{ label: "Rename…", onClick: () => onRenameWorkspace(c.id, c.name) }]
                        : []),
                      ...(onArchiveWorkspace
                        ? [{ label: "Archive", onClick: () => void onArchiveWorkspace(c.id) }]
                        : []),
                      ...(onDeleteWorkspace
                        ? [{ label: "Delete", onClick: () => { if (confirm(`Delete workspace "${c.name}"? This cannot be undone.`)) void onDeleteWorkspace(c.id); }, danger: true }]
                        : []),
                    ]}
                  />
                )}
              </div>

              {open &&
                c.projects.map((p) => {
                  const pkey = `${c.id}/${p.id}`;
                  const popen = !!openProjects[pkey];
                  const phover = hoverKey === `p:${pkey}`;
                  const projActive = activeProjectId === p.id && activeWorkspaceId === c.id;
                  return (
                    <div key={p.id}>
                      <div
                        onMouseEnter={() => setHoverKey(`p:${pkey}`)}
                        onMouseLeave={() => setHoverKey(null)}
                        onClick={() => {
                          setOpenProjects((s) => ({ ...s, [pkey]: !s[pkey] }));
                          if (onSelectProject) {
                            onSelectProject(c.id, projActive ? null : p.id);
                          }
                        }}
                        style={{
                          padding: "3px 8px 3px 26px",
                          borderRadius: 4,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          cursor: "pointer",
                          background: projActive ? "var(--bg-active)" : phover ? "var(--bg-hover)" : "transparent",
                          position: "relative",
                        }}
                      >
                        {projActive && (
                          <span
                            style={{
                              position: "absolute",
                              left: 18,
                              top: 4,
                              bottom: 4,
                              width: 2,
                              borderRadius: 2,
                              background: "var(--fg-base)",
                            }}
                          />
                        )}
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
                        {onRefreshProject && (
                          <InlineRefresh
                            visible={phover}
                            busy={busyKey === `proj:${pkey}`}
                            title="Refresh project"
                            onClick={() => runRefresh(`proj:${pkey}`, () => onRefreshProject(c.id, p.id))}
                          />
                        )}
                        <InlinePlus
                          visible={phover}
                          title="New run"
                          onClick={() => {
                            setOpenProjects((s) => ({ ...s, [pkey]: true }));
                            onNewRun?.(c, p);
                          }}
                        />
                        {(onRenameProject || onArchiveProject || onDeleteProject) && (
                          <KebabMenu
                            visible={phover}
                            open={menuKey === `proj-menu:${pkey}`}
                            onToggle={() => setMenuKey(menuKey === `proj-menu:${pkey}` ? null : `proj-menu:${pkey}`)}
                            items={[
                              ...(onRenameProject
                                ? [{ label: "Rename…", onClick: () => onRenameProject(c.id, p.id, p.name) }]
                                : []),
                              ...(onArchiveProject
                                ? [{ label: "Archive", onClick: () => void onArchiveProject(c.id, p.id) }]
                                : []),
                              ...(onDeleteProject
                                ? [{ label: "Delete", onClick: () => { if (confirm(`Delete project "${p.name}"? This cannot be undone.`)) void onDeleteProject(c.id, p.id); }, danger: true }]
                                : []),
                            ]}
                          />
                        )}
                      </div>

                      {popen &&
                        p.runs.map((r) => {
                          const active = r.id === activeRunId;
                          const rkey = `${pkey}/${r.id}`;
                          const rhover = hoverKey === `r:${rkey}`;
                          const refreshBusy = busyKey === `run:${r.id}`;
                          return (
                            <button
                              key={r.id}
                              onClick={() => setActiveRunId(r.id)}
                              onMouseEnter={(e) => {
                                if (!active) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
                                setHoverKey(`r:${rkey}`);
                              }}
                              onMouseLeave={(e) => {
                                if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                                setHoverKey(null);
                              }}
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
                              {onRefreshRun && (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!refreshBusy) runRefresh(`run:${r.id}`, () => onRefreshRun(r.id));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (!refreshBusy) runRefresh(`run:${r.id}`, () => onRefreshRun(r.id));
                                    }
                                  }}
                                  title={refreshBusy ? "Refreshing run…" : "Refresh run"}
                                  aria-label="Refresh run"
                                  style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: 3,
                                    display: "grid",
                                    placeItems: "center",
                                    color: refreshBusy ? "var(--accent)" : "var(--fg-faint)",
                                    cursor: refreshBusy ? "default" : "pointer",
                                    flexShrink: 0,
                                    opacity: rhover || refreshBusy ? 1 : 0,
                                    transition: "opacity .12s, background .12s",
                                  }}
                                >
                                  <span
                                    style={{
                                      display: "inline-grid",
                                      placeItems: "center",
                                      animation: refreshBusy ? "orchSpin .9s linear infinite" : undefined,
                                    }}
                                  >
                                    <Icon name="refresh" size={9} />
                                  </span>
                                </span>
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

      {/* Resize handle — 5px hit strip on the right edge. Invisible at
          rest; flashes a 1px accent line on hover/drag so the
          affordance is discoverable without adding chrome. */}
      <div
        {...sidebar.handleProps}
        style={{
          position: "absolute",
          top: 0,
          right: -2,
          bottom: 0,
          width: 5,
          cursor: "col-resize",
          zIndex: 10,
          background: "transparent",
          touchAction: "none",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "inset -1px 0 0 0 var(--accent)";
        }}
        onMouseLeave={(e) => {
          if (!sidebar.dragging)
            (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        }}
      />
    </aside>
  );
};
