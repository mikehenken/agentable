/**
 * Component tests for `<agentable-operator-surface-placement>`.
 *
 * Proves all four placements mount `<agentable-operator-surface>`, emit typed
 * lifecycle events, and share the page session.
 */
import { expect, elementUpdated, oneEvent } from '@open-wc/testing';
import '../../src/agents/surface/operator-surface-placement';
import type { AgentableOperatorSurfacePlacementElement } from '../../src/agents/surface/operator-surface-placement';
import {
  OPERATOR_SURFACE_PLACEMENT_KINDS,
  type OperatorSurfacePlacementKind,
} from '../../src/agents/surface/placementTypes';
import { OPERATOR_SURFACE_TAG } from '../../src/agents/surface/constants';
import {
  __resetPageSessionForTests__,
  ensurePageSession,
} from '../../src/session/pageSession';
import { __resetPageSlotsForTests__, ensurePageSlotRegistry } from '../../src/session/pageSlots';
import {
  clearModelResolverForTests,
  resetOperatorModelBridgeForTests,
} from '../../src/agents/surface/operatorModelBridge';

async function createPlacementElement(
  placement: OperatorSurfacePlacementKind,
  placementId = `test-${placement}`): Promise<AgentableOperatorSurfacePlacementElement> {
  const el = document.createElement(
    'agentable-operator-surface-placement') as AgentableOperatorSurfacePlacementElement;
  el.placement = placement;
  el.placementId = placementId;
  if (placement === 'slot') {
    el.slotName = 'operator-sidebar';
  }
  document.body.appendChild(el);
  await elementUpdated(el);
  return el;
}

describe('<agentable-operator-surface-placement>', () => {
  beforeEach(() => {
    __resetPageSessionForTests__();
    __resetPageSlotsForTests__();
    resetOperatorModelBridgeForTests();
    clearModelResolverForTests();
  });

  afterEach(() => {
    resetOperatorModelBridgeForTests();
    clearModelResolverForTests();
    document.body.innerHTML = '';
  });

  describe('registration', () => {
    it('registers the custom element', async () => {
      await createPlacementElement('dock-inside');
      expect(customElements.get('agentable-operator-surface-placement')).to.not.equal(undefined);
    });
  });

  for (const placement of OPERATOR_SURFACE_PLACEMENT_KINDS) {
    describe(`placement="${placement}"`, () => {
      it('mounts nested agentable-operator-surface without error', async () => {
        const el = await createPlacementElement(placement);
        const surface = el.getOperatorSurface;
        expect(surface).to.not.equal(null);
        expect(surface?.().tagName.toLowerCase()).to.equal(OPERATOR_SURFACE_TAG);
      });

      it('mounts exactly one nested operator surface ', async () => {
        const el = await createPlacementElement(placement);
        const surfaces = el.shadowRoot?.querySelectorAll(OPERATOR_SURFACE_TAG) ?? [];
        expect(surfaces.length).to.equal(1);
      });

      it('emits landi:operator-placement-mounted with typed detail', async () => {
        const el = document.createElement(
          'agentable-operator-surface-placement') as AgentableOperatorSurfacePlacementElement;
        el.placement = placement;
        el.placementId = `test-${placement}`;
        if (placement === 'slot') {
          el.slotName = 'operator-sidebar';
        }

        const mountedPromise = oneEvent(el, 'landi:operator-placement-mounted');
        document.body.appendChild(el);
        await elementUpdated(el);

        const event = await mountedPromise;
        expect(event.detail.placement).to.equal(placement);
        expect(event.detail.placementId).to.equal(`test-${placement}`);
        expect(typeof event.detail.pageSessionId).to.equal('string');
        expect(event.detail.pageSessionId.length).to.be.greaterThan(0);

        if (placement === 'slot') {
          expect(event.detail.slotName).to.equal('operator-sidebar');
        } else {
          expect(event.detail.slotName).to.equal(undefined);
        }
      });

      it('emits landi:operator-placement-interacted on pointer activation', async () => {
        const el = await createPlacementElement(placement);
        const interactedPromise = oneEvent(el, 'landi:operator-placement-interacted');
        const root = el.shadowRoot?.querySelector('[part="placement-root"]');
        expect(root).to.not.equal(null);
        root?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));

        const event = await interactedPromise;
        expect(event.detail.placement).to.equal(placement);
        expect(event.detail.placementId).to.equal(`test-${placement}`);
        expect(event.detail.interactionKind).to.equal('pointerdown');
        expect(event.detail.pageSessionId).to.equal(ensurePageSession().sessionId);
      });
    });
  }

  describe('slot placement registry', () => {
    it('registers slot-name with the page slot registry', async () => {
      const el = await createPlacementElement('slot');
      const mountElement = ensurePageSlotRegistry().get('operator-sidebar');
      expect(mountElement).to.equal(el);
    });
  });

  describe('shared page session ', () => {
    it('uses the same session id across all four placements on one page', async () => {
      const sessionBefore = ensurePageSession().sessionId;
      const mountedSessionIds: string[] = [];

      for (const placement of OPERATOR_SURFACE_PLACEMENT_KINDS) {
        const el = await createPlacementElement(placement, `shared-${placement}`);
        const surface = el.getOperatorSurface;
        expect(surface).to.not.equal(null);
        mountedSessionIds.push(ensurePageSession().sessionId);
      }

      expect(mountedSessionIds).to.have.length(4);
      for (const sessionId of mountedSessionIds) {
        expect(sessionId).to.equal(sessionBefore);
      }

      const snapshot = ensurePageSession().getSnapshot;
      expect(snapshot().chatSurfaceCount).to.be.greaterThan(0);
      expect(snapshot().participantIds.length).to.be.greaterThan(0);
    });
  });
});
