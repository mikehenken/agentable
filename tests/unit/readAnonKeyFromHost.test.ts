import { describe, it, expect } from 'vitest';
import {
  readAnonKeyFromElement,
  readAnonKeyLookupFromElement,
  readConfigPathFromElement,
  readApiEndpointFromElement,
} from '../../src/embed/tenantLookup';

describe('readAnonKeyFromHost', () => {
  it('reads anon-key attribute on custom element', () => {
    const el = document.createElement('agentable-canvas');
    el.setAttribute('anon-key', 'pk_live_attr');
    el.setAttribute('api-endpoint', '/api');
    expect(readAnonKeyFromElement(el)).toBe('pk_live_attr');
    expect(readApiEndpointFromElement(el)).toBe('/api');
  });

  it('reads data-anon-key on auto-mount placeholder', () => {
    const el = document.createElement('div');
    el.setAttribute('data-anon-key', 'pk_live_data');
    el.setAttribute('data-api-endpoint', '/api');
    el.setAttribute('data-config-path', '/custom/config');
    expect(readAnonKeyFromElement(el)).toBe('pk_live_data');
    expect(readConfigPathFromElement(el)).toBe('/custom/config');
  });

  it('anon-key wins over data-anon-key', () => {
    const el = document.createElement('agentable-panel');
    el.setAttribute('anon-key', 'pk_attr');
    el.setAttribute('data-anon-key', 'pk_data');
    el.setAttribute('api-endpoint', '/api');
    expect(readAnonKeyFromElement(el)).toBe('pk_attr');
  });

  it('readAnonKeyLookupFromElement returns null without api base', () => {
    const el = document.createElement('div');
    el.setAttribute('data-anon-key', 'pk_live');
    expect(readAnonKeyLookupFromElement(el)).toBeNull();
  });

  it('readAnonKeyLookupFromElement resolves lookup snapshot', () => {
    const el = document.createElement('div');
    el.setAttribute('data-anon-key', 'pk_live');
    el.setAttribute('data-api-endpoint', '/api');
    expect(readAnonKeyLookupFromElement(el)).toEqual({
      anonKey: 'pk_live',
      apiBaseUrl: '/api',
    });
  });
});
