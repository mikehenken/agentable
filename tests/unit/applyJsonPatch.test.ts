/**
 * Unit tests for RFC 6902 patch application on panel spec envelopes.
 */
import { describe, expect, it } from 'vitest';
import { applyJsonPatch } from '../../src/panels/spec/applyJsonPatch';
import type { JsonObject } from '../../src/panels/types';

describe('applyJsonPatch', () => {
  it('replaces a nested value', () => {
    const document: JsonObject = {
      nodes: {
        actions: {
          props: { actions: ['save'] },
        },
      },
    };

    const result = applyJsonPatch(document, [
      { op: 'replace', path: '/nodes/actions/props/actions', value: ['save', 'aiGenerate'] },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const actions = result.document.nodes as JsonObject;
      const actionNode = actions.actions as JsonObject;
      const props = actionNode.props as JsonObject;
      expect(props.actions).toEqual(['save', 'aiGenerate']);
    }
  });

  it('returns a structured error when the path is missing', () => {
    const document: JsonObject = { nodes: {} };
    const result = applyJsonPatch(document, [
      { op: 'replace', path: '/nodes/missing/props/actions', value: ['save'] },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('not found');
    }
  });
});
