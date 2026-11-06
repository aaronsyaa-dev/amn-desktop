/**
 * Contrôle de la COQUILLE v3 du LOT-00 (01-SOCLE-DESIGN §0.1 et §0.4) — barre latérale (sections ESPACE,
 * SURVEILLANCE, ÉPINGLÉS ; Cyber toujours là ; sous-liste de cinq lignes au plus avec le module courant et son
 * repère ; « + N autres » ; carte « Aujourd'hui »), fil d'Ariane « Famille / Page » sans libellé tiré de
 * l'adresse, présence sans route brute, ⌘K et ⌘J d'un bloc, barre Ajmani v3, chiffres tabulaires sur les nombres
 * seulement. Sans navigateur.
 *
 *   npm run check:socle-coquille
 */
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { assert, charger, chargerRendu, creerEssais, lire, racine, sansCommentaires } from './lib/essai-socle.ts';

const { dit, fin } = creerEssais('Coquille v3 (LOT-00)');

const K = await chargerRendu<Record<string, any>>( // eslint-disable-line @typescript-eslint/no-explicit-any
  [
    "import { BarreLaterale, lienAutres, ICONES_FAMILLE, EPINGLES_MONTRES, COLLEGUES_MONTRES } from '../src/socle/coquille/BarreLaterale';",
    "import { EnTete } from '../src/socle/coquille/EnTete';",
    "import { BarreAjmani } from '../src/socle/coquille/BarreAjmani';",
    "import { choisirLesVisibles, placesDeModules, MODULES_VISIBLES, choisirEpingles, EPINGLES_BARRE } from '../src/refonte/coquille/visibles';",
    "import { construireFil } from '../src/refonte/coquille/fil';",
    "import { pageSysteme, motsPagesSysteme, libellePageSysteme } from '../src/refonte/coquille/pagesSysteme';",
    "import { libelleDuLieu } from '../src/refonte/coquille/lieu';",
    "import { raccourciAffiche } from '../src/refonte/coquille/touche';",
    "import { delaiAvant, calculerAujourdhui } from '../src/refonte/coquille/aujourdhui';",
    "import { routeEnsemble, ensembleGenerique, PREFIXE_ENSEMBLE } from '../src/refonte/systeme/ensemble';",
  ].join('\n'),
  [
    'BarreLaterale', 'lienAutres', 'ICONES_FAMILLE', 'EPINGLES_MONTRES', 'COLLEGUES_MONTRES', 'EnTete', 'BarreAjmani',
    'choisirLesVisibles', 'placesDeModules', 'MODULES_VISIBLES', 'choisirEpingles', 'EPINGLES_BARRE', 'construireFil',
    'pageSysteme', 'motsPagesSysteme', 'libellePageSysteme', 'libelleDuLieu', 'raccourciAffiche', 'delaiAvant', 'calculerAujourdhui',
    'routeEnsemble', 'ensembleGenerique', 'PREFIXE_ENSEMBLE',
  ],
);
const { h, rendre } = K;

const mod = (cle: string, niveau: string, courant = false) => ({ cle, libelle: `Module ${cle}`, vers: `/${cle}`, badge: 0, courant, avance: niveau === 'avance', niveau });
const famille = (cle: string, modules: ReturnType<typeof mod>[], extra: Record<string, unknown> = {}) => ({ cle, nom: `Famille ${cle}`, famille: 'argent', modules, badge: 0, active: false, ...extra });
const CYBER = { cle: 'cyber', nom: 'Cyber', famille: 'outils', modules: [], badge: 0, active: false, vers: '/cyber', compteur: 5, compteurAide: '5 alertes ouvertes' };
const JOUR = { faites: 5, total: 8, serie: 6, rendezVous: { titre: 'Rendez-vous Exemple', heure: '11:00', dans: 'dans 18 min' }, collegues: [{ cle: 'b', nom: 'Camille', lieu: 'Facturation' }, { cle: 'c', nom: 'Dominique', lieu: 'Clients' }, { cle: 'd', nom: 'Sacha', lieu: 'Notes' }], presenceMontree: true, vers: '/' };
const EPINGLES = [
  { cle: 'invoices', libelle: 'Facturation', vers: '/facturation', badge: 2, courant: false, famille: 'argent' },
  { cle: 'clients', libelle: 'Clients', vers: '/clients', badge: 0, courant: false, famille: 'contacts' },
  { cle: 'notes', libelle: 'Notes', vers: '/notes', badge: 0, courant: true, famille: 'ecrire' },
  { cle: 'tasks', libelle: 'Tâches', vers: '/tasks', badge: 1, courant: false, famille: 'jour' },
  { cle: 'agenda', libelle: 'Calendrier', vers: '/agenda', badge: 0, courant: false, famille: 'jour' },
];
const props = (familles: unknown[], garde: unknown = null, plus: Record<string, unknown> = {}) => ({
  produit: 'Produit', familles, garde, cyber: CYBER, epingles: EPINGLES, etatGarde: 'calme', nombreModules: 101, routeTousLesModules: '/tous-les-modules',
  aujourdhui: JOUR, raccourciRecherche: '⌘K', onRecherche: () => undefined, onReplier: () => undefined, ouvert: false, onFermer: () => undefined, ...plus,
});
const sousListe = (html: string, cle: string) => /<ul id="sc-sous-[^"]+" class="sc-sous">([\s\S]*?)<\/ul>/.exec(html.slice(html.indexOf(`data-cle="${cle}"`)))?.[1] ?? '';

await dit('choisirLesVisibles : au plus 5 lignes (4 quand la famille a sa « Vue d’ensemble »), les essentiels d’abord, le module courant toujours présent, l’ordre du registre conservé', () => {
  assert.equal(K.MODULES_VISIBLES, 5);
  assert.equal(K.placesDeModules(false), 5);
  assert.equal(K.placesDeModules(true), 4);
  const tous = [mod('a', 'avance'), mod('b', 'courant'), mod('c', 'essentiel'), mod('d', 'courant'), mod('e', 'courant'), mod('f', 'courant'), mod('g', 'courant'), mod('h', 'courant'), mod('i', 'essentiel'), mod('j', 'avance')];
  const v = K.choisirLesVisibles(tous) as ReturnType<typeof mod>[];
  assert.equal(v.length, 5);
  assert.ok(v.some((m) => m.cle === 'c') && v.some((m) => m.cle === 'i'), 'les essentiels sont visibles');
  assert.ok(!v.some((m) => m.cle === 'a' || m.cle === 'j'), 'les avancés passent en dernier');
  assert.deepEqual(v.map((m) => m.cle), [...v.map((m) => m.cle)].sort((x, y) => tous.findIndex((m) => m.cle === x) - tous.findIndex((m) => m.cle === y)));
  for (const places of [4, 5]) {
    const avecCourant = K.choisirLesVisibles(tous.map((m) => (m.cle === 'j' ? { ...m, courant: true } : m)), places) as ReturnType<typeof mod>[];
    assert.equal(avecCourant.length, places);
    assert.ok(avecCourant.some((m) => m.cle === 'j'), 'le module courant reste visible');
  }
  assert.equal((K.choisirLesVisibles(tous.slice(0, 3)) as unknown[]).length, 3);
});

