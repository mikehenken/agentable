/**
 * Nested diagram post-draw lint filtering.
 */
import { describe, expect, it } from 'vitest';
import {
  filterBenignNestedDiagramLints,
  shouldCompleteNestedDiagramReview,
} from '../../src/chat/postDrawNestedDiagram';
import type { CanvasShapeGraph } from '../../src/engine/canvasPerceptionTypes';

const nestedGraph: CanvasShapeGraph = {
  region: { x: 0, y: 0, w: 1200, h: 800 },
  shapes: [
    {
      id: 'shape:aws',
      nativeType: 'geo',
      kind: 'box',
      geometry: { kind: 'rect', x: 0, y: 0, w: 400, h: 600 },
      text: 'AWS VPC',
      parentId: 'page:page',
      zOrder: 1,
      agentId: 'agentable-chat-agent',
    },
    {
      id: 'shape:gcp',
      nativeType: 'geo',
      kind: 'box',
      geometry: { kind: 'rect', x: 420, y: 0, w: 400, h: 600 },
      text: 'GCP VPC',
      parentId: 'page:page',
      zOrder: 2,
      agentId: 'agentable-chat-agent',
    },
    {
      id: 'shape:arrow1',
      nativeType: 'arrow',
      kind: 'arrow',
      geometry: {
        kind: 'segment',
        from: { x: 400, y: 300 },
        to: { x: 420, y: 300 },
      },
      zOrder: 3,
      agentId: 'agentable-chat-agent',
    },
  ],
};

describe('filterBenignNestedDiagramLints', () => {
  it('drops viewport cutoff, false no-arrows, touch, and column sibling overlap lints', () => {
    const raw = [
      '3 of your shapes extend past the visible view (for example "AWS VPC").',
      'Your sketch has no connecting arrows; if the request involves flow, sequence, or connections, add arrows between the related shapes.',
      '"AWS VPC" and "GCP VPC" touch; add breathing room between them.',
      '"AWS VPC" and "GCP VPC" overlap; separate them.',
      '1 of your shapes sit under the "chat" panel (for example "subnet"); move them clear of it.',
    ];
    const filtered = filterBenignNestedDiagramLints(raw, nestedGraph);
    expect(filtered).toEqual([
      '1 of your shapes sit under the "chat" panel (for example "subnet"); move them clear of it.',
    ]);
  });

  it('keeps no-arrows lint when graph has no connectors', () => {
    const graphNoArrows: CanvasShapeGraph = {...nestedGraph,
      shapes: nestedGraph.shapes.filter((node) => node.kind !== 'arrow'),
    };
    const raw = [
      'Your sketch has no connecting arrows; if the request involves flow, sequence, or connections, add arrows between the related shapes.',
    ];
    expect(filterBenignNestedDiagramLints(raw, graphNoArrows)).toEqual(raw);
  });
});

describe('shouldCompleteNestedDiagramReview', () => {
  it('returns true for nested layout with no actionable lints after filter', () => {
    expect(shouldCompleteNestedDiagramReview('nested', [], 'skip')).toBe(true);
  });

  it('returns false when actionable lints remain', () => {
    expect(
      shouldCompleteNestedDiagramReview('nested', ['shapes under panel'], 'skip')).toBe(false);
  });

  it('returns false for non-nested layouts', () => {
    expect(shouldCompleteNestedDiagramReview('flow', [], 'flow')).toBe(false);
  });
});
