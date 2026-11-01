/**
 * Contrôle des JEUX DE DONNÉES FICTIVES — `src/refonte/donnees/`, exercés hors application.
 *
 * Ces jeux servent à construire et tester les écrans de la refonte. Ils ne
 * valent que s'ils sont (1) reproductibles, (2) sans la moindre donnée réelle,
 * (3) cohérents entre eux : une facture payée a son paiement, un client est
 * « Impayé » parce qu'une facture est échue, une série vient des tâches faites.
 *
 *   · même graine, mêmes données ; graine différente, données différentes ;
 *   · « vide » est vide, « beaucoup » dépasse « normal » ; un volume par jeu prime ;
 *   · aucun courriel hors `.exemple.test`, aucun téléphone hors plages fictives,
 *     aucun IBAN, numéro de carte, SIRET ni secret réalistes ;
 *   · toute référence (client, facture, fournisseur, membre…) existe ;
 *   · la numérotation des factures est continue et sans trou ;
 *   · les chiffres se recoupent (statut, solde, santé, points, avancement) ;
 *   · rien n'est daté dans le futur quand cela doit être passé, et inversement.
 *
 *   node --experimental-strip-types scripts/check-donnees.ts
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));

async function loadFromSrc<T>(entry: string): Promise<T> {
  const built = await esbuild.build({
    entryPoints: [path.join(here, '..', entry)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    target: 'node22',
    charset: 'utf8',
  });
  return (await import(
    `data:text/javascript;charset=utf-8;base64,${Buffer.from(built.outputFiles[0].text, 'utf8').toString('base64')}`
  )) as T;
}

type Lien = Record<string, unknown>;
type MondeBrut = Record<string, Lien[]> & { contexte: { aujourdhui: string; maintenant: number }; entreprise: Lien };
const D = await loadFromSrc<{
  construireMonde: (o?: Record<string, unknown>) => MondeBrut;
  NOMS_DES_JEUX: readonly string[];
  estCourrielFictif: (c: string) => boolean;
  estTelephoneFictif: (t: string) => boolean;
  totauxDeFacture: (f: unknown) => { htCents: number; tvaCents: number; ttcCents: number };
  statutAffiche: (f: unknown, j: string) => string;
  calculerSante: (c: unknown, d: unknown, j: string) => number;
  avancementProjet: (p: unknown, t: unknown) => number;
  statutProjet: (a: number, e: string, j: string, c: boolean) => string;
  journeesDeTravail: (t: unknown, email: string, jusqua: string, n?: number) => { jour: string; bouclee: boolean }[];
  serieEnCours: (j: unknown, aujourdhui: string) => number;
  jourDe: (ms: number) => string;
  ecartJours: (a: string, b: string) => number;
}>('src/refonte/donnees/index.ts');

let vus = 0;
const dit = (nom: string, fn: () => void) => {
  fn();
  vus += 1;
  console.log(`  ✓ ${nom}`);
};

const normal = D.construireMonde({ volume: 'normal' });
const gros = D.construireMonde({ volume: 'beaucoup' });
const peu = D.construireMonde({ volume: 'peu' });
const vide = D.construireMonde({ volume: 'vide' });
const jours = (m: MondeBrut): string => m.contexte.aujourdhui;
const str = (x: unknown): string => String(x ?? '');
const num = (x: unknown): number => Number(x);

console.log('Jeux de données fictives\n');

/* ----------------------------- Reproductibilité ----------------------------- */

console.log('Reproductibilité et volumes');
dit('même graine, mêmes données, à l’octet près', () => {
  assert.equal(JSON.stringify(D.construireMonde({ volume: 'normal' })), JSON.stringify(normal));
});
dit('une autre graine donne un autre monde', () => {
  assert.notEqual(JSON.stringify(D.construireMonde({ volume: 'normal', graine: 7 })), JSON.stringify(normal));
});
dit('« vide » est vide (sauf l’équipe : la personne connectée existe toujours)', () => {
  for (const nom of D.NOMS_DES_JEUX) {
    if (nom === 'equipe') assert.equal(vide[nom].length, 1, 'la personne connectée seule');
    else assert.equal(vide[nom].length, 0, `${nom} doit être vide`);
  }
});
dit('« peu » < « normal » < « beaucoup » pour les jeux principaux', () => {
  for (const nom of ['clients', 'factures', 'devis', 'depenses', 'notes', 'rappels', 'tickets', 'projets', 'avis', 'prospects']) {
    assert.ok(peu[nom].length > 0, `${nom} : « peu » n’est pas vide`);
    assert.ok(peu[nom].length < normal[nom].length, `${nom} : peu < normal`);
    assert.ok(normal[nom].length < gros[nom].length, `${nom} : normal < beaucoup`);
  }
  assert.ok(gros.clients.length >= 300 && gros.factures.length >= 600, '« beaucoup » dépasse largement une page d’écran');
});
dit('un volume propre à un jeu prime sur le volume général', () => {
  const m = D.construireMonde({ volume: 'normal', volumes: { clients: 'beaucoup', factures: 'vide' } });
  assert.equal(m.clients.length, gros.clients.length);
  assert.equal(m.factures.length, 0);
  assert.equal(m.paiements.length, 0, 'sans facture, aucun paiement');
});
dit('chaque jeu garde ses tirages quand on change le volume d’un autre', () => {
  const a = D.construireMonde({ volume: 'normal', volumes: { avis: 'vide' } });
  assert.equal(JSON.stringify(a.clients.map((c) => c.name)), JSON.stringify(normal.clients.map((c) => c.name)));
});
dit('la référence est le vendredi 30 octobre 2026', () => {
  assert.equal(jours(normal), '2026-10-30');
});
dit('un autre « maintenant » décale tout le monde de façon cohérente', () => {
  const m = D.construireMonde({ volume: 'normal', maintenant: Date.parse('2027-03-12T10:00:00Z') });
  assert.equal(jours(m), '2027-03-12');
  assert.ok(m.factures.every((f) => !f.issuedAt || str(f.issuedAt) <= '2027-03-12'));
});

