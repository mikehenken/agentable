/**
 * Unified career chat + toolbar bundle (Helios/Archipelago parity).
 *
 * Single injectable unit for system prompt, tool-surface policy, starter chips,
 * and whiteboard toolbar defaults. Hosts may override persona fields; weak
 * one-line embed prompts are replaced with tenant canonical prompts.
 */
import type { CanvasStarterPrompt } from '../../../src/config/CanvasContext';
import type { WhiteboardToolbarConfig } from '../../../src/engines/tldraw/toolbar/toolbarConfig';
import {
  DEFAULT_CAREER_AGENT_JOBS_GUIDE,
  enrichCareerAgentSystemPrompt,
} from './careerToolGrounding';
import { HELIOS_CAREER_SYSTEM_PROMPT } from './prompts/heliosSystemPrompt';
import { ARCHIPELAGO_CAREER_SYSTEM_PROMPT } from './prompts/archipelagoSystemPrompt';
import {
  DEFAULT_CAREER_TOOLBAR_CONFIG,
} from './whiteboard/careerCanvasDefaults';
import { HELIOS_STARTER_PROMPTS } from './tenants/helios';
import { ARCHIPELAGO_STARTER_PROMPTS } from './tenants/archipelago';

/** Core tools suppressed when career routing tools are registered. */
export const CAREER_SUPPRESSED_CORE_TOOLS = [
  'share_artifact',
  'draw_shapes',
  'annotate_panel',
  'clear_agent_drawings',
  'arrange',
  'group_shapes',
  'connect_shapes',
  'frame_shapes',
  'insert_image',
  'read_canvas',
  'screenshot_canvas',
] as const;

export type CareerSuppressedCoreTool = (typeof CAREER_SUPPRESSED_CORE_TOOLS)[number];

export interface CareerChatBundle {
  tenant: string;
  /** Canonical tenant system prompt (Helios Mason / Sandy full voice). */
  systemPrompt: string;
  /** Append fixture agentJobsGuide + default routing appendix. */
  enrichSystemPrompt: (base: string, agentJobsGuide?: string) => string;
  suppressedCoreTools: readonly CareerSuppressedCoreTool[];
  starterPrompts: readonly CanvasStarterPrompt[];
  toolbarConfig: WhiteboardToolbarConfig;
}

const HELIOS_AGENT_JOBS_GUIDE_SOURCE =
  'archipelago/helios/data/career-fixture.json#agentJobsGuide (116-role scrape 2026-07-21)';

/** Helios starter chips with deterministic tool prefetch (parity with Mason playbook). */
export const HELIOS_STARTER_PROMPTS_WITH_TOOLS: readonly CanvasStarterPrompt[] = [
  {
    ...HELIOS_STARTER_PROMPTS[0],
    prefetchTool: { name: 'open_positions', args: { location: 'South Florida' } },
  },
  {
    ...HELIOS_STARTER_PROMPTS[1],
    prefetchTool: { name: 'open_positions', args: { track: 'Solar Hourly' } },
  },
  {
    ...HELIOS_STARTER_PROMPTS[2],
    prefetchTool: { name: 'open_resources', args: { search: 'internship' } },
  },
  {
    ...HELIOS_STARTER_PROMPTS[3],
    prefetchTool: { name: 'open_positions', args: { location: 'Texas' } },
  },
];

/** Archipelago starter chips with deterministic tool prefetch. */
export const ARCHIPELAGO_STARTER_PROMPTS_WITH_TOOLS: readonly CanvasStarterPrompt[] = [
  {
    ...ARCHIPELAGO_STARTER_PROMPTS[0],
    prefetchTool: { name: 'open_positions' },
  },
  {
    ...ARCHIPELAGO_STARTER_PROMPTS[1],
    prefetchTool: { name: 'open_positions', args: { location: 'Jamaica' } },
  },
  {
    ...ARCHIPELAGO_STARTER_PROMPTS[2],
    prefetchTool: { name: 'open_growth_paths' },
  },
  {
    ...ARCHIPELAGO_STARTER_PROMPTS[3],
    prefetchTool: { name: 'open_resources', args: { search: 'SCU' } },
  },
];

const HELIOS_BUNDLE: CareerChatBundle = {
  tenant: 'helios',
  systemPrompt: HELIOS_CAREER_SYSTEM_PROMPT,
  enrichSystemPrompt: enrichCareerAgentSystemPrompt,
  suppressedCoreTools: CAREER_SUPPRESSED_CORE_TOOLS,
  starterPrompts: HELIOS_STARTER_PROMPTS_WITH_TOOLS,
  toolbarConfig: DEFAULT_CAREER_TOOLBAR_CONFIG,
};

const ARCHIPELAGO_BUNDLE: CareerChatBundle = {
  tenant: 'archipelago',
  systemPrompt: ARCHIPELAGO_CAREER_SYSTEM_PROMPT,
  enrichSystemPrompt: enrichCareerAgentSystemPrompt,
  suppressedCoreTools: CAREER_SUPPRESSED_CORE_TOOLS,
  starterPrompts: ARCHIPELAGO_STARTER_PROMPTS_WITH_TOOLS,
  toolbarConfig: DEFAULT_CAREER_TOOLBAR_CONFIG,
};

const GENERIC_BUNDLE: CareerChatBundle = {
  tenant: 'career-default',
  systemPrompt:
    'You are a friendly career assistant. Help candidates explore open roles, applications, growth paths, and learning resources.',
  enrichSystemPrompt: enrichCareerAgentSystemPrompt,
  suppressedCoreTools: CAREER_SUPPRESSED_CORE_TOOLS,
  starterPrompts: ARCHIPELAGO_STARTER_PROMPTS_WITH_TOOLS,
  toolbarConfig: DEFAULT_CAREER_TOOLBAR_CONFIG,
};

/** Minimum chars for a host-provided prompt to be treated as a full override. */
export const CAREER_PROMPT_OVERRIDE_MIN_CHARS = 500;

/** 
 * Resolve the career chat bundle for a tenant id.
 * Unknown tenants fall back to generic career defaults.
 */
export function resolveCareerChatBundle(tenant: string): CareerChatBundle {
  const normalized = tenant.trim().toLowerCase();
  if (normalized === 'helios') return HELIOS_BUNDLE;
  if (normalized === 'archipelago') return ARCHIPELAGO_BUNDLE;
  return { ...GENERIC_BUNDLE, tenant: normalized || 'career-default' };
}

/**
 * Pick effective system prompt: use host override when substantial, else canonical tenant prompt.
 */
export function resolveCareerSystemPrompt(
  tenant: string,
  hostPrompt: string | undefined,
): string {
  const bundle = resolveCareerChatBundle(tenant);
  const trimmed = hostPrompt?.trim() ?? '';
  if (trimmed.length >= CAREER_PROMPT_OVERRIDE_MIN_CHARS) {
    return trimmed;
  }
  return bundle.systemPrompt;
}

/** Reference string for docs — Helios fixture agentJobsGuide lives in career-fixture.json. */
export function heliosAgentJobsGuideSourceRef(): string {
  return HELIOS_AGENT_JOBS_GUIDE_SOURCE;
}

/** Default jobs routing appendix when fixture omits agentJobsGuide. */
export function defaultCareerAgentJobsGuide(): string {
  return DEFAULT_CAREER_AGENT_JOBS_GUIDE;
}
