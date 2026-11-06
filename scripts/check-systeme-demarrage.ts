/**
 * Contrôle de DÉMARRAGE (H42) et du CHOIX DU MÉTIER (H47) — sans navigateur, sans build, sans réseau.
 *
 *   npm run check:systeme-demarrage
 *
 * Il tient ce qu'une capture ne voit pas :
 *   · les huit modèles (des données) : chaque identifiant existe au registre, « + N autres » se calcule, les cartes
 *     d'aperçu sont des exemples sans nom propre ni montant ;
 *   · les allègements : les modules qui ne s'allègent jamais ne le sont jamais, au moins un module reste activé,
 *     rien n'est supprimé ;
 *   · les étapes : n / N, pluriel et singulier, 6 sur 6, étape conseillée, « pas pour moi », jamais « redevenue à
 *     faire », « Seul » masque l'équipe ;
 *   · le rendu statique des deux vues : rôles ARIA, un seul bouton primaire par état, un seul h1, aucun barré
 *     sur une étape faite ;
 *   · les cotes des fiches, lues dans `demarrage.css` ; aucune couleur en dur, aucune encre « discret » en texte,
 *     aucun nom d'exemple des fiches dans les sources.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { assert, creerEssais, lire, racine, sansCommentaires } from './lib/essai-socle.ts';

const { dit, fin } = creerEssais('Démarrage (H42) et choix du métier (H47)');

const DIR = 'src/refonte/systeme/demarrage';
const sources = fs.readdirSync(path.join(racine, DIR)).filter((f) => /\.(tsx?|css)$/.test(f)).sort();
const lireSource = (f: string): string => lire(`${DIR}/${f}`);
const codes = sources.filter((f) => /\.tsx?$/.test(f));

/* ── Le chargement : comme `charger`, mais sans les feuilles de style (esbuild n'en a que faire ici) ── */
async function chargerAvecCss<T>(code: string): Promise<T> {
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
    define: {
      'process.env.NODE_ENV': '"production"',
      'import.meta.env.DEV': 'false',
      'import.meta.env.VITE_AMN_WEB_URL': '""',
      __AMN_EDITION__: '"internal"',
      __AMN_VERSION__: '"0.0.0"',
    },
    logLevel: 'silent',
  });
  return (await import(`data:text/javascript;charset=utf-8;base64,${Buffer.from(construit.outputFiles[0].text, 'utf8').toString('base64')}`)) as T;
}

/* ── Le registre : les déclarations du dossier, assemblées sans Vite (comme `check:navigation`) ── */
const declarations = fs.readdirSync(path.join(racine, 'src/refonte/modules/declarations')).filter((f) => f.endsWith('.ts')).sort();
interface VueR { id: string; route: string }
interface EntreeR { id: string; nom?: { fr: string; en: string }; teinte: string; vues: readonly VueR[] }
const { registre } = await chargerAvecCss<{ registre: { entrees: readonly EntreeR[]; vues: readonly VueR[]; fautes: readonly string[] } }>(
  [
    "import { assembler } from '../src/refonte/modules/assembler';",
    ...declarations.map((f, i) => `import d${i} from '../src/refonte/modules/declarations/${f.replace(/\.ts$/, '')}';`),
    `export const registre = assembler([${declarations.map((f, i) => `{ chemin: 'declarations/${f}', declaration: d${i} }`).join(',')}]);`,
  ].join('\n'),
);
const idsEntrees = new Set(registre.entrees.map((e) => e.id));
const routesDuRegistre = new Set(registre.vues.map((v) => v.route));
const { catalogueCles, TOUJOURS } = await chargerAvecCss<{ catalogueCles: string[]; TOUJOURS: string[] }>(
  [
    "import { NAV_SECTIONS } from '../src/edition/modules.internal';",
    "import { ALWAYS_ON_MODULES } from '../src/data/spaces';",
    'export const catalogueCles = NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.key));',
    'export const TOUJOURS = [...ALWAYS_ON_MODULES];',
  ].join('\n'),
);

/* ── Le code de la zone, en un seul paquet : mêmes instances pour tout ── */
/* eslint-disable @typescript-eslint/no-explicit-any */
const Z = await chargerAvecCss<Record<string, any>>(
  [
    "import { createElement as h } from 'react';",
    "import { renderToStaticMarkup } from 'react-dom/server.browser';",
    "import { MemoryRouter } from 'react-router-dom';",
    "export * from '../src/refonte/systeme/demarrage/modeles';",
    "export * from '../src/refonte/systeme/demarrage/metier';",
    "export * from '../src/refonte/systeme/demarrage/etapes';",
    "export * from '../src/refonte/systeme/demarrage/memoire';",
    "export * from '../src/refonte/systeme/demarrage/chemins';",
    "export { MOTS_FR, MOTS_EN, traduire } from '../src/refonte/systeme/demarrage/i18n';",
    "export { VueDemarrage, SqueletteDemarrage, LienMobile, PapierBrouillon } from '../src/refonte/systeme/demarrage/VueDemarrage';",
    "export { presentationDemarrage, MODULES_DANS_LA_BARRE } from '../src/refonte/systeme/demarrage/presentation';",
    "export { VueMetier, SqueletteMetier } from '../src/refonte/systeme/demarrage/VueMetier';",
    'export { h };',
    'export const rendre = (el) => renderToStaticMarkup(h(MemoryRouter, null, el));',
  ].join('\n'),
);
const { h, rendre } = Z;
const R = Z as Record<string, any>;

type Libelle = { fr: string; en: string };
interface Modele {
  id: string; nom: Libelle; description: Libelle; icone: string; modules: string[];
  vocabulaire?: Record<string, Libelle>;
  apercu: { etiquette: Libelle; module: string; titre: Libelle; detail: Libelle }[];
  etapes: Record<'client' | 'devis' | 'paiement', { titre: Libelle; sous: Libelle; action: Libelle; vers: string; mesure?: string }>;
}
const MODELES: Modele[] = R.MODELES;
const compter = (html: string, re: RegExp): number => (html.match(re) ?? []).length;
/** Les boutons d'un rendu : leurs attributs et leur texte (sans les balises). */
const boutons = (html: string): { attrs: string; texte: string }[] => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[1], texte: m[2].replace(/<[^>]*>/g, '').trim() }));
const bouton = (html: string, texte: string): { attrs: string; texte: string } => {
  const b = boutons(html).find((x) => x.texte === texte);
  assert.ok(b, `bouton « ${texte} » introuvable`);
  return b as { attrs: string; texte: string };
};
const primaires = (html: string): number => compter(html, /data-variante="primaire"/g);

/* ═════════════════════════ H47 · les modèles ═════════════════════════ */

await dit('huit familles, dans l’ordre de la fiche, avec leurs titres et leurs descriptions exacts, en français et en anglais', () => {
  const attendu: [string, string][] = [
    ['Conseil et services', 'clients, missions, factures'], ['Artisan du bâtiment', 'chantiers, devis, stock'], ['Commerce', 'stock, fournisseurs, avis'],
    ['Start-up', 'tickets, tableau, équipe'], ['Création et agence', 'projets, visuels, signatures'], ['Vie de tous les jours', 'courses, budget, rendez-vous'],
    ['Santé et bien-être', 'agenda, dossiers, rappels'], ['Association', 'membres, annonces, dons'],
  ];
  assert.deepEqual(MODELES.map((m) => [m.nom.fr, m.description.fr]), attendu);
  assert.equal(new Set(MODELES.map((m) => m.id)).size, 8);
  assert.deepEqual(MODELES.map((m) => m.icone), ['utilisateurs', 'camion', 'cube', 'eclair', 'etincelle', 'maison', 'calendrier', 'livre']);
  for (const m of MODELES) for (const t of [m.nom, m.description]) assert.ok(t.fr.trim() && t.en.trim(), `${m.id} : texte sans fr ou sans en`);
});

await dit('le registre est sain (101 entrées) et CHAQUE identifiant de module de chaque modèle y est une entrée — aucun identifiant inventé', () => {
  assert.deepEqual(registre.fautes, []);
  assert.equal(registre.entrees.length, 101);
  for (const m of MODELES) {
    assert.equal(new Set(m.modules).size, m.modules.length, `${m.id} : un module revient deux fois`);
    for (const id of m.modules) assert.ok(idsEntrees.has(id), `${m.id} : « ${id} » n’est pas une entrée du registre`);
    for (const id of Object.keys(m.vocabulaire ?? {})) assert.ok(m.modules.includes(id), `${m.id} : le vocabulaire parle de « ${id} », qui n’est pas dans ses modules`);
  }
  for (const id of R.JEU_GENERAL) assert.ok(idsEntrees.has(id), `jeu général : « ${id} » absent du registre`);
  assert.deepEqual(R.JEU_GENERAL, ['home', 'tasks', 'agenda', 'clients', 'invoices', 'binder', 'dm']);
});

await dit('« + N autres » = modules du modèle moins six, jamais écrit à la main ; N = 0 quand tout est affiché ; les modules fermés à l’organisation ne comptent pas', () => {
  for (const m of MODELES) {
    assert.ok(m.modules.length >= 6, `${m.id} : moins de six modules`);
    const c = R.composition(m);
    assert.equal(c.affiches.length, 6);
    assert.deepEqual(c.affiches, m.modules.slice(0, 6));
    assert.equal(c.autres, m.modules.length - 6);
    assert.equal(R.nombreAutres(m), m.modules.length - 6);
  }
  const six = { ...MODELES[0], modules: MODELES[0].modules.slice(0, 6) };
  assert.equal(R.composition(six).autres, 0);
  const artisanM = R.modeleParId('artisan') as Modele;
  const ferme = new Set(artisanM.modules.filter((id) => id !== 'stock'));
  assert.equal(R.composition(artisanM, ferme).tous.includes('stock'), false);
  assert.equal(R.composition(artisanM, ferme).autres, artisanM.modules.length - 1 - 6);
  assert.equal(R.MODULES_AFFICHES, 6);
});

await dit('la maquette : l’artisan montre chantiers, facturation, clients, stock, calendrier ; la santé met droits et coffre-fort dans ses premières lignes', () => {
  const artisan = MODELES.find((m) => m.id === 'artisan') as Modele;
  for (const id of ['assembly', 'invoices', 'stock', 'clients', 'agenda']) assert.ok(artisan.modules.slice(0, 6).includes(id), id);
  const sante = MODELES.find((m) => m.id === 'sante') as Modele;
  assert.ok(sante.modules.slice(0, 6).includes('vault') && sante.modules.slice(0, 6).includes('members'));
  assert.equal(MODELES.find((m) => m.id === 'association')?.vocabulaire?.clients?.fr, 'Membres');
  assert.equal(sante.vocabulaire?.clients?.fr, 'Dossiers');
});

await dit('les cartes d’aperçu : trois par modèle, un module du registre chacune, des exemples génériques sans nom propre ni montant', () => {
  for (const m of MODELES) {
    assert.equal(m.apercu.length, 3, m.id);
    for (const c of m.apercu) {
      assert.ok(idsEntrees.has(c.module), `${m.id} : l'aperçu parle de « ${c.module} »`);
      assert.ok(m.modules.includes(c.module), `${m.id} : l'aperçu parle d'un module que le modèle n'active pas (${c.module})`);
      for (const t of [c.etiquette, c.titre, c.detail]) {
        assert.ok(t.fr.trim() && t.en.trim());
        assert.doesNotMatch(`${t.fr} ${t.en}`, /€|\$|\bEUR\b|\d\s?\d{3}\b|\b[A-Z][a-zé]+,\s/, `${m.id} : montant ou nom propre dans « ${t.fr} »`);
      }
    }
  }
});

