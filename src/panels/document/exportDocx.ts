/**
 * DOCX export from the document block model (P12-T4). No HTML round-trip.
 */
import { buildDeterministicZip } from './deterministicZip';
import { escapeXml, runsToPlainText } from './exportText';
import { sanitizePlainText } from './sanitizeRuns';
import type { DocBlock, DocumentPayload, TextRun } from './types';
import type { DocumentExportOptions } from './exportTypes';

function xmlEscape(value: string): string {
  return escapeXml(value);
}

function runXml(run: TextRun): string {
  const text = xmlEscape(run.text);
  if (run.bold === true && run.italic === true) {
    return `<w:r><w:rPr><w:b/><w:i/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`;
  }
  if (run.bold === true) {
    return `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`;
  }
  if (run.italic === true) {
    return `<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`;
  }
  if (run.code === true) {
    return `<w:r><w:rPr><w:rStyle w:val="Code"/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`;
  }
  return `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;
}

function runsXml(runs: readonly TextRun[]): string {
  const sanitized = runs.map((run) => ({
    text: run.text,
    bold: run.bold,
    italic: run.italic,
    code: run.code,
  }));
  if (sanitized.every((run) => run.text.length === 0)) {
    return '<w:r><w:t xml:space="preserve"></w:t></w:r>';
  }
  return sanitized.map((run) => runXml(run)).join('');
}

function paragraphXml(text: string, style?: string): string {
  const styleXml =
    style !== undefined ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
  return `<w:p>${styleXml}<w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
}

function paragraphRunsXml(runs: readonly TextRun[], style?: string): string {
  const styleXml =
    style !== undefined ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
  return `<w:p>${styleXml}${runsXml(runs)}</w:p>`;
}

function pageBreakXml(): string {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

function blocksToDocumentXml(blocks: readonly DocBlock[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const style = block.level === 1 ? 'Heading1' : block.level === 2 ? 'Heading2' : 'Heading3';
        parts.push(paragraphXml(sanitizePlainText(block.text), style));
        break;
      }
      case 'paragraph':
        parts.push(paragraphRunsXml(block.runs));
        break;
      case 'list': {
        block.items.forEach((itemBlocks, itemIndex) => {
          const itemText = itemBlocks
            .map((nested) => {
              if (nested.type === 'paragraph') {
                return runsToPlainText(nested.runs);
              }
              if (nested.type === 'heading') {
                return sanitizePlainText(nested.text);
              }
              return '';
            })
            .filter((segment) => segment.length > 0)
            .join(' ');
          const prefix = block.ordered ? `${itemIndex + 1}. ` : '• ';
          parts.push(paragraphXml(`${prefix}${itemText}`));
        });
        break;
      }
      case 'table': {
        parts.push('<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>');
        for (const row of block.rows) {
          parts.push('<w:tr>');
          for (const cell of row) {
            parts.push(`<w:tc><w:p>${runsXml(cell)}</w:p></w:tc>`);
          }
          parts.push('</w:tr>');
        }
        parts.push('</w:tbl>');
        break;
      }
      case 'image': {
        const label =
          block.alt !== undefined ? sanitizePlainText(block.alt) : block.assetId;
        parts.push(paragraphXml(`[image: ${label}]`));
        break;
      }
      case 'callout':
        parts.push(
          paragraphRunsXml([
            { text: `[${block.tone.toUpperCase()}] `, bold: true },
            ...block.runs,
          ]),
        );
        break;
      case 'pageBreak':
        parts.push(pageBreakXml());
        break;
      default: {
        const exhaustive: never = block;
        parts.push(paragraphXml(String((exhaustive as DocBlock).type)));
      }
    }
  }

  return parts.join('');
}

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOCUMENT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

export async function exportDocumentToDocx(
  payload: DocumentPayload,
  options: DocumentExportOptions = {},
): Promise<Uint8Array> {
  void options;
  const body = blocksToDocumentXml(payload.blocks);
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphXml(payload.title, 'Title')}
    ${body}
    <w:sectPr/>
  </w:body>
</w:document>`;

  const encoder = new TextEncoder();
  return buildDeterministicZip([
    { name: '[Content_Types].xml', data: encoder.encode(CONTENT_TYPES_XML) },
    { name: '_rels/.rels', data: encoder.encode(ROOT_RELS_XML) },
    { name: 'word/_rels/document.xml.rels', data: encoder.encode(DOCUMENT_RELS_XML) },
    { name: 'word/document.xml', data: encoder.encode(documentXml) },
  ]);
}
