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
import type { CallSignal, CallSignalKind, RemoteInputEvent } from '../shared/api';

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
  /**
   * True while ringing someone the hub had no open socket for. The call is NOT
   * abandoned: a push was sent, and the offer keeps being re-emitted so a phone
   * that wakes up can still catch it. It only changes what the caller reads.
   */
  peerOffline: boolean;
  /** True while WE are sharing our screen with the peer (BLOC B). */
  sharingScreen: boolean;
  /** True while the PEER is sharing theirs and we have a live video track. */
  viewingScreen: boolean;
  /**
   * Remote control (B.2). Two distinct roles, never both at once:
   *  - `controlledBy`: someone is driving THIS machine, with our consent.
   *  - `controlling`: we are driving THEIRS.
   * `controlRequested` is a pending request waiting for our explicit answer.
   */
  controlledBy: string;
  controlling: boolean;
  controlRequested: string;
  /** Why a control request was refused, shown once to the asker. */
  controlDenied: string;
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
  /** Starts sharing this screen; resolves to an error message, or null. */
  startScreenShare: () => Promise<string | null>;
  stopScreenShare: () => Promise<void>;
  /** The peer's screen while they share it — null otherwise. */
  remoteScreen: MediaStream | null;
  requestControl: () => boolean;
  answerControl: (accept: boolean) => Promise<void>;
  stopControl: () => void;
  sendInput: (event: RemoteInputEvent) => void;
}

const CallCtx = createContext<CallContextValue | undefined>(undefined);

const IDLE: CallState = {
  phase: 'idle',
  peerEmail: '',
  endedReason: '',
  muted: false,
  durationSec: 0,
  peerOffline: false,
  sharingScreen: false,
  viewingScreen: false,
  controlledBy: '',
  controlling: false,
  controlRequested: '',
  controlDenied: '',
};

/**
 * How often the offer is re-sent while ringing an operator who was not
 * connected (A.3). A closed PWA is woken by push, then needs a few seconds to
 * start, register and open its socket — by which time the single original
 * offer is long gone. Re-emitting it is what makes the push actually able to
 * connect a call rather than merely display a notification.
 */
