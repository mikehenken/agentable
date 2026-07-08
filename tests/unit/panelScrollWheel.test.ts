import { describe, expect, it } from 'vitest';
import {
  findScrollableWheelTarget,
  handlePanelWheelCapture,
} from '../../src/whiteboard/shapes/panelScrollWheel';

function makeScrollable(height: number, scrollHeight: number, scrollTop = 0): HTMLDivElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientHeight', { value: height, configurable: true });
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(el, 'scrollTop', { value: scrollTop, writable: true, configurable: true });
  Object.defineProperty(el, 'clientWidth', { value: 200, configurable: true });
  Object.defineProperty(el, 'scrollWidth', { value: 200, configurable: true });
  Object.defineProperty(el, 'scrollLeft', { value: 0, writable: true, configurable: true });
  el.style.overflowY = 'auto';
  return el;
}

describe('panelScrollWheel', () => {
  it('finds a scrollable descendant that can absorb wheel delta', () => {
    const root = document.createElement('div');
    const scroll = makeScrollable(100, 400, 0);
    root.appendChild(scroll);
    const inner = document.createElement('p');
    scroll.appendChild(inner);

    const target = findScrollableWheelTarget(root, inner, 0, 40);
    expect(target).toBe(scroll);
  });

  it('returns null when scrollable region is at boundary', () => {
    const root = document.createElement('div');
    const scroll = makeScrollable(100, 400, 0);
    root.appendChild(scroll);

    const target = findScrollableWheelTarget(root, scroll, 0, -40);
    expect(target).toBeNull();
  });

  it('stopPropagation when scrollable child can scroll', () => {
    const root = document.createElement('div');
    const scroll = makeScrollable(100, 400, 50);
    root.appendChild(scroll);

    let stopped = false;
    const event = new WheelEvent('wheel', { deltaY: 40, bubbles: true });
    event.stopPropagation = () => {
      stopped = true;
    };

    Object.defineProperty(event, 'target', { value: scroll });
    handlePanelWheelCapture(root, event);
    expect(stopped).toBe(true);
  });
});
