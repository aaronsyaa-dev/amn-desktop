/**
 * Contrôle des ARCHÉTYPES du socle (LOT-00) — gabarit de page, tableau, kanban, cartes, scindé, semaine, ligne de
 * temps (01-SOCLE-DESIGN §3 à §5). Sans navigateur, sans build, sans réseau.
 *
 * Il prouve quatre choses :
 *   1. la LOGIQUE sans React (placement des événements, chevauchements, tri stable, `aria-sort`, déplacement au
 *      clavier, déplacement d'un ticket) — chargée telle quelle depuis les sources, puis exercée, y compris sur des
 *      événements tirés au hasard (une propriété : jamais deux blocs l'un sur l'autre) ;
 *   2. les COTES de la spec, lues dans `archetypes.css` (colonne droite 340, tête 36, lignes 54, kanban 10 / 34,
 *      ticket 12, cartes 3 colonnes à 14 px, scindé 380, semaine 46 px par heure, KPI en quatre colonnes égales) ;
 *   3. le RENDU statique : rôles ARIA, un seul `h1`, un seul bouton primaire dans l'en-tête, états vide et chargement ;
 *   4. l'HYGIÈNE des sources : aucune couleur en dur, aucune encre « discret » en texte, aucun nom ni date d'exemple,
 *      aucun import hors du socle, et rien de tout cela dans l'édition cliente.
 *
 *   npm run check:socle-archetypes
 */
import fs from 'node:fs';
import path from 'node:path';
import { assert, charger, chargerRendu, creerEssais, jetons, lire, racine, sansCommentaires } from './lib/essai-socle.ts';

const { dit, fin } = creerEssais('Socle — archétypes (LOT-00)');

const norm = (s: string): string => s.replace(/\s/g, ' ');
const compter = (s: string, re: RegExp): number => (s.match(re) ?? []).length;
const dossier = path.join(racine, 'src/socle/ui/archetypes');

function fichiers(dir: string, ext: RegExp): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? fichiers(p, ext) : ext.test(e.name) ? [p] : [];
  });
}

/* ═════════════════════════  1. La logique sans React  ═════════════════════════ */

type Semaine = typeof import('../src/socle/ui/archetypes/logique/semaine.ts');
type Tableau = typeof import('../src/socle/ui/archetypes/logique/tableau.ts');
type Navigation = typeof import('../src/socle/ui/archetypes/logique/navigation.ts');
type Kanban = typeof import('../src/socle/ui/archetypes/logique/kanban.ts');
type Formats = typeof import('../src/socle/ui/archetypes/logique/formats.ts');
const S = await charger<Semaine>('src/socle/ui/archetypes/logique/semaine.ts');
const T = await charger<Tableau>('src/socle/ui/archetypes/logique/tableau.ts');
const N = await charger<Navigation>('src/socle/ui/archetypes/logique/navigation.ts');
const K = await charger<Kanban>('src/socle/ui/archetypes/logique/kanban.ts');
const F = await charger<Formats>('src/socle/ui/archetypes/logique/formats.ts');

// Un lundi quelconque : on le calcule, on ne l'écrit pas en dur dans une assertion.
const lundi = S.debutDeSemaine(new Date(2031, 2, 12));
const jours = S.joursConsecutifs(lundi, 7);
const au = (jour: number, h: number, m = 0): Date => new Date(jours[jour].getFullYear(), jours[jour].getMonth(), jours[jour].getDate(), h, m);
const optionsSemaine = { jours, heureDebut: 8, heureFin: 20 };

await dit('semaine : un événement se place par ses minutes — 46 px par heure depuis l’ouverture de la grille', () => {
  assert.equal(S.PX_PAR_HEURE, 46);
  assert.equal(S.debutDeSemaine(au(3, 15)).getDay(), 1, 'le premier jour de la semaine est un lundi');
  assert.equal(jours.length, 7);
  const { placements, horsPlage } = S.placerEvenements(optionsSemaine, [{ id: 'a', debut: au(2, 9), fin: au(2, 10, 30) }]);
  assert.equal(placements.length, 1);
  assert.deepEqual(horsPlage, []);
  const p = placements[0];
  assert.equal(p.jour, 2);
  assert.equal(p.haut, 46, '9 h = 1 h après 8 h = 46 px');
  assert.equal(p.hauteur, 69, '1 h 30 = 69 px');
  assert.deepEqual([p.colonne, p.colonnes, p.empan], [0, 1, 1]);
  assert.equal(S.hauteurGrille(8, 20), 12 * 46);
  assert.deepEqual(S.heuresAffichees(8, 12), [8, 9, 10, 11]);
});

await dit('semaine : l’heure d’ouverture vient des arguments (fractions admises)', () => {
  const { placements } = S.placerEvenements({ ...optionsSemaine, heureDebut: 8.5 }, [{ id: 'a', debut: au(0, 9), fin: au(0, 10) }]);
  assert.equal(placements[0].haut, 23, '9 h pour une ouverture à 8 h 30 : une demi-heure = 23 px');
  const { placements: serres } = S.placerEvenements({ ...optionsSemaine, pxParHeure: 60 }, [{ id: 'a', debut: au(0, 9), fin: au(0, 10) }]);
  assert.deepEqual([serres[0].haut, serres[0].hauteur], [60, 60]);
});

await dit('semaine : les chevauchements se rangent côte à côte, les événements qui se touchent restent seuls', () => {
  const r = S.placerEvenements(optionsSemaine, [
    { id: 'a', debut: au(1, 9), fin: au(1, 10) },
    { id: 'b', debut: au(1, 9, 30), fin: au(1, 11) },
    { id: 'c', debut: au(1, 11), fin: au(1, 12) },
    { id: 'd', debut: au(1, 12), fin: au(1, 13) },
  ]);
  const par = Object.fromEntries(r.placements.map((p) => [p.id, p]));
  assert.deepEqual([par.a.colonne, par.a.colonnes], [0, 2]);
  assert.deepEqual([par.b.colonne, par.b.colonnes], [1, 2]);
  assert.deepEqual([par.c.colonne, par.c.colonnes], [0, 1], 'c commence quand b finit : il ne le chevauche pas');
  assert.deepEqual([par.d.colonne, par.d.colonnes], [0, 1]);
});

await dit('semaine : un chevauchement de proche en proche partage le même nombre de colonnes ; un événement s’élargit où il y a de la place', () => {
  const chaine = S.placerEvenements(optionsSemaine, [
    { id: 'a', debut: au(0, 9), fin: au(0, 10) },
    { id: 'b', debut: au(0, 9, 30), fin: au(0, 10, 30) },
    { id: 'c', debut: au(0, 10, 15), fin: au(0, 11) },
  ]);
  const p = Object.fromEntries(chaine.placements.map((x) => [x.id, x]));
  assert.deepEqual([p.a.colonne, p.b.colonne, p.c.colonne], [0, 1, 0], 'c reprend la colonne de a, qui a fini');
  assert.ok(chaine.placements.every((x) => x.colonnes === 2));
  const large = S.placerEvenements(optionsSemaine, [
    { id: 'a', debut: au(0, 9), fin: au(0, 12) },
    { id: 'b', debut: au(0, 9), fin: au(0, 10) },
    { id: 'c', debut: au(0, 9, 30), fin: au(0, 10, 30) },
    { id: 'd', debut: au(0, 10, 30), fin: au(0, 11, 30) },
  ]);
  const q = Object.fromEntries(large.placements.map((x) => [x.id, x]));
  assert.equal(q.a.colonnes, 3);
  assert.deepEqual([q.d.colonne, q.d.empan], [1, 2], 'd tient sa colonne et prend celle de c, déjà finie');
  assert.equal(q.a.empan, 1);
});

await dit('semaine : un bloc court garde sa hauteur minimale, et c’est elle qui le fait chevaucher', () => {
  const { placements } = S.placerEvenements(optionsSemaine, [
    { id: 'court', debut: au(0, 9), fin: au(0, 9, 5) },
    { id: 'suivant', debut: au(0, 9, 10), fin: au(0, 10) },
  ]);
  const p = Object.fromEntries(placements.map((x) => [x.id, x]));
  assert.equal(p.court.hauteur, S.HAUTEUR_MIN_BLOC);
  assert.equal(p.court.colonnes, 2, 'à 9 h 10, le bloc minimal de 9 h n’a pas fini de s’afficher');
  assert.notEqual(p.court.colonne, p.suivant.colonne);
});

await dit('semaine : bornés à la plage, coupés sur plusieurs jours, comptés quand ils sont hors plage', () => {
  const r = S.placerEvenements(optionsSemaine, [
    { id: 'tot', debut: au(0, 6), fin: au(0, 9) },
    { id: 'nuit', debut: au(1, 22), fin: au(2, 9) },
    { id: 'avant', debut: au(3, 5), fin: au(3, 7) },
    { id: 'apres', debut: au(3, 21), fin: au(3, 22) },
    { id: 'vide', debut: au(4, 10), fin: au(4, 10) },
  ]);
  assert.deepEqual(r.horsPlage.sort(), ['apres', 'avant']);
  const tot = r.placements.find((p) => p.id === 'tot');
  assert.deepEqual([tot?.haut, tot?.hauteur, tot?.coupeDebut], [0, 46, true]);
  const nuit = r.placements.filter((p) => p.id === 'nuit');
  assert.equal(nuit.length, 1, 'le soir du premier jour est hors plage ; le matin du second est affiché');
  assert.equal(nuit[0].jour, 2);
  assert.deepEqual([nuit[0].haut, nuit[0].hauteur, nuit[0].coupeDebut], [0, 46, true]);
  assert.equal(r.placements.find((p) => p.id === 'vide')?.hauteur, S.HAUTEUR_MIN_BLOC, 'un événement sans durée reste visible');
  const deuxJours = S.placerEvenements(optionsSemaine, [{ id: 'long', debut: au(1, 10), fin: au(2, 11) }]);
  assert.deepEqual(deuxJours.placements.map((p) => [p.jour, p.coupeFin]), [[1, true], [2, false]]);
  assert.deepEqual(S.placerEvenements(optionsSemaine, [{ id: 'x', debut: 'pas une date', fin: 'non plus' }]).placements, []);
});

await dit('semaine : l’ordre d’arrivée ne change rien, et jamais deux blocs ne se recouvrent (tirage au hasard, 300 jeux)', () => {
  let graine = 20260101;
  const hasard = (n: number): number => {
    graine = (graine * 1664525 + 1013904223) >>> 0;
    return graine % n;
  };
  for (let essai = 0; essai < 300; essai += 1) {
    const evs = Array.from({ length: 1 + hasard(14) }, (_, i) => {
      const debutMin = 8 * 60 + hasard(11 * 60);
      return { id: `e${i}`, debut: au(0, 0, debutMin), fin: au(0, 0, debutMin + 5 + hasard(180)) };
    });
    const a = S.placerEvenements(optionsSemaine, evs);
    const b = S.placerEvenements(optionsSemaine, [...evs].reverse());
    assert.deepEqual(
      a.placements.map((p) => [p.id, p.colonne, p.colonnes, p.empan]).sort(),
      b.placements.map((p) => [p.id, p.colonne, p.colonnes, p.empan]).sort(),
      `ordre d’arrivée (essai ${essai})`,
    );
    for (const x of a.placements) {
      assert.ok(x.colonne >= 0 && x.colonne + x.empan <= x.colonnes, `colonnes hors cadre (essai ${essai})`);
      for (const y of a.placements) {
        if (x === y || x.jour !== y.jour) continue;
        const verticalement = x.haut < y.haut + y.hauteur - 0.01 && y.haut < x.haut + x.hauteur - 0.01; // un centième de pixel : les sommes décimales ne sont pas exactes
        const horizontalement = x.colonne < y.colonne + y.empan && y.colonne < x.colonne + x.empan;
        // Les blocs courts sont agrandis à la hauteur minimale : on compare sur la hauteur affichée.
        assert.ok(!(verticalement && horizontalement && x.colonnes === y.colonnes) || x.id === y.id, `recouvrement ${x.id}/${y.id} (essai ${essai})`);
      }
    }
  }
});

