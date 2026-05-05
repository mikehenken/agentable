import { useEffect, useState } from 'react';
import {
  BookOpen,
  FileText,
  GraduationCap,
  PlayCircle,
  Search,
  Users,
  Waves,
} from 'lucide-react';
import { DraggablePanel } from './DraggablePanel';
import { useLayoutStore } from '../stores/layoutStore';
import { usePanelIntentStore } from '../stores/panelIntentStore';
import { useCanvasConfig } from './CanvasContext';

export type ResourceTone = 'teal' | 'purple' | 'amber' | 'rose' | 'indigo';

/**
 * Public shape for ResourcesPanel mock data. Tenants overriding via
 * `<CanvasShell config.panelData.resources>` (and `featuredResource`)
 * should match this shape.
 */
export interface Resource {
  id: string;
  title: string;
  type: 'Video' | 'Guide' | 'Portal' | 'Playbook';
  detail: string;
  description: string;
  tone: ResourceTone;
  Icon: typeof BookOpen;
  tag?: string;
}

const toneStyles: Record<ResourceTone, { tint: string; bg: string; iconBg: string; iconText: string }> = {
  teal: { tint: 'from-canvas-primary/10 to-canvas-primary-light/5', bg: 'bg-canvas-primary-tint', iconBg: 'bg-canvas-primary', iconText: 'text-white' },
  purple: { tint: 'from-purple-100 to-purple-50/30', bg: 'bg-purple-50', iconBg: 'bg-purple-500', iconText: 'text-white' },
  amber: { tint: 'from-amber-100 to-amber-50/30', bg: 'bg-amber-50', iconBg: 'bg-amber-500', iconText: 'text-white' },
  rose: { tint: 'from-rose-100 to-rose-50/30', bg: 'bg-rose-50', iconBg: 'bg-rose-500', iconText: 'text-white' },
  indigo: { tint: 'from-indigo-100 to-indigo-50/30', bg: 'bg-indigo-50', iconBg: 'bg-indigo-500', iconText: 'text-white' },
};

// Generic example resources — tenants override via panel injection or
// (future) tenant config.
const DEFAULT_FEATURED_RESOURCE: Resource = {
  id: 'res-featured',
  title: 'Your first 30 days here',
  type: 'Playbook',
  detail: '14 min · Onboarding',
  description:
    'What to expect in your first month — orientation, your onboarding cohort, and the people you will meet.',
  tone: 'teal',
  Icon: Waves,
  tag: 'New & recommended',
};

const DEFAULT_RESOURCES: Resource[] = [
  {
    id: 'res-1',
    title: 'Onboarding guide',
    type: 'Guide',
    detail: '12 min read',
    description: 'The A→Z primer for every new team member entering the company learning program.',
    tone: 'teal',
    Icon: GraduationCap,
  },
  {
    id: 'res-2',
    title: 'Leadership pathways video',
    type: 'Video',
    detail: '18 min',
    description: 'Five fellows walk through how they moved from IC roles into leadership.',
    tone: 'purple',
    Icon: PlayCircle,
  },
  {
    id: 'res-3',
    title: 'Benefits overview 2026',
    type: 'Portal',
    detail: 'Updated Mar 2026',
    description: 'Health, travel, perks, and the relocation program in plain English.',
    tone: 'indigo',
    Icon: BookOpen,
  },
  {
    id: 'res-4',
    title: 'Team culture handbook',
    type: 'Guide',
    detail: '32 pages',
    description: 'How each team operates day-to-day, the rhythms of the work, and what stakeholders expect.',
    tone: 'amber',
    Icon: FileText,
  },
  {
    id: 'res-5',
    title: 'Meet the leadership',
    type: 'Video',
    detail: '9 min',
    description: 'A short intro from our team leads.',
    tone: 'rose',
    Icon: Users,
  },
];

export interface ResourcesPanelProps {
  /** When true, skip the `<DraggablePanel>` wrapper + visibility gate so
   *  the panel can render inside a tldraw shape on the whiteboard. */
  hostedInWhiteboard?: boolean;
  /** Shape-scoped data (unused by this panel; intents flow via panelIntentStore). */
  data?: Record<string, unknown>;
}

