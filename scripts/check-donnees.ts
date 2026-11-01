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
  etatOrganisation: (score: number, alertes: string[], derniere: string, intervalleH: number, maintenant: number) => string;
  etatAccord: (a: unknown, aujourdhui: string) => string;
  outilDisponible: (o: unknown, accords: unknown[], aujourdhui: string) => boolean;
  quantiteEnStock: (a: unknown) => number;
  scoreMaturite: (c: unknown) => number;
  niveauMaturite: (s: number) => { niveau: number; nom: string };
  niveauConformite: (d: unknown) => string;
  joursSansImpaye: (f: unknown, j: string) => number;
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
  const cles = (v: unknown, profondeur = 0): void => {
    if (Array.isArray(v)) v.forEach((x) => cles(x, profondeur + 1));
    else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        // Le contexte nomme les jeux (dont `secrets`, le coffre-fort de H24) et le conteneur du coffre porte son nom : on contrôle les CHAMPS des enregistrements.
        if (profondeur === 0 && (k === 'contexte' || k === 'secrets')) { if (k === 'secrets') cles(x, profondeur + 1); continue; }
        noms.add(k);
        cles(x, profondeur + 1);
      }
    }
  };
  cles(gros);
  assert.deepEqual([...noms].filter((k) => /secret|token|api[_-]?key|password|motdepasse|^cle(api)?$/i.test(k)), []);
  // Le coffre-fort n'a ni valeur ni clé : un nom, un type, un responsable, des dates, et une valeur toujours masquée.
  for (const s of gros.secrets) {
    assert.equal(s.valeur, '••••••••', 'valeur d’un secret non masquée');
    assert.deepEqual(Object.keys(s).sort(), ['dernierUsageAt', 'id', 'nom', 'renouveleLe', 'responsableEmail', 'type', 'valeur']);
  }
  for (const c of gros.connecteurs) assert.ok(!('cle' in c) && !('secret' in c) && !('jeton' in c), 'un connecteur n’a aucune clé');
  for (const c of gros.sauvegardes) assert.ok(!('chemin' in c) && !('url' in c) && !('bucket' in c), 'une sauvegarde n’a aucun chemin');
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


/* ============================ La suite : Écrire, Échanger, Créer, Outils, La Garde, Cyber ============================ */

console.log('\nLa suite');

const OUTILS_REELS = /\b(nmap|metasploit|burp|wireshark|kali|shodan|maltego|hydra|sqlmap|nessus|openvas|mimikatz|cobalt ?strike|hashcat|aircrack|nikto|john the ripper|zaproxy|gophish|virustotal|splunk|crowdstrike|palo alto|fortinet|cisco)\b/i;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;

dit('chaque nouveau jeu existe, vide au volume « vide », rempli aux autres', () => {
  const suite = D.NOMS_DES_JEUX.slice(D.NOMS_DES_JEUX.indexOf('echeancesFiscales'));
  assert.ok(suite.length >= 60, `${suite.length} jeux dans la suite`);
  for (const nom of suite) {
    assert.equal(vide[nom].length, 0, `${nom} doit être vide`);
    assert.ok(gros[nom].length > 0, `${nom} : « beaucoup » est vide`);
    assert.ok(normal[nom].length > 0, `${nom} : « normal » est vide`);
    assert.ok(peu[nom].length > 0 || ['trackers', 'unites'].includes(nom), `${nom} : « peu » est vide`);
  }
});

dit('aucun nom d’outil de sécurité réel, aucune adresse IP, aucun vrai identifiant de faille', () => {
  const brut = textes.map(([, v]) => v).join('\n');
  assert.equal(OUTILS_REELS.test(brut), false, `nom d’outil réel : ${OUTILS_REELS.exec(brut)?.[0]}`);
  assert.equal(IPV4.test(brut.replace(/\b\d+\.\d+\.\d+\b/g, '')), false, 'adresse IP');
  assert.equal(/CVE-\d{4}-\d+/i.test(brut), false, 'identifiant CVE réel');
  for (const v of [...gros.vulnerabilites, ...gros.alertesVeille]) assert.match(str(v.idFictif), /^FICT-\d{4}-\d{4}$/);
  assert.equal(new Set([...gros.vulnerabilites, ...gros.alertesVeille].map((v) => v.idFictif)).size, gros.vulnerabilites.length + gros.alertesVeille.length, 'identifiants fictifs uniques');
});

dit('aucun contenu d’attaque : un constat n’a qu’un titre et une gravité, une fuite ni contenu ni nom, une campagne que des totaux', () => {
  for (const c of gros.constats) assert.deepEqual(Object.keys(c).sort(), ['creeLe', 'etat', 'gravite', 'id', 'missionId', 'titre']);
  for (const f of gros.fuites) assert.deepEqual(Object.keys(f).sort(), ['clientId', 'detecteeLe', 'etat', 'id', 'nature']);
  for (const c of gros.campagnes) {
    assert.deepEqual(Object.keys(c).sort(), ['clientId', 'cliques', 'envoyes', 'etat', 'id', 'le', 'ouverts', 'parEquipe', 'signales', 'titre', 'type']);
    for (const e of c.parEquipe as Lien[]) assert.deepEqual(Object.keys(e).sort(), ['cliques', 'envoyes', 'equipe', 'signales']);
  }
  for (const p of gros.parcSecurite) assert.ok(Object.values(p).every((v) => typeof v !== 'string' || /^(ps|pc)-\d+$/.test(v)), 'le parc ne porte aucun nom');
});

dit('les plaques de véhicules sont invalides par construction (les lettres I, O et U n’existent pas dans le format réel)', () => {
  assert.ok(gros.vehicules.length >= 8);
  for (const v of gros.vehicules) assert.match(str(v.plaque), /^[IOU]{2}-\d{3}-[IOU]{2}$/);
});

dit('la messagerie est compatible avec `Message` : id numérique, auteur, pièces jointes vides, non lus recoupés', () => {
  for (const m of gros.messages) {
    assert.equal(typeof m.id, 'number');
    assert.ok(Array.isArray(m.attachments) && (m.attachments as unknown[]).length === 0);
    assert.ok(Array.isArray(m.reactions) && typeof m.pinned === 'boolean');
  }
  for (const c of gros.conversations) {
    const msgs = gros.messages.filter((x) => x.conversationId === c.id);
    assert.ok(msgs.length >= 2, 'conversation presque vide');
    assert.equal(c.nonLus, msgs.filter((x) => x.lu === false).length, `non-lus de ${str(c.nom)}`);
    assert.equal(c.dernierMessageAt, msgs.map((x) => str(x.createdAt)).sort().pop(), 'dernier message');
    for (const x of msgs) { assert.ok(Date.parse(str(x.createdAt)) <= gros.contexte.maintenant, 'message futur'); if (x.replyToId !== null) assert.ok(msgs.some((y) => y.id === x.replyToId), 'réponse à un message absent'); }
  }
  assert.ok(new Set(normal.conversations.map((c) => c.type)).size >= 3, 'équipe, personne et client existent');
  assert.ok(normal.conversations.some((c) => num(c.nonLus) > 0));
});

console.log('  — compléments : TVA, paie, tarifs, partenaires, planning, défis');

