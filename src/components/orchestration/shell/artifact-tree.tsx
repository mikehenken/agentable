import * as React from "react";
import { Icon, type IconName } from "../../general";
import type { Artifact, ArtifactKind } from "../types";

/* ── Types ─────────────────────────────────────────────────────────── */

interface TreeNode {
  /** Segment name used as label (e.g. "iter-1", "agent-output.md"). */
  label: string;
  /** If this is a leaf, the artifact it points to. */
  artifact?: Artifact;
  /** Child directories / files keyed by segment name. */
  children: Map<string, TreeNode>;
  /** Depth from root (0-based). */
  depth: number;
}

export interface ArtifactTreeProps {
  artifacts: Artifact[];
  activeId: string;
  setActiveId: (id: string) => void;
  /** Run ID used to strip the `runs/{runId}/` prefix from keys. */
  runId?: string;
}

/* ── Helpers ───────────────────────────────────────────────────────── */

const KIND_ICON: Record<ArtifactKind, IconName> = {
  markdown: "doc",
  yaml: "yaml",
  "yaml-cite": "yaml",
  gap: "spark",
  tldraw: "board",
  source: "artifact",
};

/** Map top-level directory names to icons. */
const DIR_ICON: Record<string, IconName> = {
  inputs: "artifact",
  iterations: "layers",
  outputs: "doc",
  logs: "logs",
  journal: "list",
};

function iconForFile(a: Artifact): IconName {
  return KIND_ICON[a.kind] ?? "doc";
}

function iconForDir(name: string): IconName {
  return DIR_ICON[name] ?? "chright";
}

/** Humanize a directory segment: "02-client-intent-analysis" → "Client Intent Analysis" */
function humanizeSegment(seg: string): string {
  // "iter-1" → "Iteration 1"
  const iterMatch = seg.match(/^iter-(\d+)$/);
  if (iterMatch) return `Iteration ${iterMatch[1]}`;
  // Strip leading number prefix ("02-foo-bar" → "foo-bar")
  const stripped = seg.replace(/^\d+(\.\d+)?-/, "");
  // Title-case hyphenated words
  return stripped.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Strip `runs/{runId}/` prefix from a key. */
function stripRunPrefix(key: string, runId?: string): string {
  if (runId) {
    const prefix = `runs/${runId}/`;
    if (key.startsWith(prefix)) return key.slice(prefix.length);
  }
  // Generic fallback
  return key.replace(/^runs\/[^/]+\//, "");
}

/** Build a tree from a flat artifact list. */
function buildTree(artifacts: Artifact[], runId?: string): TreeNode {
  const root: TreeNode = { label: "", children: new Map(), depth: -1 };

  for (const a of artifacts) {
    const path = a.key ? stripRunPrefix(a.key, runId) : a.name;
    const segments = path.split("/").filter(Boolean);

    let node = root;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (!node.children.has(seg)) {
        node.children.set(seg, {
          label: seg,
          children: new Map(),
          depth: i,
        });
      }
      node = node.children.get(seg)!;
    }
    // Leaf
    node.artifact = a;
  }

  return root;
}

/** Count all leaf artifacts under a node. */
function countLeaves(node: TreeNode): number {
  if (node.artifact && node.children.size === 0) return 1;
  let n = node.artifact ? 1 : 0;
  for (const child of node.children.values()) n += countLeaves(child);
  return n;
}

/* ── Components ────────────────────────────────────────────────────── */

const FileRow: React.FC<{
  artifact: Artifact;
  label: string;
  depth: number;
  active: boolean;
  onClick: () => void;
}> = ({ artifact, label, depth, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      width: "100%",
      padding: `3px 10px 3px ${12 + depth * 16}px`,
      background: active ? "var(--bg-sunken)" : "transparent",
      color: active ? "var(--fg-strong)" : "var(--fg-default)",
      border: "none",
      cursor: "pointer",
      fontSize: 12,
      fontFamily: "var(--font-mono)",
      textAlign: "left",
      borderRadius: 0,
      borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
      lineHeight: "22px",
      minHeight: 24,
    }}
    onMouseEnter={(e) => {
      if (!active) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
    }}
    onMouseLeave={(e) => {
      if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
    }}
  >
    <Icon
      name={iconForFile(artifact)}
      size={12}
      style={{ color: active ? "var(--accent)" : "var(--fg-faint)", flexShrink: 0 }}
    />
    <span
      style={{
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
    {artifact.size && (
      <span
        style={{
          marginLeft: "auto",
          fontSize: 10,
          color: "var(--fg-ghost)",
          flexShrink: 0,
        }}
      >
        {artifact.size}
      </span>
    )}
  </button>
);

const DirRow: React.FC<{
  label: string;
  depth: number;
  open: boolean;
  count: number;
  onToggle: () => void;
}> = ({ label, depth, open, count, onToggle }) => (
  <button
    onClick={onToggle}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      width: "100%",
      padding: `3px 10px 3px ${12 + depth * 16}px`,
      background: "transparent",
      color: "var(--fg-muted)",
      border: "none",
      cursor: "pointer",
      fontSize: 11.5,
      fontFamily: "var(--font-mono)",
      textAlign: "left",
      borderRadius: 0,
      lineHeight: "22px",
      minHeight: 24,
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
    }}
  >
    <Icon
      name={open ? "chdown" : "chright"}
      size={10}
      style={{ color: "var(--fg-faint)", flexShrink: 0 }}
    />
    <Icon
      name={iconForDir(label)}
      size={12}
      style={{ color: "var(--fg-faint)", flexShrink: 0 }}
    />
    <span style={{ fontWeight: 500 }}>{humanizeSegment(label)}</span>
    <span
      style={{
        marginLeft: "auto",
        fontSize: 10,
        color: "var(--fg-ghost)",
        fontWeight: 400,
        flexShrink: 0,
      }}
    >
      {count}
    </span>
  </button>
);

