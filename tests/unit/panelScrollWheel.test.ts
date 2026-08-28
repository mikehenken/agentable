import { describe, expect, it } from 'vitest';
import {
  findScrollableWheelTarget,
  handlePanelWheelCapture,
  panelCapturesHorizontalWheel,
  resolvePanelWheelBlock,
} from '../../src/engines/tldraw/shapes/panelScrollWheel';

function makeScrollable(
  height: number,
  scrollHeight: number,
  scrollTop = 0,
  width = 200,
  scrollWidth = 200): HTMLDivElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientHeight', { value: height, configurable: true });
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(el, 'scrollTop', { value: scrollTop, writable: true, configurable: true });
  Object.defineProperty(el, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, configurable: true });
  Object.defineProperty(el, 'scrollLeft', { value: 0, writable: true, configurable: true });
  el.style.overflowY = 'auto';
  return el;
}

function makeHorizontallyScrollable(width: number, scrollWidth: number, scrollLeft = 0): HTMLDivElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientHeight', { value: 100, configurable: true });
  Object.defineProperty(el, 'scrollHeight', { value: 100, configurable: true });
  Object.defineProperty(el, 'scrollTop', { value: 0, writable: true, configurable: true });
  Object.defineProperty(el, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, configurable: true });
  Object.defineProperty(el, 'scrollLeft', { value: scrollLeft, writable: true, configurable: true });
  el.style.overflowX = 'auto';
  return el;
}

function wheelEvent(target: EventTarget, deltaX = 0, deltaY = 0): WheelEvent & { stopPropagation: () => void } {
  let stopped = false;
  const event = new WheelEvent('wheel', { deltaX, deltaY, bubbles: true });
  event.stopPropagation = () => {
    stopped = true;
  };
  Object.defineProperty(event, 'target', { value: target });
  return Object.assign(event, {
    wasStopped: () => stopped,
  });
}

describe('panelScrollWheel', () => {
  it('finds a scrollable descendant for vertical wheel delta', () => {
    const root = document.createElement('div');
    const scroll = makeScrollable(100, 400, 0);
    root.appendChild(scroll);
    const inner = document.createElement('p');
    scroll.appendChild(inner);

    const target = findScrollableWheelTarget(root, inner, 0, 40);
    expect(target).toBe(scroll);
  });

  it('blocks vertical wheel at scroll boundary when region remains scrollable', () => {
    const root = document.createElement('div');
    const scroll = makeScrollable(100, 400, 0);
    root.appendChild(scroll);

    const target = findScrollableWheelTarget(root, scroll, 0, -40);
    expect(target).toBe(scroll);

    const block = resolvePanelWheelBlock(root, scroll, 0, -40);
    expect(block.blockVertical).toBe(true);
    expect(block.block).toBe(true);
  });

  it('stopPropagation when scrollable child has vertical overflow', () => {
    const root = document.createElement('div');
    const scroll = makeScrollable(100, 400, 50);
    root.appendChild(scroll);

    const event = wheelEvent(scroll, 0, 40);
    handlePanelWheelCapture(root, event);
    expect(event.wasStopped()).toBe(true);
  });

  it('passes through to canvas when nothing scrollable can absorb the wheel', () => {
    const root = document.createElement('div');
    const inner = document.createElement('p');
    root.appendChild(inner);

    const event = wheelEvent(inner, 0, 40);
    handlePanelWheelCapture(root, event);
    expect(event.wasStopped()).toBe(false);
  });

  it('captures horizontal wheel when a descendant is horizontally scrollable', () => {
    const root = document.createElement('div');
    const scroll = makeHorizontallyScrollable(100, 400, 0);
    root.appendChild(scroll);

    const target = findScrollableWheelTarget(root, scroll, 40, 0);
    expect(target).toBe(scroll);

    const block = resolvePanelWheelBlock(root, scroll, 40, 0);
    expect(block.blockHorizontal).toBe(true);
    expect(block.blockVertical).toBe(false);
  });

  it('does not block horizontal wheel when only vertical overflow exists', () => {
    const root = document.createElement('div');
    const scroll = makeScrollable(100, 400, 0);
    root.appendChild(scroll);

    const block = resolvePanelWheelBlock(root, scroll, 40, 0);
    expect(block.block).toBe(false);
  });

  it('captures horizontal wheel for preview-style tab strips', () => {
    const root = document.createElement('div');
    const scroll = makeHorizontallyScrollable(100, 400, 0);
    root.appendChild(scroll);

    const event = wheelEvent(scroll, 40, 0);
    handlePanelWheelCapture(root, event);
    expect(event.wasStopped()).toBe(true);
  });

  it('panelCapturesHorizontalWheel is always enabled for layout detection', () => {
    expect(panelCapturesHorizontalWheel('web-preview')).toBe(true);
    expect(panelCapturesHorizontalWheel('draft-preview')).toBe(true);
    expect(panelCapturesHorizontalWheel('chat')).toBe(true);
  });
});
