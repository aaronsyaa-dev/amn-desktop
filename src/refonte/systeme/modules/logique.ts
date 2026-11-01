import { aplatir } from '../../navigation/recherche';

/**
 * LA LOGIQUE DU PANNEAU « TOUS LES MODULES » (D02) — pure, sans React, éprouvée par `check:systeme-modules`.
 *
 * Elle répond à quatre questions : quelles lignes une carte montre-t-elle (7, la ligne d'action de la meilleure
 * correspondance comprise), que dit son pied « + N autres », dans quel ordre la sélection parcourt-elle les
 * correspondances, et quelle partie d'un libellé est en gras. Aucun chiffre n'est écrit ici : 101, les effectifs
 * des familles et les trois niveaux se calculent depuis le registre.
 */

export type Niveau = 'essentiel' | 'courant' | 'avance';
export type FiltreNiveau = 'tous' | Niveau;
export const LIGNES_PAR_CARTE = 7;

export interface EntreeSource {
  id: string;
  nom: string;
  vers: string;
  niveau: Niveau;
  badge: number;
  /** Les prénoms des collègues actifs dans ce module (au plus ceux de l'appelant). */
  personnes: string[];
  epingle: boolean;
}

export interface FamilleSource {
  id: string;
  nom: string;
  teinte: string;
  /** La page d'accueil de la famille (clic sur son nom). */
  vers: string;
  entrees: EntreeSource[];
}

export interface Correspondance {
  score: number;
  /** Le verbe qui a fait trouver le module (« envoyer une facture »). */
  raison?: string;
}

export type LigneCarte =
  | { type: 'module'; id: string; entree: EntreeSource; correspond: boolean }
  | { type: 'action'; id: string; libelle: string; vers: string; entree: EntreeSource };

export interface CarteComposee {
  id: string;
  nom: string;
  teinte: string;
  vers: string;
  /** L'effectif de la famille APRÈS le filtre de niveau. */
  effectif: number;
  lignes: LigneCarte[];
  /** « + N autres » : l'effectif moins les modules montrés (la ligne d'action n'est pas un module). */
  reste: number;
  /** Aucun module à ce niveau : la carte garde sa taille et le dit. */
  videAuNiveau: boolean;
  /** Le total de la famille sans filtre, pour « Voir les N modules ». */
  totalSansFiltre: number;
}

export function majuscule(texte: string): string {
  return texte.charAt(0).toLocaleUpperCase('fr-FR') + texte.slice(1);
}

/** Les effectifs de chaque niveau, sur tout le registre (les pastilles de filtre gardent ces totaux globaux). */
export function compterParNiveau(familles: readonly FamilleSource[]): Record<FiltreNiveau, number> {
  const n: Record<FiltreNiveau, number> = { tous: 0, essentiel: 0, courant: 0, avance: 0 };
  for (const f of familles) for (const e of f.entrees) {
    n.tous += 1;
    n[e.niveau] += 1;
  }
  return n;
}

/**
 * Les cartes à montrer. Sans recherche : les modules épinglés d'abord, puis l'ordre du registre. Avec une recherche :
 * les correspondances remontent en tête de leur carte (meilleur score d'abord) ; la meilleure correspondance globale
 * qui est née d'un VERBE ajoute une ligne d'action en tête de sa carte. `deplie` : cartes en mode complet.
 */
