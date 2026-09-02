/**
 * LES LIENS ENTRE NOTES, ET LE GRAPHE QU'ILS DESSINENT
 * ════════════════════════════════════════════════════
 *
 * Module SANS React et SANS DOM, délibérément : `scripts/check-liens.ts` le
 * charge tel quel. Tout ce qui compte ici — ce qu'est un lien, ce à quoi il se
 * résout, ce qui se passe quand on renomme — est une règle qu'on peut éprouver
 * sans navigateur, et qu'aucune lecture de code ne démontre.
 *
 * ## Ce que ça change pour le module Notes
 *
 * Jusqu'ici une note était une feuille isolée : du markdown, épinglable,
 * cherchable. On pouvait accumuler cent notes sans qu'aucune ne sache que les
 * autres existent.
 *
 * Une note écrit maintenant `[[Titre d'une autre note]]`. De là viennent trois
 * choses, et c'est la troisième qui change vraiment quelque chose :
 *
 *   1. le lien est cliquable — on circule au lieu de chercher ;
 *   2. la note visée sait qui parle d'elle (les RÉTROLIENS). C'est ce qu'on ne
 *      peut pas obtenir en cherchant : une recherche donne les notes qui
 *      contiennent un mot, pas celles qui ont décidé de pointer vers celle-ci ;
 *   3. l'ensemble forme un graphe, et le regarder montre ce qu'aucune liste ne
 *      montre — les grappes, les notes isolées, celles vers lesquelles tout
 *      converge.
 *
 * ## Ce qu'est un lien, précisément
 *
 *   [[Titre]]              — pointe vers la note qui porte ce titre
 *   [[Titre|autre texte]]  — même chose, affichée autrement
 *
 * Le titre est la clé, et pas un identifiant : c'est ce qu'on tape quand on
 * écrit, et personne ne connaît par cœur l'identifiant d'une note. La
 * conséquence — renommer casse les liens — est traitée par `renommerDansLes`,
 * plus bas.
 */

/** Un lien tel qu'il est ÉCRIT, avant toute résolution. */
export interface LienEcrit {
  /** Le titre visé, tel qu'écrit. */
  readonly cible: string;
  /** Le texte à afficher : l'alias s'il y en a un, le titre sinon. */
  readonly texte: string;
  /** Où il commence et finit dans le corps, pour le remplacement au renommage. */
  readonly debut: number;
  readonly fin: number;
}

/** Une note, réduite à ce dont ce module a besoin. */
export interface NoteLiable {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly scope: 'team' | 'personal';
}

/**
 * NORMALISATION D'UN TITRE POUR LA COMPARAISON.
 *
 * On écrit `[[reunion client]]` en pensant à « Réunion client ». Exiger
 * l'exactitude ferait échouer le lien sur une majuscule ou un accent, c'est-à-
 * dire au premier essai. On compare donc sans casse, sans accents, et sans
 * tenir compte des espaces multiples.
 *
 * La normalisation NFD sépare les lettres de leurs accents, ce qui permet de
 * retirer ces derniers d'une seule passe — et couvre aussi bien « é » composé
 * que « é » précomposé, les deux existant selon le clavier et le
 * copier-coller.
 */
