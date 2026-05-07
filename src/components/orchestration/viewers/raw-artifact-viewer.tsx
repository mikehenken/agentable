import * as React from "react";
import { Icon, type IconName } from "../../general";

export interface RawArtifactBody {
  key: string;
  content: string;
}

export interface RawArtifactViewerProps {
  /** R2 key the artifact lives at — passed back to the parent for fetch. */
  artifactKey: string;
  /** Display name (basename) shown in the header. */
  name: string;
  /** Async loader. Returns null when the artifact is missing/unreadable. */
  fetchBody: (key: string) => Promise<RawArtifactBody | null>;
  /**
   * Bumps re-fetch when the parent wants a hard refresh. Pass the same
   * value across renders to keep the cache; bump to force re-fetch.
   */
  refreshKey?: number;
}

type Lang = "markdown" | "yaml" | "json" | "text";

function langFor(name: string): Lang {
  const lower = name.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml";
  if (lower.endsWith(".json")) return "json";
  return "text";
}

const HEADER_ICON: Record<Lang, IconName> = {
  markdown: "doc",
  yaml: "yaml",
  json: "code",
  text: "doc",
};

const MIME_BY_LANG: Record<Lang, string> = {
  markdown: "text/markdown; charset=utf-8",
  yaml: "application/yaml; charset=utf-8",
  json: "application/json; charset=utf-8",
  text: "text/plain; charset=utf-8",
};

/**
 * Browser-friendly basename — the R2 key is path-like (`runs/{id}/…/foo.md`)
 * but `<a download>` only wants the filename portion.
 */
function basename(name: string): string {
  const parts = name.split("/");
  return parts[parts.length - 1] || name;
}

/**
 * Lightweight icon button matching the rest of the orchestration chrome
 * (28×28, hover bg, accent color when busy/active).
 */
