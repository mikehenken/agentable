/**
 * JSX typing for `<agentable-virtual-list>` so the React catalog `list`
 * component can mount the element directly (the `src/embed/react.d.ts`
 * pattern for React 19 custom-element JSX). Properties carrying rows and
 * geometry are set imperatively through the ref, so only standard HTML
 * attributes appear here.
 */
import type { DetailedHTMLProps, HTMLAttributes } from 'react';
import type { AgentableVirtualListElement } from './virtual-list';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'agentable-virtual-list': DetailedHTMLProps<
        HTMLAttributes<AgentableVirtualListElement> & {
          'data-testid'?: string;
        },
        AgentableVirtualListElement
      >;
    }
  }
}

export {};