/* ------------------------------ Aucune donnée réelle ------------------------------ */

console.log('\nAucune donnée réelle');
function feuilles(valeur: unknown, chemin: string, sortie: [string, string][]): void {
  if (typeof valeur === 'string') sortie.push([chemin, valeur]);
  else if (Array.isArray(valeur)) valeur.forEach((v, i) => feuilles(v, `${chemin}[${i}]`, sortie));
  else if (valeur && typeof valeur === 'object') for (const [k, v] of Object.entries(valeur)) feuilles(v, chemin ? `${chemin}.${k}` : k, sortie);
}
const textes: [string, string][] = [];
feuilles(gros, '', textes);
dit('tout courriel est en « .exemple.test »', () => {
  const courriels = textes.filter(([, v]) => /@/.test(v) && /^[^\s@]+@[^\s@]+$/.test(v));
  assert.ok(courriels.length > 1000, 'il y en a beaucoup à vérifier');
  const faux = courriels.filter(([, v]) => !D.estCourrielFictif(v));
  assert.deepEqual(faux.slice(0, 5), [], 'courriel hors domaine fictif');
});
dit('tout téléphone vient des plages réservées à la fiction (01 99 00 / 06 39 98)', () => {
  const tels = textes.filter(([c]) => /(^|\.)(phone|telephone)$/.test(c.replace(/\[\d+\]/g, '')));
  assert.ok(tels.length > 500);
  assert.deepEqual(tels.filter(([, v]) => !D.estTelephoneFictif(v)).slice(0, 5), []);
});
dit('toute adresse web est en « .exemple.test »', () => {
  const urls = textes.filter(([, v]) => /^https?:\/\//.test(v));
  assert.ok(urls.length > 100);
  assert.deepEqual(urls.filter(([, v]) => !/^https:\/\/([a-z0-9-]+\.)*exemple\.test(\/|$)/.test(v)).slice(0, 5), []);
});
dit('aucun IBAN, numéro de carte ni SIRET réaliste (les valeurs d’identité sont invalides par construction)', () => {
  const brut = textes.map(([, v]) => v).join('\n');
  assert.equal(/\b[A-Z]{2}\d{2}(?: ?\d{4}){3,}/.test(brut.replace(/FR00 0000 0000 0000 0000 0000 000/g, '')), false, 'IBAN');
  assert.equal(/\b(?:\d[ -]?){13,19}\b/.test(brut.replace(/000 000 000 00012/g, '').replace(/FR00 0000 0000 0000 0000 0000 000/g, '')), false, 'suite de 13 à 19 chiffres');
  const identite = gros.entreprise.identite as Lien;
  assert.match(str(identite.iban), /^FR00 /, 'clé d’IBAN à 00 : toujours invalide');
  assert.match(str(identite.siret), /^000 /, 'un SIREN ne commence jamais par 000');
  for (const c of gros.comptes) assert.match(str(c.ibanFin), /^\d{4}$/, 'seuls 4 chiffres sont gardés');
});
dit('aucun secret : ni clé, ni jeton, ni mot de passe, ni longue chaîne opaque', () => {
  const noms = new Set<string>();
  const cles = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(cles);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { noms.add(k); cles(x); }
  };
  cles(gros);
  assert.deepEqual([...noms].filter((k) => /secret|token|api[_-]?key|password|motdepasse|^cle(api)?$/i.test(k)), []);
  assert.deepEqual(textes.filter(([, v]) => /[A-Za-z0-9+/_=-]{32,}/.test(v)).slice(0, 3), [], 'chaîne opaque de 32 caractères ou plus');
  assert.deepEqual(textes.filter(([, v]) => /(sk|pk|rk)_(live|test)_|amn_live_/.test(v)), []);
});
dit('aucune photo ni pièce jointe réelle : les images sont vides', () => {
  assert.ok(gros.depenses.every((d) => str(d.photoDataUrl) === ''));
  assert.ok(gros.clients.every((c) => str(c.imageDataUrl) === ''));
});
dit('le domaine de l’entreprise d’exemple est fictif', () => {
  assert.match(str(gros.equipe[0].email), /@maison-vallon\.exemple\.test$/);
});

/* ------------------------------ Références ------------------------------ */

