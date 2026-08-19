/**
 * Unified panel targeting resolver tests.
 */
import { describe, expect, it } from 'vitest';
import {
  panelOpenOptionsFromPlacement,
  panelOpenResolveInputFromRuntimeArgs,
  parsePanelOpenResolveInput,
  resolveOpenPanelPlacement,
} from '../../src/engine/openPanelResolver';

describe('resolveOpenPanelPlacement — region targeting', () => {
  it('maps app-shell region to aligned position rails for DOM engines', () => {
    const resolved = resolveOpenPanelPlacement('chat', {
      target: { kind: 'region', region: 'sidebar', order: 2 },
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    expect(resolved.placement).toMatchObject({
      panelId: 'chat',
      region: 'sidebar',
      tabGroup: 0,
      order: 2,
      position: { x: 1, y: 2 },
      focus: true,
    });
  });

  it('accepts legacy flat region fields', () => {
    const resolved = resolveOpenPanelPlacement('preview', {
      region: 'main',
      order: 1,
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.placement.region).toBe('main');
    expect(resolved.placement.position).toEqual({ x: 0, y: 1 });
  });
});

describe('resolveOpenPanelPlacement — canvas targeting', () => {
  it('passes canvas coordinates without region fields', () => {
    const resolved = resolveOpenPanelPlacement('jobs', {
      target: {
        kind: 'canvas',
        position: { x: 420, y: 180 },
        size: { w: 360, h: 240 },
      },
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    expect(resolved.placement).toMatchObject({
      panelId: 'jobs',
      position: { x: 420, y: 180 },
      size: { w: 360, h: 240 },
    });
    expect(resolved.placement.region).toBeUndefined();
  });

  it('accepts legacy flat position and size', () => {
    const resolved = resolveOpenPanelPlacement('jobs', {
      position: { x: 100, y: 80 },
      size: { w: 300, h: 200 },
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.placement.position).toEqual({ x: 100, y: 80 });
    expect(resolved.placement.size).toEqual({ w: 300, h: 200 });
  });
});

describe('resolveOpenPanelPlacement — slot targeting', () => {
  it('sets slot without spatial placement', () => {
    const resolved = resolveOpenPanelPlacement('open-positions', {
      target: { kind: 'slot', slot: 'sidebar' },
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.placement.slot).toBe('sidebar');
    expect(resolved.placement.position).toBeUndefined();
  });
});

describe('resolveOpenPanelPlacement — validation', () => {
  it('rejects conflicting target kinds', () => {
    const resolved = resolveOpenPanelPlacement('chat', {
      slot: 'sidebar',
      region: 'main',
    });
    expect(resolved).toEqual({
      ok: false,
      code: 'TARGET_CONFLICT',
      message: 'open_panel accepts one placement target: slot, region, or canvas position',
    });
  });

  it('rejects target plus legacy flat fields', () => {
    const resolved = resolveOpenPanelPlacement('chat', {
      target: { kind: 'region', region: 'main' },
      position: { x: 10, y: 10 },
    });
    expect(resolved.ok).toBe(false);
    if (resolved.ok) return;
    expect(resolved.code).toBe('TARGET_CONFLICT');
  });
});

describe('parsePanelOpenResolveInput + runtime arg bridge', () => {
  it('parses discriminated target from tool args', () => {
    const parsed = parsePanelOpenResolveInput({
      id: 'chat',
      target: { kind: 'canvas', position: { x: 1, y: 2 } },
    });
    expect(parsed.target).toEqual({ kind: 'canvas', position: { x: 1, y: 2 } });
  });

  it('preserves legacy runtime (scope, slot) calls', () => {
    const parsed = panelOpenResolveInputFromRuntimeArgs({ entityId: 'page-1' }, 'sidebar');
    expect(parsed).toEqual({
      scope: { entityId: 'page-1' },
      slot: 'sidebar',
    });
  });

  it('maps placement to host open options without panel id', () => {
    const resolved = resolveOpenPanelPlacement('chat', { region: 'sidebar' });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(panelOpenOptionsFromPlacement(resolved.placement)).toMatchObject({
      region: 'sidebar',
      position: { x: 1, y: 0 },
      focus: true,
    });
  });
});
