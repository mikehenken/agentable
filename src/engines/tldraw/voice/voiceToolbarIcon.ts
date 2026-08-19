import type { TLUiAssetUrlOverrides } from 'tldraw';

/**
 * Custom tldraw icon id for the bottom-toolbar voice tool.
 * tldraw's built-in sprite has no microphone audio glyph — unknown ids
 * fall back to `question-mark-circle` (looks like a Help button).
 */
export const VOICE_TOOL_ICON_ID = 'microphone' as const;

/**
 * Mask-friendly microphone SVG (black on transparent) for CSS `mask-image`.
 * Inline data URL keeps the embed self-contained (no extra public asset).
 */
const MICROPHONE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`;

export const VOICE_TOOL_ICON_DATA_URL =
  `data:image/svg+xml,${encodeURIComponent(MICROPHONE_SVG)}` as const;

/** Module-level assetUrls fragment — stable reference for `<Tldraw assetUrls={…}>`. */
export const whiteboardVoiceAssetUrls: TLUiAssetUrlOverrides = {
  icons: {
    [VOICE_TOOL_ICON_ID]: VOICE_TOOL_ICON_DATA_URL,
  },
};
