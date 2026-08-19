import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { BookOpen, Briefcase, ChevronRight, Sparkles } from 'lucide-react';
import type { ReactPanelLoaderProps } from '../../../../src/panels/registry';
import type { PanelGrowthPathRow } from '../adapters/careerDatasetToPanelData';
import { useGrowthPathRows } from './useCareerPanelPayload';

const LEVEL_BADGE: Record<string, string> = {
  entry: 'bg-emerald-100 text-emerald-800',
  specialist: 'bg-sky-100 text-sky-800',
  leadership: 'bg-violet-100 text-violet-800',
  management: 'bg-amber-100 text-amber-900',
  executive: 'bg-rose-100 text-rose-900',
};

function PathCard({
  path,
  onSelect,
}: {
  path: PanelGrowthPathRow;
  onSelect: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`growth-path-card-${path.id}`}
      className="w-full text-left rounded-2xl border border-canvas-border bg-canvas-surface hover:border-canvas-primary/35 hover:shadow-sm p-4 transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-canvas leading-snug">{path.title}</h3>
          <p className="text-[12px] text-canvas-muted mt-1 line-clamp-2">{path.tagline}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-canvas-primary bg-canvas-primary-tint px-2.5 py-1 rounded-full">
            <Sparkles size={11} />
            {path.match}% fit
          </span>
          <p className="text-[10px] text-canvas-faint mt-1">{path.totalTime}</p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-canvas-border/60">
        <span className="text-[11px] text-canvas-muted">
          {path.milestones.length} milestones
        </span>
        <span className="text-[11px] text-canvas-primary font-medium inline-flex items-center opacity-80 group-hover:opacity-100">
          View path
          <ChevronRight size={14} className="ml-0.5" />
        </span>
      </div>
    </button>
  );
}

function PathDetail({
  path,
  onBack,
}: {
  path: PanelGrowthPathRow;
  onBack: () => void;
}): ReactElement {
  return (
    <div className="flex flex-col h-full min-h-0" data-testid={`growth-path-detail-${path.id}`}>
      <div className="shrink-0 px-3 py-2 border-b border-canvas-border">
        <button
          type="button"
          onClick={onBack}
          className="text-[12px] font-medium text-canvas-muted hover:text-canvas"
        >
          ← All paths
        </button>
      </div>
      <div className="flex-1 overflow-y-auto landi-overlay-scroll p-4 space-y-4">
        <div className="rounded-2xl bg-gradient-to-br from-canvas-primary/12 to-canvas-surface border border-canvas-primary/20 p-4">
          <div className="flex items-center gap-2">
            <Briefcase size={18} className="text-canvas-primary" />
            <h2 className="text-[17px] font-semibold text-canvas leading-snug">{path.title}</h2>
          </div>
          <p className="text-[13px] text-canvas-muted mt-2 leading-relaxed">{path.tagline}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-canvas-primary bg-canvas-primary-tint px-2.5 py-1 rounded-full">
              <Sparkles size={11} />
              {path.match}% career fit
            </span>
            <span className="text-[11px] font-medium text-canvas-muted bg-canvas-surface-subtle px-2.5 py-1 rounded-full">
              {path.totalTime}
            </span>
          </div>
        </div>

        <ol className="relative space-y-0 pl-1">
          {path.milestones.map((milestone, index) => {
            const badge = LEVEL_BADGE[milestone.level] ?? LEVEL_BADGE.entry;
            const isLast = index === path.milestones.length - 1;
            return (
              <li key={`${milestone.title}-${index}`} className="relative pl-6 pb-4">
                {!isLast ? (
                  <span
                    aria-hidden
                    className="absolute left-[9px] top-6 bottom-0 w-px bg-canvas-border"
                  />
                ) : null}
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 h-[18px] w-[18px] rounded-full border-2 border-canvas-primary bg-canvas-surface"
                />
                <article className="rounded-xl border border-canvas-border p-3.5 bg-canvas-surface shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${badge}`}
                      >
                        {milestone.levelLabel}
                      </span>
                      <h3 className="text-[14px] font-semibold text-canvas mt-2 leading-snug">
                        {milestone.title}
                      </h3>
                    </div>
                    <span className="text-[12px] font-semibold text-emerald-700 shrink-0">
                      {milestone.salary}
                    </span>
                  </div>
                  <p className="text-[11px] text-canvas-faint mt-2">
                    Typical time: {milestone.timeInRole}
                  </p>
                  {milestone.unlocks.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {milestone.unlocks.map((skill) => (
                        <span
                          key={skill}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-canvas-surface-subtle text-canvas-muted border border-canvas-border/70"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {milestone.learningProgram ? (
                    <p className="text-[11px] text-canvas-primary mt-2.5 font-medium inline-flex items-center gap-1.5">
                      <BookOpen size={12} />
                      {milestone.learningProgram}
                    </p>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>

        <button
          type="button"
          className="w-full rounded-xl border border-canvas-primary/30 bg-canvas-primary-tint text-canvas-primary text-[13px] font-medium py-2.5 hover:bg-canvas-primary/15 transition-colors"
        >
          Ask assistant to map this path for me
        </button>
      </div>
    </div>
  );
}

export function GrowthPathsPanel({ data }: ReactPanelLoaderProps): ReactElement {
  const paths = useGrowthPathRows(data);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => paths.find((path) => path.id === selectedId) ?? null,
    [paths, selectedId],
  );

  const onBack = useCallback(() => setSelectedId(null), []);

  if (selected) {
    return <PathDetail path={selected} onBack={onBack} />;
  }

  return (
    <div className="flex flex-col h-full min-h-[380px]" data-testid="growth-paths-panel">
      <div className="shrink-0 px-4 py-3 border-b border-canvas-border">
        <h2 className="text-[15px] font-semibold text-canvas">Growth Paths</h2>
        <p className="text-[12px] text-canvas-muted mt-0.5">
          Fit-scored trajectories based on your profile
        </p>
      </div>
      <div className="flex-1 overflow-y-auto landi-overlay-scroll p-3 space-y-2.5">
        {paths.map((path) => (
          <PathCard key={path.id} path={path} onSelect={() => setSelectedId(path.id)} />
        ))}
        {paths.length === 0 ? (
          <p className="text-[13px] text-canvas-muted text-center py-8">No growth paths available.</p>
        ) : null}
      </div>
    </div>
  );
}
