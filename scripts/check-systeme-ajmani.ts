/**
 * Contrôle de la PALETTE D'AJMANI (G05, LOT-00) — sans navigateur, sans build, sans réseau.
 *
 *   npm run check:systeme-ajmani
 *
 * Ce qu'il tient :
 *   1. l'analyseur d'intentions : des faits CALCULÉS sur des données fictives (jamais ceux de la maquette), la règle
 *      du retard (aujourd'hui − échéance), « déjà fait », les refus (paiement, coffre-fort), la délégation ;
 *   2. la règle d'or : Entrée dans le champ n'exécute jamais un N1, N2 ou N3 ; un seul bouton primaire, au verbe précis ;
 *   3. les niveaux et le délai d'annulation de 10 s (horloge à la main) ;
 *   4. l'historique (5 demandes, 30 jours, par compte, effaçable, sans secret) et le journal (200 au plus, sans secret) ;
 *   5. les quatre lignes « Ou lancez », le parcours au clavier, les états et leurs délais ;
 *   6. le rendu statique de la palette (rôles ARIA, étincelle sans lettre, pied en minuscules, quatre lignes) ;
 *   7. les sources : cotes de `palette.css`, calque fixe z-index ≥ 50, Échap, aucune couleur en dur, aucune encre
 *      « discret » en texte, aucun avatar ni mascotte, aucun nom d'exemple de la fiche, étanchéité des éditions.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { assert, creerEssais, jetons, lire, racine, rapportContraste, sansCommentaires } from './lib/essai-socle.ts';

const { dit, fin } = creerEssais('Ajmani — la palette ⌘J (G05)');

/* ═══ Charger les sources (le CSS importé par le composant est ignoré) ═══ */

const DOSSIER = 'src/refonte/systeme/ajmani';
const dedans = (f: string) => `../${DOSSIER}/${f}`;

