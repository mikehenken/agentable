/** Lightweight gallery static server (no harness rebuild). Example 08 battery only. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const port = Number(process.env.E2E_EMBED_PORT ?? 5199);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

async function fileExists(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function resolveFilePath(urlPath) {
  if (urlPath.startsWith('/embed/')) {
    const candidate = path.join(root, 'dist/embed', urlPath.slice('/embed/'.length));
    if (await fileExists(candidate)) return candidate;
  }
  if (urlPath.startsWith('/examples/')) {
    const candidate = path.join(root, 'examples', urlPath.slice('/examples/'.length));
    if (await fileExists(candidate)) return candidate;
  }
  return null;
}

createServer(async (req, res) => {
  let pathname = new URL(req.url ?? '/', `http://127.0.0.1:${port}`).pathname;
  if (pathname.endsWith('/') && pathname.length > 1) pathname = pathname.slice(0, -1);
  const filePath = await resolveFilePath(pathname);
  if (!filePath) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const body = await readFile(filePath);
  res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(body);
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`gallery static server on http://127.0.0.1:${port}\n`);
});
