/**
 * Golden export seed document. Covers every block type for byte-stable fixtures.
 */
import type { DocumentPayload } from './types';

export const DOCUMENT_EXPORT_GOLDEN_SEED: DocumentPayload = {
  documentId: 'doc-export-golden-seed',
  title: 'Agentable Export Golden Seed',
  version: 1,
  blocks: [
    {
      id: 'h1-intro',
      type: 'heading',
      level: 1,
      text: 'Introduction',
    },
    {
      id: 'p-lead',
      type: 'paragraph',
      runs: [
        { text: 'Portable block model export with ', bold: false },
        { text: 'bold', bold: true },
        { text: ', ', italic: false },
        { text: 'italic', italic: true },
        { text: ', and ', code: false },
        { text: 'code', code: true },
        { text: ' runs.' },
      ],
    },
    {
      id: 'list-features',
      type: 'list',
      ordered: true,
      items: [
        [
          {
            id: 'li-1',
            type: 'paragraph',
            runs: [{ text: 'Structured headings and paragraphs' }],
          },
        ],
        [
          {
            id: 'li-2',
            type: 'paragraph',
            runs: [{ text: 'Nested lists and tables' }],
          },
        ],
      ],
    },
    {
      id: 'table-metrics',
      type: 'table',
      rows: [
        [
          [{ text: 'Metric' }],
          [{ text: 'Value' }],
        ],
        [
          [{ text: 'Blocks' }],
          [{ text: '7' }],
        ],
        [
          [{ text: 'Format' }],
          [{ text: 'PDF + DOCX' }],
        ],
      ],
    },
    {
      id: 'img-diagram',
      type: 'image',
      assetId: 'asset-wireframe-001',
      alt: 'Wireframe diagram',
    },
    {
      id: 'callout-info',
      type: 'callout',
      tone: 'info',
      runs: [{ text: 'Exports are deterministic on this seed.' }],
    },
    {
      id: 'pb-appendix',
      type: 'pageBreak',
    },
    {
      id: 'h2-appendix',
      type: 'heading',
      level: 2,
      text: 'Appendix',
    },
    {
      id: 'p-appendix',
      type: 'paragraph',
      runs: [{ text: 'Second page content after an explicit page break.' }],
    },
  ],
};
