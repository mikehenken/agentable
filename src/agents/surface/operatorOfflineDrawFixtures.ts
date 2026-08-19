/**
 * Intent-aware offline draw_shapes args for operator Draw mode (P13-T7 iter-21).
 * Exact demo fixtures (cat, heart) for offline-only gallery paths; generic sketch
 * fallback when live chat is unavailable. No unsupported-subject refusal gate.
 */
import type { AgentDrawPoint, AgentDrawShapeInput } from '../../engine/agentDrawingTypes';
import type { OperatorViewportRegion } from './operatorDrawVerification';

const DEFAULT_VIEWPORT: OperatorViewportRegion = { x: 0, y: 0, w: 960, h: 640 };

export type OperatorDrawSubject = 'cat' | 'heart';

const EXACT_DEMO_DRAW_INTENT =
  /^draw\s+(?:a|an|the)?\s*(cat|heart)\s*\.?$/i;

const CAT_STYLE = { fill: 'solid' as const, color: 'orange', size: 'm' as const };
const HEART_STYLE = { fill: 'solid' as const, color: 'light-red', size: 'm' as const };
const GENERIC_STYLE = { fill: 'solid' as const, color: 'blue', size: 'm' as const };

function viewportCenter(viewport: OperatorViewportRegion): { cx: number; cy: number } {
  return {
    cx: viewport.x + viewport.w / 2,
    cy: viewport.y + viewport.h / 2,
  };
}

/**
 * Match gallery demo draw intents only — e.g. "draw a cat", not "dog eating a cat".
 */
export function isExactOperatorDemoDrawIntent(userText: string): OperatorDrawSubject | null {
  const match = userText.trim().match(EXACT_DEMO_DRAW_INTENT);
  const subject = match?.[1]?.toLowerCase();
  if (subject === 'cat' || subject === 'heart') {
    return subject;
  }
  return null;
}

/** @deprecated Use isExactOperatorDemoDrawIntent — no substring hijacking. */
export function resolveOperatorDrawSubject(userText: string): OperatorDrawSubject | null {
  return isExactOperatorDemoDrawIntent(userText);
}

/** Human-readable label for success messages. */
export function resolveOperatorDrawSubjectLabel(subject: OperatorDrawSubject): string {
  switch (subject) {
    case 'cat':
      return 'cat sketch';
    case 'heart':
      return 'heart sketch';
  }
}

/** Multi-shape cat sketch — head, ears, body, tail, eyes (viewport-centered). */
export function buildOperatorCatDrawShapes(
  viewport: OperatorViewportRegion = DEFAULT_VIEWPORT,
): AgentDrawShapeInput[] {
  const { cx, cy } = viewportCenter(viewport);
  return [
    {
      id: 'cat-head',
      kind: 'ellipse',
      text: 'head',
      geometry: { kind: 'rect', x: cx - 70, y: cy - 120, w: 140, h: 120 },
      style: CAT_STYLE,
    },
    {
      id: 'cat-ear-left',
      kind: 'ellipse',
      geometry: { kind: 'rect', x: cx - 78, y: cy - 168, w: 44, h: 52 },
      style: CAT_STYLE,
    },
    {
      id: 'cat-ear-right',
      kind: 'ellipse',
      geometry: { kind: 'rect', x: cx + 34, y: cy - 168, w: 44, h: 52 },
      style: CAT_STYLE,
    },
    {
      id: 'cat-body',
      kind: 'ellipse',
      text: 'body',
      geometry: { kind: 'rect', x: cx - 90, y: cy + 8, w: 180, h: 140 },
      style: CAT_STYLE,
    },
    {
      id: 'cat-tail',
      kind: 'freehand',
      geometry: {
        kind: 'points',
        points: [
          { x: cx + 90, y: cy + 70 },
          { x: cx + 150, y: cy + 40 },
          { x: cx + 190, y: cy + 90 },
          { x: cx + 210, y: cy + 30 },
        ],
      },
      style: { color: 'orange', size: 'm' },
    },
    {
      id: 'cat-eye-left',
      kind: 'ellipse',
      geometry: { kind: 'rect', x: cx - 42, y: cy - 88, w: 16, h: 16 },
      style: { fill: 'solid', color: 'black', size: 's' },
    },
    {
      id: 'cat-eye-right',
      kind: 'ellipse',
      geometry: { kind: 'rect', x: cx + 26, y: cy - 88, w: 16, h: 16 },
      style: { fill: 'solid', color: 'black', size: 's' },
    },
  ];
}