console.log('\nRéférences : tout ce qui est pointé existe');
const ids = (liste: Lien[], cle = 'id'): Set<unknown> => new Set(liste.map((x) => x[cle]));
dit('les identifiants sont uniques dans chaque jeu', () => {
  for (const nom of D.NOMS_DES_JEUX) {
    if (nom === 'relances' || nom === 'fidelite') continue;
    const l = gros[nom];
    assert.equal(ids(l).size, l.length, `${nom} : identifiants en double`);
  }
  assert.equal(new Set(gros.fidelite.map((f) => f.clientId)).size, gros.fidelite.length);
});
dit('les personnes citées (responsable, assigné, auteur…) sont de l’équipe', () => {
  const emails = new Set(gros.equipe.map((m) => m.email));
  const verifs: [string, string][] = [
    ['taches', 'assigneeEmail'], ['tickets', 'assigneeEmail'], ['clients', 'responsableEmail'], ['prospects', 'responsableEmail'],
    ['factures', 'responsableEmail'], ['depenses', 'auteurEmail'], ['notes', 'authorEmail'], ['rappels', 'pourEmail'], ['habitudes', 'proprietaireEmail'],
  ];
  for (const [jeu, champ] of verifs) assert.deepEqual(gros[jeu].filter((x) => !emails.has(x[champ])).slice(0, 2), [], `${jeu}.${champ}`);
  assert.ok(gros.evenements.every((e) => (e.participants as string[]).every((p) => emails.has(p))), 'participants');
  assert.ok(gros.projets.every((p) => (p.membres as string[]).every((e) => emails.has(e))), 'membres de projet');
});
dit('les clients cités existent (devis, factures, avis, abonnements, contrats, tickets, tâches, rendez-vous)', () => {
  const clients = ids(gros.clients);
  for (const jeu of ['devis', 'factures', 'avis', 'abonnements', 'contrats', 'fidelite']) assert.ok(gros[jeu].every((x) => clients.has(x.clientId)), jeu);
  for (const jeu of ['tickets', 'taches', 'evenements', 'relances']) assert.ok(gros[jeu].every((x) => x.clientId === null || x.clientId === undefined || clients.has(x.clientId)), jeu);
});
dit('les fournisseurs, projets, factures et paiements cités existent', () => {
  assert.ok(gros.achats.every((a) => ids(gros.fournisseurs).has(a.fournisseurId)), 'achats → fournisseurs');
  assert.ok(gros.taches.every((t) => t.projectId === null || ids(gros.projets).has(t.projectId)), 'tâches → projets');
  assert.ok(gros.paiements.every((p) => p.factureId === null || ids(gros.factures).has(p.factureId)), 'paiements → factures');
  assert.ok(gros.factures.every((f) => f.quoteId === null || ids(gros.devis).has(f.quoteId)), 'factures → devis');
  assert.ok(gros.mouvements.every((m) => ids(gros.comptes).has(m.compteId)), 'mouvements → comptes');
  const lien = (type: string, jeu: string) => gros.mouvements.filter((m) => (m.lien as Lien).type === type).every((m) => ids(gros[jeu]).has((m.lien as Lien).id));
  assert.ok(lien('paiement', 'paiements') && lien('depense', 'depenses') && lien('abonnement', 'abonnements') && lien('facture', 'factures'), 'liens des mouvements');
});
dit('un seul « moi » dans l’équipe', () => {
  for (const m of [vide, peu, normal, gros]) assert.equal(m.equipe.filter((x) => x.moi).length, 1);
});

/* ------------------------------ Factures et argent ------------------------------ */

