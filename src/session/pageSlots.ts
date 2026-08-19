/**
 * Named page-session slots (section 15): hosts declare regions with
 * `data-agentable-slot="sidebar"`; agent `open_panel` targets them.
 */
import type { AgentablePanelMountConfig } from '../embed/mountAgentablePanel';
import { mountAgentablePanelIn } from '../embed/mountAgentablePanel';

export interface PageSlotRecord {
  slotId: string;
  mountElement: HTMLElement;
}

export interface PageSlotRegistry {
  register(slotId: string, mountElement: HTMLElement): () => void;
  get(slotId: string): HTMLElement | null;
  list(): readonly string[];
  mountPanel(slotId: string, config: AgentablePanelMountConfig): HTMLElement | null;
}

const GLOBAL_KEY = '__agentablePageSlots__';

declare global {
  interface Window {
    __agentablePageSlots__?: PageSlotRegistry;
  }
}

function createPageSlotRegistry(): PageSlotRegistry {
  const slots = new Map<string, HTMLElement>();

  return {
    register(slotId: string, mountElement: HTMLElement): () => void {
      const normalized = slotId.trim();
      if (!normalized) {
        return () => undefined;
      }
      if (slots.has(normalized) && slots.get(normalized) !== mountElement) {
        console.warn(`[pageSlots] replacing existing slot "${normalized}"`);
      }
      slots.set(normalized, mountElement);
      return () => {
        const current = slots.get(normalized);
        if (current === mountElement) {
          slots.delete(normalized);
        }
      };
    },
    get(slotId: string): HTMLElement | null {
      const normalized = slotId.trim();
      if (!normalized) {
        return null;
      }
      return slots.get(normalized) ?? null;
    },
    list(): readonly string[] {
      return [...slots.keys()];
    },
    mountPanel(slotId: string, config: AgentablePanelMountConfig): HTMLElement | null {
      const mountElement = this.get(slotId);
      if (mountElement === null) {
        console.warn(`[pageSlots] unknown slot "${slotId}"`);
        return null;
      }

      const normalizedConfig: AgentablePanelMountConfig = {
        ...config,
        slotName: config.slotName ?? slotId,
      };

      if (mountElement.tagName.toLowerCase() === 'agentable-panel') {
        mountElement.setAttribute('panel', normalizedConfig.panelId);
        if (normalizedConfig.slotName) {
          mountElement.setAttribute('slot-name', normalizedConfig.slotName);
        }
        return mountElement;
      }

      return mountAgentablePanelIn(mountElement, normalizedConfig);
    },
  };
}

export function ensurePageSlotRegistry(): PageSlotRegistry {
  if (typeof window === 'undefined') {
    throw new Error('[pageSlots] cannot install in a non-browser environment');
  }
  const existing = window[GLOBAL_KEY];
  if (existing) {
    return existing;
  }
  const registry = createPageSlotRegistry();
  window[GLOBAL_KEY] = registry;
  return registry;
}

export function getPageSlotRegistry(): PageSlotRegistry | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window[GLOBAL_KEY] ?? null;
}

/** Test-only reset. */
export function __resetPageSlotsForTests__(): void {
  if (typeof window !== 'undefined') {
    delete window[GLOBAL_KEY];
  }
}
