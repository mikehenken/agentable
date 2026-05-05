/**
 * canvasTools — shared tool registry for voice + chat agents.
 *
 * Architecture:
 *  - One source of truth for "things an agent can do on the canvas."
 *  - Each tool has a JSON-schema declaration (consumed by Gemini Live and
 *    Gemini text function-calling) AND a runtime handler that mutates the
 *    canvas state (panels, selection, filters, artifacts).
 *  - Handlers operate on `useLayoutStore.getState()` (imperative) so they
 *    work outside React render cycles (Gemini Live message handler runs in
 *    a WebSocket callback, not a React effect).
 *  - Cross-panel intents (e.g. "open positions panel filtered to IT") flow
 *    via a small zustand `panelIntentStore` so panels can subscribe without
 *    coupling to voice/chat.
 *  - Window CustomEvent dispatch is exposed too for non-React consumers
 *    (Lit components, embedded scripts).
 *
 * Why not CopilotKit:
 *  - We want one tool surface that works in BOTH the voice model (Gemini
 *    Live, has its own function-calling protocol) and a chat model running
 *    against Gemini text. CopilotKit's `useFrontendTool` only registers
 *    tools with its own runtime; the voice path bypasses it entirely.
 *  - When the platform wants to bridge to CopilotKit later, this registry
 *    becomes the input to a CopilotKit adapter. Keep the data shape
 *    library-agnostic.
 */
import { useLayoutStore } from '../../stores/layoutStore';
import { usePanelIntentStore } from '../../stores/panelIntentStore';
import type { PanelId } from '../../types';
import {
  closePanelInCanvas,
  getEditor as getWhiteboardEditor,
  openPanelInCanvas,
} from '../../whiteboard/shapes/panelShapeApi';

/**
 * JSON-schema-style declaration. Matches the shape Gemini Live expects in
 * `config.tools[].functionDeclarations[]` (a subset of OpenAPI 3.0).
 *
 * Keep `parameters.type` as `'object'` — Gemini Live rejects top-level
 * schemas of any other type.
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

/**
 * Result of a tool execution. Strings are returned directly to the agent
 * as `functionResponse.response.result`. Errors are surfaced as
 * `{ error: string }` so the agent can recover ("I tried that but…")
 * instead of silently dropping the call.
 */
export type ToolResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string };

export type ToolHandler = (args: Record<string, unknown>) => ToolResult | Promise<ToolResult>;

export interface ToolDefinition {
  declaration: ToolDeclaration;
  handler: ToolHandler;
}

const KNOWN_PANELS: readonly PanelId[] = [
  'nav', 'chat', 'artifacts',
  'open-positions', 'applications', 'resources',
  'career-tools', 'growth-paths', 'career-trajectories',
  'voice', 'journey', 'settings',
];

/**
 * Show a panel on whichever substrate is currently mounted.
 *
 * The prototype runs two canvas substrates in parallel routes:
 *  • `/career-canvas`            → legacy absolute-positioned canvas
 *  • `/career-canvas-whiteboard` → tldraw whiteboard
 *
 * They share the AI/data layer (this file), the panelIntentStore, the
 * voiceKernel, etc. — but disagree on layout. Since only one is mounted
 * per tab, we always update `useLayoutStore` (cheap, in-memory zustand
 * write — no-op cost when no panels are listening) AND additionally call
 * `openPanelInCanvas` if a whiteboard editor is bound.
 *
 * `panelProps` is the shape-scoped payload forwarded into the whiteboard
 * panel component. Cross-cut intents (selectedJobId, search, department)
 * still flow through `panelIntentStore` so both substrates see them; the
 * `panelProps` is for shape-local data (e.g. a friendly title to render
 * in the chrome).
 */
function showPanel(
  id: PanelId,
  source: string,
  panelProps?: Record<string, unknown>,
): ToolResult {
  if (!KNOWN_PANELS.includes(id)) {
    return { ok: false, error: `unknown panel id "${id}"` };
  }
  useLayoutStore.getState().showPanel(id);
  // Forward to the whiteboard ONLY if its editor is bound — never queue,
  // because the legacy canvas's tool calls shouldn't pile up in the
  // whiteboard's pending queue. The voice path's pre-mount race is
  // handled by `openPanelInCanvas` itself when called directly from voice
  // bootstrap, not via this funnel.
  if (getWhiteboardEditor()) {
    openPanelInCanvas(id, { panelProps, focus: true });
  }
  return {
    ok: true,
    result: `Opened ${id} panel${source ? ` (via ${source})` : ''}.`,
  };
}

function hidePanel(id: PanelId): ToolResult {
  if (!KNOWN_PANELS.includes(id)) {
    return { ok: false, error: `unknown panel id "${id}"` };
  }
  useLayoutStore.getState().hidePanel(id);
  if (getWhiteboardEditor()) {
    closePanelInCanvas(id);
  }
  return { ok: true, result: `Closed ${id} panel.` };
}

