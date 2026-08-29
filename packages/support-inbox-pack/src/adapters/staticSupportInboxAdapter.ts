import type { JsonObject, JsonValue, PanelScope } from '../../../../src/panels/types';
import type {
  DataAdapter,
  DeclaredAction,
  MutationResult,
  SourceRef,
  Unsubscribe,
} from '../../../../src/panels/renderer';
import { parseSupportDataset } from '../schema/supportDatasetSchema';
import type { SupportDataset, SupportMessage, SupportTicket } from '../schema/supportEntityTypes';

const STORAGE_PREFIX = 'agentable-support-inbox-adapter:';

export interface StaticSupportInboxAdapterOptions {
  /** Artificial query/mutation latency for loading-state tests. Default 0. */
  latencyMs?: number;
  /** localStorage namespace; defaults to `default`. */
  persistenceKey?: string;
  fetchFn?: typeof fetch;
}

export type StaticSupportInboxDatasetInput = SupportDataset | { url: string };

interface ReplyPayload {
  ticketId?: string;
  body?: string;
  author?: string;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readParams(params: JsonObject | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!params) return out;
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.length > 0) {
      out[key] = value;
    }
  }
  return out;
}

function storageKey(persistenceKey: string): string {
  return `${STORAGE_PREFIX}${persistenceKey}`;
}

function loadPersistedMessages(persistenceKey: string): SupportMessage[] {
  if (typeof globalThis.localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = globalThis.localStorage.getItem(storageKey(persistenceKey));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SupportMessage[];
  } catch {
    return [];
  }
}

function savePersistedMessages(
  persistenceKey: string,
  messages: readonly SupportMessage[],
): void {
  if (typeof globalThis.localStorage === 'undefined') {
    return;
  }
  try {
    globalThis.localStorage.setItem(storageKey(persistenceKey), JSON.stringify(messages));
  } catch {
    // Quota or privacy mode — in-memory layer still holds mutations for the session.
  }
}

function withLatency<T>(latencyMs: number, run: () => T | Promise<T>): Promise<T> {
  if (latencyMs <= 0) {
    return Promise.resolve(run());
  }
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      Promise.resolve(run()).then(resolve).catch(reject);
    }, latencyMs);
  });
}

