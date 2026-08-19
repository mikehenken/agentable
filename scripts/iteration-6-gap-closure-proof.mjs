/**
 * Iteration-6 gap-closure browser proof — tool calls, job detail, nav z-order, voice chrome.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../landi-labs/studies/Orchestration/agentable-panels/logs/career-canvas-tldraw-paritybrowser-proof');
mkdirSync(OUT, { recursive: true });

const HOST_BRIDGE = 'agentable-canvas/src/engines/tldraw/shapes/whiteboardPanelHostBridge.ts';
const HOST_TOOLS = 'agentable-canvas/src/panels/tools.ts';
const PANEL_SHAPE_API = 'agentable-canvas/src/engines/tldraw/shapes/panelShapeApi.ts';

/** @param {import('@playwright/test').Page} page */
async function clickNavItem(page, label) {
  return page.evaluate((navLabel) => {
    const walk = (root) => {
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const text = (el.textContent || '').trim();
        if (text === navLabel) {
          (el).click?.;
          return true;
        }
      }
      return false;
    };
    if (walk(document)) return { clicked: true, inShadow: false };
    const host = document.querySelector('agentable-whiteboard');
    const sr = host?.shadowRoot;
    if (sr && walk(sr)) return { clicked: true, inShadow: true };
    return { clicked: false };
  }, label);
}

/** @param {import('@playwright/test').Page} page */
async function walkText(page, needle) {
  return page.evaluate((text) => {
    const found = [];
    const walk = (n) => {
      if (n.nodeType === 3 && n.textContent?.includes(text)) found.push(n.textContent.trim());
      if (n.shadowRoot) walk(n.shadowRoot);
      for (const c of n.childNodes || []) walk(c);
    };
    walk(document.body);
    return found.length > 0;
  }, needle);
}

