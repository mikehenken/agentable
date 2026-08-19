/**
 * Digest shape slice helpers (D41, P8-T4): compact summaries and revision fingerprints.
 */
import type { AgentDrawShapeKind } from '../engine/agentDrawingTypes';
import type { AttentionTier, DigestShapeSummary } from './digest';

const DIGEST_SHAPE_LABEL_MAX = 48;

export interface DigestShapeRecordInput {
  id: string;
  nativeType: string;
  kind?: AgentDrawShapeKind | 'annotation';
  label: string;
  agentId?: string;
  userAuthored?: boolean;
  attention?: AttentionTier;
  revisionPayload: Record<string, unknown>;
}

function truncateLabel(value: string): string {
  if (value.length <= DIGEST_SHAPE_LABEL_MAX) return value;
  return `${value.slice(0, DIGEST_SHAPE_LABEL_MAX - 1)}…`;
}

/** Stable revision token for digest delta diffing. */
export function digestShapeRevision(payload: Record<string, unknown>): string {
  return JSON.stringify(payload);
}

export function buildDigestShapeSummary(input: DigestShapeRecordInput): DigestShapeSummary {
  const summary: DigestShapeSummary = {
    id: input.id,
    nativeType: input.nativeType,
    label: truncateLabel(input.label),
    revision: digestShapeRevision(input.revisionPayload),
  };
  if (input.kind !== undefined) summary.kind = input.kind;
  if (input.agentId !== undefined) summary.agentId = input.agentId;
  if (input.userAuthored === true) summary.userAuthored = true;
  if (input.attention !== undefined) summary.attention = input.attention;
  return summary;
}

export function cloneDigestShapeSummaries(
  shapes: readonly DigestShapeSummary[],
): DigestShapeSummary[] {
  return shapes.map((shape) => ({ ...shape }));
}
