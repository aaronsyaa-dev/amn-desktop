import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { bridge } from '../lib/bridge';
import { cleanErrorMessage } from '../lib/errorMessage';
import { Logo } from '../components/Logo';
import { EDITION_PRODUCT_NAME } from '../edition/edition';
import type { InvitationCarte, LectureInvitation } from '../shared/api';

/**
 * LA PAGE D'ACTIVATION — cahier 43b à 43e (paquet Claude Design, ARRIVEE.md §2).
 *
 * ## Le laissez-passer
 *
 * La carte de l'e-mail, dans le même dessin, posée sur le fond sombre du
 * produit : l'organisation, qui invite, pour qui, avec quel rôle. Son TALON
 * AMBRE dit l'état du lien — c'est le seul ambre de la page. À droite, le
 * seul geste que cet état permet.
 *
 * ## Lire avant d'activer, sans ouvrir d'oracle
 *
 * L'écran lit l'invitation (`POST /v1/auth/invitations/lookup`) avant tout.
 * Le serveur ne répond qu'au porteur d'un vrai lien ; tout le reste — jeton
 * tronqué, inconnu, mal copié — reçoit le même 404, et qui insiste est freiné.
 * La page ne devine donc jamais : sans code complet, elle ne peut dire ni
 * l'organisation ni la personne qui invite, et le dit.
 *
 * ## Le jeton vient de l'adresse, et en disparaît
 *
 * Lu une fois dans `#/invitation?token=…`, puis retiré de la barre d'adresse
 * (`history.replaceState`) : un secret n'a rien à faire dans l'historique,
 * une capture ou un lien recollé. Le pied de page le dit, parce que c'est vrai.
 *
 * ## Deux écarts au cahier, voulus
 *
 *   · les gris que le dépôt a refusés (`#6b6b68`, 3,79:1) prennent la sourdine
 *     du système, et le bouton inactif ses jetons `action-inactive` ;
 *   · « il suspend l'accès », « est prévenu » : le prénom de qui invite ne dit
 *     rien de son genre, les phrases sont donc tournées sans pronom.
 */

/** Le papier de la carte : ses tons n'existent qu'ici et dans l'e-mail (ARRIVEE.md, jetons du papier). */
const PAPIER = {
  carte: '#f4f3ee',
  filet: '#d8d5cd',
  encre: '#0a0a0a',
  texte: '#4a4a48',
  libelle: '#5f5d58',
} as const;

/** Le minimum exigé par amn-api. Répété ici pour le dire AVANT d'envoyer. */
const MIN_LENGTH = 8;
/** Une lecture qui revient vite n'affiche rien pendant l'attente (cahier : 300 ms). */
const DELAI_CARTE_VIDE_MS = 300;

type Lecture = LectureInvitation | { kind: 'attente' } | { kind: 'sans-jeton' };