await dit('barre latérale : trois sections nommées, dans l’ordre — ESPACE (les familles), SURVEILLANCE (La Garde, Cyber), ÉPINGLÉS', () => {
  const garde = famille('garde', [mod('salle', 'essentiel')], { nom: 'La Garde', famille: 'outils' });
  const r = rendre(h(K.BarreLaterale, props([famille('jour', [mod('home', 'essentiel', true)], { active: true }), famille('argent', [mod('invoices', 'essentiel')])], garde)));
  const titres = [...r.matchAll(/<h2 id="sc-section-(\w+)" class="sc-section__titre">([^<]+)<\/h2>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(titres, [['espace', 'Espace'], ['surveillance', 'Surveillance'], ['epingles', 'Épinglés']]);
  assert.match(sansCommentaires(lire('src/socle/coquille/coquille.css')), /\.sc-section__titre \{[^}]*height: 20px;[^}]*font-size: 10\.5px;[^}]*letter-spacing: 0\.09em;[^}]*text-transform: uppercase/);
  const surveillance = r.slice(r.indexOf('data-section="surveillance"'), r.indexOf('data-section="epingles"'));
  assert.ok(surveillance.indexOf('La Garde') < surveillance.indexOf('Cyber'), 'La Garde, puis Cyber');
  const espace = r.slice(r.indexOf('data-section="espace"'), r.indexOf('data-section="surveillance"'));
  assert.doesNotMatch(espace, /La Garde|Cyber/);
  assert.equal((r.match(/<nav/g) ?? []).length, 1, 'une seule navigation');
});

await dit('Cyber est toujours là : sans La Garde, sans compteur, hors de ses écrans — un lien vers ses écrans, son compteur d’alertes dans une pastille quand il y en a', () => {
  const sans = rendre(h(K.BarreLaterale, props([famille('jour', [mod('home', 'essentiel')])], null, { cyber: { ...CYBER, compteur: null }, epingles: [], aujourdhui: null })));
  assert.match(sans, /data-cle="cyber"><a data-active="false" class="sc-famille sc-focus" href="\/cyber"/);
  assert.match(sans, /data-section="surveillance"/);
  assert.doesNotMatch(sans, /sc-compteur|sc-count-badge/, 'pas de compteur inventé');
  assert.doesNotMatch(sans, /data-section="epingles"/, 'sans épinglé, pas de section vide');
  const avec = rendre(h(K.BarreLaterale, props([famille('jour', [mod('home', 'essentiel')])])));
  // Le `CountBadge` du socle, variante `laterale` (21 px de large au moins, 11,5 / 500, fond `--socle-lateral-compteur`).
  assert.match(avec, /data-cle="cyber">[\s\S]*?<span class="sc-count-badge" data-variante="laterale" title="5 alertes ouvertes">5<span class="sr-only"> 5 alertes ouvertes<\/span><\/span>/);
  assert.match(avec, /lucide-target/);
  assert.match(rendre(h(K.BarreLaterale, props([], null, { cyber: { ...CYBER, compteur: 0 } }))), /data-cle="cyber"(?![\s\S]*data-variante="laterale")/);
});

await dit('familles : 32 px, une icône de trait lucide de 15 px en T3 par famille, plus aucune pastille de couleur ni compteur ; la teinte seulement sur l’icône de la famille active', () => {
  const r = rendre(h(K.BarreLaterale, props([famille('jour', [mod('home', 'essentiel', true)], { active: true, badge: 4, famille: 'jour' }), famille('argent', [mod('invoices', 'essentiel')], { badge: 2 })])));
  for (const cle of ['jour', 'contacts', 'ecrire', 'argent', 'echanger', 'creer', 'outils', 'garde', 'cyber']) assert.ok(K.ICONES_FAMILLE[cle], `icône de ${cle}`);
  assert.match(r, /data-cle="jour"><button[^>]*class="sc-famille sc-focus"><svg[^>]*lucide-sun[^>]*sc-famille__icone/);
  assert.match(r, /data-cle="argent"><button[^>]*><svg[^>]*lucide-euro/);
  assert.match(r, /width="15" height="15"/);
  assert.doesNotMatch(r, /sc-point/, 'plus de pastille de couleur');
  const espace = r.slice(r.indexOf('data-section="espace"'), r.indexOf('data-section="surveillance"'));
  assert.doesNotMatch(espace, /sc-compteur|sc-count-badge/, 'aucun compteur sur une famille ni dans la sous-liste');
  const css = sansCommentaires(lire('src/socle/coquille/coquille.css'));
  assert.match(css, /\.sc-famille \{[^}]*height: 32px;[^}]*padding: 0 10px;[^}]*color: var\(--socle-texte-courant\);[^}]*font-size: 13px;/);
  assert.match(css, /\.sc-famille__icone \{[^}]*color: var\(--socle-texte-2\)/, 'icône en T3');
  assert.match(css, /\.sc-famille\[data-active='true'\] \{[^}]*background: var\(--socle-lateral-famille-active\);[^}]*color: var\(--socle-texte-1\);[^}]*font-weight: 600;/);
  assert.match(css, /\[data-famille='jour'\] > \.sc-famille\[data-active='true'\] \.sc-famille__icone \{ color: var\(--socle-fam-jour\); \}/);
  assert.match(r, /data-cle="jour">[\s\S]*?lucide-chevron-down/, 'la famille ouverte a son chevron');
});

await dit('sous-liste : « Vue d’ensemble » d’abord (sauf Ma journée), au plus cinq lignes, le module actif visible et marqué, puis « + N autres » vers Tous les modules', () => {
  const f = famille('argent', [mod('invoices', 'essentiel', true), mod('expenses', 'essentiel'), mod('quotes', 'courant'), mod('bank', 'courant')], {
    active: true,
    ensemble: { cle: 'ensemble-argent', libelle: '', vers: '/ensemble/argent', badge: 0, courant: false },
    autres: 3,
  });
  const r = rendre(h(K.BarreLaterale, props([f])));
  const sous = sousListe(r, 'argent');
  assert.match(sous, /^<li><a[^>]*href="\/ensemble\/argent"[^>]*><span class="sc-module__nom">Vue d’ensemble<\/span>/);
  const lignes = (sous.match(/class="sc-module sc-focus"/g) ?? []).length;
  assert.ok(lignes <= 5, `${lignes} lignes`);
  assert.equal((sous.match(/aria-current="page"/g) ?? []).length, 1);
  assert.match(sous, /aria-current="page"[^>]*><span class="sc-module__nom">Module invoices/);
  assert.match(sous, /href="\/tous-les-modules\?famille=argent"/);
  assert.match(sous, /lucide-plus[\s\S]*?<span>3 autres<\/span>/);
  assert.match(sous, /aria-label="Voir les 3 autres modules de Famille argent"/);
  assert.equal(K.lienAutres('/tous-les-modules', 'a b'), '/tous-les-modules?famille=a%20b');
  const jour = rendre(h(K.BarreLaterale, props([famille('jour', [mod('home', 'essentiel', true)], { active: true, autres: 0 })])));
  assert.doesNotMatch(sousListe(jour, 'jour'), /autres|Vue d’ensemble/);
  const css = sansCommentaires(lire('src/socle/coquille/coquille.css'));
  assert.match(css, /\.sc-module \{[^}]*height: 27px;[^}]*color: var\(--socle-texte-2\);[^}]*font-size: 12\.5px;/);
  assert.match(css, /\.sc-sous \{[^}]*border-left: 1px solid var\(--socle-lateral-sous-filet\)/);
  assert.match(css, /\.sc-module\[aria-current='page'\] \{[^}]*background: var\(--socle-lateral-sous-actif\);[^}]*color: var\(--socle-texte-1\);[^}]*font-weight: 500;/);
  assert.match(css, /\.sc-module--autres \{[^}]*color: var\(--socle-texte-3\)/);
});

await dit('le repère actif : une barre blanche de 2 × 13 px posée sur le filet, en face du module courant', () => {
  const css = sansCommentaires(lire('src/socle/coquille/coquille.css'));
  const bloc = /\.sc-module\[aria-current='page'\]::before \{([^}]*)\}/.exec(css)?.[1] ?? '';
  for (const re of [/position: absolute/, /left: -13px/, /width: 2px/, /height: 13px/, /background: var\(--socle-texte-1\)/]) assert.match(bloc, re);
  // Le filet est à 12 px de padding + 1 px de bord à gauche de la ligne : -13 px le pose dessus.
  assert.match(css, /\.sc-sous \{[^}]*padding-left: 12px;/);
});

