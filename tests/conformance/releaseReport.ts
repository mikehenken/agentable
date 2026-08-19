/**
 * Build release conformance report from CI run inputs.
 */
import type {
  ReleaseConformanceReport,
  ReleaseConformanceRunInput,
} from './types';

export const ENGINE_CONFORMANCE_SUITE_ID = 'engine-spi-conformance-kit';
export const A11Y_SMOKE_SUITE_ID = 'lit-embed-a11y-axe-smoke';

export const SKILL_PATH = '.cursor/skills/agentable-framework/SKILL.md';
export const LLMS_TXT_PATH = 'llms.txt';
export const SKILL_REFERENCE_GLOB = '.cursor/skills/agentable-framework/references/**/*.md';

export const FREEZE_PUBLISH_DEFERRAL_NOTE =
  ' deploy_allowed: false — conformance markdown is scaffold-only in-repo. ' +
  'Public docs-site publish ( llms.txt + per-release report pages) deferred until freeze lifts and deploy authorization passes.';

export const A11Y_COMPONENTS_BASELINE: readonly string[] = [
  'agentable-canvas',
  'voice-call-button',
  'agentable-starter-chip',
  'ask-about-this-button',
  'agent-status-pill',
];

export function buildReleaseConformanceReport(
  input: ReleaseConformanceRunInput): ReleaseConformanceReport {
  const engineFailed = input.engineTotals.total - input.engineTotals.passed;
  const a11yFailed = input.a11yTotals.total - input.a11yTotals.passed;

  return {
    packageVersion: input.packageVersion,
    generatedAtIso: input.generatedAtIso,
    publishStatus: input.publishStatus ?? 'scaffold',
    engine: {
      suiteId: ENGINE_CONFORMANCE_SUITE_ID,
      engineId: 'tldraw',
      passed: input.enginePassed,
      totalTests: input.engineTotals.total,
      passedTests: input.engineTotals.passed,
      failedTests: engineFailed,
    },
    a11y: {
      suiteId: A11Y_SMOKE_SUITE_ID,
      runner: 'web-test-runner',
      passed: input.a11yPassed,
      totalTests: input.a11yTotals.total,
      passedTests: input.a11yTotals.passed,
      failedTests: a11yFailed,
      criticalSeriousViolations: input.a11yCriticalSeriousViolations ?? 0,
      components: input.a11yComponents ?? A11Y_COMPONENTS_BASELINE,
    },
    skillArtifacts: {
      skillPath: SKILL_PATH,
      llmsTxtPath: LLMS_TXT_PATH,
      referenceCount: 5,
    },
    freezeNote: FREEZE_PUBLISH_DEFERRAL_NOTE,
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(',')}}`;
}

export function fingerprintReleaseReport(
  report: ReleaseConformanceReport): string {
  const { generatedAtIso: _generatedAtIso,...stable } = report;
  return stableStringify(stable);
}

export function formatReleaseReportMarkdown(report: ReleaseConformanceReport): string {
  const engineStatus = report.engine.passed ? 'PASS': 'FAIL';
  const a11yStatus = report.a11y.passed ? 'PASS': 'FAIL';
  const publishLabel =
    report.publishStatus === 'published' ? 'Published': 'Scaffold (freeze)';

  return [
    `# Release conformance report — v${report.packageVersion}`,
    '',
    `| Field | Value |`,
    `|-------|-------|`,
    `| Generated | ${report.generatedAtIso} |`,
    `| Publish status | ${publishLabel} |`,
    `| Package | agentable-canvas |`,
    '',
    '## Engine SPI conformance ',
    '',
    `| Engine | Suite | Status | Passed | Total |`,
    `|--------|-------|--------|--------|-------|`,
    `| ${report.engine.engineId} | ${report.engine.suiteId} | **${engineStatus}** | ${report.engine.passedTests} | ${report.engine.totalTests} |`,
    '',
    '## Accessibility — axe smoke (WCAG 2.1 AA)',
    '',
    `| Suite | Runner | Status | Passed | Total | Critical+serious |`,
    `|-------|--------|--------|--------|-------|------------------|`,
    `| ${report.a11y.suiteId} | ${report.a11y.runner} | **${a11yStatus}** | ${report.a11y.passedTests} | ${report.a11y.totalTests} | ${report.a11y.criticalSeriousViolations} |`,
    '',
    'Components under test:',
    '',...report.a11y.components.map((c) => `- \`${c}\``),
    '',
    '## Agent integration artifacts ',
    '',
    `| Artifact | Path |`,
    `|----------|------|`,
    `| Framework skill | \`${report.skillArtifacts.skillPath}\` |`,
    `| llms.txt | \`${report.skillArtifacts.llmsTxtPath}\` |`,
    `| Reference docs | ${report.skillArtifacts.referenceCount} files under \`.cursor/skills/agentable-framework/references/\` |`,
    '',
    '## Freeze publish deferral',
    '',
    report.freezeNote,
    '',
    '## CI commands',
    '',
    '```bash',
    'npm run test:release-conformance',
    'node scripts/run-release-conformance.mjs --write-log',
    '```',
    '',
  ].join('\n');
}
