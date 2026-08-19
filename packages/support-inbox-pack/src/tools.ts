import type { ToolDefinition, ToolResult } from '../../../src/panels/tools';
import {
  SUPPORT_INBOX_PANEL_IDS,
  SUPPORT_INBOX_TOOL_NAMES,
  type SupportInboxPanelId,
  type SupportInboxToolName,
} from './constants';

/** Runtime seam for generated support tools (legacy canvas + createCanvasHost). */
export interface SupportInboxToolRuntime {
  openPanel: (panelId: SupportInboxPanelId | string) => ToolResult;
  setInboxIntent?: (intent: { status?: string; search?: string; priority?: string }) => void;
  setTicketDetailIntent?: (intent: { ticketId?: string }) => void;
  setMacrosIntent?: (intent: { category?: string; search?: string }) => void;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value: undefined;
}

function openPanelTool(
  runtime: SupportInboxToolRuntime,
  panelId: SupportInboxPanelId): ToolResult {
  if (!SUPPORT_INBOX_PANEL_IDS.includes(panelId)) {
    return { ok: false, error: `unknown support panel "${panelId}"` };
  }
  return runtime.openPanel(panelId);
}

/** Generated support domain tools derived from pack panel metadata. */
export function createSupportInboxTools(
  runtime: SupportInboxToolRuntime): readonly ToolDefinition[] {
  const handlers: Record<SupportInboxToolName, (args: Record<string, unknown>) => ToolResult> = {
    open_inbox: (args) => {
      runtime.setInboxIntent?.({
        status: readString(args.status),
        search: readString(args.search),
        priority: readString(args.priority),
      });
      return openPanelTool(runtime, 'inbox');
    },
    show_ticket: (args) => {
      runtime.setTicketDetailIntent?.({
        ticketId: readString(args.ticketId),
      });
      return openPanelTool(runtime, 'ticket-detail');
    },
    open_macros: (args) => {
      runtime.setMacrosIntent?.({
        category: readString(args.category),
        search: readString(args.search),
      });
      return openPanelTool(runtime, 'macros');
    },
    search_tickets: (args) => {
      runtime.setInboxIntent?.({
        status: readString(args.status),
        search: readString(args.search) ?? readString(args.q),
        priority: readString(args.priority),
      });
      return openPanelTool(runtime, 'inbox');
    },
  };

  return SUPPORT_INBOX_TOOL_NAMES.map((name) => ({
    declaration: supportInboxToolDeclaration(name),
    handler: handlers[name],
  }));
}

/** Tool declarations only — useful for grounding tests and voice session bootstrap. */
export function supportInboxToolDeclarations(): readonly ToolDefinition['declaration'][] {
  return SUPPORT_INBOX_TOOL_NAMES.map((name) => supportInboxToolDeclaration(name));
}

function supportInboxToolDeclaration(name: SupportInboxToolName): ToolDefinition['declaration'] {
  switch (name) {
    case 'open_inbox':
      return {
        name,
        description:
          'Open the support inbox so the agent can triage tickets. Accepts optional status and priority filters.',
        parameters: {
          type: 'object',
          properties: {
            status: { type: 'string', description: 'Optional status filter: open, pending, or resolved.' },
            priority: { type: 'string', description: 'Optional priority filter: low, normal, high, or urgent.' },
            search: { type: 'string', description: 'Optional search across subject, customer, and preview text.' },
          },
        },
      };
    case 'show_ticket':
      return {
        name,
        description: 'Open the ticket detail panel for a specific conversation thread.',
        parameters: {
          type: 'object',
          properties: {
            ticketId: { type: 'string', description: 'Ticket id from the inbox list.' },
          },
          required: ['ticketId'],
        },
      };
    case 'open_macros':
      return {
        name,
        description: 'Open canned responses and quick-reply templates.',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Optional macro category filter.' },
            search: { type: 'string', description: 'Optional search across macro titles and bodies.' },
          },
        },
      };
    case 'search_tickets':
      return {
        name,
        description: 'Search the inbox and open matching tickets.',
        parameters: {
          type: 'object',
          properties: {
            search: { type: 'string', description: 'Free-text search term.' },
            q: { type: 'string', description: 'Alias for search.' },
            status: { type: 'string', description: 'Optional status filter.' },
            priority: { type: 'string', description: 'Optional priority filter.' },
          },
        },
      };
    default: {
      const exhaustive: never = name;
      throw new Error(`Unhandled support tool: ${String(exhaustive)}`);
    }
  }
}