await dit('étapes 2, 3 et 5 de chaque métier : textes fr et en, destination qui existe, mesure connue ; la maquette vaut pour l’artisan', () => {
  const connues = new Set(['quotes', 'tasks', 'appointments', 'manuel']);
  for (const m of [...MODELES, { id: 'defaut', etapes: R.ETAPES_PAR_DEFAUT } as Modele]) {
    for (const cle of ['client', 'devis', 'paiement'] as const) {
      const e = m.etapes[cle];
      for (const t of [e.titre, e.sous, e.action]) assert.ok(t.fr.trim() && t.en.trim(), `${m.id}.${cle}`);
      assert.ok(routesDuRegistre.has(e.vers), `${m.id}.${cle} : la route ${e.vers} n'existe pas`);
    }
    assert.ok(connues.has(m.etapes.devis.mesure as string), `${m.id} : mesure inconnue`);
  }
  const d = R.ETAPES_PAR_DEFAUT;
  assert.equal(d.client.titre.fr, 'Ajouter vos clients');
  assert.equal(d.devis.titre.fr, 'Créer votre premier devis');
  assert.equal(d.devis.sous.fr, 'Ajmani vous guide, 2 minutes');
  assert.equal(d.devis.action.fr, 'Créer le devis');
  assert.equal(d.devis.texte.fr, 'Je prépare un devis type pour votre métier, vous n’avez qu’à relire et ajuster. Comptez deux minutes.');
  assert.equal(d.paiement.titre.fr, 'Connecter vos encaissements');
  assert.deepEqual([d.client.duree, d.devis.duree, d.paiement.duree], [2, 2, 3]);
  assert.equal(d.paiement.action.fr, 'Connecter');
  assert.equal(MODELES.find((m) => m.id === 'association')?.etapes.client.titre.fr, 'Ajouter votre premier membre');
  assert.equal(MODELES.find((m) => m.id === 'association')?.etapes.devis.titre.fr, 'Annoncer votre première activité');
  assert.equal(R.etapesDuMetier(null), d);
});

await dit('quatre tailles d’équipe (défaut « 2 à 5 ») ; les flèches parcourent la grille de huit tuiles, bornées, Début et Fin', () => {
  assert.deepEqual([...R.TAILLES], ['seul', '2-5', '6-20', 'plus']);
  assert.equal(R.TAILLE_DEFAUT, '2-5');
  assert.equal(R.estTaille('plus'), true);
  assert.equal(R.estTaille('2 à 5'), false);
  const v = (i: number, t: string) => R.tuileVoisine(i, t, 4, 8);
  assert.equal(v(0, 'ArrowRight'), 1); assert.equal(v(7, 'ArrowRight'), 7); assert.equal(v(0, 'ArrowLeft'), 0);
  assert.equal(v(1, 'ArrowDown'), 5); assert.equal(v(5, 'ArrowUp'), 1); assert.equal(v(5, 'ArrowDown'), 5); assert.equal(v(1, 'ArrowUp'), 1);
  assert.equal(v(3, 'Home'), 0); assert.equal(v(3, 'End'), 7); assert.equal(v(3, 'a'), null);
  assert.equal(R.tuileVoisine(1, 'ArrowDown', 2, 8), 3, 'à deux colonnes, une rangée = 2 tuiles');
});

/* ═════════════════════════ H47 · les allègements ═════════════════════════ */

await dit('allègements : tout ce qui n’est pas activé s’allège, rien d’autre — les toujours-ouverts, les fermés et ce qui n’est pas au catalogue restent hors de la liste', () => {
  const geler = JSON.parse(JSON.stringify(registre));
  for (const m of MODELES) {
    const actifs = m.modules;
    const sortie: string[] = R.calculerAllegements(actifs, registre, catalogueCles, { toujoursOuverts: TOUJOURS });
    assert.equal(new Set(sortie).size, sortie.length, `${m.id} : doublon`);
    for (const k of sortie) {
      assert.ok(catalogueCles.includes(k), `${m.id} : « ${k} » n'est pas au catalogue`);
      assert.ok(!TOUJOURS.includes(k), `${m.id} : « ${k} » ne s'allège jamais (ALWAYS_ON_MODULES)`);
    }
    for (const e of registre.entrees) {
      const vuesAuCatalogue = e.vues.map((v) => v.id).filter((k) => catalogueCles.includes(k) && !TOUJOURS.includes(k));
      if (actifs.includes(e.id)) for (const k of vuesAuCatalogue) assert.ok(!sortie.includes(k), `${m.id} : « ${k} » est activé et pourtant allégé`);
      else for (const k of vuesAuCatalogue) assert.ok(sortie.includes(k), `${m.id} : « ${k} » n'est pas activé et reste affiché`);
    }
    assert.ok(sortie.length < catalogueCles.length, `${m.id} : tout est allégé`);
  }
  assert.deepEqual(registre, geler, 'le registre ne doit pas bouger : rien n’est supprimé');
  for (const k of TOUJOURS) assert.ok(!R.calculerAllegements(['clients'], registre, catalogueCles, { toujoursOuverts: TOUJOURS }).includes(k), k);
});

await dit('au moins un module reste activé : une liste vide n’allège rien, un seul module activé n’allège que le reste ; un module fermé à l’organisation n’est pas touché', () => {
  assert.deepEqual(R.calculerAllegements([], registre, catalogueCles, { toujoursOuverts: TOUJOURS }), []);
  const un: string[] = R.calculerAllegements(['clients'], registre, catalogueCles, { toujoursOuverts: TOUJOURS });
  assert.ok(!un.includes('clients'));
  assert.ok(un.includes('invoices') && un.includes('reminders'), 'toutes les vues d’une entrée non activée sont allégées');
  const sansFerme: string[] = R.calculerAllegements(['clients'], registre, catalogueCles, { toujoursOuverts: TOUJOURS, fermes: ['invoices'] });
  assert.ok(!sansFerme.includes('invoices') && sansFerme.includes('reminders'));
  assert.deepEqual(R.calculerAllegements(['clients'], { entrees: [{ id: 'x', vues: [{ id: 'inconnu' }] }] }, catalogueCles), []);
});

/* ═════════════════════════ H47 · le magasin du métier ═════════════════════════ */

function fauxStockage(refuse = false) {
  const m = new Map<string, string>();
  const evts: string[] = [];
  const stock = {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => { if (refuse) throw new Error('quota'); m.set(k, v); },
  };
  (globalThis as any).window = { localStorage: stock, dispatchEvent: (e: Event) => { evts.push(e.type); return true; }, addEventListener: () => undefined, removeEventListener: () => undefined };
  return { m, evts };
}

await dit('le choix du métier est gardé par compte (amn.metier.<adresse>), relu validé, avec la même référence tant que rien ne change ; un refus du stockage se dit', () => {
  const { m, evts } = fauxStockage();
  assert.equal(R.cleMetier('a@b.c'), 'amn.metier.a@b.c');
  assert.equal(R.lireMetier('a@b.c'), null);
  const choix = R.choixDepuisSelection('artisan', '6-20', ['clients', 'stock', 'clients'], '2026-10-31T00:00:00.000Z');
  assert.deepEqual(choix, { modele: 'artisan', taille: '6-20', modules: ['clients', 'stock'], passe: false, le: '2026-10-31T00:00:00.000Z' });
  assert.equal(R.ecrireMetier('a@b.c', choix), true);
  assert.ok(evts.includes('amn:metier'));
  const lu = R.lireMetier('a@b.c');
  assert.deepEqual(lu, choix);
  assert.equal(R.lireMetier('a@b.c'), lu, 'même référence : useSyncExternalStore ne boucle pas');
  assert.equal(R.lireMetier('autre@b.c'), null, 'par compte');
  m.set('amn.metier.a@b.c', '{pas du json');
  assert.equal(R.lireMetier('a@b.c'), null);
  const passe = R.choixPasse('seul', 'x');
  assert.deepEqual([passe.modele, passe.passe, passe.taille], [null, true, 'seul']);
  assert.deepEqual(passe.modules, R.JEU_GENERAL);
  assert.equal(R.lireChoix({ modele: 'x', modules: 'pas une liste' }), null);
  assert.equal(R.lireChoix({ modele: null, modules: [], passe: false }), null, 'sans modèle, seul « passer » est valable');
  assert.equal(R.lireChoix({ modele: 'x', modules: ['a'], taille: 'énorme' }).taille, '2-5');
  assert.equal(R.lireChoix(null), null);
  fauxStockage(true);
  assert.equal(R.ecrireMetier('a@b.c', choix), false, 'un stockage qui refuse ne ment pas');
  delete (globalThis as any).window;
});

/* ═════════════════════════ H42 · les étapes ═════════════════════════ */

const DV = R.DONNEES_VIDES;
const artisan = { modele: R.modeleParId('artisan'), taille: '2-5', passe: false };
const calc = (o: Partial<{ metier: unknown; donnees: unknown; memoire: unknown }> = {}) => R.calculerEtapes({ metier: artisan, donnees: DV, memoire: R.MEMOIRE_VIDE, ...o });
const ids = (r: { etapes: { id: string }[] }) => r.etapes.map((e) => e.id);

await dit('six étapes par défaut, dans l’ordre ; sans rien, 0/6, l’étape du métier est la conseillée et la seule', () => {
  const r = calc({ metier: null });
  assert.deepEqual(ids(r), ['metier', 'client', 'devis', 'equipe', 'paiement', 'mobile']);
  assert.deepEqual([r.n, r.total, r.restantes, r.ratio, r.tout], [0, 6, 6, 0, false]);
  assert.equal(r.conseillee, 'metier');
  assert.equal(r.etapes.filter((e: any) => e.conseillee).length, 1);
  assert.equal(r.texte, 'plusieurs');
});

await dit('détection par les données : un métier, un client, un devis, deux personnes (invitées comprises) — rien d’autre ne coche', () => {
  let r = calc({ donnees: { ...DV, clients: 3 } });
  assert.deepEqual([r.n, r.total], [2, 6]);
  assert.equal(r.conseillee, 'devis', 'la première non faite, pas forcément la 3e');
  r = calc({ donnees: { ...DV, clients: 1, quotes: 1 } });
  assert.deepEqual([r.n, r.conseillee], [3, 'equipe']);
  r = calc({ donnees: { ...DV, membres: 1 } });
  assert.equal(r.etapes.find((e: any) => e.id === 'equipe').faite, false, 'une seule personne : pas d’équipe');
  r = calc({ donnees: { ...DV, membres: 2 } });
  assert.equal(r.etapes.find((e: any) => e.id === 'equipe').faite, true, 'moi + un invité = deux');
  r = calc({ donnees: { ...DV, tasks: 9, appointments: 9 } });
  assert.equal(r.n, 1, 'des tâches ni des rendez-vous ne cochent le devis d’un artisan');
  for (const id of ['paiement', 'mobile']) assert.equal(calc({ donnees: { clients: 9, quotes: 9, tasks: 9, appointments: 9, membres: 9 } }).etapes.find((e: any) => e.id === id).manuelle, true, `${id} se marque à la main`);
});

await dit('le compte, les durées et l’étape suivante : « 2 sur 6 prêtes », « environ 7 min pour le reste », « maintenant », « ensuite » ; 6 sur 6 : plus aucune conseillée', () => {
  const faites = { clients: 1, quotes: 1, tasks: 0, appointments: 0, membres: 2 };
  const base = { donnees: faites, memoire: { faites: ['paiement'], retirees: [] } };
  const deux = calc({ donnees: { ...DV, clients: 1 } });
  assert.deepEqual([deux.n, deux.total, deux.restantes, deux.conseillee, deux.suivante], [2, 6, 4, 'devis', 'equipe']);
  assert.deepEqual(deux.etapes.map((e: any) => e.duree), [1, 2, 2, 1, 3, 1], 'les durées fixes du modèle (2, 3, 5) et des étapes communes');
  assert.deepEqual(deux.etapes.map((e: any) => e.rang), [1, 2, 3, 4, 5, 6]);
  assert.equal(deux.minutesRestantes, 7, '2 + 1 + 3 + 1 : la somme des étapes encore à faire');
  assert.equal(R.traduire('fr', 'resume.pretes', { n: 2, total: 6 }), '2 sur 6 prêtes');
  assert.equal(R.traduire('fr', 'resume.duree', { n: 7 }), 'environ 7 min');
  assert.equal(R.traduire('fr', 'statut.maintenant', { n: 2 }), 'maintenant · 2 min');
  assert.equal(R.traduire('fr', 'statut.ensuite', { n: 1 }), 'ensuite · 1 min');
  const une = calc(base);
  assert.deepEqual([une.n, une.restantes, une.texte, une.conseillee, une.suivante, une.minutesRestantes], [5, 1, 'une', 'mobile', null, 1]);
  const tout = calc({ ...base, memoire: { faites: ['paiement', 'mobile'], retirees: [] } });
  assert.deepEqual([tout.n, tout.total, tout.tout, tout.ratio, tout.conseillee, tout.suivante, tout.minutesRestantes, tout.texte], [6, 6, true, 1, null, null, 0, 'tout']);
  assert.equal(tout.etapes.some((e: any) => e.conseillee), false, 'à 6/6, plus aucune étape conseillée');
  assert.equal(R.traduire('fr', 'texte.tout'), 'Tout est en place. Vous pouvez compter sur Ajmani pour la suite.');
  assert.equal(R.traduire('fr', 'pret', { prenom: 'Camille' }), 'Votre espace est prêt, Camille');
  assert.equal(R.traduire('fr', 'sous.prenom', { prenom: 'Camille' }), 'Bienvenue Camille, votre espace se prépare avec vous, sans pression');
  const retire = calc({ donnees: { ...DV, clients: 1 }, memoire: { faites: [], retirees: ['equipe'] } });
  assert.deepEqual([retire.total, retire.suivante, retire.etapes.map((e: any) => e.rang).join('')], [5, 'paiement', '12345'], 'une étape retirée sort du rang et du total');
});

