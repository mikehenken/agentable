/**
 * Mock model response provider for compose eval.
 * No live model calls — scripted spec refs per model + case.
 */
import type { EvalSpecRef } from './specFixtures';
import { resolveEvalSpec } from './specFixtures';

export interface ComposeEvalModelStub {
  id: string;
  label: string;
}

export interface ComposeEvalResponseStub {
  phase: 'compose' | 'repair';
  specRef: EvalSpecRef;
}

export interface ComposeEvalCaseStub {
  id: string;
  modelId: string;
  responses: readonly ComposeEvalResponseStub[];
}

export interface ComposeEvalSuiteFixture {
  seed: number;
  clockIso: string;
  models: readonly ComposeEvalModelStub[];
  cases: readonly ComposeEvalCaseStub[];
}

export interface MockModelComposePayload {
  caseId: string;
  modelId: string;
  phase: 'compose' | 'repair';
  attemptIndex: number;
  spec: unknown;
}

export function getModelStub(
  suite: ComposeEvalSuiteFixture,
  modelId: string): ComposeEvalModelStub {
  const model = suite.models.find((entry) => entry.id === modelId);
  if (model === undefined) {
    throw new Error(`compose eval: unknown model id "${modelId}"`);
  }
  return model;
}

export function getCaseStub(suite: ComposeEvalSuiteFixture, caseId: string): ComposeEvalCaseStub {
  const evalCase = suite.cases.find((entry) => entry.id === caseId);
  if (evalCase === undefined) {
    throw new Error(`compose eval: unknown case id "${caseId}"`);
  }
  return evalCase;
}

/**
 * Resolve the next scripted model payload for a case attempt.
 * Returns undefined when the case has no further responses.
 */
export function resolveMockModelPayload(
  suite: ComposeEvalSuiteFixture,
  evalCase: ComposeEvalCaseStub,
  attemptIndex: number): MockModelComposePayload | undefined {
  const response = evalCase.responses[attemptIndex];
  if (response === undefined) {
    return undefined;
  }

  return {
    caseId: evalCase.id,
    modelId: evalCase.modelId,
    phase: response.phase,
    attemptIndex,
    spec: resolveEvalSpec(response.specRef),
  };
}
