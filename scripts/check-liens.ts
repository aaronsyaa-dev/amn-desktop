/**
 * Contrôle des LIENS ENTRE NOTES — ce qui se résout, et ce qui se casse.
 *
 * Les règles vivent dans `src/lib/notesLiens.ts`, sans React ni DOM, parce que
 * ce sont des propriétés qu'aucune lecture de code ne démontre : ce à quoi un
 * lien se résout selon qui l'écrit, ce qui arrive aux liens quand on renomme,
 * et ce que le graphe compte vraiment.
 *
 *   npm run check:liens
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));

async function loadFromSrc<T>(entry: string): Promise<T> {
  const built = await esbuild.build({
    entryPoints: [path.join(here, '..', entry)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    target: 'node22',
    charset: 'utf8',
  });
  return (await import(
    `data:text/javascript;charset=utf-8;base64,${Buffer.from(built.outputFiles[0].text, 'utf8').toString('base64')}`
  )) as T;
}

interface Note {
  id: string;
  title: string;
  body: string;
  scope: 'team' | 'personal';
}
interface Lien {
  cible: string;
  texte: string;
  debut: number;
  fin: number;
  cibleId?: string | null;
  ambigu?: boolean;
}
interface Graphe {
  noeuds: Note[];
  arcs: Array<{ de: string; vers: string; poids: number }>;
  manquants: string[];
}

const {
  extraireLiens,
  normaliserTitre,
  resoudre,
  construireGraphe,
  retroliens,
  isolees,
  renommerDansLes,
  suggestions,
  portee,
  saisieEnCours,
  insererLien,
} = await loadFromSrc<{
  extraireLiens: (corps: string) => Lien[];
  normaliserTitre: (t: string) => string;
  resoudre: (n: Note, toutes: readonly Note[], ordre: ReadonlyMap<string, number>) => Lien[];
  construireGraphe: (notes: readonly Note[], ordre: ReadonlyMap<string, number>) => Graphe;
  retroliens: (g: Graphe, id: string) => Note[];
  isolees: (g: Graphe) => Note[];
  renommerDansLes: (
    notes: readonly Note[],
    ancien: string,
    nouveau: string,
  ) => Array<{ id: string; body: string }>;
  suggestions: (q: string, depuis: Note, toutes: readonly Note[], max?: number) => Note[];
  portee: (n: { scope: 'team' | 'personal' }, c: readonly Note[]) => Note[];
  saisieEnCours: (t: string, c: number) => { debut: number; requete: string } | null;
  insererLien: (
    t: string,
    s: { debut: number; requete: string },
    titre: string,
    curseur: number,
  ) => { texte: string; curseur: number };
}>('src/lib/notesLiens.ts');

let vus = 0;
const dit = (nom: string, fn: () => void) => {
  fn();
  vus += 1;
  console.log(`  ✓ ${nom}`);
};

const note = (id: string, title: string, body = '', scope: 'team' | 'personal' = 'team'): Note => ({
  id,
  title,
  body,
  scope,
});
/** L'ordre d'ancienneté, dans l'ordre du tableau. */
const rangs = (...ids: string[]) => new Map(ids.map((id, i) => [id, i]));

console.log('\nContrôle des liens entre notes\n');

/* ─── Ce qu'est un lien ────────────────────────────────────────────────────── */

dit('un lien simple est reconnu', () => {
  const [l] = extraireLiens('Voir [[Réunion client]] pour la suite.');
  assert.equal(l.cible, 'Réunion client');
  assert.equal(l.texte, 'Réunion client');
});

dit('un alias change le texte affiché, pas la cible', () => {
  const [l] = extraireLiens('Voir [[Réunion client|le point de lundi]].');
  assert.equal(l.cible, 'Réunion client');
  assert.equal(l.texte, 'le point de lundi');
});

dit('LA RÈGLE : `[[…]]` dans du code n’est PAS un lien', () => {
  /*
    C'est peut-être la syntaxe qu'on est en train de documenter. En faire un
    lien transformerait un exemple en navigation, et créerait des notes
    fantômes portant le nom de variables.
  */
  assert.deepEqual(extraireLiens('Écrire `[[Titre]]` pour lier.'), []);
  assert.deepEqual(extraireLiens('```\n[[Titre]]\n```'), []);
  // Mais un lien hors du bloc, dans le même corps, reste un lien.
  const l = extraireLiens('```\n[[Dedans]]\n```\nEt [[Dehors]].');
  assert.equal(l.length, 1);
  assert.equal(l[0].cible, 'Dehors');
});

dit('un lien vide n’en est pas un', () => {
  // C'est le début d'une frappe : le signaler comme cassé serait du bruit
  // constant pendant qu'on écrit.
  assert.deepEqual(extraireLiens('[[]] et [[   ]]'), []);
});