await dit('épinglés : trois au plus, sans le module ouvert, une entrée une fois, dans l’ordre de la personne ; l’icône de leur famille, leur compteur', () => {
  assert.equal(K.EPINGLES_BARRE, 3);
  assert.equal(K.EPINGLES_MONTRES, 3);
  const entrees: Record<string, unknown> = {
    tasks: { cle: 'taches', libelle: 'Tâches', vers: '/tasks', badge: 0, courant: false },
    priorities: { cle: 'taches', libelle: 'Tâches', vers: '/tasks', badge: 0, courant: false },
    home: { cle: 'accueil', libelle: 'Accueil', vers: '/', badge: 0, courant: true },
    clients: { cle: 'clients', libelle: 'Clients', vers: '/clients', badge: 0, courant: false },
    agenda: { cle: 'agenda', libelle: 'Calendrier', vers: '/agenda', badge: 0, courant: false },
    invoices: { cle: 'invoices', libelle: 'Facturation', vers: '/facturation', badge: 2, courant: false },
  };
  const choisis = K.choisirEpingles(['home', 'tasks', 'priorities', 'inconnu', 'clients', 'agenda', 'invoices'], (c: string) => entrees[c]) as { cle: string }[];
  assert.deepEqual(choisis.map((m) => m.cle), ['taches', 'clients', 'agenda']);
  const r = rendre(h(K.BarreLaterale, props([famille('jour', [mod('home', 'essentiel')])])));
  const epingles = r.slice(r.indexOf('data-section="epingles"'), r.indexOf('sc-aujourdhui'));
  assert.equal((epingles.match(/class="sc-epingle sc-focus"/g) ?? []).length, 3);
  assert.doesNotMatch(epingles, /Notes/, 'pas le module ouvert');
  assert.match(epingles, /lucide-euro[\s\S]*?Facturation[\s\S]*?>2<span class="sr-only"> 2 à voir/);
});

await dit('carte « Aujourd’hui » : anneau vert de 34 px, « 5 sur 8 faites · série 6 j », prochain rendez-vous (voyant bleu), deux collègues et le libellé de leur module — jamais une adresse', () => {
  const r = rendre(h(K.BarreLaterale, props([famille('jour', [mod('home', 'essentiel')])])));
  const carte = r.slice(r.indexOf('<section aria-labelledby="sc-aujourdhui"'));
  assert.match(carte, /role="progressbar" aria-label="Aujourd’hui"[^>]*aria-valuenow="63"[^>]*aria-valuetext="5 sur 8 faites"[^>]*style="width:34px;height:34px/);
  assert.match(carte, /stroke-width="4"/);
  assert.match(carte, />Aujourd’hui<\/span><span class="sc-aujourdhui__detail">5 sur 8 faites · série 6 j<\/span>/);
  assert.match(carte, /data-socle="voyant" data-ton="info"[\s\S]*?data-mvt="onde"[\s\S]*?Rendez-vous Exemple[\s\S]*?11:00 · dans 18 min/);
  assert.equal((carte.match(/class="sc-avatar"/g) ?? []).length, K.COLLEGUES_MONTRES, 'deux collègues au plus');
  assert.match(carte, /Camille, sur Facturation[\s\S]*?class="sc-aujourdhui__lieu">Facturation</);
  assert.doesNotMatch(carte, /En ligne<\/h2>|sc-enligne/, 'l’ancien bloc « En ligne » est parti');
  const inconnu = rendre(h(K.BarreLaterale, props([], null, { aujourdhui: { ...JOUR, collegues: [{ cle: 'b', nom: 'Camille', lieu: null }] } })));
  const c2 = inconnu.slice(inconnu.indexOf('<section aria-labelledby="sc-aujourdhui"'));
  assert.doesNotMatch(c2, /sc-aujourdhui__lieu|sur \//, 'lieu inconnu : rien, pas de route');
  assert.doesNotMatch(c2.replace(/href="[^"]*"/g, ''), />[^<]*\/[a-z][^<]*</, 'aucune adresse écrite dans la carte');
  const vide = rendre(h(K.BarreLaterale, props([], null, { aujourdhui: { ...JOUR, total: 0, faites: 0, serie: 0, rendezVous: null, collegues: [] } })));
  assert.match(vide, /Rien à cocher aujourd’hui/);
  assert.match(vide, /Plus de rendez-vous aujourd’hui/);
  assert.match(vide, /Personne d’autre en ligne/);
  const css = sansCommentaires(lire('src/socle/coquille/coquille.css'));
  assert.match(css, /\.sc-aujourdhui \{[^}]*margin-top: auto;[^}]*border: 1px solid var\(--socle-lateral-bord-carte\);[^}]*border-radius: 12px;[^}]*background: linear-gradient\(180deg, var\(--socle-lateral-carte-haut\), var\(--socle-lateral-carte-bas\)\)/);
  assert.match(css, /\.sc-aujourdhui__titre \{[^}]*font-size: 13px;[^}]*font-weight: 600;/);
  assert.match(css, /\.sc-aujourdhui__detail \{[^}]*color: var\(--socle-texte-3\);[^}]*font-size: 11\.5px;/);
  assert.match(css, /\.sc-aujourdhui__presence \.sc-avatar\[data-en-ligne='true'\]::after \{[^}]*width: 6px;[^}]*height: 6px;/);
});

