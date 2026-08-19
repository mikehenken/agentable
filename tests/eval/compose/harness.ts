/**
 * Compose eval harness runner.
 * Seeded adapter + fixed clock + mock model stubs — no live model calls.
 */
import { createCanvasHost, type EngineHandle, type EngineLifecycleEvent } from '../../../src/panels/host';
import { createPanelRegistry } from '../../../src/panels/registry';
import {
  createPanelToolRuntime,
  resetComposedPanelIdCounterForTests,
  type ComposePanelResult,
  type PanelToolRuntime,
} from '../../../src/panels/panelToolRuntime';
import { createApprovalController } from '../../../src/panels/approval';
import type { JsonObject } from '../../../src/panels/types';
import type { RepairErrorCode } from '../../../src/panels/spec/repairVocabulary';
import { createFixedClock, type FixedClock } from './fixedClock';
import { createSeededEvalAdapter } from './seededAdapter';
import {
  resolveMockModelPayload,
  type ComposeEvalSuiteFixture,
} from './mockModelProvider';
import { EVAL_SEO_PANEL } from './specFixtures';
import {
  aggregateModelMetrics,
  deriveCaseOutcome,
  primaryRejectionCode,
  type ComposeEvalAttemptRecord,
  type ComposeEvalCaseResult,
} from './metrics';
import {
  buildResultsTable,
  fingerprintResultsTable,
  formatResultsTableMarkdown,
  type ComposeEvalResultsTable,
} from './resultsTable';
import {
  evaluateComposeEvalRegressionGate,
  type ComposeEvalRegressionGateResult,
  type ComposeEvalRegressionThresholds,
} from './regressionGate';
import composeEvalSuite from './fixtures/compose-eval-suite.json';

class EvalFakeEngine implements EngineHandle {
  private ready = true;
  private listeners: Record<EngineLifecycleEvent, Set<() => void>> = {
    ready: new Set(),
    change: new Set(),
  };

  get isReady(): boolean {
    return this.ready;
  }

  on(event: EngineLifecycleEvent, listener: () => void): () => void {
    this.listeners[event].add(listener);
    return () => {
      this.listeners[event].delete(listener);
    };
  }

  exportSnapshot(): JsonObject {
    return {};
  }

  importSnapshot(): void {}

  openPanel(): void {}
}

export interface ComposeEvalHarnessOptions {
  suite?: ComposeEvalSuiteFixture;
  seed?: number;
  clockIso?: string;
  regressionThresholds?: ComposeEvalRegressionThresholds;
}

export interface ComposeEvalHarnessRun {
  table: ComposeEvalResultsTable;
  fingerprint: string;
  markdown: string;
  regression: ComposeEvalRegressionGateResult;
  caseResults: readonly ComposeEvalCaseResult[];
}

export function loadDefaultComposeEvalSuite(): ComposeEvalSuiteFixture {
  return composeEvalSuite as ComposeEvalSuiteFixture;
}

export async function runComposeEvalHarness(
  options: ComposeEvalHarnessOptions = {}): Promise<ComposeEvalHarnessRun> {
  const suite = options.suite ?? loadDefaultComposeEvalSuite;
  const seed = options.seed ?? suite.seed;
  const clockIso = options.clockIso ?? suite.clockIso;
  const clock = createFixedClock(clockIso);

  resetComposedPanelIdCounterForTests();

  const caseResults: ComposeEvalCaseResult[] = [];

  for (const evalCase of suite.cases) {
    const { runtime, dispose } = createEvalRuntime(seed);
    try {
      caseResults.push(await runEvalCase(runtime, suite, evalCase, clock));
    } finally {
      dispose();
    }
  }

  const modelMetrics = aggregateModelMetrics(caseResults);
  const table = buildResultsTable({
    seed,
    clockIso,
    generatedAtIso: clock.nowIso,
    caseResults,
    modelMetrics,
  });

  const fingerprint = fingerprintResultsTable(table);
  const markdown = formatResultsTableMarkdown(table);
  const regression = evaluateComposeEvalRegressionGate(table, options.regressionThresholds);

  return {
    table,
    fingerprint,
    markdown,
    regression,
    caseResults,
  };
}

function createEvalRuntime(seed: number): { runtime: PanelToolRuntime; dispose: () => void } {
  const engine = new EvalFakeEngine();
  const adapter = createSeededEvalAdapter({ seed });
  const host = createCanvasHost({
    engine,
    panels: [EVAL_SEO_PANEL],
    adapter,
  });
  const registry = createPanelRegistry(host.panels.definitions);
  const runtime = createPanelToolRuntime(
    { panels: host.panels, catalog: host.catalog },
    registry,
    { approvalController: createApprovalController });

  return {
    runtime,
    dispose: () => {
      runtime.dispose();
      host.dispose();
    },
  };
}

async function runEvalCase(
  runtime: PanelToolRuntime,
  suite: ComposeEvalSuiteFixture,
  evalCase: ComposeEvalSuiteFixture['cases'][number],
  clock: FixedClock): Promise<ComposeEvalCaseResult> {
  const attempts: ComposeEvalAttemptRecord[] = [];
  let attemptIndex = 0;

  while (attemptIndex < evalCase.responses.length) {
    const payload = resolveMockModelPayload(suite, evalCase, attemptIndex);
    if (payload === undefined) {
      break;
    }

    clock.advance(1);
    const result = await runtime.composePanel(payload.spec);
    const rejectionCodes = extractRejectionCodes(result);

    attempts.push({
      attemptIndex,
      phase: payload.phase,
      ok: result.ok,
      agentRepairEligible: result.ok ? false: result.agentRepairEligible,
      rejectionCodes,
    });

    if (result.ok) {
      break;
    }

    if (!result.agentRepairEligible) {
      break;
    }

    attemptIndex += 1;
  }

  return {
    caseId: evalCase.id,
    modelId: evalCase.modelId,
    outcome: deriveCaseOutcome(attempts),
    attempts,
    primaryRejectionCode: primaryRejectionCode(attempts),
    clockIso: clock.nowIso,
  };
}

function extractRejectionCodes(result: ComposePanelResult): RepairErrorCode[] {
  if (result.ok) {
    return [];
  }
  return result.errors.map((entry) => entry.code);
}

export type {
  ComposeEvalSuiteFixture,
  ComposeEvalResultsTable,
  ComposeEvalRegressionGateResult,
  ComposeEvalRegressionThresholds,
  FixedClock,
};
