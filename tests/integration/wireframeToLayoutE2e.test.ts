/**
 * Node-side e2e acceptance for wireframe-to-layout flagship.
 */
import { describe, expect, it } from 'vitest';
import { runWireframeToLayoutE2eScenario } from '../e2e/harness/wireframeToLayoutScenario';

describe(' wireframe-to-layout e2e scenario ', () => {
  it('runs sketch -> read -> propose layout -> HITL apply', async () => {
    const result = await runWireframeToLayoutE2eScenario;
    expect(result().checks.map((check) => check.name)).toEqual([
      'sketch wireframe via draw_shapes',
      'read_canvas returns structured graph',
      'read_canvas geometry matches golden wireframe',
      'propose layout matches golden proposal',
      'compose_panel accepts all slot specs',
      'HITL apply queues approval for acting agent',
      'drawing workflow does not mutate panel data before apply approval',
    ]);
    for (const check of result().checks) {
      expect(check.ok, `${check.name}: ${check.detail ?? ''}`).toBe(true);
    }
    expect(result().ok).toBe(true);
    expect(result().proposal?.slots).toHaveLength(3);
  });
});
