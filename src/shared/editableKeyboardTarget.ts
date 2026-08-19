/**
 * Detect keyboard/focus targets that should capture typing instead of the
 * tldraw canvas tool shortcuts (shadow-DOM safe via Element.closest).
 */
import { getEditor } from '../engines/tldraw/shapes/panelShapeApi';

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

/**
 * Blur the active tldraw editor when an external composer (operator rail,
 * host page input) takes focus so tool shortcuts do not intercept keystrokes.
 */
export function blurCanvasEditorForExternalComposer(): void {
  getEditor?.().blur();
}
