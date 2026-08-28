#!/usr/bin/env node
/**
 * Static server for the assembled examples site (dist/site), used by the
 * gallery smoke suite (tests/e2e/gallerySmoke.spec.ts).
 *
 * Mirrors the Cloudflare Pages behavior the deployed gallery gets: files are
 * served as-is, and a path with no file answers 200 with /index.html (the SPA
 * fallback). The fallback matters: it is exactly what turns a missing
 * config.local.json into text/html, the failure mode the example config
 * probes must survive. Pages Functions (/v1/*) are NOT emulated; those
 * endpoints answer 404 JSON here so client code sees a clean miss instead of
 * HTML.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(__dirname, '..', 'dist', 'site');
const port = Number(process.env.SITE_PORT ?? 5199);

/** @type {Record<string, string>} */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** @param {string} filePath */
async function fileIfExists(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile() ? filePath : null;
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith('/v1/')) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'pages functions are not emulated by serve-site' }));
    return;
  }

  const relative = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  const direct = path.join(siteRoot, relative);
  const candidates = [direct, `${direct}${path.sep}index.html`.replace(/\\/g, path.sep)];

  let filePath = null;
  for (const candidate of candidates) {
    filePath = await fileIfExists(candidate);
    if (filePath) break;
  }
  // SPA fallback, mirroring Pages: unknown paths answer 200 text/html.
  if (!filePath) filePath = path.join(siteRoot, 'index.html');

  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(String(error));
  }
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`examples site (dist/site) on http://127.0.0.1:${port}\n`);
});
