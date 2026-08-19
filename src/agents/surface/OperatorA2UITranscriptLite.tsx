import { useMemo, type ReactElement } from 'react';
import type { A2UIEnvelope } from '../../a2ui/types';
import { renderA2UITranscriptContent } from './a2uiTranscriptLite';

export interface OperatorA2UITranscriptLiteProps {
  envelopes: readonly A2UIEnvelope[];
  messageId: string;
}

/** Lightweight A2UI transcript blocks for the operator embed (no SpecRenderer). */
export function OperatorA2UITranscriptLite({
  envelopes,
  messageId,
}: OperatorA2UITranscriptLiteProps): ReactElement {
  const outcome = useMemo(() => renderA2UITranscriptContent(envelopes), [envelopes]);

  if (!outcome.ok) {
    return (
      <div part="a2ui-error" role="alert" data-testid={`operator-a2ui-error-${messageId}`}>
        {outcome.message}
      </div>
    );
  }

  return (
    <div
      part="a2ui-content"
      className="operator-a2ui-content"
      data-testid={`operator-a2ui-content-${messageId}`}
    >
      {outcome.blocks.map((block) => (
        <div key={block.id} part="a2ui-block" className="a2ui-block" data-a2ui-block-id={block.id}>
          <p part="a2ui-block-title" className="a2ui-block-title">
            {block.title}
          </p>
          {block.subtitle ? (
            <p part="a2ui-block-subtitle" className="a2ui-block-subtitle">
              {block.subtitle}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
