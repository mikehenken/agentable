#!/usr/bin/env node
/**
 * Build schema-validated career fixtures from moss/sandals source shapes.
 * Run: node scripts/build-career-fixtures.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FIXTURES_DIR = path.join(ROOT, 'packages/career-pack/src/fixtures');

const MOSS_SOURCE = path.join(ROOT, '../moss/data/moss-panel-data.json');

function slugify(value) {
  return value.toLowerCase.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function parseRoleEnds(title) {
  const parts = title.split(/\s*[→\-–—>]\s*/);
  if (parts.length >= 2) {
    return {
      fromRole: parts[0]?.trim ?? title,
      toRole: parts[parts.length - 1]?.trim ?? title,
    };
  }
  return { fromRole: title, toRole: title };
}

function convertMoss(doc) {
  const postedFallback = doc.scrapedAt ?? '2026-07-01T00:00:00.000Z';
  const jobs = doc.jobs.map((job) => {
    const tags = [...(job.skillMatches ?? []),...(job.locationTags ?? [])].filter(
      (tag, index, list) => list.indexOf(tag) === index);
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
        (job.description ?? '').trim ||
        `${job.department} role at ${job.location}. Source: moss.com posting.`,
      tags,
      postedAt: postedFallback,
      source: 'fixture',
      sourceId: `moss-job-${job.id}`,
      applyUrl: (job.applicationUrl ?? '').trim || 'https://moss.com/why-moss/careers/',
    };
  });

  const growthPaths = (doc.growthPaths ?? []).map((path) => {
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

  const resources = (doc.resources ?? []).map((resource) => ({
    id: resource.id,
    title: resource.title,
    category: resource.type ?? resource.categories?.[0] ?? 'Resource',
    description: resource.description ?? resource.title,
    url: resource.url,
    featured: resource.tag !== undefined,
  }));

  return { jobs, growthPaths, resources, applications: [] };
}

/** Sandals canonical demo dataset — mirrors sandals/career-canvas/data/*.ts content. */
const SANDALS_SOURCE = {
  jobs: [
    {
      id: 1,
      title: 'Resort Manager',
      department: 'Operations',
      location: 'Montego Bay, Jamaica',
      type: 'Full-time · Salary',
      payRange: '$85,000 – $120,000',
      description:
        'Lead a team of 200+ at our flagship property undergoing a $120M transformation.',
      skillMatches: ['Leadership', 'Operations', 'Budgeting', 'Guest Relations'],
    },
    {
      id: 2,
      title: 'Senior Software Developer',
      department: 'Information Technology',
      location: 'San Pedro Sula, Honduras',
      type: 'Full-time · Salary',
      payRange: '$75,000 – $95,000',
      description:
        'Build with Copilot, ship daily, and help every Sandals guest feel seen — before they arrive.',
      skillMatches: ['React', 'TypeScript', 'AI/ML', 'Cloud'],
    },
    {
      id: 3,
      title: 'Executive Chef',
      department: 'Food & Beverage',
      location: 'Gros Islet, St. Lucia',
      type: 'Full-time · Salary',
      payRange: '$70,000 – $90,000',
      description:
        'Lead culinary operations across 11 restaurants at one of our most celebrated properties.',
      skillMatches: ['Culinary Arts', 'Menu Design', 'Team Leadership'],
    },
    {
      id: 4,
      title: 'Guest Services Agent',
      department: 'Guest Services',
      location: 'Nassau, Bahamas',
      type: 'Full-time · Hourly',
      payRange: '$18 – $24 hr',
      description:
        'Create unforgettable guest experiences from the moment they arrive to the moment they leave.',
      skillMatches: ['Hospitality', 'Communication', 'Problem Solving'],
    },
    {
      id: 5,
      title: 'Spa Therapist',
      department: 'Spa & Wellness',
      location: 'Ocho Rios, Jamaica',
      type: 'Full-time · Hourly',
      payRange: '$16 – $22 hr',
      description: 'Deliver restorative treatments in a five-star Caribbean spa setting.',
      skillMatches: ['Massage Therapy', 'Guest Care', 'Wellness'],
    },
  ],
  growthPaths: [
    {
      id: 'path-front-office',
      title: 'Front desk → Front Office Manager',
      tagline: 'The most-walked path at Sandals — 60% of current FOMs started here.',
      match: 91,
      milestones: [
        { title: 'Front Desk Agent' },
        { title: 'Guest Services Coordinator' },
        { title: 'Front Office Supervisor' },
        { title: 'Asst. Front Office Manager' },
        { title: 'Front Office Manager' },
      ],
    },
    {
      id: 'path-fnb',
      title: 'Line cook → Executive Chef',
      tagline: 'Long but legendary — the culinary climb at our flagship properties.',
      match: 88,
      milestones: [
        { title: 'Line Cook' },
        { title: 'Demi-Chef' },
        { title: 'Sous Chef' },
        { title: 'Chef de Cuisine' },
        { title: 'Executive Chef' },
      ],
    },
    {
      id: 'path-it',
      title: 'IT Analyst → Engineering Lead',
      tagline: 'The newest career ladder at Sandals — and the one with the most room.',
      match: 85,
      milestones: [
        { title: 'IT Analyst' },
        { title: 'Software Developer' },
        { title: 'Senior Developer' },
        { title: 'Staff Engineer' },
        { title: 'Engineering Lead' },
      ],
    },
  ],
  applications: [
    { id: 'app-1', role: 'Resort Manager', status: 'Interview scheduled', submitted: 'Mar 12, 2026' },
    { id: 'app-2', role: 'Guest Services Agent', status: 'Under review', submitted: 'Mar 8, 2026' },
    { id: 'app-3', role: 'Senior Software Developer', status: 'Draft', submitted: 'Mar 1, 2026' },
  ],
  resources: [
    {
      id: 'res-1',
      title: 'SCU onboarding guide',
      type: 'Guide',
      description: 'The A→Z primer for every new Sandals team member entering the Corporate University program.',
    },
    {
      id: 'res-2',
      title: 'Leadership pathways video',
      type: 'Video',
      description: 'Five SCU fellows walk through how they moved from line roles into leadership.',
    },
    {
      id: 'res-3',
      title: 'Benefits overview 2026',
      type: 'Portal',
      description: 'Health, travel, property-stay perks, and the relocation program in plain English.',
    },
    {
      id: 'res-4',
      title: 'Property culture handbook',
      type: 'Guide',
      description: 'How each resort operates day-to-day, the rhythms of high season, and what guests expect.',
    },
    {
      id: 'res-5',
      title: 'Meet the leadership',
      type: 'Video',
      description: 'A short intro from our GMs and SCU deans across the Caribbean.',
    },
  ],
};

function convertSandals(input) {
  const jobs = input.jobs.map((job) => ({
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
    source: 'fixture',
    sourceId: `sandals-job-${job.id}`,
    applyUrl: 'https://careers.sandals.com/',
  }));

  const jobIdByTitle = new Map(jobs.map((job) => [job.title.toLowerCase, job.id]));

  const applications = input.applications.map((app) => ({
    id: app.id,
    jobId: jobIdByTitle.get(app.role.toLowerCase) ?? jobs[0]?.id ?? 'unknown',
    candidate: { name: 'Candidate', email: 'candidate@example.com' },
    status: app.status,
    submittedAt: '2026-03-12T00:00:00.000Z',
    source: 'fixture',
    sourceId: app.id,
  }));

  const growthPaths = input.growthPaths.map((path) => {
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

  const resources = input.resources.map((resource) => ({
    id: resource.id,
    title: resource.title,
    category: resource.type ?? 'Resource',
    description: resource.description,
    featured: resource.id.includes('featured'),
  }));

  return { jobs, growthPaths, resources, applications };
}

mkdirSync(FIXTURES_DIR, { recursive: true });

const mossDoc = JSON.parse(readFileSync(MOSS_SOURCE, 'utf8'));
const mossFixture = convertMoss(mossDoc);
writeFileSync(path.join(FIXTURES_DIR, 'moss.json'), `${JSON.stringify(mossFixture, null, 2)}\n`);

const sandalsFixture = convertSandals(SANDALS_SOURCE);
writeFileSync(path.join(FIXTURES_DIR, 'sandals.json'), `${JSON.stringify(sandalsFixture, null, 2)}\n`);

console.log(
  `Wrote moss.json (${mossFixture.jobs.length} jobs) and sandals.json (${sandalsFixture.jobs.length} jobs) to ${FIXTURES_DIR}`);
