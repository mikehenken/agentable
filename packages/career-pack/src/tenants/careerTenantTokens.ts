/**
 * Tenant-scoped career brand tokens (Archipelago Helios gallery Archipelago).
 *
 * Marketing refs: Archipelago website `#0D7377`, Helios green `#006938`,
 * Archipelago gallery `#0E7490`. Hosts must not hard-code conflicting primaries
 * — read from this table or embed config `primaryColor`.
 */
export const CAREER_TENANT_PRIMARY_COLORS = {
  archipelago: '#0D7377',
  helios: '#006938',
  'archipelago-resorts': '#0E7490',
} as const;

export type CareerTenantPrimaryId = keyof typeof CAREER_TENANT_PRIMARY_COLORS;

const LEGACY_ARCHIPELAGO_PRIMARY = '#0077B6';

/** Resolve canonical primary hex for a career tenant id. */
export function resolveCareerTenantPrimaryColor(tenant: string): string {
  const normalized = tenant.trim().toLowerCase();
  if (normalized === 'archipelago') {
    return CAREER_TENANT_PRIMARY_COLORS.archipelago;
  }
  if (normalized === 'helios') {
    return CAREER_TENANT_PRIMARY_COLORS.helios;
  }
  if (normalized === 'archipelago-resorts') {
    return CAREER_TENANT_PRIMARY_COLORS['archipelago-resorts'];
  }
  return CAREER_TENANT_PRIMARY_COLORS.archipelago;
}

/** Apply `--landi-color-primary` (+ HSL when valid hex) on a host element. */
export function applyCareerTenantBrandTokens(
  host: HTMLElement,
  tenant: string,
  overridePrimary?: string): string {
  const primary = overridePrimary?.trim() || resolveCareerTenantPrimaryColor(tenant);
  host.style.setProperty('--landi-color-primary', primary);
  const hsl = hexToHslTriplet(primary);
  if (hsl !== null) {
    host.style.setProperty('--landi-color-primary-hsl', hsl);
  }
  return primary;
}

/** @internal Document legacy mismatch for parity audits. */
export const CAREER_TENANT_TOKEN_NOTES = {
  archipelago: {
    marketingRef: CAREER_TENANT_PRIMARY_COLORS.archipelago,
    legacyEmbedPrimary: LEGACY_ARCHIPELAGO_PRIMARY,
    status: 'unified to marketing ref in ',
  },
  helios: {
    marketingRef: CAREER_TENANT_PRIMARY_COLORS.helios,
    status: 'unchanged',
  },
  'archipelago-resorts': {
    marketingRef: CAREER_TENANT_PRIMARY_COLORS['archipelago-resorts'],
    status: 'gallery fictional tenant',
  },
} as const;

function hexToHslTriplet(hex: string): string | null {
  const normalized = hex.trim();
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(normalized);
  if (!match) {
    return null;
  }
  let raw = match[1];
  if (raw.length === 3) {
    raw = raw.split('').map((ch) => ch + ch).join('');
  }
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) {
    return `0 0% ${Math.round(l * 100)}%`;
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min): d / (max + min);
  let h = 0;
  if (max === r) {
    h = (g - b) / d + (g < b ? 6: 0);
  } else if (max === g) {
    h = (b - r) / d + 2;
  } else {
    h = (r - g) / d + 4;
  }
  h /= 6;
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
