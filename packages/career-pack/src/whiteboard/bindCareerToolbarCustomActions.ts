/**
 * Wire career toolbar customActions (phase B) to panel opens + screenshot.
 * Listens for events emitted by `createMinimalWhiteboardTldrawOverrides`.
 *
 * Panel opens route through `emitWhiteboardOpenPanel` so career-pack does not
 * call `panelShapeApi` directly (Vite workspace aliases can duplicate that
 * module, leaving editorRef unbound in the pack copy).
 */
import {
  emitWhiteboardOpenPanel,
  emitWhiteboardScreenshotCanvas,
} from '../../../../src/engines/tldraw/tools/whiteboardToolbarPanelEvents';

const CAREER_CUSTOM_ACTION_PREFIX = 'landi-whiteboard-custom-action:';

type CareerToolbarActionId = 'attach' | 'recent-activity' | 'screenshot' | 'dock-menu';

function isCareerToolbarActionId(value: string): value is CareerToolbarActionId {
  return (
    value === 'attach' ||
    value === 'recent-activity' ||
    value === 'screenshot' ||
    value === 'dock-menu'
  );
}

function openCareerPanel(panelId: string): void {
  emitWhiteboardOpenPanel(panelId, {
    focus: true,
    preserveZoom: true,
    reposition: true,
  });
}

function handleCareerToolbarAction(actionId: CareerToolbarActionId): void {
  switch (actionId) {
    case 'attach':
      openCareerPanel('resume-docs');
      break;
    case 'recent-activity':
      openCareerPanel('recent-activity');
      break;
    case 'screenshot':
      emitWhiteboardScreenshotCanvas();
      break;
    case 'dock-menu':
      openCareerPanel('journey');
      break;
    default: {
      const exhaustive: never = actionId;
      throw new Error(`Unhandled career toolbar action: ${String(exhaustive)}`);
    }
  }
}

/** Subscribe to career toolbar custom action events; returns dispose. */
export function bindCareerToolbarCustomActions(): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = (event: Event): void => {
    const custom = event as CustomEvent<{ id?: string }>;
    const actionId = custom.detail?.id;
    if (typeof actionId !== 'string' || !isCareerToolbarActionId(actionId)) {
      return;
    }
    handleCareerToolbarAction(actionId);
  };

  const actionIds: CareerToolbarActionId[] = [
    'attach',
    'recent-activity',
    'screenshot',
    'dock-menu',
  ];

  for (const id of actionIds) {
    window.addEventListener(`${CAREER_CUSTOM_ACTION_PREFIX}${id}`, handler);
  }

  return () => {
    for (const id of actionIds) {
      window.removeEventListener(`${CAREER_CUSTOM_ACTION_PREFIX}${id}`, handler);
    }
  };
}
