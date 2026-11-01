/**
 * Contrôle de la COQUILLE du LOT-00 — barre latérale (Vue d'ensemble, « + N autres », La Garde, Tous les modules, En ligne),
 * choix des modules visibles, vue d'ensemble d'une famille. Sans navigateur.
 *
 *   npm run check:socle-coquille
 */
import { assert, chargerRendu, creerEssais, lire, sansCommentaires } from './lib/essai-socle.ts';

const { dit, fin } = creerEssais('Coquille (LOT-00)');

const K = await chargerRendu<Record<string, any>>( // eslint-disable-line @typescript-eslint/no-explicit-any
  [
    "import { BarreLaterale, lienAutres } from '../src/socle/coquille/BarreLaterale';",
    "import { choisirLesVisibles, MODULES_VISIBLES } from '../src/refonte/coquille/visibles';",
    "import { routeEnsemble, ensembleGenerique, PREFIXE_ENSEMBLE } from '../src/refonte/systeme/ensemble';",
  ].join('\n'),
  ['BarreLaterale', 'lienAutres', 'choisirLesVisibles', 'MODULES_VISIBLES', 'routeEnsemble', 'ensembleGenerique', 'PREFIXE_ENSEMBLE'],
);
const { h, rendre } = K;

const mod = (cle: string, niveau: string, courant = false) => ({ cle, libelle: `Module ${cle}`, vers: `/${cle}`, badge: 0, courant, avance: niveau === 'avance', niveau });
const famille = (cle: string, modules: ReturnType<typeof mod>[], extra: Record<string, unknown> = {}) => ({ cle, nom: `Famille ${cle}`, famille: 'argent', modules, badge: 0, active: false, ...extra });
const props = (familles: unknown[], garde: unknown = null) => ({
  produit: 'Produit', familles, garde, etatGarde: 'calme', nombreModules: 101, routeTousLesModules: '/tous-les-modules',
  enLigne: [{ cle: 'a', nom: 'Camille', lieu: 'Clients' }], presenceMontree: true, raccourciRecherche: '⌘ K', onRecherche: () => undefined, ouvert: false, onFermer: () => undefined,
});

await dit('choisirLesVisibles : au plus 7, les essentiels d’abord, le module courant toujours présent, l’ordre du registre conservé', () => {
  const tous = [mod('a', 'avance'), mod('b', 'courant'), mod('c', 'essentiel'), mod('d', 'courant'), mod('e', 'courant'), mod('f', 'courant'), mod('g', 'courant'), mod('h', 'courant'), mod('i', 'essentiel'), mod('j', 'avance')];
  const v = K.choisirLesVisibles(tous) as ReturnType<typeof mod>[];
  assert.equal(v.length, K.MODULES_VISIBLES);
  assert.ok(v.some((m) => m.cle === 'c') && v.some((m) => m.cle === 'i'), 'les essentiels sont visibles');
  assert.ok(!v.some((m) => m.cle === 'a' || m.cle === 'j'), 'les avancés passent en dernier');
  assert.deepEqual(v.map((m) => m.cle), [...v.map((m) => m.cle)].sort((x, y) => tous.findIndex((m) => m.cle === x) - tous.findIndex((m) => m.cle === y)));
  const avecCourant = K.choisirLesVisibles(tous.map((m) => (m.cle === 'j' ? { ...m, courant: true } : m))) as ReturnType<typeof mod>[];
  assert.equal(avecCourant.length, K.MODULES_VISIBLES);
  assert.ok(avecCourant.some((m) => m.cle === 'j'), 'le module courant reste visible');
  assert.equal((K.choisirLesVisibles(tous.slice(0, 5)) as unknown[]).length, 5);
});

