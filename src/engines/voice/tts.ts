let currentAudio: HTMLAudioElement | null = null;
let speechQueue: string[] = [];
let audioBuffer: { url: string; sentence: string }[] = [];
let isSpeaking = false;
let isBuffering = false;

function splitIntoSentences(text: string): string[] {
  const clean = text
    .replace(/\*\*/g, '')
    .replace(/#{1,6} /g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/`/g, '')
    .trim();

  return clean
    .match(/[^.!?]+[.!?]*\s*/g)
    ?.map(s => s.trim())
    .filter(s => s.length > 0) ?? (clean ? [clean] : []);
}

/**
 * Background worker to keep the audio buffer full.
 * Fetches sentences one by one and pushes to buffer immediately.
 */
async function startBuffering() {
  if (isBuffering || speechQueue.length === 0) return;
  isBuffering = true;

  while (speechQueue.length > 0) {
    const sentence = speechQueue.shift()!;
    
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sentence })
      });

      if (res.ok) {
        const blob = await res.blob();
        audioBuffer.push({ url: URL.createObjectURL(blob), sentence });
      } else {
        throw new Error("TTS Status Error");
      }
    } catch (e) {
      console.warn("Buffering failed for sentence:", sentence, e);
      audioBuffer.push({ url: '', sentence }); // Marker for fallback
    }
  }

  isBuffering = false;
}

async function playbackLoop(onEnd?: () => void): Promise<void> {
  if (audioBuffer.length === 0) {
    if (isBuffering || speechQueue.length > 0) {
      // Still working, wait for next chunk
      setTimeout(() => playbackLoop(onEnd), 100);
      return;
    }
    // Truly finished
    isSpeaking = false;
    onEnd?.();
    return;
  }

  isSpeaking = true;
  const { url, sentence } = audioBuffer.shift()!;

  if (url) {
    currentAudio = new Audio(url);
    currentAudio.onended = () => {
      URL.revokeObjectURL(url);
      playbackLoop(onEnd);
    };
    try {
      await currentAudio.play();
    } catch (e) {
      console.warn("Audio play blocked or failed", e);
      playbackLoop(onEnd);
    }
  } else {
    // Fallback to browser TTS for this specific chunk
    if (!window.speechSynthesis) {
      playbackLoop(onEnd);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.rate = 1.1;
    utterance.onend = () => playbackLoop(onEnd);
    window.speechSynthesis.speak(utterance);
  }
}

export async function speak(text: string, onEnd?: () => void): Promise<void> {
  stopSpeaking();
  speechQueue = splitIntoSentences(text);
  
  if (speechQueue.length > 0) {
    isSpeaking = true;
    // Kick off buffering and playback simultaneously
    startBuffering();
    playbackLoop(onEnd);
  } else {
    onEnd?.();
  }
}

export function stopSpeaking(): void {
  speechQueue = [];
  isBuffering = false;
  isSpeaking = false;
  
  // Cleanup URLs in buffer
  audioBuffer.forEach(item => {
    if (item.url) URL.revokeObjectURL(item.url);
  });
  audioBuffer = [];
  
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  window.speechSynthesis?.cancel();
}