const REOFFER_INTERVAL_MS = 3_000;

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
  /** Re-sends the offer while ringing, so a push-woken device can still answer. */
  const reofferTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** The screen capture we are sending, and the sender it is attached to. */
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenSenderRef = useRef<RTCRtpSender | null>(null);
  /** The peer's screen, handed to the viewer component. */
  const [remoteScreen, setRemoteScreen] = useState<MediaStream | null>(null);
  /**
   * Input channel for remote control. Separate from the media path on purpose:
   * a data channel carries the events without touching the video encoder, and
   * closing it stops control instantly and unconditionally.
   */
  const controlChannelRef = useRef<RTCDataChannel | null>(null);
  /** Consent, held where the decision is made — never inferred from a message. */
  const grantedRef = useRef(false);
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
    for (const i of [durationTimerRef, reofferTimerRef]) {
      if (i.current) {
        clearInterval(i.current);
        i.current = null;
      }
    }

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    // A screen capture left running keeps the OS "partage en cours" indicator
    // on and the frames flowing — the video equivalent of a hot microphone,
    // and the worst thing this feature can leak.
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    screenSenderRef.current = null;
    setRemoteScreen(null);

    // Control dies with the call, unconditionally and without needing a
    // message to arrive: a dropped line must never leave a machine driveable.
    grantedRef.current = false;
    try {
      controlChannelRef.current?.close();
    } catch {
      /* already closed */
    }
    controlChannelRef.current = null;

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

  /**
   * Wires the control channel (B.2).
   *
   * Every message is checked against the state this side actually holds:
   * an `input` frame is executed ONLY while `grantedRef` is true, so a peer
   * that sends input without asking — or after control was revoked — is
   * ignored rather than trusted. Consent is never inferred from the traffic.
   */
  const attachControlChannel = useCallback((channel: RTCDataChannel) => {
    controlChannelRef.current = channel;

    channel.onmessage = (event) => {
      let msg: { t?: string; reason?: string; ev?: unknown };
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return;
      }

      if (msg.t === 'control:request') {
        // Never automatic, never silent: this only raises the question.
        setState((prev) => ({ ...prev, controlRequested: peerRef.current }));
      } else if (msg.t === 'control:grant') {
        setState((prev) => ({ ...prev, controlling: true, controlDenied: '' }));
      } else if (msg.t === 'control:deny') {
        setState((prev) => ({
          ...prev,
          controlling: false,
          controlDenied: msg.reason || 'Contrôle refusé.',
        }));
      } else if (msg.t === 'control:stop') {
        grantedRef.current = false;
        setState((prev) => ({ ...prev, controlling: false, controlledBy: '', controlRequested: '' }));
      } else if (msg.t === 'input') {
        if (!grantedRef.current) return;
        void bridge().system.injectRemoteInput(msg.ev as RemoteInputEvent).catch(() => false);
      }
    };

    // A dropped connection must not leave a machine under someone else's
    // control: closing the channel revokes it, with no message required.
    const revoke = () => {
      grantedRef.current = false;
      setState((prev) =>
        prev.controlledBy || prev.controlling || prev.controlRequested
          ? { ...prev, controlledBy: '', controlling: false, controlRequested: '' }
          : prev,
      );
    };
    channel.onclose = revoke;
    channel.onerror = revoke;
  }, []);

  /** Builds the peer connection and attaches the microphone. */
  const preparePeer = useCallback(
    async (peerEmail: string, callId: string): Promise<RTCPeerConnection> => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // The control channel is created by BOTH sides at call setup (negotiated
      // with a fixed id) rather than by whoever shares later: creating it during
      // a renegotiation would need yet another round trip, and an input path
      // that appears mid-session is harder to reason about than one that is
      // simply always there and always idle until control is granted.
      attachControlChannel(pc.createDataChannel('amn-control', { negotiated: true, id: 7 }));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          void send(peerEmail, 'ice', callId, event.candidate.toJSON());
        }
      };

      pc.ontrack = (event) => {
        // Video means the peer started sharing their screen. It is handed to
        // React rather than to a hidden element: this one has a UI.
        if (event.track.kind === 'video') {
          const stream = event.streams[0] ?? new MediaStream([event.track]);
          setRemoteScreen(stream);
          setState((prev) => ({ ...prev, viewingScreen: true }));
          event.track.onended = () => {
            setRemoteScreen(null);
            setState((prev) => ({ ...prev, viewingScreen: false }));
          };
          // `mute` fires when the sender removes the track without ending the
          // call — stopping the share must clear the viewer either way.
          event.track.onmute = () => {
            setRemoteScreen(null);
            setState((prev) => ({ ...prev, viewingScreen: false }));
          };
          return;
        }

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
    [send, teardown, attachControlChannel],
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

      // Keep re-emitting the offer for as long as it rings. Harmless when the
      // callee is already connected (they are in `incoming` and answer `busy`
      // to nothing — duplicate offers for the SAME callId are ignored below),
      // and essential when they are not: it is the only way a device woken by
      // the push notification can join a call that started before it existed.
      reofferTimerRef.current = setInterval(() => {
        const local = pcRef.current?.localDescription;
        if (!local || callIdRef.current !== callId) return;
        void send(to, 'offer', callId, local.toJSON());
      }, REOFFER_INTERVAL_MS);

      ringTimerRef.current = setTimeout(() => {
        void send(to, 'hangup', callId);
        teardown(
          stateRef.current.peerOffline
            ? 'Correspondant hors ligne — notification envoyée.'
            : 'Pas de réponse.',
        );
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

  // --- Partage d'écran (BLOC B) --------------------------------------------
  //
  // The screen rides the SAME peer connection as the audio: one connection, one
  // ICE negotiation, one thing to tear down. Adding the track means the call
  // must be renegotiated, which is why `renegotiate` exists as its own signal
  // kind — a second plain `offer` would be read as a new incoming call.

  const startScreenShare = useCallback(async (): Promise<string | null> => {
    const pc = pcRef.current;
    const to = peerRef.current;
    const callId = callIdRef.current;
    if (!pc || !to || !callId) return "Aucun appel en cours.";
    if (screenSenderRef.current) return null; // already sharing

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        // Latency over compression: a support session needs the cursor to move
        // now, not to look pretty in three frames' time.
        video: { frameRate: { ideal: 15, max: 30 } },
        audio: false,
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      return name === "NotAllowedError"
        ? "Partage refusé — autorisez la capture d'écran."
        : "Capture d'écran indisponible sur ce poste.";
    }

    const track = stream.getVideoTracks()[0];
    if (!track) {
      stream.getTracks().forEach((t) => t.stop());
      return "Aucun écran à partager.";
    }

    screenStreamRef.current = stream;
    screenSenderRef.current = pc.addTrack(track, stream);
    setState((prev) => ({ ...prev, sharingScreen: true }));

    // Stopping from the OS's own "arrêter le partage" bar must land in the same
    // place as stopping from ours, or the UI would keep claiming to share.
    track.onended = () => {
      void stopScreenShareRef.current?.();
    };

    // Encoding tuned once the sender exists: motion over detail, and a ceiling
    // so a 4K screen doesn't saturate the uplink and add seconds of latency.
    try {
      const params = screenSenderRef.current.getParameters();
      params.degradationPreference = "maintain-framerate";
      params.encodings = [{ maxBitrate: 2_500_000, maxFramerate: 30 }];
      await screenSenderRef.current.setParameters(params);
    } catch {
      /* older stacks ignore this; the share still works, just less tuned */
    }

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await send(to, "renegotiate", callId, offer);
    } catch {
      return "La renégociation de l'appel a échoué.";
    }
    return null;
  }, [send]);

  const stopScreenShare = useCallback(async (): Promise<void> => {
    const pc = pcRef.current;
    const sender = screenSenderRef.current;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    screenSenderRef.current = null;
    setState((prev) => ({ ...prev, sharingScreen: false }));
    if (!pc || !sender) return;

    try {
      pc.removeTrack(sender);
      const to = peerRef.current;
      const callId = callIdRef.current;
      if (to && callId) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await send(to, "renegotiate", callId, offer);
      }
    } catch {
      /* the tracks are already stopped — nothing is still being captured */
    }
  }, [send]);

  // The OS "stop sharing" handler is installed before stopScreenShare exists,
  // so it goes through a ref rather than capturing a stale closure.
  const stopScreenShareRef = useRef<(() => Promise<void>) | null>(null);
  stopScreenShareRef.current = stopScreenShare;

  // --- Contrôle à distance (B.2) -------------------------------------------

  const sendControl = useCallback((payload: Record<string, unknown>): boolean => {
    const channel = controlChannelRef.current;
    if (!channel || channel.readyState !== 'open') return false;
    try {
      channel.send(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }, []);

  /** Asks the peer for control of their machine. They must accept explicitly. */
  const requestControl = useCallback((): boolean => {
    setState((prev) => ({ ...prev, controlDenied: '' }));
    return sendControl({ t: 'control:request' });
  }, [sendControl]);

  /**
   * Answers a pending request. Granting is the ONLY thing that opens the input
   * path, and it refuses itself when this machine cannot be driven at all —
   * saying so is better than granting a control that would silently do nothing.
   */
  const answerControl = useCallback(
    async (accept: boolean): Promise<void> => {
      if (!accept) {
        grantedRef.current = false;
        setState((prev) => ({ ...prev, controlRequested: '', controlledBy: '' }));
        sendControl({ t: 'control:deny', reason: 'Contrôle refusé.' });
        return;
      }

      const capable = await bridge().system.canBeRemoteControlled().catch(() => false);
      if (!capable) {
        setState((prev) => ({ ...prev, controlRequested: '', controlledBy: '' }));
        sendControl({
          t: 'control:deny',
          reason: "Ce poste ne peut pas être piloté à distance (fonction indisponible).",
        });
        return;
      }

      grantedRef.current = true;
      setState((prev) => ({ ...prev, controlledBy: peerRef.current, controlRequested: '' }));
      sendControl({ t: 'control:grant' });
    },
    [sendControl],
  );

  /** Ends control, from either side. Always available, always immediate. */
  const stopControl = useCallback(() => {
    grantedRef.current = false;
    setState((prev) => ({ ...prev, controlledBy: '', controlling: false, controlRequested: '' }));
    sendControl({ t: 'control:stop' });
  }, [sendControl]);

  /** Sends one input event while controlling. No-op otherwise. */
  const sendInput = useCallback(
    (event: RemoteInputEvent) => {
      if (!stateRef.current.controlling) return;
      sendControl({ t: 'input', ev: event });
    },
    [sendControl],
  );

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
        // A re-emitted offer for the call we are ALREADY handling is not a new
        // call: the caller repeats it so a device woken by push can catch it.
        // Answering `busy` here would hang up the very call we are ringing for.
        if (signal.callId === callIdRef.current) return;
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
        // They picked up — stop repeating the offer.
        if (reofferTimerRef.current) {
          clearInterval(reofferTimerRef.current);
          reofferTimerRef.current = null;
        }
        setState((prev) => ({ ...prev, phase: 'connecting', peerOffline: false }));
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
      } else if (signal.kind === 'renegotiate') {
        // The peer added or removed their screen track on the live call.
        // Answering is unconditional: it changes what we RECEIVE, and refusing
        // would leave the connection in a half-negotiated state.
        const pc = pcRef.current;
        if (!pc) return;
        void (async () => {
          try {
            await pc.setRemoteDescription(
              new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit),
            );
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await send(from, 'renegotiate-answer', signal.callId, answer);
          } catch {
            /* a failed renegotiation must never drop the audio call itself */
          }
        })();
      } else if (signal.kind === 'renegotiate-answer') {
        const pc = pcRef.current;
        if (!pc) return;
        void pc
          .setRemoteDescription(
            new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit),
          )
          .catch(() => undefined);
      } else if (signal.kind === 'undelivered') {
        // The hub had no socket for the callee. This used to end the call on
        // the spot — which made the Web Push pointless: the phone rang, the
        // operator tapped, and by then the caller had already given up.
        //
        // Now it only changes what the caller reads. The call keeps ringing
        // (and the offer keeps being re-sent) for the full ring window, so a
        // device woken by the push has time to start and answer. If nobody
        // does, RING_TIMEOUT_MS ends it with the honest "hors ligne" message.
        const undeliveredKind = (signal.payload as { kind?: string } | null)?.kind;
        if (phase === 'outgoing' && (!undeliveredKind || undeliveredKind === 'offer')) {
          setState((prev) => (prev.peerOffline ? prev : { ...prev, peerOffline: true }));
        }
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
      startScreenShare,
      stopScreenShare,
      remoteScreen,
      requestControl,
      answerControl,
      stopControl,
      sendInput,
    }),
    [
      state,
      callsAvailable,
      call,
      accept,
      reject,
      hangup,
      toggleMute,
      missed,
      clearMissed,
      startScreenShare,
      stopScreenShare,
      remoteScreen,
      requestControl,
      answerControl,
      stopControl,
      sendInput,
    ],
  );

  return <CallCtx.Provider value={value}>{children}</CallCtx.Provider>;
}

/*
  SANS FOURNISSEUR, UN APPEL IMPOSSIBLE — PAS UN ÉCRAN CASSÉ.

  Le Trombinoscope, les Appels et les Messages privés lisent l'état des
  appels. Dans une coquille qui ne monte pas CallProvider (le contexte de
  support, un test), lever une exception faisait tomber tout l'écran pour
  un bouton qui aurait simplement dû rester grisé. Le repli dit la vérité :
  aucun appel n'est possible ici, et tout le reste s'affiche.
*/
const SANS_APPELS: CallContextValue = {
  ...IDLE,
  callsAvailable: false,
  call: async () => undefined,
  accept: async () => undefined,
  reject: () => undefined,
  hangup: () => undefined,
  toggleMute: () => undefined,
  missed: [],
  clearMissed: () => undefined,
  startScreenShare: async () => 'Les appels ne sont pas disponibles ici.',
  stopScreenShare: async () => undefined,
  remoteScreen: null,
  requestControl: () => false,
  answerControl: async () => undefined,
  stopControl: () => undefined,
  sendInput: () => undefined,
};

export function useCall(): CallContextValue {
  const ctx = useContext(CallCtx);
  return ctx ?? SANS_APPELS;
}

/** `123` -> `2:03`. */
export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
