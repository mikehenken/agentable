/**
 * Runtime bridge for story-mode walkthrough (P8-T6). Binds when the
 * whiteboard editor and host camera queue are available.
 */
import type { CameraQueue } from './camera';
import type { WalkthroughCameraIntent, WalkthroughTarget } from './walkthroughTypes';

export interface WalkthroughRuntimeBinding {
  camera: CameraQueue;
  resolveTarget: (target: WalkthroughTarget) => WalkthroughCameraIntent | null;
  applyIntent: (intent: WalkthroughCameraIntent) => void;
  registerCancelListener?: (onCancel: () => void) => () => void;
}

let boundRuntime: WalkthroughRuntimeBinding | null = null;

export function bindWalkthroughRuntime(binding: WalkthroughRuntimeBinding): () => void {
  boundRuntime = binding;
  return () => {
    if (boundRuntime === binding) {
      boundRuntime = null;
    }
  };
}

export function getWalkthroughRuntime(): WalkthroughRuntimeBinding | null {
  return boundRuntime;
}

export function resetWalkthroughRuntimeForTests(): void {
  boundRuntime = null;
}

export function isWalkthroughRuntimeBound(): boolean {
  return boundRuntime !== null;
}
