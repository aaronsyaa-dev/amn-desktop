/**
 * Contrôle de la RECHERCHE ⌘K (H41, LOT-00) — le moteur, l'index, la mémoire, la palette rendue en HTML statique,
 * les cotes de la feuille et les règles de la maison. Sans navigateur, sans build, sans réseau.
 *
 *   npm run check:systeme-recherche
 *
 * Tous les noms ci-dessous sont inventés pour l'essai : le code n'en connaît aucun.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { assert, charger, creerEssais, lire, racine, sansCommentaires } from './lib/essai-socle.ts';

const { dit, fin } = creerEssais('Système — recherche ⌘K (H41)');

const DOSSIER = 'src/refonte/systeme/recherche';
const fichiers = fs.readdirSync(path.join(racine, DOSSIER)).filter((f) => /\.(tsx?|css)$/.test(f));
const source = (f: string): string => lire(`${DOSSIER}/${f}`);

/* ─────────────────────────── Chargement ─────────────────────────── */

type M = typeof import('../src/refonte/systeme/recherche/moteur.ts');
type C = typeof import('../src/refonte/systeme/recherche/construire.ts');
type Mem = typeof import('../src/refonte/systeme/recherche/memoire.ts');
type I = typeof import('../src/refonte/systeme/recherche/i18n.ts');

const moteur = await charger<M>(`${DOSSIER}/moteur.ts`);
const construire = await charger<C>(`${DOSSIER}/construire.ts`);
const memoire = await charger<Mem>(`${DOSSIER}/memoire.ts`);
const mots = await charger<I>(`${DOSSIER}/i18n.ts`);

/** La palette se charge avec sa feuille : esbuild la vide, le contrôle la lit à part. */
async function chargerPalette() {
  const code = [
    "import { createElement as h } from 'react';",
    "import { renderToStaticMarkup } from 'react-dom/server.browser';",
    "import { PaletteRechercheVue } from '../src/refonte/systeme/recherche/PaletteRecherche';",
    "export const rendre = (props) => renderToStaticMarkup(h(PaletteRechercheVue, props));",
  ].join('\n');
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
  return (await import(`data:text/javascript;charset=utf-8;base64,${Buffer.from(construit.outputFiles[0].text, 'utf8').toString('base64')}`)) as { rendre: (props: Record<string, unknown>) => string };
}
const palette = await chargerPalette();

/* ─────────────────────────── Jeux de données de l'essai ─────────────────────────── */

const FAM: Record<string, string> = { clients: 'contacts', invoices: 'argent', tasks: 'jour', notes: 'ecrire', knowledge: 'ecrire', decisions: 'creer', vault: 'outils' };
const options = (fermes: string[] = []) => ({
  ouvert: (m: string) => !fermes.includes(m),
  familleDe: (m: string) => (FAM[m] ?? 'outils') as never,
  mots: { brouillon: 'Brouillon', sansTitre: 'Sans titre' },
});
const donnees = {
  pages: [
    { key: 'invoices', libelle: 'Facturation', route: '/facturation', verbes: ['envoyer une facture', 'créer une facture'], motsCles: ['facture'] },
    { key: 'tasks', libelle: 'Tâches', route: '/tasks', verbes: ['ajouter une tâche'], motsCles: ['tâche'] },
    { key: 'clients', libelle: 'Clients', route: '/clients', verbes: ['ajouter un client'], motsCles: ['client'] },
    { key: 'vault', libelle: 'Coffre-fort', route: '/vault', verbes: ['ranger un accès'], motsCles: ['accès'] },
  ],
  clients: [
    { id: 101, name: 'Camille Orchis', company: 'Orchidée Conseil', email: 'camille@orchidee.test', updatedAt: '2026-09-01T10:00:00Z' },
    { id: 102, name: 'Lucas Verdier', company: 'Atelier Verdier', email: '' },
    { id: 103, name: 'Inès Marin', company: 'Marin Services', email: 'ines@marin.test' },
    { id: 104, name: '', company: 'Marinade Traiteur', email: 'pas une adresse' },
    { id: 105, name: 'Paul Marian', company: 'Marian Bois', email: 'paul@marian.test' },
  ],
  devis: [{ id: 301, clientId: 101, title: 'Refonte du catalogue', updatedAt: '2026-09-02T10:00:00Z' }],
  factures: [{ id: 'f1', number: 'F-2031', clientId: 101, billTo: { name: 'Camille Orchis', company: 'Orchidée Conseil' }, updatedAt: '2026-09-03T10:00:00Z' }],
  taches: [{ id: 't1', title: 'Relire le plan de formation', clientId: 101 }, { id: 't2', title: 'Réunion équipe', clientId: null }],
  notes: [{ id: 'n1', title: 'Idées de rentrée', body: 'penser à la tournée des fournisseurs de bois', updatedAt: '2026-09-04T10:00:00Z' }],
  documents: [{ id: 'd1', title: 'Procédure de livraison' }],
  decisions: [{ id: 'x1', title: 'Passer au paiement trimestriel' }],
};
const index = construire.construireIndex(donnees, options());

const textes: import('../src/refonte/systeme/recherche/moteur.ts').TextesMoteur = {
  ajmaniGenerique: (t) => `Demander à Ajmani : « ${t} »`,
  ajmaniClient: (n) => `Demander à Ajmani : résumer l’historique de ${n}`,
  ajmaniClientDemande: (n) => `Résume l’historique de ${n}`,
  devis: (n) => `Créer un devis pour ${n}`,
  ecrire: (n) => `Écrire à ${n}`,
};
const chercherTexte = (saisie: string, ctx: Partial<import('../src/refonte/systeme/recherche/moteur.ts').ContexteRecherche> = {}, idx = index) => moteur.rechercher(saisie, idx, { textes, ...ctx });
const libelles = (r: ReturnType<typeof chercherTexte>, groupe: 'actions' | 'resultats' | 'recents') => r.groupes.find((g) => g.id === groupe)?.lignes.map((l) => l.libelle) ?? [];

/* ─────────────────────────── Le moteur ─────────────────────────── */

