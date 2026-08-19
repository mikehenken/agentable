/**
 * Locale resolution for a workspace session (02 section 16).
 *
 * Resolution order: embed `locale` attribute > tenant config `locale` >
 * `navigator.language`, falling back to English. The locale is resolved
 * ONCE per session (the embed/session bootstrap calls `resolveLocale`
 * and hands the result to `createI18n` / `configureI18n`); panels,
 * agents, and voice all receive the same resolved value.
 */

export const DEFAULT_LOCALE = 'en';

export interface LocaleResolutionInput {
  /** `locale` attribute on the embed element; highest precedence. */
  embedLocale?: string | null;
  /** Tenant configuration locale; middle precedence. */
  tenantLocale?: string | null;
  /**
   * Browser language; lowest precedence. Defaults to
   * `navigator.language` when a navigator exists (it does not in some
   * server/test environments).
   */
  navigatorLanguage?: string | null;
}

function canonicalize(candidate: string | null | undefined): string | null {
  if (typeof candidate !== 'string') return null;
  const trimmed = candidate.trim();
  if (trimmed.length === 0) return null;
  try {
    const canonical = Intl.getCanonicalLocales(trimmed);
    return canonical.length > 0 ? canonical[0] : null;
  } catch {
    return null;
  }
}

function defaultNavigatorLanguage(): string | null {
  if (typeof navigator === 'undefined') return null;
  return typeof navigator.language === 'string' ? navigator.language : null;
}

/**
 * Resolve the session locale. Invalid or empty candidates at any layer
 * fall through to the next layer rather than erroring, so a bad embed
 * attribute degrades to tenant/browser language instead of breaking the
 * mount.
 */
export function resolveLocale(input: LocaleResolutionInput = {}): string {
  const navigatorLanguage =
    input.navigatorLanguage !== undefined ? input.navigatorLanguage : defaultNavigatorLanguage();
  return (
    canonicalize(input.embedLocale) ??
    canonicalize(input.tenantLocale) ??
    canonicalize(navigatorLanguage) ??
    DEFAULT_LOCALE
  );
}

/**
 * The lookup chain for catalog resolution: the locale itself, then each
 * ancestor obtained by dropping subtags, then English. Example:
 * `es-MX` -> `['es-MX', 'es', 'en']`.
 */
export function localeFallbackChain(locale: string): string[] {
  const chain: string[] = [];
  const canonical = canonicalize(locale) ?? DEFAULT_LOCALE;
  let current = canonical;
  while (current.length > 0) {
    chain.push(current);
    const cut = current.lastIndexOf('-');
    if (cut <= 0) break;
    current = current.slice(0, cut);
  }
  if (!chain.includes(DEFAULT_LOCALE)) {
    chain.push(DEFAULT_LOCALE);
  }
  return chain;
}
