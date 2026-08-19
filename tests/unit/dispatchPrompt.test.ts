import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CHAT_PROMPT_EVENT,
  FOCUS_CHAT_INPUT_EVENT,
  OPEN_CHAT_EVENT,
  dispatchChatPrompt,
} from '../../src/choreography';

describe('dispatchChatPrompt', () => {
  beforeEach(() => {
    vi.spyOn(window, 'dispatchEvent');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches open-chat, prompt, and focus events in order', () => {
    dispatchChatPrompt('Map this growth path for me', { source: 'test' });

    expect(window.dispatchEvent).toHaveBeenCalledTimes(3);

    const events = vi.mocked(window.dispatchEvent).mock.calls.map(([event]) =>
      (event as Event).type);
    expect(events).toEqual([OPEN_CHAT_EVENT, CHAT_PROMPT_EVENT, FOCUS_CHAT_INPUT_EVENT]);

    const promptEvent = vi.mocked(window.dispatchEvent).mock.calls[1]?.[0] as CustomEvent;
    expect(promptEvent.detail).toEqual({
      prompt: 'Map this growth path for me',
      source: 'test',
    });
  });

  it('ignores blank prompts', () => {
    dispatchChatPrompt(' ');
    expect(window.dispatchEvent).not.toHaveBeenCalled;
  });
});
