#!/usr/bin/env node
/**
 * PEUPLER UNE ORGANISATION D'ESSAI — parce qu'un écran vide ne prouve rien
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ## Pourquoi ce script existe
 *
 * Les garde-fous navigateur — `check:cibles`, `check:contraste`,
 * `check:focus`, `check:etiquettes` — parcourent l'application dans un vrai
 * navigateur et mesurent ce qu'ils voient. Ils ne voyaient presque rien.
 *
 * Relevé à l'écriture, sur les deux organisations d'essai :
 *
 *   organisation interne  ·  6 documents, 2 fiches clients, 1 page.
 *                            Zéro tâche, zéro décision, zéro objectif, zéro
 *                            note, zéro rapport, zéro rendez-vous, zéro média,
 *                            zéro devis, zéro facture.
 *   organisation cliente  ·  1 tâche, 10 notes. Tout le reste à zéro.
 *
 * Les enregistrements comptés par l'API n'étaient pas des données : c'étaient
 * les sondes de `check:sync`, une par collection, invisibles à l'écran.
 *
 * Autrement dit : les garde-fous mesuraient des écrans VIDES, et rendaient un
 * vert qui ne parlait que des états vides. Trois défauts trouvés la même nuit
 * le prouvent — un « Supprimer le document » de 15 × 15 px qui n'apparaît
 * qu'une fois un document ouvert, une carte de tâche avec quatre cibles sous
 * 24 px qui n'existe que s'il y a une tâche, une flèche d'ouverture de 10 px
 * répétée dix-huit fois sur une liste de sites qui était vide.
 *
 * Aucun n'était nouveau. Ils attendaient simplement qu'on regarde un écran
 * comme les gens le voient : avec des choses dedans.
 *
 * ## Ce qu'il écrit
 *
 * Des données INVENTÉES, pour une fleuriste et une agence fictives. Aucune
 * donnée réelle, jamais — ce script refuse d'ailleurs de s'exécuter sur autre
 * chose qu'un compte `@exemple.test`.
 *
 * Les identifiants sont STABLES (`essai-…`) : relancer le script remplace les
 * mêmes enregistrements au lieu d'en empiler de nouveaux, et on peut donc le
 * rejouer autant qu'on veut avant une campagne de mesure.
 *
 *   AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… node scripts/seed-essai.mjs
 */

const API = (process.env.AMN_API ?? 'http://127.0.0.1:4171').replace(/\/$/, '');
const EMAIL = process.env.AMN_E2E_EMAIL ?? '';
const MOT_DE_PASSE = process.env.AMN_E2E_PASSWORD ?? '';

if (!EMAIL || !MOT_DE_PASSE) {
  console.error('Il faut AMN_E2E_EMAIL et AMN_E2E_PASSWORD.');
  process.exit(1);
}

/*
  LE GARDE-FOU DU GARDE-FOU.

  Ce script ÉCRIT. Le pointer par distraction sur une organisation réelle y
  déverserait des fiches clientes inventées, au milieu des vraies, sans rien
  pour les distinguer ensuite. Le domaine `.test` est réservé par la RFC 2606
  précisément pour ça : il ne peut pas exister ailleurs que dans un essai.
*/
if (!/@exemple\.test$/.test(EMAIL)) {
  console.error(
    `REFUS : « ${EMAIL} » n’est pas un compte d’essai.\n\n` +
      '  Ce script écrit des fiches clientes, des devis et des factures inventés.\n' +
      '  Il ne s’exécute que sur un compte @exemple.test — voir l’en-tête du fichier.',
  );
  process.exit(1);
}