async function charger<T>(code: string): Promise<T> {
  const r = await esbuild.build({
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
  return (await import(`data:text/javascript;charset=utf-8;base64,${Buffer.from(r.outputFiles[0].text, 'utf8').toString('base64')}`)) as T;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const A = await charger<any>(`
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
export { h, renderToStaticMarkup };
export * as I from '${dedans('intentions')}';
export * as N from '${dedans('niveaux')}';
export * as H from '${dedans('historique')}';
export * as J from '${dedans('journal')}';
export * as L from '${dedans('lancer')}';
export * as V from '${dedans('navigation')}';
export * as E from '${dedans('etat')}';
export * as S from '${dedans('sensibles')}';
export * as M from '${dedans('i18n')}';
export { ContenuPalette } from '${dedans('PaletteAjmaniRefonte')}';
`);
const { I, N, H, J, L, V, E, S, M, h, renderToStaticMarkup, ContenuPalette } = A;
/* eslint-enable @typescript-eslint/no-explicit-any */

const fr = (cle: string, params?: Record<string, string | number>): string => M.traduire('fr', cle, params);

/** Une phrase rendue en texte brut, les faits entre « ** ». */
const lire_ = (r: { phrase: { cle: string; params?: Record<string, string | number>; gras?: string[] }; complement?: { cle: string; params?: Record<string, string | number>; gras?: string[] } }): string => {
  const un = (p: typeof r.phrase) => I.segmenter(fr(p.cle), p.params, p.gras).map((s: { texte: string; gras: boolean }) => (s.gras ? `**${s.texte}**` : s.texte)).join('');
  return r.complement ? `${un(r.phrase)} ${un(r.complement)}` : un(r.phrase);
};

/** Les espaces insécables des montants (« 1 840,50 € ») ramenés à de simples espaces, pour comparer. */
const nb = (t: string): string => t.replace(/[\u00a0\u202f]/g, ' ');

/** Comme `assert.match` sur du HTML, mais en montrant le texte (sans balises) plutôt que tout le balisage. */
const matche = (html: string, re: RegExp, nom = 'rendu'): void => {
  const brut = html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.ok(re.test(html), `${nom} : ${re} — texte rendu : « ${brut.slice(0, 260)} »`);
};

/* ═══ Des données FICTIVES, qui ne sont pas celles de la maquette ═══ */

const AUJOURDHUI = '2026-03-18';
const clients = [
  { id: 11, recordId: 'c-11', nom: 'Camille Verlaine', societe: 'Studio Verlaine' },
  { id: 12, recordId: 'c-12', nom: 'Hugo Vasseur', societe: 'Garage Vasseur' },
  { id: 13, recordId: 'c-13', nom: 'Léa Vasseur', societe: 'Menuiserie Vasseur' },
  { id: 14, recordId: 'c-14', nom: 'Paul Orsini', societe: 'Cabinet Orsini' },
  { id: 15, recordId: 'c-15', nom: 'Nora Calvet', societe: '' },
];
const facture = (id: string, numero: string, clientId: number, echeance: string, reste: number, statut = 'emise') => ({
  id, numero, clientId, clientNom: clients.find((c) => c.id === clientId)?.societe ?? '', statut, echeance, resteDuCentimes: reste,
});
const factures = [
  facture('f-1', 'T-0102', 11, '2026-03-02', 184050), // 16 jours
  facture('f-2', 'T-0105', 11, '2026-03-10', 60000), // 8 jours
  facture('f-3', 'T-0099', 12, '2026-01-20', 99900), // 57 jours
  facture('f-4', 'T-0107', 14, '2026-03-30', 40000), // pas échue
  facture('f-5', 'T-0090', 13, '2026-02-01', 25000, 'payee'),
  facture('f-6', '', 13, '2026-02-01', 25000, 'brouillon'),
  facture('f-7', 'T-0091', 15, '2026-02-11', 0), // tout compensé par un avoir
];
const modules = [
  { cle: 'invoices', libelle: 'Facturation', indice: 'Émettre et suivre', route: '/facturation', familleLibelle: 'L’argent', famille: 'argent', verbes: ['créer une facture', 'envoyer une facture'], motsCles: ['facture', 'tva'] },
  { cle: 'reminders', libelle: 'Relances', route: '/relances', familleLibelle: 'L’argent', famille: 'argent', verbes: ['relancer un impayé'], motsCles: ['relance', 'impayé'] },
  { cle: 'clients', libelle: 'Clients', route: '/clients', familleLibelle: 'Mes contacts', famille: 'contacts', verbes: ['retrouver un client'], motsCles: ['client', 'fiche'] },
  { cle: 'agenda', libelle: 'Agenda', route: '/agenda', familleLibelle: 'Ma journée', famille: 'jour', verbes: ['voir mon agenda'], motsCles: ['rdv'] },
  { cle: 'notes', libelle: 'Notes', route: '/notes', familleLibelle: 'Écrire et retenir', famille: 'ecrire', verbes: ['écrire une note'], motsCles: ['note'] },
  { cle: 'tasks', libelle: 'Tâches', route: '/tasks', familleLibelle: 'Ma journée', famille: 'jour', verbes: ['ajouter une tâche'], motsCles: ['tâche'] },
  { cle: 'weekly', libelle: 'Bilan de la semaine', route: '/bilan', familleLibelle: 'Ma journée', famille: 'jour', verbes: ['faire le bilan'], motsCles: ['bilan'] },
  { cle: 'okr', libelle: 'Objectifs', route: '/objectifs', familleLibelle: 'Ma journée', famille: 'jour', verbes: ['fixer un objectif'], motsCles: ['objectif'] },
];
const donnees = {
  aujourdhui: AUJOURDHUI,
  factures,
  clients,
  relances: [] as Array<{ factureId: string; le: string; palier?: string }>,
  modules,
  attentes: [] as Array<{ cle: string; titre: string; route: string }>,
  rendezVousAujourdhui: 0,
  garde: { etat: 'calme', points: 0 } as { etat: string; points: number } | null,
};
const contexte = { famille: 'jour', ecranLibelle: 'Accueil', admin: true, enLigne: true, langue: 'fr', email: 'essai@exemple.test' };
const env = (surcharge: Partial<typeof donnees> = {}, ctx: Record<string, unknown> = {}) => ({ donnees: { ...donnees, ...surcharge }, contexte: { ...contexte, ...ctx }, mots: fr });
const analyser = (texte: string, surcharge: Partial<typeof donnees> = {}, ctx: Record<string, unknown> = {}) => I.analyser(texte, env(surcharge, ctx));

const profond = <T>(x: T): T => {
  if (x && typeof x === 'object') for (const v of Object.values(x)) profond(v);
  return Object.freeze(x);
};

/* ═══ 1. L'analyseur ═══ */

await dit('relancer : la facture en retard la plus ancienne du client cité — numéro, montant, jours CALCULÉS', () => {
  const r = analyser('Relancer Studio Verlaine');
  assert.equal(r.intention, 'relancer');
  assert.equal(r.genre, 'proposition');
  assert.equal(r.niveau, 'N1');
  const phrase = lire_(r);
  assert.match(phrase, /\*\*T-0102\*\*/, 'le numéro est en gras');
  assert.match(nb(phrase), /1 840,50 €/, 'le montant vient de la facture (184 050 centimes)');
  assert.match(phrase, /16 jours/, 'jours = aujourd’hui − échéance = 16');
  assert.equal(I.joursEntre('2026-03-02', AUJOURDHUI), 16);
  assert.deepEqual(r.objets.map((o: { type: string; libelle: string }) => `${o.type}:${o.libelle}`), ['facture:T-0102', 'client:Studio Verlaine']);
  assert.match(phrase, /rien ne part d’ici/, 'l’application ne sait pas envoyer : la phrase le dit');
  assert.equal(r.complement && lire_({ phrase: r.complement }), 'Une autre facture est aussi en retard pour ce client.');
});

await dit('relancer : les faits suivent les données (le retard et le montant changent avec elles)', () => {
  for (const [echeance, reste] of [['2026-03-17', 12345], ['2026-03-11', 500000], ['2025-12-31', 99]] as const) {
    const r = analyser('Relancer Cabinet Orsini', { factures: [facture('x', 'T-9000', 14, echeance, reste)] });
    const jours = I.joursEntre(echeance, AUJOURDHUI);
    assert.match(lire_(r), new RegExp(`${jours === 1 ? '1 jour' : `${jours} jours`}`), `${echeance} → ${jours} j`);
    assert.ok(lire_(r).includes(I.formaterMontant(reste)), 'le montant est celui de la facture');
  }
});

await dit('relancer : une facture payée, en brouillon, tout compensée ou pas échue ne se relance pas', () => {
  for (const nom of ['Menuiserie Vasseur', 'Cabinet Orsini', 'Nora Calvet']) {
    const r = analyser(`Relancer ${nom}`);
    assert.equal(r.genre, 'rien-trouve', nom);
    assert.equal(lire_(r), `Je n’ai trouvé aucune facture en retard pour **${nom}**.`);
    assert.equal(r.lignes[0].id, 'trouver', 'la ligne « Trouver un module ou un client » est là');
  }
  assert.equal(I.facturesEnRetard(env().donnees).length, 3);
});

await dit('relancer : déjà fait si une relance est notée au même palier ; si le palier monte, le ton doit monter', () => {
  const noter = (le: string, palier?: string) => [{ factureId: 'f-1', le, palier }];
  // 16 jours = palier « mise en demeure » (au-delà de 7 j : ferme ; au-delà de 21 : mise en demeure → ici « ferme »).
  const deja = analyser('Relancer Studio Verlaine', { relances: noter('2026-03-12T09:00:00Z', 'ferme') });
  assert.equal(deja.genre, 'deja-fait');
  assert.equal(lire_(deja), 'La relance de **T-0102** est déjà notée au 12 mars.');
  assert.ok(deja.boutons.every((b: { effet: { type: string } }) => b.effet.type !== 'creer-brouillon-facture'));
  assert.equal(deja.boutons.filter((b: { role: string }) => b.role === 'primaire').length, 1);
  const monte = analyser('Relancer Studio Verlaine', { relances: noter('2026-03-05T09:00:00Z', 'rappel') });
  assert.equal(monte.genre, 'proposition');
  assert.match(lire_(monte), /le ton doit monter/);
  assert.match(lire_(monte), /5 mars/);
});

await dit('relancer : client inconnu, client ambigu, aucun client cité (un seul débiteur, plusieurs, aucun)', () => {
  const inconnu = analyser('Relancer Boulevard Zéphyr');
  assert.equal(inconnu.genre, 'rien-trouve');
  assert.match(lire_(inconnu), /Je ne trouve aucun client/);
  const ambigu = analyser('Relancer Vasseur');
  assert.equal(ambigu.genre, 'question');
  assert.equal(ambigu.lignes.length, 2);
  assert.ok(ambigu.lignes.every((l: { effet: { type: string } }) => l.effet.type === 'texte'), 'choisir remet un texte dans le champ');
  const plusieurs = analyser('Relancer');
  assert.equal(plusieurs.genre, 'question');
  assert.deepEqual(plusieurs.lignes.map((l: { titre: string }) => l.titre).sort(), ['Garage Vasseur', 'Studio Verlaine']);
  const un = analyser('Relancer', { factures: [facture('x', 'T-1', 14, '2026-03-01', 1000)] });
  assert.equal(un.genre, 'proposition');
  const aucune = analyser('Relancer', { factures: [] });
  assert.equal(lire_(aucune), 'Aucune facture n’est en retard : il n’y a rien à relancer.');
});

await dit('relancer : sans client cité, la fiche ouverte à l’écran fait foi (facture ou client)', () => {
  const surFacture = analyser('Relancer', {}, { focus: { type: 'facture', id: 'f-3', label: 'T-0099' } });
  assert.match(lire_(surFacture), /\*\*T-0099\*\*/);
  const surClient = analyser('Relancer', {}, { focus: { type: 'client', id: 'c-14', label: 'Paul Orsini' } });
  assert.equal(surClient.genre, 'rien-trouve', 'ce client n’a rien en retard');
});

await dit('factures en retard (N0) : la liste du client, trois lignes au plus, chacune mène à la facture', () => {
  const r = analyser('les factures en retard de Verlaine');
  assert.equal(r.intention, 'factures-retard');
  assert.equal(r.niveau, 'N0');
  assert.equal(r.lignes.length, 2);
  assert.ok(r.lignes.every((l: { effet: { type: string; route?: string } }) => l.effet.type === 'aller' && l.effet.route === '/facturation'));
  assert.match(nb(lire_(r)), /2 factures de Studio Verlaine sont en retard, \*\*2 440,50 €\*\* au total/);
  const toutes = analyser('factures en retard');
  assert.ok(toutes.lignes.length <= 3);
  assert.equal(toutes.lignes[0].titre, 'T-0099', 'la plus ancienne d’abord');
});

await dit('créer une facture (N1) : demande le client, puis les lignes, puis récapitule avec « Créer le brouillon »', () => {
  const sansClient = analyser('Créer une facture');
  assert.equal(sansClient.genre, 'question');
  assert.equal(sansClient.niveau, 'N0', 'une question n’engage rien : le N1 commence avec le brouillon à confirmer');
  assert.ok(sansClient.lignes.length >= 3);
  const sansLignes = analyser('Créer une facture pour Cabinet Orsini');
  assert.equal(sansLignes.genre, 'question');
  assert.match(lire_(sansLignes), /Que voulez-vous facturer à \*\*Cabinet Orsini\*\*/);
  assert.equal(sansLignes.lignes[0].effet.texte, 'Créer une facture pour Cabinet Orsini sans lignes');
  const recap = analyser('Créer une facture pour Cabinet Orsini : 2 jours de conseil à 400 €, 3 heures de formation à 90 €');
  assert.equal(recap.genre, 'brouillon');
  assert.equal(recap.niveau, 'N1');
  assert.match(lire_(recap), /2 lignes, \*\*1\s?070\s?€\*\* hors taxes/);
  assert.equal(recap.details.length, 2);
  const creer = recap.boutons.find((b: { role: string }) => b.role === 'primaire');
  assert.equal(fr(creer.cle), 'Créer le brouillon');
  assert.equal(creer.effet.type, 'creer-brouillon-facture');
  assert.equal(creer.effet.clientId, 14);
  assert.deepEqual(creer.effet.lignes, [
    { label: 'Conseil', quantite: 2, prixCentimes: 40000 },
    { label: 'Formation', quantite: 3, prixCentimes: 9000 },
  ]);
  assert.deepEqual(recap.boutons.map((b: { cle: string }) => fr(b.cle)), ['Créer le brouillon', 'Modifier', 'Annuler']);
  const vide = analyser('Créer une facture pour Cabinet Orsini sans lignes');
  assert.equal(vide.genre, 'brouillon');
  assert.equal(vide.boutons[0].effet.lignes.length, 0);
});

await dit('trouver (N0) : modules, clients et documents, trois par groupe au plus, « Voir tous les résultats » ouvre la recherche', () => {
  const r = analyser('Trouver Vasseur');
  assert.equal(r.genre, 'resultats');
  assert.equal(r.niveau, 'N0');
  const parGroupe = (g: string) => r.lignes.filter((l: { groupe?: string }) => l.groupe === g).length;
  assert.equal(parGroupe('clients'), 2);
  const beaucoup = analyser('Trouver dossier', { clients: Array.from({ length: 9 }, (_, i) => ({ id: 100 + i, nom: `Dossier numéro ${i}`, societe: `Dossier ${i}` })) });
  assert.equal(beaucoup.lignes.filter((l: { groupe?: string }) => l.groupe === 'clients').length, 3, 'neuf clients correspondent, trois seulement sont montrés');
  const modulesCle = analyser('trouver facture');
  assert.ok(modulesCle.lignes.some((l: { titre: string }) => l.titre === 'Facturation'));
  const tous = r.boutons.find((b: { role: string }) => b.role === 'primaire');
  assert.equal(fr(tous.cle), 'Voir tous les résultats');
  assert.equal(tous.effet.type, 'rechercher');
  for (const g of ['modules', 'clients', 'documents']) assert.ok(r.lignes.filter((l: { groupe?: string }) => l.groupe === g).length <= I.MAX_PAR_GROUPE);
  const rien = analyser('Trouver Zéphyrine');
  assert.equal(rien.genre, 'rien-trouve');
  assert.equal(rien.lignes[0].id, 'trouver');
  const quoi = analyser('Trouver');
  assert.equal(quoi.genre, 'question');
  assert.equal(analyser('Trouver relances').intention, 'trouver', 'un verbe de recherche en tête dit ce qu’on veut');
  assert.equal(analyser('relances').intention, 'trouver', 'le nom d’un module seul l’ouvre');
  assert.equal(analyser('Relancer').intention, 'relancer', 'mais un verbe seul lance l’intention');
});

await dit('résumer (N0) : cinq lignes au plus, chacune avec son lien ; les messages sont délégués (pas de lecture d’ici)', () => {
  const attentes = Array.from({ length: 8 }, (_, i) => ({ cle: `a-${i}`, titre: `Point ${i}`, route: `/ailleurs/${i}` }));
  const r = analyser('Résumer ma journée', { attentes, rendezVousAujourdhui: 3 });
  assert.equal(r.niveau, 'N0');
  assert.ok(r.lignes.length <= 5 && r.lignes.length >= 4);
  assert.ok(r.lignes.every((l: { effet: { type: string; route?: string } }) => l.effet.type === 'aller' && l.effet.route));
  assert.equal(nb(r.lignes[0].titre), '3 factures en retard, 3 439,50 €');
  const vide = analyser('Résumer', { factures: [], attentes: [], rendezVousAujourdhui: 0 });
  assert.equal(lire_(vide), 'Rien à signaler pour le moment.');
  const messages = analyser('Résumer mes messages non lus');
  assert.equal(messages.boutons[0].effet.type, 'demander');
  assert.match(lire_(messages), /Je ne peux pas lire vos messages d’ici/);
});

await dit('point à la Garde (N0) : une phrase, une pastille d’état, « Ouvrir La Garde » ; droits et faits manquants', () => {
  for (const [etat, points, pastille] of [['calme', 0, 'succes'], ['attention', 3, 'attention'], ['critique', 1, 'critique']] as const) {
    const r = analyser('Demander un point à la Garde', { garde: { etat, points } });
    assert.equal(r.niveau, 'N0');
    assert.equal(r.pastille.etat, pastille);
    assert.equal(fr(r.boutons[0].cle), 'Ouvrir La Garde');
    assert.equal(r.boutons[0].effet.route, '/garde');
  }
  assert.match(lire_(analyser('point Garde', { garde: { etat: 'attention', points: 3 } })), /\*\*3\*\* points demandent un regard/);
  const inconnu = analyser('Demander un point à la Garde', { garde: null });
  assert.equal(inconnu.pastille.etat, 'neutre');
  assert.equal(lire_(inconnu), 'Je n’ai pas pu lire l’état de la supervision.');
  const droits = analyser('Demander un point à la Garde', {}, { admin: false });
  assert.equal(droits.genre, 'droits');
  assert.equal(droits.boutons.length, 1, 'pas de bouton d’action : seulement « Annuler »');
  assert.equal(droits.boutons[0].role, 'annuler');
});

await dit('rédiger : jamais de texte inventé ici — la demande est confiée à l’assistant', () => {
  const r = analyser('Rédiger un compte rendu');
  assert.equal(r.boutons[0].effet.type, 'demander');
  assert.equal(r.boutons[0].effet.texte, 'Rédiger un compte rendu');
  assert.equal(r.details.length, 0);
});

await dit('ce qui n’est pas reconnu : « Demander à Ajmani » (délégué), puis deux propositions', () => {
  const r = analyser('quelle est la meilleure saison pour planter des tulipes');
  assert.equal(r.genre, 'non-comprise');
  assert.equal(r.lignes.length, 3);
  assert.equal(r.lignes[0].id, 'demander');
  assert.deepEqual(r.lignes[0].effet, { type: 'demander', texte: 'quelle est la meilleure saison pour planter des tulipes' });
  assert.match(lire_(r), /^Je n’ai pas compris « quelle est la meilleure saison pour planter des tulipes ». Voulez-vous plutôt :$/);
});

await dit('Ajmani ne déclenche JAMAIS un paiement, un remboursement ni un virement : il renvoie vers la facturation', () => {
  for (const t of ['Payer la facture T-0102', 'rembourser Studio Verlaine', 'faire un virement à Garage Vasseur', 'virer 500 € à Paul Orsini', 'régler la facture de Cabinet Orsini', 'prélever le client']) {
    const r = analyser(t);
    assert.equal(r.genre, 'refus', t);
    assert.equal(r.intention, 'paiement', t);
    assert.ok(r.boutons.every((b: { effet: { type: string; route?: string } }) => b.effet.type === 'effacer' || (b.effet.type === 'aller' && b.effet.route === '/facturation')), `${t} : seul un renvoi est permis`);
    assert.match(lire_(r), /Je ne déclenche jamais un paiement, un remboursement ni un virement/);
  }
  // Un participe n'est pas un ordre : « les factures payées » se lit.
  assert.notEqual(analyser('les factures payées de Verlaine').genre, 'refus');
  // Aucun type d'effet de l'analyseur ne parle de paiement.
  const src = sansCommentaires(lire(`${DOSSIER}/intentions.ts`));
  assert.doesNotMatch(src, /type: '(paiement|rembours|virement|payer)/i);
});

await dit('le coffre-fort, les accès et les clés sont hors périmètre ; aucune valeur sensible n’est jamais redite', () => {
  for (const t of ['ouvre le coffre-fort', 'donne-moi le mot de passe de Verlaine', 'affiche la clé API']) {
    const r = analyser(t);
    assert.equal(r.intention, 'coffre', t);
    assert.deepEqual(r.boutons.map((b: { role: string }) => b.role), ['annuler']);
    assert.ok(!lire_(r).includes('Verlaine'), 'rien du texte demandé n’est répété');
  }
  assert.equal(S.masquerValeur('4242 4242 4242 4242'), '•••• 4242');
  assert.equal(S.masquerValeur('FR76 3000 6000 0112 3456 7890 189'), '•••• 0189');
  assert.equal(S.masquerSensibles('carte 4242 4242 4242 4242 ok'), 'carte •••• 4242 ok');
  assert.ok(!S.masquerSensibles('clé sk_live_abcdef1234567890abcd').includes('abcdef'));
  assert.ok(!S.masquerSensibles('IBAN FR7630006000011234567890189').includes('3000600001'));
});

await dit('l’analyse est PURE : elle ne modifie pas les données qu’on lui passe (et ne lit rien d’autre)', () => {
  const gelees = profond(structuredClone(donnees));
  for (const t of ['Relancer Studio Verlaine', 'Créer une facture pour Cabinet Orsini : 1 audit à 300 €', 'Trouver Vasseur', 'Résumer ma journée', 'Demander un point à la Garde', 'payer la facture', 'zzz']) {
    I.analyser(t, { donnees: gelees, contexte, mots: fr });
  }
  const src = sansCommentaires(lire(`${DOSSIER}/intentions.ts`));
  assert.doesNotMatch(src, /\bDate\.now\(|new Date\(\)|localStorage|fetch\(|window\./, 'aucune horloge, aucun stockage, aucun réseau dans l’analyseur');
  assert.doesNotMatch(src, /from 'react'/, 'sans React');
});

await dit('l’état de repos : « Ajmani propose » (le plus utile), sinon « Récent », sinon « Suggéré ici »', () => {
  const histo = [{ texte: 'Trouver Vasseur', le: 1 }, { texte: 'Résumer ma journée', le: 0 }];
  const e = (surcharge: Partial<typeof donnees>, historique = histo) => I.etatDeRepos({ donnees: { ...donnees, ...surcharge }, contexte, historique, mots: fr });
  const attente = e({ attentes: [{ cle: 'a', titre: 'Un devis attend', route: '/clients' }] });
  assert.equal(attente.section, 'section.propose');
  assert.match(lire_(attente), /\*\*Un devis attend\*\*/);
  const retard = e({ factures: [facture('x', 'T-1', 14, '2026-03-01', 1000)] });
  assert.equal(retard.section, 'section.propose');
  const recent = e({ factures: [] });
  assert.equal(recent.section, 'section.recent');
  assert.deepEqual(recent.lignes.map((l: { titre: string }) => l.titre), ['Trouver Vasseur', 'Résumer ma journée']);
  assert.ok(recent.lignes.every((l: { effet: { type: string } }) => l.effet.type === 'texte'), 'une demande récente se remet dans le champ, elle ne se ré-exécute pas');
  const suggere = e({ factures: [] }, []);
  assert.equal(suggere.section, 'section.suggere');
  assert.ok(suggere.lignes.length > 0 && suggere.lignes.length <= 3);
});

/* ═══ 2. La règle d'or et le bouton précis ═══ */

const CORPUS = [
  'Relancer Studio Verlaine', 'Relancer Vasseur', 'Relancer', 'Relancer Garage Vasseur', 'Créer une facture', 'Créer une facture pour Cabinet Orsini',
  'Créer une facture pour Cabinet Orsini : 2 jours de conseil à 400 €', 'les factures en retard de Verlaine', 'Trouver Vasseur', 'Trouver', 'Résumer ma journée',
  'Résumer mes messages non lus', 'Demander un point à la Garde', 'Rédiger un compte rendu', 'Rédiger une annonce', 'Payer la facture', 'ouvre le coffre-fort', 'blabla', 'facturation', 'Relancer Zéphyr',
];

await dit('règle d’or : Entrée dans le champ n’exécute JAMAIS un N1, N2 ou N3 ; seul le bouton primaire le peut', () => {
  for (const niveau of ['N1', 'N2', 'N3']) {
    assert.equal(N.peutExecuter(niveau, 'champ-entree'), false, `${niveau} par Entrée dans le champ`);
    assert.equal(N.peutExecuter(niveau, 'ligne-entree'), false, `${niveau} par une ligne`);
    assert.equal(N.peutExecuter(niveau, 'ligne-clic'), false);
    assert.equal(N.peutExecuter(niveau, 'bouton-clic'), true);
    assert.equal(N.peutExecuter(niveau, 'bouton-entree'), true);
    assert.equal(N.demandeConfirmation(niveau), true);
  }
  assert.equal(N.demandeConfirmation('N0'), false);
  assert.equal(N.peutExecuter('N0', 'champ-entree'), true, 'une lecture se fait tout de suite');
  // Dans la palette, Entrée dans le champ ne fait que demander une proposition : jamais d'appel à `executer` depuis le champ.
  const src = sansCommentaires(lire(`${DOSSIER}/PaletteAjmaniRefonte.tsx`));
  const entree = /case 'Enter':([\s\S]*?)default:/.exec(src)?.[1] ?? '';
  assert.match(entree, /lancer\(texte\.trim\(\)\)/, 'Entrée dans le champ prépare une proposition');
  assert.doesNotMatch(entree.split('if (cible && cible.zone')[1] ?? '', /executer\(/, 'et n’exécute rien');
  assert.match(src, /if \(!peutExecuter\(niveau, origine\)\) return;/, 'chaque exécution passe par la règle d’or');
});

await dit('chaque proposition N1–N3 a UN bouton primaire au verbe précis (jamais « OK » ni « Valider »), puis « Modifier » et « Annuler »', () => {
  for (const t of CORPUS) {
    const r = analyser(t);
    const primaires = r.boutons.filter((b: { role: string }) => b.role === 'primaire');
    assert.ok(primaires.length <= 1, `${t} : ${primaires.length} primaires`);
    for (const b of primaires) assert.ok(N.estLibelleBoutonPrecis(fr(b.cle)), `${t} : « ${fr(b.cle)} » n'est pas un verbe précis`);
    if (r.niveau !== 'N0') {
      assert.equal(primaires.length, 1, `${t} : une proposition N1+ a son bouton primaire`);
      if (r.genre === 'proposition' || r.genre === 'brouillon') assert.deepEqual(r.boutons.map((b: { role: string }) => b.role), ['primaire', 'secondaire', 'annuler'], t);
    }
    if (r.genre !== 'refus' && r.genre !== 'droits' && r.boutons.length > 0) assert.equal(r.boutons[r.boutons.length - 1].role, 'annuler', `${t} : « Annuler » en dernier`);
  }
  for (const faux of ['OK', 'Valider', 'Confirmer', 'Continuer', 'Oui', 'Valider la demande', 'Accepter']) assert.equal(N.estLibelleBoutonPrecis(faux), false, faux);
  for (const vrai of ['Préparer la relance', 'Créer le brouillon', 'Archiver 4 messages', 'Envoyer la relance']) assert.equal(N.estLibelleBoutonPrecis(vrai), true, vrai);
});

await dit('niveaux : N0 lecture · N1 brouillon (annuler 10 s) · N2 avant/après · N3 aperçu et délai de 10 s ; hors ligne, seule la lecture', () => {
  assert.deepEqual([...N.NIVEAUX], ['N0', 'N1', 'N2', 'N3']);
  assert.equal(N.DELAI_ANNULATION_MS, 10_000);
  assert.deepEqual(
    ['N0', 'N1', 'N2', 'N3'].map((n) => [N.regleDe(n).annulation, N.regleDe(n).delaiMs]),
    [['aucun', 0], ['defaire', 10_000], ['aucun', 0], ['retenir', 10_000]],
  );
  assert.equal(N.regleDe('N2').avantApres, true);
  assert.equal(N.regleDe('N3').apercuComplet, true);
  assert.deepEqual(['N0', 'N1', 'N2', 'N3'].map((n) => N.permisHorsLigne(n)), [true, false, false, false]);
});

/* ═══ 3. Le délai d'annulation ═══ */

function horlogeALaMain() {
  let t = 0;
  const taches: Array<{ a: number; fn: () => void; vivant: boolean }> = [];
  return {
    horloge: {
      maintenant: () => t,
      planifier: (fn: () => void, ms: number) => {
        const tache = { a: t + ms, fn, vivant: true };
        taches.push(tache);
        return () => { tache.vivant = false; };
      },
    },
    avancer(ms: number) {
      const but = t + ms;
      for (;;) {
        const prochaine = taches.filter((x) => x.vivant && x.a <= but).sort((x, y) => x.a - y.a)[0];
        if (!prochaine) break;
        t = prochaine.a;
        prochaine.vivant = false;
        prochaine.fn();
      }
      t = but;
    },
  };
}

await dit('délai d’annulation : « Envoi dans 10 s · Annuler » — annuler avant la fin empêche l’envoi, après la fin ne défait plus rien', () => {
  // Annulé à 4 s : rien ne part, jamais.
  const h1 = horlogeALaMain();
  const tics: number[] = [];
  const evt: string[] = [];
  const d1 = new N.DelaiAnnulation({ horloge: h1.horloge, surTic: (s: number) => tics.push(s), surEcoulement: () => evt.push('envoi'), surAnnulation: () => evt.push('annule') });
  d1.demarrer();
  assert.equal(d1.secondes, 10);
  assert.equal(fr('delai.envoi', { n: d1.secondes }), 'Envoi dans 10 s');
  h1.avancer(4000);
  assert.equal(d1.secondes, 6);
  assert.equal(d1.annuler(), true);
  h1.avancer(60_000);
  assert.deepEqual(evt, ['annule'], 'l’envoi n’a JAMAIS eu lieu');
  assert.equal(d1.etat, 'annule');
  assert.equal(d1.annuler(), false, 'on n’annule qu’une fois');
  assert.deepEqual(tics.slice(0, 5), [10, 9, 8, 7, 6]);
  // Laissé courir : l'envoi part une fois, à 10 s, et plus rien ne s'annule.
  const h2 = horlogeALaMain();
  const evt2: string[] = [];
  const d2 = new N.DelaiAnnulation({ horloge: h2.horloge, surEcoulement: () => evt2.push('envoi'), surAnnulation: () => evt2.push('annule') });
  d2.demarrer();
  h2.avancer(9_999);
  assert.deepEqual(evt2, []);
  h2.avancer(1);
  assert.deepEqual(evt2, ['envoi']);
  assert.equal(d2.etat, 'ecoule');
  assert.equal(d2.annuler(), false, 'passé le terme, c’est trop tard');
  assert.deepEqual(evt2, ['envoi']);
  // Une annulation à 9,9 s tient encore.
  const h3 = horlogeALaMain();
  const evt3: string[] = [];
  const d3 = new N.DelaiAnnulation({ horloge: h3.horloge, surEcoulement: () => evt3.push('envoi') });
  d3.demarrer();
  h3.avancer(9_900);
  assert.equal(d3.annuler(), true);
  h3.avancer(1000);
  assert.deepEqual(evt3, []);
  assert.equal(N.secondesRestantes(9_001), 10);
  assert.equal(N.secondesRestantes(0), 0);
});

/* ═══ 4. L'historique et le journal ═══ */

function stockageEnMemoire() {
  const t = new Map<string, string>();
  return { getItem: (k: string) => t.get(k) ?? null, setItem: (k: string, v: string) => void t.set(k, v), removeItem: (k: string) => void t.delete(k), t };
}
const JOUR = 86_400_000;
const T0 = Date.UTC(2026, 2, 18, 9, 0, 0);

await dit('historique : 5 demandes au plus, la plus récente d’abord, une demande répétée remonte, 30 jours, propre à chaque compte', () => {
  const s = stockageEnMemoire();
  for (let i = 0; i < 7; i += 1) H.ajouterDemande('a@exemple.test', `Demande numéro ${i}`, T0 + i * 1000, s);
  const lu = H.lireHistorique('a@exemple.test', T0 + 10_000, s);
  assert.equal(lu.length, 5);
  assert.deepEqual(lu.map((d: { texte: string }) => d.texte), ['Demande numéro 6', 'Demande numéro 5', 'Demande numéro 4', 'Demande numéro 3', 'Demande numéro 2']);
  H.ajouterDemande('a@exemple.test', 'demande numéro 3', T0 + 20_000, s);
  assert.equal(H.lireHistorique('a@exemple.test', T0 + 30_000, s)[0].texte.toLowerCase(), 'demande numéro 3');
  assert.equal(H.lireHistorique('a@exemple.test', T0 + 30_000, s).length, 5, 'pas de doublon');
  assert.deepEqual(H.lireHistorique('b@exemple.test', T0, s), [], 'un autre compte ne voit rien');
  assert.equal(H.cleHistorique('A@Exemple.test'), 'amn.ajmani.palette.historique.a@exemple.test');
  assert.equal(H.MAX_DEMANDES, 5);
  assert.equal(H.DUREE_HISTORIQUE_MS, 30 * JOUR);
});

await dit('historique : ce qui a plus de 30 jours est oublié ; « Effacer l’historique » efface tout', () => {
  const s = stockageEnMemoire();
  H.ajouterDemande('a@exemple.test', 'Une vieille demande', T0, s);
  H.ajouterDemande('a@exemple.test', 'Une demande récente', T0 + 29 * JOUR, s);
  assert.deepEqual(H.lireHistorique('a@exemple.test', T0 + 29 * JOUR + 1000, s).map((d: { texte: string }) => d.texte), ['Une demande récente', 'Une vieille demande']);
  assert.deepEqual(H.lireHistorique('a@exemple.test', T0 + 31 * JOUR, s).map((d: { texte: string }) => d.texte), ['Une demande récente']);
  H.effacerHistorique('a@exemple.test', s);
  assert.deepEqual(H.lireHistorique('a@exemple.test', T0 + 29 * JOUR, s), []);
  assert.equal(s.t.size, 0);
  // Un stockage qui refuse ne casse rien.
  const refuse = { getItem: () => { throw new Error('non'); }, setItem: () => { throw new Error('non'); }, removeItem: () => { throw new Error('non'); } };
  assert.doesNotThrow(() => H.ajouterDemande('a@exemple.test', 'Demande', T0, refuse));
  assert.deepEqual(H.lireHistorique('a@exemple.test', T0, refuse), []);
  H.effacerHistorique('a@exemple.test', refuse);
  // Un contenu abîmé non plus.
  s.setItem(H.cleHistorique('a@exemple.test'), '{pas du json');
  assert.deepEqual(H.lireHistorique('a@exemple.test', T0, s), []);
});

await dit('historique : jamais un secret ni un contenu de message (texte seul, masqué, trop long écarté)', () => {
  const s = stockageEnMemoire();
  H.ajouterDemande('a@exemple.test', 'Mon mot de passe est hunter2', T0, s);
  H.ajouterDemande('a@exemple.test', 'la clé sk_live_abcdef1234567890abcd', T0 + 1, s);
  H.ajouterDemande('a@exemple.test', 'Rembourser la carte 4242 4242 4242 4242', T0 + 2, s);
  H.ajouterDemande('a@exemple.test', `Bonjour, voici le message complet que je colle ici. ${'texte '.repeat(40)}`, T0 + 3, s);
  H.ajouterDemande('a@exemple.test', '   ', T0 + 4, s);
  const brut = JSON.stringify([...s.t.values()]);
  assert.ok(!/hunter2|abcdef|4242 4242|message complet/.test(brut), brut);
  assert.deepEqual(H.lireHistorique('a@exemple.test', T0 + 10, s).map((d: { texte: string }) => d.texte), ['Rembourser la carte •••• 4242', 'la clé ••••'], 'la valeur sensible est masquée, jamais écrite');
});

await dit('historique : ↑ dans un champ vide rappelle la précédente (puis les plus anciennes) ; le texte non envoyé reste 30 s', () => {
  const histo = [{ texte: 'récente', le: 3 }, { texte: 'milieu', le: 2 }, { texte: 'ancienne', le: 1 }];
  assert.deepEqual(H.demandePrecedente(histo, null), { texte: 'récente', position: 0 });
  assert.deepEqual(H.demandePrecedente(histo, 0), { texte: 'milieu', position: 1 });
  assert.deepEqual(H.demandePrecedente(histo, 2), { texte: 'ancienne', position: 2 }, 'on s’arrête sur la plus ancienne');
  assert.equal(H.demandePrecedente([], null), null);
  H.garderTexte('Relancer Garage Vasseur', T0);
  assert.equal(H.reprendreTexte(T0 + 29_000), 'Relancer Garage Vasseur');
  assert.equal(H.reprendreTexte(T0 + 30_001), '', 'passé 30 s, il est oublié');
  H.garderTexte('', T0);
  assert.equal(H.reprendreTexte(T0 + 1), '');
  H.oublierTexte();
  // Le texte gardé n'est JAMAIS écrit sur disque : seule la mémoire du module le porte.
  const src = sansCommentaires(lire(`${DOSSIER}/historique.ts`));
  const garder = /export function garderTexte[\s\S]*?\n}/.exec(src)?.[0] ?? '';
  assert.doesNotMatch(garder, /setItem|localStorage/);
});

await dit('journal : qui, la phrase demandée, ce qui a été fait, quand, le résultat — 200 au plus, sans secret ni message', () => {
  const s = stockageEnMemoire();
  const e = J.noterAction('a@exemple.test', { demande: 'Relancer Studio Verlaine', fait: 'Relance de T-0102 ouverte', niveau: 'N1', resultat: 'reussi' }, T0, s);
  assert.deepEqual({ ...e, id: 'x' }, { id: 'x', qui: 'a@exemple.test', demande: 'Relancer Studio Verlaine', fait: 'Relance de T-0102 ouverte', niveau: 'N1', le: T0, resultat: 'reussi' });
  for (let i = 0; i < 230; i += 1) J.noterAction('a@exemple.test', { demande: `Demande ${i}`, fait: `Fait ${i}`, niveau: 'N0', resultat: 'reussi' }, T0 + 1 + i, s);
  const lu = J.lireJournal('a@exemple.test', s);
  assert.equal(lu.length, J.MAX_JOURNAL);
  assert.equal(J.MAX_JOURNAL, 200);
  assert.equal(lu[0].demande, 'Demande 229', 'la plus récente en tête');
  assert.deepEqual(J.lireJournal('b@exemple.test', s), [], 'propre à chaque compte');
  assert.equal(J.cleJournal('A@exemple.test'), 'amn.ajmani.palette.journal.a@exemple.test');
  // Annuler à temps : la trace dit « annulé », elle n'est pas effacée.
  const t = J.noterAction('c@exemple.test', { demande: 'Créer une facture pour Cabinet Orsini', fait: 'Brouillon créé', niveau: 'N1', resultat: 'reussi' }, T0, s);
  J.corrigerResultat('c@exemple.test', t.id, 'annule', s);
  assert.equal(J.lireJournal('c@exemple.test', s)[0].resultat, 'annule');
  // Aucun secret.
  J.noterAction('d@exemple.test', { demande: 'mon mot de passe est hunter2', fait: 'sk_live_abcdef1234567890abcd', niveau: 'N0', resultat: 'echec' }, T0, s);
  J.noterAction('d@exemple.test', { demande: 'Rembourser la carte 4242 4242 4242 4242', fait: 'IBAN FR7630006000011234567890189', niveau: 'N0', resultat: 'echec' }, T0 + 1, s);
  const brut = [...s.t.entries()].filter(([k]) => k.endsWith('d@exemple.test')).map(([, v]) => v).join('');
  assert.ok(!/hunter2|abcdef|4242 4242|3000600001/.test(brut), brut);
  assert.ok(brut.includes(J.DEMANDE_MASQUEE));
  assert.equal(typeof J.lireJournal, 'function');
});

/* ═══ 5. Lignes « Ou lancez », clavier, états ═══ */

const FAMILLES = [null, 'jour', 'contacts', 'ecrire', 'argent', 'echanger', 'creer', 'outils', 'garde'];

await dit('« Ou lancez » : toujours quatre lignes, sans doublon, deux selon l’écran puis deux selon l’usage ; les mots tapés réordonnent sans vider', () => {
  const libelle = (cle: string) => fr(cle);
  for (const famille of FAMILLES) {
    for (const usage of [{}, { relancer: 9, resumer: 4 }, { 'creer-facture': 5, garde: 2, 'compte-rendu': 1 }]) {
      for (const texte of ['', 'fact', 'zzzz', 'relancer facture']) {
        const l = L.lignesLancer({ famille, usage, texte, libelle });
        assert.equal(l.length, 4, `${famille} ${JSON.stringify(usage)} « ${texte} »`);
        assert.equal(new Set(l.map((x: { id: string }) => x.id)).size, 4);
        if (!texte) assert.deepEqual(l.slice(0, 2).map((x: { id: string }) => x.id), [...L.SELON_LA_FAMILLE[famille ?? 'defaut']], `${famille} : les deux premières selon l'écran`);
      }
    }
  }
  assert.deepEqual(L.lignesLancer({ famille: 'jour', usage: { relancer: 9, resumer: 4 } }).slice(2).map((x: { id: string }) => x.id), ['relancer', 'resumer'], 'les deux dernières : les plus utilisées');
  assert.equal(L.lignesLancer({ famille: 'jour', usage: {}, texte: 'relanc', libelle })[0].id, 'relancer', 'une ligne qui répond remonte');
  // Les quatre lignes par défaut sont celles de la fiche, dans l'ordre.
  const defaut = L.lignesLancer({ famille: 'jour', usage: {} });
  assert.deepEqual(defaut.map((x: { titre: string }) => fr(x.titre)), ['Créer une facture', 'Trouver un module ou un client', 'Demander un point à la Garde', 'Rédiger un compte rendu']);
  assert.deepEqual(defaut.map((x: { sous: string }) => fr(x.sous)), ['Pour un client existant', 'Recherche dans tout l’espace', 'État de la supervision', 'À partir de vos notes']);
  // Échanger : les invites de la fiche, sans nom propre.
  assert.deepEqual(L.lignesLancer({ famille: 'echanger', usage: {} }).slice(0, 2).map((x: { titre: string }) => fr(x.titre)), ['Résumer mes messages non lus', 'Rédiger une annonce']);
  assert.ok(L.lignesLancer({ famille: 'jour', usage: {} }).find((x: { id: string }) => x.id === 'garde').reservee, 'La Garde est réservée aux administrateurs');
  assert.equal(L.NOMBRE_LIGNES, 4);
});

await dit('clavier : ↓ champ → lignes de la réponse → boutons → « Ou lancez » ; ↑ remonte ; ← → entre boutons ; une ligne désactivée est sautée', () => {
  const cibles = [
    { zone: 'reponse', id: 'r1' }, { zone: 'bouton', id: 'b1' }, { zone: 'bouton', id: 'b2' }, { zone: 'bouton', id: 'b3' },
    { zone: 'lancer', id: 'l1' }, { zone: 'lancer', id: 'l2', desactivee: true }, { zone: 'lancer', id: 'l3' },
  ];
  assert.equal(V.CHAMP, -1);
  const suite = (depart: number, touches: string[]) => touches.reduce((i, d) => V.deplacer(cibles, i, d), depart);
  assert.equal(suite(-1, ['bas']), 0);
  assert.equal(suite(-1, ['bas', 'bas']), 1);
  assert.equal(suite(1, ['droite']), 2);
  assert.equal(suite(3, ['droite']), 3, 'on reste sur le dernier bouton');
  assert.equal(suite(2, ['gauche', 'gauche']), 1);
  assert.equal(suite(1, ['gauche']), 1);
  assert.equal(suite(0, ['droite']), 0, '← → ne servent qu’entre boutons');
  assert.equal(suite(3, ['bas']), 4);
  assert.equal(suite(4, ['bas']), 6, 'la ligne désactivée est sautée');
  assert.equal(suite(6, ['haut']), 4);
  assert.equal(suite(6, ['bas']), -1, 'après la dernière, on revient au champ : Tab ne sort pas de la palette');
  assert.equal(suite(-1, ['haut']), 6);
  assert.equal(suite(0, ['haut']), -1);
  // « Effacer l'historique » est un arrêt du parcours, entre les lignes de la réponse et les boutons.
  const avecLien = [{ zone: 'reponse', id: 'r1' }, { zone: 'lien', id: 'effacer-historique' }, { zone: 'bouton', id: 'b1' }];
  assert.equal(V.deplacer(avecLien, 0, 'bas'), 1);
  assert.equal(V.deplacer(avecLien, 1, 'bas'), 2);
  assert.equal(V.deplacer(avecLien, 1, 'droite'), 1, '← → ne servent qu’entre boutons');
  assert.equal(V.indiceValide(cibles, 5), -1);
  assert.equal(V.indiceValide(cibles, 12), -1);
  assert.equal(V.indiceValide([], 0), -1);
  // Sans cible : on reste dans le champ.
  assert.equal(V.deplacer([], -1, 'bas'), -1);
  assert.equal(V.deplacer([], -1, 'haut'), -1);
});

await dit('états et délais : 250 ms avant la proposition, squelette après 150 ms et 400 ms au moins, 160 ms / 120 ms, Échap annule d’abord la requête', () => {
  assert.equal(E.DELAI_PROPOSITION_MS, 250);
  assert.equal(E.DELAI_SQUELETTE_MS, 150);
  assert.equal(E.DUREE_MIN_SQUELETTE_MS, 400);
  assert.equal(E.DUREE_OUVERTURE_MS, 160);
  assert.equal(E.DUREE_FERMETURE_MS, 120);
  assert.equal(E.decisionEchap(true), 'annuler-requete');
  assert.equal(E.decisionEchap(false), 'fermer');
  assert.equal(E.attenteAvantReponse(null, 1000), 0, 'jamais montré : pas d’attente');
  assert.equal(E.attenteAvantReponse(1000, 1100), 300);
  assert.equal(E.attenteAvantReponse(1000, 1500), 0);
  const r = (genre: string) => ({ genre });
  assert.equal(E.etatAffiche({ texte: '', reponse: null, enCours: false, erreur: false }), 'repos');
  assert.equal(E.etatAffiche({ texte: 'x', reponse: r('proposition'), enCours: false, erreur: false }), 'saisie');
  assert.equal(E.etatAffiche({ texte: 'x', reponse: r('proposition'), enCours: true, erreur: false }), 'reflexion');
  assert.equal(E.etatAffiche({ texte: 'x', reponse: null, enCours: false, erreur: true }), 'erreur');
  for (const g of ['rien-trouve', 'non-comprise', 'deja-fait', 'refus', 'droits']) assert.equal(E.etatAffiche({ texte: 'x', reponse: r(g), enCours: false, erreur: false }), g);
  // Le champ vide retombe toujours au repos, même si une réponse traîne.
  assert.equal(E.etatAffiche({ texte: '  ', reponse: r('proposition'), enCours: false, erreur: false }), 'repos');
  const src = sansCommentaires(lire(`${DOSSIER}/PaletteAjmaniRefonte.tsx`));
  assert.match(src, /decisionEchap\(pilote\.current\.enCours\) === 'annuler-requete'/, 'Échap passe par la décision (annuler, puis fermer)');
  assert.match(src, /DELAI_PROPOSITION_MS/);
  assert.match(src, /DELAI_SQUELETTE_MS/);
});

/* ═══ 6. Le rendu statique ═══ */

const propsDe = (surcharge: Record<string, unknown> = {}, ctx: Record<string, unknown> = {}, don: Partial<typeof donnees> = {}) => ({
  ouverte: true,
  onFermer: () => undefined,
  contexte: { ...contexte, ...ctx },
  donnees: { ...donnees, ...don },
  surDemander: () => undefined,
  surAllerA: () => undefined,
  surOuvrirRecherche: () => undefined,
  sortie: false,
  champ: { current: null },
  pilote: { current: { enCours: false, annuler: () => undefined } },
  ...surcharge,
});
const rendre = (surcharge: Record<string, unknown> = {}, ctx: Record<string, unknown> = {}, don: Partial<typeof donnees> = {}): string => renderToStaticMarkup(h(ContenuPalette, propsDe(surcharge, ctx, don)));
const compter = (html: string, re: RegExp): number => (html.match(re) ?? []).length;

await dit('rendu : dialogue nommé « Ajmani », combobox, deux listbox, des options, aria-activedescendant seulement sur une ligne choisie', () => {
  const html = rendre();
  matche(html, /role="dialog"[^>]*aria-modal="true"[^>]*aria-label="Ajmani"|aria-label="Ajmani"[^>]*role="dialog"/);
  matche(html, /<input[^>]*role="combobox"/);
  matche(html, /<input[^>]*aria-expanded="true"/);
  matche(html, /<input[^>]*aria-controls="[^"]+ [^"]+"/);
  assert.equal(compter(html, /role="listbox"/g), 2);
  assert.ok(compter(html, /role="option"/g) >= 4);
  assert.doesNotMatch(html, /aria-activedescendant/, 'aucune ligne choisie : le champ garde le focus');
  matche(html, /aria-live="polite"/, 'la proposition s’annonce');
  assert.doesNotMatch(html, /autofocus/i, 'le focus est posé après avoir relevé l’élément précédent');
});

await dit('rendu : l’étincelle verte dans une tuile 30 × 30 — jamais une lettre, un avatar ou une image', () => {
  const html = rendre();
  const tuile = /<span class="ajp-tuile"[^>]*>([\s\S]*?)<\/span>/.exec(html)?.[1] ?? '';
  assert.match(tuile, /<svg[^>]*class="sc-etincelle/);
  assert.equal(tuile.replace(/<[^>]*>/g, '').trim(), '', 'aucun texte dans la tuile');
  assert.doesNotMatch(html, /<img|<canvas|avatar|sc-avatar|mascotte/i);
  assert.match(rendre({ initial: { enCours: true } }), /class="ajp-tuile"[^>]*data-tourne="true"/, 'l’étincelle tourne pendant la réflexion');
  assert.doesNotMatch(html, /data-tourne/);
});

await dit('rendu : « ⌘J » (Ctrl J hors macOS), libellé « Ajmani propose », pied en minuscules, quatre lignes « Ou lancez » de la fiche', () => {
  const html = rendre();
  matche(html, /<kbd[^>]*>(⌘J|Ctrl J)<\/kbd>/);
  matche(html, /<p class="ajp-section">(Ajmani propose|Récent|Suggéré ici)<\/p>/);
  matche(html, /<p class="ajp-section">Ou lancez<\/p>/);
  const pied = /<footer class="ajp-pied">([\s\S]*?)<\/footer>/.exec(html)?.[1] ?? '';
  const lignes = [...pied.matchAll(/<p>([^<]*)<\/p>/g)].map((m) => m[1]);
  assert.deepEqual(lignes, ['↑ ↓ pour naviguer', '↵ pour valider', 'échap pour fermer']);
  for (const l of lignes) assert.equal(l.replace(/^[^\p{L}]*/u, '')[0], l.replace(/^[^\p{L}]*/u, '')[0].toLowerCase(), `« ${l} » commence par une minuscule`);
  assert.doesNotMatch(pied, /<svg|<img/, 'les glyphes ↑ ↓ ↵ sont du texte, pas des icônes');
  const lancer = /<ul[^>]*class="ajp-lancer__liste"[^>]*>([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? '';
  assert.equal(compter(lancer, /role="option"/g), 4, 'quatre lignes « Ou lancez »');
  assert.deepEqual([...lancer.matchAll(/class="ajp-ligne__titre">([^<]*)</g)].map((m) => m[1]), ['Créer une facture', 'Trouver un module ou un client', 'Demander un point à la Garde', 'Rédiger un compte rendu']);
  assert.deepEqual([...lancer.matchAll(/class="ajp-ligne__sous">([^<]*)</g)].map((m) => m[1]), ['Pour un client existant', 'Recherche dans tout l’espace', 'État de la supervision', 'À partir de vos notes']);
  assert.equal(compter(lancer, /ajp-ligne__fleche/g), 4);
});

await dit('rendu : une proposition — phrase aux faits en gras, UN seul bouton primaire, puis « Modifier » et « Annuler »', () => {
  const reponse = analyser('Relancer Studio Verlaine');
  const html = rendre({ initial: { texte: 'Relancer Studio Verlaine', reponse } });
  assert.equal(compter(html, /data-variante="primaire"/g), 1);
  assert.equal(compter(html, /data-variante="secondaire"/g), 2);
  matche(html, /<strong>T-0102<\/strong>/);
  matche(html, /<p class="ajp-section">Ajmani propose<\/p>/);
  assert.deepEqual([...html.matchAll(/data-socle="bouton"[^>]*>(?:<span[^>]*>)?(?:<span[^>]*aria-hidden[^>]*>[\s\S]*?<\/span>)?([^<]+)</g)].map((m) => m[1]), ['Préparer la relance', 'Modifier', 'Annuler']);
  // Aucun état de la palette n'ajoute un second bouton plein.
  for (const t of CORPUS) {
    const r = analyser(t);
    assert.ok(compter(rendre({ initial: { texte: t, reponse: r } }), /data-variante="primaire"/g) <= 1, t);
  }
  assert.ok(compter(rendre({ initial: { texte: '', reponse: null } }, {}, { attentes: [{ cle: 'a', titre: 'Un devis attend', route: '/clients' }] }), /data-variante="primaire"/g) <= 1);
});

await dit('rendu : les états — réflexion (deux squelettes), rien trouvé, non comprise, déjà fait, erreur, hors ligne, droits', () => {
  const refl = rendre({ initial: { texte: 'Relancer', enCours: true, squelette: true } });
  assert.equal(compter(refl, /class="ajp-squelette"/g), 2);
  matche(refl, /Ajmani prépare une proposition…/);
  assert.match(rendre({ initial: { texte: 'Relancer', enCours: true } }), /Ajmani prépare une proposition…/);
  assert.doesNotMatch(rendre({ initial: { texte: 'Relancer', enCours: true } }), /ajp-squelette"/, 'le squelette ne s’affiche pas avant 150 ms');
  const rien = rendre({ initial: { texte: 'Relancer Orsini', reponse: analyser('Relancer Cabinet Orsini') } });
  matche(rien, /Je n’ai trouvé aucune facture en retard pour <strong>Cabinet Orsini<\/strong>\./);
  matche(rien, /data-etat="rien-trouve"/);
  const non = rendre({ initial: { texte: 'zzz', reponse: analyser('zzz') } });
  matche(non, /Je n’ai pas compris « zzz »\. Voulez-vous plutôt :/);
  assert.equal(compter(/<ul[^>]*class="ajp-liste"[^>]*>([\s\S]*?)<\/ul>/.exec(non)?.[1] ?? '', /role="option"/g), 3);
  const deja = rendre({ initial: { texte: 'Relancer Studio Verlaine', reponse: analyser('Relancer Studio Verlaine', { relances: [{ factureId: 'f-1', le: '2026-03-12T09:00:00Z', palier: 'ferme' }] }) } });
  matche(deja, /La relance de <strong>T-0102<\/strong> est déjà notée au 12 mars\./);
  matche(deja, /data-etat="deja-fait"/);
  const err = rendre({ initial: { texte: 'x', erreur: 'analyse' } });
  matche(err, /Ajmani n’a pas pu répondre\. Rien n’a été modifié\./);
  matche(err, />Réessayer</);
  matche(err, /data-etat="erreur"/);
  assert.match(rendre({ initial: { texte: 'x', erreur: 'action' } }), /L’action a échoué\. Rien n’a été modifié\./);
  const hors = rendre({ initial: { texte: 'Relancer Studio Verlaine', reponse: analyser('Relancer Studio Verlaine') } }, { enLigne: false });
  matche(hors, /Hors ligne : Ajmani reprendra dès que la connexion reviendra\./);
  matche(hors, /data-variante="primaire"[^>]*disabled=""[^>]*title="Hors ligne : cette action reprendra quand la connexion reviendra\."|disabled=""[^>]*data-variante="primaire"/, 'le bouton N1 est désactivé, avec la raison');
  assert.doesNotMatch(rendre(), /ajp-bandeau/, 'pas de bandeau en ligne');
  const droits = rendre({}, { admin: false });
  matche(droits, /aria-disabled="true"[^>]*>[\s\S]*?Demander un point à la Garde[\s\S]*?Réservé aux administrateurs/);
  const droitsReponse = rendre({ initial: { texte: 'point Garde', reponse: analyser('Demander un point à la Garde', {}, { admin: false }) } }, { admin: false });
  matche(droitsReponse, /data-etat="droits"/);
  assert.doesNotMatch(droitsReponse, /Ouvrir La Garde/);
});

await dit('rendu : le résultat « Trouver » est groupé (3 par groupe) ; le repos « Récent » propose « Effacer l’historique »', () => {
  const html = rendre({ initial: { texte: 'Trouver Vasseur', reponse: analyser('Trouver Vasseur') } });
  matche(html, /class="ajp-groupe">Clients</);
  matche(html, />Voir tous les résultats</);
  const garde = rendre({ initial: { texte: 'g', reponse: analyser('Demander un point à la Garde') } });
  matche(garde, /class="sc-etat"[^>]*>Tout est en ordre</);
  matche(garde, />Ouvrir La Garde</);
});

/* ═══ 7. Les sources ═══ */

const css = lire(`${DOSSIER}/palette.css`);
const cssNu = sansCommentaires(css);
const dans = (nom: string): number => Number(new RegExp(`${nom}:\\s*([\\d.]+)px`).exec(cssNu)?.[1]);
/** Le bloc d'une règle, cherchée en début de ligne (`.ajp-ligne {` et non `.ajp-liste .ajp-ligne {`). */
const bloc = (selecteur: string): string => new RegExp(`(?:^|\\n)${selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{[^}]*\\}`).exec(cssNu)?.[0] ?? '';

await dit('palette.css : les cotes de la fiche — 620 × 502, haut à 118, champ 65, bouton 31, ligne 54, pied 36, rayon 18', () => {
  assert.equal(dans('--sc-ajp-largeur'), 620);
  assert.equal(dans('--sc-ajp-hauteur'), 502);
  assert.equal(dans('--sc-ajp-haut'), 118);
  assert.equal(dans('--sc-ajp-champ'), 65);
  assert.equal(dans('--sc-ajp-bouton'), 31);
  assert.equal(dans('--sc-ajp-ligne'), 54);
  assert.equal(dans('--sc-ajp-pied'), 36);
  assert.equal(dans('--sc-ajp-rayon'), 18);
  const palette = bloc('.ajp-palette');
  assert.match(palette, /width:\s*var\(--sc-ajp-largeur\)/);
  assert.match(palette, /max-width:\s*calc\(100vw - 32px\)/);
  assert.match(palette, /height:\s*var\(--sc-ajp-hauteur\)/);
  assert.match(palette, /border-radius:\s*var\(--sc-ajp-rayon\)/);
  assert.match(palette, /background:\s*linear-gradient\(180deg,\s*var\(--socle-suggestion-haut\),\s*var\(--socle-suggestion-bas\)\)/);
  assert.match(palette, /border:\s*1px solid var\(--socle-bord-suggestion\)/);
  assert.match(palette, /box-shadow:\s*var\(--sc-ajp-ombre\)/);
  assert.match(cssNu, /--sc-ajp-ombre:\s*0 24px 80px rgba\(0, 0, 0, 0\.6\)/);
  assert.match(bloc('.ajp-champ'), /height:\s*var\(--sc-ajp-champ\)/);
  assert.match(bloc('.ajp-ligne'), /height:\s*var\(--sc-ajp-ligne\)/);
  assert.match(bloc('.ajp-pied'), /height:\s*var\(--sc-ajp-pied\)/);
  assert.match(bloc(".ajp-boutons [data-socle='bouton']"), /min-height:\s*var\(--sc-ajp-bouton\)/);
  assert.match(bloc('.ajp-section'), /font-size:\s*11px[\s\S]*letter-spacing:\s*0\.08em[\s\S]*text-transform:\s*uppercase/);
  assert.match(bloc('.ajp-phrase'), /font-size:\s*13\.5px[\s\S]*line-height:\s*20px/);
  assert.match(bloc('.ajp-champ__saisie'), /caret-color:\s*var\(--socle-etat-succes\)[\s\S]*font-size:\s*15px/);
  assert.match(bloc('.ajp-tuile'), /width:\s*var\(--sc-ajp-tuile\)[\s\S]*border-radius:\s*9px/);
  assert.equal(dans('--sc-ajp-tuile'), 30);
  assert.match(cssNu, /--sc-ajp-tuile-fond:\s*#1e1f22/);
  assert.match(cssNu, /--sc-ajp-tuile-bord:\s*#2e3035/);
  assert.match(bloc('.ajp-ligne__tuile'), /width:\s*34px[\s\S]*height:\s*34px[\s\S]*background:\s*var\(--socle-tag\)/);
  assert.match(bloc(".ajp-ligne[aria-selected='true']"), /background:\s*var\(--socle-ligne-active\)/);
});

await dit('palette.css : voile fixe z-index ≥ 50 (la pile des calques le reconnaît), ~70 % et flou 3 px, 160 ms / 120 ms, mouvement réduit = fondu seul', () => {
  const voile = bloc('.ajp-voile');
  assert.match(voile, /position:\s*fixed/);
  assert.ok(Number(/z-index:\s*(\d+)/.exec(voile)?.[1]) >= 50, 'z-index ≥ 50');
  assert.match(voile, /backdrop-filter:\s*blur\(3px\)/);
  assert.match(voile, /background:\s*var\(--sc-ajp-voile\)/);
  assert.match(cssNu, /--sc-ajp-voile:\s*rgba\(0, 0, 0, 0\.7\)/);
  assert.match(voile, /padding:\s*var\(--sc-ajp-haut\)/);
  assert.match(bloc('.ajp-palette'), /animation:\s*ajp-entre 160ms/);
  assert.match(cssNu, /\.ajp-voile\[data-sortie='true'\] \.ajp-palette \{ animation:\s*ajp-sort 120ms/);
  assert.match(cssNu, /@keyframes ajp-entre \{ from \{ opacity: 0; transform: translateY\(6px\) scale\(0\.985\); \} to \{ opacity: 1; transform: none; \} \}/);
  const reduit = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(cssNu)?.[1] ?? '';
  assert.match(reduit, /\.ajp-palette \{ animation-name: ajp-fondu-entre; \}/);
  assert.match(reduit, /\.ajp-squelette \{? ?\{? ?animation: none|animation:\s*none/);
  assert.doesNotMatch(/@keyframes ajp-fondu-entre \{[^}]*\{[^}]*\}[^}]*\{[^}]*\}\s*\}/.exec(cssNu)?.[0] ?? '', /transform/, 'le fondu ne déplace ni ne met à l’échelle');
  assert.match(cssNu, /\.ajp-tuile\[data-tourne='true'\] svg \{ animation:\s*ajp-tourne 2\.4s linear infinite; \}/);
  assert.match(cssNu, /@media \(max-width: 699\.98px\)[\s\S]*\.ajp-pied__aide \{ display: none; \}[\s\S]*min-height: 46px/);
});

await dit('palette.css : aucune couleur hex en dur (jetons du socle ou `--sc-ajp-*` locaux), aucune encre « discret » en texte, texte lu ≥ 11 px', () => {
  for (const m of cssNu.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const debut = cssNu.lastIndexOf('\n', m.index) + 1;
    const ligne = cssNu.slice(debut, cssNu.indexOf('\n', m.index));
    assert.match(ligne, /^\s*--sc-ajp-[\w-]+:\s*#/, `couleur en dur « ${m[0]} » hors d'une déclaration --sc-ajp : ${ligne.trim()}`);
  }
  assert.doesNotMatch(cssNu, /(?<![\w-])color:\s*(var\(--socle-trait-(tres-)?discret\)|#77777c|#5f5f64)/i, 'une encre « discret » posée en texte');
  assert.doesNotMatch(cssNu, /color:\s*var\(--color-socle-texte-discret\)/);
  for (const m of cssNu.matchAll(/font-size:\s*([\d.]+)px/g)) assert.ok(Number(m[1]) >= 10.5, `texte de ${m[1]} px`);
  // Tous les jetons `--socle-*` lus existent.
  const definis = jetons(lire('src/socle/noir.css'));
  const noir = sansCommentaires(lire('src/socle/noir.css'));
  for (const m of cssNu.matchAll(/var\((--socle-[\w-]+)\)/g)) assert.ok(definis.has(m[1]) || new RegExp(`${m[1]}:`).test(noir), `jeton ${m[1]} inconnu de noir.css`);
  for (const m of cssNu.matchAll(/var\((--sc-ajp-[\w-]+)\)/g)) assert.match(cssNu, new RegExp(`${m[1]}:`), `${m[1]} non déclaré`);
  // Le plus petit texte lu (T4 sur le fond de la palette) tient AA.
  const j = jetons(lire('src/socle/noir.css'));
  for (const fond of ['--socle-suggestion-haut', '--socle-suggestion-bas']) for (const encre of ['--socle-texte-1', '--socle-texte-courant', '--socle-texte-2', '--socle-texte-3']) assert.ok(rapportContraste(j.get(encre) as string, j.get(fond) as string) >= 4.5, `${encre} sur ${fond}`);
  assert.ok(rapportContraste(j.get('--socle-etat-attention') as string, j.get('--socle-suggestion-bas') as string) >= 4.5, 'le bandeau hors ligne se lit');
});

const sources = fs.readdirSync(path.join(racine, DOSSIER)).filter((f) => /\.(tsx?|css)$/.test(f)).map((f) => ({ f, src: lire(`${DOSSIER}/${f}`) }));

await dit('composant : calque fixe reconnu par la pile (useFermetureEchap appelé), dialogue, combobox, listbox, focus rendu ; pas d’autoFocus', () => {
  const src = sansCommentaires(lire(`${DOSSIER}/PaletteAjmaniRefonte.tsx`));
  assert.match(src.replace(/^import .*$/gm, ''), /useFermetureEchap\(ouverte,/);
  for (const attendu of [/role="dialog"/, /aria-modal="true"/, /role="combobox"/, /role="listbox"/, /role="option"/, /aria-activedescendant=/, /aria-selected=/, /createPortal\(/, /retour\.current/]) assert.match(src, attendu, String(attendu));
  assert.doesNotMatch(src, /\bautoFocus\b/);
  assert.match(src, /e\.stopPropagation\(\)/, 'Tab est gardé dans la palette');
  assert.match(src, /import '\.\/palette\.css'/);
  // Le voile ferme au clic (pas au survol), le focus revient à l'élément qui l'avait.
  assert.match(src, /onMouseDown=\{\(e\) => e\.target === e\.currentTarget && onFermer\(\)\}/);
  assert.match(src, /if \(cible\?\.isConnected\) cible\.focus/);
  // Un seul Bouton plein à la fois : « primaire » n'est posé que depuis le rôle du bouton, jamais en dur deux fois.
  assert.equal(compter(src, /variante=\{b\.role === 'primaire' \? 'primaire' : 'secondaire'\}/g), 1);
  assert.doesNotMatch(src, /variante="primaire"/);
});

await dit('Ajmani n’a ni visage, ni avatar, ni mascotte, ni image : seul le nom et l’étincelle ; aucun nom d’exemple de la fiche', () => {
  for (const { f, src } of sources) {
    const nu = sansCommentaires(src).replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(nu, /<img\b|<canvas\b|<picture\b|<video\b|\bAvatar\b|PileAvatars|mascotte|robot|\bTete|visage|\.(png|jpe?g|gif|svg|webp)\b|background-image:\s*url/i, `${f}`);
    assert.doesNotMatch(nu, /avatar/i, `${f} : « avatar »`);
    // Les noms et chiffres de la maquette ne sont jamais codés en dur — ni dans le code, ni dans les commentaires.
    assert.doesNotMatch(src, /Atelier Dupont|\bDupont\b|F-2041|\b2041\b|\bMenna\b|\bRiyad\b|\b18 420\b|\b890 €|Mardi 20 octobre|Lun\. 26 oct/, `${f} : un nom ou un chiffre d'exemple de la fiche`);
  }
  assert.match(sansCommentaires(lire(`${DOSSIER}/PaletteAjmaniRefonte.tsx`)), /IconeEtincelle/);
  assert.doesNotMatch(sansCommentaires(lire(`${DOSSIER}/PaletteAjmaniRefonte.tsx`)), /<span className="ajp-tuile"[^>]*>\s*[A-Za-z]/, 'la tuile ne contient pas de lettre');
});

await dit('ton d’Ajmani : vouvoiement, jamais de point d’exclamation ni de « Bien sûr », fr et en de même clés', () => {
  const { en, fr: fra } = M.dictionnaires;
  assert.deepEqual(Object.keys(en).sort(), Object.keys(fra).sort());
  for (const [langue, dico] of [['en', en], ['fr', fra]] as const) {
    for (const [cle, texte] of Object.entries(dico) as Array<[string, string]>) {
      assert.ok(texte.trim().length > 0, `${langue}.${cle} vide`);
      assert.ok(!texte.includes('!'), `${langue}.${cle} : point d'exclamation`);
      assert.doesNotMatch(texte, /bien s[uû]r|\bcertainement\b|of course|sure thing/i, `${langue}.${cle}`);
      if (langue === 'fr') assert.doesNotMatch(texte, /(?<!\p{L})(tu|toi)(?!\p{L})|(?<!\p{L})(peux|veux|as|es)-tu(?!\p{L})/iu, `fr.${cle} : tutoiement`);
    }
  }
  // Les paramètres sont les mêmes d'une langue à l'autre.
  const params = (t: string) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const cle of Object.keys(en)) assert.equal(params(en[cle]), params(fra[cle]), cle);
  // Les textes de la fiche, mot pour mot.
  assert.equal(fra['phrase.nonComprise'], 'Je n’ai pas compris « {texte} ». Voulez-vous plutôt :');
  assert.equal(fra['erreur.reponse'], 'Ajmani n’a pas pu répondre. Rien n’a été modifié.');
  assert.equal(fra['horsligne.bandeau'], 'Hors ligne : Ajmani reprendra dès que la connexion reviendra.');
  assert.equal(fra['reflexion.texte'], 'Ajmani prépare une proposition…');
  assert.equal(fra['droits.admin'], 'Réservé aux administrateurs');
});

await dit('étanchéité : seul le code interne importe la palette ; elle n’importe que le socle, la refonte (sa zone, pouls, registre), lib, state, data, auth, shared, i18n et ecranContexte', () => {
  const autorises = [
    'src/socle/', 'src/lib/', 'src/state/', 'src/data/', 'src/auth/', 'src/shared/', 'src/i18n/', 'src/assistant/ecranContexte',
    'src/refonte/systeme/ajmani/', 'src/refonte/coquille/pouls', 'src/refonte/navigation/registre',
  ];
  for (const { f, src } of sources.filter((s) => /\.tsx?$/.test(s.f))) {
    for (const m of sansCommentaires(src).matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g)) {
      const cible = m[1] ?? m[2];
      if (!cible.startsWith('.')) continue;
      const resolu = path.relative(racine, path.resolve(racine, DOSSIER, cible)).split(path.sep).join('/');
      assert.ok(autorises.some((a) => `${resolu}/`.startsWith(a)), `${f} importe ${cible} (${resolu}), hors de la liste permise`);
    }
  }
  // Aucun fichier partagé n'importe la palette (la chaîne « Ajmani » est interdite dans l'édition cliente).
  const fautes: string[] = [];
  const marcher = (dir: string) => {
    for (const e of fs.readdirSync(path.join(racine, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) marcher(rel);
      else if (/\.(tsx?|mjs|css)$/.test(e.name) && !rel.startsWith('src/refonte/') && !/\.internal\.tsx?$/.test(rel)) {
        if (/systeme\/ajmani/.test(lire(rel))) fautes.push(rel);
      }
    }
  };
  marcher('src');
  assert.deepEqual(fautes, [], 'un fichier partagé importe la palette');
  const business = sansCommentaires(lire('scripts/business-bundle-rules.mjs'));
  assert.match(business, /pattern: 'Ajmani'/, 'la règle de l’édition cliente tient toujours');
});

await dit('les écritures : une seule — le brouillon de facture (N1) ; aucun envoi, aucune émission, aucun paiement dans les sources', () => {
  const src = sansCommentaires(lire(`${DOSSIER}/useActionsAjmani.ts`));
  assert.match(src, /createDraft\(/);
  assert.doesNotMatch(src, /\bissue\(|markPaid|\bsend|envoyer|emit|pay|stripe|virement/i);
  for (const { f, src: s } of sources.filter((x) => /\.tsx?$/.test(x.f))) {
    const nu = sansCommentaires(s);
    assert.doesNotMatch(nu, /\bmarkPaid|stripe|\.ordre\(|sendMessage|garde\.ordre|fetch\(|XMLHttpRequest|bridge\(\)/i, `${f} : une écriture ou un appel que la palette n’a pas à faire`);
  }
});

fin();
