import type { CSSProperties, ReactElement } from 'react';
import './AiPersona.css';
import type { AiPersonaProps, AiPersonaSize, AiPersonaState, AiPersonaType } from './types';

const SIZE_PX: Record<AiPersonaSize, number> = {
  xs: 22,
  sm: 30,
  md: 40,
  lg: 72,
};

function clampLevel(level: number | undefined): number {
  if (typeof level !== 'number' || Number.isNaN(level)) return 0;
  return Math.min(1, Math.max(0, level));
}

/**
 * Reusable AI persona presence — animated halo (default) driven by voice/chat state.
 * Drop into chat empty state, message avatars, or header chrome.
 */
export function AiPersona({
  type = 'halo',
  state = 'idle',
  size = 'md',
  level = 0,
  label,
  initial,
  className,
  'data-testid': testId = 'ai-persona',
}: AiPersonaProps): ReactElement {
  const resolvedType: AiPersonaType = type || 'halo';
  const resolvedState: AiPersonaState = state || 'idle';
  const clamped = clampLevel(level);
  const style: CSSProperties = {
    ['--ap-level' as string]: String(clamped),
    ['--ap-size' as string]: `${SIZE_PX[size]}px`,
  };

  const classes = [
    'agentable-persona',
    `agentable-persona--${size}`,
    `agentable-persona--type-${resolvedType}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={classes}
      data-testid={testId}
      data-type={resolvedType}
      data-state={resolvedState}
      role="img"
      aria-label={label ?? `AI persona (${resolvedState})`}
      style={style}
    >
      <span className="agentable-persona__rings" aria-hidden="true" />
      <span className="agentable-persona__core" aria-hidden="true" />
      {initial ? (
        <span className="agentable-persona__initial" aria-hidden="true">
          {initial}
        </span>
      ) : null}
    </span>
  );
}
