import { describe, expect, it } from 'vitest';

import { normalizeDrawShapesArgs } from '../../src/agents/tools/drawingTools';

describe('normalizeDrawShapesArgs', () => {
 it('converts excalidraw elements array to shapes', () => {
 const result = normalizeDrawShapesArgs({
 elements: [
 { type: 'rectangle', x: 10, y: 20, width: 100, height: 50 },
 { type: 'ellipse', x: 0, y: 0, width: 40, height: 40 },
 ],
 });
 expect(result.error).toBeUndefined();
 expect(Array.isArray(result.args.shapes)).toBe(true);
 const shapes = result.args.shapes as Array<{ kind: string }>;
 expect(shapes).toHaveLength(2);
 expect(shapes[0]?.kind).toBe('box');
 expect(shapes[1]?.kind).toBe('ellipse');
 });

 it('converts raw tldraw geo record to box shape', () => {
 const result = normalizeDrawShapesArgs({
 type: 'geo',
 x: 5,
 y: 10,
 props: { geo: 'rectangle', w: 80, h: 60 },
 });
 expect(result.error).toBeUndefined();
 const shapes = result.args.shapes as Array<{ kind: string; geometry: { kind: string } }>;
 expect(shapes).toHaveLength(1);
 expect(shapes[0]?.kind).toBe('box');
 expect(shapes[0]?.geometry.kind).toBe('rect');
 });

 it('maps kind aliases triangle/circle/geo to box/ellipse', () => {
 const result = normalizeDrawShapesArgs({
 shapes: [
 { kind: 'triangle', x: 0, y: 0, w: 50, h: 50 },
 { kind: 'circle', x: 60, y: 0, w: 40, h: 40 },
 { kind: 'geo', x: 120, y: 0, width: 30, height: 30 },
 ],
 });
 expect(result.error).toBeUndefined();
 const shapes = result.args.shapes as Array<{ kind: string }>;
 expect(shapes.map((shape) => shape.kind)).toEqual(['box', 'ellipse', 'box']);
 });

 it('returns actionable error when zero shapes after normalize', () => {
 const result = normalizeDrawShapesArgs({ elements: [{ type: 'unknown-thing' }] });
 expect(result.error).toMatch(/at least one shape after normalization/i);
 expect(Array.isArray(result.args.shapes) ? result.args.shapes.length: 0).toBe(0);
 });

 it('preserves canonical shapes array unchanged', () => {
 const canonical = {
 shapes: [{ kind: 'box', geometry: { kind: 'rect', x: 0, y: 0, w: 10, h: 10 } }],
 };
 const result = normalizeDrawShapesArgs(canonical);
 expect(result.error).toBeUndefined();
 expect(result.args.shapes).toEqual(canonical.shapes);
 });

 it('hoists width/height onto box entries into rect geometry', () => {
 const result = normalizeDrawShapesArgs({
 shapes: [{ kind: 'box', x: 10, y: 20, width: 100, height: 50 }],
 });
 expect(result.error).toBeUndefined();
 const shapes = result.args.shapes as Array<{ geometry: { kind: string; w: number; h: number } }>;
 expect(shapes[0]?.geometry).toEqual({ kind: 'rect', x: 10, y: 20, w: 100, h: 50 });
 });

 it('accepts freehand points as [x,y] tuples', () => {
 const result = normalizeDrawShapesArgs({
 shapes: [
 {
 kind: 'freehand',
 points: [
 [385, 190],
 [390, 190],
 [395, 200],
 ],
 },
 ],
 });
 expect(result.error).toBeUndefined();
 const shapes = result.args.shapes as Array<{
 kind: string;
 geometry: { kind: string; points: Array<{ x: number; y: number }> };
 }>;
 expect(shapes[0]?.kind).toBe('freehand');
 expect(shapes[0]?.geometry.kind).toBe('points');
 expect(shapes[0]?.geometry.points).toEqual([
 { x: 385, y: 190 },
 { x: 390, y: 190 },
 { x: 395, y: 200 },
 ]);
 });
});
