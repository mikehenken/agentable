import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { initAgentableEmbed } from '../../src/embed/embedApi';

describe('embedApi init', () => {
  // These two dynamic imports pull the full embed element graph (React +
  // Lit + every panel) through the vite transform inside a worker. Under a
  // fully parallel suite on a loaded runner that reproducibly crosses the
  // global 30s hookTimeout (vitest.release.config.ts documents the class),
  // so this hook carries its own explicit budget.
  beforeAll(async () => {
    await import('../../src/embed/agentable-canvas');
    await import('../../src/embed/agentable-panel');
  }, 120_000);

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('mounts agentable-canvas with anon-key parity fields', () => {
    const host = document.createElement('div');
    host.id = 'embed-host';
    document.body.appendChild(host);

    const instance = initAgentableEmbed({
      container: '#embed-host',
      anonKey: 'pk_live_jsapi',
      apiEndpoint: '/api',
      configPath: '/agentable/embed/config',
      tenant: 'js-api-tenant',
    });

    instance.element.setAttribute('data-skip-react-mount', '');

    expect(instance.element.tagName.toLowerCase()).toBe('agentable-canvas');
    expect(instance.element.getAttribute('anon-key')).toBe('pk_live_jsapi');
    expect(instance.element.getAttribute('api-endpoint')).toBe('/api');
    expect(instance.element.getAttribute('config-path')).toBe('/agentable/embed/config');
    expect(instance.element.tenant).toBe('js-api-tenant');
  });

  it('mounts agentable-panel when panel id provided', () => {
    const host = document.createElement('div');
    host.id = 'panel-host';
    document.body.appendChild(host);

    const instance = initAgentableEmbed({
      container: '#panel-host',
      element: 'agentable-panel',
      panel: 'open-positions',
      anonKey: 'pk_live_panel',
      apiEndpoint: '/api',
    });

    instance.element.setAttribute('data-skip-react-mount', '');

    expect(instance.element.tagName.toLowerCase()).toBe('agentable-panel');
    expect(instance.element.getAttribute('panel')).toBe('open-positions');
    expect(instance.element.getAttribute('anon-key')).toBe('pk_live_panel');
  });
});
