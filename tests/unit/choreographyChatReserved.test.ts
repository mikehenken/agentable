import { describe, it, expect, vi } from 'vitest';
import { createShapeId } from 'tldraw';
import {
  chatPanelLayoutObstacle,
  mergeChatReservedObstacles,
  repositionPanelBesideChatIfOverlapping,
} from '../../src/choreography/index';
import { rectsOverlap } from '../../src/layout/panelLayoutEngine';

describe('chatPanelLayoutObstacle', () => {
  it('returns null when chat is hidden', () => {
    expect(
      chatPanelLayoutObstacle({
        chat: { visible: false, x: 10, y: 10, w: 400, h: 500 },
      })).toBeNull();
  });

  it('returns layout rect when chat is visible', () => {
    const rect = chatPanelLayoutObstacle({
      chat: { visible: true, x: 240, y: 72, w: 520, h: 560 },
    });
    expect(rect).toEqual({ x: 240, y: 72, w: 520, h: 560 });
  });
});

describe('mergeChatReservedObstacles', () => {
  it('adds chat bounds when opening a non-chat panel', () => {
    const chat = { x: 24, y: 24, w: 360, h: 600 };
    const merged = mergeChatReservedObstacles([], chat, 'growth-paths');
    expect(merged).toEqual([chat]);
  });

  it('does not duplicate chat when already listed', () => {
    const chat = { x: 24, y: 24, w: 360, h: 600 };
    const merged = mergeChatReservedObstacles([chat], chat, 'open-positions');
    expect(merged).toHaveLength(1);
  });
});

describe('repositionPanelBesideChatIfOverlapping', () => {
  it('moves an overlapping panel beside chat', () => {
    const chatId = createShapeId('panel:chat');
    const growthId = createShapeId('panel:growth-paths');

    const shapes = new Map<string, unknown>([
      [
        chatId,
        {
          id: chatId,
          type: 'panel',
          x: 24,
          y: 24,
          props: { w: 360, h: 600, panelId: 'chat', data: {} },
        },
      ],
      [
        growthId,
        {
          id: growthId,
          type: 'panel',
          x: 24,
          y: 24,
          props: { w: 880, h: 540, panelId: 'growth-paths', data: {} },
        },
      ],
    ]);

    const editor = {
      getShapePageBounds: vi.fn((id: string) => {
        const shape = shapes.get(id) as { x: number; y: number; props: { w: number; h: number } };
        if (!shape) return undefined;
        return { x: shape.x, y: shape.y, w: shape.props.w, h: shape.props.h };
      }),
      getCurrentPageShapes: vi.fn(() => Array.from(shapes.values)),
      updateShape: vi.fn((patch: { id: string; x: number; y: number }) => {
        const existing = shapes.get(patch.id) as { x: number; y: number };
        if (existing) {
          existing.x = patch.x;
          existing.y = patch.y;
        }
      }),
    };

    const viewport = { left: 0, top: 0, right: 1600, bottom: 1000, gap: 16 };

    const moved = repositionPanelBesideChatIfOverlapping(
      editor as never,
      'growth-paths',
      viewport,
      true);

    expect(moved).toBe(true);
    expect(editor.updateShape).toHaveBeenCalled;

    const growth = shapes.get(growthId) as { x: number; y: number };
    const chatBounds = { x: 24, y: 24, w: 360, h: 600 };
    const panelRect = { x: growth.x, y: growth.y, w: 880, h: 540 };
    expect(rectsOverlap(panelRect, chatBounds, viewport.gap)).toBe(false);
  });
});
