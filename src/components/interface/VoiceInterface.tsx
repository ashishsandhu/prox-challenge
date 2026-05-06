"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

// Loose typings for the browser SpeechRecognition API (Chrome / Edge prefix
// it as webkitSpeechRecognition; newer Safari ships the unprefixed name).
// We avoid the DOM lib types because they aren't shipped uniformly.
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult:
  | ((event: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void)
  | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type RecognitionCtor = new () => Recognition;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  }
}

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

const errorMessages: Record<string, string> = {
  "not-allowed": "Microphone permission denied — enable it in your browser settings",
  "service-not-allowed": "Microphone permission denied",
  "no-speech": "Didn't catch that — try again",
  "audio-capture": "No microphone found",
  network: "Speech service unreachable — Chrome routes audio through Google",
  aborted: ""
};

// Mic-to-text button. Click to dictate one utterance, click again to cancel.
// Final transcripts are appended to the chat input via onTranscript. Hidden
// when the browser doesn't expose SpeechRecognition.
export function VoiceInterface({
  onTranscript,
  disabled
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);

  useEffect(() => {
    // Detect SpeechRecognition support on the client. This is a one-time
    // platform-feature probe — exactly the case the lint rule warns is fine
    // when scoped narrowly.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(getRecognitionCtor() !== null);
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  // Auto-clear the error pill so it doesn't linger past the next attempt.
  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 4000);
    return () => window.clearTimeout(timer);
  }, [error]);

  function start() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    recognitionRef.current?.abort();
    recognitionRef.current = null;

    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setError(null);
    };
    recognition.onresult = (event) => {
      let interimChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          const clean = transcript.trim();
          if (clean) onTranscript(clean);
        } else {
          interimChunk += transcript;
        }
      }
      setInterim(interimChunk.trim());
    };
    recognition.onerror = (event) => {
      const friendly = errorMessages[event.error] ?? `Mic error: ${event.error}`;
      if (friendly) setError(friendly);
      console.warn("[VoiceInterface] error:", event.error);
    };
    recognition.onend = () => {
      setListening(false);
      setInterim("");
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      setListening(false);
      setError("Couldn't start dictation");
      console.warn("[VoiceInterface] start() threw:", err);
    }
  }

  function stop() {
    recognitionRef.current?.stop();
  }

  if (!supported) return null;

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={listening ? stop : start}
        disabled={disabled}
        className={
          listening
            ? "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-ember/40 bg-ember/15 text-ember animate-pulse"
            : "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-black/[0.08] bg-card-soft text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        }
        aria-label={listening ? "Stop dictation" : "Start voice dictation"}
        title={listening ? "Stop dictation" : "Speak your question"}
      >
        {listening ? <MicOff size={20} /> : <Mic size={20} />}
      </button>
      {listening || interim || error ? (
        <div
          role="status"
          aria-live="polite"
          className={
            error
              ? "pointer-events-none absolute bottom-full left-0 mb-1.5 max-w-[280px] whitespace-normal rounded-md border border-ember/40 bg-ember/10 px-2 py-1 text-[11px] font-medium text-ember shadow-sm"
              : "pointer-events-none absolute bottom-full left-0 mb-1.5 max-w-[280px] truncate rounded-md border border-ember/40 bg-card px-2 py-1 text-[11px] text-text-secondary shadow-sm"
          }
        >
          {error ? error : interim ? `“${interim}”` : "Listening…"}
        </div>
      ) : null}
    </div>
  );
}
