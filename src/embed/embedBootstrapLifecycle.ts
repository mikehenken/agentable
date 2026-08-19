/**
 * Shared embed bootstrap lifecycle — split ensureReady (one-time config load)
 * from explicit reload() (refetch). Prevents flicker when whenReady /
 * runScriptedTool fire during operator chat (P13-T7 iter-12).
 */

export interface EmbedBootstrapState {
  /** True after the first successful config load + React mount. */
  bootstrapped: boolean;
  /** In-flight initial bootstrap only — not cleared on completion. */
  ensureReadyPromise: Promise<void> | null;
  /** Last WhiteboardShell / CanvasShell props signature passed to React render. */
  lastRenderSignature: string | null;
}

export function createEmbedBootstrapState(): EmbedBootstrapState {
  return {
    bootstrapped: false,
    ensureReadyPromise: null,
    lastRenderSignature: null,
  };
}

/** Wait for initial config load once; subsequent calls are no-ops. */
export async function runEmbedEnsureReady(
  state: EmbedBootstrapState,
  reloadConfig: () => Promise<void>,
): Promise<void> {
  if (state.bootstrapped) {
    return;
  }
  if (state.ensureReadyPromise !== null) {
    await state.ensureReadyPromise;
    return;
  }
  state.ensureReadyPromise = reloadConfig().then(() => {
    state.bootstrapped = true;
  });
  await state.ensureReadyPromise;
}

/** Explicit config refetch (agentable:config-reloaded); keeps bootstrapped flag. */
export async function runEmbedExplicitReload(
  state: EmbedBootstrapState,
  reloadConfig: () => Promise<void>,
): Promise<void> {
  await reloadConfig();
  state.bootstrapped = true;
}

/** Skip React re-render when resolved embed props are unchanged. */
export function embedRenderSignatureChanged(
  state: EmbedBootstrapState,
  signature: string,
): boolean {
  if (state.lastRenderSignature === signature) {
    return false;
  }
  state.lastRenderSignature = signature;
  return true;
}
