/**
 * Contrôle du panneau « TOUS LES MODULES » (D02) — la logique pure et les cotes, sans navigateur.
 *
 *   npm run check:systeme-modules
 */
import { assert, charger, creerEssais, lire, sansCommentaires } from './lib/essai-socle.ts';

const { dit, fin } = creerEssais('Tous les modules (D02)');

type Niveau = 'essentiel' | 'courant' | 'avance';
interface Entree { id: string; nom: string; vers: string; niveau: Niveau; badge: number; personnes: string[]; epingle: boolean }
interface Famille { id: string; nom: string; teinte: string; vers: string; entrees: Entree[] }
const L = await charger<{
  composerCartes: (f: Famille[], o: { niveau: string; correspondances: Map<string, { score: number; raison?: string }> | null; deplie: Set<string> }) => {
    id: string; effectif: number; reste: number; videAuNiveau: boolean; totalSansFiltre: number; lignes: { type: string; id: string; libelle?: string; entree: Entree; correspond?: boolean }[];
  }[];
  compterParNiveau: (f: Famille[]) => Record<string, number>;
  ordreDeSelection: (c: ReturnType<typeof L.composerCartes>, m: Map<string, { score: number; raison?: string }> | null) => string[];
  carteDeLaLigne: (c: ReturnType<typeof L.composerCartes>, id: string | undefined) => string | undefined;
  surligner: (l: string, s: string) => [string, string];
  voisin: (i: number, n: number, t: string) => number;
  majuscule: (t: string) => string;
  LIGNES_PAR_CARTE: number;
}>('src/refonte/systeme/modules/logique.ts');

/** Des familles FICTIVES : effectifs et niveaux inventés pour l'essai. */
const niveaux: Niveau[] = ['essentiel', 'courant', 'courant', 'avance'];
const fabrique = (id: string, n: number): Famille => ({
  id,
  nom: `Famille ${id}`,
  teinte: 'jour',
  vers: `/ensemble/${id}`,
  entrees: Array.from({ length: n }, (_, i) => ({ id: `${id}-${i}`, nom: `Module ${id}${i}`, vers: `/${id}/${i}`, niveau: niveaux[i % 4], badge: i % 3, personnes: [], epingle: false })),
});
const familles = [fabrique('a', 12), fabrique('b', 5), fabrique('c', 20)];
const aucune = new Set<string>();

await dit('les effectifs par niveau se calculent depuis les familles : la somme des niveaux égale le total', () => {
  const n = L.compterParNiveau(familles);
  assert.equal(n.tous, 37);
  assert.equal(n.essentiel + n.courant + n.avance, n.tous);
});

await dit('7 lignes par carte et « + N autres » juste (effectif − montrés) ; une petite famille n’a pas de pied', () => {
  const c = L.composerCartes(familles, { niveau: 'tous', correspondances: null, deplie: aucune });
  assert.deepEqual(c.map((x) => x.lignes.length), [7, 5, 7]);
  assert.deepEqual(c.map((x) => x.reste), [5, 0, 13]);
  assert.deepEqual(c.map((x) => x.effectif), [12, 5, 20]);
});

await dit('le mode complet montre toutes les lignes et le pied devient « Réduire » (reste 0)', () => {
  const c = L.composerCartes(familles, { niveau: 'tous', correspondances: null, deplie: new Set(['c']) });
  assert.equal(c[2].lignes.length, 20);
  assert.equal(c[2].reste, 0);
});

await dit('un filtre de niveau réduit les lignes ET les effectifs ; une famille vidée garde sa carte et le dit', () => {
  const c = L.composerCartes([...familles, { ...fabrique('d', 3), entrees: fabrique('d', 3).entrees.filter((e) => e.niveau !== 'avance').map((e) => ({ ...e, niveau: 'courant' as Niveau })) }], { niveau: 'avance', correspondances: null, deplie: aucune });
  assert.equal(c[0].effectif, 3);
  assert.ok(c[0].lignes.every((l) => l.entree.niveau === 'avance'));
  const d = c[3];
  assert.equal(d.videAuNiveau, true);
  assert.equal(d.lignes.length, 0);
  assert.equal(d.totalSansFiltre, 3);
});

await dit('les modules épinglés passent en tête sans recherche ; l’ordre du registre sinon', () => {
  const f = [fabrique('p', 4)];
  f[0].entrees[3].epingle = true;
  const c = L.composerCartes(f, { niveau: 'tous', correspondances: null, deplie: aucune });
  assert.deepEqual(c[0].lignes.map((l) => l.id), ['p-3', 'p-0', 'p-1', 'p-2']);
});

await dit('une recherche : les correspondances remontent, la meilleure née d’un verbe ajoute une ligne d’action, aucune carte ne disparaît', () => {
  const m = new Map([['b-2', { score: 93, raison: 'envoyer une facture' }], ['a-5', { score: 60 }]]);
  const c = L.composerCartes(familles, { niveau: 'tous', correspondances: m, deplie: aucune });
  assert.equal(c.length, 3);
  const b = c.find((x) => x.id === 'b');
  assert.equal(b?.lignes[0].type, 'action');
  assert.equal(b?.lignes[0].libelle, 'Envoyer une facture');
  assert.equal(b?.lignes[1].id, 'b-2');
  const a = c.find((x) => x.id === 'a');
  assert.equal(a?.lignes[0].id, 'a-5');
  assert.ok(a?.lignes[0].correspond);
  // La ligne d’action n’est pas un module : « + N autres » reste juste.
  assert.equal(b?.reste, 0);
  assert.ok((a?.lignes.length ?? 0) <= L.LIGNES_PAR_CARTE);
  const avecAction = L.composerCartes([fabrique('z', 12)], { niveau: 'tous', correspondances: new Map([['z-1', { score: 93, raison: 'ouvrir' }]]), deplie: aucune })[0];
  assert.equal(avecAction.lignes.length, 7);
  assert.equal(avecAction.reste, 12 - 6);
});

