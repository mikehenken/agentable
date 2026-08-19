/**
 * automated check: draw, canvas perception ("see"), and walkthrough
 * tool calls against an engine that declares capabilities.draw: false (the
 * DOM workspace engine) return a structured, typed capability refusal
 * instead of throwing or silently no-op'ing.
 *
 * The gate under test (`isDrawCapabilityAvailable` `drawCapabilityRefusal`
 * `parseEngineCapabilityRefusal` in src/agents/engineBridge.ts) reads
 * `capabilities.draw` off whatever `EngineCapabilities` object is bound, so
 * these tests bind the DOM engine's actual declared capabilities
 * (`DOM_ENGINE_CAPABILITIES`, exported by the DOM engine module) rather
 * than a synthetic mock, proving the refusal is capability-derived from
 * the SPI and not an engine-name or engine-type check.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  bindEngineCapabilities,
  parseEngineCapabilityRefusal,
  resetEngineCapabilitiesForTests,
} from '../../src/agents/engineBridge';
import { DRAWING_TOOLS } from '../../src/agents/tools/drawingTools';
import { PERCEPTION_TOOLS } from '../../src/agents/tools/perceptionTools';
import { WALKTHROUGH_TOOLS } from '../../src/agents/tools/walkthroughTools';
import { ENGINE_DRAW_UNAVAILABLE_CODE } from '../../src/engine/agentDrawingTypes';
import { DOM_ENGINE_CAPABILITIES } from '../../src/engines/dom';
import type { EngineCapabilities } from '../../src/engine/types';
import type { ToolDefinition, ToolResult } from '../../src/panels/tools';

function tool(tools: readonly ToolDefinition[], name: string): ToolDefinition {
  const found = tools.find((entry) => entry.declaration.name === name);
  if (found === undefined) {
    throw new Error(`test setup: tool "${name}" not found`);
  }
  return found;
}

/** Adopter-facing refusal messages must read clean of internal shorthand. */
const INTERNAL_ID_PATTERN = /\bP\d+-T\d+\b|\bD\d{2,3}\b/;

async function callTool(definition: ToolDefinition, args: Record<string, unknown>): Promise<ToolResult> {
  return definition.handler(args);
}

describe('draw/see/walkthrough structured capability refusal on the DOM engine ', () => {
  afterEach(() => {
    resetEngineCapabilitiesForTests();
  });

  it('DOM_ENGINE_CAPABILITIES declares draw: false (sanity check on the fixture used below)', () => {
    expect(DOM_ENGINE_CAPABILITIES.draw).toBe(false);
  });

  it('draw_shapes ("draw") returns a structured capability error against the DOM engine', async () => {
    bindEngineCapabilities(DOM_ENGINE_CAPABILITIES);
    const result = await callTool(tool(DRAWING_TOOLS, 'draw_shapes'), {
      shapes: [{ kind: 'box', geometry: { kind: 'rect', x: 0, y: 0, w: 10, h: 10 } }],
    });

    expect(result.ok).toBe(false);
    const refusal = parseEngineCapabilityRefusal(result);
    expect(refusal).toBeDefined();
    expect(refusal?.code).toBe(ENGINE_DRAW_UNAVAILABLE_CODE);
    expect(refusal?.capability).toBe('draw');
    expect(refusal?.message.length).toBeGreaterThan(0);
    expect(refusal?.message).not.toMatch(INTERNAL_ID_PATTERN);
  });

  it('read_canvas ("see") returns a structured capability error against the DOM engine, not a thrown editor error', async () => {
    bindEngineCapabilities(DOM_ENGINE_CAPABILITIES);
    let thrown: unknown;
    let result: ToolResult | undefined;
    try {
      result = await callTool(tool(PERCEPTION_TOOLS, 'read_canvas'), {});
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeUndefined();
    expect(result).toBeDefined();
    expect(result?.ok).toBe(false);
    const refusal = parseEngineCapabilityRefusal(result!);
    expect(refusal).toBeDefined();
    expect(refusal?.code).toBe(ENGINE_DRAW_UNAVAILABLE_CODE);
    expect(refusal?.capability).toBe('draw');
     // Not the tldraw-editor-absence message this tool would otherwise throw
     // or surface (see tests/unit/perceptionReadScreenshot.test.ts): the
     // capability gate must win before the tldraw-only driver ever runs.
    if (!result?.ok) {
      expect(result?.error).not.toContain('canvas editor not bound');
    }
  });

  it('screenshot_canvas ("see") returns a structured capability error against the DOM engine', async () => {
    bindEngineCapabilities(DOM_ENGINE_CAPABILITIES);
    const result = await callTool(tool(PERCEPTION_TOOLS, 'screenshot_canvas'), {});

    expect(result.ok).toBe(false);
    const refusal = parseEngineCapabilityRefusal(result);
    expect(refusal).toBeDefined();
    expect(refusal?.code).toBe(ENGINE_DRAW_UNAVAILABLE_CODE);
    expect(refusal?.capability).toBe('draw');
  });

  it('present_walkthrough ("walkthrough") returns a structured capability error against the DOM engine', async () => {
    bindEngineCapabilities(DOM_ENGINE_CAPABILITIES);
    const result = await callTool(tool(WALKTHROUGH_TOOLS, 'present_walkthrough'), {
      steps: [{ target: 'chat', say: 'Hello' }],
    });

    expect(result.ok).toBe(false);
    const refusal = parseEngineCapabilityRefusal(result);
    expect(refusal).toBeDefined();
    expect(refusal?.code).toBe(ENGINE_DRAW_UNAVAILABLE_CODE);
    expect(refusal?.capability).toBe('draw');
  });

  it('is capability-derived from the SPI, not an engine-name check: a non-DOM object with draw: true is not refused', async () => {
    const nonDomDrawCapableEngine: EngineCapabilities = {
      frames: false,
      draw: true,
      minimap: false,
      infinitePan: false,
      nativeSnapshots: false,
    };
    bindEngineCapabilities(nonDomDrawCapableEngine);
    const result = await callTool(tool(PERCEPTION_TOOLS, 'screenshot_canvas'), {});
     // No draw refusal now that capabilities.draw is true; the call proceeds
     // into the tldraw-only driver and fails there instead (no editor bound
     // in this test), proving the gate reads the capability flag, not the
     // engine's identity.
    expect(parseEngineCapabilityRefusal(result)).toBeUndefined();
  });

  it('never returns a silent no-op: the refusal always signals ok: false with a non-empty message', async () => {
    bindEngineCapabilities(DOM_ENGINE_CAPABILITIES);
    const results = await Promise.all([
      callTool(tool(DRAWING_TOOLS, 'draw_shapes'), { shapes: [] }),
      callTool(tool(PERCEPTION_TOOLS, 'read_canvas'), {}),
      callTool(tool(PERCEPTION_TOOLS, 'screenshot_canvas'), {}),
      callTool(tool(WALKTHROUGH_TOOLS, 'present_walkthrough'), { steps: [] }),
    ]);
    for (const result of results) {
      expect(result.ok).toBe(false);
      const refusal = parseEngineCapabilityRefusal(result);
      expect(refusal?.message.trim().length).toBeGreaterThan(0);
    }
  });
});
