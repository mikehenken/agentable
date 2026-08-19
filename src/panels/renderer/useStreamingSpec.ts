/**
 * Subscribe a React tree to a streaming spec session. Snapshot
 * identity is stable between chunks, so re-renders happen exactly when
 * the session accepts a chunk or changes phase.
 */
import { useSyncExternalStore } from 'react';
import type { StreamingSpecSession, StreamingSpecSnapshot } from './streaming';

export function useStreamingSpec(session: StreamingSpecSession): StreamingSpecSnapshot {
  return useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
}
