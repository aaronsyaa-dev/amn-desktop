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
    "export { VueDemarrage, SqueletteDemarrage, LienMobile } from '../src/refonte/systeme/demarrage/VueDemarrage';",
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
    ['Artisan du bâtiment', 'Chantiers, devis, stock'], ['Commerce', 'Stock, fournisseurs, avis'], ['Conseil et services', 'Clients, missions, factures'],
    ['Start-up', 'Tickets, tableau de bord, équipe'], ['Création et agence', 'Projets, visuels, signatures'], ['Vie de tous les jours', 'Courses, budget, rendez-vous'],
    ['Santé et bien-être', 'Agenda, dossiers, rappels'], ['Association', 'Membres, annonces, dons'],
  ];
  assert.deepEqual(MODELES.map((m) => [m.nom.fr, m.description.fr]), attendu);
  assert.equal(new Set(MODELES.map((m) => m.id)).size, 8);
  assert.deepEqual(MODELES.map((m) => m.icone), ['camion', 'cube', 'utilisateurs', 'eclair', 'etincelle', 'maison', 'calendrier', 'livre']);
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
  const ferme = new Set(MODELES[0].modules.filter((id) => id !== 'stock'));
  assert.equal(R.composition(MODELES[0], ferme).tous.includes('stock'), false);
  assert.equal(R.composition(MODELES[0], ferme).autres, MODELES[0].modules.length - 1 - 6);
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
  assert.equal(d.client.titre.fr, 'Ajouter votre premier client');
  assert.equal(d.devis.titre.fr, 'Créer votre premier devis');
  assert.equal(d.devis.sous.fr, 'Ajmani vous guide, 2 minutes');
  assert.equal(d.devis.action.fr, 'Créer un devis');
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

