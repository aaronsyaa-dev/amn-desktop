import { useEffect, useState } from 'react';
import { MOUVEMENT, type EspaceKey } from './jetons';

/**
 * L'AMBIANCE, LE SAS, ET LA SESSION — trois réglages du poste (cahier 11 §2-3).
 *
 * · Ambiance (interrupteur de la barre haute) : coupée, elle arrête tout
 *   mouvement ambiant et remplace les sas par un fondu de 160 ms, pour CE
 *   poste. Le système qui demande moins de mouvement la coupe d'office.
 * · Le sas : « La porte » (la plus sobre) ou « La plongée » (la seule qui dise
 *   quelque chose avant d'arriver). Un choix de poste, lui aussi.
 * · La session : le sas complet se joue à la PREMIÈRE entrée dans un bureau ;
 *   ensuite, la version courte. La mémoire est tenue par bureau, et la
 *   session se termine à la fermeture de l'application, à la veille, ou après
 *   quatre heures sans activité.
 */

const CLE_AMBIANCE = 'amn.bureaux.ambiance';
const CLE_SAS = 'amn.bureaux.sas';
const EVENEMENT = 'amn:bureaux-reglages';

export type VarianteSas = 'porte' | 'plongee';

function lire(cle: string): string | null {
  try {
    return window.localStorage.getItem(cle);
  } catch {
    return null;
  }
}
function ecrire(cle: string, valeur: string) {
  try {
    window.localStorage.setItem(cle, valeur);
  } catch {
    /* un poste sans stockage garde le défaut, sans bruit */
  }
  window.dispatchEvent(new Event(EVENEMENT));
}

export function ambianceActive(): boolean {
  return lire(CLE_AMBIANCE) !== 'coupee';
}
export function poserAmbiance(active: boolean) {
  ecrire(CLE_AMBIANCE, active ? 'active' : 'coupee');
}
export function varianteSas(): VarianteSas {
  return lire(CLE_SAS) === 'porte' ? 'porte' : 'plongee';
}
export function poserVarianteSas(v: VarianteSas) {
  ecrire(CLE_SAS, v);
}

export function mouvementReduit(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

/** Le mouvement ambiant est-il permis sur ce poste, maintenant ? */
export function mouvementPermis(): boolean {
  return ambianceActive() && !mouvementReduit();
}

export function useReglagesBureaux(): { ambiance: boolean; reduit: boolean; sas: VarianteSas } {
  const [etat, setEtat] = useState(() => ({ ambiance: ambianceActive(), reduit: mouvementReduit(), sas: varianteSas() }));
  useEffect(() => {
    const maj = () => setEtat({ ambiance: ambianceActive(), reduit: mouvementReduit(), sas: varianteSas() });
    window.addEventListener(EVENEMENT, maj);
    window.addEventListener('storage', maj);
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    mq?.addEventListener?.('change', maj);
    return () => {
      window.removeEventListener(EVENEMENT, maj);
      window.removeEventListener('storage', maj);
      mq?.removeEventListener?.('change', maj);
    };
  }, []);
  return etat;
}

/* ── La session ──────────────────────────────────────────────────────── */

const entres = new Set<EspaceKey>();
let derniereActivite = Date.now();

/** Un geste de la personne : la session vit encore — ou recommence après 4 h. */
export function noterActivite(maintenant = Date.now()) {
  if (maintenant - derniereActivite > MOUVEMENT.finDeSession) entres.clear();
  derniereActivite = maintenant;
}

/** La veille termine la session : la prochaine entrée rejoue le sas complet. */
export function finirSession() {
  entres.clear();
}

/** Première entrée dans cet espace pendant la session ? La réponse la consomme. */
export function premiereEntree(e: EspaceKey): boolean {
  noterActivite();
  if (entres.has(e)) return false;
  entres.add(e);
  return true;
}

/** Marque un espace comme déjà entré, sans rien jouer (ouverture directe de l'application dedans). */
export function marquerEntre(e: EspaceKey) {
  entres.add(e);
}

if (typeof window !== 'undefined') {
  const geste = () => noterActivite();
  window.addEventListener('pointerdown', geste, { passive: true, capture: true });
  window.addEventListener('keydown', geste, { passive: true, capture: true });
  window.addEventListener('amn:veille-ouverte', finirSession);
}
