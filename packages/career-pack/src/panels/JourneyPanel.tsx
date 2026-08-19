import type { ReactElement } from 'react';
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import type { ReactPanelLoaderProps } from '../../../../src/panels/registry';

const STEPS = [
  {
    id: 'profile',
    title: 'Complete your profile',
    detail: 'Add work history so Sandy can score role fit.',
    done: true,
  },
  {
    id: 'apply',
    title: 'Submit Resort Manager application',
    detail: 'Interview scheduled — prep materials in Applications.',
    done: true,
  },
  {
    id: 'learning',
    title: 'Start SCU onboarding guide',
    detail: '15 min read · recommended before your panel interview.',
    done: false,
  },
  {
    id: 'path',
    title: 'Review Front Office growth path',
    detail: '91% fit — compare salary milestones.',
    done: false,
  },
] as const;

export function JourneyPanel(_props: ReactPanelLoaderProps): ReactElement {
  return (
    <div className="flex flex-col h-full min-h-[380px]" data-testid="journey-panel">
      <div className="shrink-0 px-4 py-3 border-b border-canvas-border">
        <h2 className="text-[15px] font-semibold text-canvas">Your Journey & Next Steps</h2>
        <p className="text-[12px] text-canvas-muted mt-0.5">Personalized checklist from Sandy</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {STEPS.map((step, index) => (
          <div
            key={step.id}
            className="flex gap-3 rounded-xl border border-canvas-border bg-canvas-surface p-3.5"
            data-testid={`journey-step-${step.id}`}
          >
            {step.done ? (
              <CheckCircle2 size={20} className="text-canvas-primary shrink-0 mt-0.5" />
            ): (
              <Circle size={20} className="text-canvas-faint shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-canvas">{step.title}</p>
              <p className="text-[12px] text-canvas-muted mt-1">{step.detail}</p>
            </div>
            {!step.done ? (
              <button
                type="button"
                className="shrink-0 self-center text-canvas-primary hover:bg-canvas-primary-tint p-1.5 rounded-lg"
                aria-label={`Start ${step.title}`}
              >
                <ArrowRight size={16} />
              </button>
            ): null}
            {index < STEPS.length - 1 ? null: null}
          </div>
        ))}
      </div>
    </div>
  );
}
