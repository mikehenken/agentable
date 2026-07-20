/**
 * `<agentable-virtual-list>` (D56): the windowed list surface behind the
 * catalog `list` entry. Above the declared threshold it renders only the
 * rows near the scroll viewport between two sizing spacers, so the DOM
 * node count stays bounded no matter how many items are bound; at or
 * below the threshold every row renders. Both paths go through Lit
 * `repeat` keyed on the stable row key (the Lit performance rule), so
 * window moves and reorders reuse row DOM instead of rebuilding it.
 *
 * House web-components rule: shadow DOM, `part` hooks for host styling,
 * no hardcoded user-facing strings (rows render bound data only; chrome
 * strings stay in the D42 catalog).
 */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import {
  computeVirtualWindow,
  DEFAULT_OVERSCAN_ROWS,
  DEFAULT_ROW_HEIGHT_PX,
  DEFAULT_VIEWPORT_HEIGHT_PX,
  LIST_VIRTUALIZATION_THRESHOLD,
  shouldVirtualize,
  type VirtualListRow,
} from './virtualization';

export class AgentableVirtualListElement extends LitElement {
  static properties = {
    items: { attribute: false },
    threshold: { type: Number },
    rowHeight: { type: Number, attribute: 'row-height' },
    viewportHeight: { type: Number, attribute: 'viewport-height' },
    overscan: { type: Number },
    scrollOffset: { state: true },
  };

  static styles = css`
    :host {
      display: block;
    }
    .viewport {
      overflow-y: auto;
    }
    .row {
      display: flex;
      flex-direction: column;
      justify-content: center;
      box-sizing: border-box;
      overflow: hidden;
    }
  `;

  // `declare` keeps the accessors Lit installs via `static properties`
  // intact under `useDefineForClassFields: true`; defaults are assigned
  // in the constructor (same rationale as the embed elements).
  declare items: readonly VirtualListRow[];
  declare threshold: number;
  declare rowHeight: number;
  declare viewportHeight: number;
  declare overscan: number;
  declare scrollOffset: number;

  constructor() {
    super();
    this.items = [];
    this.threshold = LIST_VIRTUALIZATION_THRESHOLD;
    this.rowHeight = DEFAULT_ROW_HEIGHT_PX;
    this.viewportHeight = DEFAULT_VIEWPORT_HEIGHT_PX;
    this.overscan = DEFAULT_OVERSCAN_ROWS;
    this.scrollOffset = 0;
  }

  private handleScroll(event: Event): void {
    const target = event.currentTarget;
    if (target instanceof HTMLElement) {
      this.scrollOffset = target.scrollTop;
    }
  }

  private renderRow(row: VirtualListRow, position: number, setSize: number): TemplateResult {
    return html`<div
      class="row"
      part="row"
      role="listitem"
      data-row-key=${row.key}
      aria-posinset=${position}
      aria-setsize=${setSize}
      style="height:${this.rowHeight}px"
    >
      <span part="row-title">${row.title}</span>
      ${row.subtitle !== null
        ? html`<span part="row-subtitle">${row.subtitle}</span>`
        : nothing}
    </div>`;
  }

  protected render(): TemplateResult {
    const rows = this.items;

    if (!shouldVirtualize(rows.length, this.threshold)) {
      return html`<div class="viewport" part="viewport" role="list" data-virtualized="false">
        ${repeat(
          rows,
          (row) => row.key,
          (row, index) => this.renderRow(row, index + 1, rows.length),
        )}
      </div>`;
    }

    const window = computeVirtualWindow({
      scrollTop: this.scrollOffset,
      viewportHeightPx: this.viewportHeight,
      rowHeightPx: this.rowHeight,
      itemCount: rows.length,
      overscanRows: this.overscan,
    });

    return html`<div
      class="viewport"
      part="viewport"
      role="list"
      data-virtualized="true"
      data-window-start=${window.start}
      data-window-end=${window.end}
      style="height:${this.viewportHeight}px"
      @scroll=${this.handleScroll}
    >
      <div
        part="spacer"
        style="padding-top:${window.padTopPx}px;padding-bottom:${window.padBottomPx}px"
      >
        ${repeat(
          rows.slice(window.start, window.end),
          (row) => row.key,
          (row, index) => this.renderRow(row, window.start + index + 1, rows.length),
        )}
      </div>
    </div>`;
  }
}

export const VIRTUAL_LIST_TAG = 'agentable-virtual-list';

// Guarded define instead of @customElement: test environments may load
// this module against a registry that already has the element.
if (customElements.get(VIRTUAL_LIST_TAG) === undefined) {
  customElements.define(VIRTUAL_LIST_TAG, AgentableVirtualListElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'agentable-virtual-list': AgentableVirtualListElement;
  }
}
