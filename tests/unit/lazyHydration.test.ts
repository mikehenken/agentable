/**
 * lazy hydration unit coverage.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DATA_LAZY_HYDRATE_ATTR,
  LAZY_HYDRATE_ATTR,
  observeLazyVisibility,
  readLazyHydrateFlag,
  renderPlaceholderEmbedSkeleton,
  clearPlaceholderEmbedSkeleton,
  ensurePanelEmbedSkeletonStyles,
  PANEL_EMBED_SKELETON_CLASS,
} from '../../src/embed/lazyHydration';

type IntersectionCallback = (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => void;

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();
  readonly takeRecords = vi.fn.mockReturnValue([]);
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: number[] = [];

  private readonly targets = new Set<Element>();

  constructor(private readonly callback: IntersectionCallback) {
    // MockIntersectionObserver.instances.push(this);
  }

  observeElement(target: Element): void {
    this.targets.add(target);
    this.observe(target);
  }

  emit(target: Element, isIntersecting: boolean): void {
    if (!this.targets.has(target)) {
      return;
    }
    this.callback(
      [
        {
          isIntersecting,
          target,
          intersectionRatio: isIntersecting ? 1: 0,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver);
  }

  static reset(): void {
    MockIntersectionObserver.instances = [];
  }

  static emitFor(target: Element, isIntersecting: boolean): void {
    for (const instance of MockIntersectionObserver.instances) {
      instance.emit(target, isIntersecting);
    }
  }
}

describe('lazyHydration — attribute parsing', () => {
  it('reads lazy-hydrate and data-lazy-hydrate flags', () => {
    const byLitAttr = document.createElement('div');
    byLitAttr.setAttribute(LAZY_HYDRATE_ATTR, '');
    expect(readLazyHydrateFlag(byLitAttr)).toBe(true);

    const byDataAttr = document.createElement('div');
    byDataAttr.setAttribute(DATA_LAZY_HYDRATE_ATTR, 'true');
    expect(readLazyHydrateFlag(byDataAttr)).toBe(true);

    const disabled = document.createElement('div');
    disabled.setAttribute(LAZY_HYDRATE_ATTR, 'false');
    expect(readLazyHydrateFlag(disabled)).toBe(false);

    const plain = document.createElement('div');
    expect(readLazyHydrateFlag(plain)).toBe(false);
  });
});

describe('lazyHydration — observeLazyVisibility', () => {
  beforeEach(() => {
    // MockIntersectionObserver.reset();
    vi.stubGlobal(
      'IntersectionObserver',
      MockIntersectionObserver as unknown as typeof IntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defers callback until intersection', () => {
    let observerCallback: IntersectionObserverCallback | undefined;
    class CapturingIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn.mockReturnValue([]);
      root = null;
      rootMargin = '';
      thresholds: number[] = [];
    }

    vi.stubGlobal(
      'IntersectionObserver',
      CapturingIntersectionObserver as unknown as typeof IntersectionObserver);
    const target = document.createElement('div');
    document.body.appendChild(target);
    const onVisible = vi.fn();

    observeLazyVisibility(target, onVisible);
    expect(onVisible).not.toHaveBeenCalled();
    expect(observerCallback).toBeTypeOf('function');

    observerCallback!(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      {} as IntersectionObserver);
    expect(onVisible).toHaveBeenCalledTimes(1);

    observerCallback!(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      {} as IntersectionObserver);
    expect(onVisible).toHaveBeenCalledTimes(1);
  });

  it('invokes immediately when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined as unknown as typeof IntersectionObserver);
    const onVisible = vi.fn();
    observeLazyVisibility(document.createElement('div'), onVisible);
    expect(onVisible).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

describe('lazyHydration — placeholder skeleton', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.querySelector('#agentable-panel-embed-skeleton-styles')?.remove;
  });

  it('renders and clears skeleton markup in light DOM', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderPlaceholderEmbedSkeleton(host);
    ensurePanelEmbedSkeletonStyles(document);

    const skeleton = host.querySelector(`.${PANEL_EMBED_SKELETON_CLASS}`);
    expect(skeleton).not.toBeNull();
    expect(skeleton?.getAttribute('role')).toBe('status');
    expect(document.getElementById('agentable-panel-embed-skeleton-styles')).not.toBeNull();

    clearPlaceholderEmbedSkeleton(host);
    expect(host.querySelector(`.${PANEL_EMBED_SKELETON_CLASS}`)).toBeNull();
  });
});
