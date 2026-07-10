/**
 * useContextGroupAutoResize — editor event subscription cleanup.
 *
 * tldraw Editor extends EventEmitter3: `on()` returns the editor for chaining,
 * not an unsubscribe function. Cleanup must call `off(event, handler)`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createShapeId, type Editor } from 'tldraw';
import { useContextGroupAutoResize } from '../../src/whiteboard/hooks/useContextGroupAutoResize';

vi.mock('../../src/whiteboard/context/contextGroupApi', () => ({
  collectPanelShapeIdsFromStoreDiff: vi.fn(() => []),
  findSiteContextGroupForShape: vi.fn(() => null),
  fitContextGroupFrameToContent: vi.fn(),
  ensurePanelInSiteContextFrame: vi.fn(),
}));

interface StubEditor {
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  store: { listen: ReturnType<typeof vi.fn> };
  isIn: ReturnType<typeof vi.fn>;
  getShape: ReturnType<typeof vi.fn>;
  getSelectedShapeIds: ReturnType<typeof vi.fn>;
}

function makeStubEditor(): StubEditor {
  const editor: StubEditor = {
    on: vi.fn(function (this: StubEditor) {
      return this;
    }),
    off: vi.fn(),
    store: {
      listen: vi.fn(() => vi.fn()),
    },
    isIn: vi.fn(() => false),
    getShape: vi.fn(() => undefined),
    getSelectedShapeIds: vi.fn(() => []),
  };
  return editor;
}

describe('useContextGroupAutoResize', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers editor event listener and removes it with off() on unmount', () => {
    const stub = makeStubEditor();
    const editor = stub as unknown as Editor;

    const { unmount } = renderHook(() => useContextGroupAutoResize(editor));

    expect(stub.on).toHaveBeenCalledWith('event', expect.any(Function));
    expect(stub.store.listen).toHaveBeenCalledWith(expect.any(Function), {
      source: 'user',
      scope: 'document',
    });

    const eventHandler = stub.on.mock.calls[0]?.[1] as (info: { name: string }) => void;
    expect(typeof eventHandler).toBe('function');

    unmount();

    expect(stub.off).toHaveBeenCalledWith('event', eventHandler);
    expect(stub.store.listen.mock.results[0]?.value).toHaveBeenCalled();
  });

  it('handles pointer_up without throwing', () => {
    const panelId = createShapeId('panel-test');
    const stub = makeStubEditor();
    stub.getSelectedShapeIds.mockReturnValue([panelId]);
    stub.getShape.mockImplementation((id: string) =>
      id === panelId ? { id, type: 'panel', props: { data: {} } } : undefined,
    );

    const editor = stub as unknown as Editor;
    renderHook(() => useContextGroupAutoResize(editor));

    const eventHandler = stub.on.mock.calls[0]?.[1] as (info: { name: string }) => void;

    expect(() => eventHandler({ name: 'pointer_up' })).not.toThrow();
    expect(stub.getSelectedShapeIds).toHaveBeenCalled();
  });
});
