import * as React from "react";
import { Eyebrow, Icon } from "../../general";
import type { AnalysisReport, AnalysisReportBlock } from "../types";

export interface ReportViewerProps {
  report: AnalysisReport;
  /** Verdict pill on the meta strip. */
  verdict?: { label: string; tone?: "positive" | "warn" | "negative" };
}

function fmtRelative(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

const MetaCell: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
    <span style={{ textTransform: "uppercase", letterSpacing: ".06em", fontSize: 9.5, color: "var(--fg-faint)" }}>
      {label}
    </span>
    <span style={{ color: "var(--fg-strong)", fontSize: 12.5 }}>{value}</span>
  </div>
);

const ReportBlock: React.FC<{ block: AnalysisReportBlock }> = ({ block }) => {
  if (block.type === "p")
    return (
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 17.5,
          lineHeight: 1.6,
          color: "var(--fg-base)",
          margin: "0 0 18px",
        }}
      >
        {block.text}
      </p>
    );

  if (block.type === "kpi-row")
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, margin: "8px 0 24px" }}>
        {block.tiles.map((t, i) => (
          <div
            key={i}
            style={{
              padding: "14px 14px 12px",
              borderRadius: 8,
              background: "var(--bg-sunken)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9.5,
                textTransform: "uppercase",
                letterSpacing: ".06em",
                color: "var(--fg-faint)",
              }}
            >
              {t.label}
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 500,
                color: "var(--fg-strong)",
                marginTop: 4,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.02em",
              }}
            >
              {t.value}
            </div>
            <div
              style={{
                fontSize: 11,
                color:
                  t.tone === "positive"
                    ? "var(--positive-fg)"
                    : t.tone === "warn"
                      ? "var(--warn-fg)"
                      : t.tone === "negative"
                        ? "var(--negative-fg)"
                        : "var(--fg-muted)",
                marginTop: 2,
              }}
            >
              {t.trend}
            </div>
          </div>
        ))}
      </div>
    );

  if (block.type === "category-grid")
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, margin: "8px 0 24px" }}>
        {block.items.map((it, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "180px 50px 1fr 50px",
              alignItems: "center",
              gap: 14,
              padding: "8px 0",
            }}
          >
            <span style={{ fontSize: 13.5, color: "var(--fg-strong)", fontFamily: "var(--font-sans)" }}>{it.name}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-muted)", textAlign: "right" }}>
              {it.count}
            </span>
            <div style={{ height: 6, background: "var(--bg-sunken)", borderRadius: 3, overflow: "hidden" }}>
              <div
                style={{
                  width: `${it.share * 3}%`,
                  height: "100%",
                  background:
                    it.tone === "accent"
                      ? "var(--accent)"
                      : it.tone === "warn"
                        ? "var(--warn)"
                        : it.tone === "info"
                          ? "var(--info)"
                          : "var(--fg-muted)",
                  borderRadius: 3,
                }}
              ></div>
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)", textAlign: "right" }}>
              {it.share}%
            </span>
          </div>
        ))}
      </div>
    );

  if (block.type === "critical-list")
    return (
      <ol style={{ listStyle: "none", padding: 0, margin: "8px 0 24px" }}>
        {block.items.map((it, i) => (
          <li
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 18,
              padding: "20px 0",
              borderTop: i === 0 ? "1px solid var(--border-base)" : "none",
              borderBottom: "1px solid var(--border-base)",
            }}
          >
            <div style={{ width: 56, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)" }}>
              <div>{it.id}</div>
              <div style={{ marginTop: 4, fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".06em" }}>
                0{i + 1}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 17,
                  lineHeight: 1.45,
                  color: "var(--fg-strong)",
                  fontWeight: 500,
                }}
              >
                {it.title}
              </div>
              <blockquote
                style={{
                  margin: "10px 0 0",
                  padding: "2px 0 2px 14px",
                  borderLeft: "2px solid var(--quote-rule)",
                  fontFamily: "var(--font-serif)",
                  fontStyle: "italic",
                  fontSize: 14.5,
                  lineHeight: 1.5,
                  color: "var(--fg-muted)",
                }}
              >
                "{it.quote}"
              </blockquote>
              <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)" }}>
                {it.section}
              </div>
            </div>
          </li>
        ))}
      </ol>
    );

  if (block.type === "callout")
    return (
      <div
        style={{
          margin: "16px 0 24px",
          padding: "14px 16px",
          background: block.tone === "warn" ? "var(--warn-soft)" : "var(--info-soft)",
          borderRadius: 6,
          borderLeft: `3px solid ${block.tone === "warn" ? "var(--warn)" : "var(--info)"}`,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: ".08em",
            color: block.tone === "warn" ? "var(--warn-fg)" : "var(--info-fg)",
            marginBottom: 4,
          }}
        >
          {block.title}
        </div>
        <div style={{ fontFamily: "var(--font-serif)", fontSize: 15, lineHeight: 1.5, color: "var(--fg-base)" }}>
          {block.text}
        </div>
      </div>
    );

  if (block.type === "dod-list")
    return (
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "8px 0 24px",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {block.items.map((it, i) => (
          <li
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "20px 1fr auto auto",
              gap: 12,
              alignItems: "center",
              padding: "10px 14px",
              borderBottom: i < block.items.length - 1 ? "1px solid var(--border-subtle)" : "none",
              background: i % 2 ? "var(--bg-sunken)" : "transparent",
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                border: "1px solid",
                borderColor: it.done ? "var(--positive)" : "var(--border-strong)",
                background: it.done ? "var(--positive)" : "transparent",
                display: "grid",
                placeItems: "center",
                color: "var(--fg-on-accent)",
              }}
            >
              {it.done && <Icon name="check" size={10} />}
            </span>
            <span style={{ fontSize: 13, color: "var(--fg-strong)" }}>{it.label}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-muted)" }}>{it.count}</span>
            <span
              style={{
                fontSize: 11,
                color: "var(--fg-faint)",
                fontStyle: it.note ? "italic" : "normal",
              }}
            >
              {it.note}
            </span>
          </li>
        ))}
      </ul>
    );

  return null;
};

