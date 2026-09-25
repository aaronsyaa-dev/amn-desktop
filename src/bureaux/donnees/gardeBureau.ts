import { useMemo } from 'react';
import type { GardeAgent, GardeDossier, GardeEquipe } from '../../shared/garde';
import { domaineDEquipe } from '../../lib/garde';
import { useSourceBureaux } from './source';

/**
 * LA GARDE, VUE COMME UN ORGANIGRAMME (cahier 11 `45e`, cahier 14 `50a`–`50d`).
 *
 * Les chefs sont les équipes que le serveur déclare (`/v1/garde/salle`), dans
 * son ordre, avec leurs vraies gardes : l'écran ne compte rien à la main.
 *
 * Un « compte rendu » est un dossier de la pile qui attend une lecture
 * humaine : personne ne l'a pris. L'ambre va à la colonne du chef qui l'a
 * écrit — le plus ancien des dossiers non critiques ; le critique, lui, est
 * le seul rouge de l'écran, dans « Ce qui attend un humain ».
 */

export interface Chef {
  key: string;
  /** « Sites », « Sécurité »… */
  nom: string;
  titre: string;
  agents: GardeAgent[];
  equipe: GardeEquipe;
}

export interface ModeleGarde {
  pret: boolean;
  pannes: string[];
  chefs: Chef[];
  gardes: number;
  enRonde: number;
  /** Ce qui attend un humain : le dossier critique (pris ou non), puis les comptes rendus. */
  attend: GardeDossier[];
  /** Les comptes rendus : les dossiers non critiques que personne n'a pris. */
  comptesRendus: GardeDossier[];
  /** Tous les dossiers critiques — pris ou non, ils sont le rouge de l'écran. */
  critique: GardeDossier | null;
  compteRendu: GardeDossier | null;
  nuit: { rondes: number | null; regles: number | null; remontees: number | null; reveils: number | null };
  heureReleve: number;
  muette: boolean;
  at: string | null;
}

const capitale = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function useGardeBureau(): ModeleGarde {
  const src = useSourceBureaux();
  return useMemo(() => {
    const salle = src.salle;
    const accueil = src.accueil;
    const chefs: Chef[] = (salle?.equipes ?? []).map((equipe) => ({
      key: equipe.key,
      nom: capitale(domaineDEquipe(equipe.nom)),
      titre: equipe.chef?.nom ?? equipe.nom,
      agents: (salle?.agents ?? []).filter((a) => a.equipe === equipe.key),
      equipe,
    }));
    const dossiers = accueil?.pile.dossiers ?? [];
    const comptesRendus = dossiers.filter((d) => !d.prisPar && d.gravite !== 'critique').sort((a, b) => a.depuis.localeCompare(b.depuis));
    const critiques = dossiers.filter((d) => d.gravite === 'critique').sort((a, b) => b.n - a.n);
    const critique = critiques[0] ?? null;
    const attend = [...critiques, ...comptesRendus];
    const compteRendu = comptesRendus[0] ?? null;
    const releve = accueil?.releve ?? null;
    const cloture = accueil?.cloture ?? null;
    const silence = salle?.reglages?.silence ?? { de: 22, a: 7 };
    const deNuit = (iso: string) => {
      const h = new Date(iso).getHours();
      return silence.de > silence.a ? h >= silence.de || h < silence.a : h >= silence.de && h < silence.a;
    };
    return {
      pret: src.pret,
      pannes: src.pannes,
      chefs,
      gardes: salle?.agents.length ?? 0,
      enRonde: (salle?.agents ?? []).filter((a) => a.etat === 'ronde').length,
      attend,
      comptesRendus,
      critique,
      compteRendu,
      nuit: {
        rondes: cloture?.rondesNuit ?? null,
        regles: releve?.totaux.regles ?? null,
        remontees: releve?.totaux.remontes ?? null,
        reveils: accueil ? dossiers.filter((d) => d.gravite === 'critique' && deNuit(d.depuis)).length : null,
      },
      heureReleve: salle?.reglages?.heureTour ?? 7,
      muette: src.pret && src.pannes.includes('la Salle'),
      at: src.at,
    };
  }, [src]);
}