await dit('« Plus tard » dans la carte : l’étape à faire suivante, en revenant au début ; « Annuler » ne remet que l’étape retirée', () => {
  const r = calc({ donnees: { ...DV, clients: 1 } });
  assert.equal(R.etapeApres(r.etapes, 'devis'), 'equipe');
  assert.equal(R.etapeApres(r.etapes, 'mobile'), 'devis', 'après la dernière, on revient à la première à faire');
  assert.equal(R.etapeApres(calc({ donnees: { clients: 1, quotes: 1, tasks: 0, appointments: 0, membres: 2 }, memoire: { faites: ['paiement'], retirees: [] } }).etapes, 'mobile'), null);
  const m = { faites: [], retirees: ['equipe', 'mobile'] };
  assert.deepEqual(R.remettreEtape(m, 'mobile'), { faites: [], retirees: ['equipe'] });
  assert.equal(R.remettreEtape(R.MEMOIRE_VIDE, 'mobile'), R.MEMOIRE_VIDE);
});

await dit('ce que la page montre vient des vraies données, ligne par ligne : métier, nombre de clients, premier client, lignes types SANS prix, « Déjà prêt » vrai ou absent', () => {
  const conseil = R.modeleParId('conseil');
  const metier = { modele: 'conseil', taille: '2-5', modules: conseil.modules.slice(0, 9), passe: false, le: '' };
  const calcul = R.calculerEtapes({ metier: { modele: conseil, taille: '2-5', passe: false }, donnees: { ...DV, clients: 4 }, memoire: R.MEMOIRE_VIDE });
  const v = R.presentationDemarrage({ calcul, metier, modele: conseil, effectifs: { clients: 4, membres: 1 }, premierClient: 'Client exemple', langue: 'fr' });
  assert.deepEqual(v.resumes, { metier: 'Conseil et services', client: '4 enregistrés' });
  assert.deepEqual(v.rempli.devis, [
    { terme: 'Client', suite: 'Client exemple, ajouté à l’étape 2' },
    { terme: 'Lignes types', suite: 'celles de votre métier, modifiables' },
  ]);
  assert.equal(v.brouillon.client, 'Client exemple');
  assert.equal(v.brouillon.lignes.length, conseil.devisType.length);
  assert.ok(v.brouillon.lignes.every((l: any) => l.montant === undefined), 'aucun prix inventé');
  assert.equal(v.brouillon.numero, undefined, 'un brouillon n’a pas de numéro');
  assert.equal(v.brouillon.totaux, undefined);
  assert.deepEqual(v.pret.map((l: any) => [l.id, l.titre, l.sous]), [
    ['modules', '9 modules activés', 'Conseil et services, 6 dans la barre'],
    ['clients', '4 clients ajoutés', 'dans vos contacts'],
    ['garde', 'La Garde veille sur vos accès', 'chaque connexion est notée'],
  ]);
  assert.ok(!v.pret.some((l: any) => l.id === 'sauvegarde'), 'aucune ligne sur la sauvegarde : le poste n’en sait rien');
  const vide = R.presentationDemarrage({ calcul: calc({ metier: null }), metier: null, modele: null, effectifs: { clients: 0, membres: 1 }, premierClient: null, langue: 'fr' });
  assert.deepEqual([vide.resumes, vide.rempli, vide.brouillon, vide.pret.map((l: any) => l.id)], [{}, {}, null, ['garde']]);
  const passe = R.presentationDemarrage({ calcul: calc({ metier: { modele: null, taille: '2-5', passe: true } }), metier: { modele: null, taille: '2-5', modules: ['home'], passe: true, le: '' }, modele: null, effectifs: { clients: 0, membres: 1 }, premierClient: null, langue: 'fr' });
  assert.ok(!passe.pret.some((l: any) => l.id === 'modules'), 'qui passe n’a pas de modules « activés pour son métier »');
  const startup = R.modeleParId('startup');
  const sansDevis = R.presentationDemarrage({ calcul: R.calculerEtapes({ metier: { modele: startup, taille: '2-5', passe: false }, donnees: DV, memoire: R.MEMOIRE_VIDE }), metier: { ...metier, modele: 'startup' }, modele: startup, effectifs: { clients: 1, membres: 1 }, premierClient: 'X', langue: 'fr' });
  assert.equal(sansDevis.brouillon, null, 'l’étape 3 d’une start-up n’est pas un devis : pas de papier');
  for (const m of MODELES) for (const l of (m as any).devisType ?? []) for (const t of [l.libelle, l.quantite]) assert.doesNotMatch(`${t.fr} ${t.en}`, /€|\$|\d\s?\d{3}|\d+,\d/, `${m.id} : un prix dans une ligne type`);
});

await dit('une étape faite ne redevient JAMAIS « à faire » : la mémoire la garde même si le client est supprimé ensuite', () => {
  const vu = calc({ donnees: { ...DV, clients: 2, quotes: 1 } });
  assert.deepEqual([...vu.aMemoriser], ['metier', 'client', 'devis']);
  const memoire = R.memoriserFaites(R.MEMOIRE_VIDE, vu.aMemoriser);
  assert.deepEqual([...memoire.faites], ['metier', 'client', 'devis']);
  assert.equal(R.memoriserFaites(memoire, vu.aMemoriser), memoire, 'idempotent : rien à écrire de plus');
  const apres = calc({ donnees: DV, memoire });
  assert.deepEqual([apres.n, apres.total], [3, 6]);
  for (const id of ['client', 'devis']) assert.equal(apres.etapes.find((e: any) => e.id === id).faite, true, `${id} reste faite`);
  assert.equal(apres.etapes.find((e: any) => e.id === 'client').detectee, false, 'la preuve a disparu, la mémoire tient');
  assert.deepEqual([...apres.aMemoriser], []);
  assert.equal(calc({ donnees: DV, memoire }).etapes.find((e: any) => e.id === 'client').faite, true);
});

await dit('« Pas pour moi » : l’étape sort de la liste ET du total (« 2/5 »), « Les remettre » la ramène ; la conseillée passe à la suivante', () => {
  const sans = R.retirerEtape(R.MEMOIRE_VIDE, 'paiement');
  const r = calc({ donnees: { ...DV, clients: 1 }, memoire: sans });
  assert.deepEqual([r.n, r.total], [2, 5]);
  assert.ok(!ids(r).includes('paiement'));
  assert.deepEqual([...r.retirees], ['paiement']);
  assert.equal(R.retirerEtape(sans, 'paiement'), sans);
  const sansDevis = calc({ donnees: { ...DV, clients: 1 }, memoire: R.retirerEtape(R.MEMOIRE_VIDE, 'devis') });
  assert.equal(sansDevis.conseillee, 'equipe');
  const retour = calc({ donnees: { ...DV, clients: 1 }, memoire: R.remettreEtapes(sans) });
  assert.deepEqual([retour.n, retour.total], [2, 6]);
  assert.deepEqual(R.lireMemoire({ faites: ['client', 'nimporte', 'client'], retirees: 'non' }), { faites: ['client'], retirees: [] });
  const toutRetire = calc({ memoire: { faites: [], retirees: ['metier', 'client', 'devis', 'equipe', 'paiement', 'mobile'] } });
  assert.deepEqual([toutRetire.total, toutRetire.tout, toutRetire.ratio], [0, true, 1]);
});

await dit('« Seul » masque l’étape « Inviter votre équipe » (5 étapes) ; « 2 à 5 », « 6 à 20 » et « Plus » la gardent', () => {
  assert.ok(!ids(calc({ metier: { ...artisan, taille: 'seul' } })).includes('equipe'));
  assert.equal(calc({ metier: { ...artisan, taille: 'seul' } }).total, 5);
  for (const t of ['2-5', '6-20', 'plus']) assert.ok(ids(calc({ metier: { ...artisan, taille: t } })).includes('equipe'), t);
  assert.equal(R.etapeMasquee('equipe', 'seul'), true);
  assert.equal(R.etapeMasquee('client', 'seul'), false);
  const seulFini = calc({ metier: { ...artisan, taille: 'seul' }, donnees: { ...DV, clients: 1, quotes: 1 }, memoire: { faites: ['paiement', 'mobile'], retirees: [] } });
  assert.deepEqual([seulFini.n, seulFini.total, seulFini.tout], [5, 5, true], 'masquée, l’équipe ne bloque pas le 5/5');
});

await dit('« Passer » à l’étape 1 : l’étape est « passée », comptée comme faite ; sans choix du tout, elle reste à faire', () => {
  const passe = calc({ metier: { modele: null, taille: '2-5', passe: true } });
  const e = passe.etapes.find((x: any) => x.id === 'metier');
  assert.deepEqual([e.faite, e.passee], [true, true]);
  assert.equal(passe.n, 1);
  assert.equal(passe.etapes.find((x: any) => x.id === 'client').libelle.titre.fr, 'Ajouter vos clients', 'jeu général : les textes de la maquette');
  assert.equal(calc({ metier: null }).etapes[0].faite, false);
});

await dit('les étapes 2, 3 et 5 suivent le métier : une association annonce (à la main), une start-up crée une tâche (mesurée), la santé planifie un rendez-vous', () => {
  const metier = (id: string) => ({ modele: R.modeleParId(id), taille: '2-5', passe: false });
  const asso = calc({ metier: metier('association'), donnees: { ...DV, quotes: 5 } });
  const devisAsso = asso.etapes.find((e: any) => e.id === 'devis');
  assert.deepEqual([devisAsso.manuelle, devisAsso.faite, devisAsso.vers], [true, false, '/annonces'], 'des devis ne cochent pas une annonce');
  assert.equal(devisAsso.libelle.titre.fr, 'Annoncer votre première activité');
  const startup = calc({ metier: metier('startup'), donnees: { ...DV, tasks: 1 } }).etapes.find((e: any) => e.id === 'devis');
  assert.deepEqual([startup.faite, startup.manuelle], [true, false]);
  const sante = calc({ metier: metier('sante'), donnees: { ...DV, appointments: 1, tasks: 4 } }).etapes.find((e: any) => e.id === 'devis');
  assert.equal(sante.faite, true);
  assert.equal(sante.libelle.titre.fr, 'Planifier votre premier rendez-vous');
});

await dit('le prénom : le profil d’abord, puis le compte ; une boîte partagée ou un nom à chiffres ne se salue pas', () => {
  assert.equal(R.prenomAffichable('Camille Exemple', 'x'), 'Camille');
  assert.equal(R.prenomAffichable('Contact', 'Camille Exemple'), 'Camille', 'le profil n’est que le début de l’adresse : on prend le compte');
  assert.equal(R.prenomAffichable('Info', 'compta@x.fr'), '');
  assert.equal(R.prenomAffichable('Équipe2', undefined), '');
  assert.equal(R.prenomAffichable(undefined, null, '  '), '');
  assert.equal(R.prenomAffichable('camille@x.fr'), '');
});

