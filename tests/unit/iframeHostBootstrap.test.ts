/**
 * Regression: the sandboxed iframe-host page must bootstrap under both hosting
 * forms of its URL. Cloudflare Pages 308-redirects `/embed/iframe-host.html`
 * to the extension-stripped `/embed/iframe-host`, so the original
 * `.endsWith('iframe-host.html')` guard never fired on the deployed gallery
 * and example 07's "Careers block" iframe stayed permanently blank. The guard
 * is now `isIframeHostPathname`, matched here against both forms plus the
 * near-miss paths that must NOT trigger a mount.
 */
import { describe, expect, it } from 'vitest';
import { isIframeHostPathname } from '../../src/embed/iframe/iframeHostBootstrap';

describe('isIframeHostPathname', () => {
  it('matches the extensioned form (local vite / static hosts)', () => {
    expect(isIframeHostPathname('/embed/iframe-host.html')).toBe(true);
    expect(isIframeHostPathname('/iframe-host.html')).toBe(true);
  });

  it('matches the clean-URL form (Cloudflare Pages extension stripping)', () => {
    expect(isIframeHostPathname('/embed/iframe-host')).toBe(true);
    expect(isIframeHostPathname('/iframe-host')).toBe(true);
  });

  it('does not false-match a path that merely ends with the token', () => {
    expect(isIframeHostPathname('/embed/my-iframe-host')).toBe(false);
    expect(isIframeHostPathname('/embed/not-iframe-host.html')).toBe(false);
  });

  it('does not match unrelated embed pages', () => {
    expect(isIframeHostPathname('/embed/agentable-panel')).toBe(false);
    expect(isIframeHostPathname('/examples/07-iframe-cms/')).toBe(false);
    expect(isIframeHostPathname('/iframe-host/child')).toBe(false);
    expect(isIframeHostPathname('/')).toBe(false);
  });
});
