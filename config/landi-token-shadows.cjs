/**
 * Brand-tinted box-shadow tokens. Single source of truth, imported by:
 *
 *   - `tailwind.config.js`
 *   - any host site's `tailwind.config.js`            (when the host
 *                                                     compiles canvas
 *                                                     source against
 *                                                     its own Tailwind build)
 *
 * Same drift-prevention pattern as `landi-token-colors.cjs`.
 *
 * The shadow color is composed from the existing `--landi-color-primary-hsl`
 * companion token (a `H S% L%` triplet defined in `index.css`). Agencies
 * overriding `--landi-color-primary-hsl: <H S% L%>` automatically retone
 * every primary-tinted elevation across the canvas without touching
 * shadow tokens individually.
 *
 * Naming reflects intensity, NOT use-site:
 *   - soft    → 0.08 alpha (subtle hover-tint, light cards)
 *   - rich    → 0.12 alpha (featured-card hover, prominent surfaces)
 *   - active  → 0.18 alpha (selected/active state on filled surfaces)
 *   - intense → 0.35 alpha (avatar, hero accent — high-contrast brand pop)
 *
 * Three override altitudes for consumers (most → least granular):
 *   1. `--canvas-elev-primary-{name}` — replace the whole shadow string
 *      (offset, blur, spread, color) per intensity tier.
 *   2. `--canvas-elev-alpha-{name}` — keep the geometry + brand HSL, just
 *      retone the alpha (e.g., punchier or softer elevation everywhere).
 *   3. `--landi-color-primary-hsl` — keep geometry + alphas, swap the brand
 *      hue only. Cascades to every primary-tinted elevation.
 *
 * Color uses CSS Color Level 4 slash syntax `hsl(H S% L% / A)`. DO NOT
 * "simplify" to `hsla(H S% L%, A)` — mixing space-separated HSL components
 * with a comma-prefixed alpha is INVALID CSS; the browser silently rejects
 * the rule and computed `box-shadow` returns `none`.
 */
const HSL = 'var(--landi-color-primary-hsl, 182 80% 26%)';
const A = (name, fallback) => `var(--canvas-elev-alpha-${name}, ${fallback})`;

module.exports = {
  'canvas-primary-soft': `var(--canvas-elev-primary-soft, 0 6px 20px hsl(${HSL} / ${A('soft', '0.08')}))`,
  'canvas-primary-rich': `var(--canvas-elev-primary-rich, 0 10px 30px hsl(${HSL} / ${A('rich', '0.12')}))`,
  'canvas-primary-active': `var(--canvas-elev-primary-active, 0 10px 30px hsl(${HSL} / ${A('active', '0.18')}))`,
  'canvas-primary-intense': `var(--canvas-elev-primary-intense, 0 6px 20px hsl(${HSL} / ${A('intense', '0.35')}))`,
};
