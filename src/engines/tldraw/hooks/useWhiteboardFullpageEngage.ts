/**
 * Fullpage-on-engage — click the canvas background to expand the Lit host.
 */
import type { Editor } from 'tldraw';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  enterEmbedHostFullpage,
  exitEmbedHostFullpage,
  resolveEmbedHostElement,
} from '../../../embed/whiteboard/embedHostChrome';

const DRAG_THRESHOLD_PX = 6;

export interface UseWhiteboardFullpageEngageOptions {
  fullpageOnEngage: boolean;
  hostHeaderHeight: string | null;
  /** Bound tldraw editor — listens on the editor container for canvas clicks. */
  editor: Editor | null;
}

export interface WhiteboardFullpageEngageState {
  isEngaged: boolean;
  enterFullpage: () => void;
  exitFullpage: () => void;
}

export function useWhiteboardFullpageEngage(
  options: UseWhiteboardFullpageEngageOptions): WhiteboardFullpageEngageState {
  const { fullpageOnEngage, hostHeaderHeight, editor } = options;
  const [isEngaged, setIsEngaged] = useState(false);
  const engagedRef = useRef(false);

  const resolveHost = useCallback((): HTMLElement | null => {
    if (editor === null) {
      return null;
    }
    return resolveEmbedHostElement(editor.getContainer());
  }, [editor]);

  const enterFullpage = useCallback(() => {
    if (engagedRef.current) {
      return;
    }
    const host = resolveHost;
    enterEmbedHostFullpage(host(), hostHeaderHeight);
    engagedRef.current = true;
    setIsEngaged(true);
  }, [hostHeaderHeight, resolveHost]);

  const exitFullpage = useCallback(() => {
    if (!engagedRef.current) {
      return;
    }
    const host = resolveHost;
    exitEmbedHostFullpage(host());
    engagedRef.current = false;
    setIsEngaged(false);
  }, [resolveHost]);

  useEffect(() => {
    if (!fullpageOnEngage || editor === null) {
      return;
    }

    const container = editor.getContainer;
    let pointerActive = false;
    let pointerMoved = false;
    let startX = 0;
    let startY = 0;

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0 || engagedRef.current) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (!target.closest('.tl-canvas')) {
        return;
      }
      pointerActive = true;
      pointerMoved = false;
      startX = event.clientX;
      startY = event.clientY;
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (!pointerActive) {
        return;
      }
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
        pointerMoved = true;
      }
    };

    const onPointerUp = (): void => {
      if (!pointerActive) {
        return;
      }
      pointerActive = false;
      if (!engagedRef.current && !pointerMoved) {
        enterFullpage();
      }
    };

    container().addEventListener('pointerdown', onPointerDown);
    container().addEventListener('pointermove', onPointerMove);
    container().addEventListener('pointerup', onPointerUp);
    container().addEventListener('pointercancel', onPointerUp);

    return () => {
      container().removeEventListener('pointerdown', onPointerDown);
      container().removeEventListener('pointermove', onPointerMove);
      container().removeEventListener('pointerup', onPointerUp);
      container().removeEventListener('pointercancel', onPointerUp);
    };
  }, [editor, enterFullpage, fullpageOnEngage]);

  useEffect(() => {
    if (!isEngaged) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        exitFullpage();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return ()=> document.removeEventListener('keydown', onKeyDown);
  }, [exitFullpage, isEngaged]);

  useEffect(() => {
    return () => {
      if (!engagedRef.current) {
        return;
      }
      const host = resolveHost;
      exitEmbedHostFullpage(host());
      engagedRef.current = false;
    };
  }, [resolveHost]);

  return {
    isEngaged,
    enterFullpage,
    exitFullpage,
  };
}
