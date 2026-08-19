/**
 * Operator embed stub — no tldraw/panelShapeApi import ( iter-9).
 * Blurs the whiteboard host editor when the operator composer takes focus.
 */

export function editableTargetShouldCaptureKey(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(
    target.closest(
      [
        'input',
        'textarea',
        'select',
        '[contenteditable=""]',
        '[contenteditable="true"]',
        '[contenteditable="plaintext-only"]',
      ].join(', ')));
}

interface WhiteboardBlurHost extends HTMLElement {
  blurCanvasEditor?: () => void;
}

export function blurCanvasEditorForExternalComposer(): void {
  const host = document.querySelector('agentable-whiteboard');
  if (!(host instanceof HTMLElement)) {
    return;
  }
  const whiteboard = host as WhiteboardBlurHost;
  if (typeof whiteboard.blurCanvasEditor === 'function') {
    whiteboard.blurCanvasEditor();
  }
}
