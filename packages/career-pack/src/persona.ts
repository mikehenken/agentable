import type { CareerPersonaScaffold } from './types';

const DEFAULT_SYSTEM_PROMPT =
  'You are a friendly career concierge. Help candidates explore open roles, applications, growth paths, and learning resources. Keep responses concise and conversational.';

const DEFAULT_STARTER_PROMPTS: CareerPersonaScaffold['starterPrompts'] = [
  { emoji: '💼', text: 'What open roles match my background?', label: 'Open roles' },
  { emoji: '📈', text: 'Where could this role lead?', label: 'Growth paths' },
  { emoji: '📚', text: 'What learning resources are available?', label: 'Resources' },
];

/**
 * Persona scaffold for career tenants ( tenant config).
 * Clients override fields via `createCareerPack({ persona: {... } })`.
 */
export function createCareerPersonaScaffold(
  overrides: Partial<CareerPersonaScaffold> = {}): CareerPersonaScaffold {
  return {
    assistantName: overrides.assistantName ?? 'Assistant',
    tenantTitle: overrides.tenantTitle ?? 'Career Concierge',
    voiceGreeting:
      overrides.voiceGreeting ??
      'Hi — I can help you explore roles, applications, and growth paths. What would you like to look at first?',
    starterPrompts: overrides.starterPrompts ?? DEFAULT_STARTER_PROMPTS,
    systemPrompt: overrides.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
  };
}
