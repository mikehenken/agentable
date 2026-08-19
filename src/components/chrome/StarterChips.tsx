import { useState, type CSSProperties } from 'react';
import { Pin, Sparkles } from 'lucide-react';
import type { CanvasStarterPrompt } from '../../config/CanvasContext';

export interface StarterChipsProps {
  prompts: readonly CanvasStarterPrompt[];
  onSelect: (prompt: CanvasStarterPrompt) => void;
  /** `compact` renders composer-row pills; `cards` renders empty-state cards. */
  variant?: 'compact' | 'cards';
  /** Pin affordance for widget parity (P9); optional per-chip override. */
  showPinAffordance?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Framework starter-chip chrome (02 section 10 rule 3).
 * Renders persona.starterPrompts above the chat composer or in empty state.
 */
export function StarterChips({
  prompts,
  onSelect,
  variant = 'compact',
  showPinAffordance = false,
  className,
  style,
}: StarterChipsProps) {
  if (prompts.length === 0) {
    return null;
  }

  if (variant === 'cards') {
    return (
      <div
        className={className}
        data-testid="starter-chips-cards"
        style={{
          width: '100%',
          maxWidth: 380,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,...style,
        }}
      >
        {prompts.map((prompt) => (
          <StarterCard
            key={promptKey(prompt)}
            prompt={prompt}
            onClick={() => onSelect(prompt)}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={className}
      data-testid="starter-chips-compact"
      role="group"
      aria-label="Starter prompts"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,...style,
      }}
    >
      {prompts.map((prompt) => (
        <StarterChip
          key={promptKey(prompt)}
          prompt={prompt}
          showPin={showPinAffordance || prompt.pin === true}
          onClick={() => onSelect(prompt)}
        />
      ))}
    </div>
  );
}

function promptKey(prompt: CanvasStarterPrompt): string {
  return `${prompt.emoji}-${prompt.text}`;
}

interface StarterChipProps {
  prompt: CanvasStarterPrompt;
  showPin: boolean;
  onClick: () => void;
}

function StarterChip({ prompt, showPin, onClick }: StarterChipProps) {
  const [hover, setHover] = useState(false);
  const label = prompt.label?.trim() || prompt.text;

  return (
    <button
      type="button"
      data-testid="starter-chip"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        borderRadius: 999,
        cursor: 'pointer',
        fontSize: 12.5,
        fontWeight: 500,
        border: `1px solid ${hover ? 'color-mix(in srgb, var(--vibe-accent, #ff6b57) 45%, transparent)': 'var(--vibe-border, #E5E5E5)'}`,
        background: hover
          ? 'color-mix(in srgb, var(--vibe-accent, #ff6b57) 10%, var(--vibe-surface, #F7F9F9))': 'var(--vibe-surface, #F7F9F9)',
        color: hover ? 'var(--vibe-accent, #ff6b57)': 'var(--vibe-text, #1A1A1A)',
        transition: 'all.14s ease',
      }}
    >
      <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>
        {prompt.emoji}
      </span>
      <span>{label}</span>
      {showPin ? (
        <Pin size={11} aria-hidden style={{ opacity: hover ? 1: 0.55 }} />
      ): (
        <Sparkles size={11} aria-hidden style={{ opacity: hover ? 1: 0.45 }} />
      )}
    </button>
  );
}

function StarterCard({
  prompt,
  onClick,
}: {
  prompt: CanvasStarterPrompt;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const label = prompt.label?.trim() || prompt.text;

  return (
    <button
      type="button"
      data-testid="starter-chip-card"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '12px 14px',
        borderRadius: 12,
        cursor: 'pointer',
        textAlign: 'left',
        background: hover ? 'color-mix(in srgb, var(--vibe-accent, #ff6b57) 8%, var(--vibe-surface, #F7F9F9))': 'var(--vibe-surface, #F7F9F9)',
        border: `1px solid ${hover ? 'color-mix(in srgb, var(--vibe-accent, #ff6b57) 45%, transparent)': 'var(--vibe-border, #E5E5E5)'}`,
        transition: 'all.15s ease',
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1 }}>{prompt.emoji}</span>
      <span
        style={{
          flex: 1,
          fontSize: 13.5,
          fontWeight: 500,
          color: hover ? 'var(--vibe-accent, #ff6b57)': 'var(--vibe-text, #1A1A1A)',
        }}
      >
        {label}
      </span>
      <Sparkles size={14} style={{ color: hover ? 'var(--vibe-accent, #ff6b57)': 'var(--vibe-text-muted, #9CA3AF)' }} />
    </button>
  );
}
