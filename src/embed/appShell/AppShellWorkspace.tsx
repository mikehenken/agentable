/**
 * React tree behind `<agentable-app-shell>`. Mounts the DOM
 * workspace engine (`engine="dom"`, regions + splits + tabs, `camera:
 * none`) with the unmodified career-pack `PanelDefinition`s split across
 * the `main` and `sidebar` regions, restores a previously saved layout
 * from storage when one exists, and persists layout changes back.
 *
 * Deliberately does not import `createCanvasHost` (`../../panels/host`):
 * this workspace only needs panel lookup, spec validation, and the shared
 * data lifecycle, so it wires those three pieces directly and skips the
 * agent/tool/approval runtime this example never uses.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  createDomEngine,
  DomWorkspaceShell,
  type DomEngineHandle,
  type DomPanelRecord,
} from '../../engines/dom';
import { createPanelRegistry } from '../../panels/registry';
import { validateSpec, defaultCatalog, type NormalizedPanelSpec } from '../../panels/spec';
import { SpecRenderer, createDataLifecycle, type DataLifecycle } from '../../panels/renderer';
import { t } from '../../i18n';
import { createCareerPanelDefinitions } from '../../../packages/career-pack/src/panels';
import { createStaticCareerAdapter } from '../../../packages/career-pack/src/adapters/staticCareerAdapter';
import { MINIMAL_CAREER_DATASET } from '../../../packages/career-pack/src/fixtures/minimal-dataset';
import { CAREER_SOURCE_NAMES } from '../../../packages/career-pack/src/constants';
import {
  appShellStorageKey,
  buildDefaultAppShellPlacements,
  loadStoredAppShellLayout,
  saveAppShellLayout,
  type AppShellStorageLike,
} from './appShellLayout';

/** Debounce window for layout persistence; matches the host's own save debounce. */
const LAYOUT_SAVE_DEBOUNCE_MS = 400;

export interface AppShellWorkspaceReadyDetail {
  tenant: string;
  /** True when an existing saved layout was restored; false when defaults were placed. */
  restored: boolean;
}

export interface AppShellWorkspaceProps {
  tenant: string;
  locale: string;
  /** URL to a career dataset JSON document; empty string falls back to the built-in fixture. */
  careerDataUrl: string;
  /** Injectable storage seam; defaults to `window.localStorage`. Overridable for tests. */
  storage?: AppShellStorageLike;
  onReady?: (detail: AppShellWorkspaceReadyDetail) => void;
}

function resolvePanelTitle(title: string): string {
  if (title.startsWith('career.') || title.startsWith('agents.') || title.startsWith('chrome.')) {
    return t(title as Parameters<typeof t>[0]);
  }
  return title;
}

function PanelUnavailable({ reason }: { reason: string }): ReactElement {
  return (
    <div
      role="alert"
      data-testid="app-shell-panel-error"
      style={{ padding: 16, fontSize: 13, color: 'var(--landi-color-text-muted, #6B6B66)' }}
    >
      {reason}
    </div>
  );
}

