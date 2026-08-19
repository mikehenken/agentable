/**
 * fixture validation and copy-hygiene checks for Archipelago Resorts demos.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCareerDataset } from '@agentable/career-pack';
import { buildComposedChartSpec, parseBarChartProps } from '@agentable/catalog-charts';
import {
  AGENT_PRESENTS_SCENARIO_IDS,
  ARCHIPELAGO_BRAND,
  ARCHIPELAGO_CAREER_DATASET,
  ARCHIPELAGO_CAREER_TRAJECTORY,
  ARCHIPELAGO_ISLAND_DIAGRAM,
  ARCHIPELAGO_ISLAND_WALKTHROUGH_NARRATION,
  ARCHIPELAGO_JOB_ECONOMY_CHART,
  FORBIDDEN_DEMO_BRAND_NAMES,
} from '../../examples/08-agent-presents/fixtures/archipelagoResorts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(__dirname, '../fixtures/archipelago-resorts/scenario-manifest.json');

function collectFixtureStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectFixtureStrings);
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap(collectFixtureStrings);
  }
  return [];
}

describe('agent-presents fixtures', () => {
  it('defines three demo scenarios for 08-agent-presents', () => {
    expect(AGENT_PRESENTS_SCENARIO_IDS).toEqual([
      'career-trajectory',
      'job-economy-chart',
      'island-walkthrough',
    ]);
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as {
      brand: string;
      scenarios: Array<{ id: string }>;
    };
    expect(manifest.brand).toBe(ARCHIPELAGO_BRAND.name);
    expect(manifest.scenarios.map((entry) => entry.id)).toEqual([...AGENT_PRESENTS_SCENARIO_IDS]);
  });

  it('uses fictional Archipelago Resorts branding only', () => {
    const corpus = collectFixtureStrings({
      ARCHIPELAGO_BRAND,
      ARCHIPELAGO_CAREER_TRAJECTORY,
      ARCHIPELAGO_JOB_ECONOMY_CHART,
      ARCHIPELAGO_ISLAND_DIAGRAM,
      ARCHIPELAGO_ISLAND_WALKTHROUGH_NARRATION,
      ARCHIPELAGO_CAREER_DATASET,
    }).join('\n');

    for (const forbidden of FORBIDDEN_DEMO_BRAND_NAMES) {
      expect(corpus, `forbidden brand "${forbidden}"`).not.toMatch(new RegExp(`\\b${forbidden}\\b`, 'i'));
    }
    expect(corpus).toContain('Archipelago Resorts');
  });

  it('career trajectory diagram has structure without coordinates', () => {
    const serialized = JSON.stringify(ARCHIPELAGO_CAREER_TRAJECTORY);
    expect(serialized).not.toMatch(/"x"\s*:/);
    expect(serialized).not.toMatch(/"y"\s*:/);
    expect(ARCHIPELAGO_CAREER_TRAJECTORY.diagram.nodes.length).toBeGreaterThanOrEqual(4);
    expect(ARCHIPELAGO_CAREER_TRAJECTORY.layout).toBe('timeline');
  });

  it('job-economy chart builds a valid composed bar chart spec', () => {
    const spec = buildComposedChartSpec({
      chartType: ARCHIPELAGO_JOB_ECONOMY_CHART.chartType,
      chartProps: ARCHIPELAGO_JOB_ECONOMY_CHART.chartProps,
      title: ARCHIPELAGO_JOB_ECONOMY_CHART.title,
      subtitle: ARCHIPELAGO_JOB_ECONOMY_CHART.subtitle,
    });
    expect(spec.origin).toBe('agent');
    const chartNode = spec.nodes.chart;
    expect(chartNode?.type).toBe('chart-bar');
    if (chartNode?.type === 'chart-bar') {
      const parsed = parseBarChartProps(chartNode.props);
      expect(parsed.data).toHaveLength(4);
    }
  });

  it('island walkthrough narration covers every diagram node', () => {
    expect(ARCHIPELAGO_ISLAND_WALKTHROUGH_NARRATION).toHaveLength(
      ARCHIPELAGO_ISLAND_DIAGRAM.diagram.nodes.length);
    const nodeIds = new Set(ARCHIPELAGO_ISLAND_DIAGRAM.diagram.nodes.map((node) => node.id));
    for (const step of ARCHIPELAGO_ISLAND_WALKTHROUGH_NARRATION) {
      expect(nodeIds.has(step.nodeId)).toBe(true);
      expect(step.say.length).toBeGreaterThan(10);
    }
  });

  it('archipelago career dataset parses via career-pack schema', () => {
    const parsed = parseCareerDataset(ARCHIPELAGO_CAREER_DATASET);
    expect(parsed.jobs.length).toBeGreaterThan(0);
    expect(parsed.growthPaths.length).toBeGreaterThan(0);
  });
});