/** Agent tool path via injected Vite module script (same resolver as the app). *** @param {import('@playwright/test').Page} page */
async function runOpenPositionsTool(page, args) {
  return page.evaluate(
    async ({ bridgeUrl, toolsUrl, panelApiUrl, toolArgs }) => {
      /** @type {Promise<{ ok: boolean; result?: unknown; error?: string; via?: string }>} */
      const viaModuleScript = new Promise((resolve) => {
        const timeout = window.setTimeout(() => {
          resolve({ ok: false, error: 'module script timed out' });
        }, 15000);
        /** @param {CustomEvent<{ ok: boolean; result?: unknown; error?: string; via?: string }>} ev */
        const onResult = (ev) => {
          window.clearTimeout(timeout);
          window.removeEventListener('landi:iteration6-tool-result', onResult);
          resolve(ev.detail);
        };
        window.addEventListener('landi:iteration6-tool-result', onResult);
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
          import { getWhiteboardPanelHost } from ${JSON.stringify(bridgeUrl)};
          import { getHostActions } from ${JSON.stringify(toolsUrl)};
          import { openPanelInCanvas } from ${JSON.stringify(panelApiUrl)};
          (async () => {
            try {
              const host = getWhiteboardPanelHost;
              if (!host) {
                window.dispatchEvent(new CustomEvent('landi:iteration6-tool-result', {
                  detail: { ok: false, error: 'whiteboard host not bound yet' },
                }));
                return;
              }
              const tool = getHostActions.find((entry) => entry.declaration.name === 'open_positions');
              if (!tool) {
                window.dispatchEvent(new CustomEvent('landi:iteration6-tool-result', {
                  detail: { ok: false, error: 'open_positions missing from hostActions' },
                }));
                return;
              }
              const handlerResult = await tool.handler(${JSON.stringify(toolArgs ?? {})});
              openPanelInCanvas('open-positions', { focus: true, preserveZoom: true, reposition: true });
              window.dispatchEvent(new CustomEvent('landi:iteration6-tool-result', {
                detail: { ok: true, result: handlerResult, via: 'hostActions.handler' },
              }));
            } catch (err) {
              window.dispatchEvent(new CustomEvent('landi:iteration6-tool-result', {
                detail: { ok: false, error: err instanceof Error ? err.message: String(err) },
              }));
            }
          });
        `;
        document.head.appendChild(script);
      });
      return viaModuleScript;
    },
    {
      bridgeUrl: HOST_BRIDGE,
      toolsUrl: HOST_TOOLS,
      panelApiUrl: PANEL_SHAPE_API,
      toolArgs: args,
    });
}

/** UI fallback when dynamic import is blocked — mirrors open_positions intent application. *** @param {import('@playwright/test').Page} page */
async function applyOpenPositionsFilterUi(page) {
  await clickNavItem(page, 'Open Positions');
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const walk = (n) => {
      if (n.nodeType === 3 && n.textContent?.trim() === 'Operations') {
        n.parentElement?.click?.;
        return true;
      }
      if (n.shadowRoot && walk(n.shadowRoot)) return true;
      for (const c of n.childNodes || []) if (walk(c)) return true;
      return false;
    };
    walk(document.body);
  });
  const search = page.locator('input[placeholder*="Search" i]').first;
  if (await search.count) {
    await search.fill('Jamaica');
  }
}

/** @param {import('@playwright/test').Page} page */
async function clickJobTitle(page, title) {
  return page.evaluate((jobTitle) => {
    const walk = (n) => {
      if (n.nodeType === 3 && n.textContent?.trim() === jobTitle) {
        let el = n.parentElement;
        while (el) {
          if (el.getAttribute('role') === 'button' || el.tagName === 'BUTTON' || el.onclick) {
            el.click;
            return true;
          }
          el = el.parentElement;
        }
        (n.parentElement)?.click?.;
        return true;
      }
      if (n.shadowRoot && walk(n.shadowRoot)) return true;
      for (const c of n.childNodes || []) if (walk(c)) return true;
      return false;
    };
    return walk(document.body);
  }, title);
}

/** @param {import('@playwright/test').Page} page */
async function capture(page, slug, url, steps) {
  const record = { slug, url, steps: [], capturedAt: new Date.toISOString() };
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(10000);

  for (const step of steps) {
    record.steps.push({...step,...(await step.run(page)) });
    await page.waitForTimeout(step.waitMs ?? 2000);
    if (step.screenshot) {
      await page.screenshot({ path: join(OUT, `${slug}-${step.screenshot}.png`), fullPage: false });
    }
  }

  writeFileSync(join(OUT, `${slug}.json`), JSON.stringify(record, null, 2));
  return record;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const results = [];

 --- React: voice chrome + tool-call filter ---
results.push(
  await capture(page, 'react-tool-call-filter', 'http://localhost:5173/career-canvas-whiteboard', [
    {
      name: 'voice-chrome-visible',
      screenshot: '01-voice-chrome',
      run: async (p) => ({
        hasTalkToSandy: await walkText(p, 'Talk to Sandy'),
        hasMicInChat: await p.locator('[aria-label*="microphone" i], [title*="microphone" i], button:has(svg)').count,
      }),
    },
    {
      name: 'execute-open_positions-location-jamaica',
      waitMs: 3000,
      screenshot: '02-tool-call-filtered-jobs',
      run: async (p) => {
        const tool = await runOpenPositionsTool(p, {
          location: 'Jamaica',
          department: 'Operations',
        });
        if (!tool.ok) {
          await applyOpenPositionsFilterUi(p);
          return { tool, fallback: 'ui-filter' };
        }
        return { tool };
      },
    },
    {
      name: 'verify-filtered-content',
      waitMs: 1500,
      run: async (p) => ({
        hasResortManager: await walkText(p, 'Resort Manager'),
        hasExecutiveChef: await walkText(p, 'Executive Chef'),
        hasSeniorDev: await walkText(p, 'Senior Software Developer'),
      }),
    },
  ]));

 --- React: job detail drill-down ---
results.push(
  await capture(page, 'react-job-detail', 'http://localhost:5173/career-canvas-whiteboard', [
    {
      name: 'open-positions-nav',
      run: async (p) => ({ nav: await clickNavItem(p, 'Open Positions') }),
    },
    {
      name: 'list-before-detail',
      waitMs: 2500,
      screenshot: '03-list-before-detail',
      run: async (p) => ({ hasResortManager: await walkText(p, 'Resort Manager') }),
    },
    {
      name: 'click-resort-manager',
      waitMs: 2500,
      screenshot: '04-job-detail',
      run: async (p) => {
        const clicked = await clickJobTitle(p, 'Resort Manager');
        return {
          clicked,
          hasResponsibilities: await walkText(p, 'Responsibilities'),
          has120M: await walkText(p, '$120M'),
        };
      },
    },
  ]));

 --- React: nav z-order with expanded menu ---
results.push(
  await capture(page, 'react-nav-zorder', 'http://localhost:5173/career-canvas-whiteboard', [
    {
      name: 'ensure-menu-expanded-open-positions',
      run: async (p) => {
        await clickNavItem(p, 'Open Positions');
        return { menuExpanded: await walkText(p, 'Menu') };
      },
    },
    {
      name: 'nav-zorder-screenshot',
      waitMs: 2500,
      screenshot: '05-nav-zorder-expanded',
      run: async (p) => ({
        hasMenu: await walkText(p, 'Menu'),
        hasOpenPositionsPanel: await walkText(p, 'Search roles, properties, skills'),
      }),
    },
  ]));

 --- Lit embed: job detail ---
results.push(
  await capture(page, 'lit-job-detail', 'http://localhost:5173/embed/sandals-whiteboard.html', [
    {
      name: 'open-positions-nav',
      run: async (p) => ({ nav: await clickNavItem(p, 'Open Positions') }),
    },
    {
      name: 'list-before-detail',
      waitMs: 2500,
      screenshot: '06-lit-list',
      run: async (p) => ({ hasResortManager: await walkText(p, 'Resort Manager') }),
    },
    {
      name: 'click-resort-manager',
      waitMs: 2500,
      screenshot: '07-lit-job-detail',
      run: async (p) => {
        const clicked = await clickJobTitle(p, 'Resort Manager');
        return {
          clicked,
          hasResponsibilities: await walkText(p, 'Responsibilities'),
          has120M: await walkText(p, '$120M'),
        };
      },
    },
  ]));

 --- Lit: tool call filter ---
results.push(
  await capture(page, 'lit-tool-call-filter', 'http://localhost:5173/embed/sandals-whiteboard.html', [
    {
      name: 'execute-open_positions-location-jamaica',
      waitMs: 3000,
      screenshot: '08-lit-tool-call-filter',
      run: async (p) => {
        const tool = await runOpenPositionsTool(p, {
          location: 'Jamaica',
          department: 'Operations',
        });
        if (!tool.ok) {
          await applyOpenPositionsFilterUi(p);
          return {
            tool,
            fallback: 'ui-filter',
            hasResortManager: await walkText(p, 'Resort Manager'),
            hasSeniorDev: await walkText(p, 'Senior Software Developer'),
          };
        }
        return {
          tool,
          hasResortManager: await walkText(p, 'Resort Manager'),
          hasSeniorDev: await walkText(p, 'Senior Software Developer'),
        };
      },
    },
  ]));

writeFileSync(join(OUT, 'capture-summary.json'), JSON.stringify(results, null, 2));
await browser.close;
console.log(' captures written to', OUT);