await dit('↑ ↓ parcourent les correspondances, la meilleure d’abord ; la carte de la ligne choisie est active', () => {
  const m = new Map([['a-5', { score: 60 }], ['b-2', { score: 93, raison: 'envoyer une facture' }], ['c-1', { score: 60 }]]);
  const c = L.composerCartes(familles, { niveau: 'tous', correspondances: m, deplie: aucune });
  const ordre = L.ordreDeSelection(c, m);
  assert.equal(ordre[0], 'action:b-2');
  assert.deepEqual(ordre.slice(1), ['b-2', 'a-5', 'c-1']);
  assert.equal(L.carteDeLaLigne(c, 'action:b-2'), 'b');
  assert.equal(L.carteDeLaLigne(c, undefined), undefined);
  assert.deepEqual(L.ordreDeSelection(c, null), []);
});

await dit('surligner : le début saisi en gras, insensible aux accents et à la casse ; sinon tout reste courant', () => {
  assert.deepEqual(L.surligner('Envoyer une facture', 'envoyer une fac'), ['Envoyer une fac', 'ture']);
  assert.deepEqual(L.surligner('Réunions', 'reu'), ['Réu', 'nions']);
  assert.deepEqual(L.surligner('Calendrier', 'xyz'), ['', 'Calendrier']);
  assert.deepEqual(L.surligner('Tâches', ''), ['', 'Tâches']);
  assert.deepEqual(L.surligner('Tâches', 'tâches et plus'), ['', 'Tâches']);
});

await dit('flèches de la grille : bornées, Début et Fin', () => {
  assert.equal(L.voisin(0, 5, 'ArrowUp'), 0);
  assert.equal(L.voisin(4, 5, 'ArrowDown'), 4);
  assert.equal(L.voisin(2, 5, 'ArrowDown'), 3);
  assert.equal(L.voisin(2, 5, 'Home'), 0);
  assert.equal(L.voisin(2, 5, 'End'), 4);
  assert.equal(L.voisin(0, 0, 'ArrowDown'), -1);
});

await dit('cotes du panneau lues dans modules.css : 1240 × 788, rayon 24, padding 29, champ 400, ligne 28, pied de carte, grille à 4 colonnes et 14 d’écart', () => {
  const css = sansCommentaires(lire('src/refonte/systeme/modules/modules.css'));
  assert.match(css, /\.dm-panneau \{[^}]*width: min\(1240px, 100%\)[^}]*height: min\(788px, 100%\)[^}]*padding: 29px[^}]*border-radius: 24px/);
  assert.match(css, /\.dm-voile \{[^}]*padding: 56px 100px[^}]*position: fixed[^}]*z-index: 50|\.dm-voile \{[^}]*z-index: 50/s);
  assert.match(css, /\.dm-recherche \{ width: 400px/);
  assert.match(css, /\.dm-echap \{[^}]*width: 61px[^}]*height: 30px/);
  assert.match(css, /\.dm-ligne \{[^}]*height: 28px/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)[^}]*grid-auto-rows: minmax\(301px, 1fr\)[^}]*gap: 14px/);
  assert.match(css, /\.dm-carte__entete \{[^}]*height: 52px[^}]*padding: 0 19px/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});

await dit('aucune couleur hex en dur, aucune encre « discret » en texte, aucun chiffre du registre écrit à la main', () => {
  const css = sansCommentaires(lire('src/refonte/systeme/modules/modules.css'));
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(css, /color:\s*var\(--socle-trait/);
  for (const f of ['logique.ts', 'PanneauTousLesModules.tsx', 'i18n.ts']) {
    const src = sansCommentaires(lire(`src/refonte/systeme/modules/${f}`));
    assert.doesNotMatch(src, /\b(101|16|62|23)\b(?!px|\))/, `${f} : un effectif du registre est écrit à la main`);
  }
});

await dit('le panneau est un calque : fixed, z-index ≥ 50, rôle dialog modal, Échap par la pile, focus rendu, aucun nom d’exemple', () => {
  const src = sansCommentaires(lire('src/refonte/systeme/modules/PanneauTousLesModules.tsx'));
  assert.match(src, /role="dialog"/);
  assert.match(src, /aria-modal="true"/);
  assert.match(src, /useFermetureEchap\(true, fermer\)/);
  assert.match(src, /createPortal\(/);
  assert.match(src, /retour\.current\.focus\(\)/);
  assert.match(src, /useSearchParams/);
  assert.doesNotMatch(src, /Envoyer une fac|Facturation|Menna|Rondes/);
});

await dit('la couture de navigation interne monte ce panneau ; le jumeau cliente n’en sait rien', () => {
  assert.match(lire('src/edition/navigation.internal.tsx'), /PanneauTousLesModules as TousLesModules/);
  assert.doesNotMatch(lire('src/edition/navigation.business.tsx'), /systeme|Panneau/);
});

fin();
