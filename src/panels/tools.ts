/**
 * Tool contract types, host-action registration, and the panel tools
 * (six acting + read-only describe_panel; D17, D18, D43). Hosts contribute domain tools through
 * `createCanvasHost({ hostActions })`; panel tools register automatically
 * from the host's panel registry for the host's lifetime.
 *
 * Collision policy: tools are keyed by declaration name. A host action
 * sharing a built-in tool's name replaces that tool for as long as the
 * registration lives, so hosts can specialize framework behavior without
 * forking it. Across registrations the most recent wins. Disposing the
 * host removes its actions and any shadowed built-in reappears.
 */
import type { ComposeGateEvaluation } from './composeGate';
import { COMPOSE_GATE_CLOSED_CODE } from './composeGate';
import { isFrozenRepairErrorCode } from './spec/repairVocabulary';
import type { PanelRegistry } from './registry';
import { deriveRegistryAgentMetas } from './registryMetadata';
import {
  createPanelToolRuntime,
  type PanelToolRuntime,
  type PanelToolRuntimeOptions,
} from './panelToolRuntime';
import { parsePanelOpenResolveInput, resolveOpenPanelPlacement } from '../engine/openPanelResolver';

/**
 * JSON-schema-style declaration in the shape Gemini function calling
 * expects (a subset of OpenAPI 3.0). `parameters.type` stays `'object'`;
 * Gemini Live rejects top-level schemas of any other type.
 */
export type ToolCostClass = 'cheap' | 'expensive';

export interface ToolDeclaration {
  name: string;
  description: string;
  /** Orchestrator budget hint mirroring MCP manifest costClass (D43). */
  costClass?: ToolCostClass;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameterSchema>;
    required?: string[];
  };
}

export interface ToolParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: readonly string[];
  items?: ToolParameterSchema;
}

export type ToolResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string };

export type ToolHandler = (args: Record<string, unknown>) => ToolResult | Promise<ToolResult>;

export interface ToolDefinition {
  declaration: ToolDeclaration;
  handler: ToolHandler;
}

/** Stable names for the six acting panel tools (D18). */
export const PANEL_ACTING_TOOL_NAMES = [
  'list_panels',
  'open_panel',
  'fill_panel',
  'compose_panel',
  'patch_panel',
  'run_panel_action',
] as const;

/** Read-only introspection tool (D43); not part of the acting mutation set. */
export const PANEL_INTROSPECTION_TOOL_NAMES = ['describe_panel'] as const;

/** All panel tools registered for agent function calling. */
export const PANEL_TOOL_NAMES = [
  ...PANEL_ACTING_TOOL_NAMES,
  ...PANEL_INTROSPECTION_TOOL_NAMES,
] as const;

export type PanelActingToolName = (typeof PANEL_ACTING_TOOL_NAMES)[number];
export type PanelIntrospectionToolName = (typeof PANEL_INTROSPECTION_TOOL_NAMES)[number];
export type PanelToolName = (typeof PANEL_TOOL_NAMES)[number];

/** Static costClass assignments for panel tool declarations (D43). */
export const PANEL_TOOL_COST_CLASS: Record<PanelToolName, ToolCostClass> = {
  list_panels: 'cheap',
  describe_panel: 'cheap',
  open_panel: 'cheap',
  fill_panel: 'cheap',
  patch_panel: 'cheap',
  compose_panel: 'expensive',
  /** Typical mutate actions; job-class actions escalate at capability layer (03 section 2). */
  run_panel_action: 'cheap',
};

/** Vite may load `panels/tools` twice (alias + relative); share one registry. */
const HOST_ACTION_REGISTRATIONS_KEY = '__agentable_host_action_registrations__';

function hostActionRegistrations(): (readonly ToolDefinition[])[] {
  const globalRecord = globalThis as typeof globalThis & {
    [HOST_ACTION_REGISTRATIONS_KEY]?: (readonly ToolDefinition[])[];
  };
  if (globalRecord[HOST_ACTION_REGISTRATIONS_KEY] === undefined) {
    globalRecord[HOST_ACTION_REGISTRATIONS_KEY] = [];
  }
  return globalRecord[HOST_ACTION_REGISTRATIONS_KEY];
}

