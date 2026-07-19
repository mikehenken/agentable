/**
 * Streaming spec session protocol (D40/D56): envelope-first ordering,
 * skeleton substitution for referenced-but-missing nodes, idempotent
 * duplicate handling, gap rejection with a resume seq, interruption
 * state, and terminal byte-identity with the one-shot validation of
 * the same spec.
 */
import { describe, expect, it } from 'vitest';
import {
  createStreamingSpecSession,
  specToStreamChunks,
  type SpecStreamChunk,
} from '../../src/panels/renderer';
import {
  defaultCatalog,
  STREAMING_SKELETON_TYPE,
  validateSpec,
  type SpecValidationContext,
} from '../../src/panels/spec';
import type { PanelSpec } from '../../src/panels/types';

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
  sources: { jobs: { source: 'career.jobs' } },
  state: { mode: 'advanced' },
  nodes: {
    body: { type: 'panel-body', children: ['header', 'list', 'badge'] },
    header: { type: 'header', props: { title: 'Jobs', subtitle: 'Open roles' } },
    list: { type: 'list', props: { bind: 'jobs', row: { title: 'title' } } },
    badge: {
      type: 'badge',
      props: { text: 'Advanced' },
      showIf: { $eq: ['$state.mode', 'advanced'] },
    },
  },
  actions: { save: { kind: 'mutate', source: 'career.jobs', op: 'update' } },
};

function chunksOf(spec: PanelSpec): SpecStreamChunk[] {
  return specToStreamChunks(spec);
}

function oneShotJson(spec: PanelSpec): string {
  const result = validateSpec(spec, VALIDATION);
  if (!result.ok) throw new Error('fixture spec must validate');
  return JSON.stringify(result.spec);
}

