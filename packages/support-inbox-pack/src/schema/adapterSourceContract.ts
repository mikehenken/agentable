/**
 * Mock adapter source contract for the support-inbox pack.
 * Documents query/mutate shapes served by `createStaticSupportInboxAdapter`.
 */
import type { SupportMacro, SupportMessage, SupportTicket } from './supportEntityTypes';

export interface SupportTicketsQueryParams {
  status?: string;
  priority?: string;
  search?: string;
  q?: string;
}

export interface SupportTicketQueryParams {
  id?: string;
  ticketId?: string;
}

export interface SupportMessagesQueryParams {
  ticketId?: string;
}

export interface SupportMacrosQueryParams {
  category?: string;
  search?: string;
}

export interface SupportReplyMutatePayload {
  ticketId?: string;
  body?: string;
  author?: string;
}

export interface SupportInboxAdapterSourceContract {
  'support.tickets': {
    params: SupportTicketsQueryParams;
    queryResult: readonly SupportTicket[];
  };
  'support.ticket': {
    params: SupportTicketQueryParams;
    queryResult: SupportTicket | null;
  };
  'support.messages': {
    params: SupportMessagesQueryParams;
    queryResult: readonly SupportMessage[];
  };
  'support.macros': {
    params: SupportMacrosQueryParams;
    queryResult: readonly SupportMacro[];
  };
  'support.reply': {
    mutatePayload: SupportReplyMutatePayload;
    mutateResult: SupportMessage;
  };
}

export type SupportInboxAdapterQuerySource = {
  [K in keyof SupportInboxAdapterSourceContract]: SupportInboxAdapterSourceContract[K] extends {
    queryResult: unknown;
  }
    ? K: never;
}[keyof SupportInboxAdapterSourceContract];

export type SupportInboxAdapterMutateSource = {
  [K in keyof SupportInboxAdapterSourceContract]: SupportInboxAdapterSourceContract[K] extends {
    mutatePayload: unknown;
  }
    ? K: never;
}[keyof SupportInboxAdapterSourceContract];
