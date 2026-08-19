/**
 * static support inbox adapter fixture queries + reply mutation.
 */
import { describe, expect, it } from 'vitest';
import {
  MINIMAL_SUPPORT_DATASET,
  createStaticSupportInboxAdapter,
} from '@agentable/support-inbox-pack';

describe('createStaticSupportInboxAdapter', () => {
  it('filters tickets by status and search', async () => {
    const adapter = createStaticSupportInboxAdapter(MINIMAL_SUPPORT_DATASET);
    const controller = new AbortController();

    const openTickets = await adapter.query(
      { source: 'support.tickets', params: { status: 'open' } },
      {},
      controller.signal);
    expect(Array.isArray(openTickets)).toBe(true);
    expect((openTickets as Array<{ status: string }>).every((ticket) => ticket.status === 'open')).toBe(
      true);

    const billingMatches = await adapter.query(
      { source: 'support.tickets', params: { search: 'billing' } },
      {},
      controller.signal);
    expect((billingMatches as Array<{ subject: string }>).length).toBeGreaterThan(0);
    expect((billingMatches as Array<{ subject: string }>)[0]?.subject).toMatch(/billing/i);
  });

  it('returns messages for a ticket id', async () => {
    const adapter = createStaticSupportInboxAdapter(MINIMAL_SUPPORT_DATASET);
    const controller = new AbortController();
    const messages = await adapter.query(
      { source: 'support.messages', params: { ticketId: 'tkt-1001' } },
      {},
      controller.signal);
    expect((messages as Array<{ ticketId: string }>).every((msg) => msg.ticketId === 'tkt-1001')).toBe(
      true);
  });

  it('validates support.reply mutations', async () => {
    const adapter = createStaticSupportInboxAdapter(MINIMAL_SUPPORT_DATASET);
    const invalid = await adapter.mutate(
      { source: 'support.reply', name: 'reply' },
      { ticketId: 'tkt-1001' },
      {});
    expect(invalid.ok).toBe(false);

    const ok = await adapter.mutate(
      { source: 'support.reply', name: 'reply' },
      { ticketId: 'tkt-1001', body: 'We issued a refund for the duplicate charge.' },
      {});
    expect(ok.ok).toBe(true);
  });
});
