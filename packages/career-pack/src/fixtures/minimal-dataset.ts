import type { CareerDataset } from '../types';

/** Minimal fixture dataset for interop tests and local demos. */
export const MINIMAL_CAREER_DATASET: CareerDataset = {
  jobs: [
    {
      id: 'job-1',
      slug: 'safety-manager',
      title: 'Safety Manager',
      department: 'Environmental, Health & Safety',
      track: 'Professionals (Salaried)',
      location: 'Fort Lauderdale, FL',
      remote: false,
      description: 'Lead safety programs across active construction sites.',
      tags: ['safety', 'leadership'],
      postedAt: '2026-01-15T00:00:00.000Z',
      source: 'fixture',
      sourceId: 'fixture-job-1',
      applyUrl: 'https://example.test/apply/safety-manager',
    },
  ],
  growthPaths: [
    {
      id: 'path-1',
      fromRole: 'Project Engineer',
      toRole: 'Senior Project Manager',
      fitScore: 82,
      summary: 'Typical progression from field engineering into project leadership.',
      steps: ['Lead a trade package', 'Run a small project', 'PM certification'],
    },
  ],
  resources: [
    {
      id: 'res-1',
      title: 'New Hire Onboarding Guide',
      category: 'Learning',
      description: 'Week-one checklist for field and office roles.',
      url: 'https://example.test/resources/onboarding',
      featured: true,
    },
  ],
  applications: [
    {
      id: 'app-1',
      jobId: 'job-1',
      candidate: { name: 'Alex Candidate', email: 'alex@example.com' },
      status: 'Submitted',
      submittedAt: '2026-02-01T12:00:00.000Z',
      source: 'fixture',
      sourceId: 'fixture-app-1',
    },
  ],
};
