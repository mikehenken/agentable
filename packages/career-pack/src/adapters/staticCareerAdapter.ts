import type { JsonObject, JsonValue, PanelScope } from '../../../../src/panels/types';
import type {
  DataAdapter,
  DeclaredAction,
  MutationResult,
  SourceRef,
  Unsubscribe,
} from '../../../../src/panels/renderer';
import { parseCareerDataset } from '../schema/careerDatasetSchema';
import type { CareerApplication, CareerDataset, CareerJob } from '../types';

const STORAGE_PREFIX = 'agentable-career-adapter:';

export interface StaticCareerAdapterOptions {
  /** Artificial query/mutation latency for loading-state tests. Default 0. */
  latencyMs?: number;
  /** localStorage namespace; defaults to `default`. */
  persistenceKey?: string;
  fetchFn?: typeof fetch;
}

export type StaticCareerDatasetInput = CareerDataset | { url: string };

interface ApplyPayload {
  jobId?: string;
  candidate?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  answers?: Record<string, string>;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readParams(params: JsonObject | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!params) return out;
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.length > 0) {
      out[key] = value;
    }
  }
  return out;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function storageKey(persistenceKey: string): string {
  return `${STORAGE_PREFIX}${persistenceKey}`;
}

function loadPersistedApplications(persistenceKey: string): CareerApplication[] {
  if (typeof globalThis.localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = globalThis.localStorage.getItem(storageKey(persistenceKey));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as CareerApplication[];
  } catch {
    return [];
  }
}

function savePersistedApplications(
  persistenceKey: string,
  applications: readonly CareerApplication[],
): void {
  if (typeof globalThis.localStorage === 'undefined') {
    return;
  }
  try {
    globalThis.localStorage.setItem(storageKey(persistenceKey), JSON.stringify(applications));
  } catch {
    // Quota or privacy mode — in-memory layer still holds mutations for the session.
  }
}

function withLatency<T>(latencyMs: number, run: () => T | Promise<T>): Promise<T> {
  if (latencyMs <= 0) {
    return Promise.resolve(run());
  }
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      Promise.resolve(run()).then(resolve).catch(reject);
    }, latencyMs);
  });
}

