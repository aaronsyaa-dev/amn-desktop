import { HomeScreen } from '../screens/HomeScreen';
import type { AccueilDef } from '../accueils/types';
import { useEffect, useState } from 'react';
import { bridge } from '../lib/bridge';
import { Releve } from '../accueils/interne/Releve';
import { CarteDesNeuf } from '../accueils/interne/CarteDesNeuf';
import { Fil } from '../accueils/interne/Fil';
import { Radar } from '../accueils/interne/Radar';
import { Compteur } from '../accueils/interne/Compteur';
import { AjmaniDabord } from '../accueils/interne/AjmaniDabord';
import { colonnesCarte } from '../accueils/interne/parc';

/**
 * LES ONZE ACCUEILS DE L'ÉDITION INTERNE — 2a et les dix variantes du cahier 10
 * (`42a` → `42j`, ACCUEILS.md). Aucune variante cliente n'est importée ici.
 */
export const ACCUEILS: AccueilDef[] = [
  {
    code: '2a',
    nom: 'Le poste habité',
    phrase: 'Le QG du jour : le relevé, la file, le parc.',
    vignette: [[6, 8, 88, 14, 'moyen'], [6, 26, 55, 28, 'sombre'], [65, 26, 29, 28, 'sombre'], [6, 12, 20, 6, 'ambre']],
    composant: HomeScreen,
  },
  {
    code: '42a',
    nom: 'La Relève',
    phrase: 'Le bulletin du matin : ce qui s’est passé pendant qu’on n’était pas là.',
    vignette: [[6, 6, 88, 3, 'clair'], [6, 13, 60, 8, 'clair'], [6, 25, 88, 6, 'moyen'], [6, 35, 88, 6, 'ambre'], [6, 44, 88, 5, 'sombre'], [6, 52, 88, 5, 'sombre']],
    composant: Releve,
  },
  {
    code: '42b',
    nom: 'La carte des neuf',
    phrase: 'Le parc en grille, chaque organisation à sa place fixe.',
    vignette: [[6, 6, 28, 15, 'ambre'], [36, 6, 28, 15, 'moyen'], [66, 6, 28, 15, 'moyen'], [6, 23, 28, 15, 'sombre'], [36, 23, 28, 15, 'sombre'], [66, 23, 28, 15, 'sombre'], [6, 40, 28, 15, 'sombre'], [36, 40, 28, 15, 'sombre'], [66, 40, 28, 15, 'sombre']],
    composant: CarteDesNeuf,
  },
  {
    code: '42c',
    nom: 'Le fil',
    phrase: 'Les remontées en direct ; le critique reste épinglé en tête.',
    vignette: [[6, 6, 88, 8, 'ambre'], [6, 17, 88, 1, 'moyen'], [6, 22, 88, 4, 'clair'], [6, 30, 88, 4, 'moyen'], [6, 38, 88, 4, 'moyen'], [6, 46, 88, 4, 'sombre']],
    composant: Fil,
  },
  {
    code: '42d',
    nom: 'Le radar',
    phrase: 'La gravité comme distance : plus un point est près du centre, plus il est grave.',
    vignette: [[22, 4, 52, 52, 'sombre'], [34, 16, 28, 28, 'moyen'], [44, 22, 8, 8, 'ambre'], [70, 14, 24, 4, 'moyen'], [70, 24, 24, 4, 'moyen'], [70, 34, 24, 4, 'sombre']],
    composant: Radar,
  },
  {
    code: '42e',
    nom: 'Le compteur de nuit',
    phrase: 'Ce que la Garde a réglé seule, et ce qu’elle vous rend.',
    vignette: [[6, 16, 10, 20, 'moyen'], [18, 16, 10, 20, 'moyen'], [30, 16, 10, 20, 'moyen'], [42, 16, 10, 20, 'moyen'], [62, 10, 16, 28, 'ambre'], [6, 46, 60, 4, 'sombre']],
    composant: Compteur,
  },
  {
    code: '42f',
    nom: 'Ajmani d’abord',
    phrase: 'La proposition d’Ajmani, seule : il a déjà trié la situation.',
    vignette: [[8, 8, 10, 4, 'clair'], [8, 18, 12, 5, 'ambre'], [24, 17, 62, 7, 'clair'], [24, 27, 50, 7, 'clair'], [24, 38, 18, 4, 'moyen'], [8, 48, 26, 6, 'sombre'], [37, 48, 26, 6, 'sombre'], [66, 48, 26, 6, 'sombre']],
    composant: AjmaniDabord,
  },
];

/**
 * Les Accueils proposés au choix. « Au-delà de seize organisations, la carte
 * des neuf ne convient plus et doit être retirée du choix » (ACCUEILS.md) :
 * le compte du parc est lu une fois, et la variante disparaît de la liste —
 * un compte qui l'avait choisie retombe sur l'Accueil par défaut.
 */
export function useAccueilsDisponibles(): AccueilDef[] {
  const [nOrgs, setNOrgs] = useState<number | null>(null);
  useEffect(() => {
    let vivant = true;
    bridge()
      .remote.admin.listOrganizations()
      .then((l) => vivant && setNOrgs(l.length))
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, []);
  return nOrgs !== null && colonnesCarte(nOrgs) === null ? ACCUEILS.filter((a) => a.code !== '42b') : ACCUEILS;
}
