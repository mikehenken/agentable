export type SupportTicketStatus = 'open' | 'pending' | 'resolved';

export type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export type SupportMessageRole = 'customer' | 'agent' | 'system';

export interface SupportTicket {
  id: string;
  subject: string;
  customerName: string;
  customerEmail: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  channel: 'email' | 'chat' | 'phone';
  preview: string;
  updatedAt: string;
  assignee?: string;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  author: string;
  role: SupportMessageRole;
  body: string;
  sentAt: string;
}

export interface SupportMacro {
  id: string;
  title: string;
  category: string;
  body: string;
}

export interface SupportDataset {
  tickets: SupportTicket[];
  messages: SupportMessage[];
  macros: SupportMacro[];
}