const ActionBtn: React.FC<{
  icon: IconName;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({ icon, title, onClick, disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-label={title}
    style={{
      width: 24,
      height: 24,
      borderRadius: 5,
      display: "grid",
      placeItems: "center",
      color: disabled ? "var(--fg-ghost)" : "var(--fg-muted)",
      background: "transparent",
      cursor: disabled ? "default" : "pointer",
      transition: "background var(--t-fast) var(--ease-out), color var(--t-fast) var(--ease-out)",
    }}
    onMouseEnter={(e) => {
      if (!disabled) {
        (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
        (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-strong)";
      }
    }}
    onMouseLeave={(e) => {
      if (!disabled) {
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-muted)";
      }
    }}
  >
    <Icon name={icon} size={13} />
  </button>
);

/**
 * Renders the raw body of any R2-stored artifact. Fetches lazily on
 * mount + when `refreshKey` bumps; caches in component state. For
 * markdown / YAML / JSON, applies light syntax-aware coloring without
 * pulling a heavy syntax-highlighter dependency.
 */
export const RawArtifactViewer: React.FC<RawArtifactViewerProps> = ({
  artifactKey,
  name,
  fetchBody,
  refreshKey = 0,
}) => {
  const [body, setBody] = React.useState<RawArtifactBody | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchBody(artifactKey)
      .then((b) => {
        if (!mounted) return;
        if (b) setBody(b);
        else setError("Artifact not found in R2 or could not be read.");
      })
      .catch((e: unknown) => {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [artifactKey, refreshKey, fetchBody]);

  const lang = langFor(name);

  // Build a Blob for the current body. Memoized so the same instance
  // backs both the download and the open-in-new-tab paths, and so we
  // can revoke any previously-issued object URL when the body changes.
  const blob = React.useMemo(() => {
    if (!body) return null;
    return new Blob([body.content], { type: MIME_BY_LANG[lang] });
  }, [body, lang]);

  const downloadHandler = React.useCallback(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = basename(name);
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Defer revoke so Firefox actually saves before the URL is freed.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [blob, name]);

  const openHandler = React.useCallback(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) {
      // Popup blocker. Fall back to a manual <a target="_blank"> click.
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    // Revoke after the new tab has had time to load the resource.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }, [blob]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-panel)" }}>
      <div
        style={{
          padding: "8px 12px 8px 16px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
          color: "var(--fg-muted)",
        }}
      >
        <Icon name={HEADER_ICON[lang]} size={13} style={{ color: "var(--accent)" }} />
        <span style={{ color: "var(--fg-strong)" }}>{name}</span>
        <span>·</span>
        <span>{lang}</span>
        {body && (
          <>
            <span>·</span>
            <span>{(body.content.length / 1024).toFixed(1)} kb</span>
          </>
        )}
        <span
          style={{
            marginLeft: "auto",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 320,
            fontSize: 10.5,
            color: "var(--fg-faint)",
          }}
          title={artifactKey}
        >
          {artifactKey}
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            paddingLeft: 8,
            borderLeft: "1px solid var(--border-subtle)",
            marginLeft: 4,
          }}
        >
          <ActionBtn
            icon="expand"
            title="Open in new tab"
            onClick={openHandler}
            disabled={!body || loading}
          />
          <ActionBtn
            icon="download"
            title={`Download ${basename(name)}`}
            onClick={downloadHandler}
            disabled={!body || loading}
          />
        </span>
      </div>

      <div style={{ flex: 1, overflow: "auto", background: "var(--bg-panel)" }}>
        {loading && (
          <div style={{ padding: 40, color: "var(--fg-faint)", fontSize: 13, fontStyle: "italic" }}>
            Loading {name}…
          </div>
        )}
        {!loading && error && (
          <div style={{ padding: 40, color: "var(--negative-fg)", fontSize: 13 }}>
            <div style={{ fontWeight: 500, marginBottom: 6 }}>Could not load artifact</div>
            <div style={{ color: "var(--fg-muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{error}</div>
          </div>
        )}
        {!loading && !error && body && <ContentBody lang={lang} content={body.content} />}
      </div>
    </div>
  );
};

const ContentBody: React.FC<{ lang: Lang; content: string }> = ({ lang, content }) => {
  if (lang === "markdown") return <MarkdownBody content={content} />;
  if (lang === "yaml") return <CodeBody content={content} highlight={highlightYaml} />;
  if (lang === "json") return <CodeBody content={content} highlight={highlightJson} />;
  return <CodeBody content={content} highlight={null} />;
};

// ── Markdown rendering ──────────────────────────────────────────────
// Light, dependency-free transform that handles the formatting the
// orchestrator emits in practice: headings, bold, italic, inline code,
// fenced code blocks, bullet/numbered lists, and blockquotes.
const MarkdownBody: React.FC<{ content: string }> = ({ content }) => {
  const blocks = React.useMemo(() => parseMarkdown(content), [content]);
  return (
    <article
      style={{
        maxWidth: 820,
        margin: "0 auto",
        padding: "32px 48px 80px",
        fontFamily: "var(--font-serif)",
        fontSize: 16,
        lineHeight: 1.65,
        color: "var(--fg-base)",
      }}
    >
      {blocks.map((b, i) => (
        <MarkdownBlock key={i} block={b} />
      ))}
    </article>
  );
};

type MdBlock =
  | { type: "h"; level: 1 | 2 | 3 | 4; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; lang: string; content: string }
  | { type: "quote"; text: string }
  | { type: "hr" };

function parseMarkdown(src: string): MdBlock[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const lang = fence[1] || "";
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing fence
      out.push({ type: "code", lang, content: buf.join("\n") });
      continue;
    }

    // Headings
    const h = line.match(/^(#{1,4})\s+(.+)$/);
    if (h) {
      out.push({ type: "h", level: h[1].length as 1 | 2 | 3 | 4, text: h[2] });
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^-{3,}\s*$/.test(line) || /^\*{3,}\s*$/.test(line)) {
      out.push({ type: "hr" });
      i += 1;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        buf.push(lines[i].slice(2));
        i += 1;
      }
      out.push({ type: "quote", text: buf.join(" ") });
      continue;
    }

    // Bullet list
    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+]\s+/, ""));
        i += 1;
      }
      out.push({ type: "ul", items });
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      out.push({ type: "ol", items });
      continue;
    }

    // Paragraph (collect until blank line)
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,4}\s|```|>\s|[-*+]\s|\d+\.\s|-{3,}\s*$|\*{3,}\s*$)/.test(lines[i])) {
      buf.push(lines[i]);
      i += 1;
    }
    out.push({ type: "p", text: buf.join(" ") });
  }
  return out;
}

const inlineMd = (s: string): React.ReactNode => {
  // Inline: **bold**, *italic*, `code`. Sequential pass over the string.
  const out: React.ReactNode[] = [];
  let rest = s;
  let key = 0;
  const patterns: { re: RegExp; render: (m: RegExpExecArray) => React.ReactNode }[] = [
    { re: /\*\*([^*]+)\*\*/, render: (m) => <strong key={key++}>{m[1]}</strong> },
    { re: /\*([^*]+)\*/, render: (m) => <em key={key++}>{m[1]}</em> },
    { re: /`([^`]+)`/, render: (m) => (
        <code
          key={key++}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.9em",
            background: "var(--bg-sunken)",
            padding: "1px 5px",
            borderRadius: 3,
            color: "var(--code-fg)",
          }}
        >
          {m[1]}
        </code>
      ) },
  ];
  while (rest.length > 0) {
    let earliest: { idx: number; len: number; node: React.ReactNode } | null = null;
    for (const { re, render } of patterns) {
      const m = re.exec(rest);
      if (m && (earliest == null || m.index < earliest.idx)) {
        earliest = { idx: m.index, len: m[0].length, node: render(m) };
      }
    }
    if (!earliest) {
      out.push(rest);
      break;
    }
    if (earliest.idx > 0) out.push(rest.slice(0, earliest.idx));
    out.push(earliest.node);
    rest = rest.slice(earliest.idx + earliest.len);
  }
  return out;
};

