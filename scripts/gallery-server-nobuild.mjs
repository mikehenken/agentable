/**
 * Static gallery server without vite rebuild ( shell fallback).
 * Serves dist/embed, dist/gallery, examples/, and legacy harness routes.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

/** @type {Record<string, string>} */
const STATIC_ROUTES = {
  '/harness/index.html': path.join(root, 'tests/e2e/harness/index.html'),
  '/harness/multi-agent.html': path.join(root, 'tests/e2e/harness/multi-agent.html'),
  '/fixtures/embed-config-static.json': path.join(root, 'tests/fixtures/embed-config-static.json'),
  '/fixtures/panel-data-minimal.json': path.join(root, 'tests/fixtures/panel-data-minimal.json'),
  '/e2e/multi-agent-harness.js': path.join(root, 'dist/e2e/multi-agent-harness.js'),
};

/** @type {Record<string, string>} */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const port = Number(process.env.E2E_EMBED_PORT ?? 5199);

/** @param {string} filePath */
async function fileExists(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile;
  } catch {
    return false;
  }
}

/** @param {string} urlPath */
async function resolveFilePath(urlPath) {
  if (STATIC_ROUTES[urlPath]) {
    return STATIC_ROUTES[urlPath];
  }

  if (urlPath.startsWith('/embed/')) {
    const candidate = path.join(root, 'dist/embed', urlPath.slice('/embed/'.length));
    if (await fileExists(candidate)) return candidate;
  }

  if (urlPath.startsWith('/gallery/')) {
    const candidate = path.join(root, 'dist/gallery', urlPath.slice('/gallery/'.length));
    if (await fileExists(candidate)) return candidate;
  }

  if (urlPath.startsWith('/examples/')) {
    const candidate = path.join(root, 'examples', urlPath.slice('/examples/'.length));
    if (await fileExists(candidate)) return candidate;
  }

  return null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
  let pathname = url.pathname;
  if (pathname.endsWith('/') && pathname.length > 1) {
    pathname = pathname.slice(0, -1);
  }

  const filePath = await resolveFilePath(pathname);
  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  try {
    const body = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(String(error));
  }
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`e2e gallery server (nobuild) listening on http://127.0.0.1:${port}\n`);
});
