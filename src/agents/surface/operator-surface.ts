/**
 * `<agentable-operator-surface>` — canvas-wide operator agent UI (D51, P13-T1).
 *
 * Lit host shell mounting the React OperatorSurfaceShell (P13-T7 iteration-2).
 * Ask/Build/Draw mode selector with enforced tool-scope presets (P13-T2),
 * model switcher shell, and A2UI-rich transcript blocks via the D40 adapter.
 */
import { LitElement, css, html, unsafeCSS, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { createRoot, type Root } from 'react-dom/client';
import * as React from 'react';
import { ensurePageSession } from '../../session/pageSession';
import {
  DEFAULT_OPERATOR_MODEL_OPTIONS,
  DEFAULT_OPERATOR_REQUIRED_CAPS,
  DEFAULT_OPERATOR_THREADS,
  OPERATOR_PAGE_SESSION_ID,
  OPERATOR_SURFACE_TAG,
} from './constants';
import { operatorSurfaceBaseStyles, operatorSurfaceDarkTheme } from './tokens';
import type {
  OperatorMode,
  OperatorModeChangedDetail,
  OperatorModelChangedDetail,
  OperatorModelOption,
  OperatorThread,
  OperatorThreadChangedDetail,
} from './types';
import {
  bindOperatorModeEnforcement,
  evaluateOperatorModeToolDenial,
  syncOperatorMode,
  unbindOperatorModeEnforcement,
} from './operatorModeBridge';
import {
  bindOperatorRegistration,
  syncOperatorRegistrationMode,
  unbindOperatorRegistration,
} from './operatorRegistrationBridge';
import {
  bindOperatorModelBridge,
  evaluateOperatorModelOptions,
  isOperatorModelBridgeActive,
  rebindOperatorModel,
  resolveOperatorModelAlias,
  unbindOperatorModelBridge,
} from './operatorModelBridge';
import { OperatorSurfaceShell } from './OperatorSurfaceShell';
import { parseOperatorDefaultMode } from './operatorDefaultMode';
import {
  loadOperatorThreadState,
  persistOperatorThreadState,
} from './operatorThreadPersistence';
import canvasStyles from '../../index.css?inline';

export interface OperatorSurfaceEventMap {
  'landi:operator-thread-changed': CustomEvent<OperatorThreadChangedDetail>;
  'landi:operator-mode-changed': CustomEvent<OperatorModeChangedDetail>;
  'landi:operator-model-changed': CustomEvent<OperatorModelChangedDetail>;
}

declare global {
  interface HTMLElementTagNameMap {
    [OPERATOR_SURFACE_TAG]: AgentableOperatorSurfaceElement;
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Lit typed event map augmentation
  interface HTMLElementEventMap extends OperatorSurfaceEventMap {}
}

function parseModelOptions(raw: string): readonly OperatorModelOption[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return DEFAULT_OPERATOR_MODEL_OPTIONS;
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      return DEFAULT_OPERATOR_MODEL_OPTIONS;
    }
    const options: OperatorModelOption[] = [];
    for (const entry of parsed) {
      if (
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as OperatorModelOption).alias === 'string' &&
        typeof (entry as OperatorModelOption).label === 'string'
      ) {
        options.push({
          alias: (entry as OperatorModelOption).alias,
          label: (entry as OperatorModelOption).label,
        });
      }
    }
    return options.length > 0 ? options : DEFAULT_OPERATOR_MODEL_OPTIONS;
  } catch {
    return DEFAULT_OPERATOR_MODEL_OPTIONS;
  }
}

@customElement(OPERATOR_SURFACE_TAG)
export class AgentableOperatorSurfaceElement extends LitElement {
  @property({ attribute: 'active-thread-id', reflect: true })
  declare activeThreadId: string;

  @property({ reflect: true })
  declare mode: OperatorMode;

  @property({ reflect: true })
  declare model: string;

  @property({ attribute: 'model-options' })
  declare modelOptionsJson: string;

  /** Optional initial Ask/Build/Draw mode (opt-in per host page). */
  @property({ attribute: 'default-mode', reflect: true })
  declare defaultMode: OperatorMode | '';

