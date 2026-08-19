/**
 * Renders one DocBlock as safe React elements (G4 — no dangerouslySetInnerHTML).
 */
import React from 'react';
import { sanitizeAssetIdForDisplay, sanitizePlainText } from '../../security/codeExecutionBoundary';
import { sanitizeTextRuns } from './sanitizeRuns';
import type { DocBlock, TextRun } from './types';

function renderTextRun(run: TextRun, index: number): React.ReactNode {
  let node: React.ReactNode = run.text;
  if (run.code === true) {
    node = <code data-testid="text-run-code">{node}</code>;
  }
  if (run.italic === true) {
    node = <em>{node}</em>;
  }
  if (run.bold === true) {
    node = <strong>{node}</strong>;
  }
  return <span key={`run-${index}`}>{node}</span>;
}

function renderRuns(runs: readonly TextRun[]): React.ReactNode {
  const sanitized = sanitizeTextRuns(runs);
  if (sanitized.length === 0) {
    return null;
  }
  return sanitized.map((run, index) => renderTextRun(run, index));
}

export interface BlockRendererProps {
  block: DocBlock;
  position: number;
  setSize: number;
}

export function BlockRenderer(props: BlockRendererProps): React.ReactElement {
  const { block, position, setSize } = props;
  const common = {
    'data-block-id': block.id,
    'data-block-type': block.type,
    role: 'listitem' as const,
    'aria-posinset': position,
    'aria-setsize': setSize,
  };

  switch (block.type) {
    case 'heading': {
      const Tag = block.level === 1 ? 'h1': block.level === 2 ? 'h2': 'h3';
      return (
        <Tag {...common} data-testid="doc-block-heading">
          {sanitizePlainText(block.text)}
        </Tag>
      );
    }
    case 'paragraph':
      return (
        <p {...common} data-testid="doc-block-paragraph">
          {renderRuns(block.runs)}
        </p>
      );
    case 'list':
      return block.ordered ? (
        <ol {...common} data-testid="doc-block-list">
          {block.items.map((itemBlocks, index) => (
            <li key={`item-${index}`}>
              {itemBlocks.map((nested) => (
                <BlockRenderer
                  key={nested.id}
                  block={nested}
                  position={index + 1}
                  setSize={block.items.length}
                />
              ))}
            </li>
          ))}
        </ol>
      ): (
        <ul {...common} data-testid="doc-block-list">
          {block.items.map((itemBlocks, index) => (
            <li key={`item-${index}`}>
              {itemBlocks.map((nested) => (
                <BlockRenderer
                  key={nested.id}
                  block={nested}
                  position={index + 1}
                  setSize={block.items.length}
                />
              ))}
            </li>
          ))}
        </ul>
      );
    case 'table':
      return (
        <table {...common} data-testid="doc-block-table">
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`cell-${cellIndex}`}>{renderRuns(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case 'image':
      return (
        <figure {...common} data-testid="doc-block-image">
          <span data-testid="doc-image-asset">{sanitizeAssetIdForDisplay(block.assetId)}</span>
          {block.alt !== undefined ? (
            <figcaption>{sanitizePlainText(block.alt)}</figcaption>
          ): null}
        </figure>
      );
    case 'callout':
      return (
        <aside {...common} data-testid="doc-block-callout" data-tone={block.tone}>
          {renderRuns(block.runs)}
        </aside>
      );
    case 'pageBreak':
      return <hr {...common} data-testid="doc-block-page-break" />;
    default: {
      const exhaustive: never = block;
      return <div {...common}>{String((exhaustive as DocBlock).type)}</div>;
    }
  }
}
