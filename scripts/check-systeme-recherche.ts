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
type A = typeof import('../src/refonte/systeme/recherche/apercu.ts');

const moteur = await charger<M>(`${DOSSIER}/moteur.ts`);
const construire = await charger<C>(`${DOSSIER}/construire.ts`);
const memoire = await charger<Mem>(`${DOSSIER}/memoire.ts`);
const mots = await charger<I>(`${DOSSIER}/i18n.ts`);
const apercu = await charger<A>(`${DOSSIER}/apercu.ts`);

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
  mots: { brouillon: 'Brouillon', sansTitre: 'Sans titre', facture: 'Facture' },
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
  factures: [
    { id: 'f1', number: 'F-2031', clientId: 101, billTo: { name: 'Camille Orchis', company: 'Orchidée Conseil' }, enRetard: true, updatedAt: '2026-09-03T10:00:00Z' },
    { id: 'f2', number: '', clientId: 102, billTo: { name: 'Lucas Verdier', company: 'Atelier Verdier' } },
  ],
  taches: [{ id: 't1', title: 'Relire le plan de formation', clientId: 101 }, { id: 't2', title: 'Réunion équipe', clientId: null }],
  notes: [{ id: 'n1', title: 'Idées de rentrée', body: 'penser à la tournée des fournisseurs de bois', updatedAt: '2026-09-04T10:00:00Z' }],
  documents: [{ id: 'd1', title: 'Procédure de livraison' }],
  decisions: [{ id: 'x1', title: 'Passer au paiement trimestriel' }],
};
const index = construire.construireIndex(donnees, options());

const textes: import('../src/refonte/systeme/recherche/moteur.ts').TextesMoteur = {
  ajmaniGenerique: (t) => `Demander à Ajmani : « ${t} »`,
  ajmaniClient: (n) => `Résumer l’historique de ${n}`,
  ajmaniClientDemande: (n) => `Résume l’historique de ${n}`,
  devis: (n) => `Créer un devis pour ${n}`,
  ecrire: (n) => `Écrire à ${n}`,
};
const chercherTexte = (saisie: string, ctx: Partial<import('../src/refonte/systeme/recherche/moteur.ts').ContexteRecherche> = {}, idx = index) => moteur.rechercher(saisie, idx, { textes, ...ctx });
/** Les libellés d'un groupe ; « resultats » : tous les éléments trouvés, groupe après groupe (hors actions et récents). */
const libelles = (r: ReturnType<typeof chercherTexte>, groupe: 'actions' | 'resultats' | 'recents' | 'clients' | 'documents' | 'modules' | 'taches' | 'notes') =>
  groupe === 'resultats'
    ? r.groupes.filter((g) => g.id !== 'actions' && g.id !== 'recents').flatMap((g) => g.lignes.map((l) => l.libelle))
    : (r.groupes.find((g) => g.id === groupe)?.lignes.map((l) => l.libelle) ?? []);

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
  const ordre = (ctx: object) => moteur.classer('atelier nord', dup.entrees, { textes, ...ctx }).map((c) => c.entree.cle);
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

await dit('regroupement v3 : ACTIONS, CLIENTS, DOCUMENTS, MODULES (puis tâches, notes) ; RÉCENTS puis ACTIONS à saisie vide', () => {
  assert.deepEqual(chercherTexte('orch').groupes.map((g) => g.id), ['actions', 'clients', 'documents', 'taches']);
  assert.deepEqual(libelles(chercherTexte('orch'), 'documents'), ['Facture F-2031 · Orchidée Conseil', 'Refonte du catalogue'], 'un devis et une facture sont des documents (le nom dans le libellé passe devant)');
  assert.deepEqual(chercherTexte('factur').groupes.map((g) => g.id), ['actions', 'documents', 'modules'], 'une page est un module ; « Facture … » est un document');
  assert.deepEqual(libelles(chercherTexte('factur'), 'modules'), ['Facturation']);
  assert.deepEqual(moteur.ORDRE_GROUPES, ['actions', 'clients', 'documents', 'modules', 'taches', 'notes', 'messages']);
  for (const t of moteur.TYPES_RESULTAT) assert.ok(moteur.ORDRE_GROUPES.includes(moteur.GROUPE_DU_TYPE[t]), `${t} a un groupe`);
  assert.deepEqual(libelles(chercherTexte('idees rentree'), 'notes'), ['Idées de rentrée']);
  const vide = chercherTexte('', { recents: ['client:101', 'page:tasks'], actionsPage: [{ id: 'nouvelle', libelle: 'Nouvelle tâche' }] });
  assert.equal(vide.mode, 'vide');
  assert.deepEqual(vide.groupes.map((g) => g.id), ['recents', 'actions']);
  assert.deepEqual(libelles(vide, 'recents'), ['Orchidée Conseil', 'Tâches']);
  assert.deepEqual(libelles(vide, 'actions'), ['Nouvelle tâche']);
  assert.deepEqual(chercherTexte('   ').groupes, [], 'rien à montrer sans récents ni actions de page');
});

