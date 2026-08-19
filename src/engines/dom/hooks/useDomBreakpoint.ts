/**
 * Responsive breakpoint hook for DOM workspace drawer collapse.
 */
import { useEffect, useState } from 'react';
import { DOM_TABLET_MEDIA_QUERY } from '../types';

export interface DomBreakpointState {
  /** True when viewport is at or below the tablet breakpoint. */
  isCompact: boolean;
}

export function useDomBreakpoint(): DomBreakpointState {
  const [isCompact, setIsCompact] = useState<boolean>(() => readCompact);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const media = window.matchMedia(DOM_TABLET_MEDIA_QUERY);
    const onChange = (): void => {
      setIsCompact(media.matches);
    };
    onChange();
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }, []);

  return { isCompact };
}

function readCompact(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(DOM_TABLET_MEDIA_QUERY).matches;
}
