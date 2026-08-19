/**
 * Model-agnostic agent runtime + workspace world model (–).
 */
export type {
  AgentSession,
  AgentSessionKind,
  AgentSessionStatus,
  CapabilityNote,
  CapabilityNoteCode,
  CreateAgentSessionOptions,
  ModelCapabilities,
  ModelResolveContext,
  ModelResolver,
  ProviderBinding,
  ResolvedModelBinding,
} from './types';
export { ModelResolveError } from './types';

export {
  registerModelResolver,
  getRegisteredModelResolver,
  resolveModelBinding,
  clearModelResolverForTests,
} from './modelResolver';

export {
  deriveCapabilities,
  gateToolsForCapabilities,
  gateToolsForEngineCapabilities,
  selectOfferedTools,
  selectEngineOfferedTools,
  transportNotesForBinding,
  TOOL_CAPABILITY_DEGRADATION,
  TOOL_CAPABILITY_REQUIREMENTS,
  ENGINE_DRAW_REQUIRED_TOOLS,
} from './capabilities';
export type {
  CapabilityApproval,
  CapabilityClass,
  CapabilityDescriptor,
  EngineGatedToolOffer,
  GatedToolOffer,
  ToolCapabilityRequirement,
} from './capabilities';

export { createAgentSession } from './session';
export {
  createAgentRuntime,
  type AgentRuntime,
  type AgentRuntimeOptions,
} from './runtime';

export {
  createActivityLog,
  resetActivityLogCounterForTests,
  type ActivityActor,
  type ActivityEntry,
  type ActivityLog,
  type ActivityLogFilter,
  type ActivityProvenance,
  type ActivityReversalMeta,
  type DeclaredInverseAction,
} from './activity';

export {
  createUndoReversalRuntime,
  type CanvasStackOp,
  type RecordedMutationInput,
  type ReversalErrorCode,
  type ReversalResult,
  type StackRedoResult,
  type StackUndoErrorCode,
  type StackUndoResult,
  type UndoReversalRuntime,
  type UndoReversalRuntimeOptions,
} from './reversal';

export {
  applyDigestBudget,
  compileWorkspaceDigest,
  computeDigestDelta,
  createDigestCompiler,
  deriveAttention,
  estimateDigestTokens,
  DIGEST_HARD_CAP_TOKENS,
  DIGEST_RECENT_ACTIVITY_LIMIT,
  DIGEST_TARGET_TOKENS,
  type AttentionInput,
  type AttentionTier,
  type DigestActivitySummary,
  type DigestAgentSummary,
  type DigestBudgetDrop,
  type DigestBudgetOptions,
  type DigestCompileResult,
  type DigestCompiler,
  type DigestCompilerInput,
  type DigestContext,
  type DigestDelta,
  type DigestJobSummary,
  type DigestPanelSummary,
  type DigestPendingApproval,
  type DigestShapeSummary,
  type DigestUser,
  type WorkspaceDigest,
} from './digest';

export {
  buildDigestShapeSummary,
  cloneDigestShapeSummaries,
  digestShapeRevision,
  type DigestShapeRecordInput,
} from './digestShapes';

export {
  bindEngineDigestShapeSlice,
  getEngineDigestShapeSlice,
  resetEngineDigestShapeSliceForTests,
  type DigestShapeSlice,
} from './engineBridge';

export {
  bindDrawingActivityLog,
  recordAnnotatePanelActivity,
  recordClearDrawingsActivity,
  recordDrawShapesActivity,
  resetDrawingActivityLogForTests,
} from './drawingActivity';

export {
  createAgentRegistry,
  type AgentRegistry,
  type AgentRegistryEntry,
  type AgentRegistryRegisterInput,
} from './registry';

export {
  createLeaseManager,
  resetLeaseCounterForTests,
  type Lease,
  type LeaseClaimInput,
  type LeaseClaimResult,
  type LeaseManager,
} from './leases';

export {
  createCameraQueue,
  resetCameraIntentCounterForTests,
  DEFAULT_USER_CAMERA_GRACE_MS,
  type CameraEnqueueResult,
  type CameraIntent,
  type CameraMode,
  type CameraQueue,
} from './camera';

export {
  bindWalkthroughRuntime,
  getWalkthroughRuntime,
  isWalkthroughRuntimeBound,
  resetWalkthroughRuntimeForTests,
  type WalkthroughRuntimeBinding,
} from './walkthroughBridge';