console.log('\nL’argent se recoupe');
const aujourdhui = jours(normal);
dit('numérotation continue sans trou, par année, dans l’ordre d’émission ; les brouillons n’ont pas de numéro', () => {
  const emises = gros.factures.filter((f) => f.status !== 'draft').sort((a, b) => str(a.number).localeCompare(str(b.number)));
  const parAn = new Map<string, number[]>();
  for (const f of emises) {
    const m = /^F-(\d{4})-(\d{4})$/.exec(str(f.number));
    assert.ok(m, `numéro mal formé : ${str(f.number)}`);
    parAn.set(m[1], [...(parAn.get(m[1]) ?? []), Number(m[2])]);
  }
  for (const [an, suite] of parAn) assert.deepEqual(suite, suite.map((_, i) => i + 1), `trou dans la numérotation de ${an}`);
  assert.ok(gros.factures.filter((f) => f.status === 'draft').every((f) => str(f.number) === '' && str(f.issuedAt) === ''), 'brouillons');
  for (const an of parAn.keys()) {
    const dates = emises.filter((f) => str(f.number).includes(`-${an}-`)).map((f) => str(f.issuedAt));
    assert.ok(dates.every((d) => d.startsWith(an)), `une facture ${an} n’est pas émise en ${an}`);
  }
  assert.ok(emises.length > 500);
});
dit('chronologie : échéance après émission, paiement après émission, rien de payé dans le futur', () => {
  for (const f of gros.factures.filter((x) => x.status !== 'draft')) {
    assert.ok(str(f.dueAt) >= str(f.issuedAt), 'échéance avant émission');
    assert.ok(str(f.issuedAt) <= aujourdhui, 'émise dans le futur');
    if (f.status === 'paid') assert.ok(str(f.paidAt) >= str(f.issuedAt) && str(f.paidAt) <= aujourdhui, `paiement invalide ${str(f.number)}`);
    else assert.equal(str(f.paidAt), '');
    if (f.status === 'cancelled') assert.ok(str(f.cancelReason).length > 0, 'annulation sans motif');
  }
});
dit('le solde dû vaut le TTC d’une facture envoyée, zéro sinon ; les totaux sont en centimes entiers', () => {
  for (const f of gros.factures) {
    const t = D.totauxDeFacture(f);
    assert.ok(Number.isInteger(t.htCents) && Number.isInteger(t.tvaCents));
    assert.equal(t.ttcCents, t.htCents + t.tvaCents);
    assert.equal(num(f.soldeCents), f.status === 'issued' ? t.ttcCents : 0);
  }
});
dit('le statut « En retard » se déduit (envoyée + échéance passée) ; il y en a, mais peu', () => {
  const retard = gros.factures.filter((f) => D.statutAffiche(f, aujourdhui) === 'En retard');
  assert.ok(retard.length >= 10, 'MA04 a besoin d’impayés à montrer');
  assert.ok(retard.length < gros.factures.length * 0.2, 'trop d’impayés pour être plausible');
  assert.ok(retard.every((f) => f.status === 'issued' && str(f.dueAt) < aujourdhui));
  const normalRetard = normal.factures.filter((f) => D.statutAffiche(f, aujourdhui) === 'En retard').length;
  assert.ok(normalRetard >= 2, `au volume « normal », il faut au moins 2 impayés (${normalRetard})`);
});
dit('un devis accepté donne au plus une facture, émise après l’acceptation ; son règlement suit celle de la facture', () => {
  const parDevis = new Map<unknown, Lien[]>();
  for (const f of gros.factures.filter((x) => x.quoteId !== null)) parDevis.set(f.quoteId, [...(parDevis.get(f.quoteId) ?? []), f]);
  for (const [id, fs] of parDevis) {
    assert.equal(fs.length, 1, `devis ${id} facturé plusieurs fois`);
    const d = gros.devis.find((x) => x.id === id) as Lien;
    assert.equal(d.status, 'accepted', 'un devis non accepté ne se facture pas');
    assert.ok(str(fs[0].issuedAt) > str(d.acceptéLe), 'facture avant acceptation');
    const attendu = fs[0].status === 'paid' ? 'paid' : fs[0].status === 'issued' ? (str(fs[0].dueAt) < aujourdhui ? 'late' : 'pending') : 'unpaid';
    assert.equal(d.paymentStatus, attendu);
  }
  assert.ok(parDevis.size > 50);
});
dit('chaque paiement correspond à une facture réglée (ou en attente sur une facture due), au même montant', () => {
  for (const p of gros.paiements) {
    const f = gros.factures.find((x) => x.id === p.factureId) as Lien;
    assert.ok(f, 'paiement sans facture');
    assert.equal(num(p.montantCents), D.totauxDeFacture(f).ttcCents, 'montant du paiement ≠ TTC de la facture');
    if (p.etat === 'réussi' || p.etat === 'remboursé') assert.equal(f.status, 'paid');
    if (p.etat === 'en attente') assert.equal(f.status, 'issued');
    assert.ok(str(p.date).slice(0, 10) <= aujourdhui, 'paiement dans le futur');
    assert.ok(num(p.fraisCents) >= 0 && (p.moyen === 'carte' || num(p.fraisCents) === 0), 'frais hors carte');
  }
  const reussies = new Set(gros.paiements.filter((p) => p.etat === 'réussi' || p.etat === 'remboursé').map((p) => p.factureId));
  const payees = gros.factures.filter((f) => f.status === 'paid');
  const complet = D.construireMonde({ volume: 'normal', volumes: { paiements: 'beaucoup' } });
  const c2 = new Set(complet.paiements.filter((p) => p.etat === 'réussi' || p.etat === 'remboursé').map((p) => p.factureId));
  assert.ok(complet.factures.filter((f) => f.status === 'paid').every((f) => c2.has(f.id)), 'une facture payée sans paiement');
  assert.ok(reussies.size > 0 && payees.length > 0);
});
dit('les mouvements bancaires : réels dans le passé, prévus dans le futur, entrées positives pour les règlements', () => {
  for (const m of gros.mouvements) {
    if (m.reel) assert.ok(str(m.date) <= aujourdhui, `mouvement réel futur ${str(m.libelle)}`);
    else assert.ok(str(m.date) >= aujourdhui, `mouvement prévu passé ${str(m.libelle)}`);
    assert.ok(Number.isInteger(num(m.montantCents)) && num(m.montantCents) !== 0);
    const type = (m.lien as Lien).type;
    if (type === 'paiement' || type === 'facture' || type === 'abonnement') assert.ok(num(m.montantCents) > 0, 'une entrée est positive');
    if (type === 'depense') assert.ok(num(m.montantCents) < 0, 'une dépense est négative');
  }
  assert.ok(gros.mouvements.some((m) => !m.reel) && gros.mouvements.some((m) => m.reel));
  assert.ok(gros.comptes.every((c) => Number.isInteger(num(c.soldeCents)) && num(c.soldeCents) > 0));
});
dit('dépenses : TVA < montant, justificatif cohérent, plus d’« à justifier » au dernier mois', () => {
  for (const d of gros.depenses) {
    assert.ok(num(d.tvaCents) > 0 && num(d.tvaCents) < num(d.amountCents));
    const j = d.justificatif as Lien;
    assert.equal(j.statut === 'justifié', j.fichier !== null);
    assert.ok(str(d.spentAt) <= aujourdhui);
  }
  const recent = gros.depenses.filter((d) => str(d.spentAt) >= '2026-10-01');
  assert.ok(recent.some((d) => (d.justificatif as Lien).statut === 'à justifier'), 'H08 « Reste à justifier » a besoin d’en voir');
});
dit('enveloppes : le budget mensuel de l’entreprise en est la somme', () => {
  const total = normal.enveloppes.reduce((s, e) => s + num(e.prevuCents), 0);
  assert.equal(num((normal.entreprise.reglages as Lien).budgetMensuelDepensesCents), total);
  assert.ok(normal.enveloppes.every((e) => num(e.prevuCents) >= 5000));
});
dit('abonnements : prochain prélèvement dans le futur pour ceux qui sont actifs, aucun pour les résiliés', () => {
  for (const a of gros.abonnements) {
    if (a.etat === 'Actif' || a.etat === 'Paiement échoué') assert.ok(str(a.prochainPrelevementLe) > aujourdhui);
    else assert.equal(a.prochainPrelevementLe, null);
    assert.equal(a.etat === 'Résilié', a.resilieLe !== null);
  }
});
dit('contrats : l’état suit l’échéance', () => {
  for (const c of gros.contrats.filter((x) => x.etat !== 'Résilié')) {
    const reste = D.ecartJours(aujourdhui, str(c.echeanceLe));
    const attendu = reste < 0 ? 'Expiré' : reste <= 60 ? 'À renouveler' : 'En cours';
    assert.equal(c.etat, attendu, `${str(c.nom)} : ${reste} jours`);
  }
});

