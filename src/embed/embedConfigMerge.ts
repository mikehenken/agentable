/**
 * Embed config merge (02 section 11):
 * built-in defaults → tenant config (config-url) → element attributes.
 */
import type { PartialCanvasTenantConfig } from '../config/CanvasContext';
import { warnPersonaStarterPrompts } from '../choreography/validatePersona';
import { warnVoiceGreetingConfig } from '../choreography/validateVoiceGreeting';
import { parseVoiceGreetingMode, type VoiceGreetingMode } from '../voice/greetingMode';
import {
  coalescePanelDataForEmbed,
  type RawPanelDataPayload,
} from '../config/panelDataCoalesce';
import type {
  EmbedAttributeSnapshot,
  EmbedConfigDocument,
  ResolvedEmbedConfig,
} from './types/embedConfig';
import {
  parseWhiteboardToolbarConfig,
  type WhiteboardToolbarConfig,
} from '../engines/tldraw/toolbar/toolbarConfig';
import { parseAiPersonaVisualConfig } from '../components/ai-persona/mapPersonaState';

export interface EmbedBuiltInDefaults {
  tenant: string;
  primaryColor: string;
  welcomeMessage: string;
  apiEndpoint: string;
  voiceEnabled: boolean;
  snapGrid: boolean;
  systemPrompt: string;
  voiceGreeting: string;
  greetingMode: string;
  tokenEndpoint: string;
  fullpageOnEngage: boolean;
  canvasMode: string;
  canvasBounds: string;
  canvasBehavior: string;
  canvasZoom: string;
  hostHeaderHeight: string;
  locale: string;
}

function pickString(
  attribute: string,
  fromDoc: string | undefined,
  fallback: string): string {
  if (attribute.trim()) return attribute;
  if (fromDoc !== undefined && fromDoc.trim()) return fromDoc;
  return fallback;
}

function pickBoolean(
  attribute: boolean,
  attributeExplicit: boolean,
  fromDoc: boolean | undefined,
  fallback: boolean): boolean {
  if (attributeExplicit) return attribute;
  if (fromDoc !== undefined) return fromDoc;
  return fallback;
}

function resolveToolbarConfig(
  attrs: EmbedAttributeSnapshot,
  doc: EmbedConfigDocument): WhiteboardToolbarConfig | undefined {
  const fromAttr = parseWhiteboardToolbarConfig(attrs.toolbarConfigJson);
  if (fromAttr) return fromAttr;
  if (doc.toolbarConfig) return doc.toolbarConfig;
  if (doc.toolbar) return doc.toolbar;
  return undefined;
}

/** Merge persona system prompt with optional agentJobsGuide appendix (moss behavior). */
export function mergeAgentJobsGuideIntoPrompt(
  systemPrompt: string,
  agentJobsGuide: string | undefined): string {
  const guide = agentJobsGuide?.trim();
  if (!guide) return systemPrompt;
  const base = systemPrompt.trim();
  if (!base) return guide;
  return `${base}\n\n${guide}`;
}

/**
 * Merge built-in defaults, config-url document, and element attributes.
 * Attributes win over config-url; config-url wins over built-in defaults.
 */