await dit('semaine : la ligne « maintenant » tombe dans la bonne colonne, à la bonne hauteur, et nulle part ailleurs', () => {
  assert.deepEqual(S.positionMaintenant(au(3, 9, 30), jours, 8, 20), { jour: 3, haut: 69 });
  assert.equal(S.positionMaintenant(au(3, 7, 59), jours, 8, 20), null);
  assert.equal(S.positionMaintenant(au(3, 20, 1), jours, 8, 20), null);
  assert.equal(S.positionMaintenant(new Date(lundi.getFullYear() + 1, 0, 1, 10), jours, 8, 20), null);
  assert.ok(S.memeJour(au(0, 1), au(0, 23)) && !S.memeJour(au(0, 1), au(1, 1)));
});

await dit('tableau : tri stable, dans les deux sens, valeurs vides toujours en bas', () => {
  const lignes = [
    { id: 'a', nom: 'Zoé', age: 30, fin: new Date(2031, 0, 3) },
    { id: 'b', nom: 'élodie', age: 30, fin: null },
    { id: 'c', nom: 'Alice', age: 25, fin: new Date(2031, 0, 1) },
    { id: 'd', nom: 'Éric', age: 30, fin: new Date(2031, 0, 2) },
    { id: 'e', nom: 'Bob', age: null, fin: new Date(2031, 0, 2) },
  ];
  const valeur = (l: (typeof lignes)[number], cle: string) => (l as unknown as Record<string, never>)[cle];
  const ids = (tri: { cle: string; sens: 'asc' | 'desc' } | null) => T.trierLignes(lignes, tri, valeur).map((l) => l.id).join('');
  assert.equal(ids(null), 'abcde', 'sans tri : l’ordre reçu');
  assert.equal(ids({ cle: 'age', sens: 'asc' }), 'cabde', 'à âge égal, l’ordre d’origine (a, b, d) ; le vide en dernier');
  assert.equal(ids({ cle: 'age', sens: 'desc' }), 'abdce', 'décroissant : les égaux gardent leur ordre d’origine, le vide reste en bas');
  assert.equal(ids({ cle: 'nom', sens: 'asc' }), 'cebda', 'à la française : Alice, Bob, élodie, Éric, Zoé');
  assert.equal(ids({ cle: 'nom', sens: 'desc' }), 'adbec', 'décroissant : Zoé, Éric, élodie, Bob, Alice');
  assert.equal(ids({ cle: 'fin', sens: 'asc' }), 'cdeab', 'dates : le 1er, le 2 (d puis e), le 3, puis le vide');
  assert.equal(ids({ cle: 'fin', sens: 'desc' }), 'adecb', 'dates, décroissant : le vide reste en bas, d avant e');
  assert.equal(lignes.map((l) => l.id).join(''), 'abcde', 'la liste reçue n’est jamais modifiée');
  assert.deepEqual(T.trierLignes(['10', '9', '2'], { cle: 'x', sens: 'asc' }, (l) => l), ['2', '9', '10'], 'les nombres écrits en texte se rangent en nombres');
});

await dit('tableau : aria-sort — une seule colonne triée, et le clic fait tourner sans tri, croissant, décroissant', () => {
  assert.equal(T.ariaSort('nom', null), 'none');
  assert.equal(T.ariaSort('nom', { cle: 'nom', sens: 'asc' }), 'ascending');
  assert.equal(T.ariaSort('nom', { cle: 'nom', sens: 'desc' }), 'descending');
  assert.equal(T.ariaSort('age', { cle: 'nom', sens: 'desc' }), 'none');
  const un = T.prochainTri(null, 'nom');
  assert.deepEqual(un, { cle: 'nom', sens: 'asc' });
  assert.deepEqual(T.prochainTri(un, 'nom'), { cle: 'nom', sens: 'desc' });
  assert.equal(T.prochainTri(T.prochainTri(un, 'nom'), 'nom'), null);
  assert.deepEqual(T.prochainTri({ cle: 'nom', sens: 'desc' }, 'age'), { cle: 'age', sens: 'asc' }, 'une autre colonne repart du croissant');
});

await dit('tableau : recherche sans accents ni casse, tous les mots ; regroupement dans l’ordre', () => {
  const l = ['Éléonore Martin', 'Hugo Dubois', 'Éloïse Durand'];
  assert.deepEqual(T.filtrerLignes(l, 'eleo', (x) => x), ['Éléonore Martin']);
  assert.deepEqual(T.filtrerLignes(l, 'DU hu', (x) => x), ['Hugo Dubois'], 'tous les mots, dans n’importe quel ordre');
  assert.equal(T.filtrerLignes(l, '   ', (x) => x).length, 3);
  assert.deepEqual(T.filtrerLignes(l, 'zzz', (x) => x), []);
  const g = T.regrouperLignes([1, 2, 3, 4, 5, 6], (n) => (n % 3 === 0 ? 'trois' : n % 2 === 0 ? 'pair' : 'impair'));
  assert.deepEqual(g.map((x) => x.cle), ['impair', 'pair', 'trois'], 'les groupes suivent la première ligne de chacun');
  assert.deepEqual(g.map((x) => x.lignes), [[1, 5], [2, 4], [3, 6]], 'et chaque groupe garde l’ordre (donc le tri) reçu');
  assert.deepEqual(T.regrouperLignes([1, 2, 3], (n) => String(n % 2), ['0', 'absent']).map((x) => x.cle), ['0', '1']);
});

await dit('clavier : lignes, cartes et tickets — flèches, début, fin, bords sans boucle, touches étrangères ignorées', () => {
  assert.equal(N.deplacerLineaire(0, 5, 'ArrowDown'), 1);
  assert.equal(N.deplacerLineaire(4, 5, 'ArrowDown'), 4, 'on s’arrête en bas : Tab peut sortir');
  assert.equal(N.deplacerLineaire(0, 5, 'ArrowUp'), 0);
  assert.equal(N.deplacerLineaire(2, 5, 'Home'), 0);
  assert.equal(N.deplacerLineaire(2, 5, 'End'), 4);
  assert.equal(N.deplacerLineaire(1, 30, 'PageDown'), 11);
  assert.equal(N.deplacerLineaire(1, 30, 'PageUp'), 0);
  assert.equal(N.deplacerLineaire(0, 5, 'a'), null);
  assert.equal(N.deplacerLineaire(0, 0, 'ArrowDown'), null);
  // Sept cartes sur trois colonnes : 0 1 2 / 3 4 5 / 6
  assert.equal(N.deplacerDansGrille(0, 7, 3, 'ArrowRight'), 1);
  assert.equal(N.deplacerDansGrille(2, 7, 3, 'ArrowRight'), 3, '→ au bout d’une rangée passe à la suivante');
  assert.equal(N.deplacerDansGrille(0, 7, 3, 'ArrowLeft'), 0);
  assert.equal(N.deplacerDansGrille(1, 7, 3, 'ArrowDown'), 4);
  assert.equal(N.deplacerDansGrille(4, 7, 3, 'ArrowDown'), 6, '↓ vers une colonne absente de la dernière rangée va à la dernière carte');
  assert.equal(N.deplacerDansGrille(6, 7, 3, 'ArrowDown'), 6);
  assert.equal(N.deplacerDansGrille(4, 7, 3, 'ArrowUp'), 1);
  assert.equal(N.deplacerDansGrille(1, 7, 3, 'ArrowUp'), 1);
  assert.equal(N.deplacerDansGrille(4, 7, 3, 'Home'), 3);
  assert.equal(N.deplacerDansGrille(4, 7, 3, 'End'), 5);
  assert.equal(N.deplacerDansGrille(4, 7, 3, 'Home', true), 0);
  assert.equal(N.deplacerDansGrille(4, 7, 3, 'End', true), 6);
  assert.equal(N.deplacerDansGrille(4, 7, 3, 'x'), null);
  assert.equal(N.deplacerDansGrille(1, 4, 1, 'ArrowDown'), 2, 'une seule colonne : ↓ descend d’une carte');
  assert.equal(N.compterColonnes([10, 10, 10, 120, 120]), 3);
  assert.equal(N.compterColonnes([10, 120, 230]), 1);
  assert.equal(N.compterColonnes([10, 11, 10.5]), 3, 'un demi-pixel d’écart n’est pas une autre rangée');
  assert.equal(N.compterColonnes([]), 1);
  assert.deepEqual(N.positionDansGrille(7, 3), { rangee: 2, colonne: 1 });
  assert.deepEqual(N.repartirEnRangees([1, 2, 3, 4, 5, 6, 7], 3), [[1, 2, 3], [4, 5, 6], [7]]);
  assert.equal(N.nombreDeColonnes(3, 1440), 3);
  assert.equal(N.nombreDeColonnes(3, 1280), 3);
  assert.equal(N.nombreDeColonnes(3, 1279), 2, 'sous 1280 px de fenêtre : deux colonnes');
  assert.equal(N.nombreDeColonnes(4, 900), 2);
  assert.equal(N.nombreDeColonnes(1, 900), 1);
  // Tickets : colonne 1 vide, on la saute.
  const tailles = [3, 0, 2];
  assert.deepEqual(N.voisinKanban(tailles, { colonne: 0, index: 2 }, 'ArrowRight'), { colonne: 2, index: 1 }, '→ saute la colonne vide et garde le rang (ramené au dernier)');
  assert.deepEqual(N.voisinKanban(tailles, { colonne: 2, index: 0 }, 'ArrowLeft'), { colonne: 0, index: 0 });
  assert.deepEqual(N.voisinKanban(tailles, { colonne: 0, index: 0 }, 'ArrowLeft'), { colonne: 0, index: 0 }, 'au bord : on reste');
  assert.deepEqual(N.voisinKanban(tailles, { colonne: 0, index: 2 }, 'ArrowDown'), { colonne: 0, index: 2 });
  assert.deepEqual(N.voisinKanban(tailles, { colonne: 0, index: 1 }, 'ArrowUp'), { colonne: 0, index: 0 });
  assert.equal(N.voisinKanban(tailles, { colonne: 0, index: 0 }, 'Enter'), null);
});