await dit('où est un collègue : le libellé du module (catalogue) ou de la page système, sinon rien — jamais la route', () => {
  const catalogue = [
    { key: 'invoices', label: 'Facturation', to: '/facturation', icon: null },
    { key: 'home', label: 'Accueil', to: '/', icon: null },
  ];
  const sys = (c: string) => K.libellePageSysteme(c, 'fr');
  assert.equal(K.libelleDuLieu('/facturation/F-12', catalogue, sys), 'Facturation');
  assert.equal(K.libelleDuLieu('/notifications', catalogue, sys), 'Notifications');
  assert.equal(K.libelleDuLieu('/demarrage/metier', catalogue, sys), 'Votre métier');
  assert.equal(K.libelleDuLieu('/outils/mon-reglage', catalogue, sys), null);
  assert.equal(K.libelleDuLieu('/tous-les-modules', catalogue, sys), 'Tous les modules');
  const glue = sansCommentaires(lire('src/refonte/coquille/aujourdhui/useAujourdhui.ts'));
  assert.match(glue, /libelleDuLieu\(r\.module, catalogue/, '« Aujourd’hui » dit le lieu avec la même règle, pour la barre et l’Accueil');
  assert.doesNotMatch(glue, /return item \? libelleNav\(item\) : m;/, 'plus de route brute');
  const accueil = sansCommentaires(lire('src/refonte/accueil/useAccueil.ts'));
  assert.doesNotMatch(accueil, /libelleDuLieu\(|useRegards\(/, 'l’Accueil ne recalcule pas la présence : il la lit dans useAujourdhui');
});

await dit('fil d’Ariane : « Famille / Page », libellés du registre ou de la page, jamais un segment de l’adresse ; les pages système le donnent explicitement', () => {
  const mots = K.motsPagesSysteme('fr');
  const fil = (chemin: string) => {
    const p = K.pageSysteme(chemin, mots);
    return K.construireFil({ page: p && { famille: p.famille === 'jour' ? 'Ma journée' : null, miettes: p.miettes }, espace: 'Espace' }).map((m: { libelle: string }) => m.libelle).join(' / ');
  };
  assert.equal(fil('/notifications'), 'Ma journée / Notifications');
  assert.equal(fil('/demarrage'), 'Ma journée / Démarrage');
  assert.equal(fil('/demarrage/metier'), 'Ma journée / Démarrage / Votre métier');
  assert.equal(fil('/tous-les-modules'), 'Espace / Tous les modules');
  assert.equal(K.pageSysteme('/demarrage/metier', mots).miettes[0].vers, '/demarrage', 'Démarrage est un lien');
  for (const p of ['/notifications', '/demarrage', '/demarrage/metier']) {
    const page = K.pageSysteme(p, mots);
    assert.equal(page.famille, 'jour');
    assert.equal(page.sousPage, 'home', 'Accueil allumé, comme sur H40, H42, H47');
  }
  assert.equal(K.pageSysteme('/tous-les-modules', mots).famille, null, 'aucune famille dépliée (D02)');
  assert.equal(K.pageSysteme('/tous-les-modules', mots).tousLesModules, true);
  assert.equal(K.pageSysteme('/facturation', mots), null);
  assert.deepEqual(K.construireFil({ famille: 'L’argent', module: 'Facturation', espace: 'Espace' }), [{ libelle: 'L’argent' }, { libelle: 'Facturation' }]);
  assert.deepEqual(K.construireFil({ espace: 'Espace' }), [{ libelle: 'Espace' }], 'une page inconnue : « Espace », jamais « Mon reglage »');
  assert.deepEqual(K.construireFil({ module: 'Équipe', espace: 'Espace' }), [{ libelle: 'Espace' }, { libelle: 'Équipe' }]);
  assert.deepEqual(K.construireFil({ page: { famille: null, miettes: [{ libelle: ' ' }] }, espace: 'Espace' }), [{ libelle: 'Espace' }]);
  const src = sansCommentaires(lire('src/refonte/coquille/fil.ts'));
  assert.doesNotMatch(src, /pathname|split\(|decodeURIComponent|replace\(/, 'le fil ne lit pas l’adresse');
  const donnees = sansCommentaires(lire('src/refonte/coquille/donnees.ts'));
  assert.match(donnees, /pageDeclaree \?\? pageSysteme\(pathname/, 'la page déclarée l’emporte sur la table');
  assert.match(sansCommentaires(lire('src/refonte/coquille/page.ts')), /export function usePageCoquille/);
});

await dit('⌘K et ⌘J s’écrivent d’un bloc (« Ctrl K » ailleurs) ; la coquille branchée n’écrit plus « ⌘ K »', () => {
  assert.equal(K.raccourciAffiche('⌘', 'K'), '⌘K');
  assert.equal(K.raccourciAffiche('⌘', 'J'), '⌘J');
  assert.equal(K.raccourciAffiche('Ctrl', 'K'), 'Ctrl K');
  const glue = sansCommentaires(lire('src/refonte/coquille/CoquilleRefonte.tsx'));
  assert.match(glue, /raccourciRecherche=\{raccourciAffiche\(modKey, 'K'\)\}/);
  assert.match(glue, /raccourci=\{raccourciAffiche\(modKey, 'J'\)\}/);
  assert.doesNotMatch(glue, /\$\{modKey\} [KJ]/);
  const r = rendre(h(K.BarreLaterale, props([])));
  assert.match(r, /<kbd class="sc-kbd">⌘K<\/kbd>/);
  assert.match(rendre(h(K.BarreAjmani, { onOuvrir: () => undefined, raccourci: '⌘J' })), /<kbd class="sc-kbd">⌘J<\/kbd>/);
});

await dit('le haut : logo 28 px, « Espace de l’équipe », le bouton « replier la barre » (icône panneau 15 px, T4), la recherche 34 px et le bouton carré « Tous les modules (101) »', () => {
  const r = rendre(h(K.BarreLaterale, props([])));
  assert.match(r, /<button type="button" aria-label="Replier la barre" title="Replier la barre" class="sc-replier sc-focus"><svg[^>]*lucide-panel-left/);
  assert.match(r, /<a[^>]*aria-label="Tous les modules \(101\)"[^>]*class="sc-tous sc-focus" href="\/tous-les-modules"[^>]*><svg[^>]*lucide-layout-grid/);
  assert.match(rendre(h(K.BarreLaterale, props([], null, { tousLesModulesActif: true }))), /aria-current="page" class="sc-tous sc-focus"/);
  const css = sansCommentaires(lire('src/socle/coquille/coquille.css'));
  assert.match(css, /\.sc-marque__logo \{[^}]*width: 28px;[^}]*height: 28px/);
  assert.match(css, /\.sc-replier \{[^}]*color: var\(--socle-texte-3\)/);
  assert.match(css, /\.sc-recherche \{[^}]*height: 34px;/);
  assert.match(css, /\.sc-tous \{[^}]*width: 34px;[^}]*height: 34px;/);
  assert.match(css, /\.sc-tous\[aria-current='page'\] \{[^}]*border-color: var\(--socle-lateral-bord-actif\);[^}]*background: var\(--socle-lateral-bouton-actif\)/);
  assert.match(css, /\.sc-coquille\[data-repliee='true'\] \.sc-lateral \{ display: none; \}/, 'replier masque la barre');
  assert.match(css, /\.sc-coquille\[data-repliee='true'\] \.sc-menu \{ display: inline-flex; \}/, 'et l’en-tête la redéplie');
});

await dit('les cotes v3 : barre 252, dégradé, filet #1f1f21, padding 16/14/14, survol #18181a en 150 ms ; en-tête 60 ; barre Ajmani 46, rayon 14', () => {
  const css = sansCommentaires(lire('src/socle/coquille/coquille.css'));
  const noir = sansCommentaires(lire('src/socle/noir.css'));
  assert.match(css, /\.sc-lateral \{[^}]*padding: 16px 14px 14px;[^}]*border-right: 1px solid var\(--socle-lateral-filet\);[^}]*background: linear-gradient\(180deg, var\(--socle-lateral-haut\), var\(--socle-lateral-bas\)\)/);
  for (const [jeton, valeur] of [['lateral-haut', '#111112'], ['lateral-bas', '#0f0f10'], ['lateral-filet', '#1f1f21'], ['lateral-famille-active', '#19191b'], ['lateral-sous-actif', '#1f1f21'], ['lateral-sous-filet', '#262629'], ['lateral-survol', '#18181a'], ['lateral-bord-carte', '#242426'], ['ajmani-bord-survol', '#3a3a3e'], ['largeur-lateral', '252px'], ['hauteur-entete', '60px'], ['hauteur-ajmani', '46px'], ['rayon-carte', '14px']]) {
    assert.match(noir, new RegExp(`--socle-${jeton}: ${valeur};`), `--socle-${jeton}`);
  }
  for (const sel of ['sc-famille', 'sc-module', 'sc-epingle']) {
    assert.match(css, new RegExp(`\\.${sel}:hover \\{ background: var\\(--socle-lateral-survol\\); color: var\\(--socle-texte-1\\); \\}`), `${sel} au survol`);
    assert.match(css, new RegExp(`\\.${sel} \\{[^}]*transition: background-color 150ms`), `${sel} en 150 ms`);
  }
  assert.match(css, /\.sc-principal \{[^}]*padding: 24px 40px 0/);
  assert.match(css, /\.sc-pied-page \{[^}]*padding: 12px 40px 20px/);
  assert.match(css, /\.sc-ajmani \{[^}]*height: var\(--socle-hauteur-ajmani\);[^}]*border-radius: var\(--socle-rayon-carte\);/);
  assert.match(css, /\.sc-ajmani:hover \{ border-color: var\(--socle-ajmani-bord-survol\); \}/);
  assert.match(css, /\.sc-ajmani__envoi \{[^}]*color: var\(--socle-texte-3\);[^}]*font-size: 11\.5px;/);
});