await dit('barre latérale : « Vue d’ensemble » en tête de la famille ouverte, « + N autres » en pied, vers Tous les modules avec la famille', () => {
  const f = famille('argent', [mod('invoices', 'essentiel', true), mod('expenses', 'essentiel')], {
    active: true,
    ensemble: { cle: 'ensemble-argent', libelle: '', vers: '/ensemble/argent', badge: 0, courant: false },
    autres: 3,
  });
  const r = rendre(h(K.BarreLaterale, props([f])));
  assert.match(r, /<a[^>]*href="\/ensemble\/argent"[^>]*>(?:<span>Vue d’ensemble<\/span>)/);
  assert.ok(r.indexOf('Vue d’ensemble') < r.indexOf('Module invoices'), 'la vue d’ensemble est la première ligne');
  assert.match(r, /href="\/tous-les-modules\?famille=argent"/);
  assert.match(r, /\+ 3 autres/);
  assert.match(r, /aria-label="Voir les 3 autres modules de Famille argent"/);
  assert.equal(K.lienAutres('/tous-les-modules', 'a b'), '/tous-les-modules?famille=a%20b');
});

await dit('barre latérale : pas de « + N autres » quand il ne reste rien ; Ma journée n’a pas de vue d’ensemble', () => {
  const f = famille('jour', [mod('home', 'essentiel', true)], { active: true, autres: 0 });
  const r = rendre(h(K.BarreLaterale, props([f])));
  assert.doesNotMatch(r, /autres/);
  assert.doesNotMatch(r, /Vue d’ensemble/);
});

await dit('barre latérale : La Garde à part, bouclier + point d’état, Tous les modules avec le total, En ligne avec le lieu', () => {
  const garde = famille('garde', [mod('salle', 'essentiel')], { famille: 'outils' });
  for (const etat of ['calme', 'attention', 'critique']) {
    const r = rendre(h(K.BarreLaterale, { ...props([famille('jour', [mod('home', 'essentiel')])], garde), etatGarde: etat }));
    assert.match(r, /lucide-shield-check/);
    assert.match(r, new RegExp(`class="sc-famille__etat" data-etat="${etat}"`));
    assert.match(r, /class="sc-liste sc-liste--garde"/);
  }
  const r = rendre(h(K.BarreLaterale, props([famille('jour', [mod('home', 'essentiel')])], garde)));
  assert.match(r, /Tous les modules<\/span><b class="sc-tous__nombre">101<\/b>/);
  assert.match(r, /En ligne/);
  assert.match(r, /sur Clients/);
  assert.match(r, /data-en-ligne="true"/);
  assert.match(r, /aria-keyshortcuts="Control\+K Meta\+K"/);
});

await dit('vue d’ensemble : Ma journée → Accueil, La Garde → sa salle, les autres → la page générique /ensemble/<famille>', () => {
  assert.equal(K.routeEnsemble('jour'), '/');
  assert.equal(K.routeEnsemble('garde'), '/garde');
  assert.equal(K.routeEnsemble('argent'), `${K.PREFIXE_ENSEMBLE}/argent`);
  assert.equal(K.ensembleGenerique('argent'), true);
  assert.equal(K.ensembleGenerique('jour'), false);
});

await dit('les cotes de la maquette : barre 252, logo 28, famille 34, sous-élément 28 à 12,5 px, filet vertical, pied En ligne en capitales', () => {
  const css = sansCommentaires(lire('src/socle/coquille/coquille.css'));
  assert.match(css, /\.sc-marque__logo \{[^}]*width: 28px;[^}]*height: 28px/);
  assert.match(css, /\.sc-famille \{[^}]*min-height: 34px/);
  assert.match(css, /\.sc-module \{[^}]*min-height: 28px[^}]*font-size: 12\.5px/);
  assert.match(css, /\.sc-sous \{[^}]*border-left: 1px solid var\(--socle-filet-vertical\)/);
  assert.match(css, /\.sc-enligne__titre \{[^}]*text-transform: uppercase/);
  assert.match(css, /\.sc-principal \{[^}]*padding: 24px 40px 0/);
  assert.match(css, /\.sc-pied-page \{[^}]*padding: 12px 40px 20px/);
  assert.match(sansCommentaires(lire('src/socle/noir.css')), /--socle-largeur-lateral: 252px/);
  assert.match(sansCommentaires(lire('src/socle/noir.css')), /--socle-hauteur-ajmani: 46px/);
});

await dit('l’état de La Garde ne se dit jamais par la couleur seule', () => {
  const r = rendre(h(K.BarreLaterale, props([famille('jour', [mod('home', 'essentiel')])], famille('garde', [mod('salle', 'essentiel')]))));
  assert.match(r, /<span class="sr-only">Tout est en ordre<\/span>/);
});

fin();
