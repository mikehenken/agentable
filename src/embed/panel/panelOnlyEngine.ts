/**
 * Headless engine for `<agentable-panel>` — satisfies `createCanvasHost` without
 * mounting tldraw or any canvas surface ( panel-only embed).
 */
import type { EngineLifecycleEvent, EngineLifecycleHandle, EnginePanelPlacement } from '../../engine/types';
import type { JsonObject } from '../../panels/types';
import { ensurePageSlotRegistry } from '../../session/pageSlots';

export class PanelOnlyEngine implements EngineLifecycleHandle {
  private readonly listeners: Record<EngineLifecycleEvent, Set<() => void>> = {
    ready: new Set(),
    change: new Set(),
  };

  /** Last placement request (tests + diagnostics). */
  lastOpen: EnginePanelPlacement | null = null;

  isReady(): boolean {
    return true;
  }

  on(event: EngineLifecycleEvent, listener: () => void): () => void {
    this.listeners[event].add(listener);
    return () => {
      this.listeners[event].delete(listener);
    };
  }

  exportSnapshot(): JsonObject {
    return {};
  }

  importSnapshot(_snapshot: JsonObject): void {
     // Panel-only embeds do not persist workspace snapshots.
  }

  openPanel(request: EnginePanelPlacement): void {
    this.lastOpen = request;

    if (request.slot && typeof window !== 'undefined') {
      ensurePageSlotRegistry().mountPanel(request.slot, {
        panelId: request.panelId,
        slotName: request.slot,
      });
    }

    for (const listener of this.listeners.change) {
      listener();
    }
  }
}
