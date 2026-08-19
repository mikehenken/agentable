import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { ArrowLeft, Calendar, ChevronRight, User } from 'lucide-react';
import type { ReactPanelLoaderProps } from '../../../../src/panels/registry';
import type { PanelApplicationRow } from '../adapters/careerDatasetToPanelData';
import { useApplicationsRows } from './useCareerPanelPayload';

const STATUS_TONE_CLASS: Record<PanelApplicationRow['statusTone'], string> = {
  teal: 'bg-canvas-primary-tint text-canvas-primary border-canvas-primary/25',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  gray: 'bg-canvas-surface-subtle text-canvas-muted border-canvas-border',
  indigo: 'bg-indigo-50 text-indigo-800 border-indigo-200',
};

function progressPercent(stages: PanelApplicationRow['stages']): number {
  if (stages.length === 0) return 0;
  const done = stages.filter((stage) => stage.done).length;
  return Math.round((done / stages.length) * 100);
}

function ApplicationCard({
  row,
  onSelect,
}: {
  row: PanelApplicationRow;
  onSelect: () => void;
}): ReactElement {
  const pct = progressPercent(row.stages);
  const tone = STATUS_TONE_CLASS[row.statusTone];

  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`application-card-${row.id}`}
      className="w-full text-left rounded-xl border border-canvas-border bg-canvas-surface hover:border-canvas-primary/35 hover:shadow-sm transition-all p-3.5 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-canvas truncate">{row.role}</h3>
          <p className="text-[12px] text-canvas-muted mt-0.5 truncate">
            {row.property} · {row.location}
          </p>
        </div>
        <ChevronRight
          size={16}
          className="text-canvas-faint shrink-0 mt-0.5 group-hover:text-canvas-primary transition-colors"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-2.5">
        <span className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full border ${tone}`}>
          {row.status}
        </span>
        <span className="text-[11px] text-canvas-faint">Submitted {row.submitted}</span>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] text-canvas-faint mb-1">
          <span>Progress</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-canvas-surface-subtle overflow-hidden">
          <div
            className="h-full rounded-full bg-canvas-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </button>
  );
}

function ApplicationDetail({
  row,
  onBack,
}: {
  row: PanelApplicationRow;
  onBack: () => void;
}): ReactElement {
  const pct = progressPercent(row.stages);

  return (
    <div className="flex flex-col h-full min-h-0" data-testid={`application-detail-${row.id}`}>
      <div className="shrink-0 px-3 py-2 border-b border-canvas-border flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium text-canvas-muted hover:bg-canvas-surface-subtle"
        >
          <ArrowLeft size={13} />
          All applications
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div>
          <h2 className="text-[18px] font-semibold text-canvas">{row.role}</h2>
          <p className="text-[13px] text-canvas-muted mt-1">
            {row.property} · {row.location}
          </p>
          <span
            className={`inline-block mt-2 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${STATUS_TONE_CLASS[row.statusTone]}`}
          >
            {row.status}
          </span>
        </div>
        <div className="rounded-xl border border-canvas-border bg-canvas-surface-subtle/50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-canvas-faint">
            Prep for next step
          </p>
          <p className="text-[13px] text-canvas mt-1.5 leading-relaxed">
            {row.nextStep ?? 'Your recruiter will update you when there is a next step.'}
          </p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-canvas-faint">
              Timeline
            </p>
            <span className="text-[11px] text-canvas-muted">{pct}% complete</span>
          </div>
          <ol className="space-y-0">
            {row.stages.map((stage, index) => (
              <li key={`${stage.label}-${index}`} className="flex gap-3 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${
                      stage.done ? 'bg-canvas-primary' : 'bg-canvas-border'
                    }`}
                  />
                  {index < row.stages.length - 1 ? (
                    <span className="w-px flex-1 bg-canvas-border min-h-[24px] mt-1" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <p
                    className={`text-[13px] font-medium ${
                      stage.done ? 'text-canvas' : 'text-canvas-muted'
                    }`}
                  >
                    {stage.label}
                  </p>
                  <p className="text-[11px] text-canvas-faint flex items-center gap-1 mt-0.5">
                    <Calendar size={10} />
                    {stage.date}
                  </p>
                  {stage.note ? (
                    <p className="text-[12px] text-canvas-muted mt-1">{stage.note}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-xl border border-canvas-border p-3 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-canvas-primary-tint flex items-center justify-center shrink-0">
            <User size={16} className="text-canvas-primary" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-canvas">{row.recruiter}</p>
            <p className="text-[12px] text-canvas-muted">{row.recruiterRole}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ApplicationsPanel({ data }: ReactPanelLoaderProps): ReactElement {
  const rows = useApplicationsRows(data);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId],
  );

  const activeCount = useMemo(
    () => rows.filter((row) => !/draft/i.test(row.status)).length,
    [rows],
  );

  const onBack = useCallback(() => setSelectedId(null), []);

  if (selected) {
    return <ApplicationDetail row={selected} onBack={onBack} />;
  }

  return (
    <div
      className="flex flex-col h-full min-h-[380px]"
      data-testid="applications-panel"
    >
      <div className="shrink-0 px-4 py-3 border-b border-canvas-border">
        <h2 className="text-[15px] font-semibold text-canvas">My Applications</h2>
        <p className="text-[12px] text-canvas-muted mt-0.5">
          {activeCount} active · {rows.length} total
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {rows.length === 0 ? (
          <p className="text-[13px] text-canvas-muted text-center py-8">
            No applications yet. Browse open positions to get started.
          </p>
        ) : (
          rows.map((row) => (
            <ApplicationCard key={row.id} row={row} onSelect={() => setSelectedId(row.id)} />
          ))
        )}
      </div>
    </div>
  );
}
