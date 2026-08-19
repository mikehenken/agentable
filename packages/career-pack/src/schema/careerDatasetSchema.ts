import { z } from 'zod';

const careerJobSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  department: z.string().min(1),
  track: z.string().optional(),
  location: z.string().min(1),
  remote: z.boolean().optional(),
  compensation: z.string().optional(),
  description: z.string(),
  tags: z.array(z.string()),
  postedAt: z.string().min(1),
  closesAt: z.string().optional(),
  source: z.enum(['workable', 'oraclefusion', 'fixture']),
  sourceId: z.string().min(1),
  applyUrl: z.string().min(1),
});

const careerApplicationSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  candidate: z.object({
    name: z.string().min(1),
    email: z.string().min(1),
    phone: z.string().optional(),
  }),
  resumeRef: z.string().optional(),
  answers: z.record(z.string(), z.string()).optional(),
  status: z.string().min(1),
  submittedAt: z.string().min(1),
  source: z.string().min(1),
  sourceId: z.string().min(1),
});

const careerGrowthPathSchema = z.object({
  id: z.string().min(1),
  fromRole: z.string().min(1),
  toRole: z.string().min(1),
  fitScore: z.number().optional(),
  summary: z.string().min(1),
  steps: z.array(z.string()).optional(),
});

const careerResourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  url: z.string().optional(),
  featured: z.boolean().optional(),
});

export const careerDatasetSchema = z.object({
  jobs: z.array(careerJobSchema),
  growthPaths: z.array(careerGrowthPathSchema),
  resources: z.array(careerResourceSchema),
  applications: z.array(careerApplicationSchema).optional(),
});

export type ParsedCareerDataset = z.infer<typeof careerDatasetSchema>;

/** Parse and validate a fixture document; throws on schema violation. */
export function parseCareerDataset(input: unknown): ParsedCareerDataset {
  return careerDatasetSchema.parse(input);
}

/** Non-throwing validation for CI diagnostics. */
export function validateCareerDataset(input: unknown): {
  ok: true;
  data: ParsedCareerDataset;
} | {
  ok: false;
  issues: z.ZodIssue[];
} {
  const result = careerDatasetSchema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return { ok: false, issues: result.error.issues };
}
