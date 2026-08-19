/**
 * Wireframe stencil expansion for draw_shapes (D50, P12-T1).
 *
 * Closed-schema placeholders so connected wireframe sets read as wireframes,
 * not raw rectangles.
 */
import {
  AGENT_WIREFRAME_STENCIL_META_KEY,
  type WireframeStencilKind,
} from '../../../engine/authoringToolkitTypes';
import type { AgentDrawGeometry, AgentDrawShapeInput } from '../../../engine/agentDrawingTypes';

const WIREFRAME_DASH = 'dashed' as const;
const WIREFRAME_COLOR = 'grey';

function assertRectGeometry(
  geometry: AgentDrawGeometry,
): { x: number; y: number; w: number; h: number } {
  if (geometry.kind !== 'rect') {
    throw new Error('wireframe stencil requires geometry.kind "rect"');
  }
  if (geometry.w <= 0 || geometry.h <= 0) {
    throw new Error('wireframe stencil requires positive width and height');
  }
  return geometry;
}

function stencilMeta(stencil: WireframeStencilKind): Record<string, string> {
  return { [AGENT_WIREFRAME_STENCIL_META_KEY]: stencil };
}

function boxShape(
  rect: { x: number; y: number; w: number; h: number },
  stencil: WireframeStencilKind,
  label?: string,
): AgentDrawShapeInput[] {
  const shapes: AgentDrawShapeInput[] = [
    {
      kind: 'box',
      geometry: { kind: 'rect', ...rect },
      style: { color: WIREFRAME_COLOR, fill: 'none', dash: WIREFRAME_DASH },
      meta: stencilMeta(stencil),
    },
  ];
  if (label !== undefined && label.length > 0) {
    shapes.push({
      kind: 'text',
      text: label,
      geometry: {
        kind: 'text',
        x: rect.x + 8,
        y: rect.y + rect.h / 2 - 8,
        maxWidth: Math.max(rect.w - 16, 32),
      },
      style: { color: WIREFRAME_COLOR, dash: WIREFRAME_DASH },
      meta: stencilMeta(stencil),
    });
  }
  return shapes;
}

export function expandWireframeStencil(
  stencil: WireframeStencilKind,
  geometry: AgentDrawGeometry,
  text?: string,
): AgentDrawShapeInput[] {
  switch (stencil) {
    case 'label': {
      const rect = assertRectGeometry(geometry);
      const label = text ?? 'Label';
      return [
        {
          kind: 'text',
          text: label,
          geometry: {
            kind: 'text',
            x: rect.x,
            y: rect.y,
            maxWidth: rect.w,
          },
          style: { color: WIREFRAME_COLOR, dash: WIREFRAME_DASH },
          meta: stencilMeta(stencil),
        },
      ];
    }
    case 'box':
      return boxShape(assertRectGeometry(geometry), stencil, text);
    case 'input':
      return boxShape(assertRectGeometry(geometry), stencil, text ?? 'Input…');
    case 'button': {
      const rect = assertRectGeometry(geometry);
      const buttonRect = {
        x: rect.x,
        y: rect.y,
        w: Math.max(rect.w, 96),
        h: Math.max(rect.h, 36),
      };
      return boxShape(buttonRect, stencil, text ?? 'Button');
    }
    case 'nav': {
      const rect = assertRectGeometry(geometry);
      const navRect = {
        x: rect.x,
        y: rect.y,
        w: Math.max(rect.w, 240),
        h: Math.max(rect.h, 40),
      };
      return boxShape(navRect, stencil, text ?? 'Navigation');
    }
    case 'card': {
      const rect = assertRectGeometry(geometry);
      const title = text ?? 'Card title';
      return [
        ...boxShape(rect, stencil),
        {
          kind: 'text',
          text: title,
          geometry: {
            kind: 'text',
            x: rect.x + 12,
            y: rect.y + 12,
            maxWidth: rect.w - 24,
          },
          style: { color: WIREFRAME_COLOR, dash: WIREFRAME_DASH },
          meta: stencilMeta(stencil),
        },
        {
          kind: 'box',
          geometry: {
            kind: 'rect',
            x: rect.x + 12,
            y: rect.y + 44,
            w: rect.w - 24,
            h: Math.max(rect.h - 56, 24),
          },
          style: { color: WIREFRAME_COLOR, fill: 'semi', dash: WIREFRAME_DASH },
          meta: stencilMeta(stencil),
        },
      ];
    }
    default: {
      const exhaustive: never = stencil;
      throw new Error(`unsupported wireframe stencil: ${String(exhaustive)}`);
    }
  }
}
