import { BIBLIOTHEQUE, ASTUCES, registreEffectif, remplir, type Astuce, type Situation } from './phrases';
import type { Registre } from './registre';

/**
 * QUAND ET QUOI DIRE — l'anti-répétition et la limite de fréquence.
 * ═════════════════════════════════════════════════════════════════
 *
 * Ajmani parle rarement. Tout ce qui le retient vit dans un petit état
 * (`EtatParole`) que ce module lit et transforme SANS rien stocker lui-même :
 * `memoire.ts` le range dans `localStorage`, les contrôles le rejouent hors
 * application avec un hasard et une horloge choisis.
 *
 *   · Anti-répétition : pour chaque situation, les dernières variantes dites
 *     sont retenues ; on tire parmi celles qui n'ont pas servi récemment, et
 *     jamais deux fois de suite la même.
 *   · Astuces : 2 par jour au plus, une seule à la fois, et jamais une
 *     astuce masquée (« ne plus me montrer ça »).
 *   · Réactions (une facture encaissée, un nouveau client) : 4 par jour au
 *     plus, et 90 secondes au moins entre deux.
 *   · La réplique de l'Accueil est fixée pour la journée et la scène : revenir
 *     sur l'Accueil ne la fait pas changer à chaque fois.
 */

export const ASTUCES_PAR_JOUR = 2;
export const REACTIONS_PAR_JOUR = 4;
export const ECART_REACTIONS_MS = 90_000;
/** Combien de variantes récentes on évite de redire, au plus. */
const MEMOIRE_VARIANTES = 3;

export interface EtatParole {
  /** Par clé « langue:situation:registre », les indices des variantes dites, du plus ancien au plus récent. */
  dites: Record<string, number[]>;
  astuces: { jour: string; n: number; vues: string[] };
  masquees: string[];
  reactions: { jour: string; n: number; derniere: number };
  /** La réplique de l'Accueil, fixée pour (jour, scène). */
  repliques: Record<string, string>;
}

export function etatVide(): EtatParole {
  return { dites: {}, astuces: { jour: '', n: 0, vues: [] }, masquees: [], reactions: { jour: '', n: 0, derniere: 0 }, repliques: {} };
}