/**
 * Register host-supplied tools. Returns the matching unregister function;
 * `createCanvasHost` calls it from `dispose`, so a host's actions never
 * outlive the host that contributed them.
 */
export function registerHostActions(actions: readonly ToolDefinition[]): () => void {
  const registrations = hostActionRegistrations();
  const registration = Object.freeze([...actions]);
  registrations.push(registration);
  return () => {
    const index = registrations.indexOf(registration);
    if (index >= 0) {
      registrations.splice(index, 1);
    }
  };
}

/**
 * Live host actions in registration order, later registrations last so a
 * name-keyed merge lets the most recent registration win.
 */
export function getHostActions(): readonly ToolDefinition[] {
  return hostActionRegistrations().flat();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function panelIdsForRegistry(registry: PanelRegistry): readonly string[] {
  return registry.ids();
}

function buildRegistryGrounding(registry: PanelRegistry): string {
  const metas = deriveRegistryAgentMetas(registry);
  if (metas.length === 0) {
    return 'No panels are registered on this host.';
  }
  return metas
    .map((meta) => {
      const fields =
        meta.fields.length > 0
          ? meta.fields.map((field) => field.path).join(', ')
          : 'none';
      const actions =
        meta.actions.length > 0
          ? meta.actions.map((action) => action.id).join(', ')
          : 'none';
      return `${meta.id} (${meta.title}): ${meta.agentDescription ?? meta.title}. Fields: ${fields}. Actions: ${actions}.`;
    })
    .join(' ');
}

function withCostClass(name: PanelToolName, declaration: Omit<ToolDeclaration, 'costClass'>): ToolDeclaration {
  return { ...declaration, costClass: PANEL_TOOL_COST_CLASS[name] };
}

function declarationForListPanels(registry: PanelRegistry): ToolDeclaration {
  return withCostClass('list_panels', {
    name: 'list_panels',
    description:
      `List registered panels, their declared fields and actions, and any open instances. Registry: ${buildRegistryGrounding(registry)}`,
    parameters: { type: 'object', properties: {} },
  });
}

function declarationForOpenPanel(registry: PanelRegistry): ToolDeclaration {
  const ids = panelIdsForRegistry(registry);
  return withCostClass('open_panel', {
    name: 'open_panel',
    description:
      'Open a registered panel on the canvas. Scope defaults to the active context frame when omitted.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Registered panel id to open.',
          ...(ids.length > 0 ? { enum: ids } : {}),
        },
        scope: {
          type: 'object',
          description: 'Optional scope binding (contextId, entityId).',
        },
        slot: {
          type: 'string',
          description: 'Named page-session slot (`data-agentable-slot`) to mount into.',
        },
        target: {
          type: 'object',
          description:
            'Unified placement target: { kind: "slot"|"region"|"canvas", ... }. Prefer over legacy flat fields.',
        },
        region: {
          type: 'string',
          description: 'App-shell region (main, sidebar, left, right, bottom, drawer). DOM engine.',
        },
        tabGroup: {
          type: 'number',
          description: 'Tab group within the region (default 0).',
        },
        order: {
          type: 'number',
          description: 'Tab order within the tab group.',
        },
        position: {
          type: 'object',
          description: 'Canvas coordinates { x, y } for spatial engines (tldraw).',
        },
        size: {
          type: 'object',
          description: 'Panel size { w, h } when targeting canvas placement.',
        },
      },
      required: ['id'],
    },
  });
}

function declarationForFillPanel(registry: PanelRegistry): ToolDeclaration {
  const ids = panelIdsForRegistry(registry);
  return withCostClass('fill_panel', {
    name: 'fill_panel',
    description:
      'Fill declared fields on an open panel with a plain object patch. Never saves. Skips fields the user has already edited.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Registered panel id whose open instance should receive the patch.',
          ...(ids.length > 0 ? { enum: ids } : {}),
        },
        patch: {
          type: 'object',
          description: 'Field path to value map. Paths must be declared on the panel.',
        },
      },
      required: ['id', 'patch'],
    },
  });
}