const mono = "font-mono font-bold uppercase";
const heure = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
/** « VEN. 2 OCT. · 16:04 » */
const dateTalon = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · ${heure(d)}`.toUpperCase();
};
/** « 25 SEPT. » */
const dateEnvoi = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).toUpperCase() : '');
/** « vendredi 25 septembre » */
const dateLongue = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

/** Un lien entier collé, ou le seul code : on garde le code. */
function codeDepuis(saisie: string): string {
  const v = saisie.trim();
  const i = v.indexOf('token=');
  if (i < 0) return v;
  try {
    return decodeURIComponent(v.slice(i + 6).split('&')[0]);
  } catch {
    return v.slice(i + 6).split('&')[0];
  }
}

export function InvitationScreen() {
  const { acceptInvitation } = useAuth();
  const navigate = useNavigate();

  const [token, setToken] = useState('');
  const [lecture, setLecture] = useState<Lecture>({ kind: 'attente' });
  const [carteVideVisible, setCarteVideVisible] = useState(false);

  /* Le jeton est lu une fois, puis effacé de l'adresse. */
  useEffect(() => {
    const hash = window.location.hash;
    const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
    const found = (new URLSearchParams(query).get('token') ?? '').trim();
    if (found) {
      setToken(found);
      window.history.replaceState(null, '', `${window.location.pathname}#/invitation`);
    } else {
      setLecture({ kind: 'sans-jeton' });
    }
  }, []);

  const lire = useCallback(async (code: string) => {
    setLecture({ kind: 'attente' });
    setCarteVideVisible(false);
    const minuteur = window.setTimeout(() => setCarteVideVisible(true), DELAI_CARTE_VIDE_MS);
    try {
      setLecture(await bridge().remote.lookupInvitation(code));
    } catch {
      setLecture({ kind: 'injoignable' });
    } finally {
      window.clearTimeout(minuteur);
    }
  }, []);

  useEffect(() => {
    if (token) void lire(token);
  }, [token, lire]);

  const carte = lecture.kind === 'carte' ? lecture.carte : null;
  const [active, setActive] = useState<Date | null>(null);

  return (
    <div
      className="flex min-h-dvh flex-col bg-bg text-text-primary"
      style={{ backgroundImage: 'radial-gradient(60% 50% at 36% 52%, rgba(255,255,255,.035), transparent 70%)' }}
      data-activation={lecture.kind === 'carte' ? lecture.carte.statut : lecture.kind}
    >
      <header className="flex h-16 flex-none items-center gap-2.5 border-b border-raised px-5 sm:px-9">
        <Logo height={18} />
        <span className="text-sm text-text-muted">{EDITION_PRODUCT_NAME.replace(/^AMN\s+/, '')}</span>
        <span className="ml-auto hidden font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted sm:inline">Activation de votre accès</span>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10 min-[900px]:py-6">
        <div className="flex w-full max-w-[420px] flex-col items-stretch gap-10 min-[900px]:grid min-[900px]:max-w-none min-[900px]:w-auto min-[900px]:grid-cols-[420px_380px] min-[900px]:items-center min-[900px]:gap-x-[72px]">
          {carte ? (
            <Laissez carte={carte} active={active} />
          ) : lecture.kind === 'attente' && !carteVideVisible ? (
            <div className="h-[296px] w-full" aria-hidden />
          ) : (
            <CarteVide />
          )}

          <section className="w-full min-[900px]:w-[380px]" aria-live="polite">
            {lecture.kind === 'attente' ? (
              <div className="h-40" />
            ) : lecture.kind === 'carte' ? (
              lecture.carte.statut === 'valide' ? (
                lecture.carte.motDePasseRequis ? (
                  <Valable
                    carte={lecture.carte}
                    active={active}
                    onActiver={async (motDePasse) => {
                      await acceptInvitation(token, motDePasse);
                      setActive(new Date());
                      // La pause d'une seconde que l'écran marquait déjà : le seul moment où la personne apprend que son compte existe.
                      window.setTimeout(() => navigate('/', { replace: true }), 1200);
                    }}
                    onLogin={() => navigate('/login', { replace: true })}
                  />
                ) : (
                  <Panneau surtitre="Rejoindre l’espace" titre={`Rejoindre ${lecture.carte.organisation}`} texte="Vous avez déjà un compte AMN Desktop. Connectez-vous : l’espace de cette invitation vous sera proposé.">
                    <BoutonPrincipal onClick={() => navigate('/login', { replace: true })}>Me connecter</BoutonPrincipal>
                  </Panneau>
                )
              ) : lecture.carte.statut === 'expiree' ? (
                <Expire carte={lecture.carte} token={token} />
              ) : lecture.carte.statut === 'utilisee' ? (
                <DejaActive carte={lecture.carte} token={token} onLogin={() => navigate('/login', { replace: true })} />
              ) : (
                <Panneau surtitre="Espace en pause" titre="Cet espace est en pause" texte={`L’activation reprendra quand ${prenom(lecture.carte)} l’aura rouvert. Rien n’est perdu : votre lien sera encore bon jusqu’au ${dateLongue(lecture.carte.expireLe)}.`}>
                  <BoutonSecondaire onClick={() => navigate('/login', { replace: true })}>Me connecter</BoutonSecondaire>
                </Panneau>
              )
            ) : lecture.kind === 'freinee' ? (
              <Panneau surtitre="Trop de tentatives" titre="Réessayez dans un moment" texte={`Ce poste a essayé trop de liens d’invitation. Réessayez dans ${Math.max(1, Math.ceil(lecture.secondes / 60))} minutes, depuis le bouton « Activer mon espace » de l’e-mail.`} />
            ) : lecture.kind === 'injoignable' ? (
              <Panneau surtitre="Vérification impossible" titre="Ce lien ne peut pas être vérifié" texte="Le serveur ne répond pas pour l’instant. La page ne devine rien : réessayez dans un instant.">
                <BoutonSecondaire onClick={() => (token ? void lire(token) : undefined)}>Réessayer</BoutonSecondaire>
              </Panneau>
            ) : (
              <Incomplet onCode={(code) => setToken(code)} />
            )}
          </section>
        </div>
      </main>

      <footer className="flex-none px-4 pb-[22px] text-center font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">
        Par sécurité, le lien a été effacé de la barre d’adresse dès son ouverture
      </footer>
    </div>
  );
}

