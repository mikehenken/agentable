import { useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  MapPin,
  MessageSquare,
} from 'lucide-react';
import { TONE_GRADIENT } from './toneTokens';
import { DraggablePanel } from './DraggablePanel';
import { useLayoutStore } from '../stores/layoutStore';
import { useCanvasConfig } from './CanvasContext';

export type StatusTone = 'teal' | 'amber' | 'gray' | 'indigo';

export interface StageEvent {
  label: string;
  date: string;
  done: boolean;
  note?: string;
}

/**
 * Public shape for ApplicationsPanel mock data. Tenants overriding via
 * `<CanvasShell config.panelData.applications>` should match this shape.
 */
export interface Application {
  id: string;
  role: string;
  property: string;
  location: string;
  status: string;
  statusTone: StatusTone;
  submitted: string;
  recruiter: string;
  recruiterRole: string;
  stages: StageEvent[];
  nextStep?: string;
}

const statusStyles: Record<StatusTone, { chip: string; dot: string; gradient: string }> = {
  teal: {
    chip: 'bg-canvas-primary-tint text-canvas-primary border-canvas-primary/15',
    dot: 'bg-canvas-primary',
    gradient: TONE_GRADIENT.teal,
  },
  amber: {
    chip: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    gradient: TONE_GRADIENT.amber,
  },
  gray: {
    chip: 'bg-canvas-surface-subtle text-canvas-muted border-canvas-border',
    dot: 'bg-gray-400',
    gradient: TONE_GRADIENT.slate,
  },
  indigo: {
    chip: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dot: 'bg-indigo-500',
    gradient: TONE_GRADIENT.indigo,
  },
};

// Generic example data — tenants override via `<CanvasShell config.panelData.applications>`.
// These are placeholder applications for the OSS demo.
const DEFAULT_APPLICATIONS: Application[] = [
  {
    id: 'app-1',
    role: 'Engineering Manager',
    property: 'Headquarters',
    location: 'Austin, TX',
    status: 'Interview scheduled',
    statusTone: 'teal',
    submitted: 'Mar 12, 2026',
    recruiter: 'Alicia Thompson',
    recruiterRole: 'Senior Recruiter, Engineering',
    nextStep: 'Panel interview — Apr 24, 10:00 AM ET',
    stages: [
      { label: 'Application submitted', date: 'Mar 12', done: true },
      { label: 'Resume reviewed', date: 'Mar 15', done: true, note: '94% match on skills' },
      { label: 'Phone screen', date: 'Mar 22', done: true, note: '30-min intro with Alicia' },
      { label: 'Panel interview', date: 'Apr 24', done: false, note: 'Hiring manager + 2 ICs' },
      { label: 'Offer decision', date: 'TBD', done: false },
    ],
  },
  {
    id: 'app-2',
    role: 'Customer Success Specialist',
    property: 'Regional Office',
    location: 'Chicago, IL',
    status: 'Under review',
    statusTone: 'amber',
    submitted: 'Mar 8, 2026',
    recruiter: 'Marco Reyes',
    recruiterRole: 'Recruiter, Customer Success',
    nextStep: 'Recruiter will reach out within 5 business days',
    stages: [
      { label: 'Application submitted', date: 'Mar 8', done: true },
      { label: 'Under recruiter review', date: 'Mar 10', done: true, note: 'In the active pile' },
      { label: 'Phone screen', date: 'TBD', done: false },
      { label: 'Onsite interview', date: 'TBD', done: false },
      { label: 'Offer decision', date: 'TBD', done: false },
    ],
  },
  {
    id: 'app-3',
    role: 'Senior Software Engineer',
    property: 'Distributed',
    location: 'Remote (US)',
    status: 'Draft',
    statusTone: 'gray',
    submitted: 'Mar 1, 2026',
    recruiter: '—',
    recruiterRole: 'Not yet assigned',
    nextStep: 'Finish your cover letter to submit',
    stages: [
      { label: 'Draft started', date: 'Mar 1', done: true },
      { label: 'Resume attached', date: 'Mar 3', done: true },
      { label: 'Cover letter', date: 'In progress', done: false, note: 'The assistant can help you tailor it' },
      { label: 'Submit application', date: 'TBD', done: false },
    ],
  },
];

