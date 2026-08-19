/**
 * Story-mode walkthrough tool: present_walkthrough queues camera
 * moves through the P6 politeness queue and emits per-step narration.
 */
import { emitAgUiStatePatch } from '../../protocol/ag-ui';
import { getAgentToolContext } from '../agentContext';
import {
  drawCapabilityRefusal,
  isDrawCapabilityAvailable,
} from '../engineBridge';
import { getWalkthroughRuntime } from '../walkthroughBridge';
import { runWalkthrough } from '../walkthroughRunner';
import type {
  WalkthroughStepInput,
  WalkthroughTarget,
} from '../walkthroughTypes';
import { WALKTHROUGH_UNAVAILABLE_CODE } from '../walkthroughTypes';
import type { ToolDeclaration, ToolDefinition } from '../../panels/tools';

export const WALKTHROUGH_TOOL_NAMES = ['present_walkthrough'] as const;

export type WalkthroughToolName = (typeof WALKTHROUGH_TOOL_NAMES)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value: undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value: undefined;
}

function readTarget(value: unknown): WalkthroughTarget | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return { kind: 'panel', panelId: value };
  }
  if (Array.isArray(value) && value.length > 0) {
    const shapeIds = value.map((entry) => readString(entry)).filter((entry): entry is string => entry !== undefined);
    if (shapeIds.length !== value.length) return undefined;
    return { kind: 'shapes', shapeIds };
  }
  return undefined;
}

function readWalkthroughStep(value: unknown): WalkthroughStepInput | undefined {
  if (!isRecord(value)) return undefined;
  const target = readTarget(value.target);
  if (target === undefined) return undefined;
  const step: WalkthroughStepInput = { target };
  const say = readString(value.say);
  if (say !== undefined) step.say = say;
  const dwellMs = readFiniteNumber(value.dwellMs);
  if (dwellMs !== undefined && dwellMs >= 0) step.dwellMs = Math.floor(dwellMs);
  return step;
}

function readWalkthroughSteps(value: unknown): WalkthroughStepInput[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const steps = value.map((entry) => readWalkthroughStep(entry)).filter((entry): entry is WalkthroughStepInput => entry !== undefined);
  if (steps.length !== value.length) return undefined;
  return steps;
}

function resolveActingAgentId(args: Record<string, unknown>): string {
  const ctx = getAgentToolContext;
  if (ctx === null) {
    throw new Error('agent tool context is required for this operation');
  }
  const override = readString(args.agentId);
  return override ?? ctx().agentId;
}

function emitWalkthroughNarration(
  agentId: string,
  narration: { stepIndex: number; say: string }): void {
  emitAgUiStatePatch(
    [
      {
        op: 'add',
        path: '/walkthrough/narration/-',
        value: {
          agentId,
          stepIndex: narration.stepIndex,
          say: narration.say,
          timestamp: new Date().toISOString(),
        },
      },
    ],
    { source: 'tool', toolName: 'present_walkthrough' });
}

function walkthroughRuntimeRefusal(): { ok: false; error: string } {
  return {
    ok: false,
    error: `${WALKTHROUGH_UNAVAILABLE_CODE}: walkthrough runtime is not bound`,
  };
}

const declarationPresentWalkthrough: ToolDeclaration = {
  name: 'present_walkthrough',
  description:
    'Narrate a multi-scene story by stepping the camera through frame, shape, or panel targets. Each step may include say text for chat or voice. User camera input cancels instantly.',
  costClass: 'cheap',
  parameters: {
    type: 'object',
    properties: {
      steps: {
        type: 'array',
        description:
          'Ordered scenes. Each step target is a panel id, frame or shape id string, or an array of shape ids.',
        items: { type: 'object' },
      },
    },
    required: ['steps'],
  },
};

export const WALKTHROUGH_TOOLS: readonly ToolDefinition[] = [
  {
    declaration: declarationPresentWalkthrough,
    handler: async (args) => {
      if (!isDrawCapabilityAvailable) {
        return drawCapabilityRefusal;
      }
      const runtime = getWalkthroughRuntime;
      if (runtime === null) {
        return walkthroughRuntimeRefusal;
      }
      const steps = readWalkthroughSteps(args.steps);
      if (steps === undefined) {
        return {
          ok: false,
          error: 'steps must be a non-empty array of walkthrough scenes with valid targets',
        };
      }
      try {
        const agentId = resolveActingAgentId(args);
        const result = await runWalkthrough({
          agentId,
          steps,
          camera: runtime().camera,
          resolveTarget: runtime().resolveTarget,
          applyIntent: runtime().applyIntent,
          emitNarration: (narration) => emitWalkthroughNarration(agentId, narration),
          registerCancelListener: runtime().registerCancelListener,
        });
        return {
          ok: result.ok,
          result: {
            completedSteps: result.completedSteps,
            totalSteps: result.totalSteps,
            cancelled: result.cancelled,
            cancelReason: result.cancelReason,
            narrations: result.narrations,
          },...(result.ok
            ? {}: {
                error: result.cancelled
                  ? `walkthrough cancelled (${result.cancelReason ?? 'unknown'})`: 'walkthrough did not complete all steps',
              }),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message: String(err);
        return { ok: false, error: message };
      }
    },
  },
];
