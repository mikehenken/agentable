/**
 * Seeded DataAdapter for compose eval harness.
 * Returns deterministic query payloads derived from the eval seed.
 */
import type { DataAdapter, MutationResult } from '../../../src/panels/renderer/types';
import type { PanelScope } from '../../../src/panels/types';
import { createSeededRandom } from './seededRandom';

export interface SeededEvalAdapterOptions {
  seed: number;
}

export function createSeededEvalAdapter(options: SeededEvalAdapterOptions): DataAdapter {
  const rng = createSeededRandom(options.seed);
  const titleToken = rng.int(1000, 9999);
  const seoPayload = {
    title: `Eval meta title ${titleToken}`,
    description: `Seeded SEO description (seed=${options.seed}, token=${titleToken})`,
    keywords: `eval,seed-${options.seed}`,
  };

  return {
    async query(ref, scope: PanelScope, signal: AbortSignal): Promise<unknown> {
      void signal;
      if (ref.source === 'site.seo') {
        return {...seoPayload, pageId: scope.entityId };
      }
      return { seed: options.seed, source: ref.source, empty: true };
    },

    async mutate(): Promise<MutationResult> {
      return { ok: true, data: { persisted: true, seed: options.seed } };
    },
  };
}
