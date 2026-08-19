/**
 * Serializable panel-data payload shapes (no Lucide React deps).
 * Used by embed Lit shells and config merge before React hydration.
 */

export interface SerializableResource {
  id: string;
  title: string;
  type: 'Video' | 'Guide' | 'Portal' | 'Playbook';
  detail: string;
  description: string;
  tone: 'teal' | 'purple' | 'amber' | 'rose' | 'indigo' | 'emerald';
  iconKey?: string;
  tag?: string;
  url?: string;
  categories?: string[];
}

export interface SerializablePath {
  id: string;
  title: string;
  tagline: string;
  match: number;
  totalTime: string;
  iconKey?: string;
  gradient?: string;
  heroTint?: string;
  milestones: Array<{
    title: string;
    level: string;
    levelLabel: string;
    salary: string;
    timeInRole: string;
    unlocks: string[];
    learningProgram?: string;
  }>;
}

export interface RawPanelDataPayload {
  jobs?: readonly unknown[];
  applications?: readonly unknown[];
  growthPaths?: readonly SerializablePath[];
  resources?: readonly SerializableResource[];
  featuredResource?: SerializableResource;
  agentJobsGuide?: string;
  roleTaxonomy?: readonly unknown[];
  tickets?: readonly unknown[];
  messages?: readonly unknown[];
  macros?: readonly unknown[];
}

/** Panel-data fields merged into tenant config before React icon hydration. */
export interface EmbedPanelDataSnapshot {
  jobs?: readonly unknown[];
  applications?: readonly unknown[];
  growthPaths?: readonly SerializablePath[];
  resources?: readonly SerializableResource[];
  featuredResource?: SerializableResource;
  agentJobsGuide?: string;
  roleTaxonomy?: readonly unknown[];
  tickets?: readonly unknown[];
  messages?: readonly unknown[];
  macros?: readonly unknown[];
}