dit('plusieurs liens sur une ligne gardent leur ordre et leurs positions', () => {
  const l = extraireLiens('[[Un]] puis [[Deux]]');
  assert.deepEqual(l.map((x) => x.cible), ['Un', 'Deux']);
  assert.ok(l[0].fin <= l[1].debut, 'les intervalles ne se chevauchent pas');
});

/* ─── La comparaison des titres ────────────────────────────────────────────── */

dit('LA RÈGLE : accents, casse et espaces ne font pas rater un lien', () => {
  /*
    On écrit `[[reunion  client]]` en pensant à « Réunion client ». Exiger
    l'exactitude ferait échouer le lien au premier essai.
  */
  assert.equal(normaliserTitre('Réunion  CLIENT '), normaliserTitre('reunion client'));
  assert.equal(normaliserTitre('Élie'), normaliserTitre('elie'));
});

dit('mais deux titres réellement différents ne se confondent pas', () => {
  assert.notEqual(normaliserTitre('Réunion client'), normaliserTitre('Réunion interne'));
});

/* ─── La résolution ────────────────────────────────────────────────────────── */

dit('un lien vers une note existante trouve son identifiant', () => {
  const a = note('n1', 'Cible');
  const b = note('n2', 'Source', 'Voir [[cible]].');
  const [l] = resoudre(b, [a, b], rangs('n1', 'n2'));
  assert.equal(l.cibleId, 'n1');
  assert.equal(l.ambigu, false);
});

dit('un lien vers une note qui n’existe pas se résout à `null`, pas à une erreur', () => {
  // C'est une note à créer, pas une faute. Obsidian en fait un geste : cliquer
  // dessus crée la note. Le confondre avec une erreur retirerait ce geste.
  const b = note('n2', 'Source', 'Voir [[Pas encore écrite]].');
  const [l] = resoudre(b, [b], rangs('n2'));
  assert.equal(l.cibleId, null);
});

dit('LA RÈGLE : deux homonymes → toujours la PLUS ANCIENNE, et c’est signalé', () => {
  /*
    Trancher par « la plus récemment modifiée » ferait changer la destination
    d'un lien qu'on n'a pas touché, parce que quelqu'un a édité l'autre note.
    Un lien doit mener au même endroit tant qu'on ne le change pas.
  */
  const vieille = note('n1', 'Doublon');
  const jeune = note('n2', 'Doublon');
  const src = note('n3', 'Source', 'Voir [[doublon]].');
  const [l] = resoudre(src, [jeune, vieille, src], rangs('n1', 'n2', 'n3'));
  assert.equal(l.cibleId, 'n1', 'la plus ancienne gagne, quel que soit l’ordre du tableau');
  assert.equal(l.ambigu, true, 'et l’ambiguïté est dite, pour que l’écran puisse la montrer');
});

dit('une note sans titre n’est atteignable par aucun lien', () => {
  const sansTitre = note('n1', '   ');
  const src = note('n2', 'Source', 'Voir [[]] et [[ ]].');
  assert.deepEqual(resoudre(src, [sansTitre, src], rangs('n1', 'n2')), []);
});

/* ─── La portée : équipe / personnel ───────────────────────────────────────── */

dit('LA RÈGLE : une note d’ÉQUIPE ne voit que les notes d’équipe', () => {
  /*
    Une note personnelle n'existe que pour son auteur, dans son navigateur. Un
    lien d'équipe qui pointerait dessus marcherait pour une personne et serait
    cassé pour toutes les autres — sans que l'auteur puisse s'en rendre compte,
    puisque chez lui il marche.
  */
  const perso = note('p1', 'Mon brouillon', '', 'personal');
  const equipe = note('t1', 'Compte rendu', 'Voir [[Mon brouillon]].', 'team');
  const [l] = resoudre(equipe, [perso, equipe], rangs('p1', 't1'));
  assert.equal(l.cibleId, null, 'le lien reste non résolu plutôt que de mentir aux autres');
});

dit('et une note PERSONNELLE voit les deux', () => {
  const perso = note('p1', 'Mon brouillon', 'Voir [[Compte rendu]].', 'personal');
  const equipe = note('t1', 'Compte rendu', '', 'team');
  const [l] = resoudre(perso, [perso, equipe], rangs('p1', 't1'));
  assert.equal(l.cibleId, 't1');
  assert.equal(portee({ scope: 'personal' }, [perso, equipe]).length, 2);
  assert.equal(portee({ scope: 'team' }, [perso, equipe]).length, 1);
});

/* ─── Le graphe ────────────────────────────────────────────────────────────── */

