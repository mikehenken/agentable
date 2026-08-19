/**
 * Document export orchestration: PDF/DOCX from block model, no HTML round-trip.
 */
import { createHash } from 'node:crypto';
import { exportDocumentToDocx } from './exportDocx';
import { exportDocumentToPdf } from './exportPdf';
import type { DocumentPayload } from './types';
import type {
  DocumentExportFormat,
  DocumentExportOptions,
  DocumentExportResult,
} from './exportTypes';

export function sha256Bytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function mimeTypeForFormat(format: DocumentExportFormat): string {
  if (format === 'pdf') {
    return 'application/pdf';
  }
  return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

function filenameForExport(payload: DocumentPayload, format: DocumentExportFormat): string {
  const slug = payload.documentId.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  const base = slug.length > 0 ? slug : 'document';
  return `${base}.${format}`;
}

export async function exportDocument(
  payload: DocumentPayload,
  format: DocumentExportFormat,
  options: DocumentExportOptions = {},
): Promise<DocumentExportResult> {
  const bytes =
    format === 'pdf'
      ? await exportDocumentToPdf(payload, options)
      : await exportDocumentToDocx(payload, options);

  return {
    format,
    bytes,
    mimeType: mimeTypeForFormat(format),
    filename: filenameForExport(payload, format),
    sha256: sha256Bytes(bytes),
  };
}

export async function exportDocumentBoth(
  payload: DocumentPayload,
  options: DocumentExportOptions = {},
): Promise<{ pdf: DocumentExportResult; docx: DocumentExportResult }> {
  const pdf = await exportDocument(payload, 'pdf', options);
  const docx = await exportDocument(payload, 'docx', options);
  return { pdf, docx };
}
