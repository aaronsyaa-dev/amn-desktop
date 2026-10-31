/**
 * Contrôle de la page NOTIFICATIONS (H40, LOT-00 Système) — sans navigateur, sans build, sans réseau.
 *
 *   npm run check:systeme-notifications
 *
 * Le modèle (tri, groupes, compteurs, cloche, heure, report, suggestion), l'état (lu, reporté, rétention), le magasin
 * (stockage refusé, échéance de report), les préférences (règle de la sécurité, retour arrière), les sources réelles
 * (type, famille, deep-link, aucun nom d'hôte dans une alerte de sécurité), le rendu statique de chaque état de la page
 * et la feuille de style (cotes de la fiche, aucune couleur en dur, aucune encre « discret » en texte).
 */
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { assert, creerEssais, jetons, lire, racine, sansCommentaires } from './lib/essai-socle.ts';

const { dit, fin } = creerEssais('Système — page Notifications (H40)');

const DOSSIER = 'src/refonte/systeme/notifications';
const fichiersDuDossier = fs.readdirSync(path.join(racine, DOSSIER)).map((f) => `${DOSSIER}/${f}`);

/** Charge du code qui importe les sources (CSS ignoré : la feuille se contrôle à part). */
async function charger<T>(code: string): Promise<T> {
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
const M = await charger<any>(`
  import { createElement as h } from 'react';
  import { renderToStaticMarkup } from 'react-dom/server.browser';
  export { h };
  export const rendre = (el) => renderToStaticMarkup(el);
  export * as modele from '../${DOSSIER}/modele';
  export * as etat from '../${DOSSIER}/etat';
  export * as reglages from '../${DOSSIER}/reglages';
  export * as sources from '../${DOSSIER}/sources';
  export * as mots from '../${DOSSIER}/i18n';
  export { creerMagasinNotifications } from '../${DOSSIER}/magasin';
  export { creerMagasinReglages } from '../${DOSSIER}/magasinReglages';
  export { VueNotifications } from '../${DOSSIER}/VueNotifications';
`);
const { h, rendre, modele, etat, reglages, sources, mots } = M;
const tf = (cle: string, params?: Record<string, string | number>): string => mots.traduire('fr', cle, params);
const NBSP = '\u00a0';

/* ── Données d'essai : des identifiants et des textes neutres, jamais ceux de la maquette ── */
const J = (jour: number, h: number, m: number): string => new Date(2026, 9, jour, h, m, 0, 0).toISOString();
// Jeudi 29 octobre 2026, 11 h : hier = mercredi 28, cette semaine = lundi 26 et mardi 27, plus tôt = dimanche 25.
const MAINTENANT = new Date(2026, 9, 29, 11, 0, 0, 0);
const N = (id: string, date: string, sur: Record<string, unknown> = {}): any => ({
  id, type: 'activite', titre: `Titre ${id}`, detail: `Détail ${id}`, vers: { route: '/essai' }, date, urgente: false, famille: 'jour', icone: 'cloche', module: null, lue: false, ...sur,
});
const HUIT = [
  N('a1', J(29, 10, 12), { type: 'urgent', urgente: true, famille: 'jour' }),
  N('a2', J(29, 9, 48), { type: 'paiement', famille: 'argent' }),
  N('a3', J(29, 8, 19), { type: 'securite', famille: 'outils' }),
  N('a4', J(29, 8, 2), { type: 'mention', famille: 'echanger' }),
  N('a5', J(29, 10, 30), { type: 'rendez-vous', lue: true }),
  N('h1', J(28, 17, 40), { type: 'devis', lue: true }),
  N('h2', J(28, 15, 2), { type: 'stock', lue: true }),
  N('s1', J(27, 9, 0), { type: 'client', lue: true }),
];

/* ════════════════════════════════ le modèle ════════════════════════════════ */

await dit('tri : non lues d’abord, urgentes en tête, puis lues — chacune par heure décroissante, jamais par heure seule', () => {
  const ids = modele.trier(HUIT.filter((n: any) => n.date >= J(29, 0, 0))).map((n: any) => n.id);
  assert.deepEqual(ids, ['a1', 'a2', 'a3', 'a4', 'a5']); // « 10:30 » (lue) sous « 08:02 » (non lue)
  const urgenteAncienne = [N('x', J(29, 9, 0)), N('y', J(29, 7, 0), { urgente: true }), N('z', J(29, 10, 0), { lue: true, urgente: true })];
  assert.deepEqual(modele.trier(urgenteAncienne).map((n: any) => n.id), ['y', 'x', 'z']); // l'urgente non lue passe devant une plus récente
  assert.deepEqual(modele.trier([N('b', J(29, 9, 0)), N('a', J(29, 9, 0))]).map((n: any) => n.id), ['a', 'b']); // égalité : l'identifiant, stable
});

await dit('groupes : Aujourd’hui, Hier, Cette semaine, Plus tôt — vides omis, chacun trié', () => {
  const g = modele.grouper(HUIT, MAINTENANT);
  assert.deepEqual(g.map((x: any) => x.cle), ['aujourdhui', 'hier', 'semaine']);
  assert.deepEqual(g[0].notifications.map((n: any) => n.id), ['a1', 'a2', 'a3', 'a4', 'a5']);
  assert.deepEqual(g[1].notifications.map((n: any) => n.id), ['h1', 'h2']);
  assert.deepEqual(g[2].notifications.map((n: any) => n.id), ['s1']);
  const plusTot = modele.grouper([...HUIT, N('p1', J(25, 12, 0))], MAINTENANT);
  assert.deepEqual(plusTot.map((x: any) => x.cle), ['aujourdhui', 'hier', 'semaine', 'plus-tot']);
  // Un lundi, « hier » est le dimanche : il reste « Hier », jamais « Cette semaine ».
  const lundi = new Date(2026, 9, 26, 11, 0);
  assert.equal(modele.groupeDe(J(25, 20, 0), lundi), 'hier');
  assert.equal(modele.groupeDe(J(24, 20, 0), lundi), 'plus-tot');
  assert.equal(modele.groupeDe(J(26, 8, 0), lundi), 'aujourdhui');
});

await dit('compteurs : Tout, Non lues, Mentions, Urgent — et un seul prédicat par onglet', () => {
  const c = modele.compteurs(HUIT);
  assert.deepEqual(c, { tout: 8, nonLues: 4, mentions: 1, urgent: 1 });
  for (const [onglet, cle] of [['tout', 'tout'], ['non-lues', 'nonLues'], ['mentions', 'mentions'], ['urgent', 'urgent']] as const) {
    assert.equal(modele.filtrerOnglet(HUIT, onglet).length, c[cle], `l'onglet ${onglet} montre autant de lignes que son compteur`);
  }
  const lue = HUIT.map((n: any) => (n.id === 'a1' ? { ...n, lue: true } : n));
  assert.equal(modele.compteurs(lue).urgent, 0); // l'urgente lue est traitée
});

await dit('cloche : la pastille est « Non lues », « 99+ » au-delà, rien à zéro — et la page lit le même calcul', () => {
  assert.equal(modele.pastilleCloche(0), null);
  assert.equal(modele.pastilleCloche(4), '4');
  assert.equal(modele.pastilleCloche(99), '99');
  assert.equal(modele.pastilleCloche(100), '99+');
  const filtre = { appActif: () => true, moduleOuvert: () => true };
  assert.equal(modele.compteurs(modele.filtrerParReglages(HUIT, filtre)).nonLues, modele.compteurs(HUIT).nonLues);
  // La cloche et l'onglet passent par la MÊME fonction : `visibles` puis `compteurs`.
  const crochets = sansCommentaires(lire(`${DOSSIER}/useNotifications.ts`));
  assert.match(crochets, /const nonLuesVisibles = \(\): number => compteurs\(visibles\(/);
  assert.match(crochets, /const notifications = useMemo\(\(\) => visibles\(/);
  assert.match(crochets, /const compte = useMemo\(\(\) => compteurs\(notifications\)/);
});

await dit('filtre : un module fermé disparaît, le canal App filtre, la sécurité n’est jamais masquée', () => {
  const liste = [N('u', J(29, 9, 0), { type: 'urgent', module: 'tasks' }), N('p', J(29, 9, 1), { type: 'paiement', module: 'invoices' }), N('s', J(29, 9, 2), { type: 'securite', module: null }), N('d', J(29, 9, 3), { type: 'devis', module: 'invoices' })];
  const ids = (f: any) => modele.filtrerParReglages(liste, f).map((n: any) => n.id);
  assert.deepEqual(ids({ appActif: () => true, moduleOuvert: (m: string) => m !== 'invoices' }), ['u', 's']); // pas de facturation : ni paiement ni devis
  assert.deepEqual(ids({ appActif: (c: string) => c !== 'paiement', moduleOuvert: () => true }), ['u', 's']); // App éteint : le devis suit « Paiements »
  assert.deepEqual(ids({ appActif: () => false, moduleOuvert: () => true }), ['s']);
});

await dit('heure affichée : « 10:12 » aujourd’hui et hier, « Mar. » dans la semaine, le jour et le mois au-delà (Intl fr-FR)', () => {
  assert.equal(modele.heureAffichee(J(29, 10, 12), MAINTENANT), '10:12');
  assert.equal(modele.heureAffichee(J(28, 17, 40), MAINTENANT), '17:40');
  assert.equal(modele.heureAffichee(J(27, 9, 0), MAINTENANT), 'Mar.');
  assert.equal(modele.heureAffichee(J(26, 9, 0), MAINTENANT), 'Lun.');
  assert.equal(modele.heureAffichee(J(25, 9, 0), MAINTENANT), '25 oct.');
  assert.equal(modele.heureAffichee(J(27, 9, 0), MAINTENANT, 'en-GB'), 'Tue');
  assert.equal(modele.heureCourte(new Date(2026, 9, 30, 9, 0)), '9:00');
  assert.equal(modele.heureCourte(new Date(2026, 9, 30, 18, 0)), '18:00');
});

await dit('sous-titre : « N nouvelles · l’important en haut, le reste attend » avec les pluriels français, « Boîte à zéro » à zéro', () => {
  const dire = (n: number) => { const s = modele.sousTitre(n); return tf(s.cle, s.params); };
  assert.equal(dire(0), 'Boîte à zéro · tout est lu');
  assert.equal(dire(1), '1 nouvelle · l’important en haut, le reste attend');
  assert.equal(dire(4), '4 nouvelles · l’important en haut, le reste attend');
  assert.equal(dire(120), '120 nouvelles · l’important en haut, le reste attend');
});

await dit('report : les échéances sont calculées (dans 1 heure, ce soir 18:00, demain 9:00, lundi 9:00) et jamais incohérentes', () => {
  const o = modele.optionsReport(MAINTENANT); // jeudi 11:00
  assert.deepEqual(o.map((x: any) => x.cle), ['heure', 'soir', 'demain', 'lundi']);
  assert.equal(o[0].echeance.getTime(), MAINTENANT.getTime() + 3_600_000);
  assert.equal(o[1].echeance.getTime(), new Date(2026, 9, 29, 18, 0).getTime());
  assert.equal(o[2].echeance.getTime(), new Date(2026, 9, 30, 9, 0).getTime());
  assert.equal(o[3].echeance.getTime(), new Date(2026, 10, 2, 9, 0).getTime());
  assert.equal(tf('report.heure'), 'Dans 1 heure');
  assert.equal(tf('report.soir', { heure: o[1].heure }), 'Ce soir 18:00');
  assert.equal(tf('report.demain', { heure: o[2].heure }), 'Demain 9:00');
  assert.equal(tf('report.lundi', { heure: o[3].heure }), 'Lundi 9:00');
  assert.ok(!modele.optionsReport(new Date(2026, 9, 29, 17, 45)).some((x: any) => x.cle === 'soir'), 'plus de « ce soir » à 17:45');
  assert.ok(!modele.optionsReport(new Date(2026, 9, 29, 21, 0)).some((x: any) => x.cle === 'soir'));
  assert.ok(!modele.optionsReport(new Date(2026, 10, 1, 10, 0)).some((x: any) => x.cle === 'lundi'), 'le dimanche, lundi est demain : proposé une fois');
  assert.equal(modele.optionsReport(new Date(2026, 9, 30, 10, 0)).find((x: any) => x.cle === 'lundi').echeance.getDate(), 2); // vendredi : lundi 2
  assert.equal(modele.optionsReport(new Date(2026, 9, 31, 10, 0)).find((x: any) => x.cle === 'lundi').echeance.getDate(), 2); // samedi : lundi 2
  for (const x of o) assert.ok(x.echeance.getTime() > MAINTENANT.getTime());
});

await dit('rattachement : le devis suit « Paiements », le stock et les nouveaux clients forment « Activité de l’équipe »', () => {
  assert.equal(modele.categorieDe('devis'), 'paiement');
  assert.equal(modele.categorieDe('stock'), 'activite');
  assert.equal(modele.categorieDe('client'), 'activite');
  for (const t of ['urgent', 'paiement', 'securite', 'mention', 'rendez-vous']) assert.equal(modele.categorieDe(t), t);
  assert.deepEqual([...modele.CATEGORIES_MATRICE], ['urgent', 'paiement', 'securite', 'mention', 'rendez-vous']);
  assert.equal(modele.iconeDe('urgent'), 'drapeau');
});

await dit('liste longue : 50 lignes à la fois, puis « Afficher les plus anciennes » ; les compteurs restent les totaux', () => {
  const beaucoup = Array.from({ length: 120 }, (_, i) => N(`n${String(i).padStart(3, '0')}`, new Date(2026, 9, 29, 10, 59 - (i % 59), 0).toISOString()));
  const { groupes, restantes } = modele.decouper(modele.grouper(beaucoup, MAINTENANT), modele.LIGNES_PAR_PAGE);
  assert.equal(groupes.flatMap((g: any) => g.notifications).length, 50);
  assert.equal(restantes, 70);
  assert.equal(modele.compteurs(beaucoup).tout, 120);
});

await dit('suggestion « Moins de bruit » : ≥ 5 notifications, ≥ 14 jours sans ouvrir, « Garder » se tait 30 jours, jamais urgent ni sécurité', () => {
  const ilYA = (jours: number) => new Date(MAINTENANT.getTime() - jours * 86_400_000).toISOString();
  const cinq = (type: string, plusAncien: number) => [0, 1, 2, 3, 4].map((i) => N(`${type}${i}`, ilYA(plusAncien - i), { type }));
  const s = modele.suggestionMoinsDeBruit(cinq('rendez-vous', 20), {}, {}, MAINTENANT);
  assert.deepEqual(s, { categorie: 'rendez-vous', jours: 20 });
  assert.equal(modele.suggestionMoinsDeBruit(cinq('rendez-vous', 20).slice(0, 4), {}, {}, MAINTENANT), null, 'il en faut 5');
  assert.equal(modele.suggestionMoinsDeBruit(cinq('rendez-vous', 10), {}, {}, MAINTENANT), null, 'moins de 14 jours');
  assert.equal(modele.suggestionMoinsDeBruit(cinq('rendez-vous', 20), { 'rendez-vous': ilYA(3) }, {}, MAINTENANT), null, 'ouvert il y a 3 jours');
  assert.deepEqual(modele.suggestionMoinsDeBruit(cinq('rendez-vous', 40), { 'rendez-vous': ilYA(16) }, {}, MAINTENANT), { categorie: 'rendez-vous', jours: 16 });
  assert.equal(modele.suggestionMoinsDeBruit(cinq('rendez-vous', 20), {}, { 'rendez-vous': new Date(MAINTENANT.getTime() + 86_400_000).toISOString() }, MAINTENANT), null, '« Garder » : plus proposé');
  assert.ok(modele.suggestionMoinsDeBruit(cinq('rendez-vous', 20), {}, { 'rendez-vous': ilYA(1) }, MAINTENANT), '« Garder » expiré : proposé de nouveau');
  for (const type of ['urgent', 'securite']) assert.equal(modele.suggestionMoinsDeBruit(cinq(type, 30), {}, {}, MAINTENANT), null);
  assert.equal(modele.suggestionMoinsDeBruit(cinq('devis', 30), {}, {}, MAINTENANT)?.categorie, 'paiement'); // le devis compte avec les paiements
});

/* ═════════════════════ l'état : lu, reporté, première vue ═════════════════════ */

await dit('état : première vue, lu ⇔ lues[id] ≥ date, report masqué puis de retour non lu à l’échéance', () => {
  const src = [{ ...N('k1', ''), date: undefined }, { ...N('k2', J(29, 9, 0)) }];
  let e = etat.etatVide();
  const datee = etat.dater(src, e, MAINTENANT);
  assert.equal(datee.notifications[0].date, MAINTENANT.toISOString(), 'la date est la première fois vue');
  e = datee.etat;
  assert.equal(etat.dater(src, e, new Date(MAINTENANT.getTime() + 3_600_000)).notifications[0].date, MAINTENANT.toISOString(), 'elle ne bouge plus');
  const brutes = datee.notifications;
  assert.deepEqual(etat.appliquerEtat(brutes, e, MAINTENANT).map((n: any) => n.lue), [false, false]);
  e = etat.marquerLue(e, 'k1', new Date(MAINTENANT.getTime() + 1000));
  assert.deepEqual(etat.appliquerEtat(brutes, e, MAINTENANT).map((n: any) => n.lue), [true, false]);
  e = etat.marquerNonLue(e, 'k1');
  assert.equal(etat.appliquerEtat(brutes, e, MAINTENANT)[0].lue, false);
  // Report : disparue, puis de retour, non lue, datée de l'échéance.
  const echeance = new Date(MAINTENANT.getTime() + 3_600_000);
  e = etat.marquerLue(e, 'k2', MAINTENANT);
  e = etat.reporter(e, 'k2', echeance);
  assert.deepEqual(etat.appliquerEtat(brutes, e, MAINTENANT).map((n: any) => n.id), ['k1']);
  const apres = etat.appliquerEtat(brutes, e, new Date(echeance.getTime() + 1000)).find((n: any) => n.id === 'k2');
  assert.equal(apres.lue, false);
  assert.equal(apres.date, echeance.toISOString());
  assert.equal(etat.prochaineEcheance(e, MAINTENANT), echeance.getTime());
  assert.equal(etat.prochaineEcheance(e, new Date(echeance.getTime() + 1)), null);
  // Annuler le report.
  assert.deepEqual(etat.appliquerEtat(brutes, etat.annulerReport(e, 'k2', undefined), MAINTENANT).map((n: any) => n.id), ['k1', 'k2']);
});

await dit('état : tout marquer comme lu se défait ; au-delà de 30 jours, une notification s’archive', () => {
  const brutes = [N('l1', J(29, 9, 0)), N('l2', J(29, 9, 1)), N('vieille', new Date(MAINTENANT.getTime() - 31 * 86_400_000).toISOString())];
  let e = etat.etatVide();
  e = etat.marquerLue(e, 'l1', new Date(MAINTENANT.getTime() - 1000));
  const { etat: lu, avant } = etat.toutMarquerLu(e, ['l1', 'l2'], MAINTENANT);
  assert.ok(etat.appliquerEtat(brutes, lu, MAINTENANT).every((n: any) => n.lue));
  const defait = etat.appliquerEtat(brutes, etat.restaurerLues(lu, avant), MAINTENANT);
  assert.deepEqual(defait.map((n: any) => [n.id, n.lue]), [['l1', true], ['l2', false]]);
  assert.ok(!defait.some((n: any) => n.id === 'vieille'), 'archivée après 30 jours');
});

await dit('état : 50 événements au plus, 30 jours, sans doublon ; l’élagage garde le récent et jette l’ancien', () => {
  let e = etat.etatVide();
  for (let i = 0; i < 60; i += 1) e = etat.ajouterEvenement(e, N(`ev${i}`, new Date(MAINTENANT.getTime() - i * 60_000).toISOString()), MAINTENANT);
  assert.equal(e.evenements.length, 50);
  assert.equal(e.evenements[0].id, 'ev0');
  e = etat.ajouterEvenement(e, N('ev0', MAINTENANT.toISOString()), MAINTENANT);
  assert.equal(e.evenements.filter((x: any) => x.id === 'ev0').length, 1);
  assert.equal(etat.ajouterEvenement(etat.etatVide(), N('vieux', new Date(MAINTENANT.getTime() - 40 * 86_400_000).toISOString()), MAINTENANT).evenements.length, 0);
  const sale = { ...etat.etatVide(), vues: { garde: MAINTENANT.toISOString(), vieux: new Date(MAINTENANT.getTime() - 40 * 86_400_000).toISOString(), toujours: new Date(MAINTENANT.getTime() - 40 * 86_400_000).toISOString() } };
  assert.deepEqual(Object.keys(etat.elaguer(sale, new Set(['toujours']), MAINTENANT).vues).sort(), ['garde', 'toujours']);
  assert.deepEqual(etat.normaliserEtat('n’importe quoi'), etat.etatVide());
  assert.deepEqual(etat.normaliserEtat({ v: 99 }), etat.etatVide());
  assert.deepEqual(etat.normaliserEtat({ v: 1, vues: { a: 'pas une date', b: MAINTENANT.toISOString() }, evenements: [{ id: 1 }, 'x'] }).vues, { b: MAINTENANT.toISOString() });
});

/* ═════════════════════════════ le magasin ═════════════════════════════ */

function stockageEssai(refuse = false) {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => { if (refuse) throw new Error('refusé'); return m.get(k) ?? null; },
    setItem: (k: string, v: string) => { if (refuse) throw new Error('quota'); m.set(k, v); },
  };
}
const SRC = (id: string, sur: Record<string, unknown> = {}): any => { const n = { ...N(id, '') }; delete n.date; delete n.lue; return { ...n, ...sur }; };

await dit('magasin : première vue, lu, report qui revient seul à l’échéance, clé locale par compte, rien de secret', () => {
  let t = new Date(MAINTENANT);
  const reveils: Array<{ fn: () => void; ms: number }> = [];
  const st = stockageEssai();
  const mag = M.creerMagasinNotifications({ stockage: st, maintenant: () => t, planifier: (fn: () => void, ms: number) => { const r = { fn, ms }; reveils.push(r); return () => reveils.splice(reveils.indexOf(r), 1); } });
  mag.selectionnerCompte('essai@exemple.test');
  mag.alimenter('attention', [SRC('p1'), SRC('p2')]);
  assert.equal(mag.instantane().notifications.length, 2);
  assert.ok(mag.instantane().notifications.every((n: any) => !n.lue && n.date === MAINTENANT.toISOString()));
  mag.ouvrir('p1');
  assert.equal(mag.instantane().notifications.find((n: any) => n.id === 'p1').lue, true);
  assert.ok(mag.instantane().etat.ouvertures.activite, 'l’ouverture est notée (suggestion Moins de bruit)');
  mag.basculerLue('p1');
  assert.equal(mag.instantane().notifications.find((n: any) => n.id === 'p1').lue, false, 'M bascule');
  const echeance = new Date(t.getTime() + 3_600_000);
  const annuler = mag.reporter('p2', echeance);
  assert.deepEqual(mag.instantane().notifications.map((n: any) => n.id), ['p1']);
  assert.equal(reveils.length, 1, 'le magasin programme son réveil à l’échéance');
  t = new Date(echeance.getTime() + 1000);
  reveils[0].fn();
  const revenue = mag.instantane().notifications.find((n: any) => n.id === 'p2');
  assert.ok(revenue && !revenue.lue && revenue.date === echeance.toISOString(), 'revenue en non lue, datée de l’échéance');
  annuler();
  assert.equal(reveils.length, 0);
  const cle = [...st.m.keys()].find((k) => k.startsWith('amn.notifications.etat.'));
  assert.equal(cle, 'amn.notifications.etat.essai@exemple.test');
  assert.doesNotMatch(st.m.get(cle as string) as string, /token|secret|password|mot de passe/i);
  mag.selectionnerCompte('autre@exemple.test');
  assert.equal(mag.instantane().notifications.length, 0, 'un autre compte repart de zéro');
  mag.selectionnerCompte('essai@exemple.test');
  mag.alimenter('attention', [SRC('p1'), SRC('p2')]);
  assert.equal(mag.instantane().notifications.find((n: any) => n.id === 'p1').lue, false);
});

await dit('magasin : toutMarquerLu et son annulation, « Garder », statut, moments du bus, stockage refusé sans casse', () => {
  const mag = M.creerMagasinNotifications({ stockage: stockageEssai(true), maintenant: () => MAINTENANT });
  assert.equal(mag.instantane().statut, 'chargement');
  mag.alimenter('attention', [SRC('q1'), SRC('q2')]);
  mag.poserStatut('pret');
  assert.equal(mag.instantane().statut, 'pret');
  const defaire = mag.toutMarquerLu(['q1', 'q2']);
  assert.equal(modele.compteurs(mag.instantane().notifications).nonLues, 0);
  defaire();
  assert.equal(modele.compteurs(mag.instantane().notifications).nonLues, 2);
  mag.ajouterMoment({ ...SRC('ev:x'), date: MAINTENANT.toISOString() });
  assert.equal(mag.instantane().notifications.length, 3);
  const jusqua = new Date(MAINTENANT.getTime() + 30 * 86_400_000);
  mag.garder('rendez-vous', jusqua);
  assert.equal(mag.instantane().etat.gardees['rendez-vous'], jusqua.toISOString());
  let appels = 0;
  const off = mag.abonner(() => { appels += 1; });
  mag.alimenter('attention', [SRC('q1'), SRC('q2')]);
  assert.equal(appels, 0, 'une source qui redit la même chose ne réveille personne');
  off();
  const sans = M.creerMagasinNotifications({ stockage: null, maintenant: () => MAINTENANT });
  sans.alimenter('messages', [SRC('m1')]);
  assert.equal(sans.instantane().notifications.length, 1);
  const pris = M.creerMagasinNotifications({ stockage: { getItem: () => '{pas du json', setItem: () => undefined }, maintenant: () => MAINTENANT });
  pris.selectionnerCompte('x@exemple.test');
  assert.equal(pris.instantane().notifications.length, 0, 'un stockage illisible repart d’un état vide');
});

/* ═══════════════════════════ les préférences ═══════════════════════════ */

await dit('préférences : 5 types × 3 canaux, les valeurs de la maquette par défaut, heures calmes 20:00–08:00, résumé à 8 h', () => {
  const d = reglages.reglagesParDefaut();
  assert.deepEqual(d.canaux, {
    urgent: { app: true, mail: true, mobile: true },
    paiement: { app: true, mail: true, mobile: false },
    securite: { app: true, mail: true, mobile: true },
    mention: { app: true, mail: false, mobile: true },
    'rendez-vous': { app: true, mail: false, mobile: true },
  });
  assert.deepEqual(d.heuresCalmes, { actif: true, de: '20:00', a: '08:00' });
  assert.deepEqual(d.resume, { actif: true, heure: '08:00' });
  assert.equal(reglages.heureEnMots('08:00'), `8${NBSP}h`);
  assert.equal(reglages.heureEnMots('08:30'), `8${NBSP}h 30`);
  assert.equal(reglages.HEURES_PROPOSEES.length, 48);
  assert.ok(reglages.HEURES_PROPOSEES.every(reglages.estHeure));
});

await dit('préférences : la sécurité garde au moins un canal — la dernière case ne s’éteint pas', () => {
  let r = reglages.reglagesParDefaut();
  const off = (canal: string) => ({ chemin: `canaux.securite.${canal}`, valeur: false });
  assert.ok(reglages.peutChanger(r, off('mobile')));
  r = reglages.appliquerChangement(r, off('mobile'));
  assert.ok(reglages.peutChanger(r, off('mail')));
  r = reglages.appliquerChangement(r, off('mail'));
  assert.equal(reglages.peutChanger(r, off('app')), false, 'la dernière case est refusée');
  assert.equal(reglages.estVerrouillee(r, 'securite', 'app'), true);
  assert.equal(reglages.estVerrouillee(r, 'securite', 'mail'), false);
  assert.equal(reglages.estVerrouillee(r, 'paiement', 'app'), false);
  assert.equal(reglages.peutChanger(reglages.reglagesParDefaut(), { chemin: 'canaux.paiement.app', valeur: false }), true);
  const tout = JSON.parse(JSON.stringify(reglages.reglagesParDefaut()));
  tout.canaux.securite = { app: false, mail: false, mobile: false };
  assert.equal(reglages.normaliserReglages(tout).canaux.securite.app, true, 'un état stocké sans canal est réparé');
  assert.deepEqual(reglages.normaliserReglages('n’importe quoi'), reglages.reglagesParDefaut());
  assert.equal(reglages.normaliserReglages({ heuresCalmes: { de: '25:99' } }).heuresCalmes.de, '20:00');
});

await dit('préférences : « Passer en résumé » éteint App et Mobile du type et l’ajoute au résumé ; les lignes suivent les modules ouverts', () => {
  let r = reglages.reglagesParDefaut();
  for (const c of reglages.changementsPasserEnResume('rendez-vous')) r = reglages.appliquerChangement(r, c);
  assert.deepEqual(r.canaux['rendez-vous'], { app: false, mail: false, mobile: false });
  assert.deepEqual(r.enResume, ['rendez-vous']);
  assert.equal(reglages.appActif(r, 'rendez-vous'), false);
  assert.equal(reglages.appActif(r, 'activite'), true, 'l’activité de l’équipe n’a pas de ligne : App seulement, toujours');
  assert.deepEqual(reglages.lignesVisibles(() => true), ['urgent', 'paiement', 'securite', 'mention', 'rendez-vous']);
  assert.deepEqual(reglages.lignesVisibles((m: string) => m !== 'invoices' && m !== 'agenda'), ['urgent', 'securite', 'mention']);
  assert.deepEqual(reglages.lignesVisibles(() => false), ['securite'], 'la sécurité reste toujours');
});

await dit('enregistrement : immédiat, retour arrière champ par champ si le serveur refuse, message à rejouer', async () => {
  const st = stockageEssai();
  let refuse = false;
  const envoyes: any[] = [];
  const distant = { get: async () => ({}), set: async (cle: string, v: unknown) => { if (refuse) throw new Error('refus'); envoyes.push([cle, v]); } };
  const mag = M.creerMagasinReglages({ stockage: st, distant, enLigne: () => true, delaiMs: 50 });
  mag.selectionnerCompte('a@exemple.test');
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(mag.changer([{ chemin: 'canaux.paiement.mobile', valeur: true }]), true);
  assert.equal(mag.instantane().reglages.canaux.paiement.mobile, true, 'immédiat à l’écran');
  assert.equal(JSON.parse(st.m.get('amn.notifications.reglages.a@exemple.test') as string).canaux.paiement.mobile, true, 'et dans le stockage local');
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(envoyes.length, 1);
  assert.equal(envoyes[0][0], 'notifications');
  refuse = true;
  mag.changer([{ chemin: 'canaux.mention.mail', valeur: true }]);
  mag.changer([{ chemin: 'heuresCalmes.actif', valeur: false }]);
  await new Promise((r) => setTimeout(r, 10));
  const apres = mag.instantane();
  assert.equal(apres.reglages.canaux.mention.mail, false, 'l’interrupteur revient à son état précédent');
  assert.equal(apres.reglages.heuresCalmes.actif, true);
  assert.equal(apres.reglages.canaux.paiement.mobile, true, 'ce qui avait réussi ne bouge pas');
  assert.ok(apres.echec && apres.echec.length === 1, 'le message « Réessayer » a de quoi rejouer');
  refuse = false;
  mag.reessayer();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(mag.instantane().echec, null);
  assert.equal(mag.instantane().reglages.heuresCalmes.actif, false, 'le geste rejoué s’applique');
  // La règle de sécurité passe par le magasin.
  for (const c of ['mobile', 'mail']) mag.changer([{ chemin: `canaux.securite.${c}`, valeur: false }]);
  assert.equal(mag.changer([{ chemin: 'canaux.securite.app', valeur: false }]), false);
  assert.equal(mag.instantane().reglages.canaux.securite.app, true);
});

await dit('enregistrement : sans préférences distantes tout reste local, hors ligne le geste attend le réseau, un serveur muet ne bloque pas', async () => {
  const absent = M.creerMagasinReglages({ stockage: stockageEssai(), distant: { get: async () => { throw new Error('pas de compte'); }, set: async () => { throw new Error('non'); } }, enLigne: () => true });
  absent.selectionnerCompte('b@exemple.test');
  await new Promise((r) => setTimeout(r, 5));
  absent.changer([{ chemin: 'canaux.urgent.mail', valeur: false }]);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(absent.instantane().reglages.canaux.urgent.mail, false, 'jamais de retour arrière sans préférences distantes');
  assert.equal(absent.instantane().echec, null);

  let enLigne = false;
  const recus: unknown[] = [];
  const hors = M.creerMagasinReglages({ stockage: stockageEssai(), distant: { get: async () => ({}), set: async (_c: string, v: unknown) => { recus.push(v); } }, enLigne: () => enLigne });
  hors.selectionnerCompte('c@exemple.test');
  await new Promise((r) => setTimeout(r, 5));
  hors.changer([{ chemin: 'resume.actif', valeur: false }]);
  hors.changer([{ chemin: 'canaux.mention.mail', valeur: true }]);
  assert.equal(hors.instantane().enAttente, 2, '« 2 actions en attente d’envoi »');
  assert.equal(recus.length, 0);
  enLigne = true;
  hors.retourReseau();
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(recus.length, 1);
  assert.equal(hors.instantane().enAttente, 0);

  const muet = M.creerMagasinReglages({ stockage: stockageEssai(), distant: { get: async () => ({}), set: () => new Promise(() => undefined) }, enLigne: () => true, delaiMs: 20 });
  muet.selectionnerCompte('d@exemple.test');
  await new Promise((r) => setTimeout(r, 5));
  muet.changer([{ chemin: 'canaux.urgent.app', valeur: false }]);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(muet.instantane().reglages.canaux.urgent.app, true, 'un serveur qui ne répond pas vaut un refus');
  assert.ok(muet.instantane().echec);

  const adopte = M.creerMagasinReglages({ stockage: stockageEssai(), distant: { get: async () => ({ notifications: { ...reglages.reglagesParDefaut(), resume: { actif: false, heure: '08:00' } } }), set: async () => undefined }, enLigne: () => true });
  adopte.selectionnerCompte('e@exemple.test');
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(adopte.instantane().reglages.resume.actif, false, 'le serveur fait foi au chargement');

  const sansStockage = M.creerMagasinReglages({ stockage: stockageEssai(true), distant: null, enLigne: () => true });
  sansStockage.selectionnerCompte('f@exemple.test');
  assert.equal(sansStockage.changer([{ chemin: 'resume.actif', valeur: false }]), true, 'un stockage refusé ne casse rien');
});

/* ═══════════════════════════ les sources réelles ═══════════════════════════ */

const t = (cle: string, params?: Record<string, string | number>): string => tf(cle, params);
const POINT = (key: string, kind: string, severity: string, extra: Record<string, unknown> = {}): any => ({ key, kind, severity, title: `titre ${kind}`, evidence: `preuve ${kind}`, to: '/route', ...extra });

await dit('attention : chaque genre a son type, sa famille et son module ; la gravité critique fait l’urgence', () => {
  const kinds = ['project-late', 'project-validation', 'leave-pending', 'booking-conflict', 'vehicle-due', 'invoice-overdue', 'invoice-due-soon', 'task-stale', 'client-silent', 'certificate-expired', 'certificate-expiring', 'certificate-unknown', 'incident-critical', 'incident-stale', 'scan-regression'];
  assert.deepEqual(Object.keys(sources.FICHES_ATTENTION).sort(), [...kinds].sort(), 'aucun genre oublié');
  const type = (kind: string, sev = 'info') => sources.typeDePoint(kind, sev);
  assert.equal(type('invoice-overdue'), 'paiement');
  assert.equal(type('invoice-due-soon'), 'paiement');
  for (const k of ['certificate-expired', 'certificate-expiring', 'certificate-unknown', 'incident-critical', 'incident-stale', 'scan-regression']) assert.equal(type(k), 'securite', k);
  assert.equal(type('booking-conflict'), 'rendez-vous');
  assert.equal(type('task-stale', 'critical'), 'urgent');
  assert.equal(type('task-stale', 'warning'), 'activite', 'une tâche oubliée n’est pas un « ticket urgent »');
  assert.equal(type('project-late', 'critical'), 'urgent');
  for (const k of ['client-silent', 'leave-pending', 'vehicle-due']) assert.equal(type(k, 'critical'), 'activite');
  const [critique, doux] = sources.attentionVersNotifications([POINT('invoice-overdue:f1', 'invoice-overdue', 'critical'), POINT('invoice-due-soon:f2', 'invoice-due-soon', 'info')], t);
  assert.equal(critique.urgente, true);
  assert.equal(doux.urgente, false);
  assert.equal(critique.famille, 'argent');
  assert.equal(critique.module, 'invoices');
  assert.equal(critique.icone, 'euro');
  assert.equal(critique.titre, 'titre invoice-overdue');
  assert.equal(critique.detail, 'preuve invoice-overdue');
  assert.equal(critique.date, undefined, 'la date est posée par le magasin : première fois vue');
});

await dit('attention : l’identifiant est la clé du moteur (stable), dédoublonné ; le deep-link mène à l’élément', () => {
  const a = sources.attentionVersNotifications([POINT('invoice-overdue:f1', 'invoice-overdue', 'warning'), POINT('invoice-overdue:f1', 'invoice-overdue', 'warning')], t);
  assert.equal(a.length, 1);
  assert.equal(a[0].id, 'att:invoice-overdue:f1');
  assert.equal(sources.attentionVersNotifications([POINT('invoice-overdue:f1', 'invoice-overdue', 'info')], t)[0].id, a[0].id, 'stable d’un rendu à l’autre');
  assert.deepEqual(a[0].vers, { route: '/facturation', state: { openInvoiceId: 'f1' } });
  const vers = (key: string, kind: string, to = '/x') => sources.versDePoint({ key, kind, to });
  assert.deepEqual(vers('task-stale:t9', 'task-stale'), { route: '/tasks', state: { openTaskId: 't9' } });
  assert.deepEqual(vers('client-silent:42', 'client-silent'), { route: '/clients', state: { focusClientId: 42 } });
  assert.deepEqual(vers('client-silent:pas-un-nombre', 'client-silent', '/clients'), { route: '/clients' });
  assert.deepEqual(vers('project-late:p1', 'project-late', '/projets'), { route: '/projets' });
  assert.deepEqual(vers('sansdeuxpoints', 'task-stale', '/tasks'), { route: '/tasks' });
});

await dit('sécurité : le texte est le nôtre, court, sans nom d’hôte, d’adresse ni d’identifiant — et l’identifiant stocké est une empreinte', () => {
  const points = [
    POINT('certificate-expired:serveur-interne.exemple.test', 'certificate-expired', 'critical', { title: 'Certificat de serveur-interne.exemple.test EXPIRÉ', evidence: 'expiré depuis 3 jours' }),
    POINT('incident-critical:inc-8841', 'incident-critical', 'critical', { title: 'Site client · intrusion détectée', evidence: 'ouvert depuis 2 h' }),
    POINT('scan-regression:scan-12', 'scan-regression', 'warning', { title: 'Sécurité en recul — monsite.exemple.test', evidence: '80 → 60 sur 100' }),
    POINT('incident-stale:inc-77', 'incident-stale', 'warning', { title: 'x · y', evidence: 'z' }),
  ];
  for (const n of sources.attentionVersNotifications(points, t)) {
    assert.equal(n.type, 'securite');
    assert.doesNotMatch(`${n.id} ${n.titre} ${n.detail} ${JSON.stringify(n.vers)}`, /exemple|inc-|scan-12|intrusion|monsite|Site client/i, n.titre);
    assert.doesNotMatch(`${n.titre} ${n.detail}`, /expir|jours?\b|\d/i, 'aucun détail qui décrive la faiblesse');
    assert.ok(n.titre.length <= 45 && n.detail.length <= 45, 'court');
    assert.match(n.id, /^att:[a-z-]+:[0-9a-z]+$/);
    assert.equal(n.module, null, 'toujours ouvert');
  }
  assert.equal(sources.empreinte('abc'), sources.empreinte('abc'));
  assert.notEqual(sources.empreinte('abc'), sources.empreinte('abd'));
  for (const kind of ['certificate-expired', 'certificate-expiring', 'certificate-unknown', 'incident-critical', 'incident-stale', 'scan-regression']) {
    const n = sources.attentionVersNotifications([POINT(`${kind}:hote.exemple.test`, kind, 'warning')], t)[0];
    assert.doesNotMatch(n.id + n.titre, /hote|exemple/, kind);
  }
});

await dit('messages privés : un par correspondant, type « mention », lien vers le fil, jamais l’adresse dans l’identifiant', () => {
  const [un, trois] = sources.messagesVersNotifications([
    { email: 'alice@exemple.test', nom: 'Alice', nombre: 1, apercu: '  Peux-tu\n regarder ?  ', date: J(29, 8, 2) },
    { email: 'bruno@exemple.test', nom: 'Bruno', nombre: 3, apercu: 'x'.repeat(300), date: J(29, 9, 0) },
    { email: 'nul@exemple.test', nom: 'Nul', nombre: 0, apercu: '', date: J(29, 9, 0) },
  ], t);
  assert.equal(un.type, 'mention');
  assert.equal(un.titre, 'Alice vous a écrit');
  assert.equal(trois.titre, 'Bruno vous a envoyé 3 messages');
  assert.equal(un.detail, '« Peux-tu regarder ? »');
  assert.ok(trois.detail.length < 100 && trois.detail.endsWith('… »'));
  assert.equal(un.vers.route, '/messages-prives?avec=alice%40exemple.test');
  assert.doesNotMatch(un.id, /alice|exemple/);
  assert.equal(un.date, J(29, 8, 2), 'la date est celle du message');
  assert.equal(un.module, 'dm');
  assert.equal(sources.messagesVersNotifications([{ email: 'a@exemple.test', nom: 'A', nombre: 1, apercu: '', date: J(29, 8, 2) }], t)[0].detail, 'Ouvrez la conversation.');
});

await dit('rendez-vous : seulement ceux qui commencent dans l’heure, « dans N minutes » recalculé, jour et heure en détail', () => {
  const rdv = (id: string, debut: Date, sur: Record<string, unknown> = {}) => ({ id, title: 'Point', startAt: debut.toISOString(), clientName: '', location: '', status: 'scheduled', ...sur });
  const dans = (min: number) => new Date(MAINTENANT.getTime() + min * 60_000);
  const out = sources.rendezVousVersNotifications([
    rdv('r1', dans(30), { clientName: 'Cabinet', location: 'salle A' }), rdv('r2', dans(61)), rdv('r3', dans(-5)), rdv('r4', dans(10), { status: 'cancelled' }), rdv('r5', dans(1)), rdv('r6', dans(0)), rdv('r7', dans(20), { title: '', clientName: '' }),
  ], MAINTENANT, t);
  assert.deepEqual(out.map((n: any) => n.id), ['rdv:r1', 'rdv:r5', 'rdv:r6', 'rdv:r7']);
  assert.equal(out[0].titre, 'Rendez-vous Cabinet dans 30 minutes');
  assert.equal(out[0].detail, 'Jeudi 11:30, salle A');
  assert.equal(out[1].titre, 'Rendez-vous Point dans 1 minute');
  assert.equal(out[2].titre, 'Rendez-vous Point maintenant');
  assert.equal(out[3].titre, 'Rendez-vous dans 20 minutes');
  assert.equal(out[0].type, 'rendez-vous');
  assert.equal(out[0].module, 'agenda');
});

await dit('bus : seuls les moments qui valent une notification, avec deep-link, sans texte inventé ; rdv.proche rejoint la source des rendez-vous', () => {
  const quand = MAINTENANT.getTime();
  const m = (type: string, charge: unknown) => sources.momentVersNotification({ type, charge, quand }, t);
  const fac = m('facture.payee', { factureId: 'f7' });
  assert.deepEqual([fac.type, fac.famille, fac.module, fac.urgente], ['paiement', 'argent', 'invoices', false]);
  assert.deepEqual(fac.vers, { route: '/facturation', state: { openInvoiceId: 'f7' } });
  assert.equal(fac.titre, 'Facture encaissée');
  assert.equal(fac.date, MAINTENANT.toISOString());
  assert.equal(m('devis.accepte', { devisId: 'd1' }).type, 'devis');
  assert.deepEqual(m('client.cree', { clientId: '12' }).vers, { route: '/clients', state: { focusClientId: 12 } });
  assert.deepEqual(m('client.cree', { clientId: 'abc' }).vers, { route: '/clients' });
  assert.equal(m('rdv.proche', { rdvId: 'r1', dansMinutes: 30 }).id, 'rdv:r1');
  assert.equal(m('rdv.proche', { rdvId: 'r1', dansMinutes: 30 }).titre, 'Rendez-vous dans 30 minutes');
  assert.equal(m('message.recu', { conversationId: 'c1' }).type, 'mention');
  assert.equal(m('message.recu', { conversationId: 'a@exemple.test' }).vers.route, '/messages-prives?avec=a%40exemple.test');
  const susp = m('tentative.suspecte', { origine: 'connexion', reference: 'ip-secrète' });
  assert.equal(susp.type, 'securite');
  assert.equal(susp.urgente, false);
  assert.doesNotMatch(JSON.stringify(susp), /ip-secrète/, 'la référence n’est ni affichée ni stockée');
  assert.equal(m('garde.escalade', { incidentId: 'i', niveau: 1 }).urgente, true);
  assert.equal(m('garde.remontee-critique', { remonteeId: 'r', equipe: 'sites' }).urgente, true);
  assert.equal(m('site.muet', { siteId: 's' }).type, 'securite');
  for (const muet of ['tache.terminee', 'facture.envoyee', 'sauvegarde.terminee', 'premiere.fois', 'synchro.retablie', 'projet.cree', 'facture.en-retard']) assert.equal(m(muet, {}), null, muet);
  assert.doesNotThrow(() => m('facture.payee', null));
  const deux = [m('client.cree', { clientId: '1' }), sources.momentVersNotification({ type: 'client.cree', charge: { clientId: '1' }, quand: quand + 1 }, t)];
  assert.notEqual(deux[0].id, deux[1].id, 'deux émissions, deux notifications');
  for (const type of sources.MOMENTS_NOTIFIANTS) assert.ok(type in { 'facture.payee': 1, 'devis.accepte': 1, 'client.cree': 1, 'rdv.proche': 1, 'message.recu': 1, 'tentative.suspecte': 1, 'garde.escalade': 1, 'garde.remontee-critique': 1, 'site.muet': 1 });
  const unique = sources.reunir([SRC('z1'), SRC('z2')], [SRC('z2', { titre: 'doublon' }), SRC('z3')]);
  assert.deepEqual(unique.map((n: any) => [n.id, n.titre]), [['z1', 'Titre z1'], ['z2', 'Titre z2'], ['z3', 'Titre z3']]);
});

await dit('aucun nom ni donnée d’exemple de la fiche dans le dossier (sources, textes, feuille, vues)', () => {
  const interdit = /Menna|Mohamed|Riyad|Boulangerie|F-2038|D-2026|Aaron|Léo\b|Câble réseau|kanban/i;
  for (const f of fichiersDuDossier.filter((x) => /\.(ts|tsx|css)$/.test(x))) assert.doesNotMatch(lire(f), interdit, f);
});

/* ══════════════════════════════ le rendu ══════════════════════════════ */

const reglagesDefaut = reglages.reglagesParDefaut();
const actionsVides: any = new Proxy({}, { get: () => () => true });
const vue = (sur: Record<string, unknown> = {}): string =>
  rendre(h(M.VueNotifications, {
    statut: 'pret', notifications: HUIT, compteurs: modele.compteurs(HUIT), maintenant: MAINTENANT, enLigne: true, enAttente: 0, reglages: reglagesDefaut,
    lignesMatrice: modele.CATEGORIES_MATRICE, echecReglage: false, suggestion: null, actions: actionsVides, ...sur,
  }));
const compter = (html: string, re: RegExp): number => (html.match(re) ?? []).length;
const entre = (html: string, debut: string, finMarque: string): string => { const i = html.indexOf(debut); const j = html.indexOf(finMarque, i + debut.length); return html.slice(i, j < 0 ? undefined : j); };
const carteListe = (html: string): string => entre(html, 'class="sc-notif__carte-liste"', 'class="sc-notif__droite"');

await dit('rendu : un seul h1, deux boutons SECONDAIRES dans l’en-tête, aucun primaire, sous-titre vivant', () => {
  const html = vue();
  assert.equal(compter(html, /<h1[ >]/g), 1);
  assert.match(html, /<h1[^>]*>Notifications<\/h1>/);
  assert.match(html, />4 nouvelles · l’important en haut, le reste attend</);
  const entete = entre(html, '<header', '</header>');
  assert.equal(compter(entete, /data-variante="secondaire"/g), 2);
  assert.equal(compter(entete, /data-variante="primaire"/g), 0);
  assert.match(entete, /Tout marquer comme lu/);
  assert.match(entete, />Réglages</);
  assert.match(vue({ notifications: [], compteurs: modele.compteurs([]) }), /Boîte à zéro · tout est lu/);
  assert.match(vue({ notifications: [], compteurs: modele.compteurs([]) }), /<button[^>]*disabled=""[^>]*>[\s\S]*Tout marquer comme lu/, 'rien à marquer : le bouton est inactif');
});

await dit('rendu : onglets (tablist, 4 tab, un seul sélectionné) avec leurs compteurs, panneau relié', () => {
  const html = vue();
  assert.equal(compter(html, /role="tablist"/g), 1);
  assert.equal(compter(html, /role="tab"/g), 4);
  assert.equal(compter(html, /role="tab"[^>]*aria-selected="true"|aria-selected="true"[^>]*role="tab"/g), 1);
  assert.equal(compter(html, /role="tabpanel"/g), 4);
  const compteurs = [...html.matchAll(/<b class="sc-onglet__compteur"[^>]*>(\d+)<\/b>/g)].map((x) => Number(x[1]));
  assert.deepEqual(compteurs, [8, 4, 1, 1]);
  assert.match(vue({ ongletInitial: 'mentions' }), /<button[^>]*aria-selected="true"[^>]*>Mentions/);
});

await dit('rendu : les lignes — 61 px par la feuille, point non lu, drapeau Urgent, ellipsis + info-bulle, groupes en h2', () => {
  const html = carteListe(vue());
  assert.equal(compter(html, /class="sc-notif__ligne"/g), 8);
  assert.equal(compter(html, /data-lue="false"/g), 4);
  assert.equal(compter(html, /data-lue="true"/g), 4);
  assert.equal(compter(html, /<span class="sc-notif__sr">Non lue<\/span>/g), 4, 'non lue : le point ET un mot');
  assert.equal(compter(html, /class="sc-urgent"/g), 1);
  assert.equal(compter(html, /data-urgente="true"/g), 1);
  assert.match(html, /<h2[^>]*class="sc-notif__groupe-titre"[^>]*>Aujourd’hui<\/h2>/);
  assert.match(html, />Hier<\/h2>/);
  assert.match(html, />Cette semaine<\/h2>/);
  assert.match(html, /<span class="sc-notif__ligne-nom" title="Titre a1">Titre a1<\/span>/);
  assert.match(html, /<time class="sc-notif__heure" dateTime="[^"]+">10:12<\/time>/);
  assert.match(html, />Mar\.<\/time>/);
  assert.equal(compter(html, /data-ligne="[^"]+" tabindex="0"/g), 1, 'un seul arrêt de tabulation dans la liste');
  assert.equal(compter(html, /data-ligne="[^"]+" tabindex="-1"/g), 7);
  assert.match(html, /--sc-notif-teinte:var\(--socle-fam-argent\)/);
  const ordre = [...html.matchAll(/data-ligne="([^"]+)"/g)].map((x) => x[1]);
  assert.deepEqual(ordre, ['a1', 'a2', 'a3', 'a4', 'a5', 'h1', 'h2', 's1'], 'l’ordre n’est pas chronologique : non lues d’abord');
  const css = sansCommentaires(lire(`${DOSSIER}/notifications.css`));
  assert.match(css, /\.sc-notif__ligne-nom \{[^}]*text-overflow:\s*ellipsis[^}]*white-space:\s*nowrap/);
  assert.match(css, /\.sc-notif__ligne-titre > \.sc-urgent \{[^}]*flex:\s*none/, 'le drapeau ne passe jamais à la ligne');
});

await dit('rendu : « Ouvrir » (seul bouton primaire de la liste) et « Reporter » n’existent que pour la ligne survolée ou focalisée', () => {
  const sans = carteListe(vue());
  assert.equal(compter(sans, /data-variante="primaire"/g), 0);
  assert.doesNotMatch(sans, />Ouvrir</);
  assert.doesNotMatch(sans, />Reporter</);
  const avec = carteListe(vue({ ligneActiveInitiale: 'a1' }));
  assert.equal(compter(avec, /data-variante="primaire"/g), 1);
  assert.equal(compter(avec, /data-variante="secondaire"/g), 1);
  assert.match(avec, /<button[^>]*data-variante="primaire"[^>]*>[\s\S]*?Ouvrir<\/span>/);
  assert.match(avec, /aria-haspopup="menu"/);
  assert.equal(compter(avec, />Reporter</g), 1);
  assert.equal(compter(avec, /sc-notif__actions/g), 1);
});

await dit('rendu : la colonne droite — 15 interrupteurs aux valeurs de la maquette, heures calmes, résumé du matin', () => {
  const html = vue();
  const droite = entre(html, 'class="sc-notif__droite"', '</main>');
  assert.equal(compter(droite, /role="switch"/g), 15 + 2);
  assert.match(droite, />Que voulez-vous recevoir\u00a0\?</);
  for (const colonne of ['App', 'Mail', 'Mobile']) assert.match(droite, new RegExp(`class="sc-notif__canal">${colonne}<`));
  for (const ligne of ['Tickets urgents', 'Paiements', 'Sécurité', 'Mentions', 'Rendez-vous']) assert.match(droite, new RegExp(`<span>${ligne}</span>`));
  const etats = [...droite.matchAll(/aria-checked="(true|false)" aria-label="([^"]+)"/g)].filter((x) => x[2].includes(', ')).map((x) => `${x[2]}=${x[1]}`);
  assert.equal(etats.length, 15);
  assert.ok(etats.includes('Paiements, Mobile=false'));
  assert.ok(etats.includes('Mentions, Mail=false'));
  assert.ok(etats.includes('Rendez-vous, Mail=false'));
  assert.ok(etats.includes('Tickets urgents, App=true'));
  assert.match(droite, /De 20:00 à 08:00, seules les urgences passent\./);
  assert.match(droite, /Un seul message à 8\u00a0h avec l’essentiel\./);
  assert.match(droite, />Heures calmes</);
  assert.match(droite, />Résumé du matin</);
  assert.ok(entre(html, 'class="sc-notif__droite"', '</main>').indexOf('Que voulez-vous') < entre(html, 'class="sc-notif__droite"', '</main>').indexOf('Heures calmes'));
});

await dit('rendu : la dernière case de la sécurité est verrouillée, avec son info-bulle ; un métier sans module n’a pas la ligne', () => {
  const seul = JSON.parse(JSON.stringify(reglagesDefaut));
  seul.canaux.securite = { app: true, mail: false, mobile: false };
  const html = vue({ reglages: seul });
  assert.match(html, /<span class="sc-notif__cellule" title="Les alertes de sécurité restent actives"><button[^>]*aria-checked="true"[^>]*disabled=""/);
  assert.equal(compter(html, /title="Les alertes de sécurité restent actives"/g), 1);
  assert.equal(compter(vue({ lignesMatrice: ['urgent', 'securite'] }), /role="switch"/g), 6 + 2);
  assert.doesNotMatch(vue({ lignesMatrice: ['urgent', 'securite'] }), /<span>Paiements<\/span>/);
});

await dit('rendu : la suggestion « Moins de bruit » (seul second bouton blanc), sinon la carte « Astuce » — jamais un vide', () => {
  const sugg = vue({ suggestion: { categorie: 'rendez-vous', jours: 14 } });
  assert.match(sugg, /Suggestion d’Ajmani/);
  assert.match(sugg, />Moins de bruit</);
  assert.match(sugg, /Vous ignorez les notifications de rendez-vous depuis 14 jours\. Je peux les passer en résumé du matin\./);
  assert.match(sugg, />Passer en résumé</);
  assert.match(sugg, />Garder</);
  assert.match(sugg, /<svg[^>]*class="sc-etincelle/);
  const astuce = vue();
  assert.match(astuce, /class="sc-notif__carte sc-notif__astuce"/);
  assert.match(astuce, /<kbd class="sc-kbd">⌘ ⇧ L<\/kbd> marque tout comme lu\./);
  assert.doesNotMatch(astuce, /Suggestion d’Ajmani/);
  assert.doesNotMatch(vue({ suggestion: { categorie: 'paiement', jours: 20 } }), /rendez-vous depuis/);
});

await dit('rendu : le message d’échec d’enregistrement avec « Réessayer »', () => {
  const html = vue({ echecReglage: true });
  assert.match(html, /role="alert"[^>]*>[\s\S]*Le réglage n’a pas pu être enregistré\.[\s\S]*Réessayer/);
  assert.doesNotMatch(vue(), /Le réglage n’a pas pu/);
});

await dit('états : vide (Boîte à zéro), onglet vide, chargement (6 squelettes, onglets sans compteur), erreur, hors ligne, un seul élément', () => {
  const vide = carteListe(vue({ notifications: [], compteurs: modele.compteurs([]) }));
  assert.match(vide, /Rien de nouveau/);
  assert.match(vide, /Vous êtes à jour\. Les prochaines notifications apparaîtront ici\./);
  assert.match(vide, />Régler mes notifications</);
  assert.equal(compter(vide, /class="sc-notif__ligne"/g), 0);

  const sansMention = HUIT.filter((n: any) => n.type !== 'mention');
  const ongletVide = carteListe(vue({ notifications: sansMention, compteurs: modele.compteurs(sansMention), ongletInitial: 'mentions' }));
  assert.match(ongletVide, /Personne ne vous a mentionné pour l’instant\./);
  assert.match(ongletVide, />Voir toutes les notifications</);
  assert.match(carteListe(vue({ notifications: HUIT.filter((n: any) => n.lue), compteurs: modele.compteurs(HUIT.filter((n: any) => n.lue)), ongletInitial: 'urgent' })), /Rien d’urgent pour l’instant\./);

  const charge = vue({ statut: 'chargement', notifications: [] });
  assert.equal(compter(charge, /class="sc-notif__squelette-ligne"/g), 6);
  assert.match(charge, /role="status"[^>]*aria-busy="true"[^>]*aria-label="Chargement de vos notifications"|aria-busy="true"[^>]*role="status"/);
  assert.equal(compter(charge, /sc-onglet__compteur/g), 0, 'les onglets sont visibles, sans compteur');
  assert.equal(compter(charge, /role="tab"/g), 4);
  assert.equal(compter(charge, /role="switch"/g), 0, 'cartes de droite en squelette');
  assert.equal(compter(charge, /sc-notif__squelette-carte/g), 3);

  const erreur = vue({ statut: 'erreur', notifications: [] });
  assert.match(carteListe(erreur), /role="alert"[\s\S]*Les notifications n’ont pas pu être chargées\.[\s\S]*Réessayer/);
  assert.equal(compter(erreur, /role="switch"/g), 17, 'la colonne droite reste utilisable');

  const hors = vue({ enLigne: false, enAttente: 3 });
  assert.match(hors, /role="status"[^>]*>[\s\S]*Hors ligne, modifications en attente[\s\S]*3 actions en attente d’envoi/);
  assert.match(vue({ enLigne: false, enAttente: 1 }), /1 action en attente d’envoi/);
  assert.doesNotMatch(vue({ enLigne: false }), /en attente d’envoi/);
  assert.doesNotMatch(vue(), /Hors ligne/);
  assert.equal(compter(hors, /class="sc-notif__ligne"/g), 8, 'hors ligne : la liste reste en lecture');

  const un = vue({ notifications: [HUIT[0]], compteurs: modele.compteurs([HUIT[0]]) });
  assert.match(un, /C’est tout pour le moment\./);
  assert.match(un, /class="sc-notif__lien[^"]*"[^>]*>Réglages</);
  assert.equal(compter(carteListe(un), /class="sc-notif__ligne"/g), 1);
  assert.doesNotMatch(vue(), /C’est tout pour le moment/);
});

await dit('états : liste longue — 50 lignes, « Afficher les plus anciennes », compteurs = totaux ; la liste défile dans la carte', () => {
  const beaucoup = Array.from({ length: 80 }, (_, i) => N(`n${String(i).padStart(3, '0')}`, new Date(2026, 9, 29, 10, 59 - (i % 59), 0).toISOString()));
  const html = vue({ notifications: beaucoup, compteurs: modele.compteurs(beaucoup) });
  assert.equal(compter(carteListe(html), /class="sc-notif__ligne"/g), 50);
  assert.match(html, />Afficher les plus anciennes</);
  assert.match(html, /<b class="sc-onglet__compteur"[^>]*>80<\/b>/);
  assert.doesNotMatch(vue(), /Afficher les plus anciennes/);
  const css = sansCommentaires(lire(`${DOSSIER}/notifications.css`));
  assert.match(css, /\.sc-notif__defilement \{[^}]*overflow-y:\s*auto/);
  assert.match(css, /\.sc-notif__groupe-titre \{[^}]*position:\s*sticky/);
  assert.match(css, /\.sc-notif__carte-liste \{[^}]*overflow:\s*hidden/);
});

await dit('textes : fr et en ont les mêmes clés et paramètres, aucun point d’exclamation, apostrophes typographiques, espaces insécables', () => {
  const en = mots.MOTS_EN as Record<string, string>;
  const fr = mots.MOTS_FR as Record<string, string>;
  assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort());
  const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort().join(',');
  for (const cle of Object.keys(en)) {
    assert.equal(params(fr[cle]), params(en[cle]), `paramètres de ${cle}`);
    assert.ok(fr[cle].trim() && en[cle].trim(), cle);
    for (const [langue, texte] of [['fr', fr[cle]], ['en', en[cle]]]) {
      assert.ok(!texte.includes('!'), `${langue} ${cle} : point d’exclamation`);
      assert.ok(!texte.includes("'"), `${langue} ${cle} : apostrophe droite`);
    }
    assert.doesNotMatch(fr[cle], /[A-Za-zÀ-ÿ0-9][?:](\s|$)| [?:]/, `fr ${cle} : espace insécable avant « ? » et « : »`);
    assert.doesNotMatch(fr[cle], /«\s|[^\u00a0]»/, `fr ${cle} : guillemets`);
  }
  assert.equal(fr['matrice.titre'], `Que voulez-vous recevoir${NBSP}?`);
  assert.equal(fr['toast.reportee'], `Reportée${NBSP}: {quand}`);
});

/* ═════════════════════════════ la feuille de style ═════════════════════════════ */

const css = lire(`${DOSSIER}/notifications.css`);
const cssNu = sansCommentaires(css);
const px = (nom: string): number => { const m = new RegExp(`${nom}:\\s*(\\d+(?:\\.\\d+)?)px`).exec(cssNu); assert.ok(m, `${nom} introuvable`); return Number(m?.[1]); };

await dit('feuille : les cotes de la fiche (rubrique 3) — 400, 20, 14, 61, 38, 8, 32, 304 / 136 / 156, 43, 62, 31', () => {
  const attendu: Record<string, number> = {
    '--sc-notif-droite': 400, '--sc-notif-ecart': 20, '--sc-notif-ecart-droite': 14, '--sc-notif-liste-hauteur': 630, '--sc-notif-ligne': 61, '--sc-notif-tuile': 38,
    '--sc-notif-tuile-rayon': 11, '--sc-notif-point': 8, '--sc-notif-groupe': 32, '--sc-notif-carte-matrice': 304, '--sc-notif-carte-reglages': 136,
    '--sc-notif-carte-suggestion': 156, '--sc-notif-rangee': 43, '--sc-notif-colonne-canal': 62, '--sc-notif-bouton': 31,
  };
  for (const [nom, valeur] of Object.entries(attendu)) assert.equal(px(nom), valeur, nom);
  // Le contenu va de x = 40 à x = 1148 (1108 px) : la carte liste mesure 1108 − 400 − 20 = 688 à 1440 px de large.
  const contenu = 1440 - 252 - 2 * 40;
  assert.equal(contenu, 1108);
  assert.equal(contenu - px('--sc-notif-droite') - px('--sc-notif-ecart'), 688);
  assert.equal(px('--sc-notif-droite') + px('--sc-notif-ecart') + 688, contenu);
  // Les trois cartes de droite et leurs écarts finissent à y = 96 + 304 + 14 + 136 + 14 + 156 = 720 ; la suggestion grandit jusqu'à 726.
  assert.equal(96 + px('--sc-notif-carte-matrice') + 14 + px('--sc-notif-carte-reglages') + 14 + px('--sc-notif-carte-suggestion'), 720);
  assert.equal(96 + px('--sc-notif-liste-hauteur'), 726);
  assert.match(cssNu, /grid-template-columns:\s*minmax\(0, 1fr\) var\(--sc-notif-droite\)/);
  assert.match(cssNu, /\.sc-notif__droite > \.sc-suggestion,\s*\.sc-notif__astuce \{[^}]*flex:\s*1/);
  assert.match(cssNu, /\.sc-notif__ligne \{[^}]*height:\s*var\(--sc-notif-ligne\)/);
  assert.match(cssNu, /\.sc-notif__tuile \{[^}]*width:\s*var\(--sc-notif-tuile\)[^}]*height:\s*var\(--sc-notif-tuile\)[^}]*border-radius:\s*var\(--sc-notif-tuile-rayon\)[^}]*13%/);
  assert.match(cssNu, /\.sc-notif__point \{[^}]*width:\s*var\(--sc-notif-point\)/);
  assert.match(cssNu, /\.sc-notif__matrice \{[^}]*repeat\(3, var\(--sc-notif-colonne-canal\)\)/);
  assert.match(cssNu, /\.sc-notif__groupe-titre \{[^}]*font-size:\s*11px[^}]*letter-spacing:\s*0\.08em[^}]*text-transform:\s*uppercase/);
  assert.match(cssNu, /\.sc-notif__titre \{[^}]*font-size:\s*28px[^}]*font-weight:\s*600/);
  assert.match(cssNu, /\.sc-notif__ligne-nom \{[^}]*font-size:\s*13\.5px[^}]*font-weight:\s*600/);
  assert.match(cssNu, /\.sc-notif__detail \{[^}]*font-size:\s*12\.5px/);
  assert.match(cssNu, /\.sc-notif__heure \{[^}]*font-size:\s*12px[^}]*tabular-nums/);
  assert.match(cssNu, /@container \(max-width: 948px\)/, 'sous 1280 px de fenêtre, la colonne passe sous la liste');
  assert.match(cssNu, /prefers-reduced-motion: reduce/);
  assert.match(cssNu, /180ms/);
});

