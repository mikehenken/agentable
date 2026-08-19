/**
 * Animated canvas frame — 98% width, figure-ground border, canvas-only expand.
 */
import { useEffect, type CSSProperties, type ReactElement, type ReactNode } from 'react';
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
  const { isCanvasExpanded, exitCanvasExpand } = useWhiteboardHostChromeRequired;

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
    return ()=> document.removeEventListener('keydown', onKeyDown);
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
    return <div data-testid="whiteboard-canvas-frame">{children}</div>;
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
      ): null}
      <motion.div
        data-testid="whiteboard-canvas-frame"
        data-expanded={isCanvasExpanded ? 'true': 'false'}
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
                borderRadius: chrome.frameBorder ? chrome.frameBorderRadius: 0,
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
