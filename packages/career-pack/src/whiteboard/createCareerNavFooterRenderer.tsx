import type { ReactNode } from 'react';
import { CareerNavFooter } from './CareerNavFooter';

/** Factory for WhiteboardShell `renderNavFooter` (career hosts). */
export function createCareerNavFooterRenderer(options?: {
  voiceActive?: boolean;
}): (openPanel: (panelId: string) => void) => ReactNode {
  const voiceActive = options?.voiceActive ?? false;
  return (openPanel) => (
    <CareerNavFooter
      voiceActive={voiceActive}
      onOpenSettings={() => openPanel('settings')}
      onEndCall={() => {
        window.dispatchEvent(new CustomEvent('landi:voice-end'));
      }}
    />
  );
}
