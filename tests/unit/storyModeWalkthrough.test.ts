/**
 * automated checks: story-mode walkthrough runner, camera queue
 * integration, narration emit, and user-input cancellation.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  gateToolsForEngineCapabilities,
  ENGINE_DRAW_REQUIRED_TOOLS,
} from '../../src/agents/capabilities';
import {
  bindWalkthroughRuntime,
  resetWalkthroughRuntimeForTests,
} from '../../src/agents/walkthroughBridge';
import {
  cancelActiveWalkthrough,
  runWalkthrough,
} from '../../src/agents/walkthroughRunner';
import {
  createCameraQueue,
  resetCameraIntentCounterForTests,
} from '../../src/agents/camera';
import {
  bindEngineCapabilities,
  resetEngineCapabilitiesForTests,
} from '../../src/agents/engineBridge';
import { withAgentToolContextAsync } from '../../src/agents/agentContext';
import { WALKTHROUGH_TOOLS } from '../../src/agents/tools/walkthroughTools';
import type { EngineCapabilities } from '../../src/engine/types';
import type { WalkthroughTarget } from '../../src/agents/walkthroughTypes';

const AG_UI_EVENT = 'landi:ag-ui-state-patch';

function makeCapabilities(draw: boolean): EngineCapabilities {
  return {
    frames: draw,
    draw,
    minimap: draw,
    infinitePan: draw,
    nativeSnapshots: draw,
  };
}

describe('present_walkthrough engine capability gating ', () => {
  afterEach(() => {
    resetEngineCapabilitiesForTests();
  });

  it('offers present_walkthrough when draw capability is bound', () => {
    const offers = gateToolsForEngineCapabilities(
      WALKTHROUGH_TOOLS,
      makeCapabilities(true));
    expect(offers.every((offer) => offer.offered)).toBe(true);
    expect(ENGINE_DRAW_REQUIRED_TOOLS.has('present_walkthrough')).toBe(true);
  });

  it('withholds present_walkthrough when draw capability is missing', () => {
    const offers = gateToolsForEngineCapabilities(
      WALKTHROUGH_TOOLS,
      makeCapabilities(false));
    expect(offers[0]?.offered).toBe(false);
  });
});

describe('runWalkthrough camera queue integration ', () => {
  beforeEach(() => {
    resetCameraIntentCounterForTests();
  });

  it('enqueues and applies camera intents scene by scene with narration', async () => {
    const camera = createCameraQueue({ now: () => 1_000 });
    const applied: Array<Record<string, unknown>> = [];
    const narrations: string[] = [];

    const result = await runWalkthrough({
      agentId: 'guide',
      steps: [
        { target: { kind: 'panel', panelId: 'chat' }, say: 'Welcome to chat.' },
        { target: { kind: 'frame', frameId: 'frame:scene-2' }, say: 'Scene two.' },
      ],
      camera,
      resolveTarget: (target: WalkthroughTarget) => ({
        kind: 'zoomTo',
        rect: { x: 0, y: 0, w: 100, h: 100 },
        inset: 32,
        targetKind: target.kind,
      }),
      applyIntent: (intent) => {
        applied.push(intent as unknown as Record<string, unknown>);
      },
      emitNarration: (n) => {
        narrations.push(n.say);
      },
      defaultDwellMs: 0,
    });

    expect(result.ok).toBe(true);
    expect(result.completedSteps).toBe(2);
    expect(applied).toHaveLength(2);
    expect(narrations).toEqual(['Welcome to chat.', 'Scene two.']);
    expect(camera.holder).toBeUndefined();
  });

  it('cancels instantly when user camera input fires mid-walkthrough', async () => {
    const camera = createCameraQueue({ now: () => 2_000 });
    let triggerUserCancel: (() => void) | undefined;

    const result = await runWalkthrough({
      agentId: 'guide',
      steps: [
        { target: { kind: 'panel', panelId: 'a' }, say: 'Step one' },
        { target: { kind: 'panel', panelId: 'b' }, say: 'Step two' },
        { target: { kind: 'panel', panelId: 'c' }, say: 'Step three' },
      ],
      camera,
      resolveTarget: () => ({ kind: 'zoomTo', rect: { x: 0, y: 0, w: 50, h: 50 } }),
      applyIntent: () => {},
      emitNarration: () => {},
      defaultDwellMs: 200,
      sleep: async (_ms, isCancelled) => {
        triggerUserCancel?.();
        return !isCancelled;
      },
      registerCancelListener: (onCancel) => {
        triggerUserCancel = onCancel;
        return () => {
          triggerUserCancel = undefined;
        };
      },
    });

    expect(result.cancelled).toBe(true);
    expect(result.cancelReason).toBe('user_input');
    expect(result.completedSteps).toBe(1);
    expect(camera.holder).toBeUndefined();
  });

  it('returns hold_denied when camera hold cannot be acquired', async () => {
    const camera = createCameraQueue({ now: () => 3_000 });
    camera.acquireHold('other-agent', 3_000);

    const result = await runWalkthrough({
      agentId: 'guide',
      steps: [{ target: { kind: 'panel', panelId: 'chat' } }],
      camera,
      resolveTarget: () => ({ kind: 'zoomTo', rect: { x: 0, y: 0, w: 10, h: 10 } }),
      applyIntent: () => {},
      emitNarration: () => {},
      defaultDwellMs: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.cancelReason).toBe('hold_denied');
    expect(result.attentionBadge).toBe(true);
  });

  it('supersedes an active walkthrough when cancelActiveWalkthrough is called', async () => {
    const camera = createCameraQueue({ now: () => 4_000 });
    let releaseSleep: (() => void) | undefined;

    const firstPromise = runWalkthrough({
      agentId: 'guide',
      steps: [
        { target: { kind: 'panel', panelId: 'a' } },
        { target: { kind: 'panel', panelId: 'b' } },
      ],
      camera,
      resolveTarget: () => ({ kind: 'zoomTo', rect: { x: 0, y: 0, w: 10, h: 10 } }),
      applyIntent: () => {},
      emitNarration: () => {},
      defaultDwellMs: 100,
      sleep: () =>
        new Promise<boolean>((resolve) => {
          releaseSleep = ()=> resolve(false);
        }),
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    cancelActiveWalkthrough();
    releaseSleep?.();

    const firstResult = await firstPromise;
    expect(firstResult.cancelled).toBe(true);
    expect(firstResult.cancelReason).toBe('superseded');
  });
});

describe('present_walkthrough tool handler ', () => {
  const tool = WALKTHROUGH_TOOLS.find(
    (entry) => entry.declaration.name === 'present_walkthrough');

  beforeEach(() => {
    resetWalkthroughRuntimeForTests();
    resetEngineCapabilitiesForTests();
    bindEngineCapabilities(makeCapabilities(true));
  });

  afterEach(() => {
    resetWalkthroughRuntimeForTests();
    resetEngineCapabilitiesForTests();
  });

  it('refuses when walkthrough runtime is unbound', async () => {
    await withAgentToolContextAsync({ agentId: 'guide', agentLabel: 'Guide' }, async () => {
      const result = await tool!.handler({
        steps: [{ target: 'chat', say: 'Hello' }],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/WALKTHROUGH_UNAVAILABLE/);
      }
    });
  });

  it('runs bound walkthrough and emits narration patches', async () => {
    const camera = createCameraQueue({ now: () => 5_000 });
    const patches: unknown[] = [];
    const onPatch = (event: Event): void => {
      patches.push((event as CustomEvent).detail);
    };
    window.addEventListener(AG_UI_EVENT, onPatch);

    bindWalkthroughRuntime({
      camera,
      resolveTarget: () => ({ kind: 'zoomTo', rect: { x: 0, y: 0, w: 80, h: 80 } }),
      applyIntent: () => {},
    });

    try {
      await withAgentToolContextAsync({ agentId: 'guide', agentLabel: 'Guide' }, async () => {
        const result = await tool!.handler({
          steps: [
            { target: 'chat', say: 'Scene one narration.' },
            { target: ['shape:a', 'shape:b'], dwellMs: 0 },
          ],
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          const payload = result.result as { narrations: Array<{ say: string }> };
          expect(payload.narrations).toHaveLength(1);
          expect(payload.narrations[0]?.say).toBe('Scene one narration.');
        }
      });
      expect(patches.length).toBeGreaterThan(0);
    } finally {
      window.removeEventListener(AG_UI_EVENT, onPatch);
    }
  });

  it('rejects invalid steps payloads', async () => {
    bindWalkthroughRuntime({
      camera: createCameraQueue,
      resolveTarget: () => null,
      applyIntent: () => {},
    });

    await withAgentToolContextAsync({ agentId: 'guide', agentLabel: 'Guide' }, async () => {
      const result = await tool!.handler({ steps: [] });
      expect(result.ok).toBe(false);
    });
  });

  it('refuses when draw capability is unavailable', async () => {
    resetEngineCapabilitiesForTests();
    bindWalkthroughRuntime({
      camera: createCameraQueue,
      resolveTarget: () => null,
      applyIntent: () => {},
    });

    await withAgentToolContextAsync({ agentId: 'guide', agentLabel: 'Guide' }, async () => {
      const result = await tool!.handler({
        steps: [{ target: 'chat' }],
      });
      expect(result.ok).toBe(false);
    });
  });
});

describe('walkthrough tool registration ', () => {
  it('declares present_walkthrough in WALKTHROUGH_TOOLS', () => {
    const names = WALKTHROUGH_TOOLS.map((entry) => entry.declaration.name);
    expect(names).toEqual(['present_walkthrough']);
  });
});
