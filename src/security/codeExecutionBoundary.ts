/**
 * G4 code-execution boundary.
 *
 * Untrusted strings from models, adapters, and host payloads must render as
 * inert plain text — never as HTML, script, or executable URLs.
 */
import type { ResolvedCanvasPolicy } from '../config/canvasPolicyTypes';

const HTML_TAG_PATTERN = /<[^>]*>/g;
const JAVASCRIPT_SCHEME = /javascript\s*:/gi;
const DATA_HTML_SCHEME = /data\s*:\s*text\/html/gi;
const EVENT_HANDLER_PATTERN = /\bon[a-z]+\s*=/gi;

/** Safe asset id charset: opaque host references only (no paths or URLs). */
const SAFE_ASSET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

const URL_LIKE = /^(https?:|data:|\/\/|javascript:)/i;

export interface SanitizeInertTextOptions {
  /** Trim whitespace after sanitization (document text runs). */
  trim?: boolean;
}

/**
 * Strip markup and neutralize JS-shaped substrings before React text render.
 */
export function sanitizeInertText(
  value: string | undefined | null,
  options: SanitizeInertTextOptions = {},
): string {
  if (value === undefined || value === null) {
    return '';
  }
  const trim = options.trim ?? false;
  let next = value
    .replace(HTML_TAG_PATTERN, '')
    .replace(JAVASCRIPT_SCHEME, '')
    .replace(DATA_HTML_SCHEME, '')
    .replace(EVENT_HANDLER_PATTERN, '');
  if (trim) {
    next = next.trim();
  }
  return next;
}

/** @deprecated Prefer `sanitizeInertText`; kept for document panel exports. */
export function sanitizePlainText(value: string): string {
  return sanitizeInertText(value, { trim: true });
}

export function containsMarkupOrScript(value: string): boolean {
  if (HTML_TAG_PATTERN.test(value)) return true;
  HTML_TAG_PATTERN.lastIndex = 0;
  if (JAVASCRIPT_SCHEME.test(value)) return true;
  JAVASCRIPT_SCHEME.lastIndex = 0;
  if (DATA_HTML_SCHEME.test(value)) return true;
  DATA_HTML_SCHEME.lastIndex = 0;
  if (EVENT_HANDLER_PATTERN.test(value)) return true;
  EVENT_HANDLER_PATTERN.lastIndex = 0;
  return false;
}

export function isUrlLike(value: string): boolean {
  return URL_LIKE.test(value.trim());
}

export type AssetIdValidationResult =
  | { ok: true; assetId: string }
  | { ok: false; reason: string };

/**
 * Validate an opaque asset reference before resolution or render.
 * Host bridges remain the trust anchor for resolved bytes/URLs.
 */
export function validateAssetId(value: string): AssetIdValidationResult {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: 'assetId must be non-empty' };
  }
  if (isUrlLike(trimmed)) {
    return { ok: false, reason: 'assetId must not be a URL' };
  }
  if (containsMarkupOrScript(trimmed)) {
    return { ok: false, reason: 'assetId must not contain markup or script' };
  }
  if (!SAFE_ASSET_ID_PATTERN.test(trimmed)) {
    return { ok: false, reason: 'assetId has invalid characters' };
  }
  return { ok: true, assetId: trimmed };
}

/**
 * Display-safe asset id for document renderer (never emits raw markup/URLs).
 */
export function sanitizeAssetIdForDisplay(value: string): string {
  const validated = validateAssetId(value);
  if (validated.ok) {
    return validated.assetId;
  }
  return sanitizeInertText(value, { trim: true });
}

/** P14 / gate — code preview tier stays off unless policy explicitly enables it. */
export function isCodePreviewAllowed(policy: ResolvedCanvasPolicy): boolean {
  return policy.allowCodePreview === true;
}

/** Red-team probe strings exercised in unit tests. */
export const RED_TEAM_INERT_STRINGS: readonly string[] = [
  '<script>alert(1)</script>Hello',
  '<img src=x onerror=alert(1)>',
  'javascript:alert(1)',
  '<svg/onload=alert(1)>',
  '"><iframe src=javascript:alert(1)>',
  'data:text/html,<script>alert(1)</script>',
] as const;
