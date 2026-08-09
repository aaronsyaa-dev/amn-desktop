import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { bridge } from '../lib/bridge';
import { useAuth } from '../auth/AuthContext';
import type { CallSignal, CallSignalKind } from '../shared/api';

/**
 * Operator-to-operator audio calls (BLOC 2).
 *
 * Media is peer-to-peer WebRTC. amn-api only relays the handshake (offer /
 * answer / ICE) between two sockets of the same organization — it never sees
 * the audio, and the SDP it carries is opaque to it.
 *
 * V1 uses public STUN only, no TURN. That covers the common case (both peers
 * behind ordinary NAT) and fails honestly when it doesn't: after
 * CONNECT_TIMEOUT_MS without a connected ICE state the call ends with a clear
 * message rather than hanging on a silent line.
 */

const STUN_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

/** How long an unanswered call rings before giving up. */
const RING_TIMEOUT_MS = 35_000;
/** How long we wait for the media path to come up once the call is accepted. */
const CONNECT_TIMEOUT_MS = 20_000;

export type CallPhase =
  /** No call in progress. */
  | 'idle'
  /** We called someone and are waiting for them to pick up. */
  | 'outgoing'
  /** Someone is calling us and we haven't answered yet. */
  | 'incoming'
  /** Accepted on both sides; the media path is coming up. */
  | 'connecting'
  /** Audio is flowing. */
  | 'active'
  /** Terminal: showing why the call ended, then back to idle. */
  | 'ended';

export interface CallState {
  phase: CallPhase;
  /** The other operator's email, whichever direction the call went. */
  peerEmail: string;
  /** Why the call ended — shown once, in the `ended` phase. */
  endedReason: string;
  muted: boolean;
  /** Seconds of connected audio; 0 until the call is active. */
  durationSec: number;
}

export interface MissedCall {
  id: string;
  fromEmail: string;
  at: string;
}

interface CallContextValue extends CallState {
  /** True when calls can be placed at all (a live amn-api socket is required). */
  callsAvailable: boolean;
  call: (peerEmail: string) => Promise<void>;
  accept: () => Promise<void>;
  reject: () => void;
  hangup: () => void;
  toggleMute: () => void;
  missed: MissedCall[];
  clearMissed: () => void;
}

const CallCtx = createContext<CallContextValue | undefined>(undefined);

const IDLE: CallState = {
  phase: 'idle',
  peerEmail: '',
  endedReason: '',
  muted: false,
  durationSec: 0,
};

