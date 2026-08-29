import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { careerDatasetToPanelData } from '@agentable/career-pack';
import { OpenPositionsPanel } from '../../packages/career-pack/src/panels/OpenPositionsPanel';
import archipelagoFixture from '../../examples/shared/archipelago-career-data.json';

describe('OpenPositionsPanel', () => {
  it('renders search, department chips, and at least eight job titles', () => {
    const jobs = careerDatasetToPanelData(archipelagoFixture).jobs ?? [];
    render(<OpenPositionsPanel data={{ jobs }} hostedInWhiteboard={false} />);

    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.getByText(/Open Positions · 10/)).toBeInTheDocument();
    expect(screen.getByText('Guest Experience Lead')).toBeInTheDocument();
    expect(screen.getByText('Environmental Programs Coordinator')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Guest Services' })).toBeInTheDocument();
  });

  it('opens job detail when a card is clicked', async () => {
    const user = userEvent.setup;
    const jobs = careerDatasetToPanelData(archipelagoFixture).jobs ?? [];
    render(<OpenPositionsPanel data={{ jobs }} hostedInWhiteboard={false} />);

    await user().click(screen.getByLabelText('Open Guest Experience Lead details'));
    expect(screen.getByTestId('open-positions-job-detail-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /All positions/i })).toBeInTheDocument();
  });
});
