import type { PartialCanvasTenantConfig } from '../../../../src/canvas/CanvasContext';
import type { EmbedConfigDocument } from '../../../../src/embed/types/embedConfig';
import {
  createCareerPack,
  resolveCareerHostConfig,
  toEmbedConfigDocument,
} from '../pack';
import { ARCHIPELAGO_CAREER_DATASET } from '../fixtures/archipelago-dataset';
import type { CareerPersonaScaffold } from '../types';
import { CAREER_TENANT_PRIMARY_COLORS } from './careerTenantTokens';
import { ARCHIPELAGO_CAREER_SYSTEM_PROMPT } from '../prompts/archipelagoSystemPrompt';
import {
  ARCHIPELAGO_STARTER_PROMPTS_WITH_TOOLS,
  resolveCareerChatBundle,
} from '../careerChatBundle';
import { applyCareerEmbedDefaults } from '../whiteboard/careerCanvasDefaults';

/** Archipelago brand mark for whiteboard top bar (host resolves absolute URL). */
export const ARCHIPELAGO_BRAND_LOGO = {
  url: '/images/archipelago-logo.png',
  alt: 'Archipelago Resorts',
  height: 28,
} as const;

/** Archipelago Career Concierge starter chips (English). */
export const ARCHIPELAGO_STARTER_PROMPTS: CareerPersonaScaffold['starterPrompts'] = [
  { emoji: '💼', text: 'Show me Archipelago jobs that fit my resume', label: 'Jobs for me' },
  { emoji: '🌴', text: 'Which island fits the life I want?', label: 'Pick an island' },
  { emoji: '📈', text: 'Where could a line cook end up in five years?', label: 'Growth paths' },
  { emoji: '🎓', text: 'Tell me about Archipelago Corporate University', label: 'SCU' },
];

/** Spanish starter chips for archipelago local integration. */
export const ARCHIPELAGO_STARTER_PROMPTS_ES: CareerPersonaScaffold['starterPrompts'] = [
  { emoji: '💼', text: 'Muéstrame vacantes de Archipelago que encajen con mi currículum', label: 'Vacantes' },
  { emoji: '🌴', text: '¿Qué isla encaja con la vida que quiero?', label: 'Elegir isla' },
  { emoji: '📈', text: '¿A dónde puede llegar un cocinero de línea en cinco años?', label: 'Trayectorias' },
  { emoji: '🎓', text: 'Cuéntame sobre Archipelago Corporate University', label: 'SCU' },
];

export interface ArchipelagoPersonaLocale {
  assistantName: string;
  tenantTitle: string;
  welcomeMessage: string;
  voiceGreeting: string;
  starterPrompts: CareerPersonaScaffold['starterPrompts'];
}

export const ARCHIPELAGO_PERSONA_EN: ArchipelagoPersonaLocale = {
  assistantName: 'Sandy',
  tenantTitle: 'Career Concierge',
  welcomeMessage:
    "Hi there — I'm Sandy, your Career Concierge at Archipelago. I'm AI, but the career info I share is real — straight from the Archipelago team. What pulled you toward working with Archipelago?",
  voiceGreeting:
    "Hi there — I'm Sandy, your Career Concierge at Archipelago. The career info I give you is real, verified with the team. When you're ready, we can talk roles, islands, or what a path here can look like—no rush. I'm listening.",
  starterPrompts: ARCHIPELAGO_STARTER_PROMPTS,
};

/** Spanish persona variant for archipelago local integration. */
export const ARCHIPELAGO_PERSONA_ES: ArchipelagoPersonaLocale = {
  assistantName: 'Sandy',
  tenantTitle: 'Concierge de Carrera',
  welcomeMessage:
    'Hola — soy Sandy, tu Concierge de Carrera en Archipelago. Soy IA, pero la información de carrera que comparto es real, directamente del equipo de Archipelago. ¿Qué te atrajo a trabajar con Archipelago?',
  voiceGreeting:
    'Hola — soy Sandy, tu Concierge de Carrera en Archipelago. La información que te doy es real y verificada con el equipo. Cuando quieras, hablamos de roles, islas o cómo puede verse un camino aquí — sin prisa. Te escucho.',
  starterPrompts: ARCHIPELAGO_STARTER_PROMPTS_ES,
};

export type ArchipelagoLocaleTag = 'en' | 'es';

export function resolveArchipelagoPersona(locale: ArchipelagoLocaleTag = 'en'): ArchipelagoPersonaLocale {
  return locale === 'es' ? ARCHIPELAGO_PERSONA_ES : ARCHIPELAGO_PERSONA_EN;
}

export interface CreateArchipelagoEmbedConfigInput {
  locale?: ArchipelagoLocaleTag;
  /** Full Sandy system prompt from @archipelago/career-canvas voice module. */
  systemPrompt: string;
  /** Relative URL from archipelago site root to static fixture panel-data JSON. */
  fixtureDataUrl?: string;
  primaryColor?: string;
}

/**
 * Build a config-url document for the Archipelago Career Concierge plain-HTML host.
 * Uses static adapter over local fixtures — no ATS backend (G1/G2).
 */
export function createArchipelagoEmbedConfig(input: CreateArchipelagoEmbedConfigInput): EmbedConfigDocument {
  const locale = input.locale ?? 'en';
  const personaLocale = resolveArchipelagoPersona(locale);
  const chatBundle = resolveCareerChatBundle('archipelago');
  const systemPrompt = input.systemPrompt?.trim() || ARCHIPELAGO_CAREER_SYSTEM_PROMPT;
  const pack = createCareerPack({
    tenant: 'archipelago',
    dataset: ARCHIPELAGO_CAREER_DATASET,
    persona: {
      assistantName: personaLocale.assistantName,
      tenantTitle: personaLocale.tenantTitle,
      voiceGreeting: personaLocale.voiceGreeting,
      starterPrompts: [...ARCHIPELAGO_STARTER_PROMPTS_WITH_TOOLS],
      systemPrompt,
    },
  });
  const hostConfig = resolveCareerHostConfig(pack, {
    tenant: 'archipelago',
    dataset: ARCHIPELAGO_CAREER_DATASET,
    adapter: {
      kind: 'static',
      dataUrl: input.fixtureDataUrl ?? 'data/archipelago-career-fixture.json',
    },
  });
  const doc = toEmbedConfigDocument(hostConfig);
  return applyCareerEmbedDefaults({
    ...doc,
    locale,
    primaryColor: input.primaryColor ?? CAREER_TENANT_PRIMARY_COLORS.archipelago,
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
      starterPrompts: [...ARCHIPELAGO_STARTER_PROMPTS_WITH_TOOLS],
      systemPrompt,
      greetingMode: 'agent-first',
      brandLogo: ARCHIPELAGO_BRAND_LOGO,
      visual: {
        type: 'halo',
        showInChat: true,
        showInHeader: false,
      },
    } satisfies PartialCanvasTenantConfig['persona'],
  });
}
