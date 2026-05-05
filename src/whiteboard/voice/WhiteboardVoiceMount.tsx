/**
 * WhiteboardVoiceMount — invisible component that mounts `useGeminiLive`
 * so the voice kernel's transport implementation is registered against
 * the active persona.
 *
 * The `<VoiceChip>` in the TopBar then calls `useVoiceCall().toggle()` to
 * start/stop calls; without this mount, `toggle()` hits the no-impl
 * warning path and the call never connects.
 *
 * Why a separate component:
 *   - `useGeminiLive` is a hook with effects (audio context, websocket,
 *     mic streams). It must mount once per route and unmount when the
 *     route leaves. Putting it directly in `WhiteboardShellInner` works
 *     but bloats that file with voice plumbing.
 *   - Returning `null` keeps the visual surface clean — the chip in
 *     TopBar is the only voice UI on the whiteboard.
 */
import type { ReactElement } from 'react';
import { useGeminiLive } from '../../canvas/voice/useGeminiLive';
import { useCanvasConfig } from '../../canvas/CanvasContext';

export function WhiteboardVoiceMount(): ReactElement | null {
  const { persona } = useCanvasConfig();
  // Side-effect only — `useGeminiLive` registers the transport impl on
  // mount and tears it down on unmount. Discarded return value is by
  // design; the rest of the app reads voice state via `useVoiceCall`.
  useGeminiLive({
    persona,
    mockScenario: persona.mockScenario,
  });
  return null;
}
