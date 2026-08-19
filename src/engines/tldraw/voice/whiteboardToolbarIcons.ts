import type { TLUiAssetUrlOverrides } from 'tldraw';
import {
  VOICE_TOOL_ICON_DATA_URL,
  VOICE_TOOL_ICON_ID,
} from './voiceToolbarIcon';

/** Custom tldraw toolbar icon ids (career phase-B custom actions). */
export const ATTACH_TOOL_ICON_ID = 'landi-paperclip' as const;
export const RECENT_ACTIVITY_TOOL_ICON_ID = 'landi-clock' as const;
export const SCREENSHOT_TOOL_ICON_ID = 'landi-camera' as const;
export const DOCK_MENU_TOOL_ICON_ID = 'landi-layout-grid' as const;

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const STROKE_ICON = (paths: string) =>
  svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`,
  );

const ATTACH_SVG = STROKE_ICON(
  '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
);
const CLOCK_SVG = STROKE_ICON(
  '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
);
const CAMERA_SVG = STROKE_ICON(
  '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
);
const LAYOUT_GRID_SVG = STROKE_ICON(
  '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
);

/** Map host config / lucide-style icon names to registered tldraw icon ids. */
const ICON_ALIASES: Readonly<Record<string, string>> = {
  paperclip: ATTACH_TOOL_ICON_ID,
  attach: ATTACH_TOOL_ICON_ID,
  clock: RECENT_ACTIVITY_TOOL_ICON_ID,
  'recent-activity': RECENT_ACTIVITY_TOOL_ICON_ID,
  camera: SCREENSHOT_TOOL_ICON_ID,
  screenshot: SCREENSHOT_TOOL_ICON_ID,
  'layout-grid': DOCK_MENU_TOOL_ICON_ID,
  'dock-menu': DOCK_MENU_TOOL_ICON_ID,
  dock: DOCK_MENU_TOOL_ICON_ID,
  microphone: VOICE_TOOL_ICON_ID,
  voice: VOICE_TOOL_ICON_ID,
};

/**
 * Resolve a toolbar custom-action icon name to a tldraw-registered icon id.
 * Unknown ids fall back to `tool-pointer` (avoid question-mark placeholders).
 */
export function resolveWhiteboardToolbarIconId(icon: string | undefined): string {
  if (!icon?.trim()) {
    return 'tool-pointer';
  }
  const normalized = icon.trim().toLowerCase();
  return ICON_ALIASES[normalized] ?? normalized;
}

/** Module-level assetUrls — stable reference for `<Tldraw assetUrls={…}>`. */
export const whiteboardToolbarAssetUrls: TLUiAssetUrlOverrides = {
  icons: {
    [VOICE_TOOL_ICON_ID]: VOICE_TOOL_ICON_DATA_URL,
    [ATTACH_TOOL_ICON_ID]: ATTACH_SVG,
    [RECENT_ACTIVITY_TOOL_ICON_ID]: CLOCK_SVG,
    [SCREENSHOT_TOOL_ICON_ID]: CAMERA_SVG,
    [DOCK_MENU_TOOL_ICON_ID]: LAYOUT_GRID_SVG,
  },
};
