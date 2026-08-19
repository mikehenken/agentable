import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ResolvedWhiteboardHostChrome } from './whiteboardHostChrome';

export interface WhiteboardHostChromeContextValue {
  chrome: ResolvedWhiteboardHostChrome;
  isCanvasExpanded: boolean;
  toggleCanvasExpand: () => void;
  exitCanvasExpand: () => void;
}

const WhiteboardHostChromeContext = createContext<WhiteboardHostChromeContextValue | null>(
  null,
);

export interface WhiteboardHostChromeProviderProps {
  chrome: ResolvedWhiteboardHostChrome;
  children: ReactNode;
}

export function WhiteboardHostChromeProvider({
  chrome,
  children,
}: WhiteboardHostChromeProviderProps): ReactNode {
  const [isCanvasExpanded, setIsCanvasExpanded] = useState(false);

  const toggleCanvasExpand = useCallback(() => {
    setIsCanvasExpanded((prev) => !prev);
  }, []);

  const exitCanvasExpand = useCallback(() => {
    setIsCanvasExpanded(false);
  }, []);

  const value = useMemo(
    (): WhiteboardHostChromeContextValue => ({
      chrome,
      isCanvasExpanded,
      toggleCanvasExpand,
      exitCanvasExpand,
    }),
    [chrome, isCanvasExpanded, toggleCanvasExpand, exitCanvasExpand],
  );

  return (
    <WhiteboardHostChromeContext.Provider value={value}>
      {children}
    </WhiteboardHostChromeContext.Provider>
  );
}

export function useWhiteboardHostChrome(): WhiteboardHostChromeContextValue | null {
  return useContext(WhiteboardHostChromeContext);
}

/** Required inside WhiteboardShell when TopBar expand is enabled. */
export function useWhiteboardHostChromeRequired(): WhiteboardHostChromeContextValue {
  const ctx = useContext(WhiteboardHostChromeContext);
  if (ctx === null) {
    throw new Error('useWhiteboardHostChromeRequired must be used within WhiteboardHostChromeProvider');
  }
  return ctx;
}
