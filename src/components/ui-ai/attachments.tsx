import * as React from "react";
import { Icon, type IconName } from "../general";

/** A single attachment — either a local File mid-upload or a server-side artifact. */
export interface AttachmentItem {
  id: string;
  /** Display name (filename, or a custom label). */
  name: string;
  /** R2 key when uploaded; absent for files still being uploaded. */
  key?: string;
  /** MIME type if known. Drives the icon. */
  mime?: string;
  /** Size in bytes if known. */
  size?: number;
  /** Per-file lifecycle state. */
  status?: "uploading" | "ready" | "failed";
  /** Failure reason when `status === "failed"`. */
  error?: string;
}

const ICON_FOR_MIME: { test: RegExp; icon: IconName }[] = [
  { test: /^image\//, icon: "artifact" },
  { test: /pdf$/, icon: "doc" },
  { test: /^application\/(json|.*\+json)/, icon: "code" },
  { test: /yaml|yml/, icon: "yaml" },
  { test: /^text\//, icon: "doc" },
];

function iconFor(mime?: string): IconName {
  if (!mime) return "doc";
  return ICON_FOR_MIME.find((m) => m.test.test(mime))?.icon ?? "doc";
}

function formatSize(bytes?: number): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export interface AttachmentsProps {
  items: AttachmentItem[];
  /** Called when the user clicks the × on an attachment. */
  onRemove?: (id: string) => void;
  /** Compact mode shrinks chips (used inside the composer). */
  compact?: boolean;
}

/**
 * Horizontal chip row showing staged + uploaded attachments. Each
 * chip surfaces filename, size, lifecycle dot, and a remove button.
 * Used both inside the composer (pre-send) and inside user message
 * bubbles (post-send) so the visual language stays consistent.
 */
export const Attachments: React.FC<AttachmentsProps> = ({ items, onRemove, compact }) => {
  if (items.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 5,
        padding: compact ? "4px 0" : "6px 0",
      }}
    >
      {items.map((a) => {
        const dot =
          a.status === "uploading"
            ? "var(--accent)"
            : a.status === "failed"
              ? "var(--negative)"
              : "var(--positive)";
        return (
          <div
            key={a.id}
            title={a.error ?? `${a.name}${a.size ? ` · ${formatSize(a.size)}` : ""}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: compact ? "3px 6px 3px 8px" : "4px 6px 4px 10px",
              borderRadius: 4,
              background: "var(--bg-sunken)",
              border: "1px solid var(--border-subtle)",
              fontFamily: "var(--font-mono)",
              fontSize: compact ? 10.5 : 11,
              color: a.status === "failed" ? "var(--negative-fg)" : "var(--fg-muted)",
              maxWidth: 220,
            }}
          >
            {a.status === "uploading" ? (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: dot,
                  flexShrink: 0,
                }}
              />
            ) : (
              <Icon
                name={iconFor(a.mime)}
                size={11}
                style={{ color: dot, flexShrink: 0 }}
              />
            )}
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {a.name}
            </span>
            {a.size != null && (
              <span style={{ color: "var(--fg-faint)", fontSize: 9.5 }}>
                {formatSize(a.size)}
              </span>
            )}
            {onRemove && (
              <button
                onClick={() => onRemove(a.id)}
                title={`Remove ${a.name}`}
                aria-label={`Remove ${a.name}`}
                style={{
                  width: 14,
                  height: 14,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 2,
                  color: "var(--fg-ghost)",
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  fontSize: 12,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-base)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-ghost)";
                }}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};
