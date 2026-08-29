import { describe, it, expect, beforeEach } from 'vitest';
import { usePanelEngagementStore } from '../../src/stores/panelEngagementStore';

describe('usePanelEngagementStore', () => {
  beforeEach(() => {
    usePanelEngagementStore.setState({
      history: [],
      lastEngagedAt: {},
      stackOrder: [],
    });
  });

  it('assigns higher z-index bases to more recently engaged panels', () => {
    const store = usePanelEngagementStore.getState;
    store().recordEngagement('history', 'open');
    store().recordEngagement('site-seo', 'open');

    const historyZ = usePanelEngagementStore.getState().getZIndexBase('history');
    const seoZ = usePanelEngagementStore.getState().getZIndexBase('site-seo');

    expect(seoZ).toBeGreaterThan(historyZ);
  });

  it('moves a panel to the top when bringToFront is called', () => {
    const store = usePanelEngagementStore.getState;
    store().recordEngagement('history', 'open');
    store().recordEngagement('site-seo', 'open');
    store().bringToFront('history');

    const historyZ = usePanelEngagementStore.getState().getZIndexBase('history');
    const seoZ = usePanelEngagementStore.getState().getZIndexBase('site-seo');

    expect(historyZ).toBeGreaterThan(seoZ);
  });

  it('toSnapshot returns the current engagement state, not undefined fields', () => {
    const store = usePanelEngagementStore.getState;
    store().recordEngagement('history', 'open');
    store().recordEngagement('site-seo', 'open');

    const snapshot = store().toSnapshot();

    expect(snapshot.stackOrder).toEqual(['history', 'site-seo']);
    expect(snapshot.lastEngagedAt['history']).toBeTypeOf('number');
    expect(snapshot.lastEngagedAt['site-seo']).toBeTypeOf('number');
  });
});
