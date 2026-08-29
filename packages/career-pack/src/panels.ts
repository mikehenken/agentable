import type { ComponentType } from 'react';
import type { PanelDefinition, PanelProps } from '../../../src/panels/types';
import { CAREER_PANEL_IDS } from './constants';

const SCHEMA_VERSION = 1;

type CareerPanelModule = Record<string, ComponentType<unknown>>;

/**
 * Vite-static panel loaders. Explicit `.tsx` glob keys are required so dynamic
 * imports resolve when career-pack is consumed through workspace aliases
 * (e.g. archipelago website dev server `@fs` paths).
 */
const CAREER_PANEL_MODULE_LOADERS = import.meta.glob<CareerPanelModule>(
  './panels/*.tsx',
);

const K = {
  openPositionsTitle: 'career.panels.openPositions.title',
  applicationsTitle: 'career.panels.applications.title',
  growthPathsTitle: 'career.panels.growthPaths.title',
  resourcesTitle: 'career.panels.resources.title',
  settingsTitle: 'career.panels.settings.title',
  resumeDocsTitle: 'career.panels.resumeDocs.title',
  careerToolsTitle: 'career.panels.careerTools.title',
  journeyTitle: 'career.panels.journey.title',
  recentActivityTitle: 'career.panels.recentActivity.title',
} as const;

function reactPanel(
  id: string,
  meta: {
    title: string;
    icon: string;
    agentDescription: string;
    defaultSize: { w: number; h: number };
  },
  moduleFile: `./panels/${string}.tsx`,
  exportName: string,
): PanelDefinition {
  return {
    kind: 'react',
    id,
    meta: { schemaVersion: SCHEMA_VERSION, ...meta },
    loader: () => {
      const loadModule = CAREER_PANEL_MODULE_LOADERS[moduleFile];
      if (loadModule === undefined) {
        throw new Error(
          `[career-pack] no Vite glob match for ${moduleFile} (available: ${Object.keys(CAREER_PANEL_MODULE_LOADERS).join(', ')})`,
        );
      }
      return loadModule().then((mod) => {
        const component = mod[exportName];
        if (typeof component !== 'function') {
          throw new Error(`[career-pack] missing export ${exportName} from ${moduleFile}`);
        }
        // The Vite glob types every export as ComponentType<unknown>; the
        // career panels all take PanelProps, guarded by the check above.
        return { default: component as ComponentType<PanelProps> };
      });
    },
  };
}

/** Career pack panels — all Tier-2 surfaces are React for reference parity. */
export function createCareerPanelDefinitions(): readonly PanelDefinition[] {
  const panels: PanelDefinition[] = [
    reactPanel(
      'open-positions',
      {
        title: K.openPositionsTitle,
        icon: 'Briefcase',
        agentDescription:
          'Browse open roles with department, track, location, and search filters.',
        defaultSize: { w: 560, h: 520 },
      },
      './panels/OpenPositionsPanel.tsx',
      'OpenPositionsPanel',
    ),
    reactPanel(
      'applications',
      {
        title: K.applicationsTitle,
        icon: 'FileText',
        agentDescription: 'Applications with status, progress bars, and interview timelines.',
        defaultSize: { w: 520, h: 480 },
      },
      './panels/ApplicationsPanel.tsx',
      'ApplicationsPanel',
    ),
    reactPanel(
      'growth-paths',
      {
        title: K.growthPathsTitle,
        icon: 'TrendingUp',
        agentDescription: 'Fit-scored growth paths with milestone steps.',
        defaultSize: { w: 900, h: 420 },
      },
      './panels/GrowthPathsPanel.tsx',
      'GrowthPathsPanel',
    ),
    reactPanel(
      'resources',
      {
        title: K.resourcesTitle,
        icon: 'GraduationCap',
        agentDescription: 'Resources with featured hero and type tags.',
        defaultSize: { w: 520, h: 480 },
      },
      './panels/ResourcesPanel.tsx',
      'ResourcesPanel',
    ),
    reactPanel(
      'settings',
      {
        title: K.settingsTitle,
        icon: 'Settings',
        agentDescription: 'Save & sync, notifications, canvas, AI toggles.',
        defaultSize: { w: 440, h: 460 },
      },
      './panels/SettingsPanel.tsx',
      'SettingsPanel',
    ),
    reactPanel(
      'resume-docs',
      {
        title: K.resumeDocsTitle,
        icon: 'FileStack',
        agentDescription: 'Resume and document vault.',
        defaultSize: { w: 480, h: 440 },
      },
      './panels/ResumeDocsPanel.tsx',
      'ResumeDocsPanel',
    ),
    reactPanel(
      'career-tools',
      {
        title: K.careerToolsTitle,
        icon: 'Wrench',
        agentDescription: 'Salary estimator, resume scanner, interview prep.',
        defaultSize: { w: 520, h: 400 },
      },
      './panels/CareerToolsPanel.tsx',
      'CareerToolsPanel',
    ),
    reactPanel(
      'journey',
      {
        title: K.journeyTitle,
        icon: 'Map',
        agentDescription: 'Journey checklist and next steps.',
        defaultSize: { w: 480, h: 440 },
      },
      './panels/JourneyPanel.tsx',
      'JourneyPanel',
    ),
    reactPanel(
      'recent-activity',
      {
        title: K.recentActivityTitle,
        icon: 'Clock',
        agentDescription: 'Recent activity feed from panels and tools.',
        defaultSize: { w: 400, h: 360 },
      },
      './panels/RecentActivityPanel.tsx',
      'RecentActivityPanel',
    ),
  ];

  const ids = panels.map((panel) => panel.id);
  if (ids.join(',') !== CAREER_PANEL_IDS.join(',')) {
    throw new Error(
      `[career-pack] panel id drift: expected [${CAREER_PANEL_IDS.join(', ')}], got [${ids.join(', ')}]`,
    );
  }
  return panels;
}

export { K as CAREER_CATALOG_KEYS };
