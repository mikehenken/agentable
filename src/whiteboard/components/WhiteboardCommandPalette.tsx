/**
 * WhiteboardCommandPalette — Cmd/Ctrl+P command surface for the whiteboard.
 */
import { useCallback, useState, type ReactElement } from 'react';
import { CommandPalette, type CommandItem } from '../components/general/command-palette';
import { useKeybindings } from '../components/general/use-keybindings';
import {
  closePanelInCanvas,
  focusPanelInCanvas,
  openPanelInCanvas,
} from '../shapes/panelShapeApi';
import type { WhiteboardLayoutMode } from '../WhiteboardShell';

export interface WhiteboardCommandPaletteProps {
  layout: WhiteboardLayoutMode;
}

export function WhiteboardCommandPalette({
  layout,
}: WhiteboardCommandPaletteProps): ReactElement {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const commands: CommandItem[] = [
    {
      id: 'focus-chat',
      label: 'Focus chat panel',
      group: 'Panels',
      keys: 'mod+shift+c',
      run: () => {
        openPanelInCanvas('chat', { focus: true, panelProps: { __title: 'Chat' } });
        close();
      },
      available: () => layout === 'infinite-panels',
    },
    {
      id: 'close-chat',
      label: 'Close chat panel',
      group: 'Panels',
      run: () => {
        closePanelInCanvas('chat');
        close();
      },
      available: () => layout === 'infinite-panels',
    },
    {
      id: 'focus-open-positions',
      label: 'Open positions panel',
      group: 'Panels',
      run: () => {
        openPanelInCanvas('open-positions', { focus: true });
        close();
      },
    },
    {
      id: 'focus-resources',
      label: 'Resources panel',
      group: 'Panels',
      run: () => {
        openPanelInCanvas('resources', { focus: true });
        close();
      },
    },
    {
      id: 'palette',
      label: 'Command palette',
      group: 'General',
      keys: 'mod+p',
      run: () => setOpen(true),
    },
  ];

  useKeybindings([
    {
      keys: 'mod+p',
      label: 'Command palette',
      handler: () => setOpen((prev) => !prev),
    },
    {
      keys: 'mod+shift+c',
      label: 'Focus chat',
      handler: () => {
        if (layout !== 'infinite-panels') return;
        focusPanelInCanvas('chat');
      },
    },
  ]);

  return (
    <CommandPalette
      open={open}
      onClose={close}
      commands={commands}
      placeholder="Search canvas commands…"
    />
  );
}
