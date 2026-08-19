import { useMemo, useState, type ReactElement } from 'react';
import {
  BookOpen,
  FileText,
  GraduationCap,
  PlayCircle,
  Sparkles,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactPanelLoaderProps } from '../../../../src/panels/registry';
import type { PanelResourceRow } from '../adapters/careerDatasetToPanelData';
import { jobToneStyle } from './jobToneStyles';
import { useFeaturedResource, useResourcesRows } from './useCareerPanelPayload';

const ICON_BY_KEY: Record<string, LucideIcon> = {
  PlayCircle,
  BookOpen,
  FileText,
  GraduationCap,
  Users,
};

function resolveIcon(row: PanelResourceRow): LucideIcon {
  if (row.iconKey && ICON_BY_KEY[row.iconKey]) {
    return ICON_BY_KEY[row.iconKey]!;
  }
  if (row.type === 'Video') return PlayCircle;
  if (row.type === 'Portal') return BookOpen;
  return GraduationCap;
}

function ResourceCard({ row }: { row: PanelResourceRow }): ReactElement {
  const tone = jobToneStyle(row.tone);
  const Icon = resolveIcon(row);

  return (
    <article
      className="rounded-xl border border-canvas-border bg-canvas-surface overflow-hidden hover:border-canvas-primary/30 transition-colors"
      data-testid={`resource-card-${row.id}`}
    >
      <div className="flex">
        <div className={`w-1 shrink-0 ${tone.bar}`} />
        <div className="flex-1 p-3.5">
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tone.chip}`}
            >
              <Icon size={18} className={tone.chipText} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[14px] font-semibold text-canvas">{row.title}</h3>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-canvas-faint border border-canvas-border rounded px-1.5 py-0.5">
                  {row.type}
                </span>
              </div>
              <p className="text-[11px] text-canvas-faint mt-0.5">{row.detail}</p>
              <p className="text-[12.5px] text-canvas-muted mt-2 leading-relaxed line-clamp-2">
                {row.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function ResourcesPanel({ data }: ReactPanelLoaderProps): ReactElement {
  const resources = useResourcesRows(data);
  const featured = useFeaturedResource(data);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter(
      (row) =>
        row.title.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q) ||
        row.type.toLowerCase().includes(q));
  }, [resources, query]);

  return (
    <div className="flex flex-col h-full min-h-[380px]" data-testid="resources-panel">
      <div className="shrink-0 px-4 py-3 border-b border-canvas-border space-y-3">
        <h2 className="text-[15px] font-semibold text-canvas">Sandals Resources</h2>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search guides, videos, portals…"
          className="w-full rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2 text-[13px] text-canvas placeholder:text-canvas-faint focus:outline-none focus:ring-2 focus:ring-canvas-primary/30"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {featured ? (
          <div
            className="rounded-xl border border-canvas-primary/25 bg-gradient-to-br from-canvas-primary/10 to-canvas-surface p-4"
            data-testid="resources-featured-hero"
          >
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-canvas-primary">
              <Sparkles size={12} />
              Recommended read
            </div>
            <h3 className="text-[16px] font-semibold text-canvas mt-2">{featured.title}</h3>
            <p className="text-[12.5px] text-canvas-muted mt-1 leading-relaxed">
              {featured.description}
            </p>
            {featured.tag ? (
              <span className="inline-block mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-canvas-primary-tint text-canvas-primary">
                {featured.tag}
              </span>
            ): null}
          </div>
        ): null}
        <div className="grid gap-2.5">
          {filtered.map((row) => (
            <ResourceCard key={row.id} row={row} />
          ))}
        </div>
        {filtered.length === 0 ? (
          <p className="text-[13px] text-canvas-muted text-center py-6">No resources match.</p>
        ): null}
      </div>
    </div>
  );
}
