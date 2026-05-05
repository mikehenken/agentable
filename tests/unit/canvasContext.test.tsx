/**
 * CanvasContext merge corner cases.
 *
 * The merge order is documented in the README (§2): library defaults
 * are overlaid by tenant config (e.g. <CareerCanvas>). Each persona
 * field is independently optional — a tenant supplying just
 * `voiceGreeting` should keep the library's default systemPrompt.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CanvasProvider, useCanvasConfig } from '../../src/canvas/CanvasContext';

function ConfigProbe() {
  const cfg = useCanvasConfig();
  return (
    <div>
      <span data-testid="tenant">{cfg.tenant}</span>
      <span data-testid="systemPrompt">{cfg.persona.systemPrompt}</span>
      <span data-testid="voiceGreeting">{cfg.persona.voiceGreeting ?? '__none__'}</span>
      <span data-testid="assistantName">{cfg.persona.assistantName}</span>
      <span data-testid="tenantTitle">{cfg.persona.tenantTitle}</span>
      <span data-testid="starterPromptCount">
        {String(cfg.persona.starterPrompts?.length ?? 0)}
      </span>
    </div>
  );
}

describe('CanvasContext — defaults', () => {
  it('renders library defaults when no provider is in the tree', () => {
    render(<ConfigProbe />);
    expect(screen.getByTestId('tenant')).toHaveTextContent('default');
    expect(screen.getByTestId('assistantName')).toHaveTextContent('Assistant');
    expect(screen.getByTestId('tenantTitle')).toHaveTextContent('AI Assistant');
    expect(screen.getByTestId('starterPromptCount')).toHaveTextContent('0');
  });

  it('renders library defaults when CanvasProvider is given empty config', () => {
    render(
      <CanvasProvider>
        <ConfigProbe />
      </CanvasProvider>
    );
    expect(screen.getByTestId('tenant')).toHaveTextContent('default');
    expect(screen.getByTestId('assistantName')).toHaveTextContent('Assistant');
  });
});

describe('CanvasContext — partial overrides', () => {
  it('overrides only the fields the tenant supplies', () => {
    render(
      <CanvasProvider config={{ persona: { voiceGreeting: 'Hello there.' } }}>
        <ConfigProbe />
      </CanvasProvider>
    );
    expect(screen.getByTestId('voiceGreeting')).toHaveTextContent('Hello there.');
    // Other fields fall through to defaults.
    expect(screen.getByTestId('assistantName')).toHaveTextContent('Assistant');
    expect(screen.getByTestId('tenantTitle')).toHaveTextContent('AI Assistant');
  });

  it('overrides assistantName independently of systemPrompt', () => {
    render(
      <CanvasProvider config={{ persona: { assistantName: 'Riley' } }}>
        <ConfigProbe />
      </CanvasProvider>
    );
    expect(screen.getByTestId('assistantName')).toHaveTextContent('Riley');
    // System prompt remains the library default.
    expect(screen.getByTestId('systemPrompt')).toHaveTextContent(/friendly, helpful/);
  });

  it('full tenant-style override', () => {
    render(
      <CanvasProvider
        config={{
          tenant: 'acme',
          persona: {
            systemPrompt: 'You are Riley.',
            voiceGreeting: 'Hi! I am Riley.',
            assistantName: 'Riley',
            tenantTitle: 'Career Concierge',
            starterPrompts: [{ emoji: '🚀', text: 'Tell me about Acme' }],
          },
        }}
      >
        <ConfigProbe />
      </CanvasProvider>
    );
    expect(screen.getByTestId('tenant')).toHaveTextContent('acme');
    expect(screen.getByTestId('systemPrompt')).toHaveTextContent('You are Riley.');
    expect(screen.getByTestId('voiceGreeting')).toHaveTextContent('Hi! I am Riley.');
    expect(screen.getByTestId('assistantName')).toHaveTextContent('Riley');
    expect(screen.getByTestId('tenantTitle')).toHaveTextContent('Career Concierge');
    expect(screen.getByTestId('starterPromptCount')).toHaveTextContent('1');
  });
});

describe('CanvasContext — undefined vs empty string', () => {
  it('explicit undefined falls through to default', () => {
    render(
      <CanvasProvider
        config={{ persona: { systemPrompt: undefined, assistantName: undefined } }}
      >
        <ConfigProbe />
      </CanvasProvider>
    );
    expect(screen.getByTestId('systemPrompt')).toHaveTextContent(/friendly, helpful/);
    expect(screen.getByTestId('assistantName')).toHaveTextContent('Assistant');
  });

  it('empty string is RESPECTED (caller intent)', () => {
    render(
      <CanvasProvider config={{ persona: { voiceGreeting: '' } }}>
        <ConfigProbe />
      </CanvasProvider>
    );
    // `''` is falsy but not undefined — current behavior is `??` falls
    // back ONLY on `undefined | null`, so empty string passes through.
    // Pin this so future refactors don't accidentally change semantics.
    expect(screen.getByTestId('voiceGreeting')).toHaveTextContent('');
  });
});
