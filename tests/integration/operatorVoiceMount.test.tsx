/**
 * OperatorVoiceMount renders without crashing.
 *
 * Regression: the mount passed `persona: persona()` where `persona` was
 * already the resolved config object from useMemo. Calling it threw
 * "e is not a function" inside React's render phase, which surfaced on
 * gallery-13 as a bare TypeError from the scheduler and left the operator
 * surface dead. Rendering the component is enough to catch it.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { OperatorVoiceMount } from '../../src/agents/surface/OperatorVoiceMount';

vi.mock('../../src/voice/useGeminiLive', () => ({
  useGeminiLive: vi.fn(),
}));

describe('OperatorVoiceMount', () => {
  it('renders without throwing and passes a persona object, not a function', async () => {
    const { useGeminiLive } = await import('../../src/voice/useGeminiLive');

    expect(() => render(<OperatorVoiceMount />)).not.toThrow();

    expect(useGeminiLive).toHaveBeenCalledTimes(1);
    const options = vi.mocked(useGeminiLive).mock.calls[0][0];
    expect(typeof options.persona).toBe('object');
    expect(typeof options.persona.systemPrompt).toBe('string');
  });
});
