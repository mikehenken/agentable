/**
 * Multi-agent default registry presets.
 *
 * Real deployments run several scoped agents on one page (voice concierge,
 * chat editor, background jobs). Hosts register these presets at session start
 * so identity, attribution, per-agent HITL queues, and role scopes apply from
 * the first tool call.
 */
import type { AgentRegistryRegisterInput } from './registry';
import type { AgentRuntime } from './runtime';

/** Broad-scope chat editor: panel tools, unrestricted panels/slots when allow-lists are empty. */
export const MULTI_AGENT_EDITOR_PRESET: AgentRegistryRegisterInput = {
  id: 'editor',
  kind: 'chat',
  label: 'Content Editor',
  transport: 'chat',
  allowedTools: [
    'list_panels',
    'open_panel',
    'fill_panel',
    'patch_panel',
    'run_panel_action',
    'describe_panel',
  ],
};

/** Voice concierge: read/open/fill only, scoped to content panels by default. */
export const MULTI_AGENT_CONCIERGE_PRESET: AgentRegistryRegisterInput = {
  id: 'concierge',
  kind: 'voice',
  label: 'Voice Concierge',
  transport: 'voice',
  allowedTools: ['list_panels', 'open_panel', 'fill_panel'],
  allowedPanels: ['site-content'],
};

/** Background job agent: compose-heavy flows under HITL, no destructive actions by default. */
export const MULTI_AGENT_JOB_PRESET: AgentRegistryRegisterInput = {
  id: 'job',
  kind: 'job',
  label: 'Background Job',
  transport: 'async',
  allowedTools: ['list_panels', 'open_panel', 'compose_panel', 'describe_panel'],
};

/** Standing two-agent demo preset (editor + concierge) used by gallery `09-multi-agent-page`. */
export const DEFAULT_MULTI_AGENT_PRESETS: readonly AgentRegistryRegisterInput[] = [
  MULTI_AGENT_EDITOR_PRESET,
  MULTI_AGENT_CONCIERGE_PRESET,
];

/**
 * Register default multi-agent identities on a runtime or canvas host agents facade.
 */
export function registerMultiAgentDefaults(
  agents: Pick<AgentRuntime, 'register'>,
  presets: readonly AgentRegistryRegisterInput[] = DEFAULT_MULTI_AGENT_PRESETS): readonly AgentRegistryRegisterInput[] {
  for (const preset of presets) {
    agents.register(preset);
  }
  return presets;
}
