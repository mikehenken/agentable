/**
 * Runtime bridge for engine capability flags consumed by agent tools (D37/D41).
 *
 * Voice and chat call tools outside React; capabilities bind when the host or
 * whiteboard shell mounts an engine. When unbound, draw tools refuse safely.
 */
import type { EngineCapabilities } from '../engine/types';
import {
  ENGINE_DRAW_UNAVAILABLE_CODE,
  type AgentClearDrawingsResult,
  type AgentAnnotatePanelResult,
  type AgentDrawShapesResult,
  type EngineCapabilityRefusal,
} from '../engine/agentDrawingTypes';
import type {
  AgentArrangeResult,
  AgentConnectShapesResult,
  AgentFrameShapesResult,
  AgentGroupShapesResult,
  AgentInsertImageResult,
} from '../engine/authoringToolkitTypes';
import type { ToolResult } from '../panels/tools';
import type { DigestShapeSummary } from './digest';

let boundCapabilities: EngineCapabilities | null = null;

export function bindEngineCapabilities(capabilities: EngineCapabilities): () => void {
  boundCapabilities = capabilities;
  return () => {
    if (boundCapabilities === capabilities) {
      boundCapabilities = null;
    }
  };
}

export function getEngineCapabilities(): EngineCapabilities | null {
  return boundCapabilities;
}

export function resetEngineCapabilitiesForTests(): void {
  boundCapabilities = null;
}

/**
 * Digest shape slice the mounted engine currently provides (D37/D41, P8-T4).
 * Engine-agnostic by design: the shape is the same whichever engine is
 * mounted, only the source differs (see `bindEngineDigestShapeSlice`).
 */
export interface DigestShapeSlice {
  shapes: DigestShapeSummary[];
  changeBatchId: string;
}

let digestShapeSliceSource: (() => DigestShapeSlice | null) | null = null;

/**
 * Bind a live digest-shape-slice accessor. The mounted engine (or its shell
 * component) calls this once it can compute shape summaries; engines
 * without a spatial drawing surface (DOM, D48) never call it, so
 * `getEngineDigestShapeSlice()` stays null and the digest simply omits
 * shapes rather than the agent layer importing engine-specific code.
 */
export function bindEngineDigestShapeSlice(
  source: () => DigestShapeSlice | null,
): () => void {
  digestShapeSliceSource = source;
  return () => {
    if (digestShapeSliceSource === source) {
      digestShapeSliceSource = null;
    }
  };
}

export function getEngineDigestShapeSlice(): DigestShapeSlice | null {
  return digestShapeSliceSource ? digestShapeSliceSource() : null;
}

export function resetEngineDigestShapeSliceForTests(): void {
  digestShapeSliceSource = null;
}

export function isDrawCapabilityAvailable(): boolean {
  return boundCapabilities?.draw === true;
}

const DRAW_CAPABILITY_REFUSAL_MESSAGE =
  'This canvas engine does not support drawing, canvas perception, or walkthrough tools.';

/**
 * Build the structured, typed refusal for draw/see/walkthrough tools when
 * `capabilities.draw` is not declared true on the mounted engine (P11-T6).
 * The capability is read off the SPI's `EngineCapabilities`, never inferred
 * from an engine name or class check.
 */
export function buildDrawCapabilityRefusal(): EngineCapabilityRefusal {
  return {
    ok: false,
    code: ENGINE_DRAW_UNAVAILABLE_CODE,
    capability: 'draw',
    message: DRAW_CAPABILITY_REFUSAL_MESSAGE,
  };
}

/**
 * The `ToolResult` a draw/see/walkthrough tool handler returns when the
 * engine lacks draw capability. `error` encodes the same structured
 * refusal `buildDrawCapabilityRefusal()` returns (`parseEngineCapabilityRefusal`
 * recovers it); the outer shape stays the existing `{ ok: false, error }`
 * tool-result contract so no caller needs a new envelope to handle this
 * refusal.
 */
export function drawCapabilityRefusal(): ToolResult {
  const refusal = buildDrawCapabilityRefusal();
  return {
    ok: false,
    error: `${refusal.code}: ${refusal.message}`,
  };
}

/**
 * Recover the structured capability refusal from a `ToolResult`, or
 * `undefined` when the result is not an engine-draw-capability refusal.
 * Lets a caller (runtime or test) assert against the typed shape instead
 * of substring-matching the `error` text.
 */
export function parseEngineCapabilityRefusal(
  result: ToolResult,
): EngineCapabilityRefusal | undefined {
  if (result.ok) return undefined;
  const prefix = `${ENGINE_DRAW_UNAVAILABLE_CODE}: `;
  if (!result.error.startsWith(prefix)) return undefined;
  return {
    ok: false,
    code: ENGINE_DRAW_UNAVAILABLE_CODE,
    capability: 'draw',
    message: result.error.slice(prefix.length),
  };
}

export type DrawToolSuccess =
  | { kind: 'draw_shapes'; result: AgentDrawShapesResult }
  | { kind: 'annotate_panel'; result: AgentAnnotatePanelResult }
  | { kind: 'clear_agent_drawings'; result: AgentClearDrawingsResult }
  | { kind: 'insert_image'; result: AgentInsertImageResult }
  | { kind: 'connect_shapes'; result: AgentConnectShapesResult }
  | { kind: 'group_shapes'; result: AgentGroupShapesResult }
  | { kind: 'frame_shapes'; result: AgentFrameShapesResult }
  | { kind: 'arrange'; result: AgentArrangeResult };

export function drawToolSuccess(payload: DrawToolSuccess): ToolResult {
  return { ok: true, result: payload.result };
}
