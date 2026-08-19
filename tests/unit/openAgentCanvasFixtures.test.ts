/**
 * Meridian Labs gallery fixture hygiene ( rule 4).
 */
import { describe, expect, it } from 'vitest';
import {
  MERIDIAN_LABS_BRAND,
  MERIDIAN_PRODUCT_BRIEF_BLOCKS,
  MERIDIAN_WIREFRAME_FLOW,
} from '../../examples/12-open-agent-canvas/fixtures/meridianLabs';
import { FORBIDDEN_DEMO_BRAND_NAMES } from '../../examples/08-agent-presents/fixtures/archipelagoResorts';

describe('open-agent-canvas fixtures (Meridian Labs)', () => {
  it('uses fictional Meridian Labs brand only', () => {
    expect(MERIDIAN_LABS_BRAND.name).toBe('Meridian Labs');
    expect(MERIDIAN_LABS_BRAND.tenant).toBe('meridian-labs');
    const serialized = JSON.stringify({
      brand: MERIDIAN_LABS_BRAND,
      flow: MERIDIAN_WIREFRAME_FLOW,
      blocks: MERIDIAN_PRODUCT_BRIEF_BLOCKS,
    });
    for (const forbidden of FORBIDDEN_DEMO_BRAND_NAMES) {
      expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it('wireframe flow diagram has connected nodes without coordinates', () => {
    const diagramJson = JSON.stringify(MERIDIAN_WIREFRAME_FLOW.diagram);
    expect(diagramJson.includes('"x":')).toBe(false);
    expect(diagramJson.includes('"y":')).toBe(false);
    expect(MERIDIAN_WIREFRAME_FLOW.diagram.nodes.length).toBeGreaterThanOrEqual(4);
    expect(MERIDIAN_WIREFRAME_FLOW.diagram.edges?.length).toBeGreaterThanOrEqual(3);
  });

  it('product brief blocks cover multi-block document AC', () => {
    expect(MERIDIAN_PRODUCT_BRIEF_BLOCKS.length).toBeGreaterThanOrEqual(4);
    const types = new Set(MERIDIAN_PRODUCT_BRIEF_BLOCKS.map((block) => block.type));
    expect(types.has('heading')).toBe(true);
    expect(types.has('paragraph')).toBe(true);
    expect(types.has('list')).toBe(true);
    expect(types.has('callout')).toBe(true);
  });
});
