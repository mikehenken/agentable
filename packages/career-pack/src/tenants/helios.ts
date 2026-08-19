import type { PartialCanvasTenantConfig } from '../../../../src/canvas/CanvasContext';
import type { EmbedConfigDocument } from '../../../../src/embed/types/embedConfig';
import {
  createCareerPack,
  resolveCareerHostConfig,
  toEmbedConfigDocument,
} from '../pack';
import type { CareerPersonaScaffold } from '../types';
import { CAREER_TENANT_PRIMARY_COLORS } from './careerTenantTokens';
import { HELIOS_CAREER_SYSTEM_PROMPT } from '../prompts/heliosSystemPrompt';
import {
  HELIOS_STARTER_PROMPTS_WITH_TOOLS,
  resolveCareerChatBundle,
} from '../careerChatBundle';
import { applyCareerEmbedDefaults } from '../whiteboard/careerCanvasDefaults';

/** Helios Career Blueprint starter chips (persona fix). */
export const HELIOS_STARTER_PROMPTS: CareerPersonaScaffold['starterPrompts'] = [
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
    text: 'Tell me about the Helios internship program',
    label: 'Internships',
  },
  {
    emoji: '📍',
    text: 'Which roles are hiring in Texas or DFW?',
    label: 'Texas / DFW',
  },
];

export const HELIOS_STARTER_PROMPTS_ES: CareerPersonaScaffold['starterPrompts'] = [
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
    text: 'Cuéntame sobre el programa de pasantías de Helios',
    label: 'Pasantías',
  },
  {
    emoji: '📍',
    text: '¿Qué vacantes hay en Texas o DFW?',
    label: 'Texas / DFW',
  },
];

export interface HeliosPersonaLocale {
  assistantName: string;
  tenantTitle: string;
  welcomeMessage: string;
  voiceGreeting: string;
  starterPrompts: CareerPersonaScaffold['starterPrompts'];
}

export const HELIOS_PERSONA_EN: HeliosPersonaLocale = {
  assistantName: 'Mason',
  tenantTitle: 'Helios Career Blueprint',
  welcomeMessage:
    "Hey, I'm Mason — your guide to building a career at Helios. We're a Fort Lauderdale-based construction firm founded in 2004, with teams in South Florida, Mid-Florida, Dallas–Fort Worth, and Hawaii — plus solar projects nationwide. Tell me what you're looking for: construction management, solar EPC, or the internship program — or describe what you do today and we'll find a fit.",
  voiceGreeting:
    "Hey, I'm Mason — your guide to building a career at Helios & Associates. Helios is a privately held construction firm founded in 2004, headquartered in Fort Lauderdale. We build across South Florida, Mid-Florida, Dallas–Fort Worth, and Hawaii, and our solar EPC crews work nationwide. Tell me what kind of work you do today — or which track you're curious about — and we'll walk through where you might fit at Helios.",
  starterPrompts: HELIOS_STARTER_PROMPTS,
};

/** Spanish persona variant for helios local integration. */
export const HELIOS_PERSONA_ES: HeliosPersonaLocale = {
  assistantName: 'Mason',
  tenantTitle: 'Plan de Carrera Helios',
  welcomeMessage:
    'Hola, soy Mason — tu guía para construir una carrera en Helios. Somos una empresa de construcción con sede en Fort Lauderdale, fundada en 2004, con equipos en el sur de Florida, el centro de Florida, Dallas–Fort Worth y Hawái, además de proyectos solares en todo el país. Cuéntame qué buscas: gestión de construcción, solar EPC o el programa de pasantías — o describe tu experiencia y encontramos una opción.',
  voiceGreeting:
    'Hola, soy Mason — tu guía de carreras en Helios & Associates. Helios es una constructora privada fundada en 2004, con sede en Fort Lauderdale. Trabajamos en el sur de Florida, el centro de Florida, Dallas–Fort Worth y Hawái, y nuestros equipos solares operan en todo el país. Cuéntame qué tipo de trabajo haces hoy — o qué trayectoria te interesa — y vemos dónde encajas en Helios.',
  starterPrompts: HELIOS_STARTER_PROMPTS_ES,
};

export type HeliosLocaleTag = 'en' | 'es';

export function resolveHeliosPersona(locale: HeliosLocaleTag = 'en'): HeliosPersonaLocale {
  return locale === 'es' ? HELIOS_PERSONA_ES : HELIOS_PERSONA_EN;
}

export interface CreateHeliosEmbedConfigInput {
  locale?: HeliosLocaleTag;
  /** Full Mason system prompt (structured grounding lives in career-fixture agentJobsGuide). */
  systemPrompt: string;
  /** Relative URL from helios site root to static fixture panel-data JSON. */
  fixtureDataUrl?: string;
  primaryColor?: string;
}

/**
 * Build a config-url document for the Helios Career Blueprint plain-HTML host.
 * Uses static adapter over local fixtures — no ATS backend (G1/G2).
 */
export function createHeliosEmbedConfig(input: CreateHeliosEmbedConfigInput): EmbedConfigDocument {
  const locale = input.locale ?? 'en';
  const personaLocale = resolveHeliosPersona(locale);
  const chatBundle = resolveCareerChatBundle('helios');
  const systemPrompt = input.systemPrompt?.trim() || HELIOS_CAREER_SYSTEM_PROMPT;
  const pack = createCareerPack({
    tenant: 'helios',
    persona: {
      assistantName: personaLocale.assistantName,
      tenantTitle: personaLocale.tenantTitle,
      voiceGreeting: personaLocale.voiceGreeting,
      starterPrompts: [...HELIOS_STARTER_PROMPTS_WITH_TOOLS],
      systemPrompt,
    },
  });
  const hostConfig = resolveCareerHostConfig(pack, {
    tenant: 'helios',
    adapter: {
      kind: 'static',
      dataUrl: input.fixtureDataUrl ?? '/data/career-fixture.json',
    },
  });
  const doc = toEmbedConfigDocument(hostConfig);
  return applyCareerEmbedDefaults({
    ...doc,
    locale,
    primaryColor: input.primaryColor ?? CAREER_TENANT_PRIMARY_COLORS.helios,
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
      starterPrompts: [...HELIOS_STARTER_PROMPTS_WITH_TOOLS],
      systemPrompt,
      greetingMode: 'agent-first',
    } satisfies PartialCanvasTenantConfig['persona'],
  });
}
