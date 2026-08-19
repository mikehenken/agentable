import {
  ArrowLeft,
  Bookmark,
  Building2,
  Clock,
  DollarSign,
  MapPin,
} from 'lucide-react';
import type { ReactElement, KeyboardEvent } from 'react';
import type { PanelJobRow } from '../adapters/careerDatasetToPanelData';
import { jobToneStyle } from './jobToneStyles';

function CompatibilityBadge({ score }: { score: number }): ReactElement {
  const tone =
    score >= 90
      ? 'bg-emerald-600 text-white ring-1 ring-emerald-700/40'
      : score >= 80
        ? 'bg-amber-400 text-amber-900'
        : 'bg-blue-400 text-white';

  return (
    <span className={`${tone} rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm`}>
      {score}% match
    </span>
  );
}

export interface OpenPositionsJobCardProps {
  job: PanelJobRow;
  saved: boolean;
  onSelect: () => void;
  onSave: () => void;
}

export function OpenPositionsJobCard({
  job,
  saved,
  onSelect,
  onSave,
}: OpenPositionsJobCardProps): ReactElement {
  const tone = jobToneStyle(job.tone);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      aria-label={`Open ${job.title} details`}
      data-testid={`open-positions-job-card-${job.id}`}
      className="w-full text-left bg-canvas-surface rounded-xl border border-canvas-border hover:border-canvas-primary/35 hover:shadow-[0_8px_28px_rgba(15,23,42,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-primary/40 transition-all overflow-hidden group cursor-pointer"
    >
      <div className="flex">
        <div className={`w-1 shrink-0 ${tone.bar}`} />
        <div className="flex-1 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[15px] font-semibold text-canvas tracking-tight truncate">
                  {job.title}
                </h3>
                <span
                  className={`${tone.chip} ${tone.chipText} rounded-md px-1.5 py-0.5 text-[10px] font-medium shrink-0`}
                >
                  {job.department}
                </span>
              </div>
              <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[12px] text-canvas-muted">
                <span className="flex items-center gap-1">
                  <Building2 size={11} aria-hidden="true" />
                  {job.property}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={11} aria-hidden="true" />
                  {job.location}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <CompatibilityBadge score={job.compatibilityScore} />
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSave();
                }}
                className={`p-1.5 rounded-md transition-colors ${
                  saved
                    ? 'text-amber-500 bg-amber-50'
                    : 'text-canvas-faint hover:text-amber-500 hover:bg-amber-50'
                }`}
                aria-label={saved ? 'Remove saved' : 'Save job'}
              >
                <Bookmark size={14} fill={saved ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>
          <p className="text-[12.5px] text-canvas-muted leading-relaxed mt-1.5 line-clamp-1">
            {job.description}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            {(job.skillMatches ?? []).slice(0, 3).map((skill) => (
              <span
                key={skill}
                className={`${tone.chip} ${tone.chipText} rounded-md px-2 py-0.5 text-[10.5px] font-medium`}
              >
                {skill}
              </span>
            ))}
            {(job.skillMatches ?? []).length > 3 ? (
              <span className="text-[10.5px] text-canvas-faint">
                +{(job.skillMatches ?? []).length - 3} more
              </span>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-canvas-border">
            <span className="flex items-center gap-1 text-[12px] font-semibold text-canvas">
              <DollarSign size={12} className="text-emerald-600" aria-hidden="true" />
              {job.payRange}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-canvas-faint">
              <Clock size={11} aria-hidden="true" />
              {job.postedDate}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface OpenPositionsJobDetailProps {
  job: PanelJobRow;
  saved: boolean;
  onBack: () => void;
  onSave: () => void;
}

export function OpenPositionsJobDetail({
  job,
  saved,
  onBack,
  onSave,
}: OpenPositionsJobDetailProps): ReactElement {
  const tone = jobToneStyle(job.tone);

  return (
    <div className="flex flex-col h-full" data-testid={`open-positions-job-detail-${job.id}`}>
      <div className="shrink-0 px-3 py-2 bg-canvas-surface border-b border-canvas-border flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium text-canvas-muted hover:bg-canvas-surface-subtle hover:text-canvas transition-colors"
        >
          <ArrowLeft size={13} aria-hidden="true" />
          All positions
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSave}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors ${
              saved
                ? 'bg-amber-50 text-amber-700'
                : 'bg-canvas-surface-subtle text-canvas-faint hover:bg-canvas-surface-subtle'
            }`}
          >
            <Bookmark size={12} fill={saved ? 'currentColor' : 'none'} />
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div
          className="px-4 pt-5 pb-4 text-white"
          style={{ background: tone.detailHero }}
        >
          <span className="inline-block text-[10.5px] font-semibold uppercase tracking-[0.08em] bg-canvas-surface/20 backdrop-blur rounded-full px-2 py-0.5">
            {job.department}
          </span>
          <h2 className="mt-2 text-[22px] font-semibold tracking-tight leading-tight">{job.title}</h2>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-white/90">
            <span className="flex items-center gap-1">
              <Building2 size={12} aria-hidden="true" />
              {job.property}
            </span>
            <span className="flex items-center gap-1">
              <MapPin size={12} aria-hidden="true" />
              {job.location}
            </span>
            <span>{job.type}</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="bg-canvas-surface/15 backdrop-blur rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-white/70">Compensation</p>
              <p className="text-[13px] font-semibold">{job.payRange}</p>
            </div>
            <div className="bg-canvas-surface/15 backdrop-blur rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-white/70">Team</p>
              <p className="text-[13px] font-semibold">{job.team}</p>
            </div>
            <div className="bg-canvas-surface/15 backdrop-blur rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-white/70">Match</p>
              <p className="text-[13px] font-semibold">{job.compatibilityScore}%</p>
            </div>
          </div>
        </div>
        <div className="px-4 py-4 space-y-4">
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-canvas-faint mb-1.5">
              About this role
            </h3>
            <p className="text-[13.5px] text-canvas-muted leading-relaxed">{job.longDescription}</p>
          </section>
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-canvas-faint mb-2">
              What you&apos;ll own
            </h3>
            <ul className="space-y-1.5">
              {(job.responsibilities ?? []).map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[13px] text-canvas-muted leading-relaxed"
                >
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${tone.bar} shrink-0`} />
                  {item}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-canvas-faint mb-2">
              Why you&apos;re a match
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {(job.skillMatches ?? []).map((skill) => (
                <span
                  key={skill}
                  className={`${tone.chip} ${tone.chipText} rounded-md px-2 py-0.5 text-[10.5px] font-medium`}
                >
                  {skill}
                </span>
              ))}
            </div>
          </section>
          <div className="sticky bottom-0 pt-2 pb-4 bg-gradient-to-t from-canvas-surface via-canvas-surface to-transparent">
            <button
              type="button"
              data-testid="open-positions-apply-now"
              className="w-full rounded-xl py-3 text-[14px] font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
              style={{ background: 'var(--canvas-primary, var(--landi-color-primary, #0D7377))' }}
            >
              Apply Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
