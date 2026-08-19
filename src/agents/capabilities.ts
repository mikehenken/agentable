/**
 * Capability model for agent sessions and tool gating.
 */
import type { EngineCapabilities } from '../engine/types';
import { ENGINE_DRAW_UNAVAILABLE_CODE } from '../engine/agentDrawingTypes';
import type { ToolDefinition } from '../panels/tools';
import { DRAWING_TOOL_NAMES } from './tools/drawingTools';
import { AUTHORING_TOOLKIT_TOOL_NAMES } from './tools/authoringToolkitTools';
import { WALKTHROUGH_TOOL_NAMES } from './tools/walkthroughTools';
import type { AgentSession, CapabilityNote, ModelCapabilities, ProviderBinding } from './types';

export type CapabilityClass = 'read' | 'ui' | 'mutate' | 'job';

export type CapabilityApproval = 'none' | 'hitl' | 'user-only';

export interface CapabilityDescriptor {
  id: string;
  class: CapabilityClass;
  scopeRequired?: 'context' | 'entity';
  approval: CapabilityApproval;
  costClass?: 'cheap' | 'expensive';
  summary: string;
}

export interface ToolCapabilityRequirement {
  vision?: boolean;
  tools?: boolean;
  minContextTokens?: number;
  streaming?: boolean;
}

export interface GatedToolOffer {
  tool: ToolDefinition;
  offered: boolean;
  degradedFrom?: string;
  note?: CapabilityNote;
}

/** Capability-dependent tools and their requirements. */
export const TOOL_CAPABILITY_REQUIREMENTS: Readonly<
  Record<string, ToolCapabilityRequirement>
> = {
  screenshot_canvas: { vision: true },
  read_canvas: { tools: true },
  compose_panel: { minContextTokens: 8_000, tools: true },
};

/** Vision tools degrade to structured read alternatives. */
export const TOOL_CAPABILITY_DEGRADATION: Readonly<
  Record<string, { fallbackTool: string; message: string }>
> = {
  screenshot_canvas: {
    fallbackTool: 'read_canvas',
    message:
      'Model lacks vision; use read_canvas for structured canvas perception instead of screenshot_canvas.',
  },
};

const PANEL_READ_TOOLS = new Set([
  'list_panels',
  'describe_panel',
  'open_panel',
  'fill_panel',
  // Digest drill-downs (03 section 3.1): all read / free-fire.
  'describe_context',
  'read_panel_state',
  'get_activity',
  'list_agents',
  'read_canvas',
]);

const PANEL_UI_TOOLS = new Set(['compose_panel', 'patch_panel']);

const DRAWING_UI_TOOLS = new Set<string>([
  ...DRAWING_TOOL_NAMES,
  ...AUTHORING_TOOLKIT_TOOL_NAMES,
]);

/** Tools that require engine.capabilities.draw. */
export const ENGINE_DRAW_REQUIRED_TOOLS: ReadonlySet<string> = new Set([
  ...DRAWING_TOOL_NAMES,
  ...AUTHORING_TOOLKIT_TOOL_NAMES,
  ...WALKTHROUGH_TOOL_NAMES,
]);

const PANEL_MUTATE_TOOLS = new Set(['run_panel_action']);

const PANEL_JOB_TOOLS = new Set(['export_document']);

function inferCapabilityClass(toolName: string): CapabilityClass {
  if (PANEL_READ_TOOLS.has(toolName)) return 'read';
  if (PANEL_JOB_TOOLS.has(toolName)) return 'job';
  if (PANEL_UI_TOOLS.has(toolName) || DRAWING_UI_TOOLS.has(toolName)) return 'ui';
  if (PANEL_MUTATE_TOOLS.has(toolName)) return 'mutate';
  if (toolName.includes('generator') || toolName.includes('workflow')) return 'job';
  return 'ui';
}

function inferApproval(toolName: string): CapabilityApproval {
  if (toolName === 'run_panel_action') return 'hitl';
  if (toolName.includes('generator') || toolName.includes('workflow')) return 'hitl';
  return 'none';
}

function bindingMeetsRequirement(
  caps: ModelCapabilities,
  requirement: ToolCapabilityRequirement,
): boolean {
  if (requirement.vision === true && !caps.vision) return false;
  if (requirement.tools === true && !caps.tools) return false;
  if (requirement.streaming === true && !caps.streaming) return false;
  if (
    typeof requirement.minContextTokens === 'number' &&
    caps.contextTokens < requirement.minContextTokens
  ) {
    return false;
  }
  return true;
}

