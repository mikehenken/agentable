/** Canonical panel ids registered by the support-inbox pack (Tier 2). */
export const SUPPORT_INBOX_PANEL_IDS = ['inbox', 'ticket-detail', 'macros'] as const;

export type SupportInboxPanelId = (typeof SUPPORT_INBOX_PANEL_IDS)[number];

/** DataAdapter source names owned by the support-inbox domain. */
export const SUPPORT_INBOX_SOURCE_NAMES = [
  'support.tickets',
  'support.ticket',
  'support.messages',
  'support.macros',
  'support.reply',
] as const;

export type SupportInboxSourceName = (typeof SUPPORT_INBOX_SOURCE_NAMES)[number];

/** Stable generated tool names (append-only; do not reorder). */
export const SUPPORT_INBOX_TOOL_NAMES = [
  'open_inbox',
  'show_ticket',
  'open_macros',
  'search_tickets',
] as const;

export type SupportInboxToolName = (typeof SUPPORT_INBOX_TOOL_NAMES)[number];
