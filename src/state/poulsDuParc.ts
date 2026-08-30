import { useEffect, useState } from 'react';
import { bridge } from '../lib/bridge';
import { IS_BUSINESS } from '../edition/edition';

/**
 * LE POULS DU PARC — ce qui fait respirer l'anneau de l'organisation active
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Le battement est la pièce signature des Signes Vitaux : l'anneau du rail
 * respire lentement quand le parc est calme, plus vite quand un incident
 * critique est ouvert. Pour que ce mouvement ne soit JAMAIS un mensonge, il
 * lui faut une source réelle et une règle d'extinction :
 *
 *   · la source : les incidents ouverts, relus toutes les soixante secondes
 *     (même cadence que le panneau d'attention de l'accueil) ;
 *   · l'extinction : si la dernière ronde a ÉCHOUÉ, l'anneau cesse de
 *     respirer. Un battement dit « ce que tu lis est vivant » — le maintenir
 *     sur des données qu'on ne sait plus lire serait exactement le mensonge
 *     que `live-dot` s'interdit déjà.
 *
 * Magasin de module, comme `parcInsights` : une seule ronde quel que soit le
 * nombre d'abonnés, démarrée au premier, arrêtée au dernier, suspendue quand
 * la fenêtre n'est pas regardée.
 */

export interface PoulsDuParc {
  /** Des incidents critiques OUVERTS, à l'instant de la dernière ronde. */
  critiques: number;
  /** Des incidents ouverts, toutes gravités. */
  ouverts: number;
  /** Faux si la dernière ronde a échoué : le battement doit alors s'éteindre. */
  vivant: boolean;
  /**
   * Les sites qui portent un incident ouvert — pour que la Salle de contrôle
   * embrase les BONS points, pas un compteur anonyme. 'critical' l'emporte
   * quand un site en cumule plusieurs.
   */
  enIncident: ReadonlyMap<string, 'critical' | 'autre'>;
}

const INTERVALLE_MS = 60_000;

let etat: PoulsDuParc = { critiques: 0, ouverts: 0, vivant: false, enIncident: new Map() };
const abonnes = new Set<(p: PoulsDuParc) => void>();
let minuterie: ReturnType<typeof setInterval> | null = null;
let enVol = false;

function publier(next: PoulsDuParc) {
  etat = next;
  for (const a of abonnes) a(etat);
}

async function ronde() {
  if (enVol) return;
  enVol = true;
  try {
    const liste = await bridge().remote.listIncidents({ status: 'open' });
    const enIncident = new Map<string, 'critical' | 'autre'>();
    for (const i of liste) {
      if (!i.siteId) continue;
      const grave = i.severity === 'critical';
      if (grave || !enIncident.has(i.siteId)) enIncident.set(i.siteId, grave ? 'critical' : 'autre');
    }
    publier({
      critiques: liste.filter((i) => i.severity === 'critical').length,
      ouverts: liste.length,
      vivant: true,
      enIncident,
    });
  } catch {
    publier({ ...etat, vivant: false });
  } finally {
    enVol = false;
  }
}

function demarrer() {
  if (minuterie !== null) return;
  void ronde();
  minuterie = setInterval(() => {
    if (!document.hidden) void ronde();
  }, INTERVALLE_MS);
}

function arreter() {
  if (minuterie !== null) {
    clearInterval(minuterie);
    minuterie = null;
  }
}

export function usePoulsDuParc(): PoulsDuParc {
  const [pouls, setPouls] = useState(etat);

  useEffect(() => {
    // Une organisation cliente n'a pas de parc : le pouls n'existe pas, et on
    // ne poserait pas une ronde vers une route qui n'est pas la sienne.
    if (IS_BUSINESS) return;
    const abonne = (p: PoulsDuParc) => setPouls(p);
    abonnes.add(abonne);
    setPouls(etat);
    demarrer();
    return () => {
      abonnes.delete(abonne);
      if (abonnes.size === 0) arreter();
    };
  }, []);

  return pouls;
}
