import { describe, expect, it } from 'vitest';
import {
  buildDiagramIntentHint,
  CANVAS_DRAW_QUALITY_INSTRUCTIONS,
  isStructuralDiagramIntent,
} from '../../src/chat/canvasDrawQualityInstructions';

describe('canvasDrawQualityInstructions', () => {
  it('prefers diagram+layout for structural diagrams', () => {
    expect(CANVAS_DRAW_QUALITY_INSTRUCTIONS).toContain('diagram plus layout');
    expect(CANVAS_DRAW_QUALITY_INSTRUCTIONS).not.toContain('MUST call draw_shapes with { shapes:');
  });

  it('detects VPC peering as structural diagram intent', () => {
    expect(isStructuralDiagramIntent('draw diagram of vpc peering between aws and gcp')).toBe(true);
    expect(isStructuralDiagramIntent('draw a flowchart for onboarding')).toBe(true);
    expect(isStructuralDiagramIntent('sequence diagram for checkout')).toBe(true);
    expect(isStructuralDiagramIntent('draw an org chart')).toBe(true);
    expect(isStructuralDiagramIntent('draw a cat')).toBe(false);
  });

  it('buildDiagramIntentHint returns layout guidance for structural prompts', () => {
    const hint = buildDiagramIntentHint('draw vpc peering diagram');
    expect(hint).toContain('diagram');
    expect(hint).toContain('layout');
  });
});