const MarkdownBlock: React.FC<{ block: MdBlock }> = ({ block }) => {
  if (block.type === "h") {
    const sizes = { 1: 32, 2: 24, 3: 19, 4: 16 } as const;
    const margins = { 1: "0 0 18px", 2: "32px 0 14px", 3: "26px 0 10px", 4: "20px 0 8px" } as const;
    const Tag = (`h${block.level}` as unknown) as keyof React.JSX.IntrinsicElements;
    return (
      <Tag
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: sizes[block.level],
          fontWeight: 500,
          color: "var(--fg-strong)",
          letterSpacing: "-0.01em",
          margin: margins[block.level],
          lineHeight: 1.25,
        }}
      >
        {inlineMd(block.text)}
      </Tag>
    );
  }
  if (block.type === "p")
    return <p style={{ margin: "0 0 16px" }}>{inlineMd(block.text)}</p>;
  if (block.type === "ul")
    return (
      <ul style={{ margin: "0 0 16px", paddingLeft: 22 }}>
        {block.items.map((it, i) => (
          <li key={i} style={{ marginBottom: 6 }}>
            {inlineMd(it)}
          </li>
        ))}
      </ul>
    );
  if (block.type === "ol")
    return (
      <ol style={{ margin: "0 0 16px", paddingLeft: 22 }}>
        {block.items.map((it, i) => (
          <li key={i} style={{ marginBottom: 6 }}>
            {inlineMd(it)}
          </li>
        ))}
      </ol>
    );
  if (block.type === "code")
    return (
      <pre
        style={{
          margin: "0 0 16px",
          padding: "14px 16px",
          background: "var(--bg-sunken)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          fontFamily: "var(--font-mono)",
          fontSize: 12.5,
          lineHeight: 1.55,
          color: "var(--code-fg)",
          overflow: "auto",
        }}
      >
        {block.content}
      </pre>
    );
  if (block.type === "quote")
    return (
      <blockquote
        style={{
          margin: "0 0 16px",
          padding: "4px 0 4px 14px",
          borderLeft: "3px solid var(--quote-rule)",
          fontStyle: "italic",
          color: "var(--fg-muted)",
        }}
      >
        {inlineMd(block.text)}
      </blockquote>
    );
  if (block.type === "hr")
    return <hr style={{ margin: "24px 0", border: 0, borderTop: "1px solid var(--border-base)" }} />;
  return null;
};

// ── Code rendering (yaml / json / plain) ────────────────────────────
const CodeBody: React.FC<{ content: string; highlight: ((line: string) => React.ReactNode) | null }> = ({
  content,
  highlight,
}) => (
  <pre
    style={{
      margin: 0,
      padding: "20px 24px",
      fontFamily: "var(--font-mono)",
      fontSize: 12.5,
      lineHeight: 1.65,
      color: "var(--code-fg)",
      whiteSpace: "pre",
      tabSize: 2,
    }}
  >
    {highlight
      ? content.split("\n").map((line, i) => (
          <div key={i}>{highlight(line)}</div>
        ))
      : content}
  </pre>
);

function highlightYaml(line: string): React.ReactNode {
  if (/^\s*#/.test(line)) return <span style={{ color: "var(--code-comment)" }}>{line}</span>;
  const m = line.match(/^(\s*)(-?\s*)([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
  if (m) {
    const [, indent, dash, key, val] = m;
    return (
      <>
        {indent}
        {dash && <span style={{ color: "var(--code-keyword)" }}>{dash}</span>}
        <span style={{ color: "var(--code-key)" }}>{key}</span>: <span style={{ color: "var(--code-string)" }}>{val}</span>
      </>
    );
  }
  return line;
}

function highlightJson(line: string): React.ReactNode {
  // Very lightweight: color keys, strings, numbers, booleans/null.
  const out: React.ReactNode[] = [];
  let rest = line;
  let key = 0;
  const re = /("(?:[^"\\]|\\.)*")\s*:|("(?:[^"\\]|\\.)*")|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest))) {
    if (m.index > last) out.push(rest.slice(last, m.index));
    if (m[1]) {
      out.push(<span key={key++} style={{ color: "var(--code-key)" }}>{m[1]}</span>);
      out.push(":");
    } else if (m[2]) {
      out.push(<span key={key++} style={{ color: "var(--code-string)" }}>{m[2]}</span>);
    } else if (m[3]) {
      out.push(<span key={key++} style={{ color: "var(--code-keyword)" }}>{m[3]}</span>);
    } else if (m[4]) {
      out.push(<span key={key++} style={{ color: "var(--code-number)" }}>{m[4]}</span>);
    }
    last = m.index + m[0].length;
  }
  if (last < rest.length) out.push(rest.slice(last));
  return out;
}
