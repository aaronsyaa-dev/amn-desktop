import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Mic, MicOff, PhoneOff, Phone } from 'lucide-react';

/**
 * La page d'appel du VISITEUR anonyme (BLOC B.2).
 *
 * Conception complète et modèle de sécurité : `docs/APPEL-ANONYME.md` du dépôt
 * amn-api. Ce qu'il faut savoir en lisant ce fichier :
 *
 * ## Elle ne passe PAS par le pont de l'application
 *
 * Délibérément. Le pont (`bridge()`) porte un justificatif — jeton opérateur,
 * session nominative — et sait parler à `/v1/collections`. Le visiteur n'a
 * rien de tout cela et ne doit rien en approcher. Cette page ouvre donc sa
 * propre WebSocket avec le seul jeton qu'elle possède, et ne connaît aucune
 * autre route que la consultation publique du lien.
 *
 * C'est plus de code qu'une réutilisation de `CallContext`, et c'est le but :
 * le chemin anonyme est séparé du chemin authentifié, on peut le lire seul, et
 * il ne peut pas hériter par accident d'une capacité qu'on aurait ajoutée à
 * l'autre.
 *
 * ## Elle ne dit pas chez qui elle appelle
 *
 * Pas de logo, pas de nom d'organisation, pas d'adresse. Le serveur lui-même
 * refuse de les donner avant l'appel. Le visiteur voit « votre correspondant »
 * et rien de plus — c'est l'exigence « sans numéro visible » prise au mot.
 *
 * ## Le visiteur appelle, il ne reçoit pas
 *
 * C'est lui qui émet l'offre WebRTC en arrivant. L'hôte voit un appel entrant
 * et décroche. L'inverse — l'hôte appelle une page qui n'est pas encore
 * ouverte — n'aurait personne à joindre.
 */

const STUN_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

type Phase =
  | 'checking'
  | 'invalid'
  | 'ready'
  | 'asking-mic'
  | 'calling'
  | 'active'
  | 'ended';

/** L'adresse d'amn-api, telle que le build web la connaît. */
const API_BASE = (import.meta.env.VITE_AMN_API_URL || '').replace(/\/$/, '');

function useToken(): string {
  const [token] = useState(() => {
    const hash = window.location.hash;
    const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
    return (new URLSearchParams(query).get('token') ?? '').trim();
  });
  return token;
}

