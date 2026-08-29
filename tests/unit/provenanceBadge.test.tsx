/**
 * automated check: component provenance badge.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProvenanceBadge } from '../../src/panels/provenance';
import { PanelChrome } from '../../src/engines/tldraw/shapes/PanelChrome';

describe('ProvenanceBadge', () => {
  it('renders the agent badge when visible', () => {
    render(<ProvenanceBadge visible />);
    const badge = screen.getByTestId('panel-provenance-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Agent');
  });

  it('renders nothing for host-origin panels', () => {
    render(<ProvenanceBadge visible={false} />);
    expect(screen.queryByTestId('panel-provenance-badge')).toBeNull();
  });
});

describe('PanelChrome provenance', () => {
  it('shows the provenance badge for agent composed panels', () => {
    render(
      <PanelChrome
        panelId="composed-1"
        title="SEO draft"
        minimized={false}
        showProvenanceBadge
        showPinButton
      />);

    expect(screen.getByTestId('panel-provenance-badge')).toBeInTheDocument();
    expect(screen.getByTestId('panel-pin-button')).toBeInTheDocument();
  });

  it('hides the pin button once the composed panel is pinned', () => {
    render(
      <PanelChrome
        panelId="composed-1"
        title="SEO draft"
        minimized={false}
        showProvenanceBadge
        showPinButton
        pinned
      />);

    expect(screen.getByTestId('panel-provenance-badge')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-pin-button')).toBeNull();
  });
});
