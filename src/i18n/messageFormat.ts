/**
 * ICU MessageFormat engine for the framework locale layer (D42).
 *
 * Implements the ICU subset the catalogs need with zero dependencies:
 *
 *  - literal text with ICU quoting (`''` is a literal apostrophe; a single
 *    quote starts a quoted literal when followed by `{`, `}`, or `#`)
 *  - `{arg}` simple replacement
 *  - `{arg, number}` / `{arg, number, integer}` / `{arg, number, percent}`
 *    via `Intl.NumberFormat`
 *  - `{arg, date, short|medium|long|full}` and `{arg, time, ...}` via
 *    `Intl.DateTimeFormat`
 *  - `{arg, plural, =N {...} one {...} other {...}}` via `Intl.PluralRules`
 *    (cardinal), with `#` inside a branch formatting the numeric value
 *  - `{arg, selectordinal, ...}` via `Intl.PluralRules` (ordinal)
 *  - `{arg, select, key {...} other {...}}`
 *
 * Unsupported ICU features (plural offset, number/date skeletons, nested
 * argument styles beyond the above) throw at parse time so a bad catalog
 * entry fails loudly in tests rather than rendering garbage. Parsed
 * messages are cached per message string; catalog messages are static so
 * the cache is bounded by catalog size.
 */

export type MessageValue = string | number | boolean | Date | null | undefined;

export type MessageValues = Readonly<Record<string, MessageValue>>;

type MessageToken =
  | { kind: 'text'; text: string }
  | { kind: 'arg'; name: string }
  | { kind: 'number'; name: string; style: 'decimal' | 'integer' | 'percent' }
  | { kind: 'datetime'; name: string; mode: 'date' | 'time'; style: DateTimeStyle }
  | { kind: 'plural'; name: string; type: 'cardinal' | 'ordinal'; branches: PluralBranch[] }
  | { kind: 'select'; name: string; branches: SelectBranch[] }
  | { kind: 'pound' };

type DateTimeStyle = 'short' | 'medium' | 'long' | 'full';

interface PluralBranch {
  /** `=N` exact selector (as the number N) or a CLDR plural category. */
  selector: number | Intl.LDMLPluralRule;
  tokens: MessageToken[];
}

interface SelectBranch {
  selector: string;
  tokens: MessageToken[];
}

const DATE_TIME_STYLES: readonly DateTimeStyle[] = ['short', 'medium', 'long', 'full'];
const PLURAL_CATEGORIES: readonly Intl.LDMLPluralRule[] = [
  'zero',
  'one',
  'two',
  'few',
  'many',
  'other',
];

class MessageParser {
  private readonly source: string;
  private pos = 0;

  constructor(source: string) {
    this.source = source;
  }

  parse(): MessageToken[] {
    const tokens = this.parseTokens(false, false);
    if (this.pos < this.source.length) {
      throw this.error(`unexpected "${this.source[this.pos]}"`);
    }
    return tokens;
  }

  /**
   * Parse tokens until end of input, or until an unmatched `}` when inside
   * a branch body. `inPlural` makes `#` a pound token instead of text.
   */
  private parseTokens(insideBranch: boolean, inPlural: boolean): MessageToken[] {
    const tokens: MessageToken[] = [];
    let text = '';
    const flushText = (): void => {
      if (text.length > 0) {
        tokens.push({ kind: 'text', text });
        text = '';
      }
    };

    while (this.pos < this.source.length) {
      const char = this.source[this.pos];
      if (char === "'") {
        text += this.readQuoted();
        continue;
      }
      if (char === '{') {
        flushText();
        tokens.push(this.parseArgument(inPlural));
        continue;
      }
      if (char === '}') {
        if (insideBranch) {
          flushText();
          return tokens;
        }
        throw this.error('unmatched "}"');
      }
      if (char === '#' && inPlural) {
        flushText();
        tokens.push({ kind: 'pound' });
        this.pos += 1;
        continue;
      }
      text += char;
      this.pos += 1;
    }

    if (insideBranch) {
      throw this.error('unterminated branch, expected "}"');
    }
    flushText();
    return tokens;
  }

  /** ICU quoting: `''` -> `'`; `'` before `{`, `}`, `#` opens a quoted run. */
  private readQuoted(): string {
    this.pos += 1;
    if (this.source[this.pos] === "'") {
      this.pos += 1;
      return "'";
    }
    const next = this.source[this.pos];
    if (next !== '{' && next !== '}' && next !== '#') {
      return "'";
    }
    let literal = '';
    while (this.pos < this.source.length) {
      const char = this.source[this.pos];
      if (char === "'") {
        this.pos += 1;
        if (this.source[this.pos] === "'") {
          literal += "'";
          this.pos += 1;
          continue;
        }
        return literal;
      }
      literal += char;
      this.pos += 1;
    }
    throw this.error('unterminated quoted literal');
  }

