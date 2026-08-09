import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Maximize2, Mic, MicOff, Monitor, MonitorOff, Phone, PhoneIncoming, PhoneOff, X } from 'lucide-react';
import { useCall, formatDuration } from '../../state/CallContext';
import { useProfiles } from '../../state/ProfilesContext';
import { useToast } from '../../state/ToastContext';
import { bridge } from '../../lib/bridge';
import { UserAvatar } from '../UserAvatar';

/**
 * Everything the operator sees of a call: the incoming-call sheet, the
 * outgoing/connecting state, the in-call bar, and the reason a call ended.
 *
 * Rendered once at the app shell so a call survives navigation — answering
 * from Accueil and then walking over to Tâches must not drop the line.
 */

const TRANSITION = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const };

/**
 * Ringtone synthesised with the Web Audio API rather than shipped as a file:
 * no asset to package, no codec question, and the cadence (two short tones,
 * then silence) is the one people already read as "someone is calling".
 */
function useRingtone(active: boolean): void {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) return undefined;

    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return undefined;

    let ctx: AudioContext;
    try {
      ctx = new AudioCtor();
    } catch {
      return undefined; // no audio output on this machine — the visual ring stands alone
    }
    ctxRef.current = ctx;

    const beep = (at: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      // Ramped, never a hard gate: a square-edged gain pops audibly.
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.16, at + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.38);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.42);
    };

    const ring = () => {
      const t = ctx.currentTime;
      beep(t, 660);
      beep(t + 0.5, 660);
    };

    ring();
    timerRef.current = setInterval(ring, 2400);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      void ctx.close().catch(() => undefined);
      ctxRef.current = null;
    };
  }, [active]);
}

/**
 * Announces missed calls. Separate from the overlay's own render because a
 * missed call is, by definition, something the operator was not looking at:
 * it needs the toast *and* the OS notification, which surfaces even when the
 * window is in the tray.
 */
function MissedCallNotifier() {
  const { missed, clearMissed } = useCall();
  const { profileFor } = useProfiles();
  const { notify } = useToast();
  const announcedRef = useRef(new Set<string>());

  useEffect(() => {
    const fresh = missed.filter((m) => !announcedRef.current.has(m.id));
    if (fresh.length === 0) return;
    for (const m of fresh) {
      announcedRef.current.add(m.id);
      const name = profileFor(m.fromEmail).name;
      notify({ title: 'Appel manqué', body: `${name} a essayé de vous joindre.` });
      try {
        bridge().system.notify({ title: 'Appel manqué', body: `${name} a essayé de vous joindre.` });
      } catch {
        /* no native notifications on this platform — the toast already fired */
      }
    }
    // The list has done its job once announced; keeping it would re-announce
    // nothing but would grow without bound over a long session.
    clearMissed();
  }, [missed, profileFor, notify, clearMissed]);

  return null;
}

/**
 * Announces an INCOMING call to the OS (A.3).
 *
 * Until now an incoming call only rang: if the window was in the tray or
 * behind another app, nothing on screen said so, and the ringtone alone is
 * easy to miss or to have muted. Messages already had a real notification;
 * a call — the one thing that expires if unanswered — did not.
 *
 * `kind: 'call'` asks for a notification that does not auto-dismiss, so it
 * stays up exactly as long as the phone is ringing.
 */
function IncomingCallNotifier({ phase, name }: { phase: string; name: string }) {
  const announcedRef = useRef(false);

  useEffect(() => {
    if (phase !== 'incoming') {
      announcedRef.current = false;
      return;
    }
    if (announcedRef.current) return;
    announcedRef.current = true;
    try {
      bridge().system.notify({
        title: 'Appel entrant',
        body: `${name} vous appelle.`,
        kind: 'call',
      });
    } catch {
      /* no notifications on this platform — the ringtone and sheet stand alone */
    }
  }, [phase, name]);

  return null;
}

/**
 * The peer's screen while they share it (BLOC B).
 *
 * A floating panel rather than a full-screen takeover: the point of remote
 * assistance is to keep working while looking at the other machine. Fullscreen
 * is one click away for when the detail matters.
 */
function ScreenViewer({ stream, peerName }: { stream: MediaStream; peerName: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => undefined);
  }, [stream]);

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        className="elev-2 fixed bottom-24 right-6 z-[236] flex items-center gap-2 rounded-xl border border-border-strong bg-surface px-3 py-2 text-xs text-text-secondary transition-colors hover:text-text-primary"
      >
        <Monitor size={14} strokeWidth={1.75} />
        Revoir l’écran de {peerName}
      </button>
    );
  }

  return (
    <motion.div
      ref={frameRef}
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10 }}
      transition={TRANSITION}
      className="elev-3 fixed bottom-24 right-6 z-[236] w-[min(38rem,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-border-strong bg-black"
    >
      <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <Monitor size={13} strokeWidth={2} className="text-accent" />
        <p className="flex-1 truncate font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
          Écran de {peerName}
        </p>
        <button
          type="button"
          onClick={() => void frameRef.current?.requestFullscreen?.().catch(() => undefined)}
          aria-label="Plein écran"
          title="Plein écran"
          className="rounded-md p-1 text-text-muted transition-colors hover:text-text-primary"
        >
          <Maximize2 size={14} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label="Masquer l’écran partagé"
          title="Masquer"
          className="rounded-md p-1 text-text-muted transition-colors hover:text-text-primary"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      </div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="block max-h-[60vh] w-full bg-black object-contain"
      />
    </motion.div>
  );
}

