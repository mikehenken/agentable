import { z } from 'zod';

const supportTicketSchema = z.object({
  id: z.string().min(1),
  subject: z.string().min(1),
  customerName: z.string().min(1),
  customerEmail: z.string().min(1),
  status: z.enum(['open', 'pending', 'resolved']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  channel: z.enum(['email', 'chat', 'phone']),
  preview: z.string().min(1),
  updatedAt: z.string().min(1),
  assignee: z.string().optional(),
});

const supportMessageSchema = z.object({
  id: z.string().min(1),
  ticketId: z.string().min(1),
  author: z.string().min(1),
  role: z.enum(['customer', 'agent', 'system']),
  body: z.string().min(1),
  sentAt: z.string().min(1),
});

const supportMacroSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  body: z.string().min(1),
});

export const supportDatasetSchema = z.object({
  tickets: z.array(supportTicketSchema),
  messages: z.array(supportMessageSchema),
  macros: z.array(supportMacroSchema),
});

export type ParsedSupportDataset = z.infer<typeof supportDatasetSchema>;

/** Parse and validate a fixture document; throws on schema violation. */
export function parseSupportDataset(input: unknown): ParsedSupportDataset {
  return supportDatasetSchema.parse(input);
}

/** Non-throwing validation for CI diagnostics. */
export function validateSupportDataset(input: unknown):
  | { ok: true; data: ParsedSupportDataset }
  | { ok: false; issues: z.ZodIssue[] } {
  const result = supportDatasetSchema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return { ok: false, issues: result.error.issues };
}

/** Detect normalized support fixture rows vs unrelated JSON. */
export function isSupportDatasetDocument(input: unknown): boolean {
  const validated = validateSupportDataset(input);
  return validated.ok;
}
