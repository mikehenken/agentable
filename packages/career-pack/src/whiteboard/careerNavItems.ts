/**
 * Map career-pack nav catalog entries to WhiteboardShell NavItemConfig.
 */
import {
  Briefcase,
  FileStack,
  FileText,
  GraduationCap,
  MessageSquare,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { NavItemConfig } from '../../../../src/components/chrome/navItems';
import type { CareerNavItem } from '../types';

const CAREER_NAV_ICONS: Record<string, LucideIcon> = {
  Briefcase,
  FileText,
  FileStack,
  GraduationCap,
  MessageSquare,
  TrendingUp,
  Wrench,
};

function resolveCareerNavIcon(iconName: string): LucideIcon {
  const resolved = CAREER_NAV_ICONS[iconName];
  if (resolved !== undefined) {
    return resolved;
  }
  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(
      `[career-pack] Unknown career nav icon "${iconName}"; falling back to Briefcase.`,
    );
  }
  return Briefcase;
}

/** Convert career-pack nav items into chrome NavItemConfig (Lucide components). */
export function careerNavItemsToNavConfig(
  items: readonly CareerNavItem[],
  allowedPanelIds?: ReadonlySet<string>,
): NavItemConfig[] {
  const filtered =
    allowedPanelIds !== undefined && allowedPanelIds.size > 0
      ? items.filter(
          (item) => allowedPanelIds.has(item.panelId) || item.panelId === 'chat',
        )
      : items;

  return filtered.map((item) => ({
    id: item.id,
    label: item.label,
    icon: resolveCareerNavIcon(item.icon),
    panelId: item.panelId,
    prefetchKey: item.panelId,
  }));
}
