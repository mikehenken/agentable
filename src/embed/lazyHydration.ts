/**
 * P9-T5 lazy hydration — visibility-gated panel activation (D44).
 *
 * Shared IntersectionObserver helpers for `<agentable-panel>` and auto-mount
 * placeholders. Uses the same root margin for prefetch-before-visible.
 */
import { css, html, type TemplateResult } from 'lit';

/** Lit / DOM attribute for deferred hydration until visible. */
export const LAZY_HYDRATE_ATTR = 'lazy-hydrate';

/** Placeholder marker on auto-mount hosts. */
export const DATA_LAZY_HYDRATE_ATTR = 'data-lazy-hydrate';

/** Auto-mount placeholder awaiting visibility before panel mount. */
export const DATA_LAZY_PENDING_ATTR = 'data-agentable-lazy-pending';

/** Light-DOM skeleton root class (placeholders). */
export const PANEL_EMBED_SKELETON_CLASS = 'agentable-panel-embed-skeleton';

/** Default prefetch margin — hydrate shortly before entering the viewport. */
export const DEFAULT_LAZY_ROOT_MARGIN = '200px 0px';

export interface LazyVisibilityOptions {
  root?: Element | Document | null;
  rootMargin?: string;
  threshold?: number | number[];
}

export interface LazyVisibilityHandle {
  disconnect: () => void;
}

const BOOLEAN_TRUE = new Set(['', 'true', '1', 'yes']);

export function readLazyHydrateFlag(element: Element): boolean {
  if (element.hasAttribute(LAZY_HYDRATE_ATTR)) {
    const raw = element.getAttribute(LAZY_HYDRATE_ATTR);
    if (raw === null) {
      return true;
    }
    return BOOLEAN_TRUE.has(raw.trim().toLowerCase());
  }
  if (element.hasAttribute(DATA_LAZY_HYDRATE_ATTR)) {
    const raw = element.getAttribute(DATA_LAZY_HYDRATE_ATTR);
    if (raw === null) {
      return true;
    }
    return BOOLEAN_TRUE.has(raw.trim().toLowerCase());
  }
  return false;
}

/**
 * Observe `target` and invoke `onVisible` once when it intersects the viewport.
 * Falls back to immediate activation when IntersectionObserver is unavailable.
 */
export function observeLazyVisibility(
  target: Element,
  onVisible: () => void,
  options: LazyVisibilityOptions = {},
): LazyVisibilityHandle {
  if (typeof IntersectionObserver === 'undefined') {
    onVisible();
    return { disconnect: () => undefined };
  }

  let settled = false;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.target !== target || !entry.isIntersecting || settled) {
          continue;
        }
        settled = true;
        observer.disconnect();
        onVisible();
        return;
      }
    },
    {
      root: options.root ?? null,
      rootMargin: options.rootMargin ?? DEFAULT_LAZY_ROOT_MARGIN,
      threshold: options.threshold ?? 0,
    },
  );

  observer.observe(target);

  return {
    disconnect: () => {
      settled = true;
      observer.disconnect();
    },
  };
}

/** Skeleton CSS shared by Lit shadow DOM and light-DOM placeholders. */
export const panelEmbedSkeletonStyles = css`
  .agentable-panel-embed-skeleton {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    min-height: inherit;
    padding: 16px;
    border-radius: var(--landi-radius-panel, 12px);
    background: var(--landi-color-background, #f0f0ec);
  }

  .agentable-panel-embed-skeleton__bar {
    height: 14px;
    border-radius: 999px;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--landi-color-primary, #3b82f6) 12%, transparent) 0%,
      color-mix(in srgb, var(--landi-color-primary, #3b82f6) 22%, transparent) 50%,
      color-mix(in srgb, var(--landi-color-primary, #3b82f6) 12%, transparent) 100%
    );
    animation: agentable-panel-skeleton-pulse 1.4s ease-in-out infinite;
  }

  .agentable-panel-embed-skeleton__bar--title {
    width: 42%;
    height: 18px;
  }

  .agentable-panel-embed-skeleton__bar--body {
    width: 100%;
  }

  .agentable-panel-embed-skeleton__bar--body-short {
    width: 72%;
  }

  @keyframes agentable-panel-skeleton-pulse {
    0%,
    100% {
      opacity: 0.55;
    }
    50% {
      opacity: 1;
    }
  }
`;

