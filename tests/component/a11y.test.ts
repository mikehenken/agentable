/**
 * Accessibility component tests for the Lit elements.
 *
 * Per `web-components-ui.md` §9.2 — every major component state must
 * pass an axe smoke test for 0 critical/serious WCAG 2.1 AA violations.
 * Uses `@open-wc/testing`'s `expect(el).to.be.accessible()` which runs
 * axe-core internally against the rendered element.
 */
import { fixture, expect, html, elementUpdated } from '@open-wc/testing';
import '../../src/embed/agentable-canvas';
import '../../src/embed/voice-call-button';
import { ensureVoiceKernel, __resetKernelForTests__ } from '../../src/shared/voiceKernel';
import type { VoiceCallButtonElement } from '../../src/embed/voice-call-button';
import type { AgentableCanvasElement } from '../../src/embed/agentable-canvas';

describe('a11y smokes', () => {
  beforeEach(() => {
    __resetKernelForTests__();
    ensureVoiceKernel();
  });

  it('<agentable-canvas> default state has 0 critical/serious axe violations', async () => {
    const el = await fixture<AgentableCanvasElement>(
      html`<agentable-canvas data-skip-react-mount></agentable-canvas>`
    );
    await elementUpdated(el);
    await expect(el).to.be.accessible();
  });

  it('<voice-call-button> idle state is accessible', async () => {
    const el = await fixture<VoiceCallButtonElement>(
      html`<voice-call-button>Talk with our AI</voice-call-button>`
    );
    await elementUpdated(el);
    await expect(el).to.be.accessible();
  });

  it('<voice-call-button> listening state is accessible', async () => {
    // The chip uses translucent backgrounds (color-mix at 30% alpha). Axe
    // computes contrast against the host page's actual background; the
    // button is designed for dark/colored backdrops — a hero CTA over a
    // dark hero, a nav over a colored bar — not over default white.
    // Wrap in a darkened host so axe color-contrast reflects the
    // production deployment surface, not the lab fixture's white body.
    // (Architect-reviewer F.7.3 expansion WARNING.)
    const wrapper = await fixture<HTMLDivElement>(
      html`<div
        style="background: #1a1a1a; padding: 24px; color: white;"
      >
        <voice-call-button>Talk with our AI</voice-call-button>
      </div>`
    );
    const el = wrapper.querySelector('voice-call-button') as VoiceCallButtonElement;
    await elementUpdated(el);
    ensureVoiceKernel().voice._publish({ state: 'listening', level: 0.3 });
    await elementUpdated(el);
    await expect(el).to.be.accessible();
  });

  it('<voice-call-button> error state is accessible', async () => {
    // Same dark-host rationale as listening-state — error chip is
    // translucent over the host backdrop.
    const wrapper = await fixture<HTMLDivElement>(
      html`<div
        style="background: #1a1a1a; padding: 24px; color: white;"
      >
        <voice-call-button>Talk with our AI</voice-call-button>
      </div>`
    );
    const el = wrapper.querySelector('voice-call-button') as VoiceCallButtonElement;
    await elementUpdated(el);
    ensureVoiceKernel().voice._publish({
      state: 'error',
      errorMessage: 'Microphone permission denied',
    });
    await elementUpdated(el);
    await expect(el).to.be.accessible();
  });
});
