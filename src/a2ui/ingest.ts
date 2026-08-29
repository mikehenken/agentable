import { CURRENT_SPEC_VERSION } from '../panels/spec/constants';
import {
  validateSpec,
  type SpecValidationContext,
  type ValidateSpecOptions,
  type ValidateSpecResult,
} from '../panels/spec';
import type { PanelSpec } from '../panels/types';
import { buildPanelSpecFromComponents } from './componentMap';
import { parseA2UIEnvelope, safeParseA2UIEnvelope } from './schema';
import {
  applyA2UIEnvelope,
  applyA2UIStream,
  createA2UISurfaceState,
  inferSurfaceIdFromEnvelope,
  surfaceHasRoot,
} from './surfaceState';
import type {
  A2UIEnvelope,
  A2UIIngestFailure,
  A2UIIngestIssue,
  A2UIIngestOptions,
  A2UIIngestResult,
  A2UISurfaceState,
} from './types';

function failure(
  errors: A2UIIngestIssue[],
  warnings: A2UIIngestIssue[] = []): A2UIIngestFailure {
  return { ok: false, errors, warnings };
}

function surfaceToPanelSpec(
  state: A2UISurfaceState,
  origin: 'host' | 'agent'): A2UIIngestResult {
  if (state.deleted) {
    return failure([{ code: 'A2UI_SURFACE_DELETED', message: `Surface "${state.surfaceId}" was deleted` }]);
  }
  if (!surfaceHasRoot(state)) {
    return failure([
      {
        code: 'A2UI_ROOT_MISSING',
        message: 'A2UI surface must define a component with id "root"',
      },
    ]);
  }

  const mapped = buildPanelSpecFromComponents(state.components, state.dataModel);
  if (mapped.errors.length > 0) {
    return failure(mapped.errors, mapped.warnings);
  }
  if (mapped.specNodes.root === undefined) {
    return failure(
      [{ code: 'A2UI_ROOT_MISSING', message: 'Mapped IR is missing root node' }],
      mapped.warnings);
  }

  const spec: PanelSpec = {
    v: CURRENT_SPEC_VERSION,
    origin,
    root: 'root',
    nodes: mapped.specNodes,
  };
  if (mapped.state !== undefined) {
    spec.state = mapped.state;
  }
  if (mapped.sources !== undefined) {
    spec.sources = mapped.sources;
  }
  if (Object.keys(mapped.actions).length > 0) {
    spec.actions = mapped.actions;
  }

  return {
    ok: true,
    spec,
    surfaceId: state.surfaceId,
    actions: mapped.actions,
    warnings: mapped.warnings,
  };
}

/** Ingest one A2UI envelope into a PanelSpec IR document. */
export function ingestA2UIEnvelope(
  input: unknown,
  options: A2UIIngestOptions = {}): A2UIIngestResult {
  const parsed = safeParseA2UIEnvelope(input);
  if (!parsed.ok) {
    return failure([{ code: 'A2UI_ENVELOPE_INVALID', message: parsed.message }]);
  }
  const surfaceId = options.surfaceId ?? inferSurfaceIdFromEnvelope(parsed.data);
  if (surfaceId === null) {
    return failure([{ code: 'A2UI_SURFACE_MISSING', message: 'Could not infer surfaceId from envelope' }]);
  }
  const state = createA2UISurfaceState(surfaceId);
  applyA2UIEnvelope(state, parsed.data);
  return surfaceToPanelSpec(state, options.origin ?? 'agent');
}

/** Ingest an ordered A2UI message stream (JSONL progressive updates). */
export function ingestA2UIStream(
  messages: readonly unknown[],
  options: A2UIIngestOptions = {}): A2UIIngestResult {
  const envelopes: A2UIEnvelope[] = [];
  const errors: A2UIIngestIssue[] = [];

  for (const [index, message] of messages.entries()) {
    const parsed = safeParseA2UIEnvelope(message);
    if (!parsed.ok) {
      errors.push({
        code: 'A2UI_ENVELOPE_INVALID',
        message: `Message ${index}: ${parsed.message}`,
      });
      continue;
    }
    envelopes.push(parsed.data as A2UIEnvelope);
  }
  if (errors.length > 0) {
    return failure(errors);
  }
  if (envelopes.length === 0) {
    return failure([{ code: 'A2UI_ENVELOPE_INVALID', message: 'Stream is empty' }]);
  }

  const surfaceId =
    options.surfaceId ??
    inferSurfaceIdFromEnvelope(parseA2UIEnvelope(envelopes[0]!)) ??
    null;
  if (surfaceId === null) {
    return failure([{ code: 'A2UI_SURFACE_MISSING', message: 'Could not infer surfaceId from stream' }]);
  }

  const state = applyA2UIStream(
    surfaceId,
    envelopes.map((entry) => parseA2UIEnvelope(entry)));
  return surfaceToPanelSpec(state, options.origin ?? 'agent');
}

/** Convenience: ingest then run the standard validateSpec pipeline. */
export function ingestAndValidateA2UI(
  input: unknown,
  context: SpecValidationContext,
  ingestOptions: A2UIIngestOptions = {},
  validateOptions?: ValidateSpecOptions): { ingest: A2UIIngestResult; validation?: ValidateSpecResult } {
  const ingest = Array.isArray(input)
    ? ingestA2UIStream(input, ingestOptions): ingestA2UIEnvelope(input, ingestOptions);
  if (!ingest.ok) {
    return { ingest };
  }
  const validation = validateSpec(ingest.spec, context, validateOptions);
  return { ingest, validation };
}

export { parseA2UIEnvelope, safeParseA2UIEnvelope } from './schema';
export { applyA2UIEnvelope, applyA2UIStream, createA2UISurfaceState } from './surfaceState';
export { buildPanelSpecFromComponents, mapA2UIComponentToIrNode } from './componentMap';
export type {
  A2UIEnvelope,
  A2UIIngestIssue,
  A2UIIngestOptions,
  A2UIIngestResult,
  A2UIConformanceFixture,
} from './types';
