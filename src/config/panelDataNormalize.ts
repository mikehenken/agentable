/**
 * Normalizes JSON panel-data payloads (from embed `panel-data-url` or tenant
 * config) into shapes the React panels can consume. Resolves serializable
 * `iconKey` strings to Lucide components at runtime.
 */
import {
  BookOpen,
  Briefcase,
  FileText,
  GraduationCap,
  PlayCircle,
  Users,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import type { CanvasPanelData } from './CanvasContext';
import type {
  RawPanelDataPayload,
  SerializablePath,
  SerializableResource,
} from './panelDataPayloadTypes';
import { coalescePanelDataForEmbed } from './panelDataCoalesce';

export type { RawPanelDataPayload, SerializablePath, SerializableResource } from './panelDataPayloadTypes';

function resolveIcon(key: string | undefined, fallback: LucideIcon): LucideIcon {
  if (!key) return fallback;
  return ICON_MAP[key] ?? fallback;
}

const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen,
  Briefcase,
  FileText,
  GraduationCap,
  PlayCircle,
  Users,
  Waves,
};

function normalizeResource(raw: SerializableResource) {
  return {...raw,
    Icon: resolveIcon(raw.iconKey, BookOpen),
  };
}

function normalizePath(raw: SerializablePath) {
  return {...raw,
    Icon: resolveIcon(raw.iconKey, Briefcase),
    gradient: raw.gradient ?? 'linear-gradient(135deg, #006938 0%, #14B8A6 100%)',
    heroTint: raw.heroTint ?? 'from-canvas-primary/10 to-canvas-primary-light/5',
  };
}

/** Parse + hydrate a raw JSON panel-data document for CanvasProvider. */
export function normalizePanelDataPayload(
  payload: RawPanelDataPayload | null | undefined): CanvasPanelData {
  const coalesced = coalescePanelDataForEmbed(payload);
  if (Object.keys(coalesced).length === 0) {
    return {};
  }

  const resources = coalesced.resources?.map(normalizeResource);
  const featuredResource = coalesced.featuredResource
    ? normalizeResource(coalesced.featuredResource): undefined;
  const growthPaths = coalesced.growthPaths?.map(normalizePath);

  return {
    jobs: coalesced.jobs,
    applications: coalesced.applications,
    resources,
    featuredResource,
    growthPaths,
    agentJobsGuide: coalesced.agentJobsGuide,
    roleTaxonomy: coalesced.roleTaxonomy,
  };
}
