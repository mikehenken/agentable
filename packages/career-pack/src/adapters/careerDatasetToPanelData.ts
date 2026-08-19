import type {
  CareerApplication,
  CareerDataset,
  CareerGrowthPath,
  CareerJob,
  CareerResource,
} from '../types';
import { parseCareerDataset } from '../schema/careerDatasetSchema';
import { inferJobTrack } from '../panels/openPositionsTrackLexicon';

type DeptTone = 'teal' | 'amber' | 'indigo' | 'rose' | 'emerald';
type LevelKey = 'entry' | 'specialist' | 'leadership' | 'management' | 'executive';
type ResourceType = 'Video' | 'Guide' | 'Portal' | 'Playbook';
type ResourceTone = 'teal' | 'purple' | 'amber' | 'rose' | 'indigo' | 'emerald';

export interface PanelJobRow {
  id: number;
  title: string;
  department: string;
  tone: DeptTone;
  location: string;
  property: string;
  type: string;
  track?: string;
  payRange: string;
  description: string;
  longDescription: string;
  skillMatches: string[];
  compatibilityScore: number;
  postedDate: string;
  team: string;
  responsibilities: string[];
}

export interface PanelGrowthPathRow {
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
    level: LevelKey;
    levelLabel: string;
    salary: string;
    timeInRole: string;
    unlocks: string[];
    learningProgram?: string;
  }>;
}

export interface PanelResourceRow {
  id: string;
  title: string;
  type: ResourceType;
  detail: string;
  description: string;
  tone: ResourceTone;
  iconKey?: string;
  tag?: string;
  url?: string;
  categories?: string[];
}

export interface PanelApplicationRow {
  id: string;
  role: string;
  property: string;
  location: string;
  status: string;
  statusTone: 'teal' | 'amber' | 'gray' | 'indigo';
  submitted: string;
  recruiter: string;
  recruiterRole: string;
  stages: Array<{ label: string; date: string; done: boolean; note?: string }>;
  nextStep?: string;
}

export interface CareerPanelDataPayload {
  jobs?: readonly PanelJobRow[];
  applications?: readonly PanelApplicationRow[];
  growthPaths?: readonly PanelGrowthPathRow[];
  resources?: readonly PanelResourceRow[];
  featuredResource?: PanelResourceRow;
  agentJobsGuide?: string;
  roleTaxonomy?: readonly unknown[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCareerJobRow(value: unknown): value is CareerJob {
  if (!isRecord(value)) return false;
  return typeof value.slug === 'string' && Array.isArray(value.tags);
}

function isCareerGrowthPathRow(value: unknown): value is CareerGrowthPath {
  if (!isRecord(value)) return false;
  return typeof value.fromRole === 'string' && typeof value.toRole === 'string';
}

function isCareerResourceRow(value: unknown): value is CareerResource {
  if (!isRecord(value)) return false;
  return typeof value.category === 'string' && !('type' in value);
}

function isCareerApplicationRow(value: unknown): value is CareerApplication {
  if (!isRecord(value)) return false;
  return typeof value.jobId === 'string' && isRecord(value.candidate);
}

/** Detect normalized career fixture rows vs legacy React panel-data rows. */
export function isCareerDatasetPanelPayload(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  const jobs = payload.jobs;
  const growthPaths = payload.growthPaths;
  const resources = payload.resources;
  const applications = payload.applications;

  if (Array.isArray(jobs) && jobs.length > 0 && isCareerJobRow(jobs[0])) {
    return true;
  }
  if (Array.isArray(growthPaths) && growthPaths.length > 0 && isCareerGrowthPathRow(growthPaths[0])) {
    return true;
  }
  if (Array.isArray(resources) && resources.length > 0 && isCareerResourceRow(resources[0])) {
    return true;
  }
  if (Array.isArray(applications) && applications.length > 0 && isCareerApplicationRow(applications[0])) {
    return true;
  }
  return false;
}

function departmentTone(department: string): DeptTone {
  const value = department.toLowerCase();
  if (/design|culinary|food|beverage|f&b/.test(value)) return 'amber';
  if (/engineering|information technology|\bit\b|software|developer/.test(value)) return 'indigo';
  if (/guest|customer|success|service/.test(value)) return 'rose';
  if (/people|learning|hr|spa|wellness/.test(value)) return 'emerald';
  return 'teal';
}

function resourceTone(category: string): ResourceTone {
  const value = category.toLowerCase();
  if (/video/.test(value)) return 'purple';
  if (/portal|benefit/.test(value)) return 'indigo';
  if (/playbook|handbook/.test(value)) return 'amber';
  if (/guide|learning|scu/.test(value)) return 'teal';
  return 'emerald';
}

function resourceIconKey(category: string): string {
  const value = category.toLowerCase();
  if (/video/.test(value)) return 'PlayCircle';
  if (/portal|benefit/.test(value)) return 'BookOpen';
  if (/playbook|handbook|guide/.test(value)) return 'FileText';
  if (/leadership|people/.test(value)) return 'Users';
  return 'GraduationCap';
}

function resourceType(category: string): ResourceType {
  const value = category.toLowerCase();
  if (/video/.test(value)) return 'Video';
  if (/portal/.test(value)) return 'Portal';
  if (/playbook/.test(value)) return 'Playbook';
  return 'Guide';
}

function formatPostedDate(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return 'Recently posted';
  const days = Math.max(1, Math.round((Date.now() - parsed) / 86_400_000));
  if (days <= 7) return `${days}d ago`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(parsed));
}

function formatSubmittedDate(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(parsed));
}

