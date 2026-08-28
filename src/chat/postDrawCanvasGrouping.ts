/**
 * Auto-group shapes created in a single draw_shapes call so each user request
 * produces one movable group (operator iteration).
 */
import { executeTool } from '../agents/tools/canvasTools';
import {
  withAgentToolContextAsync,
  type AgentToolExecutionContext,
} from '../agents/agentContext';
import { getEditor } from '../engines/tldraw/shapes/panelShapeApi';

// Shape-id type derived from the engine surface so this module never
// imports tldraw, even type-only (engine import boundary).
type EngineShapeId = Parameters<NonNullable<ReturnType<typeof getEditor>>['getShape']>[0];
import type { PostDrawProgressHooks } from './postDrawCanvasReview';
import type { AuthoringArrangeLayout } from '../engine/authoringToolkitTypes';
import type { AgentDiagramLayoutMode } from '../engine/agentDrawingTypes';
import { inferLayoutMode } from '../agents/tools/enforceStructuralDiagramDraw';

export type PostDrawRepairLayout = AuthoringArrangeLayout | 'skip';

/**
 * Resolve which arrange layout post-draw repair may use. Never downgrades
 * nested/radial architecture diagrams to flow; nested skips arrange because
 * flat shape ids cannot preserve parentId hierarchy.
 */
export function resolvePostDrawArrangeLayout(
  lastLayout: AgentDiagramLayoutMode | undefined,
  userText?: string,
): PostDrawRepairLayout {
  if (lastLayout === 'nested') {
    return 'skip';
  }
  if (lastLayout === 'radial' || lastLayout === 'flow' || lastLayout === 'timeline') {
    return lastLayout;
  }
  if (userText !== undefined) {
    const inferred = inferLayoutMode(userText);
    if (inferred === 'nested') {
      return 'skip';
    }
    return inferred;
  }
  return 'skip';
}

export interface AutoGroupCreatedShapesResult {
  ok: boolean;
  shapeIds: readonly string[];
  groupId?: string;
  error?: string;
}

/**
 * Group only sibling shapes (same parent). Nested labels or child shapes from
 * the same draw batch are excluded so tldraw groupShapes succeeds.
 */
export function filterGroupableSiblingIds(shapeIds: readonly string[]): string[] {
  const editor = getEditor();
  if (editor === null || shapeIds.length < 2) {
    return shapeIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
  }

  const byParent = new Map<string, string[]>();
  for (const rawId of shapeIds) {
    if (typeof rawId !== 'string' || rawId.length === 0) continue;
    const shape = editor.getShape(rawId as EngineShapeId);
    if (shape === undefined) continue;
    const parentKey = String(shape.parentId ?? 'page');
    const bucket = byParent.get(parentKey) ?? [];
    bucket.push(rawId);
    byParent.set(parentKey, bucket);
  }

  let best: string[] = [];
  for (const ids of byParent.values()) {
    if (ids.length > best.length) {
      best = ids;
    }
  }
  if (best.length >= 2) {
    return best;
  }
  return shapeIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/**
 * After a successful draw_shapes, group the created shapes when there are at
 * least two. Records progress via hooks so operator/chat transcripts show the
 * programmatic group_shapes call.
 */
export async function autoGroupCreatedShapes(
  toolContext: AgentToolExecutionContext,
  createdShapeIds: readonly string[],
  hooks?: PostDrawProgressHooks,
): Promise<AutoGroupCreatedShapesResult> {
  const shapeIds = filterGroupableSiblingIds(createdShapeIds);
  if (shapeIds.length < 2) {
    return { ok: true, shapeIds };
  }

  const args = { shapeIds: [...shapeIds] };
  hooks?.onToolStart?.('group_shapes', args);
  try {
    const result = await withAgentToolContextAsync(toolContext, () =>
      executeTool('group_shapes', args),
    );
    hooks?.onToolComplete?.('group_shapes', args, result.ok);
    if (!result.ok) {
      return {
        ok: false,
        shapeIds,
        error: typeof result.error === 'string' ? result.error : 'group_shapes failed',
      };
    }
    const groupId =
      result.result !== undefined &&
      typeof result.result === 'object' &&
      result.result !== null &&
      typeof (result.result as { groupId?: unknown }).groupId === 'string'
        ? (result.result as { groupId: string }).groupId
        : undefined;
    return { ok: true, shapeIds, groupId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    hooks?.onToolComplete?.('group_shapes', args, false);
    return { ok: false, shapeIds, error: message };
  }
}

export interface PostDrawRepairStep {
  toolName: string;
  args: Record<string, unknown>;
  ok: boolean;
}

export interface SharedPostDrawRepairResult {
  steps: PostDrawRepairStep[];
  lintsAfter: readonly string[];
  reviewComplete: boolean;
}

/**
 * Shared post-draw pipeline (same as live chat hard gate): group this request's
 * shapes, read_canvas + lints, arrange created ids on overlap, verify read again.
 * Used by operator offline verify and live chat — not a weaker fork.
 */
export async function runSharedPostDrawRepairPipeline(
  toolContext: AgentToolExecutionContext,
  createdShapeIds: readonly string[],
  hooks?: PostDrawProgressHooks,
  repairLayout?: PostDrawRepairLayout,
): Promise<SharedPostDrawRepairResult> {
  const steps: PostDrawRepairStep[] = [];

  if (createdShapeIds.length >= 2) {
    const groupableIds = filterGroupableSiblingIds(createdShapeIds);
    if (groupableIds.length >= 2) {
      const groupArgs = { shapeIds: groupableIds };
      const groupResult = await autoGroupCreatedShapes(toolContext, groupableIds, hooks);
      steps.push({
        toolName: 'group_shapes',
        args: groupArgs,
        ok: groupResult.ok,
      });
    }
  }

  const { runLayoutProbe } = await import('./postDrawCanvasReview');
  let probe = await runLayoutProbe(toolContext, hooks);
  steps.push({
    toolName: 'read_canvas',
    args: probe.lints.length > 0 ? { _layoutLints: [...probe.lints] } : {},
    ok: true,
  });

  if (probe.lints.length > 0) {
    const repairIds = filterGroupableSiblingIds(createdShapeIds);
    const resolvedLayout = repairLayout ?? 'skip';
    if (repairIds.length >= 2 && resolvedLayout !== 'skip') {
      const arrangeArgs: Record<string, unknown> = { shapeIds: repairIds, layout: resolvedLayout };
      hooks?.onToolStart?.('arrange', arrangeArgs);
      const arrangeResult = await withAgentToolContextAsync(toolContext, () =>
        executeTool('arrange', arrangeArgs),
      );
      hooks?.onToolComplete?.('arrange', arrangeArgs, arrangeResult.ok);
      steps.push({ toolName: 'arrange', args: arrangeArgs, ok: arrangeResult.ok });

      if (arrangeResult.ok) {
        probe = await runLayoutProbe(toolContext, hooks);
        steps.push({
          toolName: 'read_canvas',
          args:
            probe.lints.length > 0 ? { _layoutLints: [...probe.lints] } : { _verify: true },
          ok: true,
        });
      }
    }
  }

  return {
    steps,
    lintsAfter: probe.lints,
    reviewComplete: probe.lints.length === 0,
  };
}