await dit('barre Ajmani v3 : l’étincelle, le curseur qui clignote AVANT le texte, « Entrée pour envoyer » avant ⌘J ; le texte se donne par écran', () => {
  const r = rendre(h(K.BarreAjmani, { onOuvrir: () => undefined, raccourci: '⌘J' }));
  const i = (re: RegExp) => r.search(re);
  assert.ok(i(/class="sc-etincelle/) >= 0, 'l’étincelle');
  assert.ok(i(/data-mvt="curseur"/) > i(/class="sc-etincelle/), 'le curseur après l’étincelle');
  assert.ok(i(/class="sc-ajmani__texte"/) > i(/data-mvt="curseur"/), 'le curseur avant le texte');
  assert.ok(i(/Entrée pour envoyer/) > i(/class="sc-ajmani__texte"/) && i(/<kbd/) > i(/Entrée pour envoyer/), '« Entrée pour envoyer » avant ⌘J');
  assert.equal((r.match(/<svg/g) ?? []).length, 1, 'un seul dessin : l’étincelle');
  assert.doesNotMatch(r, /<img|<canvas|sc-avatar/);
  assert.match(rendre(h(K.BarreAjmani, { onOuvrir: () => undefined, raccourci: '⌘J', texte: 'Demandez à Ajmani, par exemple : « invite l’équipe »' })), /par exemple : « invite l’équipe »/);
});

await dit('en-tête : la pastille de La Garde a le voyant vivant (onde), dans l’état de la pire situation ouverte ; « inconnu » ne pulse pas', () => {
  const entete = (etat: string) => rendre(h(K.EnTete, { fil: [{ libelle: 'Ma journée', vers: '/' }, { libelle: 'Notifications' }], enLigne: ['A', 'B', 'C'], presenceMontree: true, notifications: 4, versNotifications: '/notifications', garde: { etat, points: 1, vers: '/garde' }, onMenu: () => undefined }));
  for (const [etat, ton] of [['calme', 'ok'], ['attention', 'attention'], ['critique', 'critique']]) {
    const r = entete(etat);
    assert.match(r, new RegExp(`class="sc-garde sc-focus"[\\s\\S]*?data-socle="voyant" data-ton="${ton}"[\\s\\S]*?data-mvt="onde"`), etat);
  }
  assert.doesNotMatch(entete('inconnu').slice(entete('inconnu').indexOf('sc-garde')), /data-mvt="onde"/);
  assert.match(entete('calme'), /<li><a class="sc-focus" href="\/"[^>]*>Ma journée<\/a><\/li><li aria-current="page"><span>Notifications<\/span><\/li>/);
  assert.match(sansCommentaires(lire('src/refonte/coquille/pouls.ts')), /garde\s*\.pouls\(\)/, 'l’état vient du pouls de La Garde (une seule règle)');
});

await dit('La Garde : « La Garde » (jamais tronqué), « veille » et le voyant vert à onde ; l’état se dit en mots', () => {
  const garde = famille('garde', [mod('salle', 'essentiel')], { nom: 'La Garde', famille: 'outils' });
  for (const [etat, ton] of [['calme', 'ok'], ['attention', 'attention'], ['critique', 'critique']]) {
    const r = rendre(h(K.BarreLaterale, { ...props([famille('jour', [mod('home', 'essentiel')])], garde), etatGarde: etat }));
    assert.match(r, /lucide-shield/);
    assert.match(r, new RegExp(`class="sc-famille__etat" data-etat="${etat}"><span aria-hidden="true" class="sc-famille__veille">veille</span><span class="sc-voyant" data-socle="voyant" data-ton="${ton}"`));
  }
  const r = rendre(h(K.BarreLaterale, props([famille('jour', [mod('home', 'essentiel')])], garde)));
  assert.match(r, /<span class="sc-famille__nom">La Garde<\/span>/);
  assert.match(r, /data-mvt="onde"/);
  assert.match(r, /<span class="sr-only">Tout est en ordre<\/span>/);
  assert.match(sansCommentaires(lire('src/refonte/coquille/donnees.ts')), /ts\('coquille\.garde\.court'\)/, 'le nom court en barre latérale');
});

await dit('vue d’ensemble : Ma journée → Accueil, La Garde → sa salle, les autres → la page générique /ensemble/<famille>', () => {
  assert.equal(K.routeEnsemble('jour'), '/');
  assert.equal(K.routeEnsemble('garde'), '/garde');
  assert.equal(K.routeEnsemble('argent'), `${K.PREFIXE_ENSEMBLE}/argent`);
  assert.equal(K.ensembleGenerique('argent'), true);
  assert.equal(K.ensembleGenerique('jour'), false);
});

await dit('« dans 18 min », « dans 2 h », « dans 1 h 05 », « en cours » : le temps avant le prochain rendez-vous', () => {
  const t0 = new Date('2026-10-30T10:42:00');
  assert.equal(K.delaiAvant(new Date('2026-10-30T11:00:00'), t0, 'fr'), 'dans 18 min');
  assert.equal(K.delaiAvant(new Date('2026-10-30T12:42:00'), t0, 'fr'), 'dans 2 h');
  assert.equal(K.delaiAvant(new Date('2026-10-30T11:47:00'), t0, 'fr'), 'dans 1 h 05');
  assert.equal(K.delaiAvant(new Date('2026-10-30T10:30:00'), t0, 'fr'), 'en cours');
  assert.equal(K.delaiAvant(new Date('2026-10-30T11:00:00'), t0, 'en'), 'in 18 min');
  const carte = sansCommentaires(lire('src/refonte/coquille/aujourdhui/carte.ts'));
  assert.match(carte, /const a = useAujourdhui\(\);/, 'les chiffres d’« Aujourd’hui », lus au même endroit que l’Accueil');
  assert.doesNotMatch(carte, /useAccueil/, 'la carte ne paie plus tout le calcul de l’Accueil');
});

/* ── « Aujourd’hui » : un seul calcul (§1.10 point 3) ─────────────────────────────────────────────────────────── */

const T0 = new Date(2026, 9, 30, 10, 42); // vendredi 30 oct. 2026, 10:42 (local)
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const J0 = iso(T0);
const aT = (h: number, m = 0) => new Date(2026, 9, 30, h, m);
const LIB = { enCours: 'en cours', aFaire: 'à faire', faite: 'faite', etapeClient: 'Créer un client', etapeRdv: 'Poser un rendez-vous', etapeVisite: 'Faire la visite', heure: (s: string) => `${String(new Date(s).getHours()).padStart(2, '0')}:${String(new Date(s).getMinutes()).padStart(2, '0')}` };
const sources = (plus: Record<string, unknown> = {}) => ({
  moi: 'aaron@exemple.test',
  pret: true,
  jour: J0,
  taches: [
    { id: 't1', title: 'Relire le devis', status: 'doing', assigneeEmail: 'aaron@exemple.test' },
    { id: 't2', title: 'Appeler le fournisseur', status: 'todo', assigneeEmail: 'camille@exemple.test' },
    { id: 't3', title: 'Envoyer la facture', status: 'done', updatedAt: `${J0}T09:10:00.000Z` },
    { id: 't4', title: 'Vieille tâche faite', status: 'done', updatedAt: '2026-10-02T09:10:00.000Z' },
  ],
  priorites: [
    { email: 'aaron@exemple.test', day: J0, items: [{ id: 'p1', label: 'Boucler le dossier', doneAt: null }, { id: 'p2', label: 'Préparer la réunion', doneAt: `${J0}T08:00:00.000Z` }] },
    { email: 'camille@exemple.test', day: J0, items: [{ id: 'p3', label: 'La sienne', doneAt: null }] },
    { email: 'aaron@exemple.test', day: '2026-10-29', items: [{ id: 'p0', label: 'Hier', doneAt: null }] },
  ],
  rdv: [
    { id: 'r1', title: 'Point du matin', clientName: '', startAt: aT(9).toISOString(), fin: aT(9, 30), status: 'scheduled' },
    { id: 'r2', title: 'Rendez-vous', clientName: 'Client Exemple', startAt: aT(11).toISOString(), fin: aT(12), status: 'scheduled' },
    { id: 'r3', title: 'Annulé', clientName: '', startAt: aT(15).toISOString(), fin: aT(16), status: 'cancelled' },
    { id: 'r4', title: 'Demain', clientName: '', startAt: new Date(2026, 9, 31, 9).toISOString(), fin: new Date(2026, 9, 31, 10), status: 'scheduled' },
  ],
  routines: [{ ticks: [1, 2, 3, 4, 5].map((n) => iso(new Date(2026, 9, 30 - n))) }, { ticks: [J0] }],
  clients: 3,
  factures: 2,
  visiteFaite: true,
  retouches: { jour: J0, faits: [], masques: [], ajouts: [] },
  ...plus,
});

await dit('calculerAujourdhui (pur) : « x sur y faites » sur le fil visible, le prochain rendez-vous pas encore fini, la série comptée à la clôture (B2), les règles de S2 appelées', () => {
  const r = K.calculerAujourdhui(sources(), T0, LIB);
  // Le fil : 3 priorités du jour (les miennes d’abord), 2 rendez-vous du jour (pas l’annulé, pas demain), 3 tâches (2 ouvertes + 1 faite aujourd’hui).
  assert.equal(r.total, 8);
  assert.equal(r.fil.length, 8);
  // Faites : ma priorité p2, le rendez-vous de 9 h (fini), la tâche t3.
  assert.equal(r.faites, 3);
  assert.deepEqual(r.fil.filter((l: { fait: boolean }) => l.fait).map((l: { cle: string }) => l.cle), ['priorite:aaron@exemple.test:p2', 'rdv:r1', 'tache:t3'], 'ce qui est fait descend en bas, dans l’ordre');
  assert.equal(r.fil[0].cle, 'priorite:aaron@exemple.test:p1', 'ma priorité d’abord');
  assert.deepEqual(r.prochainRdv, { titre: 'Rendez-vous', debut: aT(11).toISOString() });
  assert.equal(r.serie, 5, 'cinq jours cochés avant aujourd’hui : le jour en cours ne rompt pas la série');
  assert.equal(r.masquees, 0);
  assert.equal(r.compteVide, false);
  assert.match(r.fil.find((l: { cle: string }) => l.cle === 'rdv:r2').titre, /Rendez-vous · Client Exemple/);
  assert.equal(r.fil.find((l: { cle: string }) => l.cle === 'rdv:r2').detail, '11:00');
  // Plus tard dans la journée : le rendez-vous de 11 h est passé, plus de prochain.
  const apres = K.calculerAujourdhui(sources(), aT(12, 30), LIB);
  assert.equal(apres.prochainRdv, null);
  assert.equal(apres.faites, 4);
});

await dit('calculerAujourdhui : les retouches du jour (masquer, ajouter, cocher à soi) comptent ; celles d’un autre jour non ; un compte vide montre ses trois étapes', () => {
  const r = K.calculerAujourdhui(sources({ retouches: { jour: J0, faits: ['perso:a'], masques: ['tache:t2'], ajouts: [{ cle: 'perso:a', titre: 'La mienne' }, { cle: 'perso:b', titre: 'L’autre' }] } }), T0, LIB);
  assert.equal(r.total, 9, '8 − 1 masquée + 2 ajoutées');
  assert.equal(r.masquees, 1);
  assert.equal(r.faites, 4);
  const hier = K.calculerAujourdhui(sources({ retouches: { jour: '2026-10-29', faits: ['perso:a'], masques: ['tache:t2'], ajouts: [{ cle: 'perso:a', titre: 'La mienne' }] } }), T0, LIB);
  assert.equal(hier.total, 8, 'les retouches d’hier sont ignorées');
  const vide = K.calculerAujourdhui(sources({ taches: [], priorites: [], rdv: [], clients: 0, factures: 0, visiteFaite: false, routines: [] }), T0, LIB);
  assert.equal(vide.compteVide, true);
  assert.deepEqual(vide.fil.map((l: { cle: string }) => l.cle), ['etape:client', 'etape:rdv', 'etape:visite']);
  assert.equal(vide.total, 3);
  assert.equal(vide.faites, 0);
  assert.equal(vide.serie, 0);
  const pasPret = K.calculerAujourdhui(sources({ pret: false, taches: [], priorites: [], rdv: [], clients: 0, factures: 0, routines: [] }), T0, LIB);
  assert.equal(pasPret.compteVide, false, 'tant que la synchronisation n’a pas répondu, le compte n’est pas « vide »');
  assert.equal(pasPret.total, 0);
});

await dit('un seul calcul : construireFil (S2) n’est appelé que dans calculer.ts ; l’Accueil et la carte lisent useAujourdhui ; la carte ne lit plus useAccueil', () => {
  const fichiers: string[] = [];
  const marcher = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) marcher(p);
      else if (/\.tsx?$/.test(e.name)) fichiers.push(p);
    }
  };
  marcher(path.join(racine, 'src'));
  const appelants = fichiers
    .filter((f) => !f.endsWith(`${path.sep}filDuJour.ts`))
    .filter((f) => /import\s*\{[^}]*\bconstruireFil\b[^}]*\}\s*from\s*'[^']*filDuJour'/.test(sansCommentaires(fs.readFileSync(f, 'utf8'))))
    .map((f) => path.relative(racine, f).replace(/\\/g, '/'));
  assert.deepEqual(appelants, ['src/refonte/coquille/aujourdhui/calculer.ts']);
  const calc = sansCommentaires(lire('src/refonte/coquille/aujourdhui/calculer.ts'));
  assert.match(calc, /appliquerRetouches\(lignes, s\.retouches, s\.jour, s\.moi\)/, 'les retouches de S2');
  assert.match(calc, /serie: meilleureSerie\(s\.routines, maintenant\)/, 'la série de S2');
  assert.doesNotMatch(calc, /import \{[^}]*\buse[A-Z]/, 'calculer.ts est pur : aucun hook');
  const accueil = sansCommentaires(lire('src/refonte/accueil/useAccueil.ts'));
  assert.match(accueil, /\} = useAujourdhui\(\);/);
  for (const re of [/construireFil/, /appliquerRetouches/, /meilleureSerie/, /lireRetouches|localStorage/, /basculerFait/, /guideVu/]) assert.doesNotMatch(accueil, re, `l’Accueil ne recalcule pas « Aujourd’hui » (${re})`);
  const hook = sansCommentaires(lire('src/refonte/coquille/aujourdhui/useAujourdhui.ts'));
  assert.match(hook, /export function useAujourdhui\(\): Aujourdhui \{\s*const partage = useContext\(ContexteAujourdhui\);\s*const local = useCalculAujourdhui\(partage === null\);\s*return partage \?\? local;/, 'le fournisseur d’abord, sinon un calcul local');
  assert.match(hook, /calculerAujourdhui\(/);
  for (const acces of [/useCollection<LigneTache>\('tasks'\)/, /useCollection<JourPriorites>\('dailyPriorities'\)/, /useCollection<\{ ticks: string\[\] \}>\('routines'\)/, /useAppointments\(\)/, /useRegards\(\)/, /useAuth\(\)/, /setInterval\(\(\) => setMaintenant\(new Date\(\)\), 60_000\)/]) assert.match(hook, acces, `${acces}`);
});

