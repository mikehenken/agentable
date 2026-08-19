import { fixture, expect, html, elementUpdated } from '@open-wc/testing';
import '../../src/embed/widgets/ask-about-this-button';
import { CHAT_PROMPT_EVENT } from '../../src/choreography/constants';
import type { AskAboutThisButtonElement } from '../../src/embed/widgets/ask-about-this-button';

describe('<ask-about-this-button>', () => {
  it('builds a contextual prompt from context + prefix', async () => {
    const el = await fixture<AskAboutThisButtonElement>(
      html`<ask-about-this-button
        context="Royal Bahamian"
        prompt-prefix="Ask about"
      ></ask-about-this-button>`);
    await elementUpdated(el);
    expect(el.buildPrompt).to.equal('Ask about Royal Bahamian');
  });

  it('dispatches chat prompt and widget event on click', async () => {
    const el = await fixture<AskAboutThisButtonElement>(
      html`<ask-about-this-button context="Butler role">
        // Ask about this role
      </ask-about-this-button>`);
    await elementUpdated(el);

    let promptEvent: CustomEvent | null = null;
    let widgetEvent: CustomEvent | null = null;
    window.addEventListener(CHAT_PROMPT_EVENT, (event) => {
      promptEvent = event as CustomEvent;
    });
    el.addEventListener('landi:ask-about-selected', (event) => {
      widgetEvent = event as CustomEvent;
    });

    el.shadowRoot!.querySelector('button')!.click;
    await elementUpdated(el);

    expect(promptEvent).to.exist;
    expect(promptEvent!.detail.prompt).to.equal('Tell me about Butler role');
    expect(widgetEvent).to.exist;
    expect(widgetEvent!.detail.context).to.equal('Butler role');
  });

  it('disables the button when context is empty', async () => {
    const el = await fixture<AskAboutThisButtonElement>(
      html`<ask-about-this-button></ask-about-this-button>`);
    await elementUpdated(el);
    const button = el.shadowRoot!.querySelector('button')!;
    expect(button.disabled).to.equal(true);
  });
});
