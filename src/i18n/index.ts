/**
 * Framework locale layer (D42, 02 section 16).
 *
 * Every user-facing string in framework chrome, catalog components, and
 * validation messages resolves through `t()` against ICU MessageFormat
 * catalogs. The framework ships English (`catalog/en.ts`); tenants and
 * packs register additional locale catalogs via `createI18n` /
 * `configureI18n`. Locale resolution order is embed attribute > tenant
 * config > `navigator.language` (see `resolveLocale.ts`), resolved once
 * per session.
 *
 * Two consumption modes:
 *  - `createI18n(...)` builds an isolated instance (tests, future
 *    per-workspace locales).
 *  - The module-level default instance backs the bound `t()` that
 *    renderer/catalog/validator code imports. `configureI18n(...)` at
 *    session bootstrap swaps it for the session's resolved locale; until
 *    then it formats English, so the framework is correct with zero
 *    configuration.
 */
import { en, type MessageCatalog, type MessageKey } from './catalog/en';
import { getTextDirection, type TextDirection } from './direction';
import { createIntlFormatters, type IntlFormatters } from './intl';
import { formatIcuMessage, type MessageValues } from './messageFormat';
import { DEFAULT_LOCALE, localeFallbackChain, resolveLocale, type LocaleResolutionInput } from './resolveLocale';

export interface I18nOptions extends LocaleResolutionInput {
  /**
   * Additional locale catalogs keyed by canonical locale tag. `en` is
   * built in and always terminates the fallback chain; a supplied `en`
   * entry overrides individual English messages (tenant rewording).
   */
  catalogs?: Readonly<Record<string, MessageCatalog>>;
}

export interface I18n {
  /** The session locale, resolved once at construction. */
  readonly locale: string;
  /** Text direction for the resolved locale; drives `dir` + logical CSS. */
  readonly direction: TextDirection;
  /** `Intl` formatters bound to the resolved locale. */
  readonly formatters: IntlFormatters;
  /** Format the catalog message for `key`, ICU-interpolating `values`. */
  t(key: MessageKey, values?: MessageValues): string;
}

const missingKeyWarnings = new Set<string>();

/**
 * Build an i18n instance for a resolved locale. Message lookup walks the
 * locale fallback chain (`es-MX` -> `es` -> `en`); a key missing from
 * every catalog returns the key itself and warns once, so a partial
 * locale pack degrades to English rather than blank chrome.
 */
export function createI18n(options: I18nOptions = {}): I18n {
  const locale = resolveLocale(options);
  const chain = localeFallbackChain(locale);
  const catalogs = options.catalogs ?? {};

  const lookup = (key: MessageKey): string | undefined => {
    for (const candidate of chain) {
      const fromRegistered = catalogs[candidate]?.[key];
      if (fromRegistered !== undefined) return fromRegistered;
      if (candidate === DEFAULT_LOCALE && en[key] !== undefined) return en[key];
    }
    return undefined;
  };

  return {
    locale,
    direction: getTextDirection(locale),
    formatters: createIntlFormatters(locale),
    t(key, values) {
      const message = lookup(key);
      if (message === undefined) {
        if (!missingKeyWarnings.has(key)) {
          missingKeyWarnings.add(key);
          console.warn(`[i18n] Missing message key "${key}" for locale "${locale}"`);
        }
        return key;
      }
      return formatIcuMessage(message, locale, values);
    },
  };
}

let defaultInstance: I18n = createI18n({ navigatorLanguage: null });

/**
 * Configure the session-wide default instance. Called once at session
 * bootstrap with the embed/tenant locale inputs; returns the configured
 * instance so callers can also inject the resolved locale into agent
 * system context and voice session config (D42).
 */
export function configureI18n(options: I18nOptions = {}): I18n {
  defaultInstance = createI18n(options);
  return defaultInstance;
}

/** The session-wide default instance (English until `configureI18n`). */
export function getI18n(): I18n {
  return defaultInstance;
}

/** Bound translate against the session default instance. */
export function t(key: MessageKey, values?: MessageValues): string {
  return defaultInstance.t(key, values);
}

export { en } from './catalog/en';
export type { MessageCatalog, MessageKey } from './catalog/en';
export { getTextDirection, PHYSICAL_TO_LOGICAL_CSS } from './direction';
export type { TextDirection } from './direction';
export { createIntlFormatters } from './intl';
export type { DateInput, IntlFormatters } from './intl';
export { formatIcuMessage } from './messageFormat';
export type { MessageValue, MessageValues } from './messageFormat';
export { DEFAULT_LOCALE, localeFallbackChain, resolveLocale } from './resolveLocale';
export type { LocaleResolutionInput } from './resolveLocale';
export { bootstrapSessionLocale } from './bootstrapSessionLocale';
export type { SessionLocaleBootstrapInput } from './bootstrapSessionLocale';