dit('TVA : la TVA à reverser est celle des factures émises moins celle des dépenses du mois ; les cotisations suivent les bulletins', () => {
  assert.ok(normal.echeancesFiscales.some((e) => e.famille === 'TVA') && normal.echeancesFiscales.some((e) => e.famille === 'Cotisations'));
  for (const e of gros.echeancesFiscales.filter((x) => x.famille === 'TVA')) {
    const m = /^TVA de (\p{L}+)$/u.exec(str(e.intitule));
    assert.ok(m, str(e.intitule));
    const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'].indexOf(m[1]) + 1;
    const [a, mEcheance] = str(e.echeanceLe).split('-').map(Number);
    const an = mEcheance === 1 ? a - 1 : a;
    const cleMois = `${an}-${String(mois).padStart(2, '0')}`;
    const col = gros.factures.filter((f) => f.status !== 'draft' && f.status !== 'cancelled' && str(f.issuedAt).startsWith(cleMois)).reduce((t, f) => t + D.totauxDeFacture(f).tvaCents, 0);
    const ded = gros.depenses.filter((d) => str(d.spentAt).startsWith(cleMois)).reduce((t, d) => t + num(d.tvaCents), 0);
    assert.equal(num(e.montantCents), col - ded, `TVA de ${m[1]}`);
  }
  for (const e of gros.echeancesFiscales) {
    if (e.paiement === 'Payée') assert.ok(str(e.echeanceLe) < jours(gros) && str(e.payeLe) <= jours(gros), `payée mais ${str(e.echeanceLe)}`);
    else assert.equal(e.payeLe, null);
  }
  assert.ok(normal.echeancesFiscales.some((e) => e.paiement === 'À payer' && str(e.echeanceLe) < jours(normal)), 'MA08 « En retard »');
  assert.ok(normal.echeancesFiscales.some((e) => e.paiement === 'À payer' && str(e.echeanceLe) >= jours(normal)), 'MA08 « À venir »');
});

dit('paie : un bulletin par salarié et par mois, net positif, les mois passés sont payés, et la banque prélève la masse salariale', () => {
  const salaries = normal.equipe.filter((m) => m.role !== 'Partenaire' && m.role !== 'Invité');
  assert.equal(normal.bulletins.length, salaries.length * 3);
  const vus = new Set<string>();
  for (const b of gros.bulletins) {
    const k = `${str(b.membreEmail)}:${str(b.mois)}`;
    assert.ok(!vus.has(k), `double bulletin ${k}`);
    vus.add(k);
    assert.ok(num(b.netCents) > 0 && num(b.heures) > 0);
    if (str(b.mois) < jours(gros).slice(0, 7)) assert.equal(b.etat, 'Payé');
    if (b.etat === 'Prêt' || b.etat === 'Validé' || b.etat === 'Payé') assert.ok(b.piece, 'pièce manquante');
    else assert.equal(b.piece, null);
  }
  assert.ok(normal.bulletins.some((b) => b.etat === 'À valider' || b.etat === 'Prêt'), 'MA11 « À valider / Prêt »');
  const parMois = new Map<string, number>();
  for (const b of normal.bulletins) parMois.set(str(b.mois), (parMois.get(str(b.mois)) ?? 0) + num(b.netCents));
  const moyenne = Math.round([...parMois.values()].reduce((t, x) => t + x, 0) / parMois.size);
  const salairesBanque = normal.mouvements.filter((m) => m.libelle === 'Salaires');
  assert.ok(salairesBanque.length >= 3 && salairesBanque.every((m) => num(m.montantCents) === -moyenne), 'les prélèvements « Salaires » = masse salariale');
});

dit('tarifs : la marge se calcule du prix et du coût ; les ventes du mois sont les lignes de facture de ce nom ; un historique daté', () => {
  const mois = jours(gros).slice(0, 7);
  for (const p of gros.prestations) {
    if (p.coutCents !== null) assert.ok(num(p.coutCents) < num(p.prixCents), 'coût ≥ prix');
    const ventes = gros.factures.filter((f) => f.status !== 'draft' && f.status !== 'cancelled' && str(f.issuedAt).startsWith(mois)).flatMap((f) => f.lines as Lien[]).filter((l) => l.label === p.nom).reduce((t, l) => t + num(l.quantity), 0);
    assert.equal(p.ventesMois, ventes, `ventes de ${str(p.nom)}`);
    for (const h of p.historique as Lien[]) assert.ok(str(h.le) <= jours(gros) && num(h.ancienCents) !== num(h.nouveauCents));
  }
  assert.ok(normal.prestations.some((p) => p.coutCents !== null) && gros.prestations.some((p) => p.etat === 'archivée'));
});

dit('partenaires : référents de l’équipe, fournisseurs existants, des contrats à renouveler (30 jours) et des pauses', () => {
  const emails = new Set(gros.equipe.map((m) => m.email));
  for (const p of gros.partenaires) {
    assert.ok((p.referents as string[]).length >= 1 && (p.referents as string[]).every((e) => emails.has(e)));
    if (p.fournisseurId !== null) assert.ok(ids(gros.fournisseurs).has(p.fournisseurId));
  }
  assert.ok(gros.partenaires.some((p) => p.finContratLe !== null && D.ecartJours(jours(gros), str(p.finContratLe)) <= 30), 'MC05 « À renouveler »');
  assert.ok(gros.partenaires.some((p) => p.statut === 'En pause') && gros.partenaires.some((p) => p.statut === 'Actif'));
});

dit('planning : du lundi au vendredi, début avant fin, personne en congé ce jour-là, « toute l’équipe » sans liste', () => {
  const emails = new Map(gros.equipe.map((m) => [str(m.email), m]));
  for (const c of gros.creneaux) {
    const [a, mo, j] = str(c.jour).split('-').map(Number);
    const jourSem = new Date(Date.UTC(a, mo - 1, j, 12)).getUTCDay();
    assert.ok(jourSem >= 1 && jourSem <= 5, `week-end ${str(c.jour)}`);
    assert.ok(str(c.debut) < str(c.fin));
    if (c.touteLEquipe) assert.equal((c.personnes as string[]).length, 0);
    else assert.ok((c.personnes as string[]).length >= 1);
    for (const e of c.personnes as string[]) { assert.ok(emails.has(e)); assert.ok(!((emails.get(e)?.congesJours as string[]) ?? []).includes(str(c.jour)), 'créneau pendant un congé'); }
  }
  assert.ok(normal.creneaux.some((c) => str(c.jour) >= '2026-10-26' && str(c.jour) <= '2026-10-30'), 'la semaine en cours est remplie');
});

dit('défis : le compteur de jours sans impayé se recalcule ; le seuil de note vient des avis ; les participants sont de l’équipe', () => {
  const emails = new Set(gros.equipe.map((m) => m.email));
  for (const d of gros.defis) {
    assert.ok((d.participants as string[]).length >= 2 && (d.participants as string[]).every((e) => emails.has(e)));
    if (d.type === 'Compteur de jours') assert.equal(d.valeurActuelle, D.joursSansImpaye(gros.factures, jours(gros)));
  }
  assert.ok(new Set(normal.defis.map((d) => d.type)).size >= 3, 'les trois types existent au volume normal');
});

console.log('  — Écrire');

dit('fichiers : la signature d’un fichier dit celle de sa demande ; un lien externe a une durée de 7, 30 ou 90 jours et expire à sa création + sa durée', () => {
  const parFichier = new Map(gros.signatures.map((s) => [s.fichierId, s]));
  for (const f of gros.fichiers) {
    const s = parFichier.get(f.id);
    const attendu = !s ? null : s.etat === 'Signée' ? 'Signé' : ['Envoyée', 'Ouverte', 'Partiellement signée'].includes(str(s.etat)) ? 'En attente de signature' : null;
    assert.equal(f.signature, attendu, `signature de ${str(f.nom)}`);
    assert.ok(num(f.tailleOctets) > 0);
    const l = f.lienExterne as Lien | null;
    if (l) { assert.ok([7, 30, 90].includes(num(l.jours))); assert.equal(l.expireLe, D.ecartJours(str(l.creeLe), str(l.expireLe)) === num(l.jours) ? l.expireLe : null, 'durée du lien'); }
    assert.ok(((f.partages as Lien[])[0]?.droit) === 'Propriétaire', 'le propriétaire est le premier partage');
  }
});

