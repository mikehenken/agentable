import { describe, it, expect } from 'vitest';
import { resolveMapLookup } from '../../src/components/toneTokens';

describe('resolveMapLookup', () => {
  const map = {
    teal: { label: 'Teal' },
    amber: { label: 'Amber' },
  } as const;

  it('returns the mapped value for known keys', () => {
    expect(resolveMapLookup(map, 'amber', 'teal')).toEqual({ label: 'Amber' });
  });

  it('falls back when key is unknown or missing', () => {
    expect(resolveMapLookup(map, 'not-real', 'teal')).toEqual({ label: 'Teal' });
    expect(resolveMapLookup(map, undefined, 'teal')).toEqual({ label: 'Teal' });
  });
});
