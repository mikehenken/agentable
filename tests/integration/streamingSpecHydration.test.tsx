/**
 * P1-T6 automated checks (D40 streaming hydration, D56 resilience):
 *
 * 1. Progressive paint: a chunked IR feed paints content as chunks
 *    arrive. Arrived nodes render for real while pending siblings show
 *    streaming skeletons, and the painted set grows monotonically until
 *    the terminal DOM is byte-identical to a one-shot `SpecRenderer`
 *    render of the same validated spec.
 * 2. Dropped-then-resumed convergence: a feed interrupted mid-stream
 *    resumes through the seq protocol (overlap replay absorbed as
 *    duplicates) and converges to the same terminal DOM as the one-shot
 *    render, without a full re-render: DOM elements painted before the
 *    drop keep their identity through resume and completion.
 */
import React from 'react';
import { act, render, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  createDataLifecycle,
  createStreamingSpecSession,
  specToStreamChunks,
  SpecRenderer,
  StreamingSpecRenderer,
  type DataLifecycle,
  type SpecStreamChunk,
  type StreamingSpecSession,
} from '../../src/panels/renderer';
import { defaultCatalog, validateSpec, type SpecValidationContext } from '../../src/panels/spec';
import type { PanelScope, PanelSpec } from '../../src/panels/types';
import { createMockDataAdapter, type MockDataAdapter } from '../helpers/mockDataAdapter';

const SCOPE: PanelScope = { contextId: 'site-1', entityId: 'page-1' };

const VALIDATION: SpecValidationContext = {
  catalog: defaultCatalog,
  adapterSources: new Set(['career.jobs']),
  hostActions: new Set(),
  panelRegistry: new Set(),
};

const FULL_SPEC: PanelSpec = {
  v: 1,
  origin: 'agent',
  root: 'body',
  sources: { jobs: { source: 'career.jobs', params: { track: '$scope.entityId' } } },
  state: { mode: 'advanced' },
  nodes: {
    body: { type: 'panel-body', children: ['header', 'list', 'actions', 'badge'] },
    header: { type: 'header', props: { title: 'Jobs', subtitle: 'Open roles' } },
    list: { type: 'list', props: { bind: 'jobs', row: { title: 'title' }, search: true } },
    actions: { type: 'action-row', props: { actions: ['save'] } },
    badge: {
      type: 'badge',
      props: { text: 'Advanced' },
      showIf: { $eq: ['$state.mode', 'advanced'] },
    },
  },
  actions: { save: { kind: 'mutate', source: 'career.jobs', op: 'update' } },
};

/** Fixed query results so streamed and one-shot renders see identical data. */
function fixedPlanAdapter(): MockDataAdapter {
  return createMockDataAdapter({
    latencyMs: 5,
    plan: () => ({ data: [{ title: 'Field Guide' }] }),
  });
}

interface Harness {
  session: StreamingSpecSession;
  chunks: SpecStreamChunk[];
  container: HTMLElement;
  lifecycle: DataLifecycle;
  dispose: () => void;
}

function mountStreaming(): Harness {
  const session = createStreamingSpecSession({ validation: VALIDATION });
  const chunks = specToStreamChunks(FULL_SPEC);
  const adapter = fixedPlanAdapter();
  const lifecycle = createDataLifecycle({ adapter, retryBackoffMs: 5 });
  const view = render(
    <StreamingSpecRenderer session={session} scope={SCOPE} lifecycle={lifecycle} />,
  );
  return {
    session,
    chunks,
    container: view.container,
    lifecycle,
    dispose: () => {
      view.unmount();
      lifecycle.dispose();
    },
  };
}

async function oneShotHtml(): Promise<{ html: string; dispose: () => void }> {
  const result = validateSpec(FULL_SPEC, VALIDATION);
  if (!result.ok) throw new Error('fixture spec must validate');
  const adapter = fixedPlanAdapter();
  const lifecycle = createDataLifecycle({ adapter, retryBackoffMs: 5 });
  const view = render(<SpecRenderer spec={result.spec} scope={SCOPE} lifecycle={lifecycle} />);
  await waitUntilDataSettled(view.container);
  return {
    html: view.container.innerHTML,
    dispose: () => {
      view.unmount();
      lifecycle.dispose();
    },
  };
}

async function waitUntilDataSettled(container: HTMLElement): Promise<void> {
  await waitFor(() => {
    expect(container.querySelectorAll('[data-testid="loading-skeleton"]')).toHaveLength(0);
  });
}

function apply(session: StreamingSpecSession, chunk: SpecStreamChunk): void {
  act(() => {
    session.applyChunk(chunk);
  });
}

function streamingSkeletonCount(container: HTMLElement): number {
  return container.querySelectorAll('[data-testid="streaming-skeleton"]').length;
}