export function ResourcesPanel({
  hostedInWhiteboard = false,
}: ResourcesPanelProps = {}) {
  const { panels } = useLayoutStore();
  const intent = usePanelIntentStore((s) => s.resources);
  const clearIntent = usePanelIntentStore((s) => s.clearResourcesIntent);
  const [query, setQuery] = useState('');
  // Tenant-injected list + featured resource override the library example data.
  const cfg = useCanvasConfig();
  const tenantResources = cfg.panelData.resources as
    | readonly Resource[]
    | undefined;
  const tenantFeatured = cfg.panelData.featuredResource as Resource | undefined;
  const resources = tenantResources ?? DEFAULT_RESOURCES;
  const featuredResource = tenantFeatured ?? DEFAULT_FEATURED_RESOURCE;

  // Apply agent search intent on open / change. One-shot — cleared after
  // applying so a manual edit isn't overwritten by stale agent state.
  useEffect(() => {
    if (!intent) return;
    if (typeof intent.search === 'string') setQuery(intent.search);
    clearIntent();
  }, [intent, clearIntent]);

  const layout = panels.resources;
  if (!hostedInWhiteboard && !layout?.visible) return null;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? resources.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.type.toLowerCase().includes(q)
      )
    : resources;

  const featuredTone = toneStyles[featuredResource.tone];

  const body = (
    <div className="flex flex-col h-full bg-[#FAFAF8]">
        <div className="shrink-0 px-4 py-3 bg-canvas-surface border-b border-canvas-border">
          <div className="flex items-center gap-2 bg-canvas-surface-subtle border border-canvas-border rounded-lg px-3 py-2 focus-within:border-canvas-primary/50 focus-within:ring-2 focus-within:ring-canvas-primary/10 transition-all">
            <Search size={15} className="text-canvas-faint shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search resources…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-canvas-faint min-w-0"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {!q && (
            <button
              type="button"
              className={`w-full text-left rounded-2xl p-4 bg-gradient-to-br ${featuredTone.tint} border border-canvas-primary/15 hover:shadow-canvas-primary-rich transition-all group`}
            >
              {featuredResource.tag && (
                <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.08em] bg-canvas-surface text-canvas-primary border border-canvas-primary/20 rounded-full px-2 py-0.5 mb-2">
                  {featuredResource.tag}
                </span>
              )}
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-xl ${featuredTone.iconBg} ${featuredTone.iconText} flex items-center justify-center shrink-0 shadow-sm`}>
                  <featuredResource.Icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[16px] font-semibold text-canvas tracking-tight leading-snug">
                    {featuredResource.title}
                  </h3>
                  <p className="text-[11.5px] text-canvas-primary font-medium mt-0.5">
                    {featuredResource.type} · {featuredResource.detail}
                  </p>
                  <p className="text-[12.5px] text-canvas-muted leading-relaxed mt-1.5 line-clamp-1">
                    {featuredResource.description}
                  </p>
                </div>
              </div>
            </button>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            {filtered.map((r) => {
              const tone = toneStyles[r.tone];
              return (
                <button
                  key={r.id}
                  type="button"
                  className="group text-left bg-canvas-surface rounded-xl border border-canvas-border hover:border-canvas-primary/35 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all p-3"
                >
                  <div className={`w-9 h-9 rounded-lg ${tone.iconBg} ${tone.iconText} flex items-center justify-center mb-2.5 shadow-sm`}>
                    <r.Icon size={17} />
                  </div>
                  <p className={`inline-block text-[10px] font-semibold uppercase tracking-wider ${tone.bg} px-1.5 py-0.5 rounded`}
                    style={{ color: tone.iconBg.replace('bg-', '').startsWith('purple') ? '#6D28D9' : tone.iconBg.replace('bg-', '').startsWith('amber') ? '#B45309' : tone.iconBg.replace('bg-', '').startsWith('rose') ? '#BE185D' : tone.iconBg.replace('bg-', '').startsWith('indigo') ? '#4338CA' : 'var(--landi-color-primary, #0D7377)' }}
                  >
                    {r.type}
                  </p>
                  <h3 className="text-[13.5px] font-semibold text-canvas tracking-tight leading-snug mt-1.5">
                    {r.title}
                  </h3>
                  <p className="text-[11.5px] text-canvas-faint mt-1 leading-relaxed line-clamp-1">{r.description}</p>
                  <p className="text-[11px] text-canvas-faint mt-2">{r.detail}</p>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Search size={26} className="text-canvas-faint mb-2" />
              <p className="text-sm text-canvas-muted font-medium">No resources match</p>
              <p className="text-xs text-canvas-faint mt-0.5">Try a different search.</p>
            </div>
          )}
        </div>
      </div>
  );

  if (hostedInWhiteboard) {
    return body;
  }

  return (
    <DraggablePanel id="resources" title={`Resources · ${resources.length + 1}`}>
      {body}
    </DraggablePanel>
  );
}
