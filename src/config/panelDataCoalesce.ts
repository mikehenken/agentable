/**
 * Coalesce panel-data for embed merge without Lucide icon hydration.
 * Full `normalizePanelDataPayload` runs at the React shell boundary.
 */
import { coalesceCareerPanelDataPayload } from '../../packages/career-pack/src/adapters/careerDatasetToPanelData';
import { coalesceSupportPanelDataPayload } from '../../packages/support-inbox-pack/src/adapters/supportDatasetToPanelData';
import type {
  EmbedPanelDataSnapshot,
  RawPanelDataPayload,
} from './panelDataPayloadTypes';

export type { RawPanelDataPayload, SerializablePath, SerializableResource } from './panelDataPayloadTypes';

/** Merge raw JSON panel-data without resolving Lucide icons. */
export function coalescePanelDataForEmbed(
  payload: RawPanelDataPayload | null | undefined,
): EmbedPanelDataSnapshot {
  const supportCoalesced = coalesceSupportPanelDataPayload(payload) as
    | RawPanelDataPayload
    | null
    | undefined;
  const coalesced = coalesceCareerPanelDataPayload(supportCoalesced) as
    | RawPanelDataPayload
    | null
    | undefined;
  if (!coalesced) {
    return {};
  }

  return {
    jobs: coalesced.jobs,
    applications: coalesced.applications,
    growthPaths: coalesced.growthPaths,
    resources: coalesced.resources,
    featuredResource: coalesced.featuredResource,
    agentJobsGuide: coalesced.agentJobsGuide,
    roleTaxonomy: coalesced.roleTaxonomy,
    tickets: coalesced.tickets,
    messages: coalesced.messages,
    macros: coalesced.macros,
  };
}