function declarationForComposePanel(): ToolDeclaration {
  return withCostClass('compose_panel', {
    name: 'compose_panel',
    description:
      'Compose a new panel from a full IR envelope. Origin is forced to agent. Validates before mount.',
    parameters: {
      type: 'object',
      properties: {
        spec: {
          type: 'object',
          description: 'Full panel IR envelope (v, root, nodes, optional sources/actions).',
        },
        title: {
          type: 'string',
          description: 'Optional chrome title for the composed instance.',
        },
        pin: {
          type: 'boolean',
          description: 'When true, persist the composed instance immediately.',
        },
      },
      required: ['spec'],
    },
  });
}

function declarationForPatchPanel(): ToolDeclaration {
  return withCostClass('patch_panel', {
    name: 'patch_panel',
    description:
      'Apply RFC 6902 JSON Patch operations to a composed panel instance for progressive hydration.',
    parameters: {
      type: 'object',
      properties: {
        panelId: {
          type: 'string',
          description: 'Composed panel instance id returned from compose_panel.',
        },
        ops: {
          type: 'array',
          description: 'RFC 6902 operation objects (op, path, optional value).',
          items: { type: 'object' },
        },
      },
      required: ['panelId', 'ops'],
    },
  });
}

function declarationForDescribePanel(registry: PanelRegistry): ToolDeclaration {
  const panelIds = panelIdsForRegistry(registry);
  return withCostClass('describe_panel', {
    name: 'describe_panel',
    description:
      'Read-only introspection: full props schema, sources, actions, scope metadata, and curated example specs for a registered panel or catalog entry. No side effects.',
    parameters: {
      type: 'object',
      properties: {
        panelId: {
          type: 'string',
          description: 'Registered panel id to describe.',
          ...(panelIds.length > 0 ? { enum: panelIds } : {}),
        },
        catalogEntry: {
          type: 'string',
          description:
            'Catalog component name (for example header, field-form, list). Mutually exclusive with panelId.',
        },
      },
    },
  });
}

function declarationForRunPanelAction(registry: PanelRegistry): ToolDeclaration {
  const ids = panelIdsForRegistry(registry);
  return withCostClass('run_panel_action', {
    name: 'run_panel_action',
    description:
      'Run a declared panel action. The only mutation path; mutating actions require user approval.',
    parameters: {
      type: 'object',
      properties: {
        panelId: {
          type: 'string',
          description: 'Open panel instance id.',
          ...(ids.length > 0 ? { enum: ids } : {}),
        },
        actionId: {
          type: 'string',
          description: 'Action id declared on the panel definition.',
        },
        payload: {
          type: 'object',
          description: 'Optional action payload.',
        },
      },
      required: ['panelId', 'actionId'],
    },
  });
}

function composeGateFailureResult(gate: ComposeGateEvaluation): ToolResult {
  const code = gate.code ?? COMPOSE_GATE_CLOSED_CODE;
  if (!isFrozenRepairErrorCode(code)) {
    throw new Error(`compose gate returned non-frozen error code: ${code}`);
  }
  return {
    ok: true,
    result: {
      ok: false,
      agentRepairEligible: false,
      errors: [
        {
          code,
          message: gate.reason ?? `compose_panel is gated (${gate.id})`,
        },
      ],
    },
  };
}