await dit('kanban : déplacer un ticket — autre colonne, même colonne, colonne pleine, inconnu', () => {
  const cles = (c: { elements: string[] }[]) => c.map((x) => x.elements.join('')).join('|');
  const base = [
    { cle: 'a', elements: ['1', '2', '3'] },
    { cle: 'b', elements: ['4'], limite: 2 },
    { cle: 'c', elements: ['5', '6'], limite: 2 },
  ];
  const id = (e: string) => e;
  const r1 = K.deplacerElement(base, id, '2', 'b');
  assert.equal(r1.deplace, true);
  assert.equal(cles(r1.colonnes), '13|42|56', 'à la fin de la colonne cible');
  assert.equal(cles(base), '123|4|56', 'l’état reçu n’est jamais modifié');
  assert.equal(cles(K.deplacerElement(base, id, '3', 'b', 0).colonnes), '12|34|56', 'au rang demandé');
  const pleine = K.deplacerElement(base, id, '1', 'c');
  assert.deepEqual([pleine.deplace, pleine.raison], [false, 'limite'], 'une colonne pleine refuse');
  assert.equal(cles(pleine.colonnes), '123|4|56');
  assert.equal(K.deplacerElement(base, id, '5', 'c', 0).raison, 'identique', 'dans sa colonne pleine, un ticket peut changer de rang');
  assert.equal(cles(K.deplacerElement(base, id, '5', 'c', 2).colonnes), '123|4|65', 'lâché sous le dernier : il passe en dernier');
  assert.equal(cles(K.deplacerElement(base, id, '1', 'a', 3).colonnes), '231|4|56');
  assert.equal(K.deplacerElement(base, id, '1', 'a', 1).raison, 'identique', 'lâché sur sa propre place');
  assert.equal(K.deplacerElement(base, id, 'x', 'a').raison, 'inconnu');
  assert.equal(K.deplacerElement(base, id, '1', 'z').raison, 'inconnu');
  assert.deepEqual(K.destinations(base, id, '1'), [{ cle: 'b', pleine: false }, { cle: 'c', pleine: true }]);
  assert.equal(K.indexDepot([10, 50, 90], 60), 2);
  assert.equal(K.indexDepot([10, 50, 90], 5), 0);
  assert.equal(K.indexDepot([], 5), 0);
});

await dit('formats : à la française — espace avant % et €, virgule décimale, heure sur deux chiffres', () => {
  assert.equal(norm(F.formaterPourcent(0.78)), '78 %');
  assert.equal(norm(F.formaterPourcent(1.4)), '100 %', 'borné à 100 %');
  assert.equal(norm(F.formaterPourcent(Number.NaN)), '0 %');
  assert.equal(norm(F.formaterMontant(1250)), '1 250 €');
  assert.equal(norm(F.formaterMontant(1250.5)), '1 250,50 €');
  assert.equal(F.formaterHeure(new Date(2031, 0, 1, 9, 5)), '09:05');
  assert.equal(F.formaterDate(new Date(2031, 0, 3), { weekday: 'long' }), new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(new Date(2031, 0, 3)));
  assert.notEqual(F.formaterDate(new Date(2031, 0, 3), { weekday: 'long' }, 'en-US'), F.formaterDate(new Date(2031, 0, 3), { weekday: 'long' }), 'la langue vient de l’argument');
  assert.equal(F.dateIso('pas une date'), '');
});

await dit('la logique est sans React ni import : elle se charge seule', () => {
  for (const f of ['semaine', 'tableau', 'navigation', 'kanban', 'formats']) {
    const src = sansCommentaires(lire(`src/socle/ui/archetypes/logique/${f}.ts`));
    assert.doesNotMatch(src, /^\s*import\s/m, `${f}.ts importe quelque chose`);
    assert.doesNotMatch(src, /from\s+['"]react|document\.|window\./, `${f}.ts touche au DOM ou à React`);
  }
});

/* ═════════════════════════  2. Les cotes, lues dans la feuille  ═════════════════════════ */

const brut = lire('src/socle/ui/archetypes/archetypes.css');
const css = sansCommentaires(brut);
const noir = jetons(lire('src/socle/noir.css'));
const bloc = (selecteur: string, ou = css): string => {
  // La règle de premier niveau (en début de ligne) : celles d'une requête de média sont indentées.
  const trouve = new RegExp(`(?:^|\\n)${selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{`).exec(ou);
  assert.ok(trouve, `règle « ${selecteur} » introuvable`);
  const i = trouve.index + (trouve[0].startsWith('\n') ? 1 : 0);
  return ou.slice(i, ou.indexOf('}', i) + 1);
};
const tokenPx = (nom: string): number => {
  const m = new RegExp(`${nom}:\\s*(\\d+)px`).exec(lire('src/socle/noir.css'));
  assert.ok(m, `${nom} introuvable dans noir.css`);
  return Number(m[1]);
};

await dit('page : h1 28 px / 600 / -0,02 em / 1,1 ; sous-titre 13,5 px T4 marge 7 ; actions à 9 px, boutons de 31 px', () => {
  const h1 = bloc('.sc-page__titre');
  assert.match(h1, /font-size:\s*28px/);
  assert.match(h1, /font-weight:\s*600/);
  assert.match(h1, /letter-spacing:\s*-0\.02em/);
  assert.match(h1, /line-height:\s*1\.1\b/);
  const sous = bloc('.sc-page__sous-titre');
  assert.match(sous, /font-size:\s*13\.5px/);
  assert.match(sous, /margin:\s*7px 0 0/);
  assert.match(sous, /color:\s*var\(--socle-texte-3\)/, 'T4');
  assert.equal(noir.get('--socle-texte-3'), '#8a8a8e');
  assert.match(bloc('.sc-page__actions'), /gap:\s*9px/);
  assert.match(bloc(".sc-page__actions [data-socle='bouton']"), /min-height:\s*31px/);
  assert.match(css, /--sc-ecart-page:\s*14px/);
});

await dit('page : jamais de défilement de la page entière — flex:1, min-height:0, la zone qui défile est la carte', () => {
  const page = bloc('.sc-page');
  assert.match(page, /flex:\s*1 0 auto/);
  assert.match(page, /min-height:\s*0/);
  assert.match(bloc(".sc-page[data-autonome='true']"), /padding:\s*24px 40px 0/, 'sans coquille : 24px 40px 0');
  // Dans la coquille : son rembourrage n’est pas redoublé, sa languette de fin cède la place, la page remplit la hauteur.
  assert.match(css, /@media \(min-width: 1280px\)\s*\{[^}]*\.sc-principal:has\(> \.sc-page:not\(\[data-autonome='true'\]\)\)\s*\{[^}]*flex-direction:\s*column/);
  assert.match(css, /\.sc-principal-fin\s*\{\s*display:\s*none/);
  const coquille = sansCommentaires(lire('src/socle/coquille/coquille.css'));
  assert.match(coquille, /\.sc-principal \{[^}]*padding:\s*24px 40px 0/, 'la coquille porte déjà le rembourrage');
  assert.doesNotMatch(bloc('.sc-page'), /padding/, 'la page de la coquille n’en pose pas un second');
  assert.match(bloc('.sc-zone'), /flex:\s*1 1 0/);
  for (const z of ['.sc-tableau__defile', '.sc-grille-cartes__zone', '.sc-liste-scindee__defile', '.sc-semaine__corps', '.sc-detail__defile']) assert.match(bloc(z), /overflow(-y)?:\s*auto/, `${z} défile en interne`);
  assert.match(css, /\.sc-tableau, \.sc-semaine, \.sc-scinde \{[^}]*overflow:\s*hidden/, 'la carte coupe ce qui dépasse : seule sa zone interne défile');
});

await dit('colonne droite : 340 px (360 ou 400 par prop), écart 14, dernière carte étirée, sous 1280 px elle passe sous le contenu', () => {
  assert.match(bloc('.sc-colonne-droite'), /--sc-colonne-droite:\s*340px/);
  assert.match(bloc('.sc-colonne-droite'), /gap:\s*14px/);
  assert.match(bloc('.sc-colonne-droite'), /width:\s*calc\(var\(--sc-colonne-droite\) \+ 8px\)/, '340 de carte + 4 de chaque côté pour l’anneau de focus');
  assert.match(bloc('.sc-colonne-droite'), /margin:\s*-4px/);
  assert.match(bloc('.sc-colonne-droite > :last-child'), /flex:\s*1 0 auto/);
  assert.match(css, /\.sc-disposition\[data-avec-droite='true'\]\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\) auto/);
  const etroit = /@media \(max-width: 1279\.98px\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  assert.match(etroit, /\.sc-colonne-droite\s*\{[^}]*flex-direction:\s*row[^}]*flex-wrap:\s*wrap/, 'cartes côte à côte');
  assert.match(etroit, /\.sc-disposition[\s\S]*flex-direction:\s*column/, 'sous le contenu');
});

await dit('KPI : quatre colonnes égales, écart 14 ; une à trois tuiles se partagent la largeur', () => {
  const k = bloc('.sc-rangee-kpi');
  assert.match(k, /grid-template-columns:\s*repeat\(var\(--sc-kpi-colonnes, 4\), minmax\(0, 1fr\)\)/);
  assert.match(k, /gap:\s*14px/);
  assert.match(sansCommentaires(lire('src/socle/ui/briques.css')), /\.sc-kpi \{[^}]*min-height:\s*84px/, 'tuile de 84 px (briques.css)');
});

await dit('tableau : tête 36, lignes 54, grille CSS (écart 12, rembourrage 16), filets, ligne active, tête collante', () => {
  const t = bloc('.sc-tableau');
  assert.match(t, /--sc-tete-hauteur:\s*36px/);
  assert.match(t, /--sc-ligne-hauteur:\s*54px/);
  const r = bloc('.sc-tableau__rangee');
  assert.match(r, /display:\s*grid/);
  assert.match(r, /grid-template-columns:\s*var\(--sc-colonnes\)/);
  assert.match(r, /column-gap:\s*12px/);
  assert.match(r, /padding:\s*0 16px/);
  const tete = bloc('.sc-tableau__rangee--tete');
  assert.match(tete, /height:\s*var\(--sc-tete-hauteur\)/);
  assert.match(tete, /border-bottom:\s*1px solid var\(--socle-bord-entete\)/);
  assert.equal(noir.get('--socle-bord-entete'), '#1d1d1f');
  const titre = bloc('.sc-tableau__titre');
  assert.match(titre, /font-size:\s*11px/);
  assert.match(titre, /letter-spacing:\s*0\.05em/);
  assert.match(titre, /text-transform:\s*uppercase/);
  assert.match(titre, /color:\s*var\(--socle-texte-3\)/);
  assert.match(bloc('.sc-tableau__tete'), /position:\s*sticky[^}]*top:\s*0/);
  const ligne = bloc('.sc-tableau__corps > .sc-tableau__rangee');
  assert.match(ligne, /min-height:\s*var\(--sc-ligne-hauteur\)/);
  assert.match(ligne, /flex:\s*1 0 var\(--sc-ligne-hauteur\)/, 'les lignes se partagent la hauteur restante');
  assert.match(ligne, /border-bottom:\s*1px solid var\(--socle-bord-ligne\)/);
  assert.equal(noir.get('--socle-bord-ligne'), '#19191b');
  assert.match(css, /linear-gradient\(90deg, rgba\(255, 255, 255, 0\.04\), transparent\)/);
  assert.match(bloc('.sc-tableau__recherche'), /width:\s*210px/);
  assert.match(bloc('.sc-tableau__montant'), /font-variant-numeric:\s*tabular-nums/);
  assert.match(bloc(".sc-tableau__cellule[data-alignement='fin']"), /justify-content:\s*flex-end/, 'montants alignés à droite');
});

await dit('kanban : colonne (padding 10, en-tête 34, rayon 14, #111112 / #1e1e20), zone pointillée de 46, ticket (rayon 12, filet urgent de 3)', () => {
  assert.match(bloc('.sc-kanban'), /--sc-colonne-padding:\s*10px/);
  assert.match(bloc('.sc-kanban'), /--sc-colonne-entete:\s*34px/);
  const c = bloc('.sc-kanban__colonne');
  assert.match(c, /padding:\s*var\(--sc-colonne-padding\)/);
  assert.match(c, /border:\s*1px solid var\(--socle-bord-kanban\)/);
  assert.match(c, /border-radius:\s*var\(--socle-rayon-kanban\)/);
  assert.match(c, /background:\s*var\(--socle-sous-carte\)/);
  assert.equal(tokenPx('--socle-rayon-kanban'), 14);
  assert.equal(noir.get('--socle-sous-carte'), '#111112');
  assert.equal(noir.get('--socle-bord-kanban'), '#1e1e20');
  assert.match(bloc('.sc-kanban__entete'), /height:\s*var\(--sc-colonne-entete\)/);
  assert.match(bloc('.sc-kanban__nom'), /font-size:\s*13px[^}]*font-weight:\s*600/);
  const z = bloc('.sc-kanban__ajout');
  assert.match(z, /height:\s*46px/);
  assert.match(z, /border:\s*1px dashed var\(--socle-pointille\)/);
  const tk = bloc('.sc-ticket');
  assert.match(tk, /border:\s*1px solid var\(--socle-bord-ticket\)/);
  assert.match(tk, /border-radius:\s*var\(--socle-rayon-ticket\)/);
  assert.match(tk, /background:\s*var\(--socle-ticket\)/);
  assert.equal(tokenPx('--socle-rayon-ticket'), 12);
  assert.equal(noir.get('--socle-ticket'), '#171718');
  assert.equal(noir.get('--socle-bord-ticket'), '#262628');
  assert.match(bloc(".sc-ticket[data-urgent='true']"), /box-shadow:\s*inset 3px 0 0 var\(--socle-etat-critique\)/);
  assert.match(bloc('.sc-ticket__titre'), /font-size:\s*13px[^}]*font-weight:\s*500/);
  assert.match(bloc('.sc-ticket__menu'), /width:\s*34px[^}]*height:\s*34px/, 'cible de 34 px');
});

