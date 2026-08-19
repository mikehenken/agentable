/**
 * Fictional Archipelago Resorts demo fixtures (rule 4).
 * No real clients, employers, or competitor brand names.
 */
import { CHART_COLORS, type ChartCatalogEntryName } from '@agentable/catalog-charts';
import type { CareerDataset } from '@agentable/career-pack';

/** Logical diagram nodes for draw_shapes auto-layout (structure only, no coordinates). */
export interface ArchipelagoDiagramStructure {
  nodes: readonly { id: string; label: string; kind?: 'box' | 'ellipse' }[];
  edges?: readonly { from: string; to: string; label?: string }[];
  order?: readonly string[];
}

export const ARCHIPELAGO_BRAND = {
  name: 'Archipelago Resorts',
  tagline: 'Island hospitality across the Meridian chain',
  tenant: 'archipelago-resorts',
} as const;

/** Brands that must never appear in demo copy (copy-hygiene gate). */
export const FORBIDDEN_DEMO_BRAND_NAMES = [
  'Beaches',
  'Fidelity',
  'Marriott',
  'Hilton',
] as const;

/** Front-office career trajectory - logical structure only (no coordinates). */
export const ARCHIPELAGO_CAREER_TRAJECTORY: {
  layout: 'timeline';
  diagram: ArchipelagoDiagramStructure;
} = {
  layout: 'timeline',
  diagram: {
    nodes: [
      { id: 'guest-associate', label: 'Guest Experience Associate' },
      { id: 'experience-lead', label: 'Experience Lead' },
      { id: 'island-manager', label: 'Island Operations Manager' },
      { id: 'regional-director', label: 'Regional Director' },
    ],
  },
};

/** Job-economy bar chart composed via @agentable/catalog-charts. */
export const ARCHIPELAGO_JOB_ECONOMY_CHART: {
  chartType: ChartCatalogEntryName;
  title: string;
  subtitle: string;
  chartProps: Record<string, unknown>;
} = {
  chartType: 'chart-bar',
  title: 'Archipelago Resorts - Job Economy',
  subtitle: 'Open roles vs internal promotions by quarter (fictional)',
  chartProps: {
    data: [
      { label: 'Q1', openRoles: 28, promotions: 9 },
      { label: 'Q2', openRoles: 34, promotions: 12 },
      { label: 'Q3', openRoles: 31, promotions: 14 },
      { label: 'Q4', openRoles: 40, promotions: 16 },
    ],
    xKey: 'label',
    series: [
      { key: 'openRoles', label: 'Open roles', color: CHART_COLORS[0] },
      { key: 'promotions', label: 'Promotions', color: CHART_COLORS[1] },
    ],
  },
};

/** Island journey map - radial layout from logical nodes. */
export const ARCHIPELAGO_ISLAND_DIAGRAM: {
  layout: 'radial';
  diagram: ArchipelagoDiagramStructure;
} = {
  layout: 'radial',
  diagram: {
    nodes: [
      { id: 'coral-bay-hq', label: 'Coral Bay HQ' },
      { id: 'azure-atoll', label: 'Azure Atoll' },
      { id: 'sunreach-isle', label: 'Sunreach Isle' },
      { id: 'mistral-key', label: 'Mistral Key' },
      { id: 'ember-lagoon', label: 'Ember Lagoon' },
    ],
    edges: [
      { from: 'coral-bay-hq', to: 'azure-atoll' },
      { from: 'coral-bay-hq', to: 'sunreach-isle' },
      { from: 'coral-bay-hq', to: 'mistral-key' },
      { from: 'coral-bay-hq', to: 'ember-lagoon' },
    ],
  },
};

/** Narration script for island walkthrough (targets resolved at runtime to shape ids). */
export const ARCHIPELAGO_ISLAND_WALKTHROUGH_NARRATION: readonly {
  nodeId: string;
  say: string;
}[] = [
  {
    nodeId: 'coral-bay-hq',
    say: 'Welcome to Coral Bay HQ, the heart of Archipelago Resorts operations.',
  },
  {
    nodeId: 'azure-atoll',
    say: 'Azure Atoll is our flagship overwater experience with the highest guest satisfaction scores.',
  },
  {
    nodeId: 'sunreach-isle',
    say: 'Sunreach Isle focuses on family programs and youth hospitality careers.',
  },
  {
    nodeId: 'mistral-key',
    say: 'Mistral Key is the culinary innovation lab for the Meridian chain.',
  },
  {
    nodeId: 'ember-lagoon',
    say: 'Ember Lagoon completes the journey with wellness retreats and spa leadership paths.',
  },
];

/** Career-pack-shaped dataset for optional host registration in the gallery example. */
export const ARCHIPELAGO_CAREER_DATASET: CareerDataset = {
  jobs: [
    {
      id: 'arch-job-1',
      slug: 'island-guest-experience-lead',
      title: 'Guest Experience Lead',
      department: 'Guest Services',
      track: 'Full-time · Salary',
      location: 'Azure Atoll, Meridian Sea',
      description:
        'Lead daily guest rituals and mentor associates across Archipelago Resorts island properties.',
      tags: ['Hospitality', 'Leadership', 'Guest Services'],
      postedAt: '2026-04-01T00:00:00.000Z',
      source: 'fixture',
      sourceId: 'archipelago-job-1',
      applyUrl: 'https://careers.example.test/archipelago/guest-experience-lead',
    },
    {
      id: 'arch-job-2',
      slug: 'culinary-innovation-chef',
      title: 'Culinary Innovation Chef',
      department: 'Food & Beverage',
      track: 'Full-time · Salary',
      location: 'Mistral Key, Meridian Sea',
      description:
        'Design tasting menus and train kitchen teams for Archipelago Resorts signature dining.',
      tags: ['Culinary', 'Innovation', 'Food & Beverage'],
      postedAt: '2026-04-01T00:00:00.000Z',
      source: 'fixture',
      sourceId: 'archipelago-job-2',
      applyUrl: 'https://careers.example.test/archipelago/culinary-innovation-chef',
    },
  ],
  growthPaths: [
    {
      id: 'arch-path-front-office',
      fromRole: 'Guest Experience Associate',
      toRole: 'Regional Director',
      fitScore: 89,
      summary: 'The signature Archipelago Resorts path from island floor roles into regional leadership.',
      steps: [
        'Guest Experience Associate',
        'Experience Lead',
        'Island Operations Manager',
        'Regional Director',
      ],
    },
  ],
  resources: [
    {
      id: 'arch-res-1',
      title: 'Island onboarding compass',
      category: 'Learning',
      description: 'Week-one guide for associates rotating across Archipelago Resorts islands.',
      url: 'https://learn.example.test/archipelago/onboarding',
      featured: true,
    },
  ],
  applications: [],
};

export const AGENT_PRESENTS_SCENARIO_IDS = [
  'career-trajectory',
  'job-economy-chart',
  'island-walkthrough',
] as const;

export type AgentPresentsScenarioId = (typeof AGENT_PRESENTS_SCENARIO_IDS)[number];
