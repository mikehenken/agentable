/**
 * Adversarial validation suite for the seven-step spec pipeline (D9, 02 section 5).
 * Each case targets a failure mode that must hard-reject or warn per the PRD.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  CURRENT_SPEC_VERSION,
  SPEC_MAX_DEPTH,
  SPEC_MAX_NODES,
  SPEC_MAX_STRING_PROP,
  SPEC_MAX_TOTAL_BYTES,
  UNKNOWN_NODE_PLACEHOLDER_TYPE,
  UNKNOWN_NODE_RAW_KEY,
  migrateSpec,
  validateSpec,
  type SpecCatalogEntry,
  type SpecValidationContext,
} from '../../src/panels/spec';
import type { PanelSpec, SpecMigration } from '../../src/panels/types';

function buildCatalog(): Map<string, SpecCatalogEntry> {
  const entries: SpecCatalogEntry[] = [
    {
      name: 'panel-body',
      props: z.object({}).passthrough(),
    },
    {
      name: 'action-row',
      props: z.object({
        actions: z.array(z.union([z.string(), z.object({ action: z.string() })])),
      }),
    },
    {
      name: 'field-form',
      props: z.object({
        bind: z.string(),
        fields: z.array(z.object({ path: z.string(), type: z.string() })).optional(),
      }),
    },
    {
      name: 'empty-state',
      props: z.object({
        message: z.string(),
        action: z.string().optional(),
      }),
    },
    {
      name: 'content',
      props: z.object({
        link: z.string().optional(),
        website: z.string().optional(),
      }),
    },
  ];
  return new Map(entries.map((entry) => [entry.name, entry]));
}

function baseContext(overrides: Partial<SpecValidationContext> = {}): SpecValidationContext {
  return {
    catalog: buildCatalog(),
    adapterSources: new Set(['site.seo', 'site.settings']),
    hostActions: new Set(['switchPage']),
    panelRegistry: new Set(['job-detail']),
    ...overrides,
  };
}

function validSpec(overrides: Partial<PanelSpec> = {}): PanelSpec {
  return {
    v: CURRENT_SPEC_VERSION,
    origin: 'host',
    root: 'body',
    nodes: {
      body: { type: 'panel-body', children: ['actions'] },
      actions: {
        type: 'action-row',
        props: { actions: ['save'] },
      },
    },
    actions: {
      save: { kind: 'mutate', source: 'site.seo', op: 'update' },
    },
    ...overrides,
  };
}

describe('validateSpec adversarial suite', () => {
  it('accepts a minimal valid host spec', () => {
    const result = validateSpec(validSpec(), baseContext());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.v).toBe(CURRENT_SPEC_VERSION);
      expect(result.spec.nodes.body?.type).toBe('panel-body');
    }
  });

  it('rejects budget violation when node count exceeds 200', () => {
    const nodes: PanelSpec['nodes'] = {
      body: { type: 'panel-body', children: [] },
    };
    for (let i = 0; i < SPEC_MAX_NODES; i += 1) {
      nodes[`n${i}`] = { type: 'panel-body' };
    }
    const result = validateSpec(
      validSpec({ nodes: { ...nodes, body: { type: 'panel-body', children: ['n0'] } } }),
      baseContext(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'SPEC_BUDGET_NODES')).toBe(true);
    }
  });

  it('rejects budget violation when tree depth exceeds 12', () => {
    const depth = SPEC_MAX_DEPTH + 1;
    const nodes: PanelSpec['nodes'] = {};
    for (let i = 0; i < depth; i += 1) {
      const id = i === 0 ? 'body' : `n${i}`;
      const childId = i + 1 < depth ? (i + 1 === 0 ? 'body' : `n${i + 1}`) : undefined;
      nodes[id] = {
        type: 'panel-body',
        ...(childId !== undefined ? { children: [childId] } : {}),
      };
    }
    const result = validateSpec(validSpec({ root: 'body', nodes }), baseContext());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'SPEC_BUDGET_DEPTH')).toBe(true);
    }
  });

  it('rejects oversized string props', () => {
    const long = 'x'.repeat(SPEC_MAX_STRING_PROP + 1);
    const result = validateSpec(
      validSpec({
        nodes: {
          body: { type: 'panel-body', children: ['empty'] },
          empty: { type: 'empty-state', props: { message: long } },
        },
      }),
      baseContext(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'SPEC_BUDGET_STRING')).toBe(true);
    }
  });

  it('rejects specs exceeding total byte budget', () => {
    const huge = 'a'.repeat(SPEC_MAX_TOTAL_BYTES);
    const result = validateSpec(
      {
        v: 1,
        origin: 'host',
        root: 'body',
        nodes: { body: { type: 'panel-body', props: { blob: huge } } },
      },
      baseContext(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'SPEC_BUDGET_SIZE')).toBe(true);
    }
  });

  it('rejects action-ref smuggling via host: prefix syntax', () => {
    const result = validateSpec(
      validSpec({
        nodes: {
          body: { type: 'panel-body', children: ['actions'] },
          actions: {
            type: 'action-row',
            props: { actions: ['host:__proto__'] },
          },
        },
        actions: {
          save: { kind: 'mutate', source: 'site.seo', op: 'update' },
        },
      }),
      baseContext(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'SPEC_ACTION_REF_SMUGGLED')).toBe(true);
    }
  });

  it('rejects undeclared action refs', () => {
    const result = validateSpec(
      validSpec({
        nodes: {
          body: { type: 'panel-body', children: ['actions'] },
          actions: {
            type: 'action-row',
            props: { actions: ['notDeclared'] },
          },
        },
        actions: {
          save: { kind: 'mutate', source: 'site.seo', op: 'update' },
        },
      }),
      baseContext(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'SPEC_ACTION_REF_MISSING')).toBe(true);
    }
  });

  it('rejects javascript: URLs anywhere in node props', () => {
    const result = validateSpec(
      validSpec({
        nodes: {
          body: { type: 'panel-body', children: ['link'] },
          link: {
            type: 'content',
            props: { website: 'javascript:alert(1)' },
          },
        },
      }),
      baseContext(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'SPEC_SANITIZE_JAVASCRIPT_URL')).toBe(true);
    }
  });

  it('rejects disallowed URL schemes in props', () => {
    const result = validateSpec(
      validSpec({
        nodes: {
          body: { type: 'panel-body', children: ['link'] },
          link: {
            type: 'content',
            props: { website: 'data:text/html,evil' },
          },
        },
      }),
      baseContext(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'SPEC_SANITIZE_URL_SCHEME')).toBe(true);
    }
  });

  it('rejects cyclic children graphs', () => {
    const result = validateSpec(
      validSpec({
        nodes: {
          body: { type: 'panel-body', children: ['a'] },
          a: { type: 'panel-body', children: ['b'] },
          b: { type: 'panel-body', children: ['a'] },
        },
      }),
      baseContext(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'SPEC_CYCLE')).toBe(true);
    }
  });

  it('rejects duplicate child ids under the same parent', () => {
    const result = validateSpec(
      validSpec({
        nodes: {
          body: { type: 'panel-body', children: ['actions', 'actions'] },
          actions: { type: 'action-row', props: { actions: ['save'] } },
        },
      }),
      baseContext(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'SPEC_DUPLICATE_CHILD')).toBe(true);
    }
  });

  it('preserves unknown node raw JSON as a placeholder with warning', () => {
    const rawNode = {
      type: 'future-widget',
      props: { experimental: true, nested: { keep: 'me' } },
      children: [],
    };
    const result = validateSpec(
      validSpec({
        nodes: {
          body: { type: 'panel-body', children: ['unknown'] },
          unknown: rawNode,
        },
      }),
      baseContext(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.some((w) => w.code === 'SPEC_NODE_UNKNOWN')).toBe(true);
      const placeholder = result.spec.nodes.unknown;
      expect(placeholder?.type).toBe(UNKNOWN_NODE_PLACEHOLDER_TYPE);
      expect(placeholder?.[UNKNOWN_NODE_RAW_KEY]).toEqual(rawNode);
    }
  });

  it('flags agent repair eligibility on failure when requested (step 7)', () => {
    const result = validateSpec(
      validSpec({
        nodes: {
          body: { type: 'panel-body', children: ['actions'] },
          actions: { type: 'action-row', props: { actions: ['missing'] } },
        },
      }),
      baseContext(),
      { agentRepairRound: true },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.agentRepairEligible).toBe(true);
      expect(result.errors[0]?.hint).toBeTruthy();
    }
  });
});

describe('migrateSpec', () => {
  it('applies ordered migrations to reach the current version', () => {
    const legacy: PanelSpec = {
      v: 0,
      origin: 'host',
      root: 'body',
      nodes: { body: { type: 'panel-body' } },
    };
    const migrations: SpecMigration[] = [
      {
        from: 0,
        to: 1,
        up: (spec) => ({
          ...spec,
          v: 1,
          state: { migrated: true },
        }),
      },
    ];
    const { spec, applied } = migrateSpec(legacy, migrations);
    expect(applied).toEqual([0]);
    expect(spec.v).toBe(1);
    expect(spec.state).toEqual({ migrated: true });
  });

  it('runs migrations before validation when spec.v is behind', () => {
    const input = {
      v: 0,
      origin: 'host',
      root: 'body',
      nodes: {
        body: { type: 'panel-body', children: ['actions'] },
        actions: { type: 'action-row', props: { actions: ['save'] } },
      },
      actions: {
        save: { kind: 'mutate', source: 'site.seo', op: 'update' },
      },
    };
    const migrations: SpecMigration[] = [
      {
        from: 0,
        to: 1,
        up: (spec) => ({ ...spec, v: 1 }),
      },
    ];
    const result = validateSpec(input, baseContext({ migrations }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.v).toBe(CURRENT_SPEC_VERSION);
    }
  });
});
