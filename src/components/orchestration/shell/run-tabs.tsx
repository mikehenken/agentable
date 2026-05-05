import * as React from "react";
import { Icon, type IconName } from "../../general";

export type RunTabId = "overview" | "workflow" | "artifacts" | "logs" | "config";

export interface RunTabsProps {
  active: RunTabId;
  setActive: (id: RunTabId) => void;
  artifactCount: number;
  /** Right-side text — defaults to "complete · 47 min · 3 iterations". Pass null to hide. */
  meta?: { label: string; tone?: "positive" | "warn" | "negative" } | null;
}

const TABS: { id: RunTabId; label: string; icon: IconName }[] = [
  { id: "overview", label: "Overview", icon: "overview" },
  { id: "workflow", label: "Workflow", icon: "board" },
  { id: "artifacts", label: "Artifacts", icon: "artifact" },
  { id: "logs", label: "Logs", icon: "logs" },
  { id: "config", label: "Config", icon: "sliders" },
];

export const RunTabs: React.FC<RunTabsProps> = ({
  active,
  setActive,
  artifactCount,
  meta = { label: "complete · 47 min · 3 iterations", tone: "positive" },
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 0,
      padding: "0 16px",
      borderBottom: "1px solid var(--border-subtle)",
      background: "var(--bg-app)",
      height: 38,
      flexShrink: 0,
    }}
  >
    {TABS.map((t) => {
      const on = t.id === active;
      const badge = t.id === "artifacts" ? artifactCount : null;
      return (
        <button
          key={t.id}
          onClick={() => setActive(t.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "0 12px",
            height: "100%",
            color: on ? "var(--fg-strong)" : "var(--fg-muted)",
            fontSize: 12.5,
            fontWeight: on ? 500 : 400,
            position: "relative",
            cursor: "pointer",
            borderBottom: on ? "2px solid var(--fg-strong)" : "2px solid transparent",
            marginBottom: -1,
          }}
        >
          <Icon name={t.icon} size={13} />
          <span>{t.label}</span>
          {badge != null && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                padding: "0 5px",
                borderRadius: 8,
                marginLeft: 2,
                background: on ? "var(--bg-active)" : "var(--bg-sunken)",
                color: on ? "var(--fg-base)" : "var(--fg-faint)",
              }}
            >
              {badge}
            </span>
          )}
        </button>
      );
    })}
    {meta && (
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--fg-faint)" }}>
        <Icon
          name="play"
          size={10}
          style={{
            color:
              meta.tone === "warn"
                ? "var(--warn)"
                : meta.tone === "negative"
                  ? "var(--negative)"
                  : "var(--positive)",
          }}
        />
        <span>{meta.label}</span>
      </div>
    )}
  </div>
);