await dit('distance d’édition : une transposition ou une lettre de trop compte pour une faute, et la borne coupe court', () => {
  assert.equal(moteur.distanceEdition('abcd', 'abcd'), 0);
  assert.equal(moteur.distanceEdition('abcd', 'abdc'), 1);
  assert.equal(moteur.distanceEdition('abcd', 'abcde'), 1);
  assert.equal(moteur.distanceEdition('abcd', 'axcd'), 1);
  assert.equal(moteur.distanceEdition('abcdef', 'uvwxyz', 2), 3);
  assert.equal(moteur.toleranceDe('abc'), 0, 'un mot de 3 lettres ne se corrige pas');
  assert.equal(moteur.toleranceDe('abcd'), 1);
  assert.equal(moteur.toleranceDe('abcdefgh'), 2);
});

await dit('accents, casse et ponctuation ne comptent pas : « ORCHIDEE » trouve « Orchidée Conseil »', () => {
  for (const saisie of ['orchidee', 'ORCHIDÉE', '  Orchidée  ', 'orchidée-conseil', 'conseil']) {
    assert.ok(libelles(chercherTexte(saisie), 'resultats').includes('Orchidée Conseil'), saisie);
  }
});

await dit('début de mot : « orch » trouve « Orchidée Conseil » ; plusieurs mots : « orchidee cons »', () => {
  assert.ok(libelles(chercherTexte('orch'), 'resultats').includes('Orchidée Conseil'));
  assert.ok(libelles(chercherTexte('orchidee cons'), 'resultats').includes('Orchidée Conseil'));
  assert.ok(!libelles(chercherTexte('orchidee zzz'), 'resultats').includes('Orchidée Conseil'), 'tous les mots tapés doivent se retrouver');
});

await dit('fautes de frappe : 1 à 2 fautes, mots de 4 lettres et plus seulement', () => {
  for (const saisie of ['orcidee', 'orchidde', 'orchdiee', 'orchidée conceil', 'verdié']) {
    assert.ok(libelles(chercherTexte(saisie), 'resultats').length > 0, `« ${saisie} » devrait trouver quelque chose`);
  }
  assert.ok(libelles(chercherTexte('atelier verdir'), 'resultats').includes('Atelier Verdier'));
  // Trois lettres : une faute change de mot, on ne la pardonne pas.
  assert.deepEqual(libelles(chercherTexte('bos'), 'resultats'), [], '« bos » ne doit pas trouver « Marian Bois »');
  assert.equal(moteur.classer('zzzz', index.entrees, { textes }).length, 0);
  // Trop de fautes : rien.
  assert.deepEqual(libelles(chercherTexte('orxxxxee'), 'resultats'), []);
});

await dit('classement : exact, puis début de mot, puis approximatif', () => {
  const r = moteur.classer('marin', index.entrees, { textes }).map((c) => c.entree.libelle);
  assert.deepEqual(r.slice(0, 3), ['Marin Services', 'Marinade Traiteur', 'Marian Bois']);
  const scores = moteur.classer('marin', index.entrees, { textes }).map((c) => c.score);
  assert.ok(scores[0] > scores[1] && scores[1] > scores[2], `les niveaux se distinguent : ${scores.join(', ')}`);
});

await dit('à égalité : les récents d’abord, puis les fréquents, puis le type', () => {
  const dup = construire.construireIndex(
    { ...donnees, clients: [{ id: 1, name: '', company: 'Atelier Nord', email: '' }, { id: 2, name: '', company: 'Atelier Nord', email: '' }, { id: 3, name: '', company: 'Atelier Nord', email: '' }], devis: [], factures: [], taches: [{ id: 'a', title: 'Atelier Nord' }], notes: [], documents: [], decisions: [] },
    options(),
  );
  const ordre = (ctx: object) => chercherTexte('atelier nord', ctx, dup).groupes.find((g) => g.id === 'resultats')?.lignes.map((l) => l.cle) ?? [];
  assert.deepEqual(ordre({}).slice(0, 4), ['client:1', 'client:2', 'client:3', 'tache:a'], 'le type passe avant : un client avant une tâche');
  assert.equal(ordre({ recents: ['client:3'] })[0], 'client:3', 'le récent passe devant');
  assert.equal(ordre({ recents: ['tache:a'] })[0], 'tache:a', 'un récent passe même devant un type mieux placé');
  assert.equal(ordre({ frequences: { 'client:2': 5, 'client:3': 2 } })[0], 'client:2', 'le plus fréquent passe devant');
  assert.equal(ordre({ recents: ['client:3'], frequences: { 'client:2': 9 } })[0], 'client:3', 'le récent passe avant le fréquent');
});

await dit('mode « > » : seulement des actions, filtrées par ce qui suit, jamais un client', () => {
  const tout = chercherTexte('>');
  assert.equal(tout.mode, 'actions');
  assert.deepEqual(tout.groupes.map((g) => g.id), ['actions']);
  assert.ok(libelles(tout, 'actions').includes('Envoyer une facture'));
  assert.ok(!tout.groupes.flatMap((g) => g.lignes).some((l) => l.genre === 'resultat'), 'aucun élément en mode actions');
  assert.ok(!libelles(tout, 'actions').some((l) => l.startsWith('Demander à Ajmani')), 'sans texte, pas de porte vers Ajmani');
  const filtre = chercherTexte('>  factur');
  assert.equal(filtre.saisie, 'factur');
  assert.equal(libelles(filtre, 'actions')[0], 'Demander à Ajmani : « factur »', 'Ajmani d’abord quand il y a un texte');
  assert.ok(libelles(filtre, 'actions').includes('Créer une facture') && !libelles(filtre, 'actions').includes('Ajouter une tâche'));
  const beaucoup = construire.construireIndex({ ...donnees, pages: Array.from({ length: 60 }, (_, i) => ({ key: `p${i}`, libelle: `Page ${i}`, route: `/p${i}`, verbes: [`faire la chose ${i}`] })) }, options());
  assert.equal(chercherTexte('>', {}, beaucoup).total, moteur.PLAFOND_MODE_ACTIONS, 'le mode actions montre plus de 5 lignes, la liste défile');
});