const login = await fetch(`${API}/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: MOT_DE_PASSE }),
}).then((r) => r.json());

if (!login?.token) {
  console.error('Connexion refusée :', JSON.stringify(login).slice(0, 200));
  process.exit(1);
}

const jour = (decalage) => {
  const d = new Date();
  d.setDate(d.getDate() + decalage);
  return d.toISOString().slice(0, 10);
};
const instant = (decalageHeures) => new Date(Date.now() + decalageHeures * 3600_000).toISOString();

let ecrits = 0;
let echecs = 0;

async function poser(collection, id, data) {
  const res = await fetch(`${API}/v1/collections/${collection}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` },
    body: JSON.stringify({ data }),
  });
  if (res.ok) {
    ecrits += 1;
  } else {
    echecs += 1;
    console.error(`  ✗ ${collection}/${id} → ${res.status} ${(await res.text()).slice(0, 120)}`);
  }
}

/*
  LA CLÉ DE SYNCHRO D'UNE FICHE CLIENTE EST ICI UN NOMBRE, ET CE N'EST PAS UN
  DÉTAIL D'ÉCRITURE.

  Les devis et les factures se rattachent à une fiche par son identifiant
  NUMÉRIQUE, que `numericId` (src/lib/records.ts) dérive de la clé : une clé
  déjà numérique garde sa valeur, toute autre est hachée en un nombre NÉGATIF.
  Écrire `clients/essai-cli-1` puis `clientId: 101` sur la facture rattachait
  donc la facture à une fiche qui n'existe pas — silencieusement, puisque
  personne ne lève d'erreur sur une référence orpheline. Le bac à sable montrait
  « 0,00 € facturé » sur des fiches qui avaient trois documents chacune.

  D'où des clés `101`, `102`, `103` : le lien tient par construction, et il
  reste stable d'une exécution à l'autre.
*/
const CLIENTES = [
  {
    cle: '101',
    num: 101,
    name: 'Camille Renaud',
    company: 'Le Jardin d’Élise',
    status: 'active',
    email: 'camille@jardin-elise.exemple.test',
    phone: '+33 6 11 22 33 44',
    notes: 'Abonnement bouquets hebdomadaires pour l’accueil. Livraison le mardi matin.',
  },
  {
    cle: '102',
    num: 102,
    name: 'Hugo Marchand',
    company: 'Brasserie du Port',
    status: 'prospect',
    email: 'h.marchand@brasserie-port.exemple.test',
    phone: '+33 6 55 44 33 22',
    notes: 'Demande de compositions pour la terrasse d’été. Devis envoyé, relance prévue.',
  },
  {
    cle: '103',
    num: 103,
    name: 'Nadia Bouvier',
    company: '',
    status: 'active',
    email: 'nadia.bouvier@exemple.test',
    phone: '+33 7 88 99 00 11',
    notes: 'Mariage en septembre : arche, bouquets de table, boutonnières.',
  },
];

console.log(`\nPeuplement de l’organisation d’essai — ${EMAIL}\n`);

/*
  LE MÉNAGE DES CLÉS D'HIER.

  Les fiches ont porté les clés `essai-cli-1..3` avant de porter leur numéro.
  Rejouer le script ne les remplace donc pas : il en AJOUTE trois à côté, et le
  bac à sable finit avec deux répertoires superposés — six fiches là où on en
  attend trois, et des moyennes fausses sur tous les écrans qui comptent. On
  retire donc explicitement les anciennes clés. Supprimer ce qui n'existe pas
  est sans effet : la boucle est sûre sur un bac à sable neuf.
*/
for (const ancienne of ['essai-cli-1', 'essai-cli-2', 'essai-cli-3']) {
  await fetch(`${API}/v1/collections/clients/${ancienne}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${login.token}` },
  }).catch(() => undefined);
}

for (const c of CLIENTES) {
  await poser('clients', c.cle, {
    name: c.name,
    company: c.company,
    status: c.status,
    email: c.email,
    phone: c.phone,
    notes: c.notes,
    imageDataUrl: '',
    linkedSiteIds: [],
    createdAt: instant(-24 * 40),
    events: [
      {
        id: 1,
        clientId: c.num,
        title: 'Premier échange',
        detail: 'Prise de contact et recueil du besoin.',
        date: jour(-38),
      },
      {
        id: 2,
        clientId: c.num,
        title: 'Devis envoyé',
        detail: 'Proposition détaillée transmise par courriel.',
        date: jour(-24),
      },
    ],
  });
}

/* ─── Devis ────────────────────────────────────────────────────────────────── */

/*
  `sentAt` est la date d'envoi, et c'est elle que l'écran lit pour dire « sans
  réponse depuis douze jours ». Elle est écrite ici parce que `updatedAt` est
  posé par le SERVEUR à l'écriture : un devis semé serait toujours « envoyé à
  l'instant », et l'ambre de l'écran Devis ne dirait jamais rien.
*/
const DEVIS = [
  ['essai-dev-1', 101, 'Abonnement accueil — trimestre', 'Un bouquet de saison par semaine, livré le mardi.', 540, 'accepted', -30],
  ['essai-dev-2', 102, 'Compositions terrasse d’été', 'Douze jardinières, entretien mensuel inclus.', 1290, 'sent', -12],
  ['essai-dev-3', 103, 'Mariage — septembre', 'Arche florale, dix bouquets de table, six boutonnières.', 2150, 'draft', null],
];
for (const [cle, clientId, title, detail, priceEuro, status, envoiJours] of DEVIS) {
  await poser('quotes', cle, {
    clientId,
    title,
    detail,
    priceEuro,
    status,
    paymentStatus: status === 'accepted' ? 'paid' : 'unpaid',
    sentAt: envoiJours === null ? '' : instant(24 * envoiJours),
    createdAt: instant(-24 * 20),
  });
}

/* ─── Factures ─────────────────────────────────────────────────────────────── */

/*
  LES STATUTS SONT CEUX DU DOMAINE, PAS DE L'ANGLAIS COURANT.

  Ce fichier écrivait `status: 'sent'` sur les factures et `'client'` sur les
  fiches. Aucun des deux n'existe : `InvoiceStatus` vaut draft | issued | paid |
  cancelled, `ClientStatus` vaut active | paused | prospect. Le décodeur
  (`oneOf`, dans useInvoices/useClients) ne plante pas là-dessus — il replie sur
  la valeur sûre. Résultat : TROIS factures d'essai devenaient des brouillons et
  toutes les fiches des prospects, et le bac à sable montrait un compte à zéro
  euro là où il devait montrer de l'argent en attente. Un jeu d'essai muet est
  pire qu'un jeu d'essai absent : on croit avoir mesuré.
*/
const ligne = (id, label, quantity, euros, vatRate = 20) => ({
  id,
  label,
  quantity,
  unitPriceCents: Math.round(euros * 100),
  vatRate,
});

await poser('invoices', 'essai-fac-1', {
  number: '2026-0041',
  clientId: 101,
  billTo: {
    name: 'Camille Renaud',
    company: 'Le Jardin d’Élise',
    email: 'camille@jardin-elise.exemple.test',
    address: '12 rue des Lilas\n34000 Montpellier',
    vatNumber: '',
  },
  issuedAt: jour(-18),
  dueAt: jour(12),
  lines: [ligne('l1', 'Bouquet de saison — livraison hebdomadaire', 12, 45)],
  status: 'issued',
  paidAt: '',
  paymentMethod: '',
  cancelReason: '',
  notes: 'Règlement à trente jours. Merci de votre confiance.',
  quoteId: null,
});

await poser('invoices', 'essai-fac-2', {
  number: '2026-0038',
  clientId: 103,
  billTo: {
    name: 'Nadia Bouvier',
    company: '',
    email: 'nadia.bouvier@exemple.test',
    address: '4 impasse du Verger\n34070 Montpellier',
    vatNumber: '',
  },
  issuedAt: jour(-52),
  dueAt: jour(-22),
  lines: [ligne('l1', 'Acompte — prestation mariage', 1, 645)],
  status: 'paid',
  paidAt: jour(-30),
  paymentMethod: 'Virement',
  cancelReason: '',
  notes: '',
  quoteId: null,
});

// Une facture EN RETARD : l'état le plus signalé de l'écran, et celui qui a le
// plus de chances de porter une couleur et une pastille à mesurer.
await poser('invoices', 'essai-fac-3', {
  number: '2026-0035',
  clientId: 102,
  billTo: {
    name: 'Hugo Marchand',
    company: 'Brasserie du Port',
    email: 'h.marchand@brasserie-port.exemple.test',
    address: '8 quai Neuf\n34200 Sète',
    vatNumber: 'FR40123456824',
  },
  issuedAt: jour(-75),
  dueAt: jour(-45),
  lines: [ligne('l1', 'Jardinières de terrasse', 6, 130), ligne('l2', 'Pose et mise en place', 1, 180)],
  status: 'issued',
  paidAt: '',
  paymentMethod: '',
  cancelReason: '',
  notes: '',
  quoteId: null,
});

/* ─── Dépenses et budgets ──────────────────────────────────────────────────── */

/*
  Les budgets sont posés par catégorie, et l'un d'eux est DÉPASSÉ à dessein :
  c'est l'unique ambre de l'écran Dépenses, et un bac à sable où tout tient dans
  son budget ne permet pas de le mesurer. Les clés de catégorie sont celles du
  réglage par défaut (voir `defaultConfig` dans src/state/expenseEngine.ts).
*/
await poser('expenseConfig', 'config', {
  categories: [
    { key: 'fournitures', label: 'Fournitures' },
    { key: 'deplacement', label: 'Déplacement' },
    { key: 'prestataire', label: 'Prestataire' },
    { key: 'materiel', label: 'Matériel' },
    { key: 'autre', label: 'Autre' },
  ],
  categoryBudgets: {
    prestataire: 90000,
    fournitures: 60000,
    deplacement: 45000,
  },
  projectBudgets: {},
});

/*
  Réparties sur trois mois : le ruban de mois a besoin d'un passé pour que la
  comparaison qu'il propose ait un sens. Le mois en cours est le plus fourni.
*/
const DEPENSES = [
  ['essai-dep-1', 'Retouchouse — visuels vitrine', 'prestataire', 48000, -2],
  ['essai-dep-2', 'Mise à jour du site', 'prestataire', 136000, -5],
  ['essai-dep-3', 'Papier et encre', 'fournitures', 8640, -5],
  ['essai-dep-4', 'Rouleaux de kraft', 'fournitures', 38160, -8],
  ['essai-dep-5', 'Train Paris — Lille', 'deplacement', 12400, -7],
  ['essai-dep-6', 'Péage et carburant', 'deplacement', 18000, -10],
  ['essai-dep-7', 'Disque dur de sauvegarde', 'materiel', 16800, -9],
  ['essai-dep-8', 'Sécateurs professionnels', 'materiel', 9400, -12],
  ['essai-dep-9', 'Location de camionnette', 'deplacement', 24000, -34],
  ['essai-dep-10', 'Impression de cartes', 'fournitures', 21000, -38],
  ['essai-dep-11', 'Prestation photo', 'prestataire', 52000, -41],
  ['essai-dep-12', 'Vitrophanie', 'fournitures', 14500, -66],
  ['essai-dep-13', 'Honoraires comptables', 'prestataire', 39000, -70],
  ['essai-dep-14', 'Étagères d’atelier', 'materiel', 27800, -74],
];
/*
  DEUX DÉPENSES PORTENT UN JUSTIFICATIF, ET LES AUTRES NON.

  Ce n'est pas de la décoration : la ligne de dépense a deux états — vignette ou
  cadre en pointillés marqué « sans justificatif » — et un jeu d'essai qui n'en
  montre qu'un ne permet pas de voir si l'autre tient. Le justificatif est un
  SVG minuscule écrit ici même plutôt qu'une photo : il occupe la même place à
  l'écran sans peser trois cents kilo-octets dans un script de bac à sable.
*/
const recu = (couleur) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="${couleur}"/>` +
      '<rect x="18" y="14" width="44" height="52" fill="#f4f2ec"/>' +
      '<g fill="#9a978f"><rect x="24" y="24" width="32" height="3"/><rect x="24" y="33" width="24" height="3"/>' +
      '<rect x="24" y="42" width="28" height="3"/><rect x="24" y="54" width="16" height="4"/></g></svg>',
  );
