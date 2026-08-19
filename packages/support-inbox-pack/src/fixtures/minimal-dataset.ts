import type { SupportDataset } from '../types';

/** Minimal fixture dataset for interop tests and local demos. */
export const MINIMAL_SUPPORT_DATASET: SupportDataset = {
  tickets: [
    {
      id: 'tkt-1001',
      subject: 'Billing portal shows duplicate charge',
      customerName: 'Jordan Lee',
      customerEmail: 'jordan.lee@example.test',
      status: 'open',
      priority: 'high',
      channel: 'email',
      preview: 'I was charged twice for the March workspace plan.',
      updatedAt: '2026-07-20T14:22:00.000Z',
      assignee: 'Alex Agent',
    },
    {
      id: 'tkt-1002',
      subject: 'Cannot reset SSO password',
      customerName: 'Sam Rivera',
      customerEmail: 'sam.rivera@example.test',
      status: 'pending',
      priority: 'normal',
      channel: 'chat',
      preview: 'The reset link expires before I can submit a new password.',
      updatedAt: '2026-07-19T09:05:00.000Z',
    },
    {
      id: 'tkt-1003',
      subject: 'Export CSV missing custom fields',
      customerName: 'Taylor Kim',
      customerEmail: 'taylor.kim@example.test',
      status: 'resolved',
      priority: 'low',
      channel: 'email',
      preview: 'Resolved after patch — custom fields now included in export.',
      updatedAt: '2026-07-18T16:40:00.000Z',
      assignee: 'Alex Agent',
    },
  ],
  messages: [
    {
      id: 'msg-1',
      ticketId: 'tkt-1001',
      author: 'Jordan Lee',
      role: 'customer',
      body: 'I was charged twice for the March workspace plan.',
      sentAt: '2026-07-20T14:10:00.000Z',
    },
    {
      id: 'msg-2',
      ticketId: 'tkt-1001',
      author: 'Alex Agent',
      role: 'agent',
      body: 'Thanks — I can see two pending charges. I am escalating to billing now.',
      sentAt: '2026-07-20T14:22:00.000Z',
    },
    {
      id: 'msg-3',
      ticketId: 'tkt-1002',
      author: 'Sam Rivera',
      role: 'customer',
      body: 'The reset link expires before I can submit a new password.',
      sentAt: '2026-07-19T09:05:00.000Z',
    },
  ],
  macros: [
    {
      id: 'macro-1',
      title: 'Acknowledge and investigate',
      category: 'Triage',
      body: 'Thanks for reaching out — I am reviewing your account now and will follow up shortly.',
    },
    {
      id: 'macro-2',
      title: 'Request screenshot',
      category: 'Diagnostics',
      body: 'Could you share a screenshot of the error and the approximate time it occurred?',
    },
    {
      id: 'macro-3',
      title: 'Resolved — verify fix',
      category: 'Closure',
      body: 'We deployed a fix for this issue. Please retry and let us know if anything still looks off.',
    },
  ],
};
