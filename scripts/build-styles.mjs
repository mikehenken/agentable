#!/usr/bin/env node
/**
 * Compiles `src/index.css` (Tailwind base + Landi brand tokens) into a
 * standalone `dist/styles.css` that React-canvas consumers can import
 * without needing matching Tailwind config in their host.
 *
 * Why: `agentable-canvas/styles.css` resolves (per package.json `exports`)
 * to the raw `src/index.css` source. A consumer who doesn't run Tailwind
 * over the canvas's source paths will get raw `@tailwind` directives in
 * their stylesheet, not actual utilities. This script outputs a compiled
 * version so any host can `import 'agentable-canvas/dist/styles.css'`
 * and get a complete stylesheet.
 *
 * Run: `npm run build:styles`
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const inFile = path.join(root, 'src', 'index.css');
const outFile = path.join(distDir, 'styles.css');

if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });

console.log(`Building styles: ${inFile} → ${outFile}`);

// Use Tailwind CLI directly. Same `tailwind.config.js` (in repo root).
const result = spawnSync(
  'npx',
  [
    'tailwindcss',
    '-i', inFile,
    '-o', outFile,
    '--minify',
  ],
  { cwd: root, stdio: 'inherit', shell: true }
);

if (result.status !== 0) {
  console.error('Tailwind build failed.');
  process.exit(result.status ?? 1);
}

console.log('✓ dist/styles.css built.');
