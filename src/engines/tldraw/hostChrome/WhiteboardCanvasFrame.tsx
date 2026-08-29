/**
 * Animated canvas frame — 98% width, figure-ground border, canvas-only expand.
 */
import { useEffect, useRef, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { ResolvedWhiteboardHostChrome } from './whiteboardHostChrome';
import { useWhiteboardHostChromeRequired } from './WhiteboardHostChromeContext';

export interface WhiteboardCanvasFrameProps {
  chrome: ResolvedWhiteboardHostChrome;
  children: ReactNode;
  /** Shell background token for expanded backdrop scrim. */
  shellBackground?: string;
}

const EXPAND_TRANSITION = {
  type: 'spring' as const,
  stiffness: 280,
  damping: 32,
  mass: 0.85,
};

export function WhiteboardCanvasFrame({
  chrome,
  children,
  shellBackground = 'var(--landi-color-background, #F0F0EC)',
}: WhiteboardCanvasFrameProps): ReactElement {
  const { isCanvasExpanded, exitCanvasExpand } = useWhiteboardHostChromeRequired();
  const frameRef = useRef<HTMLDivElement>(null);

  /**
   * Let the expanded overlay escape the custom element's own box.
   *
   * `<agentable-whiteboard>` sets `contain: layout paint` on its host. Both of
   * those make the host a containing block for `position: fixed` descendants,
   * so the expanded frame and its scrim positioned themselves against the
   * element rather than the viewport. On a page that embeds the canvas
   * mid-page, expanding opened the overlay at the embed's top edge and let the
   * embed's own clipping cut it off, all while the frame correctly reported
   * data-expanded="true". Geometry was wrong; every flag looked right.
   *
   * Marking the host lets its stylesheet drop containment for exactly as long
   * as the overlay is up. A host element that does not define the matching rule
   * is unaffected, and the attribute doubles as the signal an embedding page
   * needs to relax its own clipping.
   */
  useEffect(() => {
    const root = frameRef.current?.getRootNode();
    const host = root instanceof ShadowRoot ? root.host : null;
    if (host === null) {
      return;
    }
    if (!isCanvasExpanded) {
      host.removeAttribute('data-canvas-expanded');
      return;
    }
    host.setAttribute('data-canvas-expanded', 'true');
    return () => host.removeAttribute('data-canvas-expanded');
  }, [isCanvasExpanded]);

  useEffect(() => {
    if (!isCanvasExpanded) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        exitCanvasExpand();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [exitCanvasExpand, isCanvasExpanded]);

  useEffect(() => {
    if (!isCanvasExpanded) {
      document.body.style.removeProperty('overflow');
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isCanvasExpanded]);

  const hostTop = chrome.hostHeaderHeight ?? '0px';
  const frameBorderStyle: CSSProperties = chrome.frameBorder
    ? {
        border: '1px solid var(--landi-color-border, #E5E5E0)',
        boxShadow: '0 8px 40px rgba(15, 23, 42, 0.06)',
      }: {};

  if (chrome.fullscreenMode !== 'canvas-expand' && chrome.frameWidthPercent >= 100 && !chrome.frameBorder) {
    // Transparent pass-through, but it is still a flex child of the shell
    // column and the parent of the tldraw viewport. Without the same flex
    // contract the styled branch below declares, the viewport's `flex: 1`
    // has no growing parent and the canvas collapses to toolbar height.
    return (
      <div
        data-testid="whiteboard-canvas-frame"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          height: '100%',
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <>
      {isCanvasExpanded ? (
        <motion.div
          aria-hidden
          data-testid="whiteboard-canvas-expand-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={exitCanvasExpand}
          style={{
            position: 'fixed',
            inset: 0,
            top: hostTop,
            zIndex: 9998,
            background: 'rgba(15, 23, 42, 0.12)',
            backdropFilter: 'blur(2px)',
          }}
        />
      ) : null}
      <motion.div
        ref={frameRef}
        data-testid="whiteboard-canvas-frame"
        data-expanded={isCanvasExpanded ? 'true' : 'false'}
        layout
        initial={false}
        animate={
          isCanvasExpanded
            ? {
                position: 'fixed',
                top: hostTop,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100%',
                height: `calc(100dvh - ${hostTop})`,
                margin: 0,
                borderRadius: 0,
                zIndex: 9999,
              }: {
                position: 'relative',
                width: `${chrome.frameWidthPercent}%`,
                maxWidth: `calc(100% - ${chrome.frameEdgeMargin * 2}px)`,
                margin: `${chrome.frameEdgeMargin}px auto`,
                height: '100%',
                flex: 1,
                minHeight: 0,
                borderRadius: chrome.frameBorder ? chrome.frameBorderRadius : 0,
                zIndex: 1,
              }
        }
        transition={EXPAND_TRANSITION}
        style={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
          background: shellBackground,...(!isCanvasExpanded ? frameBorderStyle: {}),
        }}
      >
        {children}
      </motion.div>
    </>
  );
}
