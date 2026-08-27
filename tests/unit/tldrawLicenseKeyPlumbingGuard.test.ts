/**
 * Deploy contract guard — the tldraw license key must reach the embed bundles.
 *
 * Regression: the published gallery rendered normally for ~5 seconds and then
 * emptied itself. tldraw's `LicenseProvider` classifies an https non-localhost
 * origin built with `NODE_ENV=production` as `unlicensed-production` and, after
 * `LICENSE_TIMEOUT`, swaps the whole editor subtree for a hidden
 * `data-testid="tl-license-expired"` div. No error is thrown and nothing is
 * logged beyond tldraw's own banner, so the canvas, the toolbar, and the chat
 * composer all vanish silently.
 *
 * localhost is exempt from that check, which is exactly why local dev, unit
 * tests, and Playwright against a dev server all stayed green. Only a deployed
 * host reproduces it — so the guard has to live at the build-config layer.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

const LICENSE_ENV_VAR = 'VITE_TLDRAW_LICENSE_KEY';

/** Build steps that compile tldraw into a bundle served from a public origin. */
const PUBLISHED_BUILD_SCRIPTS = ['build:examples-site'] as const;

interface WorkflowStep {
  name?: string;
  run?: string;
  env?: Record<string, string>;
}

interface WorkflowFile {
  jobs?: Record<string, { steps?: WorkflowStep[] }>;
}

function repoRoot(): string {
  const testPath = expect.getState().testPath;
  if (!testPath) {
    throw new Error('vitest did not report a testPath');
  }
  return resolve(dirname(testPath), '../..');
}

function collectSteps(workflow: WorkflowFile): WorkflowStep[] {
  return Object.values(workflow.jobs ?? {}).flatMap((job) => job.steps ?? []);
}

describe('tldraw license key plumbing', () => {
  it('reads the license key from the build environment in WhiteboardShell', () => {
    const shell = readFileSync(
      join(repoRoot(), 'src/engines/tldraw/WhiteboardShell.tsx'),
      'utf8',
    );

    expect(shell).toContain(`import.meta.env.${LICENSE_ENV_VAR}`);
    expect(shell).toContain('licenseKey={TLDRAW_LICENSE_KEY}');
  });

  it('passes the license key into every published gallery build step', () => {
    const workflowPath = join(repoRoot(), '.github/workflows/deploy-examples.yml');
    const workflow = yaml.load(readFileSync(workflowPath, 'utf8')) as WorkflowFile;
    const steps = collectSteps(workflow);
    expect(steps.length).toBeGreaterThan(0);

    const buildSteps = steps.filter((step) =>
      PUBLISHED_BUILD_SCRIPTS.some((script) => step.run?.includes(`npm run ${script}`)),
    );
    expect(
      buildSteps.length,
      `no step in deploy-examples.yml runs one of: ${PUBLISHED_BUILD_SCRIPTS.join(', ')}`,
    ).toBeGreaterThan(0);

    for (const step of buildSteps) {
      expect(
        Object.keys(step.env ?? {}),
        `step "${step.name ?? '(unnamed)'}" builds a public bundle without ${LICENSE_ENV_VAR}; ` +
          'the deployed editor will blank itself 5s after mount',
      ).toContain(LICENSE_ENV_VAR);
    }
  });
});