/* ------------------------------ Contacts ------------------------------ */

console.log('\nContacts');
dit('la santé est entre 0 et 100 et se recalcule avec la formule de la fiche H05', () => {
  const donnees = { factures: gros.factures, devis: gros.devis, avis: gros.avis };
  for (const c of gros.clients) {
    assert.ok(num(c.sante) >= 0 && num(c.sante) <= 100);
    assert.equal(D.calculerSante(c, donnees, jours(gros)), c.sante);
  }
  const sante = gros.clients.map((c) => num(c.sante));
  assert.ok(sante.some((s) => s >= 70) && sante.some((s) => s >= 45 && s < 70) && sante.some((s) => s < 45), 'vert, orange et rouge doivent exister (H05)');
});
dit('« Impayé » si et seulement si une facture envoyée est échue ; « À relancer » sinon quand l’échange est ancien', () => {
  for (const c of gros.clients) {
    const impaye = gros.factures.some((f) => f.clientId === c.id && f.status === 'issued' && str(f.dueAt) < jours(gros));
    if (impaye) assert.equal(c.statutAffiche, 'Impayé');
    else assert.notEqual(c.statutAffiche, 'Impayé');
    const depuis = D.ecartJours(D.jourDe(Date.parse(str(c.dernierEchangeAt))), jours(gros));
    if (!impaye && (depuis > 5 || num(c.sante) < 45)) assert.equal(c.statutAffiche, 'À relancer');
    if (!impaye && depuis <= 5 && num(c.sante) >= 45) assert.equal(c.statutAffiche, 'Actif');
  }
  const statuts = new Set(gros.clients.map((c) => c.statutAffiche));
  assert.deepEqual([...statuts].sort(), ['Actif', 'Impayé', 'À relancer']);
});
dit('le dernier échange n’est jamais dans le futur ni avant le début de la relation', () => {
  for (const c of gros.clients) {
    assert.ok(Date.parse(str(c.dernierEchangeAt)) <= gros.contexte.maintenant, 'échange futur');
    assert.ok(str(c.debutLe) <= jours(gros));
    assert.equal((c.events as Lien[]).length >= 2, true);
  }
});
dit('prospects : probabilité selon l’étape, signatures du mois, montants entiers', () => {
  const proba: Record<string, number> = { nouveau: 10, contacté: 25, 'rendez-vous': 45, 'devis envoyé': 70, gagné: 100, perdu: 0 };
  for (const p of gros.prospects) {
    assert.equal(p.probabilite, proba[str(p.etape)]);
    assert.equal(p.etape === 'gagné', p.signeLe !== null);
    assert.equal(p.etape === 'perdu', p.perduLe !== null);
    if (p.montantCents !== null) assert.ok(Number.isInteger(num(p.montantCents)) && num(p.montantCents) > 0);
  }
  const duMois = normal.prospects.filter((p) => p.signeLe && str(p.signeLe).slice(0, 7) === jours(normal).slice(0, 7));
  assert.ok(duMois.length >= 1, 'H06 « Gagné ce mois » ne doit pas être vide au volume normal');
  assert.ok(new Set(normal.prospects.map((p) => p.etape)).size >= 5, 'toutes les colonnes du pipeline sont représentées');
});
dit('avis : notes de 1 à 5, dates passées, ordre du plus récent au plus ancien', () => {
  for (const a of gros.avis) assert.ok(num(a.noteSur5) >= 1 && num(a.noteSur5) <= 5 && str(a.date) <= jours(gros));
  const dates = gros.avis.map((a) => str(a.date));
  assert.deepEqual(dates, [...dates].sort().reverse());
});
dit('achats : réception après commande, jamais dans le futur ; total = quantité × prix unitaire', () => {
  for (const a of gros.achats) {
    assert.equal(num(a.totalCents), num(a.quantite) * num(a.prixUnitaireCents));
    if (a.recuLe) assert.ok(str(a.recuLe) >= str(a.commandeLe) && str(a.recuLe) <= jours(gros));
  }
});
dit('relances : chacune pointe un objet réellement en retard ; tri par montant décroissant', () => {
  const retard = new Set(gros.factures.filter((f) => D.statutAffiche(f, jours(gros)) === 'En retard').map((f) => f.id));
  for (const r of gros.relances.filter((x) => x.motif === 'facture')) assert.ok(retard.has(r.objetId), 'relance d’une facture qui n’est pas en retard');
  const montants = gros.relances.map((r) => (r.montantCents === null ? -1 : num(r.montantCents)));
  assert.deepEqual(montants, [...montants].sort((a, b) => b - a));
  assert.ok(new Set(gros.relances.map((r) => r.motif)).size >= 3, 'plusieurs motifs');
});
dit('fidélité : 1 point par euro encaissé sur 12 mois ; niveaux Bronze < 500 ≤ Argent < 1 500 ≤ Or', () => {
  const depuis = `${Number(jours(gros).slice(0, 4)) - 1}${jours(gros).slice(4)}`;
  for (const f of gros.fidelite) {
    const pts = gros.factures.filter((x) => x.clientId === f.clientId && x.status === 'paid' && str(x.paidAt) >= depuis).reduce((s, x) => s + Math.floor(D.totauxDeFacture(x).ttcCents / 100), 0);
    assert.equal(f.points, pts);
    assert.equal(f.niveau, pts >= 1500 ? 'Or' : pts >= 500 ? 'Argent' : 'Bronze');
  }
  assert.deepEqual(new Set(gros.fidelite.map((f) => f.niveau)).size >= 2, true);
});

