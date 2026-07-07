/**
 * Landi Canvas Studio tenant tools — host-bridge pattern.
 *
 * API calls run in the host app (landi-canvas-studio) via CustomEvents so
 * this package stays free of landing-editor imports. Tools block on a
 * host response event with a matching requestId.
 */
import { useCanvasFileStore } from '../../stores/canvasFileStore';
import { getEditor as getWhiteboardEditor, openPanelInCanvas } from '../../whiteboard/shapes/panelShapeApi';
import type { ToolDefinition, ToolResult } from './canvasToolTypes';

export const CANVAS_ACTION_EVENT = 'landi-canvas-action';
export const CANVAS_ACTION_RESPONSE_EVENT = 'landi-canvas-action-response';
export const CANVAS_OPEN_FILE_MANAGER_EVENT = 'landi-canvas-open-file-manager';

const FILE_MANAGER_PANEL_ID = 'file-manager';
const HOST_ACTION_TIMEOUT_MS = 45_000;

interface HostActionDetail {
  requestId: string;
  action: string;
  args: Record<string, unknown>;
}

interface HostActionResponseDetail {
  requestId: string;
  result: ToolResult;
}

function dispatchHostAction(action: string, args: Record<string, unknown>): Promise<ToolResult> {
  return new Promise((resolve) => {
    const requestId = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener(CANVAS_ACTION_RESPONSE_EVENT, handler);
      resolve({ ok: false, error: `host action "${action}" timed out` });
    }, HOST_ACTION_TIMEOUT_MS);

    const handler = (event: Event): void => {
      const detail = (event as CustomEvent<HostActionResponseDetail>).detail;
      if (!detail || detail.requestId !== requestId) return;
      window.clearTimeout(timeout);
      window.removeEventListener(CANVAS_ACTION_RESPONSE_EVENT, handler);
      resolve(detail.result);
    };

    window.addEventListener(CANVAS_ACTION_RESPONSE_EVENT, handler);
    window.dispatchEvent(
      new CustomEvent<HostActionDetail>(CANVAS_ACTION_EVENT, {
        detail: { requestId, action, args },
        bubbles: true,
        composed: true,
      }),
    );
  });
}

function openFileManagerPanel(): ToolResult {
  if (getWhiteboardEditor()) {
    openPanelInCanvas(FILE_MANAGER_PANEL_ID, { focus: true });
  }
  window.dispatchEvent(
    new CustomEvent(CANVAS_OPEN_FILE_MANAGER_EVENT, { bubbles: true, composed: true }),
  );
  return { ok: true, result: 'Opened file manager panel.' };
}

/** Tools registered only for the landi-canvas-studio tenant allowlist. */
export const LANDI_CANVAS_TOOLS: readonly ToolDefinition[] = [
  {
    declaration: {
      name: 'generate_site_image',
      description:
        'Generate an AI image for the active site, store it in site assets, and return the public URL. Use when the user asks for hero images, product shots, or branded visuals.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Image generation prompt (4-500 chars).' },
          useContext: {
            type: 'boolean',
            description: 'When true, enrich the prompt with site business context. Default true.',
          },
        },
        required: ['prompt'],
      },
    },
    handler: async ({ prompt, useContext }) => {
      if (typeof prompt !== 'string' || prompt.trim().length < 4) {
        return { ok: false, error: 'prompt must be at least 4 characters' };
      }
      const result = await dispatchHostAction('generate_site_image', {
        prompt: prompt.trim(),
        useContext: useContext !== false,
      });
      if (result.ok && result.result && typeof result.result === 'object') {
        const payload = result.result as { path?: string; name?: string; url?: string };
        if (payload.path && payload.name) {
          useCanvasFileStore.getState().upsertFile({
            path: payload.path,
            kind: 'asset',
            name: payload.name,
            url: typeof payload.url === 'string' ? payload.url : undefined,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      return result;
    },
  },
  {
    declaration: {
      name: 'list_site_files',
      description:
        'List virtual site files (pages + stored assets) for the active site. Refreshes the file manager.',
      parameters: { type: 'object', properties: {} },
    },
    handler: async () => {
      const result = await dispatchHostAction('list_site_files', {});
      if (result.ok && Array.isArray(result.result)) {
        useCanvasFileStore.getState().setFiles(result.result as never);
      }
      return result;
    },
  },
  {
    declaration: {
      name: 'read_site_file',
      description: 'Read a site virtual file by path (e.g. index.html or assets/hero.png metadata).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Virtual path returned by list_site_files.' },
        },
        required: ['path'],
      },
    },
    handler: async ({ path }) => {
      if (typeof path !== 'string' || !path.trim()) {
        return { ok: false, error: 'path is required' };
      }
      return dispatchHostAction('read_site_file', { path: path.trim() });
    },
  },
  {
    declaration: {
      name: 'write_site_file',
      description:
        'Apply an edit instruction to a site page via the virtual FS executor (find/replace loop).',
      parameters: {
        type: 'object',
        properties: {
          instruction: { type: 'string', description: 'Natural-language edit instruction.' },
          page: {
            type: 'string',
            description: 'Target page path. Default index.html.',
          },
        },
        required: ['instruction'],
      },
    },
    handler: async ({ instruction, page }) => {
      if (typeof instruction !== 'string' || instruction.trim().length < 3) {
        return { ok: false, error: 'instruction must be at least 3 characters' };
      }
      return dispatchHostAction('write_site_file', {
        instruction: instruction.trim(),
        page: typeof page === 'string' ? page : 'index.html',
      });
    },
  },
  {
    declaration: {
      name: 'open_file_manager',
      description: 'Open the file manager panel on the canvas to browse site pages and assets.',
      parameters: { type: 'object', properties: {} },
    },
    handler: () => openFileManagerPanel(),
  },
] as const;

export const LANDI_CANVAS_TOOL_ALLOWLIST: readonly string[] = [
  'open_chat',
  'dismiss_panel',
  'share_artifact',
  'knowledge_search',
  'generate_site_image',
  'list_site_files',
  'read_site_file',
  'write_site_file',
  'open_file_manager',
];