export function GuestCallScreen() {
  const token = useToken();
  const [phase, setPhase] = useState<Phase>('checking');
  const [message, setMessage] = useState('');
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const callIdRef = useRef('');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ------------------------------ Le raccrochage ---------------------------- */

  const teardown = useCallback((why: string) => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    // Le micro est coupé explicitement : une piste laissée vivante garde la
    // pastille d'enregistrement allumée dans le navigateur, ce qui est au mieux
    // inquiétant et au pire malhonnête.
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    socketRef.current?.close();
    socketRef.current = null;
    setMessage(why);
    setPhase('ended');
  }, []);

  useEffect(() => () => teardown(''), [teardown]);

  /* --------------------------- L'état du lien, d'abord ---------------------- */

  useEffect(() => {
    let alive = true;
    if (!token) {
      setPhase('invalid');
      setMessage('Ce lien est incomplet.');
      return undefined;
    }
    if (!API_BASE) {
      setPhase('invalid');
      setMessage('Cette page doit être ouverte depuis un navigateur, via le lien reçu.');
      return undefined;
    }
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/call-links/${encodeURIComponent(token)}`);
        const body = (await res.json()) as { status?: string };
        if (!alive) return;
        if (body.status === 'ready') {
          setPhase('ready');
        } else {
          setPhase('invalid');
          setMessage(
            body.status === 'used'
              ? 'Ce lien a déjà servi. Demandez-en un nouveau.'
              : 'Ce lien a expiré. Demandez-en un nouveau.',
          );
        }
      } catch {
        if (!alive) return;
        setPhase('invalid');
        setMessage('Connexion impossible pour le moment.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  /* -------------------------------- L'appel --------------------------------- */

  const start = useCallback(async () => {
    setPhase('asking-mic');
    setMessage('');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      setPhase('ready');
      setMessage('Le micro est nécessaire pour parler. Autorisez-le puis réessayez.');
      return;
    }
    streamRef.current = stream;

    const wsBase = API_BASE.replace(/^http/, 'ws');
    const socket = new WebSocket(`${wsBase}/v1/stream?link=${encodeURIComponent(token)}`);
    socketRef.current = socket;
    setPhase('calling');

    const callId = `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    callIdRef.current = callId;

    /*
      La destination n'est pas indiquée.

      Le serveur la lit dans la liaison. On envoie donc `to: ''` — non par
      négligence, mais parce que ce champ est ignoré côté serveur : le visiteur
      ne choisit pas qui il joint. Le poser ici ne servirait qu'à faire croire
      le contraire au prochain lecteur.
    */
    const send = (kind: string, payload: unknown) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'signal', kind, callId, payload }));
      }
    };

    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
    pcRef.current = pc;
    for (const track of stream.getTracks()) pc.addTrack(track, stream);

    pc.onicecandidate = (event) => {
      if (event.candidate) send('ice', event.candidate.toJSON());
    };
    pc.ontrack = (event) => {
      const [remote] = event.streams;
      if (audioRef.current && remote) {
        audioRef.current.srcObject = remote;
        void audioRef.current.play().catch(() => undefined);
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setPhase('active');
        if (!tickRef.current) {
          tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
        }
      }
      if (pc.connectionState === 'failed') {
        teardown('La connexion n’a pas pu s’établir. Votre réseau la bloque peut-être.');
      }
    };

    socket.onopen = async () => {
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      send('offer', offer);
    };

    socket.onmessage = async (event) => {
      let msg: { type?: string; kind?: string; callId?: string; payload?: unknown };
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return;
      }

      if (msg.type === 'signal:undelivered') {
        teardown('Personne n’est disponible pour le moment. Réessayez dans un instant.');
        return;
      }
      if (msg.type !== 'signal' || msg.callId !== callIdRef.current) return;

      if (msg.kind === 'answer') {
        await pc.setRemoteDescription(msg.payload as RTCSessionDescriptionInit).catch(() => undefined);
        return;
      }
      if (msg.kind === 'ice') {
        await pc.addIceCandidate(msg.payload as RTCIceCandidateInit).catch(() => undefined);
        return;
      }
      if (msg.kind === 'reject') {
        teardown('Votre appel n’a pas été pris.');
        return;
      }
      if (msg.kind === 'busy') {
        teardown('Votre correspondant est déjà en ligne.');
        return;
      }
      if (msg.kind === 'hangup') teardown('Appel terminé.');
    };

    socket.onclose = (event) => {
      // 4403 : lien déjà consommé ou révoqué. Le dire précisément évite de
      // laisser croire à une panne.
      if (event.code === 4403) {
        setPhase('invalid');
        setMessage('Ce lien a déjà servi. Demandez-en un nouveau.');
        return;
      }
      if (pcRef.current?.connectionState !== 'connected') {
        teardown('La connexion a été interrompue.');
      }
    };
  }, [teardown, token]);

  const toggleMute = () => {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    setMuted(next);
  };

  const hangUp = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({ type: 'signal', kind: 'hangup', callId: callIdRef.current }),
      );
    }
    teardown('Appel terminé.');
  };

  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      {/* Aucune marque, aucun nom d'organisation : le visiteur ne doit pas
          savoir chez qui il appelle tant que l'appel n'est pas pris. */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm border border-border bg-surface p-8 text-center"
      >
        {phase === 'checking' && (
          <>
            <Loader2 size={22} className="mx-auto animate-spin text-text-muted" />
            <p className="mt-3 text-sm text-text-secondary">Vérification du lien…</p>
          </>
        )}

        {phase === 'invalid' && (
          <>
            <h1 className="text-lg font-bold tracking-tight text-text-primary">Lien indisponible</h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{message}</p>
          </>
        )}

        {(phase === 'ready' || phase === 'asking-mic') && (
          <>
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              Votre correspondant vous attend
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Aucun compte n’est nécessaire. Rien n’est enregistré : la voix passe directement d’un
              navigateur à l’autre.
            </p>
            {message && (
              <p role="alert" className="mt-3 border border-danger/40 bg-danger-muted px-3 py-2 text-xs text-danger">
                {message}
              </p>
            )}
            <button
              type="button"
              onClick={() => void start()}
              disabled={phase === 'asking-mic'}
              className="mt-6 flex h-16 w-full items-center justify-center gap-2.5 bg-accent text-lg font-bold text-bg transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {phase === 'asking-mic' ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Phone size={20} strokeWidth={2.5} />
              )}
              Rejoindre l’appel
            </button>
          </>
        )}

        {(phase === 'calling' || phase === 'active') && (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
              {phase === 'active' ? 'En communication' : 'Appel en cours…'}
            </p>
            <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-text-primary">
              {phase === 'active' ? clock : '···'}
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? 'Réactiver le micro' : 'Couper le micro'}
                className={`flex h-14 w-14 items-center justify-center border transition-colors ${
                  muted
                    ? 'border-border-strong bg-surface-hover text-text-primary'
                    : 'border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                {muted ? <MicOff size={20} strokeWidth={2} /> : <Mic size={20} strokeWidth={2} />}
              </button>
              <button
                type="button"
                onClick={hangUp}
                aria-label="Raccrocher"
                className="flex h-14 w-14 items-center justify-center border border-danger bg-danger-muted text-danger transition-colors hover:bg-danger/20"
              >
                <PhoneOff size={20} strokeWidth={2} />
              </button>
            </div>
          </>
        )}

        {phase === 'ended' && (
          <>
            <h1 className="text-lg font-bold tracking-tight text-text-primary">Appel terminé</h1>
            {message && <p className="mt-2 text-sm leading-relaxed text-text-secondary">{message}</p>}
            <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Ce lien ne peut plus être réutilisé
            </p>
          </>
        )}

        {/* La voix du correspondant. Pas de sous-titres possibles sur un flux
            temps réel, et rien à afficher : l'élément est purement sonore. */}
        <audio ref={audioRef} autoPlay />
      </motion.div>
    </div>
  );
}
