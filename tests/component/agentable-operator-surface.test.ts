/**
 * Component tests for `<agentable-operator-surface>`.
 *
 * Per web-components-ui §9.2 — real browser via @web/test-runner + Playwright.
 */
import { fixture, expect, html, elementUpdated, oneEvent } from '@open-wc/testing';
import type { A2UIEnvelope } from '../../src/a2ui';
import '../../src/agents/surface/operator-surface';
import type { AgentableOperatorSurfaceElement } from '../../src/agents/surface/operator-surface';
import type { OperatorThread } from '../../src/agents/surface/types';
import {
  __resetPageSessionForTests__,
  ensurePageSession,
} from '../../src/session/pageSession';
import {
  clearModelResolverForTests,
  getOperatorAgentSession,
  registerOperatorSurfaceTestModelResolver,
  resetOperatorModelBridgeForTests,
} from '../../src/agents/surface/operatorModelBridge';
import type { ModelCapabilities, ProviderBinding } from '../../src/agents/types';

function operatorTestBindings(): Record<string, ProviderBinding> {
  const full: ModelCapabilities = {
    vision: true,
    tools: true,
    contextTokens: 128_000,
    streaming: true,
  };
  const textOnly: ModelCapabilities = {
    vision: false,
    tools: true,
    contextTokens: 32_000,
    streaming: false,
  };
  const noTools: ModelCapabilities = {
    vision: false,
    tools: false,
    contextTokens: 8_000,
    streaming: false,
  };
  return {
    auto: { providerId: 'vertex', model: 'gemini-default', caps: full, available: true },
    default: { providerId: 'vertex', model: 'gemini-default', caps: full, available: true },
    fast: { providerId: 'vertex', model: 'gemini-flash', caps: textOnly, available: true },
    quality: { providerId: 'vertex', model: 'gemini-pro', caps: full, available: true },
    broken: { providerId: 'mock', model: 'no-tools', caps: noTools, available: true },
  };
}

/** Minimal user-profile-card envelope from A2UI conformance fixtures (P10). */
const USER_PROFILE_ENVELOPES: readonly A2UIEnvelope[] = [
  {
    version: 'v1.0',
    createSurface: {
      surfaceId: 'user_profile_card',
      catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
      components: [
        {
          id: 'root',
          component: 'Column',
          children: ['user_name'],
        },
        {
          id: 'user_name',
          component: 'Text',
          text: { path: '/name' },
        },
      ],
      dataModel: {
        name: 'John Doe',
      },
    },
  },
];

function sampleThreads(): OperatorThread[] {
  return [
    {
      id: 'thread-alpha',
      title: 'Alpha',
      messages: [
        {
          id: 'msg-alpha',
          role: 'user',
          kind: 'text',
          text: 'Hello from Alpha thread',
          timestamp: '2026-07-22T21:00:00.000Z',
        },
      ],
    },
    {
      id: 'thread-beta',
      title: 'Beta',
      messages: [
        {
          id: 'msg-beta',
          role: 'user',
          kind: 'text',
          text: 'Hello from Beta thread',
          timestamp: '2026-07-22T21:01:00.000Z',
        },
      ],
    },
  ];
}

async function waitForReactChrome(el: AgentableOperatorSurfaceElement): Promise<void> {
  await elementUpdated(el);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await elementUpdated(el);
}

