import type { PanelJobRow } from '../adapters/careerDatasetToPanelData';

export type JobDeptTone = PanelJobRow['tone'];

export interface JobToneStyle {
  bar: string;
  chip: string;
  chipText: string;
  detailHero: string;
}

const TONE_STYLES: Record<JobDeptTone, JobToneStyle> = {
  teal: {
    bar: 'bg-canvas-primary',
    chip: 'bg-canvas-primary-tint',
    chipText: 'text-canvas-primary',
    detailHero: 'linear-gradient(135deg, #0e7490 0%, #0891b2 100%)',
  },
  amber: {
    bar: 'bg-amber-500',
    chip: 'bg-amber-50',
    chipText: 'text-amber-800',
    detailHero: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
  },
  indigo: {
    bar: 'bg-indigo-500',
    chip: 'bg-indigo-50',
    chipText: 'text-indigo-700',
    detailHero: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
  },
  rose: {
    bar: 'bg-rose-500',
    chip: 'bg-rose-50',
    chipText: 'text-rose-700',
    detailHero: 'linear-gradient(135deg, #e11d48 0%, #fb7185 100%)',
  },
  emerald: {
    bar: 'bg-emerald-500',
    chip: 'bg-emerald-50',
    chipText: 'text-emerald-700',
    detailHero: 'linear-gradient(135deg, #059669 0%, #34d399 100%)',
  },
};

export function jobToneStyle(tone: JobDeptTone | undefined): JobToneStyle {
  if (tone !== undefined && tone in TONE_STYLES) {
    return TONE_STYLES[tone];
  }
  return TONE_STYLES.teal;
}