await dit('cartes : 3 colonnes à 14 px (2 sous 1280 px), icône de 38 px teinte 13 %, texte à 3 lignes, bas de carte aligné, survol 1 px en 120 ms', () => {
  const g = bloc('.sc-grille-cartes');
  assert.match(g, /--sc-grille-ecart:\s*14px/);
  assert.match(g, /grid-template-columns:\s*repeat\(var\(--sc-grille-colonnes, 3\), minmax\(0, 1fr\)\)/);
  assert.match(g, /gap:\s*var\(--sc-grille-ecart\)/);
  assert.match(g, /grid-auto-rows:\s*1fr/, 'cartes de même hauteur');
  assert.match(css, /@media \(max-width: 1279\.98px\)\s*\{[^}]*\.sc-grille-cartes\s*\{\s*grid-template-columns:\s*repeat\(var\(--sc-grille-colonnes-etroit, 2\)/);
  const i = bloc('.sc-carte-module__icone');
  assert.match(i, /width:\s*38px[^}]*height:\s*38px/);
  assert.match(i, /background:\s*color-mix\(in srgb, var\(--fam, var\(--socle-fam-outils\)\) 13%, transparent\)/);
  assert.match(bloc('.sc-carte-module__titre'), /font-size:\s*14px[^}]*font-weight:\s*600/);
  const d = bloc('.sc-carte-module__description');
  assert.match(d, /font-size:\s*12\.5px/);
  assert.match(d, /color:\s*var\(--socle-texte-2\)/, 'T3');
  assert.match(bloc(".sc-tronque[data-lignes]"), /-webkit-line-clamp:\s*var\(--sc-lignes, 2\)/);
  assert.match(bloc('.sc-carte-module__pied'), /margin-top:\s*auto/);
  const c = bloc('.sc-carte-module');
  assert.match(c, /transition:\s*transform 120ms ease-out, border-color 120ms ease-out/);
  const survol = bloc(".sc-carte-module[data-interactive='true']:hover");
  assert.match(survol, /border-color:\s*var\(--socle-bord-bouton\)/);
  assert.match(survol, /transform:\s*translateY\(-1px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.sc-carte-module\[data-interactive='true'\]:hover \{ transform: none; \}/);
  assert.match(css, /:root\[data-mouvement='reduit'\] \.sc-carte-module\[data-interactive='true'\]:hover/);
  assert.match(css, /\.sc-carte-module__lien\.sc-focus:focus-visible::after \{ outline:\s*2px solid var\(--color-socle-focus\)/, 'anneau de focus de 2 px');
  assert.equal(noir.get('--socle-bord-bouton'), '#2e2e31');
});

await dit('scindé : liste de 380 px, titre du détail 21 px / 600, texte 13,5 px interligne 1,65, point blanc non lu', () => {
  assert.match(bloc('.sc-scinde'), /--sc-scinde-liste:\s*380px/);
  assert.match(bloc('.sc-scinde'), /grid-template-columns:\s*var\(--sc-scinde-liste\) minmax\(0, 1fr\)/);
  const t = bloc('.sc-detail__titre');
  assert.match(t, /font-size:\s*21px[^}]*font-weight:\s*600/);
  const x = bloc('.sc-detail__texte');
  assert.match(x, /font-size:\s*13\.5px[^}]*line-height:\s*1\.65/);
  assert.match(css, /\.sc-element-liste\[data-non-lu='true'\] \.sc-element-liste__point \{ background: var\(--socle-primaire\)/);
  assert.match(bloc('.sc-detail__suggestion'), /margin-top:\s*auto/);
});

await dit('semaine : 46 px par heure, blocs teintés 14 % avec filet de 3 px, aujourd’hui en pastille blanche, ligne « maintenant »', () => {
  assert.match(bloc('.sc-semaine'), /--sc-px-heure:\s*46px/);
  assert.match(bloc('.sc-semaine__jour'), /background-size:\s*100% var\(--sc-px-heure\)/);
  const e = bloc('.sc-semaine__evenement');
  assert.match(e, /border-left:\s*3px solid var\(--fam, var\(--socle-fam-outils\)\)/);
  assert.match(e, /background:\s*color-mix\(in srgb, var\(--fam, var\(--socle-fam-outils\)\) 14%, transparent\)/);
  assert.match(css, /\.sc-semaine__titre-jour\[data-aujourdhui='true'\] \.sc-semaine__numero \{ background: var\(--socle-primaire\); color: var\(--socle-primaire-encre\)/);
  assert.match(bloc('.sc-semaine__maintenant'), /height:\s*2px/);
  assert.match(bloc('.sc-semaine__tete'), /position:\s*sticky/);
  assert.match(bloc('.sc-semaine__evenement-titre'), /font-size:\s*12px/);
  for (const m of css.matchAll(/\.sc-semaine__[\w-]+\s*\{[^}]*font-size:\s*([\d.]+)px/g)) assert.ok(Number(m[1]) >= 10.5, `texte de ${m[1]} px sous le plancher de 10,5`);
});

await dit('ligne de temps : heure 42 px (12 px T4), pastille de 26 px, filet vertical #222224 (§4), titre 13,5 px / 500, détail 12 px T4', () => {
  const l = bloc('.sc-ligne-temps');
  assert.match(l, /--sc-heure-largeur:\s*42px/);
  assert.match(l, /--sc-pastille:\s*26px/);
  assert.match(css, /\.sc-ligne-temps:not\(\[data-dernier='true'\]\)::before \{[^}]*background:\s*var\(--socle-filet-vertical\)/);
  assert.equal(noir.get('--socle-filet-vertical'), '#222224', 'le filet vertical du §4 TimelineItem (mesuré à #2a2a2d avant le chantier s1b)');
  assert.match(bloc('.sc-ligne-temps__heure'), /font-size:\s*12px/);
  assert.match(bloc('.sc-ligne-temps__heure'), /color:\s*var\(--socle-texte-3\)/);
  assert.match(bloc('.sc-ligne-temps__titre'), /font-size:\s*13\.5px[^}]*font-weight:\s*500/);
  assert.match(bloc('.sc-ligne-temps__detail'), /font-size:\s*12px/);
  assert.match(bloc('.sc-ligne-temps__detail'), /color:\s*var\(--socle-texte-3\)/);
  assert.match(bloc('.sc-ligne-temps__pastille'), /border-radius:\s*99px/);
});

await dit('la feuille : aucune couleur hex en dur, aucune encre « discret » en texte, aucun texte sous 10,5 px', () => {
  for (const m of css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const ligne = css.slice(0, m.index).split('\n').pop() ?? '';
    assert.ok(/--sc-[\w-]+:\s*$/.test(ligne), `couleur en dur « ${m[0]} » (${ligne.trim()}…)`);
  }
  assert.doesNotMatch(css, /trait-discret|trait-tres-discret|#77777c|#5f5f64/i, 'encre « discret » dans la feuille');
  for (const m of css.matchAll(/font-size:\s*([\d.]+)px/g)) assert.ok(Number(m[1]) >= 10.5, `font-size ${m[1]}px sous le plancher`);
  // Un contour ne se retire qu'en le redessinant ailleurs : ici, sur le ::after qui couvre toute la carte.
  const retraits = [...css.matchAll(/([^{}]+)\{[^}]*outline:\s*(?:none|0)\b[^}]*\}/g)].map((m) => m[1].trim());
  assert.deepEqual(retraits, [":root[data-ambiance='noir'] .sc-carte-module__lien.sc-focus:focus-visible"], 'un contour supprimé sans remplaçant');
  assert.match(css, /\.sc-carte-module__lien\.sc-focus:focus-visible::after \{ outline:\s*2px solid var\(--color-socle-focus\)/);
});

/* ═════════════════════════  3. Le rendu statique  ═════════════════════════ */

const R = await chargerRendu<Record<string, any>>( // eslint-disable-line @typescript-eslint/no-explicit-any
  [
    "import { Bouton, Carte, TuileKpi, PastilleEtat, Etiquette } from '../src/socle/ui';",
    "import { Tag, CarteCases, SuggestionAjmani, BoutonIcone, Interrupteur } from '../src/socle/ui/controles';",
    "import { Page, EnTeteDePage, RangeeKpi, ColonneDroite, DispositionPage, Tableau, CelluleNom, CelluleTexte, CelluleEtat, CelluleProgression, CelluleAvatar, CelluleMontant, CelluleTag, CelluleDate, CelluleCase, CelluleInterrupteur, CelluleIcone, CelluleBouton, Kanban, ColonneKanban, Ticket, GrilleCartes, CarteModule, Scinde, ListeScindee, ElementListe, DetailScinde, Semaine, LigneTemps, ChronologieTemps, TexteTronque } from '../src/socle/ui/archetypes';",
    "import { traduireSocle, DICTIONNAIRES_SOCLE } from '../src/socle/i18n';",
    "import { EN_ARCHETYPES, FR_ARCHETYPES } from '../src/socle/mots/archetypes';",
  ].join('\n'),
  ['Bouton', 'Carte', 'TuileKpi', 'PastilleEtat', 'Etiquette', 'Tag', 'CarteCases', 'SuggestionAjmani', 'BoutonIcone', 'Interrupteur', 'Page', 'EnTeteDePage', 'RangeeKpi', 'ColonneDroite', 'DispositionPage', 'Tableau', 'CelluleNom', 'CelluleTexte', 'CelluleEtat', 'CelluleProgression', 'CelluleAvatar', 'CelluleMontant', 'CelluleTag', 'CelluleDate', 'CelluleCase', 'CelluleInterrupteur', 'CelluleIcone', 'CelluleBouton', 'Kanban', 'ColonneKanban', 'Ticket', 'GrilleCartes', 'CarteModule', 'Scinde', 'ListeScindee', 'ElementListe', 'DetailScinde', 'Semaine', 'LigneTemps', 'ChronologieTemps', 'TexteTronque', 'traduireSocle', 'DICTIONNAIRES_SOCLE', 'EN_ARCHETYPES', 'FR_ARCHETYPES'],
);
const { h, rendre } = R;
const noop = () => undefined;

await dit('mots : l’anglais est la base, le français a les mêmes clés et les mêmes {paramètres}, aucun point d’exclamation', () => {
  const en = R.EN_ARCHETYPES as Record<string, string>;
  const fr = R.FR_ARCHETYPES as Record<string, string>;
  assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort());
  assert.ok(Object.keys(en).length >= 20);
  for (const [k, v] of Object.entries(en)) {
    const params = (t: string) => (t.match(/\{\w+\}/g) ?? []).sort().join();
    assert.equal(params(fr[k]), params(v), `paramètres de ${k}`);
    assert.ok(v.trim() && fr[k].trim(), `valeur vide : ${k}`);
    assert.ok(!v.includes('!') && !fr[k].includes('!'), `point d’exclamation : ${k}`);
    assert.doesNotMatch(v, /[«»\u202f\u00a0]/, `résidu français dans l’anglais : ${k}`);
    assert.ok(k in R.DICTIONNAIRES_SOCLE.fr && k in R.DICTIONNAIRES_SOCLE.en, `${k} n’est pas fusionné dans i18n.ts`);
  }
  assert.equal(R.traduireSocle('fr', 'kanban.deplacer'), 'Déplacer vers…');
  assert.equal(R.traduireSocle('en', 'kanban.ajouter'), 'Add or drop here');
});

