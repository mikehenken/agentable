/**
 * Host action `export_document` (03 section 12).
 */
import type { ToolDefinition, ToolResult } from '../tools';
import type { DocumentStore } from './documentAdapter';
import { exportDocument } from './documentExport';
import type { DocumentExportFormat, DocumentExportHostContext } from './exportTypes';
import { EXPORT_DOCUMENT_HOST_ACTION_ID } from './exportTypes';
import type { DocumentPayload } from './types';
import { DOCUMENT_PANEL_ID } from './types';

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readFormat(value: unknown): DocumentExportFormat | undefined {
  if (value === 'pdf' || value === 'docx') {
    return value;
  }
  return undefined;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }
  return btoa(binary);
}

export function createExportDocumentHostAction(
  context: DocumentExportHostContext,
): ToolDefinition {
  return {
    declaration: {
      name: EXPORT_DOCUMENT_HOST_ACTION_ID,
      description:
        'Export a document panel instance to PDF or DOCX from the portable block model (no HTML round-trip).',
      costClass: 'cheap',
      parameters: {
        type: 'object',
        properties: {
          panelId: {
            type: 'string',
            description: 'Open document panel instance id to export.',
          },
          format: {
            type: 'string',
            enum: ['pdf', 'docx'],
            description: 'Target export format.',
          },
        },
        required: ['panelId', 'format'],
      },
    },
    handler: async (args): Promise<ToolResult> => {
      const panelId = readNonEmptyString(args.panelId);
      if (panelId === undefined) {
        return { ok: false, error: 'panelId must be a non-empty string' };
      }

      const format = readFormat(args.format);
      if (format === undefined) {
        return { ok: false, error: 'format must be "pdf" or "docx"' };
      }

      const payload = await context.resolveDocument(panelId);
      if (payload === null) {
        return { ok: false, error: `document for panel "${panelId}" not found` };
      }

      try {
        const result = await exportDocument(payload, format, {
          resolveAsset: context.resolveAsset,
        });
        return {
          ok: true,
          result: {
            panelId,
            panelType: DOCUMENT_PANEL_ID,
            format: result.format,
            filename: result.filename,
            mimeType: result.mimeType,
            sha256: result.sha256,
            bytesBase64: bytesToBase64(result.bytes),
          },
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'export failed';
        return { ok: false, error: message };
      }
    },
  };
}

/**
 * Resolve a document payload from a panel instance id via an in-memory store keyed by
 * `scope.entityId` / `documentId`.
 */
export function createPanelDocumentResolver(
  lookup: (panelId: string) => { documentId: string } | null,
  store: Pick<DocumentStore, 'get'>,
): (panelId: string) => DocumentPayload | null {
  return (panelId: string) => {
    const binding = lookup(panelId);
    if (binding === null) {
      return null;
    }
    return store.get(binding.documentId) ?? null;
  };
}