const prenom = (c: InvitationCarte) => c.invitePar.prenom ?? c.organisation;

/* ─────────────────────────── La carte ─────────────────────────── */

function Laissez({ carte, active }: { carte: InvitationCarte; active: Date | null }) {
  const phrase = active
    ? 'Votre espace est activé. Il s’ouvre.'
    : carte.statut === 'valide'
      ? 'Votre espace de travail est prêt. Il ne reste qu’à l’activer.'
      : carte.statut === 'expiree'
        ? 'Votre espace vous attend toujours. Il lui faut seulement un lien neuf.'
        : carte.statut === 'utilisee'
          ? 'Cet espace a été activé avec ce lien.'
          : 'Cet espace est en pause pour le moment.';
  const [talonGauche, talonDroite] = active
    ? [`Activé à l’instant · ${heure(active)}`, 'Bienvenue']
    : carte.statut === 'valide'
      ? [`Valable jusqu’au ${dateTalon(carte.expireLe)}`, 'Usage unique']
      : carte.statut === 'expiree'
        ? [`Expiré le ${dateTalon(carte.expireLe)}`, '7 jours écoulés']
        : carte.statut === 'utilisee' && carte.utiliseLe
          ? [`Activé le ${dateTalon(carte.utiliseLe)}`, 'Lien consommé']
          : ['Espace en pause', 'En attente'];
  const ligne = (libelle: string, valeur: string) => (
    <div className="grid grid-cols-[122px_1fr] items-baseline gap-2.5 px-7 pt-[11px]">
      <span className={`${mono} text-[10px] tracking-[0.14em]`} style={{ color: PAPIER.libelle }}>{libelle}</span>
      <span className="min-w-0 break-words text-sm" style={{ color: PAPIER.encre }}>{valeur}</span>
    </div>
  );
  return (
    <article
      className="w-full min-[900px]:w-[420px]"
      style={{ background: PAPIER.carte, boxShadow: '0 44px 80px -34px rgba(0,0,0,1), 0 0 0 1px rgba(255,255,255,.05)' }}
      aria-label={`Invitation : ${carte.organisation}`}
      data-laissez-passer
    >
      <div className="flex items-baseline justify-between px-7 pt-6">
        <span className={`${mono} text-[10px] tracking-[0.2em]`} style={{ color: PAPIER.libelle }}>Invitation</span>
        {carte.emisLe && <span className={`${mono} text-[10px] tracking-[0.14em]`} style={{ color: PAPIER.libelle }}>Envoyée le {dateEnvoi(carte.emisLe)}</span>}
      </div>
      <h2 className="px-7 pt-[18px] text-[32px] font-bold leading-[1.05] tracking-[-0.03em]" style={{ color: PAPIER.encre }}>{carte.organisation}</h2>
      <p className="px-7 pt-2.5 text-[14.5px] leading-[1.55]" style={{ color: PAPIER.texte }}>{phrase}</p>
      <div className="mx-7 mb-1 mt-5 h-px" style={{ background: PAPIER.filet }} />
      {ligne('De la part de', [carte.invitePar.prenom, carte.invitePar.libelle].filter(Boolean).join(' · ') || carte.organisation)}
      {ligne('Pour', carte.email)}
      {ligne('Votre rôle', carte.role)}
      {/* LE TALON : le seul ambre de la page, et il dit l'état du lien. */}
      <div data-signal-groupe="talon" className="mt-[26px] flex justify-between gap-3.5 bg-signal px-7 py-3">
        <span data-signal-groupe="talon" className={`${mono} text-[10px] tracking-[0.12em] text-signal-ink`}>{talonGauche}</span>
        <span data-signal-groupe="talon" className={`${mono} whitespace-nowrap text-[10px] tracking-[0.12em] text-signal-ink`}>{talonDroite}</span>
      </div>
    </article>
  );
}

