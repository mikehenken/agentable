/**
 * Node-side e2e acceptance for open-agent-canvas gallery.
 */
import { describe, expect, it } from 'vitest';
import { runOpenAgentCanvasE2eScenario } from '../e2e/harness/openAgentCanvasScenario';

describe(' open-agent-canvas e2e scenario (Meridian Labs)', () => {
  it('authors wireframe + document under open, exports, and keeps host-data HITL', async () => {
    const result = await runOpenAgentCanvasE2eScenario;
    expect(result().brand.name).toBe('Meridian Labs');
    expect(result().checks.map((check) => check.name)).toEqual([
      'gallery host config resolves canvasPolicy open',
      'connected wireframe compiles from logical flow diagram',
      'wireframe flow draw_shapes succeeds under open policy',
      'wireframe stencils render on canvas',
      'connect_shapes links wireframe regions',
      'document panel opens for Meridian brief',
      'agent builds multi-block document via structured block ops',
      'red-team markup stays inert in document text (G4)',
      'document block ops undo restores prior block list',
      'persisted document survives store reload ',
      'export_document returns PDF under open policy',
      'export bytes are stable on repeat export',
      'export_document host action id is stable ',
      'block-model export uses fixed epoch (no HTML round-trip)',
      'wireframe and document authoring do not queue HITL under open',
      'host-data save action still queues HITL under open',
      'approved host-data save completes after HITL',
    ]);
    for (const check of result().checks) {
      expect(check.ok, `${check.name}: ${check.detail ?? ''}`).toBe(true);
    }
    expect(result().ok).toBe(true);
  });
});