await dit('FournisseurAujourdhui : monté une fois dans la coque interne (AppLayout, par @edition/coquille), autour de CoquilleRefonte ; côté cliente, un jumeau inerte', () => {
  const layout = lire('src/components/AppLayout.tsx');
  assert.match(layout, /import \{[^}]*\bFournisseurAujourdhui\b[^}]*\} from '@edition\/coquille';/);
  assert.equal((layout.match(/<FournisseurAujourdhui>/g) ?? []).length, 1);
  assert.match(layout, /<FournisseurAujourdhui>\s*(\{\/\*[^]*?\*\/\}\s*)?<CoquilleRefonte /, 'juste au-dessus de CoquilleRefonte');
  assert.match(layout, /<\/CoquilleRefonte>\s*<\/FournisseurAujourdhui>/);
  assert.doesNotMatch(sansCommentaires(layout), /from '[^']*(refonte|socle)\//, 'AppLayout passe par la couture, jamais par src/refonte ni src/socle');
  assert.match(lire('src/edition/coquille.internal.tsx'), /export \{ FournisseurAujourdhui \} from '\.\.\/refonte\/coquille\/aujourdhui';/);
  const cliente = lire('src/edition/coquille.business.tsx');
  assert.match(cliente, /export function FournisseurAujourdhui\(\{ children \}: \{ children\?: React\.ReactNode \}\): React\.ReactElement \{\s*return <>\{children\}<\/>;/);
  assert.doesNotMatch(cliente, /from '[^']*(socle|refonte)\//, 'la face cliente n’importe rien du socle ni de la refonte');
  assert.match(lire('src/refonte/coquille/aujourdhui/Fournisseur.tsx'), /useCalculAujourdhui\(true\)[^]*<ContexteAujourdhui\.Provider value=\{aujourdhui\}>/);
});

