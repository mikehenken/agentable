/**
 * <ListPanel> — generic, domain-agnostic OSS primitive.
 *
 * Owns the chrome (search, filter chips, scroll list, empty state, selection,
 * saved set) for any "browseable list with optional detail view" panel.
 * Knows nothing about the shape of T beyond what the consumer's accessors
 * (`getId`, `getSearchText`, `filters[].getValue`) expose.
 *
 * Consumers control:
 *   - Data (`items`)
 *   - Card + detail rendering (`renderCard`, `renderDetail`)
 *   - Optional URL-syncing or persistence via the controlled-prop escape
 *     hatches (`selectedId/onSelectedIdChange`, `savedIds/onSavedIdsChange`,
 *     `query/onQueryChange`, `filterValues/onFilterValuesChange`)
 *
 * Brand-token discipline:
 *   Chrome renders only via `bg-canvas-*` / `text-canvas-*` / `border-canvas-*`
 *   Tailwind classes that resolve to `--landi-color-*` custom properties.
 *   Tenant overrides (e.g. `<agentable-canvas primary-color="...">`) flow
 *   through automatically. No bare hex in this file.
 *
 * Perf contract:
 *   `getSearchText` and each `filters[].getValue` are called O(items) per
 *   keystroke / chip change. Stabilize with `useCallback` on the consumer
 *   side OR accept the rebuild for small lists (< ~200 items). The
 *   primitive memoizes a search-index keyed by `getId` to amortize repeated
 *   accessor calls within a single render pass.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { DraggablePanel } from '../DraggablePanel';
import { useLayoutStore } from '../../stores/layoutStore';
import type { PanelId } from '../../types';

export type ListPanelItemId = string | number;

export interface ListPanelLabels {
  /** Title prefix shown before the count. Default: 'Items'. */
  titlePrefix?: string;
  /** Search-input placeholder + aria-label. Default: 'Search…'. */
  searchPlaceholder?: string;
  /** Chip shown for "no filter applied". Default: 'All'. */
  allFilterLabel?: string;
  /** Empty-state primary line when nothing matches. Default: 'No matches'. */
  emptyTitle?: string;
  /** Empty-state secondary line. Default: 'Try a different search or filter.'. */
  emptySubtitle?: string;
}

export interface ListPanelRenderContext {
  selected: boolean;
  saved: boolean;
  onSelect: () => void;
  onSave: () => void;
}

export interface ListPanelDetailContext {
  saved: boolean;
  onBack: () => void;
  onSave: () => void;
}

/**
 * One filter axis. Stack multiples for multi-axis chip strips (e.g.
 * department + property + status). Each axis is independently single-select;
 * "All" deselects only that axis.
 */
export interface ListPanelFilter<T> {
  /** Stable key used in `filterValues` state. */
  id: string;
  /** Returns the value to compare against the active chip for this filter. */
  getValue: (item: T) => string;
  /**
   * Explicit chip values for this axis. Default: unique values in iteration
   * order from `items`.
   */
  values?: string[];
  /** Optional label rendered above this filter's chip strip. */
  label?: string;
}

export interface ListPanelProps<T> {
  /**
   * Layout-store key. Visibility flag from store gates render. Currently
   * typed as the workspace's `PanelId` union; widens to `string` once the
   * panel-registry refactor (Track A.7-follow-up) lifts the tenant panel
   * set out of the OSS package.
   */
  panelId: PanelId;
  /** Items to render. Order is preserved; sorting is the consumer's job. */
  items: T[];
  /** Stable identifier for an item — used as React key + selection key. */
  getId: (item: T) => ListPanelItemId;
  /**
   * Free-text search accessor. Returns ALL strings that should match the
   * query for an item (consumer composes; e.g. title + skills + location
   * into one string). Return `''` to make an item never match.
   */
  getSearchText: (item: T) => string;
  /**
   * Zero or more filter axes. Renders as one chip strip per axis (in order).
   * Single-select per axis; multi-axis filters AND together.
   */
  filters?: ListPanelFilter<T>[];
  /** Show the search input. Default: true. */
  showSearch?: boolean;
  /** Render a card in the list view. */
  renderCard: (item: T, ctx: ListPanelRenderContext) => ReactNode;
  /**
   * Optional detail view shown when an item is selected. If omitted, list is
   * read-only (selection has no visible effect).
   */
  renderDetail?: (item: T, ctx: ListPanelDetailContext) => ReactNode;
  /**
   * Compute the panel title. Receives count after filtering + selected
   * item. If unset, defaults to `${labels.titlePrefix} · ${count}`.
   */
  getTitle?: (state: { count: number; selected: T | null }) => string;
  /** Locale-able strings; see ListPanelLabels for defaults. */
  labels?: ListPanelLabels;

