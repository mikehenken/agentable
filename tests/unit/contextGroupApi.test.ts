/**
 * Unit tests for context group frames (site / agency tldraw frames).
 */
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { createShapeId } from 'tldraw';
import {
  assignPanelsToSiteGroup,
  collectContextGroupFrameIdsFromStoreDiff,
  collectPanelShapeIdsFromStoreDiff,
  contextGroupFrameId,
  ensurePanelInSiteContextFrame,
  fitContextGroupFrameToContent,
  fitSiteContextGroupForShape,
  groupPanelsWithContext,
  resolveSiteIdFromPanelData,
} from '../../src/whiteboard/context/contextGroupApi';

vi.mock('tldraw', async (importOriginal) => {
  const actual = await importOriginal<typeof import('tldraw')>();
  return {
    ...actual,
    fitFrameToContent: vi.fn(),
  };
});

interface StubFrame {
  id: string;
  type: 'frame';
  x: number;
  y: number;
  parentId: string;
  props: { w: number; h: number; name: string; color: string };
  meta?: Record<string, unknown>;
}

interface StubPanel {
  id: string;
  type: 'panel';
  x: number;
  y: number;
  parentId: string;
  props: { w: number; h: number; panelId: string; data: Record<string, unknown> };
}

interface StubEditor {
  getShape: Mock;
  createShape: Mock;
  updateShape: Mock;
  reparentShapes: Mock;
  setCurrentTool: Mock;
  groupShapes: Mock;
  getSortedChildIdsForParent: Mock;
  __frames: Map<string, StubFrame>;
  __panels: Map<string, StubPanel>;
}

function makeStubEditor(): StubEditor {
  const frames = new Map<string, StubFrame>();
  const panels = new Map<string, StubPanel>();

  const editor: StubEditor = {
    __frames: frames,
    __panels: panels,
    getShape: vi.fn((id: string) => frames.get(id) ?? panels.get(id)),
    createShape: vi.fn((shape: StubFrame) => {
      frames.set(shape.id, shape);
    }),
    updateShape: vi.fn((patch: StubFrame & { id: string }) => {
      const existing = frames.get(patch.id);
      if (!existing) return;
      frames.set(patch.id, {
        ...existing,
        ...patch,
        props: { ...existing.props, ...patch.props },
      });
    }),
    reparentShapes: vi.fn((ids: string[], parentId: string) => {
      for (const id of ids) {
        const panel = panels.get(id);
        if (panel) panels.set(id, { ...panel, parentId });
        const frame = frames.get(id);
        if (frame) frames.set(id, { ...frame, parentId });
      }
    }),
    setCurrentTool: vi.fn(),
    groupShapes: vi.fn(),
    getSortedChildIdsForParent: vi.fn((parentId: string) => {
      const childPanels = [...panels.values()]
        .filter((p) => p.parentId === parentId)
        .map((p) => p.id);
      const childFrames = [...frames.values()]
        .filter((f) => f.parentId === parentId)
        .map((f) => f.id);
      return [...childPanels, ...childFrames];
    }),
  };

  panels.set('shape:panel:chat', {
    id: 'shape:panel:chat',
    type: 'panel',
    x: 20,
    y: 20,
    parentId: 'page:page',
    props: { w: 400, h: 500, panelId: 'chat', data: {} },
  });

  return editor;
}

beforeEach(() => {
  vi.clearAllMocks();
});

function seedSitePanels(editor: StubEditor): void {
  editor.__panels.set('shape:panel:chat', {
    id: 'shape:panel:chat',
    type: 'panel',
    x: 20,
    y: 20,
    parentId: 'page:page',
    props: { w: 400, h: 500, panelId: 'chat', data: { __siteId: 'site-1' } },
  });
  editor.__panels.set('shape:panel:project-brief', {
    id: 'shape:panel:project-brief',
    type: 'panel',
    x: 440,
    y: 20,
    parentId: 'page:page',
    props: {
      w: 380,
      h: 500,
      panelId: 'project-brief',
      data: { __siteId: 'site-1' },
    },
  });
}

describe('resolveSiteIdFromPanelData', () => {
  it('reads __siteId and siteId', () => {
    expect(resolveSiteIdFromPanelData({ __siteId: 'a' })).toBe('a');
    expect(resolveSiteIdFromPanelData({ siteId: 'b' })).toBe('b');
    expect(resolveSiteIdFromPanelData({})).toBeNull();
  });
});