/** Le jour local, `AAAA-MM-JJ`. */
export function jourDe(maintenant: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${maintenant.getFullYear()}-${p(maintenant.getMonth() + 1)}-${p(maintenant.getDate())}`;
}

export interface Replique {
  situation: Situation;
  registre: Registre;
  texte: string;
}

/**
 * Choisit une variante et rend l'état mis à jour. Ne lève jamais : une
 * situation sans variante rend une chaîne vide (les contrôles l'interdisent).
 */
export function choisir(
  etat: EtatParole,
  langue: 'fr' | 'en',
  situation: Situation,
  reglage: Registre,
  params: Record<string, string | number> = {},
  hasard: () => number = Math.random,
): { replique: Replique; etat: EtatParole } {
  const variantes = BIBLIOTHEQUE[langue][situation];
  let registre = registreEffectif(reglage, situation, variantes);
  // Taquin est un plafond : une fois sur deux, il reste simplement chill.
  if (registre === 'taquin' && (variantes.chill?.length ?? 0) > 0 && hasard() < 0.5) registre = 'chill';
  const liste = variantes[registre] ?? variantes.serieux;
  const cle = `${langue}:${situation}:${registre}`;
  const recents = etat.dites[cle] ?? [];
  const aEviter = new Set(recents.slice(-Math.min(MEMOIRE_VARIANTES, Math.max(0, liste.length - 1))));
  const libres = liste.map((_, i) => i).filter((i) => !aEviter.has(i));
  const candidats = libres.length ? libres : liste.map((_, i) => i).filter((i) => i !== recents[recents.length - 1]);
  const pool = candidats.length ? candidats : [0];
  const indice = pool[Math.min(pool.length - 1, Math.floor(Math.max(0, hasard()) * pool.length))];
  const texte = liste.length ? remplir(liste[indice], params) : '';
  const suivant: EtatParole = { ...etat, dites: { ...etat.dites, [cle]: [...recents, indice].slice(-8) } };
  return { replique: { situation, registre, texte }, etat: suivant };
}

/**
 * La réplique de l'Accueil pour (jour, scène) : choisie une fois, puis rendue
 * telle quelle tant que la scène et le jour ne changent pas.
 */
export function repliqueDuJour(
  etat: EtatParole,
  jour: string,
  scene: string,
  langue: 'fr' | 'en',
  situation: Situation,
  reglage: Registre,
  params: Record<string, string | number> = {},
  hasard: () => number = Math.random,
): { texte: string; etat: EtatParole } {
  const cle = `${jour}|${scene}|${langue}|${reglage}|${situation}|${JSON.stringify(params)}`;
  const deja = etat.repliques[cle];
  if (deja) return { texte: deja, etat };
  const { replique, etat: apres } = choisir(etat, langue, situation, reglage, params, hasard);
  // Seules les répliques du jour sont gardées : la mémoire ne grossit pas.
  const gardees = Object.fromEntries(Object.entries(apres.repliques).filter(([k]) => k.startsWith(`${jour}|`)));
  return { texte: replique.texte, etat: { ...apres, repliques: { ...gardees, [cle]: replique.texte } } };
}

/** L'astuce à montrer maintenant, ou `null` : budget du jour, masquées et déjà vues aujourd'hui exclues. */
export function astuceDuMoment(etat: EtatParole, jour: string, offertes: readonly Astuce[] = ASTUCES): Astuce | null {
  const compte = etat.astuces.jour === jour ? etat.astuces : { jour, n: 0, vues: [] };
  if (compte.n >= ASTUCES_PAR_JOUR) return null;
  return offertes.find((a) => !etat.masquees.includes(a) && !compte.vues.includes(a)) ?? null;
}

/** Compte une astuce montrée aujourd'hui. */
export function noterAstuce(etat: EtatParole, jour: string, astuce: Astuce): EtatParole {
  const compte = etat.astuces.jour === jour ? etat.astuces : { jour, n: 0, vues: [] };
  if (compte.vues.includes(astuce)) return etat;
  return { ...etat, astuces: { jour, n: compte.n + 1, vues: [...compte.vues, astuce] } };
}

/** « Ne plus me montrer ça ». */
export function masquerAstuce(etat: EtatParole, astuce: Astuce): EtatParole {
  return etat.masquees.includes(astuce) ? etat : { ...etat, masquees: [...etat.masquees, astuce] };
}

/** Une réaction est-elle permise maintenant ? */
export function peutReagir(etat: EtatParole, maintenant: number, jour: string): boolean {
  const r = etat.reactions.jour === jour ? etat.reactions : { jour, n: 0, derniere: 0 };
  return r.n < REACTIONS_PAR_JOUR && maintenant - r.derniere >= ECART_REACTIONS_MS;
}

export function noterReaction(etat: EtatParole, maintenant: number, jour: string): EtatParole {
  const r = etat.reactions.jour === jour ? etat.reactions : { jour, n: 0, derniere: 0 };
  return { ...etat, reactions: { jour, n: r.n + 1, derniere: maintenant } };
}

/** Relit un état stocké sans jamais lever : un stockage abîmé redevient un état vide. */
export function relireEtat(brut: string | null): EtatParole {
  if (!brut) return etatVide();
  try {
    const v = JSON.parse(brut) as Partial<EtatParole>;
    const vide = etatVide();
    return {
      dites: v.dites && typeof v.dites === 'object' ? v.dites : vide.dites,
      astuces: v.astuces && typeof v.astuces.jour === 'string' && Array.isArray(v.astuces.vues) ? v.astuces : vide.astuces,
      masquees: Array.isArray(v.masquees) ? v.masquees.filter((x): x is string => typeof x === 'string') : vide.masquees,
      reactions: v.reactions && typeof v.reactions.n === 'number' ? v.reactions : vide.reactions,
      repliques: v.repliques && typeof v.repliques === 'object' ? v.repliques : vide.repliques,
    };
  } catch {
    return etatVide();
  }
}
