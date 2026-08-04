import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Mic, Trash2 } from 'lucide-react';
import type { MessageAttachment } from '../../shared/api';

/** Reads a Blob into a data-URL. */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Voice-note recorder for the composer (Bloc 1.4). Idle → a mic button; while
 * recording → a compact cluster (elapsed time, cancel, send). On send the clip
 * is handed to the composer as an audio attachment (data-URL, kept small — a
 * voice note in webm/opus is only a few KB per second). Recording is capped so
 * a forgotten recording can't grow past the message size budget.
 */
const MAX_SECONDS = 180; // 3 min hard cap

export function VoiceRecorder({ onRecorded }: { onRecorded: (att: MessageAttachment) => void }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setElapsed(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      cancelledRef.current = false;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const wasCancelled = cancelledRef.current;
        const blob = new Blob(chunksRef.current, { type: mime });
        cleanup();
        if (wasCancelled || blob.size === 0) return;
        try {
          const dataUrl = await blobToDataUrl(blob);
          onRecorded({
            dataUrl,
            name: `note-vocale-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.webm`,
            kind: 'audio',
            mime,
          });
        } catch {
          setError('Enregistrement illisible.');
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((s) => {
          const next = s + 1;
          if (next >= MAX_SECONDS) recorderRef.current?.stop();
          return next;
        });
      }, 1000);
    } catch {
      setError("Micro indisponible — autorise l'accès au microphone.");
    }
  };

  const stopAndSend = () => {
    cancelledRef.current = false;
    recorderRef.current?.stop();
  };

  const cancel = () => {
    cancelledRef.current = true;
    recorderRef.current?.stop();
  };

  if (recording) {
    return (
      <div className="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-danger/40 bg-danger-muted px-2 py-1">
        <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
        <span className="tnum font-mono text-xs text-danger">{fmt(elapsed)}</span>
        <button
          type="button"
          onClick={cancel}
          aria-label="Annuler l'enregistrement"
          className="flex h-6 w-6 items-center justify-center rounded text-text-muted transition-colors hover:text-text-primary"
        >
          <Trash2 size={14} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={stopAndSend}
          aria-label="Terminer et joindre"
          className="flex h-6 w-6 items-center justify-center rounded bg-accent text-bg transition-colors hover:bg-accent-hover"
        >
          <Check size={14} strokeWidth={2.5} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      aria-label="Enregistrer un message vocal"
      title={error ?? 'Message vocal'}
      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md transition-colors hover:bg-surface-hover hover:text-text-primary ${
        error ? 'text-danger' : 'text-text-muted'
      }`}
    >
      <Mic size={16} strokeWidth={1.75} />
    </button>
  );
}