/* ------------------------------ Ma journée ------------------------------ */

console.log('\nMa journée');
const moiEmail = str(normal.equipe.find((m) => m.moi)?.email);
dit('aujourd’hui : des tâches faites ce matin, d’autres à faire, et des tâches en retard', () => {
  const duJour = normal.taches.filter((t) => t.echeance === aujourdhui && t.assigneeEmail === moiEmail);
  assert.ok(duJour.length >= 3, `tâches du jour : ${duJour.length}`);
  assert.ok(duJour.some((t) => t.status === 'done') && duJour.some((t) => t.status !== 'done'));
  assert.ok(normal.taches.some((t) => t.status !== 'done' && str(t.echeance) < aujourdhui && t.assigneeEmail === moiEmail), 'H02 « En retard »');
});
dit('une tâche faite a une date de fin passée ; une tâche à faire n’en a pas', () => {
  for (const t of gros.taches) {
    if (t.status === 'done') {
      assert.ok(t.faiteAt && Date.parse(str(t.faiteAt)) <= gros.contexte.maintenant, `tâche faite dans le futur : ${str(t.title)}`);
      assert.ok((t.sousTaches as { done: boolean }[]).every((s) => s.done), 'sous-tâche ouverte sur une tâche faite');
    } else assert.equal(t.faiteAt, null);
  }
});
dit('la série vient des tâches : calculée, positive au volume normal, nulle sans tâche', () => {
  const j = D.journeesDeTravail(normal.taches, moiEmail, aujourdhui, 90);
  assert.ok(j.length > 20);
  const serie = D.serieEnCours(j, aujourdhui);
  assert.ok(serie >= 0 && serie <= j.length);
  assert.ok(j.some((x) => x.bouclee) && j.some((x) => !x.bouclee), 'des journées bouclées et d’autres non');
  assert.equal(D.serieEnCours(D.journeesDeTravail(vide.taches, moiEmail, aujourdhui), aujourdhui), 0);
  const rompue = D.serieEnCours([{ jour: '2026-10-29', bouclee: false }, { jour: '2026-10-28', bouclee: true }] as never, aujourdhui);
  assert.equal(rompue, 0, 'une journée non bouclée rompt la série');
});
dit('projets : le statut suit l’avancement et l’échéance (règle de MJ01) ; chaque statut existe', () => {
  for (const p of gros.projets) {
    const liees = gros.taches.filter((t) => t.projectId === p.id);
    const av = D.avancementProjet(p, gros.taches);
    assert.equal(p.status, D.statutProjet(av, str(p.deadline), jours(gros), liees.some((t) => t.status !== 'todo')));
  }
  assert.deepEqual([...new Set(gros.projets.map((p) => p.status))].sort(), ['En cours', 'En retard', 'Presque fini', 'Terminé', 'À démarrer']);
  assert.ok(normal.projets.some((p) => p.status === 'En retard'), 'MJ01 montre un projet en retard');
});
dit('événements : fin = début + durée, rendez-vous manqués annulés, rondes marquées « système »', () => {
  for (const e of gros.evenements) {
    assert.equal(Date.parse(str(e.endAt)) - Date.parse(str(e.startAt)), num(e.durationMin) * 60_000);
    if (e.confirmation === 'manqué') assert.equal(e.status, 'cancelled');
    if (e.type === 'système') assert.equal(e.systeme, true);
    else assert.equal(e.systeme, false);
    if (e.status === 'done') assert.ok(Date.parse(str(e.endAt)) <= gros.contexte.maintenant);
    if (e.status === 'scheduled') assert.ok(Date.parse(str(e.endAt)) > gros.contexte.maintenant, `événement passé encore « prévu » : ${str(e.title)}`);
  }
  const duJour = normal.evenements.filter((e) => D.jourDe(Date.parse(str(e.startAt))) === aujourdhui);
  assert.ok(duJour.length >= 3 && duJour.some((e) => e.systeme) && duJour.some((e) => e.status === 'done') && duJour.some((e) => e.status === 'scheduled'), 'la journée type : passé, à venir, ronde');
});
dit('tickets : un seul rang par colonne, aucun urgent terminé, des urgents ouverts, des tickets partagés', () => {
  const vus = new Set<string>();
  for (const t of gros.tickets) {
    const cle = `${str(t.colonne)}:${num(t.ordre)}`;
    assert.ok(!vus.has(cle), `rang en double ${cle}`);
    vus.add(cle);
    if (t.colonne === 'termine') { assert.equal(t.urgent, false); assert.ok(t.termineLe); }
    else assert.equal(t.termineLe, null);
    const s = t.sousTaches as { faites: number; total: number };
    assert.ok(s.faites <= s.total);
  }
  assert.ok(normal.tickets.some((t) => t.urgent) && normal.tickets.some((t) => t.partageClient));
  assert.ok(new Set(normal.tickets.map((t) => t.colonne)).size === 4, 'les quatre colonnes sont remplies');
});
dit('rappels : un en retard, des à venir, des faits ; ceux liés à une facture pointent une facture en retard', () => {
  const retard = normal.rappels.filter((r) => !r.fait && Date.parse(str(r.quandAt)) < normal.contexte.maintenant);
  assert.ok(retard.length >= 1 && normal.rappels.some((r) => !r.fait && Date.parse(str(r.quandAt)) > normal.contexte.maintenant) && normal.rappels.some((r) => r.fait));
  for (const r of gros.rappels) {
    if (r.fait) assert.ok(Date.parse(str(r.faitAt)) <= gros.contexte.maintenant, 'rappel fait dans le futur');
    const lien = r.lien as Lien;
    if (lien.type === 'facture') assert.equal(D.statutAffiche(gros.factures.find((f) => f.id === lien.id), jours(gros)), 'En retard');
  }
});
dit('notes : titre non vide, les épinglées sont plusieurs, une note d’équipe a un auteur de l’équipe', () => {
  assert.ok(gros.notes.every((n) => str(n.title).length > 0 && str(n.body).length > 0));
  assert.ok(gros.notes.filter((n) => n.pinned).length >= 3);
  assert.ok(gros.notes.every((n, i, l) => i === 0 || str(l[i - 1].updatedAt) >= str(n.updatedAt)), 'tri : modification la plus récente d’abord');
});
dit('habitudes : historique daté d’aujourd’hui au plus tard, après le début ; valeurs en entiers positifs', () => {
  for (const h of gros.habitudes) {
    for (const [jour, v] of Object.entries(h.historique as Record<string, number>)) {
      assert.ok(jour <= jours(gros) && jour >= str(h.debut), `${str(h.nom)} : ${jour}`);
      assert.ok(Number.isInteger(v) && v > 0);
    }
  }
  assert.ok(gros.habitudes.length >= 8);
});

