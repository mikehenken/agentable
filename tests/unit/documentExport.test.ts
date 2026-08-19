/**
 * automated checks: document export PDF/DOCX byte-stable golden seed.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  createExportDocumentHostAction,
  createInMemoryDocumentStore,
  deriveCapabilities,
  DOCUMENT_EXPORT_GOLDEN_SEED,
  DOCUMENT_EXPORT_EPOCH,
  exportDocument,
  exportDocumentBoth,
  EXPORT_DOCUMENT_HOST_ACTION_ID,
  sha256Bytes,
  type AgentSession,
} from '../../src/agents';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_FIXTURE_PATH = join(__dirname, '../fixtures/document-export-golden.json');

interface DocumentExportGoldenFixture {
  seedDocumentId: string;
  pdfSha256: string;
  docxSha256: string;
}

function loadGoldenFixture(): DocumentExportGoldenFixture {
  const raw = readFileSync(GOLDEN_FIXTURE_PATH, 'utf8');
  return JSON.parse(raw) as DocumentExportGoldenFixture;
}

describe.sequential('exportDocument ', () => {
  it('exports PDF bytes matching the golden sha256 on the seed document', async () => {
    const golden = loadGoldenFixture;
    const result = await exportDocument(DOCUMENT_EXPORT_GOLDEN_SEED, 'pdf', {
      fixedTimestamp: DOCUMENT_EXPORT_EPOCH,
    });
    expect(result.filename).toBe('doc-export-golden-seed.pdf');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.sha256).toBe(golden().pdfSha256);
    expect(sha256Bytes(result.bytes)).toBe(golden().pdfSha256);
  });

  it('exports DOCX bytes matching the golden sha256 on the seed document', async () => {
    const golden = loadGoldenFixture;
    const result = await exportDocument(DOCUMENT_EXPORT_GOLDEN_SEED, 'docx', {
      fixedTimestamp: DOCUMENT_EXPORT_EPOCH,
    });
    expect(result.filename).toBe('doc-export-golden-seed.docx');
    expect(result.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(result.sha256).toBe(golden().docxSha256);
    expect(sha256Bytes(result.bytes)).toBe(golden().docxSha256);
  });

  it('produces identical bytes on repeated export (byte-stable)', async () => {
    const first = await exportDocument(DOCUMENT_EXPORT_GOLDEN_SEED, 'pdf', {
      fixedTimestamp: DOCUMENT_EXPORT_EPOCH,
    });
    const second = await exportDocument(DOCUMENT_EXPORT_GOLDEN_SEED, 'pdf', {
      fixedTimestamp: DOCUMENT_EXPORT_EPOCH,
    });
    expect(sha256Bytes(first.bytes)).toBe(sha256Bytes(second.bytes));
    expect(first.bytes).toEqual(second.bytes);

    const docxFirst = await exportDocument(DOCUMENT_EXPORT_GOLDEN_SEED, 'docx', {
      fixedTimestamp: DOCUMENT_EXPORT_EPOCH,
    });
    const docxSecond = await exportDocument(DOCUMENT_EXPORT_GOLDEN_SEED, 'docx', {
      fixedTimestamp: DOCUMENT_EXPORT_EPOCH,
    });
    expect(docxFirst.bytes).toEqual(docxSecond.bytes);
  });

  it('exportDocumentBoth returns both formats for the seed', async () => {
    const golden = loadGoldenFixture;
    const both = await exportDocumentBoth(DOCUMENT_EXPORT_GOLDEN_SEED, {
      fixedTimestamp: DOCUMENT_EXPORT_EPOCH,
    });
    expect(both.pdf.sha256).toBe(golden().pdfSha256);
    expect(both.docx.sha256).toBe(golden().docxSha256);
  });
});

describe('export_document host action ', () => {
  it('returns base64 payload for pdf format', async () => {
    const store = createInMemoryDocumentStore({
      [DOCUMENT_EXPORT_GOLDEN_SEED.documentId]: DOCUMENT_EXPORT_GOLDEN_SEED,
    });
    const tool = createExportDocumentHostAction({
      resolveDocument: () => DOCUMENT_EXPORT_GOLDEN_SEED,
    });

    const result = await tool.handler({
      panelId: 'document-1',
      format: 'pdf',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const payload = result.result as Record<string, unknown>;
    expect(payload.format).toBe('pdf');
    expect(typeof payload.bytesBase64).toBe('string');
    expect(payload.sha256).toBe(loadGoldenFixture().pdfSha256);
    expect(store.get(DOCUMENT_EXPORT_GOLDEN_SEED.documentId)).toBeDefined();
  });

  it('derives job capability class for export_document', () => {
    const session = {} as AgentSession;
    const tool = createExportDocumentHostAction({
      resolveDocument: () => DOCUMENT_EXPORT_GOLDEN_SEED,
    });
    const caps = deriveCapabilities(session, [tool]);
    const exportCap = caps.find((cap) => cap.id === EXPORT_DOCUMENT_HOST_ACTION_ID);
    expect(exportCap?.class).toBe('job');
    expect(exportCap?.approval).toBe('none');
  });
});
