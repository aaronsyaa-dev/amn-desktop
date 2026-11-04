/**
 * Contrôle de l'ÉCRAN DE VEILLE (G09, v3) — la géométrie, les textes, ce que l'écran a le droit de lire, ce qui
 * l'empêche de tomber, et la bascule sur le drapeau de la coquille. Sans navigateur.
 *
 *   npm run check:systeme-veille
 *
 * Ce que l'écran promet (fiche G09) : noir absolu, ici seulement ; l'heure (sans secondes), le jour et l'état global
 * de La Garde, rien d'autre — ni nom de client, ni montant, ni texte de travail ; jamais pendant un appel, un
 * partage d'écran, un enregistrement ou une vidéo ; réglable (5 et 15 min par défaut) ; le mouvement s'arrête avec
 * le réglage ; coquille éteinte, le voile d'avant (la Salle de situation) ne change pas.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { assert, creerEssais, jetons, lire, racine, rapportContraste, sansCommentaires } from './lib/essai-socle.ts';

const { dit, fin } = creerEssais('Écran de veille (G09, v3)');

async function chargerVue<T>(code: string): Promise<T> {
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
    loader: { '.css': 'empty' },
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', __AMN_EDITION__: '"internal"', __AMN_VERSION__: '"0.0.0"' },
    logLevel: 'silent',
  });
  return (await import(`data:text/javascript;charset=utf-8;base64,${Buffer.from(construit.outputFiles[0].text, 'utf8').toString('base64')}`)) as T;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const M = await chargerVue<any>(`
  import { createElement as h } from 'react';
  import { renderToStaticMarkup } from 'react-dom/server.browser';
  export { VueVeille } from '../src/refonte/systeme/veille/VueVeille';
  export { EcranDeVeilleSection } from '../src/refonte/systeme/veille/EcranDeVeilleSection';
  export * as temps from '../src/refonte/systeme/veille/temps';
  export * as etat from '../src/refonte/systeme/veille/etat';
  export * as blocage from '../src/refonte/systeme/veille/blocage';
  export * as reglage from '../src/refonte/systeme/veille/reglage';
  export * as orbite from '../src/refonte/systeme/veille/WatchOrbit';
  export { dictionnaires } from '../src/refonte/systeme/veille/i18n';
  export { h };
  export const rendre = (el) => renderToStaticMarkup(el);
`);
const T = M.temps;
const DIR = 'src/refonte/systeme/veille';
const fichiersVeille = fs.readdirSync(path.join(racine, DIR)).map((f) => `${DIR}/${f}`);
const base = (sur: Record<string, unknown> = {}) => ({
  produit: 'Produit',
  maintenant: new Date(2026, 9, 30, 10, 42, 37),
  etat: 'calme',
  ronde: new Date(2026, 9, 30, 12, 30),
  veilleMin: 5,
  verrouApresMin: null,
  verrouille: false,
  repereEnVeille: 3,
  ...sur,
});
const vue = (sur: Record<string, unknown> = {}): string => M.rendre(M.h(M.VueVeille, base(sur)));
const compter = (html: string, re: RegExp): number => (html.match(re) ?? []).length;
/** Le premier morceau qui correspond, ou une chaîne vide (l'assertion qui suit échoue alors d'elle-même). */
const extraire = (html: string, re: RegExp, groupe = 0): string => re.exec(html)?.[groupe] ?? '';
const texte = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, '’').replace(/\s+/g, ' ');

/* ── 1. L'anneau ── */
await dit('l’anneau : midi en haut, minuit en bas, 18 h à droite, 6 h à gauche (rayon 300)', () => {
  assert.deepEqual(T.pointHeure(12, 300), { x: 0, y: -300 });
  assert.deepEqual(T.pointHeure(0, 300), { x: 0, y: 300 });
  assert.deepEqual(T.pointHeure(24, 300), { x: 0, y: 300 });
  assert.deepEqual(T.pointHeure(18, 300), { x: 300, y: 0 });
  assert.deepEqual(T.pointHeure(6, 300), { x: -300, y: 0 });
  assert.equal(T.RAYON_ANNEAU, 300);
  assert.deepEqual(T.CENTRE, { x: 720, y: 410 });
  // 10:42 → le repère de l'instant tombe là où l'image le montre (620, 127).
  const p = T.pointHeure(T.heureDecimale(new Date(2026, 9, 30, 10, 42)), 300);
  assert.ok(Math.abs(720 + p.x - 619.9) < 0.3 && Math.abs(410 + p.y - 127.2) < 0.3, `(${720 + p.x}, ${410 + p.y})`);
});

