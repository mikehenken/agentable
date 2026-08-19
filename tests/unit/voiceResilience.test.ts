/**
 * voice reconnect policy unit coverage.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeBackoffDelayMs,
  createVoiceReconnectController,
} from '../../src/voice/resilience';

describe('voiceResilience — backoff', () => {
  it('computes exponential delays capped at max', () => {
    expect(computeBackoffDelayMs(1)).toBe(250);
    expect(computeBackoffDelayMs(2)).toBe(500);
    expect(computeBackoffDelayMs(3)).toBe(1000);
    expect(computeBackoffDelayMs(5)).toBe(4000);
    expect(computeBackoffDelayMs(10)).toBe(4000);
  });
});

describe('voiceResilience — controller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('preserves logical session id across reconnect attempts', () => {
    const controller = createVoiceReconnectController({}, 'vs_test_logical');
    expect(controller.logicalSessionId).toBe('vs_test_logical');
  });

  it('schedules bounded reconnect attempts with increasing delay', async () => {
    const controller = createVoiceReconnectController({
      initialDelayMs: 100,
      maxAttempts: 3,
    });
    const runs: number[] = [];

    controller.scheduleReconnect(async () => {
      runs.push(Date.now());
    });
    expect(controller.attemptCount).toBe(1);

    await vi.advanceTimersByTimeAsync(100);
    expect(runs).toHaveLength(1);

    controller.scheduleReconnect(async () => {
      runs.push(Date.now());
    });
    await vi.advanceTimersByTimeAsync(200);
    expect(runs).toHaveLength(2);
  });

  it('returns null when attempts are exhausted', () => {
    const controller = createVoiceReconnectController({ maxAttempts: 2 });
    expect(controller.scheduleReconnect(() => undefined)).not.toBeNull();
    expect(controller.scheduleReconnect(() => undefined)).not.toBeNull();
    expect(controller.scheduleReconnect(() => undefined)).toBeNull();
    expect(controller.isExhausted).toBe(true);
  });
});