/** La carte dessinée vide : pendant la lecture, et sans code complet (43e). Aucun texte, aucun ambre. */
function CarteVide() {
  const trait = (w: number, h: number, fond = '#1a1a1a') => <span className="block" style={{ width: w, height: h, background: fond, maxWidth: '100%' }} />;
  return (
    <div className="w-full border border-dashed border-[#2e2e2e] min-[900px]:w-[420px]" aria-hidden data-carte-vide>
      <div className="flex justify-between px-7 pt-6">{trait(72, 7)}{trait(96, 7, 'var(--color-surface-hover)')}</div>
      <div className="px-7 pt-5">{trait(210, 24)}</div>
      <div className="px-7 pt-3.5">{trait(300, 8, 'var(--color-surface-hover)')}</div>
      <div className="mx-7 mb-1.5 mt-[22px] border-t border-dashed border-border-raised" />
      {[150, 190, 160].map((w) => (
        <div key={w} className="flex gap-6 px-7 pt-3">{trait(96, 7, 'var(--color-surface-hover)')}{trait(w, 8)}</div>
      ))}
      <div className="mt-7 flex h-10 items-center border-t border-dashed border-[#2e2e2e] px-7">{trait(220, 7, 'var(--color-surface-hover)')}</div>
    </div>
  );
}

/* ─────────────────────────── Le panneau ─────────────────────────── */

function Panneau({ surtitre, titre, texte, children }: { surtitre: string; titre: string; texte: string; children?: React.ReactNode }) {
  return (
    <div>
      <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">{surtitre}</span>
      <h1 className="mt-2.5 text-[28px] font-bold leading-[1.1] tracking-[-0.03em] text-text-primary [text-wrap:balance]">{titre}</h1>
      <p className="mt-3 text-sm leading-[1.65] text-text-secondary [text-wrap:pretty]">{texte}</p>
      {children}
    </div>
  );
}

function BoutonPrincipal({ children, disabled = false, onClick, type = 'button' }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void; type?: 'button' | 'submit' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`mt-[22px] flex h-12 w-full items-center justify-center gap-2 text-sm font-semibold transition-colors ${
        disabled ? 'cursor-not-allowed bg-action-inactive text-action-inactive-ink' : 'bg-text-primary text-[#0a0a0a] shadow-[0_12px_26px_-12px_rgba(0,0,0,.9)] hover:bg-white'
      }`}
    >
      {children}
    </button>
  );
}

function BoutonSecondaire({ children, onClick, disabled = false }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="mt-3.5 inline-flex h-10 items-center justify-center border border-border-strong px-4 text-[13px] font-semibold text-text-body hover:bg-surface-hover disabled:opacity-50">
      {children}
    </button>
  );
}

function Champ({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <label className="mt-[18px] block">
      <span className="mb-[7px] block font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">{libelle}</span>
      <span className="flex h-12 items-center gap-2.5 border border-[#2b2b2b] bg-sunken px-3.5 focus-within:border-border-strong">{children}</span>
    </label>
  );
}

/* ─────────────────────────── Les quatre états ─────────────────────────── */