dit('le français est correct : élision après « de », pas de modèle non remplacé, pas de double espace', () => {
  const titres = [...gros.taches.map((t) => str(t.title)), ...gros.notes.flatMap((n) => [str(n.title), str(n.body)]), ...gros.projets.map((p) => str(p.title)), ...gros.evenements.map((e) => str(e.title)), ...gros.relances.map((r) => str(r.message))];
  assert.deepEqual(titres.filter((t) => /\bde [AEIOUYÀÂÉÈÊÎÔÛ]/.test(t)).slice(0, 3), [], 'il manque une élision');
  assert.deepEqual(titres.filter((t) => /[{}]/.test(t) || / {2}/.test(t) || /undefined|null|NaN/.test(t)).slice(0, 3), [], 'modèle mal rempli');
  for (const [, v] of textes) assert.ok(!/undefined|NaN|\[object/.test(v), `valeur mal formée : ${v.slice(0, 40)}`);
});

/* ------------------------------ Équipe ------------------------------ */

console.log('\nÉquipe et entreprise');
dit('les six personnes écrites à la main sont stables ; la dirigeante est « moi »', () => {
  const six = normal.equipe.map((m) => m.nomComplet);
  assert.deepEqual(six, ['Camille Roux', 'Hugo Marchand', 'Nadia Bensalah', 'Léa Dubois', 'Yanis Garcia', 'Inès Traoré']);
  assert.equal(normal.equipe[0].moi, true);
  assert.equal(gros.equipe.length, 24);
  assert.equal(new Set(gros.equipe.map((m) => m.email)).size, 24, 'courriels uniques');
});
dit('l’astreinte est une personne de l’équipe ; le taux de TVA par défaut est 20 %', () => {
  const r = normal.entreprise.reglages as Lien;
  assert.ok(normal.equipe.some((m) => m.email === r.astreinteEmail));
  assert.equal((r.tauxTva as number[])[0], 20);
});

/* ------------------------------ Autres graines, autres volumes ------------------------------ */

console.log('\nPlusieurs graines et tous les volumes');

/** Les invariants qui ne doivent JAMAIS dépendre du tirage : une violation ne se voit parfois qu'avec une graine. */
function invariants(m: MondeBrut, nom: string): void {
  const auj = jours(m);
  const maintenant = m.contexte.maintenant;
  const clients = ids(m.clients);
  const emails = new Set(m.equipe.map((x) => x.email));
  // Références
  for (const jeu of ['devis', 'factures', 'avis', 'abonnements', 'contrats', 'fidelite']) assert.ok(m[jeu].every((x) => clients.has(x.clientId)), `${nom} : ${jeu} → client`);
  assert.ok(m.paiements.every((p) => ids(m.factures).has(p.factureId)), `${nom} : paiement → facture`);
  assert.ok(m.taches.every((t) => emails.has(t.assigneeEmail)), `${nom} : tâche → membre`);
  // Factures : numérotation, chronologie, solde
  const parAn = new Map<string, number[]>();
  for (const f of m.factures) {
    const t = D.totauxDeFacture(f);
    assert.equal(num(f.soldeCents), f.status === 'issued' ? t.ttcCents : 0, `${nom} : solde`);
    if (f.status === 'draft') { assert.equal(str(f.number), ''); continue; }
    assert.ok(str(f.dueAt) >= str(f.issuedAt) && str(f.issuedAt) <= auj, `${nom} : dates ${str(f.number)}`);
    if (f.status === 'paid') assert.ok(str(f.paidAt) >= str(f.issuedAt) && str(f.paidAt) <= auj, `${nom} : paiement ${str(f.number)}`);
    const mt = /^F-(\d{4})-(\d{4})$/.exec(str(f.number));
    assert.ok(mt, `${nom} : numéro ${str(f.number)}`);
    parAn.set(mt[1], [...(parAn.get(mt[1]) ?? []), Number(mt[2])]);
  }
  for (const [an, suite] of parAn) assert.deepEqual([...suite].sort((a, b) => a - b), suite.map((_, i) => i + 1), `${nom} : trou en ${an}`);
  for (const p of m.paiements) assert.equal(num(p.montantCents), D.totauxDeFacture(m.factures.find((f) => f.id === p.factureId)).ttcCents, `${nom} : montant du paiement`);
  // Passé et futur
  for (const t of m.taches) if (t.status === 'done') assert.ok(Date.parse(str(t.faiteAt)) <= maintenant, `${nom} : tâche faite dans le futur`);
  for (const r of m.rappels) if (r.fait) assert.ok(Date.parse(str(r.faitAt)) <= maintenant, `${nom} : rappel fait dans le futur`);
  for (const e of m.evenements) {
    if (e.status === 'scheduled') assert.ok(Date.parse(str(e.endAt)) > maintenant, `${nom} : événement passé « prévu »`);
    if (e.status === 'done') assert.ok(Date.parse(str(e.endAt)) <= maintenant, `${nom} : événement futur « fait »`);
  }
  for (const mv of m.mouvements) assert.ok(mv.reel ? str(mv.date) <= auj : str(mv.date) >= auj, `${nom} : mouvement ${mv.reel ? 'réel futur' : 'prévu passé'}`);
  for (const d of m.depenses) assert.ok(str(d.spentAt) <= auj && num(d.tvaCents) < num(d.amountCents), `${nom} : dépense`);
  // Clients : statut et santé
  const donnees = { factures: m.factures, devis: m.devis, avis: m.avis };
  for (const c of m.clients) {
    assert.equal(D.calculerSante(c, donnees, auj), c.sante, `${nom} : santé`);
    const impaye = m.factures.some((f) => f.clientId === c.id && f.status === 'issued' && str(f.dueAt) < auj);
    assert.equal(c.statutAffiche === 'Impayé', impaye, `${nom} : statut Impayé`);
    assert.ok(Date.parse(str(c.dernierEchangeAt)) <= maintenant, `${nom} : échange futur`);
  }
  // Projets
  for (const p of m.projets) {
    const liees = m.taches.filter((t) => t.projectId === p.id);
    assert.equal(p.status, D.statutProjet(D.avancementProjet(p, m.taches), str(p.deadline), auj, liees.some((t) => t.status !== 'todo')), `${nom} : statut de projet`);
  }
  // Tickets
  assert.ok(m.tickets.every((t) => !(t.urgent && t.colonne === 'termine')), `${nom} : urgent terminé`);
  assert.equal(new Set(m.tickets.map((t) => `${str(t.colonne)}:${num(t.ordre)}`)).size, m.tickets.length, `${nom} : rang en double`);
}

dit('les invariants tiennent pour 12 graines, aux volumes « peu » et « normal »', () => {
  for (let graine = 1; graine <= 12; graine += 1) for (const volume of ['peu', 'normal'] as const) invariants(D.construireMonde({ graine, volume }), `graine ${graine}, ${volume}`);
});
dit('… et pour 4 graines au volume « beaucoup »', () => {
  for (const graine of [101, 202, 303, 404]) invariants(D.construireMonde({ graine, volume: 'beaucoup' }), `graine ${graine}, beaucoup`);
});
dit('… et à d’autres dates de référence (hiver, été, changement d’heure)', () => {
  for (const jour of ['2026-03-29T10:00:00Z', '2026-07-14T09:00:00Z', '2026-10-25T11:30:00Z', '2027-01-04T08:00:00Z']) invariants(D.construireMonde({ volume: 'normal', maintenant: Date.parse(jour) }), `date ${jour}`);
});
dit('chaque volume montre les cas que les écrans attendent (au moins un impayé, un projet en retard…) dès « peu » ou « normal »', () => {
  for (let graine = 1; graine <= 12; graine += 1) {
    const p = D.construireMonde({ graine, volume: 'peu' });
    const n = D.construireMonde({ graine, volume: 'normal' });
    const auj = jours(n);
    const nom = `graine ${graine}`;
    assert.ok(p.factures.some((f) => D.statutAffiche(f, auj) === 'En retard'), `${nom}, peu : aucun impayé`);
    assert.ok(n.factures.filter((f) => D.statutAffiche(f, auj) === 'En retard').length >= 2, `${nom}, normal : moins de 2 impayés`);
    for (const statut of ['Brouillon', 'Envoyée', 'Payée', 'Annulée']) assert.ok(n.factures.some((f) => D.statutAffiche(f, auj) === statut), `${nom}, normal : aucune facture « ${statut} »`);
    assert.ok(p.taches.some((t) => t.echeance === auj) && p.evenements.some((e) => D.jourDe(Date.parse(str(e.startAt))) === auj), `${nom}, peu : rien aujourd’hui`);
    assert.ok(n.taches.some((t) => t.status !== 'done' && str(t.echeance) < auj), `${nom}, normal : aucune tâche en retard`);
    assert.ok(n.rappels.some((r) => !r.fait && Date.parse(str(r.quandAt)) < n.contexte.maintenant), `${nom}, normal : aucun rappel en retard`);
    assert.ok(new Set(n.clients.map((c) => c.statutAffiche)).size === 3, `${nom}, normal : les trois statuts de client`);
    assert.ok(n.relances.length >= 3, `${nom}, normal : trop peu de relances`);
    assert.ok(n.paiements.some((p) => p.etat === 'réussi' && str(p.date).slice(0, 10) === auj), `${nom}, normal : rien d’encaissé aujourd’hui (N01)`);
  }
});

console.log(`\n${vus} contrôles, tous au vert.`);
