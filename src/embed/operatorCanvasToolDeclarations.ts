/**
 * Lightweight tool declarations for the operator embed bundle (no tldraw imports).
 */
import type { ToolDeclaration } from '../panels/tools';
import { getOperatorMode } from '../agents/surface/operatorModeBridge';
import { getAllowedToolsForOperatorMode } from '../agents/surface/operatorModeScope';

const OPERATOR_TOOL_DECLARATIONS: Readonly<Record<string, ToolDeclaration>> = {
  read_canvas: {
    name: 'read_canvas',
    description: 'Read structured shapes from the canvas viewport.',
    parameters: { type: 'object', properties: {} },
  },
  draw_shapes: {
    name: 'draw_shapes',
    description: 'Create canvas shapes or diagrams on the whiteboard.',
    parameters: { type: 'object', properties: {} },
  },
  open_panel: {
    name: 'open_panel',
    description: 'Open a panel on the canvas.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Panel id' } },
      required: ['id'],
    },
  },
  compose_panel: {
    name: 'compose_panel',
    description: 'Compose structured content into an open panel.',
    parameters: { type: 'object', properties: {} },
  },
  clear_agent_drawings: {
    name: 'clear_agent_drawings',
    description: 'Clear agent-stamped drawings from the canvas.',
    parameters: { type: 'object', properties: {} },
  },
};

export function getOperatorEmbedFunctionDeclarations(): ToolDeclaration[] {
  const allowed = new Set(getAllowedToolsForOperatorMode(getOperatorMode()));
  return Object.values(OPERATOR_TOOL_DECLARATIONS).filter((declaration) =>
    allowed.has(declaration.name));
}

export type { ToolDeclaration };