  private parseArgument(inPlural: boolean): MessageToken {
    this.expect('{');
    const name = this.readIdentifier();
    this.skipWhitespace();
    if (this.source[this.pos] === '}') {
      this.pos += 1;
      return { kind: 'arg', name };
    }
    this.expect(',');
    this.skipWhitespace();
    const type = this.readIdentifier();
    this.skipWhitespace();

    switch (type) {
      case 'number':
        return this.finishNumber(name);
      case 'date':
      case 'time':
        return this.finishDateTime(name, type);
      case 'plural':
        return this.finishPlural(name, 'cardinal');
      case 'selectordinal':
        return this.finishPlural(name, 'ordinal');
      case 'select':
        return this.finishSelect(name, inPlural);
      default:
        throw this.error(`unsupported argument type "${type}"`);
    }
  }

  private finishNumber(name: string): MessageToken {
    if (this.source[this.pos] === '}') {
      this.pos += 1;
      return { kind: 'number', name, style: 'decimal' };
    }
    this.expect(',');
    this.skipWhitespace();
    const style = this.readIdentifier();
    this.skipWhitespace();
    this.expect('}');
    if (style !== 'integer' && style !== 'percent') {
      throw this.error(`unsupported number style "${style}"`);
    }
    return { kind: 'number', name, style };
  }

  private finishDateTime(name: string, mode: 'date' | 'time'): MessageToken {
    let style: DateTimeStyle = 'medium';
    if (this.source[this.pos] !== '}') {
      this.expect(',');
      this.skipWhitespace();
      const parsed = this.readIdentifier();
      this.skipWhitespace();
      if (!DATE_TIME_STYLES.includes(parsed as DateTimeStyle)) {
        throw this.error(`unsupported ${mode} style "${parsed}"`);
      }
      style = parsed as DateTimeStyle;
    }
    this.expect('}');
    return { kind: 'datetime', name, mode, style };
  }

  private finishPlural(name: string, type: 'cardinal' | 'ordinal'): MessageToken {
    this.expect(',');
    this.skipWhitespace();
    const branches: PluralBranch[] = [];
    while (this.source[this.pos] !== '}') {
      let selector: number | Intl.LDMLPluralRule;
      if (this.source[this.pos] === '=') {
        this.pos += 1;
        const digits = this.readWhile((char) => /[\d.-]/.test(char));
        const exact = Number(digits);
        if (digits.length === 0 || Number.isNaN(exact)) {
          throw this.error('invalid exact plural selector');
        }
        selector = exact;
      } else {
        const category = this.readIdentifier();
        if (category === 'offset') {
          throw this.error('plural offset is not supported');
        }
        if (!PLURAL_CATEGORIES.includes(category as Intl.LDMLPluralRule)) {
          throw this.error(`unknown plural category "${category}"`);
        }
        selector = category as Intl.LDMLPluralRule;
      }
      this.skipWhitespace();
      this.expect('{');
      const tokens = this.parseTokens(true, true);
      this.expect('}');
      branches.push({ selector, tokens });
      this.skipWhitespace();
    }
    this.pos += 1;
    if (!branches.some((branch) => branch.selector === 'other')) {
      throw this.error('plural argument requires an "other" branch');
    }
    return { kind: 'plural', name, type, branches };
  }

  private finishSelect(name: string, inPlural: boolean): MessageToken {
    this.expect(',');
    this.skipWhitespace();
    const branches: SelectBranch[] = [];
    while (this.source[this.pos] !== '}') {
      const selector = this.readIdentifier();
      this.skipWhitespace();
      this.expect('{');
      const tokens = this.parseTokens(true, inPlural);
      this.expect('}');
      branches.push({ selector, tokens });
      this.skipWhitespace();
    }
    this.pos += 1;
    if (!branches.some((branch) => branch.selector === 'other')) {
      throw this.error('select argument requires an "other" branch');
    }
    return { kind: 'select', name, branches };
  }

  private readIdentifier(): string {
    this.skipWhitespace();
    const identifier = this.readWhile((char) => /[\w-]/.test(char));
    if (identifier.length === 0) {
      throw this.error('expected an identifier');
    }
    return identifier;
  }

