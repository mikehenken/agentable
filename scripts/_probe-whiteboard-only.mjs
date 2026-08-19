import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const html = `<!DOCTYPE html>
<html><head><link rel="stylesheet" href="/embed/agentable-whiteboard.css"/></head>
<body style="margin:0;height:100vh">
<agentable-whiteboard tenant="meridian-labs" config-url="/examples/shared/meridian-labs-open-config.json" open-chat-on-mount="false" suppress-canvas-chat></agentable-whiteboard>
<script type="module" src="/embed/agentable-whiteboard.js"></script>
</body></html>`;

const server = createServer((req, res) => {
  const url = req.url?.split('?')[0] ?? '/';
  if (url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }
  const filePath = join(root, url.replace(/^\, ''));
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end('missing');
    return;
  }
  res.writeHead(200);
  res.end(readFileSync(filePath));
});

await new Promise((resolve) => server.listen(5198, resolve));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage;
await page.goto('http://127.0.0.1:5198/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);

const result = await page.evaluate(async () => {
  const host = document.querySelector('agentable-whiteboard');
  await host?.whenReady?.(20000);
  const draw = await host?.runScriptedTool?.('draw_shapes', {
    shapes: [{ kind: 'box', geometry: { kind: 'rect', x: 200, y: 200, w: 220, h: 140 }, style: { fill: 'solid', color: 'blue', size: 'm' }, text: 'solo' }],
  });
  await new Promise((r) => setTimeout(r, 1000));
  const read = await host?.runScriptedTool?.('read_canvas', {});
  return { draw, readCount: read?.result?.shapes?.length ?? 0, region: read?.result?.region };
});

console.log(JSON.stringify(result, null, 2));
await page.screenshot({ path: 'scripts/_probe-whiteboard-only.png' });
await browser.close;
server.close;
