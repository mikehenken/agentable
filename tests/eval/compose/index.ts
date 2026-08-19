/**
 * Compose eval harness exports.
 */
export { createFixedClock, type FixedClock } from './fixedClock';
export { createSeededRandom, type SeededRandom } from './seededRandom';
export { createSeededEvalAdapter, type SeededEvalAdapterOptions } from './seededAdapter';
export {
  EVAL_SEO_PANEL,
  invalidSeoSpec,
  resolveEvalSpec,
  type EvalSpecRef,
} from './specFixtures';
export {
  getCaseStub,
  getModelStub,
  resolveMockModelPayload,
  type ComposeEvalCaseStub,
  type ComposeEvalModelStub,
  type ComposeEvalResponseStub,
  type ComposeEvalSuiteFixture,
  type MockModelComposePayload,
} from './mockModelProvider';
export {
  aggregateModelMetrics,
  aggregateOverallMetrics,
  deriveCaseOutcome,
  primaryRejectionCode,
  type ComposeEvalAggregateMetrics,
  type ComposeEvalAttemptRecord,
  type ComposeEvalCaseResult,
  type ComposeEvalModelMetrics,
  type ComposeEvalOutcome,
} from './metrics';
export {
  buildResultsTable,
  fingerprintResultsTable,
  formatResultsTableMarkdown,
  type ComposeEvalResultRow,
  type ComposeEvalResultsTable,
} from './resultsTable';
export {
  DEFAULT_COMPOSE_EVAL_BASELINE,
  evaluateComposeEvalRegressionGate,
  type ComposeEvalRegressionGateResult,
  type ComposeEvalRegressionThresholds,
  type ComposeEvalRegressionViolation,
} from './regressionGate';
export {
  loadDefaultComposeEvalSuite,
  runComposeEvalHarness,
  type ComposeEvalHarnessOptions,
  type ComposeEvalHarnessRun,
} from './harness';
