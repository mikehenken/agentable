/**
 * Nav sidebar config — hosts and packs supply items; framework defaults are empty.
 */
import type { ComponentType } from 'react';

export interface NavItemConfig {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  panelId: string;
  prefetchKey?: string;
}

/** Example-only default (B2): empty; career demo nav lives in the career domain pack. */
export const DEFAULT_NAV_ITEMS: NavItemConfig[] = [];

/** Whiteboard shell default — chat-only example wiring. */
export const DEFAULT_WHITEBOARD_NAV_ITEMS: NavItemConfig[] = [];
