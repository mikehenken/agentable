/**
 * Runtime backing the panel tools (six acting + read-only describe_panel).
 * Handlers stay pure wrappers over this seam so Gemini text, Gemini Live,
 * execution path (03 section 1).
 */
import {
  actionAutoApproveKey,
  computePayloadDiff,
  createApprovalController,
} from './approval';
import type {
  ApprovalActor,
  ApprovalController,
  PanelToolApprovalOptions,
} from './approval/types';
import type { ComposeGateEvaluation } from './composeGate';
import { COMPOSE_GATE_CLOSED_CODE } from './composeGate';
import type { SpecDevtoolsSession } from '../devtools/specDevtoolsSession';
import {
  recordSpecActionRun,
  recordSpecHitlQueued,
  recordSpecHitlResolved,
  recordSpecInspection,
  recordSpecRepairFailure,
} from '../devtools/specDevtoolsBridge';
import { dispatchChatPrompt } from '../choreography';
import type { PanelRegistry } from './registry';
import {
  declaredActionIds,
  declaredFieldPaths,
  deriveRegistryAgentMetas,
  findPanelAgentMeta,
  type PanelActionMeta,
  type PanelAgentMeta,
  type PanelFieldMeta,
} from './registryMetadata';
import { describePanel, type DescribePanelArgs, type DescribePanelOutcome } from './describe';
import { validateSpec } from './spec';
import type { RepairErrorCode } from './spec/repairVocabulary';
import { applyJsonPatch, type JsonPatchOperation } from './spec/applyJsonPatch';
import type { SpecIssue } from './spec/types';
import type { PanelOpenOptions } from './host';
import type { PanelOpenResolveInput } from '../engine/openPanelResolver';
import {
  panelOpenOptionsFromPlacement,
  panelOpenResolveInputFromRuntimeArgs,
  resolveOpenPanelPlacement,
} from '../engine/openPanelResolver';
import type { CatalogEntry, JsonObject, JsonValue, PanelScope, PanelSpec } from './types';
import {
  createUndoReversalRuntime,
  type ReversalResult,
  type StackRedoResult,
  type StackUndoResult,
  type UndoReversalRuntime,
  type CanvasStackOp,
} from '../agents/reversal';
import {
  getAgentToolContext,
  toApprovalActor,
  approvalActorAgentId,
} from '../agents/agentContext';
import type { ActivityLogFilter } from '../agents/activity';
import {
  buildComposeTelemetryEvent,
  buildHitlTelemetryEvent,
  type TelemetryEmit,
} from '../telemetry';

export interface PanelToolHost {
  panels: {
    open(id: string, options?: PanelOpenOptions): Promise<void>;
    has(id: string): boolean;
  };
  catalog: ReadonlyMap<string, CatalogEntry>;
}

export interface PanelFieldError {
  path: string;
  message: string;
}

export interface PanelOpenInstance {
  panelId: string;
  definitionId: string;
  scope: PanelScope;
  dirty: boolean;
  composed: boolean;
}

export interface ListPanelsResult {
  id: string;
  title: string;
  agentDescription?: string;
  scope: PanelAgentMeta['scope'];
  contextKinds?: readonly string[];
  fields?: readonly PanelFieldMeta[];
  actions?: readonly PanelActionMeta[];
  openInstances: readonly PanelOpenInstance[];
}

export interface FillPanelResult {
  ok: true;
  applied: string[];
  skippedUserDirty: string[];
  errors?: PanelFieldError[];
}

export interface PanelSpecValidationError {
  code: RepairErrorCode;
  message: string;
  nodeId?: string;
  path?: string;
 /** Nearest-valid-alternative hint from the validator. */
  hint?: string;
 /** Structured repair suggestion surfaced to agents. */
  suggestedFix?: string;
}

export interface ComposePanelSuccess {
  ok: true;
  panelId: string;
}

export interface ComposePanelFailure {
  ok: false;
  errors: readonly PanelSpecValidationError[];
 /** True when the agent may attempt exactly one structured repair (.7). */
  agentRepairEligible: boolean;
}

export type ComposePanelResult = ComposePanelSuccess | ComposePanelFailure;

export interface PatchPanelSuccess {
  ok: true;
}

export interface PatchPanelFailure {
  ok: false;
  errors: readonly PanelSpecValidationError[];
 /** True when the agent may attempt exactly one structured repair (.7). */
  agentRepairEligible: boolean;
}