  /** Thread list is host-controlled; not reflected as a JSON attribute. */
  @property({ attribute: false })
  declare threads: readonly OperatorThread[];

  @state() private declare _parsedModelOptions: readonly OperatorModelOption[];
  @state() private declare _modelBridgeActive: boolean;

  private _pageSessionParticipantId = `${OPERATOR_PAGE_SESSION_ID}-${Math.random().toString(36).slice(2, 8)}`;
  private _chatSurfaceUnregister: (() => void) | null = null;
  private _root: Root | null = null;
  private _reactMounted = false;

  constructor() {
    super();
    const persisted = loadOperatorThreadState();
    this.activeThreadId = persisted.activeThreadId;
    this.mode = 'auto';
    this.model = DEFAULT_OPERATOR_MODEL_OPTIONS[0]?.alias ?? 'auto';
    this.modelOptionsJson = '';
    this.defaultMode = '';
    this.threads = persisted.threads;
    this._parsedModelOptions = DEFAULT_OPERATOR_MODEL_OPTIONS;
    this._modelBridgeActive = false;
  }

  static styles = [
    operatorSurfaceBaseStyles,
    unsafeCSS(canvasStyles),
    operatorSurfaceDarkTheme,
    css`
      :host {
        border: 0;
        background: transparent;
        min-height: 0;
      }

      .operator-react-mount {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this._applyDefaultModeFromAttribute();
    bindOperatorModeEnforcement(this.mode);
    bindOperatorRegistration(this.mode);
    void this._bindModelBridge();
    const session = ensurePageSession();
    session.join(this._pageSessionParticipantId);
    this._chatSurfaceUnregister = session.registerChatSurface(this._pageSessionParticipantId);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    unbindOperatorRegistration();
    unbindOperatorModeEnforcement();
    unbindOperatorModelBridge();
    ensurePageSession().leave(this._pageSessionParticipantId);
    this._chatSurfaceUnregister?.();
    this._chatSurfaceUnregister = null;
    const mount = this.renderRoot.querySelector<HTMLElement>('.operator-react-mount');
    if (mount) {
      delete mount.dataset.operatorReactMounted;
    }
    this._root?.unmount();
    this._root = null;
    this._reactMounted = false;
  }

  protected firstUpdated(): void {
    this._applyDefaultModeFromAttribute();
    this._ensureReactMount();
  }

  private _defaultModeApplied = false;

  private _applyDefaultModeFromAttribute(): void {
    if (this._defaultModeApplied) {
      return;
    }
    const parsed = parseOperatorDefaultMode(this.defaultMode || this.getAttribute('default-mode'));
    if (parsed !== null && parsed !== this.mode) {
      this.mode = parsed;
      syncOperatorMode(parsed);
      syncOperatorRegistrationMode(parsed);
    }
    this._defaultModeApplied = true;
  }

  protected updated(changed: PropertyValues<this>): void {
    if (changed.has('mode')) {
      syncOperatorMode(this.mode);
      syncOperatorRegistrationMode(this.mode);
    }
    if (changed.has('modelOptionsJson')) {
      this._parsedModelOptions = parseModelOptions(this.modelOptionsJson);
      void this._refreshModelOptionAvailability();
    }
    if (changed.has('threads') && !this._threadExists(this.activeThreadId)) {
      const first = this.threads[0];
      if (first) {
        this.activeThreadId = first.id;
      }
    }
    const shouldRenderReact =
      changed.has('activeThreadId') ||
      changed.has('mode') ||
      changed.has('model') ||
      changed.has('threads') ||
      changed.has('modelOptionsJson') ||
      changed.has('_parsedModelOptions') ||
      changed.has('_modelBridgeActive');
    if (shouldRenderReact) {
      this._renderReact();
    }
  }

  render(): TemplateResult {
    return html`
      <div
        class="operator-react-mount"
        data-operator-react-root
        part="react-root"
      ></div>
    `;
  }

  /** Imperative API for hosts/tests to replace the thread list. */
  setThreads(nextThreads: readonly OperatorThread[]): void {
    this.threads = nextThreads;
    persistOperatorThreadState(nextThreads, this.activeThreadId);
    this.requestUpdate();
  }

  /** Imperative thread selection for the React shell. */
  selectThread(threadId: string): void {
    if (!this._threadExists(threadId) || threadId === this.activeThreadId) {
      return;
    }
    const previousThreadId = this.activeThreadId;
    this.activeThreadId = threadId;
    persistOperatorThreadState(this.threads, this.activeThreadId);
    this.dispatchEvent(
      new CustomEvent<OperatorThreadChangedDetail>('landi:operator-thread-changed', {
        bubbles: true,
        composed: true,
        detail: { threadId, previousThreadId },
      }),
    );
    this.requestUpdate();
  }

  /**
   * Create a new conversation thread, select it, and emit thread-changed.
   * Optional title defaults to "Chat N".
   */
  createThread(title?: string): string {
    const id = `thread_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const nextIndex = this.threads.length + 1;
    const threadTitle = title?.trim() || `Chat ${nextIndex}`;
    const newThread: OperatorThread = {
      id,
      title: threadTitle,
      messages: [],
    };
    const previousThreadId = this.activeThreadId;
    this.threads = [...this.threads, newThread];
    this.activeThreadId = id;
    persistOperatorThreadState(this.threads, this.activeThreadId);
    this.dispatchEvent(
      new CustomEvent<OperatorThreadChangedDetail>('landi:operator-thread-changed', {
        bubbles: true,
        composed: true,
        detail: { threadId: id, previousThreadId },
      }),
    );
    this.requestUpdate();
    return id;
  }