describe('contextGroupFrameId', () => {
  it('builds stable frame ids', () => {
    expect(contextGroupFrameId({ kind: 'site', id: 'site-1' })).toBe(
      createShapeId('context:site:site-1'),
    );
  });
});

describe('assignPanelsToSiteGroup', () => {
  it('creates a site frame and reparents panels', () => {
    const editor = makeStubEditor();
    seedSitePanels(editor);
    const frameId = contextGroupFrameId({ kind: 'site', id: 'site-1' });

    expect(
      assignPanelsToSiteGroup(editor as never, ['chat', 'project-brief'], 'site-1'),
    ).toBe(true);

    expect(editor.createShape).toHaveBeenCalledWith(
      expect.objectContaining({
        id: frameId,
        type: 'frame',
        props: expect.objectContaining({ name: expect.stringContaining('Site') }),
      }),
    );
    expect(editor.reparentShapes).toHaveBeenCalledWith(
      ['shape:panel:chat', 'shape:panel:project-brief'],
      frameId,
    );
  });

  it('nests site frame under agency frame when agencyId provided', () => {
    const editor = makeStubEditor();
    seedSitePanels(editor);
    assignPanelsToSiteGroup(editor as never, ['chat'], 'site-1', {
      agencyId: 'agency-99',
    });

    const agencyFrameId = contextGroupFrameId({ kind: 'agency', id: 'agency-99' });
    const siteFrameId = contextGroupFrameId({ kind: 'site', id: 'site-1' });
    expect(editor.createShape).toHaveBeenCalledWith(
      expect.objectContaining({ id: agencyFrameId, type: 'frame' }),
    );
    expect(editor.reparentShapes).toHaveBeenCalledWith([siteFrameId], agencyFrameId);
  });
});

describe('groupPanelsWithContext', () => {
  it('uses site frame when panels share siteId', () => {
    const editor = makeStubEditor();
    seedSitePanels(editor);
    expect(groupPanelsWithContext(editor as never, ['chat', 'project-brief'])).toBe(true);
    expect(editor.reparentShapes).toHaveBeenCalled();
  });

  it('falls back to tldraw group when no shared siteId', () => {
    const editor = makeStubEditor();
    editor.__panels.set('shape:panel:resources', {
      id: 'shape:panel:resources',
      type: 'panel',
      x: 0,
      y: 0,
      parentId: 'page:page',
      props: { w: 300, h: 300, panelId: 'resources', data: {} },
    });

    expect(groupPanelsWithContext(editor as never, ['chat', 'resources'])).toBe(true);
    expect(editor.setCurrentTool).toHaveBeenCalledWith('select');
    expect(editor.groupShapes).toHaveBeenCalled();
  });
});

describe('ensurePanelInSiteContextFrame', () => {
  it('reparents a site panel into the site frame when it drifted to the page', () => {
    const editor = makeStubEditor();
    seedSitePanels(editor);
    const frameId = contextGroupFrameId({ kind: 'site', id: 'site-1' });
    editor.__panels.set('shape:panel:chat', {
      id: 'shape:panel:chat',
      type: 'panel',
      x: 20,
      y: 20,
      parentId: 'page:page',
      props: { w: 400, h: 500, panelId: 'chat', data: { __siteId: 'site-1' } },
    });

    ensurePanelInSiteContextFrame(editor as never, 'shape:panel:chat', frameId);
    expect(editor.reparentShapes).toHaveBeenCalledWith(['shape:panel:chat'], frameId);
  });
});

describe('fitContextGroupFrameToContent', () => {
  it('fits only context group frames', () => {
    const editor = makeStubEditor();
    const frameId = contextGroupFrameId({ kind: 'site', id: 'site-1' });
    editor.__frames.set(frameId, {
      id: frameId,
      type: 'frame',
      x: 0,
      y: 0,
      parentId: 'page:page',
      props: { w: 800, h: 600, name: 'Site', color: 'blue' },
      meta: { landiContextGroup: { kind: 'site', id: 'site-1' } },
    });

    expect(fitContextGroupFrameToContent(editor as never, frameId)).toBe(true);
    expect(fitContextGroupFrameToContent(editor as never, 'shape:missing')).toBe(false);
  });
});

