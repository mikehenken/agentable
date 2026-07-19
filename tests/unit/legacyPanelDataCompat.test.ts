/**
 * A persisted document written by an older host, carrying only the
 * reserved `__*` panel data keys, must load with chrome behavior
 * identical to its typed-options twin. The whiteboard derives all chrome
 * rendering from `resolvePanelChrome`, labels and search text from
 * `shapeTextUtils`, and site grouping from `resolveSiteIdFromPanelData`,
 * so equal outputs across those seams for both documents proves the
 * legacy document behaves exactly like the typed one.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Editor, TLShape } from 'tldraw';
import {
  __resetPanelShapeApiForTests__,
  bindEditor,
  loadWhiteboardSnapshot,
} from '../../src/whiteboard/shapes/panelShapeApi';
import { resolvePanelChrome } from '../../src/panels/chrome';
import { resolveSiteIdFromPanelData } from '../../src/whiteboard/context/contextGroupApi';
import {
  getShapeLabel,
  getShapeSearchText,
} from '../../src/whiteboard/utils/shapeTextUtils';

interface PanelRecord {
  id: string;
  type: 'panel';
  x: number;
  y: number;
  props: {
    w: number;
    h: number;
    panelId: string;
    minimized: boolean;
    data: Record<string, unknown>;
  };
}

function panelRecord(panelId: string, data: Record<string, unknown>): PanelRecord {
  return {
    id: `shape:panel:${panelId}`,
    type: 'panel',
    x: 0,
    y: 0,
    props: { w: 480, h: 540, panelId, minimized: false, data },
  };
}

const LEGACY_RECORDS = [
  panelRecord('chat', { __title: 'Chat', __minimized: true, __siteId: 'site-1' }),
  panelRecord('web-preview', {
    __title: 'Preview',
    __fullBleed: true,
    __noBorder: true,
    siteName: 'Acme Landing',
  }),
  panelRecord('file-manager', { __hideChrome: true, __siteId: 'site-1' }),
];

const TYPED_RECORDS = [
  panelRecord('chat', {
    chrome: { title: 'Chat', minimized: true },
    scope: { contextId: 'site-1' },
  }),
  panelRecord('web-preview', {
    chrome: { title: 'Preview', fullBleed: true, noBorder: true },
    siteName: 'Acme Landing',
  }),
  panelRecord('file-manager', {
    chrome: { hideChrome: true },
    scope: { contextId: 'site-1' },
  }),
];

function snapshotOf(records: PanelRecord[]): unknown {
  return {
    document: {
      store: Object.fromEntries(records.map((record) => [record.id, record])),
    },
    session: {},
  };
}

function mockEditor(): Editor {
  return {
    getShapeUtil: () => ({ getText: () => undefined }),
  } as unknown as Editor;
}

beforeEach(() => {
  __resetPanelShapeApiForTests__();
});

describe('legacy document load', () => {
  it('accepts a snapshot whose panel shapes carry only legacy keys', () => {
    const snapshot = snapshotOf(LEGACY_RECORDS);
    expect(loadWhiteboardSnapshot(snapshot)).toBe(true);

    const loadSnapshot = vi.fn();
    // Queued path, as in loadWhiteboardSnapshot.test.ts: bindEditor's
    // deferred arrange/repair pass closes over this stub, so the page
    // readers keep it a no-op regardless of when the frame fires.
    bindEditor({
      loadSnapshot,
      getCurrentPageShapes: () => [],
      getSelectedShapeIds: () => [],
    } as never);
    expect(loadSnapshot).toHaveBeenCalledWith(snapshot);
  });

  it('resolves identical chrome for every legacy record and its typed twin', () => {
    for (const [index, legacy] of LEGACY_RECORDS.entries()) {
      const typed = TYPED_RECORDS[index]!;
      expect(resolvePanelChrome(legacy.props.data)).toEqual(
        resolvePanelChrome(typed.props.data),
      );
    }
  });

  it('resolves identical site grouping for every legacy record and its typed twin', () => {
    for (const [index, legacy] of LEGACY_RECORDS.entries()) {
      const typed = TYPED_RECORDS[index]!;
      expect(resolveSiteIdFromPanelData(legacy.props.data)).toBe(
        resolveSiteIdFromPanelData(typed.props.data),
      );
    }
    expect(resolveSiteIdFromPanelData(LEGACY_RECORDS[0]!.props.data)).toBe('site-1');
  });

  it('produces identical labels and search text for both documents', () => {
    const editor = mockEditor();
    for (const [index, legacy] of LEGACY_RECORDS.entries()) {
      const typed = TYPED_RECORDS[index]!;
      expect(getShapeLabel(editor, legacy as unknown as TLShape)).toBe(
        getShapeLabel(editor, typed as unknown as TLShape),
      );
      expect(getShapeSearchText(editor, legacy as unknown as TLShape)).toBe(
        getShapeSearchText(editor, typed as unknown as TLShape),
      );
    }
    expect(getShapeLabel(editor, LEGACY_RECORDS[0] as unknown as TLShape)).toBe('Chat');
    expect(
      getShapeSearchText(editor, LEGACY_RECORDS[1] as unknown as TLShape),
    ).toContain('Acme Landing');
  });
});
