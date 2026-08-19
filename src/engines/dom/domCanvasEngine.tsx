/**
 * CanvasEngine factory for imperative DOM workspace mounting.
 */
import { createRoot, type Root } from 'react-dom/client';
import type { CanvasEngine, EngineHandle, EngineMountOptions } from '../../engine/types';
import { DomWorkspaceShell } from './DomWorkspaceShell';
import { createDomEngine } from './engine';

const reactRoots = new WeakMap<EngineHandle, Root>;

export function createDomCanvasEngine(): CanvasEngine {
  return {
    mount(container: HTMLElement, opts?: EngineMountOptions): EngineHandle {
      const handle = createDomEngine();
      if (opts?.mode !== undefined) {
        handle.setMode(opts.mode);
      }
      const root = createRoot(container);
      reactRoots.set(handle, root);
      root.render(<DomWorkspaceShell engine={handle} />);

      const baseDestroy = handle.destroy.bind(handle);
      handle.destroy = (): void => {
        const mountedRoot = reactRoots.get(handle);
        mountedRoot?.unmount;
        reactRoots.delete(handle);
        baseDestroy();
      };

      return handle;
    },
  };
}