/** Derive session capabilities from the tool registry. */
export function deriveCapabilities(
  session: AgentSession,
  tools: readonly ToolDefinition[],
): CapabilityDescriptor[] {
  return tools.map((tool) => {
    const name = tool.declaration.name;
    return {
      id: name,
      class: inferCapabilityClass(name),
      approval: inferApproval(name),
      costClass: tool.declaration.costClass,
      summary: tool.declaration.description.split('\n')[0] ?? name,
    };
  });
}

/** Gate tools for a resolved provider binding. */
export function gateToolsForCapabilities(
  tools: readonly ToolDefinition[],
  binding: ProviderBinding,
): GatedToolOffer[] {
  const byName = new Map(tools.map((tool) => [tool.declaration.name, tool]));
  const offers: GatedToolOffer[] = [];
  const offeredNames = new Set<string>();

  for (const tool of tools) {
    const name = tool.declaration.name;
    const requirement = TOOL_CAPABILITY_REQUIREMENTS[name];
    if (!requirement || bindingMeetsRequirement(binding.caps, requirement)) {
      offers.push({ tool, offered: true });
      offeredNames.add(name);
      continue;
    }

    const degradation = TOOL_CAPABILITY_DEGRADATION[name];
    if (degradation && byName.has(degradation.fallbackTool)) {
      const fallbackName = degradation.fallbackTool;
      const degradationNote: CapabilityNote = {
        code: 'TOOL_DEGRADED',
        message: degradation.message,
        alias: binding.model,
      };
      const existingFallback = offers.find(
        (offer) => offer.tool.declaration.name === fallbackName && offer.offered,
      );
      if (existingFallback !== undefined && existingFallback.degradedFrom === undefined) {
        existingFallback.degradedFrom = name;
        existingFallback.note = degradationNote;
      } else if (!offeredNames.has(fallbackName)) {
        offers.push({
          tool: byName.get(fallbackName)!,
          offered: true,
          degradedFrom: name,
          note: degradationNote,
        });
        offeredNames.add(fallbackName);
      }
      offers.push({
        tool,
        offered: false,
        note: degradationNote,
      });
      continue;
    }

    offers.push({
      tool,
      offered: false,
      note: {
        code: 'CAPABILITY_MISMATCH',
        message: `Tool "${name}" requires capabilities not provided by the resolved model.`,
        alias: binding.model,
      },
    });
  }

  return offers;
}

/** Session-level transport notes for non-streaming bindings. */
export function transportNotesForBinding(
  binding: ProviderBinding,
): CapabilityNote[] {
  if (binding.caps.streaming) return [];
  return [
    {
      code: 'BUFFERED_TURNS',
      message:
        'Resolved model does not stream; agent turns will be buffered instead of token-streamed.',
      alias: binding.model,
    },
  ];
}

export interface EngineGatedToolOffer {
  tool: ToolDefinition;
  offered: boolean;
  note?: CapabilityNote;
}

/** Gate draw tools when the mounted engine lacks capabilities.draw. */
export function gateToolsForEngineCapabilities(
  tools: readonly ToolDefinition[],
  capabilities: EngineCapabilities | null,
): EngineGatedToolOffer[] {
  const drawEnabled = capabilities?.draw === true;
  return tools.map((tool) => {
    const name = tool.declaration.name;
    if (!ENGINE_DRAW_REQUIRED_TOOLS.has(name)) {
      return { tool, offered: true };
    }
    if (drawEnabled) {
      return { tool, offered: true };
    }
    return {
      tool,
      offered: false,
      note: {
        code: 'ENGINE_CAPABILITY_MISMATCH',
        message: `${ENGINE_DRAW_UNAVAILABLE_CODE}: tool "${name}" requires engine draw capability`,
      },
    };
  });
}

/** Return only tools offered for engine capabilities. */
export function selectEngineOfferedTools(
  offers: readonly EngineGatedToolOffer[],
): ToolDefinition[] {
  return offers.filter((offer) => offer.offered).map((offer) => offer.tool);
}

/** Return only tools offered for the session binding. */
export function selectOfferedTools(offers: readonly GatedToolOffer[]): ToolDefinition[] {
  const selected: ToolDefinition[] = [];
  const seen = new Set<string>();
  for (const offer of offers) {
    if (!offer.offered) continue;
    const name = offer.tool.declaration.name;
    if (seen.has(name)) continue;
    seen.add(name);
    selected.push(offer.tool);
  }
  return selected;
}
