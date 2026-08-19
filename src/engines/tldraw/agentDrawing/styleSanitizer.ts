/**
 * Model-supplied style token sanitizer.
 *
 * tldraw's shape schema validates style enums strictly; a single invalid
 * token ("lightBlue" instead of "light-blue") thrown into the store took
 * down the whole canvas with tldraw's "Something went wrong" screen in a
 * live run. Models reach for camelCase and common color names constantly,
 * so instead of dropping their shapes (or crashing), normalize what they
 * meant onto the nearest valid token and fall back to the default for
 * anything unrecognizable.
 *
 * Pure functions, no editor access.
 */
import type { AgentDrawShapeStyle } from '../../../engine/agentDrawingTypes';

const VALID_COLORS = new Set([
  'black',
  'grey',
  'light-violet',
  'violet',
  'blue',
  'light-blue',
  'yellow',
  'orange',
  'green',
  'light-green',
  'light-red',
  'red',
  'white',
]);

/** Common model color names mapped to their nearest tldraw token. */
const COLOR_ALIASES: Record<string, string> = {
  gray: 'grey',
  lightgray: 'grey',
  lightgrey: 'grey',
  silver: 'grey',
  purple: 'violet',
  lightpurple: 'light-violet',
  lavender: 'light-violet',
  magenta: 'light-violet',
  pink: 'light-red',
  salmon: 'light-red',
  crimson: 'red',
  maroon: 'red',
  darkred: 'red',
  cyan: 'light-blue',
  teal: 'light-blue',
  skyblue: 'light-blue',
  navy: 'blue',
  darkblue: 'blue',
  indigo: 'violet',
  lime: 'light-green',
  mint: 'light-green',
  darkgreen: 'green',
  olive: 'green',
  gold: 'yellow',
  amber: 'yellow',
  brown: 'orange',
  tan: 'orange',
};

const VALID_FILLS = new Set(['none', 'semi', 'solid']);
const VALID_DASHES = new Set(['draw', 'dashed', 'dotted', 'solid']);
const VALID_SIZES = new Set(['s', 'm', 'l', 'xl']);

/**
 * Normalize a model-supplied color to a valid tldraw token, or undefined
 * when nothing close matches (callers then apply their own default).
 * Handles camelCase ("lightBlue"), spaces/underscores ("light blue"), and
 * common aliases ("gray", "purple", "cyan").
 */
export function normalizeStyleColor(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const kebab = raw
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
  if (VALID_COLORS.has(kebab)) return kebab;
  return COLOR_ALIASES[kebab.replace(/-/g, '')];
}

/**
 * Return a style whose every token tldraw accepts: color normalized via
 * aliases, invalid fill/dash/size dropped so defaults apply. Returns the
 * input object unchanged when nothing needed fixing.
 */
export function sanitizeDrawStyle(
  style: AgentDrawShapeStyle | undefined,
): AgentDrawShapeStyle | undefined {
  if (style === undefined) return undefined;
  const color = normalizeStyleColor(style.color);
  const fill = typeof style.fill === 'string' && VALID_FILLS.has(style.fill) ? style.fill : undefined;
  const dash = typeof style.dash === 'string' && VALID_DASHES.has(style.dash) ? style.dash : undefined;
  const size = typeof style.size === 'string' && VALID_SIZES.has(style.size) ? style.size : undefined;
  if (color === style.color && fill === style.fill && dash === style.dash && size === style.size) {
    return style;
  }
  return {
    ...(color !== undefined ? { color } : {}),
    ...(fill !== undefined ? { fill } : {}),
    ...(dash !== undefined ? { dash } : {}),
    ...(size !== undefined ? { size } : {}),
  };
}
