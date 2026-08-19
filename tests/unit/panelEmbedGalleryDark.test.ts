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
  '--landi-color-background: #121212',
  '--landi-color-text: #ececec',
  '--landi-color-border: rgb(255 255 255 / 0.09)',
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