export type PatchPanelResult = PatchPanelSuccess | PatchPanelFailure;

export interface RunPanelActionOptions {
  actor?: ApprovalActor;
 /** When true, mutating actions always queue HITL even for user actor (reversal). */
  forceHitl?: boolean;
}

export type RunPanelActionResult =
  | { status: 'ok'; result: unknown; ledgerEntryId?: string }
  | { status: 'pending_approval' }
  | { status: 'rejected_by_user' }
  | { status: 'error'; message: string };

interface ApprovalControllerWithQueue extends ApprovalController {
  queue: (
    request: Omit<import('./approval/types').PendingApprovalRequest, 'id' | 'createdAt'>,
  ) => Promise<import('./approval/types').ApprovalResolutionStatus>;
  isAutoApproved: (actionKey: string) => boolean;
}

export interface FieldAttribution {
  agentId: string;
  agentLabel: string;
}

interface PanelInstanceState {
  panelId: string;
  definitionId: string;
  scope: PanelScope;
  composed: boolean;
  spec?: PanelSpec;
  values: Record<string, JsonValue>;
  userDirtyFields: Set<string>;
  agentFilledFields: Set<string>;
 /** Per-field acting agent for chrome attribution. */
  fieldAttribution: Map<string, FieldAttribution>;
 /** Set after the first repair-eligible patch validation failure (.7). */
  patchRepairConsumed: boolean;
}

export interface PanelToolRuntime {
  describePanel(args: DescribePanelArgs): DescribePanelOutcome;
  listPanels(): ListPanelsResult[];
  openPanel(
    id: string,
    scopeOrOptions?: PanelScope | PanelOpenResolveInput,
    slotLegacy?: string,
  ): Promise<{ ok: true; panelId: string } | { ok: false; error: string }>;
  fillPanel(
    id: string,
    patch: Record<string, unknown>,
  ): Promise<FillPanelResult | { ok: false; error: string }>;
  composePanel(
    spec: unknown,
    options?: { title?: string; pin?: boolean },
  ): Promise<ComposePanelResult>;
  patchPanel(
    panelId: string,
    ops: unknown,
  ): Promise<PatchPanelResult | { ok: false; error: string }>;
  runPanelAction(
    panelId: string,
    actionId: string,
    payload?: Record<string, unknown>,
    options?: RunPanelActionOptions,
  ): Promise<RunPanelActionResult>;
  markFieldUserDirty(panelId: string, fieldPath: string): void;
  getFieldMarkers(panelId: string): { agentFilled: ReadonlySet<string>; userDirty: ReadonlySet<string> };
  getFieldAttribution(panelId: string): ReadonlyMap<string, FieldAttribution>;
 /** Map an open instance id back to its registered definition id (scopes). */
  resolveDefinitionId(panelId: string): string | undefined;
  readonly approvalController: ApprovalController;
 /** undo/reversal: canvas stack undo + compensating mutation reversal. */
  readonly undoReversal: UndoReversalRuntime;
  pushCanvasOp(actor: ApprovalActor, op: CanvasStackOp): ReturnType<UndoReversalRuntime['pushCanvasOp']>;
  stackUndo(actor: ApprovalActor): StackUndoResult;
  stackRedo(actor: ApprovalActor): StackRedoResult;
  reverseMutation(ledgerEntryId: string, actor?: ApprovalActor): Promise<ReversalResult>;
  getActivityLedger(filter?: ActivityLogFilter): ReturnType<UndoReversalRuntime['getLedger']>;
  dispose(): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizePatch(value: unknown): Record<string, JsonValue> | null {
  if (!isRecord(value)) return null;
  const patch: Record<string, JsonValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    patch[key] = entry as JsonValue;
  }
  return patch;
}

function instanceIsDirty(state: PanelInstanceState): boolean {
  return state.userDirtyFields.size > 0 || state.agentFilledFields.size > 0;
}

function toOpenInstance(state: PanelInstanceState): PanelOpenInstance {
  return {
    panelId: state.panelId,
    definitionId: state.definitionId,
    scope: state.scope,
    dirty: instanceIsDirty(state),
    composed: state.composed,
  };
}

let composedCounter = 0;

function nextComposedPanelId(): string {
  composedCounter += 1;
  return `composed-${composedCounter}`;
}

/** Reset composed panel id sequence for deterministic eval/tests. */
export function resetComposedPanelIdCounterForTests(): void {
  composedCounter = 0;
}

