/**
 * Helios tenant embed config — Mason persona, starter chips, es variant.
 */
import { describe, expect, it } from 'vitest';
import {
  createHeliosEmbedConfig,
  HELIOS_PERSONA_EN,
  HELIOS_PERSONA_ES,
  resolveHeliosPersona,
} from '@agentable/career-pack';

const SAMPLE_PROMPT = 'You are Mason, Helios Career Blueprint guide.';

describe('helios tenant embed config', () => {
  it('SC4: English config uses Mason name and starter chips', () => {
    const doc = createHeliosEmbedConfig({ systemPrompt: SAMPLE_PROMPT, locale: 'en' });
    expect(doc.tenant).toBe('helios');
    expect(doc.persona?.assistantName).toBe('Mason');
    expect(doc.persona?.starterPrompts?.length).toBeGreaterThanOrEqual(4);
    expect(doc.adapter?.kind).toBe('static');
    expect(doc.adapter?.dataUrl).toBe('/data/career-fixture.json');
    expect(doc.persona?.starterPrompts?.[0]?.label).toBe('CM roles');
  });

  it('SC3: Spanish config sets locale es and Spanish starter chips ', () => {
    const doc = createHeliosEmbedConfig({ systemPrompt: SAMPLE_PROMPT, locale: 'es' });
    expect(doc.locale).toBe('es');
    expect(doc.persona?.assistantName).toBe('Mason');
    expect(doc.persona?.starterPrompts?.[0]?.label).toBe('Roles CM');
    expect(doc.welcomeMessage).toMatch(/Hola, soy Mason/);
  });

  it('resolveHeliosPersona returns distinct en/es copy', () => {
    expect(resolveHeliosPersona('en').tenantTitle).toBe(HELIOS_PERSONA_EN.tenantTitle);
    expect(resolveHeliosPersona('es').tenantTitle).toBe(HELIOS_PERSONA_ES.tenantTitle);
    expect(HELIOS_PERSONA_ES.welcomeMessage).toMatch(/Hola/);
  });

  it('structured grounding: config-url uses static fixture adapter only', () => {
    const doc = createHeliosEmbedConfig({ systemPrompt: SAMPLE_PROMPT });
    expect(doc.canvasMode).toBe('bounded');
    expect(doc.canvasZoom).toBe('locked');
    expect(doc.panels?.map((p) => (p as { id: string }).id)).toEqual([
      'open-positions',
      'applications',
      'growth-paths',
      'resources',
    ]);
  });
});