await dit('le texte suit le compte : « Plus que N étapes… » au pluriel, « Plus qu’une étape… » au singulier, « Votre espace est prêt » à N sur N', () => {
  const faites = { clients: 1, quotes: 1, tasks: 0, appointments: 0, membres: 2 };
  const base = { donnees: faites, memoire: { faites: ['paiement'], retirees: [] } };
  const quatre = calc({ donnees: { ...DV, clients: 1 } });
  assert.deepEqual([quatre.n, quatre.restantes, quatre.texte], [2, 4, 'plusieurs']);
  assert.equal(R.traduire('fr', `texte.${quatre.texte}`, { n: quatre.restantes }), 'Plus que 4 étapes pour que tout soit prêt. Vous pouvez les faire dans l’ordre que vous voulez.');
  const une = calc(base);
  assert.deepEqual([une.n, une.restantes, une.texte, une.conseillee], [5, 1, 'une', 'mobile']);
  assert.equal(R.traduire('fr', 'texte.une'), 'Plus qu’une étape pour que tout soit prêt.');
  const tout = calc({ ...base, memoire: { faites: ['paiement', 'mobile'], retirees: [] } });
  assert.deepEqual([tout.n, tout.total, tout.tout, tout.ratio, tout.conseillee, tout.texte], [6, 6, true, 1, null, 'tout']);
  assert.equal(tout.etapes.some((e: any) => e.conseillee), false, 'à 6/6, plus aucun bouton primaire dans la liste');
  assert.equal(R.traduire('fr', 'texte.tout'), 'Tout est en place. Vous pouvez compter sur Ajmani pour la suite.');
  assert.equal(R.traduire('fr', 'pret', { prenom: 'Camille' }), 'Votre espace est prêt, Camille');
  assert.equal(R.traduire('fr', 'bienvenue', { prenom: 'Camille' }), 'Bienvenue, Camille');
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
  assert.equal(passe.etapes.find((x: any) => x.id === 'client').libelle.titre.fr, 'Ajouter votre premier client', 'jeu général : les textes de la maquette');
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
    'allerAccueil': 'Aller à l’accueil', 'visite.titre': 'Visite guidée, 2 minutes', 'visite.texte': 'Le tour de ce que vous pouvez faire ici.', 'savoir.titre': 'Bon à savoir',
    'savoir.chercher': 'Chercher n’importe quoi', 'savoir.ajmani': 'Parler à Ajmani', 'savoir.raccourcis': 'Voir tous les raccourcis',
    'aide.ajmani.titre': 'Demander à Ajmani', 'aide.ajmani.texte': 'Il vous guide pas à pas', 'aide.appel.titre': 'Un appel de 15 minutes', 'aide.appel.texte': 'Avec quelqu’un de l’équipe',
    'aide.donnees.titre': 'Reprendre vos données', 'aide.donnees.texte': 'Depuis Excel ou un autre outil', 'aide.ajmani.demande': 'Guide-moi pas à pas pour finir la configuration',
    'etape.metier.titre': 'Choisir votre métier', 'etape.metier.sous': 'Pour activer les bons modules', 'etape.equipe.titre': 'Inviter votre équipe', 'etape.equipe.sous': 'Chacun garde ses accès',
    'etape.mobile.titre': 'Installer l’application mobile', 'etape.mobile.sous': 'Vos tâches dans la poche', 'etape.mobile.action': 'Obtenir le lien', 'etape.equipe.action': 'Inviter',
    'erreur': 'Votre progression n’a pas pu être chargée.', 'erreur.reessayer': 'Réessayer', 'horsLigne': 'Disponible au retour du réseau', 'etape.admin': 'Réservé aux administrateurs',
    'etape.libre': 'Besoin d’aide ? Ajmani peut faire ces étapes avec vous.',
    'metier.titre': 'Quel est votre métier ?', 'metier.sous': 'On active les bons modules, vous n’avez rien d’autre à régler', 'metier.passer': 'Passer', 'metier.continuer': 'Continuer',
    'metier.continuer.info': 'Choisissez un métier ou utilisez Passer', 'taille.titre': 'Combien êtes-vous ?', 'taille.aide': 'Pour régler les accès et les rôles', 'taille.seul': 'Seul', 'taille.2-5': '2 à 5',
    'taille.6-20': '6 à 20', 'taille.plus': 'Plus', 'apercu.titre': 'Votre première journée, en aperçu', 'apercu.aide': 'Ce que vous verrez dès demain matin',
    'decrire.texte': 'Votre activité n’est pas dans la liste ? Décrivez-la en une phrase, Ajmani compose l’espace.', 'decrire.bouton': 'Décrire', 'decrire.champ': 'Décrivez votre activité en une phrase',
    'decrire.composer': 'Composer l’espace', 'compose.titre': 'Votre espace sera composé de', 'compose.sous': 'Vous pourrez tout changer plus tard',
    'compose.autres': '+ {n} autres modules disponibles à tout moment', 'compose.autres.zero': 'Tous les modules du modèle sont affichés', 'vide.titre': 'Choisissez un métier',
    'vide.texte': 'Les modules à activer apparaîtront ici.', 'vide.action': 'Décrire mon activité', 'erreur.enregistrement': 'Votre choix n’a pas pu être enregistré.',
  };
  for (const [k, v] of Object.entries(attendu)) assert.equal(fr[k], v, k);
  const aAjmani = new Set(['aide.ajmani.demande', 'decrire.consigne']);
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
  onPlusTard: noop, onAccueil: noop, onReprendreVisite: noop, onReessayer: noop, onAgir: noop, onOuvrir: noop, onMarquer: noop, onRetirer: noop, onRemettre: noop,
  onRaccourci: noop, onAjmani: noop, onAppel: noop, onDonnees: noop, ...surcharge,
});
const vueDem = (s: Record<string, unknown> = {}): string => rendre(h(R.VueDemarrage, propsDem(s)));
const lignes = (html: string): string[] => html.split('<li class="dem-etape"').slice(1).map((x) => x.split('</li>')[0]);

await dit('H42 · 2 sur 6 : un h1, l’anneau de 80 px à 33 %, « 2/6 », le titre, le texte, six étapes dont deux faites et une seule conseillée', () => {
  const html = vueDem();
  assert.equal(compter(html, /<h1[ >]/g), 1);
  assert.match(html, />Démarrage<\/h1>/);
  assert.match(html, /role="progressbar"[^>]*aria-valuenow="33"/);
  assert.match(html, /width:80px;height:80px/);
  assert.match(html, />2\/6</);
  assert.match(html, />Bienvenue, Camille<\/h2>/);
  assert.match(html, /Plus que 4 étapes pour que tout soit prêt\. Vous pouvez les faire dans l’ordre que vous voulez\./);
  const l = lignes(html);
  assert.equal(l.length, 6);
  assert.equal(compter(html, /role="checkbox"/g), 6);
  assert.equal(compter(html, /role="checkbox"[^>]*aria-checked="true"/g), 2);
  assert.equal(compter(html, /data-conseillee="true"/g), 1);
  assert.match(l[2], /data-conseillee/);
  assert.match(l[2], /data-variante="primaire"[^>]*>(<span[^>]*>)?Créer un devis/);
  assert.equal(primaires(html), 1, 'un seul bouton primaire : celui de l’étape conseillée');
  assert.match(html, /Inviter<\/span>/);
  assert.match(html, />Connecter</);
  assert.match(html, />Obtenir le lien</);
  assert.equal(compter(html, /data-variante="secondaire"/g), 2 + 3, 'en-tête (2) + trois boutons secondaires d’étapes');
});