await dit('page : un seul h1, sous-titre, un seul bouton primaire — par construction —, secondaires avant lui', () => {
  const r = rendre(
    h(R.Page, null, h(R.EnTeteDePage, { titre: 'Un titre', sousTitre: 'Un sous-titre', primaire: { libelle: 'Créer', onClick: noop }, secondaires: [{ libelle: 'Modèle', onClick: noop }, { libelle: 'Exporter', onClick: noop }] })),
  );
  assert.equal(compter(r, /<h1[ >]/g), 1);
  assert.match(r, /<h1[^>]*>Un titre<\/h1>/);
  assert.match(r, /<p[^>]*class="sc-page__sous-titre"[^>]*>Un sous-titre<\/p>/);
  assert.equal(compter(r, /data-variante="primaire"/g), 1, 'un seul bouton blanc plein');
  assert.equal(compter(r, /data-variante="secondaire"/g), 2);
  assert.ok(r.indexOf('Modèle') < r.indexOf('Exporter') && r.indexOf('Exporter') < r.indexOf('Créer'), 'les secondaires précèdent le primaire');
  assert.match(r, /role="group"[^>]*aria-label="Actions de la page"/);
  assert.match(r, /^<div[^>]*data-socle-page=""[^>]*class="sc-page"/);
  assert.doesNotMatch(r, /data-autonome/);
  const seule = rendre(h(R.Page, { autonome: true }, h(R.EnTeteDePage, { titre: 'T' })));
  assert.match(seule, /^<main[^>]*data-autonome="true"/);
  assert.doesNotMatch(rendre(h(R.EnTeteDePage, { titre: 'T' })), /sc-page__actions|<button|<p/, 'sans action ni sous-titre : rien en plus');
  const sansPrimaire = rendre(h(R.EnTeteDePage, { titre: 'T', secondaires: [{ libelle: 'A' }] }));
  assert.equal(compter(sansPrimaire, /data-variante="primaire"/g), 0);
});

await dit('rangée de KPI : 1 à 4 tuiles se partagent la largeur sans trou, jamais plus de 4 colonnes', () => {
  const tuiles = (n: number) => Array.from({ length: n }, (_, i) => h(R.TuileKpi, { key: i, libelle: `K${i}`, valeur: i }));
  const colonnes = (n: number) => /--sc-kpi-colonnes:(\d+)/.exec(rendre(h(R.RangeeKpi, null, ...tuiles(n))))?.[1];
  assert.deepEqual([1, 2, 3, 4, 6].map(colonnes), ['1', '2', '3', '4', '4']);
  assert.equal(colonnes(0), '1');
  assert.equal(compter(rendre(h(R.RangeeKpi, null, ...tuiles(4))), /data-socle="kpi"/g), 4);
  assert.equal(colonnes(3), '3');
  assert.match(rendre(h(R.RangeeKpi, { libelle: 'Indicateurs' }, ...tuiles(2))), /role="group"[^>]*aria-label="Indicateurs"/);
});

await dit('colonne droite : une région nommée, 340 px par défaut, 360 ou 400 par prop ; la disposition la pose ou non', () => {
  const d = rendre(h(R.ColonneDroite, null, h('div', null, 'a'), h('div', null, 'b')));
  assert.match(d, /^<aside[^>]*aria-label="Informations complémentaires"/);
  assert.match(d, /--sc-colonne-droite:340px/);
  assert.match(rendre(h(R.ColonneDroite, { largeur: 360 }, 'x')), /--sc-colonne-droite:360px/);
  assert.match(rendre(h(R.ColonneDroite, { largeur: 400, libelle: 'Contexte' }, 'x')), /aria-label="Contexte"[^>]*--sc-colonne-droite:400px|--sc-colonne-droite:400px[^>]*aria-label="Contexte"/);
  const avec = rendre(h(R.DispositionPage, { droite: h('div', null, 'carte'), largeurDroite: 400 }, 'contenu'));
  assert.match(avec, /data-avec-droite="true"/);
  assert.match(avec, /sc-disposition__contenu[^>]*>contenu</);
  assert.match(avec, /<aside/);
  assert.match(avec, /--sc-colonne-droite:400px/);
  const sans = rendre(h(R.DispositionPage, null, 'contenu'));
  assert.doesNotMatch(sans, /<aside|data-avec-droite/);
});

type LigneEssai = { id: string; nom: string; sous: string; etat: 'succes' | 'attention'; avance: number; montant: number; fin: Date };
const lignesEssai: LigneEssai[] = [
  { id: 'l1', nom: 'Premier', sous: 'Un sous-titre', etat: 'succes', avance: 0.72, montant: 1250, fin: new Date(2031, 0, 3) },
  { id: 'l2', nom: 'Deuxième', sous: 'Un autre', etat: 'attention', avance: 0.3, montant: 480.5, fin: new Date(2031, 0, 1) },
  { id: 'l3', nom: 'Troisième', sous: 'Encore un', etat: 'succes', avance: 1, montant: 90, fin: new Date(2031, 0, 2) },
];
const colonnesEssai = [
  { cle: 'nom', titre: 'Nom', largeur: '2fr', valeur: (l: LigneEssai) => l.nom, cellule: (l: LigneEssai) => h(R.CelluleNom, { nom: l.nom, sousTitre: l.sous }) },
  { cle: 'etat', titre: 'Statut', largeur: '120px', valeur: (l: LigneEssai) => l.etat, cellule: (l: LigneEssai) => h(R.CelluleEtat, { etat: l.etat }, l.etat) },
  { cle: 'avance', titre: 'Avancement', largeur: '160px', valeur: (l: LigneEssai) => l.avance, cellule: (l: LigneEssai) => h(R.CelluleProgression, { valeur: l.avance, libelle: `Avancement de ${l.nom}` }) },
  { cle: 'fin', titre: 'Échéance', largeur: '90px', valeur: (l: LigneEssai) => l.fin, cellule: (l: LigneEssai) => h(R.CelluleDate, { date: l.fin }) },
  { cle: 'montant', titre: 'Montant', largeur: '110px', alignement: 'fin', valeur: (l: LigneEssai) => l.montant, cellule: (l: LigneEssai) => h(R.CelluleMontant, { valeur: l.montant, etat: l.etat === 'attention' ? 'attention' : undefined, libelleEtat: l.etat === 'attention' ? 'à surveiller' : undefined }) },
  { cle: 'case', titre: 'Suivi', titreCache: true, largeur: '40px', cellule: (l: LigneEssai) => h(R.CelluleCase, { coche: false, libelle: `Suivre ${l.nom}`, onChange: noop }) },
];
const videEssai = { titre: 'Rien ici', texte: 'Aucune ligne pour l’instant.', action: h(R.Bouton, { variante: 'secondaire' }, 'Ajouter une ligne') };
const tableau = (props: Record<string, unknown> = {}) => rendre(h(R.Tableau, { libelle: 'Lignes', colonnes: colonnesEssai, lignes: lignesEssai, cleLigne: (l: LigneEssai) => l.id, vide: videEssai, ...props }));

