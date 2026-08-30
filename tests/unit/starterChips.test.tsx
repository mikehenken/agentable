import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StarterChips } from '../../src/components/chrome/StarterChips';

const PROMPTS = [
  { emoji: '🚀', text: 'Show me open roles', label: 'Open roles' },
  { emoji: '📈', text: 'Map my growth path', pin: true },
] as const;

describe('StarterChips', () => {
  it('renders compact chips above composer with pin affordance', () => {
    render(
      <StarterChips prompts={PROMPTS} variant="compact" showPinAffordance onSelect={() => {}} />);
    expect(screen.getByTestId('starter-chips-compact')).toBeInTheDocument();
    expect(screen.getAllByTestId('starter-chip')).toHaveLength(2);
    expect(screen.getByText('Open roles')).toBeInTheDocument();
  });

  it('renders card variant for empty chat state', () => {
    render(<StarterChips prompts={PROMPTS} variant="cards" onSelect={() => {}} />);
    expect(screen.getByTestId('starter-chips-cards')).toBeInTheDocument();
    expect(screen.getAllByTestId('starter-chip-card')).toHaveLength(2);
  });

  it('fires onSelect with prompt text when chip clicked', () => {
    const onSelect = vi.fn();
    render(<StarterChips prompts={PROMPTS} variant="compact" onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Open roles'));
    // onSelect receives the whole prompt object, not just the text: the chat
    // host reads prompt.prefetchTool for deterministic tool routing (see
    // handleStarterSelect in src/chat/ChatPanel.tsx).
    expect(onSelect).toHaveBeenCalledWith(PROMPTS[0]);
  });

  it('renders nothing when prompts array is empty', () => {
    const { container } = render(<StarterChips prompts={[]} onSelect={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