function Valable({ carte, active, onActiver, onLogin }: { carte: InvitationCarte; active: Date | null; onActiver: (motDePasse: string) => Promise<void>; onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);
  useEffect(() => { champ.current?.focus(); }, []);

  if (active) {
    return (
      <Panneau surtitre="Espace activé" titre="Votre espace est activé" texte="Ouverture de votre espace…" />
    );
  }

  const tropCourt = password.length > 0 && password.length < MIN_LENGTH;
  const differe = confirmation.length > 0 && confirmation !== password;
  const pret = password.length >= MIN_LENGTH && confirmation === password;
  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pret || busy) return;
    setBusy(true);
    setErreur(null);
    try {
      await onActiver(password);
    } catch (err) {
      setErreur(cleanErrorMessage(err, 'L’activation n’a pas abouti. Réessayez, ou demandez un nouveau lien.'));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={envoyer}>
      <Panneau
        surtitre="Activer l’espace"
        titre="Choisissez votre mot de passe"
        texte="Il n’a jamais été transmis à personne, et personne ne peut le lire — pas même nous. C’est vous qui le fixez, maintenant."
      />
      <Champ libelle="Mot de passe">
        <input
          ref={champ}
          type={visible ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          aria-label="Mot de passe"
          className="min-w-0 flex-1 bg-transparent font-mono text-[15px] tracking-[0.18em] text-text-primary outline-none"
        />
        <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} className="flex h-8 w-8 flex-none items-center justify-center text-text-muted hover:text-text-primary">
          {visible ? <EyeOff size={16} strokeWidth={1.9} /> : <Eye size={16} strokeWidth={1.9} />}
        </button>
      </Champ>
      <span className={`mt-[7px] block font-mono text-[9.5px] uppercase tracking-[0.14em] ${tropCourt ? 'text-danger' : 'text-text-muted'}`} data-compte-mdp>
        {password.length >= MIN_LENGTH ? `${password.length} caractères · ${MIN_LENGTH} minimum` : `${MIN_LENGTH} caractères minimum`}
      </span>
      <Champ libelle="Confirmation">
        <input
          type={visible ? 'text' : 'password'}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="new-password"
          aria-label="Confirmation du mot de passe"
          className="min-w-0 flex-1 bg-transparent font-mono text-[15px] tracking-[0.18em] text-text-primary outline-none"
        />
      </Champ>
      {differe && <span className="mt-[7px] block font-mono text-[9.5px] uppercase tracking-[0.14em] text-danger">Les deux saisies diffèrent</span>}
      <BoutonPrincipal type="submit" disabled={!pret || busy}>
        {busy && <Loader2 size={15} className="animate-spin" />}
        Activer mon espace
      </BoutonPrincipal>
      {erreur && <p role="alert" className="mt-3 text-[12.5px] leading-relaxed text-danger">{erreur}</p>}
      <button type="button" onClick={onLogin} className="mt-3.5 block w-full text-center text-[12.5px] text-text-muted hover:text-text-secondary">
        J’ai déjà un mot de passe — me connecter
      </button>
      <span className="sr-only">Invitation de {prenom(carte)} pour {carte.organisation}.</span>
    </form>
  );
}

/** Relance ou signalement : une fois envoyé, le bouton laisse la place à la phrase, et ne revient pas. */
function useDemande(token: string, nature: 'relance' | 'signalement') {
  const [etat, setEtat] = useState<{ fait: boolean; busy: boolean; erreur: string | null }>({ fait: false, busy: false, erreur: null });
  const envoyer = async () => {
    if (etat.busy || etat.fait) return;
    setEtat({ fait: false, busy: true, erreur: null });
    try {
      await (nature === 'relance' ? bridge().remote.relancerInvitation(token) : bridge().remote.signalerInvitation(token));
      setEtat({ fait: true, busy: false, erreur: null });
    } catch (err) {
      setEtat({ fait: false, busy: false, erreur: cleanErrorMessage(err, 'La demande n’est pas partie. Réessayez dans un instant.') });
    }
  };
  return { ...etat, envoyer };
}

