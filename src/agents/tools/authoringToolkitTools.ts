/**
 * Open agent canvas authoring toolkit tools.
 * Capability-gated on engine.capabilities.draw; every mark is provenance-stamped.
 */
import type { ToolDeclaration, ToolDefinition, ToolHandler } from '../../panels/tools';
import {
  rejectUntrustedImageFields,
  resolveAuthoringImageAsset,
} from '../authoringAssetBridge';
import { getAgentToolContext } from '../agentContext';
import {
  drawCapabilityRefusal,
  drawToolSuccess,
  isDrawCapabilityAvailable,
} from '../engineBridge';
import type {
  AgentArrangeRequest,
  AgentConnectShapesRequest,
  AgentFrameShapesRequest,
  AgentGroupShapesRequest,
  AgentInsertImageRequest,
  AuthoringArrangeLayout,
  AgentConnectorKind,
} from '../../engine/authoringToolkitTypes';
import {
  arrangeAgentShapes,
  connectAgentShapes,
  frameAgentShapes,
  groupAgentShapes,
  insertAgentImage,
} from '../../engines/tldraw/agentDrawing/authoringToolkitApi';
import { readSketchText } from './drawingTools';

export const AUTHORING_TOOLKIT_TOOL_NAMES = [
  'insert_image',
  'connect_shapes',
  'group_shapes',
  'frame_shapes',
  'arrange',
] as const;

export type AuthoringToolkitToolName = (typeof AUTHORING_TOOLKIT_TOOL_NAMES)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value: undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value: undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map((entry) => (typeof entry === 'string' && entry.length > 0 ? entry: undefined)).filter((entry): entry is string => entry !== undefined);
  return items.length === value.length ? items: undefined;
}

function readConnectorKind(value: unknown): AgentConnectorKind | undefined {
  if (value === 'dependency' || value === 'flow' || value === 'annotation') {
    return value;
  }
  return undefined;
}

function readArrangeLayout(value: unknown): AuthoringArrangeLayout | undefined {
  if (value === 'flow' || value === 'timeline' || value === 'radial' || value === 'nested') {
    return value;
  }
  return undefined;
}

function readInsertImageGeometry(value: unknown): AgentInsertImageRequest['geometry'] | undefined {
  if (!isRecord(value)) return undefined;
  const x = readFiniteNumber(value.x);
  const y = readFiniteNumber(value.y);
  const w = readFiniteNumber(value.w);
  const h = readFiniteNumber(value.h);
  if (x === undefined || y === undefined || w === undefined || h === undefined) {
    return undefined;
  }
  return { x, y, w, h };
}

function readInsertImageRequest(args: Record<string, unknown>): AgentInsertImageRequest | undefined {
  const geometry = readInsertImageGeometry(args.geometry);
  if (geometry === undefined) return undefined;
  const assetId = readString(args.assetId);
  const generatePrompt = readString(args.generatePrompt);
  const alt = readString(args.alt);
  const request: AgentInsertImageRequest = { geometry };
  if (assetId !== undefined) request.assetId = assetId;
  if (generatePrompt !== undefined) request.generatePrompt = generatePrompt;
  if (alt !== undefined) request.alt = alt;
  return request;
}

function withDrawGate(handler: ToolHandler): ToolHandler {
  return (args) => {
    if (!isDrawCapabilityAvailable) {
      return drawCapabilityRefusal;
    }
    return handler(args);
  };
}

function resolveActingAgentId(args: Record<string, unknown>): string {
  const ctx = getAgentToolContext;
  if (ctx === null) {
    throw new Error('agent tool context is required for this operation');
  }
  const override = readString(args.agentId);
  return override ?? ctx().agentId;
}

const declarationInsertImage: ToolDeclaration = {
  name: 'insert_image',
  description:
    'Place an uploaded asset by id or an image from the host generation bridge. Never accepts markup or model-supplied URLs.',
  costClass: 'cheap',
  parameters: {
    type: 'object',
    properties: {
      assetId: { type: 'string', description: 'Uploaded asset reference id.' },
      generatePrompt: {
        type: 'string',
        description: 'Prompt for the host image generation bridge (not a URL).',
      },
      geometry: {
        type: 'object',
        description: 'Placement rect in page coordinates.',
      },
      alt: { type: 'string', description: 'Accessible alt text for the image.' },
    },
    required: ['geometry'],
  },
};

const declarationConnectShapes: ToolDeclaration = {
  name: 'connect_shapes',
  description:
    'Create a typed connector arrow between two existing shape refs (dependency, flow, or annotation).',
  costClass: 'cheap',
  parameters: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Source shape id.' },
      to: { type: 'string', description: 'Target shape id.' },
      kind: {
        type: 'string',
        enum: ['dependency', 'flow', 'annotation'],
        description: 'Connector semantics.',
      },
      label: { type: 'string', description: 'Optional connector label.' },
    },
    required: ['from', 'to', 'kind'],
  },
};

const declarationGroupShapes: ToolDeclaration = {
  name: 'group_shapes',
  description: 'Group an agent-owned selection into a tldraw group container.',
  costClass: 'cheap',
  parameters: {
    type: 'object',
    properties: {
      shapeIds: {
        type: 'array',
        description: 'Shape ids to group together.',
        items: { type: 'string' },
      },
    },
    required: ['shapeIds'],
  },
};