await dit('regroupement : ACTIONS puis CLIENTS ET PAGES ; RÉCENTS puis ACTIONS à saisie vide', () => {
  assert.deepEqual(chercherTexte('orch').groupes.map((g) => g.id), ['actions', 'resultats']);
  const vide = chercherTexte('', { recents: ['client:101', 'page:tasks'], actionsPage: [{ id: 'nouvelle', libelle: 'Nouvelle tâche' }] });
  assert.equal(vide.mode, 'vide');
  assert.deepEqual(vide.groupes.map((g) => g.id), ['recents', 'actions']);
  assert.deepEqual(libelles(vide, 'recents'), ['Orchidée Conseil', 'Tâches']);
  assert.deepEqual(libelles(vide, 'actions'), ['Nouvelle tâche']);
  assert.deepEqual(chercherTexte('   ').groupes, [], 'rien à montrer sans récents ni actions de page');
});

await dit('plafond : 5 lignes par groupe, 5 récents au plus', () => {
  const grand = construire.construireIndex(
    { ...donnees, clients: Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: '', company: `Boutique ${i}`, email: '' })) },
    options(),
  );
  const r = chercherTexte('boutique', {}, grand);
  assert.equal(libelles(r, 'resultats').length, 5);
  assert.ok(libelles(r, 'actions').length <= 5);
  const recents = Array.from({ length: 9 }, (_, i) => `client:${i + 1}`);
  assert.equal(libelles(chercherTexte('', { recents }, grand), 'recents').length, 5);
});

await dit('Demander à Ajmani : première ligne dès qu’il y a une saisie, jamais sans ; « résumer l’historique » si un client est désigné', () => {
  const generique = chercherTexte('relire le plan');
  assert.equal(generique.groupes[0].lignes[0].libelle, 'Demander à Ajmani : « relire le plan »');
  assert.deepEqual(generique.groupes[0].lignes[0].cible, { k: 'ajmani', texte: 'relire le plan' });
  const client = chercherTexte('orchidee');
  assert.equal(client.groupes[0].lignes[0].libelle, 'Demander à Ajmani : résumer l’historique de Orchidée Conseil');
  assert.deepEqual(client.groupes[0].lignes[0].cible, { k: 'ajmani', texte: 'Résume l’historique de Orchidée Conseil' });
  assert.equal(client.groupes[0].lignes[0].famille, 'ajmani');
  // Une approximation ne « désigne » pas un client : on ne présume pas.
  assert.equal(chercherTexte('orcidee').groupes[0].lignes[0].libelle, 'Demander à Ajmani : « orcidee »');
  // Rien trouvé : la porte reste ouverte.
  const rien = chercherTexte('qqqqqqq');
  assert.equal(rien.aucunResultat, true);
  assert.equal(rien.groupes[0].lignes[0].cible.k, 'ajmani');
  assert.equal(rien.total, 1);
});

await dit('actions du meilleur client : un devis (fiche client), écrire (courriel valide seulement) ; rien qui écrive une donnée', () => {
  const r = chercherTexte('orchidee');
  const actions = r.groupes[0].lignes;
  assert.deepEqual(actions.map((l) => l.libelle), ['Demander à Ajmani : résumer l’historique de Orchidée Conseil', 'Créer un devis pour Orchidée Conseil', 'Écrire à Camille Orchis']);
  assert.deepEqual(actions[1].cible, { k: 'aller', route: '/clients', state: { focusClientId: 101 } });
  assert.deepEqual(actions[2].cible, { k: 'lien', href: 'mailto:camille@orchidee.test' });
  // Une adresse absente ou invalide : pas d’action « Écrire ».
  for (const saisie of ['atelier verdier', 'marinade']) assert.ok(!libelles(chercherTexte(saisie), 'actions').some((l) => l.startsWith('Écrire')), saisie);
  // Une tâche n’appelle aucune action d’écriture.
  const tache = chercherTexte('relire le plan');
  assert.ok(!tache.groupes.flatMap((g) => g.lignes).some((l) => /Terminer|Supprimer|Archiver/i.test(l.libelle)));
  assert.equal(moteur.courrielValide('a@b.fr?bcc=x@y.fr'), false);
  assert.equal(moteur.lienCourriel('a+b@c.fr'), 'mailto:a%2Bb@c.fr');
});

await dit('les actions de la page : cherchées quand on tape, grisées hors ligne si elles exigent le réseau', () => {
  const ctx = { actionsPage: [{ id: 'n', libelle: 'Nouvelle tâche' }, { id: 'e', libelle: 'Exporter la liste', exigeReseau: true }] };
  assert.ok(libelles(chercherTexte('nouvelle', ctx), 'actions').includes('Nouvelle tâche'));
  assert.ok(!libelles(chercherTexte('nouvelle', ctx), 'actions').includes('Exporter la liste'));
  const enLigne = chercherTexte('>', ctx).groupes[0].lignes.filter((l) => l.cible.k === 'page');
  assert.deepEqual(enLigne.map((l) => l.grise), [false, false]);
  const horsLigne = chercherTexte('>', { ...ctx, horsLigne: true }).groupes[0].lignes.filter((l) => l.cible.k === 'page');
  assert.deepEqual(horsLigne.map((l) => l.grise), [false, true]);
});

await dit('hors ligne : les pages et les éléments récents seulement', () => {
  const r = chercherTexte('orch', { horsLigne: true });
  assert.deepEqual(libelles(r, 'resultats'), []);
  const avecRecent = chercherTexte('orch', { horsLigne: true, recents: ['client:101'] });
  assert.deepEqual(libelles(avecRecent, 'resultats'), ['Orchidée Conseil']);
  assert.deepEqual(libelles(chercherTexte('factur', { horsLigne: true }), 'resultats'), ['Facturation']);
});