export function AppShellWorkspace({
  tenant,
  locale,
  careerDataUrl,
  storage,
  onReady,
}: AppShellWorkspaceProps): ReactElement {
  const [engine] = useState<DomEngineHandle>(() => createDomEngine());
  const storageRef = useRef<AppShellStorageLike>(
    storage ?? (typeof window !== 'undefined' ? window.localStorage: createNoopStorage()));
  const tenantRef = useRef(tenant);
  tenantRef.current = tenant;

  const definitions = useMemo(() => createCareerPanelDefinitions(), []);
  const registry = useMemo(() => createPanelRegistry(definitions), [definitions]);

  const adapter = useMemo(() =>
      createStaticCareerAdapter(careerDataUrl.trim().length > 0 ? { url: careerDataUrl }: MINIMAL_CAREER_DATASET, {
        persistenceKey: tenant || 'default',
      }),
     // Recreated only when the data source itself changes; `tenant` only
     // namespaces the adapter's own localStorage prefix at construction time.
     // eslint-disable-next-line react-hooks/exhaustive-deps
    [careerDataUrl]);

  const lifecycle: DataLifecycle = useMemo(() => createDataLifecycle({ adapter }),
    [adapter]);

  useEffect(() => () => lifecycle.dispose(), [lifecycle]);

  useEffect(() => () => engine.destroy(), [engine]);

  const adapterSources = useMemo(() => new Set<string>(CAREER_SOURCE_NAMES), []);
  const registeredPanelIds = useMemo(() => new Set(registry.ids), [registry]);

  /** Validated once per definition set; specs are static, so this never needs to re-run. */
  const normalizedSpecs = useMemo(() => {
    const specs = new Map<string, NormalizedPanelSpec>();
    const errors = new Map<string, string>();
    for (const definition of definitions) {
      if (definition.kind !== 'spec') continue;
      const validation = validateSpec(definition.spec, {
        catalog: defaultCatalog,
        adapterSources,
        hostActions: new Set(),
        panelRegistry: registeredPanelIds,
      });
      if (validation.ok) {
        specs.set(definition.id, validation.spec);
      } else {
        errors.set(definition.id, validation.errors.map((issue) => issue.message).join('; '));
      }
    }
    return { specs, errors };
  }, [definitions, adapterSources, registeredPanelIds]);

  useEffect(() => {
    const key = appShellStorageKey(tenantRef.current);
    const stored = loadStoredAppShellLayout(storageRef.current, key);
    let restored = false;

    if (stored !== null) {
      engine.importSnapshot(stored);
      restored = true;
    } else {
      for (const placement of buildDefaultAppShellPlacements()) {
        engine.openPanel?.(placement);
      }
      // `openPanel` sets the region's active tab to whichever panel it just
      // placed, so after seeding the region the active tab is the *last*
      // panel placed rather than the first; reset both regions to their
      // first tab so the primary panel is the one shown on first paint.
      engine.setActiveTab('main', 0);
      engine.setActiveTab('sidebar', 0);
    }

    onReady?.({ tenant: tenantRef.current, restored });
    // Intentionally engine-only: this seeds or restores the workspace once
    // per engine instance. Live tenant/storage swaps mid-session are out of
     // scope for this gallery example (see implementation log).
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  useEffect(() => {
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    const flush = (): void => {
      saveTimer = null;
      const key = appShellStorageKey(tenantRef.current);
      saveAppShellLayout(storageRef.current, key, engine.exportSnapshot());
    };
    const unsubscribe = engine.on('change', () => {
      if (saveTimer !== null) clearTimeout(saveTimer);
      saveTimer = setTimeout(flush, LAYOUT_SAVE_DEBOUNCE_MS);
    });
    return () => {
      unsubscribe();
      if (saveTimer !== null) {
        clearTimeout(saveTimer);
        flush();
      }
    };
  }, [engine]);

  const resolvePanelLabel = useCallback(
    (panelId: string): string => {
      const definition = registry.get(panelId);
      if (definition === undefined) {
        return panelId;
      }
      return resolvePanelTitle(definition.meta.title);
    },
    [registry]);

  const renderPanel = useCallback(
    (panel: DomPanelRecord): ReactElement => {
      const definition = registry.get(panel.panelId);
      if (definition === undefined) {
        return (
          <PanelUnavailable
            key={panel.panelId}
            reason={`No panel registered for id "${panel.panelId}".`}
          />
        );
      }
      if (definition.kind !== 'spec') {
        return (
          <PanelUnavailable
            key={panel.panelId}
            reason={`Panel "${panel.panelId}" is not a schema panel; this example only renders spec-kind panels.`}
          />
        );
      }
      const spec = normalizedSpecs.specs.get(definition.id);
      if (spec === undefined) {
        return (
          <PanelUnavailable
            key={panel.panelId}
            reason={normalizedSpecs.errors.get(definition.id) ?? t('chrome.composed.invalid')}
          />
        );
      }
      return (
        <div
          key={panel.panelId}
          data-testid={`app-shell-panel-${panel.panelId}`}
          data-app-shell-panel-title={resolvePanelTitle(definition.meta.title)}
          data-app-shell-panel-region={panel.regionId}
          className="dom-app-shell-panel-body panel-shape__content h-full min-h-0"
          data-panel-interactive="true"
        >
          <div className="panel-shape__body min-h-0 flex-1">
            <SpecRenderer
              spec={spec}
              scope={{}}
              lifecycle={lifecycle}
              bodyScroll={definition.meta.bodyScroll ?? 'auto'}
            />
          </div>
        </div>
      );
    },
    [registry, normalizedSpecs, lifecycle]);

  return (
    <div
      className="agentable-app-shell__workspace h-full min-h-0 w-full"
      data-app-shell-tenant={tenant}
      data-app-shell-locale={locale}
    >
      <DomWorkspaceShell
        engine={engine}
        renderPanel={renderPanel}
        resolvePanelLabel={resolvePanelLabel}
      />
    </div>
  );
}

function createNoopStorage(): AppShellStorageLike {
  return {
    getItem: () => null,
    setItem: () => {},
  };
}
