#!/usr/bin/env node
/** List HTML/JS asset refs vs files on disk. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const re = /assets\/[a-zA-Z0-9._-]+/g;
const refs = new Set([...(html.match(re) || []),...(js.match(re) || [])]);
const dir = path.join(root, 'assets');
const files = new Set(fs.existsSync(dir) ? fs.readdirSync(dir): []);

console.log('=== HTML/JS refs ===');
/** @type {string[]} */
const missing = [];
for (const r of [...refs].sort) {
  const name = path.basename(r);
  const ok = files.has(name);
  if (!ok) {
    missing.push(r);
  }
  const size = ok ? fs.statSync(path.join(dir, name)).size: 0;
  console.log(`${ok ? 'OK': 'MISSING'} ${r}${ok ? ` (${size} bytes)`: ''}`);
}

console.log('\n=== Orphan assets (on disk, not referenced) ===');
for (const f of [...files].sort) {
  if (![...refs].some((r) => path.basename(r) === f)) {
    console.log(` ${f}`);
  }
}

console.log(`\nmissingCount=${missing.length}`);
if (missing.length) {
  process.exitCode = 1;
}
