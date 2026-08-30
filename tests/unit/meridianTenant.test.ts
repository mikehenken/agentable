/**
 * Guards the single meridian-labs tenant predicate (Wave 7 consolidation).
 * The whiteboard embed and the gallery scripted demo both branch on this
 * tenant; before consolidation the literal lived in three places and a
 * drifted spelling would have silently disabled the meridian host bundle on
 * the deployed gallery. This pins the constant and the predicate's edges.
 */
import { describe, it, expect } from 'vitest';
import { MERIDIAN_LABS_TENANT, isMeridianLabsTenant } from '../../src/embed/meridian/tenant';
import { MERIDIAN_LABS_BRAND } from '../../src/embed/meridian/fixtures/meridianLabs';

describe('meridian tenant predicate', () => {
  it('exposes the canonical tenant literal', () => {
    expect(MERIDIAN_LABS_TENANT).toBe('meridian-labs');
  });

  it('matches the fixture brand tenant (no data/runtime fork)', () => {
    expect(MERIDIAN_LABS_BRAND.tenant).toBe(MERIDIAN_LABS_TENANT);
  });

  it('accepts the exact tenant only', () => {
    expect(isMeridianLabsTenant('meridian-labs')).toBe(true);
    expect(isMeridianLabsTenant(MERIDIAN_LABS_TENANT)).toBe(true);
  });

  it('rejects other tenants, empty, null, and undefined', () => {
    expect(isMeridianLabsTenant('northstar')).toBe(false);
    expect(isMeridianLabsTenant('Meridian-Labs')).toBe(false);
    expect(isMeridianLabsTenant(' meridian-labs ')).toBe(false);
    expect(isMeridianLabsTenant('')).toBe(false);
    expect(isMeridianLabsTenant(null)).toBe(false);
    expect(isMeridianLabsTenant(undefined)).toBe(false);
  });
});