await dit('portée : « Tout » montre 3 lignes par groupe, la puce d’un groupe le montre en entier ; ⇥ passe à la suivante', () => {
  const grand = construire.construireIndex(
    { ...donnees, clients: Array.from({ length: 40 }, (_, i) => ({ id: i + 1, name: '', company: `Boutique ${i}`, email: '' })) },
    options(),
  );
  const r = chercherTexte('boutique', {}, grand);
  assert.equal(libelles(r, 'clients').length, moteur.PLAFOND_PAR_GROUPE, 'un groupe garde au plus PLAFOND_PAR_GROUPE lignes');
  assert.equal(moteur.PLAFOND_TOUT, 3);
  const tout = moteur.groupesDeLaPortee(r, 'tout');
  assert.ok(tout.every((g) => g.lignes.length <= 3), 'vue Tout : 3 lignes par groupe');
  assert.equal(tout.find((g) => g.id === 'clients')?.lignes.length, 3);
  const seul = moteur.groupesDeLaPortee(r, 'clients');
  assert.deepEqual(seul.map((g) => g.id), ['clients']);
  assert.equal(seul[0].lignes.length, moteur.PLAFOND_PAR_GROUPE);
  assert.deepEqual(moteur.groupesDeLaPortee(r, 'notes'), tout, 'une portée sans groupe revient à Tout');
  const puces = moteur.pucesDePortee(r);
  assert.deepEqual(puces.map((p) => p.cle), ['tout', 'actions', 'clients']);
  assert.equal(puces[0].compteur, r.total, '« Tout » compte toutes les lignes');
  assert.equal(puces[2].compteur, moteur.PLAFOND_PAR_GROUPE);
  assert.equal(moteur.porteeSuivante(puces, 'tout'), 'actions');
  assert.equal(moteur.porteeSuivante(puces, 'clients'), 'tout', 'en boucle');
  assert.equal(moteur.porteeSuivante(puces, 'tout', true), 'clients', '⇧⇥ : la précédente');
  assert.equal(moteur.porteeSuivante(puces, 'notes'), 'tout');
  assert.deepEqual(moteur.pucesDePortee(chercherTexte('')), [], 'saisie vide : pas de puces');
  // À saisie vide et en mode « > », « Tout » ne coupe rien.
  assert.equal(moteur.groupesDeLaPortee(chercherTexte('>', {}, grand), 'tout')[0].lignes.length, chercherTexte('>', {}, grand).total);
  const recents = Array.from({ length: 9 }, (_, i) => `client:${i + 1}`);
  assert.equal(libelles(chercherTexte('', { recents }, grand), 'recents').length, 5);
});