const declarationFrameShapes: ToolDeclaration = {
  name: 'frame_shapes',
  description:
    'Compose a selection into a named frame (walkthrough scene). Requires engine frames support.',
  costClass: 'cheap',
  parameters: {
    type: 'object',
    properties: {
      shapeIds: {
        type: 'array',
        description: 'Shape ids to place inside the frame.',
        items: { type: 'string' },
      },
      name: { type: 'string', description: 'Optional frame label.' },
    },
    required: ['shapeIds'],
  },
};

const declarationArrange: ToolDeclaration = {
  name: 'arrange',
  description:
    'Re-run auto-layout over an existing selection or frame contents. Moves the shapes in place; connectors and labels follow automatically, and the canvas already shows the new layout when this returns. Never redraw the same shapes after arranging them. Agents supply structure, not coordinates.',
  costClass: 'cheap',
  parameters: {
    type: 'object',
    properties: {
      shapeIds: {
        type: 'array',
        description: 'Explicit shape ids to arrange.',
        items: { type: 'string' },
      },
      frameId: { type: 'string', description: 'Arrange all children of this frame.' },
      layout: {
        type: 'string',
        enum: ['flow', 'timeline', 'radial', 'nested'],
        description: 'Auto-layout mode.',
      },
    },
    required: ['layout'],
  },
};

export const AUTHORING_TOOLKIT_TOOLS: readonly ToolDefinition[] = [
  {
    declaration: declarationInsertImage,
    handler: withDrawGate(async (args) => {
      const untrusted = rejectUntrustedImageFields(args);
      if (untrusted !== undefined) {
        return { ok: false, error: untrusted };
      }
      const request = readInsertImageRequest(args);
      if (request === undefined) {
        return { ok: false, error: 'geometry requires finite x, y, w, and h' };
      }
      try {
        const agentId = resolveActingAgentId(args);
        const resolved = await resolveAuthoringImageAsset(request);
        const result = insertAgentImage(agentId, request, resolved);
        return drawToolSuccess({ kind: 'insert_image', result });
      } catch (err) {
        const message = err instanceof Error ? err.message: String(err);
        return { ok: false, error: message };
      }
    }),
  },
  {
    declaration: declarationConnectShapes,
    handler: withDrawGate((args) => {
      const from = readString(args.from);
      const to = readString(args.to);
      const kind = readConnectorKind(args.kind);
      if (from === undefined) return { ok: false, error: 'from must be a non-empty string' };
      if (to === undefined) return { ok: false, error: 'to must be a non-empty string' };
      if (kind === undefined) {
        return { ok: false, error: 'kind must be dependency, flow, or annotation' };
      }
      const request: AgentConnectShapesRequest = {
        from,
        to,
        kind,
        label: readSketchText(args.label),
      };
      try {
        const agentId = resolveActingAgentId(args);
        const result = connectAgentShapes(agentId, request);
        return drawToolSuccess({ kind: 'connect_shapes', result });
      } catch (err) {
        const message = err instanceof Error ? err.message: String(err);
        return { ok: false, error: message };
      }
    }),
  },
  {
    declaration: declarationGroupShapes,
    handler: withDrawGate((args) => {
      const shapeIds = readStringArray(args.shapeIds);
      if (shapeIds === undefined || shapeIds.length < 2) {
        return { ok: false, error: 'shapeIds must be an array of at least two shape ids' };
      }
      const request: AgentGroupShapesRequest = { shapeIds };
      try {
        const agentId = resolveActingAgentId(args);
        const result = groupAgentShapes(agentId, request);
        return drawToolSuccess({ kind: 'group_shapes', result });
      } catch (err) {
        const message = err instanceof Error ? err.message: String(err);
        return { ok: false, error: message };
      }
    }),
  },
  {
    declaration: declarationFrameShapes,
    handler: withDrawGate((args) => {
      const shapeIds = readStringArray(args.shapeIds);
      if (shapeIds === undefined || shapeIds.length === 0) {
        return { ok: false, error: 'shapeIds must be a non-empty array' };
      }
      const request: AgentFrameShapesRequest = {
        shapeIds,
        name: readString(args.name),
      };
      try {
        const agentId = resolveActingAgentId(args);
        const result = frameAgentShapes(agentId, request);
        return drawToolSuccess({ kind: 'frame_shapes', result });
      } catch (err) {
        const message = err instanceof Error ? err.message: String(err);
        return { ok: false, error: message };
      }
    }),
  },
  {
    declaration: declarationArrange,
    handler: withDrawGate((args) => {
      const layout = readArrangeLayout(args.layout);
      if (layout === undefined) {
        return { ok: false, error: 'layout must be flow, timeline, radial, or nested' };
      }
      const shapeIds = args.shapeIds === undefined ? undefined: readStringArray(args.shapeIds);
      const frameId = readString(args.frameId);
      if (shapeIds !== undefined && frameId !== undefined) {
        return { ok: false, error: 'pass either shapeIds or frameId, not both' };
      }
      const request: AgentArrangeRequest = {
        layout,...(shapeIds !== undefined ? { shapeIds }: {}),...(frameId !== undefined ? { frameId }: {}),
      };
      try {
        const agentId = resolveActingAgentId(args);
        const result = arrangeAgentShapes(agentId, request);
        return drawToolSuccess({ kind: 'arrange', result });
      } catch (err) {
        const message = err instanceof Error ? err.message: String(err);
        return { ok: false, error: message };
      }
    }),
  },
];