const AVEC_RECU = new Set(['essai-dep-2', 'essai-dep-5']);

for (const [cle, note, category, amountCents, dansJours] of DEPENSES) {
  await poser('expenses', cle, {
    amountCents,
    category,
    spentAt: jour(dansJours),
    note,
    photoDataUrl: AVEC_RECU.has(cle) ? recu(cle === 'essai-dep-2' ? '#2f2a24' : '#26282f') : '',
    createdAt: instant(24 * dansJours),
  });
}

/* ─── Commandes ────────────────────────────────────────────────────────────── */

/*
  Les commandes n'arrivent normalement PAS d'ici : elles viennent du site
  public, par la clé de réception (voir docs/COMMANDES.md dans amn-api). On les
  écrit quand même dans le bac à sable, parce qu'un écran qui n'existe qu'avec
  des commandes ne se mesure pas sans commandes.

  Une par état de la chaîne, plus deux nouvelles en attente : c'est ce qui donne
  au premier maillon quelque chose à traiter, donc à l'écran son unique ambre.
*/
const COMMANDES = [
  ['essai-cmd-1', '#1841', 'new', -2, 'Camille Renaud', [['Bouquet de saison', 2, 45]]],
  ['essai-cmd-2', '#1840', 'new', -9, 'Hugo Marchand', [['Jardinière garnie', 1, 95]]],
  ['essai-cmd-3', '#1839', 'new', -28, 'Nadia Bouvier', [['Composition de table', 4, 45]]],
  ['essai-cmd-4', '#1837', 'confirmed', -50, 'Camille Renaud', [['Abonnement hebdomadaire', 4, 45]]],
  ['essai-cmd-5', '#1834', 'preparing', -74, 'Hugo Marchand', [['Jardinière garnie', 3, 95], ['Pose', 1, 120]]],
  ['essai-cmd-6', '#1828', 'shipped', -98, 'Nadia Bouvier', [['Boutonnières', 6, 18]]],
  ['essai-cmd-7', '#1826', 'delivered', -146, 'Camille Renaud', [['Bouquet de saison', 8, 45]]],
  ['essai-cmd-8', '#1822', 'cancelled', -170, 'Hugo Marchand', [['Arche florale', 1, 420]]],
];
for (const [cle, reference, status, dansHeures, nom, articles] of COMMANDES) {
  const lignes = articles.map(([label, quantity, euros], i) => ({
    label,
    sku: `SKU-${String(i + 1).padStart(3, '0')}`,
    quantity,
    unitPriceCents: Math.round(euros * 100),
    vatRate: 20,
  }));
  await poser('orders', cle, {
    reference,
    placedAt: instant(dansHeures),
    status,
    source: 'site',
    customer: {
      name: nom,
      email: `${nom.split(' ')[0].toLowerCase()}@exemple.test`,
      phone: '',
      address: '34000 Montpellier',
    },
    lines: lignes,
    note: '',
    paidCents: 0,
    totalCents: lignes.reduce((t, l) => t + Math.round(l.quantity * l.unitPriceCents * 1.2), 0),
    invoiceId: null,
    updatedAt: instant(dansHeures),
  });
}

