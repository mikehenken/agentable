import * as React from "react";
import { Icon } from "../../general";
import { PriorityChip, StatusChip } from "../chips";
import type { Intent, IntentIndex, IntentPriority } from "../types";

export type IntentTreatment = "catalog" | "table" | "yaml";

export interface IntentViewerProps {
  intents: IntentIndex;
  treatment: IntentTreatment;
}

export const IntentViewer: React.FC<IntentViewerProps> = ({ intents, treatment }) => {
  const [query, setQuery] = React.useState("");
  const [pri, setPri] = React.useState<IntentPriority | "all">("all");
  const data = intents.filter((i) => {
    if (pri !== "all" && i.priority !== pri) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        i.id.toLowerCase().includes(q) ||
        i.paraphrase.toLowerCase().includes(q) ||
        i.origin.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-panel)" }}>
      <IntentToolbar
        query={query}
        setQuery={setQuery}
        pri={pri}
        setPri={setPri}
        count={data.length}
        total={intents.length}
        treatment={treatment}
      />
      <div style={{ flex: 1, overflow: "auto" }}>
        {treatment === "catalog" && <IntentCatalog data={data} />}
        {treatment === "table" && <IntentTable data={data} />}
        {treatment === "yaml" && <IntentYaml data={data} />}
      </div>
    </div>
  );
};

interface IntentToolbarProps {
  query: string;
  setQuery: (q: string) => void;
  pri: IntentPriority | "all";
  setPri: (p: IntentPriority | "all") => void;
  count: number;
  total: number;
  treatment: IntentTreatment;
}

const IntentToolbar: React.FC<IntentToolbarProps> = ({ query, setQuery, pri, setPri, count, total, treatment }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 16px",
      borderBottom: "1px solid var(--border-subtle)",
      background: "var(--bg-panel)",
      flexShrink: 0,
    }}
  >
    <div style={{ position: "relative", flex: "0 0 240px" }}>
      <Icon
        name="search"
        size={13}
        style={{
          position: "absolute",
          left: 8,
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--fg-faint)",
        }}
      />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="filter intents..."
        style={{
          width: "100%",
          padding: "5px 8px 5px 28px",
          fontSize: 12,
          background: "var(--bg-sunken)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 5,
          color: "var(--fg-base)",
          outline: "none",
          fontFamily: "var(--font-mono)",
        }}
      />
    </div>

    <div
      style={{
        display: "flex",
        gap: 0,
        padding: 2,
        borderRadius: 5,
        background: "var(--bg-sunken)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      {(["all", "critical", "high", "medium"] as const).map((p) => (
        <button
          key={p}
          onClick={() => setPri(p)}
          style={{
            padding: "3px 9px",
            fontSize: 11,
            borderRadius: 3,
            color: pri === p ? "var(--fg-strong)" : "var(--fg-muted)",
            background: pri === p ? "var(--bg-panel)" : "transparent",
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            letterSpacing: ".04em",
            cursor: "pointer",
            fontWeight: pri === p ? 500 : 400,
            boxShadow: pri === p ? "var(--shadow-1)" : "none",
          }}
        >
          {p}
        </button>
      ))}
    </div>

    <div
      style={{
        marginLeft: "auto",
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontSize: 11.5,
        color: "var(--fg-faint)",
        fontFamily: "var(--font-mono)",
      }}
    >
      <span>
        <span style={{ color: "var(--fg-strong)" }}>{count}</span>/{total} intents
      </span>
      <span>·</span>
      <span>schema v2</span>
      <span>·</span>
      <span>
        view: <span style={{ color: "var(--accent)" }}>{treatment}</span>
      </span>
    </div>
  </div>
);

const IntentCatalog: React.FC<{ data: Intent[] }> = ({ data }) => (
  <div
    style={{
      padding: "20px 16px",
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
      gap: 10,
    }}
  >
    {data.map((it) => (
      <article
        key={it.id}
        style={{
          padding: "12px 14px",
          borderRadius: 8,
          background: "var(--bg-panel)",
          border: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          transition: "all var(--t-fast) var(--ease-out)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border-base)";
          (e.currentTarget as HTMLElement).style.background = "var(--bg-sunken)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)";
          (e.currentTarget as HTMLElement).style.background = "var(--bg-panel)";
        }}
      >
        <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-fg)", fontWeight: 600 }}>
            {it.id}
          </span>
          <PriorityChip p={it.priority} />
          <StatusChip s={it.status} />
          <span
            style={{
              marginLeft: "auto",
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: "var(--fg-faint)",
            }}
          >
            {it.section}
          </span>
        </header>
        <div style={{ fontSize: 13.5, lineHeight: 1.4, color: "var(--fg-strong)", fontWeight: 500 }}>
          {it.paraphrase}
        </div>
        <blockquote
          style={{
            margin: 0,
            padding: "4px 0 4px 10px",
            borderLeft: "2px solid var(--quote-rule)",
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontSize: 12.5,
            lineHeight: 1.45,
            color: "var(--fg-muted)",
          }}
        >
          "{it.origin.length > 130 ? it.origin.slice(0, 127) + "..." : it.origin}"
        </blockquote>
        <div
          style={{
            fontSize: 10.5,
            color: "var(--fg-faint)",
            fontFamily: "var(--font-mono)",
            marginTop: 2,
          }}
        >
          {it.category}
        </div>
      </article>
    ))}
  </div>
);

