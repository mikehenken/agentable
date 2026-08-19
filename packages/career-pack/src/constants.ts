/** Canonical panel ids registered by the career pack (Tier 2). */
export const CAREER_PANEL_IDS = [
  'open-positions',
  'applications',
  'growth-paths',
  'resources',
  'settings',
  'resume-docs',
  'career-tools',
  'journey',
  'recent-activity',
] as const;

export type CareerPanelId = (typeof CAREER_PANEL_IDS)[number];

/** DataAdapter source names owned by the career domain. */
export const CAREER_SOURCE_NAMES = [
  'career.jobs',
  'career.applications',
  'career.paths',
  'career.resources',
  'career.apply',
] as const;

export type CareerSourceName = (typeof CAREER_SOURCE_NAMES)[number];

/** Stable generated tool names (append-only; do not reorder). */
export const CAREER_TOOL_NAMES = [
  'open_positions',
  'show_job_detail',
  'open_applications',
  'open_growth_paths',
  'open_resources',
  'open_learning',
] as const;

export type CareerToolName = (typeof CAREER_TOOL_NAMES)[number];
