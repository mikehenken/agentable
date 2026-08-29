/**
 * substrate: repeatable-group field primitive — add/remove/edit rows,
 * array path binding, nested fields, dirty tracking, and save payload merge.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { defineSchemaPanel } from '../../src/panels/builder';
import { createDataLifecycle, SpecRenderer } from '../../src/panels/renderer';
import { defaultCatalog, validateSpec } from '../../src/panels/spec';
import type { PanelSpec } from '../../src/panels/types';

const RULES_FIXTURE = [
  { id: 'rule-1', name: 'Tone', description: 'Keep it friendly' },
];

function repeatableGroupSpec(): PanelSpec {
  return defineSchemaPanel({
    id: 'repeatable-group-proof',
    meta: { title: 'Repeatable group proof', schemaVersion: 1 },
    sources: {
      config: { source: 'demo.config' },
    },
    actions: {
      save: { kind: 'mutate', source: 'demo.config', op: 'update' },
    },
    blocks: [
      { block: 'header', title: 'Rules editor' },
      {
        block: 'form',
        bind: 'config',
        fields: [
          {
            bind: 'rules',
            type: 'repeatable-group',
            label: 'AI Rules',
            rowKey: 'id',
            fields: [
              { bind: 'name', type: 'text', label: 'Name' },
              { bind: 'description', type: 'textarea', label: 'Description' },
            ],
          },
        ],
      },
      { block: 'actions', actions: ['save'] },
    ],
  }).spec;
}

describe('repeatable-group field rendering', () => {
  it('renders existing rows bound to an array path', async () => {
    const lifecycle = createDataLifecycle({
      adapter: {
        query: async () => ({ rules: RULES_FIXTURE }),
        mutate: async () => ({ ok: true as const }),
      },
    });
    const validated = validateSpec(repeatableGroupSpec, {
      catalog: defaultCatalog,
      adapterSources: new Set(['demo.config']),
      hostActions: new Set(),
      panelRegistry: new Set(['repeatable-group-proof']),
    });
    if (!validated.ok) throw new Error(JSON.stringify(validated.errors));

    render(
      <SpecRenderer spec={validated.spec} scope={{}} lifecycle={lifecycle} />);

    await waitFor(() => {
      expect(screen.getByTestId('repeatable-group')).toBeInTheDocument();
    });
    expect(screen.getAllByTestId('repeatable-group-row')).toHaveLength(1);
    expect(screen.getByTestId('repeatable-field-rules-0-name')).toHaveValue('Tone');
    expect(screen.getByTestId('repeatable-field-rules-0-description')).toHaveValue(
      'Keep it friendly');
    lifecycle.dispose();
  });

  it('adds a row with nested field defaults and marks the form dirty', async () => {
    const user = userEvent.setup;
    const lifecycle = createDataLifecycle({
      adapter: {
        query: async () => ({ rules: [] }),
        mutate: async () => ({ ok: true as const }),
      },
    });
    const validated = validateSpec(repeatableGroupSpec, {
      catalog: defaultCatalog,
      adapterSources: new Set(['demo.config']),
      hostActions: new Set(),
      panelRegistry: new Set(['repeatable-group-proof']),
    });
    if (!validated.ok) throw new Error(JSON.stringify(validated.errors));

    render(
      <SpecRenderer spec={validated.spec} scope={{}} lifecycle={lifecycle} />);

    await waitFor(() => {
      expect(screen.getByTestId('repeatable-group-add')).toBeEnabled();
    });
    expect(screen.queryAllByTestId('repeatable-group-row')).toHaveLength(0);

    await user().click(screen.getByTestId('repeatable-group-add'));

    expect(screen.getAllByTestId('repeatable-group-row')).toHaveLength(1);
    expect(screen.getByTestId('repeatable-field-rules-0-name')).toHaveValue('');
    expect(screen.getByTestId('dirty-indicator')).toBeInTheDocument();
    lifecycle.dispose();
  });

  it('edits a nested field value inside a row', async () => {
    const user = userEvent.setup;
    const lifecycle = createDataLifecycle({
      adapter: {
        query: async () => ({ rules: RULES_FIXTURE }),
        mutate: async () => ({ ok: true as const }),
      },
    });
    const validated = validateSpec(repeatableGroupSpec, {
      catalog: defaultCatalog,
      adapterSources: new Set(['demo.config']),
      hostActions: new Set(),
      panelRegistry: new Set(['repeatable-group-proof']),
    });
    if (!validated.ok) throw new Error(JSON.stringify(validated.errors));

    render(
      <SpecRenderer spec={validated.spec} scope={{}} lifecycle={lifecycle} />);

    await waitFor(() => {
      expect(screen.getByTestId('repeatable-field-rules-0-name')).toBeInTheDocument();
    });

    const nameInput = screen.getByTestId('repeatable-field-rules-0-name');
    await user().clear(nameInput);
    await user().type(nameInput, 'Voice');

    expect(nameInput).toHaveValue('Voice');
    expect(screen.getByTestId('dirty-indicator')).toBeInTheDocument();
    lifecycle.dispose();
  });

  it('removes a row and dispatches merged draft payload on save', async () => {
    const user = userEvent.setup;
    let mutatePayload: Record<string, unknown> | null = null;
    const lifecycle = createDataLifecycle({
      adapter: {
        query: async () => ({
          rules: [
            { id: 'rule-1', name: 'Keep', description: 'One' },
            { id: 'rule-2', name: 'Remove me', description: 'Two' },
          ],
        }),
        mutate: async (_action, payload) => {
          mutatePayload = (payload ?? null) as Record<string, unknown> | null;
          return { ok: true as const };
        },
      },
    });
    const validated = validateSpec(repeatableGroupSpec, {
      catalog: defaultCatalog,
      adapterSources: new Set(['demo.config']),
      hostActions: new Set(),
      panelRegistry: new Set(['repeatable-group-proof']),
    });
    if (!validated.ok) throw new Error(JSON.stringify(validated.errors));

    render(
      <SpecRenderer spec={validated.spec} scope={{}} lifecycle={lifecycle} />);

    await waitFor(() => {
      expect(screen.getAllByTestId('repeatable-group-row')).toHaveLength(2);
    });

    await user().click(screen.getByTestId('repeatable-group-remove-1'));
    expect(screen.getAllByTestId('repeatable-group-row')).toHaveLength(1);

    await user().click(screen.getByTestId('panel-action-save'));

    await waitFor(() => {
      expect(mutatePayload).not.toBeNull();
    });
    const rules = (mutatePayload as { rules?: Array<{ name?: string }> }).rules;
    expect(Array.isArray(rules)).toBe(true);
    expect(rules).toHaveLength(1);
    expect(rules?.[0]?.name).toBe('Keep');
    lifecycle.dispose();
  });
});

describe('fieldPaths helpers', () => {
  it('reads and writes nested array paths', async () => {
    const { readFieldPath, writeFieldPath, cloneRecord } = await import(
      '../../src/panels/catalog/fieldPaths'
    );
    const root = cloneRecord({ rules: [{ name: 'A' }] });
    expect(readFieldPath(root, 'rules.0.name')).toBe('A');
    writeFieldPath(root, 'rules.0.name', 'B');
    expect(readFieldPath(root, 'rules.0.name')).toBe('B');
  });
});
