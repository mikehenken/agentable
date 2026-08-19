/**
 * browser proof — typed composer "draw a cat" in Draw mode.
 * Supplementary Playwright harness (cursor-ide-browser is primary proof channel).
 * Run: node scripts/qa-p13-t7-iter11-browser-proof.mjs
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PROOF_DIR =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/p13-canvas-wide-agentoutputs/browser-proof';
const URL = 'http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html';
const DRAW_PROBE = 'draw a cat';

mkdirSync(PROOF_DIR, { recursive: true });

/** @param {import('playwright').Page} page */
async function waitForGalleryReady(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(
     => {
      const ready = window.__galleryReady;
      return ready?.example === '13-canvas-wide-agent' && ready.ok === true;
    },
    { timeout: 45_000 });
  await page.waitForFunction(() => window.__operatorGalleryResult?.ok === true, {
    timeout: 45_000,
  });
  await page.locator('agentable-operator-surface-placement[placement-id="operator-main"]').first.waitFor({
    state: 'attached',
    timeout: 30_000,
  });
}

/** @param {import('playwright').Page} page */
async function waitForOperatorComposer(page) {
  await page.waitForFunction(
     => {
      const placement = document.querySelector(
        'agentable-operator-surface-placement[placement-id="operator-main"]');
      const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
      return Boolean(root?.querySelector('textarea'));
    },
    { timeout: 30_000 });
}

/** @param {import('playwright').Page} page */
async function createOperatorThread(page) {
  await page.evaluate(() => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    if (surface && typeof surface.createThread === 'function') {
      surface.createThread;
    }
  });
  await page.waitForTimeout(400);
}

/**
 * @param {import('playwright').Page} page
 * @param {string} message
 * @param {'ask' | 'build' | 'draw'} mode
 */
async function sendOperatorProbe(page, message, mode) {
  await createOperatorThread(page);
  await waitForOperatorComposer(page);

  await page.evaluate((nextMode) => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    if (surface && typeof surface.selectMode === 'function') {
      surface.selectMode(nextMode);
    }
  }, mode);

  const textarea = page.locator('.operator-rail textarea,.operator-rail-inner textarea').first;
  await textarea.waitFor({ state: 'visible', timeout: 30_000 });
  await textarea.click;
  await textarea.fill(message);
  await page.locator('.operator-rail [part="composer-submit"],.operator-rail-inner [part="composer-submit"]').first.click;
}

/** @param {import('playwright').Page} page */
async function readDrawToolPayload(page) {
  return page.evaluate(() => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    const threads = surface?.threads;
    if (!Array.isArray(threads)) {
      return null;
    }
    for (const thread of threads) {
      const messages = thread?.messages;
      if (!Array.isArray(messages)) {
        continue;
      }
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message?.kind !== 'tool' || message.toolName !== 'draw_shapes') {
          continue;
        }
        const args = message.args ?? {};
        return {
          ok: message.ok === true,
          toolName: message.toolName,
          createdShapeIds: Array.isArray(args._createdShapeIds)
            ? args._createdShapeIds.filter((id) => typeof id === 'string'): [],
          shapesBeforeDraw: args._shapesBeforeDraw ?? null,
          shapesAfterDraw: args._shapesAfterDraw ?? null,
          store: args._store ?? null,
          pageShapeCountBefore: args._pageShapeCountBefore ?? null,
          pageShapeCountAfter: args._pageShapeCountAfter ?? null,
          shapeIdsInArgs: Array.isArray(args.shapes)
            ? args.shapes.map((s) => (typeof s?.id === 'string' ? s.id: null)).filter(Boolean): [],
        };
      }
    }
    return null;
  });
}

