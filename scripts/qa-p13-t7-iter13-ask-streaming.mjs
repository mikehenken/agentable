/**
 * qa-expert supplementary — Ask mode streaming snapshots for iter-13.
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
  await page.waitForFunction(() => window.__galleryReady?.ok === true, { timeout: 60_000 });
  await page.waitForFunction(() => window.__operatorGalleryResult?.whiteboardReady === true, {
    timeout: 60_000,
  });
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
await page.screenshot({ path: join(PROOF, '04-ask-mode-before-chat.png'), fullPage: false });

await page.evaluate(() => {
  const placement = document.querySelector(
    'agentable-operator-surface-placement[placement-id="operator-main"]');
  const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
  surface?.selectMode?.('ask');
  surface?.createThread?.;
});

await page.waitForTimeout(800);
await page.evaluate(() => {
  const placement = document.querySelector(
    'agentable-operator-surface-placement[placement-id="operator-main"]');
  const textarea = placement?.shadowRoot
    ?.querySelector('agentable-operator-surface')
    ?.shadowRoot?.querySelector('textarea');
  if (textarea instanceof HTMLTextAreaElement) {
    textarea.focus;
  }
});

await page.keyboard.type('What shapes are on the canvas? Reply in one sentence.');
await page.keyboard.press('Enter');

/** @type {Array<Record<string, unknown>>} */
const streamingSnapshots = [];
for (let i = 0; i < 12; i += 1) {
  await page.waitForTimeout(3_000);
  const state = await page.evaluate(() => {
    const placement = document.querySelector(
      'agentable-operator-surface-placement[placement-id="operator-main"]');
    const surface = placement?.shadowRoot?.querySelector('agentable-operator-surface');
    const thread =
      surface?.threads?.find((entry) => entry.id === surface.activeThreadId) ??
      surface?.threads?.[0];
    const messages = thread?.messages ?? [];
    return {
      messageCount: messages.length,
      messageKinds: messages.map((message) => ({
        kind: message.kind,
        toolName: message.toolName,
        ok: message.ok,
        streaming: message.streaming,
        textHead: typeof message.text === 'string' ? message.text.slice(0, 100): undefined,
      })),
      wbContainerPresent: Boolean(
        document.querySelector('agentable-whiteboard')?.shadowRoot?.querySelector('.tl-container')),
    };
  });
  streamingSnapshots.push({ elapsedSec: (i + 1) * 3,...state });
  if (i === 2) {
    await page.screenshot({ path: join(PROOF, '05-ask-mid-streaming-t9s.png'), fullPage: false });
  }
}

await page.screenshot({ path: join(PROOF, '06-ask-after-response.png'), fullPage: false });

const voiceGreetingWarnings = consoleEvents.filter((event) =>
  event.text.includes('greetingMode is "agent-first" but voiceGreeting is empty'));
const bareTldrawErrors = consoleEvents.filter(
  (event) =>
    event.text.includes('Failed to resolve module specifier') && event.text.includes('tldraw'));

const hasEarlyStreaming = streamingSnapshots.some((snapshot) =>
  snapshot.messageKinds?.some(
    (message) =>
      message &&
      typeof message === 'object' &&
      'streaming' in message &&
      message.streaming === true));
const firstNonUserAt = streamingSnapshots.findIndex((snapshot) =>
  snapshot.messageKinds?.some(
    (message) =>
      message &&
      typeof message === 'object' &&
      'kind' in message &&
      message.kind !== 'user'));

const scan = {
  capturedAt: new Date.toISOString(),
  url: URL,
  mode: 'ask',
  streamingSnapshots,
  hasEarlyStreaming,
  firstNonUserSnapshotIndex: firstNonUserAt,
  consoleEventCount: consoleEvents.length,
  bareTldrawErrors,
  voiceGreetingWarningCount: voiceGreetingWarnings.length,
  errorsAndWarnings: consoleEvents.filter(
    (event) => event.type === 'error' || event.type === 'pageerror' || event.type === 'warning'),
};

writeFileSync(join(ROOT, 'console-scan--ask-streaming.json'), JSON.stringify(scan, null, 2));

await browser.close;
console.log(
  JSON.stringify(
    {
      hasEarlyStreaming,
      firstNonUserAt,
      finalMessageCount: streamingSnapshots.at(-1)?.messageCount,
      voiceGreetingWarningCount: voiceGreetingWarnings.length,
    },
    null,
    2));
