import type { PartialCanvasTenantConfig } from '../../../../src/canvas/CanvasContext';
import type { EmbedConfigDocument } from '../../../../src/embed/types/embedConfig';
import {
  createCareerPack,
  resolveCareerHostConfig,
  toEmbedConfigDocument,
} from '../pack';
import type { CareerPersonaScaffold } from '../types';
import { CAREER_TENANT_PRIMARY_COLORS } from './careerTenantTokens';
import { MOSS_CAREER_SYSTEM_PROMPT } from '../prompts/mossSystemPrompt';
import {
  MOSS_STARTER_PROMPTS_WITH_TOOLS,
  resolveCareerChatBundle,
} from '../careerChatBundle';
import { applyCareerEmbedDefaults } from '../whiteboard/careerCanvasDefaults';

/** Moss Career Blueprint starter chips (P4-T3 / P5-T2 persona fix). */
export const MOSS_STARTER_PROMPTS: CareerPersonaScaffold['starterPrompts'] = [
  {
    emoji: '🏗️',
    text: 'Show me construction management roles in South Florida',
    label: 'CM roles',
  },
  {
    emoji: '☀️',
    text: 'What solar hourly field jobs are open?',
    label: 'Solar hourly',
  },
  {
    emoji: '🎓',
    text: 'Tell me about the Moss internship program',
    label: 'Internships',
  },
  {
    emoji: '📍',
    text: 'Which roles are hiring in Texas or DFW?',
    label: 'Texas / DFW',
  },
];

export const MOSS_STARTER_PROMPTS_ES: CareerPersonaScaffold['starterPrompts'] = [
  {
    emoji: '🏗️',
    text: 'Muéstrame vacantes de gestión de construcción en el sur de Florida',
    label: 'Roles CM',
  },
  {
    emoji: '☀️',
    text: '¿Qué empleos solares por hora hay abiertos?',
    label: 'Solar por hora',
  },
  {
    emoji: '🎓',
    text: 'Cuéntame sobre el programa de pasantías de Moss',
    label: 'Pasantías',
  },
  {
    emoji: '📍',
    text: '¿Qué vacantes hay en Texas o DFW?',
    label: 'Texas / DFW',
  },
];

export interface MossPersonaLocale {
  assistantName: string;
  tenantTitle: string;
  welcomeMessage: string;
  voiceGreeting: string;
  starterPrompts: CareerPersonaScaffold['starterPrompts'];
}

export const MOSS_PERSONA_EN: MossPersonaLocale = {
  assistantName: 'Mason',
  tenantTitle: 'Moss Career Blueprint',
  welcomeMessage:
    "Hey, I'm Mason — your guide to building a career at Moss. We're a Fort Lauderdale-based construction firm founded in 2004, with teams in South Florida, Mid-Florida, Dallas–Fort Worth, and Hawaii — plus solar projects nationwide. Tell me what you're looking for: construction management, solar EPC, or the internship program — or describe what you do today and we'll find a fit.",
  voiceGreeting:
    "Hey, I'm Mason — your guide to building a career at Moss & Associates. Moss is a privately held construction firm founded in 2004, headquartered in Fort Lauderdale. We build across South Florida, Mid-Florida, Dallas–Fort Worth, and Hawaii, and our solar EPC crews work nationwide. Tell me what kind of work you do today — or which track you're curious about — and we'll walk through where you might fit at Moss.",
  starterPrompts: MOSS_STARTER_PROMPTS,
};

/** D59 — Spanish persona variant for moss local integration. */
export const MOSS_PERSONA_ES: MossPersonaLocale = {
  assistantName: 'Mason',
  tenantTitle: 'Plan de Carrera Moss',
  welcomeMessage:
    'Hola, soy Mason — tu guía para construir una carrera en Moss. Somos una empresa de construcción con sede en Fort Lauderdale, fundada en 2004, con equipos en el sur de Florida, el centro de Florida, Dallas–Fort Worth y Hawái, además de proyectos solares en todo el país. Cuéntame qué buscas: gestión de construcción, solar EPC o el programa de pasantías — o describe tu experiencia y encontramos una opción.',
  voiceGreeting:
    'Hola, soy Mason — tu guía de carreras en Moss & Associates. Moss es una constructora privada fundada en 2004, con sede en Fort Lauderdale. Trabajamos en el sur de Florida, el centro de Florida, Dallas–Fort Worth y Hawái, y nuestros equipos solares operan en todo el país. Cuéntame qué tipo de trabajo haces hoy — o qué trayectoria te interesa — y vemos dónde encajas en Moss.',
  starterPrompts: MOSS_STARTER_PROMPTS_ES,
};

export type MossLocaleTag = 'en' | 'es';

export function resolveMossPersona(locale: MossLocaleTag = 'en'): MossPersonaLocale {
  return locale === 'es' ? MOSS_PERSONA_ES : MOSS_PERSONA_EN;
}

export interface CreateMossEmbedConfigInput {
  locale?: MossLocaleTag;
  /** Full Mason system prompt (structured grounding lives in career-fixture agentJobsGuide). */
  systemPrompt: string;
  /** Relative URL from moss site root to static fixture panel-data JSON. */
  fixtureDataUrl?: string;
  primaryColor?: string;
}

/**
 * Build a config-url document for the Moss Career Blueprint plain-HTML host.
 * Uses static adapter over local fixtures — no ATS backend (G1/G2).
 */
export function createMossEmbedConfig(input: CreateMossEmbedConfigInput): EmbedConfigDocument {
  const locale = input.locale ?? 'en';
  const personaLocale = resolveMossPersona(locale);
  const chatBundle = resolveCareerChatBundle('moss');
  const systemPrompt = input.systemPrompt?.trim() || MOSS_CAREER_SYSTEM_PROMPT;
  const pack = createCareerPack({
    tenant: 'moss',
    persona: {
      assistantName: personaLocale.assistantName,
      tenantTitle: personaLocale.tenantTitle,
      voiceGreeting: personaLocale.voiceGreeting,
      starterPrompts: [...MOSS_STARTER_PROMPTS_WITH_TOOLS],
      systemPrompt,
    },
  });
  const hostConfig = resolveCareerHostConfig(pack, {
    tenant: 'moss',
    adapter: {
      kind: 'static',
      dataUrl: input.fixtureDataUrl ?? '/data/career-fixture.json',
    },
  });
  const doc = toEmbedConfigDocument(hostConfig);
  return applyCareerEmbedDefaults({
    ...doc,
    locale,
    primaryColor: input.primaryColor ?? CAREER_TENANT_PRIMARY_COLORS.moss,
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
      starterPrompts: [...MOSS_STARTER_PROMPTS_WITH_TOOLS],
      systemPrompt,
      greetingMode: 'agent-first',
    } satisfies PartialCanvasTenantConfig['persona'],
  });
}
