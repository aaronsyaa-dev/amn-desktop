import { useMemo } from 'react';
import type { BureauKey } from './jetons';
import type { Compteur } from './catalogue';
import { useSupervisor } from './donnees/useSupervisor';
import { useCyber } from './donnees/cyber';
import { useStudio } from './donnees/studio';
import { useGardeBureau } from './donnees/gardeBureau';
import { useSourceBureaux } from './donnees/source';

/**
 * LES COMPTEURS DES COQUILLES — l'onglet « À traiter 12 », la console
 * « Alertes 7 », la porte « Toutes les pièces 12 ». Lus dans les modèles des
 * écrans, jamais écrits à la main (cahier 11 §6 : « aucun compteur n'est écrit
 * à la main dans un écran »). Un compte nul n'est pas affiché : pas de zéro.
 */
export function useCompteurs(bureau: BureauKey | null): Partial<Record<Compteur, number | null>> {
  const src = useSourceBureaux();
  const sup = useSupervisor();
  const cyber = useCyber();
  const studio = useStudio();
  const garde = useGardeBureau();
  return useMemo(() => {
    if (!bureau || !src.pret) return {};
    return {
      aTraiter: sup.file.length,
      organisations: sup.orgs.length,
      automatisations: sup.regles.filter((r) => r.active).length,
      groupes: sup.groupes.size,
      alertes: cyber.alertes.length,
      incidents: cyber.incidents.length,
      echeances: cyber.echeancesProches.length,
      playbooks: cyber.playbooks.length,
      ssl: cyber.sslEnDefaut,
      pieces: studio.pieces.length,
      gardes: garde.gardes,
      avis: src.accueil?.pile.dossiers.length ?? null,
      chefs: garde.chefs.length,
    };
  }, [bureau, src, sup, cyber, studio, garde]);
}
