import * as React from "react";
import { createPortal } from "react-dom";

export interface ModalShellProps {
  onClose: () => void;
  width?: number;
  maxHeight?: string;
  children: React.ReactNode;
}

const KEYFRAMES = `
@keyframes orchestrationModalFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes orchestrationModalSlideIn { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
`;

/** Generic centered modal shell with backdrop fade + slide-in. Closes on backdrop click + Escape. */
export const ModalShell: React.FC<ModalShellProps> = ({ onClose, width = 720, maxHeight = "85vh", children }) => {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="modal-shell-overlay"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(15,15,15,0.32)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        animation: "orchestrationModalFadeIn .14s ease-out",
      }}
    >
      <style>{KEYFRAMES}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: "94vw",
          maxHeight,
          background: "var(--bg-panel)",
          border: "1px solid var(--border-base)",
          borderRadius: 10,
          boxShadow: "var(--shadow-modal)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "orchestrationModalSlideIn .18s var(--ease-out)",
        }}
      >
        {children}
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(overlay, document.body);
};
