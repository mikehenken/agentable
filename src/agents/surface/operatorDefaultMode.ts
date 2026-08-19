import type { OperatorMode } from './types';

const OPERATOR_MODE_VALUES: readonly OperatorMode[] = ['auto', 'ask', 'build', 'draw'];

export function parseOperatorDefaultMode(raw: string | null | undefined): OperatorMode | null {
  const trimmed = raw?.trim().toLowerCase() ?? '';
  if (trimmed.length === 0) {
    return null;
  }
  return OPERATOR_MODE_VALUES.includes(trimmed as OperatorMode)
    ? (trimmed as OperatorMode): null;
}
