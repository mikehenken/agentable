/**
 * D56 list virtualization (02 section 21, 06 P1 item 8): any catalog
 * list/collection view windows above a declared item threshold. This
 * module owns that declared threshold and the pure windowing math; the
 * `agentable-virtual-list` element applies it with Lit `repeat` and
 * stable keys (the Lit performance rule). The 117-job moss fixture is
 * the reference load; the automated check asserts the rendered DOM node
 * count stays bounded for 117 rows.
 */

/**
 * The declared virtualization threshold. A list with more items than
 * this windows its rows; at or below it, every row renders (still via
 * `repeat` with stable keys). Hosts may override per element instance
 * through the `threshold` property.
 */
export const LIST_VIRTUALIZATION_THRESHOLD = 50;

/** Fixed row height the windowing math assumes, in CSS pixels. */
export const DEFAULT_ROW_HEIGHT_PX = 40;

/** Scroll viewport height when the host supplies none, in CSS pixels. */
export const DEFAULT_VIEWPORT_HEIGHT_PX = 400;

/** Extra rows rendered above and below the visible range. */
export const DEFAULT_OVERSCAN_ROWS = 6;

/** A half-open row range [start, end) plus the spacer heights around it. */
export interface VirtualWindow {
  start: number;
  end: number;
  padTopPx: number;
  padBottomPx: number;
}

export interface VirtualWindowInput {
  scrollTop: number;
  viewportHeightPx: number;
  rowHeightPx: number;
  itemCount: number;
  overscanRows: number;
}

export function shouldVirtualize(itemCount: number, threshold: number): boolean {
  return itemCount > threshold;
}

/**
 * Upper bound on rows a virtualized window may render: the rows that fit
 * the viewport, one partial row at each edge, plus overscan on both
 * sides. The bounded-DOM assertion tests against this number.
 */
export function maxWindowRowCount(
  viewportHeightPx: number,
  rowHeightPx: number,
  overscanRows: number,
): number {
  if (rowHeightPx <= 0) {
    throw new Error(`maxWindowRowCount requires a positive row height, got ${rowHeightPx}`);
  }
  return Math.ceil(viewportHeightPx / rowHeightPx) + 1 + overscanRows * 2;
}

export function computeVirtualWindow(input: VirtualWindowInput): VirtualWindow {
  const { viewportHeightPx, rowHeightPx, itemCount, overscanRows } = input;
  if (rowHeightPx <= 0) {
    throw new Error(`computeVirtualWindow requires a positive row height, got ${rowHeightPx}`);
  }
  if (itemCount < 0) {
    throw new Error(`computeVirtualWindow requires a non-negative item count, got ${itemCount}`);
  }
  const maxScrollTop = Math.max(0, itemCount * rowHeightPx - viewportHeightPx);
  const scrollTop = Math.min(Math.max(0, input.scrollTop), maxScrollTop);
  const firstVisible = Math.floor(scrollTop / rowHeightPx);
  const visibleCount = Math.ceil(viewportHeightPx / rowHeightPx) + 1;
  const start = Math.max(0, firstVisible - overscanRows);
  const end = Math.min(itemCount, firstVisible + visibleCount + overscanRows);
  return {
    start,
    end,
    padTopPx: start * rowHeightPx,
    padBottomPx: (itemCount - end) * rowHeightPx,
  };
}

/** One displayable row extracted from bound list data via the row template. */
export interface VirtualListRow {
  key: string;
  title: string;
  subtitle: string | null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Row templates reference item fields either bare (`"title"`) or with the
 * `$row.` binding prefix (`"$row.title"`, 02 section 2 rules).
 */
function templateFieldName(templateValue: unknown): string | null {
  if (typeof templateValue !== 'string' || templateValue.length === 0) return null;
  const ROW_PREFIX = '$row.';
  const name = templateValue.startsWith(ROW_PREFIX)
    ? templateValue.slice(ROW_PREFIX.length)
    : templateValue;
  return name.length > 0 ? name : null;
}

function primitiveText(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

/**
 * Extract displayable rows from a list node's bound data. Returns null
 * when the data is not a non-empty array of records, in which case the
 * component falls back to its legacy presentational output.
 *
 * Keys come from the `rowKey` field (default `id`) so `repeat` reuses
 * DOM across window moves and reorders. Items missing that field fall
 * back to their index, and any collision is disambiguated with the index
 * so `repeat` never sees duplicate keys.
 */
export function extractListRows(
  data: unknown,
  rowTemplate: Record<string, unknown> | undefined,
  rowKeyField: string | undefined,
): VirtualListRow[] | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  if (!data.every(isPlainRecord)) return null;

  const titleField = templateFieldName(rowTemplate?.title);
  const subtitleField = templateFieldName(rowTemplate?.subtitle);
  const keyField = rowKeyField !== undefined && rowKeyField.length > 0 ? rowKeyField : 'id';

  const seenKeys = new Set<string>();
  return data.map((item, index) => {
    const preferred = primitiveText(item[keyField]) ?? `row-${index}`;
    const key = seenKeys.has(preferred) ? `${preferred}#${index}` : preferred;
    seenKeys.add(key);
    const title = titleField !== null ? (primitiveText(item[titleField]) ?? '') : '';
    const subtitle = subtitleField !== null ? primitiveText(item[subtitleField]) : null;
    return { key, title, subtitle };
  });
}
