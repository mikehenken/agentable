import * as React from "react";
import type { Board, BoardNode, BoardPhase, BoardBay, EdgeOpts, PhaseStatus } from "../types";

const STATUS_COLORS: Record<PhaseStatus, { bar: string; bg: string; label: string; emoji: string }> = {
  completed:     { bar: "var(--positive)",  bg: "color-mix(in oklab, var(--positive) 6%, transparent)", label: "Complete",  emoji: "✓" },
  running:       { bar: "var(--accent)",    bg: "color-mix(in oklab, var(--accent) 6%, transparent)",   label: "Running",   emoji: "●" },
  failed:        { bar: "var(--negative)",  bg: "color-mix(in oklab, var(--negative) 6%, transparent)", label: "Failed",    emoji: "✗" },
  awaiting_hitm: { bar: "var(--warn)",      bg: "color-mix(in oklab, var(--warn) 6%, transparent)",     label: "Awaiting",  emoji: "⏸" },
  paused:        { bar: "var(--warn)",      bg: "color-mix(in oklab, var(--warn) 4%, transparent)",     label: "Paused",    emoji: "⏸" },
  cancelled:     { bar: "var(--fg-faint)",  bg: "transparent",                                          label: "Cancelled", emoji: "—" },
  not_started:   { bar: "var(--fg-ghost)",  bg: "transparent",                                          label: "Pending",   emoji: "○" },
  pending:       { bar: "var(--fg-ghost)",  bg: "transparent",                                          label: "Pending",   emoji: "○" },
};

const EMOJI: Record<string, string> = {
  trigger: "▶️",
  step: "⚙️",
  "step-llm": "✨",
  store: "📦",
  fan: "🌿",
  "loop-head": "🔁",
  decision: "❓",
  wait: "⏸️",
  human: "👤",
  emit: "📤",
  downstream: "↗️",
  "artifact-card": "📄",
  stub: "•",
};

const PHASE_TONE: Record<
  BoardPhase["tone"],
  { bg: string; fg: string; bar: string }
> = {
  neutral: { bg: "transparent", fg: "var(--fg-faint)", bar: "var(--border-subtle)" },
  info: {
    bg: "color-mix(in oklab, var(--info) 5%, transparent)",
    fg: "var(--info-fg)",
    bar: "var(--info)",
  },
  accent: {
    bg: "color-mix(in oklab, var(--accent) 4%, transparent)",
    fg: "var(--accent-fg)",
    bar: "var(--accent)",
  },
  warn: {
    bg: "color-mix(in oklab, var(--warn) 6%, transparent)",
    fg: "var(--warn-fg)",
    bar: "var(--warn)",
  },
  positive: {
    bg: "color-mix(in oklab, var(--positive) 5%, transparent)",
    fg: "var(--positive-fg)",
    bar: "var(--positive)",
  },
};

function nodePort(node: BoardNode, side: string) {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  if (side === "right") return { x: node.x + node.w, y: cy };
  if (side === "left") return { x: node.x, y: cy };
  if (side === "top") return { x: cx, y: node.y };
  if (side === "bottom") return { x: cx, y: node.y + node.h };
  return { x: cx, y: cy };
}

function bestPorts(a: BoardNode, b: BoardNode): [string, string] {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2);
  const dy = b.y + b.h / 2 - (a.y + a.h / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ["right", "left"] : ["left", "right"];
  return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
}

function edgePath(a: BoardNode, b: BoardNode, opts: EdgeOpts = {}) {
  const [pa, pb] = bestPorts(a, b);
  const p1 = nodePort(a, pa);
  const p2 = nodePort(b, pb);
  if (opts.curve === "back") {
    const midY = Math.max(a.y + a.h, b.y + b.h) + 80;
    return `M ${p1.x} ${p1.y} C ${p1.x + 60} ${midY}, ${p2.x - 60} ${midY}, ${p2.x} ${p2.y}`;
  }
  if (pa === "right" || pa === "left") {
    const cp = Math.max(40, Math.abs(p2.x - p1.x) * 0.4);
    return `M ${p1.x} ${p1.y} C ${p1.x + (pa === "right" ? cp : -cp)} ${p1.y}, ${
      p2.x + (pb === "left" ? -cp : cp)
    } ${p2.y}, ${p2.x} ${p2.y}`;
  }
  const cp = Math.max(30, Math.abs(p2.y - p1.y) * 0.4);
  return `M ${p1.x} ${p1.y} C ${p1.x} ${p1.y + (pa === "bottom" ? cp : -cp)}, ${p2.x} ${
    p2.y + (pb === "top" ? -cp : cp)
  }, ${p2.x} ${p2.y}`;
}