const IntentTable: React.FC<{ data: Intent[] }> = ({ data }) => (
  <div style={{ padding: "0 0 20px" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead style={{ position: "sticky", top: 0, background: "var(--bg-panel)", zIndex: 1 }}>
        <tr style={{ borderBottom: "1px solid var(--border-base)" }}>
          {["id", "paraphrase", "category", "priority", "status", "section"].map((h) => (
            <th
              key={h}
              style={{
                padding: "10px 12px",
                textAlign: "left",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: ".06em",
                color: "var(--fg-faint)",
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((it) => (
          <tr
            key={it.id}
            style={{ borderBottom: "1px solid var(--border-subtle)", cursor: "pointer" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--bg-hover)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
          >
            <td
              style={{
                padding: "10px 12px",
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                color: "var(--accent-fg)",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {it.id}
            </td>
            <td style={{ padding: "10px 12px", color: "var(--fg-strong)", maxWidth: 360 }}>{it.paraphrase}</td>
            <td style={{ padding: "10px 12px" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-muted)" }}>
                {it.category}
              </span>
            </td>
            <td style={{ padding: "10px 12px" }}>
              <PriorityChip p={it.priority} />
            </td>
            <td style={{ padding: "10px 12px" }}>
              <StatusChip s={it.status} />
            </td>
            <td
              style={{
                padding: "10px 12px",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--fg-muted)",
                whiteSpace: "nowrap",
              }}
            >
              {it.section}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

type YamlLine =
  | { k: "blank" }
  | { k: "comment"; t: string }
  | { k: "key"; indent: number; t: string }
  | { k: "kv"; indent: number; key: string; val: React.ReactNode; mono?: boolean; raw?: boolean }
  | { k: "kv-multi"; indent: number; key: string; val: string }
  | { k: "listmark"; indent: number; key: string; val: string };

const Indent: React.FC<{ n: number }> = ({ n }) => <span style={{ display: "inline-block", width: n * 16 }} />;

const IntentYaml: React.FC<{ data: Intent[] }> = ({ data }) => {
  const lines: YamlLine[] = [];
  lines.push({ k: "comment", t: "# intent-index.yaml — run-0142 · iter 3 · 35 records" });
  lines.push({ k: "comment", t: "# generated by Analyst Agent · self-reviewed · AMA citation format" });
  lines.push({ k: "blank" });
  lines.push({ k: "key", indent: 0, t: "metadata:" });
  lines.push({ k: "kv", indent: 1, key: "schema", val: "intent-v2" });
  lines.push({ k: "kv", indent: 1, key: "source_doc", val: "uvi-brd-uc01.pdf" });
  lines.push({ k: "kv", indent: 1, key: "extracted", val: data.length, raw: true });
  lines.push({ k: "blank" });
  lines.push({ k: "key", indent: 0, t: "intents:" });
  data.forEach((it, idx) => {
    lines.push({ k: "listmark", indent: 1, key: "id", val: it.id });
    lines.push({ k: "kv", indent: 2, key: "paraphrase", val: it.paraphrase });
    lines.push({ k: "kv", indent: 2, key: "category", val: it.category, mono: true });
    lines.push({ k: "kv", indent: 2, key: "priority", val: it.priority, mono: true });
    lines.push({ k: "kv", indent: 2, key: "status", val: it.status, mono: true });
    lines.push({ k: "kv", indent: 2, key: "section_ref", val: it.section, mono: true });
    lines.push({ k: "kv-multi", indent: 2, key: "origin", val: it.origin });
    if (idx < data.length - 1) lines.push({ k: "blank" });
  });

  return (
    <pre
      style={{
        margin: 0,
        padding: "20px 24px 60px",
        fontFamily: "var(--font-mono)",
        fontSize: 12.5,
        lineHeight: 1.65,
        color: "var(--code-fg)",
        background: "var(--bg-panel)",
        whiteSpace: "pre",
        tabSize: 2,
      }}
    >
      {lines.map((ln, i) => {
        if (ln.k === "blank") return <div key={i}>&nbsp;</div>;
        if (ln.k === "comment")
          return (
            <div key={i} style={{ color: "var(--code-comment)" }}>
              {ln.t}
            </div>
          );
        if (ln.k === "key")
          return (
            <div key={i}>
              <Indent n={ln.indent} />
              <span style={{ color: "var(--code-key)" }}>{ln.t}</span>
            </div>
          );
        if (ln.k === "listmark")
          return (
            <div key={i}>
              <Indent n={ln.indent} />
              <span style={{ color: "var(--code-keyword)" }}>- </span>
              <span style={{ color: "var(--code-key)" }}>{ln.key}: </span>
              <span style={{ color: "var(--code-string)" }}>{ln.val}</span>
            </div>
          );
        if (ln.k === "kv") {
          const isNum = typeof ln.val === "number";
          return (
            <div key={i}>
              <Indent n={ln.indent} />
              <span style={{ color: "var(--code-key)" }}>{ln.key}: </span>
              {ln.raw ? (
                <span style={{ color: "var(--code-number)" }}>{ln.val as React.ReactNode}</span>
              ) : isNum ? (
                <span style={{ color: "var(--code-number)" }}>{ln.val as React.ReactNode}</span>
              ) : ln.mono ? (
                <span style={{ color: "var(--code-string)" }}>{ln.val}</span>
              ) : (
                <span style={{ color: "var(--code-string)" }}>"{ln.val}"</span>
              )}
            </div>
          );
        }
        if (ln.k === "kv-multi")
          return (
            <div key={i}>
              <Indent n={ln.indent} />
              <span style={{ color: "var(--code-key)" }}>{ln.key}: </span>
              <span style={{ color: "var(--code-keyword)" }}>|-</span>
              <div>
                <Indent n={ln.indent + 1} />
                <span
                  style={{
                    color: "var(--code-string)",
                    whiteSpace: "pre-wrap",
                    display: "inline-block",
                    maxWidth: "calc(100% - 64px)",
                    verticalAlign: "top",
                  }}
                >
                  {ln.val}
                </span>
              </div>
            </div>
          );
        return null;
      })}
    </pre>
  );
};
