import type { Editor, TLUiOverrides } from 'tldraw';
import { autoArrangeWhiteboardPanels } from './layout/autoArrangeWhiteboardPanels';
import { resetWhiteboardLayout } from './layout/resetWhiteboardLayout';
import {
  AUTO_ARRANGE_TOOL_ID,
  emitWhiteboardAutoArrange,
  emitWhiteboardResetCanvas,
  RESET_CANVAS_TOOL_ID,
} from './tools/layoutActionEvents';
import {
  allowedTldrawToolIds,
  resolveWhiteboardToolbarConfig,
  type ResolvedWhiteboardToolbarConfig,
} from './toolbar/toolbarConfig';
import { resolveWhiteboardToolbarIconId } from './voice/whiteboardToolbarIcons';

/**
 * Build tldraw UI overrides from a resolved toolbar config:
 * prune disallowed tools, register layout action tools + labels.
 */
export function createMinimalWhiteboardTldrawOverrides(
  resolved: ResolvedWhiteboardToolbarConfig): TLUiOverrides {
  const allowed = allowedTldrawToolIds(resolved);

  return {
    tools(editor: Editor, tools) {
      for (const id of Object.keys(tools)) {
        if (!allowed.has(id)) {
          delete tools[id];
        }
      }

      if (resolved.showAutoArrangeToolbar) {
        tools[AUTO_ARRANGE_TOOL_ID] = {
          id: AUTO_ARRANGE_TOOL_ID,
          icon: 'horizontal-align-middle',
          label: 'tools.auto-arrange',
          onSelect: () => {
            try {
              autoArrangeWhiteboardPanels(editor);
            } catch (err) {
              console.error('[auto-arrange override] failed', err);
            }
            emitWhiteboardAutoArrange();
            if (editor.getCurrentToolId() === AUTO_ARRANGE_TOOL_ID) {
              editor.setCurrentTool('select');
            }
          },
        };
      }

      if (resolved.showResetToolbar) {
        tools[RESET_CANVAS_TOOL_ID] = {
          id: RESET_CANVAS_TOOL_ID,
          icon: 'arrow-cycle',
          label: 'tools.reset',
          onSelect: () => {
            try {
              resetWhiteboardLayout(editor, {
                openChat: true,
                resetCamera: true,
              });
            } catch (err) {
              console.error('[reset override] failed', err);
            }
            emitWhiteboardResetCanvas();
            if (editor.getCurrentToolId() === RESET_CANVAS_TOOL_ID) {
              editor.setCurrentTool('select');
            }
          },
        };
      }

      for (const action of resolved.customActions) {
        const placement = action.placement ?? 'toolbar';
        if (placement !== 'toolbar' && placement !== 'both') continue;
        if (tools[action.id]) continue;
        tools[action.id] = {
          id: action.id,
          icon: resolveWhiteboardToolbarIconId(action.icon),
          label: `tools.${action.id}`,
          onSelect: () => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent(`landi-whiteboard-custom-action:${action.id}`, {
                  detail: { id: action.id },
                  bubbles: true,
                  composed: true,
                }));
            }
            editor.setCurrentTool('select');
          },
        };
      }

      return tools;
    },
    translations: {
      en: {
        'tools.auto-arrange': 'Auto-arrange',
        'tools.reset': 'Reset',...Object.fromEntries(
          resolved.customActions.map((action) => [
            `tools.${action.id}`,
            action.label ?? action.id,
          ])),
      },
    },
  };
}

/**
 * @deprecated Prefer `createMinimalWhiteboardTldrawOverrides(resolveWhiteboardToolbarConfig)`.
 * Static career default tool ids kept for backward-compat imports tests.
 */
export const WHITEBOARD_TOOLBAR_TOOL_IDS = resolveWhiteboardToolbarConfig().toolbarTools;

/**
 * @deprecated Prefer `createMinimalWhiteboardTldrawOverrides(resolveWhiteboardToolbarConfig)`.
 */
export const minimalWhiteboardTldrawOverrides: TLUiOverrides =
  createMinimalWhiteboardTldrawOverrides(resolveWhiteboardToolbarConfig());
