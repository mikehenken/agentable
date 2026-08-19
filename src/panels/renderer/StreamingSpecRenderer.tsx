/**
 * React binding for a streaming spec session. Subscribes to the
 * session with `useSyncExternalStore` and renders the current partial
 * (or final) spec through the one block renderer, so streamed and
 * one-shot feeds share every rendering code path. Before the envelope
 * yields a renderable partial, an awaiting placeholder paints; once the
 * stream completes, the output is exactly `SpecRenderer` over the
 * one-shot validated spec.
 */
import React from 'react';
import { SpecRenderer, type SpecRendererProps } from './SpecRenderer';
import type { StreamingSpecSession } from './streaming';
import { useStreamingSpec } from './useStreamingSpec';

export interface StreamingSpecRendererProps extends Omit<SpecRendererProps, 'spec'> {
  session: StreamingSpecSession;
}

export function StreamingSpecRenderer(props: StreamingSpecRendererProps): React.ReactElement {
  const { session, ...rendererProps } = props;
  const snapshot = useStreamingSpec(session);

  if (snapshot.spec === null) {
    return (
      <div data-testid="streaming-awaiting-envelope" role="status" aria-busy="true" />
    );
  }

  return <SpecRenderer spec={snapshot.spec} {...rendererProps} />;
}
