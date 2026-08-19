/**
 * Operator composer attachments — Gemini-compatible file encoding (P13-T7 iter-5).
 * Ported from landing-editor `nas-chat-attachments.ts` (adapted for agentable-canvas).
 */
import type { AttachmentItem } from '../../components/ui-ai/attachments';

export const OPERATOR_ATTACHMENT_MAX_BYTES = 5_000_000;

/** Gemini inline-data friendly types for operator chat. */
export const OPERATOR_ALLOWED_MIME_PREFIXES = [
  'image/',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
] as const;

export interface OperatorPendingAttachment {
  id: string;
  name: string;
  mimeType: string;
  file: File;
  previewUrl: string;
}

export interface OperatorOutboundAttachment {
  mimeType: string;
  data: string;
  label: string;
}

const PASTED_IMAGE_EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function extensionForImageMime(mimeType: string): string {
  return PASTED_IMAGE_EXTENSION_BY_MIME[mimeType] ?? 'png';
}

export function isOperatorAttachmentMimeAllowed(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return OPERATOR_ALLOWED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function ensurePastedImageFileName(file: File, index: number): File {
  const trimmedName = file.name.trim();
  if (trimmedName.length > 0 && trimmedName !== 'blob') {
    return file;
  }
  const mimeType = file.type.startsWith('image/') ? file.type : 'image/png';
  const ext = extensionForImageMime(mimeType);
  const stamp = Date.now();
  const name =
    index === 0
      ? `pasted-image-${stamp}.${ext}`
      : `pasted-image-${stamp}-${index + 1}.${ext}`;
  return new File([file], name, { type: mimeType, lastModified: file.lastModified });
}

export function extractImageFilesFromClipboard(data: DataTransfer): File[] {
  const files: File[] = [];

  if (data.items?.length) {
    for (const item of Array.from(data.items)) {
      if (item.kind !== 'file') {
        continue;
      }
      if (!item.type.startsWith('image/')) {
        continue;
      }
      const file = item.getAsFile();
      if (!file) {
        continue;
      }
      files.push(ensurePastedImageFileName(file, files.length));
    }
  }

  if (files.length === 0 && data.files?.length) {
    for (const file of Array.from(data.files)) {
      if (!file.type.startsWith('image/')) {
        continue;
      }
      files.push(ensurePastedImageFileName(file, files.length));
    }
  }

  return files;
}

export function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function createOperatorPendingAttachment(file: File): OperatorPendingAttachment | null {
  if (file.size > OPERATOR_ATTACHMENT_MAX_BYTES) {
    return null;
  }
  const mimeType = file.type || 'application/octet-stream';
  if (!isOperatorAttachmentMimeAllowed(mimeType)) {
    return null;
  }
  return {
    id: crypto.randomUUID(),
    name: file.name,
    mimeType,
    file,
    previewUrl: URL.createObjectURL(file),
  };
}

export function pendingAttachmentToItem(pending: OperatorPendingAttachment): AttachmentItem {
  return {
    id: pending.id,
    name: pending.name,
    mime: pending.mimeType,
    size: pending.file.size,
    status: 'ready',
  };
}

export async function encodeOperatorAttachments(
  pending: readonly OperatorPendingAttachment[],
): Promise<OperatorOutboundAttachment[]> {
  const encoded: OperatorOutboundAttachment[] = [];
  for (const item of pending) {
    const dataUri = await readFileAsDataUri(item.file);
    const base64Marker = ';base64,';
    const markerIndex = dataUri.indexOf(base64Marker);
    const data =
      markerIndex >= 0 ? dataUri.slice(markerIndex + base64Marker.length) : dataUri;
    encoded.push({
      mimeType: item.mimeType,
      data,
      label: item.name,
    });
  }
  return encoded;
}

export function revokeOperatorAttachmentPreviews(pending: readonly OperatorPendingAttachment[]): void {
  for (const item of pending) {
    URL.revokeObjectURL(item.previewUrl);
  }
}
