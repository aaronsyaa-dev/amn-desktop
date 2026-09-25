/**
 * LE CHERCHEUR DE MODULES, ÉPROUVÉ SUR DES PHRASES DE CLIENTES (cahier 12, `46f`, `46h`).
 *
 * Le paquet le demande en toutes lettres : « Le moteur réel doit être testé
 * sur un jeu de phrases de clientes, dont celle-ci. » Chaque phrase porte ce
 * qu'on attend du chercheur — les idées qu'il doit y lire, s'il doit ouvrir
 * deux lectures, le module qui doit répondre seul (ou l'aveu qu'aucun ne le
 * fait), ce qu'il doit écarter.
 *
 *   node --experimental-strip-types scripts/check-chercheur.ts
 */
import { chercher, lire, limiteDeLaPaire, type ModuleCatalogue } from '../src/bureaux/donnees/chercheur.ts';

const CATALOGUE: ModuleCatalogue[] = [
  ['rounds', 'Tournées', 'Production'],
  ['orders', 'Commandes', 'Clients & revenus'],
  ['interventions', 'Interventions', 'Production'],
  ['time', 'Temps', 'Pilotage'],
  ['shifts', 'Planning d’équipe', 'Équipe'],
  ['leaves', 'Absences', 'Équipe'],
  ['expenseClaims', 'Notes de frais', 'Finance'],
  ['expenses', 'Dépenses', 'Finance'],
  ['binder', 'Classeur', 'Documents'],
  ['booking', 'Rendez-vous en ligne', 'Guichet'],
  ['agenda', 'Calendrier', 'Pilotage'],
  ['invoices', 'Facturation', 'Clients & revenus'],
  ['reminders', 'Relances', 'Clients & revenus'],
  ['deposits', 'Acompte en ligne', 'Guichet'],
  ['esign', 'Signature sur place', 'Documents'],
  ['stock', 'Stock', 'Production'],
  ['shop', 'Boutique', 'Guichet'],
  ['checklists', 'Contrôles qualité', 'Production'],
  ['reviews', 'Avis', 'Clients & revenus'],
  ['loyalty', 'Fidélité', 'Clients & revenus'],
].map(([cle, nom, famille]) => ({ cle, nom, famille }));

let echecs = 0;
const verifier = (nom: string, ok: boolean, detail = '') => {
  if (!ok) {
    echecs += 1;
    console.error(`  ✗ ${nom}${detail ? ` — ${detail}` : ''}`);
  } else console.log(`  ✓ ${nom}`);
};

interface Attendu {
  phrase: string;
  idees: string[];
  lectures: number;
  complet?: (string | null)[];
  ecarte?: string;
  ignore?: boolean;
}

const JEU: Attendu[] = [
  // `46f` — la première phrase du paquet : quatre idées, aucun module du catalogue ne les couvre toutes.
  { phrase: 'il me manque un truc pour suivre mes livraisons avec photo du colis', idees: ['suivre', 'livraison', 'photo', 'colis'], lectures: 1, complet: [null], ignore: true },
  // `46h` — « pointer » a deux sens : deux lectures, la livraison d'abord.
  { phrase: 'Il me faut un truc pour que mes livreurs pointent leur arrivée avec une photo du colis.', idees: ['personnel', 'photo', 'colis'], lectures: 2, complet: [null, null], ignore: true },
  { phrase: 'Je voudrais que mes clients réservent un créneau en ligne et paient un acompte', idees: ['rdv', 'enLigne', 'paiement'], lectures: 1, complet: ['booking'] },
  // « pointer leurs heures » : le complément tranche, une seule lecture.
  { phrase: 'mes employés doivent pointer leurs heures de début et de fin', idees: ['personnel', 'pointer:heures'], lectures: 1, complet: ['time'] },
  { phrase: 'un outil pour relancer les factures impayées', idees: ['relance', 'facture'], lectures: 1, complet: ['reminders'] },
  { phrase: 'savoir quand mon stock va manquer', idees: ['stock'], lectures: 1 },
  { phrase: 'faire signer un devis sur place', idees: ['signature', 'devis', 'surPlace'], lectures: 1, complet: ['esign'] },
  { phrase: 'une carte de fidélité avec des tampons pour mes clientes', idees: ['fidelite'], lectures: 1, complet: ['loyalty'] },
];

for (const a of JEU) {
  console.log(`« ${a.phrase} »`);
  const r = chercher(a.phrase, CATALOGUE, new Map([['rounds', 40], ['interventions', 55], ['orders', 70]]));
  const cles = r.idees.map((i) => i.cle);
  verifier('les idées lues', a.idees.every((i) => cles.includes(i)) && cles.every((c) => a.idees.includes(c)), `lues : ${cles.join(', ')}`);
  verifier(`${a.lectures} lecture${a.lectures > 1 ? 's' : ''}`, r.lectures.length === a.lectures, `obtenues : ${r.lectures.length}`);
  if (a.lectures > 1) verifier('une question pour la cliente, jamais un choix en silence', Boolean(r.ambigu && r.ambigu.sens.length === 2));
  if (a.complet) {
    a.complet.forEach((c, i) => {
      const l = r.lectures[i];
      verifier(`lecture ${l?.lettre ?? '?'} : ${c ? `« ${c} » répond seul` : 'aucun module ne répond seul, et c’est dit'}`, c ? l?.complet?.cle === c : !l?.complet, `obtenu : ${l?.complet?.cle ?? 'aucun'}`);
      if (!c && l?.paire) verifier(`lecture ${l.lettre} : la combinaison dit ce qu’elle ne fera pas`, Boolean(limiteDeLaPaire(l)) || l.idees.length < 2);
    });
  }
  if (a.ignore) verifier('le remplissage est ignoré, et dit', r.ignores.length > 0, r.ignores.join(', '));
  for (const l of r.lectures) {
    if (l.idees.length >= 2) verifier(`lecture ${l.lettre} : aucun module à une seule idée dans la grille`, l.lignes.every((x) => x.couvre >= 2));
  }
}
// La première lecture de `46h` est la livraison : « photo du colis » parle de livraison.
const h = chercher('Il me faut un truc pour que mes livreurs pointent leur arrivée avec une photo du colis.', CATALOGUE);
verifier('46h : la lecture A est « l’arrivée chez le destinataire »', h.lectures[0]?.idees.some((i) => i.cle === 'pointer:arrivee') ?? false);
verifier('46h : une réserve est portée par une case (Interventions : heure notée à la main)', h.lectures[0].lignes.some((l) => l.reserves > 0) || h.lectures[0].ecartes.some((l) => l.reserves > 0));
verifier('lire() ne tranche pas : le mot à deux sens est rendu tel quel', lire('pointer leur arrivée').ambigu?.mot === 'pointer leur arrivée');

if (echecs) {
  console.error(`\n${echecs} échec(s).`);
  process.exit(1);
}
console.log('\nOK — le chercheur tient sur le jeu de phrases.');