/** Lit skeleton template (part=skeleton, D44 skeleton-first). */
export function renderPanelEmbedSkeletonTemplate(loadingLabel = 'Loading panel…'): TemplateResult {
  return html`
    <div
      part="skeleton"
      class="agentable-panel-embed-skeleton"
      role="status"
      aria-busy="true"
      aria-live="polite"
      data-testid="agentable-panel-embed-skeleton"
    >
      <span class="visually-hidden">${loadingLabel}</span>
      <div class="agentable-panel-embed-skeleton__bar agentable-panel-embed-skeleton__bar--title"></div>
      <div class="agentable-panel-embed-skeleton__bar agentable-panel-embed-skeleton__bar--body"></div>
      <div
        class="agentable-panel-embed-skeleton__bar agentable-panel-embed-skeleton__bar--body agentable-panel-embed-skeleton__bar--body-short"
      ></div>
    </div>
  `;
}

/** Insert matching skeleton into a light-DOM auto-mount placeholder. */
export function renderPlaceholderEmbedSkeleton(host: HTMLElement, loadingLabel = 'Loading panel…'): void {
  if (typeof document !== 'undefined') {
    ensurePanelEmbedSkeletonStyles(document);
  }
  if (host.querySelector(`.${PANEL_EMBED_SKELETON_CLASS}`) !== null) {
    return;
  }

  const skeleton = document.createElement('div');
  skeleton.className = PANEL_EMBED_SKELETON_CLASS;
  skeleton.setAttribute('role', 'status');
  skeleton.setAttribute('aria-busy', 'true');
  skeleton.setAttribute('aria-live', 'polite');
  skeleton.setAttribute('data-testid', 'agentable-panel-embed-skeleton');

  const srOnly = document.createElement('span');
  srOnly.className = 'visually-hidden';
  srOnly.textContent = loadingLabel;
  skeleton.appendChild(srOnly);

  for (const className of [
    'agentable-panel-embed-skeleton__bar agentable-panel-embed-skeleton__bar--title',
    'agentable-panel-embed-skeleton__bar agentable-panel-embed-skeleton__bar--body',
    'agentable-panel-embed-skeleton__bar agentable-panel-embed-skeleton__bar--body agentable-panel-embed-skeleton__bar--body-short',
  ]) {
    const bar = document.createElement('div');
    bar.className = className;
    skeleton.appendChild(bar);
  }

  host.appendChild(skeleton);
}

export function clearPlaceholderEmbedSkeleton(host: HTMLElement): void {
  host.querySelector(`.${PANEL_EMBED_SKELETON_CLASS}`)?.remove();
}

const PLACEHOLDER_SKELETON_STYLE_ID = 'agentable-panel-embed-skeleton-styles';

const PLACEHOLDER_SKELETON_CSS = `
.${PANEL_EMBED_SKELETON_CLASS} {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  min-height: 420px;
  padding: 16px;
  border-radius: var(--landi-radius-panel, 12px);
  background: var(--landi-color-background, #f0f0ec);
}

.${PANEL_EMBED_SKELETON_CLASS} .agentable-panel-embed-skeleton__bar {
  height: 14px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--landi-color-primary, #3b82f6) 12%, transparent) 0%,
    color-mix(in srgb, var(--landi-color-primary, #3b82f6) 22%, transparent) 50%,
    color-mix(in srgb, var(--landi-color-primary, #3b82f6) 12%, transparent) 100%
  );
  animation: agentable-panel-skeleton-pulse 1.4s ease-in-out infinite;
}

.${PANEL_EMBED_SKELETON_CLASS} .agentable-panel-embed-skeleton__bar--title {
  width: 42%;
  height: 18px;
}

.${PANEL_EMBED_SKELETON_CLASS} .agentable-panel-embed-skeleton__bar--body {
  width: 100%;
}

.${PANEL_EMBED_SKELETON_CLASS} .agentable-panel-embed-skeleton__bar--body-short {
  width: 72%;
}

.${PANEL_EMBED_SKELETON_CLASS} .visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes agentable-panel-skeleton-pulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}
`;

/** Inject light-DOM skeleton styles once (auto-mount placeholders). */
export function ensurePanelEmbedSkeletonStyles(doc: Document = document): void {
  if (doc.getElementById(PLACEHOLDER_SKELETON_STYLE_ID) !== null) {
    return;
  }
  const style = doc.createElement('style');
  style.id = PLACEHOLDER_SKELETON_STYLE_ID;
  style.textContent = PLACEHOLDER_SKELETON_CSS;
  doc.head.appendChild(style);
}
