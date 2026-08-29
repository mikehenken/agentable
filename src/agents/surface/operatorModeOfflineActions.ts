/**
 * Mode-aware deterministic operator actions for gallery / offline paths.
 * Draw routes through executeTool → operatorCanvasToolsProxy → runGalleryScriptedTool.
 */
import { MERIDIAN_DOCUMENT_ID } from '../../embed/meridian/fixtures/meridianLabs';
import { withAgentToolContextAsync } from '../agentContext';
import { executeTool } from '../tools/canvasTools';
import { formatToolCallLabel } from '../../chat/toolCallLabels';
import { autoGroupCreatedShapes } from '../../chat/postDrawCanvasGrouping';
import { countOperatorPageShapes } from './operatorDrawPersistence';
import { getEditor } from '../../engines/tldraw/shapes/panelShapeApi';
import { waitForOperatorCanvasToolsReady } from './operatorCanvasToolBridge';
import { summarizeCanvasViaWhiteboardHost } from './operatorCanvasSummary';
import {
  buildDrawFailureMessage,
  dispatchFitOperatorDrawing,
  readOperatorDrawShapeEvidence,
  readOperatorViewportRegion,
  resolveOperatorProbeReadRegion,
  runOperatorClearDrawingsOnHost,
  readOperatorPageShapeCountFromHost,
  resolvePageShapeCountAfterDraw,
  syncOperatorDrawViewport,
  verifyOperatorDrawVisibility,
  waitForDrawCameraSettle,
} from './operatorDrawVerification';
import { resolveOperatorLiveChatEnabled } from './operatorChatEndpoint';
import {
  buildOperatorOfflineDrawArgs,
  isExactOperatorDemoDrawIntent,
  isOperatorClearDrawIntent,
  isOperatorDrawIntent,
  resolveOperatorDrawSubjectLabel,
} from './operatorOfflineDrawFixtures';
import { OPERATOR_TOOL_CONTEXT } from './operatorRegistrationBridge';
import { isOperatorDrawCapableMode } from './operatorModeScope';
import type { OperatorMode } from './types';

export interface OperatorModeOfflineActionResult {
  text: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolOk?: boolean;
}

const BUILD_PANEL_PATTERN =
  /\b(open|create|add|compose|build|wireframe)\b.*\b(panel|document|brief)\b|\b(panel|document)\b.*\b(open|create|add)\b/i;

interface WhiteboardScriptedHost extends HTMLElement {
  runScriptedTool?: (
    toolName: 'draw_shapes' | 'read_canvas' | 'clear_agent_drawings',
    args?: Record<string, unknown>,
  ) => Promise<{ ok: boolean; result?: unknown; error?: string }>;
  runOperatorScriptedTool?: (
    toolName: 'draw_shapes' | 'read_canvas' | 'clear_agent_drawings',
    args?: Record<string, unknown>,
  ) => Promise<{ ok: boolean; result?: unknown; error?: string }>;
  runMeridianDemo?: (
    step: 'document' | 'wireframe' | 'full',
  ) => Promise<{
    ok: boolean;
    document?: { ok: boolean; panelId: string; blockCount: number; title: string };
  }>;
  whenReady?: (timeoutMs?: number) => Promise<boolean>;
}

async function resolveWhiteboardHost(): Promise<WhiteboardScriptedHost | null> {
  const whiteboard = document.querySelector('agentable-whiteboard');
  if (!(whiteboard instanceof HTMLElement)) {
    return null;
  }
  const host = whiteboard as WhiteboardScriptedHost;
  if (typeof host.whenReady === 'function') {
    await host.whenReady(15_000);
  }
  return host;
}

/**
 * Run a deterministic mode-scoped action when live chat is unavailable.
 * Returns null when no scripted action matches the user intent.
 */
