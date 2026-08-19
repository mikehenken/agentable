/**
 * telemetry redaction guarantee.
 * Automated check: event payloads strip PII and credential-shaped values.
 */
import { describe, it, expect } from 'vitest';
import { createHostTelemetry } from '../../src/telemetry/hostTelemetry';
import {
  isForbiddenTelemetryKey,
  isForbiddenTelemetrySecretValue,
  redactTelemetryEvent,
  redactTelemetryString,
  TELEMETRY_REDACTED,
  TELEMETRY_REDACTED_EMAIL,
} from '../../src/telemetry/redactTelemetryEvent';
import type { TelemetryEvent } from '../../src/telemetry';
import redactionFixtures from '../fixtures/telemetry-redaction-pii-keys.json';

const BASE_COMPOSE_EVENT: TelemetryEvent = {
  ts: '2026-07-21T12:00:00.000Z',
  family: 'compose',
  phase: 'compose',
  outcome: 'rejected',
  tool: 'compose_panel',
  panelId: 'composed-1',
  errorCodes: ['SPEC_ACTION_REF_MISSING'],
};

describe(' telemetry redaction guarantee ', () => {
  describe('secret value detection', () => {
    it.each(redactionFixtures.secretValues)('flags credential-shaped value %s', (value) => {
      expect(isForbiddenTelemetrySecretValue(value)).toBe(true);
    });

    it('does not flag benign identifiers', () => {
      for (const value of redactionFixtures.benignValues) {
        expect(isForbiddenTelemetrySecretValue(value)).toBe(false);
      }
    });
  });

  describe('forbidden key names', () => {
    it.each(redactionFixtures.forbiddenKeys)('rejects key %s', (key) => {
      expect(isForbiddenTelemetryKey(key)).toBe(true);
    });

    it('allows structured telemetry field names', () => {
      for (const key of redactionFixtures.allowedKeys) {
        expect(isForbiddenTelemetryKey(key)).toBe(false);
      }
    });
  });

  describe('redactTelemetryString', () => {
    it('replaces email addresses with redacted email token', () => {
      expect(redactTelemetryString('Contact user@example.com for help')).toBe(
        `Contact ${TELEMETRY_REDACTED_EMAIL} for help`);
    });

    it('replaces full secret strings with generic redacted token', () => {
      expect(redactTelemetryString('sk_live_abc123secretkey')).toBe(TELEMETRY_REDACTED);
    });

    it('truncates anonKeyHint values to prefix + ellipsis', () => {
      expect(redactTelemetryString('pk_live_abcdefghijklmnop', 'anonKeyHint')).toBe('pk_live_…');
    });
  });

  describe('redactTelemetryEvent', () => {
    it('preserves structured fields that are not sensitive', () => {
      expect(redactTelemetryEvent(BASE_COMPOSE_EVENT)).toEqual(BASE_COMPOSE_EVENT);
    });

    it('strips forbidden top-level keys from polluted payloads', () => {
      const polluted = redactionFixtures.pollutedComposeEvent as TelemetryEvent;

      const redacted = redactTelemetryEvent(polluted);
      expect(redacted).toEqual(BASE_COMPOSE_EVENT);
      expect(Object.prototype.hasOwnProperty.call(redacted, 'apiKey')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(redacted, 'password')).toBe(false);
    });

    it('redacts PII embedded in string fields', () => {
      const polluted = {...BASE_COMPOSE_EVENT,
        panelId: 'panel-for user@example.com',
      } as TelemetryEvent;

      expect(redactTelemetryEvent(polluted).panelId).toBe(
        `panel-for ${TELEMETRY_REDACTED_EMAIL}`);
    });

    it('redacts credential-shaped values in string fields', () => {
      const polluted = {...BASE_COMPOSE_EVENT,
        panelId: 'sk_live_abc123secretkey',
      } as TelemetryEvent;

      expect(redactTelemetryEvent(polluted).panelId).toBe(TELEMETRY_REDACTED);
    });

    it('redacts embedded credential substrings in string fields', () => {
      const polluted = {...BASE_COMPOSE_EVENT,
        panelId: 'prefix-sk_live_leaked_suffix',
      } as TelemetryEvent;

      expect(redactTelemetryEvent(polluted).panelId).toBe(`prefix-${TELEMETRY_REDACTED}_suffix`);
    });

    it('truncates full anon keys in embed telemetry anonKeyHint', () => {
      const embedEvent = redactionFixtures.pollutedEmbedEvent as TelemetryEvent;

      expect(redactTelemetryEvent(embedEvent).anonKeyHint).toBe('pk_live_…');
    });

    it('redacts emails in errorCodes arrays when polluted at runtime', () => {
      const polluted = {...BASE_COMPOSE_EVENT,
        errorCodes: ['VALIDATION', 'user@example.com'],
      } as unknown as TelemetryEvent;

      const redacted = redactTelemetryEvent(polluted);
      expect(redacted.errorCodes).toEqual(['VALIDATION', TELEMETRY_REDACTED_EMAIL]);
    });
  });

  describe('createHostTelemetry emit boundary', () => {
    it('delivers redacted payloads to the host sink', () => {
      const received: TelemetryEvent[] = [];
      const telemetry = createHostTelemetry((event) => {
        received.push(event);
      });

      telemetry.emit({
        ts: '2026-07-21T12:00:00.000Z',
        family: 'tool',
        toolName: 'open_panel',
        outcome: 'error',
        latencyMs: 12,
        agentId: 'editor',
        errorCodes: ['SCOPE_DENIED'],
      });

      telemetry.emit({
        ts: '2026-07-21T12:00:00.000Z',
        family: 'embed',
        operation: 'tenant_lookup',
        outcome: 'refused',
        anonKeyHint: 'pk_live_supersecretvalue',
        errorCodes: ['RATE_LIMITED'],
      } as TelemetryEvent);

      expect(received).toHaveLength(2);
      expect(received[0]).toMatchObject({
        family: 'tool',
        agentId: 'editor',
        errorCodes: ['SCOPE_DENIED'],
      });
      expect(received[1]?.anonKeyHint).toBe('pk_live_…');
      expect(JSON.stringify(received)).not.toContain('supersecretvalue');
      expect(JSON.stringify(received)).not.toContain('sk_live');
    });
  });
});