function newCallId(): string {
  return `call-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const myEmail = (user?.email ?? '').trim().toLowerCase();

  const [state, setState] = useState<CallState>(IDLE);
  const [missed, setMissed] = useState<MissedCall[]>([]);
  const [callsAvailable, setCallsAvailable] = useState(false);

  // Everything below the React state is a live resource that must be released
  // exactly once. Refs (not state) because the signal handler and the timers
  // run outside React's render cycle and must see the current values.
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const callIdRef = useRef<string>('');
  const peerRef = useRef<string>('');
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Offer held between "incoming" and the moment the operator accepts. */
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  /**
   * ICE candidates that arrived before the remote description was set. Adding
   * one early throws and silently kills the connection, so they are queued and
   * flushed once the description lands.
   */
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  const send = useCallback(
    async (to: string, kind: CallSignalKind, callId: string, payload?: unknown) => {
      try {
        return await bridge().remote.sendCallSignal({ to, kind, callId, payload });
      } catch {
        return false;
      }
    },
    [],
  );

  /**
   * Tears every call resource down. Deliberately total and idempotent: the
   * microphone must stop on *every* path out of a call — hang up, refusal,
   * timeout, peer disconnect, unmount — because a track left live keeps the OS
   * recording indicator on and is the single worst bug this feature can ship.
   */
  const teardown = useCallback((reason: string) => {
    for (const t of [ringTimerRef, connectTimerRef, endedTimerRef]) {
      if (t.current) {
        clearTimeout(t.current);
        t.current = null;
      }
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      try {
        pcRef.current.close();
      } catch {
        /* already closed */
      }
      pcRef.current = null;
    }

    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current.remove();
      audioElRef.current = null;
    }

    callIdRef.current = '';
    peerRef.current = '';
    pendingOfferRef.current = null;
    pendingIceRef.current = [];

    if (reason) {
      setState((s) => ({ ...IDLE, phase: 'ended', peerEmail: s.peerEmail, endedReason: reason }));
      // The reason is worth reading, not worth blocking the app: it clears
      // itself so the operator never has to dismiss a dead call banner.
      endedTimerRef.current = setTimeout(() => setState(IDLE), 4000);
    } else {
      setState(IDLE);
    }
  }, []);

  /** Builds the peer connection and attaches the microphone. */
  const preparePeer = useCallback(
    async (peerEmail: string, callId: string): Promise<RTCPeerConnection> => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          void send(peerEmail, 'ice', callId, event.candidate.toJSON());
        }
      };

      pc.ontrack = (event) => {
        // The element is attached to <body> rather than kept detached: a
        // detached media element is not guaranteed to keep playing in Chromium,
        // and this is the one part of the call the operator actually hears. It
        // carries no UI — playback only — and teardown removes it.
        let el = audioElRef.current;
        if (!el) {
          el = document.createElement('audio');
          el.autoplay = true;
          el.setAttribute('data-amn-call-audio', '');
          el.style.display = 'none';
          document.body.appendChild(el);
          audioElRef.current = el;
        }
        el.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        void el.play().catch(() => {
          /* autoplay policies don't apply to a user-initiated call, but never throw */
        });
      };

      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if (s === 'connected') {
          if (connectTimerRef.current) {
            clearTimeout(connectTimerRef.current);
            connectTimerRef.current = null;
          }
          setState((prev) => ({ ...prev, phase: 'active', durationSec: 0 }));
          if (!durationTimerRef.current) {
            durationTimerRef.current = setInterval(
              () => setState((prev) => ({ ...prev, durationSec: prev.durationSec + 1 })),
              1000,
            );
          }
        } else if (s === 'failed') {
          // No TURN in V1: a symmetric-NAT pair lands here. Say so plainly.
          teardown('Connexion audio impossible entre les deux postes.');
        } else if (s === 'disconnected' || s === 'closed') {
          if (pcRef.current === pc) teardown('Appel interrompu.');
        }
      };

      return pc;
    },
    [send, teardown],
  );

  const call = useCallback(
    async (peerEmail: string) => {
      const to = peerEmail.trim().toLowerCase();
      if (!to || to === myEmail) return;
      if (state.phase !== 'idle' && state.phase !== 'ended') return;

      const callId = newCallId();
      callIdRef.current = callId;
      peerRef.current = to;
      setState({ ...IDLE, phase: 'outgoing', peerEmail: to });

      let pc: RTCPeerConnection;
      try {
        pc = await preparePeer(to, callId);
      } catch {
        teardown('Micro indisponible — autorisez le microphone puis réessayez.');
        return;
      }

      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);
        const ok = await send(to, 'offer', callId, offer);
        if (!ok) {
          teardown('Hors ligne — impossible de joindre le serveur AMN.');
          return;
        }
      } catch {
        teardown("L'appel n'a pas pu être établi.");
        return;
      }

      ringTimerRef.current = setTimeout(() => {
        void send(to, 'hangup', callId);
        teardown('Pas de réponse.');
      }, RING_TIMEOUT_MS);
    },
    [myEmail, preparePeer, send, state.phase, teardown],
  );

  const accept = useCallback(async () => {
    const offer = pendingOfferRef.current;
    const callId = callIdRef.current;
    const from = peerRef.current;
    if (!offer || !callId || !from) return;

    setState((prev) => ({ ...prev, phase: 'connecting' }));
    if (ringTimerRef.current) {
      clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
    }

    let pc: RTCPeerConnection;
    try {
      pc = await preparePeer(from, callId);
    } catch {
      void send(from, 'reject', callId);
      teardown('Micro indisponible — autorisez le microphone puis réessayez.');
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      for (const candidate of pendingIceRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
      }
      pendingIceRef.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await send(from, 'answer', callId, answer);
    } catch {
      teardown("L'appel n'a pas pu être établi.");
      return;
    }

    connectTimerRef.current = setTimeout(
      () => teardown('Connexion audio impossible entre les deux postes.'),
      CONNECT_TIMEOUT_MS,
    );
  }, [preparePeer, send, teardown]);

  const reject = useCallback(() => {
    if (peerRef.current && callIdRef.current) {
      void send(peerRef.current, 'reject', callIdRef.current);
    }
    teardown('');
  }, [send, teardown]);

  const hangup = useCallback(() => {
    if (peerRef.current && callIdRef.current) {
      void send(peerRef.current, 'hangup', callIdRef.current);
    }
    teardown('Appel terminé.');
  }, [send, teardown]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !stream.getAudioTracks().every((t) => !t.enabled);
    // `enabled = false` keeps the track (and the connection) alive but sends
    // silence — the correct mute, as opposed to stopping the track, which
    // would end the call's audio for good.
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    setState((prev) => ({ ...prev, muted: next }));
  }, []);

  const clearMissed = useCallback(() => setMissed([]), []);

  // --- Inbound signalling -------------------------------------------------
  //
  // Kept in a ref-driven effect with a stable subscription: re-subscribing on
  // every state change would drop signals arriving in that gap.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!myEmail) return undefined;

    const onSignal = (signal: CallSignal) => {
      const phase = stateRef.current.phase;
      const from = (signal.from || '').trim().toLowerCase();

      if (signal.kind === 'offer') {
        // Already busy: refuse straight away so the caller hears "occupé"
        // instead of ringing at a machine that will never pick up.
        if (phase !== 'idle' && phase !== 'ended') {
          void send(from, 'busy', signal.callId);
          return;
        }
        pendingOfferRef.current = signal.payload as RTCSessionDescriptionInit;
        pendingIceRef.current = [];
        callIdRef.current = signal.callId;
        peerRef.current = from;
        setState({ ...IDLE, phase: 'incoming', peerEmail: from });
        ringTimerRef.current = setTimeout(() => {
          setMissed((prev) => [
            { id: signal.callId, fromEmail: from, at: new Date().toISOString() },
            ...prev,
          ]);
          void send(from, 'reject', signal.callId);
          teardown('');
        }, RING_TIMEOUT_MS);
        return;
      }

      // Everything else only makes sense for the call currently in progress.
      // Stale signals from an abandoned attempt must never disturb a live one.
      if (signal.callId !== callIdRef.current) return;

      if (signal.kind === 'answer') {
        const pc = pcRef.current;
        if (!pc) return;
        if (ringTimerRef.current) {
          clearTimeout(ringTimerRef.current);
          ringTimerRef.current = null;
        }
        setState((prev) => ({ ...prev, phase: 'connecting' }));
        void pc
          .setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit))
          .then(async () => {
            for (const candidate of pendingIceRef.current) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
            }
            pendingIceRef.current = [];
          })
          .catch(() => teardown("L'appel n'a pas pu être établi."));
        connectTimerRef.current = setTimeout(
          () => teardown('Connexion audio impossible entre les deux postes.'),
          CONNECT_TIMEOUT_MS,
        );
      } else if (signal.kind === 'ice') {
        const candidate = signal.payload as RTCIceCandidateInit;
        const pc = pcRef.current;
        if (!pc || !pc.remoteDescription) {
          pendingIceRef.current.push(candidate);
          return;
        }
        void pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
      } else if (signal.kind === 'reject') {
        teardown(phase === 'outgoing' ? 'Appel refusé.' : '');
      } else if (signal.kind === 'busy') {
        teardown('Occupé — déjà en appel.');
      } else if (signal.kind === 'hangup') {
        if (phase === 'incoming') {
          setMissed((prev) => [
            { id: signal.callId, fromEmail: from, at: new Date().toISOString() },
            ...prev,
          ]);
          teardown('');
        } else {
          teardown('Appel terminé.');
        }
      } else if (signal.kind === 'undelivered') {
        // The hub had no socket for the callee. Only meaningful while we're
        // the one ringing — an undelivered hangup is not worth a message.
        if (phase === 'outgoing') teardown('Correspondant hors ligne.');
      }
    };

    return bridge().remote.onCallSignal(onSignal);
  }, [myEmail, send, teardown]);

  // Calls need the live socket, so the button follows the connection badge
  // rather than pretending to work while offline.
  useEffect(() => {
    let cancelled = false;
    const apply = (status: string) => {
      if (!cancelled) setCallsAvailable(status === 'online');
    };
    void bridge().remote.getConnectionStatus().then(apply).catch(() => undefined);
    const unsubscribe = bridge().remote.onConnectionStatusChange(apply);
    return () => {
      // The initial getConnectionStatus() promise can resolve after unmount;
      // without the flag it would set state on a dead component.
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // A window closed mid-call must not leave the microphone recording.
  useEffect(() => () => teardown(''), [teardown]);

  const value = useMemo<CallContextValue>(
    () => ({
      ...state,
      callsAvailable,
      call,
      accept,
      reject,
      hangup,
      toggleMute,
      missed,
      clearMissed,
    }),
    [state, callsAvailable, call, accept, reject, hangup, toggleMute, missed, clearMissed],
  );

  return <CallCtx.Provider value={value}>{children}</CallCtx.Provider>;
}

export function useCall(): CallContextValue {
  const ctx = useContext(CallCtx);
  if (!ctx) throw new Error('useCall must be used within a CallProvider');
  return ctx;
}

/** `123` -> `2:03`. */
export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
