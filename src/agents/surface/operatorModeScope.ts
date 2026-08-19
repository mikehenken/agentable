/**
 * Operator mode tool-scope presets (03 §13).
 *
 * Ask / Build / Draw map to enforced allow-lists checked at tool execution time.
 * Draw-mode tools still pass through existing engine draw capability gates.
 *
 * Tool name lists are local constants so Lit component tests avoid pulling the
 * full canvas / React dependency graph.
 */
import type { OperatorMode } from './types';

const DRILL_DOWN_TOOL_NAMES = [
  'describe_context',
  'read_panel_state',
  'get_activity',
  'list_agents',
] as const;

const DRAWING_TOOL_NAMES = [
  'draw_shapes',
  'annotate_panel',
  'clear_agent_drawings',
] as const;

const AUTHORING_TOOLKIT_TOOL_NAMES = [
  'insert_image',
  'connect_shapes',
  'group_shapes',
  'frame_shapes',
  'arrange',
] as const;

const WALKTHROUGH_TOOL_NAMES = ['present_walkthrough'] as const;

/** Read-only / Q&A tools permitted in Ask mode. */
export const OPERATOR_ASK_TOOL_NAMES = [
  'list_panels',
  'describe_panel',
  ...DRILL_DOWN_TOOL_NAMES,
  'read_canvas',
  'screenshot_canvas',
  'knowledge_search',
] as const;

/** Structural / build tools (non-draw canvas mutations). */
export const OPERATOR_BUILD_TOOL_NAMES = [
  'open_panel',
  'fill_panel',
  'compose_panel',
  'patch_panel',
  'run_panel_action',
  'open_chat',
  'dismiss_panel',
  ...AUTHORING_TOOLKIT_TOOL_NAMES,
  'export_document',
] as const;

/** Freehand draw + walkthrough tools (Draw mode only at operator scope). */
export const OPERATOR_DRAW_ONLY_TOOL_NAMES = [
  ...DRAWING_TOOL_NAMES,
  ...WALKTHROUGH_TOOL_NAMES,
] as const;

export type OperatorAskToolName = (typeof OPERATOR_ASK_TOOL_NAMES)[number];
export type OperatorBuildToolName = (typeof OPERATOR_BUILD_TOOL_NAMES)[number];
export type OperatorDrawOnlyToolName = (typeof OPERATOR_DRAW_ONLY_TOOL_NAMES)[number];

const ASK_TOOL_SET = new Set<string>(OPERATOR_ASK_TOOL_NAMES);
const BUILD_TOOL_SET = new Set<string>(OPERATOR_BUILD_TOOL_NAMES);
const DRAW_ONLY_TOOL_SET = new Set<string>(OPERATOR_DRAW_ONLY_TOOL_NAMES);

/** Union of tools explicitly classified for operator modes. */
export function getKnownOperatorToolNames(): readonly string[] {
  return [
    ...OPERATOR_ASK_TOOL_NAMES,
    ...OPERATOR_BUILD_TOOL_NAMES,
    ...OPERATOR_DRAW_ONLY_TOOL_NAMES,
  ];
}

/** Stable allow-list for registry / model tool offers (excludes unknown host tools). */
export function getAllowedToolsForOperatorMode(mode: OperatorMode): readonly string[] {
  if (mode === 'draw' || mode === 'auto') {
    return getKnownOperatorToolNames();
  }
  if (mode === 'build') {
    return [...OPERATOR_ASK_TOOL_NAMES, ...OPERATOR_BUILD_TOOL_NAMES];
  }
  return [...OPERATOR_ASK_TOOL_NAMES];
}

/** True when operator mode permits draw-only tools (Draw or Auto). */
export function isOperatorDrawCapableMode(mode: OperatorMode): boolean {
  return mode === 'draw' || mode === 'auto';
}

/**
 * Runtime operator-mode scope check.
 * Returns true when the tool may be invoked under the given mode.
 */
export function isToolAllowedForOperatorMode(toolName: string, mode: OperatorMode): boolean {
  if (mode === 'draw' || mode === 'auto') {
    return true;
  }

  if (ASK_TOOL_SET.has(toolName)) {
    return true;
  }

  if (mode === 'ask') {
    return false;
  }

  // Build mode: structural/build tools yes; draw-only tools no.
  if (DRAW_ONLY_TOOL_SET.has(toolName)) {
    return false;
  }

  if (BUILD_TOOL_SET.has(toolName)) {
    return true;
  }

  // Unknown host tools: deny-by-default in ask and build (explicit classification required).
  return false;
}
