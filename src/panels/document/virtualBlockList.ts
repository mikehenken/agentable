/**
 * Block row extraction for D56 document block-list virtualization.
 */
import type { DocBlock } from './types';
import { sanitizePlainText } from './sanitizeRuns';

export interface DocumentBlockRow {
  key: string;
  block: DocBlock;
  label: string;
}

function blockPreview(block: DocBlock): string {
  switch (block.type) {
    case 'heading':
      return sanitizePlainText(block.text);
    case 'paragraph':
      return block.runs.map((run) => sanitizePlainText(run.text)).join(' ');
    case 'list':
      return block.ordered ? 'Ordered list' : 'Bullet list';
    case 'table':
      return `Table (${block.rows.length} rows)`;
    case 'image':
      return block.alt ?? block.assetId;
    case 'callout':
      return block.runs.map((run) => sanitizePlainText(run.text)).join(' ');
    case 'pageBreak':
      return 'Page break';
    default: {
      const exhaustive: never = block;
      return String((exhaustive as DocBlock).type);
    }
  }
}

export function extractDocumentBlockRows(blocks: readonly DocBlock[]): DocumentBlockRow[] {
  return blocks.map((block) => ({
    key: block.id,
    block,
    label: `${block.type}: ${blockPreview(block).slice(0, 80)}`,
  }));
}