export function CallOverlay() {
  const {
    phase,
    peerEmail,
    endedReason,
    muted,
    durationSec,
    peerOffline,
    sharingScreen,
    remoteScreen,
    startScreenShare,
    stopScreenShare,
    accept,
    reject,
    hangup,
    toggleMute,
  } = useCall();
  const { profileFor } = useProfiles();
  const peer = profileFor(peerEmail);

  const { notify } = useToast();
  useRingtone(phase === 'incoming');

  const toggleShare = async () => {
    if (sharingScreen) {
      await stopScreenShare();
      return;
    }
    const error = await startScreenShare();
    if (error) notify({ title: 'Partage d’écran', body: error, durationMs: 6000 });
  };

  return (
    <>
      <MissedCallNotifier />
      <IncomingCallNotifier phase={phase} name={peer.name} />

      <AnimatePresence>
        {remoteScreen && phase !== 'idle' && (
          <ScreenViewer key="screen-viewer" stream={remoteScreen} peerName={peer.name} />
        )}
      </AnimatePresence>

      {/* Incoming call — a modal sheet, because it needs an answer now. */}
      <AnimatePresence>
        {phase === 'incoming' && (
          <motion.div
            key="incoming-call"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[240] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-label={`Appel entrant de ${peer.name}`}
          >
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={TRANSITION}
              className="elev-3 w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center"
            >
              <div className="relative mx-auto w-fit">
                {/* Two staggered halos: the visual half of "it's ringing". */}
                {[0, 0.6].map((delay) => (
                  <motion.span
                    key={delay}
                    className="absolute inset-0 rounded-full border border-accent/40"
                    initial={{ opacity: 0.5, scale: 1 }}
                    animate={{ opacity: 0, scale: 1.7 }}
                    transition={{ duration: 1.6, repeat: Infinity, delay, ease: 'easeOut' }}
                    aria-hidden
                  />
                ))}
                <UserAvatar email={peerEmail} size={72} />
              </div>
              <p className="mt-5 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted">
                <PhoneIncoming size={12} strokeWidth={2} />
                Appel entrant
              </p>
              <p className="mt-2 text-xl font-semibold text-text-primary">{peer.name}</p>

              <div className="mt-7 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={reject}
                  aria-label="Refuser l’appel"
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-danger text-white transition-transform hover:scale-105"
                >
                  <PhoneOff size={22} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onClick={() => void accept()}
                  aria-label="Accepter l’appel"
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg transition-transform hover:scale-105"
                >
                  <Phone size={22} strokeWidth={1.75} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Outgoing / connecting / active / ended — a bar, so the app stays usable. */}
      <AnimatePresence>
        {phase !== 'idle' && phase !== 'incoming' && (
          <motion.div
            key="call-bar"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={TRANSITION}
            className="elev-3 fixed bottom-6 left-1/2 z-[235] flex w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-2xl border border-border-strong bg-surface px-4 py-3"
            role="status"
            aria-live="polite"
          >
            <UserAvatar email={peerEmail} size={38} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold text-text-primary">{peer.name}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
                {phase === 'outgoing' && (peerOffline ? 'Hors ligne — notifié…' : 'Sonnerie…')}
                {phase === 'connecting' && 'Connexion…'}
                {phase === 'active' && formatDuration(durationSec)}
                {phase === 'ended' && endedReason}
              </p>
            </div>

            {(phase === 'active' || phase === 'connecting') && (
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? 'Réactiver le micro' : 'Couper le micro'}
                title={muted ? 'Réactiver le micro' : 'Couper le micro'}
                className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                  muted
                    ? 'border-border-strong bg-accent-muted text-text-primary'
                    : 'border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                {muted ? <MicOff size={16} strokeWidth={1.75} /> : <Mic size={16} strokeWidth={1.75} />}
              </button>
            )}

            {(phase === 'active' || phase === 'connecting') && (
              <button
                type="button"
                onClick={() => void toggleShare()}
                aria-label={sharingScreen ? 'Arrêter le partage d’écran' : 'Partager mon écran'}
                title={sharingScreen ? 'Arrêter le partage d’écran' : 'Partager mon écran'}
                className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                  sharingScreen
                    ? 'border-accent bg-accent text-bg'
                    : 'border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                {sharingScreen ? (
                  <MonitorOff size={16} strokeWidth={1.75} />
                ) : (
                  <Monitor size={16} strokeWidth={1.75} />
                )}
              </button>
            )}

            {phase !== 'ended' && (
              <button
                type="button"
                onClick={hangup}
                aria-label="Raccrocher"
                title="Raccrocher"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-danger text-white transition-transform hover:scale-105"
              >
                <PhoneOff size={16} strokeWidth={1.75} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
