/**
 * ICU MessageFormat engine proofs: literal text and quoting,
 * simple args, number/date/time via Intl, plural (cardinal + exact +
 * `#`), selectordinal, select, nesting, malformed-message and
 * wrong-value failure modes, and full English catalog integrity (every
 * shipped message parses and formats).
 */
import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/catalog/en';
import { formatIcuMessage } from '../../src/i18n/messageFormat';

describe('formatIcuMessage', () => {
  it('renders literal text verbatim', () => {
    expect(formatIcuMessage('Loading...', 'en')).toBe('Loading...');
  });

  it('interpolates simple arguments and stringifies ids verbatim', () => {
    expect(formatIcuMessage('Unsupported block ({type})', 'en', { type: 'chart' })).toBe(
      'Unsupported block (chart)');
    expect(formatIcuMessage('Spec has {count} nodes', 'en', { count: 1234 })).toBe(
      'Spec has 1234 nodes');
    expect(formatIcuMessage('At {path}', 'en', { path: 'props.items[0].label' })).toBe(
      'At props.items[0].label');
  });

  it('renders missing/null simple args as empty string', () => {
    expect(formatIcuMessage('Hello {name}!', 'en', {})).toBe('Hello !');
    expect(formatIcuMessage('Hello {name}!', 'en', { name: null })).toBe('Hello !');
  });

  it('handles ICU quoting: double apostrophe and quoted braces', () => {
    expect(formatIcuMessage("It''s ready", 'en')).toBe("It's ready");
    expect(formatIcuMessage("literal '{brace}' here", 'en')).toBe('literal {brace} here');
    expect(formatIcuMessage("Don't stop", 'en')).toBe("Don't stop");
  });

  it('formats numbers through Intl with locale rules', () => {
    expect(formatIcuMessage('{n, number}', 'en', { n: 51200 })).toBe('51,200');
    expect(formatIcuMessage('{n, number}', 'de', { n: 51200 })).toBe('51.200');
    expect(formatIcuMessage('{n, number, integer}', 'en', { n: 3.7 })).toBe('4');
    expect(formatIcuMessage('{n, number, percent}', 'en', { n: 0.25 })).toBe('25%');
  });

  it('formats dates and times through Intl with locale rules', () => {
    const date = new Date(Date.UTC(2026, 6, 4, 12, 0, 0));
    const enOut = formatIcuMessage('{d, date, long}', 'en-US', { d: date });
    const esOut = formatIcuMessage('{d, date, long}', 'es-ES', { d: date });
    expect(enOut).toContain('July');
    expect(esOut).toContain('julio');
    expect(formatIcuMessage('{d, date}', 'en-US', { d: date })).toBe(
      new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date));
    expect(formatIcuMessage('{d, time, short}', 'en-US', { d: date })).toBe(
      new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(date));
  });

  it('selects plural branches per locale with exact matches and #', () => {
    const message = '{count, plural, =0 {no items} one {# item} other {# items}}';
    expect(formatIcuMessage(message, 'en', { count: 0 })).toBe('no items');
    expect(formatIcuMessage(message, 'en', { count: 1 })).toBe('1 item');
    expect(formatIcuMessage(message, 'en', { count: 5000 })).toBe('5,000 items');
    // Russian "few" category proves CLDR plural selection, not an
    // English-only n===1 shortcut.
    const russian = '{count, plural, one {x} few {y} many {z} other {w}}';
    expect(formatIcuMessage(russian, 'ru', { count: 2 })).toBe('y');
    expect(formatIcuMessage(russian, 'ru', { count: 5 })).toBe('z');
    expect(formatIcuMessage(russian, 'ru', { count: 21 })).toBe('x');
  });

  it('supports selectordinal via ordinal plural rules', () => {
    const message = '{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}';
    expect(formatIcuMessage(message, 'en', { n: 1 })).toBe('1st');
    expect(formatIcuMessage(message, 'en', { n: 22 })).toBe('22nd');
    expect(formatIcuMessage(message, 'en', { n: 33 })).toBe('33rd');
    expect(formatIcuMessage(message, 'en', { n: 11 })).toBe('11th');
  });

  it('supports select with other fallback and nesting inside plural', () => {
    const select = '{tone, select, error {Problem} warning {Heads up} other {Note}}';
    expect(formatIcuMessage(select, 'en', { tone: 'error' })).toBe('Problem');
    expect(formatIcuMessage(select, 'en', { tone: 'unknown' })).toBe('Note');

    const nested =
      '{count, plural, one {{tone, select, error {# failure} other {# note}}} other {{tone, select, error {# failures} other {# notes}}}}';
    expect(formatIcuMessage(nested, 'en', { count: 1, tone: 'error' })).toBe('1 failure');
    expect(formatIcuMessage(nested, 'en', { count: 3, tone: 'x' })).toBe('3 notes');
  });

  it('throws loudly on malformed messages', () => {
    expect(() => formatIcuMessage('{unclosed', 'en')).toThrow('[i18n]');
    expect(() => formatIcuMessage('unmatched }', 'en')).toThrow('[i18n]');
    expect(() => formatIcuMessage('{n, plural, one {x}}', 'en', { n: 1 })).toThrow(
      'requires an "other" branch');
    expect(() => formatIcuMessage('{x, spellout}', 'en', { x: 1 })).toThrow(
      'unsupported argument type');
    expect(() => formatIcuMessage('{n, plural, offset:1 one {x} other {y}}', 'en', { n: 1 })).toThrow(
      '[i18n]');
  });

  it('throws loudly on wrong value types for number/date/plural args', () => {
    expect(() => formatIcuMessage('{n, number}', 'en', { n: 'five' })).toThrow('finite number');
    expect(() => formatIcuMessage('{d, date}', 'en', { d: 'today' })).toThrow('Date or timestamp');
    expect(() => formatIcuMessage('{n, plural, other {#}}', 'en', { n: Number.NaN })).toThrow(
      'finite number');
  });

  it('parses and formats every message in the shipped English catalog', () => {
    const sampleValues = {
      type: 'x',
      max: 1,
      version: 1,
      supported: 1,
      nodeId: 'n',
      root: 'r',
      count: 1,
      depth: 1,
      cycle: 'a -> b',
      childId: 'c',
      ref: 'ref',
      actionId: 'a1',
      source: 's',
      action: 'act',
      panelId: 'p',
      path: 'props.x',
      length: 1,
    };
    for (const [key, message] of Object.entries(en)) {
      expect(() => formatIcuMessage(message, 'en', sampleValues), key).not.toThrow();
      expect(formatIcuMessage(message, 'en', sampleValues), key).not.toBe('');
    }
  });
});