await dit('H42 · étapes faites : titre et sous-titre T4, SANS barré, sans bouton, titre ouvrable ; étapes à faire : T1', () => {
  const l = lignes(vueDem());
  for (const i of [0, 1]) {
    assert.match(l[i], /data-faite="true"/);
    assert.doesNotMatch(l[i], /line-through|<s>|<del>|text-decoration/);
    assert.doesNotMatch(l[i], /<button[^>]*data-socle="bouton"/, 'une étape faite n’a pas de bouton d’action');
    assert.match(l[i], /class="dem-etape__ouvrir sc-focus"/);
  }
  for (const i of [2, 3, 4, 5]) assert.doesNotMatch(l[i], /data-faite/);
  const css = sansCommentaires(lireSource('demarrage.css'));
  assert.doesNotMatch(css, /line-through/);
  assert.match(css, /\.dem-etape\[data-faite='true'\] \.dem-etape__titre \{[^}]*color: var\(--socle-texte-3\)[^}]*text-decoration: none/);
  assert.match(css, /\.dem-etape__titre \{[^}]*color: var\(--socle-texte-1\)/);
  assert.match(css, /\.dem-etape__sous \{[^}]*color: var\(--socle-texte-3\)/);
  assert.doesNotMatch(sansCommentaires(lireSource('VueDemarrage.tsx')), /LigneTache/, 'la ligne de tâche barre le texte coché : on ne s’en sert pas ici');
  assert.match(l[0], /aria-checked="true"/);
});

await dit('H42 · 6 sur 6 : « Votre espace est prêt », anneau plein, liste visible, « Aller à l’accueil » devient le seul bouton primaire, « Plus tard » disparaît', () => {
  const tout = calc({ donnees: { clients: 1, quotes: 1, tasks: 0, appointments: 0, membres: 2 }, memoire: { faites: ['paiement', 'mobile'], retirees: [] } });
  const html = vueDem({ calcul: tout });
  assert.match(html, />Votre espace est prêt, Camille<\/h2>/);
  assert.match(html, /Tout est en place\. Vous pouvez compter sur Ajmani pour la suite\./);
  assert.match(html, /aria-valuenow="100"/);
  assert.match(html, />6\/6</);
  assert.equal(compter(html, /role="checkbox"[^>]*aria-checked="true"/g), 6);
  assert.match(html, /Aller à l’accueil/);
  assert.doesNotMatch(html, />Plus tard</);
  assert.equal(primaires(html), 1);
  assert.match(html, /data-variante="primaire"[^>]*>(<span[^>]*>)?Aller à l’accueil/);
  assert.equal(compter(html, /data-conseillee/g), 0);
  assert.match(vueDem({ calcul: tout, prenom: '' }), />Votre espace est prêt<\/h2>/);
});

await dit('H42 · « Seul » : cinq étapes, « 2/5 » ; une étape retirée : « Les remettre » ; une liste courte garde sa place avec « Besoin d’aide ? »', () => {
  const seul = calc({ metier: { ...artisan, taille: 'seul' }, donnees: { ...DV, clients: 1 } });
  const html = vueDem({ calcul: seul });
  assert.equal(lignes(html).length, 5);
  assert.match(html, />2\/5</);
  assert.doesNotMatch(html, />Inviter votre équipe</);
  assert.match(html, /Besoin d’aide \? Ajmani peut faire ces étapes avec vous\./);
  const retiree = calc({ memoire: R.retirerEtape(R.MEMOIRE_VIDE, 'mobile') });
  const h2 = vueDem({ calcul: retiree });
  assert.match(h2, /1 étape sortie de la liste/);
  assert.match(h2, />Les remettre</);
  assert.doesNotMatch(vueDem(), />Les remettre</);
  assert.doesNotMatch(vueDem(), /Besoin d’aide/, 'six lignes : pas de place à combler');
});

