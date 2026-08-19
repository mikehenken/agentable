#!/usr/bin/env node
/**
 * — CopilotKit version alignment gate (framework repo entrypoint).
 * Delegates to the shared checker beside landing-editor when present; otherwise runs
 * the local-only subset (exact pins + single minor within this repo).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frameworkRoot = path.resolve(__dirname, '..');
const sharedScript = path.resolve(
  frameworkRoot,
  '../../landing-editor/scripts/ci/check-copilotkit-version-alignment.mjs');

if (fs.existsSync(sharedScript)) {
  const result = spawnSync(process.execPath, [sharedScript], {
    stdio: 'inherit',
    cwd: frameworkRoot,
  });
  process.exit(result.status ?? 1);
}

console.error(
  'check-copilotkit-version-alignment: shared landing-editor script not found; run from monorepo checkout.');
process.exit(2);
