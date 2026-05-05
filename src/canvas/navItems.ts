/**
 * Nav-sidebar item config — siblings to `PanelRegistry`. The shell exposes
 * BOTH via props on `<CanvasShell>` and forwards them through React context
 * so `NavSidebar` (and any future tenant chrome) can render the right
 * surface for the active tenant.
 *
 * Every nav item points at a `panelId` to open. If that panel is lazy-
 * loaded, set `prefetchKey` to the corresponding `PanelRegistry` key so
 * hover/focus warms the chunk ~100 ms before the click. Items pointing
 * at eager panels (chat, artifacts, voice) leave `prefetchKey` undefined.
 */
import type { ComponentType } from 'react';
import {
  Briefcase,
  FileText,
  GraduationCap,
  MessageSquare,
  TrendingUp,
  Wrench,
} from 'lucide-react';

export interface NavItemConfig {
  /** Stable key — React `key` + telemetry. */
  id: string;
  /** Visible label in the expanded sidebar; also `title` attr in the
   *  collapsed icon-only state for accessibility. */
  label: string;
  /** Lucide icon component (or any `ComponentType<{ size?: number; className?: string }>`).
   *  Tenants supplying their own glyphs should match the prop shape. */
  icon: ComponentType<{ size?: number; className?: string }>;
  /** Layout-store id of the panel to show on click. */
  panelId: string;
  /**
   * `PanelRegistry` key for hover/focus prefetch. Optional — if omitted,
   * `NavSidebar` falls back to `panelId`, then membership-checks against
   * the active registry (so eager panels naturally skip). Set explicitly
   * only when the nav id and the registry key diverge.
   */
  prefetchKey?: string;
}

/**
 * Default nav set — example career-themed configuration (mirrors
 * `DEFAULT_PANEL_REGISTRY`). Tenant wrappers supply their own via
 * `<CanvasShell navItems={...}>` to drop, replace, or add items.
 */
export const DEFAULT_NAV_ITEMS: NavItemConfig[] = [
  { id: 'positions', label: 'Open Positions', icon: Briefcase, panelId: 'open-positions', prefetchKey: 'positions' },
  { id: 'chat', label: 'New Chat', icon: MessageSquare, panelId: 'chat' },
  { id: 'applications', label: 'My Applications', icon: FileText, panelId: 'applications', prefetchKey: 'applications' },
  { id: 'resume', label: 'Resume & Docs', icon: FileText, panelId: 'artifacts' },
  { id: 'resources', label: 'Resources', icon: GraduationCap, panelId: 'resources', prefetchKey: 'resources' },
  { id: 'trajectories', label: 'Growth Paths', icon: TrendingUp, panelId: 'growth-paths', prefetchKey: 'trajectories' },
  { id: 'tools', label: 'Career Tools', icon: Wrench, panelId: 'career-tools', prefetchKey: 'tools' },
];
