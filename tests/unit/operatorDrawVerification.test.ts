import { describe, expect, it } from 'vitest';
import { verifyOperatorDrawVisibility } from '../../src/agents/surface/operatorDrawVerification';

describe('verifyOperatorDrawVisibility (strict)', () => {
 it('fails when read_canvas after count is zero', () => {
 const verdict = verifyOperatorDrawVisibility({
 drawResult: {
 ok: true,
 result: { createdShapeIds: ['shape:cat-head'] },
 },
 shapesBeforeDraw: { count: 0, blueGeo: 0 },
 shapesAfterDraw: { count: 0, blueGeo: 0 },
 pageShapeCountBefore: 0,
 });
 expect(verdict.visibleOnCanvas).toBe(false);
 });

 it('fails when read_canvas after count did not increase and store shows no persistence', () => {
 const verdict = verifyOperatorDrawVisibility({
 drawResult: {
 ok: true,
 result: {
 createdShapeIds: ['shape:cat-head', 'shape:cat-body'],
 _store: { bound: true, pageShapeCount: 3, createdFound: 0 },
 },
 },
 shapesBeforeDraw: { count: 3, blueGeo: 1 },
 shapesAfterDraw: { count: 3, blueGeo: 1 },
 pageShapeCountBefore: 3,
 pageShapeCountAfter: 3,
 });
 expect(verdict.visibleOnCanvas).toBe(false);
 expect(verdict.countIncreased).toBe(false);
 });

 it('passes freehand heart when store persisted, read count unchanged, page count increased', () => {
 const verdict = verifyOperatorDrawVisibility({
 drawResult: {
 ok: true,
 result: {
 createdShapeIds: ['shape:heart-outline'],
 _store: { bound: true, pageShapeCount: 5, createdFound: 1 },
 },
 },
 shapesBeforeDraw: { count: 3, blueGeo: 0 },
 shapesAfterDraw: { count: 3, blueGeo: 0 },
 pageShapeCountBefore: 4,
 pageShapeCountAfter: 5,
 });
 expect(verdict.visibleOnCanvas).toBe(true);
 expect(verdict.countIncreased).toBe(true);
 });

 it('detects read_canvas count increase even when store is unavailable in unit tests', () => {
 const verdict = verifyOperatorDrawVisibility({
 drawResult: {
 ok: true,
 result: {
 createdShapeIds: ['shape:cat-head', 'shape:cat-body'],
 _shapesBeforeDraw: 2,
 _shapesAfterDraw: 9,
 },
 },
 shapesBeforeDraw: { count: 2, blueGeo: 0 },
 shapesAfterDraw: { count: 9, blueGeo: 4 },
 pageShapeCountBefore: 2,
 });
 expect(verdict.countIncreased).toBe(true);
 expect(verdict.shapesAfterDraw?.count).toBe(9);
 });
});