await dit('Demander à Ajmani : première ligne dès qu’il y a une saisie, jamais sans ; « résumer l’historique » si un client est désigné', () => {
  const generique = chercherTexte('relire le plan');
  assert.equal(generique.groupes[0].lignes[0].libelle, 'Demander à Ajmani : « relire le plan »');
  assert.deepEqual(generique.groupes[0].lignes[0].cible, { k: 'ajmani', texte: 'relire le plan' });
  const client = chercherTexte('orchidee');
  assert.equal(client.groupes[0].lignes[0].libelle, 'Résumer l’historique de Orchidée Conseil');
  assert.deepEqual(client.groupes[0].lignes[0].cible, { k: 'ajmani', texte: 'Résume l’historique de Orchidée Conseil' });
  assert.equal(client.groupes[0].lignes[0].famille, 'ajmani');
  assert.equal(client.groupes[0].lignes[0].nature, 'ajmani', 'son étiquette dit « Demander à Ajmani »');
  assert.equal(client.groupes[0].lignes[0].lie, 'client:101', 'l’aperçu montre le client');
  assert.equal(generique.groupes[0].lignes[0].nature, 'ajmani');
  assert.equal(generique.groupes[0].lignes[0].lie, undefined);
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
  assert.deepEqual(actions.map((l) => l.libelle), ['Résumer l’historique de Orchidée Conseil', 'Créer un devis pour Orchidée Conseil', 'Écrire à Camille Orchis']);
  assert.deepEqual(actions.map((l) => l.nature), ['ajmani', 'devis', 'courriel']);
  assert.ok(actions.every((l) => l.lie === 'client:101'));
  // Les actions rapides de l'aperçu d'un client : l'ouvrir, un devis, un courriel ; d'un autre élément : l'ouvrir.
  const parCle = new Map(index.entrees.map((e) => [e.cle, e]));
  const rapides = moteur.actionsRapides(parCle.get('client:101') as never, { textes });
  assert.deepEqual([rapides.ouvrir.cle, rapides.devis?.libelle, rapides.ecrire?.cible], ['client:101', 'Créer un devis pour Orchidée Conseil', { k: 'lien', href: 'mailto:camille@orchidee.test' }]);
  assert.equal(moteur.actionsRapides(parCle.get('client:102') as never, { textes }).ecrire, undefined, 'sans adresse valide, pas de « Écrire »');
  assert.deepEqual(Object.keys(moteur.actionsRapides(parCle.get('tache:t1') as never, { textes })), ['ouvrir']);
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
  assert.deepEqual(libelles(chercherTexte('factures'), 'modules'), ['Facturation'], 'pluriel toléré');
  assert.deepEqual(libelles(chercherTexte('facturaton'), 'modules'), ['Facturation'], 'une lettre manquante : la tolérance prend le relais');
  assert.ok(libelles(chercherTexte('taches'), 'resultats').includes('Tâches'));
  const page = chercherTexte('clients').groupes.find((g) => g.id === 'modules')?.lignes.find((l) => l.type === 'page');
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
  assert.equal(parCle.get('facture:f1')?.libelle, 'Facture F-2031 · Orchidée Conseil', 'le numéro et le tiers');
  assert.equal(parCle.get('facture:f2')?.libelle, 'Brouillon Atelier Verdier', 'un brouillon n’a pas de numéro');
  assert.equal(parCle.get('facture:f1')?.enRetard, true, 'l’état « en retard » vient de l’appelant (échéance et avoirs)');
  assert.equal(parCle.get('facture:f2')?.enRetard, undefined);
  assert.equal(chercherTexte('F-2031').groupes.find((g) => g.id === 'documents')?.lignes[0].enRetard, true);
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
  assert.equal(fr['pied.astuce'], 'Astuce\u00a0: tapez «\u00a0>\u00a0» pour ne voir que les actions');
  assert.equal(mots.traduire('fr', 'compteur.n', { n: 9, ms: 12 }), '9 résultats en 12 ms');
  assert.equal(fr['portee.changer'], 'changer de groupe');
  assert.deepEqual(['tout', 'actions', 'clients', 'documents', 'modules'].map((g) => fr[`groupe.${g}`]), ['Tout', 'Actions', 'Clients', 'Documents', 'Modules']);
  assert.deepEqual(['ajmani', 'devis', 'courriel'].map((n) => fr[`nature.${n}`]), ['Demander à Ajmani', 'Devis', 'Courriel']);
  assert.equal(fr['etat.retard'], 'en retard');
  assert.deepEqual(['apercu.ouvrirFiche', 'apercu.devis', 'apercu.ecrire'].map((c) => fr[c]), ['Ouvrir la fiche', 'Créer un devis', 'Écrire']);
  assert.equal(mots.traduire('fr', 'apercu.facture', { annee: 2026 }), 'Facturé en 2026');
  assert.equal(mots.traduire('fr', 'apercu.courbe', { n: 10 }), 'Facturation sur 10 mois');
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
  // Quatre groupes dans la liste (actions, clients, documents, tâches), plus le groupe des actions rapides de l'aperçu.
  assert.equal(compter(r, /aria-labelledby="[^"]*-g-/g), 4);
  assert.equal(compter(r, /role="group"/g), 5);
  assert.match(r, /role="group" aria-label="Actions rapides"/);
  // L'aperçu est annoncé poliment ; la portée est un groupe de puces exclusives.
  assert.match(r, /<section class="rc-apercu" aria-label="Aperçu" aria-live="polite">/);
  assert.match(r, /role="radiogroup" aria-label="Résultats par groupe"/);
  assert.match(r, /role="radio" aria-checked="true"[^>]*class="sc-puce"><span class="sc-puce__corps">Tout<b class="sc-puce__compteur"[^>]*>\d+<\/b>/);
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
  const tout = vue();
  // La liste seule : l'aperçu a ses propres raccourcis (voir plus bas).
  const r = tout.slice(tout.indexOf('role="listbox"'), tout.indexOf('class="rc-apercu"'));
  assert.equal(compter(r, /<kbd[^>]*>↵<\/kbd>/g), 1);
  assert.match(r, /aria-selected="true"[\s\S]*?<kbd[^>]*>↵<\/kbd>/);
  const apresSelection = r.slice(r.indexOf('aria-selected="true"'));
  assert.equal(compter(r.slice(0, r.indexOf('aria-selected="true"')), /<kbd[^>]*>↵/g), 0, 'rien avant la ligne sélectionnée');
  assert.equal(compter(apresSelection.slice(apresSelection.indexOf('</kbd>') + 6), /<kbd[^>]*>↵/g), 0, 'rien après');
  assert.match(tout, /<kbd[^>]*>esc<\/kbd>/);
  assert.doesNotMatch(tout, /onglet|⌘↵|nouvelle fenêtre/i);
  assert.match(tout, /↑↓ pour naviguer/);
  assert.match(tout, /↵ pour ouvrir/);
  assert.match(tout, /Astuce\u00a0: tapez «\u00a0&gt;\u00a0» pour ne voir que les actions/);
  // Le compteur du champ : le nombre de lignes et la durée mesurée (« 9 résultats en 12 ms »), puis ⇥ « changer de groupe ».
  let t = 0;
  const horloge = () => (t += 6);
  assert.match(vue({ horloge }), /class="rc-champ__compteur">\d+ résultats en 6 ms<\/span>/);
  assert.match(vue({ horloge: () => (t += 1500) }), /class="rc-champ__compteur">\d+ résultats<\/span>/, 'au-delà d’une seconde, la durée ne se dit plus');
  assert.match(tout, /rc-portee__aide"><kbd class="sc-kbd">⇥<\/kbd>changer de groupe</);
  assert.doesNotMatch(vue({ texteInitial: '' }), /rc-champ__compteur|role="radiogroup"/, 'saisie vide : ni compteur ni portée');
});