export function mergeEmbedConfig(
  defaults: EmbedBuiltInDefaults,
  configDoc: EmbedConfigDocument | null,
  attrs: EmbedAttributeSnapshot,
  panelDataRaw: RawPanelDataPayload | null): ResolvedEmbedConfig {
  const doc = configDoc ?? {};
  const docPersona = doc.persona ?? {};

  const tenant = pickString(attrs.tenant, doc.tenant, defaults.tenant);
  const primaryColor = pickString(attrs.primaryColor, doc.primaryColor, defaults.primaryColor);
  const welcomeMessage = pickString(
    attrs.welcomeMessage,
    doc.welcomeMessage,
    defaults.welcomeMessage);
  const apiEndpoint = pickString(attrs.apiEndpoint, doc.apiEndpoint, defaults.apiEndpoint);

  const voiceEnabled = pickBoolean(
    attrs.voiceEnabled,
    attrs.voiceEnabledSet,
    doc.voiceEnabled,
    defaults.voiceEnabled);
  const snapGrid = pickBoolean(
    attrs.snapGrid,
    attrs.snapGridSet,
    doc.snapGrid,
    defaults.snapGrid);

  const flatSystemPrompt = pickString(attrs.systemPrompt, doc.systemPrompt, defaults.systemPrompt);
  const personaSystemPrompt =
    docPersona.systemPrompt !== undefined && docPersona.systemPrompt !== ''
      ? docPersona.systemPrompt: flatSystemPrompt;

  const voiceGreeting = pickString(
    attrs.voiceGreeting,
    docPersona.voiceGreeting ?? doc.voiceGreeting,
    defaults.voiceGreeting);
  const greetingModeRaw = pickString(
    attrs.greetingMode,
    docPersona.greetingMode !== undefined
      ? String(docPersona.greetingMode): doc.greetingMode !== undefined
        ? String(doc.greetingMode): undefined,
    defaults.greetingMode);
  const greetingModeParsed = parseVoiceGreetingMode(
    greetingModeRaw.trim() ? greetingModeRaw: undefined);
  const greetingMode: VoiceGreetingMode = greetingModeParsed.ok
    ? greetingModeParsed.value: 'agent-first';
  const tokenEndpoint = pickString(
    attrs.tokenEndpoint,
    docPersona.tokenEndpoint ?? doc.tokenEndpoint,
    defaults.tokenEndpoint);

  const engageFromDoc = doc.fullpageOnEngage ?? doc.fullscreenOnEngage;
  const fullpageOnEngage = attrs.fullpageOnEngageSet
    ? attrs.fullpageOnEngage || attrs.fullscreenOnEngage: engageFromDoc === true
      ? true: defaults.fullpageOnEngage;

  const canvasMode = pickString(attrs.canvasMode, doc.canvasMode, defaults.canvasMode);
  const canvasBounds = pickString(attrs.canvasBounds, doc.canvasBounds, defaults.canvasBounds);
  const canvasBehavior = pickString(
    attrs.canvasBehavior,
    doc.canvasBehavior,
    defaults.canvasBehavior);
  const canvasZoom = pickString(attrs.canvasZoom, doc.canvasZoom, defaults.canvasZoom);
  const hostHeaderHeight = pickString(
    attrs.hostHeaderHeight,
    doc.hostHeaderHeight,
    defaults.hostHeaderHeight);
  const locale = pickString(attrs.locale, doc.locale, defaults.locale);
  const toolbarConfig = resolveToolbarConfig(attrs, doc);

  const normalizedPanel = coalescePanelDataForEmbed(panelDataRaw);
  const systemPrompt = mergeAgentJobsGuideIntoPrompt(
    personaSystemPrompt,
    panelDataRaw?.agentJobsGuide);

  const personaVisual = parseAiPersonaVisualConfig(docPersona.visual);

  const tenantConfig: PartialCanvasTenantConfig = {
    tenant,
    locale: locale.trim() ? locale: undefined,
     // Surface merged welcome copy into React so ChatPanel empty state can
     // show the Sandals tenant greeting (not the Lit constructor default)....(welcomeMessage.trim() ? { welcomeMessage }: {}),
    persona: {
      systemPrompt,...(voiceGreeting ? { voiceGreeting }: {}),
      greetingMode,...(tokenEndpoint ? { tokenEndpoint }: {}),...(docPersona.assistantName ? { assistantName: docPersona.assistantName }: {}),...(docPersona.tenantTitle ? { tenantTitle: docPersona.tenantTitle }: {}),...(docPersona.starterPrompts ? { starterPrompts: docPersona.starterPrompts }: {}),...(docPersona.geminiVoiceName ? { geminiVoiceName: docPersona.geminiVoiceName }: {}),...(docPersona.chatProxyUrl ? { chatProxyUrl: docPersona.chatProxyUrl }: {}),...(docPersona.mockScenario ? { mockScenario: docPersona.mockScenario }: {}),...(personaVisual ? { visual: personaVisual }: {}),
    },...(Object.keys(normalizedPanel).length > 0 ? { panelData: normalizedPanel }: {}),
  };

  warnPersonaStarterPrompts(tenantConfig.persona ?? {}, {
    tenant,
    welcomeMessage,
  });
  warnVoiceGreetingConfig(tenantConfig.persona ?? {}, {
    tenant,
    rawGreetingMode: greetingModeRaw.trim() ? greetingModeRaw: docPersona.greetingMode ?? doc.greetingMode,
  });

  return {
    tenant,
    primaryColor,
    welcomeMessage,
    apiEndpoint,
    voiceEnabled,
    snapGrid,
    systemPrompt,
    voiceGreeting,
    greetingMode,
    tokenEndpoint,
    fullpageOnEngage,
    canvasModeInput: {
      mode: canvasMode,
      bounds: canvasBounds,
      behavior: canvasBehavior,
      zoom: canvasZoom,
    },
    hostHeaderHeight,
    locale,
    tenantConfig,...(toolbarConfig ? { toolbarConfig }: {}),
  };
}
