/**
 * Contrôle de la COQUILLE v3 du LOT-00 (01-SOCLE-DESIGN §0.1 et §0.4) — barre latérale (sections ESPACE,
 * SURVEILLANCE, ÉPINGLÉS ; Cyber toujours là ; sous-liste de cinq lignes au plus avec le module courant et son
 * repère ; « + N autres » ; carte « Aujourd'hui »), fil d'Ariane « Famille / Page » sans libellé tiré de
 * l'adresse, présence sans route brute, ⌘K et ⌘J d'un bloc, barre Ajmani v3, chiffres tabulaires sur les nombres
 * seulement. Sans navigateur.
 *
 *   npm run check:socle-coquille
 */
import { assert, chargerRendu, creerEssais, lire, sansCommentaires } from './lib/essai-socle.ts';

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
    "import { delaiAvant } from '../src/refonte/coquille/aujourdhui';",
    "import { routeEnsemble, ensembleGenerique, PREFIXE_ENSEMBLE } from '../src/refonte/systeme/ensemble';",
  ].join('\n'),
  [
    'BarreLaterale', 'lienAutres', 'ICONES_FAMILLE', 'EPINGLES_MONTRES', 'COLLEGUES_MONTRES', 'EnTete', 'BarreAjmani',
    'choisirLesVisibles', 'placesDeModules', 'MODULES_VISIBLES', 'choisirEpingles', 'EPINGLES_BARRE', 'construireFil',
    'pageSysteme', 'motsPagesSysteme', 'libellePageSysteme', 'libelleDuLieu', 'raccourciAffiche', 'delaiAvant',
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
  assert.doesNotMatch(sans, /sc-compteur/, 'pas de compteur inventé');
  assert.doesNotMatch(sans, /data-section="epingles"/, 'sans épinglé, pas de section vide');
  const avec = rendre(h(K.BarreLaterale, props([famille('jour', [mod('home', 'essentiel')])])));
  assert.match(avec, /data-cle="cyber">[\s\S]*?<span class="sc-compteur" data-pastille="true" title="5 alertes ouvertes">5<span class="sr-only"> 5 alertes ouvertes<\/span><\/span>/);
  assert.match(avec, /lucide-target/);
  assert.match(rendre(h(K.BarreLaterale, props([], null, { cyber: { ...CYBER, compteur: 0 } }))), /data-cle="cyber"(?![\s\S]*sc-compteur)/);
});

await dit('familles : 32 px, une icône de trait lucide de 15 px en T3 par famille, plus aucune pastille de couleur ni compteur ; la teinte seulement sur l’icône de la famille active', () => {
  const r = rendre(h(K.BarreLaterale, props([famille('jour', [mod('home', 'essentiel', true)], { active: true, badge: 4, famille: 'jour' }), famille('argent', [mod('invoices', 'essentiel')], { badge: 2 })])));
  for (const cle of ['jour', 'contacts', 'ecrire', 'argent', 'echanger', 'creer', 'outils', 'garde', 'cyber']) assert.ok(K.ICONES_FAMILLE[cle], `icône de ${cle}`);
  assert.match(r, /data-cle="jour"><button[^>]*class="sc-famille sc-focus"><svg[^>]*lucide-sun[^>]*sc-famille__icone/);
  assert.match(r, /data-cle="argent"><button[^>]*><svg[^>]*lucide-euro/);
  assert.match(r, /width="15" height="15"/);
  assert.doesNotMatch(r, /sc-point/, 'plus de pastille de couleur');
  const espace = r.slice(r.indexOf('data-section="espace"'), r.indexOf('data-section="surveillance"'));
  assert.doesNotMatch(espace, /sc-compteur/, 'aucun compteur sur une famille ni dans la sous-liste');
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
  const glue = sansCommentaires(lire('src/refonte/accueil/useAccueil.ts'));
  assert.match(glue, /libelleDuLieu\(r\.module, catalogue/, 'l’Accueil dit le lieu avec la même règle');
  assert.doesNotMatch(glue, /return item \? libelleNav\(item\) : m;/, 'plus de route brute à l’Accueil');
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
  assert.match(sansCommentaires(lire('src/refonte/coquille/aujourdhui.ts')), /const a = useAccueil\(\);/, 'les chiffres de l’Accueil, lus au même endroit');
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
