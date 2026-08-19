import type { ParsedA2UIEnvelope } from './schema';
import type { A2UIComponent, A2UISurfaceState } from './types';
import { writeDataModelPath } from './dynamicValue';

export function createA2UISurfaceState(surfaceId: string): A2UISurfaceState {
  return {
    surfaceId,
    catalogId: null,
    deleted: false,
    components: new Map<string, A2UIComponent>(),
    dataModel: {},
  };
}

function mergeComponents(
  target: Map<string, A2UIComponent>,
  components: readonly A2UIComponent[],
): void {
  for (const component of components) {
    target.set(component.id, component);
  }
}

/** Apply one validated A2UI envelope to a surface accumulator. */
export function applyA2UIEnvelope(
  state: A2UISurfaceState,
  envelope: ParsedA2UIEnvelope,
): A2UISurfaceState {
  if (envelope.createSurface !== undefined) {
    const message = envelope.createSurface;
    if (message.surfaceId !== state.surfaceId) {
      return state;
    }
    state.catalogId = message.catalogId;
    state.deleted = false;
    if (message.components !== undefined) {
      mergeComponents(state.components, message.components);
    }
    if (message.dataModel !== undefined) {
      state.dataModel = { ...message.dataModel };
    }
    return state;
  }

  if (envelope.updateComponents !== undefined) {
    const message = envelope.updateComponents;
    if (message.surfaceId !== state.surfaceId) {
      return state;
    }
    mergeComponents(state.components, message.components);
    return state;
  }

  if (envelope.updateDataModel !== undefined) {
    const message = envelope.updateDataModel;
    if (message.surfaceId !== state.surfaceId) {
      return state;
    }
    state.dataModel = writeDataModelPath(state.dataModel, message.path, message.value);
    return state;
  }

  if (envelope.deleteSurface !== undefined) {
    if (envelope.deleteSurface.surfaceId === state.surfaceId) {
      state.deleted = true;
      state.components.clear();
      state.dataModel = {};
    }
  }

  return state;
}

/** Apply a stream of envelopes in order (JSONL ingestion). */
export function applyA2UIStream(
  initialSurfaceId: string,
  envelopes: readonly ParsedA2UIEnvelope[],
): A2UISurfaceState {
  const state = createA2UISurfaceState(initialSurfaceId);
  for (const envelope of envelopes) {
    applyA2UIEnvelope(state, envelope);
  }
  return state;
}

/** Extract surface id from the first envelope when not supplied by caller. */
export function inferSurfaceIdFromEnvelope(envelope: ParsedA2UIEnvelope): string | null {
  if (envelope.createSurface !== undefined) {
    return envelope.createSurface.surfaceId;
  }
  if (envelope.updateComponents !== undefined) {
    return envelope.updateComponents.surfaceId;
  }
  if (envelope.updateDataModel !== undefined) {
    return envelope.updateDataModel.surfaceId;
  }
  if (envelope.deleteSurface !== undefined) {
    return envelope.deleteSurface.surfaceId;
  }
  return null;
}

export function surfaceHasRoot(state: A2UISurfaceState): boolean {
  return state.components.has('root');
}