function toValidationErrors(issues: readonly SpecIssue[]): PanelSpecValidationError[] {
  return issues.map((entry) => ({
    code: entry.code,
    message: entry.message,
    nodeId: entry.nodeId,
    path: entry.path,
    hint: entry.hint,
    suggestedFix: entry.hint,
  }));
}

function buildValidationContext(
  host: PanelToolHost,
  registry: PanelRegistry,
  spec: PanelSpec,
): {
  catalog: PanelToolHost['catalog'];
  adapterSources: Set<string>;
  hostActions: Set<string>;
  panelRegistry: Set<string>;
} {
  return {
    catalog: host.catalog,
    adapterSources: extractAdapterSources(spec),
    hostActions: new Set(),
    panelRegistry: new Set(registry.ids()),
  };
}

function resolveAgentRepairEligible(
  validatorEligible: boolean | undefined,
  repairConsumed: boolean,
): boolean {
  return validatorEligible === true && !repairConsumed;
}

function validationFailure(
  errors: readonly SpecIssue[],
  validatorEligible: boolean | undefined,
  repairConsumed: boolean,
): { errors: readonly PanelSpecValidationError[]; agentRepairEligible: boolean; consumeRepair: boolean } {
  const agentRepairEligible = resolveAgentRepairEligible(validatorEligible, repairConsumed);
  return {
    errors: toValidationErrors(errors),
    agentRepairEligible,
    consumeRepair: agentRepairEligible,
  };
}
function extractAdapterSources(spec: PanelSpec): Set<string> {
  const sources = new Set<string>();
  if (spec.sources !== undefined) {
    for (const binding of Object.values(spec.sources)) {
      sources.add(binding.source);
    }
  }
  if (spec.actions !== undefined) {
    for (const action of Object.values(spec.actions)) {
      if (action.kind === 'mutate') {
        sources.add(action.source);
      }
    }
  }
  return sources;
}

interface ResolvedActingAgent {
  actor: import('./approval/types').ApprovalActor;
  agentId: string;
  agentLabel: string;
  provenance: { derivedFrom: `agent:${string}` } | { derivedFrom: 'user' };
}

function resolveActingAgent(
  runOptions: RunPanelActionOptions,
): ResolvedActingAgent {
  if (runOptions.actor === 'user') {
    return {
      actor: 'user',
      agentId: 'user',
      agentLabel: 'User',
      provenance: { derivedFrom: 'user' },
    };
  }

  const ctx = getAgentToolContext();
  if (ctx !== null) {
    return {
      actor: toApprovalActor(ctx.agentId),
      agentId: ctx.agentId,
      agentLabel: ctx.agentLabel,
      provenance: { derivedFrom: `agent:${ctx.agentId}` },
    };
  }

  const explicitActor = runOptions.actor;
  if (explicitActor !== undefined && explicitActor !== 'agent') {
    const agentId = approvalActorAgentId(explicitActor) ?? explicitActor;
    return {
      actor: explicitActor.startsWith('agent:') ? explicitActor : toApprovalActor(agentId),
      agentId,
      agentLabel: agentId,
      provenance: { derivedFrom: `agent:${agentId}` },
    };
  }

  return {
    actor: 'agent',
    agentId: 'default',
    agentLabel: 'Agent',
    provenance: { derivedFrom: 'agent:default' },
  };
}

function resolveFillAttribution(): FieldAttribution | undefined {
  const ctx = getAgentToolContext();
  if (ctx === null) return undefined;
  return { agentId: ctx.agentId, agentLabel: ctx.agentLabel };
}

function normalizeActionPayload(
  payload: Record<string, unknown> | undefined,
): Record<string, JsonValue> {
  if (payload === undefined) return {};
  const normalized: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    normalized[key] = value as JsonValue;
  }
  return normalized;
}

export interface PanelToolRuntimeOptions extends PanelToolApprovalOptions {
  composeGate?: ComposeGateEvaluation;
  undoReversal?: UndoReversalRuntime;
 /** Optional devtools session for spec inspector trace. */
  devtoolsSession?: SpecDevtoolsSession;
 /** Host telemetry sink emit hook (`host.telemetry.emit`). */
  telemetryEmit?: TelemetryEmit;
}

