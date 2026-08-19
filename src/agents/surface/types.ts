import type { A2UIEnvelope } from '../../a2ui/types';

/** Canvas-wide operator tool-scope preset ( 03 §13). Enforced at runtime in. */
export type OperatorMode = 'auto' | 'ask' | 'build' | 'draw';

export type OperatorMessageRole = 'user' | 'assistant' | 'system';

export interface OperatorAttachmentRef {
  id: string;
  name: string;
  mimeType: string;
}

export interface OperatorTextMessage {
  id: string;
  role: OperatorMessageRole;
  kind: 'text';
  text: string;
  timestamp: string;
  attachments?: readonly OperatorAttachmentRef[];
}

export interface OperatorToolMessage {
  id: string;
  role: 'assistant';
  kind: 'tool';
  toolName: string;
  args: Record<string, unknown>;
  ok: boolean;
  /** Tool handler error message when ok is false. */
  error?: string;
  timestamp: string;
}

export interface OperatorReasoningMessage {
  id: string;
  role: 'assistant';
  kind: 'reasoning';
  text: string;
  timestamp: string;
  streaming?: boolean;
}

export interface OperatorA2UIMessage {
  id: string;
  role: OperatorMessageRole;
  kind: 'a2ui';
  /** Ordered A2UI v1.0 envelopes rendered through the ingestion adapter. */
  envelopes: readonly A2UIEnvelope[];
  timestamp: string;
}

export type OperatorMessage =
  | OperatorTextMessage
  | OperatorA2UIMessage
  | OperatorToolMessage
  | OperatorReasoningMessage;

export interface OperatorThread {
  id: string;
  title: string;
  messages: readonly OperatorMessage[];
  /** True while this thread has an in-flight operator chat turn. */
  generating?: boolean;
}

export interface OperatorModelOption {
  alias: string;
  label: string;
  /** When true, the switcher renders the option disabled (capability gating). */
  disabled?: boolean;
}

export interface OperatorThreadChangedDetail {
  threadId: string;
  previousThreadId: string | null;
}

export interface OperatorModeChangedDetail {
  mode: OperatorMode;
  previousMode: OperatorMode | null;
}

export interface OperatorModelChangedDetail {
  modelAlias: string;
  previousModelAlias: string | null;
  /** Alias that supplied the binding after resolution (may differ when fallback used). */
  resolvedAlias?: string;
  fallbackUsed?: boolean;
}

export function isOperatorA2UIMessage(message: OperatorMessage): message is OperatorA2UIMessage {
  return message.kind === 'a2ui';
}

export function isOperatorTextMessage(message: OperatorMessage): message is OperatorTextMessage {
  return message.kind === 'text';
}