await dit('feuille : aucune couleur hexadécimale en dur, aucun jeton inconnu, aucune encre « discret » en texte, rien sous 10,5 px', () => {
  assert.doesNotMatch(cssNu, /#[0-9a-fA-F]{3,8}\b/, 'couleur en dur');
  const noir = lire('src/socle/noir.css');
  const jetonsNoir = new Set([...noir.matchAll(/(--[\w-]+):/g)].map((m) => m[1]));
  const locaux = new Set([...cssNu.matchAll(/(--sc-notif-[\w-]+):/g)].map((m) => m[1]));
  const locauxAutres = new Set(['--sc-notif-teinte']);
  const connus = new Set([...jetonsNoir, ...locaux, ...locauxAutres]);
  for (const [, nom] of cssNu.matchAll(/var\((--[\w-]+)/g)) assert.ok(connus.has(nom), `jeton inconnu : ${nom}`);
  const j = jetons(noir);
  assert.ok(j.size > 50);
  for (const regle of cssNu.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const corps = regle[2];
    assert.doesNotMatch(corps.replace(/border[\w-]*:[^;]*;|background[\w-]*:[^;]*;|outline[\w-]*:[^;]*;/g, ''), /(^|[;\s])color:\s*[^;]*(trait-discret|trait-tres-discret|77777c|5f5f64)/, `encre « discret » en texte : ${regle[1].trim()}`);
  }
  assert.doesNotMatch(cssNu, /color:\s*var\(--socle-trait/);
  for (const f of fichiersDuDossier.filter((x) => /\.tsx?$/.test(x))) assert.doesNotMatch(sansCommentaires(lire(f)), /trait-discret|trait-tres-discret|#77777c|#5f5f64|#777777|#5f5f5f/i, `${f} : encre « discret »`);
  for (const [, taille] of cssNu.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) assert.ok(Number(taille) >= 10.5, `texte de ${taille} px`);
  for (const f of fichiersDuDossier.filter((x) => /\.tsx$/.test(x))) assert.doesNotMatch(sansCommentaires(lire(f)), /#[0-9a-fA-F]{6}\b|style=\{\{[^}]*(?:color|background):\s*['"]#/, `${f} : couleur en dur`);
});

await dit('édition cliente : rien hors de ce dossier n’importe cette page, et la page n’importe que des zones permises', () => {
  const permis = /^(?:\.\/|\.\.\/\.\.\/\.\.\/(?:socle|lib|state|data|auth|shared|i18n)(?:\/|$)|\.\.\/\.\.\/\.\.\/socle\/|react|react-router-dom|lucide-react|framer-motion)/;
  for (const f of fichiersDuDossier.filter((x) => /\.tsx?$/.test(x))) {
    for (const [, spec] of sansCommentaires(lire(f)).matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)) assert.match(spec, permis, `${f} importe ${spec}`);
  }
  const dehors: string[] = [];
  const marcher = (dir: string) => {
    for (const e of fs.readdirSync(path.join(racine, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (rel !== 'src/refonte' && rel !== 'src/socle') marcher(rel); continue; }
      if (!/\.(tsx?|css)$/.test(e.name) || /\.internal\.tsx?$/.test(e.name)) continue;
      if (/systeme\/notifications/.test(lire(rel).replace(/\\/g, '/'))) dehors.push(rel);
    }
  };
  marcher('src');
  assert.deepEqual(dehors, [], 'un fichier partagé importe la page');
  const edition = JSON.parse(lire('package.json')) as { scripts: Record<string, string> };
  assert.equal(edition.scripts['check:systeme-notifications'], 'node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-systeme-notifications.ts');
});

fin();
