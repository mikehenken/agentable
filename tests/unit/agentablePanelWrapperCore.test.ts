/**
 * shared wrapper core — props sync + typed event forwarding.
 */
import '../../src/embed/agentable-panel';
import type { AgentablePanelElement } from '../../src/embed/agentable-panel';
import {
  AGENTABLE_PANEL_WRAPPER_EVENT_NAMES,
  applyAgentablePanelProps,
  bindAgentablePanelEvents,
  createAgentablePanelEventBindings,
} from '../../src/embed/wrappers/agentablePanelWrapperCore';

describe('agentablePanelWrapperCore', () => {
  let panel: AgentablePanelElement;

  beforeEach(async () => {
    await customElements.whenDefined('agentable-panel');
    panel = document.createElement('agentable-panel') as AgentablePanelElement;
    panel.setAttribute('data-skip-react-mount', '');
    document.body.appendChild(panel);
  });

  afterEach(() => {
    panel.remove();
  });

  it('exports all seven panel event names', () => {
    expect(AGENTABLE_PANEL_WRAPPER_EVENT_NAMES).toEqual([
      'agentable:config-reloaded',
      'agentable:panel-ready',
      'agentable:adapter-loaded',
      'agentable:panel-error',
      'agentable:chrome-changed',
      'agentable:approval-pending',
      'agentable:phase-changed',
    ]);
  });

  it('creates seven lazy event bindings', () => {
    const bindings = createAgentablePanelEventBindings(() => ({}));
    expect(bindings).toHaveLength(7);
  });

  it('applyAgentablePanelProps syncs camelCase props to attributes', () => {
    applyAgentablePanelProps(panel, {
      panel: 'open-positions',
      primaryColor: '#0077B6',
      locale: 'en',
      hideChrome: true,
      lazyHydrate: true,
      anonKey: 'anon-test',
    });

    expect(panel.getAttribute('panel')).toBe('open-positions');
    expect(panel.getAttribute('primary-color')).toBe('#0077B6');
    expect(panel.getAttribute('locale')).toBe('en');
    expect(panel.hasAttribute('hide-chrome')).toBe(true);
    expect(panel.hasAttribute('lazy-hydrate')).toBe(true);
    expect(panel.getAttribute('anon-key')).toBe('anon-test');
  });

  it('bindAgentablePanelEvents forwards typed custom events', () => {
    const ready = vi.fn();
    const phase = vi.fn();

    bindAgentablePanelEvents(panel, () => ({
      onPanelReady: ready,
      onPhaseChanged: phase,
    }));

    panel.dispatchEvent(
      new CustomEvent('agentable:panel-ready', {
        bubbles: true,
        composed: true,
        detail: { panelId: 'open-positions', definitionKind: 'react' },
      }));

    panel.dispatchEvent(
      new CustomEvent('agentable:phase-changed', {
        bubbles: true,
        composed: true,
        detail: { panelId: 'open-positions', phase: 'ready' },
      }));

    expect(ready).toHaveBeenCalledTimes(1);
    expect(ready.mock.calls[0]?.[0].detail.panelId).toBe('open-positions');
    expect(phase).toHaveBeenCalledTimes(1);
    expect(phase.mock.calls[0]?.[0].detail.phase).toBe('ready');
  });

  it('unbind removes listeners', () => {
    const ready = vi.fn();
    const unbind = bindAgentablePanelEvents(panel, () => ({ onPanelReady: ready }));

    unbind();
    panel.dispatchEvent(
      new CustomEvent('agentable:panel-ready', {
        bubbles: true,
        composed: true,
        detail: { panelId: 'applications', definitionKind: 'react' },
      }));

    expect(ready).not.toHaveBeenCalled;
  });

  it('reads latest handler from getter on each dispatch', () => {
    let handler: ((event: CustomEvent) => void) | undefined = vi.fn();
    bindAgentablePanelEvents(panel, () => ({
      onAdapterLoaded: handler,
    }));

    handler = vi.fn();

    panel.dispatchEvent(
      new CustomEvent('agentable:adapter-loaded', {
        bubbles: true,
        composed: true,
        detail: { ok: true, panelId: 'resources' },
      }));

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
