/**
 * Portable document block model. Rendered and exported by the
 * framework; never HTML round-tripped (03 section 12).
 */

/** Inline text run — rendered as React elements, never raw HTML (G4). */
export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export type DocBlock =
  | { id: string; type: 'heading'; level: 1 | 2 | 3; text: string }
  | { id: string; type: 'paragraph'; runs: TextRun[] }
  | { id: string; type: 'list'; ordered: boolean; items: DocBlock[][] }
  | { id: string; type: 'table'; rows: TextRun[][][] }
  | { id: string; type: 'image'; assetId: string; alt?: string }
  | { id: string; type: 'callout'; tone: 'info' | 'warn' | 'success'; runs: TextRun[] }
  | { id: string; type: 'pageBreak' };

/** Bound payload for `workspace.documents` (persisted via `createPersistedDocumentStore`). */
export interface DocumentPayload {
  documentId: string;
  title: string;
  blocks: DocBlock[];
  version?: number;
}

export type BlockOp =
  | { op: 'insert'; index: number; block: DocBlockInput }
  | { op: 'replace'; blockId: string; block: DocBlockInput }
  | { op: 'move'; blockId: string; toIndex: number }
  | { op: 'remove'; blockId: string };

/** Omit that distributes over union members instead of collapsing to common keys. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Block payload for insert/replace — id optional (assigned when missing). */
export type DocBlockInput = DistributiveOmit<DocBlock, 'id'> & { id?: string };

export const WORKSPACE_DOCUMENTS_SOURCE = 'workspace.documents';

export const DOCUMENT_PANEL_ID = 'document';

/** Fixed row height for document block virtualization. */
export const DOCUMENT_BLOCK_ROW_HEIGHT_PX = 48;
