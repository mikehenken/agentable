/**
 * Future ATS sync worker endpoint types (05 §3b).
 *
 * Recorded design for `agentable-ats-sync` — NOT implemented (G2).
 * These types exist so a future worker can drop in behind the identical
 * DataAdapter source names without changing panel or tool contracts.
 */
import type { CareerApplication, CareerJob } from './careerEntityTypes';
import type {
  CareerApplyMutatePayload,
  CareerJobsQueryParams,
} from './adapterSourceContract';

/** Tenant ids planned for the multi-tenant ATS worker. */
export type AtsWorkerTenantId = 'moss' | 'sandals' | (string & {});

/** ATS-origin job record — `source` excludes mock-only `fixture`. */
export type AtsWorkerJobRecord = Omit<CareerJob, 'source'> & {
  source: Extract<CareerJob['source'], 'workable' | 'oraclefusion'>;
};

/** ATS-origin application record. */
export type AtsWorkerApplicationRecord = Omit<CareerApplication, 'source'> & {
  source: Extract<CareerApplication['source'], 'workable' | 'oraclefusion'> | string;
};

/** GET /v1/:tenant/jobs query string (superset of mock filter params). */
export interface AtsListJobsQueryParams extends CareerJobsQueryParams {
  updatedSince?: string;
  limit?: number;
  cursor?: string;
}

/** GET /v1/:tenant/jobs response body. */
export interface AtsListJobsResponse {
  jobs: readonly AtsWorkerJobRecord[];
  cursor?: string;
  total?: number;
}

/** GET /v1/:tenant/jobs/:id response body. */
export interface AtsGetJobResponse {
  job: AtsWorkerJobRecord;
}

/** GET /v1/:tenant/applications query string. */
export interface AtsListApplicationsQueryParams {
  email?: string;
}

/** GET /v1/:tenant/applications response body. */
export interface AtsListApplicationsResponse {
  applications: readonly AtsWorkerApplicationRecord[];
}

/** POST /v1/:tenant/applications request body. */
export type AtsCreateApplicationRequest = Required<
  Pick<CareerApplyMutatePayload, 'jobId'>
> &
  Pick<CareerApplyMutatePayload, 'answers' | 'resumeRef'> & {
    candidate: Required<Pick<NonNullable<CareerApplyMutatePayload['candidate']>, 'name' | 'email'>> &
      Pick<NonNullable<CareerApplyMutatePayload['candidate']>, 'phone'>;
  };

/** POST /v1/:tenant/applications response body. */
export interface AtsCreateApplicationResponse {
  application: AtsWorkerApplicationRecord;
  receipt?: {
    atsReferenceId: string;
    vendor: 'workable' | 'oraclefusion';
  };
}

/** GET /v1/:tenant/sync/status response body (status badge; not a DataAdapter source). */
export interface AtsSyncStatusResponse {
  lastSyncAt: string;
  jobCount: number;
  applicationCount: number;
  errors: readonly { code: string; message: string; at: string }[];
}

/** Maps worker HTTP routes to DataAdapter source names they will hydrate. */
export interface AtsWorkerEndpointSourceMap {
  'GET /v1/:tenant/jobs': {
    adapterSource: 'career.jobs';
    queryParams: AtsListJobsQueryParams;
    response: AtsListJobsResponse;
  };
  'GET /v1/:tenant/jobs/:id': {
    adapterSource: 'career.job';
    response: AtsGetJobResponse;
  };
  'GET /v1/:tenant/applications': {
    adapterSource: 'career.applications';
    queryParams: AtsListApplicationsQueryParams;
    response: AtsListApplicationsResponse;
  };
  'POST /v1/:tenant/applications': {
    adapterSource: 'career.apply';
    request: AtsCreateApplicationRequest;
    response: AtsCreateApplicationResponse;
  };
  'GET /v1/:tenant/sync/status': {
    adapterSource: never;
    response: AtsSyncStatusResponse;
  };
}
