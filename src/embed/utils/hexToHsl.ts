/**
 * `hexToHslComponents` — pure helper used by the Lit shell's
 * `_applyBrandTokens` to keep the dual-form token pair in sync.
 *
 * Converts `#RRGGBB` (or `#RGB`) to a Tailwind-compatible HSL component
 * triplet `"H S% L%"` (no `hsl(...)` wrapper, no commas — the format
 * Tailwind's `<alpha-value>` placeholder expects when it builds
 * `hsl(var(--token) / <alpha>)`). Returns `null` on parse failure so
 * callers don't accidentally clobber a token with `"NaN NaN% NaN%"`.
 *
 * Extracted to its own module (no Lit / customElements deps) so the
 * unit test can import it directly without triggering element
 * registration in happy-dom. (Architect-reviewer M2.6 W1.)
 */
export function hexToHslComponents(hex: string): string | null {
  const clean = hex.replace(/^#/, '').trim();
  if (!/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(clean)) return null;
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h = h * 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
