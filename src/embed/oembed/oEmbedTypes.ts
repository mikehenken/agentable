/**
 * oEmbed response types for agentable embed surfaces.
 */
export interface OEmbedDiscoveryLink {
  rel: 'alternate';
  type: 'application/json+oembed';
  href: string;
  title?: string;
}

export interface OEmbedRichResponse {
  version: '1.0';
  type: 'rich';
  provider_name: string;
  provider_url: string;
  title: string;
  author_name?: string;
  width: number;
  height: number;
  html: string;
  cache_age?: number;
}

export interface OEmbedErrorResponse {
  error: true;
  message: string;
}

export type OEmbedResponse = OEmbedRichResponse | OEmbedErrorResponse;

export interface OEmbedRequestParams {
  url: string;
  format?: 'json';
  maxwidth?: number;
  maxheight?: number;
}

export const OEMBED_PROVIDER_NAME = 'Agentable Canvas';
export const OEMBED_CACHE_AGE_SECONDS = 300;
