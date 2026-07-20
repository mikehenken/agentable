/**
 * The block renderer (02 section 6). One renderer walks the validated
 * spec tree; the framework owns the data lifecycle around every source
 * binding: loading skeleton, error card with retry, empty state,
 * stale-banner when a remote change lands while dirty, and the save
 * lifecycle for mutate actions. Catalog components stay presentational;
 * they receive validated props plus `SpecNodeContextValue`.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { getI18n, t } from '../../i18n';
import {
  defaultCatalog,
  STREAMING_SKELETON_TYPE,
  UNKNOWN_NODE_PLACEHOLDER_TYPE,
  type NormalizedPanelSpec,
} from '../spec';
import type { CatalogEntry, PanelScope, SpecNodeContextValue } from '../types';
import { evaluateShowIf, resolveSourceParams, showIfDataSources } from './bindings';
import type {
  AdapterError,
  DataLifecycle,
  DeclaredAction,
  SourceBindingHandle,
  SourceRef,
  SourceSnapshot,
} from './types';

export interface SpecRendererProps {
  /** A spec that already passed `validateSpec`; the renderer trusts its shape. */
  spec: NormalizedPanelSpec;
  scope: PanelScope;
  /** Shared per-host store from `createDataLifecycle`. */
  lifecycle: DataLifecycle;
  /** Defaults to the v1 catalog. */
  catalog?: ReadonlyMap<string, CatalogEntry>;
  onHostAction?: (action: string, payload?: Record<string, unknown>) => void;
  onOpenPanel?: (panelId: string, scopeFrom?: string) => void;
  onPrompt?: (prompt: string) => void;
}

interface RendererContextValue {
  spec: NormalizedPanelSpec;
  scope: PanelScope;
  catalog: ReadonlyMap<string, CatalogEntry>;
  lifecycle: DataLifecycle;
  onHostAction?: (action: string, payload?: Record<string, unknown>) => void;
  onOpenPanel?: (panelId: string, scopeFrom?: string) => void;
  onPrompt?: (prompt: string) => void;
}

const RendererContext = createContext<RendererContextValue | null>(null);

function useRendererContext(): RendererContextValue {
  const value = useContext(RendererContext);
  if (value === null) {
    throw new Error('SpecNodeView must render inside SpecRenderer');
  }
  return value;
}

interface NamedSourceRef {
  name: string;
  ref: SourceRef;
}

/**
 * Acquire every source ref a node depends on for exactly the mounted
 * lifetime, and re-render when any of them changes. The external-store
 * snapshot is the joined per-entry version string, so identical versions
 * never re-render and the per-entry `SourceSnapshot` objects (read via
 * `peek` during render) stay identity-stable.
 */
function useNodeSources(
  refs: readonly NamedSourceRef[],
  scope: PanelScope,
  lifecycle: DataLifecycle,
): React.RefObject<ReadonlyMap<string, SourceBindingHandle>> {
  const handlesRef = useRef<ReadonlyMap<string, SourceBindingHandle>>(new Map());

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const acquired = refs.map((entry) => ({
        name: entry.name,
        handle: lifecycle.acquire(entry.ref, scope),
      }));
      handlesRef.current = new Map(acquired.map((entry) => [entry.name, entry.handle]));
      const unsubscribes = acquired.map((entry) => entry.handle.subscribe(onStoreChange));
      // Acquisition itself may have started fetches before listeners were
      // attached; force one sync so the first snapshot is current.
      onStoreChange();
      return () => {
        for (const unsubscribe of unsubscribes) unsubscribe();
        for (const entry of acquired) entry.handle.release();
        handlesRef.current = new Map();
      };
    },
    [refs, scope, lifecycle],
  );

  const getVersionKey = useCallback(
    () => refs.map((entry) => lifecycle.getVersion(entry.ref, scope)).join('|'),
    [refs, scope, lifecycle],
  );

  useSyncExternalStore(subscribe, getVersionKey);
  return handlesRef;
}

function isEmptyData(data: unknown): boolean {
  if (data === null || data === undefined) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === 'object') return Object.keys(data).length === 0;
  return false;
}