await dit('les pages : par `chercher` (intention), et par la tolérance aux fautes quand elle ne trouve rien', () => {
  assert.deepEqual(libelles(chercherTexte('factures'), 'resultats'), ['Facturation'], 'pluriel toléré');
  assert.deepEqual(libelles(chercherTexte('facturaton'), 'resultats'), ['Facturation'], 'une lettre manquante : la tolérance prend le relais');
  assert.ok(libelles(chercherTexte('taches'), 'resultats').includes('Tâches'));
  const page = chercherTexte('clients').groupes.find((g) => g.id === 'resultats')?.lignes.find((l) => l.type === 'page');
  assert.equal(page?.module, 'clients');
  assert.equal(page?.famille, 'contacts');
});

await dit('« Rien pour … » : l’élément proche est proposé (fautes plus larges), sinon rien n’est inventé', () => {
  const proche = chercherTexte('orchidd');
  assert.equal(proche.aucunResultat, false, 'une faute simple est déjà trouvée par la recherche');
  const loin = chercherTexte('orkidee');
  assert.equal(loin.aucunResultat, true);
  assert.equal(loin.proche?.libelle, 'Orchidée Conseil');
  assert.equal(chercherTexte('qqqqqqq').proche, null);
  assert.equal(moteur.procheDe('xyz', index.entrees), null, 'moins de 4 lettres : pas de proposition');
});

await dit('le corps d’une note se cherche (jamais approximativement) mais ne s’affiche pas', () => {
  const r = chercherTexte('tournée fournisseurs');
  assert.deepEqual(libelles(r, 'resultats'), ['Idées de rentrée']);
  assert.deepEqual(libelles(chercherTexte('tourne fournisseurz'), 'resultats'), []);
  assert.ok(!JSON.stringify(r.groupes).includes('bois'), 'le corps ne sort pas de l’index');
});

await dit('une saisie très longue ou étrange ne casse rien', () => {
  for (const saisie of ['a'.repeat(5000), '((((', '\\', '>>>>', '%%%', 'é'.repeat(40) + ' ' + 'x'.repeat(40)]) assert.doesNotThrow(() => chercherTexte(saisie));
});

/* ─────────────────────────── L'index ─────────────────────────── */

await dit('l’index : chaque élément porte sa destination et son lien profond existant', () => {
  const parCle = new Map(index.entrees.map((e) => [e.cle, e]));
  assert.deepEqual([parCle.get('client:101')?.route, parCle.get('client:101')?.state], ['/clients', { focusClientId: 101 }]);
  assert.deepEqual([parCle.get('facture:f1')?.route, parCle.get('facture:f1')?.state], ['/facturation', { openInvoiceId: 'f1' }]);
  assert.deepEqual([parCle.get('tache:t1')?.route, parCle.get('tache:t1')?.state], ['/tasks', { openTaskId: 't1' }]);
  assert.deepEqual([parCle.get('devis:301')?.route, parCle.get('devis:301')?.state], ['/clients', { focusClientId: 101 }]);
  assert.equal(parCle.get('note:n1')?.route, '/notes');
  assert.equal(parCle.get('document:d1')?.route, '/knowledge');
  assert.equal(parCle.get('decision:x1')?.route, '/decisions');
  assert.equal(parCle.get('page:invoices')?.route, '/facturation');
  assert.equal(parCle.get('facture:f1')?.libelle, 'F-2031');
  // Les types sont ceux de la liste.
  for (const e of index.entrees) assert.ok(moteur.TYPES_RESULTAT.includes(e.type), e.type);
  assert.deepEqual(index.erreurs, []);
});

await dit('l’index : on retrouve un devis, une facture, une tâche par le nom de leur client', () => {
  for (const cle of ['devis:301', 'facture:f1', 'tache:t1']) assert.ok(moteur.classer('orchidee', index.entrees, { textes }).some((c) => c.entree.cle === cle), cle);
  assert.ok(!moteur.classer('orchidee', index.entrees, { textes }).some((c) => c.entree.cle === 'tache:t2'));
});

await dit('droits : un module fermé n’a ni ses pages ni ses éléments dans l’index', () => {
  const ferme = construire.construireIndex(donnees, options(['invoices', 'clients']));
  assert.ok(!ferme.entrees.some((e) => e.type === 'facture' || e.type === 'client' || e.type === 'devis'));
  assert.ok(ferme.entrees.some((e) => e.type === 'tache'));
  assert.ok(!libelles(chercherTexte('orchidee', {}, ferme), 'resultats').includes('Orchidée Conseil'));
  // Un élément non autorisé n’arrive pas non plus par la mémoire des récents.
  assert.deepEqual(libelles(chercherTexte('', { recents: ['client:101', 'facture:f1'] }, ferme), 'recents'), []);
});

await dit('une source illisible n’abat pas l’index : les autres restent, l’erreur est dite', () => {
  const abime = construire.construireIndex({ ...donnees, clients: null as never }, options());
  assert.deepEqual(abime.erreurs, ['noms', 'clients']);
  assert.ok(abime.entrees.some((e) => e.type === 'page'));
});

