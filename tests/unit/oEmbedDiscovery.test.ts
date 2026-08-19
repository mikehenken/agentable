/**
 * oEmbed discovery/response unit coverage.
 */
import { describe, it, expect } from 'vitest';
import {
  buildIframeHostUrl,
  buildSandboxedIframeHtml,
  parseIframeHostUrl,
} from '../../src/embed/iframe/iframeHostUrl';
import {
  buildOEmbedDiscoveryLink,
  handleOEmbedRequest,
  renderOEmbedDiscoveryLinkTag,
  createOEmbedHttpHandler,
} from '../../src/embed/oembed/oEmbedDiscovery';
import { IFRAME_EMBED_SANDBOX } from '../../src/embed/iframe/embedBridgeProtocol';

const CONFIG = {
  embedBaseUrl: 'https://embed.agentable.dev',
  providerUrl: 'https://agentable.dev',
};

describe('iframe host URL helpers', () => {
  it('builds and parses panel iframe host URLs', () => {
    const url = buildIframeHostUrl(CONFIG.embedBaseUrl, {
      surface: 'panel',
      panel: 'open-positions',
      configUrl: '/config/sandals-career.json',
      parentOrigin: 'https://cms.example.com',
      bridgeId: 'bridge_abc',
    });

    const parsed = parseIframeHostUrl(url);
    expect(parsed?.params.panel).toBe('open-positions');
    expect(parsed?.params.configUrl).toBe('/config/sandals-career.json');
    expect(parsed?.params.parentOrigin).toBe('https://cms.example.com');
    expect(parsed?.params.bridgeId).toBe('bridge_abc');
  });

  it('emits sandboxed iframe HTML without inline scripts', () => {
    const html = buildSandboxedIframeHtml('https://embed.agentable.dev/embed/iframe-host.html?surface=panel', 640, 480);
    expect(html).toContain('sandbox="');
    expect(html).toContain(IFRAME_EMBED_SANDBOX);
    expect(html).not.toContain('<script');
  });
});

describe('oEmbed discovery', () => {
  it('builds discovery link tags', () => {
    const pageUrl = buildIframeHostUrl(CONFIG.embedBaseUrl, {
      surface: 'panel',
      panel: 'open-positions',
    });
    const link = buildOEmbedDiscoveryLink(pageUrl, CONFIG);
    expect(link.type).toBe('application/json+oembed');
    expect(link.href).toContain('/oembed?');
    expect(renderOEmbedDiscoveryLinkTag(link)).toContain('application/json+oembed');
  });

  it('returns rich oEmbed JSON for iframe host URLs', () => {
    const pageUrl = buildIframeHostUrl(CONFIG.embedBaseUrl, {
      surface: 'panel',
      panel: 'open-positions',
      configUrl: '/config/sandals-career.json',
    });

    const response = handleOEmbedRequest({ url: pageUrl, maxwidth: 800 }, CONFIG);
    expect('error' in response).toBe(false);
    if ('error' in response) {
      return;
    }
    expect(response.version).toBe('1.0');
    expect(response.type).toBe('rich');
    expect(response.width).toBe(800);
    expect(response.html).toContain('iframe');
    expect(response.html).toContain('iframe-host.html');
  });

  it('handles HTTP-style oEmbed requests', () => {
    const pageUrl = buildIframeHostUrl(CONFIG.embedBaseUrl, {
      surface: 'panel',
      panel: 'applications',
    });
    const handler = createOEmbedHttpHandler(CONFIG);
    const result = handler(`/oembed?url=${encodeURIComponent(pageUrl)}&format=json`);
    expect(result.status).toBe(200);
    expect(result.contentType).toContain('application/json');
    expect(result.body).toContain('"type":"rich"');
  });
});
