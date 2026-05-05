import { useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  Clock,
  Code2,
  GraduationCap,
  Palette,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { DraggablePanel } from './DraggablePanel';
import { useLayoutStore } from '../stores/layoutStore';
import { TONE_GRADIENT } from './toneTokens';
import { useCanvasConfig } from './CanvasContext';

export type LevelKey = 'entry' | 'specialist' | 'leadership' | 'management' | 'executive';

export interface Milestone {
  title: string;
  level: LevelKey;
  levelLabel: string;
  salary: string;
  timeInRole: string;
  unlocks: string[];
  learningProgram?: string;
}

/**
 * Public shape for GrowthPathsPanel mock data. Tenants overriding via
 * `<CanvasShell config.panelData.growthPaths>` should match this shape.
 */
export interface Path {
  id: string;
  title: string;
  tagline: string;
  match: number;
  totalTime: string;
  Icon: typeof Briefcase;
  gradient: string;
  heroTint: string;
  milestones: Milestone[];
}

const levelStyles: Record<LevelKey, { chip: string; dot: string; label: string }> = {
  entry: { chip: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500', label: 'Entry' },
  specialist: { chip: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500', label: 'Specialist' },
  leadership: { chip: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500', label: 'Lead' },
  management: { chip: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500', label: 'Manager' },
  executive: { chip: 'bg-rose-100 text-rose-800', dot: 'bg-rose-500', label: 'Exec' },
};

// Generic example growth ladders. Tenants override via
// `<CanvasShell config.panelData.growthPaths>` — pay ranges, learning
// programs, titles, and time-in-role are all placeholders.
const DEFAULT_PATHS: Path[] = [
  {
    id: 'path-customer-success',
    title: 'CS Specialist → CS Director',
    tagline: 'A common path — most CS leaders start in IC roles.',
    match: 91,
    totalTime: '18–24 mo',
    Icon: Briefcase,
    gradient: TONE_GRADIENT.teal,
    heroTint: 'from-canvas-primary/10 to-canvas-primary-light/5',
    milestones: [
      {
        title: 'Customer Success Specialist',
        level: 'entry',
        levelLabel: 'Entry',
        salary: '$24–32 / hr',
        timeInRole: '6–12 mo',
        unlocks: ['CRM systems', 'Onboarding playbooks', 'Account health basics'],
        learningProgram: 'CS 101 · Foundations',
      },
      {
        title: 'Senior CS Specialist',
        level: 'specialist',
        levelLabel: 'Specialist',
        salary: '$70–85k',
        timeInRole: '6–9 mo',
        unlocks: ['Strategic accounts', 'Renewals motion', 'Escalation handling'],
        learningProgram: 'CS 210 · Strategic Accounts',
      },
      {
        title: 'CS Team Lead',
        level: 'leadership',
        levelLabel: 'Lead',
        salary: '$90–110k',
        timeInRole: '9–12 mo',
        unlocks: ['Team coaching', 'QA programs', 'Process design'],
        learningProgram: 'Leadership 320 · First-Line',
      },
      {
        title: 'CS Manager',
        level: 'management',
        levelLabel: 'Manager',
        salary: '$110–140k',
        timeInRole: '12–18 mo',
        unlocks: ['Budget ownership', 'Hiring', 'Performance reviews'],
        learningProgram: 'Leadership 410 · Operations',
      },
      {
        title: 'Director of CS',
        level: 'management',
        levelLabel: 'Manager',
        salary: '$160–200k',
        timeInRole: 'Ongoing',
        unlocks: ['P&L', 'Strategic planning', 'Cross-functional leadership'],
        learningProgram: 'Leadership 510 · Director Track',
      },
    ],
  },
  {
    id: 'path-design',
    title: 'Designer → Director of Design',
    tagline: 'The IC and management ladders converge here.',
    match: 88,
    totalTime: '24–36 mo',
    Icon: Palette,
    gradient: TONE_GRADIENT.amber,
    heroTint: 'from-amber-100 to-amber-50/30',
    milestones: [
      {
        title: 'Product Designer I',
        level: 'entry',
        levelLabel: 'Entry',
        salary: '$80–100k',
        timeInRole: '9–12 mo',
        unlocks: ['Design system fluency', 'Critique participation', 'Spec writing'],
        learningProgram: 'Design 101',
      },
      {
        title: 'Product Designer II',
        level: 'specialist',
        levelLabel: 'Specialist',
        salary: '$110–135k',
        timeInRole: '9–12 mo',
        unlocks: ['Cross-team flows', 'Research ownership', 'Mid-fi prototyping'],
        learningProgram: 'Design 210 · Research',
      },
      {
        title: 'Senior Product Designer',
        level: 'leadership',
        levelLabel: 'Lead',
        salary: '$140–170k',
        timeInRole: '12–18 mo',
        unlocks: ['Surface ownership', 'Design crits', 'Mentorship'],
        learningProgram: 'Design 330 · Craft',
      },
      {
        title: 'Design Manager',
        level: 'management',
        levelLabel: 'Manager',
        salary: '$170–210k',
        timeInRole: 'Ongoing',
        unlocks: ['Team building', 'Roadmap shaping', 'Hiring'],
        learningProgram: 'Leadership 410 · Design Mgmt',
      },
      {
        title: 'Director of Design',
        level: 'executive',
        levelLabel: 'Exec',
        salary: '$220–280k',
        timeInRole: 'Ongoing',
        unlocks: ['Org design', 'Multi-team strategy', 'Executive influence'],
        learningProgram: 'Leadership 550 · Director Track',
      },
    ],
  },
  {
    id: 'path-engineering',
    title: 'Engineer → Engineering Lead',
    tagline: 'Both IC and management tracks open after Senior.',
    match: 85,
    totalTime: '36+ mo',
    Icon: Code2,
    gradient: TONE_GRADIENT.indigo,
    heroTint: 'from-indigo-100 to-indigo-50/30',
    milestones: [
      {
        title: 'Software Engineer I',
        level: 'entry',
        levelLabel: 'Entry',
        salary: '$95–115k',
        timeInRole: '9–12 mo',
        unlocks: ['Codebase fluency', 'Code review participation', 'Testing basics'],
      },
      {
        title: 'Software Engineer II',
        level: 'specialist',
        levelLabel: 'Specialist',
        salary: '$125–155k',
        timeInRole: '12–18 mo',
        unlocks: ['Feature ownership', 'On-call rotation', 'Cross-team collaboration'],
        learningProgram: 'Engineering 210 · Foundations',
      },
      {
        title: 'Senior Engineer',
        level: 'leadership',
        levelLabel: 'Lead',
        salary: '$160–200k',
        timeInRole: '12–18 mo',
        unlocks: ['System design', 'Mentorship', 'Code review ownership'],
      },
      {
        title: 'Staff Engineer',
        level: 'management',
        levelLabel: 'Manager',
        salary: '$210–270k',
        timeInRole: 'Ongoing',
        unlocks: ['Cross-team architecture', 'Tech strategy', 'Hiring panel'],
        learningProgram: 'Engineering 410 · Senior Track',
      },
      {
        title: 'Engineering Lead',
        level: 'executive',
        levelLabel: 'Exec',
        salary: '$260–340k',
        timeInRole: 'Ongoing',
        unlocks: ['Team ownership', 'Budget', 'Platform direction'],
      },
    ],
  },
];

export function GrowthPathsPanel() {
  const { panels } = useLayoutStore();
  // Tenant-injected paths override the library example data.
  const tenantPaths = useCanvasConfig().panelData.growthPaths as
    | readonly Path[]
    | undefined;
  const paths = tenantPaths ?? DEFAULT_PATHS;
  const [activeId, setActiveId] = useState<string>(paths[0].id);

  const layout = panels['growth-paths'];
  if (!layout?.visible) return null;

  const active = paths.find((p) => p.id === activeId) ?? paths[0];

  return (
    <DraggablePanel id="growth-paths" title="Growth Paths">
      <div className="flex flex-col h-full bg-[#FAFAF8]">
        <div className="shrink-0 bg-canvas-surface-subtle border-b border-canvas-primary/15 px-4 py-2 flex items-center gap-2">
          <GraduationCap size={14} className="text-canvas-primary" />
          <span className="text-[11px] font-medium text-canvas-primary">
            Every path is mapped to your company's learning programs
          </span>
        </div>

        <div className="shrink-0 px-3 py-3 bg-canvas-surface border-b border-canvas-border">
          <div className="grid grid-cols-3 gap-2">
            {paths.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveId(p.id)}
                className={`relative overflow-hidden rounded-xl p-3 text-left transition-all ${
                  activeId === p.id
                    ? 'text-white shadow-canvas-primary-active'
                    : 'bg-canvas-surface text-canvas border border-canvas-border hover:border-canvas-primary/30 hover:shadow-sm'
                }`}
                style={activeId === p.id ? { background: p.gradient } : undefined}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      activeId === p.id ? 'bg-canvas-surface/20 backdrop-blur' : 'bg-canvas-surface-subtle text-canvas-primary'
                    }`}
                  >
                    <p.Icon size={14} />
                  </div>
                  <span
                    className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${
                      activeId === p.id
                        ? 'bg-canvas-surface/20 backdrop-blur text-white'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {p.match}% fit
                  </span>
                </div>
                <p className="mt-2 text-[12px] font-semibold leading-snug line-clamp-2">{p.title}</p>
                <p
                  className={`mt-1 text-[10.5px] ${
                    activeId === p.id ? 'text-white/80' : 'text-canvas-faint'
                  } flex items-center gap-1`}
                >
                  <Clock size={10} /> {p.totalTime}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className={`bg-gradient-to-br ${active.heroTint} px-4 py-3 border-b border-canvas-border`}>
            <h3 className="text-[15px] font-semibold text-canvas tracking-tight">{active.title}</h3>
            <p className="text-[12px] text-canvas-muted mt-0.5 leading-relaxed">{active.tagline}</p>
          </div>

          <div className="p-4">
            <div className="relative">
              <div className="absolute left-[17px] top-6 bottom-6 w-px bg-gradient-to-b from-canvas-primary/30 via-gray-200 to-gray-200" />
              <ol className="space-y-3">
                {active.milestones.map((m, i) => {
                  const lv = levelStyles[m.level];
                  return (
                    <li key={i} className="relative pl-10">
                      <div className={`absolute left-0 top-1 w-9 h-9 rounded-full flex items-center justify-center text-white ${lv.dot} shadow-[0_4px_12px_rgba(0,0,0,0.12)]`}>
                        <span className="text-[11px] font-bold">{i + 1}</span>
                      </div>
                      <div className="bg-canvas-surface rounded-xl border border-canvas-border p-3.5 hover:border-canvas-primary/30 hover:shadow-[0_6px_20px_rgba(15,23,42,0.06)] transition-all">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-[13.5px] font-semibold text-canvas tracking-tight">{m.title}</h4>
                              <span className={`${lv.chip} rounded-md px-1.5 py-0.5 text-[10px] font-medium`}>
                                {m.levelLabel}
                              </span>
                            </div>
                            <p className="text-[11.5px] text-canvas-faint mt-0.5 flex items-center gap-2">
                              <span>{m.salary}</span>
                              <span className="text-canvas-faint">·</span>
                              <span className="flex items-center gap-1"><Clock size={10} /> {m.timeInRole}</span>
                            </p>
                          </div>
                          {i < active.milestones.length - 1 && (
                            <ArrowRight size={12} className="text-canvas-faint mt-1.5" />
                          )}
                        </div>

                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {m.unlocks.map((u) => (
                            <span key={u} className="bg-canvas-surface-subtle text-canvas-muted rounded-md px-1.5 py-0.5 text-[10.5px] font-medium">
                              {u}
                            </span>
                          ))}
                        </div>

                        {m.learningProgram && (
                          <div className="mt-2.5 pt-2.5 border-t border-canvas-border flex items-center gap-1.5">
                            <GraduationCap size={11} className="text-canvas-primary" />
                            <span className="text-[11px] text-canvas-primary font-medium">{m.learningProgram}</span>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-canvas-border px-4 py-3 bg-canvas-surface flex items-center gap-2">
          <button
            type="button"
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[12.5px] font-medium text-canvas-primary hover:bg-canvas-primary/8 transition-colors"
          >
            <TrendingUp size={13} /> See where I'd start
          </button>
          <button
            type="button"
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white transition-all"
            style={{ background: active.gradient }}
          >
            <Sparkles size={13} /> Ask the assistant to map this for me
          </button>
        </div>
      </div>
    </DraggablePanel>
  );
}
