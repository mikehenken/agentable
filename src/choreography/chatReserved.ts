import type { LayoutRect } from '../layout/panelLayoutEngine';
import { CHAT_PANEL_ID } from './constants';

/** Legacy layoutStore helper — chat rect for overlap checks. */
export function chatPanelLayoutObstacle(
  panels: Record<
    string,
    {
      visible?: boolean;
      x?: number;
      y?: number;
      w?: number;
      h?: number;
      minimized?: boolean;
    }
  >): LayoutRect | null {
  const chat = panels[CHAT_PANEL_ID];
  if (!chat?.visible) return null;
  const minimized = chat.minimized ?? false;
  return {
    x: chat.x ?? 0,
    y: chat.y ?? 0,
    w: chat.w ?? 400,
    h: minimized ? 44 : (chat.h ?? 400),
  };
}