export function composerCartes(
  familles: readonly FamilleSource[],
  options: { niveau: FiltreNiveau; correspondances: ReadonlyMap<string, Correspondance> | null; deplie: ReadonlySet<string> },
): CarteComposee[] {
  const { niveau, correspondances, deplie } = options;
  let meilleur: { id: string; c: Correspondance } | null = null;
  if (correspondances) {
    for (const [id, c] of correspondances) if (!meilleur || c.score > meilleur.c.score) meilleur = { id, c };
  }
  return familles.map((f) => {
    const retenues = f.entrees.filter((e) => niveau === 'tous' || e.niveau === niveau);
    const rang = new Map(retenues.map((e, i) => [e.id, i]));
    const ordonnees = [...retenues].sort((a, b) => {
      if (correspondances) {
        const sa = correspondances.get(a.id)?.score ?? 0;
        const sb = correspondances.get(b.id)?.score ?? 0;
        if (sa !== sb) return sb - sa;
      } else if (a.epingle !== b.epingle) return a.epingle ? -1 : 1;
      return (rang.get(a.id) ?? 0) - (rang.get(b.id) ?? 0);
    });
    const complet = deplie.has(f.id);
    const action = meilleur && meilleur.c.raison ? ordonnees.find((e) => e.id === meilleur?.id) : undefined;
    const places = complet ? ordonnees.length : Math.max(0, LIGNES_PAR_CARTE - (action ? 1 : 0));
    const montres = ordonnees.slice(0, places);
    const lignes: LigneCarte[] = [];
    if (action && meilleur?.c.raison) lignes.push({ type: 'action', id: `action:${action.id}`, libelle: majuscule(meilleur.c.raison), vers: action.vers, entree: action });
    for (const e of montres) lignes.push({ type: 'module', id: e.id, entree: e, correspond: Boolean(correspondances?.has(e.id)) });
    return {
      id: f.id,
      nom: f.nom,
      teinte: f.teinte,
      vers: f.vers,
      effectif: retenues.length,
      lignes,
      reste: complet ? 0 : Math.max(0, ordonnees.length - montres.length),
      videAuNiveau: retenues.length === 0 && f.entrees.length > 0,
      totalSansFiltre: f.entrees.length,
    };
  });
}

/** Les lignes que ↑ ↓ parcourent : les correspondances seulement, la meilleure d'abord, à score égal dans l'ordre de lecture des cartes. */
export function ordreDeSelection(cartes: readonly CarteComposee[], correspondances: ReadonlyMap<string, Correspondance> | null): string[] {
  if (!correspondances) return [];
  const lues: { id: string; score: number; i: number }[] = [];
  let i = 0;
  for (const c of cartes) for (const l of c.lignes) {
    if (l.type === 'action') lues.push({ id: l.id, score: (correspondances.get(l.entree.id)?.score ?? 0) + 1000, i: i++ });
    else if (l.correspond) lues.push({ id: l.id, score: correspondances.get(l.id)?.score ?? 0, i: i++ });
  }
  return lues.sort((a, b) => b.score - a.score || a.i - b.i).map((x) => x.id);
}

/** La carte « active » : celle de la ligne sélectionnée. */
export function carteDeLaLigne(cartes: readonly CarteComposee[], idLigne: string | undefined): string | undefined {
  if (!idLigne) return undefined;
  return cartes.find((c) => c.lignes.some((l) => l.id === idLigne))?.id;
}

/**
 * Le début d'un libellé qui correspond à ce qu'on a tapé : [en gras, le reste]. Insensible aux accents, à la casse et
 * à la ponctuation ; si le libellé ne commence pas par la saisie, tout reste en texte courant.
 */
export function surligner(libelle: string, saisie: string): [string, string] {
  const cible = aplatir(saisie).replace(/ /g, '');
  if (!cible) return ['', libelle];
  let k = 0;
  let fin = 0;
  for (let i = 0; i < libelle.length && k < cible.length; i += 1) {
    const brut = aplatir(libelle[i]).replace(/ /g, '');
    if (brut === '') {
      fin = i + 1;
      continue;
    }
    if (brut[0] !== cible[k]) return ['', libelle];
    k += 1;
    fin = i + 1;
  }
  return k === cible.length ? [libelle.slice(0, fin), libelle.slice(fin)] : ['', libelle];
}

/** Les touches fléchées dans la grille : l'indice voisin parmi `n` éléments dans l'ordre de lecture. */
export function voisin(index: number, n: number, touche: string): number {
  if (n === 0) return -1;
  if (touche === 'ArrowDown' || touche === 'ArrowRight') return Math.min(n - 1, index + 1);
  if (touche === 'ArrowUp' || touche === 'ArrowLeft') return Math.max(0, index - 1);
  if (touche === 'Home') return 0;
  if (touche === 'End') return n - 1;
  return index;
}
