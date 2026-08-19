/**
 * Regression coverage for the live canvas crash: the model sent
 * style.color "lightBlue" and tldraw's schema validator took down the
 * whole whiteboard ("Something went wrong") instead of one shape failing.
 * Model-supplied style enums are normalized before they reach the editor.
 */
import { describe, expect, it } from 'vitest';
import {
  normalizeStyleColor,
  sanitizeDrawStyle,
} from '../../src/engines/tldraw/agentDrawing/styleSanitizer';

describe('normalizeStyleColor', () => {
  it('passes valid tldraw tokens through unchanged', () => {
    expect(normalizeStyleColor('light-blue')).toBe('light-blue');
    expect(normalizeStyleColor('grey')).toBe('grey');
    expect(normalizeStyleColor('black')).toBe('black');
  });

  it('normalizes camelCase to kebab tokens (the crash trigger)', () => {
    expect(normalizeStyleColor('lightBlue')).toBe('light-blue');
    expect(normalizeStyleColor('lightGreen')).toBe('light-green');
    expect(normalizeStyleColor('lightRed')).toBe('light-red');
    expect(normalizeStyleColor('lightViolet')).toBe('light-violet');
  });

  it('normalizes spaces, underscores, and casing', () => {
    expect(normalizeStyleColor('Light Blue')).toBe('light-blue');
    expect(normalizeStyleColor('light_violet')).toBe('light-violet');
    expect(normalizeStyleColor(' RED ')).toBe('red');
  });

  it('maps common aliases to their nearest token', () => {
    expect(normalizeStyleColor('gray')).toBe('grey');
    expect(normalizeStyleColor('purple')).toBe('violet');
    expect(normalizeStyleColor('cyan')).toBe('light-blue');
    expect(normalizeStyleColor('pink')).toBe('light-red');
    expect(normalizeStyleColor('navy')).toBe('blue');
    expect(normalizeStyleColor('gold')).toBe('yellow');
  });

  it('returns undefined for unrecognizable values', () => {
    expect(normalizeStyleColor('chartreuse')).toBeUndefined();
    expect(normalizeStyleColor('#3B82F6')).toBeUndefined();
    expect(normalizeStyleColor(42)).toBeUndefined();
    expect(normalizeStyleColor(undefined)).toBeUndefined();
  });
});

describe('sanitizeDrawStyle', () => {
  it('returns the same object when every token is already valid', () => {
    const style = { color: 'blue', fill: 'semi', dash: 'draw', size: 'm' } as const;
    expect(sanitizeDrawStyle(style)).toBe(style);
  });

  it('rewrites an invalid color and keeps the valid rest', () => {
    const style = { color: 'lightBlue', fill: 'semi', size: 'l' } as const;
    expect(sanitizeDrawStyle(style)).toEqual({ color: 'light-blue', fill: 'semi', size: 'l' });
  });

  it('drops unrecognizable tokens so defaults apply', () => {
    const style = {
      color: 'chartreuse',
      fill: 'hatch' as never,
      dash: 'wavy' as never,
      size: 'xxl' as never,
    };
    expect(sanitizeDrawStyle(style)).toEqual({});
  });

  it('passes undefined through', () => {
    expect(sanitizeDrawStyle(undefined)).toBeUndefined();
  });
});