await dit('24 traits : écoulés avant l’heure en cours, l’heure en cours, à venir après ; 16 px aux repères 12 · 18 · 00 · 06, 11 px sinon', () => {
  const traits = T.traitsDeLAnneau(new Date(2026, 9, 30, 10, 42));
  assert.equal(traits.length, 24);
  traits.forEach((t: any, h: number) => {
    assert.equal(t.etat, h < 10 ? 'ecoulee' : h === 10 ? 'encours' : 'avenir', `heure ${h}`);
    assert.equal(t.long, h % 6 === 0, `heure ${h}`);
    const l = Math.hypot(t.a.x - t.de.x, t.a.y - t.de.y);
    assert.ok(Math.abs(l - (h % 6 === 0 ? 16 : 11)) < 0.2, `heure ${h} : ${l}`);
    assert.ok(Math.abs(Math.hypot(t.de.x, t.de.y) - 292) < 0.2);
  });
  const html = vue();
  assert.equal(compter(html, /class="ve-trait"/g), 24);
  assert.equal(compter(html, /data-etat="encours"/g), 1);
  assert.equal(compter(html, /data-etat="ecoulee"/g), 10);
  for (const e of ['12', '18', '00', '06']) assert.match(html, new RegExp(`class="ve-etiquette"[^>]*>${e}</span>`));
});

await dit('l’arc écoulé va de minuit à l’instant, dans le sens horaire ; grand arc après midi ; rien à minuit', () => {
  const arc = T.arcEcoule(new Date(2026, 9, 30, 10, 42));
  const p = T.pointHeure(10.7, 300);
  assert.equal(arc, `M 0 300 A 300 300 0 0 1 ${p.x} ${p.y}`);
  assert.match(T.arcEcoule(new Date(2026, 9, 30, 15, 0)), /^M 0 300 A 300 300 0 1 1 212\.1 -212\.1$/);
  assert.equal(T.arcEcoule(new Date(2026, 9, 30, 0, 0)), null);
  assert.match(vue(), /<path d="M 0 300 A 300 300 0 0 1 [^"]+" class="ve-arc"/);
});

/* ── 2. L'heure et le jour ── */
await dit('l’heure du poste, sans secondes : « 10:42 » ; le jour en français : « Vendredi 30 octobre »', () => {
  const d = new Date(2026, 9, 30, 10, 42, 37);
  assert.equal(T.heureVeille(d, 'fr'), '10:42');
  assert.equal(T.heureVeille(new Date(2026, 9, 30, 8, 5, 59), 'fr'), '08:05');
  assert.equal(T.jourVeille(d, 'fr'), 'Vendredi 30 octobre');
  const html = vue();
  assert.match(html, /<time class="ve-heure" dateTime="10:42"[^>]*>10:42<\/time>/);
  assert.match(html, /<p class="ve-jour"[^>]*>Vendredi 30 octobre<\/p>/);
  assert.doesNotMatch(texte(html), /\d{1,2}:\d{2}:\d{2}/, 'aucune seconde nulle part');
  // L'horloge se réveille à la minute pleine, pas toutes les secondes.
  assert.equal(T.avantLaMinute(new Date(2026, 9, 30, 10, 42, 30, 0)), 30_000);
  const ecran = sansCommentaires(lire(`${DIR}/EcranDeVeille.tsx`));
  assert.match(ecran, /avantLaMinute\(new Date\(\)\)/);
  assert.doesNotMatch(ecran, /setInterval\([^)]*1_?000\)/);
});

