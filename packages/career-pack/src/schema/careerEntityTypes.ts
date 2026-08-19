/**
 * Normalized career entity types (05 §3a §3b shared schema).
 *
 * Kept free of framework imports so forward-compat type proofs
 * compile in isolation via `tsconfig.career-forward-compat.json`.
 *** Normalized career job (05-DATA_AND_BACKENDS section 3b). */
export interface CareerJob {
  id: string;
  slug: string;
  title: string;
  department: string;
  track?: string;
  location: string;
  remote?: boolean;
  compensation?: string;
  description: string;
  tags: readonly string[];
  postedAt: string;
  closesAt?: string;
  source: 'workable' | 'oraclefusion' | 'fixture';
  sourceId: string;
  applyUrl: string;
}

/** Normalized career application record. */
export interface CareerApplication {
  id: string;
  jobId: string;
  candidate: {
    name: string;
    email: string;
    phone?: string;
  };
  resumeRef?: string;
  answers?: Readonly<Record<string, string>>;
  status: string;
  submittedAt: string;
  source: string;
  sourceId: string;
}

/** Growth path trajectory card. */
export interface CareerGrowthPath {
  id: string;
  fromRole: string;
  toRole: string;
  fitScore?: number;
  summary: string;
  steps?: readonly string[];
}

/** Learning benefits handbook resource entry. */
export interface CareerResource {
  id: string;
  title: string;
  category: string;
  description: string;
  url?: string;
  featured?: boolean;
}

/** Inline or URL-backed fixture dataset (P5 mock adapter shape). */
export interface CareerDataset {
  jobs: readonly CareerJob[];
  growthPaths: readonly CareerGrowthPath[];
  resources: readonly CareerResource[];
  applications?: readonly CareerApplication[];
}
