/**
 * Runtime validation for document payloads and block ops.
 */
import { z } from 'zod';
import { validateAssetId } from '../../security/codeExecutionBoundary';
import type { DocumentPayload, DocBlock, TextRun } from './types';

const safeAssetIdSchema = z.string().min(1).superRefine((value, ctx) => {
  const result = validateAssetId(value);
  if (!result.ok) {
    ctx.addIssue({ code: 'custom', message: result.reason });
  }
});

const textRunSchema: z.ZodType<TextRun> = z.object({
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  code: z.boolean().optional(),
});

const docBlockSchema: z.ZodType<DocBlock> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      id: z.string().min(1),
      type: z.literal('heading'),
      level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      text: z.string(),
    }),
    z.object({
      id: z.string().min(1),
      type: z.literal('paragraph'),
      runs: z.array(textRunSchema),
    }),
    z.object({
      id: z.string().min(1),
      type: z.literal('list'),
      ordered: z.boolean(),
      items: z.array(z.array(docBlockSchema)),
    }),
    z.object({
      id: z.string().min(1),
      type: z.literal('table'),
      rows: z.array(z.array(z.array(textRunSchema))),
    }),
    z.object({
      id: z.string().min(1),
      type: z.literal('image'),
      assetId: safeAssetIdSchema,
      alt: z.string().optional(),
    }),
    z.object({
      id: z.string().min(1),
      type: z.literal('callout'),
      tone: z.enum(['info', 'warn', 'success']),
      runs: z.array(textRunSchema),
    }),
    z.object({
      id: z.string().min(1),
      type: z.literal('pageBreak'),
    }),
  ]));

export const documentPayloadSchema: z.ZodType<DocumentPayload> = z.object({
  documentId: z.string().min(1),
  title: z.string(),
  blocks: z.array(docBlockSchema),
  version: z.number().int().nonnegative().optional(),
});

export function parseDocumentPayload(value: unknown): DocumentPayload | null {
  const result = documentPayloadSchema.safeParse(value);
  return result.success ? result.data: null;
}

export function isDocumentPayload(value: unknown): value is DocumentPayload {
  return parseDocumentPayload(value) !== null;
}