export function createPanelToolRuntime(
  host: PanelToolHost,
  registry: PanelRegistry,
  options: PanelToolRuntimeOptions = {},
): PanelToolRuntime {
  const instances = new Map<string, PanelInstanceState>();
  const approvalController = (options.approvalController ??
    createApprovalController({ autoApprove: options.autoApprove })) as ApprovalControllerWithQueue;
  let disposed = false;
  let composeRepairConsumed = false;
  const composeGate = options.composeGate;
  const devtoolsSession = options.devtoolsSession;
  const telemetryEmit = options.telemetryEmit;

  const runtimeRef: { current: PanelToolRuntime | null } = { current: null };

  const undoReversal =
    options.undoReversal ??
    createUndoReversalRuntime({
      executeCompensatingAction: async (panelId, actionId, payload, actor) => {
        const runtime = runtimeRef.current;
        if (runtime === undefined || runtime === null) {
          return { status: 'error', message: 'panel tool runtime not initialized' };
        }
        return runtime.runPanelAction(panelId, actionId, payload, { actor, forceHitl: true });
      },
    });

  const resolveDefinitionInstance = (definitionId: string): PanelInstanceState | undefined => {
    for (const state of instances.values()) {
      if (state.definitionId === definitionId && !state.composed) {
        return state;
      }
    }
    return undefined;
  };

  const getOrCreateDefinitionInstance = (
    definitionId: string,
    scope: PanelScope,
  ): PanelInstanceState => {
    const existing = resolveDefinitionInstance(definitionId);
    if (existing !== undefined) return existing;

    const panelId = `${definitionId}-${instances.size + 1}`;
    const created: PanelInstanceState = {
      panelId,
      definitionId,
      scope,
      composed: false,
      values: {},
      userDirtyFields: new Set(),
      agentFilledFields: new Set(),
      fieldAttribution: new Map(),
      patchRepairConsumed: false,
    };
    instances.set(panelId, created);
    return created;
  };

  const runtime: PanelToolRuntime = {
    describePanel(args: DescribePanelArgs): DescribePanelOutcome {
      if (disposed) {
        return { ok: false, error: 'panel tool runtime disposed' };
      }
      return describePanel(args, { registry, catalog: host.catalog });
    },

    listPanels(): ListPanelsResult[] {
      const openByDefinition = new Map<string, PanelOpenInstance[]>();
      for (const state of instances.values()) {
        const list = openByDefinition.get(state.definitionId) ?? [];
        list.push(toOpenInstance(state));
        openByDefinition.set(state.definitionId, list);
      }

      return deriveRegistryAgentMetas(registry).map((meta) => ({
        id: meta.id,
        title: meta.title,
        agentDescription: meta.agentDescription,
        scope: meta.scope,
        contextKinds: meta.contextKinds,
        fields: meta.fields.length > 0 ? meta.fields : undefined,
        actions: meta.actions.length > 0 ? meta.actions : undefined,
        openInstances: openByDefinition.get(meta.id) ?? [],
      }));
    },

    async openPanel(
      id: string,
      scopeOrOptions?: PanelScope | PanelOpenResolveInput,
      slotLegacy?: string,
    ): Promise<{ ok: true; panelId: string } | { ok: false; error: string }> {
      if (disposed) {
        return { ok: false, error: 'panel tool runtime disposed' };
      }
      if (!registry.has(id)) {
        return { ok: false, error: `unknown panel id "${id}"` };
      }

      const resolveInput = panelOpenResolveInputFromRuntimeArgs(scopeOrOptions, slotLegacy);
      const resolved = resolveOpenPanelPlacement(id, resolveInput);
      if (!resolved.ok) {
        return { ok: false, error: resolved.message };
      }

      const scope = resolved.placement.scope ?? {};
      const openOptions = panelOpenOptionsFromPlacement(resolved.placement);

      try {
        await host.panels.open(id, openOptions);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
      }

      const instance = getOrCreateDefinitionInstance(id, scope);
      return { ok: true, panelId: instance.panelId };
    },

    async fillPanel(
      id: string,
      patchInput: Record<string, unknown>,
    ): Promise<FillPanelResult | { ok: false; error: string }> {
      if (disposed) {
        return { ok: false, error: 'panel tool runtime disposed' };
      }

      const meta = findPanelAgentMeta(registry, id);
      if (meta === undefined) {
        return { ok: false, error: `unknown panel id "${id}"` };
      }

      const patch = normalizePatch(patchInput);
      if (patch === null) {
        return { ok: false, error: 'patch must be a plain object' };
      }

      const allowed = declaredFieldPaths(meta);
      if (allowed.size === 0) {
        return { ok: false, error: `panel "${id}" has no declared fillable fields` };
      }

      const instance = resolveDefinitionInstance(id);
      if (instance === undefined) {
        return { ok: false, error: `panel "${id}" is not open` };
      }

      const applied: string[] = [];
      const skippedUserDirty: string[] = [];
      const errors: PanelFieldError[] = [];
      const fillAttribution = resolveFillAttribution();

      for (const [path, value] of Object.entries(patch)) {
        if (!allowed.has(path)) {
          errors.push({ path, message: 'field is not declared on this panel' });
          continue;
        }
        if (instance.userDirtyFields.has(path)) {
          skippedUserDirty.push(path);
          continue;
        }
        instance.values[path] = value;
        instance.agentFilledFields.add(path);
        if (fillAttribution !== undefined) {
          instance.fieldAttribution.set(path, fillAttribution);
        }
        applied.push(path);
      }

      const result: FillPanelResult = {
        ok: true,
        applied,
        skippedUserDirty,
      };
      if (errors.length > 0) {
        result.errors = errors;
      }
      return result;
    },

    async composePanel(
      specInput: unknown,
      options?: { title?: string; pin?: boolean },
    ): Promise<ComposePanelResult> {
      if (disposed) {
        return {
          ok: false,
          agentRepairEligible: false,
          errors: [{ code: 'RUNTIME_DISPOSED', message: 'panel tool runtime disposed' }],
        };
      }
      if (composeGate !== undefined && !composeGate.open) {
        return {
          ok: false,
          agentRepairEligible: false,
          errors: [
            {
              code: composeGate.code ?? COMPOSE_GATE_CLOSED_CODE,
              message:
                composeGate.reason ??
                `compose_panel is gated (${composeGate.id})`,
            },
          ],
        };
      }
      if (!isRecord(specInput)) {
        return {
          ok: false,
          agentRepairEligible: false,
          errors: [{ code: 'VALIDATION', message: 'spec must be a panel IR envelope object' }],
        };
      }

      const specRecord = specInput as JsonObject;
      const withAgentOrigin: PanelSpec = {
        ...(specRecord as unknown as PanelSpec),
        origin: 'agent',
      };

      const validation = validateSpec(withAgentOrigin, buildValidationContext(host, registry, withAgentOrigin), {
        agentRepairRound: true,
      });
      if (!validation.ok) {
        const failure = validationFailure(
          validation.errors,
          validation.agentRepairEligible,
          composeRepairConsumed,
        );
        const repairAttempt = composeRepairConsumed;
        if (failure.consumeRepair) {
          composeRepairConsumed = true;
        }
        if (devtoolsSession !== undefined) {
          recordSpecRepairFailure(
            devtoolsSession,
            'compose_panel',
            withAgentOrigin,
            validation.errors,
            failure.agentRepairEligible,
            'compose',
          );
        }
        telemetryEmit?.(
          buildComposeTelemetryEvent({
            phase: repairAttempt ? 'repair' : 'compose',
            outcome: 'rejected',
            tool: 'compose_panel',
            agentRepairEligible: failure.agentRepairEligible,
            errorCodes: failure.errors.map((entry) => entry.code),
          }),
        );
        return {
          ok: false,
          errors: failure.errors,
          agentRepairEligible: failure.agentRepairEligible,
        };
      }

      const repairedSuccess = composeRepairConsumed;
      composeRepairConsumed = false;

      const panelId = nextComposedPanelId();
      if (devtoolsSession !== undefined) {
        recordSpecInspection(
          devtoolsSession,
          panelId,
          validation.spec,
          [],
          validation.warnings,
        );
      }
      const instance: PanelInstanceState = {
        panelId,
        definitionId: panelId,
        scope: {},
        composed: true,
        spec: validation.spec,
        values: {},
        userDirtyFields: new Set(),
        agentFilledFields: new Set(),
        fieldAttribution: new Map(),
        patchRepairConsumed: false,
      };
      instances.set(panelId, instance);

      if (options?.pin === true) {
        instance.agentFilledFields.add('__pinned');
      }

      telemetryEmit?.(
        buildComposeTelemetryEvent({
          phase: repairedSuccess ? 'repair' : 'compose',
          outcome: repairedSuccess ? 'repaired_success' : 'success',
          tool: 'compose_panel',
          panelId,
        }),
      );

      void options?.title;
      return { ok: true, panelId };
    },

    async patchPanel(
      panelId: string,
      opsInput: unknown,
    ): Promise<PatchPanelResult | { ok: false; error: string }> {
      if (disposed) {
        return { ok: false, error: 'panel tool runtime disposed' };
      }

      const instance = instances.get(panelId);
      if (instance === undefined) {
        return { ok: false, error: `unknown panel instance "${panelId}"` };
      }
      if (!instance.composed) {
        return { ok: false, error: 'patch_panel applies to composed panel instances only' };
      }
      if (instance.spec === undefined) {
        return { ok: false, error: `composed panel "${panelId}" has no spec envelope` };
      }
      if (!Array.isArray(opsInput)) {
        return { ok: false, error: 'ops must be an RFC 6902 operation array' };
      }

      const operations: JsonPatchOperation[] = [];
      for (const op of opsInput) {
        if (!isRecord(op) || typeof op.op !== 'string' || typeof op.path !== 'string') {
          return {
            ok: false,
            agentRepairEligible: false,
            errors: [{ code: 'VALIDATION', message: 'each op requires op and path strings' }],
          };
        }
        if (op.op !== 'add' && op.op !== 'remove' && op.op !== 'replace') {
          return {
            ok: false,
            agentRepairEligible: false,
            errors: [
              {
                code: 'VALIDATION',
                message: `unsupported patch op "${op.op}"; use add, remove, or replace`,
              },
            ],
          };
        }
        operations.push({
          op: op.op,
          path: op.path,
          ...(op.value !== undefined ? { value: op.value as JsonValue } : {}),
        });
      }

      const patched = applyJsonPatch(instance.spec as unknown as JsonObject, operations);
      if (!patched.ok) {
        telemetryEmit?.(
          buildComposeTelemetryEvent({
            phase: instance.patchRepairConsumed ? 'repair' : 'compose',
            outcome: 'rejected',
            tool: 'patch_panel',
            panelId,
            agentRepairEligible: false,
            errorCodes: ['PATCH_APPLY_FAILED'],
          }),
        );
        return {
          ok: false,
          agentRepairEligible: false,
          errors: [{ code: 'PATCH_APPLY_FAILED', message: patched.message }],
        };
      }

      const patchedSpec: PanelSpec = {
        ...(patched.document as unknown as PanelSpec),
        origin: 'agent',
      };

      const validation = validateSpec(
        patchedSpec,
        buildValidationContext(host, registry, patchedSpec),
        { agentRepairRound: true },
      );
      if (!validation.ok) {
        const failure = validationFailure(
          validation.errors,
          validation.agentRepairEligible,
          instance.patchRepairConsumed,
        );
        if (failure.consumeRepair) {
          instance.patchRepairConsumed = true;
        }
        if (devtoolsSession !== undefined) {
          recordSpecRepairFailure(
            devtoolsSession,
            panelId,
            patchedSpec,
            validation.errors,
            failure.agentRepairEligible,
            'patch',
          );
        }
        telemetryEmit?.(
          buildComposeTelemetryEvent({
            phase: failure.consumeRepair || instance.patchRepairConsumed ? 'repair' : 'compose',
            outcome: 'rejected',
            tool: 'patch_panel',
            panelId,
            agentRepairEligible: failure.agentRepairEligible,
            errorCodes: failure.errors.map((entry) => entry.code),
          }),
        );
        return {
          ok: false,
          errors: failure.errors,
          agentRepairEligible: failure.agentRepairEligible,
        };
      }

      const repairedSuccess = instance.patchRepairConsumed;
      instance.patchRepairConsumed = false;
      instance.spec = validation.spec;
      if (devtoolsSession !== undefined) {
        recordSpecInspection(
          devtoolsSession,
          panelId,
          validation.spec,
          [],
          validation.warnings,
        );
      }
      telemetryEmit?.(
        buildComposeTelemetryEvent({
          phase: repairedSuccess ? 'repair' : 'compose',
          outcome: repairedSuccess ? 'repaired_success' : 'success',
          tool: 'patch_panel',
          panelId,
        }),
      );
      return { ok: true };
    },

    async runPanelAction(
      panelId: string,
      actionId: string,
      payload?: Record<string, unknown>,
      runOptions: RunPanelActionOptions = {},
    ): Promise<RunPanelActionResult> {
      if (disposed) {
        return { status: 'error', message: 'panel tool runtime disposed' };
      }

      const instance = instances.get(panelId);
      if (instance === undefined) {
        const byDefinition = resolveDefinitionInstance(panelId);
        if (byDefinition !== undefined) {
          return this.runPanelAction(byDefinition.panelId, actionId, payload, runOptions);
        }
        return { status: 'error', message: `unknown panel instance "${panelId}"` };
      }

      const meta = findPanelAgentMeta(registry, instance.definitionId);
      if (meta === undefined) {
        return { status: 'error', message: `panel definition missing for "${instance.definitionId}"` };
      }

      if (!declaredActionIds(meta).has(actionId)) {
        return { status: 'error', message: `unknown action "${actionId}" for panel "${meta.id}"` };
      }

      const action = meta.actions.find((entry) => entry.id === actionId);
      const acting = resolveActingAgent(runOptions);
      const actionPayload = normalizeActionPayload(payload);

      if (action?.kind === 'prompt' && action.prompt !== undefined) {
        dispatchChatPrompt(action.prompt, {
          source: `panel:${instance.panelId}:${actionId}`,
        });
        return {
          status: 'ok',
          result: { actionId, panelId: instance.panelId, prompt: action.prompt },
        };
      }

      if (action?.kind !== 'mutate') {
        return { status: 'ok', result: { actionId, panelId: instance.panelId } };
      }

      const autoApproveKey = actionAutoApproveKey(instance.definitionId, actionId);
      const bypassReview =
        !runOptions.forceHitl &&
        (acting.actor === 'user' ||
          approvalController.isAutoApproved(actionId) ||
          approvalController.isAutoApproved(autoApproveKey));

      const currentData = { ...instance.values };

      const executeMutation = (): RunPanelActionResult => {
        let ledgerEntryId: string | undefined;
        if (action !== undefined) {
          const ledgerEntry = undoReversal.recordPersistedMutation({
            actor: acting.actor,
            panelId: instance.panelId,
            definitionId: instance.definitionId,
            actionId,
            actionLabel: action.label ?? actionId,
            payload: actionPayload,
            beforeData: currentData,
            actionMeta: action,
            provenance: acting.provenance,
          });
          ledgerEntryId = ledgerEntry.id;
        }
        return {
          status: 'ok',
          result: { actionId, panelId: instance.panelId, payload: actionPayload },
          ledgerEntryId,
        };
      };

      if (bypassReview && !action.destructive) {
        return executeMutation();
      }

      const diff = computePayloadDiff(currentData, actionPayload);
      const initialPhase = bypassReview && action.destructive ? 'destructive_confirm' : 'review';

      if (initialPhase === 'review' && diff.length === 0 && Object.keys(actionPayload).length === 0) {
 // No visible diff; still surface review for mutating agent actions.
      }

      const resolution = await approvalController.queue({
        panelId: instance.panelId,
        definitionId: instance.definitionId,
        actionId,
        actionLabel: action.label ?? actionId,
        source: action.source,
        destructive: action.destructive === true,
        confirmMessage: action.confirmMessage,
        payload: actionPayload,
        currentData,
        diff,
        actor: acting.actor,
        agentId: acting.agentId,
        agentLabel: acting.agentLabel,
        phase: initialPhase,
        reversible: action.reversible !== false,
      });

      telemetryEmit?.(
        buildHitlTelemetryEvent({
          outcome: 'queued',
          panelId: instance.panelId,
          definitionId: instance.definitionId,
          actionId,
          agentId: acting.agentId,
        }),
      );

      const pendingEntry = approvalController
        .getPendingForPanel(instance.panelId)
        .find((entry) => entry.actionId === actionId);
      if (devtoolsSession !== undefined && pendingEntry !== undefined) {
        recordSpecHitlQueued(devtoolsSession, pendingEntry);
      }

      if (resolution === 'rejected_by_user') {
        if (devtoolsSession !== undefined && pendingEntry !== undefined) {
          recordSpecHitlResolved(devtoolsSession, pendingEntry, resolution);
        }
        telemetryEmit?.(
          buildHitlTelemetryEvent({
            outcome: 'rejected',
            panelId: instance.panelId,
            definitionId: instance.definitionId,
            actionId,
            agentId: acting.agentId,
          }),
        );
        return { status: 'rejected_by_user' };
      }

      if (devtoolsSession !== undefined && pendingEntry !== undefined) {
        recordSpecHitlResolved(devtoolsSession, pendingEntry, resolution);
      }

      telemetryEmit?.(
        buildHitlTelemetryEvent({
          outcome: 'approved',
          panelId: instance.panelId,
          definitionId: instance.definitionId,
          actionId,
          agentId: acting.agentId,
        }),
      );

      const mutationResult = executeMutation();
      if (devtoolsSession !== undefined) {
        recordSpecActionRun(devtoolsSession, instance.panelId, actionId, mutationResult.status);
      }
      return mutationResult;
    },

    markFieldUserDirty(panelId: string, fieldPath: string): void {
      const instance = instances.get(panelId);
      if (instance === undefined) return;
      instance.userDirtyFields.add(fieldPath);
      instance.agentFilledFields.delete(fieldPath);
      instance.fieldAttribution.delete(fieldPath);
    },

    getFieldMarkers(panelId: string): { agentFilled: ReadonlySet<string>; userDirty: ReadonlySet<string> } {
      const instance = instances.get(panelId);
      if (instance === undefined) {
        return { agentFilled: new Set(), userDirty: new Set() };
      }
      return {
        agentFilled: new Set(instance.agentFilledFields),
        userDirty: new Set(instance.userDirtyFields),
      };
    },

    getFieldAttribution(panelId: string): ReadonlyMap<string, FieldAttribution> {
      const instance = instances.get(panelId);
      if (instance === undefined) {
        return new Map();
      }
      return new Map(instance.fieldAttribution);
    },

    resolveDefinitionId(panelId: string): string | undefined {
      const instance = instances.get(panelId);
      if (instance !== undefined) return instance.definitionId;
      if (registry.has(panelId)) return panelId;
      const byDefinition = resolveDefinitionInstance(panelId);
      return byDefinition?.definitionId;
    },

    approvalController,

    undoReversal,

    pushCanvasOp(actor: ApprovalActor, op: CanvasStackOp) {
      if (disposed) {
        throw new Error('panel tool runtime disposed');
      }
      return undoReversal.pushCanvasOp(actor === 'user' ? 'user' : actor, op);
    },

    stackUndo(actor: ApprovalActor): StackUndoResult {
      if (disposed) {
        return { ok: false, code: 'STACK_EMPTY', message: 'panel tool runtime disposed' };
      }
      return undoReversal.stackUndo(actor === 'user' ? 'user' : actor);
    },

    stackRedo(actor: ApprovalActor): StackRedoResult {
      if (disposed) {
        return { ok: false, code: 'STACK_EMPTY', message: 'panel tool runtime disposed' };
      }
      return undoReversal.stackRedo(actor === 'user' ? 'user' : actor);
    },

    reverseMutation(ledgerEntryId: string, actor: ApprovalActor = 'user'): Promise<ReversalResult> {
      if (disposed) {
        return Promise.resolve({
          ok: false,
          code: 'ENTRY_NOT_FOUND',
          message: 'panel tool runtime disposed',
        });
      }
      return undoReversal.reverseMutation(ledgerEntryId, actor);
    },

    getActivityLedger(filter?: ActivityLogFilter) {
      return undoReversal.getLedger(filter);
    },

    dispose(): void {
      disposed = true;
      composeRepairConsumed = false;
      instances.clear();
      runtimeRef.current = null;
    },
  };

  runtimeRef.current = runtime;
  return runtime;
}

export function applyFillPatch(
  instance: {
    values: Record<string, JsonValue>;
    userDirtyFields: ReadonlySet<string>;
    agentFilledFields: Set<string>;
  },
  patch: Record<string, JsonValue>,
  allowed: ReadonlySet<string>,
): FillPanelResult {
  const applied: string[] = [];
  const skippedUserDirty: string[] = [];
  const errors: PanelFieldError[] = [];

  for (const [path, value] of Object.entries(patch)) {
    if (!allowed.has(path)) {
      errors.push({ path, message: 'field is not declared on this panel' });
      continue;
    }
    if (instance.userDirtyFields.has(path)) {
      skippedUserDirty.push(path);
      continue;
    }
    instance.values[path] = value;
    instance.agentFilledFields.add(path);
    applied.push(path);
  }

  const result: FillPanelResult = {
    ok: true,
    applied,
    skippedUserDirty,
  };
  if (errors.length > 0) {
    result.errors = errors;
  }
  return result;
}
