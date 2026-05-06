#!/usr/bin/env node
/**
 * `prepare` lifecycle hook — runs on `npm install` (incl. github: installs)
 * AND on local `npm install` after clone.
 *
 * Strategy:
 *   - Skip in CI of consuming projects when dist/ is already shipped (the
 *     normal github-install path — bundles ride along in git).
 *   - Skip if vite isn't available (consumer ran `npm install --production`).
 *   - Otherwise build the embed bundles + styles so dev clones get a working
 *     dist without an extra step.
 *
 * This keeps `npm install github:mikehenken/agentable` zero-config: the
 * shipped dist/ is present, prepare exits silently, and `agentable-canvas/
 * embed` resolves immediately.
 */

import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const distEmbed = resolve(root, 'dist', 'embed', 'agentable-canvas.js');
const distStyles = resolve(root, 'dist', 'styles.css');
const viteBin = resolve(root, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');

if (existsSync(distEmbed) && existsSync(distStyles)) {
  // Already built (shipped via git). Nothing to do.
  process.exit(0);
}

if (!existsSync(viteBin)) {
  // Consumer install with --production or some other reason vite isn't here.
  // Fail quietly — they can still consume `./src/*` exports if they have
  // their own bundler (Vite/Webpack/etc.).
  console.warn(
    '[agentable-canvas] vite not available; skipping prepare build. ' +
      'If you need the prebuilt embed bundle at dist/embed/agentable-canvas.js, ' +
      'run `npm install` (without --production) and `npm run build:embed:all`.'
  );
  process.exit(0);
}

console.log('[agentable-canvas] building embed bundles via prepare hook…');
const result = spawnSync('npm', ['run', 'build:embed:all'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 0);
