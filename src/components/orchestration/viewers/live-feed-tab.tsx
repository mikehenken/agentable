import * as React from "react";
import { Icon } from "../../general";

/**
 * A single event in the live feed — normalized from the worker SSE
 * stream by the host app's adapter layer.
 */
export interface FeedEvent {
  /** Monotonic index for React key stability. */
  id: number;
  /** ISO timestamp when the event occurred (or was received). */
  at: string;
  /** Event category — drives the left-edge color and icon. */
  type: "phase" | "llm-call" | "artifact" | "snapshot" | "heartbeat" | "error" | "info";
  /** Short summary line. */
  title: string;
  /** Optional detail body. */
  detail?: string;
  /** Phase / artifact / LLM-call ID for future click-through. */
  refId?: string;
  /** Previous status (phase transitions). */
  prev?: string | null;
}

export interface LiveFeedTabProps {
  events: FeedEvent[];
  connected: boolean;
  /** Whether the run is in a terminal state (complete / failed / cancelled). */
  terminal: boolean;
  /** Called when user clicks a phase event row. */
  onPhaseClick?: (phaseId: string) => void;
  /** Called when user clicks an artifact event row. */
  onArtifactClick?: (artifactKey: string) => void;
}

const TYPE_META: Record<
  FeedEvent["type"],
  { color: string; icon: string; label: string }
> = {
  phase:     { color: "var(--accent)",   icon: "board",    label: "Phase" },
  "llm-call":{ color: "var(--info)",     icon: "logs",     label: "LLM call" },
  artifact:  { color: "var(--positive)", icon: "artifact", label: "Artifact" },
  snapshot:  { color: "var(--fg-muted)", icon: "overview", label: "Snapshot" },
  heartbeat: { color: "var(--fg-ghost)", icon: "play",     label: "Heartbeat" },
  error:     { color: "var(--negative)", icon: "close",    label: "Error" },
  info:      { color: "var(--fg-muted)", icon: "overview", label: "Info" },
};

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const p = (n: number) => n.toString().padStart(2, "0");
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  } catch {
    return iso;
  }
}

export const LiveFeedTab: React.FC<LiveFeedTabProps> = ({
  events,
  connected,
  terminal,
  onPhaseClick,
  onArtifactClick,
}) => {
  const endRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive — but only if the
  // user hasn't scrolled up to review history.
  const [autoScroll, setAutoScroll] = React.useState(true);
  React.useEffect(() => {
    if (autoScroll && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [events.length, autoScroll]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(nearBottom);
  };

  // Filter out heartbeats in the rendered list — they're noise for the user.
  const visible = events.filter((e) => e.type !== "heartbeat");

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-canvas)",
      }}
    >
      {/* Connection status bar */}
      <div
        style={{
          padding: "8px 20px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 11.5,
          color: "var(--fg-faint)",
          flexShrink: 0,
          background: "var(--bg-app)",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: terminal
              ? "var(--fg-faint)"
              : connected
                ? "var(--positive)"
                : "var(--warn)",
            flexShrink: 0,
          }}
        />
        <span>
          {terminal
            ? "Run complete"
            : connected
              ? "Streaming live events"
              : "Connecting..."}
        </span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10.5 }}>
          {visible.length} event{visible.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Event stream */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "12px 0",
        }}
      >
        {visible.length === 0 && (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              color: "var(--fg-faint)",
              fontSize: 13,
            }}
          >
            {connected ? "Waiting for events..." : "Connecting to event stream..."}
          </div>
        )}

        {visible.map((evt) => {
          const meta = TYPE_META[evt.type] ?? TYPE_META.info;
          const clickable =
            (evt.type === "phase" && evt.refId && onPhaseClick) ||
            (evt.type === "artifact" && evt.refId && onArtifactClick);

          return (
            <div
              key={evt.id}
              onClick={() => {
                if (evt.type === "phase" && evt.refId && onPhaseClick) onPhaseClick(evt.refId);
                if (evt.type === "artifact" && evt.refId && onArtifactClick) onArtifactClick(evt.refId);
              }}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "6px 20px",
                cursor: clickable ? "pointer" : "default",
                borderLeft: `2px solid transparent`,
                transition: "background .1s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)";
                (e.currentTarget as HTMLDivElement).style.borderLeftColor = meta.color;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = "transparent";
                (e.currentTarget as HTMLDivElement).style.borderLeftColor = "transparent";
              }}
            >
              {/* Timestamp */}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  color: "var(--fg-ghost)",
                  minWidth: 56,
                  flexShrink: 0,
                  paddingTop: 2,
                  textAlign: "right",
                }}
              >
                {fmtTime(evt.at)}
              </span>

              {/* Icon */}
              <span style={{ flexShrink: 0, paddingTop: 1 }}>
                <Icon name={meta.icon as never} size={12} style={{ color: meta.color }} />
              </span>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9.5,
                      fontWeight: 500,
                      color: meta.color,
                      textTransform: "uppercase",
                      letterSpacing: ".06em",
                      flexShrink: 0,
                    }}
                  >
                    {meta.label}
                  </span>
                  <span
                    style={{
                      fontSize: 12.5,
                      color: "var(--fg-strong)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {evt.title}
                  </span>
                </div>
                {evt.detail && (
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--fg-muted)",
                      marginTop: 2,
                      lineHeight: 1.4,
                    }}
                  >
                    {evt.detail}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Scroll-to-bottom button — appears when user scrolls up */}
      {!autoScroll && visible.length > 10 && (
        <button
          onClick={() => {
            setAutoScroll(true);
            endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
          }}
          style={{
            position: "absolute",
            bottom: 16,
            right: 24,
            padding: "6px 12px",
            borderRadius: 16,
            fontSize: 11,
            fontWeight: 500,
            color: "var(--fg-strong)",
            background: "var(--bg-panel)",
            border: "1px solid var(--border-base)",
            boxShadow: "0 4px 12px rgba(0,0,0,.12)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
            zIndex: 10,
          }}
        >
          <Icon name="play" size={10} style={{ transform: "rotate(90deg)" }} />
          Jump to latest
        </button>
      )}
    </div>
  );
};
