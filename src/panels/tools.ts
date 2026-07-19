/**
 * Tool contract types and the host-action seam of the tool registry.
 *
 * The framework ships generic canvas tools; hosts contribute their own
 * through `createCanvasHost({ hostActions })`, which registers them here
 * for the host's lifetime. The runtime registry that executes tools lives
 * canvas-side (it drives panel shapes through the engine); this module
 * stays engine-free so the hostActions option and its types respect the
 * panels import boundary.
 *
 * Collision policy: tools are keyed by declaration name. A host action
 * sharing a built-in tool's name replaces that tool for as long as the
 * registration lives, so hosts can specialize framework behavior without
 * forking it. Across registrations the most recent wins. Disposing the
 * host removes its actions and any shadowed built-in reappears.
 */

/**
 * JSON-schema-style declaration in the shape Gemini function calling
 * expects (a subset of OpenAPI 3.0). `parameters.type` stays `'object'`;
 * Gemini Live rejects top-level schemas of any other type.
 */
export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameterSchema>;
    required?: string[];
  };
}

export interface ToolParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: readonly string[];
  items?: ToolParameterSchema;
}

export type ToolResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string };

export type ToolHandler = (args: Record<string, unknown>) => ToolResult | Promise<ToolResult>;

export interface ToolDefinition {
  declaration: ToolDeclaration;
  handler: ToolHandler;
}

const registrations: (readonly ToolDefinition[])[] = [];

/**
 * Register host-supplied tools. Returns the matching unregister function;
 * `createCanvasHost` calls it from `dispose`, so a host's actions never
 * outlive the host that contributed them.
 */
export function registerHostActions(actions: readonly ToolDefinition[]): () => void {
  const registration = Object.freeze([...actions]);
  registrations.push(registration);
  return () => {
    const index = registrations.indexOf(registration);
    if (index >= 0) {
      registrations.splice(index, 1);
    }
  };
}

/**
 * Live host actions in registration order, later registrations last so a
 * name-keyed merge lets the most recent registration win.
 */
export function getHostActions(): readonly ToolDefinition[] {
  return registrations.flat();
}