/* ─── Projets ──────────────────────────────────────────────────────────────── */

/*
  Les statuts sont les clés du profil par défaut du moteur (`agence-creative`,
  dans src/state/projectEngine.ts) : idee · en-cours · validation · termine ·
  archive. Une clé inventée ici ne ferait pas d'erreur — elle produirait un
  projet rangé sous un statut que l'écran ne sait pas nommer.

  Les échéances sont posées EN JOURS depuis aujourd'hui, pour que la frise ait
  toujours la même allure quel que soit le jour où on la mesure : une dépassée,
  quatre à venir étalées sur les dix semaines, une sans date du tout.
*/
const PROJETS = [
  ['essai-prj-1', 'Refonte boutique', 'en-cours', -6, 101, 'Reprendre la mise en page des fiches produit', 'high'],
  ['essai-prj-2', 'Identité Studio Nord', 'en-cours', 14, 0, 'Maquette 2', 'normal'],
  ['essai-prj-3', 'Vitrine automne', 'en-cours', 28, 102, 'Valider les visuels', 'normal'],
  ['essai-prj-4', 'Catalogue hiver', 'idee', 45, 0, 'Devis à envoyer', 'normal'],
  ['essai-prj-5', 'Signalétique atelier', 'idee', 62, 0, '', 'low'],
  ['essai-prj-6', 'Cartes de visite', 'termine', -30, 103, '', 'low'],
];
for (const [cle, title, status, dansJours, clientId, nextAction, priority] of PROJETS) {
  await poser('projects', cle, {
    title,
    status,
    structure: '',
    clientId,
    priority,
    nextAction,
    deadline: jour(dansJours),
    link: '',
    notes: '',
    extra: {},
    createdAt: instant(-24 * 55),
  });
}
/* Celui-là n'a PAS d'échéance : la frise doit savoir le dire au lieu de le poser
   au hasard sur la règle. */
