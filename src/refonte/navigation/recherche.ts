import { entreeDuRegistre } from './registre';

/**
 * LA RECHERCHE PAR INTENTION — « envoyer une facture » mène à Facturation.
 *
 * Pure, sans React ni stockage : la palette (⌘K), la vue « Tous les modules »
 * et `check:navigation` l'appellent pareil. On compare ce qu'on tape au
 * libellé du module, à ses verbes et à ses mots-clés (`registre.ts`), sans
 * accent ni casse, mot à mot : « facture envoyer » trouve aussi.
 *
 * Le score n'est qu'un ordre : le nom exact d'abord, puis un mot-clé exact,
 * puis un nom qui commence par ce qu'on tape, puis un verbe qui contient la
 * phrase, puis un verbe dont chaque mot tapé est le début d'un mot, puis les
 * autres mots-clés, puis l'indice. À égalité, l'ordre du catalogue.
 */

export interface Cherchable {
  key: string;
  label: string;
  hint?: string;
}

export interface Trouvaille<T extends Cherchable> {
  item: T;
  score: number;
  /** Le verbe qui a fait trouver le module, pour l'afficher à côté (« envoyer une facture »). */
  raison?: string;
}

/** Sans accent, sans casse, apostrophes et tirets changés en espaces. */
export function aplatir(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`\-–—/·,.;:!?()«»"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Les mots qui ne disent pas l'intention : « je veux envoyer une facture » = « envoyer facture ». */
const VIDES = new Set([
  'un', 'une', 'des', 'le', 'la', 'les', 'de', 'du', 'd', 'l', 'a', 'au', 'aux', 'en', 'et', 'ou',
  'mes', 'mon', 'ma', 'me', 'moi', 'je', 'j', 'veux', 'voudrais', 'comment', 'pour', 'sur', 'avec', 'mettre',
]);

function mots(texte: string): string[] {
  return aplatir(texte).split(' ').filter(Boolean);
}

/** Le mot tapé est le début d'un mot du texte, pluriel toléré (« factures » trouve « facture »). */
function motColle(tape: string, mot: string): boolean {
  if (mot.startsWith(tape)) return true;
  return tape.length > 3 && /[sx]$/.test(tape) && mot.startsWith(tape.slice(0, -1));
}

function tousLesMotsCollent(tapes: string[], cible: string[]): boolean {
  return tapes.length > 0 && tapes.every((t) => cible.some((m) => motColle(t, m)));
}

export function chercher<T extends Cherchable>(requete: string, items: readonly T[]): Trouvaille<T>[] {
  const q = aplatir(requete);
  if (!q) return [];
  const tous = q.split(' ');
  const utiles = tous.filter((t) => !VIDES.has(t));
  const tapes = utiles.length > 0 ? utiles : tous;

  const trouvailles: (Trouvaille<T> & { rang: number })[] = [];
  items.forEach((item, rang) => {
    const entree = entreeDuRegistre(item.key);
    const libelle = aplatir(item.label);
    let score = 0;
    let raison: string | undefined;
    const garder = (s: number, r?: string) => {
      if (s > score) {
        score = s;
        raison = r;
      }
    };

    if (libelle === q) garder(120);
    else if (libelle.startsWith(q)) garder(100);
    else if (libelle.includes(q)) garder(85);
    else if (tousLesMotsCollent(tapes, mots(item.label))) garder(80);

    for (const verbe of entree?.verbes ?? []) {
      const v = aplatir(verbe);
      if (v.includes(q)) garder(v.startsWith(q) ? 93 : 90, verbe);
      else if (tousLesMotsCollent(tapes, v.split(' '))) garder(70, verbe);
    }

    // Un mot-clé exact passe devant un libellé qui commence pareil : « facture » est le mot de
    // Facturation, même si « Factures entrantes » commence par lui.
    const singulier = q.length > 3 && /[sx]$/.test(q) ? q.slice(0, -1) : q;
    for (const cle of entree?.motsCles ?? []) {
      const k = aplatir(cle);
      if (k === q || k === singulier) garder(105);
      else if (k.startsWith(q) || tousLesMotsCollent(tapes, k.split(' '))) garder(55);
    }

    if (score === 0 && entree) {
      const sac = [...mots(item.label), ...entree.verbes.flatMap(mots), ...entree.motsCles.flatMap(mots)];
      if (tousLesMotsCollent(tapes, sac)) garder(40);
    }
    if (score === 0 && item.hint && aplatir(item.hint).includes(q)) garder(25);

    if (score > 0) trouvailles.push({ item, score, raison, rang });
  });

  return trouvailles
    .sort((a, b) => b.score - a.score || a.rang - b.rang)
    .map(({ item, score, raison }) => ({ item, score, raison }));
}
