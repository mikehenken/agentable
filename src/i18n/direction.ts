/**
 * Text direction and CSS logical-properties support.
 *
 * Layout in framework chrome and catalog styles uses CSS LOGICAL
 * properties (`margin-inline-start`, `padding-block`, `inset-inline-end`,
 * `border-start-start-radius`, `text-align: start`, ...) instead of
 * physical ones, so RTL locales work by setting `dir` on the workspace
 * root - which `SpecRenderer` does from the resolved locale - with no
 * per-component fixes. `PHYSICAL_TO_LOGICAL_CSS` documents the required
 * substitutions and gives tooling a machine-readable rule table.
 */

export type TextDirection = 'ltr' | 'rtl';

/**
 * Languages whose default script is right-to-left. Used when the runtime
 * lacks `Intl.Locale` text-info support (happy-dom, older engines).
 * Sources: CLDR scriptDirection data for arab/hebr/thaa/nkoo/syrc/adlm
 * script defaults.
 */
const RTL_LANGUAGES: ReadonlySet<string> = new Set([
  'ar', // Arabic
  'arc', // Aramaic
  'ckb', // Central Kurdish (Sorani)
  'dv', // Divehi
  'fa', // Persian
  'ff-adlm', // Fulah in Adlam script
  'he', // Hebrew
  'ks', // Kashmiri
  'nqo', // N'Ko
  'ps', // Pashto
  'sd', // Sindhi
  'syr', // Syriac
  'ug', // Uyghur
  'ur', // Urdu
  'yi', // Yiddish
]);

const RTL_SCRIPTS: ReadonlySet<string> = new Set([
  'Adlm',
  'Arab',
  'Hebr',
  'Nkoo',
  'Syrc',
  'Thaa',
]);

interface LocaleTextInfo {
  direction?: string;
}

interface LocaleWithTextInfo extends Intl.Locale {
  textInfo?: LocaleTextInfo;
  getTextInfo?: () => LocaleTextInfo;
}

/**
 * Resolve the text direction for a locale. Prefers the engine's own
 * `Intl.Locale` text info (spec: `getTextInfo()`, shipped in V8 as the
 * `textInfo` getter); falls back to the CLDR-derived script/language
 * tables above.
 */
export function getTextDirection(locale: string): TextDirection {
  let parsed: LocaleWithTextInfo | null = null;
  try {
    parsed = new Intl.Locale(locale) as LocaleWithTextInfo;
  } catch {
    return 'ltr';
  }

  const info =
    typeof parsed.getTextInfo === 'function' ? parsed.getTextInfo() : parsed.textInfo;
  if (info?.direction === 'rtl') return 'rtl';
  if (info?.direction === 'ltr') return 'ltr';

  if (parsed.script !== undefined && RTL_SCRIPTS.has(parsed.script)) return 'rtl';
  if (parsed.script !== undefined) return 'ltr';
  const language = parsed.language ?? '';
  return RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr';
}

/**
 * Physical CSS properties that MUST NOT appear in framework chrome or
 * catalog styles, each mapped to the logical property to use instead.
 * This is the guidance table; style reviews and future lint tooling
 * key off it.
 */
export const PHYSICAL_TO_LOGICAL_CSS: Readonly<Record<string, string>> = {
  left: 'inset-inline-start',
  right: 'inset-inline-end',
  top: 'inset-block-start',
  bottom: 'inset-block-end',
  'margin-left': 'margin-inline-start',
  'margin-right': 'margin-inline-end',
  'margin-top': 'margin-block-start',
  'margin-bottom': 'margin-block-end',
  'padding-left': 'padding-inline-start',
  'padding-right': 'padding-inline-end',
  'padding-top': 'padding-block-start',
  'padding-bottom': 'padding-block-end',
  'border-left': 'border-inline-start',
  'border-right': 'border-inline-end',
  'border-top': 'border-block-start',
  'border-bottom': 'border-block-end',
  'border-top-left-radius': 'border-start-start-radius',
  'border-top-right-radius': 'border-start-end-radius',
  'border-bottom-left-radius': 'border-end-start-radius',
  'border-bottom-right-radius': 'border-end-end-radius',
  'text-align: left': 'text-align: start',
  'text-align: right': 'text-align: end',
  width: 'inline-size (when the box should follow writing mode)',
  height: 'block-size (when the box should follow writing mode)',
};