/** @param {import('playwright').Page} page */
async function countOrangeCatShapes(page) {
  return page.evaluate(async () => {
    const host = document.querySelector('agentable-whiteboard');
    if (!(host instanceof HTMLElement) || typeof host.runScriptedTool !== 'function') {
      return { count: 0, orangeGeo: 0, catIds: [], via: 'no-host' };
    }
    if (typeof host.whenReady === 'function') {
      await host.whenReady(10_000);
    }
    const read = await host.runScriptedTool('read_canvas', {});
    if (!read.ok || !read.result || typeof read.result !== 'object') {
      return { count: 0, orangeGeo: 0, catIds: [], via: 'read-fail' };
    }
    const graph = /** @type {{ shapes?: Array<{ id?: string; nativeType?: string; props?: Record<string, unknown> }> }} */ (
      read.result
    );
    const shapes = graph.shapes ?? [];
    const catIds = shapes.map((s) => s.id ?? '').filter((id) => /cat-/i.test(id));
    const orangeGeo = shapes.filter((shape) => {
      const color = shape.props?.color;
      return color === 'orange' || color === '#ffa500';
    }).length;
    return { count: shapes.length, orangeGeo, catIds, via: 'read_canvas' };
  });
}

/** @param {string} name @param {Buffer} buf */
function savePng(name, buf) {
  const artifact_path = join(PROOF_DIR, `${name}.png`);
  writeFileSync(artifact_path, buf);
  const sha256 = createHash('sha256').update(buf).digest('hex');
  return { artifact_path, bytes: buf.length, sha256 };
}

async function main {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage;

  const consoleEntries = [];
  page.on('console', (msg) => {
    if (msg.type === 'error' || msg.type === 'warning') {
      consoleEntries.push({
        type: msg.type,
        text: msg.text,
        location: msg.location,
      });
    }
  });
  page.on('pageerror', (err) => {
    consoleEntries.push({ type: 'pageerror', text: err.message, stack: err.stack ?? '' });
  });

  await waitForGalleryReady(page);
  savePng('01-gallery-ready', await page.screenshot({ fullPage: false }));

  await sendOperatorProbe(page, DRAW_PROBE, 'draw');

  await page.waitForFunction(
     => {
      const placement = document.querySelector(
        'agentable-operator-surface-placement[placement-id="operator-main"]');
      const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
      const threads = surface?.threads;
      if (!Array.isArray(threads)) return false;
      for (const thread of threads) {
        for (const message of thread?.messages ?? []) {
          if (message?.kind === 'tool' && message.toolName === 'draw_shapes') return true;
        }
      }
      return false;
    },
    undefined,
    { timeout: 30_000 });
  await page.waitForTimeout(2000);

  const payload = await readDrawToolPayload(page);
  const canvasShapes = await countOrangeCatShapes(page);
  savePng('02-draw-a-cat-composer-result', await page.screenshot({ fullPage: false }));

  const beforeCount =
    payload?.shapesBeforeDraw && typeof payload.shapesBeforeDraw === 'object'
      ? payload.shapesBeforeDraw.count: null;
  const afterCount =
    payload?.shapesAfterDraw && typeof payload.shapesAfterDraw === 'object'
      ? payload.shapesAfterDraw.count: null;
  const countIncreased =
    typeof beforeCount === 'number' && typeof afterCount === 'number' && afterCount > beforeCount;
  const multiShapeCat =
    (payload?.createdShapeIds?.length ?? 0) >= 5 ||
    (payload?.shapeIdsInArgs?.length ?? 0) >= 5 ||
    canvasShapes.catIds.length >= 3;
  const notProbe =
    !payload?.createdShapeIds?.includes('operator-probe') &&
    !payload?.shapeIdsInArgs?.includes('operator-probe');

  const verdict = {
    timestamp: new Date.toISOString(),
    probe: DRAW_PROBE,
    mode: 'draw',
    payload,
    canvasShapes,
    criteria: {
      toolOk: payload?.ok === true,
      countIncreased,
      multiShapeCat,
      notProbe,
      visibleOrange: canvasShapes.orangeGeo >= 3,
    },
    pass:
      payload?.ok === true &&
      countIncreased &&
      multiShapeCat &&
      notProbe &&
      afterCount !== 0 &&
      afterCount !== beforeCount,
  };

  writeFileSync(join(PROOF_DIR, '../console-scan-.json'), JSON.stringify(consoleEntries, null, 2));
  writeFileSync(join(PROOF_DIR, 'draw-cat-verdict.json'), JSON.stringify(verdict, null, 2));

  console.log(JSON.stringify(verdict, null, 2));
  await browser.close;
  process.exit(verdict.pass ? 0: 1);
}

main.catch((err) => {
  console.error(err);
  process.exit(1);
});
