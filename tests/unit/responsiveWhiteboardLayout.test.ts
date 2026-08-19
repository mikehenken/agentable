import { describe, it, expect } from 'vitest';
import {
  computeResponsiveWhiteboardPanelSize,
  computeWhiteboardChromeInsets,
  shouldExpandWhiteboardNav,
  shouldUseCompactWhiteboardChrome,
  whiteboardNavReserveWidth,
  whiteboardViewportTier,
} from '../../src/engines/tldraw/layout/responsiveWhiteboardLayout';

describe('responsiveWhiteboardLayout', () => {
  it('classifies viewport tiers at 390 768 1280', () => {
    expect(whiteboardViewportTier(390)).toBe('mobile');
    expect(whiteboardViewportTier(768)).toBe('tablet');
    expect(whiteboardViewportTier(1280)).toBe('desktop');
  });

  it('uses compact chrome below tablet width', () => {
    expect(shouldUseCompactWhiteboardChrome(390)).toBe(true);
    expect(shouldUseCompactWhiteboardChrome(767)).toBe(true);
    expect(shouldUseCompactWhiteboardChrome(768)).toBe(false);
    expect(shouldUseCompactWhiteboardChrome(1280)).toBe(false);
  });

  it('expands nav at tablet+ widths (career UX default)', () => {
    expect(shouldExpandWhiteboardNav(390)).toBe(false);
    expect(shouldExpandWhiteboardNav(767)).toBe(false);
    expect(shouldExpandWhiteboardNav(768)).toBe(true);
    expect(shouldExpandWhiteboardNav(1280)).toBe(true);
  });

  it('scales chat panel size for mobile (~390) vs desktop (~1280)', () => {
    const mobile = computeResponsiveWhiteboardPanelSize({
      viewportWidth: 390,
      viewportHeight: 844,
      panelId: 'chat',
    });
    const desktop = computeResponsiveWhiteboardPanelSize({
      viewportWidth: 1280,
      viewportHeight: 800,
      panelId: 'chat',
    });
     // Mobile uses most of the narrow viewport; desktop targets usable chat strip width.
    // expect(mobile.w 390).toBeGreaterThan(0.7);
    expect(desktop.w).toBeGreaterThanOrEqual(420);
    expect(desktop.w).toBeLessThanOrEqual(440);
    expect(mobile.w).toBeLessThanOrEqual(390);
    expect(mobile.h).toBeGreaterThan(200);
    expect(desktop.h).toBeGreaterThan(300);
  });

  it('scales applications panel for 390 768 1280', () => {
    const at390 = computeResponsiveWhiteboardPanelSize({
      viewportWidth: 390,
      viewportHeight: 844,
      panelId: 'applications',
    });
    const at768 = computeResponsiveWhiteboardPanelSize({
      viewportWidth: 768,
      viewportHeight: 1024,
      panelId: 'applications',
    });
    const at1280 = computeResponsiveWhiteboardPanelSize({
      viewportWidth: 1280,
      viewportHeight: 800,
      panelId: 'applications',
    });

    expect(at390.w).toBeGreaterThan(250);
    expect(at390.w).toBeLessThanOrEqual(390);
    expect(at768.w).toBeGreaterThan(at1280.w * 0.5);
    expect(at1280.w).toBeGreaterThanOrEqual(420);
    expect(at1280.w).toBeLessThanOrEqual(560);
    expect(at1280.h).toBeGreaterThan(300);
  });

  it('reserves less nav width when collapsed on mobile', () => {
    expect(whiteboardNavReserveWidth(390, false)).toBe(48);
    expect(whiteboardNavReserveWidth(390, true)).toBe(180);
    expect(whiteboardNavReserveWidth(1280, false)).toBe(56);
    expect(whiteboardNavReserveWidth(1280, true)).toBe(210);
  });

  it('chrome insets clear expanded Menu vs collapsed icon rail', () => {
    const expanded = computeWhiteboardChromeInsets({
      viewportWidth: 1280,
      navExpanded: true,
    });
    const collapsed = computeWhiteboardChromeInsets({
      viewportWidth: 1280,
      navExpanded: false,
    });
    expect(expanded.left).toBe(24 + 210);
    expect(collapsed.left).toBe(24 + 56);
    expect(expanded.left).toBeGreaterThan(collapsed.left);
    expect(expanded.top).toBe(24);
    expect(collapsed.top).toBe(24);
  });

  it('chrome insets skip nav reserve when sidebar is hidden', () => {
    const insets = computeWhiteboardChromeInsets({
      viewportWidth: 1280,
      navExpanded: true,
      showNavSidebar: false,
    });
    expect(insets.left).toBe(24);
    expect(insets.navReserve).toBe(0);
  });
});
