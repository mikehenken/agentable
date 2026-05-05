/**
 * Lexicon — small, reusable normaliser for agent-supplied filter values.
 *
 * Why this exists:
 *   When the agent says "show me Engineering roles" and our data uses
 *   "Software Engineering", a strict-equality filter returns zero
 *   results. The model produced a perfectly reasonable English term that
 *   doesn't happen to match our schema. We need a layer between the agent
 *   tool registry and the panel filters that:
 *     1. Accepts the agent's natural-language value.
 *     2. Maps it to one of the panel's canonical values (or null).
 *     3. Falls back to substring fuzzy match when no synonym is known.
 *
 *   Lifting this into an OSS primitive keeps each panel from re-rolling
 *   the same logic. Standardised across `OpenPositionsPanel`,
 *   `ResourcesPanel`, `ApplicationsPanel`, etc., it also gives us one
 *   place to add diacritic-insensitive matching, plural collapsing, etc.
 *
 * Non-goals:
 *   - This is NOT a search engine. For free-text matching across multiple
 *     fields (title, description, skills) keep using `getSearchText` on
 *     <ListPanel>. The lexicon is specifically for "this filter chip
 *     accepts these N values; the agent said something close to one of
 *     them; pick the best."
 *   - Not a translation layer. English-only synonyms today; i18n is a
 *     separate concern that can layer on top by swapping the synonym map.
 */

export interface Lexicon {
  /**
   * Best-effort normalisation. Returns one of the canonical values, or
   * null when no plausible match exists. Empty input → null.
   *
   * Order:
   *   1. Exact (case-insensitive) match against canonical.
   *   2. Synonym dictionary lookup.
   *   3. Substring fuzzy match (input contains canonical, OR canonical
   *      contains input). Disabled with `fuzzy: false`.
   */
  normalize(input: string): string | null;
  /** Canonical values list, in declared order. */
  values(): readonly string[];
  /** Cheap test for "is this a known canonical value?" — case-insensitive. */
  isCanonical(value: string): boolean;
}

export interface LexiconOptions {
  /** Authoritative list of values for the filter axis. */
  canonical: readonly string[];
  /**
   * Synonym dictionary. Keys are lowercased aliases; values are one of
   * the canonical strings. Synonyms with values not in `canonical` are
   * silently ignored (fail-soft so a typo in the synonym map can't
   * surface a value that has no corresponding chip).
   */
  synonyms?: Record<string, string>;
  /**
   * Allow substring matching when neither exact nor synonym hits. Default
   * true. Disable for axes where partial matches would be misleading
   * (e.g. status codes — "ok" should not match "blocked").
   */
  fuzzy?: boolean;
}

export function createLexicon(options: LexiconOptions): Lexicon {
  const canonicalArr = options.canonical;
  const lowerToCanonical = new Map<string, string>();
  for (const c of canonicalArr) {
    lowerToCanonical.set(c.toLowerCase(), c);
  }
  // Filter out synonyms whose targets aren't canonical.
  const synonyms: Record<string, string> = {};
  for (const [alias, target] of Object.entries(options.synonyms ?? {})) {
    if (lowerToCanonical.has(target.toLowerCase())) {
      synonyms[alias.toLowerCase()] = lowerToCanonical.get(target.toLowerCase())!;
    }
  }
  const fuzzy = options.fuzzy ?? true;

  return {
    values: () => canonicalArr,
    isCanonical: (v) => lowerToCanonical.has(v.toLowerCase()),
    normalize(input: string): string | null {
      const trimmed = input.trim();
      if (!trimmed) return null;
      const lc = trimmed.toLowerCase();
      const exact = lowerToCanonical.get(lc);
      if (exact) return exact;
      const syn = synonyms[lc];
      if (syn) return syn;
      if (!fuzzy) return null;
      // Substring match — bidirectional. "eng" should match "Engineering"
      // AND "Engineering" should match "eng". Pick the canonical with the
      // shortest length to prefer "IT" over "IT Operations" when both
      // contain the input.
      const candidates: string[] = [];
      for (const [lower, canonical] of lowerToCanonical) {
        if (lower.includes(lc) || lc.includes(lower)) {
          candidates.push(canonical);
        }
      }
      if (candidates.length === 0) return null;
      candidates.sort((a, b) => a.length - b.length);
      return candidates[0] ?? null;
    },
  };
}