export { runWalkthrough, cancelActiveWalkthrough } from './walkthroughRunner';

export {
  DEFAULT_WALKTHROUGH_DWELL_MS,
  WALKTHROUGH_UNAVAILABLE_CODE,
  type WalkthroughCameraIntent,
  type WalkthroughCancelReason,
  type WalkthroughNarration,
  type WalkthroughRunResult,
  type WalkthroughStepInput,
  type WalkthroughTarget,
} from './walkthroughTypes';

export {
  createAgentBudget,
  CHEAP_DEFAULT_UNITS,
  DEFAULT_BUDGET_HARD_CAP,
  DEFAULT_BUDGET_WARN_BELOW,
  EXPENSIVE_DEFAULT_UNITS,
  type AgentBudgetLimits,
  type AgentBudgetSignal,
  type BudgetCheckResult,
  type BudgetSpendRecord,
} from './budget';

export {
  createDrillDownTools,
  createDigestGetter,
  DRILL_DOWN_TOOL_NAMES,
  type DrillDownHost,
  type DrillDownToolName,
} from './drillDowns';

export {
  createHandoff,
  resetHandoffCounterForTests,
  type HandoffInput,
  type HandoffRecord,
  type HandoffResult,
} from './handoff';

export {
  AGENT_ACTIVITY_PANEL_ID,
  AGENTS_ACTIVITY_SOURCE,
  activityFilterFromParams,
  formatActivityRowSubtitle,
  formatActivityRowTitle,
  mapActivityEntriesToListRows,
  type ActivityListRow,
  type ActivityQueryParams,
} from './activityRows';

export {
  createActivityDataAdapter,
  withActivitySource,
} from './activityAdapter';

export {
  createAgentActivityPanelDefinition,
  AGENT_ACTIVITY_CATALOG_KEYS,
} from './panels';

export {
  createDocumentPanelDefinition,
  DOCUMENT_PANEL_CATALOG_KEYS,
} from './panels';

export {
  applyBlockOp,
  createDocumentUndoStack,
  createInMemoryDocumentStore,
  createPersistedDocumentStore,
  clearPersistedDocumentsForTests,
  createExportDocumentHostAction,
  createPanelDocumentResolver,
  exportDocument,
  exportDocumentBoth,
  sha256Bytes,
  resetDocumentBlockIdCounterForTests,
  sanitizePlainText,
  withDocumentSource,
  WORKSPACE_DOCUMENTS_SOURCE,
  DOCUMENT_PANEL_ID,
  DOCUMENT_EXPORT_GOLDEN_SEED,
  DOCUMENT_EXPORT_EPOCH,
  EXPORT_DOCUMENT_HOST_ACTION_ID,
  type BlockOp,
  type DocBlock,
  type DocumentPayload,
  type DocumentUndoStack,
  type DocumentExportFormat,
  type DocumentExportHostContext,
  type DocumentExportOptions,
  type DocumentExportResult,
} from '../panels/document';

export {
  withAgentToolContext,
  withAgentToolContextAsync,
  getAgentToolContext,
  resolveAgentLabel,
  toApprovalActor,
  approvalActorAgentId,
  type AgentToolExecutionContext,
} from './agentContext';

export {
  createAgentToolExecutor,
  requireAgentToolContext,
  SCOPE_DENIED_CODE,
  type AgentToolExecutor,
  type AgentToolExecutorOptions,
} from './toolExecutor';

export {
  DEFAULT_MULTI_AGENT_PRESETS,
  MULTI_AGENT_CONCIERGE_PRESET,
  MULTI_AGENT_EDITOR_PRESET,
  MULTI_AGENT_JOB_PRESET,
  registerMultiAgentDefaults,
} from './multiAgentDefaults';

export {
  buildWireframeSlotPanelSpec,
  geometriesMatchGolden,
  goldenSketchToDrawShapes,
  normalizeWireframeProposalForCompare,
  proposeWireframeLayout,
} from './workflows/wireframeToLayout';
export type {
  WireframeGoldenSketch,
  WireframeGoldenSketchShape,
  WireframeLayoutGeometry,
  WireframeLayoutProposal,
  WireframeLayoutRole,
  WireframeLayoutSlot,
  WireframeToLayoutReadInput,
} from '../engine/wireframeLayoutTypes';
