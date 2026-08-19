import { describe, expect, it } from 'vitest';

import {
  convertHandPlacedShapesToDiagram,
  enforceStructuralDiagramDraw,
  inferLayoutMode,
  isHandPlacedShapesOnly,
  isInPlacePatchDraw,
  STRUCTURAL_DIAGRAM_REQUIRED_ERROR,
} from '../../src/agents/tools/enforceStructuralDiagramDraw';
import { withDrawUserMessage } from '../../src/chat/drawIntentContext';

describe('enforceStructuralDiagramDraw', () => {
  it('rejects hand-placed shapes when user message is VPC peering intent', () => {
    const args = {
      shapes: [{ kind: 'box', x: 0, y: 0, w: 120, h: 60, text: 'AWS VPC' }],
    };
    const result = withDrawUserMessage('draw diagram of vpc peering between aws and gcp', () =>
      enforceStructuralDiagramDraw(args));
    expect(result.error).toBe(STRUCTURAL_DIAGRAM_REQUIRED_ERROR);
    expect(result.rewritten).toBeUndefined();
  });

  it('allows patch draw when all shapes have ids', () => {
    const args = {
      shapes: [
        { id: 'vpc-a', kind: 'box', x: 0, y: 0, w: 120, h: 60, text: 'AWS VPC' },
        { id: 'vpc-b', kind: 'box', x: 200, y: 0, w: 120, h: 60, text: 'GCP VPC' },
      ],
    };
    const result = withDrawUserMessage('draw vpc peering diagram', () =>
      enforceStructuralDiagramDraw(args));
    expect(result.error).toBeUndefined();
    expect(result.args).toEqual(args);
  });

  it('converts simple boxes and arrows to diagram+layout', () => {
    const args = {
      shapes: [
        { id: 'aws', kind: 'box', x: 0, y: 0, w: 120, h: 60, text: 'AWS VPC' },
        { id: 'gcp', kind: 'box', x: 200, y: 0, w: 120, h: 60, text: 'GCP VPC' },
        { kind: 'arrow', from: 'aws', to: 'gcp', text: 'peering' },
      ],
    };
    const converted = convertHandPlacedShapesToDiagram(args, 'draw vpc peering diagram');
    expect(converted).toBeDefined();
    expect(converted?.layout).toBe('nested');
    expect(converted?.diagram).toEqual({
      nodes: [
        { id: 'aws', label: 'AWS VPC' },
        { id: 'gcp', label: 'GCP VPC' },
      ],
      edges: [{ from: 'aws', to: 'gcp', label: 'peering' }],
    });
    expect(converted?.shapes).toBeUndefined();

    const enforced = withDrawUserMessage('draw vpc peering diagram', () =>
      enforceStructuralDiagramDraw(args));
    expect(enforced.rewritten).toBe(true);
    expect(enforced.error).toBeUndefined();
    expect(enforced.args.layout).toBe('nested');
    expect(enforced.args.diagram).toBeDefined();
  });

  it('allows freeform when user message is not structural', () => {
    const args = {
      shapes: [{ kind: 'ellipse', x: 10, y: 10, w: 80, h: 80 }],
    };
    const result = withDrawUserMessage('draw a cat', () => enforceStructuralDiagramDraw(args));
    expect(result.error).toBeUndefined();
    expect(result.args).toEqual(args);
  });

  it('allows diagram+layout passthrough unchanged', () => {
    const args = {
      layout: 'radial',
      diagram: {
        nodes: [
          { id: 'hub', label: 'Hub' },
          { id: 'spoke-a', label: 'Spoke A' },
        ],
        edges: [{ from: 'hub', to: 'spoke-a' }],
      },
    };
    const result = withDrawUserMessage('draw hub and spoke dependency map', () =>
      enforceStructuralDiagramDraw(args));
    expect(result.error).toBeUndefined();
    expect(result.args).toEqual(args);
    expect(isHandPlacedShapesOnly(args)).toBe(false);
  });

  it('infers nested layout for vpc and cloud architecture prompts', () => {
    expect(inferLayoutMode('draw vpc peering between aws and gcp')).toBe('nested');
    expect(inferLayoutMode('cloud infrastructure topology')).toBe('nested');
    expect(inferLayoutMode('aws subnet network diagram')).toBe('nested');
  });

  it('infers radial layout for hub/spoke prompts', () => {
    expect(inferLayoutMode('draw hub and spoke network')).toBe('radial');
    expect(inferLayoutMode('dependency map of services')).toBe('radial');
  });

  it('infers timeline layout for sequence prompts', () => {
    expect(inferLayoutMode('sequence diagram of checkout')).toBe('timeline');
  });

  it('detects in-place patch draws', () => {
    expect(
      isInPlacePatchDraw([
        { id: 'a', kind: 'box' },
        { id: 'b', kind: 'box' },
      ])).toBe(true);
    expect(
      isInPlacePatchDraw([
        { id: 'a', kind: 'box' },
        { kind: 'box' },
      ])).toBe(false);
  });
});