function deriveNodeState(
  snapshot: SourceSnapshot | null,
  saving: boolean,
  selfDirty: boolean,
): SpecNodeContextValue['state'] {
  if (saving) return 'saving';
  if (snapshot !== null) {
    if (snapshot.status === 'idle' || snapshot.status === 'loading') return 'loading';
    if (snapshot.status === 'error') return 'error';
    if (snapshot.stale) return 'stale';
  }
  if (selfDirty) return 'dirty';
  if (snapshot !== null && isEmptyData(snapshot.data)) return 'empty';
  return 'populated';
}

function UnsupportedBlock({ nodeId, type }: { nodeId: string; type: string }): React.ReactElement {
  return (
    <div data-testid="unsupported-block" data-renderer-node={nodeId} role="note">
      {t('renderer.unsupportedBlock', { type })}
    </div>
  );
}

export function SpecNodeView({ nodeId }: { nodeId: string }): React.ReactElement | null {
  const renderer = useRendererContext();
  const { spec, scope, catalog, lifecycle } = renderer;
  const node = spec.nodes[nodeId];
  const ownerId = useId();
  const [selfDirty, setSelfDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mutationError, setMutationError] = useState<AdapterError | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const bindName = useMemo(() => {
    const candidate = node?.props?.bind;
    return typeof candidate === 'string' && spec.sources?.[candidate] !== undefined
      ? candidate
      : null;
  }, [node, spec.sources]);

  const namedRefs = useMemo<readonly NamedSourceRef[]>(() => {
    const names = new Set<string>();
    if (bindName !== null) names.add(bindName);
    for (const sourceName of showIfDataSources(node?.showIf)) {
      if (spec.sources?.[sourceName] !== undefined) names.add(sourceName);
    }
    return [...names].map((name) => {
      const binding = spec.sources![name];
      const params = resolveSourceParams(binding.params, scope);
      return {
        name,
        ref: { source: binding.source, ...(params !== undefined ? { params } : {}) },
      };
    });
    // scope participates through its two closed keys only.
  }, [bindName, node, spec.sources, scope]);

  const handlesRef = useNodeSources(namedRefs, scope, lifecycle);

  const snapshotFor = useCallback(
    (name: string): SourceSnapshot | null => {
      const entry = namedRefs.find((candidate) => candidate.name === name);
      return entry === undefined ? null : lifecycle.peek(entry.ref, scope);
    },
    [namedRefs, lifecycle, scope],
  );

  const snapshot = bindName !== null ? snapshotFor(bindName) : null;

  const setDirty = useCallback(
    (dirty: boolean) => {
      setSelfDirty(dirty);
      if (bindName !== null) {
        handlesRef.current.get(bindName)?.setDirty(ownerId, dirty);
      }
    },
    [bindName, handlesRef, ownerId],
  );

  const runMutation = useCallback(
    async (action: DeclaredAction, payload?: Record<string, unknown>) => {
      setSaving(true);
      setMutationError(null);
      const result = await lifecycle.mutate(action, payload ?? null, scope);
      if (!mountedRef.current) return;
      setSaving(false);
      if (result.ok) {
        setDirty(false);
        // Pull fresh server state after a save. Refetch the node's own
        // binding silently when it reads the mutated source; anything
        // else mounted against that source goes through invalidate.
        const ownHandle = bindName !== null ? handlesRef.current.get(bindName) : undefined;
        const ownBinding = bindName !== null ? spec.sources?.[bindName] : undefined;
        if (ownHandle !== undefined && ownBinding?.source === action.source) {
          void ownHandle.refetch();
        } else {
          lifecycle.invalidate(action.source, scope);
        }
      } else {
        setMutationError(result.error);
      }
    },
    [lifecycle, scope, setDirty, bindName, handlesRef, spec.sources],
  );

  const dispatch = useCallback(
    (actionRef: string, payload?: Record<string, unknown>) => {
      const action = spec.actions?.[actionRef];
      if (action === undefined) {
        console.warn(`[SpecRenderer] dispatch of undeclared action "${actionRef}" ignored`);
        return;
      }
      switch (action.kind) {
        case 'mutate':
          void runMutation(action, payload);
          break;
        case 'host':
          renderer.onHostAction?.(action.action, payload);
          break;
        case 'panel':
          renderer.onOpenPanel?.(action.panelId, action.scopeFrom);
          break;
        case 'prompt':
          renderer.onPrompt?.(action.prompt);
          break;
      }
    },
    [spec.actions, runMutation, renderer],
  );

  const state = deriveNodeState(snapshot, saving, selfDirty);

  const context = useMemo<SpecNodeContextValue>(
    () => ({
      scope,
      data: bindName !== null ? { [bindName]: snapshot?.data } : {},
      dispatch,
      isDirty: selfDirty,
      setDirty,
      state,
    }),
    [scope, bindName, snapshot, dispatch, selfDirty, setDirty, state],
  );

  if (node === undefined) return null;

  const visible = evaluateShowIf(node.showIf, {
    scope,
    state: spec.state ?? {},
    sourceData: (sourceName) => snapshotFor(sourceName)?.data,
  });
  if (!visible) return null;

  if (node.type === STREAMING_SKELETON_TYPE) {
    // D40 streaming hydration: this node was referenced by an arrived
    // parent but has not streamed in yet. Paint a skeleton in its slot;
    // the real node replaces it in place when its chunk lands.
    return (
      <div
        data-testid="streaming-skeleton"
        data-renderer-node={nodeId}
        role="status"
        aria-busy="true"
      />
    );
  }

  if (node.type === UNKNOWN_NODE_PLACEHOLDER_TYPE) {
    const originalType =
      typeof node.props?.originalType === 'string' ? node.props.originalType : 'unknown';
    return <UnsupportedBlock nodeId={nodeId} type={originalType} />;
  }

  const entry = catalog.get(node.type);
  if (entry === undefined) {
    return <UnsupportedBlock nodeId={nodeId} type={node.type} />;
  }

  const Component = entry.component as React.ComponentType<Record<string, unknown>>;
  const children = node.children?.map((childId) => (
    <SpecNodeView key={childId} nodeId={childId} />
  ));

  const refetch = (): void => {
    if (bindName !== null) {
      void handlesRef.current.get(bindName)?.refetch();
    }
  };

  return (
    <div data-renderer-node={nodeId} data-renderer-type={node.type}>
      {snapshot?.stale === true && (
        <div data-testid="renderer-stale-banner" role="status">
          <span>{t('renderer.stale.message')}</span>
          <button type="button" data-testid="renderer-stale-refresh" onClick={refetch}>
            {t('renderer.stale.refresh')}
          </button>
        </div>
      )}
      <Component {...(node.props ?? {})} context={context}>
        {children}
      </Component>
      {snapshot?.status === 'error' && (
        <div data-testid="renderer-error-card" role="alert">
          <span data-testid="renderer-error-message">
            {snapshot.error?.message ?? t('renderer.error.fallback')}
          </span>
          <button type="button" data-testid="renderer-retry" onClick={refetch}>
            {t('renderer.error.retry')}
          </button>
        </div>
      )}
      {mutationError !== null && (
        <div data-testid="renderer-mutation-error" role="alert">
          {mutationError.message}
        </div>
      )}
    </div>
  );
}

export function SpecRenderer(props: SpecRendererProps): React.ReactElement {
  const { spec, scope, lifecycle, onHostAction, onOpenPanel, onPrompt } = props;
  const catalog = props.catalog ?? defaultCatalog;

  const value = useMemo<RendererContextValue>(
    () => ({
      spec,
      scope,
      catalog,
      lifecycle,
      onHostAction,
      onOpenPanel,
      onPrompt,
    }),
    [spec, scope, catalog, lifecycle, onHostAction, onOpenPanel, onPrompt],
  );

  // D42 layout contract: the renderer root carries the resolved locale's
  // text direction, so the CSS logical properties used by chrome and
  // catalog styles flow RTL/LTR without per-component fixes.
  return (
    <RendererContext.Provider value={value}>
      <div data-testid="spec-renderer-root" dir={getI18n().direction}>
        <SpecNodeView nodeId={spec.root} />
      </div>
    </RendererContext.Provider>
  );
}