dit('signatures : l’état suit les signataires, l’échéance et l’envoi ; chaque demande pointe un fichier ; l’empreinte est tronquée', () => {
  for (const s of gros.signatures) {
    const st = (s.signataires as Lien[]).map((x) => x.statut);
    assert.match(str(s.empreinteCourte), /^[0-9a-f]{8}$/);
    assert.ok(ids(gros.fichiers).has(s.fichierId));
    if (s.etat === 'À envoyer') assert.ok(s.envoyeAt === null && st.every((x) => x === 'En attente'));
    if (s.etat === 'Signée') assert.ok(st.every((x) => x === 'Signé'));
    if (s.etat === 'Partiellement signée') assert.ok(st.includes('Signé') && st.some((x) => x !== 'Signé'));
    if (s.etat === 'Refusée') assert.ok(st.includes('Refusé'));
    if (s.etat === 'Expirée') assert.ok(str(s.echeanceLe) < jours(gros) && !st.every((x) => x === 'Signé'));
    for (const x of s.signataires as Lien[]) assert.equal(x.statut === 'Signé', x.signeAt !== null);
  }
  assert.ok(normal.signatures.length >= 10 && new Set(normal.signatures.map((s) => s.etat)).size >= 6, 'H12 montre presque tous les états');
});

dit('pages, modèles, journal, textes, archives, connaissances : références, dates passées, règles propres', () => {
  const emails = new Set(gros.equipe.map((m) => m.email));
  for (const p of gros.pages) { assert.ok(p.parentId === null || ids(gros.pages).has(p.parentId)); assert.ok((p.blocs as unknown[]).length > 0 && Date.parse(str(p.modifieAt)) <= gros.contexte.maintenant); assert.ok(emails.has(p.auteurEmail)); }
  for (const m of gros.modeles) { assert.ok(num(m.usagesMois) <= num(m.creationsDuTypeMois)); assert.equal((m.utilisateurs30j as string[]).length > 0, num(m.usagesMois) > 0); }
  const cles = new Set<string>();
  for (const j of gros.journal) { const k = `${str(j.auteurEmail)}:${str(j.jour)}`; assert.ok(!cles.has(k), `deux entrées le même jour ${k}`); cles.add(k); assert.ok(str(j.jour) <= jours(gros)); assert.match(str(j.commenceA), /^\d{2}:\d{2}$/); assert.ok(['très bien', 'bien', 'moyen', 'difficile'].includes(str(j.humeur))); }
  for (const t of gros.textes) { if (t.interlocuteurId !== null) assert.ok(ids(gros.interlocuteurs).has(t.interlocuteurId)); if (t.etat === 'à valider' || t.etat === 'prêt') assert.ok(t.relecteurEmail); }
  for (const a of gros.archives) { assert.ok(str(a.conserverJusquau) > str(a.archiveLe) && str(a.archiveLe) <= jours(gros)); assert.equal(a.mode === 'à la main', a.parEmail !== null); if (a.type === 'Facture') assert.equal(num(str(a.conserverJusquau).slice(0, 4)) - num(str(a.archiveLe).slice(0, 4)), 10, 'factures : dix ans'); }
  for (const e of gros.connaissances) { assert.ok(!(e.lectures as Lien[]).some((l) => l.email === e.auteurEmail), 'l’auteur ne compte pas parmi les lecteurs'); for (const q of e.questionsLieesIds as string[]) assert.equal(gros.connaissances.find((x) => x.id === q)?.type, 'question'); }
  assert.ok(new Set(normal.connaissances.map((e) => e.type)).size === 3, 'article, procédure et question');
  assert.ok(gros.pages.some((p) => p.parentId !== null) && gros.journal.length >= 100);
});

console.log('  — Échanger');

dit('canaux, annonces, courriels, salles, appels, réunions, partages, sondages, réponses automatiques', () => {
  const emails = new Set(gros.equipe.map((m) => m.email));
  for (const c of gros.canaux) { assert.match(str(c.nom), /^[a-z0-9-]+$/); assert.ok((c.membres as string[]).every((e) => emails.has(e))); if (c.visibilite === 'privé') assert.ok((c.membres as string[]).length < gros.equipe.length || gros.equipe.length <= 2); }
  const art = gros.annonces;
  for (const a of art) { assert.ok((a.confirmations as Lien[]).some((c) => c.email === a.auteurEmail), 'l’auteur est compté d’office'); assert.ok((a.confirmations as Lien[]).every((c) => Date.parse(str(c.at)) <= gros.contexte.maintenant)); }
  assert.deepEqual(art.map((a) => Number(a.epinglee)), [...art.map((a) => Number(a.epinglee))].sort((x, y) => y - x), 'épinglées d’abord');
  for (const c of gros.courriels) { assert.ok(['réception', 'envoyés', 'brouillons', 'archive'].includes(str(c.dossier))); if (c.envoiProgrammeAt) assert.ok(Date.parse(str(c.envoiProgrammeAt)) > gros.contexte.maintenant, 'envoi programmé dans le passé'); else assert.ok(Date.parse(str(c.at)) <= gros.contexte.maintenant); }
  assert.ok(normal.courriels.some((c) => c.dossier === 'réception' && !c.lu) && normal.courriels.some((c) => c.dossier === 'envoyés'));
  for (const a of gros.appels) { assert.ok(Date.parse(str(a.debutAt)) < gros.contexte.maintenant && ids(gros.salles).has(a.salleId)); assert.ok((a.participants as string[]).every((e) => emails.has(e))); }
  for (const r of gros.reunions) { assert.ok(ids(gros.evenements).has(r.evenementId)); const passee = Date.parse(str(r.debutAt)) + num(r.dureeMin) * 60_000 <= gros.contexte.maintenant; if (r.compteRendu !== null) assert.ok(passee, 'compte rendu d’une réunion à venir'); if (!passee) assert.ok((r.preparation as unknown[]).length > 0); }
  for (const p of gros.partages) { assert.ok(ids(gros.fichiers).has(p.fichierId)); if (p.expireAt) assert.ok(str(p.expireAt) > str(p.creeAt)); if (p.destinataire === 'Équipe') assert.equal(p.protection, 'aucune'); }
  assert.ok(normal.partages.some((p) => p.expireAt && Date.parse(str(p.expireAt)) > normal.contexte.maintenant && Date.parse(str(p.expireAt)) - normal.contexte.maintenant <= 3 * 86_400_000), 'MX03 « Expirent bientôt »');
  for (const s of gros.sondages) { assert.ok(num(s.repondants) <= num(s.invites)); if (s.statut === 'Nouveau') assert.equal(s.repondants, 0); if (s.statut === 'Terminé') assert.ok(Date.parse(str(s.echeanceAt)) <= gros.contexte.maintenant); assert.equal((s.options as Lien[]).reduce((t, o) => t + num(o.votes), 0) <= num(s.repondants) + (s.options as unknown[]).length, true); }
  assert.ok(new Set(normal.sondages.map((s) => s.statut)).size === 3 && new Set(normal.sondages.map((s) => s.type)).size >= 2);
  for (const r of gros.reponsesAuto) { if (!r.actif) assert.equal(r.envois, 0); }
  assert.ok(normal.reponsesAuto.some((r) => r.actif) && normal.reponsesAuto.some((r) => !r.actif));
});