function matchesSearch(job: CareerJob, search: string): boolean {
  const needle = search.toLowerCase();
  const haystack = [
    job.title,
    job.department,
    job.location,
    job.track ?? '',
    ...job.tags,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function filterJobs(jobs: readonly CareerJob[], params: Record<string, string>): CareerJob[] {
  let result = [...jobs];
  const department = params.department;
  const track = params.track;
  const location = params.location;
  const search = params.search ?? params.q;
  const roleIntent = params.roleIntent;

  if (department) {
    const deptNeedle = department.toLowerCase();
    result = result.filter((job) => job.department.toLowerCase().includes(deptNeedle));
  }
  if (track) {
    const trackNeedle = track.toLowerCase();
    result = result.filter((job) => (job.track ?? '').toLowerCase().includes(trackNeedle));
  }
  if (location) {
    const locNeedle = location.toLowerCase();
    result = result.filter(
      (job) =>
        job.location.toLowerCase().includes(locNeedle) ||
        job.tags.some((tag) => tag.toLowerCase().includes(locNeedle)),
    );
  }
  if (roleIntent) {
    const intentNeedle = roleIntent.toLowerCase().replace(/_/g, ' ');
    result = result.filter(
      (job) =>
        job.tags.some((tag) => tag.toLowerCase().includes(intentNeedle)) ||
        job.title.toLowerCase().includes(intentNeedle) ||
        job.department.toLowerCase().includes(intentNeedle),
    );
  }
  if (search) {
    result = result.filter((job) => matchesSearch(job, search));
  }
  return result;
}

function filterResources(
  resources: CareerDataset['resources'],
  params: Record<string, string>,
): CareerDataset['resources'] {
  const search = params.search;
  if (!search) return [...resources];
  const needle = search.toLowerCase();
  return resources.filter(
    (resource) =>
      resource.title.toLowerCase().includes(needle) ||
      resource.category.toLowerCase().includes(needle) ||
      resource.description.toLowerCase().includes(needle),
  );
}

function filterGrowthPaths(
  paths: CareerDataset['growthPaths'],
  params: Record<string, string>,
): CareerDataset['growthPaths'] {
  const fromRole = params.fromRole;
  if (!fromRole) return [...paths];
  const needle = fromRole.toLowerCase();
  return paths.filter(
    (path) =>
      path.fromRole.toLowerCase().includes(needle) ||
      path.toRole.toLowerCase().includes(needle) ||
      path.summary.toLowerCase().includes(needle),
  );
}

async function resolveDatasetInput(
  input: StaticCareerDatasetInput,
  fetchFn: typeof fetch,
): Promise<CareerDataset> {
  if ('url' in input) {
    const response = await fetchFn(input.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch career dataset from ${input.url}: HTTP ${response.status}`);
    }
    const json: unknown = await response.json();
    return parseCareerDataset(json);
  }
  return parseCareerDataset(input);
}

/** Load inline dataset or fetch + validate URL-backed fixture once. */
export async function resolveCareerDatasetInput(
  input: StaticCareerDatasetInput,
  fetchFn: typeof fetch = fetch,
): Promise<CareerDataset> {
  return resolveDatasetInput(input, fetchFn);
}

/**
 * Mock-first career DataAdapter.
 * Serves fixture data in-memory with optional localStorage-backed applications.
 */
export function createStaticCareerAdapter(
  datasetInput: StaticCareerDatasetInput,
  options: StaticCareerAdapterOptions = {},
): DataAdapter {
  const latencyMs = options.latencyMs ?? 0;
  const persistenceKey = options.persistenceKey ?? 'default';
  const fetchFn = options.fetchFn ?? fetch;

  let datasetPromise: Promise<CareerDataset> | null = null;
  let resolvedDataset: CareerDataset | null = 'url' in datasetInput ? null : parseCareerDataset(datasetInput);

  const subscribers: Array<{ source: string; onChange: () => void; active: boolean }> = [];

  let applications: CareerApplication[] = [
    ...(resolvedDataset?.applications ?? []),
    ...loadPersistedApplications(persistenceKey),
  ];

  const ensureDataset = async (): Promise<CareerDataset> => {
    if (resolvedDataset) {
      return resolvedDataset;
    }
    if (!datasetPromise) {
      datasetPromise = resolveDatasetInput(datasetInput, fetchFn).then((dataset) => {
        resolvedDataset = dataset;
        if (applications.length === 0 && dataset.applications?.length) {
          applications = [...dataset.applications];
        }
        return dataset;
      });
    }
    return datasetPromise;
  };

  const notify = (source: string): void => {
    for (const entry of subscribers) {
      if (entry.active && entry.source === source) {
        entry.onChange();
      }
    }
  };

  const queryImpl = async (ref: SourceRef, params: Record<string, string>): Promise<unknown> => {
    const dataset = await ensureDataset();
    switch (ref.source) {
      case 'career.jobs':
        return filterJobs(dataset.jobs, params);
      case 'career.job': {
        const jobId = params.id ?? params.jobId;
        if (!jobId) return null;
        return dataset.jobs.find((job) => job.id === jobId) ?? null;
      }
      case 'career.applications':
        return applications.map((application) => {
          const job = dataset.jobs.find((entry) => entry.id === application.jobId);
          return {
            ...application,
            jobId: job?.title ?? application.jobId,
          };
        });
      case 'career.paths':
        return filterGrowthPaths(dataset.growthPaths, params);
      case 'career.resources':
        return filterResources(dataset.resources, params);
      default:
        throw Object.assign(new Error(`Unknown career source "${ref.source}"`), {
          code: 'not_found' as const,
        });
    }
  };

  const mutateImpl = async (
    action: DeclaredAction,
    payload: unknown,
  ): Promise<MutationResult> => {
    if (action.source !== 'career.apply') {
      return {
        ok: false,
        error: {
          code: 'not_found',
          message: `Unsupported career mutate source "${action.source}"`,
        },
      };
    }

    const body = (payload ?? {}) as ApplyPayload;
    const dataset = await ensureDataset();
    const fieldErrors: Record<string, string> = {};
    const jobId = readString(body.jobId);
    const name = readString(body.candidate?.name);
    const email = readString(body.candidate?.email);

    if (!jobId) {
      fieldErrors.jobId = 'Select a job to apply.';
    } else if (!dataset.jobs.some((job) => job.id === jobId)) {
      fieldErrors.jobId = 'Selected job was not found in the fixture dataset.';
    }
    if (!name) {
      fieldErrors['candidate.name'] = 'Full name is required.';
    }
    if (!email) {
      fieldErrors['candidate.email'] = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fieldErrors['candidate.email'] = 'Enter a valid email address.';
    }

    if (Object.keys(fieldErrors).length > 0) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: 'Application validation failed.',
          fieldErrors,
        },
      };
    }

    const job = dataset.jobs.find((entry) => entry.id === jobId);
    if (!job) {
      return {
        ok: false,
        error: { code: 'not_found', message: 'Job not found.' },
      };
    }

    const application: CareerApplication = {
      id: `app-${Date.now()}`,
      jobId: job.id,
      candidate: {
        name: name ?? '',
        email: email ?? '',
        phone: readString(body.candidate?.phone),
      },
      answers: body.answers,
      status: 'Submitted',
      submittedAt: new Date().toISOString(),
      source: 'fixture',
      sourceId: slugify(`${job.slug}-${email ?? 'anon'}`),
    };

    applications = [...applications, application];
    savePersistedApplications(persistenceKey, applications);
    notify('career.applications');

    // JSON-safe record; interfaces lack the implicit index signature JsonValue wants.
    return { ok: true, data: application as unknown as JsonValue };
  };

  return {
    query(ref: SourceRef, _scope: PanelScope, signal: AbortSignal): Promise<unknown> {
      if (signal.aborted) {
        return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
      }
      const params = readParams(ref.params);
      return withLatency(latencyMs, () => queryImpl(ref, params));
    },

    mutate(action: DeclaredAction, payload: unknown, _scope: PanelScope): Promise<MutationResult> {
      return withLatency(latencyMs, () => mutateImpl(action, payload));
    },

    subscribe(ref: SourceRef, _scope: PanelScope, onChange: () => void): Unsubscribe {
      const entry = { source: ref.source, onChange, active: true };
      subscribers.push(entry);
      return () => {
        entry.active = false;
      };
    },
  };
}
