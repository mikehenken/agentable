import { defineSchemaPanel } from '../../../src/panels/builder';
import type { PanelDefinition } from '../../../src/panels/types';
import { SUPPORT_INBOX_PANEL_IDS } from './constants';

const SCHEMA_VERSION = 1;

const K = {
  inboxTitle: 'support.panels.inbox.title',
  inboxSubtitle: 'support.panels.inbox.subtitle',
  ticketDetailTitle: 'support.panels.ticketDetail.title',
  ticketDetailColumnAuthor: 'support.panels.ticketDetail.column.author',
  ticketDetailColumnRole: 'support.panels.ticketDetail.column.role',
  ticketDetailColumnSent: 'support.panels.ticketDetail.column.sent',
  macrosTitle: 'support.panels.macros.title',
  macrosSubtitle: 'support.panels.macros.subtitle',
} as const;

function inboxPanel(): PanelDefinition {
  return defineSchemaPanel({
    id: 'inbox',
    meta: {
      title: K.inboxTitle,
      schemaVersion: SCHEMA_VERSION,
      icon: 'Inbox',
      agentDescription:
        'Browse the support ticket inbox with status and priority filters. Use when triaging open, pending, or resolved conversations.',
      defaultSize: { w: 560, h: 520 },
    },
    sources: {
      tickets: { source: 'support.tickets' },
    },
    blocks: [
      { block: 'header', title: K.inboxTitle, subtitle: K.inboxSubtitle },
      {
        block: 'list',
        bind: 'tickets',
        row: { title: 'subject', subtitle: 'customerName' },
      },
    ],
  });
}

function ticketDetailPanel(): PanelDefinition {
  return defineSchemaPanel({
    id: 'ticket-detail',
    meta: {
      title: K.ticketDetailTitle,
      schemaVersion: SCHEMA_VERSION,
      icon: 'MessageSquare',
      agentDescription:
        'Show the message thread for a selected ticket. Use when the agent asks for conversation history or context on a case.',
      defaultSize: { w: 620, h: 520 },
    },
    sources: {
      messages: { source: 'support.messages' },
    },
    blocks: [
      { block: 'header', title: K.ticketDetailTitle },
      {
        block: 'table',
        bind: 'messages',
        columns: [
          { bind: 'author', label: K.ticketDetailColumnAuthor },
          { bind: 'role', label: K.ticketDetailColumnRole },
          { bind: 'sentAt', label: K.ticketDetailColumnSent },
        ],
      },
    ],
  });
}

function macrosPanel(): PanelDefinition {
  return defineSchemaPanel({
    id: 'macros',
    meta: {
      title: K.macrosTitle,
      schemaVersion: SCHEMA_VERSION,
      icon: 'MessagesSquare',
      agentDescription:
        'Canned responses and quick-reply templates. Use when the agent needs approved wording for common support scenarios.',
      defaultSize: { w: 520, h: 480 },
    },
    sources: {
      macros: { source: 'support.macros' },
    },
    actions: {
      insertMacro: {
        kind: 'prompt',
        prompt: 'Insert this canned response into my reply draft and summarize when to use it.',
      },
    },
    blocks: [
      { block: 'header', title: K.macrosTitle, subtitle: K.macrosSubtitle },
      {
        block: 'list',
        bind: 'macros',
        row: { title: 'title', subtitle: 'category' },
        rowActions: ['insertMacro'],
      },
    ],
  });
}

/** Three Tier 2 schema panels compiled deterministically from the builder. */
export function createSupportInboxPanelDefinitions(): readonly PanelDefinition[] {
  const panels = [inboxPanel(), ticketDetailPanel(), macrosPanel()];
  const ids = panels.map((panel) => panel.id);
  if (ids.join(',') !== SUPPORT_INBOX_PANEL_IDS.join(',')) {
    throw new Error(
      `[support-inbox-pack] panel id drift: expected [${SUPPORT_INBOX_PANEL_IDS.join(', ')}], got [${ids.join(', ')}]`,
    );
  }
  return panels;
}

export { K as SUPPORT_INBOX_CATALOG_KEYS };
