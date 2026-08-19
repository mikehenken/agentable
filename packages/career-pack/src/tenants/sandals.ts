import type { PartialCanvasTenantConfig } from '../../../../src/canvas/CanvasContext';
import type { EmbedConfigDocument } from '../../../../src/embed/types/embedConfig';
import {
  createCareerPack,
  resolveCareerHostConfig,
  toEmbedConfigDocument,
} from '../pack';
import { SANDALS_CAREER_DATASET } from '../fixtures/sandals-dataset';
import type { CareerPersonaScaffold } from '../types';
import { CAREER_TENANT_PRIMARY_COLORS } from './careerTenantTokens';
import { SANDALS_CAREER_SYSTEM_PROMPT } from '../prompts/sandalsSystemPrompt';
import {
  SANDALS_STARTER_PROMPTS_WITH_TOOLS,
  resolveCareerChatBundle,
} from '../careerChatBundle';
import { applyCareerEmbedDefaults } from '../whiteboard/careerCanvasDefaults';

/** Sandals brand mark for whiteboard top bar (host resolves absolute URL). */
export const SANDALS_BRAND_LOGO = {
  url: '/images/sandals-logo.png',
  alt: 'Sandals Resorts',
  height: 28,
} as const;

/** Sandals Career Concierge starter chips (English). */
export const SANDALS_STARTER_PROMPTS: CareerPersonaScaffold['starterPrompts'] = [
  { emoji: '💼', text: 'Show me Sandals jobs that fit my resume', label: 'Jobs for me' },
  { emoji: '🌴', text: 'Which island fits the life I want?', label: 'Pick an island' },
  { emoji: '📈', text: 'Where could a line cook end up in five years?', label: 'Growth paths' },
  { emoji: '🎓', text: 'Tell me about Sandals Corporate University', label: 'SCU' },
];

/** D59 — Spanish starter chips for sandals local integration. */
export const SANDALS_STARTER_PROMPTS_ES: CareerPersonaScaffold['starterPrompts'] = [
  { emoji: '💼', text: 'Muéstrame vacantes de Sandals que encajen con mi currículum', label: 'Vacantes' },
  { emoji: '🌴', text: '¿Qué isla encaja con la vida que quiero?', label: 'Elegir isla' },
  { emoji: '📈', text: '¿A dónde puede llegar un cocinero de línea en cinco años?', label: 'Trayectorias' },
  { emoji: '🎓', text: 'Cuéntame sobre Sandals Corporate University', label: 'SCU' },
];

export interface SandalsPersonaLocale {
  assistantName: string;
  tenantTitle: string;
  welcomeMessage: string;
  voiceGreeting: string;
  starterPrompts: CareerPersonaScaffold['starterPrompts'];
}

export const SANDALS_PERSONA_EN: SandalsPersonaLocale = {
  assistantName: 'Sandy',
  tenantTitle: 'Career Concierge',
  welcomeMessage:
    "Hi there — I'm Sandy, your Career Concierge at Sandals. I'm AI, but the career info I share is real — straight from the Sandals team. What pulled you toward working with Sandals?",
  voiceGreeting:
    "Hi there — I'm Sandy, your Career Concierge at Sandals. The career info I give you is real, verified with the team. When you're ready, we can talk roles, islands, or what a path here can look like—no rush. I'm listening.",
  starterPrompts: SANDALS_STARTER_PROMPTS,
};

/** D59 — Spanish persona variant for sandals local integration. */
export const SANDALS_PERSONA_ES: SandalsPersonaLocale = {
  assistantName: 'Sandy',
  tenantTitle: 'Concierge de Carrera',
  welcomeMessage:
    'Hola — soy Sandy, tu Concierge de Carrera en Sandals. Soy IA, pero la información de carrera que comparto es real, directamente del equipo de Sandals. ¿Qué te atrajo a trabajar con Sandals?',
  voiceGreeting:
    'Hola — soy Sandy, tu Concierge de Carrera en Sandals. La información que te doy es real y verificada con el equipo. Cuando quieras, hablamos de roles, islas o cómo puede verse un camino aquí — sin prisa. Te escucho.',
  starterPrompts: SANDALS_STARTER_PROMPTS_ES,
};

export type SandalsLocaleTag = 'en' | 'es';

export function resolveSandalsPersona(locale: SandalsLocaleTag = 'en'): SandalsPersonaLocale {
  return locale === 'es' ? SANDALS_PERSONA_ES : SANDALS_PERSONA_EN;
}

export interface CreateSandalsEmbedConfigInput {
  locale?: SandalsLocaleTag;
  /** Full Sandy system prompt from @sandals/career-canvas voice module. */
  systemPrompt: string;
  /** Relative URL from sandals site root to static fixture panel-data JSON. */
  fixtureDataUrl?: string;
  primaryColor?: string;
}

/**
 * Build a config-url document for the Sandals Career Concierge plain-HTML host.
 * Uses static adapter over local fixtures — no ATS backend (G1/G2).
 */
export function createSandalsEmbedConfig(input: CreateSandalsEmbedConfigInput): EmbedConfigDocument {
  const locale = input.locale ?? 'en';
  const personaLocale = resolveSandalsPersona(locale);
  const chatBundle = resolveCareerChatBundle('sandals');
  const systemPrompt = input.systemPrompt?.trim() || SANDALS_CAREER_SYSTEM_PROMPT;
  const pack = createCareerPack({
    tenant: 'sandals',
    dataset: SANDALS_CAREER_DATASET,
    persona: {
      assistantName: personaLocale.assistantName,
      tenantTitle: personaLocale.tenantTitle,
      voiceGreeting: personaLocale.voiceGreeting,
      starterPrompts: [...SANDALS_STARTER_PROMPTS_WITH_TOOLS],
      systemPrompt,
    },
  });
  const hostConfig = resolveCareerHostConfig(pack, {
    tenant: 'sandals',
    dataset: SANDALS_CAREER_DATASET,
    adapter: {
      kind: 'static',
      dataUrl: input.fixtureDataUrl ?? 'data/sandals-career-fixture.json',
    },
  });
  const doc = toEmbedConfigDocument(hostConfig);
  return applyCareerEmbedDefaults({
    ...doc,
    locale,
    primaryColor: input.primaryColor ?? CAREER_TENANT_PRIMARY_COLORS.sandals,
    welcomeMessage: personaLocale.welcomeMessage,
    voiceEnabled: true,
    snapGrid: true,
    canvasMode: 'bounded',
    canvasBounds: '1200x800',
    canvasZoom: 'locked',
    greetingMode: 'agent-first',
    toolbar: chatBundle.toolbarConfig,
    persona: {
      ...doc.persona,
      assistantName: personaLocale.assistantName,
      tenantTitle: personaLocale.tenantTitle,
      voiceGreeting: personaLocale.voiceGreeting,
      starterPrompts: [...SANDALS_STARTER_PROMPTS_WITH_TOOLS],
      systemPrompt,
      greetingMode: 'agent-first',
      brandLogo: SANDALS_BRAND_LOGO,
      visual: {
        type: 'halo',
        showInChat: true,
        showInHeader: false,
      },
    } satisfies PartialCanvasTenantConfig['persona'],
  });
}