  private readWhile(predicate: (char: string) => boolean): string {
    let out = '';
    while (this.pos < this.source.length && predicate(this.source[this.pos])) {
      out += this.source[this.pos];
      this.pos += 1;
    }
    return out;
  }

  private skipWhitespace(): void {
    while (this.pos < this.source.length && /\s/.test(this.source[this.pos])) {
      this.pos += 1;
    }
  }

  private expect(char: string): void {
    this.skipWhitespace();
    if (this.source[this.pos] !== char) {
      throw this.error(`expected "${char}"`);
    }
    this.pos += 1;
  }

  private error(detail: string): Error {
    return new Error(
      `[i18n] Invalid ICU message at position ${this.pos}: ${detail} in "${this.source}"`,
    );
  }
}

const parseCache = new Map<string, MessageToken[]>();

function parseMessage(message: string): MessageToken[] {
  const cached = parseCache.get(message);
  if (cached !== undefined) return cached;
  const tokens = new MessageParser(message).parse();
  parseCache.set(message, tokens);
  return tokens;
}

function toNumber(value: MessageValue, name: string, message: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new Error(`[i18n] Argument "${name}" must be a finite number in "${message}"`);
}

function toDate(value: MessageValue, name: string, message: string): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  throw new Error(`[i18n] Argument "${name}" must be a Date or timestamp in "${message}"`);
}

/**
 * Simple `{arg}` interpolation stringifies (matching intl-messageformat):
 * ids, paths, and technical counts render verbatim. Locale-aware number
 * and date rendering is explicit via `{arg, number}` / `{arg, date}`.
 */
function formatSimpleValue(value: MessageValue): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function formatNumberToken(
  value: number,
  style: 'decimal' | 'integer' | 'percent',
  locale: string,
): string {
  if (style === 'integer') {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
  }
  if (style === 'percent') {
    return new Intl.NumberFormat(locale, { style: 'percent' }).format(value);
  }
  return new Intl.NumberFormat(locale).format(value);
}

function formatTokens(
  tokens: readonly MessageToken[],
  values: MessageValues,
  locale: string,
  message: string,
  poundValue: number | null,
): string {
  let out = '';
  for (const token of tokens) {
    switch (token.kind) {
      case 'text':
        out += token.text;
        break;
      case 'pound':
        if (poundValue === null) {
          throw new Error(`[i18n] "#" used outside a plural branch in "${message}"`);
        }
        out += new Intl.NumberFormat(locale).format(poundValue);
        break;
      case 'arg':
        out += formatSimpleValue(values[token.name]);
        break;
      case 'number':
        out += formatNumberToken(toNumber(values[token.name], token.name, message), token.style, locale);
        break;
      case 'datetime': {
        const date = toDate(values[token.name], token.name, message);
        const options: Intl.DateTimeFormatOptions =
          token.mode === 'date' ? { dateStyle: token.style } : { timeStyle: token.style };
        out += new Intl.DateTimeFormat(locale, options).format(date);
        break;
      }
      case 'plural': {
        const value = toNumber(values[token.name], token.name, message);
        const exact = token.branches.find((branch) => branch.selector === value);
        const category = new Intl.PluralRules(locale, { type: token.type }).select(value);
        const branch =
          exact ??
          token.branches.find((candidate) => candidate.selector === category) ??
          token.branches.find((candidate) => candidate.selector === 'other');
        if (branch === undefined) {
          throw new Error(`[i18n] No plural branch matched in "${message}"`);
        }
        out += formatTokens(branch.tokens, values, locale, message, value);
        break;
      }
      case 'select': {
        const raw = values[token.name];
        const key = typeof raw === 'string' ? raw : String(raw);
        const branch =
          token.branches.find((candidate) => candidate.selector === key) ??
          token.branches.find((candidate) => candidate.selector === 'other');
        if (branch === undefined) {
          throw new Error(`[i18n] No select branch matched in "${message}"`);
        }
        out += formatTokens(branch.tokens, values, locale, message, poundValue);
        break;
      }
    }
  }
  return out;
}

/**
 * Format one ICU message with the given locale and values. Parsing is
 * cached; formatting is pure. Throws on malformed messages or values of
 * the wrong type so catalog errors surface in tests, never as silent
 * mis-rendering.
 */
export function formatIcuMessage(
  message: string,
  locale: string,
  values: MessageValues = {},
): string {
  return formatTokens(parseMessage(message), values, locale, message, null);
}
