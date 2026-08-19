/**
 * Display rows for the Agent Activity debug panel.
 * Maps session activity ledger entries into list-bindable records.
 */
import type { ActivityEntry, ActivityLogFilter } from './activity';

/** Panel id for the Tier 2 dogfood activity debug panel. */
export const AGENT_ACTIVITY_PANEL_ID = 'agent-activity';

/** DataAdapter source name for the activity ledger binding. */
export const AGENTS_ACTIVITY_SOURCE = 'agents.activity';

/** One row bound by the catalog list virtual-list pipeline. */
export interface ActivityListRow {
  id: string;
  title: string;
  subtitle: string;
}

export function formatActivityRowTitle(entry: ActivityEntry): string {
  const verb = entry.verb.trim();
  const target = entry.target.trim();
  if (verb.length === 0 && target.length === 0) return entry.id;
  if (verb.length === 0) return target;
  if (target.length === 0) return verb;
  return `${verb} ${target}`;
}

export function formatActivityRowSubtitle(entry: ActivityEntry): string {
  return `${entry.actor} · ${entry.ts}`;
}

export function mapActivityEntriesToListRows(
  entries: readonly ActivityEntry[]): ActivityListRow[] {
  return entries.map((entry) => ({
    id: entry.id,
    title: formatActivityRowTitle(entry),
    subtitle: formatActivityRowSubtitle(entry),
  }));
}

export interface ActivityQueryParams {
  actor?: string;
  since?: string;
  limit?: number;
}

export function activityFilterFromParams(
  params: ActivityQueryParams | undefined): ActivityLogFilter {
  const filter: ActivityLogFilter = {};
  if (params?.actor !== undefined && params.actor.length > 0) {
    filter.actor = params.actor;
  }
  if (params?.since !== undefined && params.since.length > 0) {
    filter.since = params.since;
  }
  if (params?.limit !== undefined && Number.isFinite(params.limit) && params.limit > 0) {
    filter.limit = Math.floor(params.limit);
  }
  return filter;
}
