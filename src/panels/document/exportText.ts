/**
 * Plain-text extraction from document blocks for export.
 */
import { sanitizePlainText, sanitizeTextRuns } from './sanitizeRuns';
import type { DocBlock, TextRun } from './types';

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function runsToPlainText(runs: readonly TextRun[]): string {
  return sanitizeTextRuns(runs)
    .map((run) => run.text)
    .join('');
}

export function wrapPlainText(text: string, maxWidth = 80): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines: string[] = [];
  for (const paragraph of normalized.split('\n')) {
    if (paragraph.length === 0) {
      lines.push('');
      continue;
    }
    let cursor = 0;
    while (cursor < paragraph.length) {
      lines.push(paragraph.slice(cursor, cursor + maxWidth));
      cursor += maxWidth;
    }
  }
  return lines;
}

export function blockToPlainLines(block: DocBlock, depth = 0): string[] {
  const indent = '  '.repeat(depth);

  switch (block.type) {
    case 'heading':
      return [`${indent}${sanitizePlainText(block.text)}`];
    case 'paragraph':
      return wrapPlainText(`${indent}${runsToPlainText(block.runs)}`);
    case 'list': {
      const lines: string[] = [];
      block.items.forEach((itemBlocks, index) => {
        const marker = block.ordered ? `${index + 1}. ` : '- ';
        const itemText = itemBlocks
          .flatMap((nested) => blockToPlainLines(nested, depth + 1))
          .join(' ');
        lines.push(`${indent}${marker}${itemText}`);
      });
      return lines;
    }
    case 'table': {
      const lines: string[] = [];
      for (const row of block.rows) {
        const cells = row.map((cell) => runsToPlainText(cell));
        lines.push(`${indent}${cells.join('\t')}`);
      }
      return lines;
    }
    case 'image': {
      const alt = block.alt !== undefined ? sanitizePlainText(block.alt) : block.assetId;
      return [`${indent}[image: ${alt}]`];
    }
    case 'callout':
      return wrapPlainText(`${indent}[${block.tone.toUpperCase()}] ${runsToPlainText(block.runs)}`);
    case 'pageBreak':
      return ['\f'];
    default: {
      const exhaustive: never = block;
      return [`${indent}${String((exhaustive as DocBlock).type)}`];
    }
  }
}

export function documentToPlainLines(blocks: readonly DocBlock[]): string[] {
  const lines: string[] = [];
  for (const block of blocks) {
    lines.push(...blockToPlainLines(block));
  }
  return lines;
}