/**
 * Tool definitions. The list and order are stable — the voice model is
 * told about every tool at session start, and adding/removing from the
 * middle of the array would invalidate any cached function-call ids.
 *
 * Adding a new tool: append to the array. Don't reshuffle.
 */
export const CANVAS_TOOLS: readonly ToolDefinition[] = [
  {
    declaration: {
      name: 'open_positions',
      description:
        'Open the Open Positions panel on the canvas so the candidate can see current career openings while you talk. Use when discussing roles, departments, or specific properties. The panel is forgiving about synonyms — you can pass natural terms like "engineering" or "IT" or "tech" and the panel will route to the right department.',
      parameters: {
        type: 'object',
        properties: {
          department: {
            type: 'string',
            description:
              'Optional department filter. Canonical values match the example data ("Engineering", "Design", "Customer Success", "People & Learning"). Common synonyms accepted (Eng→Engineering, CX→Customer Success, L&D→People & Learning, etc.). Omit to show everything.',
          },
          search: {
            type: 'string',
            description:
              'Optional free-text search across title, department, team, location, property, and skills (e.g. "Austin", "Senior Software", "engineering", "remote").',
          },
        },
      },
    },
    handler: ({ department, search }) => {
      usePanelIntentStore.getState().setOpenPositionsIntent({
        department: typeof department === 'string' ? department : undefined,
        search: typeof search === 'string' ? search : undefined,
        selectedJobId: null,
      });
      return showPanel('open-positions', 'tool');
    },
  },
  {
    declaration: {
      name: 'show_job_detail',
      description:
        "Open a specific job's detail view in the Open Positions panel. Use after referencing a particular role by name in conversation.",
      parameters: {
        type: 'object',
        properties: {
          jobId: {
            type: 'number',
            description: 'Numeric id of the job (e.g. 1 for Engineering Manager, 2 for Senior Software Engineer).',
          },
          jobTitle: {
            type: 'string',
            description: 'Optional title to disambiguate when jobId is unknown — partial match supported.',
          },
        },
      },
    },
    handler: ({ jobId, jobTitle }) => {
      usePanelIntentStore.getState().setOpenPositionsIntent({
        selectedJobId: typeof jobId === 'number' ? jobId : null,
        selectedJobTitle: typeof jobTitle === 'string' ? jobTitle : undefined,
      });
      return showPanel('open-positions', 'tool');
    },
  },
  {
    declaration: {
      name: 'open_learning',
      description:
        "Open the company learning view — the Resources panel filtered to learning content. Use when the candidate asks about training, certifications, or career growth.",
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Optional search term (e.g. "leadership", "onboarding").',
          },
        },
      },
    },
    handler: ({ search }) => {
      usePanelIntentStore.getState().setResourcesIntent({
        search: typeof search === 'string' ? search : 'learning',
      });
      return showPanel('resources', 'tool');
    },
  },
  {
    declaration: {
      name: 'open_growth_paths',
      description:
        "Open the Growth Paths panel showing career trajectory examples. Use when the candidate asks 'where could this role lead?' or wants to see example career trajectories.",
      parameters: {
        type: 'object',
        properties: {
          fromRole: {
            type: 'string',
            description: 'Optional starting role to highlight (e.g. "Engineer I", "Customer Success Specialist").',
          },
        },
      },
    },
    handler: ({ fromRole }) => {
      usePanelIntentStore.getState().setGrowthPathsIntent({
        fromRole: typeof fromRole === 'string' ? fromRole : undefined,
      });
      return showPanel('growth-paths', 'tool');
    },
  },
  {
    declaration: {
      name: 'open_resources',
      description:
        'Open the Resources panel — guides, videos, benefits, handbooks. General-purpose; use open_learning specifically for learning/training content.',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Optional search term to filter resources.',
          },
        },
      },
    },
    handler: ({ search }) => {
      usePanelIntentStore.getState().setResourcesIntent({
        search: typeof search === 'string' ? search : undefined,
      });
      return showPanel('resources', 'tool');
    },
  },
  {
    declaration: {
      name: 'open_career_tools',
      description:
        'Open the Career Tools panel (resume builder, interview prep, etc).',
      parameters: { type: 'object', properties: {} },
    },
    handler: () => showPanel('career-tools', 'tool'),
  },
  {
    declaration: {
      name: 'open_applications',
      description:
        "Open the candidate's My Applications panel showing roles they've already applied to.",
      parameters: { type: 'object', properties: {} },
    },
    handler: () => showPanel('applications', 'tool'),
  },
  {
    declaration: {
      name: 'open_journey',
      description:
        "Open the Journey panel showing the candidate's progress / timeline on the canvas.",
      parameters: { type: 'object', properties: {} },
    },
    handler: () => showPanel('journey', 'tool'),
  },
  {
    declaration: {
      name: 'open_chat',
      description:
        'Open the chat panel and focus the input. Use when handing off from voice to text.',
      parameters: { type: 'object', properties: {} },
    },
    handler: () => {
      const result = showPanel('chat', 'tool');
      window.dispatchEvent(new CustomEvent('landi:focus-chat-input'));
      return result;
    },
  },
  {
    declaration: {
      name: 'dismiss_panel',
      description: 'Close a panel by id.',
      parameters: {
        type: 'object',
        properties: {
          panelId: {
            type: 'string',
            description:
              'Panel id to close. Valid values: open-positions, applications, resources, career-tools, growth-paths, career-trajectories, journey, artifacts, chat, voice, settings.',
          },
        },
        required: ['panelId'],
      },
    },
    handler: ({ panelId }) => {
      if (typeof panelId !== 'string') {
        return { ok: false, error: 'panelId must be a string' };
      }
      return hidePanel(panelId as PanelId);
    },
  },
  {
    declaration: {
      name: 'save_job',
      description: 'Bookmark / save a job for the candidate. Job must be open in the Positions panel first.',
      parameters: {
        type: 'object',
        properties: {
          jobId: { type: 'number', description: 'Numeric job id to save.' },
        },
        required: ['jobId'],
      },
    },
    handler: ({ jobId }) => {
      if (typeof jobId !== 'number') {
        return { ok: false, error: 'jobId must be a number' };
      }
      usePanelIntentStore.getState().toggleSavedJob(jobId);
      return { ok: true, result: `Saved job ${jobId}.` };
    },
  },
  {
    declaration: {
      name: 'share_artifact',
      description:
        'Add a generated artifact (resume snippet, summary, plan) to the Artifacts panel for the candidate to review later.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Short label for the artifact.' },
          content: { type: 'string', description: 'The artifact body — markdown or plain text.' },
          kind: {
            type: 'string',
            description: 'Optional artifact type label (e.g. "summary", "resume", "plan").',
          },
        },
        required: ['name', 'content'],
      },
    },
    handler: ({ name, content, kind }) => {
      if (typeof name !== 'string' || typeof content !== 'string') {
        return { ok: false, error: 'name and content must be strings' };
      }
      usePanelIntentStore.getState().pushArtifact({
        id: `art-${Date.now().toString(36)}`,
        name,
        content,
        kind: typeof kind === 'string' ? kind : 'note',
        createdAt: new Date().toISOString(),
      });
      useLayoutStore.getState().showPanel('artifacts');
      return { ok: true, result: `Added "${name}" to artifacts.` };
    },
  },
  {
    declaration: {
      name: 'knowledge_search',
      description:
        'Search the tenant knowledge base (vetted internal docs, brand voice, policy text). Returns grounding chunks you can cite by name. Use for facts you are not certain about.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Free-text query, 4-200 chars.' },
          topK: { type: 'number', description: 'How many chunks to return (1-10). Default 6.' },
        },
        required: ['query'],
      },
    },
    handler: async ({ query, topK }) => {
      if (typeof query !== 'string' || query.trim().length < 3) {
        return { ok: false, error: 'query must be a string of at least 3 chars' };
      }
      const k = Math.min(10, Math.max(1, typeof topK === 'number' ? topK : 6));
      const endpoint = (import.meta.env.VITE_KNOWLEDGE_SEARCH_URL as string | undefined)?.trim();
      if (!endpoint) {
        return {
          ok: false,
          error:
            'knowledge_search not configured (set VITE_KNOWLEDGE_SEARCH_URL). Answer from system-prompt facts only.',
        };
      }
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ q: query.trim(), topK: k }),
        });
        if (!response.ok) {
          return { ok: false, error: `knowledge_search HTTP ${response.status}` };
        }
        const data = await response.json();
        return { ok: true, result: data };
      } catch (err) {
        return { ok: false, error: `knowledge_search failed: ${(err as Error).message}` };
      }
    },
  },
] as const;

/**
 * Lookup helper. Tools are flat (no namespaces yet) so the registry is
 * keyed on `declaration.name` directly.
 */
export function getTool(name: string): ToolDefinition | undefined {
  return CANVAS_TOOLS.find((t) => t.declaration.name === name);
}

/**
 * Execute a tool by name. Surfaces unknown-tool as a structured error so
 * the agent gets a textual failure (and can apologise / retry) instead of
 * a silent drop.
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const tool = getTool(name);
  if (!tool) {
    return { ok: false, error: `unknown tool "${name}"` };
  }
  try {
    return await tool.handler(args ?? {});
  } catch (err) {
    return { ok: false, error: `${name} threw: ${(err as Error).message}` };
  }
}

/**
 * Function-declaration array suitable for Gemini Live `config.tools[0].functionDeclarations`
 * AND Gemini text `tools[0].functionDeclarations`.
 */
export function getFunctionDeclarations(): ToolDeclaration[] {
  return CANVAS_TOOLS.map((t) => t.declaration);
}