await dit('H42 · colonne de droite : visite guidée (bouton de lecture, aucun lecteur externe), « Bon à savoir » à trois raccourcis, bandeau à trois tuiles', () => {
  const html = vueDem();
  assert.match(html, /class="dem-poster__lire sc-focus"[^>]*aria-label="Lancer la visite guidée \(2 minutes\)"/);
  assert.doesNotMatch(html, /<video|<iframe|<audio|youtube|vimeo/i);
  assert.match(html, />Visite guidée, 2 minutes</);
  assert.equal(compter(html, /class="dem-savoir__ligne/g), 3);
  assert.match(html, /<kbd[^>]*>⌘K<\/kbd>/);
  assert.match(html, /<kbd[^>]*>⌘J<\/kbd>/);
  assert.match(html, /<kbd[^>]*>\?<\/kbd>/);
  assert.doesNotMatch(html, /Créer, partout/);
  assert.match(vueDem({ mac: false }), /<kbd[^>]*>Ctrl K<\/kbd>/);
  assert.match(vueDem({ mac: false }), /data-large="true"/);
  assert.equal(compter(html, /class="dem-tuile sc-focus"/g), 3);
  for (const t of ['Demander à Ajmani', 'Un appel de 15 minutes', 'Reprendre vos données', 'Il vous guide pas à pas', 'Avec quelqu’un de l’équipe', 'Depuis Excel ou un autre outil']) assert.match(html, new RegExp(t));
  assert.equal(compter(html, /<svg[^>]*aria-hidden="true"/g) >= 5 ? 1 : 0, 1, 'les icônes sont décoratives');
});

await dit('H42 · chargement : squelettes (anneau, six lignes, cartes de droite), région annoncée, aucun bouton primaire, la page garde son h1', () => {
  const html = vueDem({ etat: 'chargement' });
  assert.match(html, /role="status"[^>]*aria-busy="true"[^>]*aria-label="Chargement de votre progression"|aria-busy="true"[^>]*role="status"/);
  assert.equal(compter(html, /class="dem-squelette-ligne"/g), 6);
  assert.equal(compter(html, /<h1[ >]/g), 1);
  assert.equal(primaires(html), 0);
  assert.doesNotMatch(html, /role="checkbox"/);
  assert.match(rendre(h(R.SqueletteDemarrage)), /dem-grille/);
});

await dit('H42 · erreur : le bandeau « Votre progression n’a pas pu être chargée. » et « Réessayer », les étapes et leurs boutons restent là', () => {
  const html = vueDem({ etat: 'erreur' });
  assert.match(html, /role="alert"/);
  assert.match(html, /Votre progression n’a pas pu être chargée\./);
  assert.match(html, />Réessayer</);
  assert.equal(lignes(html).length, 6);
  assert.equal(primaires(html), 1);
});

await dit('H42 · hors ligne : « Connecter », « Obtenir le lien » et « Un appel de 15 minutes » sont grisés avec « Disponible au retour du réseau » ; « Plus tard » reste actif', () => {
  const calcul = calc({ donnees: { clients: 1, quotes: 1, tasks: 0, appointments: 0, membres: 2 } });
  assert.equal(calcul.conseillee, 'paiement');
  const html = vueDem({ calcul, horsLigne: true });
  assert.match(html, /<span class="dem-etape__bouton" title="Disponible au retour du réseau"><button[^>]*data-variante="primaire"[^>]*disabled=""/);
  assert.match(html, /<span class="dem-etape__bouton" title="Disponible au retour du réseau"><button[^>]*data-variante="secondaire"[^>]*disabled=""[^>]*>(<span[^>]*>)?Obtenir le lien/);
  assert.match(html, /<button[^>]*class="dem-tuile sc-focus"[^>]*disabled=""[^>]*title="Disponible au retour du réseau"[\s\S]*?Un appel de 15 minutes/);
  assert.doesNotMatch(html, /<button[^>]*disabled=""[^>]*>(<span[^>]*>)?Plus tard/);
  assert.equal(primaires(html), 1);
  assert.doesNotMatch(vueDem({ calcul }), /disabled=""/);
});

await dit('H42 · droits : sans droit d’administration, « Inviter » et « Connecter » deviennent « Réservé aux administrateurs »', () => {
  const calcul = calc({ donnees: { ...DV, clients: 1, quotes: 1 } });
  const html = vueDem({ calcul, peutAdministrer: false });
  assert.equal(compter(html, /Réservé aux administrateurs/g), 2);
  assert.doesNotMatch(html, />Inviter</);
  assert.doesNotMatch(html, />Connecter</);
  assert.match(html, />Obtenir le lien</, 'l’application mobile reste à tout le monde');
  assert.equal(compter(vueDem({ calcul }), /Réservé aux administrateurs/g), 0);
  assert.equal(primaires(html), 0, 'la conseillée est « Inviter » : remplacée, plus de primaire — jamais un second');
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

const propsMet = (surcharge: Record<string, unknown> = {}) => ({
  choix: null, taille: '2-5', lignes: [], autres: 0, teintesApercu: [], dernierActif: false, horsLigne: false, erreurEnregistrement: false,
  decrireOuvert: false, phrase: '', composeEnvoye: false, onChoisir: noop, onTaille: noop, onBasculer: noop, onContinuer: noop, onPasser: noop, onReessayer: noop,
  onDecrire: noop, onPhrase: noop, onComposer: noop, ...surcharge,
});
const lignesDe = (id: string) => {
  const m = R.modeleParId(id) as Modele;
  const c = R.composition(m);
  return { lignes: c.affiches.map((x: string) => ({ id: x, nom: `Module ${x}`, teinte: 'argent', actif: true, toujours: false })), autres: c.autres, teintesApercu: m.apercu.map(() => 'creer') };
};
const vueMet = (s: Record<string, unknown> = {}): string => rendre(h(R.VueMetier, propsMet(s)));

await dit('H47 · premier affichage : un h1, un groupe radio de huit tuiles non choisies, « Continuer » grisé et seul primaire, carte de droite « Choisissez un métier »', () => {
  const html = vueMet();
  assert.equal(compter(html, /<h1[ >]/g), 1);
  assert.match(html, />Quel est votre métier \?<\/h1>/);
  assert.match(html, /role="radiogroup"[^>]*aria-label="Familles de métiers"/);
  assert.equal(compter(html, /role="radio"[^>]*class="met-tuile/g), 8);
  assert.equal(compter(html, /class="met-tuile[^"]*"[^>]*>/g) >= 8 ? 1 : 0, 1);
  assert.equal(compter(html, /role="radio"[^>]*aria-checked="false"[^>]*class="met-tuile/g), 8);
  assert.equal(compter(html, /aria-checked="true"[^>]*class="met-tuile/g), 0);
  assert.equal(compter(html, /met-tuile__coche/g), 0);
  assert.equal(compter(html, /role="radio"[^>]*tabindex="0"[^>]*class="met-tuile/g), 1, 'une seule tuile dans l’ordre de tabulation');
  assert.match(html, /<span title="Choisissez un métier ou utilisez Passer"><button/);
  assert.match(bouton(html, 'Continuer').attrs, /data-variante="primaire"[^>]*disabled=""/);
  assert.match(bouton(html, 'Passer').attrs, /data-variante="secondaire"/);
  assert.equal(primaires(html), 1);
  assert.match(html, />Passer</);
  assert.match(html, /<h2[^>]*>Choisissez un métier<\/h2>/);
  assert.match(html, /Les modules à activer apparaîtront ici\./);
  assert.match(html, />Décrire mon activité</);
  assert.equal(compter(html, /role="switch"/g), 0);
  assert.match(html, /Choisissez un métier : trois exemples/);
  for (const m of MODELES) { assert.match(html, new RegExp(m.nom.fr)); assert.match(html, new RegExp(m.description.fr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))); }
});

await dit('H47 · une tuile choisie : une seule coche (aria-checked + disque, pas la couleur seule), six interrupteurs, « + N autres », trois cartes d’aperçu marquées comme exemples', () => {
  const html = vueMet({ choix: 'artisan', ...lignesDe('artisan') });
  assert.equal(compter(html, /aria-checked="true"[^>]*class="met-tuile/g), 1);
  assert.equal(compter(html, /met-tuile__coche/g), 1);
  assert.equal(compter(html, /role="radio"[^>]*tabindex="0"[^>]*class="met-tuile/g), 1);
  assert.equal(compter(html, /role="switch"/g), 6);
  assert.equal(compter(html, /role="switch"[^>]*aria-checked="true"/g), 6);
  assert.match(html, /\+ 6 autres modules disponibles à tout moment/);
  assert.equal(compter(html, /class="met-ligne"/g), 6);
  assert.equal(compter(html, /class="met-apercu__carte"/g), 3);
  assert.match(html, />Exemple<\/span>/);
  assert.match(html, />Votre première journée, en aperçu<\/h2>/);
  assert.match(html, />Votre espace sera composé de<\/h2>/);
  assert.match(html, /Vous pourrez tout changer plus tard/);
  assert.equal(primaires(html), 1);
  assert.doesNotMatch(bouton(html, 'Continuer').attrs, /disabled=""/, '« Continuer » est actif une fois un métier choisi');
  assert.doesNotMatch(html, /Choisissez un métier ou utilisez Passer/);
  assert.doesNotMatch(html, /Dupont|Carrelage|8 400/);
  assert.match(vueMet({ choix: 'artisan', lignes: [], autres: 0 }), /Tous les modules du modèle sont affichés/);
  assert.equal(boutons(vueMet({ choix: 'artisan', ...lignesDe('artisan'), taille: 'seul' })).filter((b) => b.texte === 'Seul' && /aria-checked="true"/.test(b.attrs)).length, 1, 'la taille choisie est cochée');
});

await dit('H47 · « Combien êtes-vous ? » : un groupe radio de quatre options (Seul, 2 à 5, 6 à 20, Plus), « 2 à 5 » par défaut', () => {
  const html = vueMet();
  assert.match(html, /role="radiogroup"[^>]*aria-label="Combien êtes-vous \?"/);
  for (const t of ['Seul', '2 à 5', '6 à 20', 'Plus']) assert.match(html, new RegExp(`>${t}</button>`));
  assert.match(bouton(html, '2 à 5').attrs, /aria-checked="true"/);
  assert.equal(boutons(html).filter((b) => /role="radio"/.test(b.attrs) && ['Seul', '2 à 5', '6 à 20', 'Plus'].includes(b.texte)).length, 4);
});

await dit('H47 · « Décrire » : replié, un bouton secondaire ; déplié, « Composer l’espace » est le seul primaire (« Continuer » passe en secondaire) ; hors ligne, grisé avec son info-bulle', () => {
  const ferme = vueMet({ choix: 'commerce', ...lignesDe('commerce') });
  assert.match(ferme, /Votre activité n’est pas dans la liste \? Décrivez-la en une phrase, Ajmani compose l’espace\./);
  assert.match(bouton(ferme, 'Décrire').attrs, /data-variante="secondaire"[^>]*aria-expanded="false"/);
  assert.doesNotMatch(ferme, /Composer l’espace/);
  const ouvert = vueMet({ choix: 'commerce', ...lignesDe('commerce'), decrireOuvert: true, phrase: 'x' });
  assert.match(ouvert, /Décrivez votre activité en une phrase/);
  assert.match(bouton(ouvert, 'Composer l’espace').attrs, /data-variante="primaire"/);
  assert.equal(primaires(ouvert), 1);
  assert.match(bouton(ouvert, 'Continuer').attrs, /data-variante="secondaire"/);
  const hors = vueMet({ horsLigne: true });
  assert.match(hors, /<span title="Disponible au retour du réseau"><button/);
  assert.match(bouton(hors, 'Décrire').attrs, /disabled=""/);
  assert.match(bouton(vueMet({ choix: 'commerce', ...lignesDe('commerce'), decrireOuvert: true, phrase: 'x', horsLigne: true }), 'Composer l’espace').attrs, /disabled=""/);
  assert.match(bouton(vueMet({ choix: 'commerce', ...lignesDe('commerce'), decrireOuvert: true, phrase: '  ' }), 'Composer l’espace').attrs, /disabled=""/, 'sans phrase, rien à composer');
  assert.match(vueMet({ composeEnvoye: true }), /role="status"[^>]*>Ajmani vous répond dans son panneau/);
});

await dit('H47 · erreur d’enregistrement : « Votre choix n’a pas pu être enregistré. » et « Réessayer », les choix de la page restent', () => {
  const html = vueMet({ choix: 'artisan', ...lignesDe('artisan'), erreurEnregistrement: true });
  assert.match(html, /role="alert"/);
  assert.match(html, /Votre choix n’a pas pu être enregistré\./);
  assert.match(html, />Réessayer</);
  assert.equal(compter(html, /aria-checked="true"[^>]*class="met-tuile/g), 1);
  assert.equal(primaires(html), 1);
});

await dit('H47 · un module toujours ouvert garde son interrupteur allumé et grisé ; le dernier module activable ne s’éteint pas', () => {
  const lg = [{ id: 'members', nom: 'Droits et accès', teinte: 'outils', actif: true, toujours: true }, { id: 'vault', nom: 'Coffre-fort', teinte: 'outils', actif: true, toujours: false }];
  const html = vueMet({ choix: 'sante', lignes: lg, autres: 4, dernierActif: true });
  assert.match(html, /<span title="Toujours disponible"><button[^>]*role="switch"[^>]*aria-checked="true"[^>]*disabled=""/);
  assert.match(html, /<span title="Au moins un module reste activé"><button[^>]*role="switch"[^>]*aria-checked="true"[^>]*disabled=""/);
  assert.match(vueMet({ choix: 'sante', lignes: [{ ...lg[1], actif: false }], autres: 0, dernierActif: true }), /role="switch"[^>]*aria-checked="false"/);
});

await dit('H47 · squelette (repli de `lazy`) : huit blocs de 127 de haut, la carte de droite de 369, région annoncée', () => {
  const html = rendre(h(R.SqueletteMetier));
  assert.match(html, /role="status"[^>]*aria-busy="true"|aria-busy="true"[^>]*role="status"/);
  assert.equal(compter(html, /height:127px/g), 8);
  assert.match(html, /height:369px/);
});

await dit('les deux routes sont deux constantes, hors registre et hors catalogue ; les écrans sont en export par défaut pour `lazy`', () => {
  assert.equal(R.ROUTE_DEMARRAGE, '/demarrage');
  assert.equal(R.ROUTE_METIER, '/demarrage/metier');
  for (const r of [R.ROUTE_DEMARRAGE, R.ROUTE_METIER]) { assert.ok(!routesDuRegistre.has(r), r); assert.ok(!catalogueCles.includes(r), r); }
  assert.match(sansCommentaires(lireSource('PageDemarrage.tsx')), /export default PageDemarrage;/);
  assert.match(sansCommentaires(lireSource('PageMetier.tsx')), /export default PageMetier;/);
});

/* ═════════════════════════ Les pages branchées (lues dans les sources) ═════════════════════════ */

await dit('PageDemarrage : visite pas à pas (aucun lecteur externe), assistant, destinations qui existent, lien générique sans jeton', () => {
  const src = sansCommentaires(lireSource('PageDemarrage.tsx'));
  assert.match(src, /lancer\(parcoursGeneral\(/);
  assert.match(src, /assistant\.open\('chat'\);\s*assistant\.sendMessage\(/);
  assert.match(src, /canBuildPublicLink\(\) \? publicOrigin\(\) : null/);
  assert.doesNotMatch(src, /token|jeton|window\.location|\?\w+=/i);
  for (const [, route] of src.matchAll(/navigate\('(\/[^']*)'\)/g)) assert.ok(route === '/' || routesDuRegistre.has(route), `route inconnue : ${route}`);
  assert.match(src, /navigate\('\/assistance'\)/);
  assert.match(src, /navigate\('\/outils\/donnees'\)/);
  assert.match(src, /ROUTE_METIER/);
  assert.match(src, /new KeyboardEvent\('keydown', evenementDeTouche\(/);
  assert.doesNotMatch(src, /dangerouslySetInnerHTML|<iframe|<video/);
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
});

/* ═════════════════════════ Les cotes des fiches, lues dans le CSS ═════════════════════════ */

const css = sansCommentaires(lireSource('demarrage.css'));
const regle = (sel: string): string => {
  const i = css.indexOf(`${sel} {`);
  assert.ok(i >= 0, `règle « ${sel} » introuvable`);
  return css.slice(i, css.indexOf('}', i) + 1);
};

await dit('cotes de H42 : 728 × 510, colonne droite 360 (229 + 225, écart 14), bandeau 1108 × 92 avec tuiles de 62, étapes de 63, poster 326 × 152 et bouton de 54, touche de 36', () => {
  assert.match(regle('.dem-grille'), /grid-template-columns: 728px 360px[^}]*gap: 20px/);
  assert.match(regle(":root[data-ambiance='noir'] .dem-principale"), /width: 728px[^}]*min-height: 510px/);
  assert.match(regle(':root[data-ambiance=\'noir\'] .dem-principale'), /padding: 20px 22px/);
  assert.match(regle('.dem-accueil'), /height: 80px/);
  assert.match(regle('.dem-droite'), /gap: 14px/);
  assert.match(regle(":root[data-ambiance='noir'] .dem-visite"), /height: 229px/);
  assert.match(regle('.dem-poster'), /height: 152px[^}]*border-radius: 14px/);
  assert.match(regle('.dem-poster__lire'), /width: 54px[^}]*height: 54px/);
  assert.match(regle(":root[data-ambiance='noir'] .dem-savoir"), /height: 225px/);
  assert.match(regle('.dem-savoir__ligne'), /height: 41px/);
  assert.match(regle('.dem-touche'), /width: 36px/);
  assert.match(regle('.dem-etape'), /height: 63px/);
  assert.match(regle(":root[data-ambiance='noir'] .dem-aide"), /height: 92px[^}]*padding: 14px 16px/);
  assert.match(regle('.dem-aide__grille'), /repeat\(3, minmax\(0, 1fr\)\)[^}]*gap: 14px/);
  assert.match(regle('.dem-tuile'), /height: 62px/);
  assert.match(regle('.dem-tuile__icone'), /width: 36px[^}]*height: 36px[^}]*border-radius: 10px/);
  assert.match(regle('.dem-entete'), /margin-bottom: 16px/);
  assert.match(regle('.dem-titre'), /font-size: 28px[^}]*font-weight: 600/);
  assert.match(regle('.dem-sous'), /font-size: 13\.5px/);
  assert.match(sansCommentaires(lireSource('VueDemarrage.tsx')), /taille=\{80\}[^>]*ton="succes"/);
  assert.match(regle(".dem-etape[data-conseillee='true']"), /background: var\(--sc-dem-ligne-conseillee\)/);
});

await dit('cotes de H47 : tuiles de 127 (écart 14, rangées à 13), cartes de 65 / 165 / 61, aperçu de 82, carte de droite 340 × 369, lignes de 43, collante', () => {
  assert.match(regle('.met-grille'), /grid-template-columns: 748px 340px[^}]*gap: 20px/);
  assert.match(regle('.met-tuiles'), /repeat\(4, minmax\(0, 1fr\)\)[^}]*column-gap: 14px[^}]*row-gap: 13px/);
  assert.match(regle('.met-tuile'), /height: 127px[^}]*padding: 19px 17px 17px[^}]*border: 1px solid var\(--socle-bord-carte\)[^}]*border-radius: 14px/);
  assert.match(regle(".met-tuile[aria-checked='true']"), /border-color: var\(--socle-primaire\)[^}]*background: var\(--sc-met-tuile-choisie\)/);
  assert.doesNotMatch(regle(".met-tuile[aria-checked='true']"), /border-width|border:/, 'la bordure ne change que de couleur : rien ne bouge');
  assert.match(regle('.met-tuile__icone'), /width: 18px[^}]*height: 18px/);
  assert.match(regle('.met-tuile__titre'), /margin-top: 18px[^}]*font-size: 14px[^}]*font-weight: 600[^}]*line-height: 18px/);
  assert.match(regle('.met-tuile__texte'), /margin-top: 3px[^}]*font-size: 12px[^}]*line-clamp: 2/);
  assert.match(regle('.met-tuile__coche'), /top: 11px[^}]*right: 11px[^}]*width: 22px[^}]*height: 22px/);
  assert.match(regle(":root[data-ambiance='noir'] .met-taille"), /height: 65px/);
  assert.match(regle(":root[data-ambiance='noir'] .met-apercu"), /height: 165px/);
  assert.match(regle('.met-apercu__cartes'), /repeat\(3, minmax\(0, 1fr\)\)[^}]*gap: 12px/);
  assert.match(regle('.met-apercu__carte'), /height: 82px/);
  assert.match(regle(":root[data-ambiance='noir'] .met-decrire"), /min-height: 61px/);
  assert.match(regle('.met-droite'), /position: sticky[^}]*top: 0/);
  assert.match(regle(":root[data-ambiance='noir'] .met-compose"), /min-height: 369px/);
  assert.match(regle('.met-ligne'), /height: 43px/);
  assert.match(regle('.met-gauche'), /gap: 14px/);
});

