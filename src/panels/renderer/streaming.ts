/**
 * Streaming spec hydration (D40) with interrupted-stream resume (D56).
 *
 * A producer (agent transport, host bridge) feeds an IR spec as an
 * ordered chunk stream: one envelope chunk (everything except nodes),
 * then node chunks, then an end chunk. The session assembles a partial
 * raw spec after every accepted chunk, substitutes a synthetic
 * `streaming-skeleton` node for every referenced-but-missing node id,
 * and runs the FULL `validateSpec` pipeline over the partial tree, so
 * partial paints carry the same trust guarantees as one-shot renders.
 *
 * Resume protocol: every chunk carries a monotonic `seq` starting at 0.
 * Replayed chunks (`seq < nextSeq`) are acknowledged as duplicates and
 * change nothing, so a producer that lost track of its position resends
 * from any earlier point and converges; a skipped chunk (`seq >
 * nextSeq`) is rejected with the seq to resume from. On `end` the
 * accumulated raw spec equals the one-shot spec byte for byte, so the
 * terminal validation and render are identical to a non-streamed feed.
 */
import { z } from 'zod';
import {
  STREAMING_SKELETON_TYPE,
  validateSpec,
  type NormalizedPanelSpec,
  type SpecCatalogEntry,
  type SpecIssue,
  type SpecValidationContext,
} from '../spec';
import type { JsonObject, JsonValue, PanelSpec, SpecOrigin } from '../types';

/** Envelope chunk payload: the spec minus `nodes` (which stream separately). */
export interface SpecStreamEnvelope {
  v: number;
  origin: SpecOrigin;
  root: string;
  sources?: JsonObject;
  state?: JsonObject;
  actions?: JsonObject;
}

export type SpecStreamChunk =
  | { kind: 'envelope'; seq: number; envelope: SpecStreamEnvelope }
  | { kind: 'node'; seq: number; nodeId: string; node: JsonValue }
  | { kind: 'end'; seq: number };

export type StreamingPhase = 'idle' | 'streaming' | 'interrupted' | 'complete' | 'failed';

export interface StreamingSpecSnapshot {
  phase: StreamingPhase;
  /**
   * Renderable spec: partial with skeleton placeholders while streaming,
   * the final validated spec once complete, `null` before the envelope
   * produces a valid partial.
   */
  spec: NormalizedPanelSpec | null;
  /** Node ids referenced by arrived nodes (or the root) still awaited. */
  pendingNodeIds: readonly string[];
  receivedNodeIds: readonly string[];
  /** The seq the producer must send next; doubles as the resume token. */
  nextSeq: number;
  /** Issues from the most recent validation pass. */
  errors: readonly SpecIssue[];
  warnings: readonly SpecIssue[];
}

export type ApplyChunkResult =
  | { applied: true; nextSeq: number }
  | {
      applied: false;
      reason: 'duplicate' | 'gap' | 'protocol' | 'closed';
      nextSeq: number;
      message: string;
    };

export interface SpecStreamResumeToken {
  nextSeq: number;
}

export interface StreamingSpecSession {
  applyChunk(chunk: SpecStreamChunk): ApplyChunkResult;
  getSnapshot(): StreamingSpecSnapshot;
  subscribe(listener: () => void): () => void;
  /** Where a reconnecting producer must resume its feed from. */
  getResumeToken(): SpecStreamResumeToken;
  /**
   * Transport-level drop signal. Painted DOM stays up; the next accepted
   * chunk returns the session to `streaming`.
   */
  notifyInterrupted(): void;
}

export interface CreateStreamingSpecSessionOptions {
  validation: SpecValidationContext;
}

