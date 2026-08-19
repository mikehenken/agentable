/**
 * Config-driven gate for agent `compose_panel` (D29, P3-T5).
 *
 * Hosts opt in via `createCanvasHost({ composeGate })`. When closed, the tool
 * is omitted from agent declarations and runtime calls return a structured
 * rejection with a frozen error code.
 */
import type { PanelRegistry } from './registry';
import {
  declaredActionIds,
  declaredFieldPaths,
  findPanelAgentMeta,
} from './registryMetadata';
import {
  COMPOSE_GATE_CLOSED_CODE,
  type RepairErrorCode,
} from './spec/repairVocabulary';

export { COMPOSE_GATE_CLOSED_CODE };

/** Stable id for the site SEO compose port-order gate. */
export const POST_SEO_COMPOSE_GATE_ID = 'post-seo-compose';

export interface ComposeGateCriteria {
  /** Registered panel ids that must be present. */
  requiredPanelIds?: readonly string[];
  /** panelId -> declared field paths required for parity. */
  requiredFields?: Readonly<Record<string, readonly string[]>>;
  /** panelId -> declared action ids required for parity. */
  requiredActions?: Readonly<Record<string, readonly string[]>>;
}

export interface ComposeGateConfig {
  /** Gate identifier (for telemetry and host config). */
  id: string;
  /** When false, compose stays closed regardless of criteria. */
  enabled: boolean;
  /** Registry parity checks evaluated when `enabled` is true. */
  criteria?: ComposeGateCriteria;
}

export interface ComposeGateEvaluation {
  id: string;
  open: boolean;
  code?: RepairErrorCode;
  reason?: string;
}

/** Site SEO parity criteria (History/Variables/SEO HITM-approved). */
export const POST_SEO_COMPOSE_GATE_CRITERIA: ComposeGateCriteria = {
  requiredPanelIds: ['site-seo'],
  requiredFields: {
    'site-seo': ['title', 'description', 'keywords'],
  },
  requiredActions: {
    'site-seo': ['save', 'aiGenerate'],
  },
};

function gateClosed(
  id: string,
  reason: string): ComposeGateEvaluation {
  return {
    id,
    open: false,
    code: COMPOSE_GATE_CLOSED_CODE,
    reason,
  };
}

/**
 * Evaluate whether agents may call `compose_panel` for this host.
 * When `config` is omitted by the caller, treat compose as open.
 */
export function evaluateComposeGate(
  config: ComposeGateConfig,
  registry: PanelRegistry): ComposeGateEvaluation {
  if (!config.enabled) {
    return gateClosed(
      config.id,
      `compose_panel is gated until "${config.id}" is enabled in host config`);
  }

  const criteria = config.criteria;
  if (criteria === undefined) {
    return { id: config.id, open: true };
  }

  for (const panelId of criteria.requiredPanelIds ?? []) {
    if (!registry.has(panelId)) {
      return gateClosed(
        config.id,
        `compose gate "${config.id}" requires panel "${panelId}" in the registry`);
    }
  }

  for (const [panelId, fields] of Object.entries(criteria.requiredFields ?? {})) {
    const meta = findPanelAgentMeta(registry, panelId);
    if (meta === undefined) {
      return gateClosed(
        config.id,
        `compose gate "${config.id}" requires metadata for panel "${panelId}"`);
    }
    const paths = declaredFieldPaths(meta);
    for (const field of fields) {
      if (!paths.has(field)) {
        return gateClosed(
          config.id,
          `compose gate "${config.id}" requires field "${field}" on panel "${panelId}"`);
      }
    }
  }

  for (const [panelId, actions] of Object.entries(criteria.requiredActions ?? {})) {
    const meta = findPanelAgentMeta(registry, panelId);
    if (meta === undefined) {
      return gateClosed(
        config.id,
        `compose gate "${config.id}" requires metadata for panel "${panelId}"`);
    }
    const actionIds = declaredActionIds(meta);
    for (const actionId of actions) {
      if (!actionIds.has(actionId)) {
        return gateClosed(
          config.id,
          `compose gate "${config.id}" requires action "${actionId}" on panel "${panelId}"`);
      }
    }
  }

  return { id: config.id, open: true };
}
