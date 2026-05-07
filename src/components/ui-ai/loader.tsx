import * as React from "react";

/**
 * Typing indicator. Three dots that pulse in sequence. Sits inline
 * inside a Message bubble or alongside it. Uses pure CSS animation so
 * there's no runtime cost.
 */
export const Loader: React.FC<{ label?: string }> = ({ label }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      color: "var(--fg-faint)",
      fontFamily: "var(--font-mono)",
      fontSize: 11,
    }}
  >
    <style>{`
      @keyframes uiAiBounce {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
        30% { transform: translateY(-3px); opacity: 1; }
      }
    `}</style>
    <span style={{ display: "inline-flex", gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 4,
            height: 4,
            borderRadius: 2,
            background: "currentColor",
            animation: `uiAiBounce 1.1s infinite`,
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </span>
    {label && <span>{label}</span>}
  </span>
);
