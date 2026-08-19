/**
 * First-class whiteboard toolbar configuration.
 *
 * Hosts pass a partial `WhiteboardToolbarConfig` via `WhiteboardShell` props,
 * `<agentable-whiteboard toolbar-config='…'>`, or career config JSON
 * (`toolbar` `toolbarConfig`). Legacy booleans (`enableVoiceTool`,
 * `enableLayersPanel`, `enableContextActionsTool`) map into the resolved shape.
 */
import { CONTEXT_ACTIONS_TOOL_ID } from '../tools/contextActionsEvents';
import { LAYERS_TOOL_ID } from '../tools/layersEvents';
import { VOICE_TOOL_ID } from '../tools/voiceEvents';
import {
  AUTO_ARRANGE_TOOL_ID,
  RESET_CANVAS_TOOL_ID,
} from '../tools/layoutActionEvents';

/** Built-in tool chrome action ids recognized by the whiteboard toolbar. */
export const BUILTIN_WHITEBOARD_TOOLBAR_TOOL_IDS = [
  'select',
  'draw',
  'hand',
  LAYERS_TOOL_ID,
  VOICE_TOOL_ID,
  AUTO_ARRANGE_TOOL_ID,
  RESET_CANVAS_TOOL_ID,
  CONTEXT_ACTIONS_TOOL_ID,
] as const;

export type BuiltinWhiteboardToolbarToolId =
  (typeof BUILTIN_WHITEBOARD_TOOLBAR_TOOL_IDS)[number];

/** Tool id whitelist — builtins plus host-defined custom action ids. */
export type WhiteboardToolbarToolId = BuiltinWhiteboardToolbarToolId | (string & {});

/** Where layout chrome actions (auto-arrange reset) appear. */
export type WhiteboardLayoutActionPlacement =
  | 'toolbar'
  | 'topbar'
  | 'both'
  | 'none';

export interface WhiteboardToolbarCustomAction {
  /** Unique id — also used as the tldraw tool id when placement includes toolbar. */
  id: string;
  label?: string;
  /** tldraw icon name when rendered as a toolbar tool. */
  icon?: string;
  /** Where this custom action appears. Default: toolbar. */
  placement?: Exclude<WhiteboardLayoutActionPlacement, 'none'>;
}

/**
 * Host-facing toolbar config. `tools` is an ordered whitelist; when omitted,
 * {@link DEFAULT_WHITEBOARD_TOOLBAR_TOOLS} applies. `exclude` removes ids after
 * the whitelist is applied.
 */
export interface WhiteboardToolbarConfig {
  /** Ordered whitelist of tools layout actions. */
  tools?: WhiteboardToolbarToolId[];
  /**
   * When false, removes `draw` from the toolbar and disables agent canvas drawing
   * tools (`engine.capabilities.draw`). Default: true.
   */
  drawingEnabled?: boolean;
  /** Ids to strip after whitelist resolution. */
  exclude?: WhiteboardToolbarToolId[];
  /**
   * Where auto-arrange reset appear when included in `tools`.
   * Default: `both` (bottom toolbar + TopBar chrome).
   */
  layoutActionPlacement?: WhiteboardLayoutActionPlacement;
  /** Additional host-defined toolbar chrome actions. */
  customActions?: WhiteboardToolbarCustomAction[];
}

/** Legacy boolean flags still accepted by WhiteboardShell UI factories. */
export interface WhiteboardToolbarLegacyFlags {
  enableVoiceTool?: boolean;
  enableLayersPanel?: boolean;
  enableContextActionsTool?: boolean;
}

export interface ResolveWhiteboardToolbarConfigInput extends WhiteboardToolbarLegacyFlags {
  toolbarConfig?: WhiteboardToolbarConfig | null;
}

/**
 * Fully resolved toolbar chrome visibility used by Shell, Toolbar, TopBar,
 * and tldraw overrides.
 */