export function normaliserTitre(titre: string): string {
  return titre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * LES ZONES OÙ UN `[[…]]` N'EST PAS UN LIEN.
 *
 * Dans un bloc de code ou du code en ligne, `[[ceci]]` est du TEXTE — c'est
 * peut-être même la syntaxe qu'on est en train de documenter. En faire un lien
 * transformerait un exemple en navigation, et créerait des notes fantômes
 * portant le nom de variables.
 *
 * Rend les intervalles à ignorer, dans l'ordre.
 */
function zonesDeCode(corps: string): Array<[number, number]> {
  const zones: Array<[number, number]> = [];
  // Blocs délimités par ``` — le contenu ET les délimiteurs.
  const bloc = /^```[\s\S]*?^```/gm;
  let m: RegExpExecArray | null;
  while ((m = bloc.exec(corps)) !== null) zones.push([m.index, m.index + m[0].length]);
  // Code en ligne `…`, hors des blocs déjà pris.
  const ligne = /`[^`\n]+`/g;
  while ((m = ligne.exec(corps)) !== null) {
    const [d, f] = [m.index, m.index + m[0].length];
    if (!zones.some(([a, b]) => d >= a && f <= b)) zones.push([d, f]);
  }
  return zones;
}

/**
 * Tous les liens écrits dans un corps, dans l'ordre d'apparition.
 *
 * Un lien vide (`[[]]`, `[[   ]]`) n'en est pas un : c'est le début d'une
 * frappe, et le signaler comme lien cassé pendant qu'on tape serait du bruit
 * constant.
 */
export function extraireLiens(corps: string): LienEcrit[] {
  const zones = zonesDeCode(corps);
  const dansDuCode = (i: number) => zones.some(([a, b]) => i >= a && i < b);
  const out: LienEcrit[] = [];
  const re = /\[\[([^\]|\n]*)(?:\|([^\]\n]*))?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(corps)) !== null) {
    if (dansDuCode(m.index)) continue;
    const cible = m[1].trim();
    if (cible === '') continue;
    const alias = (m[2] ?? '').trim();
    out.push({ cible, texte: alias || cible, debut: m.index, fin: m.index + m[0].length });
  }
  return out;
}

/** Ce à quoi un lien écrit se résout. */
export interface LienResolu extends LienEcrit {
  /** L'identifiant de la note visée, ou `null` si elle n'existe pas encore. */
  readonly cibleId: string | null;
  /**
   * `true` quand plusieurs notes portent ce titre. Le lien pointe alors vers la
   * plus ANCIENNE, et l'écran le dit — voir `resoudre`.
   */
  readonly ambigu: boolean;
}

/**
 * LES NOTES QU'UNE NOTE DONNÉE PEUT ATTEINDRE.
 *
 * Une note d'ÉQUIPE ne peut pointer que vers une autre note d'équipe. Une note
 * PERSONNELLE peut pointer vers les deux.
 *
 * Ce n'est pas une restriction de confort, c'est une question de sens : une
 * note personnelle n'existe que pour son auteur, dans son navigateur. Un lien
 * d'équipe qui pointerait dessus fonctionnerait pour une personne et serait
 * cassé pour toutes les autres — sans que l'auteur puisse jamais s'en rendre
 * compte, puisque chez lui il marche. Un lien qui ment à tout le monde sauf à
 * celui qui l'a écrit est pire qu'un lien absent.
 */
export function portee(note: Pick<NoteLiable, 'scope'>, candidates: readonly NoteLiable[]): NoteLiable[] {
  return note.scope === 'team' ? candidates.filter((n) => n.scope === 'team') : [...candidates];
}

/**
 * Résout les liens d'une note contre l'ensemble des notes.
 *
 * `ordre` donne, pour chaque identifiant, son rang d'ancienneté (0 = la plus
 * ancienne). Il sert à trancher les homonymes de façon STABLE : deux notes du
 * même titre existent, le lien va toujours à la même — celle qui était là
 * d'abord. Trancher par « la plus récemment modifiée » ferait changer la
 * destination d'un lien qu'on n'a pas touché, simplement parce que quelqu'un a
 * édité l'autre note.
 */
export function resoudre(
  note: NoteLiable,
  toutes: readonly NoteLiable[],
  ordre: ReadonlyMap<string, number>,
): LienResolu[] {
  const visibles = portee(note, toutes);
  const parTitre = new Map<string, NoteLiable[]>();
  for (const n of visibles) {
    const cle = normaliserTitre(n.title);
    if (cle === '') continue; // une note sans titre n'est atteignable par aucun lien
    const liste = parTitre.get(cle);
    if (liste) liste.push(n);
    else parTitre.set(cle, [n]);
  }

  return extraireLiens(note.body).map((lien) => {
    const candidats = parTitre.get(normaliserTitre(lien.cible)) ?? [];
    if (candidats.length === 0) return { ...lien, cibleId: null, ambigu: false };
    const gagnante = [...candidats].sort(
      (a, b) => (ordre.get(a.id) ?? 0) - (ordre.get(b.id) ?? 0),
    )[0];
    return { ...lien, cibleId: gagnante.id, ambigu: candidats.length > 1 };
  });
}

/** Un arc du graphe : une note en cite une autre. */
export interface Arc {
  readonly de: string;
  readonly vers: string;
  /** Combien de fois — deux mentions dans la même note ne font qu'un arc. */
  readonly poids: number;
}

export interface Graphe {
  readonly noeuds: NoteLiable[];
  readonly arcs: Arc[];
  /** Les titres cités qui ne correspondent à aucune note. */
  readonly manquants: string[];
}

/**
 * Construit le graphe de tout un carnet.
 *
 * Les arcs sont DIRIGÉS — « A parle de B » n'est pas « B parle de A », et
 * c'est justement la différence qui rend les rétroliens intéressants. L'écran
 * peut les dessiner sans flèche s'il préfère ; l'information, elle, est là.
 *
 * Un lien d'une note vers ELLE-MÊME est ignoré : il ne dit rien, et il
 * dessinerait une boucle que personne ne veut lire.
 */
export function construireGraphe(
  notes: readonly NoteLiable[],
  ordre: ReadonlyMap<string, number>,
): Graphe {
  const arcs = new Map<string, Arc>();
  const manquants = new Map<string, string>();

  for (const note of notes) {
    for (const lien of resoudre(note, notes, ordre)) {
      if (lien.cibleId === null) {
        // On garde la première graphie rencontrée : c'est celle qu'on
        // proposera comme titre si on crée la note manquante.
        const cle = normaliserTitre(lien.cible);
        if (!manquants.has(cle)) manquants.set(cle, lien.cible);
        continue;
      }
      if (lien.cibleId === note.id) continue; // une note ne se cite pas elle-même
      const cle = `${note.id}→${lien.cibleId}`;
      const vu = arcs.get(cle);
      arcs.set(cle, { de: note.id, vers: lien.cibleId, poids: (vu?.poids ?? 0) + 1 });
    }
  }

  return { noeuds: [...notes], arcs: [...arcs.values()], manquants: [...manquants.values()] };
}

/**
 * QUI PARLE DE CETTE NOTE.
 *
 * C'est le sens de la lecture inverse, et ce qu'aucune recherche ne donne :
 * une recherche rend les notes qui CONTIENNENT un mot, celle-ci rend les notes
 * qui ont décidé de pointer ici.
 */
export function retroliens(graphe: Graphe, noteId: string): NoteLiable[] {
  const ids = new Set(graphe.arcs.filter((a) => a.vers === noteId).map((a) => a.de));
  return graphe.noeuds.filter((n) => ids.has(n.id));
}

/**
 * LE GRAPHE RESTREINT À UNE PARTIE DU CARNET.
 *
 * Filtrer le carnet sur « Perso » ou « Équipe » doit filtrer le dessin avec
 * lui. Un arc dont une seule extrémité survit est un trait qui part vers rien :
 * il ne dit plus « ces deux-là se parlent », il dit seulement « il y a quelque
 * chose là-bas », et l'œil le lit comme un nœud invisible. On les retire.
 *
 * Les titres cités sans note (`manquants`) sont conservés tels quels : ils ne
 * dépendent d'aucun nœud, et une note à écrire reste à écrire quel que soit le
 * filtre affiché.
 */
export function sousGraphe(graphe: Graphe, gardes: ReadonlySet<string>): Graphe {
  const noeuds = graphe.noeuds.filter((n) => gardes.has(n.id));
  const restants = new Set(noeuds.map((n) => n.id));
  return {
    noeuds,
    arcs: graphe.arcs.filter((a) => restants.has(a.de) && restants.has(a.vers)),
    manquants: [...graphe.manquants],
  };
}

/** Les notes que personne ne cite et qui ne citent personne. */
export function isolees(graphe: Graphe): NoteLiable[] {
  const relies = new Set<string>();
  for (const a of graphe.arcs) {
    relies.add(a.de);
    relies.add(a.vers);
  }
  return graphe.noeuds.filter((n) => !relies.has(n.id));
}

/**
 * RENOMMER SANS CASSER CE QUI POINTE ICI.
 *
 * Le titre est la clé du lien ; le changer casserait donc tous les `[[…]]` qui
 * visent cette note. Obsidian réécrit les liens au renommage, et c'est la
 * seule façon que le titre reste modifiable — sans ça, on n'ose plus corriger
 * une faute de frappe dans un titre une fois qu'on y a lié trois notes.
 *
 * Rend, pour chaque note à modifier, son nouveau corps. Une note dont rien ne
 * change n'apparaît pas : l'appelant ne doit réécrire que ce qui bouge.
 *
 * L'ALIAS EST PRÉSERVÉ. `[[Réunion|le point de lundi]]` devient
 * `[[Réunion hebdo|le point de lundi]]` : le texte affiché est une décision
 * d'écriture, pas une conséquence du titre.
 */
export function renommerDansLes(
  notes: readonly NoteLiable[],
  ancienTitre: string,
  nouveauTitre: string,
): Array<{ id: string; body: string }> {
  const cible = normaliserTitre(ancienTitre);
  if (cible === '' || normaliserTitre(nouveauTitre) === cible) return [];

  const out: Array<{ id: string; body: string }> = [];
  for (const note of notes) {
    const liens = extraireLiens(note.body).filter((l) => normaliserTitre(l.cible) === cible);
    if (liens.length === 0) continue;
    /*
      De la FIN vers le DÉBUT : chaque remplacement décale ce qui suit, et
      remplacer d'abord le premier lien invaliderait les positions de tous les
      autres. C'est le genre de défaut qui ne se voit qu'à partir du deuxième
      lien dans la même note — donc jamais pendant qu'on écrit le premier.
    */
    let body = note.body;
    for (const lien of [...liens].reverse()) {
      const alias = lien.texte === lien.cible ? '' : `|${lien.texte}`;
      body = body.slice(0, lien.debut) + `[[${nouveauTitre}${alias}]]` + body.slice(lien.fin);
    }
    out.push({ id: note.id, body });
  }
  return out;
}

/**
 * CE QU'ON PROPOSE PENDANT QU'ON TAPE `[[`.
 *
 * Les titres qui contiennent ce qu'on a tapé, les plus courts d'abord — un
 * titre court qui correspond est presque toujours celui qu'on vise, et un
 * titre long qui contient le même mot est presque toujours autre chose.
 *
 * La note en cours d'écriture est exclue : se lier à soi-même n'a pas de sens,
 * et la proposer en tête (elle correspond forcément à ce qu'on tape si on tape
 * son propre sujet) mettrait la mauvaise réponse en premier.
 */
export function suggestions(
  saisie: string,
  depuis: NoteLiable,
  toutes: readonly NoteLiable[],
  maximum = 8,
): NoteLiable[] {
  const q = normaliserTitre(saisie);
  return portee(depuis, toutes)
    .filter((n) => n.id !== depuis.id && n.title.trim() !== '')
    .filter((n) => q === '' || normaliserTitre(n.title).includes(q))
    .sort((a, b) => {
      // Ce qui COMMENCE par la saisie passe devant ce qui la contient.
      const da = normaliserTitre(a.title).startsWith(q) ? 0 : 1;
      const db = normaliserTitre(b.title).startsWith(q) ? 0 : 1;
      if (da !== db) return da - db;
      if (a.title.length !== b.title.length) return a.title.length - b.title.length;
      return a.title.localeCompare(b.title, 'fr');
    })
    .slice(0, maximum);
}

/**
 * EST-ON EN TRAIN D'ÉCRIRE UN LIEN ?
 *
 * Rend, quand le curseur se trouve dans un `[[` pas encore refermé, où il
 * commence et ce qui a été tapé depuis. C'est ce qui permet de proposer des
 * titres pendant la frappe plutôt qu'après coup.
 *
 * Trois refus, et chacun évite une liste de suggestions qui s'ouvre au mauvais
 * moment :
 *
 *   · pas de `[[` avant le curseur — on écrit du texte ordinaire ;
 *   · un `]]` est passé entre les deux — le lien est refermé, on écrit APRÈS
 *     lui ;
 *   · un saut de ligne s'est glissé dedans — un `[[` resté ouvert en haut du
 *     document ferait s'ouvrir la liste vingt lignes plus bas, à chaque frappe.
 */
export function saisieEnCours(
  texte: string,
  curseur: number,
): { debut: number; requete: string } | null {
  const avant = texte.slice(0, curseur);
  const debut = avant.lastIndexOf('[[');
  if (debut === -1) return null;
  const dedans = avant.slice(debut + 2);
  if (dedans.includes(']]') || dedans.includes('\n')) return null;
  /*
    L'alias vient après la barre : une fois qu'on l'écrit, la cible est
    choisie et proposer des titres n'a plus de sens.
  */
  if (dedans.includes('|')) return null;
  return { debut, requete: dedans };
}

/**
 * Remplace la saisie en cours par le titre choisi, et rend le texte et la
 * nouvelle position du curseur.
 *
 * Le curseur se pose APRÈS le `]]` : on vient de choisir, on continue d'écrire
 * sa phrase. Le laisser dans le lien obligerait à un geste de plus à chaque
 * insertion.
 */
export function insererLien(
  texte: string,
  saisie: { debut: number; requete: string },
  titre: string,
  curseur: number,
): { texte: string; curseur: number } {
  const avant = texte.slice(0, saisie.debut);
  const apres = texte.slice(curseur);
  const insertion = `[[${titre}]]`;
  return { texte: avant + insertion + apres, curseur: avant.length + insertion.length };
}

/* ───────────────────────── Étiquettes et mentions ───────────────────────── */

/**
 * LES ÉTIQUETTES — « #devis », « #boulangerie-martin » — telles qu'écrites
 * dans le corps, hors des liens [[…]] et des adresses. Sans doublon, dans
 * l'ordre d'apparition, en minuscules pour que #Devis et #devis se
 * retrouvent.
 */
export function extraireTags(corps: string): string[] {
  const sansLiens = corps.replace(/\[\[[^\]]*\]\]/g, ' ').replace(/https?:\/\/\S+/g, ' ');
  const vus = new Set<string>();
  for (const m of sansLiens.matchAll(/(?:^|[\s(,;])#([\p{L}\p{N}][\p{L}\p{N}_-]{0,39})/gu)) vus.add(m[1].toLowerCase());
  return [...vus];
}

/** Le titre apparaît-il en clair dans ce corps, hors de tout lien [[…]] ? */
function mentionneEnClair(corps: string, titre: string): boolean {
  const propre = titre.trim();
  if (propre.length < 3) return false;
  const sansLiens = corps.replace(/\[\[[^\]]*\]\]/g, ' ');
  return sansLiens.toLowerCase().includes(propre.toLowerCase());
}

/**
 * LES MENTIONS NON LIÉES — les notes qui citent ce titre en clair sans
 * pointer ici. C'est le geste d'Obsidian qui fait qu'un carnet se relie tout
 * seul : on écrit d'abord, on relie ensuite, en un clic. Une note ne se
 * mentionne pas elle-même ; une note qui pointe déjà ici n'est pas une
 * mention, c'est un lien.
 */
export function mentionsNonLiees(note: NoteLiable, toutes: readonly NoteLiable[], graphe: Graphe): NoteLiable[] {
  if (note.title.trim().length < 3) return [];
  const dejaLiees = new Set(graphe.arcs.filter((a) => a.vers === note.id).map((a) => a.de));
  return portee(note, toutes).filter((n) => n.id !== note.id && !dejaLiees.has(n.id) && mentionneEnClair(n.body, note.title));
}

/** Remplace la première occurrence en clair du titre par un lien [[titre]], en gardant la casse écrite. */
export function lierMention(corps: string, titre: string): string {
  const propre = titre.trim();
  if (!propre) return corps;
  const sansLiens = corps.replace(/\[\[[^\]]*\]\]/g, (m) => ' '.repeat(m.length));
  const index = sansLiens.toLowerCase().indexOf(propre.toLowerCase());
  if (index < 0) return corps;
  const ecrit = corps.slice(index, index + propre.length);
  return `${corps.slice(0, index)}[[${ecrit === propre ? propre : `${propre}|${ecrit}`}]]${corps.slice(index + propre.length)}`;
}
