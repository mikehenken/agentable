import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CSSProperties } from 'react';
import { CanvasProvider } from '../../src/config/CanvasContext';
import { ChatPanel } from '../../src/chat/ChatPanel';
import { StarterChips } from '../../src/components/chrome/StarterChips';

const STARTER_PROMPTS = [
  { emoji: '🏗️', text: 'Show me construction roles', label: 'CM roles' },
] as const;

describe('ChatPanel theme tokens', () => {
  it('uses theme-aware CSS variables for the chat surface in light context', () => {
    render(
      <CanvasProvider>
        <ChatPanel chromeless />
      </CanvasProvider>);

    const chatRoot = screen.getByTestId('landi-chat-panel');
    const inlineStyle = chatRoot.getAttribute('style') ?? '';
    expect(inlineStyle).toContain('background: var(--vibe-background)');
    expect(inlineStyle).toContain('color: var(--vibe-text)');
    expect(inlineStyle).not.toContain('#121212');
    expect(inlineStyle).not.toContain('#141414');
  });

  it('renders starter chips with theme-aware surface tokens', () => {
    render(
      <div
        style={
          {
            '--vibe-surface': '#ffffff',
            '--vibe-border': '#e5e5e5',
            '--vibe-text': '#1a1a1a',
          } as CSSProperties
        }
      >
        <StarterChips prompts={STARTER_PROMPTS} variant="compact" onSelect={() => {}} />
      </div>);

    const chip = screen.getByTestId('starter-chip');
    expect(chip).toHaveStyle({ background: 'var(--vibe-surface, #F7F9F9)' });
    expect(chip.getAttribute('style')).not.toContain('#1a1a1a');
  });
});