await dit('palette : la première ligne est « Demander à Ajmani » (étincelle verte, jamais un avatar), puis les autres', () => {
  const r = vue();
  const premiere = /role="option"[^>]*>([\s\S]*?)<\/div>(?=<div id=|<\/div>)/.exec(r)?.[1] ?? '';
  assert.match(premiere, /data-ajmani="true"/);
  assert.match(premiere, /sc-etincelle/);
  assert.match(premiere, /Résumer l’historique de <mark>Orchidée<\/mark> Conseil<\/span><span class="rc-ligne__type">Demander à Ajmani</);
  assert.doesNotMatch(r, /sc-avatar|<img|<canvas/);
  assert.match(r, /Créer un devis pour <mark>Orchidée<\/mark> Conseil<\/span><span class="rc-ligne__type">Devis</);
  assert.match(r, /Écrire à Camille Orchis<\/span><span class="rc-ligne__type">Courriel</);
  // Les types sont dits en toutes lettres à côté des éléments ; une page porte le nom de sa famille, une facture échue « en retard ».
  assert.match(r, /rc-ligne__type">Client</);
  assert.match(vue({ texteInitial: 'factur' }), /rc-ligne__type">L’argent</);
  assert.match(r, /Facture F-2031 · <mark>Orchidée<\/mark> Conseil<\/span><span class="rc-ligne__type">en retard</);
  // La porte générique vers Ajmani répète la saisie : rien n'y est mis en évidence.
  assert.doesNotMatch(vue({ texteInitial: 'relire le plan' }), /Demander à Ajmani\u00a0: «\u00a0<mark>/);
  // La tuile suit la famille du module de destination.
  assert.match(r, /class="rc-tuile" data-famille="contacts"/);
});

await dit('palette : saisie vide → RÉCENTS puis ACTIONS de la page ; sans « Demander à Ajmani »', () => {
  const r = vue({ texteInitial: '', recents: ['client:101', 'page:tasks'], actionsPage: [{ id: 'n', libelle: 'Nouvelle tâche', famille: 'jour' }] });
  assert.match(r, /rc-groupe__titre"><span[^>]*>Récents</);
  assert.match(r, /rc-groupe__titre"><span[^>]*>Actions</);
  assert.ok(r.indexOf('Récents<') < r.indexOf('Actions<'));
  assert.match(r, /Nouvelle tâche/);
  assert.doesNotMatch(r, /Demander à Ajmani/);
  assert.match(vue({ texteInitial: '' }), /Tapez un nom, une page ou «\u00a0&gt;\u00a0» pour voir les actions/);
});

await dit('palette : mode « > » → une seule liste d’actions', () => {
  const r = vue({ texteInitial: '> factur' });
  assert.equal(compter(r, /aria-labelledby="[^"]*-g-/g), 1);
  assert.match(r, /rc-groupe__titre"><span[^>]*>Actions</);
  assert.match(r, /Créer une facture/);
  // Seule la porte vers Ajmani dit sa nature ; aucun élément (client, page…) n'est proposé.
  assert.deepEqual([...r.matchAll(/rc-ligne__type">([^<]*)</g)].map((m) => m[1]), ['Demander à Ajmani']);
});

/* ─────────────────────────── L'aperçu ─────────────────────────── */

const MAINTENANT = new Date('2026-10-30T10:42:00');
const SOURCES = {
  clients: [{ id: 101, creeLe: '2025-03-12T09:00:00', evenements: [{ titre: 'Appel de cadrage', date: '2026-10-30T10:12:00' }, { titre: 'Ancien échange', date: '2026-01-05T09:00:00' }] }],
  factures: [
    { id: 'a', numero: 'F-1', clientId: 101, statut: 'paid', avoir: false, emiseLe: '2026-01-15', echeance: '2026-02-15', payeeLe: '2026-10-30', totalCentimes: 100_000, resteDuCentimes: 0 },
    { id: 'b', numero: 'F-2', clientId: 101, statut: 'issued', avoir: false, emiseLe: '2026-09-20', echeance: '2026-10-20', payeeLe: '', totalCentimes: 50_000, resteDuCentimes: 30_000 },
    { id: 'c', numero: 'F-3', clientId: 101, statut: 'issued', avoir: false, emiseLe: '2026-10-01', echeance: '2026-10-26', payeeLe: '', totalCentimes: 20_000, resteDuCentimes: 20_000 },
    { id: 'd', numero: 'F-0', clientId: 101, statut: 'paid', avoir: false, emiseLe: '2025-06-01', echeance: '2025-07-01', payeeLe: '2025-07-01', totalCentimes: 125_000, resteDuCentimes: 0 },
    { id: 'e', numero: 'F-9', clientId: 101, statut: 'paid', avoir: false, emiseLe: '2025-12-01', echeance: '2026-01-01', payeeLe: '2026-01-01', totalCentimes: 999_000, resteDuCentimes: 0 },
    { id: 'f', numero: 'AV-1', clientId: 101, statut: 'issued', avoir: true, emiseLe: '2026-10-02', echeance: '2026-10-02', payeeLe: '', totalCentimes: 7_000, resteDuCentimes: 0 },
    { id: 'g', numero: '', clientId: 101, statut: 'draft', avoir: false, emiseLe: '', echeance: '', payeeLe: '', totalCentimes: 88_000, resteDuCentimes: 88_000 },
    { id: 'h', numero: 'F-7', clientId: 999, statut: 'issued', avoir: false, emiseLe: '2026-10-01', echeance: '2026-10-02', payeeLe: '', totalCentimes: 5_000, resteDuCentimes: 5_000 },
  ],
  rendezVous: [
    { clientId: 101, debut: '2026-10-30T09:00:00', statut: 'scheduled' },
    { clientId: 101, debut: '2026-10-30T11:00:00', statut: 'scheduled' },
    { clientId: 101, debut: '2026-10-30T10:50:00', statut: 'cancelled' },
    { clientId: 102, debut: '2026-10-30T10:45:00', statut: 'scheduled' },
  ],
} as const;

await dit('aperçu d’un client : chaque chiffre est lu dans les factures, les rendez-vous et la fiche, jamais inventé', () => {
  const a = apercu.apercuClient(101, SOURCES as never, MAINTENANT);
  assert.equal(a.annee, 2026);
  assert.equal(a.factureCentimes, 170_000, 'émises ou payées en 2026 ; ni avoir, ni brouillon, ni l’an dernier, ni un autre client');
  assert.equal(a.evolution, 36, '170 000 contre 125 000 sur la même période de 2025 (la facture de décembre n’entre pas)');
  assert.deepEqual(a.retard, { centimes: 50_000, numero: 'F-2', jours: 10 }, 'ce qui reste dû sur les échues ; la plus ancienne, et ses jours de retard');
  assert.equal(a.rendezVous, '2026-10-30T11:00:00', 'le prochain prévu, pas un passé ni un annulé');
  assert.equal(a.depuis, '2025-03-12T09:00:00');
  assert.deepEqual(a.courbe, { valeurs: [100_000, 0, 0, 0, 0, 0, 0, 0, 50_000, 20_000], premier: '2026-01', dernier: '2026-10' });
  assert.deepEqual(a.activite.map((f) => f.genre), ['evenement', 'encaissement', 'emission'], 'les 3 derniers faits, du plus récent au plus ancien');
  assert.equal(apercu.apercuClient(101, { ...SOURCES, factures: [] } as never, MAINTENANT).evolution, null, 'sans base, pas d’évolution');
  assert.equal(apercu.apercuClient(101, { ...SOURCES, factures: [] } as never, MAINTENANT).retard, null);
  assert.deepEqual(apercu.moisGlissants('2026-03-05', 4), ['2025-12', '2026-01', '2026-02', '2026-03']);
  const f = apercu.apercuDeCle('facture:b', SOURCES as never, MAINTENANT);
  assert.deepEqual(f, { genre: 'facture', numero: 'F-2', totalCentimes: 50_000, resteDuCentimes: 30_000, echeance: '2026-10-20', etat: 'retard', jours: 10 });
  assert.equal(apercu.apercuDeCle('tache:t1', SOURCES as never, MAINTENANT), null, 'une tâche n’a pas d’aperçu chiffré');
  assert.equal(apercu.apercuDeCle(undefined, SOURCES as never, MAINTENANT), null);
});

await dit('aperçu rendu : en-tête, 3 chiffres, courbe 10 mois, activité, actions rapides avec raccourcis ; rien sans source', () => {
  const a = apercu.apercuClient(101, SOURCES as never, MAINTENANT);
  const r = vue({ apercuDe: (l: { lie?: string }) => (l.lie === 'client:101' ? a : null), maintenant: MAINTENANT, touche: '⌘' });
  const volet = r.slice(r.indexOf('class="rc-apercu"'));
  assert.match(volet, /rc-apercu__monogramme[^>]*>O</);
  assert.match(volet, /rc-apercu__titre">Orchidée Conseil</);
  assert.match(volet, /Client depuis mars 2025/);
  assert.match(volet, /Facturé en 2026<\/span><span class="rc-chiffre__valeur">1\u202f700\u00a0€<\/span><span class="rc-chiffre__detail" data-ton="succes">\+36\u00a0% sur 2025</);
  assert.match(volet, /En retard<\/span><span class="rc-chiffre__valeur">500\u00a0€<\/span><span class="rc-chiffre__detail" data-ton="attention">F-2 · 10 jours</);
  assert.match(volet, /Rendez-vous<\/span><span class="rc-chiffre__valeur">11:00<\/span><span class="rc-chiffre__detail" data-ton="info">dans 18 min</);
  assert.match(volet, /Facturation sur 10 mois/);
  assert.match(volet, /janv\. · oct\./);
  assert.match(volet, /data-socle="mini-courbe"/);
  assert.match(volet, /Activité récente/);
  assert.match(volet, /rc-fait__quand sc-mono">10:12</);
  assert.match(volet, /Facture F-1 encaissée · 1\u202f000\u00a0€/);
  // La ligne choisie est la porte vers Ajmani : « Demander ↵ », puis la fiche (sans ↵), le devis ⌘D, l'écriture ⌘E.
  assert.deepEqual([...volet.matchAll(/rc-rapide__libelle">([^<]*)<\/span>(?:<kbd class="sc-kbd">([^<]*)<\/kbd>)?/g)].map((m) => [m[1], m[2] ?? '']), [
    ['Demander', '↵'],
    ['Ouvrir la fiche', ''],
    ['Créer un devis', '⌘D'],
    ['Écrire', '⌘E'],
  ]);
  // Sur la fiche elle-même, « Ouvrir la fiche ↵ » ; « Ctrl D » hors macOS.
  const fiche = vue({ apercuDe: () => a, maintenant: MAINTENANT, choixInitial: 3 });
  assert.match(fiche, /rc-rapide__libelle">Ouvrir la fiche<\/span><kbd class="sc-kbd">↵<\/kbd>/);
  assert.match(fiche, /rc-rapide__libelle">Créer un devis<\/span><kbd class="sc-kbd">Ctrl D<\/kbd>/);
  // Ce que l'application ne sait pas : ni effectif, ni urgents, ni contacts, ni note épinglée, ni « Appeler ».
  assert.doesNotMatch(r, /personnes|urgent|contacts ·|Épinglé|Appeler|⌘P/);
  // Une ligne sans aperçu chiffré : le volet dit ce que la ligne dit, jamais vide.
  const nu = vue({ texteInitial: 'idees rentree' });
  assert.match(nu.slice(nu.indexOf('class="rc-apercu"')), /rc-apercu__titre">[^<]+<[\s\S]*rc-rapide__libelle">Demander</);
});

await dit('lettres trouvées : premier passage de chaque mot, début de mot de préférence, sans accent ni casse', () => {
  const m = (libelle: string, saisie: string) => moteur.surligner(libelle, saisie).map((x) => (x.trouve ? `[${x.texte}]` : x.texte)).join('');
  assert.equal(m('Créer un devis pour Orchidée Conseil', 'orchidee'), 'Créer un devis pour [Orchidée] Conseil');
  assert.equal(m('Orchidée Conseil', 'ORCH cons'), '[Orch]idée [Cons]eil');
  assert.equal(m('Mardi marin', 'mar'), '[Mar]di marin', 'le premier passage');
  assert.equal(m('Atelier Nord', 'lier'), 'Ate[lier] Nord', 'au milieu d’un mot, faute de mieux');
  assert.equal(m('Facturation', '> fact'), '[Fact]uration', 'le « > » du mode actions ne compte pas');
  assert.equal(m('Tâches', ''), 'Tâches');
  assert.equal(moteur.surligner('Écrire à Camille', 'ecrire').map((x) => x.texte).join(''), 'Écrire à Camille', 'les morceaux recollent le libellé exact');
});

await dit('état chargement : trois squelettes de ligne par groupe attendu, après 200 ms seulement', () => {
  const avant = vue({ pret: false, texteInitial: 'factur', attenteEcoulee: false });
  assert.doesNotMatch(avant, /data-squelette/);
  const apres = vue({ pret: false, texteInitial: 'factur', attenteEcoulee: true });
  assert.equal(compter(apres, /class="rc-groupe" data-squelette/g), 1, 'les résultats attendent');
  assert.equal(compter(apres, /class="rc-apercu__corps" aria-hidden="true" data-squelette/g), 1, 'l’aperçu attend aussi, en squelette');
  assert.equal(compter(apres, /rc-ligne--squelette/g), 3);
  assert.match(apres, /class="rc-champ__compteur">Recherche…</);
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
  assert.match(r, /<mark>Factur<\/mark>ation/, 'les pages restent proposées');
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

await dit('cotes de la feuille (v3) : 862 × 642 à 88 px, champ 61, portée 43, volets de 430, lignes 38, tuile 26, pied 41, rayon 18', () => {
  assert.match(bloc('.rc-palette'), /width:\s*min\(862px,\s*calc\(100% - 32px\)\)/);
  assert.match(bloc('.rc-palette'), /height:\s*min\(642px/);
  assert.match(bloc('.rc-palette'), /box-sizing:\s*border-box/);
  assert.match(bloc('.rc-palette'), /border-radius:\s*18px/);
  assert.match(bloc('.rc-palette'), /border:\s*1px solid var\(--socle-bord-palette\)/);
  assert.match(bloc('.rc-palette'), /background:\s*linear-gradient\(180deg, var\(--sc-recherche-haut-fond\), var\(--socle-palette-fond\)\)/);
  assert.match(bloc('.rc-palette'), /box-shadow:\s*var\(--sc-recherche-ombre\)/);
  assert.doesNotMatch(bloc('.rc-palette'), /tabular-nums/, 'écart C11 : la palette entière ne passe pas en chiffres tabulaires');
  assert.match(css, /--sc-recherche-haut-fond:\s*#19191b;/);
  assert.match(css, /--sc-recherche-ombre:\s*0 40px 120px rgba\(0, 0, 0, 0\.72\)/);
  assert.match(bloc('.rc-champ'), /height:\s*61px/);
  assert.match(bloc('.rc-champ__saisie'), /font-size:\s*17px/);
  assert.match(bloc('.rc-champ__compteur'), /font-size:\s*12px/);
  assert.match(bloc('.rc-portee'), /height:\s*43px/);
  assert.match(bloc('.rc-corps'), /grid-template-columns:\s*430px/);
  assert.match(bloc('.rc-liste'), /overflow-y:\s*auto[\s\S]*overscroll-behavior:\s*contain[\s\S]*padding:\s*4px 8px 10px[\s\S]*border-right:\s*1px solid var\(--sc-recherche-filet-volet\)/);
  assert.match(bloc('.rc-groupe__titre'), /height:\s*28px/);
  assert.match(bloc('.rc-groupe__titre'), /font-size:\s*11px[\s\S]*letter-spacing:\s*0\.08em[\s\S]*text-transform:\s*uppercase/);
  assert.match(bloc('.rc-groupe__titre'), /color:\s*var\(--socle-texte-3\)/);
  assert.match(bloc('.rc-ligne'), /height:\s*38px/);
  assert.match(bloc('.rc-ligne'), /border-radius:\s*9px/);
  // T1 H41.1 : 13,5 px, pas 14 (la palette était ≈ 3 % trop large).
  assert.match(bloc('.rc-ligne'), /font-size:\s*13\.5px/);
  assert.doesNotMatch(css, /\.rc-ligne \{[^}]*font-size:\s*14px/);
  assert.match(bloc('.rc-ligne__type'), /font-size:\s*11\.5px/);
  assert.match(bloc(".rc-ligne[aria-selected='true']"), /background:\s*var\(--socle-segment-actif\)/);
  assert.match(css, /\.rc-ligne__libelle mark \{[^}]*background:\s*var\(--sc-recherche-trouve\)[^}]*font-weight:\s*600/);
  assert.match(bloc('.rc-tuile'), /width:\s*26px[\s\S]*height:\s*26px[\s\S]*border-radius:\s*7px/);
  assert.match(bloc('.rc-tuile'), /color-mix\(in srgb, var\(--rc-teinte\) 14%, transparent\)/);
  assert.match(bloc('.rc-apercu__corps'), /padding:\s*16px 20px 14px/);
  assert.match(bloc('.rc-chiffre'), /height:\s*72px/);
  assert.match(bloc('.rc-chiffres'), /grid-template-columns:\s*repeat\(3/);
  assert.match(bloc('.rc-fait'), /height:\s*28px/);
  assert.match(bloc('.rc-rapides'), /margin-top:\s*auto/);
  assert.match(bloc('.rc-rapide'), /height:\s*34px/);
  assert.match(bloc('.rc-pied'), /height:\s*41px/);
  assert.match(bloc('.rc-pied'), /gap:\s*18px/);
  assert.match(css, /--sc-recherche-haut:\s*88px/);
  assert.match(css, /@media \(max-height: 699\.98px\) \{\s*:root\[data-ambiance='noir'\] \{ --sc-recherche-haut: 10dvh; \}/);
  assert.match(css, /@media \(max-width: 899\.98px\) \{[^}]*width:\s*min\(600px[\s\S]*?\.rc-apercu \{ display: none; \}/);
  assert.match(css, /@media \(max-width: 559\.98px\) \{\s*\.rc-pied__mention\[data-secondaire\] \{ display: none; \}/);
});

await dit('le calque est fixe, à z-index 50 ou plus : la pile des calques le reconnaît', () => {
  const v = bloc('.rc-voile');
  assert.match(v, /position:\s*fixed/);
  const z = Number(/z-index:\s*(\d+)/.exec(v)?.[1]);
  assert.ok(z >= 50, `z-index ${z}`);
  assert.match(v, /inset:\s*0/);
  assert.match(v, /background:\s*var\(--sc-recherche-voile\)/);
  // v3 : l'écran derrière est flouté, désaturé et assombri, et rien n'y bouge.
  assert.match(v, /backdrop-filter:\s*var\(--sc-recherche-flou\)/);
  assert.match(css, /--sc-recherche-voile:\s*rgba\(6, 6, 7, 0\.6\)/);
  assert.match(css, /--sc-recherche-flou:\s*blur\(2\.5px\) saturate\(0\.8\)/);
  assert.match(css, /body:has\(> \.rc-voile\) > :not\(\.rc-voile\) \*[\s\S]*animation-play-state:\s*paused/);
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
  assert.match(src, /0\.16/);
  // ⇥ change de portée ; ⌘D et ⌘E ne valent que dans la palette (dans son champ, jamais un écouteur global).
  assert.match(src, /e\.key === 'Tab' && puces\.length > 1/);
  assert.match(src, /lettre === 'd' && rapides\?\.devis/);
  assert.match(src, /lettre === 'e' && rapides\?\.ecrire/);
  assert.doesNotMatch(src, /addEventListener\('keydown'/);
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
