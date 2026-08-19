/**

 * Mount resizable gallery chrome for example 13.

 */

import { createRoot, type Root } from 'react-dom/client';

import { flushSync } from 'react-dom';

import { useEffect, useRef, type ReactElement } from 'react';

import { CanvasWideAgentChrome } from './CanvasWideAgentChrome';

import { cn } from '@/lib/utils';

import '../../index.css';



let activeRoot: Root | null = null;



function DomSlot({

  node,

  className,

  onMounted,

}: {

  node: HTMLElement;

  className?: string;

  onMounted?: () => void;

}): ReactElement {

  const ref = useRef<HTMLDivElement>(null);

  const onMountedRef = useRef(onMounted);

  onMountedRef.current = onMounted;

  const didMountRef = useRef(false);



  useEffect(() => {

    const host = ref.current;

    if (host === null) {

      return;

    }

    host.replaceChildren(node);

    if (didMountRef.current) {

      return;

    }

    didMountRef.current = true;

    onMountedRef.current?.();

  }, [node]);



  return <div ref={ref} className={className} />;

}



function remountOperatorSurfaces(container: ParentNode): void {

  const surfaces: HTMLElement[] = [];

  for (const el of container.querySelectorAll('agentable-operator-surface')) {

    if (el instanceof HTMLElement) {

      surfaces.push(el);

    }

  }

  for (const placement of container.querySelectorAll('agentable-operator-surface-placement')) {

    const nested = placement.shadowRoot?.querySelector('agentable-operator-surface');

    if (nested instanceof HTMLElement) {

      surfaces.push(nested);

    }

  }

  for (const surface of surfaces) {

    if (

      'remountReactShell' in surface &&

      typeof (surface as HTMLElement & { remountReactShell?: () => void }).remountReactShell ===

        'function'

    ) {

      (surface as HTMLElement & { remountReactShell: () => void }).remountReactShell();

    }

  }

}



export interface MountCanvasWideAgentChromeResult {

  ok: boolean;

  error?: string;

  whiteboardReady?: boolean;

}



export function mountCanvasWideAgentChrome(

  container: HTMLElement): MountCanvasWideAgentChromeResult {

  const mainPane = container.querySelector('.canvas-pane');

  const operatorRail = container.querySelector('.operator-rail');



  if (!(mainPane instanceof HTMLElement) || !(operatorRail instanceof HTMLElement)) {

    return { ok: false, error: 'canvas-pane or operator-rail missing' };

  }



  container.style.position = 'relative';

  container.classList.add('gallery-resizable-mounted');



  const mountPoint = document.createElement('div');

  mountPoint.className = 'gallery-chrome-root';

  mountPoint.style.flex = '1';

  mountPoint.style.minHeight = '0';

  mountPoint.style.display = 'flex';

  mountPoint.style.flexDirection = 'column';

  container.appendChild(mountPoint);



  const mainMount = document.createElement('div');

  mainMount.className = 'canvas-pane-inner';

  mainMount.style.height = '100%';

  mainMount.style.minHeight = '0';

  // Keep mounts in-document while reparenting so Lit embeds are not disconnected.

  container.appendChild(mainMount);



  const sidebarMount = document.createElement('div');

  sidebarMount.className = 'operator-rail-inner';

  sidebarMount.style.display = 'flex';

  sidebarMount.style.flexDirection = 'column';

  sidebarMount.style.flex = '1';

  sidebarMount.style.minHeight = '0';

  container.appendChild(sidebarMount);



  while (mainPane.firstChild) {

    mainMount.appendChild(mainPane.firstChild);

  }



  while (operatorRail.firstChild) {

    sidebarMount.appendChild(operatorRail.firstChild);

  }



  mainPane.remove();
  operatorRail.remove();
  activeRoot?.unmount();

  activeRoot = createRoot(mountPoint);

  const remountSidebar = (): void => {

    remountOperatorSurfaces(sidebarMount);

  };



  flushSync(() => {

    activeRoot?.render(

      <CanvasWideAgentChrome

        main={<DomSlot node={mainMount} className="canvas-pane h-full min-h-0" />}

        sidebar={

          <DomSlot

            node={sidebarMount}

            className={cn(

              'operator-rail operator-rail-inner flex h-full min-h-0 flex-col',

              'bg-[var(--vibe-surface,#1a1a1a)]')}

            onMounted={remountSidebar}

          />

        }

      />);

  });



  remountOperatorSurfaces(sidebarMount);

  window.requestAnimationFrame(() => {

    window.requestAnimationFrame(() => {

      remountOperatorSurfaces(sidebarMount);

    });

  });



  remountOperatorSurfaces(sidebarMount);



  return { ok: true, whiteboardReady: undefined };

}



/** Await tldraw re-bind after resizable chrome mount (gallery-13 iter-13). */

export async function awaitGalleryChromeWhiteboardReady(

  container: ParentNode,

  timeoutMs = 25_000): Promise<boolean> {

  if (typeof window !== 'undefined') {

    window.dispatchEvent(new Event('resize'));

  }

  await new Promise<void>((resolve) => {

    requestAnimationFrame(() => {

      requestAnimationFrame(() => {

        window.setTimeout(resolve, 120);

      });

    });

  });



  const mainMount = container.querySelector('.canvas-pane-inner');

  if (!(mainMount instanceof HTMLElement)) {

    return false;

  }

  const whiteboard = mainMount.querySelector('agentable-whiteboard');

  let ready = false;

  if (

    whiteboard instanceof HTMLElement &&

    typeof (whiteboard as HTMLElement & { whenReady?: (ms?: number) => Promise<boolean> }).whenReady ===

      'function'

  ) {

    ready = await (

      whiteboard as HTMLElement & { whenReady: (ms?: number) => Promise<boolean> }

    ).whenReady(timeoutMs);

  }

  const sidebarMount = container.querySelector('.operator-rail-inner');

  if (sidebarMount instanceof HTMLElement) {

    remountOperatorSurfaces(sidebarMount);

  }

  return ready;

}



export function unmountCanvasWideAgentChrome(): void {

  activeRoot?.unmount();

  activeRoot = null;

}



if (typeof window !== 'undefined') {

  window.__mountCanvasWideAgentChrome = mountCanvasWideAgentChrome;

  window.__awaitGalleryChromeWhiteboardReady = awaitGalleryChromeWhiteboardReady;

}



declare global {

  interface Window {

    __mountCanvasWideAgentChrome?: typeof mountCanvasWideAgentChrome;

    __awaitGalleryChromeWhiteboardReady?: typeof awaitGalleryChromeWhiteboardReady;

  }

}


