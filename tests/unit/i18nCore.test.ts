/**
 * Locale layer core proofs (02 section 16): resolution order (embed
 * attribute > tenant config > navigator.language > English), fallback
 * chains, catalog lookup with locale packs, partial-pack fallback to
 * English, `Intl` formatter helpers bound to the resolved locale, text
 * direction for RTL locales, the logical-properties guidance table, and
 * the session default instance (`configureI18n`/`getI18n`/bound `t`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
 configureI18n,
 createI18n,
 createIntlFormatters,
 DEFAULT_LOCALE,
 getI18n,
 getTextDirection,
 localeFallbackChain,
 PHYSICAL_TO_LOGICAL_CSS,
 resolveLocale,
 t,
} from '../../src/i18n';

afterEach(() => {
 // Restore the session default so other suites see plain English.
 configureI18n({ navigatorLanguage: null });
});

describe('resolveLocale', () => {
 it('prefers the embed attribute over tenant config and navigator', () => {
 expect(resolveLocale({ embedLocale: 'es-MX', tenantLocale: 'fr', navigatorLanguage: 'de' }),
 ).toBe('es-MX');
 });

 it('falls back to tenant config when the embed attribute is absent or invalid', () => {
 expect(resolveLocale({ tenantLocale: 'fr-CA', navigatorLanguage: 'de' })).toBe('fr-CA');
 expect(resolveLocale({ embedLocale: '!!not-a-locale!!', tenantLocale: 'fr-CA', navigatorLanguage: 'de' }),
 ).toBe('fr-CA');
 expect(resolveLocale({ embedLocale: ' ', tenantLocale: 'fr-CA', navigatorLanguage: 'de' })).toBe(
 'fr-CA',
 );
 });

 it('falls back to navigator.language, then English', () => {
 expect(resolveLocale({ navigatorLanguage: 'de-AT' })).toBe('de-AT');
 expect(resolveLocale({ navigatorLanguage: null })).toBe(DEFAULT_LOCALE);
 });

 it('canonicalizes locale tags', () => {
 expect(resolveLocale({ embedLocale: 'EN-us' })).toBe('en-US');
 expect(resolveLocale({ embedLocale: ' ar-EG ' })).toBe('ar-EG');
 });
});

describe('localeFallbackChain', () => {
 it('drops subtags down to the base language and ends at English', () => {
 expect(localeFallbackChain('es-MX')).toEqual(['es-MX', 'es', 'en']);
 expect(localeFallbackChain('zh-Hant-TW')).toEqual(['zh-Hant-TW', 'zh-Hant', 'zh', 'en']);
 expect(localeFallbackChain('en-GB')).toEqual(['en-GB', 'en']);
 expect(localeFallbackChain('en')).toEqual(['en']);
 });
});

describe('createI18n', () => {
 it('resolves messages from a registered locale pack', () => {
 const i18n = createI18n({
 embedLocale: 'es',
 catalogs: { es: { 'catalog.state.loading': 'Cargando...' } },
 });
 expect(i18n.locale).toBe('es');
 expect(i18n.t('catalog.state.loading')).toBe('Cargando...');
 });

 it('walks the fallback chain: regional pack, base pack, then English', () => {
 const i18n = createI18n({
 embedLocale: 'es-MX',
 catalogs: {
 'es-MX': { 'catalog.state.saving': 'Guardando (MX)...' },
 es: { 'catalog.state.loading': 'Cargando...' },
 },
 });
 expect(i18n.t('catalog.state.saving')).toBe('Guardando (MX)...');
 expect(i18n.t('catalog.state.loading')).toBe('Cargando...');
 // Not in either Spanish pack: falls back to the English catalog.
 expect(i18n.t('catalog.state.error')).toBe('Error loading data');
 });

 it('lets a supplied en catalog override individual English messages', () => {
 const i18n = createI18n({
 navigatorLanguage: null,
 catalogs: { en: { 'catalog.state.empty': 'Nothing here yet' } },
 });
 expect(i18n.t('catalog.state.empty')).toBe('Nothing here yet');
 expect(i18n.t('catalog.state.loading')).toBe('Loading...');
 });

 it('interpolates ICU values through t()', () => {
 const i18n = createI18n({ navigatorLanguage: null });
 expect(i18n.t('renderer.unsupportedBlock', { type: 'chart' })).toBe(
 'Unsupported block (chart)',
 );
 expect(i18n.t('validation.budget.nodes', { count: 300, max: 200 })).toBe(
 'Spec has 300 nodes; maximum is 200',
 );
 });

 it('returns the key and warns once when a key is missing everywhere', () => {
 const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
 try {
 const i18n = createI18n({ embedLocale: 'fr' });
 const bogusKey = 'framework.bogus.missing' as Parameters<typeof i18n.t>[0];
 expect(i18n.t(bogusKey)).toBe('framework.bogus.missing');
 i18n.t(bogusKey);
 expect(warn).toHaveBeenCalledTimes(1);
 } finally {
 warn.mockRestore();
 }
 });

 it('exposes direction and locale-bound formatters', () => {
 const arabic = createI18n({ embedLocale: 'ar' });
 expect(arabic.direction).toBe('rtl');
 const german = createI18n({ embedLocale: 'de-DE' });
 expect(german.direction).toBe('ltr');
 expect(german.formatters.formatNumber(51200)).toBe('51.200');
 });
});

describe('session default instance', () => {
 it('is English before configuration and swaps after configureI18n', () => {
 configureI18n({ navigatorLanguage: null });
 expect(getI18n().locale).toBe('en');
 expect(t('catalog.state.loading')).toBe('Loading...');

 const configured = configureI18n({
 embedLocale: 'es',
 catalogs: { es: { 'catalog.state.loading': 'Cargando...' } },
 });
 expect(configured).toBe(getI18n());
 expect(getI18n().locale).toBe('es');
 expect(t('catalog.state.loading')).toBe('Cargando...');
 });
});

describe('createIntlFormatters', () => {
 const formatters = createIntlFormatters('en-US');

 it('formats dates, times, numbers, currencies, and relative times', () => {
 const date = new Date(Date.UTC(2026, 0, 15, 12, 30));
 expect(formatters.formatDate(date)).toBe(new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date),
 );
 expect(formatters.formatTime(date)).toBe(new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(date),
 );
 expect(formatters.formatNumber(1234567.89)).toBe('1,234,567.89');
 expect(formatters.formatCurrency(99.5, 'USD')).toBe('$99.50');
 expect(formatters.formatRelativeTime(-1, 'day')).toBe('yesterday');
 expect(formatters.formatRelativeTime(3, 'hour')).toBe('in 3 hours');
 });

 it('respects the bound locale', () => {
 const spanish = createIntlFormatters('es-ES');
 expect(spanish.formatRelativeTime(-1, 'day')).toBe('ayer');
 expect(spanish.formatNumber(1234.5)).toBe('1234,5');
 });

 it('accepts timestamps and rejects invalid dates', () => {
 const timestamp = Date.UTC(2026, 5, 1);
 expect(formatters.formatDate(timestamp)).toBe(new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(timestamp)),
 );
 expect(() => formatters.formatDate(Number.NaN)).toThrow('[i18n]');
 });
});

describe('getTextDirection', () => {
 it('reports rtl for RTL languages and scripts', () => {
 expect(getTextDirection('ar')).toBe('rtl');
 expect(getTextDirection('he-IL')).toBe('rtl');
 expect(getTextDirection('fa')).toBe('rtl');
 expect(getTextDirection('ur-PK')).toBe('rtl');
 expect(getTextDirection('az-Arab')).toBe('rtl');
 });

 it('reports ltr for LTR locales and unknown input', () => {
 expect(getTextDirection('en-US')).toBe('ltr');
 expect(getTextDirection('es')).toBe('ltr');
 expect(getTextDirection('ja')).toBe('ltr');
 expect(getTextDirection('not a locale !!')).toBe('ltr');
 });
});

describe('logical properties guidance (layout contract)', () => {
 it('maps every physical inline-axis property to a logical replacement', () => {
 expect(PHYSICAL_TO_LOGICAL_CSS['margin-left']).toBe('margin-inline-start');
 expect(PHYSICAL_TO_LOGICAL_CSS['padding-right']).toBe('padding-inline-end');
 expect(PHYSICAL_TO_LOGICAL_CSS.left).toBe('inset-inline-start');
 expect(PHYSICAL_TO_LOGICAL_CSS['text-align: left']).toBe('text-align: start');
 for (const [physical, logical] of Object.entries(PHYSICAL_TO_LOGICAL_CSS)) {
 expect(logical.length, physical).toBeGreaterThan(0);
 }
 });
});
