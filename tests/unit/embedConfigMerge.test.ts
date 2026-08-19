import { describe, it, expect } from 'vitest';
import {
  mergeEmbedConfig,
  mergeAgentJobsGuideIntoPrompt,
  type EmbedBuiltInDefaults,
} from '../../src/embed/embedConfigMerge';
import type { EmbedAttributeSnapshot } from '../../src/embed/types/embedConfig';

const DEFAULTS: EmbedBuiltInDefaults = {
  tenant: 'default',
  primaryColor: '#3B82F6',
  welcomeMessage: 'Hi!',
  apiEndpoint: '/api',
  voiceEnabled: false,
  snapGrid: true,
  systemPrompt: '',
  voiceGreeting: '',
  greetingMode: '',
  tokenEndpoint: '',
  fullpageOnEngage: false,
  canvasMode: 'infinite',
  canvasBounds: '',
  canvasBehavior: '',
  canvasZoom: '',
  hostHeaderHeight: '',
  locale: 'en',
};

const EMPTY_ATTRS: EmbedAttributeSnapshot = {
  tenant: '',
  primaryColor: '',
  welcomeMessage: '',
  apiEndpoint: '',
  voiceEnabled: false,
  voiceEnabledSet: false,
  snapGrid: true,
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

describe('mergeAgentJobsGuideIntoPrompt', () => {
  it('appends agentJobsGuide when both strings are present', () => {
    expect(mergeAgentJobsGuideIntoPrompt('Base prompt.', 'Guide text.')).toBe(
      'Base prompt.\n\nGuide text.');
  });

  it('returns guide alone when base prompt is empty', () => {
    expect(mergeAgentJobsGuideIntoPrompt('', 'Guide only.')).toBe('Guide only.');
  });
});

describe('mergeEmbedConfig', () => {
  it('defaults voiceEnabled to false when unset ', () => {
    const merged = mergeEmbedConfig(DEFAULTS, null, EMPTY_ATTRS, null);
    expect(merged.voiceEnabled).toBe(false);
  });

  it('applies config-url tenant when attributes are empty', () => {
    const merged = mergeEmbedConfig(
      DEFAULTS,
      {
        tenant: 'acme',
        canvasMode: 'bounded',
        canvasBounds: '900x600',
        voiceEnabled: false,
        greetingMode: 'user-first',
      },
      EMPTY_ATTRS,
      null);
    expect(merged.tenant).toBe('acme');
    expect(merged.canvasModeInput.mode).toBe('bounded');
    expect(merged.canvasModeInput.bounds).toBe('900x600');
    expect(merged.voiceEnabled).toBe(false);
  });

  it('applies config-url brand + welcome when Lit defaults are not explicit attrs', () => {
    const merged = mergeEmbedConfig(
      DEFAULTS,
      {
        tenant: 'sandals',
        primaryColor: '#0077B6',
        welcomeMessage:
          "Hi there — I'm Sandy, your Career Concierge at Sandals.",
        persona: {
          assistantName: 'Sandy',
          starterPrompts: [
            { emoji: '💼', text: 'Show me jobs', label: 'Jobs for me' },
          ],
        },
      },
      EMPTY_ATTRS,
      null);
    expect(merged.primaryColor).toBe('#0077B6');
    expect(merged.welcomeMessage).toContain('Sandy');
    expect(merged.tenantConfig.welcomeMessage).toContain('Sandy');
    expect(merged.tenantConfig.persona?.starterPrompts).toHaveLength(1);
  });

  it('lets element attributes override config-url values', () => {
    const merged = mergeEmbedConfig(
      DEFAULTS,
      { tenant: 'from-config', primaryColor: '#111111', greetingMode: 'user-first' },
      {...EMPTY_ATTRS,
        tenant: 'from-attr',
        primaryColor: '#FF0000',
      },
      null);
    expect(merged.tenant).toBe('from-attr');
    expect(merged.primaryColor).toBe('#FF0000');
  });

  it('respects explicit boolean attributes over config-url', () => {
    const merged = mergeEmbedConfig(
      DEFAULTS,
      { voiceEnabled: false, snapGrid: false, greetingMode: 'user-first' },
      {...EMPTY_ATTRS,
        voiceEnabled: true,
        voiceEnabledSet: true,
        snapGrid: true,
        snapGridSet: true,
      },
      null);
    expect(merged.voiceEnabled).toBe(true);
    expect(merged.snapGrid).toBe(true);
  });

  it('merges greetingMode from config-url persona block', () => {
    const merged = mergeEmbedConfig(
      DEFAULTS,
      { persona: { greetingMode: 'user-first', voiceGreeting: 'Hi' } },
      EMPTY_ATTRS,
      null);
    expect(merged.greetingMode).toBe('user-first');
    expect(merged.tenantConfig.persona?.greetingMode).toBe('user-first');
  });

  it('hydrates panelData into tenantConfig and merges agentJobsGuide', () => {
    const merged = mergeEmbedConfig(
      DEFAULTS,
      { persona: { systemPrompt: 'You are Riley.', greetingMode: 'user-first' } },
      EMPTY_ATTRS,
      {
        jobs: [{ id: 1, title: 'Engineer', department: 'IT', track: 'Pro', location: 'Remote' }],
        agentJobsGuide: 'Keep answers short.',
      });
    expect(merged.tenantConfig.panelData?.jobs).toHaveLength(1);
    expect(merged.tenantConfig.persona?.systemPrompt).toContain('You are Riley.');
    expect(merged.tenantConfig.persona?.systemPrompt).toContain('Keep answers short.');
  });
});