const skeletonValidationEntry: SpecCatalogEntry = {
  name: STREAMING_SKELETON_TYPE,
  props: z.object({ pendingNodeId: z.string() }),
  internal: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Child ids referenced by a raw (not yet validated) node value. */
function rawNodeChildIds(raw: JsonValue): string[] {
  if (!isRecord(raw) || !Array.isArray(raw.children)) return [];
  return raw.children.filter((child): child is string => typeof child === 'string');
}

export function createStreamingSpecSession(
  options: CreateStreamingSpecSessionOptions,
): StreamingSpecSession {
  const { validation } = options;
  const partialCatalog = new Map<string, SpecCatalogEntry>([
    ...validation.catalog,
    [STREAMING_SKELETON_TYPE, skeletonValidationEntry],
  ]);
  const partialValidation: SpecValidationContext = { ...validation, catalog: partialCatalog };

  const listeners = new Set<() => void>();
  let phase: StreamingPhase = 'idle';
  let nextSeq = 0;
  let envelope: SpecStreamEnvelope | null = null;
  const nodes = new Map<string, JsonValue>();
  let spec: NormalizedPanelSpec | null = null;
  let errors: readonly SpecIssue[] = [];
  let warnings: readonly SpecIssue[] = [];
  let snapshot: StreamingSpecSnapshot | null = null;

  const notify = (): void => {
    snapshot = null;
    for (const listener of [...listeners]) listener();
  };

  const pendingNodeIds = (): string[] => {
    if (envelope === null) return [];
    const pending = new Set<string>();
    if (!nodes.has(envelope.root)) pending.add(envelope.root);
    for (const raw of nodes.values()) {
      for (const childId of rawNodeChildIds(raw)) {
        if (!nodes.has(childId)) pending.add(childId);
      }
    }
    return [...pending];
  };

  // The assembled raw spec is untrusted JSON headed into `validateSpec`,
  // so it is deliberately typed `unknown` rather than `PanelSpec`.
  const buildRawSpec = (withSkeletons: boolean): unknown => {
    if (envelope === null) throw new Error('buildRawSpec requires an envelope');
    const rawNodes: Record<string, JsonValue> = {};
    for (const [nodeId, raw] of nodes) {
      rawNodes[nodeId] = raw;
    }
    if (withSkeletons) {
      for (const nodeId of pendingNodeIds()) {
        rawNodes[nodeId] = {
          type: STREAMING_SKELETON_TYPE,
          props: { pendingNodeId: nodeId },
        };
      }
    }
    return {
      v: envelope.v,
      origin: envelope.origin,
      root: envelope.root,
      nodes: rawNodes,
      ...(envelope.sources !== undefined ? { sources: envelope.sources } : {}),
      ...(envelope.state !== undefined ? { state: envelope.state } : {}),
      ...(envelope.actions !== undefined ? { actions: envelope.actions } : {}),
    };
  };

  const revalidatePartial = (): void => {
    const result = validateSpec(buildRawSpec(true), partialValidation);
    if (result.ok) {
      spec = result.spec;
      errors = [];
      warnings = result.warnings;
    } else {
      // Keep the last good partial painted; record why the newest chunk
      // did not paint. The terminal end-of-stream validation decides
      // pass or fail for the whole spec.
      errors = result.errors;
      warnings = result.warnings;
    }
  };

  const finalize = (): void => {
    const result = validateSpec(buildRawSpec(false), validation);
    if (result.ok) {
      spec = result.spec;
      errors = [];
      warnings = result.warnings;
      phase = 'complete';
    } else {
      errors = result.errors;
      warnings = result.warnings;
      phase = 'failed';
    }
  };

  const rejected = (
    reason: 'duplicate' | 'gap' | 'protocol' | 'closed',
    message: string,
  ): ApplyChunkResult => ({ applied: false, reason, nextSeq, message });

  return {
    applyChunk(chunk: SpecStreamChunk): ApplyChunkResult {
      if (phase === 'complete' || phase === 'failed') {
        return rejected('closed', `stream already ${phase}; chunk ${chunk.seq} ignored`);
      }
      if (chunk.seq < nextSeq) {
        return rejected('duplicate', `chunk ${chunk.seq} already applied; next is ${nextSeq}`);
      }
      if (chunk.seq > nextSeq) {
        return rejected('gap', `chunk ${chunk.seq} skips ahead; resume from ${nextSeq}`);
      }
      if (chunk.kind === 'envelope') {
        if (envelope !== null) {
          return rejected('protocol', 'envelope already received');
        }
        envelope = chunk.envelope;
      } else if (envelope === null) {
        return rejected('protocol', `${chunk.kind} chunk received before the envelope`);
      } else if (chunk.kind === 'node') {
        nodes.set(chunk.nodeId, chunk.node);
      }

      nextSeq = chunk.seq + 1;
      if (chunk.kind === 'end') {
        finalize();
      } else {
        phase = 'streaming';
        revalidatePartial();
      }
      notify();
      return { applied: true, nextSeq };
    },

    getSnapshot(): StreamingSpecSnapshot {
      if (snapshot === null) {
        snapshot = {
          phase,
          spec,
          pendingNodeIds: phase === 'complete' ? [] : pendingNodeIds(),
          receivedNodeIds: [...nodes.keys()],
          nextSeq,
          errors,
          warnings,
        };
      }
      return snapshot;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getResumeToken(): SpecStreamResumeToken {
      return { nextSeq };
    },

    notifyInterrupted(): void {
      if (phase !== 'streaming' && phase !== 'idle') return;
      phase = 'interrupted';
      notify();
    },
  };
}

export interface SpecToStreamChunksOptions {
  /** Node emission order; defaults to the spec's own key order. */
  nodeOrder?: readonly string[];
}

/**
 * Deterministic chunking of a complete spec: envelope, one chunk per
 * node, end. Feeding these chunks in order reproduces the one-shot
 * spec exactly; tests and simple producers use this as the reference
 * feed shape.
 */
export function specToStreamChunks(
  spec: PanelSpec,
  options: SpecToStreamChunksOptions = {},
): SpecStreamChunk[] {
  const nodeIds = options.nodeOrder ?? Object.keys(spec.nodes);
  const chunks: SpecStreamChunk[] = [
    {
      kind: 'envelope',
      seq: 0,
      envelope: {
        v: spec.v,
        origin: spec.origin,
        root: spec.root,
        ...(spec.sources !== undefined
          ? { sources: spec.sources as unknown as JsonObject }
          : {}),
        ...(spec.state !== undefined ? { state: spec.state } : {}),
        ...(spec.actions !== undefined
          ? { actions: spec.actions as unknown as JsonObject }
          : {}),
      },
    },
  ];
  nodeIds.forEach((nodeId, index) => {
    const node = spec.nodes[nodeId];
    if (node === undefined) {
      throw new Error(`specToStreamChunks: nodeOrder id "${nodeId}" is not in spec.nodes`);
    }
    chunks.push({
      kind: 'node',
      seq: index + 1,
      nodeId,
      node: node as unknown as JsonValue,
    });
  });
  chunks.push({ kind: 'end', seq: nodeIds.length + 1 });
  return chunks;
}