/** Parametric ♥ silhouette (~20 points), clockwise from top cleft through apex. */
function buildHeartOutlinePoints(cx: number, cy: number): AgentDrawPoint[] {
  const scale = 5.5;
  const pointCount = 20;
  const points: AgentDrawPoint[] = [];
  for (let i = 0; i < pointCount; i++) {
    const t = (i / pointCount) * Math.PI * 2;
    const sinT = Math.sin(t);
    const x = 16 * sinT ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    points.push({
      x: cx + x * scale,
      y: cy - y * scale,
    });
  }
  return points;
}

/** Single closed freehand heart silhouette (viewport-centered). */
export function buildOperatorHeartDrawShapes(
  viewport: OperatorViewportRegion = DEFAULT_VIEWPORT,
): AgentDrawShapeInput[] {
  const { cx, cy } = viewportCenter(viewport);
  return [
    {
      id: 'heart-outline',
      kind: 'freehand',
      geometry: {
        kind: 'points',
        points: buildHeartOutlinePoints(cx, cy),
        closed: true,
      },
      style: HEART_STYLE,
    },
  ];
}

/** Generic multi-shape sketch for offline draw when live chat is unavailable. */
export function buildOperatorGenericDrawShapes(
  viewport: OperatorViewportRegion = DEFAULT_VIEWPORT,
): AgentDrawShapeInput[] {
  const { cx, cy } = viewportCenter(viewport);
  return [
    {
      id: 'sketch-a',
      kind: 'box',
      geometry: { kind: 'rect', x: cx - 120, y: cy - 80, w: 100, h: 72 },
      style: GENERIC_STYLE,
    },
    {
      id: 'sketch-b',
      kind: 'ellipse',
      geometry: { kind: 'rect', x: cx + 10, y: cy - 60, w: 96, h: 96 },
      style: GENERIC_STYLE,
    },
    {
      id: 'sketch-c',
      kind: 'arrow',
      geometry: {
        kind: 'segment',
        from: { x: cx - 20, y: cy - 8 },
        to: { x: cx + 58, y: cy + 48 },
      },
      style: GENERIC_STYLE,
    },
  ];
}

/**
 * Build draw_shapes args from user text and live viewport (offline operator path).
 * Exact demo intents use fixtures; all other prompts use generic sketch (never refuse).
 */
export function buildOperatorOfflineDrawArgs(
  userText: string,
  viewport: OperatorViewportRegion | null,
): Record<string, unknown> {
  const region = viewport ?? DEFAULT_VIEWPORT;
  const subject = isExactOperatorDemoDrawIntent(userText);

  if (subject === 'cat') {
    return { shapes: buildOperatorCatDrawShapes(region) };
  }
  if (subject === 'heart') {
    return { shapes: buildOperatorHeartDrawShapes(region) };
  }

  return { shapes: buildOperatorGenericDrawShapes(region) };
}

export function isOperatorDrawIntent(userText: string): boolean {
  return /\b(draw|sketch|annotate|rectangle|circle|shape|diagram|flow|heart|box|cat)\b/i.test(
    userText.trim(),
  );
}

export function isOperatorClearDrawIntent(userText: string): boolean {
  return /\b(clear|erase|remove|delete)\b.*\b(draw|sketch|annotation|drawing|shape)s?\b/i.test(
    userText.trim(),
  );
}