/* ── Les compteurs de la barre latérale : déclarés par les lots, ramassés seuls (demande de LOT-06, point 5) ── */

/** `import.meta.glob` est un mot de Vite : ici, on le remplace par les imports du dossier, comme Vite le fait. */
const globVite: esbuild.Plugin = {
  name: 'import-meta-glob',
  setup(b) {
    b.onLoad({ filter: /[\\/]src[\\/].*\.tsx?$/ }, (a) => {
      const src = fs.readFileSync(a.path, 'utf8');
      if (!src.includes('import.meta.glob')) return undefined;
      const tetes: string[] = [];
      const code = src.replace(/import\.meta\.glob(?:<[^>]*>)?\(\s*'([^']+)'\s*,\s*\{\s*eager:\s*true\s*\}\s*\)/g, (_m, motif: string) => {
        const dossier = path.resolve(path.dirname(a.path), path.dirname(motif));
        const fichiers = fs.readdirSync(dossier).filter((f) => f.endsWith(path.extname(motif))).sort();
        const paires = fichiers.map((f, i) => {
          tetes.push(`import * as __glob${i} from ${JSON.stringify(path.join(dossier, f))};`);
          return `${JSON.stringify(`./${path.relative(path.dirname(a.path), path.join(dossier, f)).replace(/\\/g, '/')}`)}: __glob${i}`;
        });
        return `({ ${paires.join(', ')} })`;
      });
      return { contents: `${tetes.join('\n')}\n${code}`, loader: a.path.endsWith('x') ? 'tsx' : 'ts' };
    });
  },
};

/** Comme `charger`, avec le glob de Vite réécrit et les feuilles de style / polices vidées (les aperçus les importent). */
async function chargerVite<T>(code: string): Promise<T> {
  const construit = await esbuild.build({
    stdin: { contents: code, resolveDir: path.join(racine, 'scripts'), loader: 'tsx' },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    charset: 'utf8',
    jsx: 'automatic',
    tsconfig: path.join(racine, 'tsconfig.json'),
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', __AMN_EDITION__: '"internal"', __AMN_VERSION__: '"0.0.0"' },
    loader: { '.css': 'empty', '.woff': 'empty', '.woff2': 'empty', '.png': 'empty', '.svg': 'empty' },
    plugins: [globVite],
    logLevel: 'silent',
  });
  return (await import(`data:text/javascript;charset=utf-8;base64,${Buffer.from(construit.outputFiles[0].text, 'utf8').toString('base64')}`)) as T;
}

const DOSSIER_COMPTEURS = 'src/refonte/compteurs';
type ModuleCompteurs = {
  COMPTEURS_DECLARES: { declarations: { chemin: string; famille: string; useCompteurs: () => Record<string, number> }[]; ecartes: { chemin: string; raison: string }[] };
  ramasserCompteurs: (f: { chemin: string; declaration: unknown }[]) => ModuleCompteurs['COMPTEURS_DECLARES'];
  fusionnerCompteurs: (parts: Record<string, number>[]) => Record<string, number>;
  useCompteursDe: (d: { famille: string; useCompteurs: () => Record<string, number> }[]) => Record<string, number>;
  declarerCompteurs: (d: unknown) => unknown;
  verifierDeclaration: (v: unknown) => string | null;
};