await dit('les tuiles gardent leur titre à la même hauteur quelle que soit la description : titre à hauteur fixe, description après, tuile de hauteur fixe', () => {
  const html = vueMet();
  for (const m of MODELES) assert.match(html, new RegExp(`met-tuile__titre">${m.nom.fr}</span><span class="met-tuile__texte">`));
  assert.match(regle('.met-tuile__titre'), /white-space: nowrap/);
});

await dit('sous 1108 et 780 px de contenu, les colonnes se rangent (conteneur de la coquille) ; le mouvement réduit coupe les animations', () => {
  assert.match(css, /@container \(max-width: 1107px\) \{[^@]*\.dem-grille \{ grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /@container \(max-width: 780px\) \{[^@]*\.met-tuiles \{ grid-template-columns: repeat\(2/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^@]*animation: none/);
  assert.match(css, /animation: met-fondu 160ms ease-out/);
  assert.match(css, /stroke-dashoffset 220ms/);
});

/* ═════════════════════════ L'hygiène ═════════════════════════ */

await dit('aucune couleur en dur : pas un #hex hors des trois `--sc-…` déclarés, pas de rgb()', () => {
  for (const m of css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const debut = css.lastIndexOf('\n', m.index) + 1;
    assert.match(css.slice(debut, css.indexOf('\n', m.index)), /^\s*--sc-[\w-]+:\s*#/, `couleur en dur : ${m[0]}`);
  }
  assert.equal(compter(css, /--sc-[\w-]+:\s*#[0-9a-f]{6}/g), 3);
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
  for (const [ligne] of modeles.matchAll(/^.*stripe.*$/gim)) assert.match(ligne, /L\('Connecter Stripe ou votre banque', 'Connect Stripe or your bank'\)/);
  assert.equal(compter(modeles, /stripe/gi), 2);
});

await dit('aucun robot, mascotte, émoji ni confettis ; Ajmani n’est qu’un nom et l’étincelle ; aucun secret', () => {
  for (const f of codes) {
    const src = sansCommentaires(lireSource(f));
    assert.doesNotMatch(src, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, `${f} : un émoji`);
    assert.doesNotMatch(src, /confetti|mascotte|\brobot\b|avatar/i, f);
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