await dit('« Bon à savoir » : les trois raccourcis qui existent (⌘K, ⌘J, ?) ; « N : Créer, partout » n’existe pas et n’est pas montré ; chaque ligne rejoue sa touche', () => {
  assert.deepEqual(R.RACCOURCIS_SAVOIR.map((r: any) => r.touche), ['k', 'j', '?']);
  assert.deepEqual(R.evenementDeTouche(R.RACCOURCIS_SAVOIR[0], true), { key: 'k', bubbles: true, metaKey: true, ctrlKey: false });
  assert.deepEqual(R.evenementDeTouche(R.RACCOURCIS_SAVOIR[1], false), { key: 'j', bubbles: true, metaKey: false, ctrlKey: true });
  assert.deepEqual(R.evenementDeTouche(R.RACCOURCIS_SAVOIR[2], true), { key: '?', bubbles: true, metaKey: false, ctrlKey: false });
});

await dit('la mémoire de Démarrage se garde par compte (amn.demarrage.faites.<adresse>), même référence tant que rien ne change, et dit son refus', () => {
  const { evts } = fauxStockage();
  assert.equal(R.cleFaites('a@b.c'), 'amn.demarrage.faites.a@b.c');
  assert.equal(R.lireMemoireStockee('a@b.c'), R.MEMOIRE_VIDE);
  const m = { faites: ['client'], retirees: ['mobile'] };
  assert.equal(R.ecrireMemoire('a@b.c', m), true);
  assert.ok(evts.includes('amn:demarrage'));
  const lu = R.lireMemoireStockee('a@b.c');
  assert.deepEqual(lu, m);
  assert.equal(R.lireMemoireStockee('a@b.c'), lu);
  assert.deepEqual(R.lireMemoireStockee('autre@b.c'), R.MEMOIRE_VIDE);
  fauxStockage(true);
  assert.equal(R.ecrireMemoire('a@b.c', m), false);
  delete (globalThis as any).window;
});

/* ═════════════════════════ Les mots ═════════════════════════ */

await dit('français et anglais disent les mêmes clés ; les textes de la fiche sont exacts ; vouvoiement, aucun point d’exclamation, rien qui presse', () => {
  assert.deepEqual(Object.keys(R.MOTS_FR).sort(), Object.keys(R.MOTS_EN).sort());
  const fr = R.MOTS_FR as Record<string, string>;
  const attendu: Record<string, string> = {
    'titre': 'Démarrage', 'sous': 'Votre espace se prépare avec vous, sans pression', 'plusTard': 'Plus tard', 'reprendreVisite': 'Reprendre la visite',
    'sous.prenom': 'Bienvenue {prenom}, votre espace se prépare avec vous, sans pression', 'allerAccueil': 'Aller à l’accueil',
    'resume.pretes': '{n} sur {total} prêtes', 'resume.duree': 'environ {n} min', 'resume.reste': 'pour le reste',
    'statut.maintenant': 'maintenant · {n} min', 'statut.ensuite': 'ensuite · {n} min', 'statut.duree': '{n} min',
    'panneau.etape': 'Étape {n} sur {total}', 'panneau.conseillee': '· conseillée maintenant', 'panneau.rempli': 'Déjà rempli pour vous', 'panneau.plusTard': 'Plus tard',
    'panneau.pasPourMoi': 'Pas pour moi', 'panneau.ajmani': 'Rien ne part chez {client} sans votre accord.', 'panneau.retiree': 'Étape retirée', 'panneau.annuler': 'Annuler',
    'rempli.client.terme': 'Client', 'rempli.client.suite': '{client}, ajouté à l’étape {n}', 'rempli.lignes.terme': 'Lignes types', 'rempli.lignes.suite': 'celles de votre métier, modifiables',
    'ensuite.titre': 'Ensuite : {etape}', 'ensuite.inviter': 'Ensuite : inviter {noms}', 'savoir.titre': 'Bon à savoir', 'savoir.chercher': 'chercher', 'savoir.ajmani': 'Ajmani',
    'papier.statut': 'Brouillon', 'papier.titre': 'Devis', 'papier.pour': 'Pour', 'papier.note': 'Prérempli par Ajmani, à relire',
    'dejaPret.titre': 'Déjà prêt', 'dejaPret.sous': 'sans rien faire', 'dejaPret.modules.titre': '{n} modules activés', 'dejaPret.modules.sous': '{metier}, {n} dans la barre',
    'dejaPret.garde.titre': 'La Garde veille sur vos accès', 'dejaPret.garde.sous': 'chaque connexion est notée',
    'aide.referent.titre': '{nom} vous accompagne', 'aide.referent.sous': 'de l’équipe AMN · répond sous {n} min', 'aide.equipe.titre': 'L’équipe AMN vous répond',
    'aide.texte': 'Un appel de 15 minutes pour faire le tour ensemble, ou une question par écrit. Comme vous préférez.', 'aide.creneaux': 'Créneaux libres aujourd’hui',
    'aide.reserver': 'Réserver {heure}', 'aide.ecrire': 'Lui écrire', 'aide.reserve': 'Rendez-vous avec {nom} à {heure}',
    'etape.metier.titre': 'Choisir votre métier', 'etape.metier.sous': 'Pour activer les bons modules', 'etape.equipe.titre': 'Inviter votre équipe', 'etape.equipe.sous': 'Chacun garde ses accès',
    'etape.mobile.titre': 'Installer l’application mobile', 'etape.mobile.sous': 'Vos tâches dans la poche', 'etape.mobile.action': 'Obtenir le lien', 'etape.equipe.action': 'Inviter',
    'erreur': 'Votre progression n’a pas pu être chargée.', 'erreur.reessayer': 'Réessayer', 'horsLigne': 'Disponible au retour du réseau', 'etape.admin': 'Réservé aux administrateurs',
    'metier.titre': 'Quel est votre métier ?', 'metier.sous': 'Choisissez le plus proche : on active les bons modules, vous n’avez rien d’autre à régler', 'metier.passer': 'Passer',
    'metier.continuer.avec': 'Continuer avec {metier}', 'metier.continuer': 'Continuer', 'metier.continuer.info': 'Choisissez un métier ou utilisez Passer', 'metier.miette': 'Votre métier',
    'metier.ajmani': 'Décrivez votre activité en une phrase, Ajmani compose l’espace', 'carte.autres': '+ {n} autres modules, {total} en tout',
    'taille.titre': 'Combien êtes-vous ?', 'taille.aide': 'Pour préparer les accès et les rôles', 'taille.seul': 'Seul', 'taille.2-5': '2 à 5', 'taille.6-20': '6 à 20', 'taille.plus': 'Plus',
    'barre.titre': 'Votre barre latérale', 'apercu.titre': 'Votre espace, demain matin', 'apercu.avec': 'aperçu avec {metier}',
    'apercu.phrase': '{nombre} modules dans votre barre, {autres} autres prêts à servir. Tout se change plus tard.', 'nombre.6': 'Six',
    'apercu.mention': 'Les {n} modules restent dans « Tous les modules », rien n’est supprimé.', 'apercu.vide': 'Choisissez un métier pour voir votre espace',
    'decrire.titre': 'Pas dans la liste ?', 'decrire.texte': 'Décrivez votre activité en une phrase, Ajmani compose l’espace.', 'decrire.bouton': 'Décrire mon activité',
    'decrire.champ': 'Décrivez votre activité en une phrase', 'decrire.composer': 'Composer l’espace', 'erreur.enregistrement': 'Votre choix n’a pas pu être enregistré.',
  };
  for (const [k, v] of Object.entries(attendu)) assert.equal(fr[k], v, k);
  const aAjmani = new Set(['decrire.consigne']);
  for (const [k, t] of [...Object.entries(R.MOTS_FR), ...Object.entries(R.MOTS_EN)] as [string, string][]) {
    assert.doesNotMatch(t, /!/, `${k} : point d’exclamation`);
    assert.doesNotMatch(t, /en retard|\blate\b|overdue|urgent|dépêch|compte à rebours|countdown|expire/i, `${k} : ça presse`);
  }
  for (const [k, t] of Object.entries(fr)) if (!aAjmani.has(k)) assert.doesNotMatch(t, /(?<![\p{L}])(tu|ton|ta|tes|toi)(?![\p{L}])/iu, `${k} : tutoiement`);
  for (const m of MODELES) for (const t of [m.nom.fr, m.description.fr, ...m.apercu.flatMap((c) => [c.titre.fr, c.detail.fr, c.etiquette.fr]), ...Object.values(m.etapes).flatMap((e) => [e.titre.fr, e.sous.fr, e.action.fr])]) assert.doesNotMatch(t, /!/, t);
});

/* ═════════════════════════ Le rendu statique ═════════════════════════ */

const noop = () => undefined;
const propsDem = (surcharge: Record<string, unknown> = {}) => ({
  etat: 'pret', calcul: calc({ donnees: { ...DV, clients: 2 } }), prenom: 'Camille', horsLigne: false, peutAdministrer: true, mac: true,
  resumes: { client: '2 enregistrés' }, rempli: {}, brouillon: null, client: null, pret: [], aInviter: [], referent: null, lienMobile: null,
  onPlusTard: noop, onAccueil: noop, onReprendreVisite: noop, onReessayer: noop, onAgir: noop, onOuvrir: noop, onMarquer: noop, onRetirer: noop, onRemettre: noop,
  onRaccourci: noop, onReserver: noop, onEcrire: noop, ...surcharge,
});
const vueDem = (s: Record<string, unknown> = {}): string => rendre(h(R.VueDemarrage, propsDem(s)));
const noeuds = (html: string): string[] => html.split('<li class="dem-route__etape"').slice(1).map((x) => x.split('</li>')[0]);
const entete = (html: string): string => html.slice(html.indexOf('<header'), html.indexOf('</header>'));
const carteEtape = (html: string): string => html.slice(html.indexOf('dem-carte-etape'), html.indexOf('class="dem-droite"'));
const REFERENT = { nom: 'Sacha', delai: 10, enLigne: true, creneaux: ['14:30', '16:00', 'Lun. 9:30'] };

await dit('H42 · 2 sur 6 : un h1, l’anneau de 74 px à 33 % (« 2 » et « /6 »), « 2 sur 6 prêtes · environ 7 min », six nœuds dont deux faits et un seul conseillé', () => {
  const html = vueDem();
  assert.equal(compter(html, /<h1[ >]/g), 1);
  assert.match(html, />Démarrage<\/h1>/);
  assert.match(html, />Bienvenue Camille, votre espace se prépare avec vous, sans pression</);
  assert.match(vueDem({ prenom: '' }), />Votre espace se prépare avec vous, sans pression</);
  assert.match(html, /role="progressbar"[^>]*aria-valuenow="33"/);
  assert.match(html, /width:74px;height:74px/);
  assert.match(html, /class="dem-anneau__n">2<\/span><span class="dem-anneau__total">\/6</);
  assert.match(html, />2 sur 6 prêtes</);
  assert.match(html, />environ 7 min</);
  assert.match(html, />pour le reste</);
  const n = noeuds(html);
  assert.equal(n.length, 6);
  assert.deepEqual(n.map((x) => /data-forme="(\w+)"/.exec(x)?.[1]), ['faite', 'faite', 'conseillee', 'afaire', 'afaire', 'afaire'], 'la conseillée suit les données');
  assert.match(n[0], /data-lien="plein"/, 'entre deux étapes faites, un trait plein');
  assert.equal(compter(noeuds(vueDem({ calcul: calc({ metier: null, donnees: { ...DV, clients: 2 } }) }))[0], /data-forme="conseillee"/g), 1, 'sans métier gardé, l’étape 1 est la conseillée');
  assert.equal(compter(html, /aria-current="step"/g), 1);
  assert.match(n[1], />2 enregistrés</, 'le nœud fait dit sa valeur');
  assert.match(n[2], />maintenant · 2 min</);
  assert.match(n[3], />ensuite · 1 min</);
  assert.match(n[4], />3 min</);
  assert.match(n[1], /aria-label="Ajouter vos clients, faite : la revoir"/);
  assert.match(n[3], /aria-label="Inviter votre équipe, à faire : l’afficher"/);
  assert.match(n[1], /data-lien="flux"/, 'la liaison qui s’écoule mène à l’étape conseillée');
  assert.match(n[2], /data-lien="attente"/);
  assert.equal(compter(html, /data-mvt="flux"/g), 1);
  assert.equal(compter(html, /data-mvt="onde"/g), 1, 'le halo du seul nœud conseillé');
  assert.equal(primaires(html), 1, 'un seul primaire sans créneau réservable : celui de l’étape');
});

