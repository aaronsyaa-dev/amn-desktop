import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { bridge } from '../lib/bridge';
import type { InvitationLue } from '../shared/api';
import { cleanErrorMessage } from '../lib/errorMessage';
import { Logo } from '../components/Logo';

/**
 * L'activation d'un compte invité (BLOC B.1).
 *
 * ## Ce qui manquait
 *
 * Le serveur savait déjà émettre une invitation propre — jeton à usage unique,
 * daté, et c'est l'invitée qui choisit son mot de passe (`POST
 * /v1/auth/invitations`, puis `/v1/auth/invitations/accept`). Mais aucun écran
 * ne permettait de s'en servir : le lien existait et ne menait nulle part.
 * Faute de quoi la seule façon d'ouvrir un accès à une cliente était de lui
 * fabriquer un mot de passe temporaire et de le lui dicter — c'est-à-dire de
 * transmettre un secret par un canal qu'on ne maîtrise pas, et qui reste
 * valable tant que personne n'y repense.
 *
 * ## Le jeton vient de l'adresse, et en disparaît
 *
 * Il arrive par `#/invitation?token=…`. Une fois lu, il est RETIRÉ de la barre
 * d'adresse : une invitation est un secret, et un secret n'a rien à faire dans
 * l'historique du navigateur, dans une capture d'écran, ni dans un lien
 * recollé à quelqu'un d'autre.
 *
 * ## Lire avant d'activer (chantier « arrivée cliente »)
 *
 * L'écran lit d'abord l'invitation (`POST /v1/auth/invitations/lire`) : chez
 * qui elle mène, qui l'a envoyée, et dans quel état elle est — valable,
 * expirée, déjà utilisée, ou lien incomplet. Chaque état a sa suite : choisir
 * son mot de passe, en redemander une, se connecter, recoller le lien.
 *
 * Ce que l'écran ne peut toujours PAS faire : sonder. Un jeton inconnu reçoit
 * la même réponse qu'un lien tronqué (« incomplet »), et le serveur freine qui
 * insiste. Seul le porteur d'un vrai lien voit les autres états.
 *
 * Mise en page provisoire, avec les briques du système : le laissez-passer du
 * cahier (43b–43e) la remplacera sans changer ce qu'elle dit.
 */

/** Le minimum exigé par amn-api. Répété ici pour le dire AVANT d'envoyer. */
const MIN_LENGTH = 8;

/** Un état d'invitation qui ne se termine pas par un formulaire : ce qui se passe, et la suite. */
function EtatInvitation({ titre, texte, onLogin, principal = false }: { titre: string; texte: string; onLogin: () => void; principal?: boolean }) {
  return (
    <div className="mt-8">
      <h1 className="text-2xl font-bold tracking-tight text-text-primary">{titre}</h1>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">{texte}</p>
      <button
        type="button"
        onClick={onLogin}
        className={
          principal
            ? 'mt-6 flex min-h-12 w-full items-center justify-center bg-accent text-sm font-semibold text-bg hover:bg-accent-hover'
            : 'mt-6 flex min-h-11 w-full items-center justify-center border border-border-strong text-sm text-text-primary hover:bg-surface-hover'
        }
      >
        Me connecter
      </button>
    </div>
  );
}

