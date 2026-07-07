/**
 * WhiteboardCommandPalette — Cmd/Ctrl+P and Alt+P command surface for the whiteboard.
 */
import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { CommandPalette, type CommandItem } from '../components/general/command-palette';
import { useKeybindings } from '../components/general/use-keybindings';
import {
  WHITEBOARD_PALETTE_ENTITIES,
  useFrameContextStore,
} from '../context/frameContextStore';
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
  const setActiveContextRef = useFrameContextStore((s) => s.setActiveContextRef);
  const activeContextRef = useFrameContextStore((s) => s.activeContextRef);

  const entityCommands = useMemo<CommandItem[]>(
    () =>
      WHITEBOARD_PALETTE_ENTITIES.map((entity) => ({
        id: `insert-${entity.panelId}`,
        label: `Insert ${entity.label}`,
        group: 'Entities',
        description: entity.id,
        run: () => {
          setActiveContextRef(entity.id);
          openPanelInCanvas(entity.panelId, {
            focus: true,
            panelProps: { __title: entity.label, contextRef: entity.id },
          });
          close();
        },
      })),
    [setActiveContextRef, close],
  );

  const commands: CommandItem[] = [
    ...entityCommands,
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
      id: 'clear-context',
      label: 'Clear frame context scope',
      group: 'Context',
      description: activeContextRef ?? 'No active context',
      run: () => {
        setActiveContextRef(null);
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
      keys: 'alt+p',
      label: 'Command palette (Alt+P)',
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
