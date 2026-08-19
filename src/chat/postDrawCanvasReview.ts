/**
 * Mandatory post-draw canvas review — shared by live chat (`geminiChatClient`)
 * and operator offline draw verification. Runs read_canvas + layout lints
 * (and optionally a screenshot) so the model cannot claim a clean diagram
 * without seeing its own work.
 */
import type { Content, Part } from '@google/genai';
import { executeTool } from '../agents/tools/canvasTools';
import {
  withAgentToolContextAsync,
  type AgentToolExecutionContext,
} from '../agents/agentContext';
import type { CanvasShapeGraph } from '../engine/canvasPerceptionTypes';
import { clampPixelRatio } from '../engines/tldraw/perception/canvasPerceptionApi';
import { computeCanvasLints, readShapeGraph } from './canvasLints';

/** Canvas tools whose successful execution places or moves marks worth reviewing. */
export const CANVAS_DRAW_TOOLS: ReadonlySet<string> = new Set([
  'draw_shapes',
  'draw_diagram',
  'connect_shapes',
  'group_shapes',
  'frame_shapes',
  'arrange',
  'insert_image',
  'annotate_panel',
]);

export const CANVAS_CHECK_MARKER = '[Canvas check]';

/** Refusal when overlap-fix phase blocks canvas clear. */
export const CLEAR_FORBIDDEN_LAYOUT_FIX_ERROR =
  'Do not clear to fix overlaps. Update shapes in place using draw_shapes with existing ids, or arrange.';

const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';

const FALSE_LAYOUT_CLEAN_CLAIM =
  /\b(no overlaps?|layout (is )?clean|looks clean|nothing overlaps?|diagram is (complete|done|ready)|all (labels|text) (are )?(clear|readable|visible))\b/gi;

export interface PostDrawProgressHooks {
  onToolStart?: (name: string, args: Record<string, unknown>) => void;
  onToolComplete?: (name: string, args: Record<string, unknown>, ok: boolean) => void;
}

function extractBase64Png(dataUrl: unknown): string | null {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
    return null;
  }
  const data = dataUrl.slice(PNG_DATA_URL_PREFIX.length);
  return data.length > 0 ? data: null;
}

export function isCanvasCheckContent(content: Content): boolean {
  const first = content.parts?.[0];
  return (
    content.role === 'user' &&
    typeof first?.text === 'string' &&
    first.text.startsWith(CANVAS_CHECK_MARKER)
  );
}

export function dropStaleCanvasChecks(contents: Content[]): void {
  for (let i = contents.length - 1; i >= 0; i -= 1) {
    if (isCanvasCheckContent(contents[i]!)) {
      contents.splice(i, 1);
    }
  }
}

export function buildCanvasCheckText(
  lints: readonly string[],
  hasImage: boolean,
  options?: { nestedStructural?: boolean }): string {
  const findings =
    lints.length > 0
      ? `Layout checks flagged: ${lints.map((lint, index) => `${index + 1}) ${lint}`).join(' ')} Fix what is genuinely wrong; a deliberate container, tab, or grouping pattern is fine to keep.`: 'Automated layout checks found no overlaps or cut-off shapes.';
  const imageLine = hasImage
    ? 'Attached is what the canvas looks like to the user right now. Judge it like a design reviewer: labels must sit inside their shapes, nothing should overlap or crowd, and the layout should read at a glance. ': '';
  const nestedGuidance =
    options?.nestedStructural === true
      ? 'This nested column diagram is already placed. Do NOT redraw the whole diagram with draw_shapes or call clear_agent_drawings. Patch only with draw_shapes using existing shape ids, or reply if the layout reads correctly. ': '';
  return (
    `${CANVAS_CHECK_MARKER} ${imageLine}${findings} ${nestedGuidance}` +
    'If there is a problem, patch it in place: move or resize shapes with draw_shapes using their existing ids, or run arrange. Do not call clear_agent_drawings to fix overlaps — clearing is forbidden during layout repair. A single clear is allowed only before you draw, to start over. After several failed patch attempts you may clear once and rebuild from scratch. ' +
    'If it looks clean, just give your final short reply. Never mention this check or the screenshot.'
  );
}

/** Strip layout-clean claims when post-draw review did not complete. */
export function stripFalseLayoutClaims(text: string, reviewComplete: boolean): string {
  const trimmed = text.trim();
  if (reviewComplete || trimmed.length === 0) {
    return trimmed;
  }
  if (!FALSE_LAYOUT_CLEAN_CLAIM.test(trimmed)) {
    return trimmed;
  }
  // FALSE_LAYOUT_CLEAN_CLAIM.lastIndex = 0;
  const stripped = trimmed.replace(FALSE_LAYOUT_CLEAN_CLAIM, '').replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
  return stripped.length > 0 ? stripped: 'The sketch is on the whiteboard.';
}

async function recordProgrammaticTool(
  toolContext: AgentToolExecutionContext,
  name: string,
  args: Record<string, unknown>,
  hooks: PostDrawProgressHooks | undefined): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  hooks?.onToolStart?.(name, args);
  const result = await withAgentToolContextAsync(toolContext, () => executeTool(name, args));
  hooks?.onToolComplete?.(name, args, result.ok);
  return result;
}

