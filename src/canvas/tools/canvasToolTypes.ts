/**
 * Shared canvas tool types — extracted to avoid circular imports between
 * canvasTools and tenant-specific tool modules.
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
