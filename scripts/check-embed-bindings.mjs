#!/usr/bin/env node
/**
 * Guards the embed bundle against lucide-react import regressions where JSX
 * references a bare icon name (e.g. `Wrench`) that Rollup did not bind.
 * Minified output should only use short aliases like `kNe`.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.resolve(__dirname, '..', 'dist', 'embed', 'agentable-canvas.js');

/** Bare lucide component names that must not appear in minified JSX calls. */
const BARE_LUCIDE_JSX_FORBIDDEN = ['Wrench', 'AlertTriangle'];

async function main {
  let source;
  try {
    source = await readFile(bundlePath, 'utf8');
  } catch {
    console.error(`check-embed-bindings: missing ${bundlePath} — run build:embed first`);
    process.exit(2);
  }

  const hits = BARE_LUCIDE_JSX_FORBIDDEN.filter((name) =>
    new RegExp(`x\\.jsx(?:s)?\\(${name},`).test(source));

  if (hits.length === 0) {
    console.log('✓ Embed bundle lucide JSX bindings OK.');
    return;
  }

  console.error('✗ Embed bundle has bare lucide JSX identifier(s):');
  for (const name of hits) {
    console.error(` - x.jsx(${name}, …)`);
  }
  console.error(
    '\nRebuild agentable-canvas embed after fixing lucide imports, then copy to moss/embed.');
  process.exit(1);
}

main.catch((error) => {
  console.error('check-embed-bindings failed:', error);
  process.exit(2);
});
