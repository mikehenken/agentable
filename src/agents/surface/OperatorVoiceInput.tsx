/**
 * Operator composer mic — spawns Gemini Live voice agent session (P13-T7 iter-6).
 * Web Speech dictation remains available via long-press / secondary affordance.
 */
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactElement } from 'react';
import { Mic, MicOff, Radio } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useVoiceCall, defaultVoiceLabel } from '../../hooks/useVoiceCall';
import { ensurePageSession } from '../../session/pageSession';
import { ensureVoiceKernel } from '../../shared/voiceKernel';

export interface OperatorVoiceInputProps {
  disabled?: boolean;
  className?: string;
  /** Optional dictation hook — appends transcript to composer draft. */
  onTranscript?: (text: string) => void;
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: Array<Array<{ transcript?: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function OperatorVoiceInput({
  disabled = false,
  className,
  onTranscript,
}: OperatorVoiceInputProps): ReactElement {
  const voice = useVoiceCall();
  const [dictating, setDictating] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const dictationSupported = Boolean(getSpeechRecognitionCtor()) && typeof onTranscript === 'function';

  const voiceActive =
    voice.state === 'connecting' || voice.state === 'listening' || voice.state === 'speaking';

  const stopDictation = useCallback(() => {
    recognitionRef.current?.stop();
    setDictating(false);
  }, []);

  const startDictation = useCallback(() => {
    if (disabled || !dictationSupported || !onTranscript) {
      return;
    }
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        onTranscript(transcript);
      }
    };
    recognition.onerror = () => setDictating(false);
    recognition.onend = () => setDictating(false);

    recognitionRef.current = recognition;
    recognition.start();
    setDictating(true);
  }, [dictationSupported, disabled, onTranscript]);

  const handlePrimaryClick = useCallback(() => {
    if (disabled) {
      return;
    }
    if (voiceActive) {
      voice.stop();
      ensurePageSession().setVoiceSessionId(null);
      ensurePageSession().setConnectionState('idle');
      return;
    }
    stopDictation();
    ensurePageSession().setConnectionState('connecting');
    void ensureVoiceKernel().voice.start();
  }, [disabled, stopDictation, voiceActive]);

  const handleContextMenu = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (!dictationSupported) {
        return;
      }
      event.preventDefault();
      if (dictating) {
        stopDictation();
        return;
      }
      if (voiceActive) {
        voice.stop();
      }
      startDictation();
    },
    [dictating, dictationSupported, startDictation, stopDictation, voice, voiceActive],
  );

  useEffect(() => {
    if (!voiceActive) {
      return;
    }
    ensurePageSession().setConnectionState(
      voice.state === 'connecting'
        ? 'connecting'
        : voice.state === 'error'
          ? 'idle'
          : 'connected',
    );
  }, [voice.state, voiceActive]);

  useEffect(() => () => stopDictation(), [stopDictation]);

  const ariaLabel = voiceActive
    ? defaultVoiceLabel(voice.state, 'End voice session')
    : dictating
      ? 'Stop dictation'
      : 'Start operator voice agent';

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={voiceActive || dictating ? 'true' : 'false'}
      disabled={disabled}
      title={
        dictationSupported
          ? 'Click: voice agent · Right-click: dictation'
          : 'Start operator voice agent'
      }
      data-testid="operator-speech-input"
      data-operator-voice-active={voiceActive ? 'true' : 'false'}
      data-operator-voice-state={voice.state}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
        'border-[var(--vibe-border,rgb(255_255_255/0.09))]',
        'text-[var(--vibe-text-muted,#9a9a9a)] hover:text-[var(--vibe-text,#ececec)]',
        (voiceActive || dictating) &&
          'border-[var(--vibe-accent,#ff6b57)] text-[var(--vibe-accent,#ff6b57)]',
        className,
      )}
      onClick={handlePrimaryClick}
      onContextMenu={handleContextMenu}
    >
      {voiceActive ? <Radio size={15} aria-hidden /> : dictating ? <MicOff size={15} /> : <Mic size={15} />}
    </button>
  );
}
