import { describe, expect, it } from 'vitest';
import type { A2UIEnvelope } from '../../src/a2ui';
import { renderA2UITranscriptContent } from '../../src/agents/surface/a2uiTranscriptLite';

const USER_PROFILE_ENVELOPES: readonly A2UIEnvelope[] = [
  {
    version: 'v1.0',
    createSurface: {
      surfaceId: 'user_profile_card',
      catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
      components: [
        {
          id: 'root',
          component: 'Column',
          children: ['user_name'],
        },
        {
          id: 'user_name',
          component: 'Text',
          text: { path: '/name' },
        },
      ],
      dataModel: {
        name: 'John Doe',
      },
    },
  },
];

describe('operator A2UI transcript lite renderer', () => {
  it('ingests conformance fixture and extracts display blocks', () => {
    const outcome = renderA2UITranscriptContent(USER_PROFILE_ENVELOPES);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    expect(outcome.blocks.some((block) => block.title === 'John Doe')).toBe(true);
  });
});
