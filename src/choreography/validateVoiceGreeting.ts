import type { CanvasPersona } from '../config/CanvasContext';
import {
  DEFAULT_VOICE_GREETING_MODE,
  parseVoiceGreetingMode,
  type VoiceGreetingMode,
} from '../voice/greetingMode';

export interface VoiceGreetingValidationContext {
  tenant?: string;
  /** Raw greetingMode from embed document before persona merge (optional). */
  rawGreetingMode?: unknown;
}

export interface VoiceGreetingValidationIssue {
  code: 'GREETING_MODE_INVALID' | 'AGENT_FIRST_EMPTY_GREETING';
  message: string;
}

function tenantLabel(tenant: string | undefined): string {
  const trimmed = tenant?.trim();
  return trimmed ? ` (tenant "${trimmed}")` : '';
}

/**
 * Resolve greeting mode from persona + optional raw embed field.
 * Invalid raw values produce issues; unresolved persona falls back to default.
 */
export function resolveVoiceGreetingMode(
  persona: Partial<CanvasPersona>,
  context: VoiceGreetingValidationContext = {},
): VoiceGreetingMode {
  const raw = persona.greetingMode ?? context.rawGreetingMode;
  const parsed = parseVoiceGreetingMode(raw);
  return parsed.ok ? parsed.value : DEFAULT_VOICE_GREETING_MODE;
}

/**
 * config validation — greetingMode enum + agent-first empty greeting warn.
 */
export function validateVoiceGreetingConfig(
  persona: Partial<CanvasPersona>,
  context: VoiceGreetingValidationContext = {},
): VoiceGreetingValidationIssue[] {
  const issues: VoiceGreetingValidationIssue[] = [];
  const label = tenantLabel(context.tenant);

  for (const raw of [context.rawGreetingMode, persona.greetingMode]) {
    if (raw === undefined || raw === null || raw === '') {
      continue;
    }
    const parsed = parseVoiceGreetingMode(raw);
    if (!parsed.ok) {
      issues.push({
        code: 'GREETING_MODE_INVALID',
        message: `[agentable] persona validation${label}: ${parsed.error}`,
      });
      break;
    }
  }

  const mode = resolveVoiceGreetingMode(persona, context);
  const voiceGreeting = persona.voiceGreeting?.trim() ?? '';
  const isGenericDefault =
    (persona.assistantName?.trim() ?? 'Assistant') === 'Assistant' &&
    voiceGreeting === '' &&
    persona.greetingMode === undefined &&
    (context.rawGreetingMode === undefined ||
      context.rawGreetingMode === null ||
      context.rawGreetingMode === '');

  if (mode === 'agent-first' && voiceGreeting === '' && !isGenericDefault) {
    issues.push({
      code: 'AGENT_FIRST_EMPTY_GREETING',
      message:
        `[agentable] persona validation${label}: greetingMode is "agent-first" but voiceGreeting is empty — the assistant will connect silently. Set voiceGreeting or switch greetingMode to "user-first".`,
    });
  }

  return issues;
}

/** Signatures already warned — dedupe across _recomputeResolved calls. */
const warnedVoiceGreetingSignatures = new Set<string>();

function voiceGreetingWarnSignature(
  persona: Partial<CanvasPersona>,
  context: VoiceGreetingValidationContext,
): string {
  const tenant = context.tenant?.trim() ?? '';
  const rawMode =
    context.rawGreetingMode === undefined || context.rawGreetingMode === null
      ? ''
      : String(context.rawGreetingMode);
  const personaMode =
    persona.greetingMode === undefined || persona.greetingMode === null
      ? ''
      : String(persona.greetingMode);
  const greeting = persona.voiceGreeting?.trim() ?? '';
  return `${tenant}|${rawMode}|${personaMode}|${greeting}`;
}

/** Log voice greeting validation warnings once per merged config signature. */
export function warnVoiceGreetingConfig(
  persona: Partial<CanvasPersona>,
  context: VoiceGreetingValidationContext = {},
): void {
  if (typeof console === 'undefined' || typeof console.warn !== 'function') {
    return;
  }
  const signature = voiceGreetingWarnSignature(persona, context);
  if (warnedVoiceGreetingSignatures.has(signature)) {
    return;
  }
  const issues = validateVoiceGreetingConfig(persona, context);
  if (issues.length === 0) {
    return;
  }
  warnedVoiceGreetingSignatures.add(signature);
  for (const issue of issues) {
    console.warn(issue.message);
  }
}