export const ReportViewer: React.FC<ReportViewerProps> = ({ report: r, verdict }) => {
  const [activeSection, setActiveSection] = React.useState(r.sections[0]?.id);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const sectionRefs = React.useRef<Record<string, HTMLElement | null>>({});

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const top = el.scrollTop + 120;
      let cur = r.sections[0]?.id;
      for (const s of r.sections) {
        const node = sectionRefs.current[s.id];
        if (node && node.offsetTop <= top) cur = s.id;
      }
      setActiveSection(cur);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [r]);

  const scrollTo = (id: string) => {
    const node = sectionRefs.current[id];
    const el = scrollRef.current;
    if (node && el) el.scrollTo({ top: node.offsetTop - 24, behavior: "smooth" });
  };

  const verdictColor =
    verdict?.tone === "warn"
      ? "var(--warn-fg)"
      : verdict?.tone === "negative"
        ? "var(--negative-fg)"
        : "var(--positive-fg)";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", height: "100%", overflow: "hidden" }}>
      <div ref={scrollRef} style={{ overflowY: "auto", background: "var(--bg-panel)" }}>
        <article style={{ maxWidth: 760, margin: "0 auto", padding: "48px 56px 96px" }}>
          <Eyebrow style={{ marginBottom: 16 }}>
            {r.meta.runId} · iteration {r.meta.iteration} · markdown
          </Eyebrow>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 40,
              lineHeight: 1.1,
              fontWeight: 500,
              color: "var(--fg-strong)",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            {r.title}
          </h1>
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontSize: 18,
              lineHeight: 1.4,
              color: "var(--fg-muted)",
              marginTop: 14,
              marginBottom: 0,
            }}
          >
            {r.subtitle}
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "18px 28px",
              marginTop: 28,
              paddingTop: 18,
              paddingBottom: 18,
              borderTop: "1px solid var(--border-base)",
              borderBottom: "1px solid var(--border-base)",
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
              color: "var(--fg-muted)",
            }}
          >
            <MetaCell label="Generated" value={fmtRelative(r.meta.generated)} />
            <MetaCell label="Source" value={`${r.meta.sourceDocs} doc · ${r.meta.sourcePages} pp.`} />
            <MetaCell label="Intents" value={r.meta.intentsExtracted} />
            <MetaCell label="Verbatim" value={`${r.meta.verifiedQuotes}/${r.meta.intentsExtracted}`} />
            {verdict && (
              <MetaCell label="Verdict" value={<span style={{ color: verdictColor }}>{verdict.label}</span>} />
            )}
          </div>

          <div style={{ marginTop: 36 }}>
            {r.sections.map((s, idx) => (
              <section
                key={s.id}
                ref={(el) => {
                  sectionRefs.current[s.id] = el;
                }}
                style={{ marginBottom: 56, scrollMarginTop: 24 }}
              >
                <h2
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 26,
                    fontWeight: 500,
                    color: "var(--fg-strong)",
                    margin: "0 0 18px",
                    letterSpacing: "-0.01em",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--fg-ghost)",
                      marginRight: 12,
                      fontWeight: 400,
                      verticalAlign: "middle",
                    }}
                  >
                    §{idx + 1}
                  </span>
                  {s.heading}
                </h2>
                {s.body.map((block, i) => (
                  <ReportBlock key={i} block={block} />
                ))}
              </section>
            ))}
          </div>

          <div
            style={{
              marginTop: 80,
              paddingTop: 24,
              borderTop: "1px solid var(--border-base)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "var(--fg-faint)",
              fontSize: 12,
            }}
          >
            <span style={{ fontFamily: "var(--font-mono)" }}>
              EOF · iter-{r.meta.iteration} · {r.meta.intentsExtracted} intents · {r.meta.verifiedQuotes} verbatim
            </span>
            <span style={{ display: "flex", gap: 14 }}>
              <a style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "var(--fg-muted)" }}>
                <Icon name="download" size={12} /> .md
              </a>
              <a style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "var(--fg-muted)" }}>
                <Icon name="download" size={12} /> .pdf
              </a>
            </span>
          </div>
        </article>
      </div>

      <aside
        style={{
          borderLeft: "1px solid var(--border-subtle)",
          background: "var(--bg-panel)",
          padding: "48px 14px",
          overflowY: "auto",
        }}
      >
        <Eyebrow style={{ marginBottom: 12, padding: "0 8px" }}>On this page</Eyebrow>
        {r.sections.map((s, i) => {
          const on = s.id === activeSection;
          return (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              style={{
                display: "block",
                width: "100%",
                padding: "5px 8px",
                borderRadius: 4,
                textAlign: "left",
                cursor: "pointer",
                color: on ? "var(--fg-strong)" : "var(--fg-muted)",
                fontSize: 12,
                lineHeight: 1.4,
                borderLeft: on ? "2px solid var(--accent)" : "2px solid transparent",
                fontWeight: on ? 500 : 400,
                marginLeft: -2,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  color: "var(--fg-ghost)",
                  marginRight: 6,
                }}
              >
                0{i + 1}
              </span>
              {s.heading}
            </button>
          );
        })}
      </aside>
    </div>
  );
};