/** A single collapsible directory node — owns its own open/close state. */
const DirNode: React.FC<{
  node: TreeNode;
  activeId: string;
  setActiveId: (id: string) => void;
  defaultOpen: boolean;
}> = ({ node, activeId, setActiveId, defaultOpen }) => {
  const [open, setOpen] = React.useState(defaultOpen);
  const count = countLeaves(node);

  return (
    <>
      <DirRow
        label={node.label}
        depth={node.depth}
        open={open}
        count={count}
        onToggle={() => setOpen((o) => !o)}
      />
      {open && (
        <NodeChildren
          node={node}
          activeId={activeId}
          setActiveId={setActiveId}
        />
      )}
    </>
  );
};

/** Render sorted children of a tree node (dirs first, then files). */
const NodeChildren: React.FC<{
  node: TreeNode;
  activeId: string;
  setActiveId: (id: string) => void;
}> = ({ node, activeId, setActiveId }) => {
  const entries = Array.from(node.children.entries());

  // Sort: directories first (have children), then files, both alphabetically.
  entries.sort(([aKey, aNode], [bKey, bNode]) => {
    const aIsDir = aNode.children.size > 0;
    const bIsDir = bNode.children.size > 0;
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
    return aKey.localeCompare(bKey);
  });

  return (
    <>
      {entries.map(([key, child]) => {
        const isLeaf = child.children.size === 0 && child.artifact;
        if (isLeaf) {
          return (
            <FileRow
              key={key}
              artifact={child.artifact!}
              label={child.label}
              depth={child.depth}
              active={child.artifact!.id === activeId}
              onClick={() => setActiveId(child.artifact!.id)}
            />
          );
        }

        // Directory node — each gets its own DirNode with independent state.
        return (
          <DirNode
            key={key}
            node={child}
            activeId={activeId}
            setActiveId={setActiveId}
            defaultOpen={child.depth < 2}
          />
        );
      })}
    </>
  );
};

/* ── Main Export ────────────────────────────────────────────────────── */

export const ArtifactTree: React.FC<ArtifactTreeProps> = ({
  artifacts,
  activeId,
  setActiveId,
  runId,
}) => {
  const tree = React.useMemo(() => buildTree(artifacts, runId), [artifacts, runId]);

  // If there are no artifacts, show empty state.
  if (artifacts.length === 0) {
    return (
      <div
        style={{
          padding: "32px 16px",
          textAlign: "center",
          color: "var(--fg-faint)",
          fontSize: 12,
        }}
      >
        No artifacts yet.
      </div>
    );
  }

  // If all artifacts are flat (no slashes in keys → all at root),
  // render them directly without directory nesting.
  const allFlat = artifacts.every((a) => {
    const path = a.key ? stripRunPrefix(a.key, runId) : a.name;
    return !path.includes("/");
  });

  if (allFlat) {
    return (
      <div
        style={{
          height: "100%",
          overflow: "auto",
          background: "var(--bg-app)",
          paddingTop: 4,
          paddingBottom: 4,
        }}
      >
        {artifacts.map((a) => (
          <FileRow
            key={a.id}
            artifact={a}
            label={a.name}
            depth={0}
            active={a.id === activeId}
            onClick={() => setActiveId(a.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        overflow: "auto",
        background: "var(--bg-app)",
        paddingTop: 4,
        paddingBottom: 4,
      }}
    >
      <div
        style={{
          padding: "4px 12px 6px",
          fontSize: 10,
          fontFamily: "var(--font-mono)",
          color: "var(--fg-ghost)",
          textTransform: "uppercase",
          letterSpacing: ".06em",
        }}
      >
        {artifacts.length} artifact{artifacts.length === 1 ? "" : "s"}
      </div>
      <NodeChildren
        node={tree}
        activeId={activeId}
        setActiveId={setActiveId}
      />
    </div>
  );
};