await dit('le coffre-fort : une page parmi les autres, et ses entrées ne sont lues nulle part', () => {
  assert.ok(index.entrees.filter((e) => e.cle.startsWith('page:')).some((e) => e.libelle === 'Coffre-fort'));
  const src = ['construire.ts', 'index.ts', 'moteur.ts'].map(source).join('\n');
  assert.doesNotMatch(sansCommentaires(src), /useVault|useCollection<[^>]*>\(\s*['"](?:vault|secrets?|credentials?)['"]|['"]vault['"]\s*\)/i);
  assert.doesNotMatch(Object.keys(donnees).join(' '), /vault|secret|coffre/i);
});

await dit('ce qui ne doit pas entrer dans l’index n’y entre pas : téléphone, adresse postale, détail, notes de fiche', () => {
  const src = sansCommentaires(source('construire.ts'));
  assert.doesNotMatch(src, /\b[cqft]\.(?:phone|address|notes|events|detail)\b|imageDataUrl/);
  const lourd = construire.construireIndex({ ...donnees, clients: [{ id: 9, name: 'Zoé Test', company: 'Test SARL', email: 'zoe@test.test', phone: '0102030405', address: '1 rue X', notes: 'secret' } as never] }, options());
  assert.ok(!JSON.stringify(lourd).includes('0102030405') && !JSON.stringify(lourd).includes('1 rue X') && !JSON.stringify(lourd).includes('secret'));
});

/* ─────────────────────────── La mémoire ─────────────────────────── */

await dit('mémoire : 5 derniers éléments, sans doublon, clé + type + route seulement', () => {
  let liste: ReturnType<Mem['ajouterRecent']> = [];
  for (let i = 0; i < 8; i += 1) liste = memoire.ajouterRecent(liste, { cle: `client:${i}`, type: 'client', route: '/clients' });
  assert.equal(liste.length, 5);
  assert.equal(liste[0].cle, 'client:7');
  liste = memoire.ajouterRecent(liste, { cle: 'client:5', type: 'client', route: '/clients' });
  assert.deepEqual(liste.map((r) => r.cle), ['client:5', 'client:7', 'client:6', 'client:4', 'client:3']);
  const magasin = new Map<string, string>();
  const stockage = { getItem: (k: string) => magasin.get(k) ?? null, setItem: (k: string, v: string) => void magasin.set(k, v) };
  memoire.ecrireRecents(stockage, 'a@b.test', [{ cle: 'client:1', type: 'client', route: '/clients', titre: 'ne doit pas partir' } as never]);
  assert.deepEqual([...magasin.keys()], ['amn.recherche.recents.a@b.test']);
  assert.deepEqual(JSON.parse(magasin.get('amn.recherche.recents.a@b.test') as string), [{ cle: 'client:1', type: 'client', route: '/clients' }]);
});

await dit('mémoire : une valeur abîmée est écartée, jamais réparée ; un stockage qui refuse ne casse rien', () => {
  const magasin = new Map<string, string>([['amn.recherche.recents.a@b.test', JSON.stringify([{ cle: 'client:1', type: 'client', route: '/clients' }, { cle: 'x', type: 'inconnu', route: '/x' }, { cle: 'y', type: 'client', route: 'http://pirate.test' }, 7, null, { cle: 'client:1', type: 'client', route: '/clients' }])]]);
  const stockage = { getItem: (k: string) => magasin.get(k) ?? null, setItem: () => undefined };
  assert.deepEqual(memoire.lireRecents(stockage, 'a@b.test').map((r) => r.cle), ['client:1']);
  assert.deepEqual(memoire.lireRecents({ getItem: () => '{pas du json', setItem: () => undefined }, 'a@b.test'), []);
  assert.deepEqual(memoire.lireRecents(null, 'a@b.test'), []);
  assert.doesNotThrow(() => memoire.ecrireRecents({ getItem: () => null, setItem: () => { throw new Error('plein'); } }, 'a@b.test', []));
  assert.equal(memoire.cleRecents(''), 'amn.recherche.recents.anonyme');
});

await dit('mémoire : les fréquences comptent les ouvertures et s’arrêtent à 100 clés', () => {
  let f: Record<string, number> = {};
  for (let i = 0; i < 3; i += 1) f = memoire.compterOuverture(f, 'client:1');
  assert.equal(f['client:1'], 3);
  for (let i = 0; i < 150; i += 1) f = memoire.compterOuverture(f, `client:${i + 10}`);
  assert.ok(Object.keys(f).length <= 100);
  assert.equal(f['client:1'], 3, 'les plus ouvertes restent');
  assert.deepEqual(memoire.lireFrequences({ getItem: () => JSON.stringify({ a: 2, b: -1, c: 'x' }), setItem: () => undefined }, 'z'), { a: 2 });
});

/* ─────────────────────────── Les mots ─────────────────────────── */

await dit('mots : fr et en ont les mêmes clés et les mêmes {paramètres}, sans point d’exclamation, typographie française', () => {
  const { en, fr } = mots.dictionnaires as { en: Record<string, string>; fr: Record<string, string> };
  assert.deepEqual(Object.keys(en).sort(), Object.keys(fr).sort());
  const param = (t: string) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const cle of Object.keys(en)) {
    assert.equal(param(en[cle]), param(fr[cle]), cle);
    assert.ok(en[cle].length > 0 && fr[cle].length > 0, cle);
    assert.ok(!/!/.test(en[cle] + fr[cle]), `${cle} : point d’exclamation`);
    assert.ok(!/[«»]/.test(en[cle]), `${cle} : guillemets français dans l’anglais`);
    assert.doesNotMatch(fr[cle], /[ ][?:;»!]|«[ ]/, `${cle} : espace sécable avant « : ? ; » ou après «`);
    assert.ok(!/'/.test(fr[cle]), `${cle} : apostrophe droite dans le français`);
  }
  assert.equal(fr['aucun.titre'], 'Rien pour «\u00a0{texte}\u00a0»');
  assert.equal(fr['pied.astuce'], 'Astuce\u00a0: tapez «\u00a0>\u00a0» pour voir toutes les actions');
  assert.equal(fr['pied.ouvrir'], '↵ pour ouvrir');
  assert.equal(fr['erreur.texte'], 'La recherche n’a pas pu aboutir.');
  assert.equal(fr['horsligne'], 'Hors ligne\u00a0: éléments récents et pages seulement');
  const types = ['client', 'contact', 'document', 'tache', 'note', 'facture', 'devis', 'message', 'page'].map((t) => fr[`type.${t}`]);
  assert.deepEqual(types, ['Client', 'Contact', 'Document', 'Tâche', 'Note', 'Facture', 'Devis', 'Message', 'Page']);
  assert.equal(mots.traduire('fr', 'annonce.n', { n: 3 }), '3 résultats');
});

/* ─────────────────────────── La palette, en HTML statique ─────────────────────────── */

const vue = (props: Record<string, unknown> = {}) =>
  palette.rendre({ index, pret: true, erreur: false, horsLigne: false, recents: [], frequences: {}, texteInitial: 'orchidee', onFermer: () => undefined, onExecuter: () => undefined, onReessayer: () => undefined, ...props });
const compter = (html: string, re: RegExp): number => (html.match(re) ?? []).length;

await dit('palette : dialogue modal nommé, combobox → listbox, groupes, options avec aria-selected, annonce du nombre', () => {
  const r = vue();
  assert.match(r, /<div class="rc-voile"[^>]*><div role="dialog" aria-modal="true" aria-labelledby="[^"]+" tabindex="-1" class="rc-palette">/);
  const idListe = /role="combobox"[^>]*aria-controls="([^"]+)"/.exec(r)?.[1];
  assert.ok(idListe);
  assert.match(r, new RegExp(`id="${idListe?.replace(/[:]/g, '\\:')}" role="listbox"`));
  assert.match(r, /aria-autocomplete="list"/);
  assert.match(r, /aria-expanded="true"/);
  assert.equal(compter(r, /role="group"/g), 2);
  assert.equal(compter(r, /aria-labelledby="[^"]*-g-/g), 2);
  const options = compter(r, /role="option"/g);
  assert.ok(options >= 4, `${options} options`);
  assert.equal(compter(r, /aria-selected="true"/g), 1);
  assert.equal(compter(r, /aria-selected="false"/g), options - 1);
  assert.match(r, /<div role="status" class="sr-only">\d+ résultats?<\/div>/);
  // aria-activedescendant désigne la première option, et c’est elle qui est sélectionnée.
  const actif = /aria-activedescendant="([^"]+)"/.exec(r)?.[1] as string;
  assert.match(r, new RegExp(`id="${actif}" role="option" aria-selected="true"`));
  assert.match(r, /<input[^>]*aria-label="Rechercher un client, une page, une action"/);
});