/* ── 3. Les textes exacts ── */
await dit('les textes de la maquette, mot pour mot (aperçu de l’image : verrou allumé)', () => {
  const t = texte(vue({ verrouApresMin: 15, verrouille: true }));
  for (const s of [
    '12', '18', '00', '06', 'A', 'Produit', 'Espace verrouillé', '10:42', 'Vendredi 30 octobre', 'La Garde veille', '·', 'tout est en ordre', 'prochaine ronde', '12:30',
    'Bougez la souris ou appuyez sur une touche pour reprendre', 'Veille après 5 min · verrouillage après 15 min', 'Réglages · Écran de veille',
  ]) assert.ok(t.includes(s), `« ${s} » absent`);
  assert.equal(M.dictionnaires.fr.calque, 'Écran de veille. Appuyez sur une touche pour reprendre.');
  // Le nom de la marque est celui de l'édition, jamais une chaîne figée.
  assert.match(sansCommentaires(lire(`${DIR}/EcranDeVeille.tsx`)), /produit=\{EDITION_PRODUCT_NAME\}/);
});

await dit('sans verrou réel (l’écran branché) : ni « Espace verrouillé », ni « verrouillage après » ; le pied dit seulement « Veille après N min »', () => {
  const html = vue({ veilleMin: 10 });
  assert.doesNotMatch(html, /Espace verrouillé|verrouillage après|ve-verrou/);
  assert.match(html, /<p class="ve-pied__delais">Veille après 10 min<\/p>/);
  const ecran = sansCommentaires(lire(`${DIR}/EcranDeVeille.tsx`));
  assert.match(ecran, /verrouApresMin=\{null\}/);
  assert.match(ecran, /verrouille=\{false\}/);
  // Aucune logique d'authentification ni de verrou créée.
  for (const f of fichiersVeille) assert.doesNotMatch(sansCommentaires(lire(f)), /useAuth|logout|signOut|deconnect|AuthContext|navigate\(/, f);
});

await dit('les états de la pastille : orange, rouge sans détail et point fixe, hors ligne, sans réponse ; la couleur n’est jamais seule', () => {
  const ok = vue();
  assert.match(ok, /class="ve-pastille" data-etat="calme" role="status"/);
  assert.match(ok, /data-ton="ok"[\s\S]*?data-mvt="onde"/, 'au vert, le point vit');
  const orange = vue({ etat: 'attention' });
  assert.match(texte(orange), /La Garde veille · un point demande votre attention · prochaine ronde 12:30/);
  assert.match(orange, /data-ton="attention"/);
  assert.doesNotMatch(extraire(orange, /<p class="ve-pastille"[\s\S]*?<\/p>/), /data-mvt="onde"/, 'à l’orange, point fixe');
  const rouge = vue({ etat: 'critique' });
  const pastilleRouge = extraire(rouge, /<p class="ve-pastille"[\s\S]*?<\/p>/);
  assert.match(texte(pastilleRouge), /^ ?La Garde veille · une alerte critique ?$/);
  assert.doesNotMatch(pastilleRouge, /data-mvt="onde"|prochaine ronde|12:30/, 'au rouge : point fixe, aucun détail');
  assert.match(pastilleRouge, /data-ton="critique"/);
  const hl = vue({ etat: 'horsLigne' });
  assert.match(texte(hl), /Hors connexion · La Garde reprend au retour du réseau/);
  assert.match(hl, /10:42/, 'hors ligne, l’heure reste');
  assert.doesNotMatch(extraire(hl, /<p class="ve-pastille"[\s\S]*?<\/p>/), /prochaine ronde|data-mvt="onde"/);
  const inconnu = vue({ etat: 'inconnu' });
  assert.match(texte(inconnu), /La Garde ne répond pas/);
  assert.doesNotMatch(inconnu, /tout est en ordre/);
  assert.equal(M.etat.etatPastille('calme', false), 'horsLigne');
  assert.equal(M.etat.etatPastille('critique', true), 'critique');
  const sansRonde = vue({ ronde: null });
  assert.doesNotMatch(sansRonde, /prochaine ronde/, 'sans ronde annoncée, rien n’est inventé');
});

await dit('l’état de La Garde suit la règle de la pastille de l’en-tête (usePoulsGarde) et le réseau du poste', () => {
  const ecran = sansCommentaires(lire(`${DIR}/EcranDeVeille.tsx`));
  assert.match(ecran, /import \{ usePoulsGarde \} from '\.\.\/\.\.\/coquille\/pouls'/);
  assert.match(ecran, /etatPastille\(pouls\.etat, enLigne\)/);
  assert.match(lire('src/refonte/coquille/CoquilleRefonte.tsx'), /usePoulsGarde\(\)/, 'la même règle que la coquille');
});

await dit('la prochaine ronde : la plus proche `prochaineRondeAt` à venir d’une garde active, sinon rien', () => {
  const maintenant = new Date('2026-10-30T10:42:00Z');
  const agents = [
    { actif: true, prochaineRondeAt: '2026-10-30T12:30:00Z' },
    { actif: false, prochaineRondeAt: '2026-10-30T11:00:00Z' },
    { actif: true, prochaineRondeAt: '2026-10-30T10:00:00Z' },
    { actif: true, prochaineRondeAt: null },
    { actif: true, prochaineRondeAt: '2026-10-30T13:00:00Z' },
  ];
  assert.equal(M.etat.prochaineRonde(agents, maintenant)?.toISOString(), '2026-10-30T12:30:00.000Z');
  assert.equal(M.etat.prochaineRonde([], maintenant), null);
  assert.equal(M.etat.prochaineRonde([{ actif: true, prochaineRondeAt: 'pas une date' }], maintenant), null);
  const ecran = sansCommentaires(lire(`${DIR}/EcranDeVeille.tsx`));
  assert.match(ecran, /const \{ salle \} = useSourceBureaux\(\);/, 'de la source des bureaux, seule la Salle est lue');
  assert.match(ecran, /prochaineRonde\(salle\?\.agents \?\? \[\], maintenant\)/);
});

/* ── 4. Aucune donnée de travail ── */
await dit('aucune donnée de travail : la vue ne reçoit qu’un état et deux heures ; aucun magasin de clients, factures, contacts, messages', () => {
  const PERMIS = /^(react|react-dom|framer-motion|lucide-react|@fontsource\/inter\/200\.css|\.\/[\w.]+|\.\.\/\.\.\/\.\.\/socle\/(ui|mots|couche-mouvement|coquille|ui\/vivant\/tons)|\.\.\/\.\.\/coquille\/(pouls|drapeau)|\.\.\/\.\.\/\.\.\/lib\/useInactivite|\.\.\/\.\.\/\.\.\/edition\/edition|\.\.\/\.\.\/\.\.\/bureaux\/donnees\/source|\.\.\/\.\.\/\.\.\/state\/CallContext|\.\.\/\.\.\/\.\.\/assistant\/(AssistantContext|voix))$/;
  for (const f of fichiersVeille.filter((x) => /\.tsx?$/.test(x))) {
    for (const [, i] of sansCommentaires(lire(f)).matchAll(/from '([^']+)'|import '([^']+)'/g)) if (i) assert.match(i, PERMIS, `${f} importe ${i}`);
    // (Les mots, eux, disent la règle : « Aucun nom de client, aucun montant » — ce sont des textes fixes.)
    if (f.endsWith('/i18n.ts')) continue;
    assert.doesNotMatch(sansCommentaires(lire(f)), /useRemoteSites|useOrg|organisations|invoices?|factures?|useContacts|clients?\b|montant|useTasks|useMessages|bridge\(\)/i, `${f} touche une donnée de travail`);
  }
  // La vue et ses briques n'importent que le socle et leurs voisines.
  for (const f of ['VueVeille.tsx', 'DayRing24.tsx', 'WatchOrbit.tsx', 'BigClock.tsx', 'StatusPill.tsx', 'IdleScreen.tsx']) {
    for (const [, i] of sansCommentaires(lire(`${DIR}/${f}`)).matchAll(/from '([^']+)'/g)) assert.match(i, /^(react|react-dom|framer-motion|lucide-react|\.\/[\w.]+|\.\.\/\.\.\/\.\.\/socle\/[\w/-]+)$/, `${f} importe ${i}`);
  }
  // Huit repères anonymes : aucun nom sur l'orbite, même pour faire joli.
  const html = vue();
  assert.equal(compter(html, /class="ve-repere"/g), 8);
  assert.equal(compter(html, /class="ve-repere" data-veille="true"/g), 1);
  assert.doesNotMatch(extraire(html, /<div aria-hidden="true" class="ve-orbites"[\s\S]*?<\/svg>([\s\S]*?)<div aria-hidden="true" class="ve-anneau"/, 1), />[^<\s]+</, 'un repère porte un texte');
});

await dit('les huit repères : angles de la fiche sur l’orbite de 452, le repère en veille tiré au hasard', () => {
  assert.deepEqual([...M.orbite.ANGLES_REPERES], [-158, -126, -52, -20, 24, 50, 134, 160]);
  assert.deepEqual([...M.orbite.RAYONS_ORBITES], [372, 452, 560]);
  const p = M.orbite.placeRepere(-20);
  assert.ok(Math.abs(p.x - 424.7) < 0.2 && Math.abs(p.y + 154.6) < 0.2, `(${p.x}, ${p.y})`);
  assert.equal(M.orbite.tirerRepereEnVeille(() => 0), 0);
  assert.equal(M.orbite.tirerRepereEnVeille(() => 0.999), 7);
  assert.match(sansCommentaires(lire(`${DIR}/EcranDeVeille.tsx`)), /useState\(\(\) => tirerRepereEnVeille\(\)\)/, 'tiré à chaque affichage');
});

/* ── 5. Le déclenchement ── */
await dit('jamais pendant un appel, un partage d’écran, une dictée ou une vidéo ; libre sinon', () => {
  const R = M.blocage.raisonDeBlocage;
  const calme = { phase: 'idle', sharingScreen: false, viewingScreen: false, controlledBy: '', controlling: false, voixEtat: 'inactif', videoEnLecture: false };
  assert.equal(R(calme), null);
  assert.equal(R({ ...calme, phase: 'ended' }), null);
  for (const phase of ['outgoing', 'incoming', 'connecting', 'active']) assert.equal(R({ ...calme, phase }), 'appel', phase);
  assert.equal(R({ ...calme, sharingScreen: true }), 'partage');
  assert.equal(R({ ...calme, viewingScreen: true }), 'partage');
  assert.equal(R({ ...calme, controlledBy: 'x@exemple.test' }), 'partage');
  assert.equal(R({ ...calme, controlling: true }), 'partage');
  assert.equal(R({ ...calme, voixEtat: 'enregistrement' }), 'enregistrement');
  assert.equal(R({ ...calme, voixEtat: 'transcription' }), 'enregistrement');
  assert.equal(R({ ...calme, voixEtat: 'echec' }), null);
  assert.equal(R({ ...calme, videoEnLecture: true }), 'video');
  const doc = (videos: { paused: boolean; ended: boolean }[]) => ({ querySelectorAll: () => videos });
  assert.equal(M.blocage.uneVideoJoue(doc([{ paused: true, ended: false }, { paused: false, ended: true }])), false);
  assert.equal(M.blocage.uneVideoJoue(doc([{ paused: false, ended: false }])), true);
  // Branchement : les vraies sources, et le délai coupé tant que quelque chose bloque.
  const hook = sansCommentaires(lire(`${DIR}/useBlocageVeille.ts`));
  assert.match(hook, /useCall\(\)/);
  assert.match(hook, /useAssistant\(\)/);
  assert.match(hook, /document\.addEventListener\(t, relire, true\)/, 'les événements de média, en capture');
  const ecran = sansCommentaires(lire(`${DIR}/EcranDeVeille.tsx`));
  assert.match(ecran, /const delai = reglage\.actif && blocage === null \? reglage\.veilleMin \* 60_000 : null;/);
  assert.match(ecran, /useInactivite\(delai\)/);
  assert.match(sansCommentaires(lire('src/lib/useInactivite.ts')), /if \(delaiMs === null\) setActif\(false\)/, 'un appel qui arrive referme la veille');
  // Le message vocal (sans état lisible) plafonne sous le plus court délai.
  const plafond = Number(/const MAX_SECONDS = (\d+)/.exec(lire('src/components/team/VoiceRecorder.tsx'))?.[1]);
  assert.ok(plafond > 0 && Math.min(...M.reglage.DELAIS_VEILLE) * 60 > plafond, `${plafond} s`);
});

await dit('`amn:veille-ouverte` part toujours à l’ouverture (nouvel écran comme ancien voile)', () => {
  assert.match(sansCommentaires(lire(`${DIR}/EcranDeVeille.tsx`)), /if \(actif\) window\.dispatchEvent\(new Event\('amn:veille-ouverte'\)\)/);
  assert.match(sansCommentaires(lire('src/components/IdleScreensaver.tsx')), /if \(actif\) window\.dispatchEvent\(new Event\('amn:veille-ouverte'\)\)/);
  assert.match(lire('src/bureaux/ambiance.ts'), /addEventListener\('amn:veille-ouverte', finirSession\)/);
});

/* ── 6. Le réglage H18 ── */
await dit('le réglage : 5 et 15 min par défaut, 0 = jamais, une valeur inconnue reprend le défaut ; clé propre à l’édition interne', () => {
  const R = M.reglage;
  assert.deepEqual({ ...R.REGLAGE_VEILLE_DEFAUT }, { actif: true, veilleMin: 5, verrouMin: 15 });
  assert.deepEqual(R.normaliserReglage({ actif: 'oui', veilleMin: 7, verrouMin: -1 }), { actif: true, veilleMin: 5, verrouMin: 15 });
  assert.deepEqual(R.normaliserReglage({ actif: false, veilleMin: 30, verrouMin: 0 }), { actif: false, veilleMin: 30, verrouMin: 0 });
  assert.ok(R.DELAIS_VERROU.includes(0));
  assert.equal(R.CLE_ECRAN_DE_VEILLE, 'amn.ecranDeVeille');
  assert.notEqual(R.CLE_ECRAN_DE_VEILLE, 'amn.veille.reglages', 'la clé de la vitrine cliente n’est pas touchée');
  assert.match(sansCommentaires(lire(`${DIR}/EcranDeVeille.tsx`)), /reglage\.actif && /, 'désactivée : elle n’apparaît jamais');
});

await dit('la ligne « Écran de veille » des Réglages : interne seulement, interrupteur et deux groupes de délais, défauts cochés', () => {
  const interne = lire('src/edition/socle.internal.tsx');
  assert.match(interne, /<MouvementBloc \/>\s*<EcranDeVeilleSection \/>\s*<CoquilleSection \/>/);
  const cliente = sansCommentaires(lire('src/edition/socle.business.tsx'));
  assert.match(cliente, /export function MouvementSection\(\): null \{\s*return null;/);
  assert.doesNotMatch(cliente, /veille|refonte\//i, 'le jumeau client n’en sait rien');
  assert.doesNotMatch(lire('src/screens/SettingsScreen.tsx'), /EcranDeVeille|systeme\/veille/, 'l’écran partagé ne change pas');
  const html = M.rendre(M.h(M.EcranDeVeilleSection));
  assert.match(html, />Écran de veille</);
  assert.match(html, /<input type="checkbox" role="switch" aria-checked="true"[^>]*checked=""/);
  assert.equal(compter(html, /name="amn-veille-delai"/g), 4);
  assert.equal(compter(html, /name="amn-veille-verrou"/g), 4);
  assert.match(html, /name="amn-veille-delai" checked="" value="5"/);
  assert.match(html, /name="amn-veille-verrou" checked="" value="15"/);
  assert.equal(compter(html, /checked=""/g), 3, 'l’interrupteur et un délai par groupe');
  assert.match(html, />Jamais</);
  assert.match(html, /il ne change rien aujourd’hui/, 'le délai de verrouillage ne promet pas un verrou qui n’existe pas');
});

/* ── 7. Le mouvement ── */
await dit('le mouvement passe par la couche commune et s’arrête avec elle (balayage 60 s, halo 3,6 s, point vivant, entrée échelonnée, dérive)', () => {
  const css = sansCommentaires(lire(`${DIR}/veille.css`));
  assert.doesNotMatch(css, /@keyframes|animation\s*:/, 'aucune animation propre : la couche commune seulement');
  assert.match(css, /\.ve-balayage\[data-mvt='balayage'\] \{[^}]*--sc-mvt-balayage: 60s;/);
  assert.match(css, /\.ve-repere__point \{ --sc-mvt-voyant: 3600ms;/);
  const html = vue();
  assert.equal(compter(html, /data-mvt="balayage"/g), 1);
  assert.equal(compter(html, /data-mvt="entree"/g), 3, 'l’heure, le jour, la pastille');
  assert.equal(compter(html, /data-mvt="onde"/g), 2, 'le repère en veille et le point vivant : au plus trois boucles avec le balayage');
  const mvt = lire('src/socle/mouvement.css');
  assert.match(mvt, /\[data-mouvement='aucun'\] \[data-mvt\],/);
  assert.match(mvt, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\[data-mvt\]/);
  const ecran = sansCommentaires(lire(`${DIR}/EcranDeVeille.tsx`));
  assert.match(ecran, /useMouvementVivant\(\) === 'complet' \? deriveDeLaMinute\(maintenant\) : undefined/, 'la dérive est coupée en mouvement réduit');
  assert.deepEqual([0, 1, 2, 3].map((m) => T.deriveDeLaMinute(new Date(m * 60_000))), [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]);
  assert.match(sansCommentaires(lire(`${DIR}/IdleScreen.tsx`)), /COTES_MOUVEMENT\.fonduCourt\.duree \/ 1000/, 'fondu de 200 ms à la reprise');
});

/* ── 8. Le noir et le calque ── */
await dit('le noir absolu ne fuit pas : un jeton dédié, lu par veille.css seulement', () => {
  assert.match(lire('src/socle/noir.css'), /--socle-veille-noir: #000000;/);
  const tous: string[] = [];
  const parcourir = (d: string) => {
    for (const e of fs.readdirSync(path.join(racine, d), { withFileTypes: true })) {
      const rel = `${d}/${e.name}`;
      if (e.isDirectory()) parcourir(rel);
      else if (/\.(css|tsx?)$/.test(e.name)) tous.push(rel);
    }
  };
  parcourir('src');
  for (const f of tous) {
    const s = sansCommentaires(lire(f));
    if (/--socle-veille-/.test(s)) assert.ok(f === `${DIR}/veille.css` || f === 'src/socle/noir.css', `${f} lit un jeton de la veille`);
  }
  for (const f of tous.filter((x) => x.startsWith('src/socle/') || x.startsWith('src/refonte/'))) {
    const s = sansCommentaires(lire(f)).replace(/--socle-veille-noir: #000000;/, '');
    assert.doesNotMatch(s, /#000(000)?\b(?![0-9a-f])|bg-black\b|rgb\(0,\s*0,\s*0\)/i, `${f} pose du noir absolu`);
  }
});

await dit('le calque : portail vers <body>, au-dessus de toute la pile (z-index), dialogue modal annoncé, gestes pris en capture, focus rendu', () => {
  const idle = sansCommentaires(lire(`${DIR}/IdleScreen.tsx`));
  assert.match(idle, /createPortal\([\s\S]*document\.body/);
  assert.match(idle, /role="dialog"[\s\S]*aria-modal="true"[\s\S]*aria-label=\{libelle\}/);
  assert.match(idle, /capture: true, passive: false/);
  assert.match(idle, /stopImmediatePropagation\(\)/);
  assert.match(idle, /'keydown', 'mousedown', 'pointerdown', 'touchstart'/);
  assert.match(idle, /avalerLaSuite\(\)/, 'le clic qui suit la reprise est avalé');
  assert.match(idle, /precedent\.focus\(/, 'le focus revient à l’élément qui l’avait');
  assert.doesNotMatch(idle, /inscrireCalque/, 'Échap reprend, il ne ferme pas un autre calque');
  const zVeille = Number(/\.ve \{[^}]*z-index: (\d+)/.exec(sansCommentaires(lire(`${DIR}/veille.css`)))?.[1]);
  let zMax = 0;
  const parcourir = (d: string) => {
    for (const e of fs.readdirSync(path.join(racine, d), { withFileTypes: true })) {
      const rel = `${d}/${e.name}`;
      if (e.isDirectory()) parcourir(rel);
      else if (/\.(css|tsx?)$/.test(e.name) && rel !== `${DIR}/veille.css`) {
        for (const m of lire(rel).matchAll(/z-\[(\d+)\]|z-index:\s*(\d+)|zIndex:\s*(\d+)/g)) zMax = Math.max(zMax, Number(m[1] ?? m[2] ?? m[3]));
      }
    }
  };
  parcourir('src');
  assert.ok(zVeille > zMax * 1000, `veille ${zVeille}, le plus haut ailleurs ${zMax}`);
  assert.equal(M.dictionnaires.fr.calque, 'Écran de veille. Appuyez sur une touche pour reprendre.');
});

await dit('lecteur d’écran : seuls l’heure, le jour et l’état de La Garde sont lus ; le reste est décoratif', () => {
  const html = vue({ verrouApresMin: 15, verrouille: true });
  for (const c of ['ve-orbites', 've-anneau', 've-marque', 've-pied', 've-verrou']) assert.match(html, new RegExp(`aria-hidden="true" class="${c}"`), c);
  assert.doesNotMatch(extraire(html, /<time class="ve-heure"[^>]*>/), /aria-hidden/);
  assert.match(html, /role="status"/);
  assert.equal(compter(html, /<a |<button/g), 0, '« Réglages · Écran de veille » est un rappel, pas un lien');
});

await dit('contraste : l’heure (T1), le jour et la consigne (T3), le pied et les étiquettes (T4) tiennent 4,5:1 sur #000', () => {
  const j = jetons(lire('src/socle/noir.css'));
  const noir = j.get('--socle-veille-noir') ?? '';
  assert.equal(noir, '#000000');
  for (const n of ['--socle-texte-1', '--socle-texte-courant', '--socle-texte-2', '--socle-texte-3']) assert.ok(rapportContraste(j.get(n) ?? '#000000', noir) >= 4.5, `${n} : ${rapportContraste(j.get(n) ?? '#000000', noir).toFixed(2)}:1`);
  const css = sansCommentaires(lire(`${DIR}/veille.css`));
  for (const m of css.matchAll(/(?:^|[;{\s])color\s*:\s*([^;}]+)/g)) assert.doesNotMatch(m[1], /trait-discret|veille-/, `texte en ${m[1]}`);
});

/* ── 9. La bascule ── */
await dit('coquille allumée → G09 ; coquille éteinte → le voile d’avant (la Salle de situation), inchangé', () => {
  const s = sansCommentaires(lire('src/components/IdleScreensaver.tsx'));
  assert.match(s, /const coquille = useCoquilleActive\(\);\s*return coquille \? <EcranDeVeille \/> : <VoileSalle \/>;/);
  assert.match(s, /import \{ EcranDeVeille, useCoquilleActive \} from '@edition\/coquille';/, 'par la couture de la coquille, jamais en direct');
  assert.match(lire('src/edition/coquille.internal.tsx'), /export \{ EcranDeVeille \} from '\.\.\/refonte\/systeme\/veille\/EcranDeVeille';/);
  const jumeau = sansCommentaires(lire('src/edition/coquille.business.tsx'));
  assert.match(jumeau, /export function EcranDeVeille\(\): null \{\s*return null;/, 'côté cliente, l’écran de veille v3 ne rend rien');
  assert.doesNotMatch(jumeau, /from '[^']*refonte/, 'le jumeau client n’importe rien de la refonte');
  assert.match(s, /function VoileSalle\(\) \{\s*const \{ actif, reveiller \} = useInactivite\(IDLE_MS\);/);
  assert.match(s, /const IDLE_MS = 4 \* 60_000;/);
  assert.match(s, /<SalleDeSituation enVeille \/>/);
  assert.match(lire('src/refonte/coquille/drapeau.ts'), /return window\.localStorage\.getItem\(CLE_COQUILLE\) === 'noir';/, 'la coquille reste éteinte par défaut');
  assert.match(lire('src/edition/coquille.business.tsx'), /export function useCoquilleActive\(\): boolean \{\s*return false;/);
});

fin();