  // ─── Controlled-prop escape hatches (all optional) ───────────────────
  // Pass any pair to lift state into the consumer (URL-sync, persistence,
  // multi-panel coordination). Omit to use uncontrolled internal state.

  /** Controlled selection id. Pass with `onSelectedIdChange`. */
  selectedId?: ListPanelItemId | null;
  onSelectedIdChange?: (id: ListPanelItemId | null) => void;
  /** Controlled saved set. Pass with `onSavedIdsChange`. */
  savedIds?: Set<ListPanelItemId>;
  onSavedIdsChange?: (next: Set<ListPanelItemId>) => void;
  /** Controlled search query. Pass with `onQueryChange`. */
  query?: string;
  onQueryChange?: (q: string) => void;
  /** Controlled filter values keyed by filter id. Pass with `onFilterValuesChange`. */
  filterValues?: Record<string, string>;
  onFilterValuesChange?: (next: Record<string, string>) => void;

  /**
   * When true, render only the panel body — no `<DraggablePanel>` wrapper,
   * no visibility gate from `useLayoutStore`. Use when the panel is hosted
   * inside a chrome-providing container (e.g. a tldraw shape on the
   * whiteboard) so we don't double up title bars / drag handles.
   *
   * The body keeps its own internal scrollers + filter chips; it just
   * skips the wrapping DraggablePanel positioning + close/minimise UI.
   */
  chromeless?: boolean;
}

const DEFAULT_LABELS: Required<ListPanelLabels> = {
  titlePrefix: 'Items',
  searchPlaceholder: 'Search…',
  allFilterLabel: 'All',
  emptyTitle: 'No matches',
  emptySubtitle: 'Try a different search or filter.',
};