describe('createStreamingSpecSession protocol', () => {
  it('rejects node and end chunks before the envelope', () => {
    const session = createStreamingSpecSession({ validation: VALIDATION });
    const nodeResult = session.applyChunk({
      kind: 'node',
      seq: 0,
      nodeId: 'body',
      node: { type: 'panel-body' },
    });
    expect(nodeResult).toMatchObject({ applied: false, reason: 'protocol', nextSeq: 0 });

    const endResult = session.applyChunk({ kind: 'end', seq: 0 });
    expect(endResult).toMatchObject({ applied: false, reason: 'protocol', nextSeq: 0 });
    expect(session.getSnapshot().phase).toBe('idle');
    expect(session.getSnapshot().spec).toBeNull();
  });

  it('rejects a second envelope', () => {
    const session = createStreamingSpecSession({ validation: VALIDATION });
    const chunks = chunksOf(FULL_SPEC);
    const envelopeChunk = chunks[0]!;
    if (envelopeChunk.kind !== 'envelope') throw new Error('first chunk must be the envelope');
    expect(session.applyChunk(envelopeChunk)).toMatchObject({ applied: true });
    const again = session.applyChunk({ ...envelopeChunk, seq: 1 });
    expect(again).toMatchObject({ applied: false, reason: 'protocol' });
  });

  it('substitutes skeletons for the root and for referenced-but-missing children', () => {
    const session = createStreamingSpecSession({ validation: VALIDATION });
    const chunks = chunksOf(FULL_SPEC);

    session.applyChunk(chunks[0]!);
    let snapshot = session.getSnapshot();
    expect(snapshot.phase).toBe('streaming');
    expect(snapshot.pendingNodeIds).toEqual(['body']);
    expect(snapshot.spec?.nodes.body?.type).toBe(STREAMING_SKELETON_TYPE);

    session.applyChunk(chunks[1]!);
    snapshot = session.getSnapshot();
    expect(snapshot.spec?.nodes.body?.type).toBe('panel-body');
    expect([...snapshot.pendingNodeIds].sort()).toEqual(['badge', 'header', 'list']);
    expect(snapshot.spec?.nodes.header?.type).toBe(STREAMING_SKELETON_TYPE);
    expect(snapshot.spec?.nodes.list?.type).toBe(STREAMING_SKELETON_TYPE);
    expect(snapshot.spec?.nodes.badge?.type).toBe(STREAMING_SKELETON_TYPE);

    session.applyChunk(chunks[2]!);
    snapshot = session.getSnapshot();
    expect(snapshot.spec?.nodes.header?.type).toBe('header');
    expect([...snapshot.pendingNodeIds].sort()).toEqual(['badge', 'list']);
  });

  it('acknowledges replayed chunks as duplicates without changing state', () => {
    const session = createStreamingSpecSession({ validation: VALIDATION });
    const chunks = chunksOf(FULL_SPEC);
    session.applyChunk(chunks[0]!);
    session.applyChunk(chunks[1]!);
    const before = session.getSnapshot();

    const replayEnvelope = session.applyChunk(chunks[0]!);
    const replayNode = session.applyChunk(chunks[1]!);
    expect(replayEnvelope).toMatchObject({ applied: false, reason: 'duplicate', nextSeq: 2 });
    expect(replayNode).toMatchObject({ applied: false, reason: 'duplicate', nextSeq: 2 });
    // Snapshot identity is unchanged: duplicates are pure no-ops.
    expect(session.getSnapshot()).toBe(before);
  });

  it('rejects a skipped chunk with the seq to resume from', () => {
    const session = createStreamingSpecSession({ validation: VALIDATION });
    const chunks = chunksOf(FULL_SPEC);
    session.applyChunk(chunks[0]!);
    const before = session.getSnapshot();

    const gap = session.applyChunk(chunks[3]!);
    expect(gap).toMatchObject({ applied: false, reason: 'gap', nextSeq: 1 });
    expect(session.getSnapshot()).toBe(before);
    expect(session.getResumeToken()).toEqual({ nextSeq: 1 });
  });

  it('reaches a terminal spec byte-identical to one-shot validation', () => {
    const session = createStreamingSpecSession({ validation: VALIDATION });
    for (const chunk of chunksOf(FULL_SPEC)) {
      expect(session.applyChunk(chunk)).toMatchObject({ applied: true });
    }
    const snapshot = session.getSnapshot();
    expect(snapshot.phase).toBe('complete');
    expect(snapshot.pendingNodeIds).toEqual([]);
    expect(snapshot.errors).toEqual([]);
    expect(JSON.stringify(snapshot.spec)).toBe(oneShotJson(FULL_SPEC));
  });

  it('keeps the last good partial when an invalid node arrives, then fails at end', () => {
    const badSpec: PanelSpec = {
      ...FULL_SPEC,
      nodes: {
        ...FULL_SPEC.nodes,
        // header.title is required by the catalog schema.
        header: { type: 'header', props: { subtitle: 'no title' } },
      },
    };
    const session = createStreamingSpecSession({ validation: VALIDATION });
    const chunks = chunksOf(badSpec);
    session.applyChunk(chunks[0]!);
    session.applyChunk(chunks[1]!);
    const goodPartial = session.getSnapshot().spec;
    expect(goodPartial?.nodes.header?.type).toBe(STREAMING_SKELETON_TYPE);

    const badApply = session.applyChunk(chunks[2]!);
    expect(badApply).toMatchObject({ applied: true });
    const afterBad = session.getSnapshot();
    expect(afterBad.phase).toBe('streaming');
    expect(afterBad.errors.map((issue) => issue.code)).toContain('SPEC_NODE_PROPS_INVALID');
    // The bad node never painted: the last good partial is still current.
    expect(afterBad.spec).toBe(goodPartial);

    session.applyChunk(chunks[3]!);
    session.applyChunk(chunks[4]!);
    session.applyChunk(chunks[5]!);
    const terminal = session.getSnapshot();
    expect(terminal.phase).toBe('failed');
    expect(terminal.errors.map((issue) => issue.code)).toContain('SPEC_NODE_PROPS_INVALID');
  });

  it('marks interruption, keeps the partial, and resumes through duplicate replay', () => {
    const session = createStreamingSpecSession({ validation: VALIDATION });
    const chunks = chunksOf(FULL_SPEC);
    session.applyChunk(chunks[0]!);
    session.applyChunk(chunks[1]!);
    session.applyChunk(chunks[2]!);

    session.notifyInterrupted();
    const interrupted = session.getSnapshot();
    expect(interrupted.phase).toBe('interrupted');
    expect(interrupted.spec?.nodes.header?.type).toBe('header');

    // A reconnecting producer resends from an earlier point; overlap is
    // absorbed as duplicates and the tail applies cleanly.
    const resumeFrom = 1;
    for (const chunk of chunks.slice(resumeFrom)) {
      const result = session.applyChunk(chunk);
      if (chunk.seq < interrupted.nextSeq) {
        expect(result).toMatchObject({ applied: false, reason: 'duplicate' });
      } else {
        expect(result).toMatchObject({ applied: true });
      }
    }
    const terminal = session.getSnapshot();
    expect(terminal.phase).toBe('complete');
    expect(JSON.stringify(terminal.spec)).toBe(oneShotJson(FULL_SPEC));
  });

  it('rejects chunks after completion as closed', () => {
    const session = createStreamingSpecSession({ validation: VALIDATION });
    const chunks = chunksOf(FULL_SPEC);
    for (const chunk of chunks) session.applyChunk(chunk);
    const late = session.applyChunk({ kind: 'end', seq: chunks.length });
    expect(late).toMatchObject({ applied: false, reason: 'closed' });
  });
});

describe('specToStreamChunks', () => {
  it('emits envelope, one chunk per node, then end, with contiguous seqs', () => {
    const chunks = chunksOf(FULL_SPEC);
    expect(chunks).toHaveLength(2 + Object.keys(FULL_SPEC.nodes).length);
    expect(chunks[0]?.kind).toBe('envelope');
    expect(chunks[chunks.length - 1]?.kind).toBe('end');
    chunks.forEach((chunk, index) => {
      expect(chunk.seq).toBe(index);
    });
  });

  it('throws on a nodeOrder id that is not in the spec', () => {
    expect(() => specToStreamChunks(FULL_SPEC, { nodeOrder: ['missing'] })).toThrow(
      /not in spec\.nodes/,
    );
  });
});
