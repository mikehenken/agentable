#!/usr/bin/env node
/**
 * Gallery import guard: examples must consume published entry points only.
 *
 * Two scans:
 *   1. Source files (ts/tsx/js/jsx/vue/svelte/mjs): no imports that reach
 *      into repo src/ (relative `../../src/...`, any `/src/` path segment,
 *      or the `@/` alias). Examples are the adoption surface; an example
 *      that imports internals works in this repo and breaks for every
 *      consumer.
 *   2. HTML script tags: `src` must point into /embed/, /gallery/, or the
 *      example's own directory. `/tests/...` or `/src/...` references ship
 *      404s to the deployed gallery.
 *
 * `*.dev.html` files are skipped: they are dev-server-only harness pages and
 * are excluded from the deployed site copy by build-examples-site.mjs.
 *
 * ALLOWLIST (shrink-only; removing an entry requires the import to be gone,
 * adding one requires an explicit owner decision, mirroring the
 * careerPackBundleBoundary rule): two examples still import repo src
 * directly. Repointing them to published entry points is P16 API-surface
 * work (the devtools playground and the telemetry reference sink have no
 * published entry point yet).
 *
 * History: the original version of this script shipped with unterminated
 * regex literals and had never parsed, so the boundary it claims to guard
 * was never checked (first fixed 2026-08-28).
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
// GALLERY_GUARD_EXAMPLES_ROOT exists for the guard's own fixture test, which
// points it at a directory containing deliberate violations to prove the
// scanner cannot rot into a vacuous green.
const examplesRoot = process.env.GALLERY_GUARD_EXAMPLES_ROOT
  ? path.resolve(process.env.GALLERY_GUARD_EXAMPLES_ROOT)
  : path.join(repoRoot, 'examples');

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte', '.mjs']);

/** repo-relative posix paths allowed to import repo src (shrink-only). */
const SRC_IMPORT_ALLOWLIST = new Set([
  'examples/spec-playground/App.tsx',
  'examples/telemetry-reference-sink/referenceSink.ts',
]);

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

/** @param {string} file */
function rel(file) {
  return path.relative(repoRoot, file).split(path.sep).join('/');
}

const importPatterns = [
  /from\s+['"]([^'"]*)['"]/g,
  /import\s*\(\s*['"]([^'"]*)['"]\s*\)/g,
  /require\s*\(\s*['"]([^'"]*)['"]\s*\)/g,
];

// The repo layout puts src/ next to examples/, so "reaching into src" means
// resolving into the sibling src directory of whatever tree is being scanned.
const srcDir = path.join(path.dirname(examplesRoot), 'src') + path.sep;

/** @param {string} specifier @param {string} file */
function isSrcReach(specifier, file) {
  if (specifier.startsWith('@/')) return true;
  if (specifier.startsWith('.')) {
    const target = path.resolve(path.dirname(file), specifier);
    return target.startsWith(srcDir) || target === srcDir.slice(0, -1);
  }
  return /(^|\/)src\//.test(specifier) && specifier.startsWith('/');
}

/** @type {Array<{ file: string; detail: string }>} */
const violations = [];

const allFiles = walk(examplesRoot);
let scannedSources = 0;
let scannedHtml = 0;

for (const file of allFiles) {
  const ext = path.extname(file);
  const relPath = rel(file);

  if (SOURCE_EXT.has(ext)) {
    scannedSources++;
    if (SRC_IMPORT_ALLOWLIST.has(relPath)) continue;
    const content = readFileSync(file, 'utf8');
    for (const pattern of importPatterns) {
      pattern.lastIndex = 0;
      for (const match of content.matchAll(pattern)) {
        const specifier = match[1];
        if (isSrcReach(specifier, file)) {
          violations.push({ file: relPath, detail: `imports ${specifier}` });
        }
      }
    }
    continue;
  }

  if (ext === '.html') {
    if (file.endsWith('.dev.html')) continue;
    scannedHtml++;
    const content = readFileSync(file, 'utf8');
    const exampleDir = rel(path.dirname(file));
    for (const match of content.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) {
      const src = match[1];
      const ok =
        src.startsWith('/embed/') ||
        src.startsWith('/gallery/') ||
        src.startsWith('./') ||
        (!src.startsWith('/') && !src.startsWith('..') && !src.includes('://')) ||
        src.startsWith(`/${exampleDir}/`);
      if (!ok) {
        violations.push({ file: relPath, detail: `script src="${src}"` });
      }
    }
  }
}

if (violations.length > 0) {
  console.error('\n✗ Gallery import guard failed. Examples must use published entry points only:\n');
  for (const v of violations) {
    console.error(`  ${v.file}: ${v.detail}`);
  }
  console.error(
    '\nAllowed script src prefixes: /embed/, /gallery/, the example\'s own directory.' +
      '\nAllowed imports: package entry points and example-local files.\n'
  );
  process.exit(1);
}

console.log(
  `✓ Gallery import guard passed (${scannedSources} source files, ${scannedHtml} HTML pages, ` +
    `${SRC_IMPORT_ALLOWLIST.size} allowlisted src importers).`
);
