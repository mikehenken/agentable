/**
 * Career tenant brand tokens — tenant-scoped primaries.
 */
import { describe, expect, it } from 'vitest';
import {
  CAREER_TENANT_PRIMARY_COLORS,
  applyCareerTenantBrandTokens,
  resolveCareerTenantPrimaryColor,
} from '../../packages/career-pack/src/tenants/careerTenantTokens';

describe('careerTenantTokens', () => {
  it('resolves Sandals marketing primary', () => {
    expect(resolveCareerTenantPrimaryColor('sandals')).toBe('#0D7377');
    expect(CAREER_TENANT_PRIMARY_COLORS.sandals).toBe('#0D7377');
  });

  it('resolves Moss green primary', () => {
    expect(resolveCareerTenantPrimaryColor('moss')).toBe('#006938');
  });

  it('resolves Archipelago gallery primary', () => {
    expect(resolveCareerTenantPrimaryColor('archipelago-resorts')).toBe('#0E7490');
  });

  it('applyCareerTenantBrandTokens sets CSS vars on host', () => {
    const host = document.createElement('div');
    const applied = applyCareerTenantBrandTokens(host, 'sandals');
    expect(applied).toBe('#0D7377');
    expect(host.style.getPropertyValue('--landi-color-primary')).toBe('#0D7377');
    expect(host.style.getPropertyValue('--landi-color-primary-hsl')).toMatch(/\d+ \d+% \d+%/);
  });
});
