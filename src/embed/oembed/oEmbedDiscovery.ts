/**
 * oEmbed discovery links and response builders.
 */
import {
  IFRAME_EMBED_DEFAULT_HEIGHT,
  IFRAME_EMBED_DEFAULT_WIDTH,
} from '../iframe/embedBridgeProtocol';
import {
  buildIframeHostUrl,
  buildSandboxedIframeHtml,
  parseIframeHostUrl,
  type IframeHostEmbedParams,
} from '../iframe/iframeHostUrl';
import {
  OEMBED_CACHE_AGE_SECONDS,
  OEMBED_PROVIDER_NAME,
  type OEmbedDiscoveryLink,
  type OEmbedRequestParams,
  type OEmbedResponse,
  type OEmbedRichResponse,
} from './oEmbedTypes';

export interface OEmbedServiceConfig {
  embedBaseUrl: string;
  providerUrl: string;
  oEmbedEndpointPath?: string;
}

const DEFAULT_OEMBED_PATH = '/oembed';

function clampDimension(value: number | undefined, fallback: number, max?: number): number {
  if (value === undefined || Number.isNaN(value) || value <= 0) {
    return fallback;
  }
  if (max !== undefined && value > max) {
    return max;
  }
  return Math.round(value);
}

export function buildOEmbedDiscoveryLink(
  pageUrl: string,
  config: OEmbedServiceConfig): OEmbedDiscoveryLink {
  const endpoint = new URL(config.oEmbedEndpointPath ?? DEFAULT_OEMBED_PATH, config.embedBaseUrl);
  endpoint.searchParams.set('url', pageUrl);
  endpoint.searchParams.set('format', 'json');
  return {
    rel: 'alternate',
    type: 'application/json+oembed',
    href: endpoint.toString(),
    title: OEMBED_PROVIDER_NAME,
  };
}

export function renderOEmbedDiscoveryLinkTag(link: OEmbedDiscoveryLink): string {
  const titleAttr = link.title ? ` title="${link.title.replace(/"/g, '&quot;')}"`: '';
  return `<link rel="${link.rel}" type="${link.type}" href="${link.href.replace(/"/g, '&quot;')}"${titleAttr} />`;
}

export function resolveOEmbedTitle(params: IframeHostEmbedParams): string {
  if (params.surface === 'panel' && params.panel) {
    return `Agentable panel: ${params.panel}`;
  }
  if (params.surface === 'widget' && params.widget) {
    return `Agentable widget: ${params.widget}`;
  }
  if (params.surface === 'canvas') {
    return 'Agentable canvas';
  }
  return 'Agentable embed';
}

export function buildOEmbedResponseForIframeParams(
  iframeParams: IframeHostEmbedParams,
  config: OEmbedServiceConfig,
  request?: Pick<OEmbedRequestParams, 'maxwidth' | 'maxheight'>): OEmbedRichResponse {
  const width = clampDimension(
    request?.maxwidth ?? iframeParams.width,
    IFRAME_EMBED_DEFAULT_WIDTH,
    request?.maxwidth);
  const height = clampDimension(
    request?.maxheight ?? iframeParams.height,
    IFRAME_EMBED_DEFAULT_HEIGHT,
    request?.maxheight);

  const iframeSrc = buildIframeHostUrl(config.embedBaseUrl, {...iframeParams,
    width,
    height,
  });

  return {
    version: '1.0',
    type: 'rich',
    provider_name: OEMBED_PROVIDER_NAME,
    provider_url: config.providerUrl,
    title: resolveOEmbedTitle(iframeParams),
    width,
    height,
    html: buildSandboxedIframeHtml(iframeSrc, width, height, resolveOEmbedTitle(iframeParams)),
    cache_age: OEMBED_CACHE_AGE_SECONDS,
  };
}

export function buildOEmbedError(message: string): OEmbedResponse {
  return { error: true, message };
}

export function handleOEmbedRequest(
  request: OEmbedRequestParams,
  config: OEmbedServiceConfig): OEmbedResponse {
  const parsed = parseIframeHostUrl(request.url);
  if (parsed === null) {
    return buildOEmbedError('Unsupported embed URL for oEmbed discovery.');
  }

  return buildOEmbedResponseForIframeParams(parsed.params, config, {
    maxwidth: request.maxwidth,
    maxheight: request.maxheight,
  });
}

export function parseOEmbedQuery(searchParams: URLSearchParams): OEmbedRequestParams | null {
  const url = searchParams.get('url')?.trim();
  if (!url) {
    return null;
  }
  const maxwidthRaw = searchParams.get('maxwidth');
  const maxheightRaw = searchParams.get('maxheight');
  return {
    url,
    format: searchParams.get('format') === 'json' ? 'json': undefined,
    maxwidth: maxwidthRaw ? Number(maxwidthRaw): undefined,
    maxheight: maxheightRaw ? Number(maxheightRaw): undefined,
  };
}

export function serializeOEmbedResponse(response: OEmbedResponse): string {
  return JSON.stringify(response);
}

export function createOEmbedHttpHandler(config: OEmbedServiceConfig): (
  requestUrl: string) => { status: number; body: string; contentType: string } {
  return (requestUrl: string) => {
    let url: URL;
    try {
      url = new URL(requestUrl, config.embedBaseUrl);
    } catch {
      return {
        status: 400,
        body: serializeOEmbedResponse(buildOEmbedError('Invalid request URL.')),
        contentType: 'application/json; charset=utf-8',
      };
    }

    const params = parseOEmbedQuery(url.searchParams);
    if (params === null) {
      return {
        status: 400,
        body: serializeOEmbedResponse(buildOEmbedError('Missing required url parameter.')),
        contentType: 'application/json; charset=utf-8',
      };
    }

    const response = handleOEmbedRequest(params, config);
    if ('error' in response) {
      return {
        status: 404,
        body: serializeOEmbedResponse(response),
        contentType: 'application/json; charset=utf-8',
      };
    }

    return {
      status: 200,
      body: serializeOEmbedResponse(response),
      contentType: 'application/json; charset=utf-8',
    };
  };
}
