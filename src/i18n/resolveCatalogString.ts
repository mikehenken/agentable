/**
 * Resolve user-facing spec prop values that reference the message catalog.
 *
 * Panel builders store `MessageKey` strings (e.g. `career.panels.openPositions.title`)
 * in spec props; catalog components call this at render time so locale switches
 * apply without recompiling specs.
 */
import { sanitizeInertText } from '../security/codeExecutionBoundary';import { en, type MessageKey } from './catalog/en';
import { getI18n } from './index';

export function isMessageKey(value: string): value is MessageKey {
  return Object.prototype.hasOwnProperty.call(en, value);
}

/** Resolve a catalog key through `t`, or return literal tenant copy unchanged. */
export function resolveCatalogString(value: string | undefined): string {
  if (value === undefined || value.length === 0) return '';
  if (isMessageKey(value)) return getI18n().t(value);
  return sanitizeInertText(value);
}