  /**
   * Close a conversation thread. Requires at least one remaining tab.
   * Returns false when the thread is missing or is the last tab.
   */
  closeThread(threadId: string): boolean {
    if (!this._threadExists(threadId)) {
      return false;
    }
    if (this.threads.length <= 1) {
      return false;
    }

    const previousThreadId = this.activeThreadId;
    const remaining = this.threads.filter((thread) => thread.id !== threadId);
    this.threads = remaining;

    if (this.activeThreadId === threadId) {
      const nextActive = remaining[0];
      if (nextActive) {
        this.activeThreadId = nextActive.id;
        this.dispatchEvent(
          new CustomEvent<OperatorThreadChangedDetail>('landi:operator-thread-changed', {
            bubbles: true,
            composed: true,
            detail: { threadId: nextActive.id, previousThreadId },
          }),
        );
      }
    }

    persistOperatorThreadState(this.threads, this.activeThreadId);
    this.requestUpdate();
    return true;
  }

  /** Imperative mode selection for the React shell. */
  selectMode(nextMode: OperatorMode): void {
    if (nextMode === this.mode) {
      return;
    }
    const previousMode = this.mode;
    this.mode = nextMode;
    syncOperatorMode(nextMode);
    syncOperatorRegistrationMode(nextMode);
    this.dispatchEvent(
      new CustomEvent<OperatorModeChangedDetail>('landi:operator-mode-changed', {
        bubbles: true,
        composed: true,
        detail: { mode: nextMode, previousMode },
      }),
    );
    this.requestUpdate();
  }

  /** Imperative model selection for the React shell. */
  selectModel(nextAlias: string): void {
    void this._selectModelAsync(nextAlias);
  }

  /**
   * Test/diagnostic helper: evaluate operator-mode tool denial for the active mode.
   * Returns null when the tool is permitted or enforcement is inactive.
   */
  evaluateOperatorToolDenial(toolName: string): ReturnType<typeof evaluateOperatorModeToolDenial> {
    return evaluateOperatorModeToolDenial(toolName);
  }

  /** Test/diagnostic helper: whether D49 model rebind is active for this surface. */
  isOperatorModelBridgeActive(): boolean {
    return this._modelBridgeActive && isOperatorModelBridgeActive();
  }

  /** Re-mount React shell after host layout reparenting (gallery resizable chrome). */
  remountReactShell(): void {
    this._root?.unmount();
    this._root = null;
    this._reactMounted = false;
    const mount = this.renderRoot.querySelector<HTMLElement>('.operator-react-mount');
    if (mount) {
      delete mount.dataset.operatorReactMounted;
    }
    this._ensureReactMount();
  }