await dit('tableau : une grille ARIA — en-têtes de colonne, en-tête de ligne, cellules ; une seule tabulation ; aria-sort', () => {
  const r = tableau({ ligneActive: 'l2', triInitial: { cle: 'montant', sens: 'desc' } });
  assert.match(r, /role="grid"[^>]*aria-label="Lignes"/);
  assert.match(r, /aria-rowcount="4"/);
  assert.match(r, /aria-colcount="6"/);
  assert.equal(compter(r, /role="columnheader"/g), 6);
  assert.equal(compter(r, /role="row"/g), 4, 'la tête et trois lignes');
  assert.equal(compter(r, /role="rowheader"/g), 3, 'la première cellule de chaque ligne nomme la ligne');
  assert.equal(compter(r, /role="gridcell"/g), 15);
  assert.equal(compter(r, /aria-sort="descending"/g), 1, 'une seule colonne triée');
  assert.equal(compter(r, /aria-sort="none"/g), 4, 'les autres colonnes triables le disent');
  assert.equal(compter(r, /aria-sort=/g), 5, 'la colonne sans valeur ne se trie pas : pas d’aria-sort');
  assert.equal(compter(r, /tabindex="0"/g), 1, 'une seule ligne dans l’ordre de tabulation');
  assert.equal(compter(r, /data-rang="/g), 3);
  // Tri décroissant par montant : 1 250, 480,50, 90.
  assert.ok(r.indexOf('Premier') < r.indexOf('Deuxième') && r.indexOf('Deuxième') < r.indexOf('Troisième'));
  assert.match(r, /<div[^>]*role="row"[^>]*aria-selected="true"[^>]*data-active="true"/);
  assert.equal(compter(r, /aria-selected="false"/g), 2);
  assert.equal(compter(r, /<button[^>]*class="sc-tableau__tri/g), 5, 'les en-têtes triables sont des boutons');
  assert.match(r, /<span class="sr-only">Suivi<\/span>/, 'la colonne de cases garde son titre pour les lecteurs d’écran');
  const croissant = tableau({ triInitial: { cle: 'montant', sens: 'asc' } });
  assert.ok(croissant.indexOf('Troisième') < croissant.indexOf('Premier'));
  assert.doesNotMatch(tableau(), /aria-selected/, 'sans ligne active : pas de sélection annoncée');
  assert.doesNotMatch(tableau(), /data-ouvrable/, 'sans onOuvrir, les lignes ne se disent pas ouvrables');
  assert.match(tableau({ onOuvrir: noop }), /data-ouvrable="true"/);
});

await dit('tableau : cellules typées — nom, état, progression, montant à la française, date, case, avatar, tag, interrupteur, icône, bouton', () => {
  const r = tableau();
  assert.match(r, /class="sc-tronque sc-tableau__nom-principal"[^>]*>Premier</);
  assert.match(r, /class="sc-tronque sc-tableau__nom-sous"[^>]*>Un sous-titre</);
  assert.match(r, /data-forme="carre"/, 'Sq pour une organisation ou un client');
  assert.match(r, /data-etat="succes"[^>]*>succes</);
  assert.match(r, /role="progressbar"[^>]*aria-label="Avancement de Premier"[^>]*aria-valuenow="72"/);
  assert.match(norm(r), /1 250 €/);
  assert.match(norm(r), /480,50 €/);
  assert.match(norm(r), /72 %/);
  assert.match(r, /data-etat="attention"[^>]*title="à surveiller"/);
  assert.match(r, /<span class="sr-only"> — à surveiller<\/span>/, 'l’état du montant se dit en mots, pas seulement en couleur');
  assert.match(r, /<time dateTime="[^"]+"[^>]*class="sc-tableau__date"|<time datetime="[^"]+"[^>]*class="sc-tableau__date"/);
  assert.equal(compter(r, /role="checkbox"/g), 3);
  const autres = rendre(
    h('div', null,
      h(R.CelluleAvatar, { noms: ['Alpha Un', 'Beta Deux'], libelle: 'Responsables : Alpha Un, Beta Deux' }),
      h(R.CelluleTag, { famille: 'argent' }, 'Devis'),
      h(R.CelluleInterrupteur, { actif: true, libelle: 'Actif', onChange: noop }),
      h(R.CelluleIcone, { icone: h('svg', null) }, 'Fichier'),
      h(R.CelluleBouton, { libelle: 'Relancer', onClick: noop }),
      h(R.CelluleTexte, { attenue: true }, 'Un texte'),
    ),
  );
  assert.match(autres, /role="img"[^>]*aria-label="Responsables : Alpha Un, Beta Deux"/);
  assert.match(autres, /data-famille="argent"/);
  assert.match(autres, /role="switch"[^>]*aria-checked="true"/);
  assert.match(autres, /data-variante="secondaire"/);
  assert.doesNotMatch(autres, /data-variante="primaire"/, 'un bouton de ligne n’est jamais le blanc plein');
  assert.match(autres, /sc-tableau__texte--attenue/);
});

await dit('tableau : onglets, recherche, Filtrer et résumé dans la barre d’outils ; recherche locale sans accents', () => {
  const r = tableau({
    onglets: { libelle: 'Vues', actif: 'tout', onChange: noop, onglets: [{ cle: 'tout', libelle: 'Tout', compteur: 3 }, { cle: 'tard', libelle: 'En retard', compteur: 1 }] },
    recherche: { valeur: '', onChange: noop },
    filtrer: { onClick: noop },
    resume: '3 sur 3',
  });
  assert.match(r, /role="tablist"[^>]*aria-label="Vues"/);
  assert.match(r, /role="tabpanel"/);
  assert.match(r, /aria-labelledby="[^"]*-onglet-tout"/);
  assert.match(r, /role="search"/);
  assert.match(r, /aria-label="Rechercher dans le tableau"/);
  assert.match(r, />Filtrer</);
  assert.match(r, /role="status"[^>]*class="sc-tableau__resume"[^>]*>3 sur 3</);
  const trouve = tableau({ recherche: { valeur: 'deuxieme', onChange: noop } });
  assert.match(trouve, /Deuxième/);
  assert.doesNotMatch(trouve, /Premier|Troisième/);
  assert.match(trouve, /aria-rowcount="2"/);
  const externe = tableau({ recherche: { valeur: 'deuxieme', onChange: noop, externe: true } });
  assert.match(externe, /Premier/, 'recherche externe : le tableau ne filtre pas');
  assert.doesNotMatch(tableau(), /role="search"|>Filtrer</, 'sans barre demandée, pas de barre');
});

await dit('tableau : l’état vide dit quoi faire et donne l’action ; le chargement garde la forme des lignes ; zéro résultat', () => {
  const vide = tableau({ lignes: [] });
  assert.match(vide, /class="sc-vide"/);
  assert.match(vide, /Rien ici/);
  assert.match(vide, /Aucune ligne pour l’instant\./);
  assert.match(vide, /<button[\s\S]*?Ajouter une ligne/, 'l’action est là');
  assert.equal(compter(vide, /role="row"/g), 1, 'la tête reste, aucune ligne');
  assert.match(vide, /data-etat="vide"/);
  const charge = tableau({ chargement: true, lignesSquelette: 4 });
  assert.match(charge, /role="status"[^>]*aria-busy="true"[^>]*aria-label="Chargement du tableau"/);
  assert.match(charge, /aria-busy="true"[^>]*class="sc-tableau__grille"|class="sc-tableau__grille"[^>]*aria-busy="true"/);
  assert.equal(compter(charge, /data-squelette=""/g), 4);
  assert.ok(compter(charge, /class="sc-squelette"/g) >= 4 * 3);
  assert.doesNotMatch(charge, /Premier|class="sc-vide"/, 'ni données ni état vide pendant le chargement');
  assert.match(charge, /data-etat="chargement"/);
  const aucun = tableau({ recherche: { valeur: 'zzz', onChange: noop }, aucunResultat: { texte: 'Aucun résultat.', action: h(R.Bouton, { variante: 'secondaire' }, 'Effacer la recherche') } });
  assert.match(aucun, /Aucun résultat\./);
  assert.doesNotMatch(aucun, /Aucune ligne pour l’instant/);
  const groupes = tableau({ groupe: { cle: (l: LigneEssai) => l.etat, libelle: (cle: string, n: number) => `${cle} — ${n}` } });
  assert.equal(compter(groupes, /class="sc-tableau__groupe"/g), 2);
  assert.match(groupes, /aria-colspan="6"/);
});

type TicketEssai = { id: string; titre: string };
const ticketsEssai: Record<string, TicketEssai[]> = { a: [{ id: 't1', titre: 'Premier ticket' }, { id: 't2', titre: 'Second ticket' }], b: [{ id: 't3', titre: 'Troisième ticket' }], c: [] };
const kanban = () =>
  rendre(
    h(R.Kanban, {
      libelle: 'Tableau de suivi',
      colonnes: [
        { cle: 'a', titre: 'À faire', accent: 'jour', limite: 3, tickets: ticketsEssai.a },
        { cle: 'b', titre: 'En cours', accent: 'attention', limite: 1, tickets: ticketsEssai.b },
        { cle: 'c', titre: 'Terminé', accent: 'succes', tickets: ticketsEssai.c },
      ],
      cleTicket: (t: TicketEssai) => t.id,
      titreTicket: (t: TicketEssai) => t.titre,
      onDeplacer: noop,
      onAjouter: noop,
      rendreTicket: (t: TicketEssai) =>
        h(R.Ticket, { cle: t.id, titre: t.titre, urgent: t.id === 't1', tags: h(R.Tag, null, 'Étiquette'), progression: t.id === 't1' ? { fait: 2, total: 5 } : undefined, responsables: ['Alpha Un'], echeance: { texte: 'bientôt', retard: t.id === 't1' }, commentaires: 3, onOuvrir: noop }),
    }),
  );

await dit('kanban : colonnes nommées, compteur « sur N », ticket au clavier (menu Déplacer vers…), glisser natif en plus', () => {
  const r = kanban();
  assert.match(r, /role="group"[^>]*aria-label="Tableau de suivi"/);
  assert.equal(compter(r, /<section[^>]*aria-labelledby=/g), 3);
  assert.equal(compter(r, /<h3[ >]/g), 3, 'une colonne = un titre de niveau 3');
  assert.match(norm(r), /<span class="sc-kanban__compteur"[^>]*>2<span> sur 3<\/span>/);
  assert.match(r, /data-pleine="true"/, 'En cours (1 sur 1) est pleine, et le dit par un attribut et par un mot');
  assert.match(r, /<span class="sr-only"> — Pleine<\/span>/);
  assert.equal(compter(r, /<article/g), 3);
  assert.equal(compter(r, /draggable="true"/g), 3, 'chaque ticket peut être glissé…');
  assert.equal(compter(r, /aria-haspopup="menu"/g), 3, '…et déplacé sans souris');
  assert.match(r, /aria-label="Déplacer « Premier ticket » vers…"/);
  assert.equal(compter(r, /aria-expanded="false"/g), 3);
  assert.match(r, /role="status"[^>]*aria-live="polite"/, 'les déplacements s’annoncent');
  assert.equal(compter(r, /Ajouter ou glisser ici/g), 3, 'la zone pointillée de chaque colonne');
  assert.equal(compter(r, /aria-label="Ajouter dans « [^"]+ »"/g), 3, 'et le « + » de chaque en-tête');
  assert.equal(compter(r, /data-ticket-focus="t\d"/g), 3, 'le titre de chaque ticket est la cible des flèches');
});

await dit('ticket : rayon 12, filet urgent + drapeau avec icône, titre, tags, progression de 4 px « 2/5 », avatar 22 px, échéance, commentaires', () => {
  const r = kanban();
  const t1 = /<article[^>]*data-ticket="t1"[\s\S]*?<\/article>/.exec(r)?.[0] ?? '';
  assert.match(t1, /data-urgent="true"/);
  assert.match(t1, /class="sc-urgent"/);
  assert.match(t1, /<svg[^>]*aria-hidden="true"/);
  assert.match(t1, />Urgent</);
  assert.match(t1, /data-hauteur="4"/);
  assert.match(t1, /role="progressbar"[^>]*aria-label="Avancement : 2 sur 5"[^>]*aria-valuenow="40"/);
  assert.match(t1, />2\/5</);
  assert.match(t1, /--sc-avatar:22px/);
  assert.match(t1, /aria-label="Confié à Alpha Un"/);
  assert.match(t1, /class="sc-tag"/);
  assert.match(t1, /aria-label="3 commentaires"/);
  assert.match(t1, /<span class="sr-only"> — En retard<\/span>/, 'le retard se dit en mots, l’icône change aussi');
  const t2 = /<article[^>]*data-ticket="t2"[\s\S]*?<\/article>/.exec(r)?.[0] ?? '';
  assert.doesNotMatch(t2, /data-urgent|sc-urgent|progressbar/);
  const seul = rendre(h(R.Ticket, { titre: 'Un ticket seul' }));
  assert.doesNotMatch(seul, /draggable|aria-haspopup|tabindex/, 'hors tableau : ni menu ni glisser');
  assert.match(seul, /aria-labelledby=/);
  const colonne = rendre(h(R.ColonneKanban, { titre: 'Libre', nombre: 0 }));
  assert.match(colonne, /Déposer ici/);
  assert.doesNotMatch(colonne, /<button/);
  assert.match(rendre(h(R.ColonneKanban, { titre: 'Libre', nombre: 4, limite: 4, onAjouter: noop })), /4<span> sur 4<\/span>/);
});

type CarteEssai = { titre: string; vers?: string; onClick?: () => void; href?: string };
const cartes = (extra: Record<string, unknown> = {}, ...cartes: CarteEssai[]) =>
  rendre(
    h(R.GrilleCartes, { libelle: 'Modules', ...extra },
      ...(cartes.length ? cartes : [{ titre: 'Un', vers: '/un' }, { titre: 'Deux', onClick: noop }, { titre: 'Trois' }]).map((c, i) =>
        h(R.CarteModule, { key: i, ...c, description: 'Une description assez longue pour tenir sur plusieurs lignes.', icone: h('svg', null), famille: 'jour', progression: { libelle: 'Avancement', valeur: 0.72 }, personnes: ['Alpha Un', 'Beta Deux'], libellePersonnes: 'Responsables : Alpha Un, Beta Deux', etat: { etat: 'succes', libelle: 'En cours' } }),
      ),
    ),
  );

await dit('cartes : liste nommée de 3 colonnes (2 en fenêtre étroite), chaque carte est un lien, un bouton ou un bloc ; titre de niveau 3', () => {
  const r = cartes();
  assert.match(r, /<ul[^>]*role="list"[^>]*aria-label="Modules"/);
  assert.match(r, /--sc-grille-colonnes:3/);
  assert.match(r, /--sc-grille-colonnes-etroit:2/);
  assert.match(cartes({ colonnes: 4 }), /--sc-grille-colonnes:4[^"]*--sc-grille-colonnes-etroit:2/);
  assert.match(cartes({ colonnes: 1 }), /--sc-grille-colonnes:1[^"]*--sc-grille-colonnes-etroit:1/);
  assert.equal(compter(r, /<li>/g), 3);
  assert.equal(compter(r, /<h3[ >]/g), 3);
  assert.match(r, /<h3[^>]*><a[^>]*data-carte-module=""[^>]*href="\/un"/, 'lien du routeur dans le titre');
  assert.match(r, /<h3[^>]*><button[^>]*type="button"[^>]*data-carte-module=""/);
  assert.equal(compter(r, /data-carte-module=""/g), 2, 'la carte sans action n’entre pas dans les flèches');
  assert.equal(compter(r, /data-interactive="true"/g), 2, 'et ne se soulève pas');
  assert.match(cartes({}, { titre: 'Externe', href: 'https://exemple.test/' }), /<a[^>]*href="https:\/\/exemple\.test\/"/);
  assert.match(r, /data-famille="jour"/);
  assert.equal(compter(r, /role="progressbar"/g), 3);
  assert.match(norm(r), /72 %/);
  assert.match(r, /role="img"[^>]*aria-label="Responsables : Alpha Un, Beta Deux"/);
  assert.match(r, /data-etat="succes"[^>]*>En cours</);
  assert.match(r, /class="sc-tronque[^"]*"[^>]*data-lignes="3"|data-lignes="3"[^>]*class="sc-tronque/, 'trois lignes puis une ellipse');
});

await dit('scindé : liste de boutons avec aria-current, point non lu dit en mots, détail avec titre, méta, suggestion Oui / Non, état vide avec action', () => {
  const liste = rendre(
    h(R.ListeScindee, { libelle: 'Messages', recherche: { valeur: '', onChange: noop, libelle: 'Rechercher un message' }, ajouter: { libelle: 'Nouveau message', onClick: noop }, onglets: { libelle: 'Dossiers', actif: 'tous', onChange: noop, onglets: [{ cle: 'tous', libelle: 'Tous' }, { cle: 'non', libelle: 'Non lus' }] } },
      h(R.ElementListe, { titre: 'Premier', apercu: 'Un aperçu', heure: new Date(2031, 0, 3, 9, 5), nonLu: true, actif: true, onSelect: noop }),
      h(R.ElementListe, { titre: 'Second', apercu: 'Un autre aperçu', heure: 'hier', onSelect: noop }),
    ),
  );
  assert.match(liste, /role="search"/);
  assert.match(liste, /aria-label="Nouveau message"/);
  assert.match(liste, /role="tablist"/);
  assert.match(liste, /<ul[^>]*role="list"[^>]*aria-label="Messages"/);
  assert.equal(compter(liste, /aria-current="true"/g), 1, 'un seul élément ouvert');
  assert.equal(compter(liste, /data-element-liste=""/g), 2);
  assert.equal(compter(liste, /data-non-lu="true"/g), 1);
  assert.match(liste, /<span class="sr-only">Non lu<\/span>/);
  assert.match(liste, />09:05</);
  assert.match(liste, />hier</);
  assert.equal(compter(liste, /<button[^>]*type="button"[^>]*data-element-liste/g), 2);
  const vide = rendre(h(R.ListeScindee, { libelle: 'Messages', vide: h(R.Bouton, null, 'Écrire un message') }));
  assert.match(vide, /Écrire un message/);
  assert.doesNotMatch(vide, /<ul/);
  const detail = rendre(
    h(R.DetailScinde, { titre: 'Un objet', meta: [{ icone: h('svg', null), texte: 'Un auteur' }, { icone: h('svg', null), texte: 'Une date' }], actions: h(R.Bouton, { variante: 'secondaire' }, 'Répondre'), suggestion: { titre: 'Une idée', texte: 'Un texte.', onOui: noop, onNon: noop } }, 'Le corps du message.'),
  );
  assert.equal(compter(detail, /<h2[ >]/g), 1);
  assert.match(detail, /<h2[^>]*>Un objet<\/h2>/);
  assert.equal(compter(detail, /<li>/g), 2);
  assert.match(detail, /class="sc-detail__texte"[^>]*>Le corps du message\./);
  assert.match(detail, /data-socle="suggestion"/);
  assert.match(detail, /data-variante="primaire"[^>]*>(?:<span[^>]*>)?(?:<span[^>]*>)?Oui/);
  assert.match(detail, />Non</);
  assert.equal(compter(detail, /data-variante="primaire"/g), 1, 'un seul blanc plein dans le détail : le Oui de la suggestion');
  const sans = rendre(h(R.DetailScinde, { vide: { texte: 'Choisissez un élément.', action: h(R.Bouton, null, 'Tout afficher') } }));
  assert.match(sans, /Choisissez un élément\./);
  assert.match(sans, /Tout afficher/);
  assert.doesNotMatch(sans, /<h2|<article/);
  const ensemble = rendre(h(R.Scinde, { liste: h('div', null, 'L'), detail: h('div', null, 'D') }));
  assert.match(ensemble, /^<div class="sc-scinde sc-zone">/);
});

const evenementsEssai = [
  { id: 'e1', titre: 'Un rendez-vous', debut: au(2, 9), fin: au(2, 10, 30), famille: 'jour', detail: 'Une salle' },
  { id: 'e2', titre: 'Un autre', debut: au(2, 9, 30), fin: au(2, 11), famille: 'argent' },
  { id: 'e3', titre: 'Trop tôt', debut: au(4, 5), fin: au(4, 6) },
];
const semaine = (props: Record<string, unknown> = {}) =>
  rendre(h(R.Semaine, { libelle: 'Semaine', debut: lundi, heureDebut: 8, heureFin: 20, evenements: evenementsEssai, maintenant: au(2, 9, 30), ...props }));

await dit('semaine : jours, heures et événements viennent des props — noms de jours à la langue demandée, aujourd’hui en pastille, ligne maintenant', () => {
  const r = semaine();
  const long = (loc: string, d: Date) => new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  assert.equal(compter(r, /role="group"[^>]*aria-label=/g), 7);
  for (const [i, j] of jours.entries()) assert.ok(r.includes(`aria-label="${long('fr-FR', j)}"`), `colonne ${i}`);
  assert.equal(compter(r, /aria-current="date"/g), 1, 'aujourd’hui, une seule fois');
  assert.match(r, /data-aujourdhui="true"[\s\S]*?sr-only"> — Aujourd’hui</);
  assert.equal(compter(r, /class="sc-semaine__heure"/g), 12, 'une étiquette par heure, de 8 h à 19 h');
  assert.match(r, />08:00</);
  assert.match(r, />19:00</);
  assert.doesNotMatch(r, />20:00</);
  assert.equal(compter(r, /class="sc-semaine__maintenant"/g), 1);
  assert.match(r, /class="sc-semaine__maintenant"[^>]*style="top:69px"/);
  assert.match(r, /style="--sc-semaine-jours:7;--sc-px-heure:46px"/);
  assert.match(r, /class="sc-semaine__grille"[^>]*style="height:552px"/, '12 h × 46 px');
  const en = semaine({ locale: 'en-US' });
  assert.ok(en.includes(`aria-label="${long('en-US', jours[0])}"`), 'la langue vient de la prop');
  assert.doesNotMatch(en, new RegExp(`aria-label="${long('fr-FR', jours[0])}"`));
  assert.ok(en.includes(new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(jours[0])));
  assert.equal(compter(semaine({ nbJours: 5 }), /role="group"[^>]*aria-label=/g), 5);
  assert.equal(compter(semaine({ maintenant: new Date(lundi.getFullYear() + 2, 0, 1) }), /aria-current="date"|sc-semaine__maintenant"/g), 0, 'hors de la semaine : ni pastille ni ligne');
});

await dit('semaine : les blocs sont posés par leurs minutes, côte à côte quand ils se chevauchent ; hors plage compté, pas perdu', () => {
  const r = semaine();
  assert.match(r, /<li[^>]*style="top:46px;height:69px;left:calc\(0% \+ 2px\);width:calc\(50% - 4px\)"/, 'e1 : 9 h → 46 px, 1 h 30 → 69 px, moitié gauche');
  assert.match(r, /<li[^>]*style="top:69px;height:69px;left:calc\(50% \+ 2px\);width:calc\(50% - 4px\)"/, 'e2 : 9 h 30 → 69 px, moitié droite');
  assert.match(r, /data-famille="jour"/);
  assert.match(r, /data-famille="argent"/);
  assert.match(r, /title="Un rendez-vous · 09:00–10:30"/);
  assert.match(r, />09:00–10:30</);
  assert.match(r, />Une salle</);
  assert.doesNotMatch(r, /Trop tôt/);
  assert.match(r, /class="sc-semaine__note"[^>]*>1 événements hors de la plage affichée</);
  assert.doesNotMatch(semaine({ evenements: evenementsEssai.slice(0, 2) }), /sc-semaine__note/);
  const bouton = semaine({ onOuvrirEvenement: noop });
  assert.equal(compter(bouton, /<button[^>]*class="sc-semaine__evenement sc-focus"/g), 2, 'avec une action, un événement est un bouton');
  assert.equal(compter(semaine(), /<button/g), 0, 'sans action, un simple bloc');
});

await dit('ligne de temps : liste ordonnée nommée, heure à la française, pastille décorative, état dit en mots, pas de filet sous le dernier', () => {
  const r = rendre(
    h(R.ChronologieTemps, { libelle: 'Journée' },
      h(R.LigneTemps, { heure: new Date(2031, 0, 3, 9, 5), icone: h('svg', null), famille: 'echanger', titre: 'Un appel', detail: 'Un détail' }),
      h(R.LigneTemps, { heure: 'midi', icone: h('svg', null), etat: 'critique', libelleEtat: 'En retard', titre: 'Un rappel', onOuvrir: noop }),
    ),
  );
  assert.match(r, /^<ol[^>]*aria-label="Journée"/);
  assert.equal(compter(r, /<li[ >]/g), 2);
  assert.match(r, /<time dateTime="[^"]+"[^>]*class="sc-ligne-temps__heure"[^>]*>09:05<\/time>|<time datetime="[^"]+"[^>]*class="sc-ligne-temps__heure"[^>]*>09:05<\/time>/);
  assert.match(r, />midi</);
  assert.match(r, /data-famille="echanger"/);
  assert.match(r, /class="sc-ligne-temps__pastille"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*class="sc-ligne-temps__pastille"/);
  assert.match(r, /<span class="sr-only"> — En retard<\/span>/);
  assert.equal(compter(r, /data-dernier="true"/g), 1);
  assert.match(r, /<li[^>]*data-etat="critique"[^>]*data-dernier="true"/);
  assert.equal(compter(r, /<button/g), 1);
});

await dit('texte coupé : ellipse, nombre de lignes dit en attribut, info-bulle seulement quand il l’est réellement (mesure côté navigateur)', () => {
  const r = rendre(h('div', null, h(R.TexteTronque, null, 'Une seule ligne'), h(R.TexteTronque, { lignes: 3, as: 'p' }, 'Trois lignes')));
  assert.match(r, /<span[^>]*class="sc-tronque"[^>]*>Une seule ligne</);
  assert.match(r, /<p[^>]*data-lignes="3"[^>]*style="--sc-lignes:3"[^>]*class="sc-tronque"/);
  assert.doesNotMatch(r, /title=/, 'rendu statique : rien n’est mesuré, donc rien n’est coupé');
  assert.match(sansCommentaires(lire('src/socle/ui/archetypes/TexteTronque.tsx')), /title=\{tronque \? children : undefined\}/);
});

/* ═════════════════════════  4. L'hygiène des sources  ═════════════════════════ */

const sources = [...fichiers(dossier, /\.(tsx?|css)$/), path.join(racine, 'src/socle/mots/archetypes.ts')];
const sourcesTs = sources.filter((f) => /\.tsx?$/.test(f));
const nom = (f: string) => path.relative(racine, f);

await dit('chaque fichier s’ouvre sur un mode d’emploi (au moins trois lignes de commentaire)', () => {
  for (const f of [...sourcesTs, path.join(dossier, 'archetypes.css')]) {
    if (/index\.ts$/.test(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    const en = /\/\*[\s\S]*?\*\//.exec(src.replace(/^(import[^\n]*\n)+\s*/m, ''))?.[0] ?? '';
    assert.ok(/Mode d'emploi|mode d'emploi/i.test(en) || /archetypes\.css$/.test(f) || /mots\/archetypes\.ts$/.test(f) || /logique\/formats\.ts$/.test(f), `${nom(f)} : pas de mode d’emploi en tête`);
    assert.ok(en.split('\n').length >= 5, `${nom(f)} : commentaire d’en-tête trop court`);
  }
});

await dit('aucun nom, chiffre ni date d’exemple en dur dans les composants, la logique et les mots', () => {
  const noms = /\b(Menna|Dupont|Medina|Roux|Atelier|Mohamed|Riyad|Aaron|Stripe|Cabinet)\b/i;
  const dates = /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|janvier|février|mars|avril|juin|juillet|août|septembre|octobre|novembre|décembre)\b|\b(Lun|Mar|Mer|Jeu|Ven|Sam|Dim)\.|\b20[2-3]\d-\d\d-\d\d\b/i;
  for (const f of sourcesTs) {
    const src = sansCommentaires(fs.readFileSync(f, 'utf8'));
    assert.doesNotMatch(src, noms, `${nom(f)} : un nom d’exemple`);
    assert.doesNotMatch(src, dates, `${nom(f)} : un jour, un mois ou une date écrits en dur`);
    assert.doesNotMatch(src, /new Date\(\s*\d{4}/, `${nom(f)} : une date écrite en dur`);
  }
});

await dit('aucun émoji, aucun point d’exclamation dans les textes, aucune encre « discret » en texte, aucune couleur en dur', () => {
  for (const f of sources) {
    const src = sansCommentaires(fs.readFileSync(f, 'utf8'));
    assert.doesNotMatch(src, /\p{Extended_Pictographic}/u, `${nom(f)} : un émoji`);
    assert.doesNotMatch(src, /trait-discret|trait-tres-discret|#77777c|#5f5f64/i, `${nom(f)} : une encre « discret »`);
    if (/\.tsx?$/.test(f)) {
      assert.doesNotMatch(src, /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])|rgba?\(/, `${nom(f)} : une couleur écrite en dur`);
      assert.doesNotMatch(src, /'[^']*[A-Za-zÀ-ÿ]!(?:\s|')|"[^"]*[A-Za-zÀ-ÿ]!(?:\s|")/, `${nom(f)} : un point d’exclamation dans un texte`);
      assert.doesNotMatch(src, /<img|mascotte|robot|confetti/i, `${nom(f)} : une image ou un personnage`);
    }
  }
});

await dit('les imports restent dans le socle (et src/lib, src/i18n) ; la logique ne dépend de rien', () => {
  const permis = [path.join(racine, 'src/socle'), path.join(racine, 'src/lib'), path.join(racine, 'src/i18n')];
  for (const f of sourcesTs) {
    const src = sansCommentaires(fs.readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g)) {
      const cible = m[1];
      if (!cible.startsWith('.')) {
        assert.ok(/^(react|react-dom|react-router-dom|lucide-react|framer-motion)$/.test(cible), `${nom(f)} importe « ${cible} » : une dépendance hors du socle`);
        continue;
      }
      const resolu = path.resolve(path.dirname(f), cible);
      assert.ok(permis.some((p) => resolu === p || resolu.startsWith(p + path.sep)), `${nom(f)} importe « ${cible} » hors de src/socle, src/lib, src/i18n`);
    }
  }
  const pkg = JSON.parse(lire('package.json')) as { dependencies?: Record<string, string> };
  assert.ok(pkg.dependencies, 'package.json lisible');
});

await dit('édition cliente : aucun fichier hors du socle et de la refonte n’importe les archétypes ; aucun import du socle dans l’édition cliente', () => {
  const fautes: string[] = [];
  for (const f of fichiers(path.join(racine, 'src'), /\.(tsx?|css)$/)) {
    const rel = path.relative(racine, f).replace(/\\/g, '/');
    if (rel.startsWith('src/socle/') || rel.startsWith('src/refonte/') || /\.internal\.(tsx?)$/.test(rel)) continue;
    const src = fs.readFileSync(f, 'utf8');
    if (/(?:from|import)\s+['"][^'"]*socle\/(?:ui\/archetypes|mots\/archetypes)/.test(src) || /archetypes\.css/.test(src)) fautes.push(rel);
  }
  assert.deepEqual(fautes, [], 'un fichier partagé importe les archétypes sans passer par une couture interne');
  const ambiance = lire('src/refonte/accueil/Ambiance.tsx');
  assert.match(ambiance, /socle\/ui\/archetypes\/archetypes\.css/, 'la feuille est chargée par l’ambiance interne, une seule fois');
  assert.equal(compter(ambiance, /archetypes\.css/g), 1);
});

/** Les balises ouvrantes `<nom …>` d'une source TSX, en comptant les accolades (une flèche `=>` ne ferme pas la balise). */
function balisesOuvrantes(src: string, nom: string): string[] {
  const trouvees: string[] = [];
  for (const m of src.matchAll(new RegExp(`<${nom}\\b`, 'g'))) {
    let profondeur = 0;
    let i = m.index ?? 0;
    for (; i < src.length; i += 1) {
      const c = src[i];
      if (c === '{') profondeur += 1;
      else if (c === '}') profondeur -= 1;
      else if (c === '>' && profondeur === 0 && src[i - 1] !== '=') break;
    }
    trouvees.push(src.slice(m.index, i + 1));
  }
  return trouvees;
}

await dit('les composants interactifs portent le focus du socle, une cible ≥ 34 px et un nom accessible', () => {
  const tsx = (f: string) => sansCommentaires(lire(`src/socle/ui/archetypes/${f}.tsx`));
  for (const f of ['Tableau', 'Kanban', 'Cartes', 'Scinde', 'Semaine', 'LigneTemps']) {
    const src = tsx(f);
    for (const b of balisesOuvrantes(src, 'button')) assert.match(b, /sc-focus/, `${f} : un bouton sans l’anneau de focus du socle — ${b.slice(0, 90)}`);
  }
  assert.match(tsx('Kanban'), /aria-label=\{ts\('kanban\.deplacerTicket'/);
  assert.match(tsx('Kanban'), /aria-haspopup="menu"[\s\S]*aria-expanded=\{ouvert\}/);
  assert.match(tsx('Kanban'), /e\.key === 'Escape'/, 'Échap ferme le menu');
  assert.match(tsx('Tableau'), /e\.key === 'Enter'/, 'Entrée ouvre la ligne');
  assert.match(tsx('Tableau'), /deplacerLineaire\(i, plat\.length, e\.key\)/, '↑ ↓ entre les lignes');
  assert.match(tsx('Tableau'), /vide:\s*EtatVideTableau/);
  assert.match(sansCommentaires(lire('src/socle/ui/archetypes/Tableau.tsx')), /action:\s*React\.ReactNode/, 'l’action de l’état vide est obligatoire (pas de « ? »)');
  assert.match(tsx('Cartes'), /deplacerDansGrille\(index, cartes\.length, cols, e\.key/);
  assert.match(tsx('Scinde'), /deplacerLineaire\(i, items\.length, e\.key\)/);
  assert.match(tsx('Semaine'), /Intl\.DateTimeFormat\(locale/);
  assert.match(css, /\.sc-ticket__menu \{[^}]*width: 34px; ?height: 34px|\.sc-ticket__menu \{[^}]*width:\s*34px/);
});

fin();
