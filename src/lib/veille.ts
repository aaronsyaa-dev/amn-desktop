/**
 * L'ÉCRAN DE VEILLE DE L'ÉDITION CLIENTE (`41a`, ACCUEILS.md) — ses règles,
 * pures et éprouvées par `check:cinquante` (bloc « Veille »).
 *
 * Les réglages sont ceux du POSTE, pas du compte : « poste déclaré en accueil
 * du public », délai, heure de fermeture décrivent l'appareil posé sur le
 * comptoir, pas la personne connectée. Ils vivent donc dans le stockage local
 * du poste — et tout se comporte correctement si ce stockage est refusé.
 */

export type DelaiVeille = 2 | 5 | 10 | 0;
export interface ReglagesVeille {
  /** Minutes sans action avant la veille ; 0 = jamais. */
  delaiMin: DelaiVeille;
  /** Le poste est déclaré en accueil du public. */
  accueilPublic: boolean;
  /** Montants (et noms des clients) masqués en veille ; `null` = suivre `accueilPublic`. */
  masque: boolean | null;
  /** L'heure de fermeture déclarée (fin de la bande et entrée en mode nuit). */
  fermetureH: number;
}

export const DELAIS_VEILLE: DelaiVeille[] = [2, 5, 10, 0];
export const REGLAGES_VEILLE_DEFAUT: ReglagesVeille = { delaiMin: 5, accueilPublic: false, masque: null, fermetureH: 20 };
/** La bande de la journée : de 08 h à 20 h. */
export const BANDE = { debutH: 8, finH: 20 } as const;
/** « L'ensemble glisse de quelques pixels toutes les dix minutes, dans une amplitude de ± 8 px. » */
export const DERIVE = { periodeMs: 10 * 60_000, amplitudePx: 8 } as const;
export const MONTANT_MASQUE = '— €';

const CLE = 'amn.veille.reglages';
export const EVENEMENT_REGLAGES = 'amn:veille-reglages';
export const EVENEMENT_APERCU = 'amn:veille-apercu';

export function lireReglagesVeille(): ReglagesVeille {
  try {
    const brut = window.localStorage.getItem(CLE);
    if (!brut) return REGLAGES_VEILLE_DEFAUT;
    const r = JSON.parse(brut) as Partial<ReglagesVeille>;
    return {
      delaiMin: DELAIS_VEILLE.includes(r.delaiMin as DelaiVeille) ? (r.delaiMin as DelaiVeille) : REGLAGES_VEILLE_DEFAUT.delaiMin,
      accueilPublic: r.accueilPublic === true,
      masque: typeof r.masque === 'boolean' ? r.masque : null,
      fermetureH: Number.isInteger(r.fermetureH) && (r.fermetureH as number) >= 12 && (r.fermetureH as number) <= 24 ? (r.fermetureH as number) : REGLAGES_VEILLE_DEFAUT.fermetureH,
    };
  } catch {
    return REGLAGES_VEILLE_DEFAUT;
  }
}

export function ecrireReglagesVeille(r: ReglagesVeille): void {
  try {
    window.localStorage.setItem(CLE, JSON.stringify(r));
  } catch {
    /* stockage refusé : le réglage ne vaut que pour cette session */
  }
  window.dispatchEvent(new CustomEvent(EVENEMENT_REGLAGES, { detail: r }));
}

/** « Montants masqués en veille, activé par défaut quand le poste est déclaré en accueil du public. » */
export const masqueEffectif = (r: ReglagesVeille) => (r.masque === null ? r.accueilPublic : r.masque);

/** « Après la fermeture déclarée, mode nuit » — et jusqu'à l'ouverture du lendemain (08 h). */
export function enModeNuit(maintenant: Date, fermetureH: number): boolean {
  const h = maintenant.getHours() + maintenant.getMinutes() / 60;
  return h >= fermetureH || h < BANDE.debutH;
}

/** La dérive anti-marquage : fixe pendant dix minutes, puis un autre décalage, toujours dans ± 8 px. */
export function derive(maintenantMs: number): { x: number; y: number } {
  const pas = Math.floor(maintenantMs / DERIVE.periodeMs);
  const a = DERIVE.amplitudePx;
  const x = (((pas * 37) % (2 * a + 1)) + 2 * a + 1) % (2 * a + 1) - a;
  const y = (((pas * 53 + 7) % (2 * a + 1)) + 2 * a + 1) % (2 * a + 1) - a;
  return { x, y };
}

/** La place d'un créneau sur la bande 08 h → 20 h, en % de sa largeur ; hors bande : null. */
export function surLaBande(debutH: number, dureeH: number): { gauche: number; largeur: number } | null {
  const a = Math.max(debutH, BANDE.debutH);
  const b = Math.min(debutH + dureeH, BANDE.finH);
  if (b <= a) return null;
  const total = BANDE.finH - BANDE.debutH;
  return { gauche: ((a - BANDE.debutH) / total) * 100, largeur: ((b - a) / total) * 100 };
}

/** Le trait de l'heure qu'il est, en % de la bande (borné à ses extrémités). */
export const traitMaintenant = (h: number) => Math.min(100, Math.max(0, ((h - BANDE.debutH) / (BANDE.finH - BANDE.debutH)) * 100));
