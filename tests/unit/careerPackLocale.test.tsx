/**
 * automated_check: career pack panels render from es catalog under locale es.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createCareerPack } from '@agentable/career-pack';
import { careerDatasetToPanelData } from '@agentable/career-pack';
import { OpenPositionsPanel } from '../../packages/career-pack/src/panels/OpenPositionsPanel';
import { GrowthPathsPanel } from '../../packages/career-pack/src/panels/GrowthPathsPanel';
import { ARCHIPELAGO_CAREER_DATASET } from '@agentable/career-pack';
import { bootstrapSessionLocale, getI18n } from '../../src/i18n';

const PANEL_DATA = careerDatasetToPanelData(ARCHIPELAGO_CAREER_DATASET);
const SAMPLE_JOBS = PANEL_DATA.jobs ?? [];

afterEach(() => {
  bootstrapSessionLocale({});
});

describe('career pack locale rendering', () => {
  it('SC1: open-positions is a react panel with ListPanel search', () => {
    bootstrapSessionLocale({ embedLocale: 'es' });
    const pack = createCareerPack();
    const panel = pack.panels.find((entry) => entry.id === 'open-positions');
    expect(panel?.kind).toBe('react');

    render(<OpenPositionsPanel data={{ jobs: SAMPLE_JOBS }} hostedInWhiteboard={false} />);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.getByText(/Open Positions ·/)).toBeInTheDocument();
    expect(getI18n().locale).toBe('es');
  });

  it('SC2: growth-paths is a react panel that keeps English copy under en locale', () => {
    // Growth paths is one of the nine all-react career panels (drift-guarded by
    // CAREER_PANEL_IDS); it is no longer a spec panel. Under the en locale its
    // header copy stays English.
    bootstrapSessionLocale({});
    const pack = createCareerPack();
    const panel = pack.panels.find((entry) => entry.id === 'growth-paths');
    expect(panel?.kind).toBe('react');

    render(<GrowthPathsPanel data={PANEL_DATA} />);

    expect(screen.getByTestId('growth-paths-panel')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Growth Paths' })).toBeInTheDocument();
    expect(getI18n().locale).toBe('en');
  });

  it('SC3: renders Arabic open-positions list when locale is ar', () => {
    bootstrapSessionLocale({ embedLocale: 'ar' });
    render(<OpenPositionsPanel data={{ jobs: SAMPLE_JOBS.slice(0, 3) }} hostedInWhiteboard={false} />);
    expect(screen.getByTestId('open-positions-panel')).toBeInTheDocument();
    expect(screen.getByText('Resort Manager')).toBeInTheDocument();
    expect(getI18n().locale).toBe('ar');
  });
});