describe('<agentable-operator-surface>', () => {
  beforeEach(() => {
    __resetPageSessionForTests__();
    resetOperatorModelBridgeForTests();
    clearModelResolverForTests();
  });

  afterEach(() => {
    resetOperatorModelBridgeForTests();
    clearModelResolverForTests();
  });

  describe('registration & chrome', () => {
    it('registers the custom element with shadow DOM chrome', async () => {
      const el = await fixture<AgentableOperatorSurfaceElement>(
        html`<agentable-operator-surface></agentable-operator-surface>`);
      await waitForReactChrome(el);
      expect(customElements.get('agentable-operator-surface')).to.not.equal(undefined);
      expect(el.shadowRoot?.mode).to.equal('open');
      expect(el.shadowRoot?.querySelector('[part="mode-selector"]')).to.not.equal(null);
      expect(el.shadowRoot?.querySelector('[part="model-switcher"]')).to.not.equal(null);
    });

    it('mounts exactly one React operator shell in shadow DOM ', async () => {
      const el = await fixture<AgentableOperatorSurfaceElement>(
        html`<agentable-operator-surface></agentable-operator-surface>`);
      await waitForReactChrome(el);
      const shells = el.shadowRoot?.querySelectorAll('[data-testid="operator-surface-shell"]') ?? [];
      expect(shells.length).to.equal(1);
    });

    it('joins the shared page session on connect', async () => {
      const el = await fixture<AgentableOperatorSurfaceElement>(
        html`<agentable-operator-surface></agentable-operator-surface>`);
      await elementUpdated(el);
      expect(ensurePageSession().getSnapshot().participantIds.length).to.be.greaterThan(0);
      el.remove();
    });
  });

  describe('tab switching', () => {
    it('creates a new thread from the + control and selects it', async () => {
      const el = await fixture<AgentableOperatorSurfaceElement>(
        html`<agentable-operator-surface></agentable-operator-surface>`);
      await waitForReactChrome(el);

      expect(el.threads.length).to.equal(1);

      const eventPromise = oneEvent(el, 'landi:operator-thread-changed');
      el.shadowRoot!.querySelector<HTMLButtonElement>('[data-testid="operator-new-thread"]')!.click();
      await waitForReactChrome(el);
      const event = await eventPromise;

      expect(el.threads.length).to.equal(2);
      expect(event.detail.previousThreadId).to.equal('thread-main');
      expect(el.threads.some((thread) => thread.id === event.detail.threadId)).to.equal(true);
      expect(el.activeThreadId).to.equal(event.detail.threadId);
    });

    it('shows only the active thread transcript and emits thread-changed', async () => {
      const el = await fixture<AgentableOperatorSurfaceElement>(
        html`<agentable-operator-surface active-thread-id="thread-alpha"></agentable-operator-surface>`);
      el.setThreads(sampleThreads);
      await waitForReactChrome(el);

      const alphaPanel = el.shadowRoot!.querySelector('[data-thread-panel="thread-alpha"].active');
      const betaPanel = el.shadowRoot!.querySelector('[data-thread-panel="thread-beta"].active');
      expect(alphaPanel).to.not.equal(null);
      expect(betaPanel).to.equal(null);
      expect(alphaPanel!.textContent).to.contain('Hello from Alpha thread');

      const eventPromise = oneEvent(el, 'landi:operator-thread-changed');
      el.shadowRoot!.querySelector<HTMLButtonElement>('[data-thread-tab="thread-beta"]')!.click();
      await waitForReactChrome(el);
      const event = await eventPromise;

      expect(event.detail.threadId).to.equal('thread-beta');
      expect(event.detail.previousThreadId).to.equal('thread-alpha');
      expect(el.activeThreadId).to.equal('thread-beta');
      const activeBeta = el.shadowRoot!.querySelector('[data-thread-panel="thread-beta"].active');
      expect(activeBeta!.textContent).to.contain('Hello from Beta thread');
      expect(el.shadowRoot!.querySelector('[data-thread-panel="thread-alpha"].active')).to.equal(null);
    });
  });

  describe('A2UI transcript rendering', () => {
    it('renders ingested A2UI profile card content in the active thread', async () => {
      const el = await fixture<AgentableOperatorSurfaceElement>(
        html`<agentable-operator-surface active-thread-id="thread-plan"></agentable-operator-surface>`);
      el.setThreads([
        {
          id: 'thread-plan',
          title: 'Plan',
          messages: [
            {
              id: 'a2ui-profile',
              role: 'assistant',
              kind: 'a2ui',
              envelopes: USER_PROFILE_ENVELOPES,
              timestamp: '2026-07-22T21:02:00.000Z',
            },
          ],
        },
      ]);
      await waitForReactChrome(el);

      expect(
        el.shadowRoot!.querySelector('[data-testid="operator-a2ui-content-a2ui-profile"]')).to.not.equal(null);
      expect(el.shadowRoot!.textContent).to.contain('John Doe');
    });
  });

  describe('mode and model shells', () => {
    it('emits mode-changed when a mode button is pressed', async () => {
      const el = await fixture<AgentableOperatorSurfaceElement>(
        html`<agentable-operator-surface mode="ask"></agentable-operator-surface>`);
      await waitForReactChrome(el);

      const eventPromise = oneEvent(el, 'landi:operator-mode-changed');
      el.shadowRoot!.querySelector<HTMLButtonElement>('[data-mode="build"]')!.click();
      const event = await eventPromise;

      expect(event.detail.mode).to.equal('build');
      expect(event.detail.previousMode).to.equal('ask');
      expect(el.mode).to.equal('build');
    });

    it('emits model-changed when the switcher selection changes', async () => {
      registerOperatorSurfaceTestModelResolver(operatorTestBindings);

      const el = await fixture<AgentableOperatorSurfaceElement>(
        html`<agentable-operator-surface model="auto"></agentable-operator-surface>`);
      await waitForReactChrome(el);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await elementUpdated(el);

      expect(el.isOperatorModelBridgeActive).to.equal(true);

      const select = el.shadowRoot!.querySelector<HTMLSelectElement>('[part="model-switcher"]')!;
      const eventPromise = oneEvent(el, 'landi:operator-model-changed');
      select.value = 'fast';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      const event = await eventPromise;
      await elementUpdated(el);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(event.detail.modelAlias).to.equal('fast');
      expect(event.detail.previousModelAlias).to.equal('auto');
      expect(event.detail.resolvedAlias).to.equal('fast');
      expect(el.model).to.equal('fast');
      expect(getOperatorAgentSession?.().binding.model).to.equal('gemini-flash');
    });

    it('disables capability-ineligible model options ', async () => {
      registerOperatorSurfaceTestModelResolver(operatorTestBindings);

      const el = await fixture<AgentableOperatorSurfaceElement>(
        html`<agentable-operator-surface
          model="default"
          model-options='[{"alias":"default","label":"Default"},{"alias":"broken","label":"Broken"}]'
        ></agentable-operator-surface>`);
      await waitForReactChrome(el);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await elementUpdated(el);

      const brokenOption = el.shadowRoot!.querySelector<HTMLOptionElement>(
        'select.model-switcher option[value="broken"]');
      expect(brokenOption).to.not.equal(null);
      expect(brokenOption!.disabled).to.equal(true);
    });

    it('Ask mode cannot reach a mutation tool ( scope enforcement)', async () => {
      const el = await fixture<AgentableOperatorSurfaceElement>(
        html`<agentable-operator-surface mode="ask"></agentable-operator-surface>`);
      await elementUpdated(el);

      expect(el.mode).to.equal('ask');

      const denial = el.evaluateOperatorToolDenial('fill_panel');
      expect(denial).to.not.equal(null);
      if (denial === null) return;
      expect(denial.ok).to.equal(false);
      expect(denial.error).to.contain('SCOPE_DENIED');
      expect(denial.error).to.contain('operator mode "ask"');

      expect(el.evaluateOperatorToolDenial('list_panels')).to.equal(null);

      el.remove();
      await elementUpdated(el);
      expect(el.evaluateOperatorToolDenial('fill_panel')).to.equal(null);
    });
    it('appends user + assistant messages from the composer without error toast ', async () => {
      const el = await fixture<AgentableOperatorSurfaceElement>(
        html`<agentable-operator-surface></agentable-operator-surface>`);
      await waitForReactChrome(el);

      const textarea = el.shadowRoot!.querySelector('textarea');
      expect(textarea).to.not.equal(null);
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value')?.set;
      setter?.call(textarea, 'Operator probe message');
      textarea!.dispatchEvent(new Event('input', { bubbles: true }));

      const submit = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="composer-submit"]');
      expect(submit).to.not.equal(null);
      submit!.click();
      await waitForReactChrome(el);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await elementUpdated(el);

      expect(el.shadowRoot!.textContent).to.contain('Operator probe message');
      expect(el.shadowRoot!.textContent?.toLowerCase()).not.to.contain('gallery demo mode');
      const toast = el.shadowRoot!.querySelector('[data-testid="operator-error-toast"]');
      expect(toast).to.equal(null);
    });
  });
});
