/**
 * ChunkErrorBoundary — catches `React.lazy` chunk-load failures.
 *
 * Production failure modes covered:
 *   - Network blip: user opens panel, CDN request times out
 *   - CDN 503 / origin error
 *   - Stale chunk hash: a deploy happened mid-session, the old chunk
 *     URL now 404s, the user's session held the previous main chunk
 *     and tries to load a chunk that no longer exists
 *
 * Without this boundary, any of those throws an unhandled exception that
 * React surfaces as a silent empty tree above the parent Suspense — the
 * panel doesn't appear, no error fires for the user, only console noise.
 * That's the single most common production failure mode for `React.lazy`.
 *
 * Recovery affordance: a tokenized "Reload to continue" button that calls
 * `window.location.reload()`. Aggressive but reliable — chunk hash is
 * baked into the build, so re-fetching the index re-pins to current
 * artifact URLs.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Cross-bundler chunk-failure messages. Vite, Webpack, esbuild + Safari
// each emit slightly different strings; match them all so we don't miss
// a real production failure mode.
const CHUNK_ERROR_PATTERNS = [
  /ChunkLoadError/i,
  /Loading (CSS )?chunk [\w-]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  /Unable to preload CSS/i,
];

function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return CHUNK_ERROR_PATTERNS.some((re) => re.test(msg));
}

export class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  // Pure state derivation only. Re-throwing inside this method is
  // undefined behavior (React 18+ may unmount the parent tree, double-
  // invoke `componentDidCatch`, or in concurrent mode trigger a render
  // loop). The canonical pattern is: store the error, then in `render()`
  // re-throw if it's not a chunk-load error so the next boundary up the
  // tree receives it via the standard render-phase throw path.
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the failure to telemetry / console for ops visibility.
     
    console.error('[agentable-canvas] chunk load failed', { error, info });
    // Also dispatch a typed CustomEvent so embedders can wire telemetry
    // without monkey-patching `console`. Per web-components-ui rule §6.
    if (typeof window !== 'undefined' && isChunkLoadError(error)) {
      window.dispatchEvent(
        new CustomEvent('landi:chunk-load-failed', {
          detail: { message: error.message, timestamp: new Date().toISOString() },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  private handleRetry = (): void => {
    // Soft retry — clear the error so React re-attempts the lazy import.
    // If the chunk is genuinely gone (post-deploy stale hash), the failure
    // will recur and the boundary re-shows. If it was a network blip,
    // this avoids a full page reload that tears down the voice WebSocket.
    this.setState({ error: null });
  };

  private handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    // CRITICAL: re-throwing inside render() is the canonical React pattern
    // for "this isn't my error, propagate" — React catches it via the next
    // boundary up the tree, exactly as if the original throw had reached
    // there. (Safer than re-throwing inside getDerivedStateFromError.)
    if (!isChunkLoadError(error)) {
      throw error;
    }

    // Tokenized fallback — uses the canvas's brand tokens via inline
    // style so the message inherits tenant theming. `role="alert"` +
    // `aria-live="assertive"` for cross-screen-reader robustness when
    // the alert appears via post-mount setState.
    return (
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="absolute inset-0 flex items-center justify-center p-6"
        style={{ zIndex: 200 }}
      >
        <div
          className="max-w-sm text-center p-6 rounded-2xl border bg-canvas-surface"
          style={{
            borderColor: 'var(--landi-color-border, #E5E5E5)',
            boxShadow: 'var(--landi-shadow-md, 0 4px 12px rgba(0,0,0,0.06))',
          }}
        >
          <p className="text-sm font-medium text-canvas mb-2">
            Couldn&apos;t load this part of the canvas.
          </p>
          <p className="text-xs text-canvas-muted mb-4">
            A network hiccup or deploy mid-session interrupted the load.
            Try again, or reload the page if that doesn&apos;t work.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              onClick={this.handleRetry}
              className="text-sm font-medium px-4 py-2 rounded-lg border bg-canvas-surface hover:bg-canvas-surface-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
              style={{
                borderColor: 'var(--landi-color-border, #E5E5E5)',
                color: 'var(--landi-color-text, #1A1A1A)',
                // Tailwind `ring-*` is box-shadow-driven; `--tw-ring-color`
                // is the variable Tailwind reads when computing the ring.
                // Setting it inline gives the focus ring its tenant color.
                ['--tw-ring-color' as string]: 'var(--landi-color-primary, #0D7377)',
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="text-sm font-medium px-4 py-2 rounded-lg text-white bg-canvas-primary hover:bg-canvas-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
              style={{
                ['--tw-ring-color' as string]: 'var(--landi-color-primary, #0D7377)',
              }}
            >
              Reload to continue
            </button>
          </div>
        </div>
      </div>
    );
  }
}
