/**
 * SpecRenderer applies agent-filled user-dirty field classes.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AGENT_FILLED_FIELD_CLASS, USER_DIRTY_FIELD_CLASS } from '../../src/panels/approval/fieldMarkers';
import { defineSchemaPanel } from '../../src/panels/builder';
import { createDataLifecycle, SpecRenderer } from '../../src/panels/renderer';
import { validateSpec, defaultCatalog } from '../../src/panels/spec';

const lifecycle = createDataLifecycle({
  adapter: {
    query: async () => ({ title: 'Hello' }),
    mutate: async () => ({ ok: true as const }),
  },
});

const specPanel = defineSchemaPanel({
  id: 'marker-demo',
  meta: { title: 'Markers', schemaVersion: 1 },
  sources: { form: { source: 'demo.form' } },
  blocks: [{ block: 'form', bind: 'form', fields: [{ bind: 'title', type: 'text', label: 'Title' }] }],
});

const validated = validateSpec(specPanel.spec, {
  catalog: defaultCatalog,
  adapterSources: new Set(['demo.form']),
  hostActions: new Set(),
  panelRegistry: new Set(),
});

describe('SpecRenderer fieldMarkers', () => {
  it('applies agent-filled and user-dirty classes on bound nodes', () => {
    if (!validated.ok) throw new Error('fixture spec must validate');

    render(
      <SpecRenderer
        spec={validated.spec}
        scope={{}}
        lifecycle={lifecycle}
        fieldMarkers={{
          agentFilled: new Set(['form']),
          userDirty: new Set(),
        }}
      />);

    const node = screen.getByTestId('field-form').closest('[data-renderer-node]');
    expect(node).toHaveClass(AGENT_FILLED_FIELD_CLASS);
  });

  it('prefers user-dirty over agent-filled for the same bind', () => {
    if (!validated.ok) throw new Error('fixture spec must validate');

    render(
      <SpecRenderer
        spec={validated.spec}
        scope={{}}
        lifecycle={lifecycle}
        fieldMarkers={{
          agentFilled: new Set(['form']),
          userDirty: new Set(['form']),
        }}
      />);

    const node = screen.getByTestId('field-form').closest('[data-renderer-node]');
    expect(node).toHaveClass(USER_DIRTY_FIELD_CLASS);
    expect(node).not.toHaveClass(AGENT_FILLED_FIELD_CLASS);
  });
});
