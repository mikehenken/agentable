import { describe, expect, it } from 'vitest';

import {
  buildOperatorCatDrawShapes,
  buildOperatorHeartDrawShapes,
  buildOperatorOfflineDrawArgs,
  isExactOperatorDemoDrawIntent,
  resolveOperatorDrawSubject,
} from '../../src/agents/surface/operatorOfflineDrawFixtures';

const TEST_VIEWPORT = { x: 0, y: 0, w: 960, h: 640 };
const VIEWPORT_CX = TEST_VIEWPORT.x + TEST_VIEWPORT.w / 2;
const VIEWPORT_CY = TEST_VIEWPORT.y + TEST_VIEWPORT.h / 2;

type PointsGeometry = {
  kind: 'points';
  points: Array<{ x: number; y: number }>;
  closed?: boolean;
};

function shapeIds(args: Record<string, unknown>): string[] {
  const shapes = args.shapes;
  if (!Array.isArray(shapes)) {
    return [];
  }
  return shapes.map((shape) => {
      if (typeof shape === 'object' && shape !== null && 'id' in shape) {
        const id = (shape as { id?: unknown }).id;
        return typeof id === 'string' ? id: null;
      }
      return null;
    }).filter((id): id is string => id !== null);
}

describe('operatorOfflineDrawFixtures ( iter-21 live draw exact demo only)', () => {
  it('"draw a heart" exact demo resolves to heart-outline freehand', () => {
    expect(isExactOperatorDemoDrawIntent('draw a heart')).toBe('heart');
    expect(resolveOperatorDrawSubject('draw a heart')).toBe('heart');

    const args = buildOperatorOfflineDrawArgs('draw a heart', TEST_VIEWPORT);
    const ids = shapeIds(args);
    expect(ids).toEqual(['heart-outline']);
    expect(ids).not.toContain('sketch-a');
  });

  it('"draw a cat" exact demo resolves to cat fixture ids', () => {
    expect(isExactOperatorDemoDrawIntent('draw a cat')).toBe('cat');
    expect(resolveOperatorDrawSubject('draw a cat')).toBe('cat');

    const args = buildOperatorOfflineDrawArgs('draw a cat', TEST_VIEWPORT);
    const ids = shapeIds(args);
    expect(ids).toContain('cat-head');
    expect(ids).toContain('cat-body');
    expect(ids).not.toContain('sketch-a');
  });

  it('"draw a rocket" uses generic sketch fallback (never null unsupported)', () => {
    expect(isExactOperatorDemoDrawIntent('draw a rocket')).toBeNull();
    const args = buildOperatorOfflineDrawArgs('draw a rocket', TEST_VIEWPORT);
    expect(shapeIds(args)).toEqual(['sketch-a', 'sketch-b', 'sketch-c']);
  });

  it('"draw guy with gun" is NOT unsupported and NOT cat demo', () => {
    expect(isExactOperatorDemoDrawIntent('draw guy with gun')).toBeNull();
    const args = buildOperatorOfflineDrawArgs('draw guy with gun', TEST_VIEWPORT);
    expect(shapeIds(args)).toEqual(['sketch-a', 'sketch-b', 'sketch-c']);
    expect(shapeIds(args).some((id) => id.startsWith('cat-'))).toBe(false);
  });

  it('"dog eating a cat" does NOT hijack cat fixture', () => {
    expect(isExactOperatorDemoDrawIntent('draw a dog eating a cat')).toBeNull();
    expect(isExactOperatorDemoDrawIntent('dog eating a cat')).toBeNull();
    const args = buildOperatorOfflineDrawArgs('draw a dog eating a cat', TEST_VIEWPORT);
    expect(shapeIds(args).some((id) => id.startsWith('cat-'))).toBe(false);
  });

  it('heart fixture is exactly one closed freehand shape', () => {
    const shapes = buildOperatorHeartDrawShapes(TEST_VIEWPORT);
    expect(shapes).toHaveLength(1);

    const heart = shapes[0];
    expect(heart?.id).toBe('heart-outline');
    expect(heart?.kind).toBe('freehand');
    expect(heart?.geometry.kind).toBe('points');
    expect(heart?.style).toEqual({
      fill: 'solid',
      color: 'light-red',
      size: 'm',
    });

    const geometry = heart?.geometry as PointsGeometry;
    expect(geometry.closed).toBe(true);
    expect(geometry.points.length).toBeGreaterThanOrEqual(16);
    expect(geometry.points.length).toBeLessThanOrEqual(24);
  });

  it('heart outline spans center with apex below top cleft', () => {
    const shapes = buildOperatorHeartDrawShapes(TEST_VIEWPORT);
    const geometry = shapes[0]?.geometry as PointsGeometry;
    const points = geometry.points;

    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));

    expect(minX).toBeLessThan(VIEWPORT_CX);
    expect(maxX).toBeGreaterThan(VIEWPORT_CX);

    const topCleftY = Math.min(...points.filter((point) => Math.abs(point.x - VIEWPORT_CX) < 2).map((point) => point.y));
    expect(minY).toBeLessThan(topCleftY);
    expect(maxY).toBeGreaterThan(topCleftY);
    expect(maxY - topCleftY).toBeGreaterThan(40);

    const apex = points.reduce((best, point) => (point.y > best.y ? point: best), points[0]!);
    expect(Math.abs(apex.x - VIEWPORT_CX)).toBeLessThan(3);
    expect(apex.y).toBeGreaterThan(VIEWPORT_CY);
  });

  it('cat fixture shape count is unchanged (7 shapes)', () => {
    expect(buildOperatorCatDrawShapes(TEST_VIEWPORT)).toHaveLength(7);
  });
});
