/**
 * automated_check: career pack panels render from es catalog under locale es.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createCareerPack } from '@agentable/career-pack';
import { careerDatasetToPanelData } from '@agentable/career-pack';
import { OpenPositionsPanel } from '../../packages/career-pack/src/panels/OpenPositionsPanel';
import { SANDALS_CAREER_DATASET } from '@agentable/career-pack';
import { Header } from '../../src/panels/catalog/components';
import { bootstrapSessionLocale, getI18n } from '../../src/i18n';
import type { SpecNodeContextValue } from '../../src/panels/types';

const POPULATED_CONTEXT: SpecNodeContextValue = {
  scope: {},
  data: {},
  dispatch: () => undefined,
  isDirty: false,
  setDirty: () => undefined,
  state: 'populated',
};

const SAMPLE_JOBS = careerDatasetToPanelData(SANDALS_CAREER_DATASET).jobs ?? [];

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
    expect(screen.getByRole('searchbox')).toBeInTheDocument;
    expect(screen.getByText(/Open Positions ·/)).toBeInTheDocument;
    expect(getI18n().locale).toBe('es');
  });

  it('SC2: en locale keeps English career panel copy', () => {
    bootstrapSessionLocale({});
    const pack = createCareerPack();
    const panel = pack.panels.find((entry) => entry.id === 'growth-paths');
    expect(panel?.kind).toBe('spec');
    if (panel?.kind !== 'spec') return;

    render(
      <Header
        title={String(panel.spec.nodes.header?.props?.title)}
        subtitle={String(panel.spec.nodes.header?.props?.subtitle ?? '')}
        context={POPULATED_CONTEXT}
      />);

    expect(screen.getByTestId('header')).toHaveTextContent('Growth Paths');
  });

  it('SC3: renders Arabic open-positions list when locale is ar', () => {
    bootstrapSessionLocale({ embedLocale: 'ar' });
    render(<OpenPositionsPanel data={{ jobs: SAMPLE_JOBS.slice(0, 3) }} hostedInWhiteboard={false} />);
    expect(screen.getByTestId('open-positions-panel')).toBeInTheDocument;
    expect(screen.getByText('Resort Manager')).toBeInTheDocument;
    expect(getI18n().locale).toBe('ar');
  });
});
