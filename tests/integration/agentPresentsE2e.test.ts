/**
 * Node-side e2e acceptance for agent-presents demo scenarios.
 */
import { describe, expect, it } from 'vitest';
import { runAgentPresentsE2eScenario } from '../e2e/harness/agentPresentsScenario';

describe(' agent-presents e2e scenario (Archipelago Resorts)', () => {
  it('runs career trajectory, job-economy chart, and island walkthrough', async () => {
    const result = await runAgentPresentsE2eScenario;
    expect(result().checks.map((check) => check.name)).toEqual([
      'career trajectory renders from logical structure alone',
      'career trajectory draw_shapes succeeds in chat turn',
      'job-economy chart spec validates against merged charts catalog',
      'job-economy chart compose_panel succeeds with pin',
      'job-economy chart is agent-origin (provenance-badged)',
      'island journey map draws via radial auto-layout',
      'island walkthrough narrates scene-by-scene',
      'island walkthrough cedes camera on user input',
      'drawing never mutates panel data',
    ]);
    for (const check of result().checks) {
      expect(check.ok, `${check.name}: ${check.detail ?? ''}`).toBe(true);
    }
    expect(result().ok).toBe(true);
  });
});