export interface ResolvedWhiteboardToolbarConfig {
  /** When false, draw tool hidden and agent draw capability off. */
  drawingEnabled: boolean;
  /** Ordered bottom-toolbar tool ids (tldraw ToolbarItem tools). */
  toolbarTools: string[];
  /** Ordered drawing panel tools that need StateNode registration. */
  registeredToolIds: string[];
  enableLayersPanel: boolean;
  enableVoiceTool: boolean;
  enableContextActionsTool: boolean;
  showAutoArrangeToolbar: boolean;
  showResetToolbar: boolean;
  showAutoArrangeTopBar: boolean;
  showResetTopBar: boolean;
  layoutActionPlacement: WhiteboardLayoutActionPlacement;
  customActions: WhiteboardToolbarCustomAction[];
  /** Custom actions that should also render in TopBar. */
  topBarCustomActions: WhiteboardToolbarCustomAction[];
}

/** Default ordered tool list for infinite-panels whiteboard hosts. */
export const DEFAULT_WHITEBOARD_TOOLBAR_TOOLS: readonly WhiteboardToolbarToolId[] = [
  'select',
  'draw',
  'hand',
  LAYERS_TOOL_ID,
  VOICE_TOOL_ID,
  AUTO_ARRANGE_TOOL_ID,
  RESET_CANVAS_TOOL_ID,
] as const;

/**
 * @deprecated Use {@link DEFAULT_WHITEBOARD_TOOLBAR_TOOLS}. Career hosts supply
 * tool order through the `toolbar` `toolbarConfig` embed config key.
 */
export const CAREER_WHITEBOARD_TOOLBAR_DEFAULTS = DEFAULT_WHITEBOARD_TOOLBAR_TOOLS;

const LAYOUT_ACTION_IDS = new Set<string>([AUTO_ARRANGE_TOOL_ID, RESET_CANVAS_TOOL_ID]);

const STATE_NODE_TOOL_IDS = new Set<string>([
  LAYERS_TOOL_ID,
  VOICE_TOOL_ID,
  CONTEXT_ACTIONS_TOOL_ID,
  AUTO_ARRANGE_TOOL_ID,
  RESET_CANVAS_TOOL_ID,
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item.trim().length > 0) {
      out.push(item.trim());
    }
  }
  return out;
}

function parseLayoutPlacement(value: unknown): WhiteboardLayoutActionPlacement | undefined {
  if (
    value === 'toolbar' ||
    value === 'topbar' ||
    value === 'both' ||
    value === 'none'
  ) {
    return value;
  }
  return undefined;
}

function parseCustomActions(value: unknown): WhiteboardToolbarCustomAction[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const actions: WhiteboardToolbarCustomAction[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    if (!id) continue;
    const action: WhiteboardToolbarCustomAction = { id };
    if (typeof item.label === 'string' && item.label.trim()) {
      action.label = item.label.trim();
    }
    if (typeof item.icon === 'string' && item.icon.trim()) {
      action.icon = item.icon.trim();
    }
    const placement = parseLayoutPlacement(item.placement);
    if (placement && placement !== 'none') {
      action.placement = placement;
    }
    actions.push(action);
  }
  return actions;
}

/**
 * Parse a JSON object attribute string into `WhiteboardToolbarConfig`.
 * Invalid payloads return `null` (caller falls back to defaults).
 */
export function parseWhiteboardToolbarConfig(raw: unknown): WhiteboardToolbarConfig | null {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      value = JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  }
  if (!isRecord(value)) return null;

  const tools = asStringArray(value.tools);
  const exclude = asStringArray(value.exclude);
  const layoutActionPlacement = parseLayoutPlacement(value.layoutActionPlacement);
  const customActions = parseCustomActions(value.customActions);

  const config: WhiteboardToolbarConfig = {};
  if (tools) config.tools = tools;
  if (exclude) config.exclude = exclude;
  if (layoutActionPlacement) config.layoutActionPlacement = layoutActionPlacement;
  if (customActions) config.customActions = customActions;
  return config;
}

function applyExclude(ids: string[], exclude: readonly string[] | undefined): string[] {
  if (!exclude || exclude.length === 0) return ids;
  const blocked = new Set(exclude);
  return ids.filter((id) => !blocked.has(id));
}

function applyLegacyGates(
  ids: string[],
  flags: WhiteboardToolbarLegacyFlags): string[] {
  return ids.filter((id) => {
    if (id === LAYERS_TOOL_ID && flags.enableLayersPanel === false) return false;
    if (id === VOICE_TOOL_ID && flags.enableVoiceTool === false) return false;
    if (id === CONTEXT_ACTIONS_TOOL_ID && flags.enableContextActionsTool !== true) {
      return false;
    }
    return true;
  });
}

