/**
 * Mapping contract for `src/panels/chrome.ts`: every legacy reserved
 * `__*` chrome key resolves to its typed option, typed options round-trip
 * through instance data, typed fields win over legacy ones, and writes
 * mirror back to the legacy keys so older package versions can still
 * read documents this version saves.
 */
import { describe, it, expect } from 'vitest';
import {
  LEGACY_PANEL_CHROME_DATA_KEYS,
  PANEL_CHROME_DATA_KEY,
  resolvePanelChrome,
  withPanelChrome,
} from '../../src/panels/chrome';
import type { PanelChromeOptions } from '../../src/panels/types';

const SAMPLE_VALUES: Record<keyof PanelChromeOptions, string | boolean> = {
  title: 'Quarterly Review',
  minimized: true,
  hideChrome: true,
  fullBleed: true,
  noBorder: true,
};

describe('legacy key catalog', () => {
  it('covers exactly the reserved chrome keys the whiteboard ever wrote', () => {
    expect(Object.keys(LEGACY_PANEL_CHROME_DATA_KEYS).sort()).toEqual([
      '__fullBleed',
      '__hideChrome',
      '__minimized',
      '__noBorder',
      '__title',
    ]);
  });

  it('maps every legacy key onto a distinct typed option', () => {
    const options = Object.values(LEGACY_PANEL_CHROME_DATA_KEYS);
    expect(new Set(options).size).toBe(options.length);
  });
});

describe('resolvePanelChrome, legacy fallbacks', () => {
  it('resolves each legacy key to its typed option', () => {
    for (const [legacyKey, option] of Object.entries(LEGACY_PANEL_CHROME_DATA_KEYS)) {
      const resolved = resolvePanelChrome({ [legacyKey]: SAMPLE_VALUES[option] });
      expect(resolved[option]).toBe(SAMPLE_VALUES[option]);
    }
  });

  it('resolves a fully legacy document to the complete typed shape', () => {
    const resolved = resolvePanelChrome({
      __title: 'Chat',
      __minimized: true,
      __hideChrome: true,
      __fullBleed: false,
      __noBorder: true,
    });
    expect(resolved).toEqual({
      title: 'Chat',
      minimized: true,
      hideChrome: true,
      fullBleed: false,
      noBorder: true,
    });
  });

  it('treats present legacy flag values by truthiness, matching the old reads', () => {
    expect(resolvePanelChrome({ __minimized: 1 }).minimized).toBe(true);
    expect(resolvePanelChrome({ __fullBleed: '' }).fullBleed).toBe(false);
    expect(resolvePanelChrome({ __hideChrome: 'yes' }).hideChrome).toBe(true);
  });

  it('ignores a legacy title that is not a string', () => {
    expect(resolvePanelChrome({ __title: 42 }).title).toBeUndefined();
  });

  it('returns an empty shape for missing or unrelated data', () => {
    expect(resolvePanelChrome(undefined)).toEqual({});
    expect(resolvePanelChrome({})).toEqual({});
    expect(resolvePanelChrome({ selectedJobId: 7 })).toEqual({});
  });
});

describe('resolvePanelChrome, typed precedence', () => {
  it('prefers typed fields over legacy keys per field', () => {
    const resolved = resolvePanelChrome({
      [PANEL_CHROME_DATA_KEY]: { title: 'New', minimized: false },
      __title: 'Old',
      __minimized: true,
      __noBorder: true,
    });
    expect(resolved.title).toBe('New');
    expect(resolved.minimized).toBe(false);
    expect(resolved.noBorder).toBe(true);
  });

  it('falls back to legacy keys when the typed object holds wrong types', () => {
    const resolved = resolvePanelChrome({
      [PANEL_CHROME_DATA_KEY]: { title: 7, minimized: 'nope' },
      __title: 'Legacy',
      __minimized: true,
    });
    expect(resolved.title).toBe('Legacy');
    expect(resolved.minimized).toBe(true);
  });

  it('ignores a non-object value under the chrome key', () => {
    expect(resolvePanelChrome({ [PANEL_CHROME_DATA_KEY]: 'chat' })).toEqual({});
  });
});

describe('withPanelChrome', () => {
  it('round-trips typed options through instance data', () => {
    const options: PanelChromeOptions = {
      title: 'Preview',
      minimized: false,
      hideChrome: false,
      fullBleed: true,
      noBorder: true,
    };
    expect(resolvePanelChrome(withPanelChrome({}, options))).toEqual(options);
  });

  it('mirrors every written field to its legacy key', () => {
    const next = withPanelChrome({}, {
      title: 'Preview',
      minimized: true,
      hideChrome: true,
      fullBleed: true,
      noBorder: true,
    });
    for (const [legacyKey, option] of Object.entries(LEGACY_PANEL_CHROME_DATA_KEYS)) {
      expect(next[legacyKey]).toBe((next[PANEL_CHROME_DATA_KEY] as PanelChromeOptions)[option]);
    }
  });

  it('leaves unset options out of both typed and legacy keys', () => {
    const next = withPanelChrome({}, { title: 'Chat' });
    expect(next[PANEL_CHROME_DATA_KEY]).toEqual({ title: 'Chat' });
    expect(next.__title).toBe('Chat');
    expect(next).not.toHaveProperty('__minimized');
    expect(next).not.toHaveProperty('__hideChrome');
    expect(next).not.toHaveProperty('__fullBleed');
    expect(next).not.toHaveProperty('__noBorder');
  });

  it('merges a patch over existing chrome without dropping fields', () => {
    const first = withPanelChrome({}, { title: 'Chat', fullBleed: true });
    const second = withPanelChrome(first, { minimized: true });
    expect(resolvePanelChrome(second)).toEqual({
      title: 'Chat',
      fullBleed: true,
      minimized: true,
    });
  });

  it('promotes legacy-only values into the typed object on write', () => {
    const next = withPanelChrome({ __title: 'Legacy Title' }, { minimized: true });
    expect(next[PANEL_CHROME_DATA_KEY]).toEqual({
      title: 'Legacy Title',
      minimized: true,
    });
    expect(next.__title).toBe('Legacy Title');
    expect(next.__minimized).toBe(true);
  });

  it('preserves unrelated panel data keys', () => {
    const next = withPanelChrome(
      { selectedJobId: 7, contextRef: 'site:1' },
      { title: 'Jobs' },
    );
    expect(next.selectedJobId).toBe(7);
    expect(next.contextRef).toBe('site:1');
  });

  it('does not mutate the input data', () => {
    const data = { __title: 'Chat' };
    withPanelChrome(data, { minimized: true });
    expect(data).toEqual({ __title: 'Chat' });
  });
});
