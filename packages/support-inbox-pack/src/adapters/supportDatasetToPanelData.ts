import type { SupportDataset } from '../schema/supportEntityTypes';
import { parseSupportDataset, validateSupportDataset } from '../schema/supportDatasetSchema';

/** Map normalized support dataset rows into embed panelData when hosts expect inline rows. */
export function supportDatasetToPanelData(dataset: SupportDataset): {
  tickets: SupportDataset['tickets'];
  messages: SupportDataset['messages'];
  macros: SupportDataset['macros'];
} {
  return {
    tickets: [...dataset.tickets],
    messages: [...dataset.messages],
    macros: [...dataset.macros],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSupportTicketRow(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.subject === 'string' && typeof value.customerEmail === 'string';
}

/** Detect normalized support fixture rows vs unrelated panel-data payloads. */
export function isSupportDatasetPanelPayload(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  const tickets = payload.tickets;
  if (Array.isArray(tickets) && tickets.length > 0 && isSupportTicketRow(tickets[0])) {
    return true;
  }
  return validateSupportDatasetShape(payload);
}

function validateSupportDatasetShape(payload: unknown): boolean {
  return validateSupportDataset(payload).ok;
}

/** When embed hosts load support fixtures via static adapter, pass through panel-ready rows. */
export function coalesceSupportPanelDataPayload(payload: unknown): unknown {
  if (!isSupportDatasetPanelPayload(payload)) {
    return payload;
  }
  const dataset = parseSupportDataset(payload);
  return {...(isRecord(payload) ? payload: {}),...supportDatasetToPanelData(dataset),
  };
}
