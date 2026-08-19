/**
 * `<agentable-operator-surface-placement>` — four host placements for the
 * canvas-wide operator surface (P13-T4, D51 §13).
 *
 * Mounts `<agentable-operator-surface>` and emits typed placement events on
 * connect and user interaction. All instances join the shared page session (D44).
 *
 * Floating placement supports preset anchors, free drag (header handle), and
 * localStorage persistence for gallery hosts (P13-T7 iteration-4).
 */
import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ensurePageSession } from '../../session/pageSession';
import { ensurePageSlotRegistry } from '../../session/pageSlots';
import {
  blurCanvasEditorForExternalComposer,
  editableTargetShouldCaptureKey,
} from '../../shared/editableKeyboardTarget';
import { OPERATOR_SURFACE_TAG } from './constants';
import {
  isOperatorSurfacePlacementKind,
  type OperatorPlacementInteractedDetail,
  type OperatorPlacementMountedDetail,
  type OperatorSurfacePlacementKind,
} from './placementTypes';
import './operator-surface';

export const OPERATOR_PLACEMENT_TAG = 'agentable-operator-surface-placement';

export const OPERATOR_FLOATING_STORAGE_KEY = 'p13-operator-floating-visible';
export const OPERATOR_FLOATING_X_KEY = 'p13-operator-floating-x';
export const OPERATOR_FLOATING_Y_KEY = 'p13-operator-floating-y';
export const OPERATOR_FLOATING_PRESET_KEY = 'p13-operator-floating-preset';

export type OperatorFloatingPreset = 'bottom-left' | 'bottom-right' | 'top-right' | 'free';

declare global {
  interface HTMLElementTagNameMap {
    [OPERATOR_PLACEMENT_TAG]: AgentableOperatorSurfacePlacementElement;
  }
}