describe('fitSiteContextGroupForShape', () => {
  it('fits the site frame for a site-scoped panel', () => {
    const editor = makeStubEditor();
    seedSitePanels(editor);
    const frameId = contextGroupFrameId({ kind: 'site', id: 'site-1' });
    editor.__frames.set(frameId, {
      id: frameId,
      type: 'frame',
      x: 0,
      y: 0,
      parentId: 'page:page',
      props: { w: 800, h: 600, name: 'Site', color: 'blue' },
      meta: { landiContextGroup: { kind: 'site', id: 'site-1' } },
    });

    expect(fitSiteContextGroupForShape(editor as never, 'shape:panel:chat')).toBe(true);
  });
});

describe('collectPanelShapeIdsFromStoreDiff', () => {
  it('collects added panels and updated panels whose geometry changed', () => {
    const ids = collectPanelShapeIdsFromStoreDiff({
      added: {
        'shape:panel:chat': {
          id: 'shape:panel:chat',
          typeName: 'shape',
          type: 'panel',
        },
      },
      updated: {
        // Geometry change (height) → collected.
        'shape:panel:brief': [
          { id: 'shape:panel:brief', typeName: 'shape', type: 'panel', x: 0, y: 0, props: { w: 280, h: 400 } },
          { id: 'shape:panel:brief', typeName: 'shape', type: 'panel', x: 0, y: 0, props: { w: 280, h: 500 } },
        ],
      },
    });
    expect(ids).toEqual(['shape:panel:chat', 'shape:panel:brief']);
  });

  it('skips content-only panel updates (no geometry change) so chat messages do not refit', () => {
    const ids = collectPanelShapeIdsFromStoreDiff({
      added: {},
      updated: {
        // Same x/y/w/h, only content props (data) changed → NOT collected.
        'shape:panel:chat': [
          {
            id: 'shape:panel:chat',
            typeName: 'shape',
            type: 'panel',
            x: 10,
            y: 20,
            props: { w: 280, h: 400, data: { messages: 1 } },
          },
          {
            id: 'shape:panel:chat',
            typeName: 'shape',
            type: 'panel',
            x: 10,
            y: 20,
            props: { w: 280, h: 400, data: { messages: 2 } },
          },
        ],
      },
    });
    expect(ids).toEqual([]);
  });
});

describe('collectContextGroupFrameIdsFromStoreDiff', () => {
  const frameMeta = { landiContextGroup: { kind: 'site', id: 'site-1' } };

  it('collects context-group frames whose size (w/h) changed on GROUP resize', () => {
    const ids = collectContextGroupFrameIdsFromStoreDiff({
      added: {},
      updated: {
        'shape:context:site:site-1': [
          {
            id: 'shape:context:site:site-1',
            typeName: 'shape',
            type: 'frame',
            x: 0,
            y: 0,
            meta: frameMeta,
            props: { w: 800, h: 600 },
          },
          {
            id: 'shape:context:site:site-1',
            typeName: 'shape',
            type: 'frame',
            x: 0,
            y: 0,
            meta: frameMeta,
            props: { w: 1200, h: 720 },
          },
        ],
      },
    });
    expect(ids).toEqual(['shape:context:site:site-1']);
  });

  it('ignores pure moves (x/y only) and non-context frames', () => {
    const ids = collectContextGroupFrameIdsFromStoreDiff({
      added: {},
      updated: {
        // Same size, only moved → child panels move with it, no reflow needed.
        'shape:context:site:site-1': [
          {
            id: 'shape:context:site:site-1',
            typeName: 'shape',
            type: 'frame',
            x: 0,
            y: 0,
            meta: frameMeta,
            props: { w: 800, h: 600 },
          },
          {
            id: 'shape:context:site:site-1',
            typeName: 'shape',
            type: 'frame',
            x: 120,
            y: 80,
            meta: frameMeta,
            props: { w: 800, h: 600 },
          },
        ],
        // Plain frame without context-group meta → ignored even on resize.
        'shape:frame:plain': [
          { id: 'shape:frame:plain', typeName: 'shape', type: 'frame', props: { w: 100, h: 100 } },
          { id: 'shape:frame:plain', typeName: 'shape', type: 'frame', props: { w: 300, h: 300 } },
        ],
      },
    });
    expect(ids).toEqual([]);
  });
});
