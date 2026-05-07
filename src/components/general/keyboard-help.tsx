import * as React from "react";
import { formatKeys } from "./use-keybindings";

export interface KeyboardHelpEntry {
  keys: string;
  label: string;
}

export interface KeyboardHelpGroup {
  title: string;
  entries: KeyboardHelpEntry[];
}

export interface KeyboardHelpProps {
  open: boolean;
  onClose: () => void;
  groups: KeyboardHelpGroup[];
}

/**
 * Keyboard cheatsheet overlay. Renders the registered shortcuts in
 * named groups so the user can scan by intent. Triggered by `?` per
 * vim convention; closed by Esc, click-outside, or any keystroke.
 */
export const KeyboardHelp: React.FC<KeyboardHelpProps> = ({ open, onClose, groups }) => {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        display: "grid",
        placeItems: "center",
        zIndex: 1100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 92vw)",
          maxHeight: "80vh",
          background: "var(--bg-panel)",
          border: "1px solid var(--border-base)",
          borderRadius: 12,
          boxShadow: "0 24px 64px rgba(0,0,0,.35)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: "var(--fg-faint)",
                textTransform: "uppercase",
                letterSpacing: ".08em",
              }}
            >
              Reference
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 500, margin: "2px 0 0", color: "var(--fg-strong)" }}>
              Keyboard shortcuts
            </h2>
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: "var(--fg-faint)",
              padding: "3px 7px",
              borderRadius: 4,
              background: "var(--bg-sunken)",
            }}
          >
            Esc to close
          </span>
        </div>

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "16px 18px 24px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "20px 28px",
          }}
        >
          {groups.map((g) => (
            <section key={g.title}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--fg-faint)",
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  marginBottom: 8,
                }}
              >
                {g.title}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {g.entries.map((e, i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 10,
                      alignItems: "center",
                      padding: "4px 0",
                      borderBottom: i < g.entries.length - 1 ? "1px solid var(--border-subtle)" : "none",
                    }}
                  >
                    <span style={{ fontSize: 12.5, color: "var(--fg-base)" }}>{e.label}</span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--fg-muted)",
                        padding: "2px 6px",
                        borderRadius: 3,
                        background: "var(--bg-sunken)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatKeys(e.keys)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};