await poser('projects', 'essai-prj-7', {
  title: 'Enseigne lumineuse',
  status: 'idee',
  structure: '',
  clientId: 0,
  priority: 'low',
  nextAction: '',
  deadline: '',
  link: '',
  notes: '',
  extra: {},
  createdAt: instant(-24 * 12),
});

/* ─── Rendez-vous ──────────────────────────────────────────────────────────── */

const RDV = [
  ['essai-rdv-1', 'Livraison hebdomadaire', 20, 60, 101, 'Camille Renaud', 'Le Jardin d’Élise, Montpellier', 'scheduled'],
  ['essai-rdv-2', 'Repérage terrasse', 54, 90, 102, 'Hugo Marchand', 'Quai Neuf, Sète', 'scheduled'],
  ['essai-rdv-3', 'Essai bouquet mariage', -48, 45, 103, 'Nadia Bouvier', 'Atelier', 'done'],
];
for (const [cle, title, dansHeures, durationMin, clientId, clientName, location, status] of RDV) {
  await poser('appointments', cle, {
    title,
    startAt: instant(dansHeures),
    durationMin,
    clientId,
    clientName,
    location,
    notes: '',
    reminderMin: 30,
    status,
    createdAt: instant(-24 * 10),
  });
}

/* ─── Tâches ───────────────────────────────────────────────────────────────── */

