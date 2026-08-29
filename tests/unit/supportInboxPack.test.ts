/**
 * @agentable/support-inbox-pack unit suite — panel compile, validation,
 * generated tools, and pack immutability.
 */
import { describe, expect, it } from 'vitest';
import {
  SUPPORT_INBOX_PANEL_IDS,
  SUPPORT_INBOX_TOOL_NAMES,
  createSupportInboxPack,
  createSupportInboxTools,
  extendSupportInboxPack,
  type SupportInboxToolRuntime,
} from '@agentable/support-inbox-pack';
import { defineStaticPanel } from '../../src/panels/builder';
import { validateSpec, defaultCatalog } from '../../src/panels/spec';

describe('createSupportInboxPack', () => {
  it('registers three Tier 2 panels in stable order', () => {
    const pack = createSupportInboxPack();
    expect(pack.panelIds).toEqual([...SUPPORT_INBOX_PANEL_IDS]);
    expect(pack.panels).toHaveLength(3);
    expect(pack.panels.every((panel) => panel.kind === 'spec')).toBe(true);
  });

  it('ships persona scaffold with starter prompts', () => {
    const pack = createSupportInboxPack({ persona: { assistantName: 'Casey' } });
    expect(pack.personaScaffold.assistantName).toBe('Casey');
    expect(pack.personaScaffold.starterPrompts.length).toBeGreaterThan(0);
    expect(pack.tenantDefaults.persona?.assistantName).toBe('Casey');
  });

  it('generates stable support tool declarations', () => {
    const pack = createSupportInboxPack();
    expect(pack.tools.map((tool) => tool.declaration.name)).toEqual([...SUPPORT_INBOX_TOOL_NAMES]);
  });

  it('validates all pack panel specs against the v1 catalog', () => {
    const pack = createSupportInboxPack();
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

  it('compiles the macros list with the insertMacro row action', () => {
    // Regression: rowActions declared at the block level (instead of on `row`)
    // were silently dropped by the list compiler, shipping macros rows with
    // no insert action.
    const pack = createSupportInboxPack();
    const macros = pack.panels.find((panel) => panel.id === 'macros');
    expect(macros?.kind).toBe('spec');
    if (macros?.kind !== 'spec') return;
    const listNode = Object.values(macros.spec.nodes).find(
      (node) => node.type === 'list' && (node.props as { bind?: string })?.bind === 'macros',
    );
    expect(listNode).toBeDefined();
    const row = (listNode?.props as { row?: { rowActions?: string[] } })?.row;
    expect(row?.rowActions).toEqual(['insertMacro']);
  });
});

describe('createSupportInboxTools runtime binding', () => {
  it('routes open_inbox to the inbox panel with intent', () => {
    const opened: string[] = [];
    const intents: unknown[] = [];
    const runtime: SupportInboxToolRuntime = {
      openPanel: (panelId) => {
        opened.push(panelId);
        return { ok: true, result: panelId };
      },
      setInboxIntent: (intent) => {
        intents.push(intent);
      },
    };
    const tools = createSupportInboxTools(runtime);
    const openInbox = tools.find((tool) => tool.declaration.name === 'open_inbox');
    expect(openInbox).toBeDefined();
    const result = openInbox?.handler({ status: 'open', search: 'billing' });
    expect(result?.ok).toBe(true);
    expect(opened).toEqual(['inbox']);
    expect(intents[0]).toEqual({
      status: 'open',
      search: 'billing',
      priority: undefined,
    });
  });

  it('routes show_ticket to ticket-detail with ticket id intent', () => {
    const opened: string[] = [];
    const intents: unknown[] = [];
    const runtime: SupportInboxToolRuntime = {
      openPanel: (panelId) => {
        opened.push(panelId);
        return { ok: true, result: panelId };
      },
      setTicketDetailIntent: (intent) => {
        intents.push(intent);
      },
    };
    const tools = createSupportInboxTools(runtime);
    const showTicket = tools.find((tool) => tool.declaration.name === 'show_ticket');
    const result = showTicket?.handler({ ticketId: 'tkt-1001' });
    expect(result?.ok).toBe(true);
    expect(opened).toEqual(['ticket-detail']);
    expect(intents[0]).toEqual({ ticketId: 'tkt-1001' });
  });
});

describe('extendSupportInboxPack ( extension surface)', () => {
  it('does not mutate the base pack', () => {
    const base = createSupportInboxPack();
    const baseIds = [...base.panelIds];
    extendSupportInboxPack(base, {
      panels: [
        defineStaticPanel({
          id: 'fixture-sla',
          meta: { title: 'SLA', schemaVersion: 1 },
          blocks: [{ block: 'header', title: 'SLA' }],
        }),
      ],
    });
    expect(base.panelIds).toEqual(baseIds);
    expect(base.panels).toHaveLength(3);
  });

  it('appends custom panels via extension points only', () => {
    const base = createSupportInboxPack();
    const extended = extendSupportInboxPack(base, {
      panels: [
        defineStaticPanel({
          id: 'fixture-sla',
          meta: { title: 'SLA Dashboard', schemaVersion: 1, agentDescription: 'SLA overview' },
          blocks: [{ block: 'header', title: 'SLA Dashboard' }],
        }),
      ],
      navItems: [{ id: 'sla', label: 'SLA', icon: 'Gauge', panelId: 'fixture-sla' }],
    });
    expect(extended.panelIds).toContain('fixture-sla');
    expect(extended.panelIds).toEqual(expect.arrayContaining([...SUPPORT_INBOX_PANEL_IDS]));
    expect(extended.navItems.some((item) => item.id === 'sla')).toBe(true);
  });
});
