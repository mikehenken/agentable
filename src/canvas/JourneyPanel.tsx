import { DraggablePanel } from './DraggablePanel';
import { useLayoutStore } from '../stores/layoutStore';

const milestones = [
  { id: 'started', label: 'Started\nchat', completed: true },
  { id: 'resume', label: 'Resume\nuploaded', completed: true },
  { id: 'career', label: 'Career\npath', completed: false, current: true },
  { id: 'interview', label: 'Interview', completed: false },
  { id: 'apply', label: 'Apply', completed: false },
  { id: 'start', label: 'Start\nwork', completed: false },
];

export function JourneyPanel() {
  const { panels } = useLayoutStore();
  const layout = panels.journey;

  if (!layout?.visible) return null;

  return (
    <DraggablePanel id="journey" title="Your Journey & Next Steps">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Progress bar */}
        <div className="relative flex items-start justify-between mb-1 px-1">
          <div className="absolute top-3 left-6 right-6 h-0.5 bg-canvas-border -z-0" />
          <div className="absolute top-3 left-6 h-0.5 bg-canvas-primary -z-0" style={{ width: '28%' }} />

          {milestones.map((m) => (
            <div key={m.id} className="flex flex-col items-center relative z-10">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  m.completed
                    ? 'bg-canvas-primary text-white'
                    : m.current
                    ? 'bg-canvas-primary text-white ring-2 ring-canvas-primary ring-offset-2'
                    : 'bg-canvas-surface border-2 border-canvas-border text-canvas-faint'
                }`}
              >
                {m.completed ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="2 6 5 9 10 3" />
                  </svg>
                ) : null}
              </div>
              <span className={`text-[10px] mt-1.5 text-center whitespace-pre-line leading-tight max-w-[60px] ${
                m.completed || m.current ? 'text-canvas-muted font-medium' : 'text-canvas-faint'
              }`}>
                {m.label}
              </span>
            </div>
          ))}
        </div>

        {/* NEXT STEPS */}
        <h3 className="text-[11px] font-semibold text-canvas-faint uppercase tracking-wider mt-6 mb-3">Next Steps</h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="border border-canvas-border rounded-xl p-3.5">
            <p className="text-sm text-canvas-muted mb-3 leading-snug">Explore career paths at your nearest resort</p>
            <button className="w-full py-2 bg-canvas-primary hover:bg-canvas-primary-hover text-white text-xs font-medium rounded-lg transition-colors">
              View Career Paths
            </button>
          </div>
          <div className="border border-canvas-border rounded-xl p-3.5">
            <p className="text-sm text-canvas-muted mb-3 leading-snug">Schedule an informational interview with a recruiter</p>
            <button className="w-full py-2 bg-canvas-primary hover:bg-canvas-primary-hover text-white text-xs font-medium rounded-lg transition-colors">
              Schedule Interview
            </button>
          </div>
        </div>
      </div>
    </DraggablePanel>
  );
}
