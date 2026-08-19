#!/usr/bin/env node
/**
 * compose eval harness CLI — CI regression gate scaffold.
 *
 * Usage:
 * node scripts/run-compose-eval.mjs
 * node scripts/run-compose-eval.mjs --write-log
 *
 * Runs vitest on composeEvalHarness.test.ts. With --write-log, copies vitest
 * output into the iteration log folder when present.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const defaultLogDir = path.resolve(
  repoRoot,
  '..',
  '..',
  'landi-labs',
  'studies',
  'Orchestration',
  'agentable-panels',
  'logs',
  'p10-ecosystem-wave',
  '',
  '');

const writeLog = process.argv.includes('--write-log');
const logDir = process.env.COMPOSE_EVAL_LOG_DIR ?? defaultLogDir;

const result = spawnSync(
  'npm',
  ['run', 'test', '--', 'tests/unit/composeEvalHarness.test.ts'],
  {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

const combined = [result.stdout ?? '', result.stderr ?? ''].filter(Boolean).join('\n');
process.stdout.write(combined);

if (writeLog) {
  fs.mkdirSync(logDir, { recursive: true });
  const stamp = new Date.toISOString.replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(logDir, `test-run-${stamp}.log`), combined, 'utf8');
  fs.writeFileSync(path.join(logDir, 'test-run.log'), combined, 'utf8');
}

process.exit(result.status ?? 1);
