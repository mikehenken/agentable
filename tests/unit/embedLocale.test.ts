/**
 * embed locale attribute wiring + session bootstrap (/).
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  bootstrapSessionLocale,
  DEFAULT_LOCALE,
  getI18n,
  resolveLocale,
} from '../../src/i18n';
import {
  mergeEmbedConfig,
  type EmbedBuiltInDefaults,
} from '../../src/embed/embedConfigMerge';
import type { EmbedAttributeSnapshot } from '../../src/embed/types/embedConfig';

const DEFAULTS: EmbedBuiltInDefaults = {
  tenant: 'default',
  primaryColor: '#3B82F6',
  welcomeMessage: 'Hi!',
  apiEndpoint: '/api',
  voiceEnabled: false,
  snapGrid: true,
  systemPrompt: '',
  voiceGreeting: '',
  greetingMode: '',
  tokenEndpoint: '',
  fullpageOnEngage: false,
  canvasMode: 'infinite',
  canvasBounds: '',
  canvasBehavior: '',
  canvasZoom: '',
  hostHeaderHeight: '',
  locale: 'en',
};

const EMPTY_ATTRS: EmbedAttributeSnapshot = {
  tenant: '',
  primaryColor: '',
  welcomeMessage: '',
  apiEndpoint: '',
  voiceEnabled: false,
  voiceEnabledSet: false,
  snapGrid: true,
  snapGridSet: false,
  systemPrompt: '',
  voiceGreeting: '',
  greetingMode: '',
  tokenEndpoint: '',
  fullpageOnEngage: false,
  fullscreenOnEngage: false,
  fullpageOnEngageSet: false,
  canvasMode: '',
  canvasBounds: '',
  canvasBehavior: '',
  canvasZoom: '',
  hostHeaderHeight: '',
  locale: '',
  toolbarConfigJson: '',
};

afterEach(() => {
  bootstrapSessionLocale({});
});

describe('mergeEmbedConfig locale', () => {
  it('defaults locale to en when unset', () => {
    const merged = mergeEmbedConfig(DEFAULTS, null, EMPTY_ATTRS, null);
    expect(merged.locale).toBe('en');
  });

  it('merges locale from config-url then attribute override', () => {
    const fromDoc = mergeEmbedConfig(
      DEFAULTS,
      { locale: 'es' },
      EMPTY_ATTRS,
      null);
    expect(fromDoc.locale).toBe('es');
    expect(fromDoc.tenantConfig.locale).toBe('es');

    const fromAttr = mergeEmbedConfig(
      DEFAULTS,
      { locale: 'es' },
      {...EMPTY_ATTRS, locale: 'en-US' },
      null);
    expect(fromAttr.locale).toBe('en-US');
  });
});

describe('bootstrapSessionLocale', () => {
  it('SC2: en catalog remains default without embed locale', () => {
    bootstrapSessionLocale({});
    expect(getI18n().locale).toBe(DEFAULT_LOCALE);
    expect(getI18n().t('career.panels.openPositions.title')).toBe('Open Positions');
  });

  it('SC1: embed locale es resolves Spanish career strings', () => {
    bootstrapSessionLocale({ embedLocale: 'es' });
    expect(getI18n().locale).toBe('es');
    expect(getI18n().t('career.panels.openPositions.title')).toBe('Posiciones abiertas');
    expect(getI18n().t('career.nav.growthPaths')).toBe('Rutas de crecimiento');
  });

  it('prefers embed attribute over tenant config locale', () => {
    bootstrapSessionLocale({ embedLocale: 'en-GB', tenantLocale: 'es' });
    expect(resolveLocale({ embedLocale: 'en-GB', tenantLocale: 'es' })).toBe('en-GB');
    expect(getI18n().t('career.panels.resources.title')).toBe('Resources');
  });
});