function Expire({ carte, token }: { carte: InvitationCarte; token: string }) {
  const qui = prenom(carte);
  const d = useDemande(token, 'relance');
  return (
    <Panneau
      surtitre="Lien expiré"
      titre="Ce lien a expiré"
      texte={`Un lien d’activation dure sept jours. Celui-ci vous a été envoyé le ${carte.emisLe ? dateLongue(carte.emisLe) : dateLongue(carte.expireLe)} par ${qui} : l’espace ${carte.organisation} vous attend toujours, il lui faut seulement un lien neuf.`}
    >
      {d.fait ? (
        <p className="mt-[26px] text-sm font-semibold text-text-primary" data-demande-faite>Demande envoyée à {qui}.</p>
      ) : (
        <BoutonPrincipal onClick={() => void d.envoyer()} disabled={d.busy}>
          {d.busy && <Loader2 size={15} className="animate-spin" />}
          Demander un nouveau lien
        </BoutonPrincipal>
      )}
      <p className="mt-3.5 text-[12.5px] leading-[1.6] text-text-muted">{qui} reçoit votre demande et vous renvoie un lien. Vous n’avez rien d’autre à faire.</p>
      {d.erreur && <p role="alert" className="mt-2 text-[12.5px] text-danger">{d.erreur}</p>}
    </Panneau>
  );
}

function DejaActive({ carte, token, onLogin }: { carte: InvitationCarte; token: string; onLogin: () => void }) {
  const qui = prenom(carte);
  const d = useDemande(token, 'signalement');
  const quand = carte.utiliseLe ? `le ${dateLongue(carte.utiliseLe)} à ${heure(new Date(carte.utiliseLe))}` : 'déjà';
  return (
    <Panneau
      surtitre="Espace déjà activé"
      titre="Cet espace est déjà activé"
      texte={`Ce lien a servi ${quand} — un lien d’activation ne sert qu’une fois. Si c’était vous, connectez-vous avec le mot de passe choisi ce jour-là.`}
    >
      <BoutonPrincipal onClick={onLogin}>Me connecter</BoutonPrincipal>
      <div className="mt-[26px] border-t border-border pt-5">
        <span className="block text-[13.5px] font-semibold text-text-body">Ce n’était pas vous ?</span>
        <p className="mt-1.5 text-[12.5px] leading-[1.6] text-text-secondary">
          Prévenez {qui} : l’accès ouvert avec ce lien sera suspendu, et un nouveau lien vous sera renvoyé.
        </p>
        {d.fait ? (
          <p className="mt-3.5 text-[13px] font-semibold text-text-primary" data-demande-faite>Signalement envoyé à {qui}.</p>
        ) : (
          <BoutonSecondaire onClick={() => void d.envoyer()} disabled={d.busy}>Signaler à {qui}</BoutonSecondaire>
        )}
        {d.erreur && <p role="alert" className="mt-2 text-[12.5px] text-danger">{d.erreur}</p>}
      </div>
    </Panneau>
  );
}

function Incomplet({ onCode }: { onCode: (code: string) => void }) {
  const [saisie, setSaisie] = useState('');
  const champ = useRef<HTMLInputElement>(null);
  useEffect(() => { champ.current?.focus(); }, []);
  const code = codeDepuis(saisie);
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (code) onCode(code); }}>
      <Panneau
        surtitre="Lien incomplet"
        titre="Ce lien n’est pas complet"
        texte="Votre messagerie a peut-être coupé l’adresse en deux. Rouvrez le bouton « Activer mon espace » depuis l’e-mail, ou collez ici le code qui suit « token= » dans l’adresse."
      />
      <Champ libelle="Code d’invitation">
        <input
          ref={champ}
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Collez le code reçu"
          aria-label="Code d’invitation"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
        />
      </Champ>
      <BoutonPrincipal type="submit" disabled={!code}>Continuer</BoutonPrincipal>
      <p className="mt-3.5 text-[12.5px] leading-[1.6] text-text-muted [text-wrap:pretty]">
        Sans code complet, la page ne peut dire ni l’organisation ni la personne qui vous invite : c’est voulu.
      </p>
    </form>
  );
}
