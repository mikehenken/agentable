import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { ListPanel } from '../../../../src/components/primitives/ListPanel';
import type { ReactPanelLoaderProps } from '../../../../src/panels/registry';
import { usePanelIntentStore } from '../../../../src/stores/panelIntentStore';
import type { PanelJobRow } from '../adapters/careerDatasetToPanelData';
import { OpenPositionsJobCard, OpenPositionsJobDetail } from './OpenPositionsJobViews';
import { openPositionsDepartmentLexicon } from './openPositionsDepartmentLexicon';
import { inferJobTrack, openPositionsTrackLexicon } from './openPositionsTrackLexicon';
import { useOpenPositionsJobs } from './useOpenPositionsJobs';

export function OpenPositionsPanel({
  data,
  hostedInWhiteboard = false,
}: ReactPanelLoaderProps): ReactElement {
  const jobs = useOpenPositionsJobs(data, null);

  const intent = usePanelIntentStore((state) => state.openPositions);
  const clearIntent = usePanelIntentStore((state) => state.clearOpenPositionsIntent);
  const savedJobIds = usePanelIntentStore((state) => state.savedJobIds);
  const toggleSavedJob = usePanelIntentStore((state) => state.toggleSavedJob);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({
    department: 'All',
    track: 'All',
  });

  useEffect(() => {
    if (!intent) {
      return;
    }

    if (typeof intent.selectedJobId === 'number') {
      setSelectedId(intent.selectedJobId);
    } else if (typeof intent.selectedJobTitle === 'string' && intent.selectedJobTitle.trim()) {
      const match = jobs.find((job) =>
        job.title.toLowerCase().includes(intent.selectedJobTitle!.toLowerCase()),
      );
      if (match) {
        setSelectedId(match.id);
      }
    } else if (intent.selectedJobId === null) {
      setSelectedId(null);
    }

    if (typeof intent.search === 'string') {
      setQuery(intent.search);
    }

    if (typeof intent.location === 'string' && intent.location.trim()) {
      setQuery((current) =>
        current.trim().length > 0 ? `${current} ${intent.location}` : intent.location!,
      );
    }

    if (typeof intent.track === 'string' && intent.track.trim()) {
      const normalizedTrack =
        openPositionsTrackLexicon.normalize(intent.track) ??
        inferJobTrack(intent.track, intent.department ?? '');
      setFilterValues((current) => ({
        ...current,
        track: normalizedTrack,
      }));
      if (!normalizedTrack && typeof intent.search !== 'string') {
        setQuery(intent.track);
      }
    }

    if (typeof intent.department === 'string') {
      const normalized = openPositionsDepartmentLexicon.normalize(intent.department);
      setFilterValues((current) => ({
        ...current,
        department: normalized ?? 'All',
      }));
      if (!normalized && typeof intent.search !== 'string') {
        setQuery(intent.department);
      }
    }

    clearIntent();
  }, [intent, clearIntent, jobs]);

  const savedIds = useMemo(() => new Set<number>(Array.from(savedJobIds)), [savedJobIds]);

  const syncSavedIds = useCallback(
    (next: Set<number | string>) => {
      const nextNumeric = new Set<number>();
      for (const id of next) {
        if (typeof id === 'number') {
          nextNumeric.add(id);
        }
      }
      for (const id of nextNumeric) {
        if (!savedJobIds.has(id)) {
          toggleSavedJob(id);
        }
      }
      for (const id of savedJobIds) {
        if (!nextNumeric.has(id)) {
          toggleSavedJob(id);
        }
      }
    },
    [savedJobIds, toggleSavedJob],
  );

  const renderCard = useCallback(
    (job: PanelJobRow, ctx: { saved: boolean; onSelect: () => void; onSave: () => void }) => (
      <OpenPositionsJobCard
        job={job}
        saved={ctx.saved}
        onSelect={ctx.onSelect}
        onSave={ctx.onSave}
      />
    ),
    [],
  );

  const renderDetail = useCallback(
    (job: PanelJobRow, ctx: { saved: boolean; onBack: () => void; onSave: () => void }) => (
      <OpenPositionsJobDetail job={job} saved={ctx.saved} onBack={ctx.onBack} onSave={ctx.onSave} />
    ),
    [],
  );

  const getTitle = useCallback(
    ({ count, selected }: { count: number; selected: PanelJobRow | null }) =>
      selected ? selected.title : `Open Positions · ${count}`,
    [],
  );

  const listTitle = getTitle({
    count: jobs.length,
    selected:
      selectedId !== null ? jobs.find((job) => job.id === selectedId) ?? null : null,
  });

  return (
    <div
      className="flex flex-col h-full min-h-[380px]"
      data-testid="open-positions-panel"
      data-hosted-in-whiteboard={hostedInWhiteboard ? 'true' : 'false'}
    >
      {!hostedInWhiteboard && selectedId === null ? (
        <div
          part="list-panel-title"
          className="shrink-0 px-4 py-3 border-b border-canvas-border bg-canvas-surface"
        >
          <h2 className="text-[15px] font-semibold text-canvas tracking-tight">{listTitle}</h2>
        </div>
      ) : null}
      <ListPanel<PanelJobRow>
        panelId="open-positions"
        items={[...jobs]}
        getId={(job) => job.id}
        getSearchText={(job) =>
          [
            job.title,
            job.department,
            job.track,
            job.team,
            job.location,
            job.property,
            ...(job.skillMatches ?? []),
          ].join(' ')
        }
        filters={[
          { id: 'department', getValue: (job) => job.department, label: 'Department' },
          {
            id: 'track',
            getValue: (job) => job.track ?? inferJobTrack(job.type, job.department),
            label: 'Track',
          },
        ]}
        labels={{
          titlePrefix: 'Open Positions',
          searchPlaceholder: 'Search roles, properties, skills…',
          emptyTitle: 'No matches',
          emptySubtitle: 'Try a different search or department.',
        }}
        getTitle={getTitle}
        renderCard={renderCard}
        renderDetail={renderDetail}
        selectedId={selectedId}
        onSelectedIdChange={(id) => setSelectedId(typeof id === 'number' ? id : null)}
        query={query}
        onQueryChange={setQuery}
        filterValues={filterValues}
        onFilterValuesChange={setFilterValues}
        savedIds={savedIds}
        onSavedIdsChange={syncSavedIds}
        chromeless={hostedInWhiteboard}
      />
    </div>
  );
}
