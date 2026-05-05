/**
 * WhiteboardChatPanel — flush-column chat surface for the whiteboard.
 *
 * Reuses the existing `<ChatPanel chromeless>` from the legacy canvas:
 *   - Same Gemini chat client (real API, tool round-trips)
 *   - Same voice transcript subscription (`landi:voice-transcript`)
 *   - Same tool call echo (`landi:tool-call`)
 *   - Same focus event (`landi:focus-chat-input`)
 *
 * The only difference is presentation:
 *   - No `<DraggablePanel>` wrapper (the chat column is fixed by the
 *     `WhiteboardShell` grid)
 *   - No `useLayoutStore` visibility gate (the column is always visible
 *     when the route is mounted)
 *
 * That isolation is owned by the `chromeless` prop on the underlying
 * `<ChatPanel>` component. By keeping one component with a chromeless
 * mode, both substrates share bug-fix and feature work — no
 * second copy to drift.
 */
import type { ReactElement } from 'react';
import { ChatPanel } from '../../canvas/ChatPanel';

export function WhiteboardChatPanel(): ReactElement {
  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <ChatPanel chromeless />
    </div>
  );
}
