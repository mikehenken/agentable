/**

 * Preset dock trees for admin-style site context layouts.

 *

 * Brief left of preview, Files right of preview.

 * Chat (when present) docks left of frame before Brief.

 */

import { createShapeId, type TLShapeId } from 'tldraw';

import type { PanelDock } from './panelDockEngine';

import type { DockTreeNode } from './panelDockEngine';

import type { SiteContextPanelKind, SiteContextPanelPlacement } from './siteContextPanelLayout';



export interface SiteDockPresetOptions {

  includeChat: boolean;

  includeBrief: boolean;

  includePreview: boolean;

  includeFiles: boolean;

  frameId: TLShapeId;

}



function dockChatToGroupLeft(frameId: TLShapeId): PanelDock {

  return { target: 'group', targetId: frameId, edge: 'left', gap: 0, fillHeight: true };

}



function dockFilesToGroupRight(frameId: TLShapeId): PanelDock {

  return { target: 'group', targetId: frameId, edge: 'right', gap: 0, fillHeight: true };

}



function dockToGroupLeft(frameId: TLShapeId): PanelDock {

  return { target: 'group', targetId: frameId, edge: 'left', gap: 0 };

}



function dockToPanelRight(panelId: SiteContextPanelKind): PanelDock {

  return {

    target: 'panel',

    targetId: createShapeId(`panel:${panelId}`),

    edge: 'right',

    gap: 0,

  };

}



/**

 * Build an ordered dock tree from grid-derived sizes.

 * Order matters: anchors must be resolved before dependents.

 */

export function buildAdminSiteDockTree(

  options: SiteDockPresetOptions,

  sizes: Map<SiteContextPanelKind, { w: number; h: number }>,

): DockTreeNode[] {

  const { includeChat, includeBrief, includePreview, includeFiles, frameId } = options;

  const nodes: DockTreeNode[] = [];



  if (includeChat) {

    const size = sizes.get('chat');

    if (size) {

      nodes.push({

        panelId: 'chat',

        dock: dockChatToGroupLeft(frameId),

        w: size.w,

        h: size.h,

      });

    }

  }



  if (includeBrief) {

    const size = sizes.get('project-brief');

    if (size) {

      const dock: PanelDock = includeChat

        ? dockToPanelRight('chat')

        : dockToGroupLeft(frameId);

      nodes.push({

        panelId: 'project-brief',

        dock,

        w: size.w,

        h: size.h,

      });

    }

  }



  if (includePreview) {

    const size = sizes.get('web-preview');

    if (size) {

      const anchor: SiteContextPanelKind = includeBrief

        ? 'project-brief'

        : includeChat

          ? 'chat'

          : 'web-preview';

      const dock: PanelDock =

        anchor === 'web-preview'

          ? dockToGroupLeft(frameId)

          : dockToPanelRight(anchor);

      nodes.push({

        panelId: 'web-preview',

        dock,

        w: size.w,

        h: size.h,

      });

    }

  }



  if (includeFiles) {

    const size = sizes.get('file-manager');

    if (size) {

      // File manager always docks flush to the group RIGHT edge at full height.

      nodes.push({

        panelId: 'file-manager',

        dock: dockFilesToGroupRight(frameId),

        w: size.w,

        h: size.h,

      });

    }

  }



  return nodes;

}



/** Convert grid layout placements to a size map for dock tree building. */

export function sizesFromPlacements(

  placements: SiteContextPanelPlacement[],

): Map<SiteContextPanelKind, { w: number; h: number }> {

  const map = new Map<SiteContextPanelKind, { w: number; h: number }>();

  for (const p of placements) {

    map.set(p.panelId, { w: p.w, h: p.h });

  }

  return map;

}

