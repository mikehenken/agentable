import type { ReactElement } from 'react';
import { Calculator, FileSearch, MessageSquareQuote, Sparkles, TrendingUp } from 'lucide-react';
import type { ReactPanelLoaderProps } from '../../../../src/panels/registry';

const TOOLS = [
  {
    id: 'salary',
    title: 'Salary estimator',
    description: 'Compare comp bands by role, property, and track.',
    icon: Calculator,
    tone: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    featured: true,
    featuredBlurb: 'See how island roles compare across properties and tracks before you apply.',
  },
  {
    id: 'resume',
    title: 'Resume scanner',
    description: 'Match your CV to open roles and skill gaps.',
    icon: FileSearch,
    tone: 'bg-sky-50 text-sky-800 border-sky-100',
    featured: false,
  },
  {
    id: 'interview',
    title: 'Interview prep',
    description: 'Practice prompts tailored to your applications.',
    icon: MessageSquareQuote,
    tone: 'bg-violet-50 text-violet-800 border-violet-100',
    featured: false,
  },
  {
    id: 'path',
    title: 'Path planner',
    description: 'Model timelines across growth trajectories.',
    icon: TrendingUp,
    tone: 'bg-amber-50 text-amber-900 border-amber-100',
    featured: false,
  },
] as const;

export function CareerToolsPanel(_props: ReactPanelLoaderProps): ReactElement {
  const featured = TOOLS.find((tool) => tool.featured) ?? TOOLS[0];
  const gridTools = TOOLS.filter((tool) => tool.id !== featured.id);
  const FeaturedIcon = featured.icon;

  return (
    <div className="flex flex-col h-full min-h-[380px]" data-testid="career-tools-panel">
      <div className="shrink-0 px-4 py-3 border-b border-canvas-border">
        <h2 className="text-[15px] font-semibold text-canvas">Career Tools</h2>
        <p className="text-[12px] text-canvas-muted mt-0.5">
          Calculators and prep utilities for your search
        </p>
      </div>
      <div className="flex-1 overflow-y-auto landi-overlay-scroll p-3 space-y-3">
        <button
          type="button"
          data-testid="career-tool-featured"
          className="w-full text-left rounded-2xl border border-canvas-primary/25 bg-gradient-to-br from-canvas-primary/12 via-canvas-surface to-canvas-primary-tint p-5 shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-canvas-primary text-white shrink-0">
              <FeaturedIcon size={22} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-semibold text-canvas">{featured.title}</h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-canvas-primary bg-canvas-primary-tint px-2 py-0.5 rounded-full">
                  <Sparkles size={10} />
                  Featured
                </span>
              </div>
              <p className="text-[12px] text-canvas-muted mt-1 leading-relaxed">
                {featured.featuredBlurb ?? featured.description}
              </p>
            </div>
          </div>
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {gridTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                type="button"
                data-testid={`career-tool-${tool.id}`}
                className={`text-left rounded-xl border p-4 hover:shadow-sm transition-all ${tool.tone}`}
              >
                <Icon size={22} className="mb-2" />
                <h3 className="text-[14px] font-semibold">{tool.title}</h3>
                <p className="text-[12px] opacity-90 mt-1 leading-relaxed">{tool.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
