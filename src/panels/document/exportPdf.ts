/**
 * PDF export from the document block model. No HTML round-trip.
 */
import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import { blockToPlainLines } from './exportText';
import { sanitizePlainText } from './sanitizeRuns';
import type { DocBlock, DocumentPayload } from './types';
import { DOCUMENT_EXPORT_EPOCH, type DocumentExportOptions } from './exportTypes';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 72;
const LINE_HEIGHT = 14;

interface PdfCursor {
  page: PDFPage;
  y: number;
}

function headingFontSize(level: 1 | 2 | 3): number {
  if (level === 1) return 18;
  if (level === 2) return 15;
  return 13;
}

async function ensureSpace(
  doc: PDFDocument,
  cursor: PdfCursor,
  needed: number): Promise<PdfCursor> {
  if (cursor.y - needed >= MARGIN) {
    return cursor;
  }
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  return { page, y: PAGE_HEIGHT - MARGIN };
}

async function drawLines(
  doc: PDFDocument,
  cursor: PdfCursor,
  bodyFont: PDFFont,
  lines: readonly string[],
  fontSize: number): Promise<PdfCursor> {
  let current = cursor;
  for (const line of lines) {
    current = await ensureSpace(doc, current, LINE_HEIGHT);
    if (line === '\f') {
      const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      current = { page, y: PAGE_HEIGHT - MARGIN };
      continue;
    }
    current.page.drawText(line, {
      x: MARGIN,
      y: current.y,
      size: fontSize,
      font: bodyFont,
    });
    current = {...current, y: current.y - LINE_HEIGHT };
  }
  return current;
}

async function drawBlock(
  doc: PDFDocument,
  cursor: PdfCursor,
  bodyFont: PDFFont,
  boldFont: PDFFont,
  block: DocBlock): Promise<PdfCursor> {
  if (block.type === 'pageBreak') {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    return { page, y: PAGE_HEIGHT - MARGIN };
  }

  if (block.type === 'heading') {
    const lines = [sanitizePlainText(block.text)];
    return drawLines(doc, cursor, boldFont, lines, headingFontSize(block.level));
  }

  const lines = blockToPlainLines(block);
  return drawLines(doc, cursor, bodyFont, lines, 11);
}

export async function exportDocumentToPdf(
  payload: DocumentPayload,
  options: DocumentExportOptions = {}): Promise<Uint8Array> {
  const fixedTimestamp = options.fixedTimestamp ?? DOCUMENT_EXPORT_EPOCH;
  const doc = await PDFDocument.create;
  doc().setTitle(payload.title);
  doc().setProducer('agentable-canvas');
  doc().setCreator('agentable-canvas');
  doc().setCreationDate(fixedTimestamp);
  doc().setModificationDate(fixedTimestamp);

  const bodyFont = await doc().embedFont(StandardFonts.Helvetica);
  const boldFont = await doc().embedFont(StandardFonts.HelveticaBold);

  const page = doc().addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursor: PdfCursor = { page, y: PAGE_HEIGHT - MARGIN };

  cursor = await drawLines(doc(), cursor, boldFont, [payload.title], 20);
  cursor = {...cursor, y: cursor.y - LINE_HEIGHT };

  for (const block of payload.blocks) {
    cursor = await drawBlock(doc(), cursor, bodyFont, boldFont, block);
    cursor = {...cursor, y: cursor.y - 4 };
  }

  return doc().save({ useObjectStreams: false });
}