await dit('compteurs déclarables : ramassés seuls dans src/refonte/compteurs (glob de Vite, repli vide sous esbuild), dans l’ordre des chemins ; jour.ts porte les compteurs d’avant, cyber.ts celui de Cyber', async () => {
  const sans = await charger<ModuleCompteurs>('src/refonte/coquille/compteurs.ts');
  assert.deepEqual(sans.COMPTEURS_DECLARES, { declarations: [], ecartes: [] }, 'sans Vite : rien, et rien ne casse');
  const avec = await chargerVite<ModuleCompteurs>("export * from '../src/refonte/coquille/compteurs'; export * from '../src/refonte/coquille/declarerCompteurs';");
  const fichiers = fs.readdirSync(path.join(racine, DOSSIER_COMPTEURS)).filter((f) => f.endsWith('.ts')).sort();
  assert.deepEqual(avec.COMPTEURS_DECLARES.ecartes, [], 'aucun fichier du dossier n’est écarté');
  assert.deepEqual(avec.COMPTEURS_DECLARES.declarations.map((d) => d.chemin), fichiers.map((f) => `compteurs/${f}`), 'tous les fichiers, dans l’ordre des chemins');
  assert.deepEqual(avec.COMPTEURS_DECLARES.declarations.map((d) => d.famille), ['cyber', 'jour']);
  for (const d of avec.COMPTEURS_DECLARES.declarations) assert.equal(typeof d.useCompteurs, 'function', d.chemin);
  for (const f of fichiers) {
    const src = sansCommentaires(lire(`${DOSSIER_COMPTEURS}/${f}`));
    assert.match(src, /export default declarerCompteurs\(\{ famille: '[a-z]+', useCompteurs \}\);/, `${f} exporte par défaut declarerCompteurs(...)`);
    assert.match(src, /from '\.\.\/coquille\/declarerCompteurs'/, `${f} importe declarerCompteurs sans passer par compteurs.ts (pas de cycle)`);
  }
  // Les chiffres d’avant, mot pour mot : la première déclaration reprend le calcul que la coquille faisait en dur.
  const jour = sansCommentaires(lire(`${DOSSIER_COMPTEURS}/jour.ts`));
  for (const re of [
    /\.\.\.unseen,/,
    /'\/agenda': appointments\.filter\(\(a\) => a\.status === 'scheduled' && isoDay\(new Date\(a\.startAt\)\) === aujourdhui && appointmentEnd\(a\) > maintenant\)\.length,/,
    /'\/tasks': taches\.filter\(\(t\) => \(t\.status === 'todo' \|\| t\.status === 'doing'\) && \(t\.assigneeEmail \?\? ''\)\.toLowerCase\(\) === moi\)\.length,/,
    /'\/relances': invoices\.filter\(\(f\) => isOverdue\(f, aujourdhui, invoices\)\)\.length,/,
    /'\/priorites': priorites\.filter\(\(d\) => d\.day === aujourdhui && d\.email\.toLowerCase\(\) === moi\)\.flatMap\(\(d\) => d\.items \?\? \[\]\)\.filter\(\(p\) => !p\.doneAt\)\.length,/,
  ]) assert.match(jour, re, `jour.ts : ${re}`);
  const cyber = sansCommentaires(lire(`${DOSSIER_COMPTEURS}/cyber.ts`));
  assert.match(cyber, /const alertes = modele\.pret \? modele\.alertes\.length : null;/, 'Cyber : rien tant que la source n’a pas répondu');
  assert.match(cyber, /if \(alertes !== null\) compteurs\['\/cyber'\] = alertes;/);
  const donnees = sansCommentaires(lire('src/refonte/coquille/donnees.ts'));
  assert.match(donnees, /const compteurs = useCompteursDeclares\(\);/, 'la coquille lit les déclarations');
  assert.match(donnees, /const alertesCyber = Object\.hasOwn\(compteurs, ROUTE_CYBER\) \? compteurs\[ROUTE_CYBER\] : null;/, 'absent → null (pas de pastille), 0 → 0');
  for (const re of [/'\/agenda':/, /'\/tasks':/, /'\/relances':/, /'\/priorites':/, /useCyber\(/, /useActivity\(/, /\.\.\.unseen/]) assert.doesNotMatch(donnees, re, `plus de compteur en dur dans donnees.ts (${re})`);
});

await dit('ramasserCompteurs / fusionnerCompteurs (purs) : une déclaration inconnue ou mal formée est écartée avec sa raison, les autres restent ; l’ordre est celui des chemins ; les adresses s’additionnent', async () => {
  const m = await charger<ModuleCompteurs>({ code: "export * from '../src/refonte/coquille/compteurs'; export * from '../src/refonte/coquille/declarerCompteurs';" });
  const ok = (famille: string, compteurs: Record<string, number>) => m.declarerCompteurs({ famille, useCompteurs: () => compteurs });
  const r = m.ramasserCompteurs([
    { chemin: 'compteurs/jour.ts', declaration: ok('jour', { '/agenda': 3 }) },
    { chemin: 'compteurs/creer.ts', declaration: ok('creer', { '/stock': 6 }) },
    { chemin: 'compteurs/zz-faux.ts', declaration: { famille: 'inconnue', useCompteurs: () => ({}) } },
    { chemin: 'compteurs/vide.ts', declaration: undefined },
    { chemin: 'compteurs/sans-hook.ts', declaration: { famille: 'argent' } },
    { chemin: 'compteurs/texte.ts', declaration: 'bonjour' },
  ]);
  assert.deepEqual(r.declarations.map((d) => [d.chemin, d.famille]), [['compteurs/creer.ts', 'creer'], ['compteurs/jour.ts', 'jour']], 'triées par chemin, les fautives en moins');
  assert.deepEqual(r.ecartes.map((e) => e.chemin), ['compteurs/sans-hook.ts', 'compteurs/texte.ts', 'compteurs/vide.ts', 'compteurs/zz-faux.ts']);
  for (const e of r.ecartes) assert.ok(e.raison.length > 10, `${e.chemin} : une raison`);
  assert.equal(m.verifierDeclaration(ok('garde', {})), null);
  assert.equal(m.verifierDeclaration(ok('cyber', {})), null);
  assert.match(m.verifierDeclaration({ famille: 'soc', useCompteurs: () => ({}) }) ?? '', /famille inconnue : soc/);
  assert.deepEqual(m.fusionnerCompteurs([{ '/a': 1, '/b': 2 }, { '/b': 3, '/c': 0 }, { '/d': Number.NaN, '/e': Number.POSITIVE_INFINITY }]), { '/a': 1, '/b': 5, '/c': 0 });
  assert.deepEqual(m.fusionnerCompteurs([]), {});
});

await dit('useCompteursDe : chaque hook déclaré est appelé à chaque rendu, dans l’ordre des déclarations (règle des hooks), et la fusion nourrit la barre', async () => {
  const m = await charger<ModuleCompteurs & { h: (...a: unknown[]) => unknown; rendre: (el: unknown) => string; useState: <T>(v: T) => [T, (v: T) => void] }>({
    code: "import { createElement as h, useState } from 'react'; import { renderToStaticMarkup } from 'react-dom/server.browser'; export const rendre = (el) => renderToStaticMarkup(el); export { h, useState }; export * from '../src/refonte/coquille/compteurs';",
  });
  const appels: string[] = [];
  const decl = (famille: string, compteurs: Record<string, number>) => ({
    famille,
    useCompteurs: () => {
      appels.push(famille);
      const [v] = m.useState(compteurs); // un vrai hook, pour que l’ordre compte
      return v;
    },
  });
  const liste = [decl('jour', { '/agenda': 3, '/tasks': 2 }), decl('creer', { '/stock': 6, '/tasks': 1 }), decl('cyber', { '/cyber': 5 })];
  const Barre = () => {
    const c = m.useCompteursDe(liste);
    return m.h('pre', null, JSON.stringify(c));
  };
  const html = m.rendre(m.h(Barre));
  assert.equal(html, '<pre>{&quot;/agenda&quot;:3,&quot;/tasks&quot;:3,&quot;/stock&quot;:6,&quot;/cyber&quot;:5}</pre>');
  assert.deepEqual(appels, ['jour', 'creer', 'cyber'], 'dans l’ordre, une fois chacun par rendu');
  assert.equal(m.rendre(m.h(() => m.h('i', null, JSON.stringify(m.useCompteursDe([]))))), '<i>{}</i>', 'sans déclaration : aucune pastille, rien ne casse');
});

await dit('l’aperçu ApercuBureau (données fictives) rend toujours la coquille : barre, carte « Aujourd’hui », compteurs de la maquette, Cyber, en-tête, barre Ajmani', async () => {
  const m = await chargerVite<{ h: (...a: unknown[]) => unknown; rendre: (el: unknown) => string; ApercuBureau: unknown }>(
    "import { createElement as h } from 'react'; import { renderToStaticMarkup } from 'react-dom/server.browser'; export const rendre = (el) => renderToStaticMarkup(el); export { h }; export { ApercuBureau } from './apercu/coquille';",
  );
  const r = m.rendre(m.h(m.ApercuBureau, { famille: 'jour', sousPage: 'accueil', fil: ['Ma journée', 'Démarrage'], ajmani: 'Demandez à Ajmani' }));
  assert.match(r, /<section aria-labelledby="sc-aujourdhui"[\s\S]*5 sur 8 faites · série 6 j[\s\S]*Rendez-vous Menna[\s\S]*11:00 · dans 18 min/);
  assert.match(r, /data-section="espace"[\s\S]*data-section="surveillance"[\s\S]*data-section="epingles"/);
  assert.match(r, /data-cle="cyber">[\s\S]*?<span class="sc-compteur" data-pastille="true" title="5 alertes ouvertes">5</);
  assert.match(r, /aria-current="page"[^>]*><span class="sc-module__nom">Accueil</);
  assert.match(r, /Ma journée<\/a><\/li><li aria-current="page"><span>Démarrage<\/span>/);
  assert.match(r, /Demandez à Ajmani/);
  const apercu = sansCommentaires(lire('scripts/apercu/coquille.tsx'));
  assert.doesNotMatch(apercu, /useCompteursDeclares|useDonneesCoquille|useAujourdhui|refonte\/coquille/, 'l’aperçu reste sur ses données fictives, sans les hooks de l’application');
});

await dit('chiffres tabulaires sur les nombres seulement (C11) : le corps et la coquille en chiffres normaux, les nombres du socle tabulaires', () => {
  const noir = sansCommentaires(lire('src/socle/noir.css'));
  assert.match(noir, /:root\[data-ambiance='noir'\] body \{ font-variant-numeric: normal; \}/);
  assert.match(noir, /:root\[data-ambiance='noir'\] :is\(\.sc-nombre, \.sc-compteur, \.sc-kbd, \.sc-anneau__centre, \.sc-cloche__badge[^)]*\) \{\s*font-variant-numeric: tabular-nums;/);
  assert.match(noir, /\[data-refonte-police='inter'\] \{[^}]*font-variant-numeric: normal;/);
  assert.match(sansCommentaires(lire('src/socle/coquille/coquille.css')), /\.sc-coquille \{[^}]*font-variant-numeric: normal;/);
  assert.match(noir, /\.sc-mono \{[^}]*font-variant-numeric: tabular-nums;/, 'les données techniques gardent leurs chiffres tabulaires');
});

await dit('le point flottant d’Ajmani (✦) n’est pas posé sur la nouvelle coquille (C10) ; l’ancienne le garde', () => {
  const layout = lire('src/components/AppLayout.tsx');
  assert.match(layout, /function BulleAjmaniSelonCoquille\(\{ coquille \}: \{ coquille: boolean \}\) \{\s*const \{ bulleOuverte \} = useAssistant\(\);\s*if \(coquille && !bulleOuverte\) return null;\s*return <AjmaniBubble \/>;/);
  assert.match(layout, /<BulleAjmaniSelonCoquille coquille=\{coquille\} \/>/);
  assert.match(layout, /const coquille = useCoquilleActive\(\);/);
  assert.match(lire('src/edition/coquille.business.tsx'), /export function useCoquilleActive\(\): boolean \{\s*return false;/, 'côté cliente : toujours l’ancienne coquille');
});

fin();