describe('streaming spec hydration: progressive paint', () => {
  it('paints arrived nodes progressively with skeletons for pending ones', async () => {
    const harness = mountStreaming();
    const { session, chunks, container } = harness;
    const scoped = within(container);

    // Before any chunk: nothing renderable yet.
    expect(scoped.getByTestId('streaming-awaiting-envelope')).toBeInTheDocument();

    // Envelope alone: the unarrived root paints as one skeleton.
    apply(session, chunks[0]!);
    expect(scoped.queryByTestId('streaming-awaiting-envelope')).not.toBeInTheDocument();
    expect(streamingSkeletonCount(container)).toBe(1);

    // Root node: the body renders for real; its four children pend.
    apply(session, chunks[1]!);
    expect(scoped.getByTestId('panel-body')).toBeInTheDocument();
    expect(streamingSkeletonCount(container)).toBe(4);

    // Header chunk: real header DOM paints while the stream is still
    // open and the remaining siblings stay skeletons. This is the
    // progressive-paint assertion: content is visible before `end`.
    apply(session, chunks[2]!);
    expect(scoped.getByTestId('header')).toBeInTheDocument();
    expect(scoped.getByTestId('header')).toHaveTextContent('Jobs');
    expect(streamingSkeletonCount(container)).toBe(3);
    expect(session.getSnapshot().phase).toBe('streaming');

    // List chunk: painted set grows monotonically; header stays up.
    apply(session, chunks[3]!);
    expect(scoped.getByTestId('header')).toBeInTheDocument();
    expect(scoped.getByTestId('list')).toBeInTheDocument();
    expect(streamingSkeletonCount(container)).toBe(2);

    // Remaining nodes plus end: no skeleton survives completion.
    apply(session, chunks[4]!);
    apply(session, chunks[5]!);
    apply(session, chunks[6]!);
    expect(session.getSnapshot().phase).toBe('complete');
    expect(streamingSkeletonCount(container)).toBe(0);

    await waitUntilDataSettled(container);
    const streamedHtml = container.innerHTML;
    expect(streamedHtml.length).toBeGreaterThan(0);

    // Terminal DOM is byte-identical to a one-shot render of the same spec.
    const oneShot = await oneShotHtml();
    expect(streamedHtml).toBe(oneShot.html);

    oneShot.dispose();
    harness.dispose();
  });
});

describe('streaming spec hydration: dropped-then-resumed convergence (D56)', () => {
  it('resumes an interrupted feed and converges to the one-shot DOM without remounting painted nodes', async () => {
    const harness = mountStreaming();
    const { session, chunks, container } = harness;
    const scoped = within(container);

    // Feed envelope + body + header, then drop the stream.
    apply(session, chunks[0]!);
    apply(session, chunks[1]!);
    apply(session, chunks[2]!);
    const headerBeforeDrop = scoped.getByTestId('header');
    const bodyBeforeDrop = scoped.getByTestId('panel-body');

    act(() => {
      session.notifyInterrupted();
    });
    expect(session.getSnapshot().phase).toBe('interrupted');
    // Painted DOM survives the drop.
    expect(scoped.getByTestId('header')).toBe(headerBeforeDrop);
    expect(streamingSkeletonCount(container)).toBe(3);

    // A producer that skips ahead is refused and told where to resume.
    const skipped = session.applyChunk(chunks[5]!);
    expect(skipped).toMatchObject({ applied: false, reason: 'gap', nextSeq: 3 });
    expect(session.getResumeToken()).toEqual({ nextSeq: 3 });

    // Resume with overlap from seq 1: replayed chunks are absorbed as
    // duplicates, the tail applies, and the stream completes.
    for (const chunk of chunks.slice(1)) {
      act(() => {
        const result = session.applyChunk(chunk);
        if (chunk.seq < 3) {
          expect(result).toMatchObject({ applied: false, reason: 'duplicate' });
        } else {
          expect(result).toMatchObject({ applied: true });
        }
      });
    }
    expect(session.getSnapshot().phase).toBe('complete');
    expect(streamingSkeletonCount(container)).toBe(0);

    // No full re-render across drop and resume: the exact DOM elements
    // painted before the interruption are still mounted.
    expect(scoped.getByTestId('header')).toBe(headerBeforeDrop);
    expect(scoped.getByTestId('panel-body')).toBe(bodyBeforeDrop);

    await waitUntilDataSettled(container);
    const resumedHtml = container.innerHTML;

    // Convergence: identical DOM to a one-shot complete feed.
    const oneShot = await oneShotHtml();
    expect(resumedHtml).toBe(oneShot.html);

    oneShot.dispose();
    harness.dispose();
  });

  it('converges even when the resume replays the entire feed from seq 0', async () => {
    const harness = mountStreaming();
    const { session, chunks, container } = harness;

    apply(session, chunks[0]!);
    apply(session, chunks[1]!);
    act(() => {
      session.notifyInterrupted();
    });

    // Worst-case producer: full replay from the beginning.
    for (const chunk of chunks) {
      apply(session, chunk);
    }
    expect(session.getSnapshot().phase).toBe('complete');

    await waitUntilDataSettled(container);
    const resumedHtml = container.innerHTML;
    const oneShot = await oneShotHtml();
    expect(resumedHtml).toBe(oneShot.html);

    oneShot.dispose();
    harness.dispose();
  });
});