interface NodeProps {
  node: BoardNode;
  isHover: boolean;
  isActive: boolean;
  onClick: () => void;
  onHover: (id: string | null) => void;
}

const Node: React.FC<NodeProps> = ({ node, isHover, isActive, onClick, onHover }) => {
  const isCard = node.kind === "artifact-card";
  const clickable = !!node.artifact || !!node.link;
  const sc = node.status ? STATUS_COLORS[node.status] : null;
  const ringTone = sc
    ? sc.bar
    : node.kind === "decision" || node.kind === "wait" || node.kind === "human"
      ? "var(--warn)"
      : node.kind === "emit" || node.kind === "downstream"
        ? "var(--positive)"
        : node.kind === "step-llm" || node.kind === "trigger"
          ? "var(--accent)"
          : "var(--border-base)";

  return (
    <div
      onClick={clickable ? onClick : undefined}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        position: "absolute",
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.h,
        background: sc ? sc.bg : "var(--bg-panel)",
        border: `1px solid ${isActive ? "var(--accent)" : "var(--border-subtle)"}`,
        borderRadius: isCard ? 6 : 8,
        padding: isCard ? "8px 10px" : "10px 12px",
        boxShadow: isActive
          ? "0 0 0 3px color-mix(in oklab, var(--accent) 18%, transparent)"
          : isHover && clickable
            ? "0 4px 12px rgba(15,15,15,.05)"
            : "none",
        cursor: clickable ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 2,
        transition: "box-shadow .15s, border-color .15s, transform .15s",
        transform: isHover && clickable ? "translateY(-1px)" : "none",
        userSelect: "none",
      }}
    >
      {!isCard && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 8,
            bottom: 8,
            width: 2,
            borderRadius: 2,
            background: ringTone,
            opacity: 0.55,
          }}
        ></div>
      )}
      {!isCard && (
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0, filter: "saturate(0.85)" }}>
            {EMOJI[node.kind] || "•"}
          </span>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--fg-strong)",
              letterSpacing: "-0.005em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {node.title}
          </span>
          {node.artifact && (
            <span
              title="opens artifact viewer"
              style={{
                fontSize: 9.5,
                color: "var(--accent-fg)",
                fontWeight: 500,
                padding: "1px 6px",
                borderRadius: 10,
                background: "color-mix(in oklab, var(--accent) 10%, transparent)",
                flexShrink: 0,
              }}
            >
              open
            </span>
          )}
          {sc && (
            <span
              title={sc.label}
              style={{
                fontSize: 9.5,
                fontWeight: 500,
                padding: "1px 6px",
                borderRadius: 10,
                color: sc.bar,
                background: sc.bg,
                flexShrink: 0,
                fontFamily: "var(--font-mono)",
                letterSpacing: ".02em",
              }}
            >
              {sc.emoji} {sc.label}
            </span>
          )}
        </div>
      )}
      {isCard && (
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 12, flexShrink: 0 }}>📄</span>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 12.5,
              color: clickable ? "var(--fg-strong)" : "var(--fg-base)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {node.title}
          </span>
          {clickable && <span style={{ fontSize: 11, color: "var(--fg-ghost)" }}>↗</span>}
        </div>
      )}
      {node.sub && !isCard && (
        <div
          style={{
            fontSize: 11.5,
            color: "var(--fg-muted)",
            paddingLeft: 21,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {node.sub}
        </div>
      )}
      {node.sub && isCard && (
        <div
          style={{
            fontSize: 11,
            color: "var(--fg-faint)",
            paddingLeft: 19,
            marginTop: -1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {node.sub}
        </div>
      )}
      {node.detail && !isCard && node.h >= 70 && (
        <div
          style={{
            fontSize: 10.5,
            color: "var(--fg-faint)",
            fontStyle: "italic",
            paddingLeft: 21,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {node.detail}
        </div>
      )}
    </div>
  );
};

const Edge: React.FC<{ a: BoardNode; b: BoardNode; opts: EdgeOpts; hover: boolean }> = ({ a, b, opts, hover }) => {
  const path = edgePath(a, b, opts);
  const tone = opts.tone || "neutral";
  const stroke =
    tone === "warn"
      ? "var(--warn)"
      : tone === "positive"
        ? "var(--positive)"
        : opts.thin
          ? "var(--border-base)"
          : "var(--border-strong)";
  const widthBase = opts.thin ? 1 : 1.4;
  const width = hover ? widthBase + 0.5 : widthBase;
  const dash = opts.dashed ? "3 3" : "none";
  const opacity = opts.thin ? 0.5 : 0.85;
  return (
    <g style={{ pointerEvents: "none" }}>
      <path
        d={path}
        stroke={stroke}
        strokeWidth={width}
        fill="none"
        strokeDasharray={dash}
        opacity={opacity}
        markerEnd={opts.thin ? undefined : `url(#arrow-${tone})`}
      />
      {opts.label &&
        (() => {
          const m = path.match(/M ([\d.\-]+) ([\d.\-]+) C [\d.\-]+ [\d.\-]+, [\d.\-]+ [\d.\-]+, ([\d.\-]+) ([\d.\-]+)/);
          if (!m) return null;
          const mx = (parseFloat(m[1]) + parseFloat(m[3])) / 2;
          const my = (parseFloat(m[2]) + parseFloat(m[4])) / 2 - 2;
          return (
            <g>
              <rect
                x={mx - 26}
                y={my - 9}
                width="52"
                height="16"
                rx="8"
                fill="var(--bg-panel)"
                stroke={stroke}
                strokeWidth="0.75"
                opacity="0.95"
              />
              <text
                x={mx}
                y={my + 2}
                textAnchor="middle"
                fill={stroke}
                style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 500 }}
              >
                {opts.label}
              </text>
            </g>
          );
        })()}
    </g>
  );
};

const PhaseStrip: React.FC<{ p: BoardPhase }> = ({ p }) => {
  const t = PHASE_TONE[p.tone] || PHASE_TONE.neutral;
  return (
    <div
      style={{
        position: "absolute",
        left: p.x,
        top: p.y,
        width: p.w,
        height: p.h,
        background: t.bg,
        border: `1px solid var(--border-subtle)`,
        borderRadius: 14,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 16,
          fontFamily: "var(--font-sans)",
          fontSize: 11.5,
          color: t.fg,
          fontWeight: 500,
          letterSpacing: "-0.005em",
        }}
      >
        {p.label}
      </div>
    </div>
  );
};

const BayStrip: React.FC<{ b: BoardBay }> = ({ b }) => (
  <div
    style={{
      position: "absolute",
      left: b.x,
      top: b.y,
      width: b.w,
      height: b.h,
      background: "var(--bg-sunken)",
      border: "1px dashed var(--border-subtle)",
      borderRadius: 10,
      pointerEvents: "none",
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 10,
        left: 14,
        fontFamily: "var(--font-sans)",
        fontSize: 11,
        color: "var(--fg-faint)",
        fontWeight: 500,
      }}
    >
      {b.label}
    </div>
  </div>
);

export interface WorkflowGraphProps {
  board: Board;
  focusNodeId?: string | null;
  onOpenArtifact?: (artifactId: string) => void;
  onOpenWorkflow?: (workflowId: string) => void;
  /** Canvas dimensions — defaults to 1620 × 1100 (matches the prototype). */
  canvas?: { w: number; h: number };
}

export const WorkflowGraph: React.FC<WorkflowGraphProps> = ({
  board,
  focusNodeId = null,
  onOpenArtifact,
  onOpenWorkflow,
  canvas = { w: 1620, h: 1100 },
}) => {
  const [view, setView] = React.useState({ z: 1, x: 0, y: 0 });
  const [hover, setHover] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const W = canvas.w;
  const H = canvas.h;

  const fit = React.useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const fitZ = Math.min(rect.width / W, rect.height / H, 1);
    setView({ z: fitZ, x: (rect.width - W * fitZ) / 2, y: (rect.height - H * fitZ) / 2 });
  }, [W, H]);

  React.useEffect(() => {
    fit();
  }, [board, fit]);

  React.useEffect(() => {
    if (!focusNodeId || !containerRef.current) return;
    const n = board.nodes.find((x) => x.id === focusNodeId);
    if (!n) return;
    setHover(focusNodeId);
    const rect = containerRef.current.getBoundingClientRect();
    const z = 0.9;
    const cx = n.x + n.w / 2;
    const cy = n.y + n.h / 2;
    setView({ z, x: rect.width / 2 - cx * z, y: rect.height / 2 - cy * z });
  }, [focusNodeId, board]);

  // Wheel-to-zoom. React (since v17) attaches wheel listeners as PASSIVE
  // at the document root, which makes `preventDefault()` on the
  // synthetic event a silent no-op — the browser then page-zooms on top
  // of our diagram zoom. We work around that by binding a native
  // non-passive listener directly to the container in `useEffect`.
  // Pinch-to-zoom on trackpads also dispatches `wheel` events with
  // `ctrlKey=true`, so the same handler covers both ctrl/cmd-scroll AND
  // trackpad pinch — and both must be intercepted to stop the browser
  // from zooming the page.
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setView((v) => {
        const z2 = Math.max(0.25, Math.min(2.5, v.z * factor));
        const k = z2 / v.z;
        return { z: z2, x: mx - (mx - v.x) * k, y: my - (my - v.y) * k };
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const onMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    dragRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  };
  const onMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setView((v) => ({ ...v, x: dragRef.current!.vx + dx, y: dragRef.current!.vy + dy }));
  };
  const onMouseUp = () => {
    dragRef.current = null;
  };

  const handleClick = (n: BoardNode) => {
    if (n.artifact && onOpenArtifact) onOpenArtifact(n.artifact);
    else if (n.link && onOpenWorkflow) onOpenWorkflow(n.link);
  };

  const nodeById = Object.fromEntries(board.nodes.map((n) => [n.id, n]));

  return (
    <div
      ref={containerRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{
        position: "relative",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        background: "var(--bg-canvas)",
        backgroundImage:
          "radial-gradient(circle, color-mix(in oklab, var(--fg-ghost) 35%, transparent) 0.8px, transparent 0.8px)",
        backgroundSize: `${28 * view.z}px ${28 * view.z}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
        cursor: dragRef.current ? "grabbing" : "grab",
      }}
    >
      <div
        style={{
          position: "absolute",
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
          transformOrigin: "0 0",
          width: W,
          height: H,
        }}
      >
        {board.phases.map((p) => (
          <PhaseStrip key={p.id} p={p} />
        ))}
        {board.bays.map((b) => (
          <BayStrip key={b.id} b={b} />
        ))}

        <svg
          width={W}
          height={H}
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", overflow: "visible" }}
        >
          <defs>
            {(["neutral", "warn", "positive"] as const).map((t) => {
              const c = t === "warn" ? "var(--warn)" : t === "positive" ? "var(--positive)" : "var(--border-strong)";
              return (
                <marker
                  key={t}
                  id={`arrow-${t}`}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={c} />
                </marker>
              );
            })}
          </defs>
          {board.edges.map(([fromId, toId, opts = {}], i) => {
            const a = nodeById[fromId];
            const b = nodeById[toId];
            if (!a || !b) return null;
            return <Edge key={i} a={a} b={b} opts={opts} hover={hover === fromId || hover === toId} />;
          })}
        </svg>

        {board.nodes.map((n) => (
          <div data-node key={n.id} style={{ position: "absolute", left: 0, top: 0 }}>
            <Node
              node={n}
              isHover={hover === n.id}
              isActive={hover === n.id || focusNodeId === n.id}
              onClick={() => handleClick(n)}
              onHover={setHover}
            />
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 14,
          right: 14,
          display: "flex",
          flexDirection: "column",
          gap: 1,
          background: "var(--bg-panel)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <BoardCtl onClick={() => setView((v) => ({ ...v, z: Math.min(2.5, v.z * 1.2) }))}>+</BoardCtl>
        <BoardCtl onClick={() => setView((v) => ({ ...v, z: Math.max(0.25, v.z / 1.2) }))}>−</BoardCtl>
        <BoardCtl onClick={fit} title="Fit">
          ⊡
        </BoardCtl>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 14,
          left: 14,
          fontSize: 11,
          color: "var(--fg-faint)",
          background: "var(--bg-panel)",
          padding: "5px 10px",
          border: "1px solid var(--border-subtle)",
          borderRadius: 6,
        }}
      >
        {Math.round(view.z * 100)}% · drag · ⌘-scroll to zoom
      </div>
    </div>
  );
};

const BoardCtl: React.FC<{ children: React.ReactNode; onClick: () => void; title?: string }> = ({
  children,
  onClick,
  title,
}) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      width: 28,
      height: 28,
      display: "grid",
      placeItems: "center",
      background: "transparent",
      color: "var(--fg-muted)",
      cursor: "pointer",
      fontSize: 13,
    }}
    onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
  >
    {children}
  </button>
);

export interface OutlineRailProps {
  board: Board;
  focusNodeId: string | null;
  setFocusNodeId: (id: string | null) => void;
  onOpenArtifact?: (artifactId: string) => void;
}

export const OutlineRail: React.FC<OutlineRailProps> = ({ board, focusNodeId, setFocusNodeId, onOpenArtifact }) => {
  const [open, setOpen] = React.useState<Record<string, boolean>>(() => {
    const s: Record<string, boolean> = {};
    board.groups.forEach((g) => (s[g.id] = true));
    return s;
  });
  const nodeById = Object.fromEntries(board.nodes.map((n) => [n.id, n]));

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        background: "var(--bg-app)",
        borderRight: "1px solid var(--border-subtle)",
        overflow: "auto",
        padding: "14px 4px 14px 8px",
      }}
    >
      <div style={{ padding: "0 10px 10px", color: "var(--fg-faint)", fontSize: 11.5, fontWeight: 500 }}>Steps</div>
      {board.groups.map((g) => {
        const isOpen = open[g.id];
        return (
          <div key={g.id} style={{ marginBottom: 4 }}>
            <button
              onClick={() => setOpen((s) => ({ ...s, [g.id]: !s[g.id] }))}
              style={{
                width: "100%",
                padding: "4px 8px",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
            >
              <span style={{ color: "var(--fg-ghost)", fontSize: 9, width: 10, textAlign: "center" }}>
                {isOpen ? "▾" : "▸"}
              </span>
              <span style={{ fontSize: 14 }}>{g.emoji}</span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--fg-strong)",
                  flex: 1,
                  textAlign: "left",
                }}
              >
                {g.label}
              </span>
              <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>{g.nodes.length}</span>
            </button>
            {isOpen &&
              g.nodes.map((nid) => {
                const n = nodeById[nid];
                if (!n) return null;
                const active = focusNodeId === nid;
                return (
                  <button
                    key={nid}
                    onClick={() => setFocusNodeId(nid)}
                    onDoubleClick={() => n.artifact && onOpenArtifact?.(n.artifact)}
                    style={{
                      width: "100%",
                      padding: "3px 8px 3px 26px",
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
                          left: 18,
                          top: 5,
                          bottom: 5,
                          width: 2,
                          background: "var(--fg-base)",
                          borderRadius: 2,
                        }}
                      ></span>
                    )}
                    <span style={{ fontSize: 12, opacity: 0.85, flexShrink: 0 }}>{EMOJI[n.kind] || "•"}</span>
                    <span
                      style={{
                        fontSize: 12.5,
                        color: active ? "var(--fg-strong)" : "var(--fg-base)",
                        flex: 1,
                        textAlign: "left",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {n.title}
                    </span>
                    {n.artifact && <span style={{ fontSize: 10, color: "var(--accent-fg)" }}>↗</span>}
                  </button>
                );
              })}
          </div>
        );
      })}
    </aside>
  );
};
