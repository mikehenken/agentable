/**
 * Panel embed gallery-dark theme — contrast tokens and RTL padding contract.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import '../../src/embed/agentable-panel';

const panelEmbedGalleryDarkCss = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/embed/styles/panel-embed-gallery-dark.css'),
  'utf8');

const GALLERY_DARK_TOKENS = [
  '--landi-color-surface: #1f1f1f',
  '--landi-color-background: #141414',
  '--landi-color-text: #ececec',
  '--landi-color-border: rgb(255 255 255 / 0.12)',
] as const;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('panel embed gallery-dark theme', () => {
  it('ships CSS with required Landi contrast tokens on:host([data-theme=gallery-dark])', () => {
    for (const token of GALLERY_DARK_TOKENS) {
      expect(panelEmbedGalleryDarkCss).toContain(token);
    }
    expect(panelEmbedGalleryDarkCss).toContain(":host([data-theme='gallery-dark'])");
  });

  it('uses logical CSS for RTL-safe list row padding and text alignment', () => {
    expect(panelEmbedGalleryDarkCss).toContain('padding-inline: 12px');
    expect(panelEmbedGalleryDarkCss).toContain('text-align: start');
    expect(panelEmbedGalleryDarkCss).not.toContain('text-align: left');
    expect(panelEmbedGalleryDarkCss).not.toContain('padding-left');
  });

  it('styles virtual-list row parts as dark cards with hover', () => {
    expect(panelEmbedGalleryDarkCss).toContain('agentable-virtual-list::part(row)');
    expect(panelEmbedGalleryDarkCss).toContain('agentable-virtual-list::part(row):hover');
    expect(panelEmbedGalleryDarkCss).toContain('border-radius: 6px');
  });

  it('inherits direction into virtual-list for RTL job cards', () => {
    expect(panelEmbedGalleryDarkCss).toContain('agentable-virtual-list');
    expect(panelEmbedGalleryDarkCss).toContain('direction: inherit');
    expect(panelEmbedGalleryDarkCss).toContain('.agentable-panel-surface');
  });

  it('applies data-theme attribute on agentable-panel host', () => {
    const panel = document.createElement('agentable-panel');
    panel.setAttribute('data-theme', 'gallery-dark');
    panel.setAttribute('panel', 'open-positions');
    document.body.appendChild(panel);

    expect(panel.getAttribute('data-theme')).toBe('gallery-dark');
  });
});

/**
 * Regression: the support-inbox-quickstart (and examples 02/07) mount a plain
 * `<agentable-panel>` with NO `data-theme`. The spec-renderer body (list rows,
 * header, table, state cards) was previously styled only under
 * `:host([data-theme='gallery-dark'])`, so those no-theme surfaces dumped the
 * inbox as raw unstyled text. The fix moved the body structure + neutral
 * token-driven colour into an UNGATED base layer; the gallery-dark blocks now
 * override colour only. These tests pin that the body layer stays ungated so
 * the bug cannot silently return.
 */
describe('panel embed ungated base body layer (no-theme adopters)', () => {
  // The base body layer lives between its marker comment and the first
  // gallery-dark chrome override below it; slice it out and prove the
  // structural row styling is NOT scoped to a data-theme.
  const markerStart = panelEmbedGalleryDarkCss.indexOf('Ungated base BODY layer');
  // Begin the region after the marker comment closes, so the comment's own
  // description of the old `[data-theme='gallery-dark']` gating is excluded.
  const rulesStart = panelEmbedGalleryDarkCss.indexOf('*/', markerStart) + 2;
  const themeAfter = panelEmbedGalleryDarkCss.indexOf(
    "host([data-theme='gallery-dark']) .panel-chrome",
    rulesStart);
  const baseBodyLayer = panelEmbedGalleryDarkCss.slice(rulesStart, themeAfter);
  // Strip any nested block comments so their prose can't count as a selector.
  const baseBodyLayerCode = baseBodyLayer.replace(/\/\*[\s\S]*?\*\//g, '');

  it('extracts a non-empty ungated base body region', () => {
    expect(markerStart).toBeGreaterThanOrEqual(0);
    expect(themeAfter).toBeGreaterThan(rulesStart);
    expect(baseBodyLayerCode.length).toBeGreaterThan(0);
  });

  it('styles the spec-renderer body without any data-theme gate', () => {
    // The region must NOT reference the gallery-dark host scope: every rule in
    // it applies to a plain <agentable-panel>.
    expect(baseBodyLayerCode).not.toContain('[data-theme=');
    expect(baseBodyLayer).toContain("[data-testid='panel-body']");
    expect(baseBodyLayer).toContain("[data-testid='spec-renderer-root']");
  });

  it('styles virtual-list row parts ungated so support-inbox rows are cards', () => {
    expect(baseBodyLayer).toContain('agentable-virtual-list::part(row)');
    expect(baseBodyLayer).toContain('agentable-virtual-list::part(row-title)');
    expect(baseBodyLayer).toContain('agentable-virtual-list::part(row-subtitle)');
    // Row background is token-driven with a light default, not a dark literal.
    expect(baseBodyLayer).toContain('background: var(--panel-embed-row-bg)');
  });

  it('defines light-default body tokens on the bare :host so no-theme text is legible', () => {
    expect(baseBodyLayer).toContain('--panel-embed-row-bg: var(--landi-color-surface, #ffffff)');
    expect(baseBodyLayer).toContain('--panel-embed-body-text: var(--landi-color-text, #16283c)');
  });
});
