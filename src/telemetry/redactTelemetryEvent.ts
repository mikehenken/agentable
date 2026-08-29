/**
 * redaction guarantee: strip PII and credential-shaped values
 * from telemetry payloads before host sink dispatch.
 */
import type { TelemetryEvent } from './types';

export const TELEMETRY_REDACTED = '[redacted]' as const;

export const TELEMETRY_REDACTED_EMAIL = '[redacted:email]' as const;

/** Field names that must never appear on emitted telemetry payloads. */
const FORBIDDEN_KEY_PATTERN =
  /^(auth|secret|service[_-]?role|api[_-]?key|private[_-]?key|gemini|openai|supabase|bearer|password|credential|token|access[_-]?token|refresh[_-]?token)/i;

/** Entire-string secret shapes (aligned with embed G3 sanitizer). */
const FORBIDDEN_VALUE_PATTERNS: readonly RegExp[] = [
  /^sk_(live|test)_[a-zA-Z0-9]+$/,
  /^sk_[a-zA-Z0-9]+$/,
  /^pk_(live|test)_[a-zA-Z0-9]+$/,
  /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/,
  /^AIzaSy[a-zA-Z0-9_-]+$/,
  /^sbp_[a-zA-Z0-9]+$/,
  /^Bearer\s+[a-zA-Z0-9._-]+$/i,
];

/** Embedded secret substrings redacted inline within larger strings. */
const EMBEDDED_SECRET_PATTERNS: readonly RegExp[] = [
  /sk_(live|test)_[a-zA-Z0-9]+/g,
  /pk_(live|test)_[a-zA-Z0-9]+/g,
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
  /AIzaSy[a-zA-Z0-9_-]+/g,
  /sbp_[a-zA-Z0-9]+/g,
  /Bearer\s+[a-zA-Z0-9._-]+/gi,
];

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const ANON_KEY_HINT_MAX_PREFIX = 8;

function truncateAnonKeyHint(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  return trimmed.length <= ANON_KEY_HINT_MAX_PREFIX
    ? `${trimmed}…`
    : `${trimmed.slice(0, ANON_KEY_HINT_MAX_PREFIX)}…`;
}

export function isForbiddenTelemetryKey(key: string): boolean {
  return FORBIDDEN_KEY_PATTERN.test(key);
}

export function isForbiddenTelemetrySecretValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return FORBIDDEN_VALUE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function redactTelemetryString(value: string, fieldKey?: string): string {
  if (fieldKey === 'anonKeyHint') {
    return truncateAnonKeyHint(value);
  }

  const trimmed = value.trim();
  if (isForbiddenTelemetrySecretValue(trimmed)) {
    return TELEMETRY_REDACTED;
  }

  let next = value.replace(EMAIL_PATTERN, TELEMETRY_REDACTED_EMAIL);
  for (const pattern of EMBEDDED_SECRET_PATTERNS) {
    next = next.replace(pattern, TELEMETRY_REDACTED);
  }

  return next;
}

function redactJsonLike(value: unknown, fieldKey?: string): unknown {
  if (typeof value === 'string') {
    return redactTelemetryString(value, fieldKey);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactJsonLike(entry));
  }

  if (value !== null && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (isForbiddenTelemetryKey(key)) {
        continue;
      }
      next[key] = redactJsonLike(entry, key);
    }
    return next;
  }

  return value;
}

/**
 * Deep-redact a telemetry event before sink dispatch. Drops forbidden keys,
 * truncates `anonKeyHint`, and replaces PII / credential-shaped strings.
 */
export function redactTelemetryEvent(event: TelemetryEvent): TelemetryEvent {
  // Serialization boundary: the walker treats the event as plain JSON and preserves its shape (minus forbidden keys).
  return redactJsonLike(event) as TelemetryEvent;
}
