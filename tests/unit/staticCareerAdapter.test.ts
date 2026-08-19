/**
 * createStaticCareerAdapter — mock adapter + localStorage persistence path.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  createStaticCareerAdapter,
  MINIMAL_CAREER_DATASET,
  MOSS_CAREER_DATASET,
  resolveCareerDatasetInput,
} from '@agentable/career-pack';
import type { PanelScope } from '../../src/panels/types';

const SCOPE: PanelScope = { contextId: 'p5-test', entityId: 'careers' };

describe('createStaticCareerAdapter', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns filtered jobs for career.jobs query params', async () => {
    const adapter = createStaticCareerAdapter(MOSS_CAREER_DATASET, { latencyMs: 0 });
    const all = await adapter.query({ source: 'career.jobs' }, SCOPE, new AbortController().signal);
    expect(Array.isArray(all)).toBe(true);
    expect((all as unknown[]).length).toBe(117);

    const filtered = await adapter.query(
      { source: 'career.jobs', params: { department: 'Human Resources' } },
      SCOPE,
      new AbortController().signal);
    expect((filtered as unknown[]).length).toBeGreaterThan(0);
    expect((filtered as unknown[]).length).toBeLessThan(117);
  });

  it('searches jobs by title keyword', async () => {
    const adapter = createStaticCareerAdapter(MOSS_CAREER_DATASET);
    const results = await adapter.query(
      { source: 'career.jobs', params: { search: 'Safety Manager' } },
      SCOPE,
      new AbortController().signal);
    expect((results as unknown[]).some((row) => (row as { title: string }).title.includes('Safety'))).toBe(
      true);
  });

  it('serves growth paths and resources sources', async () => {
    const adapter = createStaticCareerAdapter(MINIMAL_CAREER_DATASET);
    const paths = await adapter.query({ source: 'career.paths' }, SCOPE, new AbortController().signal);
    const resources = await adapter.query(
      { source: 'career.resources' },
      SCOPE,
      new AbortController().signal);
    expect((paths as unknown[]).length).toBe(1);
    expect((resources as unknown[]).length).toBe(1);
  });

  it('persists career.apply mutations to localStorage and career.applications query', async () => {
    const adapter = createStaticCareerAdapter(MINIMAL_CAREER_DATASET, {
      persistenceKey: 'unit-test',
    });

    const invalid = await adapter.mutate(
      { kind: 'mutate', source: 'career.apply', op: 'create' },
      { jobId: 'job-1', candidate: { name: '', email: 'bad-email' } },
      SCOPE);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.error.code).toBe('validation');
      expect(invalid.error.fieldErrors?.['candidate.email']).toBeDefined();
    }

    const created = await adapter.mutate(
      { kind: 'mutate', source: 'career.apply', op: 'create' },
      {
        jobId: 'job-1',
        candidate: { name: 'Alex Candidate', email: 'alex@example.com' },
      },
      SCOPE);
    expect(created.ok).toBe(true);

    const apps = await adapter.query(
      { source: 'career.applications' },
      SCOPE,
      new AbortController().signal);
    expect((apps as unknown[]).length).toBeGreaterThanOrEqual(2);
    expect(localStorage.getItem('agentable-career-adapter:unit-test')).toContain('alex@example.com');
  });

  it('loads URL-backed dataset once and caches results', async () => {
    let fetchCount = 0;
    const fetchFn: typeof fetch = async () => {
      fetchCount += 1;
      return new Response(JSON.stringify(MINIMAL_CAREER_DATASET), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const adapter = createStaticCareerAdapter({ url: '/fixtures/minimal.json' }, { fetchFn });
    await adapter.query({ source: 'career.jobs' }, SCOPE, new AbortController().signal);
    await adapter.query({ source: 'career.resources' }, SCOPE, new AbortController().signal);
    expect(fetchCount).toBe(1);

    const resolved = await resolveCareerDatasetInput(MINIMAL_CAREER_DATASET);
    expect(resolved.jobs).toHaveLength(1);
  });

  it('supports subscribe notifications after apply mutation', async () => {
    const adapter = createStaticCareerAdapter(MINIMAL_CAREER_DATASET, { persistenceKey: 'sub-test' });
    let changeCount = 0;
    adapter.subscribe?.({ source: 'career.applications' }, SCOPE, () => {
      changeCount += 1;
    });

    await adapter.mutate(
      { kind: 'mutate', source: 'career.apply', op: 'create' },
      {
        jobId: 'job-1',
        candidate: { name: 'Sam Rivera', email: 'sam@example.com' },
      },
      SCOPE);
    expect(changeCount).toBe(1);
  });
});
