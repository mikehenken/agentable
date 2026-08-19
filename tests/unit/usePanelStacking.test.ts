import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePanelStacking } from '../../src/engines/tldraw/hooks/usePanelStacking';

interface PageStateRecord {
  typeName: 'instance_page_state';
  selectedShapeIds: string[];
}

function makeEditorStub (){
  const listeners: Array<(entry: { changes: { updated: Record<string, [PageStateRecord, PageStateRecord]> } }) => void> = [];
  const shapes = new Map<string, { type: string }>([
    ['shape:panel:seo', { type: 'panel' }],
    ['shape:panel:history', { type: 'panel' }],
    ['shape:frame:site', { type: 'frame' }],
  ]);

  return {
    bringToFront: vi.fn(),
    getShape: vi.fn((id: string) => shapes.get(id) ?? undefined),
    store: {
      listen: vi.fn(
        (
          handler: (entry: {
            changes: { updated: Record<string, [PageStateRecord, PageStateRecord]> };
          }) => void) => {
          listeners.push(handler);
          return vi.fn();
        }),
    },
    emitSelectionChange(prevIds: string[], nextIds: string[]) {
      for (const listener of listeners) {
        listener({
          changes: {
            updated: {
              'page:state': [
                { typeName: 'instance_page_state', selectedShapeIds: prevIds },
                { typeName: 'instance_page_state', selectedShapeIds: nextIds },
              ],
            },
          },
        });
      }
    },
  };
}

describe('usePanelStacking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('brings newly selected panel shapes to front', () => {
    const editor = makeEditorStub();
    renderHook(() => usePanelStacking(editor as never));

    editor.emitSelectionChange(
      ['shape:panel:history'],
      ['shape:panel:seo']);

    expect(editor.bringToFront).toHaveBeenCalledWith(['shape:panel:seo']);
  });

  it('ignores selection changes that do not include panel shapes', () => {
    const editor = makeEditorStub();
    renderHook(() => usePanelStacking(editor as never));

    editor.emitSelectionChange([], ['shape:frame:site']);

    expect(editor.bringToFront).not.toHaveBeenCalled;
  });

  it('re-raises an already-selected panel when selection is unchanged', () => {
    const editor = makeEditorStub();
    renderHook(() => usePanelStacking(editor as never));

    editor.emitSelectionChange(['shape:panel:seo'], ['shape:panel:seo']);

    expect(editor.bringToFront).not.toHaveBeenCalled;
  });
});
