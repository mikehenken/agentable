import { describe, expect, it } from 'vitest';
import { registerHostActions } from '../../src/panels/tools';
import { createCareerTools, type CareerToolRuntime } from '../../packages/career-pack/src/tools';
import { getFunctionDeclarations } from '../../src/agents/tools/canvasTools';
import {
  DEFAULT_DOMAIN_ROUTING_SUPPRESSED_CORE_TOOLS,
  filterCoreToolsForDomainRouting,
  hostOffersDomainRoutingTools,
  inferPanelOpenedByTool,
} from '../../src/agents/tools/domainRoutingToolFilter';

describe('domainRoutingToolFilter (career pack declares the claim)', () => {
  it('detects career routing when open_positions is registered', () => {
    const runtime: CareerToolRuntime = {
      openPanel: () => ({ ok: true, result: 'ok' }),
    };
    const tools = createCareerTools(runtime);
    expect(hostOffersDomainRoutingTools(tools)).toBe(true);
  });

  it('suppresses share_artifact when career routing tools are present', () => {
    const runtime: CareerToolRuntime = {
      openPanel: () => ({ ok: true, result: 'ok' }),
    };
    const careerTools = createCareerTools(runtime);
    const merged = filterCoreToolsForDomainRouting([...careerTools,
      {
        declaration: {
          name: 'share_artifact',
          description: 'artifact',
          parameters: { type: 'object', properties: {} },
        },
        handler: () => ({ ok: true, result: 'noop' }),
      },
    ]);
    expect(merged.some((t) => t.declaration.name === 'open_positions')).toBe(true);
    expect(merged.some((t) => t.declaration.name === 'share_artifact')).toBe(false);
  });

  it('declares the claim on exactly one career tool', () => {
    const runtime: CareerToolRuntime = {
      openPanel: () => ({ ok: true, result: 'ok' }),
    };
    const declaring = createCareerTools(runtime)
      .filter((tool) => tool.domainRouting !== undefined)
      .map((tool) => tool.declaration.name);
    expect(declaring).toEqual(['open_positions']);
  });

  it('maps open_positions to open-positions panel for logging', () => {
    expect(inferPanelOpenedByTool('open_positions', { department: 'Operations' })).toBe(
      'open-positions');
    expect(inferPanelOpenedByTool('share_artifact', { name: 'Open Positions' })).toBe('artifacts');
  });
});

describe('pack-declared domain routing (neutral seam)', () => {
  const coreTool = (name: string) => ({
    declaration: {
      name,
      description: name,
      parameters: { type: 'object' as const, properties: {} },
    },
    handler: () => ({ ok: true as const, result: 'noop' }),
  });

  it('suppresses core tools for a pack that declares routing with non-career tool names', () => {
    const merged = filterCoreToolsForDomainRouting([
      { ...coreTool('open_widgets'), domainRouting: true },
      coreTool('share_artifact'),
      coreTool('draw_shapes'),
    ]);
    expect(merged.map((t) => t.declaration.name)).toEqual(['open_widgets']);
  });

  it('keeps every core tool for a pack that declares nothing', () => {
    const merged = filterCoreToolsForDomainRouting([
      coreTool('open_widgets'),
      coreTool('share_artifact'),
      coreTool('draw_shapes'),
    ]);
    expect(merged.map((t) => t.declaration.name)).toEqual([
      'open_widgets',
      'share_artifact',
      'draw_shapes',
    ]);
  });

  it('suppresses only the core tools a pack names explicitly', () => {
    const merged = filterCoreToolsForDomainRouting([
      { ...coreTool('open_widgets'), domainRouting: { suppressCoreTools: ['share_artifact'] } },
      coreTool('share_artifact'),
      coreTool('draw_shapes'),
    ]);
    expect(merged.map((t) => t.declaration.name)).toEqual(['open_widgets', 'draw_shapes']);
  });
});

describe('getFunctionDeclarations career routing', () => {
  it('omits share_artifact when career host actions are registered', () => {
    const runtime: CareerToolRuntime = {
      openPanel: () => ({ ok: true, result: 'ok' }),
    };
    const unregister = registerHostActions(createCareerTools(runtime));
    try {
      const names = getFunctionDeclarations().map((d) => d.name);
      expect(names).toContain('open_positions');
      expect(names).not.toContain('share_artifact');
      expect(names).not.toContain('draw_shapes');
      for (const suppressed of DEFAULT_DOMAIN_ROUTING_SUPPRESSED_CORE_TOOLS) {
        expect(names).not.toContain(suppressed);
      }
    } finally {
      unregister();
    }
  });
});

 // panels/tools has no test reset — use register/unregister only in test above
