/**
 * Single source of truth for the Tailwind theme color aliases that
 * front the canvas's CSS custom properties. Imported by:
 *
 *   - `tailwind.config.js`                              (this package's build)
 *   - any host site's `tailwind.config.js`              (when the host
 *                                                       compiles canvas
 *                                                       source against its
 *                                                       own Tailwind build)
 *
 * Without this shared file two configs drift — adding a new token in
 * one would silently NOT register in the other, leaving panels unstyled
 * in whichever surface forgot the update.
 *
 * Two value families:
 *
 *   1. Brand colors → `hsl(var(--landi-color-X-hsl, <hex-as-hsl>) / <alpha-value>)`.
 *      Tailwind substitutes `<alpha-value>` with the slash-modifier (`/30`
 *      → `0.3`, default → `1`). This makes `bg-canvas-primary/30` actually
 *      apply 30% alpha to the tenant-overridden token, instead of falling
 *      back to the bare hex via the arbitrary-value path. Required for
 *      `ring-canvas-primary/10`, `border-canvas-primary/30`, etc. to
 *      compose with tenant overrides.
 *
 *   2. Surface/text/status colors → plain `var(--landi-color-X, #fallback)`.
 *      These are rarely alpha-modified, and HSL converting `#FFFFFF` etc.
 *      adds no value. Keep simple `var()` form.
 *
 * Add new aliases here ONCE. Both Tailwind builds pick them up via
 * `theme.extend.colors: { ...landiTokenColors }`.
 */
module.exports = {
  // --- Text (no alpha modifications expected) ---
  canvas: 'var(--landi-color-text, #1A1A1A)',
  'canvas-muted': 'var(--landi-color-text-secondary, #4B5563)',
  'canvas-faint': 'var(--landi-color-text-muted, #9CA3AF)',

  // --- Brand (alpha-aware via HSL) ---
  'canvas-primary': 'hsl(var(--landi-color-primary-hsl, 182 80% 26%) / <alpha-value>)',
  'canvas-primary-hover':
    'hsl(var(--landi-color-primary-hover-hsl, 182 83% 20%) / <alpha-value>)',
  'canvas-primary-light':
    'hsl(var(--landi-color-primary-light-hsl, 173 80% 40%) / <alpha-value>)',
  'canvas-primary-soft':
    'hsl(var(--landi-color-primary-soft-hsl, 172 66% 50%) / <alpha-value>)',
  // Tint is a pre-mixed pale of primary (high lightness). Alpha-modifying
  // it is a double-composite that won't read the way authors expect — a
  // 50% alpha of an already-light color goes near-invisible. Currently no
  // call sites use `canvas-primary-tint/N`. If you need a translucent
  // primary, use `canvas-primary/N` directly. (Architect-reviewer M2.5 W2.)
  'canvas-primary-tint':
    'hsl(var(--landi-color-primary-tint-hsl, 169 39% 92%) / <alpha-value>)',
  'canvas-accent': 'hsl(var(--landi-color-accent-hsl, 45 70% 47%) / <alpha-value>)',

  // --- Surfaces (no alpha) ---
  'canvas-surface': 'var(--landi-color-surface, #FFFFFF)',
  'canvas-surface-subtle': 'var(--landi-color-surface-subtle, #F7F9F9)',
  'canvas-workspace': 'var(--landi-color-workspace-bg, #F5F5F2)',

  // --- Borders (no alpha) ---
  // Maps Tailwind grayscale `border-gray-100|200|300` to a single
  // tenant-overridable token. Embedders override `--landi-color-border`
  // to retint dividers/outlines without touching text/surface scales.
  'canvas-border': 'var(--landi-color-border, #E5E5E5)',

  // --- Status (no alpha) ---
  'canvas-error': 'var(--landi-color-error, #EF4444)',
};
