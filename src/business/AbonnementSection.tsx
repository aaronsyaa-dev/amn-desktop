import React, { useEffect, useState } from 'react';
import { CreditCard, ExternalLink, Loader2, Minus, Plus } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { isAdminRole } from '../auth/roles';
import { bridge } from '../lib/bridge';
import { cleanErrorMessage } from '../lib/errorMessage';
import { PALIERS, PRIX_PLACE_SUPPLEMENTAIRE_EUR, MODULE_TARIF_LABELS, nomPalier } from '../lib/paliers';
import type { AbonnementEtat, AbonnementModulesEtat, ModuleFacturable } from '../shared/api';

/**
 * L'ABONNEMENT, dans Paramètres (édition cliente).
 *
 * Trois pièces, chantier « modèle de facturation » (25/09) :
 *
 *   - LE PALIER (Solo 59 €, Équipe 129 €, Business 249 €) — souscrit ou géré
 *     sur la page sécurisée de Stripe (Checkout, puis le portail une fois
 *     reliée). La carte ne passe jamais par ce poste ni par nos serveurs.
 *   - LES MODULES À L'UNITÉ — une ligne de PLUS sur l'abonnement existant,
 *     ajoutée ou retirée d'un clic, SANS repasser par Stripe : la carte est
 *     déjà enregistrée.
 *   - LA PLACE SUPPLÉMENTAIRE (15 €, une fois) — au-delà de celles incluses
 *     dans le palier, sur une page Stripe à part (un paiement, pas un
 *     abonnement de plus).
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
  const { role, org } = useAuth();
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
            : `Le prélèvement est automatique${org?.plan ? ` — palier ${nomPalier(org.plan)}` : ''}. Votre carte ou votre mandat, vos factures et la résiliation se gèrent sur la page sécurisée de Stripe.`
          : 'Souscrivez votre palier en ligne : le paiement se fait sur la page sécurisée de Stripe, puis se renouvelle seul chaque mois. Quatorze jours d’essai, carte demandée mais rien prélevé avant.'}
      </p>

      {!relie && (
        <ul className="mb-4 grid gap-2 sm:grid-cols-3">
          {PALIERS.map((p) => (
            <li key={p.plan} className="border border-border bg-surface p-3">
              <p className="text-[13px] font-semibold text-text-primary">{p.label}</p>
              <p className="mt-0.5 font-mono text-[17px] font-semibold tabular-nums text-text-primary">
                {p.prixEur} €<span className="text-[11px] font-normal text-text-muted">/mois</span>
              </p>
              <p className="mt-1 text-[11.5px] text-text-secondary">{p.placesIncluses} place{p.placesIncluses > 1 ? 's' : ''} incluse{p.placesIncluses > 1 ? 's' : ''}</p>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => void ouvrir()}
        disabled={busy}
        className="flex min-h-11 items-center gap-2 border border-border-strong px-4 text-sm font-medium text-text-primary hover:bg-surface-hover disabled:opacity-50 md:min-h-9"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} strokeWidth={2} />}
        {relie ? 'Gérer mon abonnement' : `Souscrire${org?.plan ? ` — ${nomPalier(org.plan)}` : ''}`}
        <ExternalLink size={12} strokeWidth={2} className="text-text-muted" />
      </button>
      {erreur && <p role="alert" className="mt-2 text-xs text-danger">{erreur}</p>}

      {relie && (
        <>
          <PlacesSupplementaires />
          <ModulesAUnite />
        </>
      )}
    </section>
  );
}

/** N places au-delà de celles incluses dans le palier — 15 € chacune, une fois. */
function PlacesSupplementaires() {
  const [n, setN] = useState(1);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const acheter = async () => {
    if (busy) return;
    setBusy(true);
    setErreur(null);
    try {
      const { url } = await bridge().remote.acheterPlaces(n);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setErreur(cleanErrorMessage(err, 'La page de paiement n’a pas pu s’ouvrir.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
      <p className="text-[12.5px] text-text-secondary">
        Une place de plus, au-delà de celles incluses dans votre palier : {PRIX_PLACE_SUPPLEMENTAIRE_EUR} €, une seule fois.
      </p>
      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center border border-border">
          <button type="button" onClick={() => setN((v) => Math.max(1, v - 1))} aria-label="Une place de moins" className="flex h-9 w-9 items-center justify-center text-text-secondary hover:text-text-primary disabled:opacity-40" disabled={n <= 1}>
            <Minus size={13} strokeWidth={2.2} />
          </button>
          <span className="w-8 text-center font-mono text-[13px] tabular-nums text-text-primary">{n}</span>
          <button type="button" onClick={() => setN((v) => Math.min(500, v + 1))} aria-label="Une place de plus" className="flex h-9 w-9 items-center justify-center text-text-secondary hover:text-text-primary">
            <Plus size={13} strokeWidth={2.2} />
          </button>
        </div>
        <button type="button" onClick={() => void acheter()} disabled={busy} className="flex min-h-9 items-center gap-1.5 border border-border-strong px-3 text-[12.5px] font-medium text-text-primary hover:bg-surface-hover disabled:opacity-50">
          {busy ? <Loader2 size={12} className="animate-spin" /> : null}
          Acheter {n * PRIX_PLACE_SUPPLEMENTAIRE_EUR} €
        </button>
      </div>
      {erreur && <p role="alert" className="w-full text-xs text-danger">{erreur}</p>}
    </div>
  );
}

/** Les modules hors socle, à la demande : une ligne de plus sur l'abonnement, sans repasser par Stripe. */
function ModulesAUnite() {
  const [etat, setEtat] = useState<AbonnementModulesEtat | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const recharger = () => bridge().remote.abonnementModules().then(setEtat).catch(() => undefined);
  useEffect(() => { void recharger(); }, []);

  const basculer = async (m: ModuleFacturable) => {
    if (busy) return;
    setBusy(m.key);
    setErreur(null);
    try {
      if (m.actif) await bridge().remote.retirerModule(m.key);
      else await bridge().remote.souscrireModule(m.key);
      await recharger();
    } catch (err) {
      setErreur(cleanErrorMessage(err, 'Ce module n’a pas pu être mis à jour.'));
    } finally {
      setBusy(null);
    }
  };

  if (!etat?.modules.length) return null;

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="mb-2 text-[12.5px] text-text-secondary">
        Des modules à l’unité, en plus de ceux déjà inclus — facturés avec le reste, sur la même ligne.
      </p>
      <ul className="divide-y divide-border border border-border bg-bg">
        {etat.modules.map((m) => (
          <li key={m.key} className="flex items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-text-primary">{m.label}</p>
              <p className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
                {MODULE_TARIF_LABELS[m.tarif]}{m.prixEur != null ? ` · ${m.prixEur} €/mois` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void basculer(m)}
              disabled={busy === m.key}
              className={`flex min-h-9 items-center gap-1.5 border px-3 text-[11.5px] font-medium disabled:opacity-50 ${
                m.actif ? 'border-border-strong text-text-primary hover:bg-surface-hover' : 'border-border text-text-secondary hover:border-border-strong hover:text-text-primary'
              }`}
            >
              {busy === m.key ? <Loader2 size={12} className="animate-spin" /> : null}
              {m.actif ? 'Retirer' : 'Souscrire'}
            </button>
          </li>
        ))}
      </ul>
      {erreur && <p role="alert" className="mt-2 text-xs text-danger">{erreur}</p>}
    </div>
  );
}
