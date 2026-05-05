import * as React from "react";
import { Icon } from "../../general";

const pdfH2: React.CSSProperties = { fontSize: 16, fontWeight: 600, marginTop: 28, marginBottom: 10, color: "#111" };
const pdfH3: React.CSSProperties = { fontSize: 13.5, fontWeight: 600, marginTop: 18, marginBottom: 6, color: "#222" };
const pdfP: React.CSSProperties = { marginBottom: 12, textAlign: "justify" };

const PdfPage: React.FC<{ n: number; children: React.ReactNode }> = ({ n, children }) => (
  <div
    style={{
      width: 612,
      minHeight: 792,
      background: "white",
      color: "#222",
      boxShadow: "var(--shadow-2)",
      padding: "60px 64px",
      fontFamily: '"Source Serif 4", Georgia, serif',
      fontSize: 12.5,
      lineHeight: 1.55,
      position: "relative",
    }}
  >
    {children}
    <div
      style={{
        position: "absolute",
        bottom: 28,
        right: 36,
        fontSize: 10,
        color: "#999",
        fontFamily: "var(--font-mono)",
      }}
    >
      p. {n}
    </div>
  </div>
);

/** PDF source mock — page 1 only, matches the prototype faux render. */
export const SourceViewer: React.FC = () => (
  <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-sunken)" }}>
    <div
      style={{
        padding: "10px 16px",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontFamily: "var(--font-mono)",
        fontSize: 11.5,
        color: "var(--fg-muted)",
        background: "var(--bg-panel)",
      }}
    >
      <Icon name="doc" size={13} style={{ color: "var(--negative-fg)" }} />
      <span style={{ color: "var(--fg-strong)" }}>source-brd-acme-uc01.pdf</span>
      <span>·</span>
      <span>47 pages</span>
      <span>·</span>
      <span>412 kb</span>
      <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
        <button
          style={{
            padding: "2px 8px",
            borderRadius: 4,
            background: "var(--bg-sunken)",
            fontSize: 11,
            color: "var(--fg-muted)",
            cursor: "pointer",
          }}
        >
          − zoom
        </button>
        <span style={{ color: "var(--fg-faint)" }}>page 1 / 47</span>
        <button
          style={{
            padding: "2px 8px",
            borderRadius: 4,
            background: "var(--bg-sunken)",
            fontSize: 11,
            color: "var(--fg-muted)",
            cursor: "pointer",
          }}
        >
          +
        </button>
      </span>
    </div>
    <div
      style={{
        flex: 1,
        overflow: "auto",
        padding: "32px 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
      }}
    >
      <PdfPage n={1}>
        <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "#222", marginBottom: 6 }}>
          Business Requirements Document
        </div>
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 15,
            color: "#444",
            fontStyle: "italic",
            marginBottom: 28,
          }}
        >
          UC-01 — In-House Brand Monitoring System
        </div>
        <div style={{ fontSize: 11.5, color: "#666", marginBottom: 24 }}>
          Acme Corp · Engineering · v1.2 · DRAFT
        </div>

        <h2 style={pdfH2}>1.&nbsp; Executive Summary</h2>
        <p style={pdfP}>
          Acme branded properties experience persistent brand-impersonation activity
          manifesting as look-alike domains, paid-search ad hijacking of brand keywords, and
          call-center spoofing. Mean time from threat emergence to internal awareness currently
          ranges from{" "}<strong>4 to 48 hours</strong>, with awareness driven primarily by
          customer-reported incidents and ad-hoc analyst search.
        </p>
        <p style={pdfP}>
          This document specifies the business requirements for an in-house monitoring system built by
          internal engineering that will close that detection gap. The system will be delivered in three
          phases: a public-data MVP built on free and low-cost feeds; a
          commercial backstop layer that introduces paid SERP, phone intelligence, and takedown
          vendors; and a full brand protection tier.
        </p>

        <h2 style={pdfH2}>2.&nbsp; Background</h2>
        <h3 style={pdfH3}>2.3&nbsp; Why In-House</h3>
        <p style={pdfP}>
          The team requires <strong>first-party control</strong> of the classification logic, the
          allowlist-first heuristics, and the data pipeline itself. There is unique brand-specific
          context — product names, approved partner networks, active promotional phone numbers —
          that a generic DRP product cannot encode without continual configuration churn. Commercial
          Digital Risk Protection (DRP) vendors exist and will be evaluated for Phase 2 backstop
          capability, but they are not a substitute for first-party telemetry.
        </p>
      </PdfPage>
    </div>
  </div>
);
