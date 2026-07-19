/**
 * Chrome options in persisted panel instance data. Typed options live
 * under the reserved `chrome` key and are the source of truth; documents
 * written by hosts predating them used individual reserved `__*` keys,
 * which stay readable through the legacy fallbacks here. Writes go
 * through `withPanelChrome`, which also mirrors every resolved field back
 * to its legacy key for one minor version, so a rollback to an older
 * package can still read chrome state from snapshots this version saved.
 */
import type { PanelChromeOptions } from './types';

/** Reserved instance-data key holding the typed chrome options object. */
export const PANEL_CHROME_DATA_KEY = 'chrome';

/**
 * Every legacy reserved chrome key and the typed option it maps to.
 * `withPanelChrome` mirrors through this table; the compat tests iterate
 * it so a key added here without shim coverage fails loudly.
 */
export const LEGACY_PANEL_CHROME_DATA_KEYS = {
  __title: 'title',
  __minimized: 'minimized',
  __hideChrome: 'hideChrome',
  __fullBleed: 'fullBleed',
  __noBorder: 'noBorder',
} as const satisfies Record<string, keyof PanelChromeOptions>;

export type LegacyPanelChromeDataKey = keyof typeof LEGACY_PANEL_CHROME_DATA_KEYS;

const CHROME_OPTION_KEYS = [
  'title',
  'minimized',
  'hideChrome',
  'fullBleed',
  'noBorder',
] as const satisfies readonly (keyof PanelChromeOptions)[];

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

/**
 * Legacy flags were read with `Boolean(value)`, so any present value
 * counts; absence stays undefined so typed fields and defaults apply.
 */
function readLegacyFlag(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  return Boolean(value);
}

function assignDefined<K extends keyof PanelChromeOptions>(
  target: PanelChromeOptions,
  key: K,
  value: PanelChromeOptions[K] | undefined,
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

/**
 * Resolve the chrome options for a panel instance. Typed fields under
 * `data.chrome` win per field; legacy `__*` keys fill anything the typed
 * object leaves unset, so documents saved by older hosts keep behaving
 * exactly as they did.
 */
export function resolvePanelChrome(
  data: Record<string, unknown> | undefined,
): PanelChromeOptions {
  const chrome: PanelChromeOptions = {};
  if (!data) return chrome;
  const typed = asRecord(data[PANEL_CHROME_DATA_KEY]);

  assignDefined(chrome, 'title', readString(typed?.title) ?? readString(data.__title));
  assignDefined(
    chrome,
    'minimized',
    readBoolean(typed?.minimized) ?? readLegacyFlag(data.__minimized),
  );
  assignDefined(
    chrome,
    'hideChrome',
    readBoolean(typed?.hideChrome) ?? readLegacyFlag(data.__hideChrome),
  );
  assignDefined(
    chrome,
    'fullBleed',
    readBoolean(typed?.fullBleed) ?? readLegacyFlag(data.__fullBleed),
  );
  assignDefined(
    chrome,
    'noBorder',
    readBoolean(typed?.noBorder) ?? readLegacyFlag(data.__noBorder),
  );
  return chrome;
}

/**
 * Merge a chrome patch into instance data. The result carries the full
 * resolved chrome under `data.chrome` (promoting any legacy-only values
 * to typed fields) plus legacy-key mirrors of every set field, keeping
 * the document readable by the previous package version.
 */
export function withPanelChrome(
  data: Record<string, unknown>,
  patch: PanelChromeOptions,
): Record<string, unknown> {
  const merged = resolvePanelChrome(data);
  for (const key of CHROME_OPTION_KEYS) {
    assignDefined(merged, key, patch[key]);
  }

  const next: Record<string, unknown> = {
    ...data,
    [PANEL_CHROME_DATA_KEY]: { ...merged },
  };
  for (const [legacyKey, option] of Object.entries(LEGACY_PANEL_CHROME_DATA_KEYS)) {
    const value = merged[option];
    if (value !== undefined) {
      next[legacyKey] = value;
    }
  }
  return next;
}
