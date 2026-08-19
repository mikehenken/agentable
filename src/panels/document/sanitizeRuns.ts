/**
 * G4 / D50: document text runs are sanitized before render — no inline HTML/JS.
 * Delegates to the shared code-execution boundary (P12-T6).
 */
import type { TextRun } from './types';
import { sanitizeInertText, sanitizePlainText as boundarySanitizePlainText } from '../../security/codeExecutionBoundary';

export { sanitizePlainText } from '../../security/codeExecutionBoundary';

/** Sanitize every run in place; drops empty runs after sanitization. */
export function sanitizeTextRuns(runs: readonly TextRun[]): TextRun[] {
  const sanitized: TextRun[] = [];
  for (const run of runs) {
    const text = boundarySanitizePlainText(run.text);
    if (text.length === 0) continue;
    sanitized.push({
      text,
      ...(run.bold === true ? { bold: true } : {}),
      ...(run.italic === true ? { italic: true } : {}),
      ...(run.code === true ? { code: true } : {}),
    });
  }
  return sanitized;
}

/** Strip angle-bracket sequences from model-supplied text (alias for tests). */
export function stripHtmlTags(value: string): string {
  return sanitizeInertText(value, { trim: true });
}
