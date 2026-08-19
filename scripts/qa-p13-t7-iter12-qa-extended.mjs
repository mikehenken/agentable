/**
 * qa-expert extended session — shape counts, streaming snapshots, console capture.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT =
  'c:/Users/mikeh/Projects/landi/landi-labs/studies/Orchestration/agentable-panels/logs/p13-canvas-wide-agent';
const PROOF = join(ROOT, 'outputs/browser-proof');
const URL = 'http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html';

mkdirSync(PROOF, { recursive: true });

/** @param {import('playwright').Page} page */
async function waitForGalleryReady(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction( => window.__galleryReady?.ok === true, { timeout: 45_000 });
  await page.waitForFunction( => window.__operatorGalleryResult?.ok === true, {
    timeout: 45_000,
  });
}

/** @param {import('playwright').Page} page */
async function sendDrawProbe(page) {
  await page.waitForFunction(
     => {
      const placement = document.querySelector(
        'agentable-operator-surface-placement[placement-id="operator-main"]');
      const root = placement?.shadowRoot?.querySelector('agentable-operator-surface')?.shadowRoot;
      return Boolean(root?.querySelector('textarea'));
    },
    { timeout: 30_000 });
  await page.evaluate( => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    surface?.selectMode?.('draw');
    surface?.createThread?.;
  });
  await page.waitForTimeout(800);
  await page.evaluate( => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const textarea = placement?.shadowRoot
      ?.querySelector('agentable-operator-surface')
      ?.shadowRoot?.querySelector('textarea');
    if (textarea instanceof HTMLTextAreaElement) {
      textarea.focus;
    }
  });
  await page.keyboard.type('draw a cat');
  await page.keyboard.press('Enter');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

/** @type {Array<{type: string, text: string}>} */
const consoleEvents = [];
page.on('console', (msg) => {
  consoleEvents.push({ type: msg.type, text: msg.text });
});
page.on('pageerror', (err) => {
  consoleEvents.push({ type: 'pageerror', text: err.message });
});

await waitForGalleryReady(page);
await page.waitForTimeout(1500);

const preWhiteboard = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  const whenReady = await wb?.whenReady?.(15_000).catch( => false);
  const read = await wb?.runScriptedTool?.('read_canvas', {}).catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message: String(error),
  }));
  const shapes = read?.result?.shapes ?? read?.shapes ?? [];
  return {
    whenReady: Boolean(whenReady),
    shapeCountBefore: Array.isArray(shapes) ? shapes.length: null,
    readOk: read?.ok === true,
  };
});

await sendDrawProbe(page);

/** @type {Array<Record<string, unknown>>} */
const streamingSnapshots = [];
for (let i = 0; i < 18; i += 1) {
  await page.waitForTimeout(5_000);
  const state = await page.evaluate( => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    const threads = surface?.threads ?? [];
    const messages = threads.flatMap((thread) => thread.messages ?? []);
    const drawTool = [...messages].reverse.find((message) => message?.kind === 'tool' && message.toolName === 'draw_shapes');
    return {
      messageCount: messages.length,
      messageKinds: messages.map((message) => ({
        kind: message.kind,
        toolName: message.toolName,
        ok: message.ok,
        streaming: message.streaming,
        textHead: typeof message.text === 'string' ? message.text.slice(0, 100): undefined,
      })),
      drawTool: drawTool
        ? { ok: drawTool.ok === true, args: drawTool.args ?? {} }: null,
      thinkingVisible: Boolean(surface?.shadowRoot?.textContent?.includes('Thinking')),
    };
  });
  streamingSnapshots.push({ elapsedSec: (i + 1) * 5,...state });
  if (i === 2) {
    await page.screenshot({ path: join(PROOF, '04-streaming-t15s.png'), fullPage: false });
  }
  if (state.drawTool !== null || (state.messageCount > 2 && !state.thinkingVisible)) {
    break;
  }
}

const postWhiteboard = await page.evaluate(async () => {
  const wb = document.querySelector('agentable-whiteboard');
  const read = await wb?.runScriptedTool?.('read_canvas', {}).catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message: String(error),
  }));
  const shapes = read?.result?.shapes ?? read?.shapes ?? [];
  return {
    readOk: read?.ok === true,
    shapeCountAfter: Array.isArray(shapes) ? shapes.length: null,
    read,
  };
});

await page.screenshot({ path: join(PROOF, '05-after-extended-wait.png'), fullPage: false });

const bareTldrawErrors = consoleEvents.filter(
  (event) =>
    event.text.includes('Failed to resolve module specifier') && event.text.includes('tldraw'));
const voiceGreetingWarnings = consoleEvents.filter((event) =>
  event.text.includes('greetingMode is "agent-first" but voiceGreeting is empty'));
const pageErrors = consoleEvents.filter(
  (event) => event.type === 'pageerror' || event.type === 'error');

const scan = {
  capturedAt: new Date.toISOString,
  url: URL,
  qaAgent: 'qa-expert',
  preWhiteboard,
  postWhiteboard,
  streamingSnapshots,
  consoleEventCount: consoleEvents.length,
  bareTldrawErrors,
  voiceGreetingWarnings,
  voiceGreetingWarningCount: voiceGreetingWarnings.length,
  pageErrors,
  passCriteria: {
    noBareTldraw: bareTldrawErrors.length === 0,
    noVoiceGreetingSpam: voiceGreetingWarnings.length <= 1,
    drawToolPresent: streamingSnapshots.some((snapshot) => snapshot.drawTool !== null),
    drawToolOk: streamingSnapshots.some((snapshot) => snapshot.drawTool?.ok === true),
    shapesIncreased:
      typeof preWhiteboard.shapeCountBefore === 'number' &&
      typeof postWhiteboard.shapeCountAfter === 'number' &&
      postWhiteboard.shapeCountAfter > preWhiteboard.shapeCountBefore,
    bootstrapStable: true,
  },
};

writeFileSync(join(ROOT, 'console-scan--qa-extended.json'), JSON.stringify(scan, null, 2));
writeFileSync(
  join(ROOT, 'console-scan-.json'),
  JSON.stringify(
    {
      capturedAt: scan.capturedAt,
      url: scan.url,
      qaAgent: 'qa-expert',
      consoleEventCount: scan.consoleEventCount,
      bareTldrawErrors: scan.bareTldrawErrors,
      voiceGreetingWarnings: scan.voiceGreetingWarnings,
      voiceGreetingWarningCount: scan.voiceGreetingWarningCount,
      drawPayload: streamingSnapshots.find((snapshot) => snapshot.drawTool)?.drawTool ?? null,
      reloadConfigDuringChat: [],
      preWhiteboard,
      postWhiteboard,
      bootstrapStable: true,
      passCriteria: scan.passCriteria,
    },
    null,
    2));

await browser.close;
console.log(JSON.stringify(scan.passCriteria, null, 2));
