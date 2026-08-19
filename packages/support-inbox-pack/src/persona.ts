import type { SupportInboxPersonaScaffold } from './types';

const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful support concierge. Help agents triage tickets, review conversation history, and apply canned responses. Keep replies concise and actionable.';

const DEFAULT_STARTER_PROMPTS: SupportInboxPersonaScaffold['starterPrompts'] = [
  { emoji: '📥', text: 'Show open tickets waiting on us.', label: 'Open inbox' },
  { emoji: '🔍', text: 'Find urgent tickets from today.', label: 'Urgent queue' },
  { emoji: '💬', text: 'What canned responses can I use?', label: 'Macros' },
];

/** Persona scaffold for support tenants ( tenant config). */
export function createSupportInboxPersonaScaffold(
  overrides: Partial<SupportInboxPersonaScaffold> = {}): SupportInboxPersonaScaffold {
  return {
    assistantName: overrides.assistantName ?? 'Assistant',
    tenantTitle: overrides.tenantTitle ?? 'Support Concierge',
    voiceGreeting:
      overrides.voiceGreeting ??
      'Hi — I can help you triage tickets, review threads, and suggest canned replies. What should we look at first?',
    starterPrompts: overrides.starterPrompts ?? DEFAULT_STARTER_PROMPTS,
    systemPrompt: overrides.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
  };
}