function createPlacementId(): string {
  return `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function createPlacementParticipantId(placementId: string): string {
  return `operator-placement-${placementId}`;
}

function readFloatingPreset(): OperatorFloatingPreset {
  if (typeof window === 'undefined') {
    return 'bottom-left';
  }
  const raw = window.localStorage.getItem(OPERATOR_FLOATING_PRESET_KEY);
  if (raw === 'bottom-right' || raw === 'top-right' || raw === 'free' || raw === 'bottom-left') {
    return raw;
  }
  return 'bottom-left';
}

function readFloatingCoordinates(): { x: number | null; y: number | null } {
  if (typeof window === 'undefined') {
    return { x: null, y: null };
  }
  const xRaw = window.localStorage.getItem(OPERATOR_FLOATING_X_KEY);
  const yRaw = window.localStorage.getItem(OPERATOR_FLOATING_Y_KEY);
  const x = xRaw !== null ? Number.parseFloat(xRaw) : Number.NaN;
  const y = yRaw !== null ? Number.parseFloat(yRaw) : Number.NaN;
  return {
    x: Number.isFinite(x) ? x : null,
    y: Number.isFinite(y) ? y : null,
  };
}

function presetAnchorStyle(preset: OperatorFloatingPreset): Record<string, string> {
  switch (preset) {
    case 'bottom-right':
      return { right: '24px', bottom: '24px', left: 'auto', top: 'auto' };
    case 'top-right':
      return { right: '24px', top: '24px', left: 'auto', bottom: 'auto' };
    case 'bottom-left':
    default:
      return { left: '24px', bottom: '24px', right: 'auto', top: 'auto' };
  }
}

@customElement(OPERATOR_PLACEMENT_TAG)
export class AgentableOperatorSurfacePlacementElement extends LitElement {
  /** Placement anchor: dock-inside | dock-outside | slot | floating. */
  @property({ reflect: true })
  declare placement: OperatorSurfacePlacementKind;

  /** Stable id for telemetry and multi-instance hosts. Auto-generated when omitted. */
  @property({ attribute: 'placement-id', reflect: true })
  declare placementId: string;

  /** Required when `placement="slot"` — registers this host with page slots (D44). */
  @property({ attribute: 'slot-name', reflect: true })
  declare slotName: string;

  /** Optional initial operator mode forwarded to nested surface (opt-in per host). */
  @property({ attribute: 'default-mode', reflect: true })
  declare defaultMode: string;

  @state() private declare _floatingPreset: OperatorFloatingPreset;
  @state() private declare _floatingX: number | null;
  @state() private declare _floatingY: number | null;
  @state() private declare _dragging: boolean;

  private _pageSessionParticipantId = '';
  private _slotUnregister: (() => void) | null = null;
  private _mountedEventDispatched = false;
  private _dragPointerId: number | null = null;
  private _dragOriginX = 0;
  private _dragOriginY = 0;
  private _dragStartLeft = 0;
  private _dragStartTop = 0;

  constructor() {
    super();
    this.placement = 'dock-inside';
    this.placementId = '';
    this.slotName = '';
    this.defaultMode = '';
    this._floatingPreset = 'bottom-left';
    this._floatingX = null;
    this._floatingY = null;
    this._dragging = false;
  }

  static styles = css`
    :host {
      box-sizing: border-box;
      --operator-placement-border: var(--vibe-border, rgb(255 255 255 / 0.09));
      --operator-placement-shadow: 0 12px 40px rgb(0 0 0 / 0.45);
    }

    .placement-root {
      display: flex;
      flex-direction: column;
      min-height: 0;
      height: 100%;
      width: 100%;
    }

    :host([placement='dock-inside']) {
      display: flex;
      flex-direction: column;
      min-height: 0;
      height: 100%;
      width: 100%;
      overflow: hidden;
      border-radius: var(--operator-radius-md, 8px);
      border: 1px solid var(--operator-placement-border);
      background: var(--vibe-surface, #1a1a1a);
    }

    :host([placement='dock-outside']) {
      display: flex;
      flex-direction: column;
      min-height: 0;
      height: 100%;
      width: min(100%, 420px);
      border-left: 1px solid var(--operator-placement-border);
      background: var(--vibe-surface, #1a1a1a);
    }

    :host([placement='slot']) {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 240px;
    }

    :host([placement='floating']) {
      position: fixed;
      width: min(420px, calc(100vw - 48px));
      min-height: min(480px, calc(100vh - 48px));
      max-height: min(72vh, 760px);
      z-index: 1200;
      display: flex;
      flex-direction: column;
      border-radius: var(--operator-radius-md, 12px);
      border: 1px solid var(--operator-placement-border);
      background: var(--vibe-surface, #1a1a1a);
      box-shadow: var(--operator-placement-shadow);
      overflow: hidden;
    }

    :host([placement='floating']) .placement-root {
      min-height: 0;
      flex: 1;
    }

    :host([placement='floating']) agentable-operator-surface {
      min-height: 280px;
    }

    .floating-drag-handle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
      padding: 0.35rem 0.65rem;
      border-bottom: 1px solid var(--operator-placement-border);
      background: var(--vibe-composer-bg, #141414);
      color: var(--vibe-text-muted, #9a9a9a);
      font-size: 0.68rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: grab;
      user-select: none;
      touch-action: none;
    }

    :host([data-dragging='true']) .floating-drag-handle {
      cursor: grabbing;
    }

    .floating-drag-grip {
      color: var(--vibe-text-faint, #6f6f6f);
      letter-spacing: 0.12em;
    }

    agentable-operator-surface {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    if (!this.placementId.trim()) {
      this.placementId = createPlacementId();
    }
    if (this.placement === 'floating') {
      this._restoreFloatingState();
    }
    this._pageSessionParticipantId = createPlacementParticipantId(this.placementId);
    ensurePageSession().join(this._pageSessionParticipantId);
    this._registerSlotIfNeeded();
    this.addEventListener('focusin', this._handleInteractionFocus);
    this.addEventListener('focusin', this._handleComposerFocusIn, true);
    this.addEventListener('keydown', this._handleComposerKeyDown, true);
    this.addEventListener('pointerdown', this._handleInteractionPointer);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('focusin', this._handleInteractionFocus);
    this.removeEventListener('focusin', this._handleComposerFocusIn, true);
    this.removeEventListener('keydown', this._handleComposerKeyDown, true);
    this.removeEventListener('pointerdown', this._handleInteractionPointer);
    this._endFloatingDrag();
    if (this._pageSessionParticipantId) {
      ensurePageSession().leave(this._pageSessionParticipantId);
    }
    this._slotUnregister?.();
    this._slotUnregister = null;
    this._mountedEventDispatched = false;
  }

  protected firstUpdated(): void {
    this._dispatchMountedEvent();
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('placement') && !isOperatorSurfacePlacementKind(this.placement)) {
      console.warn(
        `[operator-surface-placement] invalid placement "${this.placement}"; falling back to dock-inside`,
      );
      this.placement = 'dock-inside';
    }
    if (changed.has('placement') && this.placement === 'floating') {
      this._restoreFloatingState();
    }
    if (changed.has('slotName') || changed.has('placement')) {
      this._registerSlotIfNeeded();
    }
  }

  protected updated(changed: PropertyValues<this>): void {
    if (this.placement === 'floating') {
      const anchor = this._floatingStyle();
      this.style.position = 'fixed';
      this.style.width = 'min(420px, calc(100vw - 48px))';
      this.style.minHeight = 'min(480px, calc(100vh - 48px))';
      this.style.maxHeight = 'min(72vh, 760px)';
      this.style.zIndex = '1200';
      for (const key of ['left', 'right', 'top', 'bottom'] as const) {
        const value = anchor[key];
        if (value !== undefined) {
          this.style.setProperty(key, value);
        }
      }
    } else if (changed.has('placement')) {
      this.style.cssText = '';
    }
  }

  /** Returns the nested operator surface element, if mounted. */
  getOperatorSurface(): HTMLElement | null {
    return this.shadowRoot?.querySelector(OPERATOR_SURFACE_TAG) ?? null;
  }

  /** Apply a floating preset anchor (clears free coordinates). */
  setFloatingPreset(preset: OperatorFloatingPreset): void {
    this._floatingPreset = preset;
    if (preset !== 'free') {
      this._floatingX = null;
      this._floatingY = null;
    }
    this._persistFloatingState();
    this.requestUpdate();
  }

  /** Persist floating visibility for gallery hosts. */
  static setFloatingVisible(visible: boolean): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(OPERATOR_FLOATING_STORAGE_KEY, visible ? '1' : '0');
  }

  /** Read floating visibility from localStorage. */
  static isFloatingVisible(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.localStorage.getItem(OPERATOR_FLOATING_STORAGE_KEY) === '1';
  }

  private _restoreFloatingState(): void {
    this._floatingPreset = readFloatingPreset();
    const coords = readFloatingCoordinates();
    this._floatingX = coords.x;
    this._floatingY = coords.y;
    if (this._floatingX !== null && this._floatingY !== null) {
      this._floatingPreset = 'free';
    }
  }

  private _persistFloatingState(): void {
    if (typeof window === 'undefined' || this.placement !== 'floating') {
      return;
    }
    window.localStorage.setItem(OPERATOR_FLOATING_PRESET_KEY, this._floatingPreset);
    if (this._floatingPreset === 'free' && this._floatingX !== null && this._floatingY !== null) {
      window.localStorage.setItem(OPERATOR_FLOATING_X_KEY, String(this._floatingX));
      window.localStorage.setItem(OPERATOR_FLOATING_Y_KEY, String(this._floatingY));
    } else {
      window.localStorage.removeItem(OPERATOR_FLOATING_X_KEY);
      window.localStorage.removeItem(OPERATOR_FLOATING_Y_KEY);
    }
  }

  private _floatingStyle(): Record<string, string> {
    if (this._floatingPreset === 'free' && this._floatingX !== null && this._floatingY !== null) {
      return {
        left: `${this._floatingX}px`,
        top: `${this._floatingY}px`,
        right: 'auto',
        bottom: 'auto',
      };
    }
    return presetAnchorStyle(this._floatingPreset);
  }

  private _onFloatingDragPointerDown = (event: PointerEvent): void => {
    if (this.placement !== 'floating') {
      return;
    }
    const handle = event.currentTarget;
    if (!(handle instanceof HTMLElement)) {
      return;
    }
    event.preventDefault();
    this._dragging = true;
    this._dragPointerId = event.pointerId;
    this._dragOriginX = event.clientX;
    this._dragOriginY = event.clientY;
    const rect = this.getBoundingClientRect();
    this._dragStartLeft = rect.left;
    this._dragStartTop = rect.top;
    handle.setPointerCapture(event.pointerId);
    this.setAttribute('data-dragging', 'true');
    window.addEventListener('pointermove', this._onFloatingDragPointerMove);
    window.addEventListener('pointerup', this._onFloatingDragPointerUp);
    window.addEventListener('pointercancel', this._onFloatingDragPointerUp);
  };

  private _onFloatingDragPointerMove = (event: PointerEvent): void => {
    if (!this._dragging || this._dragPointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - this._dragOriginX;
    const dy = event.clientY - this._dragOriginY;
    const maxX = Math.max(8, window.innerWidth - this.offsetWidth - 8);
    const maxY = Math.max(8, window.innerHeight - this.offsetHeight - 8);
    this._floatingX = Math.min(maxX, Math.max(8, this._dragStartLeft + dx));
    this._floatingY = Math.min(maxY, Math.max(8, this._dragStartTop + dy));
    this._floatingPreset = 'free';
    this.requestUpdate();
  };

  private _onFloatingDragPointerUp = (event: PointerEvent): void => {
    if (this._dragPointerId !== null && event.pointerId !== this._dragPointerId) {
      return;
    }
    this._endFloatingDrag();
    this._persistFloatingState();
  };

  private _endFloatingDrag(): void {
    if (!this._dragging) {
      return;
    }
    this._dragging = false;
    this._dragPointerId = null;
    this.removeAttribute('data-dragging');
    window.removeEventListener('pointermove', this._onFloatingDragPointerMove);
    window.removeEventListener('pointerup', this._onFloatingDragPointerUp);
    window.removeEventListener('pointercancel', this._onFloatingDragPointerUp);
  }

  private _registerSlotIfNeeded(): void {
    this._slotUnregister?.();
    this._slotUnregister = null;
    if (this.placement !== 'slot') {
      return;
    }
    const slotId = this.slotName.trim();
    if (!slotId) {
      console.warn('[operator-surface-placement] slot placement requires slot-name attribute');
      return;
    }
    this._slotUnregister = ensurePageSlotRegistry().register(slotId, this);
  }

  private _dispatchMountedEvent(): void {
    if (this._mountedEventDispatched) {
      return;
    }
    const pageSessionId = ensurePageSession().sessionId;
    const detail: OperatorPlacementMountedDetail = {
      placement: this.placement,
      placementId: this.placementId,
      pageSessionId,
      ...(this.slotName.trim() ? { slotName: this.slotName.trim() } : {}),
    };
    this.dispatchEvent(
      new CustomEvent<OperatorPlacementMountedDetail>('landi:operator-placement-mounted', {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
    this._mountedEventDispatched = true;
  }

  private _handleInteractionFocus = (): void => {
    this._dispatchInteractionEvent('focus');
  };

  private _handleComposerFocusIn = (event: FocusEvent): void => {
    if (editableTargetShouldCaptureKey(event.target)) {
      blurCanvasEditorForExternalComposer();
    }
  };

  private _handleComposerKeyDown = (event: KeyboardEvent): void => {
    if (editableTargetShouldCaptureKey(event.target)) {
      event.stopPropagation();
    }
  };

  private _handleInteractionPointer = (): void => {
    this._dispatchInteractionEvent('pointerdown');
  };

  private _dispatchInteractionEvent(
    interactionKind: OperatorPlacementInteractedDetail['interactionKind'],
  ): void {
    const pageSessionId = ensurePageSession().sessionId;
    const detail: OperatorPlacementInteractedDetail = {
      placement: this.placement,
      placementId: this.placementId,
      pageSessionId,
      interactionKind,
      ...(this.slotName.trim() ? { slotName: this.slotName.trim() } : {}),
    };
    this.dispatchEvent(
      new CustomEvent<OperatorPlacementInteractedDetail>('landi:operator-placement-interacted', {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  }

  render(): TemplateResult {
    return html`
      <div
        part="placement-root"
        class=${classMap({ 'placement-root': true, [`placement-${this.placement}`]: true })}
        tabindex="0"
      >
        ${this.placement === 'floating'
          ? html`
              <div
                part="floating-drag-handle"
                class="floating-drag-handle"
                @pointerdown=${this._onFloatingDragPointerDown}
              >
                <span class="floating-drag-grip" aria-hidden="true">⋮⋮</span>
                <span>Floating operator</span>
              </div>
            `
          : null}
        <agentable-operator-surface
          part="operator-surface"
          default-mode=${this.defaultMode || nothing}
        ></agentable-operator-surface>
      </div>
    `;
  }
}

export {
  OPERATOR_SURFACE_PLACEMENT_KINDS,
  isOperatorSurfacePlacementKind,
} from './placementTypes';
export type {
  OperatorPlacementEventMap,
  OperatorPlacementInteractedDetail,
  OperatorPlacementInteractionKind,
  OperatorPlacementMountedDetail,
  OperatorSurfacePlacementKind,
} from './placementTypes';
