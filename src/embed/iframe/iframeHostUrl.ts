/**
 * Build and parse canonical agentable iframe host URLs (oEmbed + iframe).
 */
import {
  IFRAME_EMBED_DEFAULT_HEIGHT,
  IFRAME_EMBED_DEFAULT_WIDTH,
  IFRAME_EMBED_SANDBOX,
  type EmbedBridgeSurface,
} from '../iframe/embedBridgeProtocol';

export interface IframeHostEmbedParams {
  surface: EmbedBridgeSurface;
  panel?: string;
  widget?: string;
  configUrl?: string;
  panelDataUrl?: string;
  primaryColor?: string;
  locale?: string;
  slotName?: string;
  hideChrome?: boolean;
  parentOrigin?: string;
  bridgeId?: string;
  width?: number;
  height?: number;
}

export interface ParsedIframeHostUrl {
  embedBaseOrigin: string;
  params: IframeHostEmbedParams;
}

const HOST_PATH = '/embed/iframe-host.html';

function appendOptionalParam(
  search: URLSearchParams,
  key: string,
  value: string | number | boolean | undefined,
): void {
  if (value === undefined) {
    return;
  }
  if (typeof value === 'boolean') {
    search.set(key, value ? '1' : '0');
    return;
  }
  const trimmed = String(value).trim();
  if (trimmed) {
    search.set(key, trimmed);
  }
}

export function buildIframeHostUrl(
  embedBaseUrl: string,
  params: IframeHostEmbedParams,
): string {
  const base = new URL(embedBaseUrl);
  base.pathname = HOST_PATH;
  base.search = '';
  base.hash = '';

  const search = new URLSearchParams();
  search.set('surface', params.surface);
  appendOptionalParam(search, 'panel', params.panel);
  appendOptionalParam(search, 'widget', params.widget);
  appendOptionalParam(search, 'config-url', params.configUrl);
  appendOptionalParam(search, 'panel-data-url', params.panelDataUrl);
  appendOptionalParam(search, 'primary-color', params.primaryColor);
  appendOptionalParam(search, 'locale', params.locale);
  appendOptionalParam(search, 'slot-name', params.slotName);
  appendOptionalParam(search, 'hide-chrome', params.hideChrome);
  appendOptionalParam(search, 'parent-origin', params.parentOrigin);
  appendOptionalParam(search, 'bridge-id', params.bridgeId);
  appendOptionalParam(search, 'width', params.width);
  appendOptionalParam(search, 'height', params.height);

  base.search = search.toString();
  return base.toString();
}

export function parseIframeHostUrl(urlString: string): ParsedIframeHostUrl | null {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }
  if (!url.pathname.endsWith(HOST_PATH)) {
    return null;
  }

  const search = url.searchParams;
  const surfaceRaw = search.get('surface')?.trim();
  const surface =
    surfaceRaw === 'panel' || surfaceRaw === 'canvas' || surfaceRaw === 'widget'
      ? surfaceRaw
      : null;
  if (surface === null) {
    return null;
  }

  const hideChromeRaw = search.get('hide-chrome');
  const widthRaw = search.get('width');
  const heightRaw = search.get('height');

  return {
    embedBaseOrigin: url.origin,
    params: {
      surface,
      panel: search.get('panel')?.trim() || undefined,
      widget: search.get('widget')?.trim() || undefined,
      configUrl: search.get('config-url')?.trim() || undefined,
      panelDataUrl: search.get('panel-data-url')?.trim() || undefined,
      primaryColor: search.get('primary-color')?.trim() || undefined,
      locale: search.get('locale')?.trim() || undefined,
      slotName: search.get('slot-name')?.trim() || undefined,
      hideChrome: hideChromeRaw === '1' || hideChromeRaw === 'true',
      parentOrigin: search.get('parent-origin')?.trim() || undefined,
      bridgeId: search.get('bridge-id')?.trim() || undefined,
      width: widthRaw ? Number(widthRaw) : undefined,
      height: heightRaw ? Number(heightRaw) : undefined,
    },
  };
}

export function buildSandboxedIframeHtml(
  iframeSrc: string,
  width: number = IFRAME_EMBED_DEFAULT_WIDTH,
  height: number = IFRAME_EMBED_DEFAULT_HEIGHT,
  title = 'Agentable embed',
): string {
  const escapedSrc = iframeSrc
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
  const escapedTitle = title
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
  return `<iframe src="${escapedSrc}" width="${width}" height="${height}" frameborder="0" sandbox="${IFRAME_EMBED_SANDBOX}" referrerpolicy="strict-origin-when-cross-origin" loading="lazy" title="${escapedTitle}"></iframe>`;
}

export function readIframeHostParamsFromSearchParams(
  params: URLSearchParams,
): IframeHostEmbedParams | null {
  const surfaceRaw = params.get('surface')?.trim();
  const surface =
    surfaceRaw === 'panel' || surfaceRaw === 'canvas' || surfaceRaw === 'widget'
      ? surfaceRaw
      : null;
  if (surface === null) {
    return null;
  }
  const hideChromeRaw = params.get('hide-chrome');
  return {
    surface,
    panel: params.get('panel')?.trim() || undefined,
    widget: params.get('widget')?.trim() || undefined,
    configUrl: params.get('config-url')?.trim() || undefined,
    panelDataUrl: params.get('panel-data-url')?.trim() || undefined,
    primaryColor: params.get('primary-color')?.trim() || undefined,
    locale: params.get('locale')?.trim() || undefined,
    slotName: params.get('slot-name')?.trim() || undefined,
    hideChrome: hideChromeRaw === '1' || hideChromeRaw === 'true',
    parentOrigin: params.get('parent-origin')?.trim() || undefined,
    bridgeId: params.get('bridge-id')?.trim() || undefined,
  };
}
