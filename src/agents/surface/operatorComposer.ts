/**
 * Operator composer — appends user messages and resolves assistant replies via
 * live chat bridge or deterministic offline fallback.
 */
import type { OperatorOutboundAttachment } from './operatorAttachments';
import { sendOperatorMessage } from './operatorChatBridge';
import type { OperatorMode, OperatorThread } from './types';

export interface SubmitOperatorComposerInput {
  text: string;
  threads: readonly OperatorThread[];
  activeThreadId: string;
  mode: OperatorMode;
  attachments?: readonly OperatorOutboundAttachment[];
  onThreadsUpdate?: (threads: OperatorThread[]) => void;
}

export interface SubmitOperatorComposerResult {
  threads: OperatorThread[];
  error?: string;
}

/**
 * Append a user turn to the active thread and resolve an assistant reply.
 * Always routes through sendOperatorMessage for unified offline/live handling.
 */
export async function submitOperatorComposerMessage(
  input: SubmitOperatorComposerInput,
): Promise<SubmitOperatorComposerResult> {
  return sendOperatorMessage(input);
}
