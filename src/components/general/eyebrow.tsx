import * as React from "react";

export interface EyebrowProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

/** Uppercase mono section label. Inherits color from the host theme via `--fg-faint`. */
export const Eyebrow: React.FC<EyebrowProps> = ({ children, style }) => (
  <div
    style={{
      fontFamily: "var(--font-mono)",
      fontSize: "var(--t-meta, 10.5px)",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--fg-faint)",
      fontWeight: 500,
      display: "inline-flex",
      alignItems: "center",
      ...style,
    }}
  >
    {children}
  </div>
);
