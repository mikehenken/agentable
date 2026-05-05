/**
 * Three-layer merge precedence test.
 *
 * Pin the contract: when a tenant wrapper component sits between the
 * caller and the OSS `<CanvasProvider>`, who wins?
 *
 *   layer 1: library defaults (CanvasContext.DEFAULT_TENANT_CONFIG)
 *   layer 2: tenant wrapper's defaults (e.g. Riley / Career Concierge / scenario)
 *   layer 3: caller-supplied props on the tenant wrapper
 *
 * Caller > tenant > library. If anyone reverses that, every deployment that
 * overrode `systemPrompt` would silently revert to the library default.
 * Cheap to write, catches the most-touched seam.
 *
 * NOTE: this test mounts a tenant wrapper directly. It only reads context
 * via the same `useCanvasConfig()` hook the canvas uses, so it doesn't
 * have to interact with the rendered DOM.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CanvasProvider, useCanvasConfig } from '../../src/canvas/CanvasContext';

// Tenant defaults — exercised as if a tenant wrapper package owned them.
// Fictional 'Acme Career Concierge' persona ('Riley') stands in for any
// downstream wrapper consumers might publish.
const TENANT_PROMPT =
  'You are Riley, the Acme Career Concierge. Be warm, accurate, and direct.';
const TENANT_GREETING = 'Hi there — I am Riley, your Career Concierge.';

// Tenant wrapper analog. Mimics the merge logic any tenant package would
// implement on top of `<CanvasProvider>`: it accepts caller props and
// falls back to its own tenant defaults when those are unset.
function TenantCanvasUnderTest({
  systemPrompt,
  voiceGreeting,
}: {
  systemPrompt?: string;
  voiceGreeting?: string;
}) {
  return (
    <CanvasProvider
      config={{
        tenant: 'acme',
        persona: {
          systemPrompt: systemPrompt ?? TENANT_PROMPT,
          voiceGreeting: voiceGreeting ?? TENANT_GREETING,
          assistantName: 'Riley',
          tenantTitle: 'Career Concierge',
        },
      }}
    >
      <Probe />
    </CanvasProvider>
  );
}

function Probe() {
  const cfg = useCanvasConfig();
  return (
    <div>
      <span data-testid="tenant">{cfg.tenant}</span>
      <span data-testid="systemPrompt">{cfg.persona.systemPrompt}</span>
      <span data-testid="voiceGreeting">{cfg.persona.voiceGreeting}</span>
      <span data-testid="assistantName">{cfg.persona.assistantName}</span>
      <span data-testid="tenantTitle">{cfg.persona.tenantTitle}</span>
    </div>
  );
}

describe('Three-layer merge precedence (caller > tenant > library)', () => {
  it('tenant defaults override library defaults when caller supplies nothing', () => {
    render(<TenantCanvasUnderTest />);
    expect(screen.getByTestId('tenant')).toHaveTextContent('acme');
    expect(screen.getByTestId('assistantName')).toHaveTextContent('Riley');
    expect(screen.getByTestId('tenantTitle')).toHaveTextContent('Career Concierge');
    expect(screen.getByTestId('systemPrompt')).toHaveTextContent(
      /You are Riley, the Acme Career Concierge/
    );
    expect(screen.getByTestId('voiceGreeting')).toHaveTextContent(TENANT_GREETING);
  });

  it('caller-supplied systemPrompt overrides tenant default', () => {
    render(<TenantCanvasUnderTest systemPrompt="OVERRIDE PROMPT" />);
    expect(screen.getByTestId('systemPrompt')).toHaveTextContent('OVERRIDE PROMPT');
    // Other tenant defaults still hold.
    expect(screen.getByTestId('voiceGreeting')).toHaveTextContent(TENANT_GREETING);
    expect(screen.getByTestId('assistantName')).toHaveTextContent('Riley');
  });

  it('caller-supplied voiceGreeting overrides tenant default', () => {
    render(<TenantCanvasUnderTest voiceGreeting="A different opener." />);
    expect(screen.getByTestId('voiceGreeting')).toHaveTextContent('A different opener.');
    expect(screen.getByTestId('systemPrompt')).toHaveTextContent(
      /You are Riley, the Acme Career Concierge/
    );
  });

  it('caller can override BOTH simultaneously', () => {
    render(
      <TenantCanvasUnderTest
        systemPrompt="OVERRIDE PROMPT"
        voiceGreeting="OVERRIDE GREETING"
      />
    );
    expect(screen.getByTestId('systemPrompt')).toHaveTextContent('OVERRIDE PROMPT');
    expect(screen.getByTestId('voiceGreeting')).toHaveTextContent('OVERRIDE GREETING');
    // assistantName + tenantTitle still come from tenant defaults — caller
    // didn't override them.
    expect(screen.getByTestId('assistantName')).toHaveTextContent('Riley');
    expect(screen.getByTestId('tenantTitle')).toHaveTextContent('Career Concierge');
  });
});
