/**
 * Node-side e2e acceptance for (runs when Playwright browser unavailable).
 */
import { describe, expect, it } from 'vitest';
import { runMultiAgentE2eScenario } from '../e2e/harness/multiAgentScenario';

describe(' multi-agent e2e scenario ', () => {
  it('passes two-agent attribution and scope refusal checks', async () => {
    const result = await runMultiAgentE2eScenario;
    expect(result().checks.map((check) => check.name)).toEqual([
      'two agents open different panels',
      'two agents fill different panels',
      'activity log attributes both agents',
      'HITL card attributed to acting agent',
      'out-of-scope tool call refused',
      'two agents registered in digest input',
    ]);
    for (const check of result().checks) {
      expect(check.ok, `${check.name}: ${check.detail ?? ''}`).toBe(true);
    }
    expect(result().ok).toBe(true);
  });
});
