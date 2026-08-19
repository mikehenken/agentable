/**
 * Document export types. Block model → PDF/DOCX; no HTML round-trip.
 */
import type { DocumentPayload } from './types';

export type DocumentExportFormat = 'pdf' | 'docx';

export interface DocumentExportOptions {
  /** Fixed timestamp for deterministic golden output. Defaults to export epoch. */
  fixedTimestamp?: Date;
  /** Optional resolver for image block asset ids → raw bytes. */
  resolveAsset?: (assetId: string) => Uint8Array | null | Promise<Uint8Array | null>;
}

export interface DocumentExportResult {
  format: DocumentExportFormat;
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
  sha256: string;
}

export interface DocumentExportHostContext {
  resolveDocument: (
    panelId: string,
  ) => DocumentPayload | null | Promise<DocumentPayload | null>;
  resolveAsset?: DocumentExportOptions['resolveAsset'];
}

/** Frozen epoch for byte-stable golden exports (AC). */
export const DOCUMENT_EXPORT_EPOCH_ISO = '2020-01-01T00:00:00.000Z';

export const DOCUMENT_EXPORT_EPOCH = new Date(DOCUMENT_EXPORT_EPOCH_ISO);

export const EXPORT_DOCUMENT_HOST_ACTION_ID = 'export_document';