/**
 * Read the canvas and compute deterministic layout lints (no screenshot).
 */
export async function runLayoutProbe(
  toolContext: AgentToolExecutionContext,
  hooks?: PostDrawProgressHooks): Promise<{ lints: string[]; graph: CanvasShapeGraph | null }> {
  try {
    const graphResult = await recordProgrammaticTool(toolContext, 'read_canvas', {}, hooks);
    const graph = graphResult.ok ? readShapeGraph(graphResult.result): null;
    const lints =
      graph !== null
        ? computeCanvasLints(graph, { agentId: toolContext.agentId }): [];
    return { lints, graph };
  } catch {
    return { lints: [], graph: null };
  }
}

/**
 * Capture the model-facing view of its own drawing: screenshot plus layout lints.
 * Returns null when there is nothing useful to show. Never throws.
 */
export async function captureCanvasCheck(
  toolContext: AgentToolExecutionContext,
  hooks?: PostDrawProgressHooks,
  existingProbe?: { lints: string[]; graph: CanvasShapeGraph | null },
  options?: { nestedStructural?: boolean }): Promise<Content | null> {
  try {
    const probe =
      existingProbe ?? (await runLayoutProbe(toolContext, existingProbe === undefined ? hooks: undefined));
    const { lints, graph } = probe;

    const agentShapeIds =
      graph !== null
        ? graph.shapes.filter((node) => node.agentId === toolContext.agentId).map((node) => node.id).filter((id): id is string => typeof id === 'string' && id.length > 0): [];

    const pixelRatio = clampPixelRatio(
      graph !== null
        ? Math.min(
            1,
            1280 / Math.max(1, graph.region.w),
            800 / Math.max(1, graph.region.h)): 1);

    const screenshotArgs: Record<string, unknown> = { pixelRatio };
    if (agentShapeIds.length > 0) {
      screenshotArgs.fallbackShapeIds = agentShapeIds;
    }

    const shotResult = await recordProgrammaticTool(
      toolContext,
      'screenshot_canvas',
      screenshotArgs,
      hooks);
    const base64 = shotResult.ok
      ? extractBase64Png((shotResult.result as { dataUrl?: unknown } | undefined)?.dataUrl): null;

    if (base64 === null && lints.length === 0) {
      return null;
    }
    const parts: Part[] = [
      { text: buildCanvasCheckText(lints, base64 !== null, options) },
    ];
    if (base64 !== null) {
      parts.push({ inlineData: { mimeType: 'image/png', data: base64 } });
    }
    return { role: 'user', parts };
  } catch {
    return null;
  }
}

export interface PostDrawExitGateInput {
  contents: Content[];
  toolContext: AgentToolExecutionContext;
  hasLiveDrawing: boolean;
  postDrawReviewComplete: boolean;
  canvasChecksLeft: number;
  hooks?: PostDrawProgressHooks;
}

export interface PostDrawExitGateResult {
  /** When true, the send loop must continue instead of returning. */
  shouldContinue: boolean;
  postDrawReviewComplete: boolean;
  canvasChecksLeft: number;
  /** True when lints remain and a canvas check was injected — blocks clear_agent_drawings. */
  layoutFixActive: boolean;
}

/**
 * Hard gate before a no-tool-call exit: mandatory read_canvas + lints when the
 * turn drew on canvas but review is not complete.
 */
export async function runPostDrawExitGate(
  input: PostDrawExitGateInput): Promise<PostDrawExitGateResult> {
  const {
    contents,
    toolContext,
    hasLiveDrawing,
    postDrawReviewComplete: reviewCompleteIn,
    canvasChecksLeft: checksLeftIn,
    hooks,
  } = input;

  if (!hasLiveDrawing || reviewCompleteIn) {
    return {
      shouldContinue: false,
      postDrawReviewComplete: reviewCompleteIn,
      canvasChecksLeft: checksLeftIn,
      layoutFixActive: false,
    };
  }

  const probe = await runLayoutProbe(toolContext, hooks);

  if (probe.lints.length === 0) {
    return {
      shouldContinue: false,
      postDrawReviewComplete: true,
      canvasChecksLeft: checksLeftIn,
      layoutFixActive: false,
    };
  }

  if (checksLeftIn <= 0) {
    return {
      shouldContinue: false,
      postDrawReviewComplete: false,
      canvasChecksLeft: 0,
      layoutFixActive: true,
    };
  }

  const check = await captureCanvasCheck(toolContext, hooks, probe);
  if (check === null) {
    return {
      shouldContinue: false,
      postDrawReviewComplete: false,
      canvasChecksLeft: checksLeftIn,
      layoutFixActive: true,
    };
  }

  dropStaleCanvasChecks(contents);
  contents.push(check);
  return {
    shouldContinue: true,
    postDrawReviewComplete: false,
    canvasChecksLeft: checksLeftIn - 1,
    layoutFixActive: true,
  };
}