function matchesSearch(ticket: SupportTicket, search: string): boolean {
  const needle = search.toLowerCase();
  const haystack = [
    ticket.subject,
    ticket.customerName,
    ticket.customerEmail,
    ticket.preview,
    ticket.assignee ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function filterTickets(
  tickets: readonly SupportTicket[],
  params: Record<string, string>,
): SupportTicket[] {
  let result = [...tickets];
  const status = params.status;
  const priority = params.priority;
  const search = params.search ?? params.q;

  if (status) {
    const statusNeedle = status.toLowerCase();
    result = result.filter((ticket) => ticket.status.toLowerCase() === statusNeedle);
  }
  if (priority) {
    const priorityNeedle = priority.toLowerCase();
    result = result.filter((ticket) => ticket.priority.toLowerCase() === priorityNeedle);
  }
  if (search) {
    result = result.filter((ticket) => matchesSearch(ticket, search));
  }
  return result.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

function filterMacros(
  macros: SupportDataset['macros'],
  params: Record<string, string>,
): SupportDataset['macros'] {
  let result = [...macros];
  const category = params.category;
  const search = params.search;
  if (category) {
    const categoryNeedle = category.toLowerCase();
    result = result.filter((macro) => macro.category.toLowerCase().includes(categoryNeedle));
  }
  if (search) {
    const needle = search.toLowerCase();
    result = result.filter(
      (macro) =>
        macro.title.toLowerCase().includes(needle) ||
        macro.body.toLowerCase().includes(needle) ||
        macro.category.toLowerCase().includes(needle),
    );
  }
  return result;
}

async function resolveDatasetInput(
  input: StaticSupportInboxDatasetInput,
  fetchFn: typeof fetch,
): Promise<SupportDataset> {
  if ('url' in input) {
    const response = await fetchFn(input.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch support dataset from ${input.url}: HTTP ${response.status}`);
    }
    const json: unknown = await response.json();
    return parseSupportDataset(json);
  }
  return parseSupportDataset(input);
}

/** Load inline dataset or fetch + validate URL-backed fixture once. */
export async function resolveSupportDatasetInput(
  input: StaticSupportInboxDatasetInput,
  fetchFn: typeof fetch = fetch,
): Promise<SupportDataset> {
  return resolveDatasetInput(input, fetchFn);
}

/**
 * Mock-first support inbox DataAdapter.
 * Serves fixture data in-memory with optional localStorage-backed replies.
 */
export function createStaticSupportInboxAdapter(
  datasetInput: StaticSupportInboxDatasetInput,
  options: StaticSupportInboxAdapterOptions = {},
): DataAdapter {
  const latencyMs = options.latencyMs ?? 0;
  const persistenceKey = options.persistenceKey ?? 'default';
  const fetchFn = options.fetchFn ?? fetch;

  let datasetPromise: Promise<SupportDataset> | null = null;
  let resolvedDataset: SupportDataset | null =
    'url' in datasetInput ? null : parseSupportDataset(datasetInput);

  const subscribers: Array<{ source: string; onChange: () => void; active: boolean }> = [];

  let messages: SupportMessage[] = [
    ...(resolvedDataset?.messages ?? []),
    ...loadPersistedMessages(persistenceKey),
  ];

  let tickets: SupportTicket[] = [...(resolvedDataset?.tickets ?? [])];

  const ensureDataset = async (): Promise<SupportDataset> => {
    if (resolvedDataset) {
      return resolvedDataset;
    }
    if (!datasetPromise) {
      datasetPromise = resolveDatasetInput(datasetInput, fetchFn).then((dataset) => {
        resolvedDataset = dataset;
        if (messages.length === 0 && dataset.messages.length > 0) {
          messages = [...dataset.messages];
        }
        if (tickets.length === 0 && dataset.tickets.length > 0) {
          tickets = [...dataset.tickets];
        }
        return dataset;
      });
    }
    return datasetPromise;
  };

  const notify = (source: string): void => {
    for (const entry of subscribers) {
      if (entry.active && entry.source === source) {
        entry.onChange();
      }
    }
  };

  const queryImpl = async (ref: SourceRef, params: Record<string, string>): Promise<unknown> => {
    const dataset = await ensureDataset();
    switch (ref.source) {
      case 'support.tickets':
        return filterTickets(tickets, params);
      case 'support.ticket': {
        const ticketId = params.id ?? params.ticketId;
        if (!ticketId) return null;
        return tickets.find((ticket) => ticket.id === ticketId) ?? null;
      }
      case 'support.messages': {
        const ticketId = params.ticketId ?? ref.params?.ticketId;
        if (typeof ticketId !== 'string' || ticketId.length === 0) {
          return [];
        }
        return messages.filter((message) => message.ticketId === ticketId);
      }
      case 'support.macros':
        return filterMacros(dataset.macros, params);
      default:
        throw Object.assign(new Error(`Unknown support source "${ref.source}"`), {
          code: 'not_found' as const,
        });
    }
  };

  const mutateImpl = async (
    action: DeclaredAction,
    payload: unknown,
  ): Promise<MutationResult> => {
    if (action.source !== 'support.reply') {
      return {
        ok: false,
        error: {
          code: 'not_found',
          message: `Unsupported support mutate source "${action.source}"`,
        },
      };
    }

    const body = (payload ?? {}) as ReplyPayload;
    const fieldErrors: Record<string, string> = {};
    const ticketId = readString(body.ticketId);
    const messageBody = readString(body.body);
    const author = readString(body.author) ?? 'Support Agent';

    if (!ticketId) {
      fieldErrors.ticketId = 'Select a ticket to reply.';
    } else if (!tickets.some((ticket) => ticket.id === ticketId)) {
      fieldErrors.ticketId = 'Selected ticket was not found in the fixture dataset.';
    }
    if (!messageBody) {
      fieldErrors.body = 'Reply body is required.';
    }

    if (Object.keys(fieldErrors).length > 0) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: 'Reply validation failed.',
          fieldErrors,
        },
      };
    }

    const sentAt = new Date().toISOString();
    const message: SupportMessage = {
      id: `msg-${Date.now()}`,
      ticketId: ticketId ?? '',
      author,
      role: 'agent',
      body: messageBody ?? '',
      sentAt,
    };

    messages = [...messages, message];
    tickets = tickets.map((ticket) =>
      ticket.id === ticketId
        ? {
            ...ticket,
            status: ticket.status === 'resolved' ? 'resolved' : 'pending',
            preview: messageBody ?? ticket.preview,
            updatedAt: sentAt,
          }
        : ticket,
    );

    savePersistedMessages(persistenceKey, messages);
    notify('support.messages');
    notify('support.tickets');

    // JSON-safe record; interfaces lack the implicit index signature JsonValue wants.
    return { ok: true, data: message as unknown as JsonValue };
  };

  return {
    query(ref: SourceRef, _scope: PanelScope, signal: AbortSignal): Promise<unknown> {
      if (signal.aborted) {
        return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
      }
      const params = readParams(ref.params);
      return withLatency(latencyMs, () => queryImpl(ref, params));
    },

    mutate(action: DeclaredAction, payload: unknown, scope: PanelScope): Promise<MutationResult> {
      void scope;
      return withLatency(latencyMs, () => mutateImpl(action, payload));
    },

    subscribe(ref: SourceRef, _scope: PanelScope, onChange: () => void): Unsubscribe {
      const entry = { source: ref.source, onChange, active: true };
      subscribers.push(entry);
      return () => {
        entry.active = false;
      };
    },
  };
}