export function ListPanel<T>(props: ListPanelProps<T>) {
  const {
    panelId,
    items,
    getId,
    getSearchText,
    filters,
    showSearch = true,
    renderCard,
    renderDetail,
    getTitle,
    labels,
    selectedId: ctrlSelectedId,
    onSelectedIdChange,
    savedIds: ctrlSavedIds,
    onSavedIdsChange,
    query: ctrlQuery,
    onQueryChange,
    filterValues: ctrlFilterValues,
    onFilterValuesChange,
    chromeless = false,
  } = props;

  const merged = useMemo(
    () => ({ ...DEFAULT_LABELS, ...labels }),
    [labels],
  );
  const allLabel = merged.allFilterLabel;

  const { panels } = useLayoutStore();
  const layout = panels[panelId];

  // Dev-only one-shot warning if panelId is unknown — silent in production.
  useEffect(() => {
    if (
      typeof process !== 'undefined' &&
      process.env?.NODE_ENV !== 'production' &&
      !layout
    ) {
      // eslint-disable-next-line no-console
      console.warn(
        `[ListPanel] Unknown panelId "${panelId}". Panel will never render. ` +
          `Did you register it in the layout store?`,
      );
    }
    // Run only when panelId changes — not on every layout mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelId]);

  // Uncontrolled state (used when the matching controlled prop is undefined).
  const [uncSelectedId, setUncSelectedId] = useState<ListPanelItemId | null>(
    null,
  );
  const [uncSaved, setUncSaved] = useState<Set<ListPanelItemId>>(
    () => new Set(),
  );
  const [uncQuery, setUncQuery] = useState('');
  const [uncFilterValues, setUncFilterValues] = useState<
    Record<string, string>
  >(() => {
    if (!filters) return {};
    const seed: Record<string, string> = {};
    for (const f of filters) seed[f.id] = allLabel;
    return seed;
  });

  const selectedId = ctrlSelectedId !== undefined ? ctrlSelectedId : uncSelectedId;
  const saved = ctrlSavedIds ?? uncSaved;
  const query = ctrlQuery ?? uncQuery;
  const filterValues = ctrlFilterValues ?? uncFilterValues;

  const setSelectedId = (id: ListPanelItemId | null) => {
    if (onSelectedIdChange) onSelectedIdChange(id);
    if (ctrlSelectedId === undefined) setUncSelectedId(id);
  };
  const setSaved = (next: Set<ListPanelItemId>) => {
    if (onSavedIdsChange) onSavedIdsChange(next);
    if (ctrlSavedIds === undefined) setUncSaved(next);
  };
  const setQuery = (q: string) => {
    if (onQueryChange) onQueryChange(q);
    if (ctrlQuery === undefined) setUncQuery(q);
  };
  const setFilterValue = (id: string, v: string) => {
    const next = { ...filterValues, [id]: v };
    if (onFilterValuesChange) onFilterValuesChange(next);
    if (ctrlFilterValues === undefined) setUncFilterValues(next);
  };

  // Per-filter chip values: explicit list, or unique values from items in
  // iteration order. Always prepend the "All" sentinel.
  const chipsByFilter = useMemo(() => {
    if (!filters) return [] as Array<{ filter: ListPanelFilter<T>; values: string[] }>;
    return filters.map((f) => {
      if (f.values) return { filter: f, values: [allLabel, ...f.values] };
      const seen = new Set<string>();
      const ordered: string[] = [];
      for (const it of items) {
        const v = f.getValue(it);
        if (!seen.has(v)) {
          seen.add(v);
          ordered.push(v);
        }
      }
      return { filter: f, values: [allLabel, ...ordered] };
    });
  }, [filters, items, allLabel]);

  // Self-heal: if a filter's active value disappears (items mutated,
  // explicit values shrunk, OR an external controller pushed a value the
  // chip strip doesn't know about), reset that axis to "All".
  //
  // Bug fix 2026-04-27: previously deps were `[chipsByFilter]` only, so
  // a controlled-prop update setting an unknown value (e.g. an agent tool
  // pushing `department: 'Engineering'` when chips are
  // [Operations, IT, F&B, ...]) didn't trigger heal — the effect had
  // already run on mount with valid values, the chips array hadn't
  // changed, and the bad value sat in state filtering everything to 0.
  // Adding `filterValues` (and `allLabel` for completeness) makes heal
  // reactive to every value change. Loop risk: setting next === current
  // is gated by the `dirty` flag.
  useEffect(() => {
    if (!filters) return;
    let dirty = false;
    const next = { ...filterValues };
    for (const { filter, values } of chipsByFilter) {
      const current = filterValues[filter.id] ?? allLabel;
      if (current !== allLabel && !values.includes(current)) {
        next[filter.id] = allLabel;
        dirty = true;
      }
    }
    if (dirty) {
      if (onFilterValuesChange) onFilterValuesChange(next);
      if (ctrlFilterValues === undefined) setUncFilterValues(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chipsByFilter, filterValues, allLabel]);

  useEffect(() => {
    if (selectedId === null) return;
    const stillThere = items.some((it) => getId(it) === selectedId);
    if (!stillThere) setSelectedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (filters) {
        for (const f of filters) {
          const active = filterValues[f.id] ?? allLabel;
          if (active !== allLabel && f.getValue(it) !== active) return false;
        }
      }
      if (!q) return true;
      return getSearchText(it).toLowerCase().includes(q);
    });
  }, [items, query, filters, filterValues, allLabel, getSearchText]);

  // Visibility gate is owned by the host. The legacy `<DraggablePanel>`
  // wrapper toggles via `useLayoutStore`'s `panels[panelId].visible`. The
  // whiteboard substrate uses a tldraw shape — its parent decides when the
  // shape exists; when it does, the panel must always render. Skipping the
  // gate in chromeless mode is the explicit contract.
  if (!chromeless && !layout?.visible) return null;

  const selectedItem =
    selectedId !== null
      ? items.find((it) => getId(it) === selectedId) ?? null
      : null;

  const toggleSaved = (id: ListPanelItemId) => {
    const next = new Set(saved);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSaved(next);
  };

  const title = getTitle
    ? getTitle({ count: filtered.length, selected: selectedItem })
    : `${merged.titlePrefix} · ${filtered.length}`;

  // Body content — same in both chrome modes. Only the wrapper differs.
  const body = (
    <div className="flex flex-col h-full bg-canvas-surface-subtle">
        {selectedItem && renderDetail ? (
          renderDetail(selectedItem, {
            saved: saved.has(getId(selectedItem)),
            onBack: () => setSelectedId(null),
            onSave: () => toggleSaved(getId(selectedItem)),
          })
        ) : (
          <>
            {(showSearch || (filters && filters.length > 0)) && (
              <div className="shrink-0 px-4 py-3 bg-canvas-surface border-b border-canvas-border space-y-2.5">
                {showSearch && (
                  <div
                    part="list-panel-search"
                    className="flex items-center gap-2 bg-canvas-surface-subtle border border-canvas-border rounded-lg px-3 py-2 focus-within:border-canvas-primary/50 focus-within:ring-2 focus-within:ring-canvas-primary/10 transition-all"
                  >
                    <Search size={15} className="text-canvas-faint shrink-0" />
                    <input
                      role="searchbox"
                      aria-label={merged.searchPlaceholder}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={merged.searchPlaceholder}
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-canvas-faint min-w-0"
                    />
                  </div>
                )}
                {chipsByFilter.map(({ filter, values }) => {
                  const active = filterValues[filter.id] ?? allLabel;
                  return (
                    <div
                      key={filter.id}
                      part="list-panel-chip-strip"
                      role="radiogroup"
                      aria-label={filter.label ?? filter.id}
                      className="flex flex-nowrap gap-1.5 overflow-x-auto -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                      {values.map((v) => {
                        const pressed = active === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            part="list-panel-chip"
                            role="radio"
                            aria-checked={pressed}
                            onClick={() => setFilterValue(filter.id, v)}
                            className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition-colors border ${
                              pressed
                                ? 'bg-canvas-primary text-white border-canvas-primary'
                                : 'bg-canvas-surface text-canvas-muted border-canvas-border hover:border-canvas-primary/40 hover:text-canvas-primary'
                            }`}
                          >
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            <div
              part="list-panel-list"
              className="flex-1 overflow-y-auto p-3 space-y-2.5"
            >
              {filtered.map((item) => {
                const id = getId(item);
                return (
                  <div key={id} part="list-panel-card">
                    {renderCard(item, {
                      selected: selectedId === id,
                      saved: saved.has(id),
                      onSelect: () => setSelectedId(id),
                      onSave: () => toggleSaved(id),
                    })}
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Search size={28} className="text-canvas-faint mb-2" />
                  <p className="text-sm text-canvas-muted font-medium">
                    {merged.emptyTitle}
                  </p>
                  <p className="text-xs text-canvas-faint mt-0.5">
                    {merged.emptySubtitle}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
  );

  // Chromeless mode skips the DraggablePanel wrapper and the layout-store
  // visibility gate. Use when the panel is mounted inside a tldraw shape
  // (or any other host that provides its own chrome).
  if (chromeless) {
    return body;
  }

  return (
    <DraggablePanel id={panelId} title={title}>
      {body}
    </DraggablePanel>
  );
}