export function ApplicationsPanel() {
  const { panels } = useLayoutStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Tenant-injected list overrides the library example data.
  const tenantApps = useCanvasConfig().panelData.applications as
    | readonly Application[]
    | undefined;
  const applications = tenantApps ?? DEFAULT_APPLICATIONS;

  const layout = panels.applications;
  if (!layout?.visible) return null;

  const selected = selectedId ? applications.find((a) => a.id === selectedId) ?? null : null;
  const activeCount = applications.filter((a) => a.statusTone !== 'gray').length;

  return (
    <DraggablePanel id="applications" title={selected ? selected.role : `My Applications · ${activeCount} active`}>
      <div className="flex flex-col h-full bg-[#FAFAF8]">
        {selected ? (
          <ApplicationDetail app={selected} onBack={() => setSelectedId(null)} />
        ) : (
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {applications.map((app) => {
              const tone = statusStyles[app.statusTone];
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => setSelectedId(app.id)}
                  className="w-full text-left bg-canvas-surface rounded-xl border border-canvas-border hover:border-canvas-primary/35 hover:shadow-[0_8px_28px_rgba(15,23,42,0.06)] transition-all p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[15px] font-semibold text-canvas tracking-tight truncate">{app.role}</h3>
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[12px] text-[#6B7280]">
                        <span className="flex items-center gap-1"><Building2 size={11} /> {app.property}</span>
                        <span className="flex items-center gap-1"><MapPin size={11} /> {app.location}</span>
                      </div>
                    </div>
                    <span className={`${tone.chip} border rounded-full px-2.5 py-0.5 text-[10.5px] font-medium whitespace-nowrap shrink-0`}>
                      {app.status}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-1">
                    {app.stages.map((s, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full ${s.done ? tone.dot : 'bg-canvas-border'}`}
                      />
                    ))}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2 text-[11.5px] text-canvas-faint">
                    <span className="flex items-center gap-1"><Calendar size={11} /> Submitted {app.submitted}</span>
                    <span className="text-canvas-primary font-medium">View details →</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </DraggablePanel>
  );
}

function ApplicationDetail({ app, onBack }: { app: Application; onBack: () => void }) {
  const tone = statusStyles[app.statusTone];
  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-3 py-2 bg-canvas-surface border-b border-canvas-border flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium text-canvas-muted hover:bg-canvas-surface-subtle hover:text-canvas transition-colors"
        >
          <ArrowLeft size={13} /> All applications
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-5 pb-4 text-white" style={{ background: tone.gradient }}>
          <span className="inline-block text-[10.5px] font-semibold uppercase tracking-[0.08em] bg-canvas-surface/20 backdrop-blur rounded-full px-2 py-0.5">
            {app.status}
          </span>
          <h2 className="mt-2 text-[22px] font-semibold tracking-tight leading-tight">{app.role}</h2>
          <p className="text-[12.5px] text-white/90 mt-0.5 flex items-center flex-wrap gap-x-3 gap-y-0.5">
            <span className="flex items-center gap-1"><Building2 size={12} /> {app.property}</span>
            <span className="flex items-center gap-1"><MapPin size={12} /> {app.location}</span>
          </p>

          {app.nextStep && (
            <div className="mt-4 bg-canvas-surface/20 backdrop-blur rounded-lg px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-white/80">Next step</p>
              <p className="text-[13.5px] font-semibold mt-0.5">{app.nextStep}</p>
            </div>
          )}
        </div>

        <div className="px-4 py-4 space-y-5">
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-canvas-faint mb-3">Timeline</h3>
            <ol className="space-y-3">
              {app.stages.map((stage, i) => (
                <li key={i} className="flex gap-3">
                  <div className="relative shrink-0">
                    {stage.done ? (
                      <CheckCircle2 size={18} className="text-canvas-primary" fill="currentColor" color="white" stroke="currentColor" />
                    ) : (
                      <Circle size={18} className="text-canvas-faint" />
                    )}
                    {i < app.stages.length - 1 && (
                      <div className={`absolute left-1/2 -translate-x-1/2 top-[18px] w-px h-[calc(100%+12px)] ${stage.done ? 'bg-canvas-primary/30' : 'bg-canvas-border'}`} />
                    )}
                  </div>
                  <div className="flex-1 pb-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-[13.5px] font-medium ${stage.done ? 'text-canvas' : 'text-canvas-faint'}`}>
                        {stage.label}
                      </p>
                      <span className="text-[11px] text-canvas-faint whitespace-nowrap">{stage.date}</span>
                    </div>
                    {stage.note && (
                      <p className="text-[12px] text-canvas-faint mt-0.5 leading-relaxed">{stage.note}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="bg-canvas-surface rounded-xl border border-canvas-border p-3.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-canvas-faint mb-2">Your recruiter</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-canvas-primary to-canvas-primary-light flex items-center justify-center text-white text-sm font-bold shrink-0">
                {app.recruiter.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-canvas truncate">{app.recruiter}</p>
                <p className="text-[11.5px] text-canvas-faint truncate">{app.recruiterRole}</p>
              </div>
              <button
                type="button"
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11.5px] font-medium text-canvas-primary hover:bg-canvas-primary/8 transition-colors"
              >
                <MessageSquare size={12} /> Message
              </button>
            </div>
          </section>
        </div>
      </div>

      <div className="shrink-0 border-t border-canvas-border px-4 py-3 bg-canvas-surface flex items-center gap-2">
        <button type="button" className="flex items-center gap-1 px-3 py-2 rounded-lg text-[12.5px] font-medium text-canvas-muted hover:bg-canvas-surface-subtle transition-colors">
          <FileText size={13} /> View resume
        </button>
        <button
          type="button"
          className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white transition-all"
          style={{ background: tone.gradient }}
        >
          <Clock size={13} /> Prep for next step
        </button>
      </div>
    </div>
  );
}
