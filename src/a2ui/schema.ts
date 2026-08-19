import { z } from 'zod';
import { A2UI_PROTOCOL_VERSION } from './constants';

const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValue),
    z.record(z.string(), jsonValue),
  ]),
);

const a2uiComponentSchema = z
  .object({
    id: z.string().min(1),
    component: z.string().min(1),
    children: z.array(z.string().min(1)).optional(),
    child: z.string().min(1).optional(),
  })
  .catchall(jsonValue);

const createSurfaceSchema = z.object({
  surfaceId: z.string().min(1),
  catalogId: z.string().min(1),
  surfaceProperties: z.record(z.string(), jsonValue).optional(),
  sendDataModel: z.boolean().optional(),
  components: z.array(a2uiComponentSchema).optional(),
  dataModel: z.record(z.string(), jsonValue).optional(),
});

const updateComponentsSchema = z.object({
  surfaceId: z.string().min(1),
  components: z.array(a2uiComponentSchema).min(1),
});

const updateDataModelSchema = z.object({
  surfaceId: z.string().min(1),
  path: z.string().optional(),
  value: jsonValue.optional(),
});

const deleteSurfaceSchema = z.object({
  surfaceId: z.string().min(1),
});

/** Validates a single A2UI v1.0 server-to-client envelope. */
export const a2uiEnvelopeSchema = z
  .object({
    version: z.string().min(1),
    createSurface: createSurfaceSchema.optional(),
    updateComponents: updateComponentsSchema.optional(),
    updateDataModel: updateDataModelSchema.optional(),
    deleteSurface: deleteSurfaceSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const keys = [
      value.createSurface !== undefined,
      value.updateComponents !== undefined,
      value.updateDataModel !== undefined,
      value.deleteSurface !== undefined,
    ].filter(Boolean).length;
    if (keys !== 1) {
      ctx.addIssue({
        code: 'custom',
        message: 'A2UI envelope must contain exactly one message key',
        path: [],
      });
    }
    if (value.version !== A2UI_PROTOCOL_VERSION) {
      ctx.addIssue({
        code: 'custom',
        message: `Unsupported A2UI version "${value.version}"; expected ${A2UI_PROTOCOL_VERSION}`,
        path: ['version'],
      });
    }
  });

export type ParsedA2UIEnvelope = z.infer<typeof a2uiEnvelopeSchema>;

/** Parse and validate unknown wire JSON as an A2UI envelope. */
export function parseA2UIEnvelope(input: unknown): ParsedA2UIEnvelope {
  return a2uiEnvelopeSchema.parse(input);
}

/** Safe parse returning structured issues instead of throwing. */
export function safeParseA2UIEnvelope(
  input: unknown,
): { ok: true; data: ParsedA2UIEnvelope } | { ok: false; message: string } {
  const result = a2uiEnvelopeSchema.safeParse(input);
  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join('; ');
    return { ok: false, message };
  }
  return { ok: true, data: result.data };
}
