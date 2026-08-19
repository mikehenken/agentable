/**

 * Resizable canvas + operator rail chrome for example 13 (P13-T7 iter-7).

 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';

import { PanelLeftClose } from 'lucide-react';

import {

  ResizableHandle,

  ResizablePanel,

  ResizablePanelGroup,

} from '@/components/ui/resizable';

import { cn } from '@/lib/utils';

import {

  OPERATOR_RAIL_COLLAPSE_STORAGE_KEY,

  OPERATOR_RAIL_SET_COLLAPSED_EVENT,

  readOperatorRailCollapsed,

  setOperatorRailCollapsed,

  subscribeOperatorRailCollapsed,

  type OperatorRailCollapsedChangedDetail,

} from './operatorRailChromeBridge';



const STORAGE_KEY = 'p13-operator-rail-size';



export interface CanvasWideAgentChromeProps {

  main: ReactNode;

  sidebar: ReactNode;

}



function readStoredSize(): number {

  if (typeof window === 'undefined') {

    return 32;

  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  const parsed = raw !== null ? Number.parseFloat(raw) : Number.NaN;

  if (!Number.isFinite(parsed)) {

    return 32;

  }

  return Math.min(42, Math.max(18, parsed));

}



export function CanvasWideAgentChrome({

  main,

  sidebar,

}: CanvasWideAgentChromeProps): ReactElement {

  const [sidebarSize, setSidebarSize] = useState<number>(() => readStoredSize());

  const [collapsed, setCollapsed] = useState<boolean>(() => readOperatorRailCollapsed());



  const defaultLayout = useMemo(

    () => ({

      'gallery-main': collapsed ? 100 : 100 - sidebarSize,

      'gallery-sidebar': collapsed ? 0 : sidebarSize,

    }),

    [collapsed, sidebarSize],

  );



  const handleLayout = useCallback(

    (layout: Record<string, number>) => {

      const nextSidebar = layout['gallery-sidebar'];

      if (typeof nextSidebar === 'number' && nextSidebar > 0) {

        setSidebarSize(nextSidebar);

        window.localStorage.setItem(STORAGE_KEY, String(nextSidebar));

      }

    },

    [],

  );



  const handleCollapse = useCallback(() => {

    setOperatorRailCollapsed(true);

  }, []);



  useEffect(() => {

    return subscribeOperatorRailCollapsed(setCollapsed);

  }, []);



  useEffect(() => {

    const onSetCollapsed = (event: Event): void => {

      const detail = (event as CustomEvent<OperatorRailCollapsedChangedDetail>).detail;

      if (detail && typeof detail.collapsed === 'boolean') {

        setOperatorRailCollapsed(detail.collapsed);

      }

    };

    window.addEventListener(OPERATOR_RAIL_SET_COLLAPSED_EVENT, onSetCollapsed);

    return () => {

      window.removeEventListener(OPERATOR_RAIL_SET_COLLAPSED_EVENT, onSetCollapsed);

    };

  }, []);



  useEffect(() => {

    window.localStorage.setItem(OPERATOR_RAIL_COLLAPSE_STORAGE_KEY, collapsed ? '1' : '0');

  }, [collapsed]);



  return (

    <div

      className="relative flex h-full min-h-0 w-full flex-col"

      data-testid="gallery-resizable-chrome"

      data-operator-rail-collapsed={collapsed ? 'true' : 'false'}

      style={

        {

          '--vibe-border': 'rgb(255 255 255 / 0.09)',

          '--vibe-surface': '#1a1a1a',

        } as CSSProperties

      }

    >

      <ResizablePanelGroup

        direction="horizontal"

        className="min-h-0 flex-1"

        defaultLayout={defaultLayout}

        onLayoutChanged={handleLayout}

      >

        <ResizablePanel

          id="gallery-main"

          minSize="40"

          className="min-w-0"

        >

          <div className="h-full min-h-0">{main}</div>

        </ResizablePanel>

        {!collapsed ? (

          <>

            <ResizableHandle

              className={cn(

                'relative w-px shrink-0 border-0 bg-transparent p-0',

                'before:absolute before:inset-y-0 before:left-0 before:w-px',

                'before:bg-[var(--vibe-border,rgb(255_255_255/0.09))]',

                'after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2',

                'hover:after:w-1.5',

              )}

            />

            <ResizablePanel

              id="gallery-sidebar"

              minSize="18"

              maxSize="42"

              className="min-w-0"

            >

              <div className="relative flex h-full min-h-0 flex-col">

                <button

                  type="button"

                  data-testid="operator-rail-collapse"

                  aria-label="Collapse operator rail"

                  className={cn(

                    'absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md border',

                    'border-[var(--vibe-border,rgb(255_255_255/0.09))] bg-[var(--vibe-composer-bg,#141414)]',

                    'text-[var(--vibe-text-muted,#9a9a9a)] hover:text-[var(--vibe-text,#ececec)]',

                  )}

                  onClick={handleCollapse}

                >

                  <PanelLeftClose size={14} aria-hidden />

                </button>

                {sidebar}

              </div>

            </ResizablePanel>

          </>

        ) : null}

      </ResizablePanelGroup>

    </div>

  );

}


