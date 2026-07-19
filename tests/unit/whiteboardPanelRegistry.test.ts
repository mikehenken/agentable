/**
 * The registry bridge behind `WhiteboardShell`'s two wirings. The
 * deprecated `panels` loader-map prop and the preferred `host` prop must
 * resolve through one code path (`resolveWhiteboardPanelLoaders`), and
 * the deprecated alias must keep behaving exactly as before: same panel
 * ids, same loader references, stable identity across repeated
 * resolution so `useLazyPanel`'s memoisation keeps holding.
 */
import { describe, it, expect } from 'vitest';
import type { ComponentType } from 'react';
import { createCanvasHost, type EngineHandle } from '../../src/panels/host';
import type { ReactPanelDefinition } from '../../src/panels/registry';
import type { PanelDefinition, PanelProps } from '../../src/panels/types';
import {
  DEFAULT_WHITEBOARD_PANEL_REGISTRY,
  resolveWhiteboardPanelLoaders,
  whiteboardLoadersForDefinitions,
} from '../../src/whiteboard/shapes/whiteboardPanelRegistry';

const NullPanel: ComponentType<PanelProps> = () => null;

function reactDefinition(id: string): ReactPanelDefinition {
  return {
    kind: 'react',
    id,
    meta: { title: id, schemaVersion: 1 },
    loader: () => Promise.resolve({ default: NullPanel }),
  };
}

function stubEngine(): EngineHandle {
  return {
    isReady: () => true,
    on: () => () => {},
    exportSnapshot: () => ({}),
    importSnapshot: () => {},
  };
}

describe('whiteboardLoadersForDefinitions', () => {
  it('projects react definitions onto a loader map', () => {
    const chat = reactDefinition('chat');
    const brief = reactDefinition('project-brief');
    const map = whiteboardLoadersForDefinitions([chat, brief]);

    expect(Object.keys(map)).toEqual(['chat', 'project-brief']);
    expect(map.chat).toBe(chat.loader);
  });

  it('skips spec definitions, which have no component to mount', () => {
    const spec: PanelDefinition = {
      kind: 'spec',
      id: 'seo',
      meta: { title: 'SEO', schemaVersion: 1 },
      spec: {
        v: 1,
        origin: 'host',
        root: 'body',
        nodes: { body: { type: 'panel-body' } },
      },
    };
    const map = whiteboardLoadersForDefinitions([spec, reactDefinition('chat')]);

    expect(Object.keys(map)).toEqual(['chat']);
  });

  it('returns the cached map for the same definitions instance', () => {
    const definitions = [reactDefinition('chat')];

    expect(whiteboardLoadersForDefinitions(definitions)).toBe(
      whiteboardLoadersForDefinitions(definitions),
    );
  });
});

describe('resolveWhiteboardPanelLoaders', () => {
  it('keeps the deprecated loader-map alias behaving exactly as before', () => {
    const map = resolveWhiteboardPanelLoaders(
      undefined,
      DEFAULT_WHITEBOARD_PANEL_REGISTRY,
    );

    expect(Object.keys(map)).toEqual(
      Object.keys(DEFAULT_WHITEBOARD_PANEL_REGISTRY),
    );
    for (const [id, original] of Object.entries(DEFAULT_WHITEBOARD_PANEL_REGISTRY)) {
      expect(map[id]).toBe(original);
    }
  });

  it('resolves the same map instance for the same alias input', () => {
    const first = resolveWhiteboardPanelLoaders(
      undefined,
      DEFAULT_WHITEBOARD_PANEL_REGISTRY,
    );
    const second = resolveWhiteboardPanelLoaders(
      undefined,
      DEFAULT_WHITEBOARD_PANEL_REGISTRY,
    );

    expect(second).toBe(first);
  });

  it('prefers the host registry over the loader-map alias', () => {
    const hostPanel = reactDefinition('all-sites');
    const host = createCanvasHost({ engine: stubEngine(), panels: [hostPanel] });

    const map = resolveWhiteboardPanelLoaders(
      host,
      DEFAULT_WHITEBOARD_PANEL_REGISTRY,
    );

    expect(Object.keys(map)).toEqual(['all-sites']);
    expect(map['all-sites']).toBe(hostPanel.loader);
  });
});
