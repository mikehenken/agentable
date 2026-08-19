/**
 * Mock adapter source contract (05 §3a).
 *
 * Documents the query/mutate shapes served by `createStaticCareerAdapter`
 * so future ATS worker endpoint types can prove forward compatibility at
 * compile time. No runtime code — types only.
 */
import type {
  CareerApplication,
  CareerGrowthPath,
  CareerJob,
  CareerResource,
} from './careerEntityTypes';

/** Query params accepted by `career.jobs` (mock + future worker listing). */
export interface CareerJobsQueryParams {
  search?: string;
  department?: string;
  track?: string;
  location?: string;
  roleIntent?: string;
}

/** Query params accepted by `career.job`. */
export interface CareerJobQueryParams {
  id?: string;
  jobId?: string;
}

/** Mutate payload for `career.apply`. */
export interface CareerApplyMutatePayload {
  jobId?: string;
  candidate?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  answers?: Record<string, string>;
  resumeRef?: string;
}

/** Per-source query/mutate contract for the mock career DataAdapter. */
export interface CareerAdapterSourceContract {
  'career.jobs': {
    params: CareerJobsQueryParams;
    queryResult: readonly CareerJob[];
  };
  'career.job': {
    params: CareerJobQueryParams;
    queryResult: CareerJob | null;
  };
  'career.applications': {
    params: Record<string, never>;
    queryResult: readonly CareerApplication[];
  };
  'career.paths': {
    params: { fromRole?: string; search?: string };
    queryResult: readonly CareerGrowthPath[];
  };
  'career.resources': {
    params: { search?: string };
    queryResult: readonly CareerResource[];
  };
  'career.apply': {
    mutatePayload: CareerApplyMutatePayload;
    mutateResult: CareerApplication;
  };
}

/** Adapter query source names (includes `career.job` detail lookup). */
export type CareerAdapterQuerySource = {
  [K in keyof CareerAdapterSourceContract]: CareerAdapterSourceContract[K] extends {
    queryResult: unknown;
  }
    ? K: never;
}[keyof CareerAdapterSourceContract];

/** Adapter mutate source names. */
export type CareerAdapterMutateSource = {
  [K in keyof CareerAdapterSourceContract]: CareerAdapterSourceContract[K] extends {
    mutatePayload: unknown;
  }
    ? K: never;
}[keyof CareerAdapterSourceContract];

/** Sources a future ATS worker is expected to back (fixture-only sources excluded). */
export type AtsWorkerBackedAdapterSource =
  | 'career.jobs'
  | 'career.job'
  | 'career.applications'
  | 'career.apply';

/** Fixture-only sources that remain mock/static even after ATS worker ships. */
export type FixtureOnlyAdapterSource = 'career.paths' | 'career.resources';
