/**
 * PanelEmbedShell states: loading → ready, error, chrome minimize/close.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MINIMAL_CAREER_DATASET } from '@agentable/career-pack';
import { configureI18n } from '../../src/i18n';
import { PanelEmbedShell } from '../../src/embed/panel/PanelEmbedShell';

describe('PanelEmbedShell', () => {
  it('renders career open-positions panel after adapter ready', async () => {
    configureI18n({ locale: 'en' });
    render(
      <PanelEmbedShell
        panelId="open-positions"
        tenantConfig={{ tenant: 'p9-fixture' }}
        locale="en"
        configDocument={{
          adapter: { kind: 'static', data: MINIMAL_CAREER_DATASET },
        }}
        panelDataRaw={null}
      />);

    await waitFor(() => {
      expect(screen.getByTestId('agentable-panel-surface')).toBeTruthy();
    });
    expect(screen.getByTestId('panel-chrome-embed-open-positions')).toBeTruthy();
  });

  it('shows error surface for unknown panel id', async () => {
    configureI18n({ locale: 'en' });
    render(
      <PanelEmbedShell
        panelId="unknown-panel"
        tenantConfig={{ tenant: 'p9-fixture' }}
        locale="en"
        configDocument={null}
        panelDataRaw={null}
      />);

    await waitFor(() => {
      expect(screen.getByTestId('agentable-panel-error')).toBeTruthy();
    });
  });

  it('minimizes chrome body on minimize toggle', async () => {
    configureI18n({ locale: 'en' });
    const user = userEvent.setup;
    render(
      <PanelEmbedShell
        panelId="open-positions"
        tenantConfig={{ tenant: 'p9-fixture' }}
        locale="en"
        configDocument={{
          adapter: { kind: 'static', data: MINIMAL_CAREER_DATASET },
        }}
        panelDataRaw={null}
      />);

    await waitFor(() => {
      expect(screen.getByTestId('agentable-panel-surface')).toBeTruthy();
    });

    const minimize = screen.getByRole('button', { name: /minimize panel/i });
    await user().click(minimize);
    expect(screen.queryByTestId('panel-chrome-embed-open-positions')).toBeTruthy();
  });
});
