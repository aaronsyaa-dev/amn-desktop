import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, Unplug } from 'lucide-react';
import { bridge } from '../../lib/bridge';
import { isWeb } from '../../lib/platform';
import type { GoogleAgendaBilan, GoogleAgendaEtat } from '../../shared/api';
import type { Appointment } from '../../state/useAppointments';

/**
 * GOOGLE AGENDA DANS L'AGENDA — la connexion, et ce que chaque rendez-vous en dit.
 *
 * Le poste ne voit jamais un jeton : il demande l'état, lance un passage, ou
 * reçoit une adresse de consentement Google à ouvrir. Tout le reste (jetons,
 * appels à Google, conflits) se passe sur le serveur — voir amn-api,
 * src/google/synchro.js.
 *
 * QUAND LE PASSAGE GOOGLE → AMN SE FAIT. À l'ouverture de l'Agenda, au retour
 * sur la fenêtre (au plus une fois par minute) et au bouton « Synchroniser ».
 * Un déclenchement de fond côté serveur (webhook ou minuterie) est une
 * décision en attente : docs/google-agenda.md. Dans l'autre sens (AMN →
 * Google), c'est immédiat : chaque écriture est répercutée par le serveur.
 */

/** Le « G » de Google, dessiné en ligne (pas de dépendance, lisible à 12 px). */
export function IconeGoogle({ size = 12, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** Synchronisé avec Google (lié, pas annulé). */
export const estSynchronise = (a: Appointment) => Boolean(a.google?.id) && !a.google?.annule;
/** Un rendez-vous lié à Google qui n'a pas pu être répercuté. */
export const enErreurGoogle = (a: Appointment) => a.google?.statut === 'erreur';

/** La marque d'un rendez-vous dans une liste : le « G » s'il est synchronisé, un triangle s'il ne l'est plus. */
export function MarqueGoogle({ appointment }: { appointment: Appointment }) {
  if (enErreurGoogle(appointment)) {
    return (
      <span
        className="flex flex-shrink-0 items-center text-danger"
        title={`Non synchronisé avec Google : ${appointment.google?.erreur ?? 'erreur'}`}
        data-google-erreur
      >
        <AlertTriangle size={12} strokeWidth={2.2} />
      </span>
    );
  }
  if (!estSynchronise(appointment)) return null;
  return (
    <span
      className="flex flex-shrink-0 items-center"
      title={appointment.googleConflit ? 'Synchronisé avec Google · conflit tranché' : 'Synchronisé avec Google Agenda'}
      data-google-synchro
    >
      <IconeGoogle size={12} />
    </span>
  );
}

const quand = (iso?: string | null) => {
  if (!iso) return '';
  const t = new Date(iso);
  const min = Math.round((Date.now() - t.getTime()) / 60_000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  return t.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/** Dans le détail d'un rendez-vous : d'où il vient, s'il est à jour, et le conflit tranché s'il y en a eu un. */
export function EtatGoogleDuRdv({ appointment, onCompris }: { appointment: Appointment; onCompris: () => void }) {
  const g = appointment.google;
  if (!g && !appointment.googleConflit) return null;
  return (
    <div className="flex flex-col gap-2" data-google-detail>
      {g && (
        <p className={`flex items-start gap-2 text-xs ${g.statut === 'erreur' ? 'text-danger' : 'text-text-secondary'}`}>
          {g.statut === 'erreur' ? (
            <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
          ) : (
            <IconeGoogle size={13} className="mt-0.5 flex-shrink-0" />
          )}
          <span>
            {g.statut === 'erreur'
              ? `Non synchronisé avec Google : ${g.erreur ?? 'erreur inconnue'}`
              : g.annule
                ? 'Retiré de Google Agenda (annulé).'
                : `Synchronisé avec Google Agenda${g.origine === 'google' ? ' · créé dans Google' : ''}${g.synchroA ? ` · ${quand(g.synchroA)}` : ''}.`}
          </span>
        </p>
      )}
      {appointment.googleConflit && (
        <div
          className="flex flex-wrap items-start justify-between gap-2 border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-text-primary"
          data-google-conflit
        >
          <span className="min-w-0 flex-1">
            <strong className="font-semibold">
              Conflit tranché — version {appointment.googleConflit.gagnant === 'google' ? 'Google' : 'AMN'} gardée.
            </strong>{' '}
            <span className="text-text-secondary">{appointment.googleConflit.detail}</span>
          </span>
          <button
            type="button"
            onClick={onCompris}
            className="border border-border-strong px-2 py-1 text-[11px] font-medium hover:bg-surface-hover"
          >
            Compris
          </button>
        </div>
      )}
    </div>
  );
}

function resumeBilan(b: GoogleAgendaBilan): string {
  const parts: string[] = [];
  if (b.importes) parts.push(`${b.importes} importé${b.importes > 1 ? 's' : ''}`);
  if (b.modifies) parts.push(`${b.modifies} mis à jour`);
  if (b.pousses) parts.push(`${b.pousses} envoyé${b.pousses > 1 ? 's' : ''} vers Google`);
  if (b.annules) parts.push(`${b.annules} annulé${b.annules > 1 ? 's' : ''} depuis Google`);
  if (b.retires) parts.push(`${b.retires} retiré${b.retires > 1 ? 's' : ''}`);
  if (b.conflits) parts.push(`${b.conflits} conflit${b.conflits > 1 ? 's' : ''} tranché${b.conflits > 1 ? 's' : ''}`);
  if (b.erreurs) parts.push(`${b.erreurs} en erreur`);
  return parts.length ? parts.join(' · ') : 'Rien de nouveau';
}

/** Le bandeau de connexion, sous l'en-tête de l'Agenda. */
export function PanneauGoogleAgenda({ nbErreurs = 0 }: { nbErreurs?: number }) {
  const [etat, setEtat] = useState<GoogleAgendaEtat | null>(null);
  const [occupe, setOccupe] = useState<'connexion' | 'synchro' | 'deconnexion' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const dernierPassage = useRef(0);

  const synchroniser = useCallback(async (manuel: boolean) => {
    if (!manuel && Date.now() - dernierPassage.current < 60_000) return;
    dernierPassage.current = Date.now();
    if (manuel) setOccupe('synchro');
    try {
      const r = await bridge().remote.agendaGoogle.synchroniser();
      setEtat((avant) => ({ ...avant, ...r }));
      if (r.bilan.expire || r.bilan.erreur) {
        // Le passage n'a pas eu lieu : dire pourquoi, jamais « rien de nouveau ».
        setMessage(null);
        setErreur(r.bilan.erreur ?? 'La connexion Google a expiré.');
        return;
      }
      if (manuel || r.bilan.importes || r.bilan.conflits || r.bilan.erreurs) {
        setMessage(r.bilan.enCours ? 'Une synchronisation est déjà en cours.' : resumeBilan(r.bilan));
      }
      setErreur(null);
    } catch (e) {
      if (manuel) setErreur(e instanceof Error ? e.message : 'Synchronisation impossible.');
    } finally {
      if (manuel) setOccupe(null);
    }
  }, []);

  useEffect(() => {
    let vivant = true;
    // Retour du consentement Google en version web : #/agenda?google=connecte|refuse|erreur
    const issue = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('google');
    if (issue === 'connecte') setMessage('Google Agenda est connecté : première synchronisation en cours.');
    else if (issue === 'refuse') setErreur('Connexion annulée sur l’écran de Google.');
    else if (issue === 'erreur') setErreur('La connexion à Google n’a pas abouti. Réessayez.');
    const lire = () =>
      bridge()
        .remote.agendaGoogle.etat()
        .then((e) => {
          if (!vivant) return;
          setEtat(e);
          if (e.etat === 'connecte') void synchroniser(false);
        });
    void lire().catch(() => vivant && setEtat(null));
    const auRetour = () => {
      if (document.visibilityState === 'visible') void lire().catch(() => undefined);
    };
    window.addEventListener('focus', auRetour);
    document.addEventListener('visibilitychange', auRetour);
    return () => {
      vivant = false;
      window.removeEventListener('focus', auRetour);
      document.removeEventListener('visibilitychange', auRetour);
    };
  }, [synchroniser]);

  const connecter = async () => {
    setOccupe('connexion');
    setErreur(null);
    try {
      const { url } = await bridge().remote.agendaGoogle.connecter(isWeb() ? 'web' : 'desktop');
      if (isWeb()) window.location.assign(url);
      else {
        window.open(url, '_blank'); // Electron : ouvert dans le navigateur du système
        setMessage('Terminez la connexion dans votre navigateur, puis revenez ici.');
        setOccupe(null);
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Connexion impossible.');
      setOccupe(null);
    }
  };

  const deconnecter = async () => {
    setOccupe('deconnexion');
    try {
      await bridge().remote.agendaGoogle.deconnecter();
      setEtat((avant) => (avant ? { ...avant, etat: 'non_connecte', compte: null, derniereSynchro: null, erreur: null } : avant));
      setMessage('Google Agenda est déconnecté. Vos rendez-vous restent dans AMN.');
      setErreur(null);
      setConfirmer(false);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Déconnexion impossible.');
    } finally {
      setOccupe(null);
    }
  };

  if (!etat) return null;
  // Rien à proposer : serveur non configuré et personne pour agir.
  if (!etat.configure && etat.etat === 'non_connecte' && !etat.peutGerer) return null;

  const bouton =
    'flex min-h-11 items-center gap-1.5 border border-border-strong px-3 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-40 md:min-h-0 md:py-1.5';
  const probleme = etat.etat === 'expire' || etat.etat === 'erreur';

  return (
    <div
      className={`flex flex-col gap-2 border px-3 py-2 ${probleme ? 'border-danger/50 bg-danger/10' : 'border-border bg-surface'}`}
      data-google-agenda={etat.etat}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex min-w-0 flex-1 items-center gap-2 text-xs text-text-secondary">
          <IconeGoogle size={14} className="flex-shrink-0" />
          {etat.etat === 'connecte' ? (
            <span className="min-w-0 break-words">
              <span className="font-medium text-text-primary">Google Agenda connecté</span>
              {etat.compte ? ` · ${etat.compte}` : ''}
              {etat.derniereSynchro ? ` · synchronisé ${quand(etat.derniereSynchro)}` : ' · première synchronisation…'}
            </span>
          ) : probleme ? (
            <span className="min-w-0 break-words text-danger">
              <span className="font-medium">
                {etat.etat === 'expire' ? 'La connexion Google a expiré' : 'La connexion Google est en erreur'}
              </span>
              {' — '}la synchronisation est arrêtée
              {etat.peutGerer ? '. Reconnectez en un clic.' : ' : demandez à un administrateur de reconnecter.'}
            </span>
          ) : !etat.configure ? (
            <span>La connexion Google Agenda n’est pas encore activée sur le serveur AMN.</span>
          ) : (
            <span>
              Synchronisez cet agenda avec Google Agenda, dans les deux sens.
              {!etat.peutGerer && ' La propriétaire ou un administrateur peut le connecter.'}
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {etat.etat === 'connecte' && (
            <button type="button" onClick={() => void synchroniser(true)} disabled={occupe !== null} className={bouton}>
              {occupe === 'synchro' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Synchroniser
            </button>
          )}
          {etat.peutGerer && etat.configure && etat.etat !== 'connecte' && (
            <button
              type="button"
              onClick={() => void connecter()}
              disabled={occupe !== null}
              className={bouton}
              data-google-connecter
            >
              {occupe === 'connexion' ? <Loader2 size={13} className="animate-spin" /> : <IconeGoogle size={13} />}
              {probleme ? 'Reconnecter Google Agenda' : 'Connecter Google Agenda'}
            </button>
          )}
          {etat.peutGerer && etat.etat !== 'non_connecte' && !confirmer && (
            <button type="button" onClick={() => setConfirmer(true)} disabled={occupe !== null} className={bouton}>
              <Unplug size={13} /> Déconnecter
            </button>
          )}
        </div>
      </div>
      {confirmer && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-xs text-text-secondary">
          <span className="min-w-0 flex-1">
            Déconnecter Google Agenda ? L’accès est révoqué chez Google ; vos rendez-vous restent dans AMN, sans lien.
          </span>
          <span className="flex gap-2">
            <button type="button" onClick={() => setConfirmer(false)} className={bouton}>
              Garder
            </button>
            <button
              type="button"
              onClick={() => void deconnecter()}
              disabled={occupe !== null}
              className={`${bouton} border-danger/60 text-danger`}
            >
              {occupe === 'deconnexion' && <Loader2 size={13} className="animate-spin" />} Déconnecter
            </button>
          </span>
        </div>
      )}
      {nbErreurs > 0 && etat.etat === 'connecte' && (
        <p className="flex items-center gap-1.5 text-xs text-danger" data-google-erreurs>
          <AlertTriangle size={12} /> {nbErreurs} rendez-vous non synchronisé{nbErreurs > 1 ? 's' : ''} — nouvel essai à
          la prochaine synchronisation.
        </p>
      )}
      {(message || erreur || (etat.erreur && etat.etat === 'connecte')) && (
        <p className={`text-xs ${erreur ? 'text-danger' : 'text-text-muted'}`} role="status">
          {erreur ?? message ?? etat.erreur}
        </p>
      )}
    </div>
  );
}
