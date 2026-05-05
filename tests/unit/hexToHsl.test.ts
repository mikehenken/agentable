/**
 * `hexToHslComponents` — pure helper used by the Lit shell's
 * `_applyBrandTokens` to keep the dual-form token pair in sync.
 *
 * Pins the architect-reviewer M2.5 CRITICAL #1: when an embedder sets
 * `primary-color="#ff0000"`, the shell MUST update both
 * `--landi-color-primary` AND `--landi-color-primary-hsl` so alpha-modified
 * utilities (`bg-canvas-primary/30`) compose with the override instead of
 * keeping the build-time default teal.
 *
 * Imports the helper directly from its module (not the embed entry) so
 * we don't trigger custom-element registration in happy-dom. The helper
 * was extracted to its own file specifically for this — see
 * `src/embed/utils/hexToHsl.ts`. (Architect-reviewer M2.6 W1.)
 */
import { describe, it, expect } from 'vitest';
import { hexToHslComponents } from '../../src/embed/utils/hexToHsl';

describe('hexToHslComponents', () => {
  it('converts the default teal #0D7377 to ~"183 80% 26%"', () => {
    // Pinning the canonical default brand. If this drifts the dual-form
    // tokens drift and `bg-canvas-primary/N` produces wrong alpha colors.
    const result = hexToHslComponents('#0D7377');
    expect(result).toBe('182 80% 26%');
  });

  it('converts pure red #FF0000 to "0 100% 50%"', () => {
    expect(hexToHslComponents('#FF0000')).toBe('0 100% 50%');
  });

  it('converts pure green #00FF00 to "120 100% 50%"', () => {
    expect(hexToHslComponents('#00FF00')).toBe('120 100% 50%');
  });

  it('converts pure blue #0000FF to "240 100% 50%"', () => {
    expect(hexToHslComponents('#0000FF')).toBe('240 100% 50%');
  });

  it('converts white #FFFFFF to "0 0% 100%"', () => {
    expect(hexToHslComponents('#FFFFFF')).toBe('0 0% 100%');
  });

  it('converts black #000000 to "0 0% 0%"', () => {
    expect(hexToHslComponents('#000000')).toBe('0 0% 0%');
  });

  it('expands shorthand #f00 → "0 100% 50%"', () => {
    expect(hexToHslComponents('#f00')).toBe('0 100% 50%');
  });

  it('strips and accepts the leading # or no #', () => {
    expect(hexToHslComponents('FF0000')).toBe('0 100% 50%');
    expect(hexToHslComponents('#FF0000')).toBe('0 100% 50%');
  });

  it('returns null for malformed input', () => {
    expect(hexToHslComponents('not-a-color')).toBe(null);
    expect(hexToHslComponents('#GGGGGG')).toBe(null);
    expect(hexToHslComponents('#FF')).toBe(null);
    expect(hexToHslComponents('')).toBe(null);
  });

  it('produces format Tailwind <alpha-value> can consume', () => {
    // The output is `H S% L%` — exactly what `hsl(var(--token) / <alpha>)`
    // expects when Tailwind substitutes `<alpha-value>` with `0.3` etc.
    const result = hexToHslComponents('#0D7377');
    expect(result).toMatch(/^\d+\s\d+%\s\d+%$/);
  });
});