dit('un arc par paire, même cité deux fois — mais le poids compte', () => {
  const a = note('n1', 'A', 'Voir [[B]] et encore [[B]].');
  const b = note('n2', 'B');
  const g = construireGraphe([a, b], rangs('n1', 'n2'));
  assert.equal(g.arcs.length, 1, 'deux mentions ne font pas deux arcs');
  assert.equal(g.arcs[0].poids, 2);
});

dit('LA RÈGLE : une note ne se cite pas elle-même', () => {
  // L'arc ne dirait rien, et dessinerait une boucle que personne ne veut lire.
  const a = note('n1', 'A', 'Je parle de [[A]].');
  const g = construireGraphe([a], rangs('n1'));
  assert.equal(g.arcs.length, 0);
});

dit('les arcs sont DIRIGÉS', () => {
  // « A parle de B » n'est pas « B parle de A », et c'est la différence qui
  // rend les rétroliens intéressants.
  const a = note('n1', 'A', 'Voir [[B]].');
  const b = note('n2', 'B');
  const g = construireGraphe([a, b], rangs('n1', 'n2'));
  assert.deepEqual(g.arcs, [{ de: 'n1', vers: 'n2', poids: 1 }]);
});

dit('les titres cités mais inexistants sont rendus, une fois chacun', () => {
  const a = note('n1', 'A', 'Voir [[Fantôme]] et [[fantome]] et [[Autre]].');
  const g = construireGraphe([a], rangs('n1'));
  assert.equal(g.manquants.length, 2, 'les deux graphies du même titre ne comptent qu’une fois');
  assert.ok(g.manquants.includes('Fantôme'), 'et c’est la PREMIÈRE graphie qui est proposée');
});

dit('LES RÉTROLIENS : qui parle de cette note', () => {
  /*
    C'est ce qu'aucune recherche ne donne : une recherche rend les notes qui
    CONTIENNENT un mot, celle-ci rend celles qui ont décidé de pointer ici.
  */
  const a = note('n1', 'A', 'Voir [[C]].');
  const b = note('n2', 'B', 'Voir [[C]].');
  const c = note('n3', 'C', 'Je ne cite personne.');
  const g = construireGraphe([a, b, c], rangs('n1', 'n2', 'n3'));
  assert.deepEqual(retroliens(g, 'n3').map((n) => n.id), ['n1', 'n2']);
  assert.deepEqual(retroliens(g, 'n1'), [], 'personne ne cite A');
});

dit('les notes isolées sont celles que personne ne cite ET qui ne citent personne', () => {
  const a = note('n1', 'A', 'Voir [[B]].');
  const b = note('n2', 'B');
  const seule = note('n3', 'Seule');
  const g = construireGraphe([a, b, seule], rangs('n1', 'n2', 'n3'));
  assert.deepEqual(isolees(g).map((n) => n.id), ['n3']);
});

/* ─── Renommer ─────────────────────────────────────────────────────────────── */

dit('LA RÈGLE : renommer réécrit les liens qui pointaient ici', () => {
  /*
    Sans ça, on n'ose plus corriger une faute de frappe dans un titre une fois
    qu'on y a lié trois notes.
  */
  const a = note('n1', 'A', 'Voir [[Ancien titre]].');
  const b = note('n2', 'B', 'Rien à voir.');
  const maj = renommerDansLes([a, b], 'Ancien titre', 'Nouveau titre');
  assert.equal(maj.length, 1, 'seules les notes qui changent sont rendues');
  assert.equal(maj[0].id, 'n1');
  assert.equal(maj[0].body, 'Voir [[Nouveau titre]].');
});

dit('l’ALIAS est préservé au renommage', () => {
  // Le texte affiché est une décision d'écriture, pas une conséquence du titre.
  const a = note('n1', 'A', 'Voir [[Ancien|le point de lundi]].');
  const [maj] = renommerDansLes([a], 'Ancien', 'Nouveau');
  assert.equal(maj.body, 'Voir [[Nouveau|le point de lundi]].');
});

