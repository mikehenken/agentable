/**
 * Unit tests for the voice kernel — singleton install, stable snapshot
 * reference, idempotent install, `_publish` undefined-as-delete semantics,
 * subscriber notification.
 *
 * The kernel is the load-bearing primitive for `useSyncExternalStore`'s
 * referential-stability contract. If `getSnapshot` returns a fresh object
 * between publishes, React errors with "The result of getSnapshot should
 * be cached to avoid an infinite loop" — that bug already shipped once
 * (B.2 first iteration), so it's the highest-value thing to lock down.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  installVoiceKernel,
  ensureVoiceKernel,
  getVoiceKernel,
} from '../../src/shared/voiceKernel';

describe('voiceKernel — install + identity', () => {
  beforeEach(() => {
    delete (window as unknown as { __voiceKernel__?: unknown }).__voiceKernel__;
  });

  it('installs a kernel on window.__voiceKernel__', () => {
    const k = installVoiceKernel();
    expect(window.__voiceKernel__).toBe(k);
    expect(k.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('is idempotent — installing twice returns the same kernel', () => {
    const a = installVoiceKernel();
    const b = installVoiceKernel();
    expect(a).toBe(b);
  });

  it('ensureVoiceKernel = installVoiceKernel — same instance', () => {
    const a = installVoiceKernel();
    const b = ensureVoiceKernel();
    expect(a).toBe(b);
  });

  it('getVoiceKernel returns null before install', () => {
    expect(getVoiceKernel()).toBe(null);
  });
});

describe('voiceKernel — stable getSnapshot', () => {
  beforeEach(() => {
    delete (window as unknown as { __voiceKernel__?: unknown }).__voiceKernel__;
  });

  it('returns the same reference between publishes', () => {
    const k = installVoiceKernel();
    const a = k.voice.getSnapshot();
    const b = k.voice.getSnapshot();
    expect(a).toBe(b);
  });

  it('returns a NEW reference after _publish', () => {
    const k = installVoiceKernel();
    const before = k.voice.getSnapshot();
    k.voice._publish({ state: 'connecting' });
    const after = k.voice.getSnapshot();
    expect(after).not.toBe(before);
    expect(after.state).toBe('connecting');
  });

  it('reflects subsequent publishes immediately', () => {
    const k = installVoiceKernel();
    k.voice._publish({ state: 'listening', level: 0.5 });
    const snap = k.voice.getSnapshot();
    expect(snap.state).toBe('listening');
    expect(snap.level).toBe(0.5);
  });
});

describe('voiceKernel — _publish undefined-as-delete', () => {
  beforeEach(() => {
    delete (window as unknown as { __voiceKernel__?: unknown }).__voiceKernel__;
  });

  it('treats explicit undefined as "clear this field"', () => {
    const k = installVoiceKernel();
    k.voice._publish({ state: 'error', errorMessage: 'boom' });
    expect(k.voice.getSnapshot().errorMessage).toBe('boom');
    k.voice._publish({ state: 'idle', errorMessage: undefined });
    const snap = k.voice.getSnapshot();
    expect(snap.state).toBe('idle');
    expect(snap.errorMessage).toBeUndefined();
  });
});

describe('voiceKernel — subscribe', () => {
  beforeEach(() => {
    delete (window as unknown as { __voiceKernel__?: unknown }).__voiceKernel__;
  });

  it('fires the listener immediately with current snapshot', () => {
    const k = installVoiceKernel();
    let received: unknown = null;
    k.voice.subscribe((s) => { received = s; });
    expect(received).not.toBe(null);
  });

  it('notifies on _publish', () => {
    const k = installVoiceKernel();
    const calls: string[] = [];
    k.voice.subscribe((s) => { calls.push(s.state); });
    // Initial call happens synchronously inside subscribe.
    expect(calls).toEqual(['idle']);
    k.voice._publish({ state: 'connecting' });
    expect(calls).toEqual(['idle', 'connecting']);
  });

  it('unsubscribes cleanly', () => {
    const k = installVoiceKernel();
    const calls: string[] = [];
    const unsub = k.voice.subscribe((s) => { calls.push(s.state); });
    expect(calls.length).toBe(1);
    unsub();
    k.voice._publish({ state: 'connecting' });
    expect(calls.length).toBe(1); // still 1 — unsubscribed before publish
  });
});

describe('voiceKernel — start/stop with no impl', () => {
  beforeEach(() => {
    delete (window as unknown as { __voiceKernel__?: unknown }).__voiceKernel__;
  });

  it('start() warns and returns when no impl registered', async () => {
    const k = installVoiceKernel();
    // Should not throw, and state should remain idle.
    await k.voice.start();
    expect(k.voice.getSnapshot().state).toBe('idle');
  });

  it('start() routes to registered impl', async () => {
    const k = installVoiceKernel();
    let started = 0;
    k.voice._setImpl({
      start: async () => { started++; },
      stop: async () => {},
    });
    await k.voice.start();
    expect(started).toBe(1);
  });

  it('_clearImpl drops the registration', async () => {
    const k = installVoiceKernel();
    let started = 0;
    k.voice._setImpl({
      start: async () => { started++; },
      stop: async () => {},
    });
    k.voice._clearImpl();
    await k.voice.start();
    expect(started).toBe(0); // no-impl path again
  });
});
