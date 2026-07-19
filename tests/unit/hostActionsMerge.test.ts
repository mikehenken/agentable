/**
 * Host actions merge into the shared tool registry through
 * `createCanvasHost({ hostActions })` and leave it again on `dispose`.
 *
 * The suite exercises both layers of the seam: the panels-side
 * registration store (`registerHostActions`/`getHostActions`, engine-free
 * by construction) and the canvas-side runtime registry that the voice
 * and chat clients consume (`getFunctionDeclarations`, `getTool`,
 * `executeTool`). The collision policy under test is the documented one:
 * tools are keyed by declaration name, a host action replaces a built-in
 * of the same name while keeping its position, the most recent
 * registration wins across hosts, and unregistering restores whatever the
 * remaining registrations resolve to.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createCanvasHost, type EngineHandle, type EngineLifecycleEvent } from '../../src/panels/host';
import {
  getHostActions,
  registerHostActions,
  type ToolDefinition,
  type ToolResult,
} from '../../src/panels/tools';
import {
  CANVAS_TOOLS,
  executeTool,
  getFunctionDeclarations,
  getTool,
} from '../../src/canvas/tools/canvasTools';
import type { JsonObject } from '../../src/panels/types';

class FakeEngine implements EngineHandle {
  private ready = true;
  private listeners: Record<EngineLifecycleEvent, Set<() => void>> = {
    ready: new Set(),
    change: new Set(),
  };

  isReady(): boolean {
    return this.ready;
  }

  on(event: EngineLifecycleEvent, listener: () => void): () => void {
    this.listeners[event].add(listener);
    return () => {
      this.listeners[event].delete(listener);
    };
  }

  exportSnapshot(): JsonObject {
    return {};
  }

  importSnapshot(): void {}
}

function hostTool(name: string, result: unknown = `${name} ran`): ToolDefinition {
  return {
    declaration: {
      name,
      description: `Test tool ${name}.`,
      parameters: { type: 'object', properties: {} },
    },
    handler: (): ToolResult => ({ ok: true, result }),
  };
}

const cleanups: (() => void)[] = [];

function track<T extends { dispose(): void }>(host: T): T {
  cleanups.push(() => host.dispose());
  return host;
}

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
  expect(getHostActions()).toEqual([]);
});

describe('registerHostActions', () => {
  it('exposes registered actions and removes them on unregister', () => {
    const actions = [hostTool('host_alpha'), hostTool('host_beta')];
    const unregister = registerHostActions(actions);
    cleanups.push(unregister);

    expect(getHostActions().map((t) => t.declaration.name)).toEqual([
      'host_alpha',
      'host_beta',
    ]);

    unregister();
    expect(getHostActions()).toEqual([]);
  });

  it('tolerates a double unregister', () => {
    const unregister = registerHostActions([hostTool('host_alpha')]);
    unregister();
    unregister();
    expect(getHostActions()).toEqual([]);
  });

  it('keeps registrations in order so later ones win a name-keyed merge', () => {
    const first = registerHostActions([hostTool('shared_name', 'from first')]);
    const second = registerHostActions([hostTool('shared_name', 'from second')]);
    cleanups.push(first, second);

    const names = getHostActions().map((t) => t.declaration.name);
    expect(names).toEqual(['shared_name', 'shared_name']);
    expect(getFunctionDeclarations().filter((d) => d.name === 'shared_name')).toHaveLength(1);
    expect(getTool('shared_name')?.handler({})).toEqual({ ok: true, result: 'from second' });

    second();
    expect(getTool('shared_name')?.handler({})).toEqual({ ok: true, result: 'from first' });
  });
});

describe('createCanvasHost hostActions', () => {
  it('merges host tools into the registry the agent clients read', async () => {
    track(
      createCanvasHost({
        engine: new FakeEngine(),
        hostActions: [hostTool('host_generate_report')],
      }),
    );

    const declarations = getFunctionDeclarations().map((d) => d.name);
    expect(declarations).toContain('host_generate_report');
    expect(declarations).toContain('open_chat');

    await expect(executeTool('host_generate_report', {})).resolves.toEqual({
      ok: true,
      result: 'host_generate_report ran',
    });
  });

  it('lets a host action replace a built-in of the same name, keeping its position', async () => {
    const builtInNames = CANVAS_TOOLS.map((t) => t.declaration.name);
    const before = getFunctionDeclarations().map((d) => d.name);
    expect(before).toEqual(builtInNames);

    track(
      createCanvasHost({
        engine: new FakeEngine(),
        hostActions: [hostTool('open_chat', 'host-owned chat')],
      }),
    );

    const after = getFunctionDeclarations().map((d) => d.name);
    expect(after).toEqual(builtInNames);
    await expect(executeTool('open_chat', {})).resolves.toEqual({
      ok: true,
      result: 'host-owned chat',
    });
  });

  it('removes the host actions on dispose and restores shadowed built-ins', async () => {
    const host = track(
      createCanvasHost({
        engine: new FakeEngine(),
        hostActions: [hostTool('host_only_tool'), hostTool('dismiss_panel', 'host dismiss')],
      }),
    );

    expect(getTool('host_only_tool')).toBeDefined();
    await expect(executeTool('dismiss_panel', { panelId: 'chat' })).resolves.toEqual({
      ok: true,
      result: 'host dismiss',
    });

    host.dispose();

    expect(getTool('host_only_tool')).toBeUndefined();
    await expect(executeTool('host_only_tool', {})).resolves.toEqual({
      ok: false,
      error: 'unknown tool "host_only_tool"',
    });
    const builtIn = getTool('dismiss_panel');
    expect(builtIn).toBe(CANVAS_TOOLS.find((t) => t.declaration.name === 'dismiss_panel'));
  });

  it('registers nothing for a host without hostActions', () => {
    track(createCanvasHost({ engine: new FakeEngine() }));
    expect(getHostActions()).toEqual([]);
  });

  it('keeps a second host\'s actions when the first is disposed', () => {
    const first = track(
      createCanvasHost({
        engine: new FakeEngine(),
        hostActions: [hostTool('host_first')],
      }),
    );
    const second = track(
      createCanvasHost({
        engine: new FakeEngine(),
        hostActions: [hostTool('host_second')],
      }),
    );

    first.dispose();

    const names = getFunctionDeclarations().map((d) => d.name);
    expect(names).not.toContain('host_first');
    expect(names).toContain('host_second');
    expect(second).toBeDefined();
  });
});
