import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CSSProperties } from 'react';
import { PromptInput } from '../../src/components/ui-ai/prompt-input';

describe('PromptInput theme fallbacks', () => {
  it('defaults to light vibe tokens when host vars are unset', () => {
    render(
      <PromptInput
        value=""
        onValueChange={() => {}}
        onSubmit={() => {}}
        placeholder="Ask anything"
      />);

    const composer = screen.getByPlaceholderText('Ask anything').parentElement;
    expect(composer).toBeTruthy();
    expect(composer).toHaveStyle({ background: 'var(--vibe-surface, #F7F9F9)' });
    expect(composer?.getAttribute('style') ?? '').not.toContain('#1a1a1a');
  });

  it('inherits light text color from host vibe vars', () => {
    render(
      <div
        style={
          {
            '--vibe-text': '#1a1a1a',
          } as CSSProperties
        }
      >
        <PromptInput value="hello" onValueChange={() => {}} onSubmit={() => {}} />
      </div>);

    const textarea = screen.getByDisplayValue('hello');
    expect(textarea).toHaveStyle({ color: 'var(--vibe-text, #1A1A1A)' });
  });
});