const TACHES = [
  ['essai-tac-1', 'Commander les pivoines pour septembre', 'todo', 'high'],
  ['essai-tac-2', 'Relancer la Brasserie du Port', 'doing', 'normal'],
  ['essai-tac-3', 'Remettre à jour la vitrine', 'todo', 'low'],
  ['essai-tac-4', 'Facture 2026-0035 — deuxième relance', 'doing', 'high'],
  ['essai-tac-5', 'Inventaire des vases', 'done', 'low'],
];
for (const [cle, title, status, priority] of TACHES) {
  await poser('tasks', cle, {
    title,
    detail: '',
    status,
    priority,
    assigneeEmail: EMAIL,
    createdAt: instant(-24 * 6),
  });
}

/* ─── Documents, notes, décisions, objectifs, rapports ─────────────────────── */

await poser('knowledge', 'essai-doc-1', {
  title: 'Conservation des fleurs coupées',
  body:
    'Recouper les tiges en biseau sous l’eau, changer l’eau tous les deux jours,\n' +
    'tenir à l’écart des fruits mûrs (l’éthylène accélère le flétrissement).\n\n' +
    'Pivoines : cueillies en bouton, elles s’ouvrent en trois à cinq jours.',
  createdAt: instant(-24 * 30),
});
await poser('knowledge', 'essai-doc-2', {
  title: 'Fournisseurs et délais',
  body: 'Marché de gros : livraison mardi et vendredi, commande la veille avant 16 h.\nProducteur local : uniquement de mai à octobre, deux jours de délai.',
  createdAt: instant(-24 * 12),
});

