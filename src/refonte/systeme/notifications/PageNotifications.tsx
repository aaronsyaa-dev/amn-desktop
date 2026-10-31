import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isModuleEnabled } from '../../../data/spaces';
import { useAttention } from '../../../state/useAttention';
import { useMots } from './i18n';
import { magasinNotifications } from './magasin';
import { lignesVisibles, changementsPasserEnResume, lireReglage, type ChangementReglage } from './reglages';
import { JOURS_DE_SILENCE_APRES_GARDER, type CleReport, type Notification, type OptionReport, type SuggestionMoinsDeBruit } from './modele';
import { magasinReglages, useAlimenterPourLaPage, useNotifications, useReglagesNotifications } from './useNotifications';
import { VueNotifications, type ActionsNotifications } from './VueNotifications';

/**
 * LA PAGE NOTIFICATIONS (H40) — la vue branchée sur le magasin réel.
 *
 * Elle s'affiche dans la zone principale de la coquille (`sc-principal`, 24 px 40 px de marge) comme seule : elle ne
 * reconstruit ni la barre latérale, ni l'en-tête, ni la barre d'Ajmani. La cloche de l'en-tête lit le MÊME magasin
 * (`useNotificationsNonLues`) : la pastille et l'onglet « Non lues » ne peuvent pas diverger.
 *
 * Les confirmations « Reportée… » et « Tout est lu » (avec « Annuler », 8 s) passent par `surAnnulable` : le groupe
 * Toast du socle n'existait pas à l'écriture de cette page, l'appelant branche le sien. Sans lui, rien ne s'affiche,
 * mais l'annulation reste réalisable (`annuler` est donné à l'appelant) et chaque geste s'applique quand même.
 */
export interface InfoAnnulable {
  message: string;
  /** Défait le geste (rend les notifications reportées, ou remet « non lues » ce qui vient d'être lu). */
  annuler: () => void;
}

export interface PageNotificationsProps {
  surAnnulable?: (info: InfoAnnulable) => void;
  /** « Réglages » et « Régler mes notifications » : par défaut, la page Paramètres. */
  versReglages?: () => void;
}

/** Délai au-delà duquel un chargement qui ne se termine pas devient l'état d'erreur (avec « Réessayer »). */
export const DELAI_CHARGEMENT_MS = 12_000;

function useMaintenant(pas = 60_000): Date {
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    const minuteur = window.setInterval(() => setMaintenant(new Date()), pas);
    return () => window.clearInterval(minuteur);
  }, [pas]);
  return maintenant;
}

function useEnLigne(): boolean {
  const [enLigne, setEnLigne] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  useEffect(() => {
    const maj = () => setEnLigne(navigator.onLine !== false);
    window.addEventListener('online', maj);
    window.addEventListener('offline', maj);
    return () => {
      window.removeEventListener('online', maj);
      window.removeEventListener('offline', maj);
    };
  }, []);
  return enLigne;
}

/** Le recours : si la coquille n'a pas branché la cloche, la page nourrit elle-même le magasin. */
function AlimentationDeLaPage(): null {
  const { items, checkedAt } = useAttention();
  useAlimenterPourLaPage(items, checkedAt !== null);
  return null;
}

const LIBELLE_REPORT = { heure: 'report.heure', soir: 'report.soir', demain: 'report.demain', lundi: 'report.lundi' } as const satisfies Record<CleReport, string>;

export function PageNotifications({ surAnnulable, versReglages }: PageNotificationsProps): React.ReactElement {
  const navigate = useNavigate();
  const { tm } = useMots();
  const maintenant = useMaintenant();
  const enLigne = useEnLigne();
  const donnees = useNotifications(maintenant);
  const { reglages, echec, enAttente, changer, reessayer: reessayerReglage } = useReglagesNotifications();
  const [essai, setEssai] = useState(0);
  const [delaiDepasse, setDelaiDepasse] = useState(false);

  useEffect(() => {
    setDelaiDepasse(false);
    if (donnees.statut !== 'chargement') return undefined;
    const minuteur = window.setTimeout(() => setDelaiDepasse(true), DELAI_CHARGEMENT_MS);
    return () => window.clearTimeout(minuteur);
  }, [donnees.statut, essai]);
  const statut = donnees.statut === 'chargement' && delaiDepasse ? 'erreur' : donnees.statut;

  const lignesMatrice = useMemo(() => lignesVisibles(isModuleEnabled), []);

  const confirmer = useCallback((info: InfoAnnulable) => surAnnulable?.(info), [surAnnulable]);
  const ouvrirReglages = useCallback(() => (versReglages ? versReglages() : navigate('/settings', { state: { section: 'notifications' } })), [versReglages, navigate]);

  const actions = useMemo<ActionsNotifications>(
    () => ({
      ouvrir: (n: Notification) => {
        magasinNotifications.ouvrir(n.id);
        navigate(n.vers.route, n.vers.state ? { state: n.vers.state } : undefined);
      },
      reporter: (n: Notification, option: OptionReport) => {
        const annuler = magasinNotifications.reporter(n.id, option.echeance);
        const libelle = tm(LIBELLE_REPORT[option.cle], { heure: option.heure });
        confirmer({ message: tm('toast.reportee', { quand: libelle.charAt(0).toLowerCase() + libelle.slice(1) }), annuler });
      },
      basculerLue: (n: Notification) => magasinNotifications.basculerLue(n.id),
      toutMarquerLu: () => {
        const ids = donnees.notifications.filter((n) => !n.lue).map((n) => n.id);
        if (ids.length === 0) return;
        confirmer({ message: tm('toast.toutLu'), annuler: magasinNotifications.toutMarquerLu(ids) });
      },
      reessayer: () => {
        setEssai((n) => n + 1);
        magasinNotifications.rafraichir();
      },
      versReglages: ouvrirReglages,
      changerReglage: (changements: ChangementReglage[]) => changer(changements),
      reessayerReglage: reessayerReglage,
      passerEnResume: (s: SuggestionMoinsDeBruit) => {
        const changements = changementsPasserEnResume(s.categorie);
        const avant = changements.map((c) => ({ chemin: c.chemin, valeur: lireReglage(magasinReglages.instantane().reglages, c.chemin) }));
        if (!changer(changements)) return;
        confirmer({ message: tm(`toast.resume.${s.categorie}`), annuler: () => void changer(avant) });
      },
      garder: (s: SuggestionMoinsDeBruit) => magasinNotifications.garder(s.categorie, new Date(Date.now() + JOURS_DE_SILENCE_APRES_GARDER * 86_400_000)),
    }),
    [navigate, tm, confirmer, ouvrirReglages, changer, reessayerReglage, donnees.notifications],
  );

  return (
    <>
      {!donnees.alimenteParLaCoquille && <AlimentationDeLaPage />}
      <VueNotifications
        statut={statut}
        notifications={donnees.notifications}
        compteurs={donnees.compteurs}
        maintenant={maintenant}
        enLigne={enLigne}
        enAttente={enAttente}
        reglages={reglages}
        lignesMatrice={lignesMatrice}
        echecReglage={echec !== null}
        suggestion={donnees.suggestion}
        actions={actions}
      />
    </>
  );
}
