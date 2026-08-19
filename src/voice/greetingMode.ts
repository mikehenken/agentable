/**
 * — voice greeting mode: who speaks first on connect.
 *
 * - `agent-first`: assistant speaks `voiceGreeting` when the session opens.
 * - `user-first`: session opens in listening state; user speaks first.
 */
export type VoiceGreetingMode = 'agent-first' | 'user-first';

export const VOICE_GREETING_MODES: readonly VoiceGreetingMode[] = [
  'agent-first',
  'user-first',
] as const;

export const DEFAULT_VOICE_GREETING_MODE: VoiceGreetingMode = 'agent-first';

export type ParseVoiceGreetingModeResult =
  | { ok: true; value: VoiceGreetingMode }
  | { ok: false; error: string };

/**
 * Parse embed persona `greetingMode`. Empty input resolves to the default
 * (`agent-first`) for backward-compatible behavior.
 */
export function parseVoiceGreetingMode(raw: unknown): ParseVoiceGreetingModeResult {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: DEFAULT_VOICE_GREETING_MODE };
  }
  if (typeof raw !== 'string') {
    return { ok: false, error: 'greetingMode must be a string' };
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'agent-first' || normalized === 'user-first') {
    return { ok: true, value: normalized };
  }
  return {
    ok: false,
    error: `greetingMode must be "agent-first" or "user-first", got "${raw}"`,
  };
}

/**
 * Returns the greeting text to speak on voice connect, or `undefined` when
 * the session should open in user-first (listening) mode.
 */
export function resolveConnectGreeting(
  mode: VoiceGreetingMode | undefined,
  voiceGreeting: string | undefined): string | undefined {
  const effectiveMode = mode ?? DEFAULT_VOICE_GREETING_MODE;
  if (effectiveMode === 'user-first') {
    return undefined;
  }
  const trimmed = voiceGreeting?.trim() ?? '';
  return trimmed.length > 0 ? trimmed: undefined;
}
