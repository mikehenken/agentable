/**

 * Homepage bounded embed — chat + open positions on first paint.

 * Safe to call after tldraw persistence hydrates (idempotent).

 * Does NOT run full auto-arrange — layout stays stable after tool calls.

 */

import type { Editor } from 'tldraw';

import { snapToGrid } from '../../../../src/layout/panelLayoutEngine';

import { defaultWhiteboardPanelSize } from '../../../../src/engines/tldraw/context/contextFramePanelLayout';

import {

  computeWhiteboardChromeInsets,

  type ResolveWhiteboardChromeInsetsOptions,

} from '../../../../src/engines/tldraw/layout/whiteboardChromeInsets';

import { getFreeCanvasViewportConfig } from '../../../../src/engines/tldraw/layout/whiteboardChromeInsets';

import { openPanelInCanvas, repairOpenPositionsBesideChatIfStacked } from '../../../../src/engines/tldraw/shapes/panelShapeApi';

import { shouldExpandWhiteboardNav } from '../../../../src/engines/tldraw/layout/responsiveWhiteboardLayout';

import { computeBesideChatPlacement } from '../../../../src/engines/tldraw/choreography/chatReserved';



export interface ApplyCareerHomepageFirstPaintOptions extends ResolveWhiteboardChromeInsetsOptions {

  /** When true, pan/zoom camera to fit opened panels. Default true. */

  fitCamera?: boolean;

}



function listPanelIds(editor: Editor): readonly string[] {

  const ids: string[] = [];

  for (const shape of editor.getCurrentPageShapes) {

    if ((shape.type as string) !== 'panel') continue;

    const panelId = (shape.props as { panelId?: string }).panelId;

    if (typeof panelId === 'string' && panelId.length > 0) {

      ids.push(panelId);

    }

  }

  return ids;

}



function openChatAtDefault(editor: Editor, options: ResolveWhiteboardChromeInsetsOptions): void {

  const viewport = editor.getViewportPageBounds;

  const navExpanded = options.showNavSidebar

    ? options.navExpanded ?? shouldExpandWhiteboardNav(viewport().w): false;

  const chrome = computeWhiteboardChromeInsets({

    viewportWidth: viewport().w,

    navExpanded,

    showNavSidebar: options.showNavSidebar ?? true,

  });

  const chatSize = defaultWhiteboardPanelSize(editor, 'chat');

  openPanelInCanvas('chat', {

    focus: true,

    preserveZoom: true,

    position: {

      x: snapToGrid(viewport().x + chrome.left),

      y: snapToGrid(viewport().y + chrome.top),

    },

    size: chatSize,

    chrome: { title: 'Chat', minimized: false },

  });

}



function openOpenPositionsBesideChat(editor: Editor): void {

  const viewport = getFreeCanvasViewportConfig(editor);

  const sized = defaultWhiteboardPanelSize(editor, 'open-positions');

  const placed = computeBesideChatPlacement(

    editor,

    'open-positions',

    sized.w,

    sized.h,

    viewport,

    true);

  openPanelInCanvas('open-positions', {

    focus: false,

    preserveZoom: true,

    position: placed,

    size: sized,

    chrome: { title: 'Open Positions', minimized: false },

  });

}



/**

 * Ensures Sandy chat + Open Positions are visible for marketing embeds.

 * Opens missing panels only — never re-runs auto-arrange on existing layout.

 */

export function applyCareerHomepageFirstPaint(

  editor: Editor,

  options: ApplyCareerHomepageFirstPaintOptions = {}): boolean {

  const fitCamera = options.fitCamera ?? true;

  const showNavSidebar = options.showNavSidebar ?? true;

  const navExpanded =

    options.navExpanded ??

    (showNavSidebar ? shouldExpandWhiteboardNav(editor.getViewportScreenBounds().w): false);



  const layoutOptions: ResolveWhiteboardChromeInsetsOptions = {

    showNavSidebar,

    navExpanded,

  };



  const existing = new Set(listPanelIds(editor));

  let changed = false;



  if (!existing.has('chat')) {

    openChatAtDefault(editor, layoutOptions);

    changed = true;

  }



  if (!existing.has('open-positions')) {

    openOpenPositionsBesideChat(editor);

    changed = true;

  } else if (repairOpenPositionsBesideChatIfStacked(editor)) {

    changed = true;

  }



  if (fitCamera && changed) {

    const panelShapes = editor.getCurrentPageShapes().filter((shape) => (shape.type as string) === 'panel');

    if (panelShapes.length > 0) {

      const ids = panelShapes.map((shape) => shape.id);

      const bounds = editor.getShapesPageBounds(ids);

      if (bounds) {

        editor.zoomToBounds(bounds, {

          animation: { duration: 0 },

          inset: 24,

        });

      }

    }

  }



  return changed;

}


