/**
 * Mounts Gemini Live transport for operator-surface voice sessions ( iter-6).
 * Parallel to WhiteboardVoiceMount — registers kernel impl for operator mic control.
 */
import { useMemo, type ReactElement } from 'react';
import { useGeminiLive } from '../../voice/useGeminiLive';
import { resolveOperatorVoicePersona } from './operatorVoicePersona';
import { resolveWhiteboardChatCredentials } from '../../chat/whiteboardChatCredentials';

export function OperatorVoiceMount(): ReactElement | null {
  const persona = useMemo(() => resolveOperatorVoicePersona, []);
  const creds = useMemo(() => resolveWhiteboardChatCredentials, []);
  const forceMock =
    creds().useMock ||
    (typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia !== 'function');

  useGeminiLive({
    persona: persona(),
    tokenEndpoint: creds().tokenEndpoint.length > 0 ? creds().tokenEndpoint: undefined,
    forceMock,
    mockScenario: forceMock
      ? {
          id: 'operator-demo',
          greeting: 'Operator voice agent connected (demo mode — no live mic transport).',
          turns: [
            {
              text: 'Ask, Build, or Draw — tell me what you need on the canvas.',
              durationMs: 2800,
            },
          ],
        }: undefined,
  });

  return null;
}
