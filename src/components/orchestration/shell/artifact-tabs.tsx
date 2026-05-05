import * as React from "react";
import { Icon, type IconName } from "../../general";
import type { Artifact, ArtifactKind } from "../types";

const KIND_ICON: Record<ArtifactKind, IconName> = {
  markdown: "doc",
  yaml: "yaml",
  "yaml-cite": "yaml",
  gap: "spark",
  tldraw: "board",
  source: "artifact",
};

export interface ArtifactTabsProps {
  artifacts: Artifact[];
  activeId: string;
  setActiveId: (id: string) => void;
}

export const ArtifactTabs: React.FC<ArtifactTabsProps> = ({ artifacts, activeId, setActiveId }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 0,
      padding: "0 8px",
      borderBottom: "1px solid var(--border-subtle)",
      background: "var(--bg-panel)",
      height: 36,
      flexShrink: 0,
      overflowX: "auto",
    }}
  >
    {artifacts.map((a) => {
      const on = a.id === activeId;
      return (
        <button
          key={a.id}
          onClick={() => setActiveId(a.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "0 10px",
            height: 26,
            marginTop: 6,
            marginRight: 2,
            borderRadius: 5,
            color: on ? "var(--fg-strong)" : "var(--fg-muted)",
            background: on ? "var(--bg-sunken)" : "transparent",
            fontSize: 12,
            cursor: "pointer",
            whiteSpace: "nowrap",
            border: on ? "1px solid var(--border-subtle)" : "1px solid transparent",
          }}
          onMouseEnter={(e) => {
            if (!on) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
          }}
          onMouseLeave={(e) => {
            if (!on) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          <Icon
            name={KIND_ICON[a.kind] || "doc"}
            size={12}
            style={{ color: on ? "var(--accent)" : "var(--fg-faint)" }}
          />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>{a.name}</span>
        </button>
      );
    })}
  </div>
);