/*
  UN CARNET QUI SE TIENT, ET PAS DIX NOTES SANS RAPPORT.

  Il n'y en avait qu'une. Une note seule ne prouve rien de la vue graphe : elle
  y apparaît comme un point isolé au milieu du vide, et les garde-fous
  mesuraient donc un graphe SANS ARC — c'est-à-dire pas un graphe.

  Ces notes-ci se citent les unes les autres comme un vrai carnet le fait :
  une note centrale (« Vitrine automne ») que plusieurs autres visent, des
  chaînes courtes, une note qui n'est reliée à rien (il y en a toujours), et un
  titre cité qui n'existe PAS encore — c'est le cas qui nourrit le pointillé
  dans le texte et la liste « cité mais pas encore écrit » sous le graphe.
*/
const carnet = [
  [
    'essai-note-1',
    'Vitrine automne',
    'Dahlias, branches de chêne, courges décoratives. Palette rouille et vert profond.\n\n' +
      'Les fleurs viennent de [[Fournisseurs et délais]] ; pour la tenue, voir\n' +
      '[[Conservation des fleurs coupées]].',
    true,
    4,
  ],
  [
    'essai-note-2',
    'Fournisseurs et délais',
    'Marché de gros : mardi et vendredi, commande la veille avant 16 h.\n' +
      'Producteur local : mai à octobre seulement, deux jours de délai.\n\n' +
      'Pour l’automne, tout passe par le marché — voir [[Vitrine automne]].',
    false,
    12,
  ],
  [
    'essai-note-3',
    'Conservation des fleurs coupées',
    'Recouper en biseau sous l’eau, changer l’eau tous les deux jours, tenir à\n' +
      'l’écart des fruits mûrs.\n\n' +
      'Les pivoines demandent un traitement à part : [[Pivoines, cueillette et ouverture]].',
    false,
    30,
  ],
  [
    'essai-note-4',
    'Pivoines, cueillette et ouverture',
    'Cueillies en bouton, elles s’ouvrent en trois à cinq jours.\n' +
      'Stock froid : compter une semaine de plus.',
    false,
    28,
  ],
  [
    'essai-note-5',
    'Mariage Loiseau — septembre',
    'Arche, six bouquets de table, boutonnières. Blanc et vert, rien de rose.\n\n' +
      'Commande à passer selon [[Fournisseurs et délais]]. Devis dans\n' +
      '[[Grille de prix 2026]].',
    false,
    9,
  ],
  [
    'essai-note-6',
    'Grille de prix 2026',
    'Bouquet simple 28 €, composition 45 €, arche sur devis.\n' +
      'Livraison offerte au-delà de 60 €.',
    false,
    40,
  ],
  [
    'essai-note-7',
    'Abonnements accueil',
    'Trois entreprises, livraison le mardi matin. Renouvellement tacite.\n\n' +
      'Tarifs alignés sur [[Grille de prix 2026]].',
    false,
    18,
  ],
  [
    'essai-note-8',
    'Refaire les étiquettes',
    'Papier kraft, tampon à l’encre sépia. Devis imprimeur à demander.',
    false,
    6,
  ],
  [
    'essai-note-9',
    'Atelier couronnes de l’Avent',
    'Deux sessions de dix personnes, début décembre. Matériel à chiffrer dans\n' +
      '[[Grille de prix 2026]].\n\n' +
      'Le déroulé reste à écrire : [[Déroulé atelier couronnes]].',
    false,
    2,
  ],
];
for (const [id, title, body, pinned, jours] of carnet) {
  await poser('notes', id, {
    title,
    body,
    authorEmail: EMAIL,
    pinned,
    createdAt: instant(-24 * jours),
  });
}

await poser('decisions', 'essai-dec-1', {
  title: 'Arrêter les livraisons du samedi',
  detail:
    'Trois commandes en moyenne, pour une demi-journée mobilisée. Le samedi retourne\n' +
    'à la boutique, où la fréquentation est la plus forte.',
  authorEmail: EMAIL,
  createdAt: instant(-24 * 15),
});

await poser('objectives', 'essai-obj-1', {
  label: 'Chiffre d’affaires du trimestre',
  unit: '€',
  targetValue: 24000,
  currentValue: 15400,
  periodLabel: 'T3 2026',
});
await poser('objectives', 'essai-obj-2', {
  label: 'Abonnements actifs',
  unit: '',
  targetValue: 12,
  currentValue: 7,
  periodLabel: 'T3 2026',
});

await poser('reports', 'essai-rap-1', {
  type: 'weekly',
  title: 'Semaine du 24 août',
  body:
    'Deux devis envoyés, un accepté. La facture 2026-0035 reste impayée à\n' +
    'quarante-cinq jours : relance téléphonique prévue lundi.',
  links: [],
  authorEmail: EMAIL,
  createdAt: instant(-24 * 3),
});

/* ─── La supervision : tous ses ÉTATS, pas seulement « nouveau » ───────────── */