dit('LE PIÈGE : plusieurs liens dans la MÊME note, tous réécrits', () => {
  /*
    Le remplacement se fait de la fin vers le début : chaque écriture décale ce
    qui suit, et commencer par le premier invaliderait les positions de tous
    les autres. Un défaut qui ne se voit qu'à partir du deuxième lien — donc
    jamais pendant qu'on écrit le premier.

    LE TITRE DOIT CHANGER DE LONGUEUR. Premier jet de ce contrôle : il
    renommait « X » en « Y ». Même longueur, donc rien ne se décalait, et la
    mutation qui remplace du début vers la fin passait au vert — le contrôle
    n'exerçait pas la propriété qu'il annonçait. C'est l'allongement qui fait
    bouger les positions, et c'est lui qu'il faut mettre à l'épreuve.
  */
  const a = note('n1', 'A', 'Voir [[X]] puis [[X|encore]] et enfin [[x]].');
  const [maj] = renommerDansLes([a], 'X', 'Un titre nettement plus long');
  assert.equal(
    maj.body,
    'Voir [[Un titre nettement plus long]] puis [[Un titre nettement plus long|encore]] ' +
      'et enfin [[Un titre nettement plus long]].',
  );

  // Et dans l'autre sens : un titre qui RACCOURCIT décale aussi.
  const b = note('n2', 'B', 'Voir [[Un titre bien long]] et [[Un titre bien long]].');
  const [majB] = renommerDansLes([b], 'Un titre bien long', 'Z');
  assert.equal(majB.body, 'Voir [[Z]] et [[Z]].');
});

dit('renommer vers le même titre ne touche rien', () => {
  const a = note('n1', 'A', 'Voir [[Titre]].');
  assert.deepEqual(renommerDansLes([a], 'Titre', 'titre'), [], 'même titre à la casse près');
  assert.deepEqual(renommerDansLes([a], '', 'Neuf'), [], 'un titre vide ne renomme rien');
});

dit('un lien dans du code n’est PAS réécrit au renommage', () => {
  const a = note('n1', 'A', 'Exemple : `[[X]]`, et le vrai [[X]].');
  const [maj] = renommerDansLes([a], 'X', 'Y');
  assert.equal(maj.body, 'Exemple : `[[X]]`, et le vrai [[Y]].');
});

/* ─── Les suggestions pendant la frappe ────────────────────────────────────── */

dit('ce qui COMMENCE par la saisie passe devant ce qui la contient', () => {
  const src = note('n0', 'Source', '', 'team');
  const notes = [src, note('n1', 'Bilan réunion'), note('n2', 'Réunion client')];
  const s = suggestions('réu', src, notes);
  assert.equal(s[0].title, 'Réunion client');
});

dit('la note en cours n’est jamais proposée à elle-même', () => {
  const src = note('n0', 'Réunion', '', 'team');
  const s = suggestions('réu', src, [src, note('n1', 'Réunion client')]);
  assert.deepEqual(s.map((n) => n.id), ['n1']);
});

dit('une saisie vide propose tout de même, les plus courts d’abord', () => {
  const src = note('n0', 'Source', '', 'team');
  const s = suggestions('', src, [src, note('n1', 'Un titre très très long'), note('n2', 'Court')]);
  assert.equal(s[0].title, 'Court');
});

dit('et les suggestions respectent la portée', () => {
  const src = note('t0', 'Source', '', 'team');
  const s = suggestions('', src, [src, note('p1', 'Perso', '', 'personal')]);
  assert.deepEqual(s, [], 'une note d’équipe ne se voit pas proposer une note personnelle');
});

/* ─── La saisie d’un lien, pendant la frappe ───────────────────────────────── */

dit('un `[[` ouvert donne ce qui a été tapé depuis', () => {
  const s = saisieEnCours('Voir [[réu', 10);
  assert.deepEqual(s, { debut: 5, requete: 'réu' });
});

dit('LA RÈGLE : un lien déjà refermé n’ouvre plus de suggestions', () => {
  // Sinon la liste réapparaîtrait dès qu'on écrit après un lien terminé.
  assert.equal(saisieEnCours('Voir [[Réunion]] ensuite', 24), null);
});

dit('et un `[[` resté ouvert en haut du document n’en ouvre pas non plus', () => {
  /*
    Sans la garde sur le saut de ligne, un crochet oublié vingt lignes plus
    haut ferait s'ouvrir la liste à chaque frappe, partout en dessous.
  */
  assert.equal(saisieEnCours('[[oublié\nune ligne plus bas', 26), null);
});

dit('une fois l’alias commencé, la cible est choisie', () => {
  assert.equal(saisieEnCours('Voir [[Réunion|le point', 23), null);
});

dit('du texte ordinaire ne déclenche rien', () => {
  assert.equal(saisieEnCours('Une note sans lien', 18), null);
});

dit('insérer un titre remplace la saisie et pose le curseur APRÈS', () => {
  // On vient de choisir : on continue d'écrire sa phrase.
  const r = insererLien('Voir [[réu et la suite', { debut: 5, requete: 'réu' }, 'Réunion client', 10);
  assert.equal(r.texte, 'Voir [[Réunion client]] et la suite');
  assert.equal(r.curseur, 'Voir [[Réunion client]]'.length);
});

console.log(`\nOK — ${vus} contrôles.\n`);
