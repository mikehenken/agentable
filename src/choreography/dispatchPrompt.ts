import {
  CHAT_PROMPT_EVENT,
  FOCUS_CHAT_INPUT_EVENT,
  OPEN_CHAT_EVENT,
} from './constants';

export interface ChatPromptDetail {
  prompt: string;
  source?: string;
}

/**
 * Framework primitive for `prompt`-kind panel actions (02 section 10 rule 2):
 * restore chat, insert the prompt visibly, focus composer, scroll on response.
 */
export function dispatchChatPrompt(
  prompt: string,
  options: { source?: string } = {},
): void {
  if (typeof window === 'undefined') return;

  const trimmed = prompt.trim();
  if (!trimmed) return;

  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT));
  window.dispatchEvent(
    new CustomEvent<ChatPromptDetail>(CHAT_PROMPT_EVENT, {
      detail: { prompt: trimmed, source: options.source },
    }),
  );
  window.dispatchEvent(new CustomEvent(FOCUS_CHAT_INPUT_EVENT));
}

/** Surface chat without sending — palette / agent focus paths. */
export function dispatchOpenChat(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT));
  window.dispatchEvent(new CustomEvent(FOCUS_CHAT_INPUT_EVENT));
}
