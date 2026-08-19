import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SpeechInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
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

function getSpeechRecognitionCtor(): (new ()=> SpeechRecognitionLike) | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const w = window as Window & {
    SpeechRecognition?: new ()=> SpeechRecognitionLike;
    webkitSpeechRecognition?: new ()=> SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Mic button for Web Speech API dictation (shadcn AI speech-input pattern). */
export function SpeechInput({
  onTranscript,
  disabled = false,
  className,
}: SpeechInputProps): ReactElement {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const supported = Boolean(getSpeechRecognitionCtor);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (disabled) {
      return;
    }
    const SpeechRecognitionCtor = getSpeechRecognitionCtor;
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
    recognition.onerror = ()=> setListening(false);
    recognition.onend = ()=> setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [disabled, onTranscript]);

  useEffect(() => ()=> stopListening, [stopListening]);

  if (!supported) {
    return <></>;
  }

  return (
    <button
      type="button"
      aria-label={listening ? 'Stop dictation': 'Start dictation'}
      aria-pressed={listening ? 'true': 'false'}
      disabled={disabled}
      data-testid="operator-speech-input"
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
        'border-[var(--vibe-border,rgb(255_255_255/0.09))]',
        'text-[var(--vibe-text-muted,#9a9a9a)] hover:text-[var(--vibe-text,#ececec)]',
        listening && 'border-[var(--vibe-accent,#ff6b57)] text-[var(--vibe-accent,#ff6b57)]',
        className)}
      onClick={() => (listening ? stopListening: startListening)}
    >
      {listening ? <MicOff size={15} />: <Mic size={15} />}
    </button>
  );
}