await dit('palette : le Raccourci ↵ n’est que sur la ligne sélectionnée, « esc » dans le champ, pas de « nouvel onglet »', () => {
  const r = vue();
  assert.equal(compter(r, /<kbd[^>]*>↵<\/kbd>/g), 1);
  assert.match(r, /aria-selected="true"[\s\S]*?<kbd[^>]*>↵<\/kbd>/);
  const apresSelection = r.slice(r.indexOf('aria-selected="true"'));
  assert.equal(compter(r.slice(0, r.indexOf('aria-selected="true"')), /<kbd[^>]*>↵/g), 0, 'rien avant la ligne sélectionnée');
  assert.equal(compter(apresSelection.slice(apresSelection.indexOf('</kbd>') + 6), /<kbd[^>]*>↵/g), 0, 'rien après');
  assert.match(r, /<kbd[^>]*>esc<\/kbd>/);
  assert.doesNotMatch(r, /onglet|⌘↵|nouvelle fenêtre/i);
  assert.match(r, /↑↓ pour naviguer/);
  assert.match(r, /↵ pour ouvrir/);
  assert.match(r, /Astuce\u00a0: tapez «\u00a0&gt;\u00a0» pour voir toutes les actions/);
});

await dit('palette : la première ligne est « Demander à Ajmani » (étincelle verte, jamais un avatar), puis les autres', () => {
  const r = vue();
  const premiere = /role="option"[^>]*>([\s\S]*?)<\/div>(?=<div id=|<\/div>)/.exec(r)?.[1] ?? '';
  assert.match(premiere, /data-ajmani="true"/);
  assert.match(premiere, /sc-etincelle/);
  assert.match(premiere, /Demander à Ajmani\u00a0: résumer l’historique de Orchidée Conseil/);
  assert.doesNotMatch(r, /sc-avatar|<img|<canvas/);
  assert.match(r, /Créer un devis pour Orchidée Conseil/);
  assert.match(r, /Écrire à Camille Orchis/);
  // Les types sont dits en toutes lettres à côté des éléments, et les pages portent « Page ».
  assert.match(r, /rc-ligne__type">Client</);
  assert.match(vue({ texteInitial: 'factur' }), /rc-ligne__type">Page</);
  // La tuile suit la famille du module de destination.
  assert.match(r, /class="rc-tuile" data-famille="contacts"/);
});

await dit('palette : saisie vide → RÉCENTS puis ACTIONS de la page ; sans « Demander à Ajmani »', () => {
  const r = vue({ texteInitial: '', recents: ['client:101', 'page:tasks'], actionsPage: [{ id: 'n', libelle: 'Nouvelle tâche', famille: 'jour' }] });
  assert.match(r, /rc-groupe__titre">Récents</);
  assert.match(r, /rc-groupe__titre">Actions</);
  assert.ok(r.indexOf('Récents<') < r.indexOf('Actions<'));
  assert.match(r, /Nouvelle tâche/);
  assert.doesNotMatch(r, /Demander à Ajmani/);
  assert.match(vue({ texteInitial: '' }), /Tapez un nom, une page ou «\u00a0&gt;\u00a0» pour voir les actions/);
});

await dit('palette : mode « > » → une seule liste d’actions', () => {
  const r = vue({ texteInitial: '> factur' });
  assert.equal(compter(r, /role="group"/g), 1);
  assert.match(r, /rc-groupe__titre">Actions</);
  assert.match(r, /Créer une facture/);
  assert.doesNotMatch(r, /rc-ligne__type/);
});

await dit('état chargement : trois squelettes de ligne par groupe attendu, après 200 ms seulement', () => {
  const avant = vue({ pret: false, texteInitial: 'factur', attenteEcoulee: false });
  assert.doesNotMatch(avant, /data-squelette/);
  const apres = vue({ pret: false, texteInitial: 'factur', attenteEcoulee: true });
  assert.equal(compter(apres, /data-squelette/g), 1, 'le groupe des résultats attend');
  assert.equal(compter(apres, /rc-ligne--squelette/g), 3);
  assert.match(apres, /aria-busy="true"/);
  assert.match(apres, /<div role="status" class="sr-only">Chargement des résultats<\/div>/);
  assert.match(apres, /Demander à Ajmani/, 'la porte vers Ajmani ne attend pas les données');
  const vide = vue({ pret: false, texteInitial: '', attenteEcoulee: true, recents: ['client:101'] });
  assert.equal(compter(vide, /rc-ligne--squelette/g), 3);
  assert.match(vide, /rc-groupe__titre">Récents</);
  // Un squelette n’est jamais une option.
  assert.equal(compter(apres, /role="option"/g), compter(apres, /aria-selected=/g));
});

await dit('état aucun résultat : « Rien pour … », Demander à Ajmani reste en premier, bouton vers le proche ou « Effacer »', () => {
  const sans = vue({ texteInitial: 'qqqqqqq' });
  assert.match(sans, /Rien pour «\u00a0qqqqqqq\u00a0»/);
  assert.match(sans, /Essayez un autre mot ou effacez la recherche\./);
  assert.match(sans, /Effacer la recherche/);
  assert.equal(compter(sans, /role="option"/g), 1);
  assert.match(sans, /role="option"[^>]*aria-selected="true"[\s\S]*?Demander à Ajmani\u00a0: «\u00a0qqqqqqq\u00a0»/);
  assert.match(sans, /role="status" class="sr-only">Aucun résultat</);
  const proche = vue({ texteInitial: 'orkidee' });
  assert.match(proche, /Vouliez-vous dire Orchidée Conseil\u202f\? Sinon, essayez un autre mot\./);
  assert.match(proche, /Voir Orchidée Conseil/);
  assert.match(proche, /data-variante="primaire"/);
});

await dit('état erreur : « La recherche n’a pas pu aboutir. » + « Réessayer », les actions locales restent', () => {
  const r = vue({ erreur: true, texteInitial: 'factur' });
  assert.match(r, /role="alert"[\s\S]*La recherche n’a pas pu aboutir\.[\s\S]*Réessayer/);
  assert.match(r, /Demander à Ajmani/);
  assert.match(r, /Facturation/, 'les pages restent proposées');
  assert.doesNotMatch(vue(), /role="alert"/);
});

await dit('état hors ligne : la ligne d’information, rien d’autre que les pages et les récents', () => {
  const r = vue({ horsLigne: true, texteInitial: 'orch' });
  assert.match(r, /Hors ligne\u00a0: éléments récents et pages seulement/);
  assert.doesNotMatch(r, /rc-ligne__type">Client</);
  assert.doesNotMatch(vue(), /Hors ligne/);
  const grise = vue({ horsLigne: true, texteInitial: '', actionsPage: [{ id: 'e', libelle: 'Exporter la liste', exigeReseau: true }] });
  assert.match(grise, /aria-disabled="true"[^>]*title="Demande une connexion"/);
});

await dit('état droits : un élément non autorisé n’apparaît jamais, même grisé', () => {
  const ferme = construire.construireIndex(donnees, options(['clients']));
  const r = vue({ index: ferme, texteInitial: 'orchidee' });
  assert.doesNotMatch(r, /Orchidée Conseil|Camille/);
});

await dit('animation : sans niveau, aucun élément animé ; avec un niveau, la palette est animée', () => {
  assert.doesNotMatch(vue(), /style="opacity/);
  assert.match(vue({ animation: 'complet' }), /style="opacity:0/);
});

/* ─────────────────────────── Les sources et la feuille ─────────────────────────── */

const css = sansCommentaires(source('recherche.css'));
const bloc = (selecteur: string): string => new RegExp(`${selecteur.replace(/[.[\]()]/g, '\\$&')} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';

await dit('cotes de la feuille : 700 × 444, champ 58, lignes 44, pied 41, tuile 28, liste 520, rayon 16, filet 1 px', () => {
  assert.match(bloc('.rc-palette'), /width:\s*min\(700px,\s*calc\(100% - 32px\)\)/);
  assert.match(bloc('.rc-palette'), /min-height:\s*min\(444px/);
  assert.match(bloc('.rc-palette'), /border-radius:\s*16px/);
  assert.match(bloc('.rc-palette'), /border:\s*1px solid var\(--socle-bord-palette\)/);
  assert.match(bloc('.rc-palette'), /background:\s*var\(--socle-palette-fond\)/);
  assert.match(bloc('.rc-palette'), /box-shadow:\s*var\(--sc-recherche-ombre\)/);
  assert.match(bloc('.rc-champ'), /height:\s*58px/);
  assert.match(bloc('.rc-ligne'), /height:\s*44px/);
  assert.match(bloc('.rc-ligne'), /border-radius:\s*10px/);
  assert.match(bloc('.rc-pied'), /height:\s*41px/);
  assert.match(bloc('.rc-pied'), /gap:\s*20px/);
  assert.match(bloc('.rc-tuile'), /width:\s*28px[\s\S]*height:\s*28px[\s\S]*border-radius:\s*8px/);
  assert.match(bloc('.rc-tuile'), /color-mix\(in srgb, var\(--rc-teinte\) 13%, transparent\)/);
  assert.match(bloc('.rc-liste'), /max-height:\s*520px[\s\S]*overflow-y:\s*auto[\s\S]*overscroll-behavior:\s*contain[\s\S]*padding:\s*8px/);
  assert.match(bloc('.rc-champ__saisie'), /font-size:\s*16px/);
  assert.match(bloc('.rc-groupe__titre'), /font-size:\s*11px[\s\S]*letter-spacing:\s*0\.08em[\s\S]*text-transform:\s*uppercase[\s\S]*/);
  assert.match(bloc('.rc-groupe__titre'), /color:\s*var\(--socle-texte-3\)/);
  assert.match(bloc('.rc-ligne__type'), /font-size:\s*12px/);
  assert.match(bloc(".rc-ligne[aria-selected='true']"), /background:\s*var\(--socle-segment-actif\)/);
  assert.match(css, /--sc-recherche-voile:\s*rgba\(0, 0, 0, 0\.5\)/);
  assert.match(css, /--sc-recherche-haut:\s*96px/);
  assert.match(css, /@media \(max-height: 699\.98px\) \{\s*:root\[data-ambiance='noir'\] \{ --sc-recherche-haut: 10dvh; \}/);
  assert.match(css, /@media \(max-width: 559\.98px\) \{\s*\.rc-pied__mention\[data-secondaire\] \{ display: none; \}/);
});

await dit('le calque est fixe, à z-index 50 ou plus : la pile des calques le reconnaît', () => {
  const v = bloc('.rc-voile');
  assert.match(v, /position:\s*fixed/);
  const z = Number(/z-index:\s*(\d+)/.exec(v)?.[1]);
  assert.ok(z >= 50, `z-index ${z}`);
  assert.match(v, /inset:\s*0/);
  assert.match(v, /background:\s*var\(--sc-recherche-voile\)/);
  assert.doesNotMatch(css, /backdrop-filter|blur\(/, 'le voile est sans flou');
});

await dit('la palette ferme à Échap par la pile des calques, au clic sur le voile, et rend le focus', () => {
  const src = sansCommentaires(source('PaletteRecherche.tsx'));
  assert.match(src, /useFermetureEchap\(true, onFermer\)/);
  assert.match(src, /e\.target === e\.currentTarget/);
  assert.match(src, /document\.activeElement/);
  assert.match(src, /retour\??\.focus\(\)/);
  assert.match(src, /role="combobox"/);
  assert.match(src, /role="listbox"/);
  assert.match(src, /role="option"/);
  assert.match(src, /aria-activedescendant/);
  assert.match(src, /e\.key === 'ArrowDown'/);
  assert.match(src, /e\.key === 'ArrowUp'/);
  assert.match(src, /e\.key === 'Home'/);
  assert.match(src, /e\.key === 'End'/);
  assert.match(src, /e\.key === 'Enter'/);
  assert.match(src, /DELAI_FRAPPE = 120/);
  assert.match(src, /DELAI_SQUELETTE = 200/);
  assert.match(src, /document\.body\.style\.overflow = 'hidden'/);
  // Le mouvement : fondu + 6 px, réduit = fondu seul, aucun = rien.
  assert.match(src, /animation === 'complet' \? -6 : 0/);
  assert.match(src, /0\.14/);
});

await dit('⌘↵ n’a pas d’hôte (une seule fenêtre) : ni mention, ni geste', () => {
  for (const f of fichiers) assert.doesNotMatch(sansCommentaires(source(f)), /onglet|nouvelle fenêtre|⌘↵|window\.open/i, f);
});

await dit('aucune couleur en dur : les hex ne sont que des déclarations --sc-recherche-*, aucune encre « discret » en texte', () => {
  for (const ligne of css.match(/^.*#[0-9a-fA-F]{3,8}\b.*$/gm) ?? []) assert.match(ligne, /^\s*--sc-recherche-[\w-]+:\s*#[0-9a-fA-F]{6};/, `couleur en dur : ${ligne.trim()}`);
  for (const f of fichiers.filter((x) => x.endsWith('.tsx') || x.endsWith('.ts'))) assert.doesNotMatch(sansCommentaires(source(f)), /#[0-9a-fA-F]{3,8}\b|rgba?\(/, `${f} : couleur en dur`);
  assert.doesNotMatch(css, /color:\s*[^;]*(?:trait-discret|trait-tres-discret|77777c|5f5f64)/i);
  assert.doesNotMatch(css, /(?<![-\w])color:\s*(?:var\(--color-socle-texte-discret\)|#)/i);
  // Le plus petit texte : 10,5 px.
  for (const m of css.matchAll(/font-size:\s*([\d.]+)px/g)) assert.ok(Number(m[1]) >= 10.5, `texte de ${m[1]} px`);
  // Les jetons utilisés existent dans noir.css.
  const noir = lire('src/socle/noir.css');
  const declares = new Set([...noir.matchAll(/(--[\w-]+):/g)].map((m) => m[1]).concat([...css.matchAll(/(--[\w-]+):/g)].map((m) => m[1])));
  for (const [, nom] of css.matchAll(/var\((--[\w-]+)/g)) assert.ok(declares.has(nom) || nom === '--fam', `jeton inconnu ${nom}`);
});

await dit('Ajmani : l’étincelle et le nom, jamais une lettre, un avatar, un robot, un émoji', () => {
  const src = source('PaletteRecherche.tsx');
  assert.match(src, /IconeEtincelle/);
  for (const f of fichiers) {
    const s = sansCommentaires(source(f));
    assert.doesNotMatch(s, /<Avatar|Mascotte|Robot|<img\b|<canvas\b/i, f);
    assert.doesNotMatch(s, /\p{Extended_Pictographic}/u, `${f} : un émoji`);
  }
});

await dit('aucun nom d’exemple de la maquette dans les sources', () => {
  for (const f of fichiers) {
    const s = source(f);
    assert.doesNotMatch(s, /Menna|Contrat de maintenance|Medina|Dupuis|Boulangerie|Valider le tableau/i, f);
  }
});

await dit('isolation : rien de partagé n’importe la recherche ; elle n’importe rien d’interdit, ni réseau, ni secret', () => {
  const dedans: string[] = [];
  const parcourir = (dossier: string) => {
    for (const e of fs.readdirSync(path.join(racine, dossier), { withFileTypes: true })) {
      const rel = `${dossier}/${e.name}`;
      if (e.isDirectory()) parcourir(rel);
      else if (/\.(tsx?|mjs|js)$/.test(e.name) && !rel.startsWith('src/refonte/') && !rel.startsWith('src/socle/') && !/\.internal\./.test(rel) && /systeme\/recherche/.test(lire(rel))) dedans.push(rel);
    }
  };
  parcourir('src');
  assert.deepEqual(dedans, [], 'un fichier partagé importe la recherche');
  const interdits = /from '(?:\.\.\/)+(?:components|screens|assistant|bureaux|edition)\/|fetch\(|XMLHttpRequest|localStorage\.(?:getItem|setItem)\(\s*['"`](?!amn\.recherche)/;
  for (const f of fichiers.filter((x) => /\.tsx?$/.test(x))) assert.doesNotMatch(sansCommentaires(source(f)), interdits, f);
  for (const f of fichiers.filter((x) => /\.tsx?$/.test(x))) assert.doesNotMatch(sansCommentaires(source(f)), /(?:api[_-]?key|token|password|secret)\s*[:=]/i, f);
});

fin();
