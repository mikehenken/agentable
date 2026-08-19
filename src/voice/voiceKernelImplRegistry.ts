/**
 * Reference-counted voice kernel impl registration — multiple `useGeminiLive`
 * mounts (dock + floating operator) must not clear the transport when one
 * surface remounts after gallery chrome reparenting (P13-T7 iter-7).
 */
import { ensureVoiceKernel, type VoiceKernelImpl } from '../shared/voiceKernel';

const implByMount = new Map<symbol, VoiceKernelImpl>();

function syncActiveImpl(): void {
  const kernel = ensureVoiceKernel();
  const entries = [...implByMount.entries()];
  if (entries.length === 0) {
    kernel.voice._clearImpl();
    return;
  }
  const [, activeImpl] = entries[entries.length - 1];
  kernel.voice._setImpl(activeImpl);
}

/**
 * Register a voice transport impl for one React mount. Returns unregister.
 * The most recently registered mount wins when multiple are active.
 */
export function registerVoiceKernelImpl(mountId: symbol, impl: VoiceKernelImpl): () => void {
  implByMount.set(mountId, impl);
  syncActiveImpl();
  return () => {
    implByMount.delete(mountId);
    syncActiveImpl();
  };
}

/** Test-only reset. */
export function __resetVoiceKernelImplRegistryForTests__(): void {
  implByMount.clear();
  ensureVoiceKernel().voice._clearImpl();
}
