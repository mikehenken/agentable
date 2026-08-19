import type { ModelCapabilities } from '../types';
import type { OperatorMode, OperatorModelOption, OperatorThread } from './types';

export const OPERATOR_SURFACE_TAG = 'agentable-operator-surface';

/** Stable agent id for the canvas-wide operator session. */
export const OPERATOR_AGENT_ID = 'operator';

/** Human-readable label for operator attribution (activity, HITL, digest). */
export const OPERATOR_LABEL = 'Canvas Operator';

/** Registry + lease scope key for the canvas-wide operator. */
export const OPERATOR_REGISTRY_SCOPE = 'canvas:operator';

/** Lease scope contested by the operator while its surface is mounted. */
export const OPERATOR_LEASE_SCOPE = OPERATOR_REGISTRY_SCOPE;

/** Default advisory lease TTL while the operator surface is connected. */
export const OPERATOR_LEASE_TTL_MS = 30_000;

/** Minimum capabilities for operator chat sessions (tools required for agent turns). */
export const DEFAULT_OPERATOR_REQUIRED_CAPS: Partial<ModelCapabilities> = {
  tools: true,
};

export const OPERATOR_MODES: readonly OperatorMode[] = ['auto', 'ask', 'build', 'draw'];

export const OPERATOR_MODE_LABELS: Readonly<Record<OperatorMode, string>> = {
  auto: 'Auto',
  ask: 'Ask',
  build: 'Build',
  draw: 'Draw',
};

export const DEFAULT_OPERATOR_MODEL_OPTIONS: readonly OperatorModelOption[] = [
  { alias: 'auto', label: 'Auto' },
  { alias: 'default', label: 'Default' },
  { alias: 'fast', label: 'Fast' },
  { alias: 'quality', label: 'Quality' },
];

export const DEFAULT_OPERATOR_THREADS: readonly OperatorThread[] = [
  {
    id: 'thread-main',
    title: 'Main',
    messages: [],
  },
];

export const OPERATOR_PAGE_SESSION_ID = 'operator-surface';
