import * as React from "react";
import { Streamdown } from "streamdown";
import { parseMarkers, type MarkerBlock } from "./parse-markers";
import {
  ToolMarker,
  TaskMarker,
  ReasoningMarker,
  PlanMarker,
  ConfirmationMarker,
  SourcesMarker,
} from "./markers";

export interface ResponseProps {
  /** The (possibly partial) markdown text to render. */
  children: string;
  /** Whether the text is still streaming — hints to Streamdown. */
  streaming?: boolean;
  /** Called when the user clicks "Approve" inside an HITM confirmation marker. */
  onHitmApprove?: (phaseId: string) => void;
  /** Optional reject handler — when omitted, the reject button is hidden. */
  onHitmReject?: (phaseId: string) => void;
}

/**
 * Render an assistant response as a sequence of structured blocks.
 *
 *   1. Split the text on our marker fences (```tool, ```plan, …).
 *   2. Plain-text segments → `<Streamdown>` for proper markdown
 *      rendering (bold, lists, tables, fenced code via Shiki, etc.).
 *      This is the core fix for the "big text blob" complaint.
 *   3. Marker segments → the matching specialist component
 *      (ToolMarker, TaskMarker, …).
 *
 * The renderer is safe to call on every keystroke during a stream —
 * the parser is lightweight and Streamdown is memoized internally.
 */
export const Response: React.FC<ResponseProps> = ({ children, streaming, onHitmApprove, onHitmReject }) => {
  const blocks = React.useMemo(() => parseMarkers(children), [children]);

  return (
    <div className="ui-ai-response" style={responseStyles}>
      {/* Markdown styles scoped via a wrapping class to avoid leaking
          into the rest of the app. Streamdown emits plain HTML
          (h1/h2/h3, ul/ol/li, p, strong, em, code, pre, table) — we
          tame those with the small reset below. */}
      <style>{`
        .ui-ai-response p { margin: 0 0 8px; }
        .ui-ai-response p:last-child { margin-bottom: 0; }
        .ui-ai-response h1, .ui-ai-response h2, .ui-ai-response h3 {
          font-family: var(--font-serif);
          font-weight: 600;
          color: var(--fg-strong);
          line-height: 1.25;
          margin: 14px 0 6px;
        }
        .ui-ai-response h1 { font-size: 17px; }
        .ui-ai-response h2 { font-size: 15px; }
        .ui-ai-response h3 { font-size: 13.5px; }
        .ui-ai-response ul, .ui-ai-response ol {
          margin: 4px 0 8px;
          padding-left: 22px;
        }
        .ui-ai-response li { margin: 2px 0; }
        .ui-ai-response li > p { margin: 0; }
        .ui-ai-response strong { color: var(--fg-strong); font-weight: 600; }
        .ui-ai-response em { color: var(--fg-base); }
        .ui-ai-response a {
          color: var(--accent-fg);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .ui-ai-response a:hover { color: var(--accent); }
        .ui-ai-response code:not(pre code) {
          font-family: var(--font-mono);
          font-size: 0.92em;
          padding: 1px 5px;
          border-radius: 3px;
          background: var(--bg-sunken);
          color: var(--code-fg);
        }
        .ui-ai-response pre {
          margin: 8px 0;
          padding: 10px 12px;
          border-radius: 6px;
          background: var(--bg-sunken);
          border: 1px solid var(--border-subtle);
          overflow: auto;
          font-family: var(--font-mono);
          font-size: 11.5px;
          line-height: 1.55;
          color: var(--code-fg);
        }
        .ui-ai-response pre code { background: transparent; padding: 0; }
        .ui-ai-response blockquote {
          margin: 8px 0;
          padding: 4px 12px;
          border-left: 3px solid var(--border-base);
          color: var(--fg-muted);
          font-style: italic;
        }
        .ui-ai-response table {
          border-collapse: collapse;
          margin: 8px 0;
          font-size: 12px;
          width: 100%;
        }
        .ui-ai-response th, .ui-ai-response td {
          border: 1px solid var(--border-subtle);
          padding: 5px 9px;
          text-align: left;
        }
        .ui-ai-response th {
          background: var(--bg-sunken);
          color: var(--fg-strong);
          font-weight: 600;
        }
        .ui-ai-response hr {
          border: 0;
          border-top: 1px solid var(--border-subtle);
          margin: 12px 0;
        }
      `}</style>
      {blocks.map((b, i) => {
        if (b.kind === "text") {
          return (
            <Streamdown key={i} mode={streaming ? "streaming" : "static"} parseIncompleteMarkdown>
              {b.body}
            </Streamdown>
          );
        }
        return <Marker key={i} block={b} onApprove={onHitmApprove} onReject={onHitmReject} />;
      })}
    </div>
  );
};

const responseStyles: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: 13.5,
  lineHeight: 1.6,
  color: "var(--fg-base)",
};

const Marker: React.FC<{
  block: MarkerBlock;
  onApprove?: (phaseId: string) => void;
  onReject?: (phaseId: string) => void;
}> = ({ block, onApprove, onReject }) => {
  switch (block.kind) {
    case "tool":
      return <ToolMarker block={block} />;
    case "task":
      return <TaskMarker block={block} />;
    case "reasoning":
      return <ReasoningMarker block={block} />;
    case "plan":
      return <PlanMarker block={block} />;
    case "hitm-confirm":
      return <ConfirmationMarker block={block} onApprove={onApprove} onReject={onReject} />;
    case "sources":
      return <SourcesMarker block={block} />;
    default:
      return null;
  }
};