function createPanelToolHandlers(
  runtime: PanelToolRuntime,
  composeGate?: ComposeGateEvaluation,
): Record<PanelToolName, ToolHandler> {
  return {
    list_panels: () => ({ ok: true, result: runtime.listPanels() }),

    open_panel: async (args) => {
      const id = readString(args.id);
      if (id === undefined) {
        return { ok: false, error: 'id must be a non-empty string' };
      }
      const resolveInput = parsePanelOpenResolveInput(args);
      const resolved = resolveOpenPanelPlacement(id, resolveInput);
      if (!resolved.ok) {
        return { ok: false, error: resolved.message };
      }
      const result = await runtime.openPanel(id, resolveInput);
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      return { ok: true, result };
    },

    fill_panel: async (args) => {
      const id = readString(args.id);
      if (id === undefined) {
        return { ok: false, error: 'id must be a non-empty string' };
      }
      if (!isRecord(args.patch)) {
        return { ok: false, error: 'patch must be a plain object' };
      }
      const result = await runtime.fillPanel(id, args.patch);
      if ('error' in result && result.ok === false) {
        return { ok: false, error: result.error };
      }
      return { ok: true, result };
    },

    compose_panel: async (args) => {
      if (composeGate !== undefined && !composeGate.open) {
        return composeGateFailureResult(composeGate);
      }
      if (!isRecord(args.spec)) {
        return { ok: false, error: 'spec must be a plain object' };
      }
      const title = readString(args.title);
      const pin = typeof args.pin === 'boolean' ? args.pin : undefined;
      const result = await runtime.composePanel(args.spec, { title, pin });
      if (!result.ok) {
        return { ok: true, result };
      }
      return { ok: true, result };
    },

    patch_panel: async (args) => {
      const panelId = readString(args.panelId);
      if (panelId === undefined) {
        return { ok: false, error: 'panelId must be a non-empty string' };
      }
      if (!Array.isArray(args.ops)) {
        return { ok: false, error: 'ops must be an array' };
      }
      const result = await runtime.patchPanel(panelId, args.ops);
      if ('error' in result && result.ok === false) {
        return { ok: false, error: result.error };
      }
      return { ok: true, result };
    },

    run_panel_action: async (args) => {
      const panelId = readString(args.panelId);
      if (panelId === undefined) {
        return { ok: false, error: 'panelId must be a non-empty string' };
      }
      const actionId = readString(args.actionId);
      if (actionId === undefined) {
        return { ok: false, error: 'actionId must be a non-empty string' };
      }
      const payload = isRecord(args.payload) ? args.payload : undefined;
      const result = await runtime.runPanelAction(panelId, actionId, payload);
      return { ok: true, result };
    },

    describe_panel: (args) => {
      const panelId = readString(args.panelId);
      const catalogEntry = readString(args.catalogEntry);
      const result = runtime.describePanel({ panelId, catalogEntry });
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      return { ok: true, result: result.result };
    },
  };
}

export interface PanelToolsOptions {
  composeGate?: ComposeGateEvaluation;
}

/**
 * Build panel tools from a live registry and runtime (six acting tools plus
 * read-only describe_panel). Declarations carry registry-derived ids and
 * grounding so models cannot drift from registered panels.
 */
export function createPanelToolsFromRegistry(
  registry: PanelRegistry,
  runtime: PanelToolRuntime,
  options: PanelToolsOptions = {},
): readonly ToolDefinition[] {
  const composeGate = options.composeGate;
  const composeOpen = composeGate === undefined || composeGate.open;
  const handlers = createPanelToolHandlers(runtime, composeGate);
  const declarations: Record<PanelToolName, ToolDeclaration> = {
    list_panels: declarationForListPanels(registry),
    open_panel: declarationForOpenPanel(registry),
    fill_panel: declarationForFillPanel(registry),
    compose_panel: declarationForComposePanel(),
    patch_panel: declarationForPatchPanel(),
    run_panel_action: declarationForRunPanelAction(registry),
    describe_panel: declarationForDescribePanel(registry),
  };

  const toolNames = composeOpen
    ? PANEL_TOOL_NAMES
    : PANEL_TOOL_NAMES.filter((name) => name !== 'compose_panel');

  return toolNames.map((name) => ({
    declaration: declarations[name],
    handler: handlers[name],
  }));
}

/**
 * Convenience for hosts and tests: create a runtime-backed tool bundle and
 * register it through the host-action store.
 */
export function registerPanelTools(
  registry: PanelRegistry,
  runtime: PanelToolRuntime,
  options: PanelToolsOptions = {},
): () => void {
  return registerHostActions(createPanelToolsFromRegistry(registry, runtime, options));
}

export { createPanelToolRuntime, type PanelToolRuntime, type PanelToolRuntimeOptions };
export type { ComposeGateConfig, ComposeGateCriteria, ComposeGateEvaluation } from './composeGate';
export {
  COMPOSE_GATE_CLOSED_CODE,
  POST_SEO_COMPOSE_GATE_CRITERIA,
  POST_SEO_COMPOSE_GATE_ID,
  evaluateComposeGate,
} from './composeGate';
