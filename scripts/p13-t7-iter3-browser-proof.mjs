import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const url = 'http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html';
const outDir = path.resolve(
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/p13-canvas-wide-agentoutputs/browser-proof');

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch;
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
await page.waitForFunction(
   => window.__galleryReady?.example === '13-canvas-wide-agent',
  { timeout: 45_000 });

const metrics = await page.evaluate(() => {
  const rail = document.querySelector('.operator-rail');
  const dockPlacement = document.querySelector(
    'agentable-operator-surface-placement[placement="dock-inside"]');
  const floating = document.querySelector(
    'agentable-operator-surface-placement[placement="floating"]');

  const countShells = (root) => {
    let count = 0;
    const walk = (node) => {
      if (!(node instanceof Element || node instanceof DocumentFragment)) return;
      const elements =
        node instanceof DocumentFragment ? [...node.children]: [node,...node.querySelectorAll('*')];
      for (const el of elements) {
        if (!(el instanceof Element)) continue;
        if (el.shadowRoot) {
          count += el.shadowRoot.querySelectorAll('[data-testid="operator-surface-shell"]').length;
          walk(el.shadowRoot);
        }
      }
    };
    if (root) walk(root);
    return count;
  };

  const dockSurface = dockPlacement?.getOperatorSurface?. ?? null;
  const dockShadow = dockSurface?.shadowRoot ?? null;
  const composer = dockShadow?.querySelector('form.rounded-xl') ?? dockShadow?.querySelector('textarea');
  const composerStyles = composer ? getComputedStyle(composer): null;

  return {
    railShellCount: countShells(rail),
    floatingVisible: floating ? getComputedStyle(floating).display !== 'none': null,
    dockHeaders: dockShadow?.querySelectorAll('.operator-header').length ?? 0,
    dockShells: dockShadow?.querySelectorAll('[data-testid="operator-surface-shell"]').length ?? 0,
    composerBackground: composerStyles?.backgroundColor ?? null,
    composerBorder: composerStyles?.borderColor ?? null,
  };
});

await page.screenshot({
  path: path.join(outDir, '01-dock-inside-single-operator.png'),
  fullPage: false,
});

const textarea = page.locator('.operator-rail textarea').first;
await textarea.fill('Browser proof message');
await page.locator('.operator-rail [part="composer-submit"]').first.click;
await page.waitForTimeout(400);

await page.screenshot({
  path: path.join(outDir, '02-composer-message-sent.png'),
  fullPage: false,
});

const manifest = [
  '01-dock-inside-single-operator.png — dock-inside rail with exactly one operator chrome',
  '02-composer-message-sent.png — dark composer accepts and sends a message',
  '',
  `metrics: ${JSON.stringify(metrics, null, 2)}`,
].join('\n');

await writeFile(path.join(outDir, 'png-manifest.txt'), manifest, 'utf8');
console.log(manifest);
await browser.close;