export async function runOperatorModeOfflineAction(
  userText: string,
  mode: OperatorMode,
): Promise<OperatorModeOfflineActionResult | null> {
  const canvasSummary = await summarizeCanvasViaWhiteboardHost(userText);
  if (canvasSummary !== null) {
    return {
      text: canvasSummary,
      toolName: 'read_canvas',
      toolArgs: {},
      toolOk: true,
    };
  }

  if (mode === 'ask' && isOperatorDrawIntent(userText)) {
    return {
      text: 'Drawing requires Draw mode. Switch to Draw using the mode control, then ask again.',
    };
  }

  if (mode === 'build' && BUILD_PANEL_PATTERN.test(userText.trim())) {
    await waitForOperatorCanvasToolsReady(15_000);
    const host = await resolveWhiteboardHost();
    if (host !== null && typeof host.runMeridianDemo === 'function') {
      const demo = await host.runMeridianDemo('document');
      const documentResult = demo.document;
      if (documentResult?.ok === true) {
        return {
          text: `Opened document panel "${documentResult.title}" with ${documentResult.blockCount} content blocks on the canvas.`,
          toolName: 'open_panel',
          toolArgs: { id: documentResult.panelId },
          toolOk: true,
        };
      }
    }

    const openResult = await withAgentToolContextAsync(OPERATOR_TOOL_CONTEXT, () =>
      executeTool('open_panel', { id: MERIDIAN_DOCUMENT_ID }),
    );
    if (openResult.ok) {
      return {
        text: 'Opened document panel on the canvas with content blocks.',
        toolName: 'open_panel',
        toolArgs: { id: MERIDIAN_DOCUMENT_ID },
        toolOk: true,
      };
    }

    return {
      text: 'Could not open a document panel — the canvas host may still be loading. Try again in a moment.',
      toolName: 'open_panel',
      toolArgs: { id: MERIDIAN_DOCUMENT_ID },
      toolOk: false,
    };
  }

  if (isOperatorDrawCapableMode(mode) && isOperatorDrawIntent(userText)) {
    await waitForOperatorCanvasToolsReady(15_000);
    const host = await resolveWhiteboardHost();
    if (host === null) {
      return {
        text: 'Draw tools are unavailable until the whiteboard finishes loading.',
        toolName: 'draw_shapes',
        toolArgs: {},
        toolOk: false,
      };
    }

    if (isOperatorClearDrawIntent(userText)) {
      await runOperatorClearDrawingsOnHost(host);
      return {
        text: 'Cleared operator drawings from the canvas.',
        toolName: 'clear_agent_drawings',
        toolArgs: {},
        toolOk: true,
      };
    }

    if (resolveOperatorLiveChatEnabled()) {
      return null;
    }

    const viewportRegion = await readOperatorViewportRegion(host);
    const readRegion = await resolveOperatorProbeReadRegion(host);
    const shapesBeforeDraw = await readOperatorDrawShapeEvidence(host, readRegion);
    const pageShapeCountBefore =
      getEditor() !== null
        ? countOperatorPageShapes()
        : (await readOperatorPageShapeCountFromHost(host)) ?? 0;
    syncOperatorDrawViewport();

    const drawArgs = buildOperatorOfflineDrawArgs(userText, viewportRegion);

    const drawResult = await withAgentToolContextAsync(OPERATOR_TOOL_CONTEXT, () =>
      executeTool('draw_shapes', drawArgs),
    );

    dispatchFitOperatorDrawing();
    await waitForDrawCameraSettle();
    syncOperatorDrawViewport();

    const shapesAfterDraw = await readOperatorDrawShapeEvidence(host, readRegion);
    const verdict = verifyOperatorDrawVisibility({
      drawResult,
      shapesBeforeDraw,
      shapesAfterDraw,
      pageShapeCountBefore,
      pageShapeCountAfter:
        resolvePageShapeCountAfterDraw(drawResult) ??
        (await readOperatorPageShapeCountFromHost(host)) ??
        undefined,
    });
    const drawOk = verdict.visibleOnCanvas;
    const shapeCount = verdict.createdShapeIds.length;

    if (drawOk && verdict.createdShapeIds.length >= 2) {
      await withAgentToolContextAsync(OPERATOR_TOOL_CONTEXT, () =>
        autoGroupCreatedShapes(OPERATOR_TOOL_CONTEXT, verdict.createdShapeIds),
      );
    }

    const demoSubject = isExactOperatorDemoDrawIntent(userText);
    const subject =
      demoSubject !== null
        ? resolveOperatorDrawSubjectLabel(demoSubject)
        : 'sketch';

    return {
      text: drawOk
        ? `Drew ${shapeCount} shape${shapeCount === 1 ? '' : 's'} on the canvas (${subject}).`
        : buildDrawFailureMessage(drawResult, verdict),
      toolName: 'draw_shapes',
      toolArgs: {
        ...drawArgs,
        _createdShapeIds: verdict.createdShapeIds,
        _shapesBeforeDraw: shapesBeforeDraw,
        _shapesAfterDraw: shapesAfterDraw,
        _store: verdict.storeEvidence,
        _pageShapeCountBefore: verdict.pageShapeCountBefore,
        _pageShapeCountAfter: verdict.pageShapeCountAfter,
      },
      toolOk: drawOk,
    };
  }

  if (mode === 'draw' || mode === 'auto') {
    return {
      text:
        mode === 'auto'
          ? 'Auto mode is active — ask, build panels, or draw on the canvas as needed.'
          : 'Draw mode is active — ask me to draw shapes, annotate a panel, or present a walkthrough.',
    };
  }

  if (mode === 'build') {
    return {
      text: 'Build mode is active — ask me to open a document panel, compose content, or patch a panel.',
    };
  }

  return null;
}

export function formatOfflineActionToolLabel(
  toolName: string,
  args: Record<string, unknown>,
  ok: boolean,
): string {
  return formatToolCallLabel(toolName, args, ok);
}

export { isOperatorDrawIntent };
