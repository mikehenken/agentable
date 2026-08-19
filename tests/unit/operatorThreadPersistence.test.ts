/**
 * — operator thread localStorage persistence.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearOperatorThreadPersistenceForTests,
  loadOperatorThreadState,
  persistOperatorThreadState,
} from '../../src/agents/surface/operatorThreadPersistence';
import type { OperatorThread } from '../../src/agents/surface/types';

describe('operatorThreadPersistence ', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<agentable-whiteboard tenant="meridian-labs"></agentable-whiteboard>';
    clearOperatorThreadPersistenceForTests('meridian-labs');
  });

  afterEach(() => {
    clearOperatorThreadPersistenceForTests('meridian-labs');
    document.body.innerHTML = '';
  });

  it('persists and reloads threads for the whiteboard tenant', () => {
    const threads: OperatorThread[] = [
      {
        id: 'thread_a',
        title: 'Alpha',
        messages: [
          {
            id: 'm1',
            role: 'user',
            kind: 'text',
            text: 'Persist me',
            timestamp: '2026-07-23T00:00:00.000Z',
          },
        ],
      },
      {
        id: 'thread_b',
        title: 'Beta',
        messages: [],
      },
    ];

    persistOperatorThreadState(threads, 'thread_b');
    const loaded = loadOperatorThreadState;

    expect(loaded().activeThreadId).toBe('thread_b');
    expect(loaded().threads).toHaveLength(2);
    expect(loaded().threads[0]?.messages[0]?.kind).toBe('text');
    if (loaded().threads[0]?.messages[0]?.kind === 'text') {
      expect(loaded().threads[0].messages[0].text).toBe('Persist me');
    }
  });
});
