/**
 * BrowserAttentionSignalController tracks window focus + document
 * visibility as a Lit ReactiveController.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactiveControllerHost } from '@lit/reactive-element/reactive-controller.js';
import { BrowserAttentionSignalController } from '../../src/engines/dom/browserAttentionSignalController';

function createHost(): ReactiveControllerHost & { requestUpdate: ReturnType<typeof vi.fn> } {
  return {
    addController: vi.fn(),
    removeController: vi.fn(),
    requestUpdate: vi.fn(),
    updateComplete: Promise.resolve(true),
  };
}

function setDocumentVisibility(value: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => value,
  });
}

function setWindowFocused(value: boolean): void {
  vi.spyOn(document, 'hasFocus').mockReturnValue(value);
}

describe('BrowserAttentionSignalController', () => {
  afterEach(() => {
    setDocumentVisibility('visible');
    vi.restoreAllMocks();
  });

  it('registers itself with the host on construction', () => {
    const host = createHost();
    new BrowserAttentionSignalController(host);
    expect(host.addController).toHaveBeenCalledTimes(1);
  });

  it('reads the initial signals from document state at construction time', () => {
    setDocumentVisibility('hidden');
    setWindowFocused(false);
    const controller = new BrowserAttentionSignalController(createHost());
    expect(controller.signals).toEqual({ documentVisibility: 'hidden', windowFocused: false });
  });

  it('updates signals and requests a host update on visibilitychange after connecting', () => {
    const host = createHost();
    const controller = new BrowserAttentionSignalController(host);
    controller.hostConnected();
    host.requestUpdate.mockClear();
    setDocumentVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(controller.signals.documentVisibility).toBe('hidden');
    expect(host.requestUpdate).toHaveBeenCalledTimes(1);
  });

  it('updates signals and requests a host update on window blur/focus after connecting', () => {
    const host = createHost();
    const controller = new BrowserAttentionSignalController(host);
    controller.hostConnected();
    host.requestUpdate.mockClear();
    setWindowFocused(false);
    window.dispatchEvent(new Event('blur'));

    expect(controller.signals.windowFocused).toBe(false);
    expect(host.requestUpdate).toHaveBeenCalledTimes(1);

    host.requestUpdate.mockClear();
    setWindowFocused(true);
    window.dispatchEvent(new Event('focus'));

    expect(controller.signals.windowFocused).toBe(true);
    expect(host.requestUpdate).toHaveBeenCalledTimes(1);
  });

  it('invokes the onChange callback with the new signals', () => {
    const host = createHost();
    const onChange = vi.fn();
    const controller = new BrowserAttentionSignalController(host, { onChange });
    controller.hostConnected();
    setDocumentVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(onChange).toHaveBeenCalledWith({ documentVisibility: 'hidden', windowFocused: true });
    void controller;
  });

  it('does not request a host update when a dispatched event carries no signal change', () => {
    const host = createHost();
    const controller = new BrowserAttentionSignalController(host);
    controller.hostConnected();
    host.requestUpdate.mockClear();
    document.dispatchEvent(new Event('visibilitychange'));

    expect(host.requestUpdate).not.toHaveBeenCalled();
    void controller;
  });

  it('stops reacting to signal changes after hostDisconnected', () => {
    const host = createHost();
    const controller = new BrowserAttentionSignalController(host);
    controller.hostConnected();
    controller.hostDisconnected();
    host.requestUpdate.mockClear();
    setDocumentVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    setWindowFocused(false);
    window.dispatchEvent(new Event('blur'));

    expect(host.requestUpdate).not.toHaveBeenCalled();
    expect(controller.signals).toEqual({ documentVisibility: 'visible', windowFocused: true });
  });

  it('is idempotent across repeated hostConnected/hostDisconnected calls', () => {
    const host = createHost();
    const controller = new BrowserAttentionSignalController(host);

    controller.hostConnected();
    controller.hostConnected();
    controller.hostDisconnected();
    controller.hostDisconnected();
    host.requestUpdate.mockClear();
    setDocumentVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(host.requestUpdate).not.toHaveBeenCalled();
  });
});
