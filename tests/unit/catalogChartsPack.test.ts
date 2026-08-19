/**
 * @agentable/catalog-charts pack assembly.
 */
import { describe, expect, it } from 'vitest';
import {
  CHART_PANEL_IDS,
  createChartsPack,
  buildComposedChartSpec,
  mergeChartsCatalog,
} from '@agentable/catalog-charts';
import { defaultCatalog } from '../../src/panels/spec';

describe('createChartsPack', () => {
  it('registers four demo panels in stable order', () => {
    const pack = createChartsPack();
    expect(pack.panelIds).toEqual([...CHART_PANEL_IDS]);
    expect(pack.panels).toHaveLength(4);
    expect(pack.panels.every((panel) => panel.kind === 'spec')).toBe(true);
  });

  it('merges chart entries onto default catalog without collision', () => {
    const merged = mergeChartsCatalog(defaultCatalog);
    expect(merged.has('chart-bar')).toBe(true);
    expect(merged.has('header')).toBe(true);
    expect(merged.size).toBe(defaultCatalog.size + 4);
  });

  it('builds agent-origin composed chart specs', () => {
    const spec = buildComposedChartSpec({
      chartType: 'chart-line',
      chartProps: { data: [{ label: 'A', value: 1 }] },
      title: 'Trend',
    });
    expect(spec.origin).toBe('agent');
    expect(spec.nodes.chart?.type).toBe('chart-line');
  });
});
