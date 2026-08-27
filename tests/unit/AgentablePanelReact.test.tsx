/**
 * React `<AgentablePanel>` wrapper smoke tests.
 */
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AgentablePanel } from '../../src/react/AgentablePanel';

describe('AgentablePanel React wrapper', () => {
  it('renders agentable-panel with panel id', async () => {
    const { container } = render(
      <AgentablePanel panel="open-positions" skipReactMount />);

    await waitFor(() => {
      const el = container.querySelector('agentable-panel');
      expect(el).not.toBeNull();
      expect(el?.getAttribute('panel')).toBe('open-positions');
    });
  });

  it('forwards onPanelReady from typed event map', async () => {
    const onPanelReady = vi.fn();

    render(
      <AgentablePanel
        panel="applications"
        skipReactMount
        primaryColor="#112233"
        onPanelReady={onPanelReady}
      />);

    const el = document.querySelector('agentable-panel');
    expect(el).not.toBeNull();

    el?.dispatchEvent(
      new CustomEvent('agentable:panel-ready', {
        bubbles: true,
        composed: true,
        detail: { panelId: 'applications', definitionKind: 'spec' },
      }));

    expect(onPanelReady).toHaveBeenCalledTimes(1);
    expect(onPanelReady.mock.calls[0]?.[0].detail.panelId).toBe('applications');
  });

  it('exposes reload via ref handle', async () => {
    const ref = { current: null as import('../../src/react/AgentablePanel').AgentablePanelHandle | null };

    render(
      <AgentablePanel
        ref={(handle) => {
          ref.current = handle;
        }}
        panel="resources"
        skipReactMount
      />);

    await waitFor(() => {
      expect(ref.current?.element).not.toBeNull();
    });

    const reloadSpy = vi.spyOn(ref.current!.element!, 'reload').mockResolvedValue(undefined);
    await ref.current!.reload();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