function milestoneLevel(index: number, total: number): { level: LevelKey; levelLabel: string } {
  if (total <= 1) return { level: 'entry', levelLabel: 'Entry' };
  const ratio = index / (total - 1);
  if (ratio < 0.2) return { level: 'entry', levelLabel: 'Entry' };
  if (ratio < 0.45) return { level: 'specialist', levelLabel: 'Specialist' };
  if (ratio < 0.65) return { level: 'leadership', levelLabel: 'Lead' };
  if (ratio < 0.85) return { level: 'management', levelLabel: 'Manager' };
  return { level: 'executive', levelLabel: 'Exec' };
}

function inferProperty(location: string): string {
  const trimmed = location.trim();
  if (!trimmed) return 'Sandals Resort';
  const islandMatch = trimmed.match(/,\s*([^,]+)$/);
  return islandMatch?.[1]?.trim() ?? 'Sandals Resort';
}

function parseNumericJobId(id: string, fallbackIndex: number): number {
  const parsed = Number.parseInt(id, 10);
  return Number.isFinite(parsed) ? parsed: fallbackIndex + 1;
}

function careerJobToPanelJob(job: CareerJob, index: number): PanelJobRow {
  const skillMatches = [...job.tags];
  return {
    id: parseNumericJobId(job.id, index),
    title: job.title,
    department: job.department,
    tone: departmentTone(job.department),
    location: job.location,
    property: inferProperty(job.location),
    type: job.track ?? 'Full-time',
    track: job.track ? inferJobTrack(job.track, job.department): inferJobTrack('Full-time', job.department),
    payRange: job.compensation ?? 'Competitive',
    description: job.description,
    longDescription: job.description,
    skillMatches,
    compatibilityScore: 85 + (index % 10),
    postedDate: formatPostedDate(job.postedAt),
    team: job.department,
    responsibilities: [job.description],
  };
}

