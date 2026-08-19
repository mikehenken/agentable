/**
 * compile-time proofs: future ATS worker endpoint types extend the
 * mock adapter source contract and normalized career schema.
 *
 * Included by `packages/career-pack/tsconfig.json`; failures surface via
 * `npm run validate:career-worker-types`.
 */
import type { CareerApplication, CareerJob } from './careerEntityTypes';
import type {
  AtsWorkerBackedAdapterSource,
  CareerAdapterMutateSource,
  CareerAdapterQuerySource,
  CareerAdapterSourceContract,
  FixtureOnlyAdapterSource,
} from './adapterSourceContract';
import type {
  AtsCreateApplicationResponse,
  AtsGetJobResponse,
  AtsListApplicationsResponse,
  AtsListJobsResponse,
  AtsWorkerApplicationRecord,
  AtsWorkerEndpointSourceMap,
  AtsWorkerJobRecord,
} from './workerEndpointTypes';

type AssertTrue<T extends true> = T;
type AssertExtends<Sub, Super> = Sub extends Super ? true : false;

/** Worker job rows must satisfy the normalized mock schema. */
type _WorkerJobExtendsCareerJob = AssertTrue<AssertExtends<AtsWorkerJobRecord, CareerJob>>;

/** Worker application rows must satisfy the normalized mock schema. */
type _WorkerApplicationExtendsCareerApplication = AssertTrue<
  AssertExtends<AtsWorkerApplicationRecord, CareerApplication>
>;

/** List jobs response items match `career.jobs` query result element type. */
type _ListJobsItemMatchesAdapter = AssertTrue<
  AssertExtends<
    AtsListJobsResponse['jobs'][number],
    CareerAdapterSourceContract['career.jobs']['queryResult'][number]
  >
>;

/** Single job response matches `career.job` query result (non-null case). */
type _GetJobMatchesAdapter = AssertTrue<
  AssertExtends<AtsGetJobResponse['job'], NonNullable<CareerAdapterSourceContract['career.job']['queryResult']>>
>;

/** List applications items match `career.applications` query result element type. */
type _ListApplicationsItemMatchesAdapter = AssertTrue<
  AssertExtends<
    AtsListApplicationsResponse['applications'][number],
    CareerAdapterSourceContract['career.applications']['queryResult'][number]
  >
>;

/** Create application response body matches `career.apply` mutate success data. */
type _CreateApplicationMatchesAdapter = AssertTrue<
  AssertExtends<
    AtsCreateApplicationResponse['application'],
    CareerAdapterSourceContract['career.apply']['mutateResult']
  >
>;

/** Every worker-backed adapter source exists on the mock contract. */
type _WorkerBackedSourcesInContract = AssertTrue<
  AssertExtends<AtsWorkerBackedAdapterSource, keyof CareerAdapterSourceContract>
>;

/** Fixture-only sources remain on the contract but are excluded from worker map values. */
type _FixtureOnlySourcesInContract = AssertTrue<
  AssertExtends<FixtureOnlyAdapterSource, keyof CareerAdapterSourceContract>
>;

/** Worker endpoint map only references known adapter sources (or `never` for sync status). */
type WorkerEndpointAdapterSources = AtsWorkerEndpointSourceMap[keyof AtsWorkerEndpointSourceMap]['adapterSource'];
type _EndpointSourcesValid = AssertTrue<
  AssertExtends<
    Exclude<WorkerEndpointAdapterSources, never>,
    CareerAdapterQuerySource | CareerAdapterMutateSource
  >
>;

/** Exported sentinel — if any assertion above fails, this line errors at compile time. */
export type CareerWorkerForwardCompatProof = [
  _WorkerJobExtendsCareerJob,
  _WorkerApplicationExtendsCareerApplication,
  _ListJobsItemMatchesAdapter,
  _GetJobMatchesAdapter,
  _ListApplicationsItemMatchesAdapter,
  _CreateApplicationMatchesAdapter,
  _WorkerBackedSourcesInContract,
  _FixtureOnlySourcesInContract,
  _EndpointSourcesValid,
];

/** Runtime no-op so the module is not elided as unused by bundlers importing the package. */
export const CAREER_WORKER_FORWARD_COMPAT_PROOF_COUNT = 9 as const;
