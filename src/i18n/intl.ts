/**
 * `Intl` formatting helpers bound to the resolved session locale.
 * Dates, numbers, currencies, and relative times in catalog components
 * MUST render through these (or through ICU `{arg, number|date|time}`
 * catalog placeholders, which use the same `Intl` machinery) - never
 * hand-rolled formatting. Formatter instances are cached per
 * locale+options because `Intl.*Format` construction is expensive.
 */

export type DateInput = Date | number;

export interface IntlFormatters {
  readonly locale: string;
  formatDate(value: DateInput, options?: Intl.DateTimeFormatOptions): string;
  formatTime(value: DateInput, options?: Intl.DateTimeFormatOptions): string;
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string;
  formatCurrency(value: number, currency: string, options?: Intl.NumberFormatOptions): string;
  formatRelativeTime(
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    options?: Intl.RelativeTimeFormatOptions,
  ): string;
}

function cacheKey(locale: string, options: object | undefined): string {
  return `${locale}|${JSON.stringify(options ?? {})}`;
}

function toDate(value: DateInput): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('[i18n] Invalid date passed to Intl formatter');
  }
  return date;
}

/** Build the formatter set for one resolved locale. */
export function createIntlFormatters(locale: string): IntlFormatters {
  const dateTimeCache = new Map<string, Intl.DateTimeFormat>();
  const numberCache = new Map<string, Intl.NumberFormat>();
  const relativeCache = new Map<string, Intl.RelativeTimeFormat>();

  const dateTime = (options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => {
    const key = cacheKey(locale, options);
    let formatter = dateTimeCache.get(key);
    if (formatter === undefined) {
      formatter = new Intl.DateTimeFormat(locale, options);
      dateTimeCache.set(key, formatter);
    }
    return formatter;
  };

  const number = (options: Intl.NumberFormatOptions): Intl.NumberFormat => {
    const key = cacheKey(locale, options);
    let formatter = numberCache.get(key);
    if (formatter === undefined) {
      formatter = new Intl.NumberFormat(locale, options);
      numberCache.set(key, formatter);
    }
    return formatter;
  };

  const relative = (options: Intl.RelativeTimeFormatOptions): Intl.RelativeTimeFormat => {
    const key = cacheKey(locale, options);
    let formatter = relativeCache.get(key);
    if (formatter === undefined) {
      formatter = new Intl.RelativeTimeFormat(locale, options);
      relativeCache.set(key, formatter);
    }
    return formatter;
  };

  return {
    locale,
    formatDate(value, options) {
      return dateTime(options ?? { dateStyle: 'medium' }).format(toDate(value));
    },
    formatTime(value, options) {
      return dateTime(options ?? { timeStyle: 'short' }).format(toDate(value));
    },
    formatNumber(value, options) {
      return number(options ?? {}).format(value);
    },
    formatCurrency(value, currency, options) {
      return number({ style: 'currency', currency, ...options }).format(value);
    },
    formatRelativeTime(value, unit, options) {
      return relative(options ?? { numeric: 'auto' }).format(value, unit);
    },
  };
}