function careerGrowthPathToPanelPath(path: CareerGrowthPath): PanelGrowthPathRow {
  const steps = [...(path.steps ?? [])];
  const milestones = steps.map((title, index) => {
    const level = milestoneLevel(index, steps.length);
    return {
      title,
      level: level.level,
      levelLabel: level.levelLabel,
      salary: '—',
      timeInRole: '—',
      unlocks: [] as string[],
    };
  });

  return {
    id: path.id,
    title: `${path.fromRole} → ${path.toRole}`,
    tagline: path.summary,
    match: path.fitScore ?? 85,
    totalTime: steps.length > 0 ? `${Math.max(6, steps.length * 4)}–${steps.length * 12} mo`: '12–24 mo',
    iconKey: 'Briefcase',
    milestones,
  };
}

function careerResourceToPanelResource(resource: CareerResource): PanelResourceRow {
  const type = resourceType(resource.category);
  return {
    id: resource.id,
    title: resource.title,
    type,
    detail: resource.category,
    description: resource.description,
    tone: resourceTone(resource.category),
    iconKey: resourceIconKey(resource.category),
    url: resource.url,
    tag: resource.featured ? 'Featured': undefined,
  };
}

function applicationStatusTone(status: string): PanelApplicationRow['statusTone'] {
  const value = status.toLowerCase();
  if (/interview|offer|scheduled/.test(value)) return 'teal';
  if (/review|submitted/.test(value)) return 'amber';
  if (/draft/.test(value)) return 'gray';
  return 'indigo';
}

function careerApplicationToPanelApplication(
  application: CareerApplication,
  jobsById: ReadonlyMap<string, CareerJob>): PanelApplicationRow {
  const job = jobsById.get(application.jobId);
  return {
    id: application.id,
    role: job?.title ?? 'Open role',
    property: job ? inferProperty(job.location): 'Sandals Resort',
    location: job?.location ?? 'Caribbean',
    status: application.status,
    statusTone: applicationStatusTone(application.status),
    submitted: formatSubmittedDate(application.submittedAt),
    recruiter: 'Sandals Talent Team',
    recruiterRole: 'Career Concierge',
    stages: [
      {
        label: application.status,
        date: formatSubmittedDate(application.submittedAt),
        done: !/draft/i.test(application.status),
      },
    ],
    nextStep: /draft/i.test(application.status) ? 'Complete your application': undefined,
  };
}

/** Map normalized career job rows to Open Positions panel rows. */
export function careerJobsToPanelRows(jobs: readonly CareerJob[]): readonly PanelJobRow[] {
  return jobs.map((job, index) => careerJobToPanelJob(job, index));
}

/** Convert normalized career dataset rows into React panel-data shapes. */
export function careerDatasetToPanelData(dataset: CareerDataset): CareerPanelDataPayload {
  const jobsById = new Map(dataset.jobs.map((job) => [job.id, job] as const));
  const resources = dataset.resources.map(careerResourceToPanelResource);
  const featured = resources.find((resource) => resource.tag === 'Featured') ?? resources[0];

  return {
    jobs: careerJobsToPanelRows(dataset.jobs),
    applications: (dataset.applications ?? []).map((application) =>
      careerApplicationToPanelApplication(application, jobsById)),
    growthPaths: dataset.growthPaths.map(careerGrowthPathToPanelPath),
    resources,...(featured ? { featuredResource: featured }: {}),
  };
}

/**
 * When embed hosts load career fixtures via static adapter, coerce the raw JSON
 * into panel-ready shapes. Pass-through when already panel-native.
 */
export function coalesceCareerPanelDataPayload(payload: unknown): unknown {
  if (!isCareerDatasetPanelPayload(payload)) {
    return payload;
  }
  const dataset = parseCareerDataset(payload);
  const converted = careerDatasetToPanelData(dataset);
  const source = isRecord(payload) ? payload: {};
  return {...source,...converted,...(typeof source.agentJobsGuide === 'string' ? { agentJobsGuide: source.agentJobsGuide }: {}),...(Array.isArray(source.roleTaxonomy) ? { roleTaxonomy: source.roleTaxonomy }: {}),
  };
}
