import type { TLUiComponents } from 'tldraw';

/**
 * Hide non-essential tldraw chrome while keeping drawing tools and navigation.
 * @see https://tldraw.dev/examples/ui-components-hidden
 *
 * Kept visible: Toolbar, ContextMenu, ActionsMenu, ZoomMenu, MainMenu, PageMenu,
 * NavigationPanel, KeyboardShortcutsDialog.
 */
export const minimalTldrawUiComponents = {
  HelpMenu: null,
  Minimap: null,
  StylePanel: null,
  QuickActions: null,
  HelperButtons: null,
  DebugPanel: null,
  DebugMenu: null,
  SharePanel: null,
  MenuPanel: null,
  TopPanel: null,
  CursorChatBubble: null,
  RichTextToolbar: null,
  ImageToolbar: null,
  VideoToolbar: null,
  Dialogs: null,
  Toasts: null,
  A11y: null,
  FollowingIndicator: null,
  PeopleMenu: null,
  PeopleMenuAvatar: null,
  PeopleMenuItem: null,
  PeopleMenuFacePile: null,
  UserPresenceEditor: null,
} satisfies TLUiComponents;