await dit('H42 · en-tête : « Plus tard » et « Reprendre la visite » en secondaires au gabarit de H40 (31 px, pas le petit bouton), aucun primaire (C13)', () => {
  const e = entete(vueDem());
  assert.equal(compter(e, /data-variante="secondaire"/g), 2);
  assert.equal(compter(e, /data-taille="moyen"/g), 2);
  assert.doesNotMatch(e, /data-taille="petit"|data-variante="primaire"/);
  assert.match(e, />Plus tard</);
  assert.match(e, />Reprendre la visite</);
  assert.doesNotMatch(sansCommentaires(lireSource('VueDemarrage.tsx')), /taille="petit"/);
});

await dit('H42 · la carte de l’étape : « Étape 3 sur 6 · conseillée maintenant », le titre, le texte, « Déjà rempli pour vous », « Créer le devis » primaire, « Plus tard », « Pas pour moi », la ligne d’Ajmani, « Ensuite », « Bon à savoir »', () => {
  const rempli = { devis: [{ terme: 'Client', suite: 'Client exemple, ajouté à l’étape 2' }, { terme: 'Lignes types', suite: 'celles de votre métier, modifiables' }] };
  const html = carteEtape(vueDem({ rempli, client: 'Client exemple' }));
  assert.match(html, />Étape 3 sur 6</);
  assert.match(html, />· conseillée maintenant</);
  assert.match(html, /<h2 class="dem-etape__titre">Créer votre premier devis<\/h2>/);
  assert.match(html, /Je prépare un devis type pour votre métier, vous n’avez qu’à relire et ajuster\. Comptez deux minutes\./);
  assert.match(html, />Déjà rempli pour vous</);
  assert.equal(compter(html, /class="dem-rempli__ligne"/g), 2);
  assert.match(html, /<span class="dem-rempli__terme">Client<\/span> · Client exemple, ajouté à l’étape 2/);
  assert.match(bouton(html, 'Créer le devis').attrs, /data-variante="primaire"/);
  assert.match(bouton(html, 'Plus tard').attrs, /data-variante="secondaire"/);
  assert.match(bouton(html, 'Pas pour moi').attrs, /class="dem-lien dem-lien--action sc-focus"/);
  assert.doesNotMatch(html, /C’est déjà fait/, 'un devis se détecte : pas de marquage à la main');
  assert.match(html, />Rien ne part chez Client exemple sans votre accord\.</);
  assert.match(carteEtape(vueDem()), />Rien ne part sans votre accord\.</);
  assert.match(html, />Ensuite : inviter votre équipe</);
  assert.match(html, />chacun garde ses accès · 1 min</);
  assert.match(carteEtape(vueDem({ aInviter: ['Camille', 'Sacha'] })), />Ensuite : inviter Camille et Sacha</);
  assert.match(html, />Bon à savoir</);
  assert.equal(compter(html, /class="dem-savoir__ligne/g), 3);
  for (const k of ['⌘K', '⌘J', '\\?']) assert.match(html, new RegExp(`<kbd[^>]*>${k}</kbd>`));
  assert.match(carteEtape(vueDem({ mac: false })), /<kbd[^>]*>Ctrl K<\/kbd>/);
  assert.doesNotMatch(html, /créer, partout|Créer, partout/i, '« N » n’existe pas');
  assert.doesNotMatch(vueDem({ rempli: {} }), /Déjà rempli pour vous/, 'rien de connu : pas de liste');
});

await dit('H42 · le papier : un aperçu (« Brouillon », « Devis », « Pour … », lignes) ; les montants, le numéro et les totaux n’apparaissent que s’ils sont donnés ; l’étape 6 montre le code', () => {
  const brouillon = { client: 'Client exemple', lignes: [{ libelle: 'Ligne A', quantite: '1 jour' }, { libelle: 'Ligne B', quantite: 'offerte' }] };
  const html = carteEtape(vueDem({ brouillon }));
  assert.match(html, /<figure class="dem-papier"[^>]*aria-label="Aperçu du brouillon"/);
  assert.match(html, /data-avec-papier="true"/);
  assert.match(html, />Brouillon</);
  assert.match(html, /class="dem-papier__titre">Devis</);
  assert.match(html, />Pour <span class="dem-papier__client">Client exemple<\/span></);
  assert.equal(compter(html, /class="dem-papier__ligne"/g), 2);
  assert.doesNotMatch(html, /€|dem-papier__totaux/);
  assert.match(html, />Prérempli par Ajmani, à relire</);
  const complet = rendre(h(R.PapierBrouillon, { b: { ...brouillon, numero: 'N-1', totaux: [{ libelle: 'Total', valeur: '1 €' }] } }));
  assert.match(complet, />N-1</);
  assert.match(complet, /data-fort="true"/);
  assert.doesNotMatch(carteEtape(vueDem()), /dem-papier/, 'sans brouillon, pas de papier');
  const mobile = calc({ donnees: { clients: 1, quotes: 1, tasks: 0, appointments: 0, membres: 2 }, memoire: { faites: ['metier', 'paiement'], retirees: [] } });
  assert.equal(mobile.conseillee, 'mobile');
  const m = carteEtape(vueDem({ calcul: mobile, lienMobile: 'https://exemple.test/app' }));
  assert.match(m, /<svg[^>]*role="img"[^>]*aria-label="Code à scanner avec votre téléphone"/);
  assert.match(m, />C’est déjà fait</, 'l’étape 6 se marque à la main');
});

await dit('H42 · « Déjà prêt » (titre T1, « sans rien faire », coches vertes) et l’accompagnement : sans référent, « L’équipe AMN vous répond » sans créneau ni primaire ; avec, trois créneaux et « Réserver »', () => {
  const pret = [{ id: 'garde', icone: 'garde', titre: 'La Garde veille sur vos accès', sous: 'chaque connexion est notée' }];
  const html = vueDem({ pret });
  assert.match(html, /<h2 class="dem-carte__titre">Déjà prêt<\/h2><span class="dem-pret__sans">sans rien faire<\/span>/);
  assert.equal(compter(html, /class="dem-pret__ligne"/g), 1);
  assert.doesNotMatch(vueDem(), /Déjà prêt/, 'rien de vrai : pas de carte');
  assert.match(html, /<h2 class="dem-carte__titre">L’équipe AMN vous répond<\/h2>/);
  assert.doesNotMatch(html, /role="radiogroup"|Réserver/);
  assert.match(bouton(html, 'Écrire à l’équipe').attrs, /data-variante="secondaire"/);
  const avec = vueDem({ pret, referent: REFERENT });
  assert.match(avec, /<h2 class="dem-carte__titre">Sacha vous accompagne<\/h2>/);
  assert.match(avec, />de l’équipe AMN · répond sous 10 min</);
  assert.match(avec, /role="radiogroup" aria-labelledby="dem-aide-creneaux"/);
  assert.equal(compter(avec, /class="dem-creneau sc-focus sc-nombre"/g), 3);
  assert.match(bouton(avec, '14:30').attrs, /aria-checked="true"/);
  assert.match(bouton(avec, 'Réserver 14:30').attrs, /data-variante="primaire"/);
  assert.match(bouton(avec, 'Lui écrire').attrs, /data-variante="secondaire"/);
  assert.equal(primaires(avec), 2, 'fiche rubrique 12 : un primaire dans la carte de l’étape, un dans l’accompagnement');
});

await dit('H42 · 6 sur 6 : anneau plein, nœuds tous faits, « Votre espace est prêt », « Aller à l’accueil » seul primaire, « Plus tard » disparaît', () => {
  const tout = calc({ donnees: { clients: 1, quotes: 1, tasks: 0, appointments: 0, membres: 2 }, memoire: { faites: ['metier', 'paiement', 'mobile'], retirees: [] } });
  const html = vueDem({ calcul: tout });
  assert.match(html, /aria-valuenow="100"/);
  assert.match(html, /class="dem-anneau__n">6<\/span><span class="dem-anneau__total">\/6</);
  assert.equal(compter(html, /data-forme="faite"/g), 6);
  assert.match(html, />Votre espace est prêt, Camille<\/h2>/);
  assert.match(html, /Tout est en place\. Vous pouvez compter sur Ajmani pour la suite\./);
  assert.match(bouton(html, 'Aller à l’accueil').attrs, /data-variante="primaire"/);
  assert.equal(primaires(html), 1);
  assert.doesNotMatch(html, />Plus tard</);
  assert.match(html, />plus rien à faire</);
  assert.match(vueDem({ calcul: tout, prenom: '' }), />Votre espace est prêt<\/h2>/);
});

await dit('H42 · « Seul » : cinq nœuds, « 2/5 » ; une étape retirée : « 1 étape retirée · Les remettre »', () => {
  const seul = calc({ metier: { ...artisan, taille: 'seul' }, donnees: { ...DV, clients: 1 } });
  const html = vueDem({ calcul: seul });
  assert.equal(noeuds(html).length, 5);
  assert.match(html, /class="dem-anneau__total">\/5</);
  assert.doesNotMatch(html, />Inviter votre équipe</);
  assert.match(html, />Étape 3 sur 5</);
  const retiree = vueDem({ calcul: calc({ memoire: R.retirerEtape(R.MEMOIRE_VIDE, 'mobile') }) });
  assert.match(retiree, /1 étape retirée/);
  assert.match(retiree, />Les remettre</);
  assert.doesNotMatch(vueDem(), />Les remettre</);
});

await dit('H42 · chargement : squelettes du parcours (six ronds), de la carte et des deux cartes de droite, région annoncée, aucun primaire, la page garde son h1', () => {
  const html = vueDem({ etat: 'chargement' });
  assert.match(html, /role="status"[^>]*aria-busy="true"[^>]*aria-label="Chargement de votre progression"|aria-busy="true"[^>]*role="status"/);
  assert.equal(compter(html, /class="dem-route__etape dem-squelette-noeud"/g), 6);
  assert.match(html, /height:233px/);
  assert.match(html, /height:239px/);
  assert.equal(compter(html, /<h1[ >]/g), 1);
  assert.equal(primaires(html), 0);
  assert.doesNotMatch(html, /class="dem-noeud/);
  assert.match(rendre(h(R.SqueletteDemarrage)), /dem-surface/);
});

await dit('H42 · erreur : le bandeau « Votre progression n’a pas pu être chargée. » et « Réessayer » dans la carte de l’étape ; le parcours et les boutons restent', () => {
  const html = vueDem({ etat: 'erreur' });
  assert.match(carteEtape(html), /role="alert"/);
  assert.match(html, /Votre progression n’a pas pu être chargée\./);
  assert.match(html, />Réessayer</);
  assert.equal(noeuds(html).length, 6);
  assert.equal(primaires(html), 1);
});

await dit('H42 · hors ligne : « Connecter » et « Réserver » grisés avec « Disponible au retour du réseau » ; « Plus tard » reste actif', () => {
  const calcul = calc({ donnees: { clients: 1, quotes: 1, tasks: 0, appointments: 0, membres: 2 }, memoire: { faites: ['metier'], retirees: [] } });
  assert.equal(calcul.conseillee, 'paiement');
  const html = vueDem({ calcul, horsLigne: true, referent: REFERENT });
  assert.match(html, /<span title="Disponible au retour du réseau"><button[^>]*data-variante="primaire"[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Connecter/);
  assert.match(html, /<span title="Disponible au retour du réseau"><button[^>]*data-variante="primaire"[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Réserver 14:30/);
  assert.doesNotMatch(bouton(html, 'Plus tard').attrs, /disabled=""/);
  assert.match(carteEtape(html), />C’est déjà fait</, 'les encaissements se marquent à la main');
  assert.doesNotMatch(vueDem({ calcul, referent: REFERENT }), /disabled=""/);
});

await dit('H42 · droits : sans droit d’administration, « Inviter » et « Connecter » deviennent « Réservé aux administrateurs », jamais un second primaire', () => {
  const calcul = calc({ donnees: { ...DV, clients: 1, quotes: 1 }, memoire: { faites: ['metier'], retirees: [] } });
  assert.equal(calcul.conseillee, 'equipe');
  const html = vueDem({ calcul, peutAdministrer: false });
  assert.match(carteEtape(html), />Réservé aux administrateurs</);
  assert.doesNotMatch(carteEtape(html), />Inviter</);
  assert.equal(primaires(html), 0);
  assert.equal(compter(vueDem({ calcul }), /Réservé aux administrateurs/g), 0);
});

await dit('H42 · la fenêtre du lien : un code à scanner (pas une image tierce) et l’adresse en toutes lettres ; sans adresse publique, l’explication — jamais un faux lien', () => {
  const html = rendre(h(R.LienMobile, { lien: 'https://exemple.test/app' }));
  assert.match(html, /<svg[^>]*role="img"[^>]*viewBox="0 0 /);
  assert.match(html, /<path d="M\d+ \d+h1v1h-1z/);
  assert.match(html, /https:\/\/exemple\.test\/app/);
  assert.doesNotMatch(html, /<img|token|jeton|\?[a-z]+=/i);
  const sans = rendre(h(R.LienMobile, { lien: null }));
  assert.match(sans, /Aucune adresse publique/);
  assert.doesNotMatch(sans, /<svg/);
});

const cartesDe = (choix: string | null, actifs?: Set<string>) =>
  MODELES.map((m) => {
    const c = R.carteModele(m, () => 'argent');
    return {
      id: m.id,
      lignes: c.quatre.map((x: string) => ({ id: x, nom: `Module ${x}`, teinte: 'argent', actif: m.id === choix ? (actifs ? actifs.has(x) : true) : true, toujours: false })),
      bande: c.bande.map((b: any) => ({ teinte: b.famille, n: b.n })),
      autres: c.autres,
      total: c.total,
    };
  });
const propsMet = (surcharge: Record<string, unknown> = {}) => ({
  choix: null, taille: '2-5', cartes: cartesDe(null), barre: [], dansLaBarre: 0, autresPrets: 0, extras: [], totalModules: 101, teintesApercu: [], dernierActif: false, horsLigne: false,
  erreurEnregistrement: false, decrireOuvert: false, phrase: '', composeEnvoye: false, onChoisir: noop, onTaille: noop, onBasculer: noop, onContinuer: noop, onPasser: noop, onReessayer: noop,
  onDecrire: noop, onPhrase: noop, onComposer: noop, ...surcharge,
});
const choisi = (id: string, s: Record<string, unknown> = {}) => ({
  choix: id, cartes: cartesDe(id), barre: [{ famille: 'argent', teinte: 'argent', nom: 'L’argent', modules: ['Module A', 'Module B'] }], dansLaBarre: 6, autresPrets: 4,
  teintesApercu: ['creer', 'argent', 'jour'], ...s,
});
const vueMet = (s: Record<string, unknown> = {}): string => rendre(h(R.VueMetier, propsMet(s)));
const cartesHtml = (html: string): string[] => html.split('<div class="met-carte"').slice(1).map((x) => x.split('<p class="met-carte__pied">')[0]);

await dit('H47 · premier affichage : un h1, un groupe radio de huit cartes non choisies, « Continuer » grisé et seul primaire, la bande dit « Choisissez un métier pour voir votre espace »', () => {
  const html = vueMet();
  assert.equal(compter(html, /<h1[ >]/g), 1);
  assert.match(html, />Quel est votre métier \?<\/h1>/);
  assert.match(html, />Choisissez le plus proche : on active les bons modules, vous n’avez rien d’autre à régler</);
  assert.match(html, /role="radiogroup"[^>]*aria-label="Familles de métiers"/);
  assert.equal(compter(html, /role="radio" aria-checked="false"[^>]*class="met-carte__choix/g), 8);
  assert.equal(compter(html, /aria-checked="true"[^>]*class="met-carte__choix/g), 0);
  assert.equal(compter(html, /met-carte__coche/g), 0);
  assert.equal(compter(html, /role="radio"[^>]*tabindex="0"[^>]*class="met-carte__choix/g), 1, 'une seule carte dans l’ordre de tabulation');
  assert.match(html, /<span title="Choisissez un métier ou utilisez Passer"><button/);
  assert.match(bouton(html, 'Continuer').attrs, /data-variante="primaire"[^>]*disabled=""/);
  assert.match(bouton(html, 'Passer').attrs, /data-variante="secondaire"/);
  assert.equal(primaires(html), 1);
  assert.equal(compter(html, /role="switch"/g), 0, 'aucun interrupteur tant qu’aucune carte n’est choisie');
  assert.match(html, />Choisissez un métier pour voir votre espace</);
  assert.match(html, /class="met-barre__squelette"/);
  assert.match(html, />Les 101 modules restent dans « Tous les modules », rien n’est supprimé\.</);
  for (const m of MODELES) {
    assert.match(html, new RegExp(`class="met-carte__nom">${m.nom.fr}</span><span class="met-carte__mots">${m.description.fr}</span>`));
    assert.match(html, new RegExp(`aria-label="${m.nom.fr}, ${m.description.fr}"`));
  }
});

await dit('H47 · une carte choisie : « Continuer avec {métier} » seul primaire, une coche (aria-checked + disque : pas la couleur seule), quatre mini-interrupteurs, « + N autres, T en tout » sur chaque carte', () => {
  const html = vueMet(choisi('conseil'));
  assert.match(bouton(html, 'Continuer avec Conseil et services').attrs, /data-variante="primaire"/);
  assert.doesNotMatch(bouton(html, 'Continuer avec Conseil et services').attrs, /disabled=""/);
  assert.equal(primaires(html), 1);
  assert.equal(compter(html, /aria-checked="true"[^>]*class="met-carte__choix/g), 1);
  assert.equal(compter(html, /met-carte__coche/g), 1);
  assert.match(html, /<div class="met-carte" data-choisi="true"/);
  assert.equal(compter(html, /role="switch"/g), 4);
  assert.match(html, /role="switch" aria-checked="true" aria-label="Module clients dans la barre"/);
  const c = cartesHtml(html);
  assert.equal(c.length, 8);
  for (const x of c) assert.equal(compter(x, /class="met-carte__module"/g), 4);
  for (const m of MODELES) assert.match(html, new RegExp(`\\+ ${m.modules.length - 4} autres modules, ${m.modules.length} en tout`), m.id);
  assert.match(html, /role="img" aria-label="Composition par famille"/);
  assert.doesNotMatch(html, /Choisissez un métier ou utilisez Passer/);
  const off = vueMet(choisi('conseil', { cartes: cartesDe('conseil', new Set(['clients'])) }));
  assert.match(off, /role="switch" aria-checked="false" aria-label="Module contracts dans la barre"/, 'un module éteint reste dans la liste : il n’est pas supprimé');
  assert.match(vueMet({ choix: 'artisan', cartes: [{ id: 'artisan', lignes: [], bande: [], autres: 0, total: 4 }] }), />4 modules en tout</);
});

await dit('H47 · « Votre espace, demain matin » : barre miniature groupée par famille, « aperçu avec … », « Six modules dans votre barre, N autres prêts à servir », trois exemples du modèle, encarts seulement s’ils existent', () => {
  const html = vueMet(choisi('conseil'));
  assert.match(html, /role="group" aria-label="Votre barre latérale"/);
  assert.match(html, /class="met-barre__famille"><svg[\s\S]*?<\/svg>L’argent<\/span>/);
  assert.equal(compter(html, /<ul class="met-barre__modules"><li>Module A<\/li><li>Module B<\/li><\/ul>/g), 1);
  assert.match(html, />Votre espace, demain matin</);
  assert.match(html, />aperçu avec Conseil et services</);
  assert.match(html, />Six modules dans votre barre, 4 autres prêts à servir\. Tout se change plus tard\.</);
  assert.match(vueMet(choisi('conseil', { dansLaBarre: 3, autresPrets: 0 })), />Trois modules dans votre barre\. Tout se change plus tard\.</);
  assert.match(vueMet(choisi('conseil', { dansLaBarre: 1, autresPrets: 0 })), />Un module dans votre barre\. Tout se change plus tard\.</);
  assert.equal(compter(html, /class="met-apercu__carte"/g), 3);
  assert.match(html, /class="met-apercu__cartes" title="Des exemples livrés avec le métier, pas vos données"/);
  assert.doesNotMatch(html, /met-extras/, 'aucun encart sans donnée du modèle');
  const extras = vueMet(choisi('conseil', { extras: [{ icone: 'automatisations', titre: 'X automatisations', detail: 'détail' }] }));
  assert.equal(compter(extras, /class="met-extra"/g), 1);
  assert.doesNotMatch(html, /Menna|Cabinet Roux|4 260|Dupont|Carrelage/);
});

await dit('H47 · « Combien êtes-vous ? » : un groupe radio de quatre options (Seul, 2 à 5, 6 à 20, Plus), « 2 à 5 » par défaut', () => {
  const html = vueMet();
  assert.match(html, />Combien êtes-vous \?</);
  assert.match(html, />Pour préparer les accès et les rôles</);
  assert.match(html, /role="radiogroup"[^>]*aria-label="Combien êtes-vous \?"/);
  for (const t of ['Seul', '2 à 5', '6 à 20', 'Plus']) assert.match(html, new RegExp(`>${t}</button>`));
  assert.match(bouton(html, '2 à 5').attrs, /aria-checked="true"/);
  assert.equal(boutons(vueMet({ taille: 'seul' })).filter((b) => b.texte === 'Seul' && /aria-checked="true"/.test(b.attrs)).length, 1);
});

await dit('H47 · « Pas dans la liste ? » : replié, « Décrire mon activité » secondaire ; déplié, « Composer l’espace » est le seul primaire (« Continuer » passe en secondaire) ; hors ligne, grisé avec son info-bulle', () => {
  const ferme = vueMet(choisi('commerce'));
  assert.match(ferme, />Pas dans la liste \?</);
  assert.match(ferme, />Décrivez votre activité en une phrase, Ajmani compose l’espace\.</);
  assert.match(bouton(ferme, 'Décrire mon activité').attrs, /data-variante="secondaire"[^>]*aria-expanded="false"/);
  assert.doesNotMatch(ferme, /Composer l’espace/);
  const ouvert = vueMet(choisi('commerce', { decrireOuvert: true, phrase: 'x' }));
  assert.match(ouvert, /Décrivez votre activité en une phrase/);
  assert.match(bouton(ouvert, 'Composer l’espace').attrs, /data-variante="primaire"/);
  assert.equal(primaires(ouvert), 1);
  assert.match(bouton(ouvert, 'Continuer avec Commerce').attrs, /data-variante="secondaire"/);
  const hors = vueMet({ horsLigne: true });
  assert.match(hors, /<span title="Disponible au retour du réseau"><button/);
  assert.match(bouton(hors, 'Décrire mon activité').attrs, /disabled=""/);
  assert.match(bouton(vueMet(choisi('commerce', { decrireOuvert: true, phrase: 'x', horsLigne: true })), 'Composer l’espace').attrs, /disabled=""/);
  assert.match(bouton(vueMet(choisi('commerce', { decrireOuvert: true, phrase: '  ' })), 'Composer l’espace').attrs, /disabled=""/, 'sans phrase, rien à composer');
  assert.match(vueMet({ composeEnvoye: true }), /role="status"[^>]*>Ajmani vous répond dans son panneau/);
});

await dit('H47 · en-tête : « Passer » et « Continuer avec … » au gabarit de H40 (31 px, pas le petit bouton) (C13)', () => {
  const e = entete(vueMet(choisi('conseil')));
  assert.equal(compter(e, /data-taille="moyen"/g), 2);
  assert.doesNotMatch(e, /data-taille="petit"/);
});

await dit('H47 · erreur d’enregistrement : « Votre choix n’a pas pu être enregistré. » et « Réessayer », les choix de la page restent', () => {
  const html = vueMet(choisi('artisan', { erreurEnregistrement: true }));
  assert.match(html, /role="alert"/);
  assert.match(html, /Votre choix n’a pas pu être enregistré\./);
  assert.match(html, />Réessayer</);
  assert.equal(compter(html, /aria-checked="true"[^>]*class="met-carte__choix/g), 1);
  assert.equal(primaires(html), 1);
});

await dit('H47 · un module toujours ouvert garde son interrupteur allumé et grisé ; le dernier module activable ne s’éteint pas', () => {
  const lg = [{ id: 'members', nom: 'Droits et accès', teinte: 'outils', actif: true, toujours: true }, { id: 'vault', nom: 'Coffre-fort', teinte: 'outils', actif: true, toujours: false }];
  const html = vueMet({ choix: 'sante', cartes: [{ id: 'sante', lignes: lg, bande: [{ teinte: 'outils', n: 2 }], autres: 4, total: 6 }], dernierActif: true });
  assert.match(html, /role="switch" aria-checked="true" aria-label="Droits et accès dans la barre" title="Toujours disponible" disabled=""/);
  assert.match(html, /role="switch" aria-checked="true" aria-label="Coffre-fort dans la barre" title="Au moins un module reste activé" disabled=""/);
});

await dit('H47 · squelette (repli de `lazy`) : huit blocs de 189 de haut, la bande de 258, région annoncée', () => {
  const html = rendre(h(R.SqueletteMetier));
  assert.match(html, /role="status"[^>]*aria-busy="true"|aria-busy="true"[^>]*role="status"/);
  assert.equal(compter(html, /height:189px/g), 8);
  assert.match(html, /height:258px/);
});

await dit('H47 · cartes et barre lues dans le modèle et le registre : quatre modules, bande par famille dans l’ordre de première apparition, « + N autres, T en tout », six modules activés dans la barre', () => {
  const fam: Record<string, string> = { a: 'jour', b: 'argent', c: 'jour', d: 'contacts', e: 'argent', f: 'jour', g: 'outils', h: 'jour' };
  const m = { ...MODELES[0], modules: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] };
  const c = R.carteModele(m, (id: string) => fam[id]);
  assert.deepEqual(c.quatre, ['a', 'b', 'c', 'd']);
  assert.deepEqual([c.autres, c.total], [4, 8]);
  assert.deepEqual(c.bande, [{ famille: 'jour', n: 4 }, { famille: 'argent', n: 2 }, { famille: 'contacts', n: 1 }, { famille: 'outils', n: 1 }]);
  assert.equal(R.carteModele(m, (id: string) => fam[id], new Set(['a', 'b'])).total, 2, 'un module fermé à l’organisation ne compte pas');
  const b = R.barreModele(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], (id: string) => fam[id]);
  assert.deepEqual(b.groupes, [{ famille: 'jour', modules: ['a', 'c', 'f'] }, { famille: 'argent', modules: ['b', 'e'] }, { famille: 'contacts', modules: ['d'] }]);
  assert.deepEqual([b.dans, b.autres], [6, 2]);
  assert.equal(R.MODULES_CARTE, 4);
});

await dit('les deux routes sont deux constantes, hors registre et hors catalogue ; les écrans sont en export par défaut pour `lazy`', () => {
  assert.equal(R.ROUTE_DEMARRAGE, '/demarrage');
  assert.equal(R.ROUTE_METIER, '/demarrage/metier');
  for (const r of [R.ROUTE_DEMARRAGE, R.ROUTE_METIER]) { assert.ok(!routesDuRegistre.has(r), r); assert.ok(!catalogueCles.includes(r), r); }
  assert.match(sansCommentaires(lireSource('PageDemarrage.tsx')), /export default PageDemarrage;/);
  assert.match(sansCommentaires(lireSource('PageMetier.tsx')), /export default PageMetier;/);
});

/* ═════════════════════════ Les pages branchées (lues dans les sources) ═════════════════════════ */

await dit('PageDemarrage : visite pas à pas (aucun lecteur externe), données par `presentationDemarrage`, aucune personne ni créneau inventés, destinations qui existent, lien générique sans jeton', () => {
  const src = sansCommentaires(lireSource('PageDemarrage.tsx'));
  assert.match(src, /lancer\(parcoursGeneral\(/);
  assert.match(src, /presentationDemarrage\(\{/);
  assert.match(src, /referent=\{null\}/, 'le poste n’a ni référent ni agenda de l’équipe AMN');
  assert.match(src, /aInviter=\{\[\]\}/);
  assert.match(src, /canBuildPublicLink\(\) \? publicOrigin\(\) : null/);
  assert.doesNotMatch(src, /token|jeton|window\.location|\?\w+=/i);
  for (const [, route] of src.matchAll(/navigate\('(\/[^']*)'\)/g)) assert.ok(route === '/' || routesDuRegistre.has(route), `route inconnue : ${route}`);
  assert.match(src, /onEcrire=\{\(\) => navigate\('\/assistance'\)\}/);
  assert.match(src, /ROUTE_METIER/);
  assert.match(src, /usePageCoquille\(\{ famille: 'jour', sousPage: 'home'/);
  assert.match(src, /new KeyboardEvent\('keydown', evenementDeTouche\(/);
  assert.doesNotMatch(src, /dangerouslySetInnerHTML|<iframe|<video/);
  const pres = sansCommentaires(lireSource('presentation.ts'));
  assert.doesNotMatch(pres, /sauvegarde|2:00|30 jours|Excel/i, 'aucune ligne que le poste ne peut pas prouver');
});

await dit('PageMetier : « Continuer » garde le choix puis allège (jamais plus), « Passer » n’allège rien, « Composer » passe par l’assistant sans rien modifier', () => {
  const src = sansCommentaires(lireSource('PageMetier.tsx'));
  assert.match(src, /calculerAllegements\(modules, REGISTRE_MODULES, [\s\S]*?\{ toujoursOuverts: ALWAYS_ON_MODULES, fermes \}\)/);
  assert.match(src, /remplacer\(allegements\)/);
  assert.equal(compter(src, /remplacer\(/g), 1, '« remplacer » n’est appelé qu’à « Continuer »');
  assert.match(src, /remote\s*\.prefs\.set\(CLE_PREFS_METIER, c\)/);
  assert.match(src, /garder\(choixPasse\(taille\), null\)/);
  assert.match(src, /assistant\.open\('chat'\);\s*assistant\.sendMessage\(/);
  assert.match(src, /if \(ALWAYS_ON_MODULES\.includes\(id\)\) return;/);
  assert.match(src, /carteModele\(m, \(id\) => teintes\.get\(id\), disponibles\)/, 'les cartes viennent du modèle et du registre');
  assert.match(src, /barreModele\(/);
  assert.match(src, /extras=\{\[\]\}/, 'un modèle ne crée ni automatisation ni modèle de document : pas d’encart');
  assert.match(src, /totalModules=\{REGISTRE_MODULES\.entrees\.length\}/);
  assert.match(src, /usePageCoquille\(\{ famille: 'jour', sousPage: 'home', miettes: \[\{ libelle: tm\('titre'\), vers: ROUTE_DEMARRAGE \}, \{ libelle: tm\('metier\.miette'\) \}\]/);
});

/* ═════════════════════════ Les cotes des fiches, lues dans le CSS ═════════════════════════ */

const css = sansCommentaires(lireSource('demarrage.css'));
/* L'en-tête des deux vues est le `PageHead` du socle : ses cotes se lisent dans archetypes.css. */
const archetypes = sansCommentaires(lire('src/socle/ui/archetypes/archetypes.css'));
const regle = (sel: string): string => {
  const i = css.indexOf(`${sel} {`);
  assert.ok(i >= 0, `règle « ${sel} » introuvable`);
  return css.slice(i, css.indexOf('}', i) + 1);
};

await dit('cotes de H42 : parcours 1108 × 164 (marges 18 / 22, gouttière 212, anneau 74, nœuds 36 / 48 au pas de 141,4), carte 748 × 486, droite 340 (233 + reste, écart 14), papier 318', () => {
  assert.match(regle('.dem-surface'), /flex-direction: column; gap: 14px/);
  assert.match(regle('.dem-bas'), /grid-template-columns: 748px 340px; gap: 20px; height: 486px/);
  assert.match(regle(":root[data-ambiance='noir'] .dem-parcours"), /height: 164px/);
  assert.match(regle('.dem-parcours__corps'), /padding: 18px 22px/);
  assert.match(regle('.dem-parcours__resume'), /width: 213px; border-right: 1px solid var\(--socle-lateral-filet\)/);
  assert.match(regle('.dem-route'), /grid-template-columns: repeat\(6, 141\.4px\)/);
  assert.match(regle('.dem-noeud__rond'), /width: 36px; height: 36px/);
  assert.match(regle(".dem-route__etape[data-forme='conseillee'] .dem-noeud__rond"), /width: 48px;\s*height: 48px;\s*background: var\(--socle-primaire\)/);
  assert.match(regle(".dem-route__etape[data-forme='faite'] .dem-noeud__rond"), /var\(--socle-etat-succes\) 75%[\s\S]*var\(--socle-etat-succes\) 14%[\s\S]*color: var\(--socle-etat-succes\)/, 'H42.2 : les étapes faites en vert (image v3)');
  assert.match(regle(".dem-route__etape[data-forme='afaire'] .dem-noeud__rond"), /border: 1px dashed var\(--socle-case-vide\)/);
  assert.match(regle('.dem-route__titre'), /max-width: 136px; margin-top: 10px[^}]*font-size: 12\.5px/);
  assert.match(regle('.dem-route__statut'), /font-size: 11\.5px/);
  assert.match(regle('.dem-carte-etape__corps'), /padding: 22px 24px 16px/);
  assert.match(regle(".dem-etape[data-avec-papier='true']"), /grid-template-columns: minmax\(0, 1fr\) 318px/);
  assert.match(regle('.dem-etape__titre'), /font-size: 24px; font-weight: 600/);
  assert.match(regle('.dem-rempli__ligne'), /height: 34px/);
  assert.match(regle('.dem-ensuite'), /height: 52px[\s\S]*border: 1px dashed var\(--socle-bord-bouton\)[\s\S]*border-radius: 12px/);
  assert.match(regle('.dem-papier'), /width: 318px/);
  assert.match(regle('.dem-papier__ligne'), /height: 31px/);
  assert.match(regle(":root[data-ambiance='noir'] .dem-pret"), /height: 233px/);
  assert.match(regle('.dem-pret__ligne'), /height: 45px/);
  assert.match(regle(":root[data-ambiance='noir'] .dem-aide"), /flex: 1/);
  assert.match(regle('.dem-creneaux'), /repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(regle('.dem-aide__actions'), /margin-top: auto/);
  // L'en-tête est le `PageHead` du socle : titre 28 / 600 et sous-titre 13,5 lus dans archetypes.css, les cotes propres de H42 ici.
  assert.match(archetypes, /\.sc-page__titre \{[^}]*font-size: 28px; font-weight: 600/);
  assert.match(archetypes, /\.sc-page__sous-titre \{[^}]*font-size: 13\.5px/);
  assert.match(archetypes, /\.sc-page__actions \{[^}]*gap: 9px/);
  assert.match(regle('.dem-entete.sc-page__entete'), /align-items: flex-end; gap: 16px; margin-bottom: 13px/);
  assert.match(regle('.dem-entete .sc-page__actions'), /padding-bottom: 3px/, 'les boutons d’en-tête posés comme sur H40');
  assert.doesNotMatch(css, /\.dem-titre|\.dem-sous|\.dem-actions/, 'plus de titre ni de boutons locaux : PageHead');
});

await dit('C11 et C12 : la racine de page ne pose pas les chiffres tabulaires (les nombres seulement) ; chaque titre, libellé de carte et de liste porte sa couleur', () => {
  const racinePage = regle(":root[data-ambiance='noir'] :is(.dem-page, .met-page)");
  assert.doesNotMatch(racinePage, /tabular-nums/);
  assert.match(css, /\.sc-nombre \{ font-variant-numeric: tabular-nums; \}/);
  for (const sel of ['.dem-anneau__n', '.dem-anneau__total', '.dem-papier__numero']) assert.match(regle(sel), /tabular-nums/, sel);
  assert.match(archetypes, /\.sc-page__titre \{[^}]*color: var\(--socle-texte-1\)/, 'le titre de page : T1');
  for (const sel of ['.dem-parcours__pretes', '.dem-etape__titre', '.dem-carte__titre', '.dem-pret__titre', '.dem-papier__titre', '.dem-rempli__terme', '.dem-papier__montant'])
    assert.match(regle(sel), /color: var\(--socle-texte-1\)/, `${sel} : T1`);
  for (const sel of ['.dem-ensuite__titre', '.dem-rempli__texte', '.dem-papier__libelle']) assert.match(regle(sel), /color: var\(--socle-texte-courant\)/, `${sel} : T2`);
  assert.match(css, /:is\(\.dem-parcours, \.dem-carte-etape, \.dem-pret, \.dem-aide\) > div \{ height: 100%; color: var\(--socle-texte-1\)/, 'rien n’hérite du gris de la carte');
});

await dit('cotes de H47 : cartes 267 × 189 (4 × 2, écart 14, marges 14 / 15 / 13), tuile 34, bande de 5 px, lignes de 19, mini-interrupteur 16 × 9 ; bande 1108 × 258 (212 + aperçu + 262, écart 20)', () => {
  assert.match(regle('.met-tuiles'), /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\); gap: 14px/);
  assert.match(regle('.met-surface'), /gap: 14px/);
  assert.match(regle('.met-carte'), /height: 189px[\s\S]*padding: 14px 15px 13px[\s\S]*border: 1px solid var\(--socle-bord-carte\)[\s\S]*border-radius: 14px/);
  assert.match(regle(".met-carte[data-choisi='true']"), /border-color: var\(--sc-met-carte-bord\)[\s\S]*background: linear-gradient\(180deg, var\(--sc-met-carte-haut\), var\(--sc-met-carte-bas\)\)[\s\S]*box-shadow: 0 0 0 3px/);
  assert.doesNotMatch(regle(".met-carte[data-choisi='true']"), /border-width|border:/, 'la bordure ne change que de couleur : rien ne bouge');
  assert.match(regle('.met-carte__tuile'), /width: 34px; height: 34px[^}]*border-radius: 10px/);
  assert.match(regle('.met-carte__nom'), /font-size: 14px; font-weight: 600/);
  assert.match(regle('.met-carte__mots'), /font-size: 11\.5px/);
  assert.match(regle('.met-carte__coche'), /width: 18px; height: 18px/);
  assert.match(regle('.met-bande-couleurs'), /gap: 3px; height: 5px; margin-top: 12px/);
  assert.match(regle('.met-bande-couleurs__segment'), /border-radius: 3px; background: var\(--fam\); opacity: 0\.45/);
  assert.match(regle('.met-carte__module'), /height: 19px/);
  assert.match(regle('.met-carte .met-mini'), /width: 16px;\s*height: 9px/);
  assert.match(regle('.met-mini::after'), /inset: -8px -9px/, 'la cible déborde : 34 × 25');
  assert.match(regle(":root[data-ambiance='noir'] .met-bande"), /height: 258px/);
  assert.match(regle('.met-bande__corps'), /grid-template-columns: 212px minmax\(0, 1fr\) 283px; column-gap: 20px; padding: 16px 18px/);
  assert.match(regle('.met-cote'), /padding-left: 20px; border-left: 1px solid var\(--socle-lateral-filet\)/);
  assert.match(regle('.met-barre'), /border: 1px solid var\(--socle-bord-sous-carte\); border-radius: 11px; background: var\(--socle-lateral-bas\)/);
  assert.match(regle('.met-apercu__cartes'), /repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(regle('.met-extra'), /border: 1px dashed var\(--socle-bord-pilule\)/);
  assert.match(regle('.met-decrire'), /border: 1px solid var\(--socle-bord-suggestion\); border-radius: 11px; background: var\(--socle-suggestion-haut\)/);
  for (const sel of ['.met-carte__nom', '.met-barre__titre', '.met-apercu__titre', '.met-apercu__carte-titre', '.met-cote__titre', '.met-decrire__titre']) assert.match(regle(sel), /color: var\(--socle-texte-1\)/, `${sel} : T1 (C12)`);
  for (const sel of ['.met-barre__modules li', ".met-carte[data-choisi='true'] .met-carte__module-nom", '.met-extra__titre']) assert.match(regle(sel), /color: var\(--socle-texte-courant\)/, `${sel} : T2`);
});

await dit('sous 1108 et 780 px de contenu, les colonnes se rangent (conteneur de la coquille) ; le mouvement réduit coupe les animations', () => {
  assert.match(css, /@container \(max-width: 1107px\) \{[^@]*\.dem-bas \{ height: auto; grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /@container \(max-width: 1000px\) \{[^@]*\.dem-route \{ display: flex; flex-direction: column/, 'sous 1000 px, le parcours devient vertical');
  assert.match(css, /@container \(max-width: 780px\) \{[^@]*\.met-tuiles \{ grid-template-columns: repeat\(2/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.met-carte, \.met-mini__pastille \{ transition: none; \}[^@]*\.met-carte:hover \{ transform: none; \}/, 'mouvement réduit : rien ne glisse ni ne se relève (la couche coupe les `data-mvt`)');
  assert.match(css, /@container \(max-width: 1107px\) \{[^@]*\.met-tuiles \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/, 'sous 1280 px : trois colonnes');
  assert.match(css, /@container \(max-width: 780px\) \{[^@]*\.met-barre \{ display: none; \}/, 'sous 1000 px : la barre miniature est masquée');
  const met = sansCommentaires(lireSource('VueMetier.tsx'));
  assert.match(met, /data-mvt="entree"/, 'entrée échelonnée des huit cartes');
  assert.match(met, /rang=\{8\}/, 'puis la bande');
  assert.equal(compter(met, /data-mvt="cascade"/g), 2, 'les modules de la barre miniature et les cartes de journée, une fois');
  assert.doesNotMatch(met, /data-mvt="(onde|flux|balayage|curseur)"/, 'aucune animation continue');
  const vue = sansCommentaires(lireSource('VueDemarrage.tsx'));
  assert.equal(compter(vue, /data-mvt="onde"/g) + compter(vue, /<FlowLine\b/g), 2, 'deux animations continues seulement : le halo et la liaison qui s’écoule');
  assert.match(vue, /data-mvt="entree"/);
  assert.match(vue, /data-mvt="cascade"/, 'les lignes du papier entrent une à une');
  for (const r of [0, 1, 2, 3]) assert.match(vue, new RegExp(`rang=\\{${r}\\}`), `la carte de rang ${r} entre à son tour`);
});

/* ═════════════════════════ L'hygiène ═════════════════════════ */

await dit('aucune couleur en dur : pas un #hex hors des trois `--sc-…` déclarés, pas de rgb()', () => {
  for (const m of css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const debut = css.lastIndexOf('\n', m.index) + 1;
    assert.match(css.slice(debut, css.indexOf('\n', m.index)), /^\s*--sc-[\w-]+:\s*#/, `couleur en dur : ${m[0]}`);
  }
  assert.equal(compter(css, /--sc-[\w-]+:\s*#[0-9a-f]{6}/g), 7);
  assert.doesNotMatch(css, /\brgba?\(|\bhsla?\(/);
  for (const f of codes) assert.doesNotMatch(sansCommentaires(lireSource(f)), /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])|rgba?\(/, `${f} : couleur en dur`);
});

await dit('les encres « discret » ne sont jamais la couleur d’un texte ; le texte lu ne descend pas sous 11 px', () => {
  assert.doesNotMatch(css, /color:\s*var\(--socle-trait|color:\s*#(77777c|5f5f64)/i);
  for (const f of codes) assert.doesNotMatch(sansCommentaires(lireSource(f)), /trait-discret|trait-tres-discret|77777c|5f5f64|text-\[var\(--socle-trait/i, f);
  for (const m of css.matchAll(/font-size:\s*([\d.]+)px/g)) assert.ok(Number(m[1]) >= 10.5, `texte trop petit : ${m[0]}`);
  assert.doesNotMatch(css, /color:\s*var\(--socle-texte-discret|--color-socle-texte-discret/);
});

await dit('aucun nom d’exemple des fiches dans les sources ; « Stripe » n’est que le libellé par défaut de l’étape 5 (un texte, jamais une logique)', () => {
  for (const f of sources) {
    const src = sansCommentaires(lireSource(f));
    assert.doesNotMatch(src, /Aaron|Mohamed|Riyad|Dupont|Menna|Carrelage|8\s?400|Cabinet Roux|Medina|Atelier du mardi/i, `${f} : un nom d'exemple`);
    if (f !== 'modeles.ts') assert.doesNotMatch(src, /stripe/i, `${f} : Stripe hors du libellé par défaut`);
  }
  const modeles = sansCommentaires(lireSource('modeles.ts'));
  for (const [ligne] of modeles.matchAll(/^.*stripe.*$/gim)) assert.match(ligne, /^\s*(sous|texte): L\('(Stripe ou votre banque|Reliez Stripe ou votre banque)[^']*', '(Stripe or your bank|Link Stripe or your bank)[^']*'\),$/);
  assert.equal(compter(modeles, /stripe/gi), 4);
});

await dit('aucun robot, mascotte, émoji ni confettis ; Ajmani n’est qu’un nom et l’étincelle ; aucun secret', () => {
  for (const f of codes) {
    const src = sansCommentaires(lireSource(f));
    assert.doesNotMatch(src, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, `${f} : un émoji`);
    assert.doesNotMatch(src, /confetti|mascotte|\brobot\b/i, f);
    // Un avatar (des initiales, jamais un visage) seulement pour une PERSONNE de l'équipe : jamais pour Ajmani.
    assert.doesNotMatch(src.replace(/<Avatar nom=\{r\.nom\}|<PileAvatars noms=\{\[\.\.\.p\.aInviter\]\}|\b(PileAvatars|Avatar),|\bAvatar\b(?= \})/g, ''), /avatar/i, `${f} : un avatar hors d’une personne`);
    assert.doesNotMatch(src, /sk_live|sk_test|api[_-]?key|\bsecret\b|password|mot de passe|Bearer /i, `${f} : un secret ?`);
  }
  assert.match(sansCommentaires(lireSource('VueDemarrage.tsx')), /IconeEtincelle/);
});

await dit('les imports restent dans la zone permise ; rien d’extérieur à `src/edition` n’importe cette zone ; aucune écriture dans les collections (surtout pas `profiles`)', () => {
  const permis = ['socle', 'refonte', 'lib', 'state', 'data', 'auth', 'shared', 'guide', 'assistant', 'i18n'];
  for (const f of codes) {
    for (const [, spec] of sansCommentaires(lireSource(f)).matchAll(/from '([^']+)'/g)) {
      if (!spec.startsWith('.')) continue;
      const cible = path.relative(path.join(racine, 'src'), path.resolve(path.join(racine, DIR), spec)).split(path.sep);
      assert.ok(permis.includes(cible[0]), `${f} importe ${spec}`);
      if (cible[0] === 'refonte') assert.ok(['systeme', 'modules', 'coquille', 'navigation'].includes(cible[1]), `${f} importe ${spec}`);
    }
  }
  const dehors: string[] = [];
  const parcours = (d: string) => {
    for (const e of fs.readdirSync(path.join(racine, d), { withFileTypes: true })) {
      const rel = `${d}/${e.name}`;
      if (e.isDirectory()) parcours(rel);
      else if (/\.tsx?$/.test(e.name) && !rel.startsWith(DIR) && /systeme\/demarrage/.test(lire(rel))) dehors.push(rel);
    }
  };
  parcours('src');
  assert.deepEqual(dehors.filter((f) => !/^src\/edition\/[\w.]+\.internal\.tsx?$/.test(f)), [], 'un fichier partagé importe la zone de Démarrage');
  for (const f of codes) assert.doesNotMatch(sansCommentaires(lireSource(f)), /\bupsert\(|\.remove\(|updateSelf|useSync\(\)\.(upsert|remove)/, `${f} écrit dans une collection`);
});

fin();
