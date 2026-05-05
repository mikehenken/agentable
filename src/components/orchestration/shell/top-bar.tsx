import * as React from "react";
import { Icon, Pill } from "../../general";

export interface BreadcrumbCrumb {
  label: string;
  /** When set, rendered with the strong/active fg color (last crumb usually). */
  active?: boolean;
  /** Mono font, e.g. for run IDs. */
  mono?: boolean;
}

export interface TopBarProps {
  brandShort?: string;
  brandFull?: string;
  brandSubtitle?: string;
  /** Breadcrumb segments — first → last reading order. */
  crumbs: BreadcrumbCrumb[];
  /** Status pill rendered after the breadcrumb (e.g. "PASS · 88"). */
  status?: { tone: "positive" | "warn" | "negative" | "info" | "neutral"; label: string };
  /** Current theme — drives the sun/moon glyph. */
  theme: "light" | "dark";
  onToggleTheme: () => void;
  /** Optional refresh action. When omitted, the button is hidden (no dead UI). */
  onRefresh?: () => void;
  /** Optional search action. Hidden when omitted. */
  onSearch?: () => void;
  /** Initials shown in the avatar bubble. Hidden when omitted. */
  initials?: string;
}

const IconBtn: React.FC<{ icon: React.ComponentProps<typeof Icon>["name"]; onClick?: () => void; active?: boolean; title?: string }> = ({
  icon,
  onClick,
  active,
  title,
}) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      width: 28,
      height: 28,
      borderRadius: 6,
      display: "grid",
      placeItems: "center",
      color: active ? "var(--fg-strong)" : "var(--fg-muted)",
      background: active ? "var(--bg-active)" : "transparent",
      cursor: "pointer",
      transition: "all var(--t-fast) var(--ease-out)",
    }}
    onMouseEnter={(e) => {
      if (!active) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
    }}
    onMouseLeave={(e) => {
      if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
    }}
  >
    <Icon name={icon} size={15} />
  </button>
);

export const TopBar: React.FC<TopBarProps> = ({
  brandShort = "iT",
  brandFull = "iTrade",
  brandSubtitle = "Orchestration",
  crumbs,
  status,
  theme,
  onToggleTheme,
  onSearch,
  onRefresh,
  initials,
}) => (
  <div
    style={{
      height: 44,
      display: "grid",
      gridTemplateColumns: "260px 1fr 360px",
      alignItems: "center",
      borderBottom: "1px solid var(--border-subtle)",
      background: "var(--bg-app)",
      flexShrink: 0,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 14px",
        borderRight: "1px solid var(--border-subtle)",
        height: "100%",
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 5,
          background: "linear-gradient(135deg, var(--fg-strong) 0%, var(--fg-base) 100%)",
          display: "grid",
          placeItems: "center",
          color: "var(--bg-canvas)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "-0.02em",
        }}
      >
        {brandShort}
      </div>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-strong)", letterSpacing: "-0.01em" }}>
          {brandFull}
        </span>
        <span
          style={{
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            color: "var(--fg-faint)",
            textTransform: "uppercase",
            letterSpacing: ".06em",
          }}
        >
          {brandSubtitle}
        </span>
      </div>
    </div>

    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 14px",
        color: "var(--fg-muted)",
        fontSize: 12.5,
        minWidth: 0,
        overflow: "hidden",
        whiteSpace: "nowrap",
      }}
    >
      {crumbs.map((c, i) => (
        <React.Fragment key={i}>
          <span
            style={{
              color: c.active ? "var(--fg-strong)" : "var(--fg-faint)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
              flexShrink: i === crumbs.length - 1 ? 0 : 1,
              fontFamily: c.mono ? "var(--font-mono)" : undefined,
              fontSize: c.mono ? 12 : undefined,
            }}
          >
            {c.label}
          </span>
          {i < crumbs.length - 1 && <Icon name="chright" size={12} style={{ flexShrink: 0 }} />}
        </React.Fragment>
      ))}
      {status && (
        <span style={{ marginLeft: 10, flexShrink: 0 }}>
          <Pill tone={status.tone}>{status.label}</Pill>
        </span>
      )}
    </div>

    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "0 10px 0 14px",
        justifyContent: "flex-end",
        borderLeft: "1px solid var(--border-subtle)",
        height: "100%",
      }}
    >
      {onSearch && <IconBtn icon="search" onClick={onSearch} title="Search" />}
      {onRefresh && <IconBtn icon="refresh" onClick={onRefresh} title="Refresh" />}
      <IconBtn icon={theme === "dark" ? "sun" : "moon"} onClick={onToggleTheme} title="Toggle theme" />
      {initials && (
        <>
          <div style={{ width: 1, height: 18, background: "var(--border-subtle)", margin: "0 6px" }}></div>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "var(--accent)",
              color: "var(--fg-on-accent)",
              display: "grid",
              placeItems: "center",
              fontSize: 10.5,
              fontWeight: 600,
            }}
          >
            {initials}
          </div>
        </>
      )}
    </div>
  </div>
);
