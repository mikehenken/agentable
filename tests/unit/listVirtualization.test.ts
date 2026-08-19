/**
 * unit coverage: the declared virtualization threshold, the pure
 * windowing math behind `<agentable-virtual-list>`, and row extraction
 * from bound list data. The 117-row bounded-DOM integration assertion
 * lives in `tests/integration/listVirtualization117.test.tsx`.
 */
import { describe, expect, it } from 'vitest';
import {
 computeVirtualWindow,
 DEFAULT_OVERSCAN_ROWS,
 DEFAULT_ROW_HEIGHT_PX,
 DEFAULT_VIEWPORT_HEIGHT_PX,
 extractListRows,
 LIST_VIRTUALIZATION_THRESHOLD,
 maxWindowRowCount,
 shouldVirtualize,
} from '../../src/panels/catalog/virtualization';

describe('declared threshold', () => {
 it('declares a positive threshold below the 117-row reference load', () => {
 expect(LIST_VIRTUALIZATION_THRESHOLD).toBeGreaterThan(0);
 expect(LIST_VIRTUALIZATION_THRESHOLD).toBeLessThan(117);
 });

 it('windows only above the threshold, not at it', () => {
 expect(shouldVirtualize(LIST_VIRTUALIZATION_THRESHOLD, LIST_VIRTUALIZATION_THRESHOLD)).toBe(false,
 );
 expect(shouldVirtualize(LIST_VIRTUALIZATION_THRESHOLD + 1, LIST_VIRTUALIZATION_THRESHOLD),
 ).toBe(true);
 expect(shouldVirtualize(117, LIST_VIRTUALIZATION_THRESHOLD)).toBe(true);
 expect(shouldVirtualize(0, LIST_VIRTUALIZATION_THRESHOLD)).toBe(false);
 });
});

describe('computeVirtualWindow', () => {
 const base = {
 viewportHeightPx: DEFAULT_VIEWPORT_HEIGHT_PX,
 rowHeightPx: DEFAULT_ROW_HEIGHT_PX,
 itemCount: 117,
 overscanRows: DEFAULT_OVERSCAN_ROWS,
 };

 it('starts at the top with no top spacer', () => {
 const window = computeVirtualWindow({...base, scrollTop: 0 });
 expect(window.start).toBe(0);
 expect(window.padTopPx).toBe(0);
 expect(window.end).toBeLessThanOrEqual(maxWindowRowCount(base.viewportHeightPx, base.rowHeightPx, base.overscanRows),
 );
 expect(window.padBottomPx).toBe((117 - window.end) * DEFAULT_ROW_HEIGHT_PX);
 });

 it('keeps spacers plus window rows summing to the full scroll height', () => {
 for (const scrollTop of [0, 37, 400, 1999, 4280, 999999]) {
 const window = computeVirtualWindow({...base, scrollTop });
 const windowRows = window.end - window.start;
 expect(window.padTopPx + window.padBottomPx + windowRows * DEFAULT_ROW_HEIGHT_PX).toBe(
 117 * DEFAULT_ROW_HEIGHT_PX,
 );
 expect(windowRows).toBeLessThanOrEqual(maxWindowRowCount(base.viewportHeightPx, base.rowHeightPx, base.overscanRows),
 );
 }
 });

 it('clamps overscroll to the last window instead of running past the end', () => {
 const window = computeVirtualWindow({...base, scrollTop: Number.MAX_SAFE_INTEGER });
 expect(window.end).toBe(117);
 expect(window.padBottomPx).toBe(0);
 expect(window.start).toBeGreaterThan(0);
 });

 it('clamps negative scroll to the first window', () => {
 const window = computeVirtualWindow({...base, scrollTop: -500 });
 expect(window.start).toBe(0);
 expect(window.padTopPx).toBe(0);
 });

 it('handles an empty list', () => {
 const window = computeVirtualWindow({...base, itemCount: 0, scrollTop: 0 });
 expect(window).toEqual({ start: 0, end: 0, padTopPx: 0, padBottomPx: 0 });
 });

 it('rejects a non-positive row height loudly', () => {
 expect(() => computeVirtualWindow({...base, rowHeightPx: 0, scrollTop: 0 })).toThrow(
 /positive row height/,
 );
 expect(() => maxWindowRowCount(400, -1, 6)).toThrow(/positive row height/);
 });

 it('rejects a negative item count loudly', () => {
 expect(() => computeVirtualWindow({...base, itemCount: -1, scrollTop: 0 })).toThrow(
 /non-negative item count/,
 );
 });
});

describe('extractListRows', () => {
 const items = [
 { id: 7, title: 'Safety Manager', department: 'EHS' },
 { id: 9, title: 'Project Engineer', department: 'Operations' },
 ];

 it('maps template fields, bare and $row-prefixed, onto rows', () => {
 const bare = extractListRows(items, { title: 'title', subtitle: 'department' }, undefined);
 const prefixed = extractListRows(items,
 { title: '$row.title', subtitle: '$row.department' },
 undefined,
 );
 expect(bare).toEqual([
 { key: '7', title: 'Safety Manager', subtitle: 'EHS' },
 { key: '9', title: 'Project Engineer', subtitle: 'Operations' },
 ]);
 expect(prefixed).toEqual(bare);
 });

 it('uses the configured key field and disambiguates collisions', () => {
 const rows = extractListRows(
 [
 { slug: 'a', title: 'one' },
 { slug: 'a', title: 'two' },
 { title: 'three' },
 ],
 { title: 'title' },
 'slug',
 );
 expect(rows?.map((row) => row.key)).toEqual(['a', 'a#1', 'row-2']);
 });

 it('returns null for non-array, empty, or non-record data', () => {
 expect(extractListRows('career.jobs-v0', { title: 'title' }, undefined)).toBeNull();
 expect(extractListRows(undefined, { title: 'title' }, undefined)).toBeNull();
 expect(extractListRows([], { title: 'title' }, undefined)).toBeNull();
 expect(extractListRows([1, 2, 3], { title: 'title' }, undefined)).toBeNull();
 expect(extractListRows([{ id: 1 }, null], { title: 'title' }, undefined)).toBeNull();
 });

 it('renders missing or non-primitive template fields as empty text', () => {
 const rows = extractListRows(
 [{ id: 1, title: { nested: true }, department: 42 }],
 { title: 'title', subtitle: 'department' },
 undefined,
 );
 expect(rows).toEqual([{ key: '1', title: '', subtitle: '42' }]);
 });
});
