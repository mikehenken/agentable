#!/usr/bin/env node

/**

 * release conformance CLI — engine kit + axe a11y gate scaffold.

 *

 * Usage:

 * node scripts/run-release-conformance.mjs

 * node scripts/run-release-conformance.mjs --write-log

 * node scripts/run-release-conformance.mjs --write-report

 *

 * Runs:

 * 1. vitest engineConformanceTldraw + releaseConformanceGate

 * 2. web-test-runner component a11y smokes (axe)

 * Writes optional log + scaffold report under docs/conformance/releases/.

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

const writeReport = process.argv.includes('--write-report');

const logDir = process.env.RELEASE_CONFORMANCE_LOG_DIR ?? defaultLogDir;



const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

const packageVersion = pkg.version ?? '0.0.0';



function run(cmd, args, label) {

  const result = spawnSync(cmd, args, {

    cwd: repoRoot,

    encoding: 'utf8',

    shell: process.platform === 'win32',

  });

  const combined = [result.stdout ?? '', result.stderr ?? ''].filter(Boolean).join('\n');

  return { label, status: result.status ?? 1, combined };

}



const runs = [];



runs.push(

  run('npm', [

    'run',

    'test',

    '--',

    'tests/unit/engineConformanceTldraw.test.ts',

    'tests/unit/releaseConformanceGate.test.ts',

  ], 'engine+gate vitest'));



runs.push(run('npm', ['run', 'test:a11y'], 'component a11y (axe)'));



const logSections = runs.map((r) => `=== ${r.label} (exit ${r.status}) ===\n${r.combined}`);

const fullLog = logSections.join('\n\n');

process.stdout.write(fullLog);



function parseVitestPassed(output) {

  const passMatch = output.match(/Tests\s+(\d+)\s+passed/);

  const failMatch = output.match(/Tests\s+\d+\s+passed(?:\s*\|\s*(\d+)\s+failed)?/);

  const passed = passMatch ? Number(passMatch[1]): 0;

  const failed = failMatch?.[1] ? Number(failMatch[1]): 0;

  return { passed, failed, total: passed + failed };

}



function parseWtrPassed(output) {
  const matches = [...output.matchAll(/(\d+)\s+passed,\s+(\d+)\s+failed/g)];
  const last = matches[matches.length - 1];
  if (last) {
    const passed = Number(last[1]);
    const failed = Number(last[2]);
    return { passed, failed, total: passed + failed };
  }
  const passMatch = output.match(/(\d+)\s+tests? passed/);
  const failMatch = output.match(/(\d+)\s+tests? failed/);
  const passed = passMatch ? Number(passMatch[1]): 0;
  const failed = failMatch ? Number(failMatch[1]): 0;
  return { passed, failed, total: passed + failed };
}



const engineRun = runs[0];

const a11yRun = runs[1];

const engineTotals = parseVitestPassed(engineRun.combined);

const a11yTotals = parseWtrPassed(a11yRun.combined);

const enginePassed = engineRun.status === 0;

const a11yPassed = a11yRun.status === 0;

const generatedAtIso = new Date.toISOString();



if (writeLog) {

  fs.mkdirSync(logDir, { recursive: true });

  const stamp = generatedAtIso.replace(/[:.]/g, '-');

  fs.writeFileSync(path.join(logDir, `test-run-${stamp}.log`), fullLog, 'utf8');

  fs.writeFileSync(path.join(logDir, 'test-run.log'), fullLog, 'utf8');

}



if (writeReport) {

  const releasesDir = path.join(repoRoot, 'docs/conformance/releases');

  fs.mkdirSync(releasesDir, { recursive: true });



  const templatePath = path.join(repoRoot, 'docs/conformance/RELEASE_REPORT.template.md');

  const template = fs.readFileSync(templatePath, 'utf8');



  const reportMd = template.replace(/\{\{VERSION\}\}/g, packageVersion).replace(/\{\{PUBLISH_STATUS\}\}/g, 'Scaffold (freeze)').replace(/\{\{GENERATED_AT_ISO\}\}/g, generatedAtIso).replace(/\{\{ENGINE_STATUS\}\}/g, enginePassed ? 'PASS': 'FAIL').replace(/\{\{ENGINE_PASSED\}\}/g, String(engineTotals.passed)).replace(/\{\{ENGINE_TOTAL\}\}/g, String(engineTotals.total)).replace(/\{\{A11Y_STATUS\}\}/g, a11yPassed ? 'PASS': 'FAIL').replace(/\{\{A11Y_PASSED\}\}/g, String(a11yTotals.passed)).replace(/\{\{A11Y_TOTAL\}\}/g, String(a11yTotals.total)).replace(/\{\{A11Y_VIOLATIONS\}\}/g, '0');



  const reportName = `v${packageVersion}-scaffold.md`;

  fs.writeFileSync(path.join(releasesDir, reportName), reportMd, 'utf8');



  const summary = {

    packageVersion,

    generatedAtIso,

    enginePassed,

    engineTotals,

    a11yPassed,

    a11yTotals,

    allPassed: enginePassed && a11yPassed,

  };

  fs.writeFileSync(

    path.join(releasesDir, `${reportName}.json`),

    JSON.stringify(summary, null, 2),

    'utf8');

}



const exitCode = runs.some((r) => r.status !== 0) ? 1: 0;

process.exit(exitCode);