/*
  Les incidents d'une base d'essai naissent tous « nouveau » et « critique ».
  Les écrans de supervision rendent pourtant quatre états — nouveau, acquitté,
  traité, fausse alerte — chacun avec sa couleur, sa pastille et ses commandes,
  et un « traité » n'apparaît même pas dans la liste par défaut (`status=open`,
  ce qui est le bon réglage : elle montre ce qui reste à faire).

  Sans ce passage, les garde-fous ne mesuraient qu'un quart de l'écran qui
  compte le plus pour une entreprise de cybersécurité.

  On ne CRÉE pas d'incident ici : un incident naît d'alertes réelles, passées
  par le tracker, et en fabriquer directement en base inventerait un objet que
  le produit n'a jamais construit lui-même. On se contente de faire avancer
  ceux qui existent — ce qu'un opérateur ferait.
*/
const listeIncidents = await fetch(`${API}/v1/incidents?status=tous&suppressed=tous`, {
  headers: { Authorization: `Bearer ${login.token}` },
})
  .then((r) => r.json())
  .then((j) => j.incidents ?? [])
  .catch(() => []);

const nouveaux = listeIncidents.filter((i) => i.status === 'new');
/*
  Les états DÉJÀ là — statuts et résolutions confondus, parce que « traité » et
  « fausse alerte » partagent le statut `resolved` et ne se ressemblent pas à
  l'écran : le second porte une note obligatoire et un libellé à lui.

  Un premier jet ne regardait que les statuts, et une base qui avait déjà un
  « traité » n'obtenait donc JAMAIS de fausse alerte — l'état le plus rare, et
  celui qu'on relit quand on veut corriger la détection.
*/
const dejaVus = new Set([
  ...listeIncidents.map((i) => i.status),
  ...listeIncidents.map((i) => i.resolution).filter(Boolean),
]);

const avances = [];

async function faireAvancer(id, chemin, corps) {
  const r = await fetch(`${API}/v1/incidents/${id}/${chemin}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` },
    body: JSON.stringify(corps ?? {}),
  });
  if (r.ok) {
    ecrits += 1;
    avances.push(corps?.resolution ?? chemin);
  } else {
    echecs += 1;
    console.error(`  ✗ incident ${chemin} → ${r.status} ${(await r.text()).slice(0, 160)}`);
  }
}

if (nouveaux.length === 0) {
  console.log(
    '\n  (aucun incident dans cette organisation : les états de supervision ne\n' +
      '   seront pas peuplés. Un incident naît du tracker, pas de ce script.)',
  );
} else {
  const aPrendre = (n) => nouveaux.splice(0, n);
  if (!dejaVus.has('acknowledged')) {
    for (const i of aPrendre(2)) await faireAvancer(i.id, 'acknowledge');
  }
  if (!dejaVus.has('resolved')) {
    for (const i of aPrendre(2)) {
      await faireAvancer(i.id, 'resolve', {
        resolution: 'resolved',
        note: 'Panne de liaison confirmée côté hébergeur, service rétabli.',
      });
    }
  }
  // Gardé SÉPARÉ du « traité » : les deux partagent le statut `resolved`, et
  // les confondre privait de fausse alerte toute base qui avait déjà un traité.
  if (!dejaVus.has('false_positive')) {
    const [fauxPositif] = aPrendre(1);
    if (fauxPositif) {
      // Un faux positif EXIGE une note côté serveur, et c'est bien ainsi : dire
      // « ce n'en était pas un » sans dire pourquoi ne se relit pas.
      await faireAvancer(fauxPositif.id, 'resolve', {
        resolution: 'false_positive',
        note:
          'Sonde de disponibilité lancée depuis un réseau bloqué par le pare-feu : ' +
          'le site répondait normalement ailleurs.',
      });
    }
  }
}

console.log(
  `\nSupervision : ${listeIncidents.length} incident(s) en base, ` +
    `états déjà présents ${[...dejaVus].join(', ') || 'aucun'}` +
    (avances.length > 0 ? `, avancés ici : ${avances.join(', ')}` : ', rien à avancer'),
);

console.log(`\n${ecrits} enregistrement(s) écrit(s), ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
console.log('\nLes écrans ont maintenant quelque chose dessus. Relancez les gardes navigateur.\n');
