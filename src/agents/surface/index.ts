export {
  AgentableOperatorSurfaceElement,
  DEFAULT_OPERATOR_MODEL_OPTIONS,
  DEFAULT_OPERATOR_THREADS,
  OPERATOR_MODES,
  OPERATOR_SURFACE_TAG,
} from './operator-surface';
export {
  AgentableOperatorSurfacePlacementElement,
  OPERATOR_PLACEMENT_TAG,
  OPERATOR_SURFACE_PLACEMENT_KINDS,
  isOperatorSurfacePlacementKind,
} from './operator-surface-placement';
export type {
  OperatorPlacementEventMap,
  OperatorPlacementInteractedDetail,
  OperatorPlacementInteractionKind,
  OperatorPlacementMountedDetail,
  OperatorSurfacePlacementKind,
} from './placementTypes';
export type {
  OperatorMessage,
  OperatorMode,
  OperatorModelOption,
  OperatorThread,
  OperatorA2UIMessage,
  OperatorTextMessage,
  OperatorThreadChangedDetail,
  OperatorModeChangedDetail,
  OperatorModelChangedDetail,
} from './types';
export {
  isOperatorA2UIMessage,
  isOperatorTextMessage,
} from './types';
export {
  renderA2UITranscriptContent,
  renderA2UITranscriptTemplate,
} from './a2uiTranscriptLite';
export type {
  A2UIDisplayBlock,
  A2UITranscriptRenderOutcome,
} from './a2uiTranscriptLite';
export { OperatorA2UITranscript } from './OperatorA2UITranscript';
export type { OperatorA2UITranscriptProps } from './OperatorA2UITranscript';
export type { OperatorSurfaceEventMap } from './operator-surface';
export {
  bindOperatorModeEnforcement,
  buildOperatorModeScopeDenial,
  evaluateOperatorModeToolDenial,
  getOperatorMode,
  isOperatorModeEnforcementActive,
  OPERATOR_MODE_SCOPE_DENIED_CODE,
  resetOperatorModeBridgeForTests,
  syncOperatorMode,
  unbindOperatorModeEnforcement,
} from './operatorModeBridge';
export {
  bindOperatorRegistration,
  buildOperatorRegistrationInput,
  getOperatorRegistrationModeForTests,
  getOperatorRegistrationRuntime,
  isOperatorRegistrationActive,
  OPERATOR_TOOL_CONTEXT,
  resetOperatorRegistrationBridgeForTests,
  setOperatorRegistrationRuntime,
  syncOperatorRegistrationMode,
  unbindOperatorRegistration,
} from './operatorRegistrationBridge';
export type { OperatorRegistrationRuntime } from './operatorRegistrationBridge';
export {
  bindOperatorModelBridge,
  evaluateOperatorModelOptions,
  getOperatorAgentSession,
  getOperatorModelAlias,
  getOperatorModelBinding,
  isOperatorModelBridgeActive,
  OPERATOR_MODEL_BRIDGE_NOT_BOUND_CODE,
  rebindOperatorModel,
  resetOperatorModelBridgeForTests,
  unbindOperatorModelBridge,
} from './operatorModelBridge';
export type {
  BindOperatorModelBridgeOptions,
  OperatorModelOptionAvailability,
  OperatorModelRebindResult,
} from './operatorModelBridge';
export {
  getAllowedToolsForOperatorMode,
  getKnownOperatorToolNames,
  isToolAllowedForOperatorMode,
  OPERATOR_ASK_TOOL_NAMES,
  OPERATOR_BUILD_TOOL_NAMES,
  OPERATOR_DRAW_ONLY_TOOL_NAMES,
} from './operatorModeScope';
