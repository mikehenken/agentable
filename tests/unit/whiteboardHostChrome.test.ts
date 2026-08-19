import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CAREER_HOST_CHROME,
  resolveCareerHostChrome,
  resolveWhiteboardHostChrome,
} from '../../src/engines/tldraw/hostChrome/whiteboardHostChrome';

describe('whiteboardHostChrome', () => {
  it('resolveCareerHostChrome applies 98% frame + canvas-expand', () => {
    const chrome = resolveCareerHostChrome;
    expect(chrome().frameWidthPercent).toBe(98);
    expect(chrome().frameBorder).toBe(true);
    expect(chrome().fullscreenMode).toBe('canvas-expand');
  });

  it('resolveWhiteboardHostChrome merges partial overrides', () => {
    const chrome = resolveWhiteboardHostChrome({...DEFAULT_CAREER_HOST_CHROME,
      hostHeaderHeight: '80px',
    });
    expect(chrome.hostHeaderHeight).toBe('80px');
  });
});
