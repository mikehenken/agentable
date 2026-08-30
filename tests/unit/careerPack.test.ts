/**
 * @agentable/career-pack unit suite — panel compile, validation,
 * generated tools, and pack immutability.
 */
import { describe, expect, it } from 'vitest';
import {
  CAREER_PANEL_IDS,
  CAREER_TOOL_NAMES,
  createCareerPack,
  createCareerTools,
  extendCareerPack,
  type CareerToolRuntime,
} from '@agentable/career-pack';
import { defineStaticPanel } from '../../src/panels/builder';
import { validateSpec, defaultCatalog } from '../../src/panels/spec';

describe('createCareerPack', () => {
  it('registers the canonical career panels in stable order (all bespoke react)', () => {
    const pack = createCareerPack();
    expect(pack.panelIds).toEqual([...CAREER_PANEL_IDS]);
    expect(pack.panels).toHaveLength(CAREER_PANEL_IDS.length);
    const openPositions = pack.panels.find((panel) => panel.id === 'open-positions');
    expect(openPositions?.kind).toBe('react');
    // The career pack is the bespoke, richly-styled surface: every panel ships
    // a dedicated React component (the generic spec-renderer path is used by
    // other packs, e.g. support-inbox), so all panels resolve to kind 'react'.
    expect(pack.panels.every((panel) => panel.kind === 'react')).toBe(true);
  });

  it('ships persona scaffold with starter prompts', () => {
    const pack = createCareerPack({ persona: { assistantName: 'Mason' } });
    expect(pack.personaScaffold.assistantName).toBe('Mason');
    expect(pack.personaScaffold.starterPrompts.length).toBeGreaterThan(0);
    expect(pack.tenantDefaults.persona?.assistantName).toBe('Mason');
  });

  it('generates stable career tool declarations', () => {
    const pack = createCareerPack();
    expect(pack.tools.map((tool) => tool.declaration.name)).toEqual([...CAREER_TOOL_NAMES]);
  });

  it('validates all pack panel specs against the v1 catalog', () => {
    const pack = createCareerPack();
    const adapterSources = new Set(pack.adapterSources);
    for (const panel of pack.panels) {
      if (panel.kind !== 'spec') continue;
      const result = validateSpec(panel.spec, {
        catalog: defaultCatalog,
        adapterSources,
        hostActions: new Set(),
        panelRegistry: new Set(pack.panelIds),
      });
      expect(result.ok, `validateSpec failed for ${panel.id}`).toBe(true);
    }
  });
});

describe('createCareerTools runtime binding', () => {
  it('routes open_positions to the open-positions panel with intent', () => {
    const opened: string[] = [];
    const intents: unknown[] = [];
    const runtime: CareerToolRuntime = {
      openPanel: (panelId) => {
        opened.push(panelId);
        return { ok: true, result: panelId };
      },
      setOpenPositionsIntent: (intent) => {
        intents.push(intent);
      },
    };
    const tools = createCareerTools(runtime);
    const openPositions = tools.find((tool) => tool.declaration.name === 'open_positions');
    expect(openPositions).toBeDefined();
    const result = openPositions?.handler({ department: 'Engineering', search: 'Austin' });
    expect(result?.ok).toBe(true);
    expect(opened).toEqual(['open-positions']);
    expect(intents[0]).toEqual({
      department: 'Engineering',
      search: 'Austin',
      selectedJobId: null,
    });
  });
});

describe('extendCareerPack ( extension surface)', () => {
  it('does not mutate the base pack', () => {
    const base = createCareerPack();
    const baseIds = [...base.panelIds];
    extendCareerPack(base, {
      panels: [
        defineStaticPanel({
          id: 'fixture-benefits',
          meta: { title: 'Benefits', schemaVersion: 1 },
          blocks: [{ block: 'header', title: 'Benefits' }],
        }),
      ],
    });
    expect(base.panelIds).toEqual(baseIds);
    expect(base.panels).toHaveLength(CAREER_PANEL_IDS.length);
  });

  it('appends custom panels via extension points only', () => {
    const base = createCareerPack();
    const extended = extendCareerPack(base, {
      panels: [
        defineStaticPanel({
          id: 'fixture-benefits',
          meta: { title: 'Benefits', schemaVersion: 1, agentDescription: 'Benefits overview' },
          blocks: [{ block: 'header', title: 'Benefits' }],
        }),
      ],
      navItems: [{ id: 'benefits', label: 'Benefits', icon: 'Heart', panelId: 'fixture-benefits' }],
    });
    expect(extended.panelIds).toContain('fixture-benefits');
    expect(extended.panelIds).toEqual(expect.arrayContaining([...CAREER_PANEL_IDS]));
    expect(extended.navItems.some((item) => item.id === 'benefits')).toBe(true);
  });

  it('supports panelOverrides without patching pack source', () => {
    const base = createCareerPack();
    const override = defineStaticPanel({
      id: 'open-positions',
      meta: { title: 'Roles (tenant)', schemaVersion: 1 },
      blocks: [{ block: 'header', title: 'Tenant Roles' }],
    });
    const extended = extendCareerPack(base, { panelOverrides: { 'open-positions': override } });
    const replaced = extended.panels.find((panel) => panel.id === 'open-positions');
    expect(replaced?.kind).toBe('spec');
    if (replaced?.kind === 'spec') {
      expect(replaced.spec.nodes.header?.props?.title).toBe('Tenant Roles');
    }
    const untouched = base.panels.find((panel) => panel.id === 'open-positions');
    expect(untouched?.meta.title).toBe('career.panels.openPositions.title');
  });
});
