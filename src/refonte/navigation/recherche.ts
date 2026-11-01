import { entreeDuRegistre } from './registre';

/**
 * LA RECHERCHE PAR INTENTION — « envoyer une facture » mène à Facturation.
 *
 * Pure, sans React ni stockage : la palette (⌘K), la vue « Tous les modules »
 * et `check:navigation` l'appellent pareil. On compare ce qu'on tape au
 * libellé du module, au nom de son entrée, à ses verbes et à ses mots-clés
 * (`src/refonte/modules/declarations/`), sans accent ni casse, mot à mot :
 * « facture envoyer » trouve aussi.
 *
 * LA LANGUE. Les verbes et mots-clés de la langue de l'application comptent
 * en plein ; ceux de l'autre langue comptent un peu moins et ne s'affichent
 * pas à côté du résultat. On trouve donc « send an invoice » en anglais comme
 * en français, et « facture » même quand l'interface est en anglais. Une vue
 * sans mots anglais retombe sur le français.
 *
 * Le score n'est qu'un ordre : le nom exact d'abord, puis un mot-clé exact,
 * puis un nom qui commence par ce qu'on tape, puis un verbe qui contient la
 * phrase, puis un verbe dont chaque mot tapé est le début d'un mot, puis les
 * autres mots-clés, puis l'indice. En dernier recours, une faute de frappe
 * d'une lettre (« facutre ») trouve encore. À égalité : un essentiel avant un
 * courant avant un avancé, la vue principale d'une entrée avant ses autres
 * vues, puis l'ordre du catalogue.
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

export type LangueRecherche = 'fr' | 'en';

export interface OptionsRecherche {
  /** La langue de l'application ; le français par défaut. */
  langue?: LangueRecherche;
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
  'the', 'an', 'to', 'my', 'i', 'want', 'how', 'do', 'of', 'for', 'on', 'in', 'and', 'or', 'with', 'would', 'like', 'please',
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

/**
 * Distance d'édition (une transposition compte pour une), arrêtée dès qu'elle
 * dépasse `max` : on ne compare que des mots courts, mais chaque frappe en
 * compare des centaines.
 */
export function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let avant: number[] = [];
  let courant = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const precedent = avant;
    avant = courant;
    courant = [i];
    let min = i;
    for (let j = 1; j <= b.length; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(avant[j] + 1, courant[j - 1] + 1, avant[j - 1] + cout);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, precedent[j - 2] + 1);
      courant[j] = d;
      if (d < min) min = d;
    }
    if (min > max) return max + 1;
  }
  return courant[b.length];
}

/**
 * Un mot tapé de cinq lettres ou plus colle à un mot du texte à une faute près
 * (deux au-delà de neuf lettres) : le mot entier, ou son début quand on n'a pas fini de taper.
 */
function motProche(tape: string, mot: string): boolean {
  if (tape.length < 5) return false;
  const tolere = tape.length >= 9 ? 2 : 1;
  return distance(tape, mot, tolere) <= tolere || distance(tape, mot.slice(0, tape.length), tolere) <= tolere;
}

const RANG_NIVEAU = { essentiel: 0, courant: 1, avance: 2 } as const;

export function chercher<T extends Cherchable>(requete: string, items: readonly T[], options: OptionsRecherche = {}): Trouvaille<T>[] {
  const langue = options.langue ?? 'fr';
  const q = aplatir(requete);
  if (!q) return [];
  const tous = q.split(' ');
  const utiles = tous.filter((t) => !VIDES.has(t));
  const tapes = utiles.length > 0 ? utiles : tous;
  const singulier = q.length > 3 && /[sx]$/.test(q) ? q.slice(0, -1) : q;

  const trouvailles: (Trouvaille<T> & { rang: number; niveau: number; principale: number })[] = [];
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

    // Le nom de l'entrée qui regroupe la vue (« Retours clients » trouve Avis, Sentiment et NPS) :
    // un peu sous le nom de la vue, et la vue principale passe devant les autres.
    const nomEntree = entree?.entreeNom?.[langue];
    if (nomEntree) {
      const n = aplatir(nomEntree);
      const bonus = entree?.principale ? 2 : 0;
      if (n === q) garder(92 + bonus);
      else if (n.startsWith(q)) garder(84 + bonus);
      else if (tousLesMotsCollent(tapes, mots(nomEntree))) garder(74 + bonus);
    }

    // Les verbes et mots-clés : la langue de l'application en plein, l'autre un peu moins, sans affichage.
    const listes: { verbes: readonly string[]; motsCles: readonly string[]; moins: number; montrer: boolean }[] = [];
    if (entree) {
      const autre = langue === 'fr' ? 'en' : 'fr';
      const de = (l: 'fr' | 'en') => (l === 'fr' ? { verbes: entree.verbes, motsCles: entree.motsCles } : entree.en);
      const actives = de(langue) ?? de('fr');
      if (actives) listes.push({ ...actives, moins: 0, montrer: true });
      const autres = de(autre);
      if (autres && autres !== actives) listes.push({ ...autres, moins: 6, montrer: false });
    }
    for (const { verbes, motsCles, moins, montrer } of listes) {
      for (const verbe of verbes) {
        const v = aplatir(verbe);
        if (v.includes(q)) garder((v === q ? 96 : v.startsWith(q) ? 93 : 90) - moins, montrer ? verbe : undefined);
        else if (tousLesMotsCollent(tapes, v.split(' '))) garder(70 - moins, montrer ? verbe : undefined);
      }
      // Un mot-clé exact passe devant un libellé qui commence pareil : « facture » est le mot de
      // Facturation, même si « Factures entrantes » commence par lui.
      for (const cle of motsCles) {
        const k = aplatir(cle);
        if (k === q || k === singulier) garder(105 - moins);
        else if (k.startsWith(q) || tousLesMotsCollent(tapes, k.split(' '))) garder(55 - moins);
      }
    }

    if (score === 0 && entree) {
      const sac = [
        ...mots(item.label),
        ...listes.flatMap((l) => [...l.verbes, ...l.motsCles].flatMap(mots)),
      ];
      if (tousLesMotsCollent(tapes, sac)) garder(40);
      // Dernier recours : une faute de frappe (« facutre », « tresorrie »).
      else if (tapes.every((t) => sac.some((m) => motColle(t, m) || motProche(t, m)))) garder(32);
    }
    if (score === 0 && item.hint && aplatir(item.hint).includes(q)) garder(25);

    if (score > 0) {
      trouvailles.push({
        item,
        score,
        raison,
        rang,
        niveau: RANG_NIVEAU[entree?.niveau as keyof typeof RANG_NIVEAU] ?? 1,
        principale: entree && !entree.principale ? 1 : 0,
      });
    }
  });

  return trouvailles
    .sort((a, b) => b.score - a.score || a.niveau - b.niveau || a.principale - b.principale || a.rang - b.rang)
    .map(({ item, score, raison }) => ({ item, score, raison }));
}
