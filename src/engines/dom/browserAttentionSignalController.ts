/**
 * Live browser attention signals for the DOM workspace digest.
 *
 * Tracks window focus/blur and `document.visibilitychange` as a Lit
 * `ReactiveController`. `@lit-labs/observers` ships Resize/Intersection/
 * Mutation/Performance controllers only, with no page-visibility or
 * window-focus observer in that package, so this follows the same
 * `ReactiveController` contract (host-lifecycle-driven `hostConnected` /
 * `hostDisconnected`, no unmanaged global listeners) instead of adding raw
 * `window`/`document` listeners with hand-rolled cleanup.
 *
 * Attach to any `ReactiveControllerHost` (a `LitElement`, or a minimal host
 * shim for imperative engines, see the DOM engine in `engine.ts`).
 */
import type {
  ReactiveController,
  ReactiveControllerHost,
} from '@lit/reactive-element/reactive-controller.js';
import {
  DEFAULT_BROWSER_ATTENTION_SIGNALS,
  type BrowserAttentionSignals,
} from './digestAttention';

export interface BrowserAttentionSignalControllerOptions {
  /** Called whenever the composited signals change. */
  onChange?: (signals: BrowserAttentionSignals) => void;
}

function readDocumentVisibility(): BrowserAttentionSignals['documentVisibility'] {
  if (typeof document === 'undefined') {
    return DEFAULT_BROWSER_ATTENTION_SIGNALS.documentVisibility;
  }
  return document.visibilityState === 'hidden' ? 'hidden': 'visible';
}

function readWindowFocused(): boolean {
  if (typeof document === 'undefined' || typeof document.hasFocus !== 'function') {
    return DEFAULT_BROWSER_ATTENTION_SIGNALS.windowFocused;
  }
  return document.hasFocus();
}

function readBrowserAttentionSignals(): BrowserAttentionSignals {
  return {
    documentVisibility: readDocumentVisibility(),
    windowFocused: readWindowFocused(),
  };
}

function signalsEqual(left: BrowserAttentionSignals, right: BrowserAttentionSignals): boolean {
  return (
    left.documentVisibility === right.documentVisibility &&
    left.windowFocused === right.windowFocused
  );
}

export class BrowserAttentionSignalController implements ReactiveController {
  private readonly host: ReactiveControllerHost;
  private readonly onChange: ((signals: BrowserAttentionSignals) => void) | undefined;
  private _signals: BrowserAttentionSignals;
  private _connected = false;

  constructor(
    host: ReactiveControllerHost,
    options: BrowserAttentionSignalControllerOptions = {}) {
    this.host = host;
    this.onChange = options.onChange;
    this._signals = readBrowserAttentionSignals();
    host.addController(this);
  }

  /** Current composited tab-focus + document-visibility signals. */
  get signals(): BrowserAttentionSignals {
    return this._signals;
  }

  hostConnected(): void {
    if (this._connected || typeof window === 'undefined') {
      return;
    }
    this._connected = true;
    window.addEventListener('focus', this._handleChange);
    window.addEventListener('blur', this._handleChange);
    document.addEventListener('visibilitychange', this._handleChange);
    this._refresh();
  }

  hostDisconnected(): void {
    if (!this._connected) {
      return;
    }
    this._connected = false;
    window.removeEventListener('focus', this._handleChange);
    window.removeEventListener('blur', this._handleChange);
    document.removeEventListener('visibilitychange', this._handleChange);
  }

  private readonly _handleChange = (): void => {
    this._refresh();
  };

  private _refresh(): void {
    const next = readBrowserAttentionSignals();
    if (signalsEqual(next, this._signals)) {
      return;
    }
    this._signals = next;
    this.onChange?.(next);
    this.host.requestUpdate();
  }
}