  private _ensureReactMount(): void {
    if (this._reactMounted && this._root) {
      return;
    }
    const mount = this.renderRoot.querySelector<HTMLElement>('.operator-react-mount');
    if (!mount) {
      return;
    }
    if (mount.dataset.operatorReactMounted === 'true') {
      return;
    }
    this._root = createRoot(mount);
    mount.dataset.operatorReactMounted = 'true';
    this._reactMounted = true;
    this._renderReact();
  }

  private _renderReact(): void {
    if (!this._root) {
      return;
    }
    this._root.render(
      React.createElement(OperatorSurfaceShell, {
        host: this,
        activeThreadId: this.activeThreadId,
        mode: this.mode,
        model: this.model,
        threads: this.threads,
        modelOptions: this._parsedModelOptions,
        modelBridgeActive: this._modelBridgeActive,
      }),
    );
  }

  private async _bindModelBridge(): Promise<void> {
    try {
      const bound = await bindOperatorModelBridge({
        initialAlias: this.model,
        requiredCaps: DEFAULT_OPERATOR_REQUIRED_CAPS,
      });
      this._modelBridgeActive = bound;
      if (bound) {
        await this._refreshModelOptionAvailability();
      }
      this.requestUpdate();
    } catch {
      this._modelBridgeActive = false;
    }
  }

  private async _refreshModelOptionAvailability(): Promise<void> {
    if (!this._modelBridgeActive) {
      return;
    }
    const baseOptions = parseModelOptions(this.modelOptionsJson);
    const evaluated = await evaluateOperatorModelOptions(baseOptions, {
      requiredCaps: DEFAULT_OPERATOR_REQUIRED_CAPS,
    });
    this._parsedModelOptions = evaluated.map((entry) => ({
      alias: entry.alias,
      label: entry.label,
      disabled: !entry.available,
    }));
    this.requestUpdate();
  }

  private _threadExists(threadId: string): boolean {
    return this.threads.some((thread) => thread.id === threadId);
  }

  private async _selectModelAsync(nextAlias: string): Promise<void> {
    const trimmed = nextAlias.trim();
    if (!trimmed || trimmed === this.model) {
      return;
    }
    const selected = this._parsedModelOptions.find((option) => option.alias === trimmed);
    if (selected?.disabled === true) {
      this.requestUpdate();
      return;
    }

    const previousModelAlias = this.model;

    if (this._modelBridgeActive) {
      try {
        const resolvedAlias = resolveOperatorModelAlias(trimmed);
        const result = await rebindOperatorModel(resolvedAlias);
        this.model = trimmed;
        this.dispatchEvent(
          new CustomEvent<OperatorModelChangedDetail>('landi:operator-model-changed', {
            bubbles: true,
            composed: true,
            detail: {
              modelAlias: trimmed,
              previousModelAlias,
              resolvedAlias: result.resolvedAlias,
              fallbackUsed: result.fallbackUsed,
            },
          }),
        );
        this.requestUpdate();
        return;
      } catch {
        this.requestUpdate();
        return;
      }
    }

    this.model = trimmed;
    this.dispatchEvent(
      new CustomEvent<OperatorModelChangedDetail>('landi:operator-model-changed', {
        bubbles: true,
        composed: true,
        detail: { modelAlias: trimmed, previousModelAlias },
      }),
    );
    this.requestUpdate();
  }
}

export {
  DEFAULT_OPERATOR_MODEL_OPTIONS,
  DEFAULT_OPERATOR_REQUIRED_CAPS,
  DEFAULT_OPERATOR_THREADS,
  OPERATOR_AGENT_ID,
  OPERATOR_LABEL,
  OPERATOR_LEASE_SCOPE,
  OPERATOR_LEASE_TTL_MS,
  OPERATOR_MODES,
  OPERATOR_REGISTRY_SCOPE,
  OPERATOR_SURFACE_TAG,
} from './constants';

export type {
  OperatorMessage,
  OperatorMode,
  OperatorModelOption,
  OperatorThread,
} from './types';
