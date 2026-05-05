import {
  ArrowUpRight,
  Calculator,
  Compass,
  Mic,
  Plane,
  Sparkles,
  Target,
} from 'lucide-react';
import { DraggablePanel } from './DraggablePanel';
import { useLayoutStore } from '../stores/layoutStore';
import { TONE_GLOW, TONE_GRADIENT } from './toneTokens';

type ToolTone = 'emerald' | 'amber' | 'rose' | 'teal' | 'indigo' | 'purple';

interface Tool {
  id: string;
  title: string;
  description: string;
  runtime: string;
  tone: ToolTone;
  Icon: typeof Calculator;
  featured?: boolean;
}

const toneStyles: Record<
  ToolTone,
  { gradient: string; glow: string; soft: string; text: string }
> = {
  emerald: {
    gradient: TONE_GRADIENT.emerald,
    glow: TONE_GLOW.emerald,
    soft: 'bg-emerald-50',
    text: 'text-emerald-700',
  },
  amber: {
    gradient: TONE_GRADIENT.amber,
    glow: TONE_GLOW.amber,
    soft: 'bg-amber-50',
    text: 'text-amber-800',
  },
  rose: {
    gradient: TONE_GRADIENT.rose,
    glow: TONE_GLOW.rose,
    soft: 'bg-rose-50',
    text: 'text-rose-700',
  },
  teal: {
    gradient: TONE_GRADIENT.teal,
    glow: TONE_GLOW.teal,
    soft: 'bg-canvas-primary-tint',
    text: 'text-canvas-primary',
  },
  indigo: {
    gradient: TONE_GRADIENT.indigo,
    glow: TONE_GLOW.indigo,
    soft: 'bg-indigo-50',
    text: 'text-indigo-700',
  },
  purple: {
    gradient: TONE_GRADIENT.violet,
    glow: TONE_GLOW.violet,
    soft: 'bg-purple-50',
    text: 'text-purple-700',
  },
};

const tools: Tool[] = [
  {
    id: 'tool-salary',
    title: 'Salary & benefits estimator',
    description: 'Model compensation by role, property, tenure, and benefits package.',
    runtime: 'Interactive · 2 min',
    tone: 'emerald',
    Icon: Calculator,
    featured: true,
  },
  {
    id: 'tool-interview',
    title: 'Interview prep, role-specific',
    description: 'Practice questions tailored to your saved applications, with assistant feedback.',
    runtime: 'Coached · 15 min',
    tone: 'amber',
    Icon: Mic,
  },
  {
    id: 'tool-relocation',
    title: 'Relocation checklist',
    description: 'Steps for cross-property moves — housing, travel, paperwork, and family logistics.',
    runtime: 'Checklist · 5 min',
    tone: 'rose',
    Icon: Plane,
  },
  {
    id: 'tool-learning',
    title: 'Learning matcher',
    description: 'Map your company learning programs to your current role and target role.',
    runtime: 'Matcher · 3 min',
    tone: 'teal',
    Icon: Target,
  },
  {
    id: 'tool-resume',
    title: 'Resume reviewer',
    description: 'The assistant reads your resume and suggests targeted edits for a specific posting.',
    runtime: 'AI · 4 min',
    tone: 'purple',
    Icon: Sparkles,
  },
  {
    id: 'tool-compass',
    title: 'Career compass',
    description: 'Short quiz that maps your strengths to 3 likely growth paths at your company.',
    runtime: 'Quiz · 6 min',
    tone: 'indigo',
    Icon: Compass,
  },
];

export function CareerToolsPanel() {
  const { panels } = useLayoutStore();
  const layout = panels['career-tools'];
  if (!layout?.visible) return null;

  return (
    <DraggablePanel id="career-tools" title={`Career Tools · ${tools.length}`}>
      <div className="flex flex-col h-full bg-[#FAFAF8]">
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {tools
            .filter((t) => t.featured)
            .map((tool) => (
              <FeaturedToolCard key={tool.id} tool={tool} />
            ))}

          <div className="grid grid-cols-2 gap-2.5">
            {tools
              .filter((t) => !t.featured)
              .map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
          </div>
        </div>
      </div>
    </DraggablePanel>
  );
}

function FeaturedToolCard({ tool }: { tool: Tool }) {
  const tone = toneStyles[tool.tone];
  return (
    <button
      type="button"
      className="w-full group relative overflow-hidden rounded-2xl p-4 text-left text-white transition-transform hover:-translate-y-0.5"
      style={{ background: tone.gradient, boxShadow: tone.glow }}
    >
      <span className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-canvas-surface/10 blur-2xl" aria-hidden />
      <div className="flex items-start gap-3.5 relative">
        <div className="w-11 h-11 rounded-xl bg-canvas-surface/20 backdrop-blur flex items-center justify-center shrink-0">
          <tool.Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.08em] bg-canvas-surface/20 backdrop-blur rounded-full px-2 py-0.5 mb-1.5">
            Featured
          </span>
          <h3 className="text-[16px] font-semibold tracking-tight leading-snug">{tool.title}</h3>
          <p className="text-[12.5px] text-white/90 mt-1 leading-relaxed">{tool.description}</p>
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-white/80">{tool.runtime}</span>
            <span className="flex items-center gap-1 text-[12px] font-semibold">
              Launch <ArrowUpRight size={12} />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function ToolCard({ tool }: { tool: Tool }) {
  const tone = toneStyles[tool.tone];
  return (
    <button
      type="button"
      className="group text-left bg-canvas-surface rounded-xl border border-canvas-border hover:border-canvas-border hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all p-3"
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center text-white mb-2.5 shadow-sm`}
        style={{ background: tone.gradient }}
      >
        <tool.Icon size={16} />
      </div>
      <h3 className="text-[13.5px] font-semibold text-canvas tracking-tight leading-snug">{tool.title}</h3>
      <p className="text-[11.5px] text-canvas-faint mt-1 leading-relaxed line-clamp-1">{tool.description}</p>
      <div className="mt-2.5 flex items-center justify-between">
        <span className={`text-[10.5px] uppercase tracking-wider font-semibold ${tone.text}`}>
          {tool.runtime}
        </span>
        <ArrowUpRight size={12} className="text-canvas-faint group-hover:text-canvas-primary transition-colors" />
      </div>
    </button>
  );
}
