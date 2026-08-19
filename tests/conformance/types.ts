/**
 * Release conformance report types.
 */
export interface ConformanceSuiteResult {
  readonly suiteId: string;
  readonly engineId: string;
  readonly passed: boolean;
  readonly totalTests: number;
  readonly passedTests: number;
  readonly failedTests: number;
}

export interface A11ySuiteResult {
  readonly suiteId: string;
  readonly runner: 'web-test-runner' | 'playwright';
  readonly passed: boolean;
  readonly totalTests: number;
  readonly passedTests: number;
  readonly failedTests: number;
  /** axe critical + serious violation count (target: 0). */
  readonly criticalSeriousViolations: number;
  readonly components: readonly string[];
}

export interface ReleaseConformanceReport {
  readonly packageVersion: string;
  readonly generatedAtIso: string;
  readonly publishStatus: 'scaffold' | 'published';
  readonly engine: ConformanceSuiteResult;
  readonly a11y: A11ySuiteResult;
  readonly skillArtifacts: {
    readonly skillPath: string;
    readonly llmsTxtPath: string;
    readonly referenceCount: number;
  };
  readonly freezeNote: string;
}

export interface ReleaseConformanceRunInput {
  readonly packageVersion: string;
  readonly generatedAtIso: string;
  readonly enginePassed: boolean;
  readonly engineTotals: { total: number; passed: number; failed: number };
  readonly a11yPassed: boolean;
  readonly a11yTotals: { total: number; passed: number; failed: number };
  readonly a11yCriticalSeriousViolations?: number;
  readonly a11yComponents?: readonly string[];
  readonly publishStatus?: 'scaffold' | 'published';
}
