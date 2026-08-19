import { describe, expect, it } from 'vitest';
import { registerHostActions } from '../../src/panels/tools';
import { createCareerTools, type CareerToolRuntime } from '../../packages/career-pack/src/tools';
import { getFunctionDeclarations } from '../../src/agents/tools/canvasTools';
import {
  CORE_TOOLS_SUPPRESSED_FOR_CAREER_ROUTING,
  filterCoreToolsForCareerRouting,
  hostOffersCareerRoutingTools,
  inferPanelOpenedByTool,
} from '../../src/agents/tools/careerToolOfferFilter';

describe('careerToolOfferFilter', () => {
  it('detects career routing when open_positions is registered', () => {
    const runtime: CareerToolRuntime = {
      openPanel: () => ({ ok: true, result: 'ok' }),
    };
    const tools = createCareerTools(runtime);
    expect(hostOffersCareerRoutingTools(tools)).toBe(true);
  });

  it('suppresses share_artifact when career routing tools are present', () => {
    const runtime: CareerToolRuntime = {
      openPanel: () => ({ ok: true, result: 'ok' }),
    };
    const careerTools = createCareerTools(runtime);
    const merged = filterCoreToolsForCareerRouting([...careerTools,
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

  it('maps open_positions to open-positions panel for logging', () => {
    expect(inferPanelOpenedByTool('open_positions', { department: 'Operations' })).toBe(
      'open-positions');
    expect(inferPanelOpenedByTool('share_artifact', { name: 'Open Positions' })).toBe('artifacts');
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
      for (const suppressed of CORE_TOOLS_SUPPRESSED_FOR_CAREER_ROUTING) {
        expect(names).not.toContain(suppressed);
      }
    } finally {
      unregister();
    }
  });
});

 // panels/tools has no test reset — use register/unregister only in test above
