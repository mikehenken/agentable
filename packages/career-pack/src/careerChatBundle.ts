/**
 * Unified career chat + toolbar bundle (Moss/Sandals parity).
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
import { MOSS_CAREER_SYSTEM_PROMPT } from './prompts/mossSystemPrompt';
import { SANDALS_CAREER_SYSTEM_PROMPT } from './prompts/sandalsSystemPrompt';
import {
  DEFAULT_CAREER_TOOLBAR_CONFIG,
} from './whiteboard/careerCanvasDefaults';
import { MOSS_STARTER_PROMPTS } from './tenants/moss';
import { SANDALS_STARTER_PROMPTS } from './tenants/sandals';

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
  /** Canonical tenant system prompt (Moss Mason / Sandy full voice). */
  systemPrompt: string;
  /** Append fixture agentJobsGuide + default routing appendix. */
  enrichSystemPrompt: (base: string, agentJobsGuide?: string) => string;
  suppressedCoreTools: readonly CareerSuppressedCoreTool[];
  starterPrompts: readonly CanvasStarterPrompt[];
  toolbarConfig: WhiteboardToolbarConfig;
}

const MOSS_AGENT_JOBS_GUIDE_SOURCE =
  'sandals/moss/data/career-fixture.json#agentJobsGuide (116-role scrape 2026-07-21)';

/** Moss starter chips with deterministic tool prefetch (parity with Mason playbook). */
export const MOSS_STARTER_PROMPTS_WITH_TOOLS: readonly CanvasStarterPrompt[] = [
  {
    ...MOSS_STARTER_PROMPTS[0],
    prefetchTool: { name: 'open_positions', args: { location: 'South Florida' } },
  },
  {
    ...MOSS_STARTER_PROMPTS[1],
    prefetchTool: { name: 'open_positions', args: { track: 'Solar Hourly' } },
  },
  {
    ...MOSS_STARTER_PROMPTS[2],
    prefetchTool: { name: 'open_resources', args: { search: 'internship' } },
  },
  {
    ...MOSS_STARTER_PROMPTS[3],
    prefetchTool: { name: 'open_positions', args: { location: 'Texas' } },
  },
];

/** Sandals starter chips with deterministic tool prefetch. */
export const SANDALS_STARTER_PROMPTS_WITH_TOOLS: readonly CanvasStarterPrompt[] = [
  {
    ...SANDALS_STARTER_PROMPTS[0],
    prefetchTool: { name: 'open_positions' },
  },
  {
    ...SANDALS_STARTER_PROMPTS[1],
    prefetchTool: { name: 'open_positions', args: { location: 'Jamaica' } },
  },
  {
    ...SANDALS_STARTER_PROMPTS[2],
    prefetchTool: { name: 'open_growth_paths' },
  },
  {
    ...SANDALS_STARTER_PROMPTS[3],
    prefetchTool: { name: 'open_resources', args: { search: 'SCU' } },
  },
];

const MOSS_BUNDLE: CareerChatBundle = {
  tenant: 'moss',
  systemPrompt: MOSS_CAREER_SYSTEM_PROMPT,
  enrichSystemPrompt: enrichCareerAgentSystemPrompt,
  suppressedCoreTools: CAREER_SUPPRESSED_CORE_TOOLS,
  starterPrompts: MOSS_STARTER_PROMPTS_WITH_TOOLS,
  toolbarConfig: DEFAULT_CAREER_TOOLBAR_CONFIG,
};

const SANDALS_BUNDLE: CareerChatBundle = {
  tenant: 'sandals',
  systemPrompt: SANDALS_CAREER_SYSTEM_PROMPT,
  enrichSystemPrompt: enrichCareerAgentSystemPrompt,
  suppressedCoreTools: CAREER_SUPPRESSED_CORE_TOOLS,
  starterPrompts: SANDALS_STARTER_PROMPTS_WITH_TOOLS,
  toolbarConfig: DEFAULT_CAREER_TOOLBAR_CONFIG,
};

const GENERIC_BUNDLE: CareerChatBundle = {
  tenant: 'career-default',
  systemPrompt:
    'You are a friendly career assistant. Help candidates explore open roles, applications, growth paths, and learning resources.',
  enrichSystemPrompt: enrichCareerAgentSystemPrompt,
  suppressedCoreTools: CAREER_SUPPRESSED_CORE_TOOLS,
  starterPrompts: SANDALS_STARTER_PROMPTS_WITH_TOOLS,
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
  if (normalized === 'moss') return MOSS_BUNDLE;
  if (normalized === 'sandals') return SANDALS_BUNDLE;
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

/** Reference string for docs — Moss fixture agentJobsGuide lives in career-fixture.json. */
export function mossAgentJobsGuideSourceRef(): string {
  return MOSS_AGENT_JOBS_GUIDE_SOURCE;
}

/** Default jobs routing appendix when fixture omits agentJobsGuide. */
export function defaultCareerAgentJobsGuide(): string {
  return DEFAULT_CAREER_AGENT_JOBS_GUIDE;
}
