import { chromium } from "playwright";
const URL = "http://127.0.0.1:5199/examples/13-canvas-wide-agent/index.html";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForFunction( => window.__galleryReady?.ok === true, { timeout: 90000 });
await page.evaluate( => {
  const p = document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]');
  const s = p?.shadowRoot?.querySelector("agentable-operator-surface");
  s?.selectMode?.("auto");
  s?.createThread?.;
});
await page.waitForTimeout(1000);
await page.evaluate( => {
  const p = document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]');
  const t = p?.shadowRoot?.querySelector("agentable-operator-surface")?.shadowRoot?.querySelector("textarea");
  if (t instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(t, "draw diagram of vpc peering between aws and gcp");
    t.dispatchEvent(new Event("input", { bubbles: true }));
  }
});
await page.evaluate( => {
  const p = document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]');
  const b = p?.shadowRoot?.querySelector("agentable-operator-surface")?.shadowRoot?.querySelector('[part="composer-submit"]:not([disabled])');
  if (b instanceof HTMLElement) b.click;
});
await page.waitForTimeout(3000);
const before = await page.evaluate( => {
  const p = document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]');
  const s = p?.shadowRoot?.querySelector("agentable-operator-surface");
  const thread = s?.threads?.find((e) => e.id === s.activeThreadId);
  return { generating: thread?.generating === true, hasStop: Boolean(s?.shadowRoot?.querySelector('[part="composer-stop"]')) };
});
const clicked = await page.evaluate( => {
  const p = document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]');
  const stop = p?.shadowRoot?.querySelector("agentable-operator-surface")?.shadowRoot?.querySelector('[part="composer-stop"]');
  if (stop instanceof HTMLElement) { stop.click; return true; }
  return false;
});
let abortedAtMs = null;
for (let i = 0; i < 20; i += 1) {
  await page.waitForTimeout(500);
  const still = await page.evaluate( => {
    const p = document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]');
    const s = p?.shadowRoot?.querySelector("agentable-operator-surface");
    const thread = s?.threads?.find((e) => e.id === s.activeThreadId);
    return thread?.generating === true;
  });
  if (!still) { abortedAtMs = (i + 1) * 500; break; }
}
const after = await page.evaluate( => {
  const p = document.querySelector('agentable-operator-surface-placement[placement-id="operator-main"]');
  const s = p?.shadowRoot?.querySelector("agentable-operator-surface");
  const thread = s?.threads?.find((e) => e.id === s.activeThreadId);
  return { generating: thread?.generating === true, msgCount: thread?.messages?.length ?? 0 };
});
console.log(JSON.stringify({ before, clicked, after, abortedAtMs, pass: clicked && before.generating && !after.generating }, null, 2));
await browser.close;