function ensureSiteActionsWhenEnabled(
  ids: string[],
  enableContextActionsTool: boolean | undefined): string[] {
  if (enableContextActionsTool !== true) return ids;
  if (ids.includes(CONTEXT_ACTIONS_TOOL_ID)) return ids;
  return [...ids, CONTEXT_ACTIONS_TOOL_ID];
}

function placementIncludesToolbar(placement: WhiteboardLayoutActionPlacement): boolean {
  return placement === 'toolbar' || placement === 'both';
}

function placementIncludesTopBar(placement: WhiteboardLayoutActionPlacement): boolean {
  return placement === 'topbar' || placement === 'both';
}

/**
 * Resolve host config + legacy flags into a concrete toolbar chrome plan.
 */
export function resolveWhiteboardToolbarConfig(
  input: ResolveWhiteboardToolbarConfigInput = {}): ResolvedWhiteboardToolbarConfig {
  const config = input.toolbarConfig ?? {};
  const layoutActionPlacement = config.layoutActionPlacement ?? 'both';
  const drawingEnabled = config.drawingEnabled !== false;

  let ordered = [...(config.tools ?? DEFAULT_WHITEBOARD_TOOLBAR_TOOLS)];
  if (!drawingEnabled) {
    ordered = ordered.filter((id) => id !== 'draw');
  }
  ordered = ensureSiteActionsWhenEnabled(ordered, input.enableContextActionsTool);
  ordered = applyLegacyGates(ordered, input);
  const exclude = [...(config.exclude ?? [])];
  if (!drawingEnabled && !exclude.includes('draw')) {
    exclude.push('draw');
  }
  ordered = applyExclude(ordered, exclude);

   // Deduplicate while preserving first-seen order.
  const seen = new Set<string>();
  ordered = ordered.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const hasAutoArrange = ordered.includes(AUTO_ARRANGE_TOOL_ID);
  const hasReset = ordered.includes(RESET_CANVAS_TOOL_ID);

  const showAutoArrangeToolbar =
    hasAutoArrange && placementIncludesToolbar(layoutActionPlacement);
  const showResetToolbar = hasReset && placementIncludesToolbar(layoutActionPlacement);
  const showAutoArrangeTopBar =
    hasAutoArrange && placementIncludesTopBar(layoutActionPlacement);
  const showResetTopBar = hasReset && placementIncludesTopBar(layoutActionPlacement);

   // Bottom toolbar: drawing tools + layout actions only when placement includes toolbar.
  const toolbarTools = ordered.filter((id) => {
    if (LAYOUT_ACTION_IDS.has(id)) {
      if (id === AUTO_ARRANGE_TOOL_ID) return showAutoArrangeToolbar;
      if (id === RESET_CANVAS_TOOL_ID) return showResetToolbar;
      return false;
    }
    return true;
  });

  const customActions = config.customActions ?? [];
  for (const action of customActions) {
    const placement = action.placement ?? 'toolbar';
    if (placementIncludesToolbar(placement) && !toolbarTools.includes(action.id)) {
      toolbarTools.push(action.id);
    }
  }

  const registeredToolIds = toolbarTools.filter((id) => STATE_NODE_TOOL_IDS.has(id));
   // Custom toolbar actions also need registration when we add generic handlers later;
   // for now only builtins use StateNodes — custom ids are override-only.

  const topBarCustomActions = customActions.filter((action) => {
    const placement = action.placement ?? 'toolbar';
    return placementIncludesTopBar(placement);
  });

  return {
    drawingEnabled,
    toolbarTools,
    registeredToolIds,
    enableLayersPanel: toolbarTools.includes(LAYERS_TOOL_ID),
    enableVoiceTool: toolbarTools.includes(VOICE_TOOL_ID),
    enableContextActionsTool: toolbarTools.includes(CONTEXT_ACTIONS_TOOL_ID),
    showAutoArrangeToolbar,
    showResetToolbar,
    showAutoArrangeTopBar,
    showResetTopBar,
    layoutActionPlacement,
    customActions,
    topBarCustomActions,
  };
}

/** Ids that minimal overrides should keep in the tldraw tools map. */
export function allowedTldrawToolIds(
  resolved: ResolvedWhiteboardToolbarConfig): ReadonlySet<string> {
  return new Set(resolved.toolbarTools);
}
