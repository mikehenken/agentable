/**
 * Regression tests for SpeechInput missing-invocation bugs:
 * the ctor lookup, click handler, and unmount cleanup were all
 * referencing functions without calling them.
 */
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpeechInput } from '../../src/components/ai/speech-input';

class FakeSpeechRecognition {
  static instances: FakeSpeechRecognition[] = [];
  lang = '';
  interimResults = false;
  maxAlternatives = 0;
  onresult: ((event: { results: Array<Array<{ transcript?: string }>> }) => void) | null = null;
  onerror: (() => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  constructor() {
    FakeSpeechRecognition.instances.push(this);
  }
}

type SpeechWindow = Window & { SpeechRecognition?: unknown };

describe('SpeechInput', () => {
  beforeEach(() => {
    FakeSpeechRecognition.instances = [];
    (window as SpeechWindow).SpeechRecognition = FakeSpeechRecognition;
  });

  afterEach(() => {
    cleanup();
    delete (window as SpeechWindow).SpeechRecognition;
  });

  it('renders nothing when the Web Speech API is unavailable', () => {
    delete (window as SpeechWindow).SpeechRecognition;
    render(<SpeechInput onTranscript={() => {}} />);
    expect(screen.queryByTestId('operator-speech-input')).toBeNull();
  });

  it('starts recognition on click and forwards the transcript', async () => {
    const user = userEvent.setup();
    const onTranscript = vi.fn();
    render(<SpeechInput onTranscript={onTranscript} />);

    await user.click(screen.getByTestId('operator-speech-input'));

    expect(FakeSpeechRecognition.instances).toHaveLength(1);
    const recognition = FakeSpeechRecognition.instances[0];
    expect(recognition.start).toHaveBeenCalledTimes(1);

    recognition.onresult?.({ results: [[{ transcript: ' hello world ' }]] });
    expect(onTranscript).toHaveBeenCalledWith('hello world');
  });

  it('stops recognition on unmount', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<SpeechInput onTranscript={() => {}} />);

    await user.click(screen.getByTestId('operator-speech-input'));
    const recognition = FakeSpeechRecognition.instances[0];

    unmount();
    expect(recognition.stop).toHaveBeenCalled();
  });
});
