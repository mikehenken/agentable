import * as React from "react";
import { Icon, type IconName } from "../../general";
import { ModalShell } from "./modal-shell";
import type { Artifact, ArtifactKind } from "../types";

const ARTIFACT_KIND_ICON: Record<ArtifactKind, IconName> = {
  markdown: "doc",
  yaml: "yaml",
  "yaml-cite": "yaml",
  gap: "spark",
  tldraw: "board",
  source: "artifact",
};

export interface ArtifactViewerModalProps {
  artifact: Artifact & {
    runName?: string;
    clientTag?: string;
  };
  onClose: () => void;
  /** Body renderer — host wires the artifact kind to the right viewer. */
  children: React.ReactNode;
}

/** Generic shell for displaying an artifact viewer in a modal. Body is host-supplied. */
export const ArtifactViewerModal: React.FC<ArtifactViewerModalProps> = ({ artifact, onClose, children }) => (
  <ModalShell onClose={onClose} width={1100} maxHeight="92vh">
    <div
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Icon name={ARTIFACT_KIND_ICON[artifact.kind] || "doc"} size={15} style={{ color: "var(--accent)" }} />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12.5,
          color: "var(--fg-strong)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
      >
        {artifact.name}
      </span>
      {artifact.runName && (
        <span style={{ fontSize: 11, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>
          {artifact.clientTag} · {artifact.runName}
        </span>
      )}
      <button
        onClick={onClose}
        style={{
          width: 26,
          height: 26,
          borderRadius: 5,
          cursor: "pointer",
          color: "var(--fg-muted)",
          display: "grid",
          placeItems: "center",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
      >
        <Icon name="close" size={14} />
      </button>
    </div>
    <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {children}
    </div>
  </ModalShell>
);
