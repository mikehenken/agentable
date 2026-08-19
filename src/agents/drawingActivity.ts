/**
 * Activity ledger entries for agent drawing tools ( digest recency).
 */
import type { ActivityLog } from './activity';
import type {
  AgentAnnotatePanelResult,
  AgentClearDrawingsResult,
  AgentDrawShapesResult,
} from '../engine/agentDrawingTypes';

let boundActivity: ActivityLog | null = null;

export function bindDrawingActivityLog(activity: ActivityLog): () => void {
  boundActivity = activity;
  return () => {
    if (boundActivity === activity) {
      boundActivity = null;
    }
  };
}

export function resetDrawingActivityLogForTests(): void {
  boundActivity = null;
}

function append(agentId: string, verb: string, target: string): void {
  boundActivity?.append({
    actor: `agent:${agentId}`,
    verb,
    target,
    provenance: { derivedFrom: `agent:${agentId}` },
    reversal: { reversible: false, persisted: false },
  });
}

export function recordDrawShapesActivity(
  agentId: string,
  result: AgentDrawShapesResult): void {
  const target =
    result.createdShapeIds.length === 1
      ? result.createdShapeIds[0] ?? 'none': `${result.createdShapeIds.length} shapes`;
  append(agentId, 'draw_shapes', target);
}

export function recordAnnotatePanelActivity(
  agentId: string,
  result: AgentAnnotatePanelResult): void {
  append(agentId, 'annotate_panel', result.panelId);
}

export function recordClearDrawingsActivity(
  agentId: string,
  result: AgentClearDrawingsResult): void {
  const target =
    result.removedShapeIds.length === 1
      ? result.removedShapeIds[0] ?? result.agentId: `${result.removedShapeIds.length} marks`;
  append(agentId, 'clear_agent_drawings', target);
}
