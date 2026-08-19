/**
 * release conformance gate — report builder, thresholds, artifact checks.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  A11Y_COMPONENTS_BASELINE,
  buildReleaseConformanceReport,
  fingerprintReleaseReport,
  formatReleaseReportMarkdown,
  LLMS_TXT_PATH,
  SKILL_PATH,
} from '../conformance/releaseReport';
import {
  DEFAULT_RELEASE_CONFORMANCE_THRESHOLDS,
  evaluateReleaseConformanceGate,
  evaluateSkillArtifactGate,
  mergeGateResults,
} from '../conformance/releaseGate';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

const EXPECTED_FINGERPRINT =
  '{"a11y":{"components":["agentable-canvas","voice-call-button","agentable-starter-chip","ask-about-this-button","agent-status-pill"],"criticalSeriousViolations":0,"failedTests":0,"passed":true,"passedTests":7,"runner":"web-test-runner","suiteId":"lit-embed-a11y-axe-smoke","totalTests":7},"engine":{"engineId":"tldraw","failedTests":0,"passed":true,"passedTests":24,"suiteId":"engine-spi-conformance-kit","totalTests":24},"freezeNote":" deploy_allowed: false — conformance markdown is scaffold-only in-repo. Public docs-site publish ( llms.txt + per-release report pages) deferred until freeze lifts and deploy authorization passes.","packageVersion":"0.2.0","publishStatus":"scaffold","skillArtifacts":{"llmsTxtPath":"llms.txt","referenceCount":5,"skillPath":".cursor/skills/agentable-framework/SKILL.md"}}';

describe('release conformance report builder ', () => {
  it('buildReleaseConformanceReport produces stable fingerprint excluding timestamp', () => {
    const report = buildReleaseConformanceReport({
      packageVersion: '0.2.0',
      generatedAtIso: '2026-07-21T18:00:00.000Z',
      enginePassed: true,
      engineTotals: { total: 24, passed: 24, failed: 0 },
      a11yPassed: true,
      a11yTotals: { total: 7, passed: 7, failed: 0 },
      a11yCriticalSeriousViolations: 0,
      a11yComponents: A11Y_COMPONENTS_BASELINE,
    });

    expect(fingerprintReleaseReport(report)).toBe(EXPECTED_FINGERPRINT);
  });

  it('formatReleaseReportMarkdown includes engine, a11y, and skill sections', () => {
    const report = buildReleaseConformanceReport({
      packageVersion: '0.2.0',
      generatedAtIso: '2026-07-21T18:00:00.000Z',
      enginePassed: true,
      engineTotals: { total: 24, passed: 24, failed: 0 },
      a11yPassed: true,
      a11yTotals: { total: 7, passed: 7, failed: 0 },
    });

    const md = formatReleaseReportMarkdown(report);
    expect(md).toContain('Engine SPI conformance');
    expect(md).toContain('axe smoke');
    expect(md).toContain('llms.txt');
    expect(md).toContain('Scaffold (freeze)');
  });
});

describe('release conformance gate ', () => {
  it('evaluateReleaseConformanceGate passes when engine and a11y pass with 0 violations', () => {
    const report = buildReleaseConformanceReport({
      packageVersion: '0.2.0',
      generatedAtIso: '2026-07-21T18:00:00.000Z',
      enginePassed: true,
      engineTotals: { total: 24, passed: 24, failed: 0 },
      a11yPassed: true,
      a11yTotals: { total: 7, passed: 7, failed: 0 },
      a11yCriticalSeriousViolations: 0,
    });

    const result = evaluateReleaseConformanceGate(
      report,
      DEFAULT_RELEASE_CONFORMANCE_THRESHOLDS);
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('evaluateReleaseConformanceGate fails on engine or a11y regression', () => {
    const failing = buildReleaseConformanceReport({
      packageVersion: '0.2.0',
      generatedAtIso: '2026-07-21T18:00:00.000Z',
      enginePassed: false,
      engineTotals: { total: 24, passed: 23, failed: 1 },
      a11yPassed: false,
      a11yTotals: { total: 7, passed: 6, failed: 1 },
      a11yCriticalSeriousViolations: 1,
    });

    const result = evaluateReleaseConformanceGate(failing);
    expect(result.ok).toBe(false);
    expect(result.violations.map((v) => v.code)).toEqual([
      'ENGINE_CONFORMANCE_FAILED',
      'A11Y_SMOKE_FAILED',
      'A11Y_VIOLATION_BUDGET',
    ]);
  });
});

describe('skill artifact gate ', () => {
  it('SKILL.md, llms.txt, and reference docs exist in repo', () => {
    const skillAbs = path.join(REPO_ROOT, SKILL_PATH);
    const llmsAbs = path.join(REPO_ROOT, LLMS_TXT_PATH);
    const refsDir = path.join(
      REPO_ROOT,
      '.cursor/skills/agentable-framework/references');

    const referencePaths: string[] = [];
    function walk(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory) walk(full);
        else if (entry.name.endsWith('.md')) referencePaths.push(full);
      }
    }
    walk(refsDir);

    const skillExists = fs.existsSync(skillAbs);
    const llmsTxtExists = fs.existsSync(llmsAbs);

    const artifactGate = evaluateSkillArtifactGate({
      skillExists,
      llmsTxtExists,
      referencePaths,
    });

    expect(artifactGate.ok).toBe(true);
    expect(referencePaths.length).toBeGreaterThanOrEqual(5);
  });

  it('mergeGateResults combines conformance and artifact violations', () => {
    const reportGate = evaluateReleaseConformanceGate(
      buildReleaseConformanceReport({
        packageVersion: '0.2.0',
        generatedAtIso: '2026-07-21T18:00:00.000Z',
        enginePassed: false,
        engineTotals: { total: 1, passed: 0, failed: 1 },
        a11yPassed: true,
        a11yTotals: { total: 1, passed: 1, failed: 0 },
      }));
    const artifactGate = evaluateSkillArtifactGate({
      skillExists: false,
      llmsTxtExists: false,
      referencePaths: [],
    });

    const merged = mergeGateResults(reportGate, artifactGate);
    expect(merged.ok).toBe(false);
    expect(merged.violations.length).toBeGreaterThan(2);
  });
});

describe('release report template scaffold ', () => {
  it('RELEASE_REPORT.template.md exists', () => {
    const templatePath = path.join(
      REPO_ROOT,
      'docs/conformance/RELEASE_REPORT.template.md');
    expect(fs.existsSync(templatePath)).toBe(true);
    const content = fs.readFileSync(templatePath, 'utf8');
    expect(content).toContain('Engine SPI conformance');
    expect(content).toContain('axe smoke');
  });
});
