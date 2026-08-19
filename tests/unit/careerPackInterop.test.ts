/**
 * automated_check: plain-HTML embed + React hosts run the same career config.
 */
import { describe, expect, it } from 'vitest';
import {
  createCareerPack,
  resolveCareerHostConfig,
  toEmbedConfigDocument,
  toReactHostConfig,
} from '@agentable/career-pack';
import { mergeEmbedConfig, type EmbedBuiltInDefaults } from '../../src/embed/embedConfigMerge';
import type { EmbedAttributeSnapshot } from '../../src/embed/types/embedConfig';

const EMBED_DEFAULTS: EmbedBuiltInDefaults = {
  tenant: 'default',
  primaryColor: '#111827',
  welcomeMessage: 'Welcome',
  apiEndpoint: '',
  voiceEnabled: false,
  snapGrid: false,
  systemPrompt: 'You are helpful.',
  voiceGreeting: '',
  greetingMode: '',
  tokenEndpoint: '',
  fullpageOnEngage: false,
  canvasMode: 'bounded',
  canvasBounds: '1200x800',
  canvasBehavior: 'pan',
  canvasZoom: '1',
  hostHeaderHeight: '0',
  locale: 'en',
};

const EMPTY_ATTRS: EmbedAttributeSnapshot = {
  tenant: '',
  primaryColor: '',
  welcomeMessage: '',
  apiEndpoint: '',
  voiceEnabled: false,
  voiceEnabledSet: false,
  snapGrid: false,
  snapGridSet: false,
  systemPrompt: '',
  voiceGreeting: '',
  greetingMode: '',
  tokenEndpoint: '',
  fullpageOnEngage: false,
  fullscreenOnEngage: false,
  fullpageOnEngageSet: false,
  canvasMode: '',
  canvasBounds: '',
  canvasBehavior: '',
  canvasZoom: '',
  hostHeaderHeight: '',
  locale: '',
  toolbarConfigJson: '',
};

describe('career pack host interop', () => {
  it('produces identical tenant + panel ids for embed and React paths', () => {
    const pack = createCareerPack({
      tenant: 'fixture-client',
      persona: { assistantName: 'Mason', tenantTitle: 'Career Guide' },
    });
    const hostConfig = resolveCareerHostConfig(pack, {
      tenant: 'fixture-client',
      persona: { assistantName: 'Mason' },
    });

    const embedDoc = toEmbedConfigDocument(hostConfig);
    const reactConfig = toReactHostConfig(hostConfig);

    const merged = mergeEmbedConfig(EMBED_DEFAULTS, embedDoc, EMPTY_ATTRS, null);

    expect(merged.tenantConfig.tenant).toBe(reactConfig.tenant);
    expect(merged.tenantConfig.persona?.assistantName).toBe(reactConfig.persona?.assistantName);
    expect(merged.tenantConfig.persona?.tenantTitle).toBe(reactConfig.persona?.tenantTitle);
    expect(merged.tenantConfig.persona?.starterPrompts?.length).toBeGreaterThan(0);

    expect(hostConfig.panelIds.sort()).toEqual([...reactConfig.panelIds].sort());
    expect(embedDoc.panels?.map((entry) => (entry as { id: string }).id).sort()).toEqual(
      hostConfig.panelIds.sort());

    expect(embedDoc.adapter?.kind).toBe('static');
    expect(reactConfig.panels.map((panel) => panel.id).sort()).toEqual(hostConfig.panelIds.sort());
    expect(reactConfig.tools.map((tool) => tool.declaration.name)).toEqual(
      hostConfig.tools.map((tool) => tool.declaration.name));
  });
});
