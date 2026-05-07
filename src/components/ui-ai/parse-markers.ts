/**
 * Parse a markdown string into a sequence of "blocks" — either plain
 * text (rendered by Streamdown) or one of our structured marker
 * blocks (rendered by Tool/Task/Reasoning/Plan/Confirmation/Sources).
 *
 * Marker grammar — the assistant emits a fenced code block whose
 * info-string is one of our known marker names:
 *
 *   ```tool
 *   { "name": "list_phases", "input": {...}, "output": "..." }
 *   ```
 *
 *   ```reasoning duration_s=12.4
 *   First I check the run state, then I…
 *   ```
 *
 *   ```plan
 *   { "title": "Linear clone", "steps": [...] }
 *   ```
 *
 * Anything outside these fences is treated as ordinary markdown and
 * routed through Streamdown's default renderer (which already handles
 * standard fenced code via Shiki, lists, tables, etc.).
 *
 * The parser is deliberately tolerant of incomplete output (mid-stream
 * partial fences) so the streaming UI doesn't strobe between renders.
 * If we see an open fence with no close, we treat the rest of the
 * string as the marker body.
 */

export type MarkerKind =
  | "tool"
  | "task"
  | "reasoning"
  | "plan"
  | "hitm-confirm"
  | "sources";

const MARKER_NAMES: readonly MarkerKind[] = [
  "tool",
  "task",
  "reasoning",
  "plan",
  "hitm-confirm",
  "sources",
];

export interface TextBlock {
  kind: "text";
  body: string;
}

export interface MarkerBlock {
  kind: MarkerKind;
  /** Raw body of the marker (text between the fences). */
  body: string;
  /** Optional info-string params, e.g. `duration_s=12.4`. */
  meta: Record<string, string>;
  /** Best-effort JSON parse of the body. `null` if it doesn't look like JSON. */
  json: unknown;
  /** True when we hit EOF before the closing fence. */
  partial: boolean;
}

export type Block = TextBlock | MarkerBlock;

/** Build a single regex that matches an opening fence with one of our marker languages. */
const OPEN_FENCE = new RegExp(
  String.raw`(^|\n)\x60\x60\x60(${MARKER_NAMES.join("|")})\b([^\n]*)\n`,
);

/**
 * Parse `text` into a flat list of blocks. Pure function; safe to
 * call on every render (the result is small and the regex is fast).
 */
export function parseMarkers(text: string): Block[] {
  const blocks: Block[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const rest = text.slice(cursor);
    const m = rest.match(OPEN_FENCE);
    if (!m || m.index === undefined) {
      // No more markers — flush the remaining text.
      if (rest.length > 0) blocks.push({ kind: "text", body: rest });
      break;
    }

    // Text before the fence.
    const prefixEnd = m.index + (m[1] ? m[1].length : 0);
    if (prefixEnd > 0) {
      const before = rest.slice(0, prefixEnd);
      if (before.trim().length > 0) blocks.push({ kind: "text", body: before });
    }

    const kind = m[2] as MarkerKind;
    const meta = parseMeta(m[3] ?? "");
    const fenceEnd = m.index + m[0].length;
    const afterFence = rest.slice(fenceEnd);

    // Find the closing fence. We look for `\n```` on its own line OR
    // at end-of-string. If none, treat the rest as a partial.
    const close = afterFence.match(/\n\x60\x60\x60(?:\n|$)/);
    if (close && close.index !== undefined) {
      const body = afterFence.slice(0, close.index);
      blocks.push({
        kind,
        body,
        meta,
        json: tryParseJson(body),
        partial: false,
      });
      cursor += fenceEnd + close.index + close[0].length;
    } else {
      // No close — treat as partial, consume to EOF.
      blocks.push({
        kind,
        body: afterFence,
        meta,
        json: tryParseJson(afterFence),
        partial: true,
      });
      cursor = text.length;
    }
  }

  return blocks;
}

/** Parse `key=value key2="value with spaces"` style info-string params. */
function parseMeta(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(\w[\w-]*)=("([^"]*)"|(\S+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    out[m[1]] = m[3] ?? m[4] ?? "";
  }
  return out;
}

function tryParseJson(s: string): unknown {
  const trimmed = s.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}
