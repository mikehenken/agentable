import type { ToolDefinition, ToolResult } from '../../../src/panels/tools';
import { CAREER_PANEL_IDS, CAREER_TOOL_NAMES, type CareerPanelId, type CareerToolName } from './constants';
import type { CareerPack } from './types';

/**
 * The career tool that claims job routing. Core suppresses its default set of
 * competing generic canvas tools while this tool is registered, so a job
 * question routes here rather than to share_artifact.
 */
export const CAREER_DOMAIN_ROUTING_TOOL: CareerToolName = 'open_positions';

/** Runtime seam for generated career tools (legacy canvas + createCanvasHost). */
export interface CareerToolRuntime {
  openPanel: (panelId: CareerPanelId | string) => ToolResult;
  setOpenPositionsIntent?: (intent: {
    department?: string;
    track?: string;
    location?: string;
    search?: string;
    selectedJobId?: number | null;
    selectedJobTitle?: string;
  }) => void;
  setResourcesIntent?: (intent: { search?: string }) => void;
  setGrowthPathsIntent?: (intent: { fromRole?: string }) => void;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function openPanelTool(
  runtime: CareerToolRuntime,
  panelId: CareerPanelId,
  _source: CareerToolName,
): ToolResult {
  if (!CAREER_PANEL_IDS.includes(panelId)) {
    return { ok: false, error: `unknown career panel "${panelId}"` };
  }
  return runtime.openPanel(panelId);
}

/**
 * Generated career domain tools derived from pack panel metadata (B3 → pack).
 * Handlers are bound to the supplied runtime so the same declarations work in
 * legacy canvas (panelIntentStore) and createCanvasHost (engine.openPanel).
 */
export function createCareerTools(
  runtime: CareerToolRuntime,
  _pack?: CareerPack,
): readonly ToolDefinition[] {
  const handlers: Record<CareerToolName, (args: Record<string, unknown>) => ToolResult> = {
    open_positions: (args) => {
      runtime.setOpenPositionsIntent?.({
        department: readString(args.department),
        track: readString(args.track),
        location: readString(args.location),
        search: readString(args.search),
        selectedJobId: null,
      });
      return openPanelTool(runtime, 'open-positions', 'open_positions');
    },
    show_job_detail: (args) => {
      runtime.setOpenPositionsIntent?.({
        selectedJobId: readNumber(args.jobId) ?? null,
        selectedJobTitle: readString(args.jobTitle),
      });
      return openPanelTool(runtime, 'open-positions', 'show_job_detail');
    },
    open_applications: () => openPanelTool(runtime, 'applications', 'open_applications'),
    open_growth_paths: (args) => {
      runtime.setGrowthPathsIntent?.({
        fromRole: readString(args.fromRole),
      });
      return openPanelTool(runtime, 'growth-paths', 'open_growth_paths');
    },
    open_resources: (args) => {
      runtime.setResourcesIntent?.({
        search: readString(args.search),
      });
      return openPanelTool(runtime, 'resources', 'open_resources');
    },
    open_learning: (args) => {
      runtime.setResourcesIntent?.({
        search: readString(args.search) ?? 'learning',
      });
      return openPanelTool(runtime, 'resources', 'open_learning');
    },
  };

  return CAREER_TOOL_NAMES.map((name) => ({
    declaration: careerToolDeclaration(name),
    handler: handlers[name],
    ...(name === CAREER_DOMAIN_ROUTING_TOOL ? { domainRouting: true as const } : {}),
  }));
}

/** Tool declarations only — useful for grounding tests and voice session bootstrap. */
export function careerToolDeclarations(): readonly ToolDefinition['declaration'][] {
  return CAREER_TOOL_NAMES.map((name) => careerToolDeclaration(name));
}

function careerToolDeclaration(name: CareerToolName): ToolDefinition['declaration'] {
  switch (name) {
    case 'open_positions':
      return {
        name,
        description:
          'Open the Open Positions panel so the candidate can browse current openings. Accepts department, track, location, and search filters.',
        parameters: {
          type: 'object',
          properties: {
            department: { type: 'string', description: 'Optional department filter.' },
            track: {
              type: 'string',
              description: 'Optional employment track filter (e.g. Professionals (Salaried)).',
            },
            location: {
              type: 'string',
              description: 'Optional location or market filter.',
            },
            search: {
              type: 'string',
              description: 'Optional free-text search across title, department, location, and tags.',
            },
          },
        },
      };
    case 'show_job_detail':
      return {
        name,
        description: "Open a specific job's detail view in the Open Positions panel.",
        parameters: {
          type: 'object',
          properties: {
            jobId: { type: 'number', description: 'Numeric job id when known.' },
            jobTitle: { type: 'string', description: 'Partial title match when id is unknown.' },
          },
        },
      };
    case 'open_applications':
      return {
        name,
        description: 'Open the Applications panel showing the candidate submitted applications.',
        parameters: { type: 'object', properties: {} },
      };
    case 'open_growth_paths':
      return {
        name,
        description: 'Open Growth Paths showing example career trajectories.',
        parameters: {
          type: 'object',
          properties: {
            fromRole: { type: 'string', description: 'Optional starting role to highlight.' },
          },
        },
      };
    case 'open_resources':
      return {
        name,
        description: 'Open Resources — guides, videos, benefits, and handbooks.',
        parameters: {
          type: 'object',
          properties: {
            search: { type: 'string', description: 'Optional search term.' },
          },
        },
      };
    case 'open_learning':
      return {
        name,
        description: 'Open Resources filtered to learning and training content.',
        parameters: {
          type: 'object',
          properties: {
            search: { type: 'string', description: 'Optional learning topic search.' },
          },
        },
      };
    default: {
      const exhaustive: never = name;
      throw new Error(`Unhandled career tool: ${String(exhaustive)}`);
    }
  }
}
