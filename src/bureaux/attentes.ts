import { useMemo } from 'react';
import { itemsForSpace } from '../data/spaces';
import type { EspaceKey } from './jetons';
import { useSupervisor } from './donnees/useSupervisor';
import { useCyber } from './donnees/cyber';
import { useStudio } from './donnees/studio';
import { useStrategie } from './donnees/strategie';
import { useGardeBureau } from './donnees/gardeBureau';
import { signe } from './format';

/**
 * CE QUI ATTEND DANS CHAQUE ESPACE — une ligne par espace, pour la palette
 * (« 1 sans personne ») et pour le carton du sas (« la ligne ambre de
 * l'accueil, même donnée, même texte »).
 *
 * Lu dans les MÊMES modèles que les accueils : la palette ne compte rien de
 * son côté. `humain` dit que la chose attend une personne ; la palette donne
 * l'ambre à la première de ces lignes hors du bureau courant. `critique`
 * dit qu'un bureau porte un critique que personne n'a pris : c'est le seul
 * cas où la palette écrit en rouge. Un critique non pris est l'affaire de
 * Cyber (le centre de sécurité) : c'est sa ligne qui le dit, une fois —
 * Supervisor garde la sienne, « N sans personne ».
 */

export interface Attente {
  texte: string | null;
  humain: boolean;
  critique: boolean;
  /** La ligne ambre de l'accueil, pour le carton de la plongée ; `null` s'il n'a pas d'ambre. */
  carton: string | null;
}

const rien: Attente = { texte: null, humain: false, critique: false, carton: null };
const pl = (n: number, un: string, des: string) => `${n} ${n > 1 ? des : un}`;

export function useAttentes(): Record<EspaceKey, Attente> {
  const sup = useSupervisor();
  const cyber = useCyber();
  const studio = useStudio();
  const strat = useStrategie();
  const garde = useGardeBureau();
  const modules = itemsForSpace('workspace').length;

  return useMemo(() => {
    const supervisor: Attente = sup.sansPersonne.length
      ? { texte: pl(sup.sansPersonne.length, 'sans personne', 'sans personne'), humain: true, critique: false, carton: sup.ambre ? `${sup.ambre.nom} · personne` : null }
      : sup.file.length
        ? { texte: pl(sup.file.length, 'à traiter', 'à traiter'), humain: false, critique: false, carton: null }
        : rien;
    const cyberA: Attente = cyber.critiquesNonPris
      ? { texte: pl(cyber.critiquesNonPris, 'critique non pris', 'critiques non pris'), humain: true, critique: true, carton: cyber.ambre ? `${cyber.ambre.nom} · ${signe(cyber.ambre.tendance ?? 0)} en 7 j` : null }
      : cyber.alertes.length
        ? { texte: pl(cyber.alertes.length, 'alerte', 'alertes'), humain: false, critique: false, carton: cyber.ambre ? `${cyber.ambre.nom} · ${signe(cyber.ambre.tendance ?? 0)} en 7 j` : null }
        : { ...rien, carton: cyber.ambre ? `${cyber.ambre.nom} · ${signe(cyber.ambre.tendance ?? 0)} en 7 j` : null };
    const studioA: Attente = studio.retoursOuverts.length
      ? { texte: pl(studio.retoursOuverts.length, 'retour client', 'retours client'), humain: true, critique: false, carton: studio.ambre ? `${studio.ambre.plaque} · retour à traiter` : null }
      : rien;
    const strategie: Attente = strat.appels.length
      ? { texte: pl(strat.appels.length, 'appel aujourd’hui', 'appels aujourd’hui'), humain: true, critique: false, carton: strat.ambre ? `${strat.ambre.company || strat.ambre.name} · à appeler aujourd’hui` : null }
      : rien;
    const gardeA: Attente = garde.comptesRendus.length
      ? { texte: pl(garde.comptesRendus.length, 'compte rendu', 'comptes rendus'), humain: true, critique: false, carton: `${pl(garde.comptesRendus.length, 'compte rendu', 'comptes rendus')} à lire` }
      : rien;
    return {
      poste: { texte: pl(modules, 'module', 'modules'), humain: false, critique: false, carton: null },
      supervisor,
      cyber: cyberA,
      studio: studioA,
      strategie,
      garde: gardeA,
    };
  }, [sup, cyber, studio, strat, garde, modules]);
}
