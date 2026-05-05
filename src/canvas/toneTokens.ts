/**
 * Tone-gradient tokens — CSS-var-backed gradient strings for the 6 dept-tone
 * accents used across panels (Open Positions, Applications, Career Tools,
 * Growth Paths, etc.).
 *
 * Architect H3 + UX IMPORTANT 2026-04-26: each panel previously hardcoded
 * the same `linear-gradient(135deg, #D97706 0%, #F59E0B 100%)` style strings
 * inline. Agencies overriding the canvas brand had no hook to retone these
 * accents. Centralizing here both removes duplication and surfaces a clean
 * override point: agencies set `--canvas-tone-{name}-from` / `-to` at
 * `:root`/`:host` and every panel inherits.
 *
 * Usage:
 *   import { TONE_GRADIENT } from './toneTokens';
 *   <div style={{ background: TONE_GRADIENT.amber }} />
 */

export type ToneKey = 'teal' | 'amber' | 'indigo' | 'rose' | 'emerald' | 'violet' | 'slate';

const v = (name: string, fallback: string) => `var(--canvas-tone-${name}, ${fallback})`;

/**
 * Compose a per-tone gradient that supports TWO override altitudes:
 *   1. `--canvas-tone-{key}-gradient` — replace the WHOLE gradient string
 *      (e.g. swap angle, add a 3rd stop, or use radial-gradient).
 *   2. `--canvas-tone-{key}-from` / `-to` — keep the 135deg linear shape,
 *      retone the two stops.
 *
 * The full-string altitude is the architect MEDIUM 2026-04-26 follow-up:
 * 2-stop tokens lock consumers into the linear-gradient(135deg, A 0%, B 100%)
 * shape. An agency wanting a 3-stop gradient or a different angle had to
 * fork. The full-string token sits OUTSIDE the linear-gradient() so any CSS
 * gradient syntax is acceptable.
 */
const grad = (key: ToneKey, from: string, to: string) =>
  `var(--canvas-tone-${key}-gradient, linear-gradient(135deg, ${v(`${key}-from`, from)} 0%, ${v(`${key}-to`, to)} 100%))`;

export const TONE_GRADIENT: Record<ToneKey, string> = {
  teal: grad('teal', '#0D7377', '#14B8A6'),
  amber: grad('amber', '#D97706', '#F59E0B'),
  indigo: grad('indigo', '#4F46E5', '#6366F1'),
  rose: grad('rose', '#E11D48', '#F43F5E'),
  emerald: grad('emerald', '#059669', '#10B981'),
  violet: grad('violet', '#7C3AED', '#A855F7'),
  slate: grad('slate', '#6B7280', '#9CA3AF'),
};

/**
 * Tone-tinted glow shadows. Shape mirrors `TONE_GRADIENT`: var-backed with
 * the original RGBA as fallback. Used inline via `style={{ boxShadow: TONE_GLOW.X }}`
 * because Tailwind's JIT can't resolve CSS-var arbitrary values like
 * `shadow-[var(--canvas-tone-X-glow)]` reliably across all builds.
 *
 * Closes architect HIGH 2026-04-26: previously each tone's glow was a
 * hardcoded `shadow-[0_12px_32px_rgba(R,G,B,A)]` Tailwind arbitrary that
 * locked the tinted-elevation color to the default palette. Agencies
 * retoning a panel via `--canvas-tone-X-from/-to` would get a mismatched
 * teal-tinted glow on a red panel.
 */
export const TONE_GLOW: Record<ToneKey, string> = {
  teal: v('teal-glow', '0 12px 32px rgba(20, 184, 166, 0.22)'),
  amber: v('amber-glow', '0 12px 32px rgba(245, 158, 11, 0.22)'),
  indigo: v('indigo-glow', '0 12px 32px rgba(99, 102, 241, 0.22)'),
  rose: v('rose-glow', '0 12px 32px rgba(244, 63, 94, 0.20)'),
  emerald: v('emerald-glow', '0 12px 32px rgba(16, 185, 129, 0.20)'),
  violet: v('violet-glow', '0 12px 32px rgba(168, 85, 247, 0.22)'),
  slate: v('slate-glow', '0 12px 32px rgba(107, 114, 128, 0.18)'),
};
