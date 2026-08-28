/**
 * Assemble the public examples gallery into a single deployable directory.
 *
 * Examples reference the embed bundles by absolute path (`/embed/*.js`), so the
 * deployed site must serve `embed/` at its root. Layout produced here:
 *
 *   dist/site/
 *     index.html          generated gallery index
 *     examples/<name>/    each example, verbatim
 *     embed/              built embed bundles + styles
 *
 * Run after `npm run build:embed:site` so `dist/embed` is populated.
 */
import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteDir = path.join(root, 'dist/site');
const embedDir = path.join(root, 'dist/embed');
const galleryDir = path.join(root, 'dist/gallery');
const functionsDir = path.join(root, 'functions');
const examplesDir = path.join(root, 'examples');

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Examples that need a dev server (raw .tsx) cannot be statically hosted. */
const SKIP = new Set(['spec-playground', 'shared']);

async function main() {
  if (!(await exists(embedDir))) {
    throw new Error('dist/embed is missing. Run the embed build first.');
  }

  await rm(siteDir, { recursive: true, force: true });
  await mkdir(siteDir, { recursive: true });

  // Sourcemaps are debug artifacts, and the largest one is well past the
  // 25 MiB per-file ceiling Cloudflare Pages enforces, which fails the whole
  // upload. Ship the bundles without them.
  const withoutSourcemaps = { recursive: true, filter: (src) => !src.endsWith('.map') };

  await cp(embedDir, path.join(siteDir, 'embed'), withoutSourcemaps);

  // Examples 06 and 09 load their React harness from `/gallery/*.js`. Those
  // bundles build to dist/gallery, so the deployed site needs them at its
  // root too or the pages 404 and render an empty body.
  if (await exists(galleryDir)) {
    await cp(galleryDir, path.join(siteDir, 'gallery'), withoutSourcemaps);
  }

  // Cloudflare Pages picks up `functions/` from the deploy root and serves it
  // on the same origin as the gallery, which is how the examples reach the
  // token mint without CORS or a per-environment URL.
  if (await exists(functionsDir)) {
    await cp(functionsDir, path.join(siteDir, 'functions'), { recursive: true });
  }

  const entries = await readdir(examplesDir, { withFileTypes: true });
  const shipped = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP.has(entry.name)) continue;
    const src = path.join(examplesDir, entry.name);
    if (!(await exists(path.join(src, 'index.html')))) continue;
    // *.dev.html pages are dev-server-only harnesses (they reference
    // /tests/e2e/harness/ files that do not exist on the deployed site and
    // 404). Ship everything else verbatim.
    await cp(src, path.join(siteDir, 'examples', entry.name), {
      recursive: true,
      filter: (source) => !source.endsWith('.dev.html'),
    });
    shipped.push(entry.name);
  }

  // `examples/shared/` holds the tenant config + data JSON every example fetches.
  const sharedSrc = path.join(examplesDir, 'shared');
  if (await exists(sharedSrc)) {
    await cp(sharedSrc, path.join(siteDir, 'examples/shared'), { recursive: true });
  }

  const title = 'Agentable Canvas — examples';
  const items = shipped
    .sort()
    .map((name) => `      <li><a href="./examples/${name}/index.html">${name}</a></li>`)
    .join('\n');

  await writeFile(
    path.join(siteDir, 'index.html'),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { font: 16px/1.6 system-ui, sans-serif; margin: 3rem auto; max-width: 44rem; padding: 0 1rem; }
      h1 { font-size: 1.4rem; }
      li { margin: .35rem 0; }
      code { background: #f4f4f5; padding: .1rem .3rem; border-radius: 4px; }
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    <p>Live embed examples. Each page loads the built web components from <code>/embed</code>.</p>
    <ul>
${items}
    </ul>
  </body>
</html>
`,
    'utf8',
  );

  process.stdout.write(`site built: ${shipped.length} examples -> dist/site\n`);
}

main().catch((error) => {
  process.stderr.write(`${String(error?.message ?? error)}\n`);
  process.exitCode = 1;
});
