import type { CanvasPersona } from '../config/CanvasContext';

export interface PersonaValidationContext {
  welcomeMessage?: string;
  tenant?: string;
}

export interface PersonaValidationIssue {
  code: 'STARTER_PROMPTS_EMPTY';
  message: string;
}

const STARTER_HINT_PATTERN =
  /one of these|starter prompt|quick start|try asking|suggestion/i;

/**
 * Returns validation issues for persona config (02 section 10 rule 3).
 * Moss regression: tenant persona configured but starterPrompts omitted.
 */
export function validatePersonaStarterPrompts(
  persona: Partial<CanvasPersona>,
  context: PersonaValidationContext = {},
): PersonaValidationIssue[] {
  const prompts = persona.starterPrompts;
  if (prompts && prompts.length > 0) {
    return [];
  }

  const assistantName = persona.assistantName?.trim() ?? '';
  const voiceGreeting = persona.voiceGreeting?.trim() ?? '';
  const welcomeMessage = context.welcomeMessage?.trim() ?? '';

  const isGenericDefault =
    assistantName === 'Assistant' &&
    voiceGreeting === '' &&
    welcomeMessage === '';

  if (isGenericDefault) {
    return [];
  }

  const hasCustomIdentity =
    (assistantName !== '' && assistantName !== 'Assistant') || voiceGreeting !== '';

  const welcomeImpliesChips = STARTER_HINT_PATTERN.test(welcomeMessage);

  if (!hasCustomIdentity && !welcomeImpliesChips) {
    return [];
  }

  const tenantLabel = context.tenant?.trim() ? ` (tenant "${context.tenant}")` : '';

  return [
    {
      code: 'STARTER_PROMPTS_EMPTY',
      message:
        `[agentable] persona validation${tenantLabel}: assistant persona is configured but persona.starterPrompts is empty — empty-state starter chips will not render. Add starterPrompts to embed config.`,
    },
  ];
}

/** Log persona validation warnings once per merged config (dev + embed diagnostics). */
export function warnPersonaStarterPrompts(
  persona: Partial<CanvasPersona>,
  context: PersonaValidationContext = {},
): void {
  if (typeof console === 'undefined' || typeof console.warn !== 'function') {
    return;
  }
  for (const issue of validatePersonaStarterPrompts(persona, context)) {
    console.warn(issue.message);
  }
}