console.log('  — Créer');

dit('stock : la quantité est la somme des mouvements et ne passe jamais sous zéro ; il y a des articles sous le seuil ; un produit en stock a la quantité de son article', () => {
  for (const a of gros.articles) {
    let cumul = 0;
    for (const m of [...(a.mouvements as Lien[])].sort((x, y) => str(x.le).localeCompare(str(y.le)))) { cumul += num(m.delta); assert.ok(cumul >= 0, `quantité négative : ${str(a.nom)}`); assert.ok(str(m.le) <= jours(gros)); }
    assert.equal(D.quantiteEnStock(a), cumul);
  }
  assert.ok(normal.articles.some((a) => D.quantiteEnStock(a) < num(a.seuilAlerte)), 'H15 « sous le seuil »');
  assert.ok(peu.articles.some((a) => D.quantiteEnStock(a) < num(a.seuilAlerte)) || peu.articles.length < 4);
  for (const p of gros.produits.filter((x) => x.type === 'produit en stock')) assert.equal(p.quantite, D.quantiteEnStock(gros.articles.find((a) => a.id === p.articleId)));
  for (const p of gros.produits.filter((x) => x.type !== 'produit en stock')) assert.equal(p.quantite, null);
});

dit('commandes : numéros uniques et séquentiels (« #1042 »), lignes qui pointent des produits, une remise a toutes ses étapes et sa preuve', () => {
  const numeros = gros.commandes.map((c) => str(c.numero));
  assert.equal(new Set(numeros).size, numeros.length);
  assert.ok(numeros.every((x) => /^#1\d{3}$/.test(x)));
  for (const c of gros.commandes) {
    assert.ok(ids(gros.clients).has(c.clientId));
    for (const l of c.lignes as Lien[]) assert.ok(ids(gros.produits).has(l.produitId));
    const faites = (c.etapes as Lien[]).filter((e) => e.fait).length;
    assert.equal(c.preuveRemise, c.preparation === 'Remise');
    if (c.preparation === 'Remise') assert.equal(faites, (c.etapes as unknown[]).length);
    if (c.preparation === 'À préparer') assert.equal(faites, 0);
    assert.ok(str(c.prevueLe) >= str(c.creeLe));
  }
  assert.ok(new Set(normal.commandes.map((c) => c.preparation)).size === 4 && normal.commandes.some((c) => c.remise === 'Tournée'));
});

dit('chantiers, photos, tournées, matériel, flotte, réservations, qualité : statuts, dates, références', () => {
  for (const c of gros.chantiers) {
    if (c.statut === 'À venir') assert.ok(str(c.debutLe) > jours(gros));
    if (c.statut === 'Terminé') { assert.ok(str(c.finPrevueLe) < jours(gros)); assert.ok((c.etapes as Lien[]).every((e) => e.faite)); }
    if (c.statut === 'En retard') { assert.ok(str(c.finPrevueLe) < jours(gros)); assert.ok((c.etapes as Lien[]).some((e) => !e.faite)); }
    if (c.statut === 'En cours') assert.ok(str(c.debutLe) <= jours(gros) && str(c.finPrevueLe) >= jours(gros));
    assert.ok(num(c.depenseCents) >= 0 && str(c.finPrevueLe) > str(c.debutLe));
  }
  assert.ok(new Set(normal.chantiers.map((c) => c.statut)).size >= 4, 'H16 : les statuts');
  for (const d of gros.dossiersPhotos) { if (!d.demarre) assert.equal((d.photos as unknown[]).length, 0); for (const p of d.photos as Lien[]) assert.ok(str(p.le) <= jours(gros)); if (d.chantierId) assert.ok(ids(gros.chantiers).has(d.chantierId)); }
  assert.equal(gros.marque.length, 1);
  for (const c of (gros.marque[0].palette as Lien[])) assert.match(str(c.hex), /^#[0-9A-F]{6}$/i);
  for (const v of gros.videos) { assert.equal(v.etape === 'Publiée', v.lienPublication !== null); assert.equal(num(v.vues) > 0, v.etape === 'Publiée'); assert.equal(num(v.avancement) === 100, v.etape === 'Publiée'); }
  for (const p of gros.pagesPubliques) { if (p.statut === 'Brouillon') assert.equal(p.versionEnLigne, null); if (p.statut === 'Publiée') assert.equal(p.versionEnLigne, p.versionTravail); if (p.statut === 'Modifications non publiées') assert.ok(num(p.versionEnLigne) < num(p.versionTravail)); }
  const parJour = new Map<string, number[]>();
  for (const e of gros.etapesTournee) { parJour.set(str(e.jour), [...(parJour.get(str(e.jour)) ?? []), num(e.ordre)]); if (str(e.jour) > jours(gros)) assert.equal(e.etat, 'À faire'); if (e.commandeId) assert.ok(ids(gros.commandes).has(e.commandeId)); }
  for (const [j, ordres] of parJour) assert.deepEqual([...ordres].sort((a, b) => a - b), ordres.map((_, i) => i + 1), `ordre des étapes du ${j}`);
  assert.ok(normal.etapesTournee.some((e) => e.etat === 'Fait') || normal.etapesTournee.every((e) => str(e.arriveePrevue) > '10:15'));
  for (const e of gros.equipements) { assert.ok(num(e.valeurCents) > 0 && str(e.achatLe) <= jours(gros)); assert.ok(['personne', 'lieu'].includes(str((e.affectation as Lien).type))); }
  for (const v of gros.vehicules) assert.equal(Number((v.prochainEntretien as Lien).km !== null) + Number((v.prochainEntretien as Lien).le !== null), 1, 'entretien en km OU en date');
  const parRessource = new Map<string, Lien[]>();
  for (const r of gros.reservations) { assert.ok(ids(gros.ressources).has(r.ressourceId) && str(r.finAt) > str(r.debutAt)); parRessource.set(str(r.ressourceId), [...(parRessource.get(str(r.ressourceId)) ?? []), r]); }
  for (const [rid, l] of parRessource) { const t = [...l].sort((a, b) => str(a.debutAt).localeCompare(str(b.debutAt))); for (let i = 1; i < t.length; i += 1) assert.ok(str(t[i].debutAt) >= str(t[i - 1].finAt), `chevauchement sur ${rid}`); }
  for (const e of gros.ecarts) {
    const c = gros.controles.find((x) => x.id === e.controleId);
    assert.ok(c, 'écart sans contrôle');
    const modele = gros.modelesControle.find((m) => m.id === c.modeleId) as Lien;
    const point = (modele.points as Lien[]).find((p) => (c.resultats as Lien[]).find((r) => r.pointId === p.id)?.conforme === false);
    assert.ok(point, 'un écart naît d’un point non conforme');
    assert.equal(e.gravite, point.criticite === 'critique' ? 'critique' : 'mineur');
  }
  for (const c of gros.controles) { if (c.statut === 'À faire') assert.ok((c.resultats as Lien[]).every((r) => r.conforme === null)); if (c.statut === 'Terminé') assert.ok((c.resultats as Lien[]).every((r) => r.conforme !== null)); }
});

console.log('  — Outils');

dit('corbeille, sites, sauvegardes, import et export, raccourcis, notifications, usages : règles propres', () => {
  for (const e of gros.corbeille) { const age = (gros.contexte.maintenant - Date.parse(str(e.supprimeAt))) / 86_400_000; assert.ok(age >= 0 && age <= num(e.conservationJours), 'rien n’est conservé plus longtemps que la durée de conservation'); }
  for (const s of gros.sites) { assert.match(str(s.adresse), /^https:\/\/[a-z0-9.-]+\.exemple\.test/); assert.ok(num(s.disponibilite30j) > 0 && num(s.disponibilite30j) <= 100); }
  assert.ok(gros.sites.some((s) => s.etat === 'Dégradé') && gros.sites.some((s) => s.etat === 'Hors ligne') && normal.sites.some((s) => s.etat === 'Dégradé'));
  for (const t of gros.trackers) { const site = gros.sites.find((s) => s.id === t.siteId) as Lien; assert.ok(site && site.tracker === true); if (t.etat === 'Actif') assert.ok(num(t.visites7j) > 0 && t.derniereVisiteAt); if (t.etat === 'À installer') assert.equal(t.derniereVisiteAt, null); }
  for (const c of gros.sauvegardes) { assert.ok(Date.parse(str(c.at)) <= gros.contexte.maintenant); assert.match(str(c.empreinteCourte), /^[0-9a-f]{8}$/); assert.deepEqual(c.emplacements, ['Cloud chiffré', 'Disque du bureau']); }
  assert.ok(gros.sauvegardes.some((c) => c.etat === 'Échouée') && gros.sauvegardes.some((c) => c.declencheur === 'Hebdomadaire'));
  for (const o of gros.operations) { const k = o.compteurs as Lien; if (o.type === 'Import') assert.equal(num(k.creees) + num(k.fusionnees) + num(k.ignorees) + num(k.erreurs), num(o.lignes), 'compteurs d’import'); assert.equal(o.etat === 'Terminée avec erreurs', num(k.erreurs) > 0); }
  const actions = gros.raccourcis.map((r) => str(r.action));
  assert.equal(new Set(actions).size, actions.length, 'une action, un raccourci');
  const touches = gros.raccourcis.map((r) => r.touches).filter((t) => t !== null);
  assert.equal(new Set(touches).size, touches.length, 'une touche ne sert qu’une fois');
  const nts = gros.notifications;
  assert.deepEqual(nts.map((n) => str(n.at)), nts.map((n) => str(n.at)).sort().reverse(), 'plus récentes d’abord');
  assert.ok(nts.every((n) => Date.parse(str(n.at)) <= gros.contexte.maintenant) && nts.every((n) => n.type !== 'urgent' || n.urgente === true));
  assert.ok(normal.notifications.some((n) => !n.lue) && normal.notifications.some((n) => n.lue) && normal.notifications.some((n) => n.urgente) && new Set(normal.notifications.map((n) => n.type)).size >= 5);
  for (const u of gros.usagesCalculs) assert.ok(num(u.joursUtilises) <= num(u.joursOuvresEcoules) && num(u.utilisationsMois) >= num(u.joursUtilises));
  assert.equal(gros.usagesCalculs[0].joursOuvresEcoules, 22, 'jours ouvrés du 1er au 30 octobre 2026');
});

dit('automatisations : neuf actives et trois en pause sur douze ; un brouillon n’a jamais tourné ; une famille Cyber quand c’est une vue Cyber', () => {
  const douze = D.construireMonde({ volumes: { automatisations: 'normal' } }).automatisations;
  assert.equal(douze.length, 12);
  assert.equal(douze.filter((a) => a.etat === 'Active').length, 9);
  assert.equal(douze.filter((a) => a.etat !== 'Active').length, 3);
  for (const a of gros.automatisations) { if (a.etat === 'Brouillon') assert.ok(a.dernierPassageAt === null && a.executions === 0); assert.ok(num(a.executionsMois) <= num(a.executions)); if (a.etat !== 'Active') assert.equal(a.executionsMois, 0); }
  assert.ok(new Set(gros.automatisations.map((a) => a.type)).size === 3 && gros.automatisations.some((a) => a.familleCyber));
});

dit('connecteurs : sans clé ; l’état dit la synchro, les droits et la date de création de la clé', () => {
  for (const c of gros.connecteurs) {
    if (c.etat === 'Non connecté') { assert.ok(c.derniereSynchroAt === null && (c.droits as unknown[]).length === 0 && c.cleCreeeLe === null && c.widgets === 0); }
    else { assert.ok(c.derniereSynchroAt && (c.droits as unknown[]).length > 0 && c.cleCreeeLe); assert.ok(Date.parse(str(c.derniereSynchroAt)) <= gros.contexte.maintenant); }
    if (c.etat === 'À renouveler') assert.ok(D.ecartJours(str(c.cleCreeeLe), jours(gros)) >= 330);
  }
  assert.ok(new Set(normal.connecteurs.map((c) => c.etat)).size === 4, 'les quatre états de H21');
  const banque = gros.connecteurs.find((c) => c.nom === 'Banque') as Lien;
  assert.deepEqual(banque.droits.length ? banque.droits : ['Lecture seule'], ['Lecture seule'], 'la banque est en lecture seule');
  const metiers = gros.modelesMetier;
  assert.equal(new Set(metiers.map((m) => m.nom)).size, metiers.length);
  assert.ok(metiers.every((m) => (m.modules as unknown[]).length >= 5 && (m.motsCles as unknown[]).length === 3));
});

console.log('  — La Garde');

dit('l’état d’une organisation se déduit du score, des alertes ouvertes et de la ronde (N02, 6.1) ; les trois états existent', () => {
  for (const o of gros.organisations) {
    const ouvertes = gros.alertes.filter((a) => a.organisationId === o.id && a.etat === 'Ouverte' && !a.sourdineJusquAt).map((a) => str(a.gravite));
    assert.equal(o.etat, D.etatOrganisation(num(o.score), ouvertes, str(o.derniereRondeAt), num(o.intervalleRondeH), gros.contexte.maintenant), `état de ${str(o.nom)}`);
    assert.ok(ids(gros.clients).has(o.clientId) && num(o.score) >= 0 && num(o.score) <= 100);
    assert.equal(o.lettre, str(o.nom)[0].toUpperCase());
  }
  for (const m of [normal, gros]) assert.deepEqual([...new Set(m.organisations.map((o) => o.etat))].sort(), ['Critique', 'Sain', 'À surveiller'], 'les trois états existent');
  // Une organisation peut avoir un bon score et pourtant être critique : c'est l'alerte (ou la ronde) qui décide.
  assert.ok(gros.organisations.some((o) => o.etat === 'Critique' && num(o.score) >= 65), 'N02 : « 71 en rouge à cause de l’alerte critique »');
  // Les bornes de N02 6.1, écrites en dur : sans elles, comparer la fonction à elle-même ne prouverait rien.
  const maintenant = gros.contexte.maintenant;
  const ilYa = (min: number) => new Date(maintenant - min * 60_000).toISOString();
  const cas: [string, number, string[], number, number, string][] = [
    ['score 70', 70, [], 5, 4, 'Sain'], ['score 69', 69, [], 5, 4, 'À surveiller'], ['score 45', 45, [], 5, 4, 'À surveiller'], ['score 44', 44, [], 5, 4, 'Critique'],
    ['alerte moyenne', 95, ['Moyenne'], 5, 4, 'À surveiller'], ['alerte critique', 95, ['Critique'], 5, 4, 'Critique'], ['alertes faibles seules', 95, ['Faible', 'Faible'], 5, 4, 'Sain'],
    ['ronde à exactement 2 intervalles', 95, [], 2 * 4 * 60, 4, 'Sain'], ['ronde juste au-delà de 2 intervalles', 95, [], 2 * 4 * 60 + 1, 4, 'À surveiller'],
    ['ronde à 24 h pile (intervalle 4 h)', 95, [], 24 * 60, 4, 'À surveiller'], ['ronde au-delà de 24 h', 95, [], 24 * 60 + 1, 4, 'Critique'], ['ronde à 24 h pile (intervalle 24 h) : pas encore deux intervalles', 95, [], 24 * 60, 24, 'Sain'], ['le plus grave l’emporte', 80, ['Moyenne'], 25 * 60, 4, 'Critique'],
  ];
  for (const [nom, score, alertes, minutes, intervalle, attendu] of cas) assert.equal(D.etatOrganisation(score, alertes, ilYa(minutes), intervalle, maintenant), attendu, nom);
  const regle = D.etatOrganisation(90, [], new Date(gros.contexte.maintenant - 3 * 3_600_000).toISOString(), 1, gros.contexte.maintenant);
  assert.equal(regle, 'À surveiller', 'une ronde de plus de deux intervalles pèse');
  assert.equal(D.etatOrganisation(90, ['Faible'], new Date(gros.contexte.maintenant - 600_000).toISOString(), 4, gros.contexte.maintenant), 'Sain', 'des alertes faibles seules ne changent rien');
});

dit('alertes, incidents, vulnérabilités, actifs : références, chronologie, cycle de vie', () => {
  for (const a of gros.alertes) {
    assert.ok(ids(gros.organisations).has(a.organisationId) && Date.parse(str(a.detecteeAt)) <= gros.contexte.maintenant);
    if (a.etat === 'Ouverte') assert.equal(a.acquitteeAt, null);
    else { assert.ok(a.acquitteeAt && Date.parse(str(a.acquitteeAt)) >= Date.parse(str(a.detecteeAt)) && Date.parse(str(a.acquitteeAt)) <= gros.contexte.maintenant); }
    if (a.fausseAlerte) assert.equal(a.etat, 'Acquittée');
  }
  const ordre = { Critique: 0, Moyenne: 1, Faible: 2 } as Record<string, number>;
  assert.deepEqual(gros.alertes.map((a) => ordre[str(a.gravite)]), gros.alertes.map((a) => ordre[str(a.gravite)]).sort((x, y) => x - y), 'tri par gravité');
  assert.ok(normal.alertes.some((a) => a.etat === 'Ouverte') && normal.alertes.some((a) => a.etat === 'Acquittée' && str(a.acquitteeAt).slice(0, 10) === jours(normal)), 'MG01 « Traitées aujourd’hui »');
  const etapes = ['Détecté', 'Pris en charge', 'En traitement', 'Résolu', 'Clôturé'];
  for (const i of gros.incidents) {
    assert.match(str(i.id), /^INC-\d{4}$/);
    assert.ok(ids(gros.organisations).has(i.organisationId) && etapes.includes(str(i.etape)));
    assert.equal(i.responsableEmail === null, i.etape === 'Détecté', 'responsable : nul seulement avant la prise en charge');
    assert.equal(i.etape === 'Clôturé', i.clotureAt !== null);
    if (i.clotureAt) assert.ok(str(i.clotureAt) >= str(i.ouvertAt));
    const faites = (i.plan as Lien[]).filter((p) => p.fait).length;
    if (i.etape === 'Résolu' || i.etape === 'Clôturé') assert.ok(faites >= 4 && i.clientInforme === true);
    if (i.etape === 'Détecté') assert.equal(faites, 0);
    assert.ok((i.chronologie as Lien[]).every((c) => Date.parse(str(c.at)) <= gros.contexte.maintenant));
  }
  assert.equal(new Set(gros.incidents.map((i) => i.id)).size, gros.incidents.length);
  assert.ok(normal.incidents.some((i) => i.etape === 'En traitement'), 'H32 « En traitement »');
  for (const v of gros.vulnerabilites) assert.ok(ids(gros.organisations).has(v.organisationId) && (v.actifId === null || ids(gros.actifs).has(v.actifId)));
  for (const a of gros.actifs) {
    assert.ok(ids(gros.organisations).has(a.organisationId) && /\.exemple\.test$/.test(str(a.nom)));
    if (a.type === 'Domaine') assert.ok(num(a.expireDansJours) > 0);
    if (a.type === 'Messagerie') assert.equal(typeof a.messagerieOk, 'boolean');
    if (a.type === 'Serveur') assert.equal(typeof a.patchEnRetard, 'boolean');
  }
  for (const o of gros.organisations) assert.ok(gros.actifs.some((a) => a.organisationId === o.id && a.type === 'Domaine'), 'chaque organisation a son domaine');
});

dit('rondes, événements de sécurité, journal d’accès : périmètres, ordre, aucune IP, aucune valeur de secret', () => {
  for (const r of gros.rondes) { assert.ok((r.perimetre as string[]).every((id) => ids(gros.organisations).has(id)) && str(r.prochaineAt) > str(r.derniereAt) && Date.parse(str(r.derniereAt)) <= gros.contexte.maintenant); assert.ok(['ok', 'attention', 'critique'].includes(str((r.dernierResultat as Lien).ton))); }
  assert.ok(new Set(gros.rondes.map((r) => r.type)).size === 6, 'les six types de ronde');
  const ev = gros.evenementsSecurite;
  assert.deepEqual(ev.map((e) => str(e.at)), ev.map((e) => str(e.at)).sort().reverse());
  assert.ok(ev.every((e) => Date.parse(str(e.at)) <= gros.contexte.maintenant && (e.organisationId === null || ids(gros.organisations).has(e.organisationId))));
  assert.deepEqual([...new Set(ev.map((e) => e.resultat))].sort(), ['Bloqué', 'Journalisé', 'Normal']);
  const noms = gros.secrets.map((s) => str(s.nom));
  for (const j of gros.journalAcces) {
    assert.ok(Date.parse(str(j.at)) <= gros.contexte.maintenant && ['Autorisé', 'Refusé', 'À revoir'].includes(str(j.resultat)));
    assert.equal(IPV4.test(str(j.lieu)) || IPV4.test(str(j.action)), false, 'adresse IP dans le journal');
    const m = /secret « (.+) »/.exec(str(j.action));
    if (m) assert.ok(noms.includes(m[1]), 'seul le NOM du secret figure');
    if (j.resultat !== 'À revoir') assert.equal(j.revuParEmail, null);
  }
  assert.ok(normal.journalAcces.some((j) => j.resultat === 'Refusé') && normal.journalAcces.some((j) => j.resultat === 'À revoir') && normal.journalAcces.some((j) => (j.acteur as Lien).type === 'client'));
});

dit('maturité SOC : le score est points obtenus ÷ points possibles (pas la moyenne des domaines) ; les six domaines ; le niveau suit la grille', () => {
  const c = gros.criteresMaturite;
  assert.equal(new Set(c.map((x) => x.domaine)).size, 6);
  const possibles = c.reduce((t, x) => t + num(x.points), 0);
  const obtenus = c.filter((x) => x.rempli).reduce((t, x) => t + num(x.points), 0);
  assert.equal(D.scoreMaturite(c), Math.round((obtenus / possibles) * 100));
  const parDomaine = [...new Set(c.map((x) => x.domaine))].map((d) => D.scoreMaturite(c.filter((x) => x.domaine === d)));
  const moyenneSimple = Math.round(parDomaine.reduce((t, x) => t + x, 0) / parDomaine.length);
  assert.ok(Math.abs(moyenneSimple - D.scoreMaturite(c)) <= 15, 'même ordre de grandeur, mais pas la moyenne simple');
  assert.deepEqual([0, 39, 40, 74, 75, 86, 87, 94, 95, 100].map((x) => D.niveauMaturite(x).niveau), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  assert.ok(normal.criteresMaturite.some((x) => !x.rempli), 'H34 a un plan de progression à montrer');
  assert.ok(normal.criteresMaturite.every((x) => num(x.points) > 0 && num(x.dureeMin) > 0));
});

dit('offres : prix en centimes, positionnement de la liste fixe, une activation par client surveillé', () => {
  const orgClients = gros.organisations.map((o) => o.clientId);
  for (const o of gros.offresCyber) { assert.ok(Number.isInteger(num(o.prixCents)) && num(o.prixCents) > 0); assert.deepEqual((o.activations as Lien[]).map((a) => a.clientId), orgClients); assert.ok((o.responsables as string[]).length >= 1); }
  assert.ok(gros.offresCyber.some((o) => o.positionnement === 'Nouveau') && gros.offresCyber.some((o) => (o.activations as Lien[]).some((a) => a.statut === 'Actif')));
});

console.log('  — Cyber');

dit('accords : l’état se déduit de la signature et des dates ; les quatre états existent ; un outil « Accord requis » est bloqué sans accord valide', () => {
  for (const a of gros.accords) {
    const etat = D.etatAccord(a, jours(gros));
    assert.equal(etat === 'En attente', !a.signe);
    if (a.signe) assert.equal(etat, str(a.finLe) < jours(gros) ? 'Expiré' : D.ecartJours(jours(gros), str(a.finLe)) <= 30 ? 'Expire bientôt' : 'Valide');
    assert.ok(str(a.finLe) > str(a.debutLe) && (a.perimetre as Lien).domaines && ((a.perimetre as Lien).domaines as string[]).every((d) => /\.exemple\.test$/.test(d)));
    assert.ok(str(a.conditionArret).length > 0);
  }
  assert.deepEqual([...new Set(normal.accords.map((a) => D.etatAccord(a, jours(normal))))].sort(), ['En attente', 'Expire bientôt', 'Expiré', 'Valide']);
  const requis = { accord: 'Accord requis' };
  const mk = (signe: boolean, debutLe: string, finLe: string) => ({ signe, debutLe, finLe });
  assert.equal(D.outilDisponible(requis, [], jours(normal)), false, 'aucun accord');
  assert.equal(D.outilDisponible(requis, [mk(true, '2026-01-01', '2026-02-01')], jours(normal)), false, 'accord expiré');
  assert.equal(D.outilDisponible(requis, [mk(false, '2026-10-01', '2027-01-01')], jours(normal)), false, 'accord non signé');
  assert.equal(D.outilDisponible(requis, [mk(true, '2026-09-01', '2026-11-10')], jours(normal)), true, 'accord qui expire bientôt');
  assert.equal(D.outilDisponible({ accord: 'Passif' }, [], jours(normal)), true, 'un outil passif n’exige aucun accord');
});

dit('outils : 54 au volume normal (9 familles × 6), les types et accords de la fiche, des noms génériques', () => {
  assert.equal(normal.outilsCyber.length, 54);
  const familles = new Map<string, number>();
  for (const o of normal.outilsCyber) familles.set(str(o.famille), (familles.get(str(o.famille)) ?? 0) + 1);
  assert.equal(familles.size, 9);
  assert.ok([...familles.values()].every((n) => n === 6));
  const accordsDe = (f: string) => new Set(normal.outilsCyber.filter((o) => o.famille === f).map((o) => o.accord));
  assert.deepEqual([...accordsDe('OSINT')], ['Passif'], 'OSINT : 6 outils passifs');
  assert.deepEqual([...accordsDe('Sites et vie privée')], ['Passif']);
  assert.deepEqual([...accordsDe('Conformité')], ['Interne']);
  assert.ok(accordsDe('Red Team').has('Accord requis') && accordsDe('Sensibilisation').has('Accord requis') && accordsDe('Réponse à incident').has('Accord requis'));
  assert.equal(normal.outilsCyber.filter((o) => o.famille === 'SOC' && o.type === 'Connecté').length, 1, 'SOC : un seul connecté (corrélation)');
  assert.ok(normal.outilsCyber.some((o) => !o.actif) && normal.outilsCyber.some((o) => o.actif));
  assert.equal(peu.outilsCyber.length, 9);
  assert.equal(new Set(peu.outilsCyber.map((o) => o.famille)).size, 9, 'une de chaque famille dès « peu »');
});

dit('missions, constats, documents : accords, phases, signatures, états', () => {
  for (const m of gros.missions) {
    assert.ok(ids(gros.clients).has(m.clientId) && ['Accord', 'Reconnaissance', 'Tests', 'Constats', 'Rapport'].includes(str(m.phase)));
    if (m.accordId !== null) assert.equal(gros.accords.find((a) => a.id === m.accordId)?.clientId, m.clientId, 'l’accord est celui du client de la mission');
    if (m.etat === 'À préparer') assert.equal(m.phase, 'Accord');
    if (m.etat === 'Terminée') { assert.equal(m.phase, 'Rapport'); const a = gros.accords.find((x) => x.id === m.accordId); if (a) assert.equal(a.signe, true, 'une mission terminée a un accord signé'); }
  }
  assert.ok(normal.missions.some((m) => m.etat === 'En cours' && normal.accords.find((a) => a.id === m.accordId)?.signe === false), 'CY12 : une mission en cours dont l’accord attend sa signature');
  assert.ok(new Set(normal.missions.map((m) => m.etat)).size === 3 && normal.missions.some((m) => m.mensuelle));
  for (const c of gros.constats) { const m = gros.missions.find((x) => x.id === c.missionId); assert.ok(m && m.etat !== 'À préparer' && str(c.creeLe) >= str(m.debutLe) && str(c.creeLe) <= jours(gros)); }
  assert.deepEqual([...new Set(gros.constats.map((c) => c.gravite))].sort(), ['Critique', 'Faible', 'Moyenne']);
  const docsAccord = gros.documentsCyber.filter((d) => d.type === 'Accord');
  assert.equal(docsAccord.length, gros.accords.length, 'un document par accord');
  for (const d of docsAccord) assert.equal(d.signature, gros.accords.find((a) => a.clientId === d.clientId)?.signe ? 'Signé' : 'À signer');
  assert.ok(new Set(gros.documentsCyber.map((d) => d.type)).size === 7 && gros.documentsCyber.every((d) => str(d.modifieLe) <= jours(gros)));
});

dit('veille, conformité, sensibilisation, parc : compteurs recoupés, rien de nominatif', () => {
  const lg = new Set(gros.logicielsClients.map((l) => l.id));
  for (const a of gros.alertesVeille) assert.ok((a.logicielsConcernes as string[]).every((id) => lg.has(id)) && str(a.publieeLe) <= jours(gros));
  const concernes = new Set(gros.alertesVeille.flatMap((a) => a.logicielsConcernes as string[]));
  for (const l of gros.logicielsClients) assert.equal(l.concerneParVeille, concernes.has(str(l.id)));
  assert.ok(normal.alertesVeille.some((a) => a.publieeLe === jours(normal)) && normal.alertesVeille.some((a) => (a.logicielsConcernes as unknown[]).length > 0), 'CY05 « N vous concernent »');
  assert.ok(gros.fuites.some((f) => f.etat === 'à traiter') && gros.fuites.every((f) => str(f.detecteeLe) <= jours(gros)));
  for (const d of gros.dossiersConformite) { assert.equal((d.points as unknown[]).length, 5); assert.equal(d.registreRevuLe === null, !(d.points as Lien[])[0].ok); }
  assert.deepEqual([...new Set(gros.dossiersConformite.map((d) => D.niveauConformite(d)))].sort(), ['Conforme', 'Partiel', 'À traiter']);
  for (const c of gros.campagnes) {
    const eq = c.parEquipe as Lien[];
    if (c.etat === 'Planifiée') assert.ok(num(c.envoyes) === 0 && eq.length === 0 && str(c.le) > jours(gros));
    else { assert.equal(eq.reduce((t, e) => t + num(e.envoyes), 0), num(c.envoyes)); assert.equal(eq.reduce((t, e) => t + num(e.cliques), 0), num(c.cliques)); assert.ok(num(c.cliques) <= num(c.envoyes) && num(c.signales) <= num(c.envoyes) && num(c.ouverts) <= num(c.envoyes)); }
    if (c.type !== 'Simulation') assert.ok(num(c.cliques) === 0 && num(c.signales) === 0);
  }
  for (const p of gros.parcSecurite) { assert.ok(num(p.postesAJour) <= num(p.postes) && num(p.correctifsImportants) <= num(p.correctifsEnAttente)); const s = p.sauvegardes as Lien; assert.ok(num(s.verifiees) <= num(s.total)); }
  assert.ok(new Set(normal.campagnes.map((c) => c.etat)).size >= 2 && normal.campagnes.some((c) => c.type === 'Simulation'));
});

/** Les invariants de la suite qui ne doivent JAMAIS dépendre du tirage. */
function invariantsSuite(m: MondeBrut, nom: string): void {
  const auj = jours(m);
  const maintenant = m.contexte.maintenant;
  const clients = ids(m.clients);
  for (const jeu of ['fichiers', 'commandes', 'organisations', 'abonnements', 'accords', 'missions', 'campagnes', 'parcSecurite', 'fuites', 'dossiersConformite', 'logicielsClients']) {
    for (const x of m[jeu]) if (x.clientId !== null && x.clientId !== undefined) assert.ok(clients.has(x.clientId), `${nom} : ${jeu} → client`);
  }
  for (const s of m.signatures) assert.ok(ids(m.fichiers).has(s.fichierId), `${nom} : signature → fichier`);
  for (const p of m.partages) assert.ok(ids(m.fichiers).has(p.fichierId), `${nom} : partage → fichier`);
  for (const r of m.reunions) assert.ok(ids(m.evenements).has(r.evenementId), `${nom} : réunion → événement`);
  for (const a of m.alertes) assert.ok(ids(m.organisations).has(a.organisationId), `${nom} : alerte → organisation`);
  for (const a of m.alertes) assert.ok(Date.parse(str(a.detecteeAt)) <= maintenant, `${nom} : alerte future`);
  for (const o of m.organisations) {
    const ouvertes = m.alertes.filter((a) => a.organisationId === o.id && a.etat === 'Ouverte' && !a.sourdineJusquAt).map((a) => str(a.gravite));
    assert.equal(o.etat, D.etatOrganisation(num(o.score), ouvertes, str(o.derniereRondeAt), num(o.intervalleRondeH), maintenant), `${nom} : état d’organisation`);
  }
  for (const a of m.articles) { let c = 0; for (const mv of [...(a.mouvements as Lien[])].sort((x, y) => str(x.le).localeCompare(str(y.le)))) { c += num(mv.delta); assert.ok(c >= 0, `${nom} : stock négatif`); } }
  for (const mi of m.missions) if (mi.accordId !== null) assert.equal(m.accords.find((a) => a.id === mi.accordId)?.clientId, mi.clientId, `${nom} : accord d’une mission`);
  for (const a of m.accords) assert.equal(D.etatAccord(a, auj) === 'En attente', !a.signe, `${nom} : accord`);
  const parRessource = new Map<string, Lien[]>();
  for (const r of m.reservations) parRessource.set(str(r.ressourceId), [...(parRessource.get(str(r.ressourceId)) ?? []), r]);
  for (const l of parRessource.values()) { const t = [...l].sort((x, y) => str(x.debutAt).localeCompare(str(y.debutAt))); for (let i = 1; i < t.length; i += 1) assert.ok(str(t[i].debutAt) >= str(t[i - 1].finAt), `${nom} : chevauchement`); }
  for (const c of m.conversations) assert.equal(c.nonLus, m.messages.filter((x) => x.conversationId === c.id && x.lu === false).length, `${nom} : non-lus`);
  for (const s of m.secrets) assert.equal(s.valeur, '••••••••', `${nom} : secret non masqué`);
  for (const t of m.etapesTournee) if (str(t.jour) > auj) assert.equal(t.etat, 'À faire', `${nom} : tournée future`);
  for (const b of m.bulletins) if (str(b.mois) < auj.slice(0, 7)) assert.equal(b.etat, 'Payé', `${nom} : bulletin passé non payé`);
  for (const j of m.journalAcces) assert.ok(Date.parse(str(j.at)) <= maintenant, `${nom} : accès futur`);
  for (const c of m.sauvegardes) assert.ok(Date.parse(str(c.at)) <= maintenant, `${nom} : sauvegarde future`);
}

dit('les invariants de la suite tiennent pour 12 graines (« peu » et « normal »), 4 graines (« beaucoup ») et d’autres dates', () => {
  for (let graine = 1; graine <= 12; graine += 1) for (const volume of ['peu', 'normal'] as const) invariantsSuite(D.construireMonde({ graine, volume }), `graine ${graine}, ${volume}`);
  for (const graine of [101, 202, 303, 404]) invariantsSuite(D.construireMonde({ graine, volume: 'beaucoup' }), `graine ${graine}, beaucoup`);
  for (const jour of ['2026-03-29T10:00:00Z', '2026-07-14T09:00:00Z', '2026-10-25T11:30:00Z', '2027-01-04T08:00:00Z']) invariantsSuite(D.construireMonde({ volume: 'normal', maintenant: Date.parse(jour) }), `date ${jour}`);
});

dit('les cas attendus par les écrans existent dès « normal », pour 12 graines (organisations en trois états, impayés fiscaux, accords en attente…)', () => {
  for (let graine = 1; graine <= 12; graine += 1) {
    const n = D.construireMonde({ graine, volume: 'normal' });
    const nom = `graine ${graine}`;
    assert.equal(new Set(n.organisations.map((o) => o.etat)).size, 3, `${nom} : états d’organisation`);
    assert.ok(n.alertes.some((a) => a.gravite === 'Critique' && a.etat === 'Ouverte') && n.alertes.some((a) => a.etat === 'Acquittée'), `${nom} : alertes`);
    assert.ok(n.incidents.some((i) => i.etape === 'En traitement'), `${nom} : incident en traitement`);
    assert.ok(n.articles.some((a) => D.quantiteEnStock(a) < num(a.seuilAlerte)), `${nom} : stock bas`);
    assert.ok(n.signatures.length >= 10 && new Set(n.signatures.map((s) => s.etat)).size >= 6, `${nom} : états de signature`);
    assert.equal(new Set(n.accords.map((a) => D.etatAccord(a, jours(n)))).size, 4, `${nom} : états d’accord`);
    assert.ok(n.echeancesFiscales.some((e) => e.paiement === 'À payer' && str(e.echeanceLe) < jours(n)), `${nom} : échéance fiscale en retard`);
    assert.ok(n.sites.some((s) => s.etat === 'Dégradé') && n.notifications.some((x) => !x.lue), `${nom} : sites, notifications`);
  }
});

console.log(`\n${vus} contrôles, tous au vert.`);
