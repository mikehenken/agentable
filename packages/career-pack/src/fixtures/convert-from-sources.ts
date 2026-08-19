import type {
  CareerApplication,
  CareerDataset,
  CareerGrowthPath,
  CareerJob,
  CareerResource,
} from '../types';

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function parseRoleEnds(title: string): { fromRole: string; toRole: string } {
  const parts = title.split(/\s*[→\-–—>]\s*/);
  if (parts.length >= 2) {
    return {
      fromRole: parts[0]?.trim() ?? title,
      toRole: parts[parts.length - 1]?.trim() ?? title,
    };
  }
  return { fromRole: title, toRole: title };
}

interface MossPanelJob {
  id: number;
  title: string;
  department: string;
  track?: string;
  location: string;
  description?: string;
  payRange?: string;
  postedDate?: string;
  skillMatches?: readonly string[];
  locationTags?: readonly string[];
  applicationUrl?: string;
}

interface MossPanelGrowthPath {
  id: string;
  title: string;
  tagline?: string;
  match?: number;
  milestones?: readonly { title: string }[];
}

interface MossPanelResource {
  id: string;
  title: string;
  type?: string;
  description?: string;
  url?: string;
  categories?: readonly string[];
  tag?: string;
}

interface MossPanelDataDocument {
  scrapedAt?: string;
  jobs: readonly MossPanelJob[];
  growthPaths?: readonly MossPanelGrowthPath[];
  resources?: readonly MossPanelResource[];
}

/** Convert moss `moss-panel-data.json` into normalized `CareerDataset`. */
export function convertMossPanelData(doc: MossPanelDataDocument): CareerDataset {
  const postedFallback = doc.scrapedAt ?? '2026-07-01T00:00:00.000Z';
  const jobs: CareerJob[] = doc.jobs.map((job) => {
    const tags = [...(job.skillMatches ?? []),...(job.locationTags ?? []),
    ].filter((tag, index, list) => list.indexOf(tag) === index);
    if (job.department && !tags.includes(job.department)) {
      tags.unshift(job.department);
    }
    return {
      id: String(job.id),
      slug: slugify(`${job.title}-${job.id}`),
      title: job.title,
      department: job.department,
      track: job.track,
      location: job.location,
      remote: /remote|hybrid/i.test(job.location),
      compensation: job.payRange,
      description:
        job.description?.trim() ||
        `${job.department} role at ${job.location}. Source: moss.com posting.`,
      tags,
      postedAt: postedFallback,
      source: 'fixture' as const,
      sourceId: `moss-job-${job.id}`,
      applyUrl: job.applicationUrl?.trim() || 'https://moss.com/why-moss/careers/',
    };
  });

  const growthPaths: CareerGrowthPath[] = (doc.growthPaths ?? []).map((path) => {
    const { fromRole, toRole } = parseRoleEnds(path.title);
    return {
      id: path.id,
      fromRole,
      toRole,
      fitScore: path.match,
      summary: path.tagline ?? path.title,
      steps: (path.milestones ?? []).map((step) => step.title),
    };
  });

  const resources: CareerResource[] = (doc.resources ?? []).map((resource) => ({
    id: resource.id,
    title: resource.title,
    category: resource.type ?? resource.categories?.[0] ?? 'Resource',
    description: resource.description ?? resource.title,
    url: resource.url,
    featured: resource.tag !== undefined,
  }));

  return { jobs, growthPaths, resources, applications: [] };
}

interface SandalsLegacyJob {
  id: number;
  title: string;
  department: string;
  location: string;
  type?: string;
  payRange?: string;
  description: string;
  skillMatches?: readonly string[];
  postedDate?: string;
}

interface SandalsLegacyGrowthPath {
  id: string;
  title: string;
  tagline?: string;
  match?: number;
  milestones?: readonly { title: string }[];
}

interface SandalsLegacyApplication {
  id: string;
  role: string;
  status: string;
  submitted: string;
}

interface SandalsLegacyResource {
  id: string;
  title: string;
  type?: string;
  description: string;
}

/** Convert sandals `career-canvas/data/*.ts` shapes into normalized `CareerDataset`. */
export function convertSandalsCareerData(input: {
  jobs: readonly SandalsLegacyJob[];
  growthPaths: readonly SandalsLegacyGrowthPath[];
  applications: readonly SandalsLegacyApplication[];
  resources: readonly SandalsLegacyResource[];
}): CareerDataset {
  const jobs: CareerJob[] = input.jobs.map((job) => ({
    id: String(job.id),
    slug: slugify(`${job.title}-${job.id}`),
    title: job.title,
    department: job.department,
    track: job.type,
    location: job.location,
    compensation: job.payRange,
    description: job.description,
    tags: [...(job.skillMatches ?? []), job.department],
    postedAt: '2026-03-01T00:00:00.000Z',
    source: 'fixture' as const,
    sourceId: `sandals-job-${job.id}`,
    applyUrl: 'https://careers.sandals.com/',
  }));

  const jobIdByTitle = new Map(jobs.map((job) => [job.title.toLowerCase(), job.id]));

  const applications: CareerApplication[] = input.applications.map((app) => ({
    id: app.id,
    jobId: jobIdByTitle.get(app.role.toLowerCase()) ?? jobs[0]?.id ?? 'unknown',
    candidate: {
      name: 'Candidate',
      email: 'candidate@example.com',
    },
    status: app.status,
    submittedAt: '2026-03-12T00:00:00.000Z',
    source: 'fixture',
    sourceId: app.id,
  }));

  const growthPaths: CareerGrowthPath[] = input.growthPaths.map((path) => {
    const { fromRole, toRole } = parseRoleEnds(path.title);
    return {
      id: path.id,
      fromRole,
      toRole,
      fitScore: path.match,
      summary: path.tagline ?? path.title,
      steps: (path.milestones ?? []).map((step) => step.title),
    };
  });

  const resources: CareerResource[] = input.resources.map((resource) => ({
    id: resource.id,
    title: resource.title,
    category: resource.type ?? 'Resource',
    description: resource.description,
    featured: resource.id.includes('featured'),
  }));

  return { jobs, growthPaths, resources, applications };
}
