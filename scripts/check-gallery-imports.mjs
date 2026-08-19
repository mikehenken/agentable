#!/usr/bin/env node
/**
 * gallery import guard — examples must not import src/ internals.
 * Allowed: package exports (agentable-canvas/*, @agentable/*), relative fixtures.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplesRoot = path.resolve(__dirname, '../examples');

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte', '.mjs']);

/** @param {string} dir */
function walk(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory) {
      files.push(...walk(full));
    } else if (SOURCE_EXT.has(path.extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

const forbiddenPatterns = [
  /from\s+['"][^'"]*\/src\,
  /from\s+['"]\.\.\/\.\.\/src\,
  /from\s+['"]@\/[^'"]+['"]/,
  /import\s*\(\s*['"][^'"]*\/src\,
  /require\s*\(\s*['"][^'"]*\/src\,
];

/** @type {Array<{ file: string; line: number; text: string }>} */
const violations = [];

for (const file of walk(examplesRoot)) {
  const rel = path.relative(examplesRoot, file);
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (forbiddenPatterns.some((pattern) => pattern.test(line))) {
      violations.push({ file: rel, line: index + 1, text: line.trim });
    }
  });
}

if (violations.length > 0) {
  console.error('\n✗ Gallery import guard failed — examples must use published entry points only:\n');
  for (const v of violations) {
    console.error(` examples/${v.file}:${v.line}`);
    console.error(` ${v.text}\n`);
  }
  process.exit(1);
}

console.log(`✓ Gallery import guard passed (${walk(examplesRoot).length} source files scanned).\n`);
