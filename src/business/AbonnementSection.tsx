import React, { useEffect, useState } from 'react';
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { isAdminRole } from '../auth/roles';
import { bridge } from '../lib/bridge';
import { cleanErrorMessage } from '../lib/errorMessage';
import type { AbonnementEtat } from '../shared/api';

/**
 * L'ABONNEMENT, dans Paramètres (édition cliente, chantier « arrivée cliente », partie 3).
 *
 * Quand AMN a configuré l'encaissement automatique (Stripe), la propriétaire
 * ou une administratrice souscrit elle-même, puis gère sa carte et lit ses
 * factures dans le portail Stripe — sans écrire à personne. La carte ne passe
 * jamais par ce poste ni par nos serveurs : tout se fait sur la page de Stripe.
 *
 * Sans encaissement configuré, la section ne s'affiche pas : un bouton qui
 * mène à « hors ligne » ne sert à rien.
 */
export function useAbonnement(): AbonnementEtat | null {
  const [etat, setEtat] = useState<AbonnementEtat | null>(null);
  useEffect(() => {
    let vivant = true;
    void bridge().remote.abonnement().then((e) => { if (vivant) setEtat(e); }).catch(() => undefined);
    return () => { vivant = false; };
  }, []);
  return etat;
}

export function AbonnementSection() {
  const { role } = useAuth();
  const etat = useAbonnement();
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const peutGerer = isAdminRole(role);
  if (!etat?.actif || !peutGerer) return null;

  const relie = Boolean(etat.abonnement?.relie);
  const enRetard = etat.abonnement?.statut === 'en_retard';
  const ouvrir = async () => {
    if (busy) return;
    setBusy(true);
    setErreur(null);
    try {
      const { url } = await bridge().remote.ouvrirAbonnement();
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setErreur(cleanErrorMessage(err, 'La page de paiement ne s’est pas ouverte.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel p-4" id="reglages-abonnement" data-abonnement={relie ? 'relie' : 'aucun'}>
      <p className="eyebrow mb-2">Mon abonnement</p>
      <p className="mb-4 max-w-2xl text-[12.5px] leading-relaxed text-text-secondary">
        {relie
          ? enRetard
            ? 'Le dernier prélèvement n’est pas passé. Mettez à jour votre moyen de paiement : tout reste ouvert pendant le préavis, et rouvre de soi-même au règlement.'
            : 'Le prélèvement est automatique. Votre carte ou votre mandat, vos factures et la résiliation se gèrent sur la page sécurisée de Stripe.'
          : 'Souscrivez votre formule en ligne : le paiement se fait sur la page sécurisée de Stripe, puis se renouvelle seul chaque mois.'}
      </p>
      <button
        type="button"
        onClick={() => void ouvrir()}
        disabled={busy}
        className="flex min-h-11 items-center gap-2 border border-border-strong px-4 text-sm font-medium text-text-primary hover:bg-surface-hover disabled:opacity-50 md:min-h-9"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} strokeWidth={2} />}
        {relie ? 'Gérer mon abonnement' : 'Souscrire'}
        <ExternalLink size={12} strokeWidth={2} className="text-text-muted" />
      </button>
      {erreur && <p role="alert" className="mt-2 text-xs text-danger">{erreur}</p>}
    </section>
  );
}
