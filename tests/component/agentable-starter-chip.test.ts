import { fixture, expect, html, elementUpdated } from '@open-wc/testing';
import '../../src/embed/widgets/agentable-starter-chip';
import { CHAT_PROMPT_EVENT, OPEN_CHAT_EVENT } from '../../src/choreography/constants';
import type { AgentableStarterChipElement } from '../../src/embed/widgets/agentable-starter-chip';
import {
  ensurePageSession,
  __resetPageSessionForTests__,
} from '../../src/session/pageSession';

describe('<agentable-starter-chip>', () => {
  beforeEach(() => {
    __resetPageSessionForTests__();
  });

  it('registers and renders a compact chip button', async () => {
    const el = await fixture<AgentableStarterChipElement>(
      html`<agentable-starter-chip
        emoji="🌴"
        label="Resort roles"
        prompt="What resort roles are open?"
      ></agentable-starter-chip>`);
    await elementUpdated(el);
    expect(customElements.get('agentable-starter-chip')).to.exist;
    expect(el.shadowRoot?.querySelector('button')).to.exist;
    expect(el.shadowRoot?.textContent).to.contain('Resort roles');
  });

  it('joins the shared page session on connect', async () => {
    const el = await fixture<AgentableStarterChipElement>(
      html`<agentable-starter-chip prompt="Hello"></agentable-starter-chip>`);
    await elementUpdated(el);
    expect(ensurePageSession().getSnapshot().participantIds.length).to.be.greaterThan(0);
    el.remove();
  });

  it('dispatches chat prompt choreography and widget event on click', async () => {
    const el = await fixture<AgentableStarterChipElement>(
      html`<agentable-starter-chip
        label="Jobs"
        prompt="Show open jobs"
      ></agentable-starter-chip>`);
    await elementUpdated(el);

    let promptDetail: CustomEvent | null = null;
    let widgetEvent: CustomEvent | null = null;
    window.addEventListener(CHAT_PROMPT_EVENT, (event) => {
      promptDetail = event as CustomEvent;
    });
    el.addEventListener('landi:starter-chip-selected', (event) => {
      widgetEvent = event as CustomEvent;
    });

    el.shadowRoot!.querySelector('button')!.click;
    await elementUpdated(el);

    expect(promptDetail).to.exist;
    expect(promptDetail!.detail.prompt).to.equal('Show open jobs');
    expect(widgetEvent).to.exist;
    expect(widgetEvent!.detail.prompt).to.equal('Show open jobs');
  });

  it('opens chat before dispatching prompt', async () => {
    const el = await fixture<AgentableStarterChipElement>(
      html`<agentable-starter-chip prompt="Ping"></agentable-starter-chip>`);
    await elementUpdated(el);

    const seen: string[] = [];
    window.addEventListener(OPEN_CHAT_EVENT, () => seen.push('open'));
    window.addEventListener(CHAT_PROMPT_EVENT, () => seen.push('prompt'));

    el.shadowRoot!.querySelector('button')!.click;
    expect(seen).to.deep.equal(['open', 'prompt']);
  });
});
