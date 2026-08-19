/**
 * CI regression gate for per-release conformance + a11y.
 */
import type { ReleaseConformanceReport } from './types';

export interface ReleaseConformanceThresholds {
  /** Engine SPI conformance suite must pass entirely. */
  requireEnginePass: boolean;
  /** axe smoke suite must pass entirely. */
  requireA11yPass: boolean;
  /** Maximum allowed axe critical+serious violations (target 0). */
  maxCriticalSeriousViolations: number;
  /** Skill + llms.txt must be present (checked separately in artifact gate). */
  requireSkillArtifacts: boolean;
}

export interface ReleaseConformanceViolation {
  readonly code: string;
  readonly message: string;
}

export interface ReleaseConformanceGateResult {
  readonly ok: boolean;
  readonly violations: readonly ReleaseConformanceViolation[];
}

export const DEFAULT_RELEASE_CONFORMANCE_THRESHOLDS: ReleaseConformanceThresholds = {
  requireEnginePass: true,
  requireA11yPass: true,
  maxCriticalSeriousViolations: 0,
  requireSkillArtifacts: true,
};

export function evaluateReleaseConformanceGate(
  report: ReleaseConformanceReport,
  thresholds: ReleaseConformanceThresholds = DEFAULT_RELEASE_CONFORMANCE_THRESHOLDS): ReleaseConformanceGateResult {
  const violations: ReleaseConformanceViolation[] = [];

  if (thresholds.requireEnginePass && !report.engine.passed) {
    violations.push({
      code: 'ENGINE_CONFORMANCE_FAILED',
      message: `engine suite ${report.engine.suiteId} failed (${report.engine.failedTests} failing tests)`,
    });
  }

  if (thresholds.requireA11yPass && !report.a11y.passed) {
    violations.push({
      code: 'A11Y_SMOKE_FAILED',
      message: `a11y suite ${report.a11y.suiteId} failed (${report.a11y.failedTests} failing tests)`,
    });
  }

  if (
    report.a11y.criticalSeriousViolations > thresholds.maxCriticalSeriousViolations
  ) {
    violations.push({
      code: 'A11Y_VIOLATION_BUDGET',
      message:
        `axe critical+serious violations ${report.a11y.criticalSeriousViolations} ` +
        `exceed budget ${thresholds.maxCriticalSeriousViolations}`,
    });
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}

export interface SkillArtifactCheck {
  readonly skillExists: boolean;
  readonly llmsTxtExists: boolean;
  readonly referencePaths: readonly string[];
}

export function evaluateSkillArtifactGate(
  check: SkillArtifactCheck,
  requireArtifacts: boolean = DEFAULT_RELEASE_CONFORMANCE_THRESHOLDS.requireSkillArtifacts): ReleaseConformanceGateResult {
  if (!requireArtifacts) {
    return { ok: true, violations: [] };
  }

  const violations: ReleaseConformanceViolation[] = [];

  if (!check.skillExists) {
    violations.push({
      code: 'SKILL_MISSING',
      message: 'Framework SKILL.md not found at.cursor/skills/agentable-framework/SKILL.md',
    });
  }

  if (!check.llmsTxtExists) {
    violations.push({
      code: 'LLMS_TXT_MISSING',
      message: 'llms.txt not found at package root',
    });
  }

  if (check.referencePaths.length < 5) {
    violations.push({
      code: 'SKILL_REFERENCES_INCOMPLETE',
      message: `expected ≥5 skill reference files, found ${check.referencePaths.length}`,
    });
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}

export function mergeGateResults(...results: readonly ReleaseConformanceGateResult[]
): ReleaseConformanceGateResult {
  const violations = results.flatMap((r) => r.violations);
  return { ok: violations.length === 0, violations };
}
