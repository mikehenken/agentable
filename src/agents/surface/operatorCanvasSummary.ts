/**
 * Deterministic canvas summary for operator Ask mode (offline + probe paths).
 */
import type { CanvasShapeGraph } from '../../engine/canvasPerceptionTypes';
import { readShapeGraph } from '../../chat/canvasLints';
import { waitForOperatorCanvasToolsReady } from './operatorCanvasToolBridge';

const SUMMARIZE_CANVAS_PATTERN =
  /\b(summarize|summary|describe|inspect|read|what(?:'s| is) on)\b.*\b(canvas|board|whiteboard)\b|\b(canvas|board|whiteboard)\b.*\b(summarize|summary|describe|inspect)\b/i;

export function isSummarizeCanvasIntent(text: string): boolean {
  return SUMMARIZE_CANVAS_PATTERN.test(text.trim());
}

function formatGraphSummary(graph: CanvasShapeGraph): string {
  const typeCounts = new Map<string, number>();
  for (const node of graph.shapes) {
    const type = node.nativeType.length > 0 ? node.nativeType: 'unknown';
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  }
  const breakdown = [...typeCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6).map(([type, count]) => `${type}×${count}`).join(', ');
  const truncated = graph.truncated === true ? ' (truncated)': '';
  return (
    `Canvas viewport ${Math.round(graph.region.w)}×${Math.round(graph.region.h)} px — ` +
    `${graph.shapes.length} shape${graph.shapes.length === 1 ? '': 's'}${truncated}` +
    (breakdown.length > 0 ? `: ${breakdown}.`: '.')
  );
}

interface WhiteboardScriptedHost extends HTMLElement {
  runScriptedTool?: (
    toolName: 'read_canvas',
    args?: Record<string, unknown>) => Promise<{ ok: boolean; result?: unknown; error?: string }>;
  whenReady?: (timeoutMs?: number) => Promise<boolean>;
}

/**
 * Run read_canvas via the embed whiteboard scripted API and return user-facing text.
 * Returns null when the host is unavailable or read fails.
 */
export async function summarizeCanvasViaWhiteboardHost(
  userText: string): Promise<string | null> {
  if (!isSummarizeCanvasIntent(userText)) {
    return null;
  }

  const whiteboard = document.querySelector('agentable-whiteboard');
  if (!(whiteboard instanceof HTMLElement)) {
    return null;
  }

  const host = whiteboard as WhiteboardScriptedHost;
  if (typeof host.runScriptedTool !== 'function') {
    return null;
  }

  if (typeof host.whenReady === 'function') {
    const ready = await host.whenReady(10_000);
    if (!ready) {
      return 'Canvas is still loading — try again in a moment.';
    }
  }

  await waitForOperatorCanvasToolsReady();

  const result = await host.runScriptedTool('read_canvas', {});
  if (!result.ok) {
    return null;
  }

  const graph = readShapeGraph(result.result);
  if (graph === null) {
    return null;
  }

  return formatGraphSummary(graph);
}