export function InvitationScreen() {
  const { acceptInvitation } = useAuth();
  const navigate = useNavigate();

  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [lue, setLue] = useState<InvitationLue | null>(null);
  const [lecture, setLecture] = useState<'attente' | 'lue' | 'freinee' | 'erreur'>('attente');

  /* La lecture, une fois le jeton connu. Rien à lire sans jeton : l'écran demande le code. */
  useEffect(() => {
    if (!token) return;
    let vivant = true;
    setLecture('attente');
    bridge().remote.lireInvitation(token.trim())
      .then((r) => { if (vivant) { setLue(r); setLecture('lue'); } })
      .catch((err: unknown) => {
        if (!vivant) return;
        setLecture(/429|trop de tentatives/i.test(String(err instanceof Error ? err.message : err)) ? 'freinee' : 'erreur');
      });
    return () => { vivant = false; };
  }, [token]);
  const dateLongue = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
  const qui = lue?.invitePar ?? lue?.organisation?.nom ?? 'la personne qui vous a invitée';

  /*
    Le jeton est lu une fois, puis effacé de l'adresse.

    `history.replaceState` plutôt qu'une navigation : recharger la page ne doit
    pas ramener le jeton, et l'entrée d'historique ne doit pas le conserver.
  */
  useEffect(() => {
    const hash = window.location.hash;
    const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
    const found = new URLSearchParams(query).get('token') ?? '';
    if (found) {
      setToken(found.trim());
      window.history.replaceState(null, '', `${window.location.pathname}#/invitation`);
    }
  }, []);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirmation.length > 0 && confirmation !== password;
  const ready = useMemo(
    () => token.trim().length > 0 && password.length >= MIN_LENGTH && confirmation === password,
    [token, password, confirmation],
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await acceptInvitation(token.trim(), password);
      setDone(true);
      // Un temps d'arrêt volontaire : l'activation est le seul moment où la
      // personne apprend que son compte existe, et l'enchaîner en une frame
      // donnerait l'impression que rien ne s'est passé.
      window.setTimeout(() => navigate('/', { replace: true }), 1200);
    } catch (err) {
      setError(cleanErrorMessage(err, 'Ce lien d’invitation n’est plus valable.'));
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="w-full max-w-md border border-border bg-surface p-6 sm:p-8"
      >
        <Logo className="h-7 w-auto" />

        {lue?.organisation && lue.etat !== 'incomplet' && (
          <div className="mt-6 border-l-2 border-border-strong pl-3" data-invitation-etat={lue.etat}>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">Votre espace</p>
            <p className="text-lg font-semibold text-text-primary">{lue.organisation.nom}</p>
            <p className="text-xs text-text-secondary">
              {lue.invitePar ? `Invitée par ${lue.invitePar}` : 'Invitation'}
              {lue.destinataire ? ` · pour ${lue.destinataire}` : ''}
              {lue.etat === 'valable' && lue.expireLe ? ` · valable jusqu’au ${dateLongue(lue.expireLe)}` : ''}
            </p>
          </div>
        )}

        {lecture === 'freinee' ? (
          <EtatInvitation titre="Trop de tentatives" texte="Ce poste a essayé trop de liens d’invitation. Réessayez dans quelques minutes, depuis le lien reçu par courriel." onLogin={() => navigate('/login', { replace: true })} />
        ) : lue?.etat === 'utilise' ? (
          <EtatInvitation titre="Ce lien a déjà servi" texte={`Votre espace ${lue.organisation?.nom ?? ''} est activé. Connectez-vous avec l’adresse invitée et le mot de passe choisi.`} onLogin={() => navigate('/login', { replace: true })} principal />
        ) : lue?.etat === 'expire' ? (
          <EtatInvitation titre="Ce lien a expiré" texte={`Il valait jusqu’au ${dateLongue(lue.expireLe)}. Rien n’est perdu : demandez-en un nouveau à ${qui}.`} onLogin={() => navigate('/login', { replace: true })} />
        ) : lue?.etat === 'suspendu' ? (
          <EtatInvitation titre="Cet espace est en pause" texte={`L’activation reprendra quand ${qui} l’aura rouvert.`} onLogin={() => navigate('/login', { replace: true })} />
        ) : lue?.etat === 'incomplet' ? (
          <div data-invitation-etat="incomplet">
            <EtatInvitation titre="Ce lien est incomplet" texte="Il a sans doute été coupé en chemin. Rouvrez-le depuis le courriel reçu, en entier — ou collez ci-dessous le lien complet." onLogin={() => navigate('/login', { replace: true })} />
            <input
              onChange={(e) => {
                const v = e.target.value.trim();
                const t = v.includes('token=') ? decodeURIComponent(v.slice(v.indexOf('token=') + 6).split('&')[0]) : v;
                if (t.length >= 43) { setLue(null); setToken(t); }
              }}
              placeholder="Collez le lien reçu"
              aria-label="Lien d’invitation"
              className="input-focus mt-3 min-h-12 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
            />
          </div>
        ) : done ? (
          <div className="mt-8 flex flex-col items-center text-center">
            <span className="flex h-12 w-12 items-center justify-center border border-accent text-accent">
              <Check size={24} strokeWidth={2.25} />
            </span>
            <h1 className="mt-4 text-xl font-bold tracking-tight text-text-primary">
              Votre compte est activé
            </h1>
            <p className="mt-1 text-sm text-text-secondary">Ouverture de votre espace…</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
              <ShieldCheck size={13} strokeWidth={2} />
              Activation de votre accès
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-text-primary">
              Choisissez votre mot de passe
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Il n’a jamais été transmis à personne, et personne ne peut le lire — pas même nous.
              C’est vous qui le fixez, maintenant.
            </p>

            {/* Le champ jeton n'apparaît que si le lien ne l'a pas fourni : le
                cas normal est un lien complet, et montrer un champ déjà rempli
                d'une chaîne illisible n'aide personne. */}
            {!token && (
              <label className="mt-6 block">
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  Code d’invitation
                </span>
                <div className="flex min-h-12 items-center border border-border bg-bg px-3">
                  <KeyRound size={15} strokeWidth={1.9} className="mr-2 flex-shrink-0 text-text-muted" />
                  <input
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    autoFocus
                    placeholder="Collez le code reçu"
                    aria-label="Code d’invitation"
                    className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none"
                  />
                </div>
              </label>
            )}

            <label className="mt-5 block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
                Mot de passe
              </span>
              <div className="flex min-h-12 items-center border border-border bg-bg px-3">
                <input
                  type={visible ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus={Boolean(token)}
                  autoComplete="new-password"
                  aria-label="Mot de passe"
                  className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none"
                />
                <button
                  type="button"
                  onClick={() => setVisible((v) => !v)}
                  aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  title={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  className="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center text-text-muted transition-colors hover:text-text-primary"
                >
                  {visible ? <EyeOff size={15} strokeWidth={1.9} /> : <Eye size={15} strokeWidth={1.9} />}
                </button>
              </div>
              <span
                className={`mt-1 block font-mono text-[10px] uppercase tracking-widest ${
                  tooShort ? 'text-danger' : 'text-text-muted'
                }`}
              >
                {MIN_LENGTH} caractères minimum
              </span>
            </label>

            <label className="mt-4 block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
                Confirmation
              </span>
              <input
                type={visible ? 'text' : 'password'}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="new-password"
                aria-label="Confirmation du mot de passe"
                className="input-focus min-h-12 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
              />
              {mismatch && (
                <span className="mt-1 block font-mono text-[10px] uppercase tracking-widest text-danger">
                  Les deux saisies diffèrent
                </span>
              )}
            </label>

            {error && (
              <div role="alert" className="mt-4 border border-danger/40 bg-danger-muted px-3 py-2">
                <p className="text-xs leading-relaxed text-danger">{error}</p>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                  Un lien d’invitation ne sert qu’une fois et expire. Demandez-en un nouveau à la
                  personne qui vous a ouvert l’accès.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={!ready || busy}
              className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 bg-accent text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              Activer mon compte
            </button>

            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="mt-3 flex min-h-11 w-full items-center justify-center text-xs text-text-muted transition-colors hover:text-text-secondary"
            >
              J’ai déjà un mot de passe — me connecter
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
