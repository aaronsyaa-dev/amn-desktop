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

/* ─── Abonnements ──────────────────────────────────────────────────────────── */

/*
  Deux échéances DÉPASSÉES à dessein : ce sont elles qui forment la file, et
  l'unique ambre de l'écran Abonnements est la plaque « 2 à facturer ». Un bac à
  sable où tout est à jour ne permet pas de la mesurer. Un abonnement suspendu
  aussi, pour que le registre montre ses deux états.
*/
const ABOS = [
  ['essai-abo-1', 'Maintenance du site', 'Camille Renaud', 24000, 'monthly', -10, true],
  ['essai-abo-2', 'Supervision boutique', 'Hugo Marchand', 60000, 'quarterly', -4, true],
  ['essai-abo-3', 'Hébergement et sauvegardes', 'Nadia Bouvier', 18000, 'monthly', 4, true],
  ['essai-abo-4', 'Forfait retouches', 'Camille Renaud', 12000, 'monthly', 9, true],
  ['essai-abo-5', 'Supervision annuelle', 'Hugo Marchand', 284000, 'yearly', 113, true],
  ['essai-abo-6', 'Lettre mensuelle', 'Nadia Bouvier', 9000, 'monthly', 20, false],
];
for (const [cle, label, customerName, amountCents, period, dansJours, active] of ABOS) {
  await poser('subscriptions', cle, {
    label,
    customerName,
    customerEmail: '',
    amountCents,
    vatRate: 20,
    period,
    nextAt: jour(dansJours),
    active,
    createdAt: instant(-24 * 120),
  });
}

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

/*
  LES RENDEZ-VOUS SONT POSÉS À UNE HEURE PRÉCISE DU JOUR, pas « dans vingt
  heures ».

  La colonne d'heures de la vue Jour les dessine à leur hauteur réelle : semés
  en décalage horaire depuis maintenant, ils tombaient tous hors de la journée
  affichée, ou tous au même endroit selon l'heure d'exécution du script. Un
  jeu d'essai dont l'allure dépend de l'heure à laquelle on le rejoue ne permet
  pas de comparer deux captures.

  `aujourdHui(10, 30)` rend donc un instant du jour courant à l'heure dite.
*/
const aujourdHui = (heure, minute = 0, decalageJours = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + decalageJours);
  d.setHours(heure, minute, 0, 0);
  return d.toISOString();
};

const RDV = [
  ['essai-rdv-1', 'Atelier cadrage — refonte boutique', aujourdHui(10, 0), 60, 101, 'Camille Renaud', 'Visio', 'scheduled'],
  ['essai-rdv-2', 'Point hebdomadaire', aujourdHui(13, 30), 30, 0, '', '', 'scheduled'],
  ['essai-rdv-3', 'Livraison — Brasserie du Port', aujourdHui(15, 0), 90, 102, 'Hugo Marchand', '8 quai Neuf, Sète', 'scheduled'],
  ['essai-rdv-4', 'Rappel devis — Nadia', aujourdHui(17, 0), 30, 103, 'Nadia Bouvier', '', 'scheduled'],
  /* Tard dans la soirée, à dessein : il prouve deux choses d'un coup — que la
     colonne d'heures ÉLARGIT sa fenêtre au-delà de dix-neuf heures quand un
     rendez-vous l'exige, et que la carte de rappel apparaît dès qu'il reste un
     préavis à honorer dans la journée. */
  ['essai-rdv-7', 'Enlèvement tardif — traiteur', aujourdHui(19, 30), 45, 101, 'Camille Renaud', 'Atelier', 'scheduled'],
  ['essai-rdv-5', 'Repérage terrasse', aujourdHui(9, 30, 2), 90, 102, 'Hugo Marchand', 'Quai Neuf, Sète', 'scheduled'],
  ['essai-rdv-6', 'Essai bouquet mariage', aujourdHui(14, 0, -2), 45, 103, 'Nadia Bouvier', 'Atelier', 'done'],
];
for (const [cle, title, startAt, durationMin, clientId, clientName, location, status] of RDV) {
  await poser('appointments', cle, {
    title,
    startAt,
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

/* ─── Automatisations ──────────────────────────────────────────────────────── */

/*
  Une règle SUSPENDUE sur les factures échues : c'est la seule configuration qui
  produit l'ambre de l'écran Automatisations (« N en attente »). Une règle
  active n'attend rien — le moteur écrit dès qu'un poste est ouvert. Les autres
  sont actives, pour que les deux états de la phrase se voient.
*/
const REGLES = [
  ['essai-aut-1', 'invoiceOverdue', 'task', false, 'design@exemple.test'],
  ['essai-aut-2', 'formAnswer', 'task', true, ''],
  ['essai-aut-3', 'stockLow', 'logbook', true, ''],
  ['essai-aut-4', 'prospectWon', 'task', false, ''],
];
for (const [cle, trigger, action, enabled, assigneeEmail] of REGLES) {
  await poser('automations', cle, { trigger, action, enabled, assigneeEmail, createdAt: instant(-24 * 45) });
}

/* ─── Contrôles qualité ────────────────────────────────────────────────────── */

/*
  Quatre modèles, dont un jamais passé : la feuille doit savoir dire « aucun
  passage » aussi bien que montrer une trace. Les passages portent des heures
  réelles et des taux de conformité différents — un 4/6 au milieu de deux 6/6,
  sinon la colonne de droite de la trace n'a rien à distinguer.
*/
const MODELES = [
  ['essai-chk-1', 'Ouverture de boutique', [
    'Température des vitrines relevée',
    'Sol lavé et signalétique en place',
    'Caisse ouverte avec son fond',
    'Étiquettes de prix vérifiées',
    'Stock de sacs vérifié',
    'Terrasse installée',
  ]],
  ['essai-chk-2', 'Fermeture', [
    'Caisse comptée et fermée',
    'Vitrines éteintes',
    'Chambre froide contrôlée',
    'Poubelles sorties',
    'Alarme enclenchée',
    'Porte verrouillée',
    'Clés rangées',
  ]],
  ['essai-chk-3', 'Contrôle frigo', [
    'Température relevée',
    'Dates de péremption vérifiées',
    'Joints nettoyés',
    'Relevé consigné',
  ]],
  ['essai-chk-4', 'Réception livraison', [
    'Bon de livraison vérifié',
    'Quantités comptées',
    'État des emballages',
    'Chaîne du froid respectée',
    'Réserves notées',
  ]],
];
for (const [cle, title, items] of MODELES) {
  await poser('checklists', cle, { title, items, createdAt: instant(-24 * 120) });
}

const coches = (total, conformes) => Array.from({ length: total }, (_, i) => i < conformes);
const PASSAGES = [
  ['essai-run-1', 'essai-chk-1', aujourdHui(8, 5, -1), 'lea@exemple.test', coches(6, 6)],
  ['essai-run-2', 'essai-chk-1', aujourdHui(8, 31, -2), 'samir@exemple.test', coches(6, 4)],
  ['essai-run-3', 'essai-chk-1', aujourdHui(7, 58, -3), 'lea@exemple.test', coches(6, 6)],
  ['essai-run-4', 'essai-chk-2', aujourdHui(19, 40, -1), 'lea@exemple.test', coches(7, 7)],
  ['essai-run-5', 'essai-chk-3', aujourdHui(9, 15, 0), 'samir@exemple.test', coches(4, 4)],
];
for (const [cle, checklistId, doneAt, byEmail, checked] of PASSAGES) {
  await poser('checkRuns', cle, { checklistId, doneAt, byEmail, checked, note: '' });
}

/* ─── Matériel ─────────────────────────────────────────────────────────────── */

/*
  Quatre ressources, dont une libre toute la journée — les deux états de la
  grille d'occupation. Le créneau de la camionnette à 13 h 30 est celui que la
  maquette refuse : réserver 14 h → 16 h dessus produit le refus, et donc
  l'unique ambre de l'écran Matériel.
*/
const RESSOURCES = [
  ['essai-res-1', 'Camionnette', 'Véhicule'],
  ['essai-res-2', 'Salle du fond', 'Salle'],
  ['essai-res-3', 'Vidéoprojecteur', 'Matériel'],
  ['essai-res-4', 'Presse à chaud', 'Machine'],
];
for (const [cle, name, kind] of RESSOURCES) {
  await poser('resources', cle, { name, kind, createdAt: instant(-24 * 90) });
}

/* Les créneaux sont en heure LOCALE sans fuseau (`AAAA-MM-JJTHH:MM`) : c'est
   le format que l'écran compare en chaînes, et un ISO complet en Z ne s'y
   ordonnerait pas de la même façon. */
const creneau = (h, m, h2, m2) =>
  [`${jour(0)}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
   `${jour(0)}T${String(h2).padStart(2, '0')}:${String(m2).padStart(2, '0')}`];
const RESERVATIONS = [
  ['essai-rsv-1', 'essai-res-1', ...creneau(9, 0, 11, 30), 'Livraison Atelier Vermeil', 'samir@exemple.test'],
  ['essai-rsv-2', 'essai-res-1', ...creneau(13, 30, 15, 0), 'Tournée de l’après-midi', 'samir@exemple.test'],
  ['essai-rsv-3', 'essai-res-2', ...creneau(15, 0, 16, 0), 'Point de production', 'clara@exemple.test'],
  ['essai-rsv-4', 'essai-res-3', ...creneau(11, 0, 12, 30), 'Présentation cliente', 'lea@exemple.test'],
];
for (const [cle, resourceId, startAt, endAt, purpose, byEmail] of RESERVATIONS) {
  await poser('resourceBookings', cle, { resourceId, startAt, endAt, purpose, byEmail, createdAt: instant(-48) });
}

/* ─── Tournées ─────────────────────────────────────────────────────────────── */

/*
  Deux arrêts livrés, quatre restants : c'est ce qui fait exister « l'arrêt en
  cours », l'unique ambre de l'écran Tournées. Une tournée entièrement livrée
  n'en a pas — elle est là aussi, pour que les deux cas se voient.
*/
const arret = (id, label, address, doneAt = null) => ({ id, label, address, doneAt });
await poser('deliveryRounds', 'essai-trn-1', {
  title: 'Tournée du matin',
  day: jour(0),
  stops: [
    arret('stp-1', 'Boulangerie Martin', '12 rue des Lilas, Nantes', aujourdHui(8, 24)),
    arret('stp-2', 'Café des Halles', '3 place du Bouffay, Nantes', aujourdHui(8, 51)),
    arret('stp-3', 'Fleuriste Camélia', '48 boulevard Gabriel Lauriol, Nantes'),
    arret('stp-4', 'Épicerie du Marché', '7 rue de Bel Air, Nantes'),
    arret('stp-5', 'Restaurant Le Cèdre', '21 rue Paul Bellamy, Nantes'),
    arret('stp-6', 'Atelier Vermeil', '12 rue Béranger, Nantes'),
  ],
  createdAt: aujourdHui(7, 0),
});
await poser('deliveryRounds', 'essai-trn-2', {
  title: 'Tournée de l’après-midi',
  day: jour(0),
  stops: [
    arret('stp-7', 'Studio Nord', '4 rue du Calvaire, Nantes'),
    arret('stp-8', 'Librairie du Guet', '9 rue de Verdun, Nantes'),
    arret('stp-9', 'Céramique Petit', '30 rue Crébillon, Nantes'),
  ],
  createdAt: aujourdHui(7, 0),
});
await poser('deliveryRounds', 'essai-trn-3', {
  title: 'Livraisons du lundi',
  day: jour(-4),
  stops: [
    arret('stp-10', 'Maison Bertaux', '18 rue Jean Jaurès, Nantes', aujourdHui(9, 12, -4)),
    arret('stp-11', 'Atelier Vermeil', '12 rue Béranger, Nantes', aujourdHui(10, 5, -4)),
    arret('stp-12', 'Café des Halles', '3 place du Bouffay, Nantes', aujourdHui(11, 30, -4)),
  ],
  createdAt: aujourdHui(7, 0, -4),
});

/* ─── Temps ────────────────────────────────────────────────────────────────── */

/*
  UNE PÉRIODE EN COURS, et c'est elle qui porte l'unique ambre de l'écran Temps
  (« 00:14:07 », la seule exception écrite de la règle de la plaque). Elle est
  démarrée quatorze minutes avant maintenant : le compteur affiche donc un
  chiffre plausible dès l'ouverture, sans dépendre de l'heure du semis.

  Les autres sont réparties sur la semaine, une déjà facturée, pour que
  « dont N déjà facturées » et « à facturer » disent chacun quelque chose.
*/
const minutesAvant = (n) => new Date(Date.now() - n * 60_000).toISOString();
const TEMPS = [
  ['essai-tps-1', 'Maquettes des gabarits', 'essai-prj-1', minutesAvant(14), '', ''],
  ['essai-tps-2', 'Retouches vitrine', 'essai-prj-3', minutesAvant(700), minutesAvant(549), instant(-20)],
  ['essai-tps-3', 'Cadrage Brasserie du Port', 'essai-prj-1', minutesAvant(1980), minutesAvant(1740), ''],
  ['essai-tps-4', 'Intégration des gabarits', 'essai-prj-1', minutesAvant(1670), minutesAvant(1450), ''],
  ['essai-tps-5', 'Sélection des visuels', 'essai-prj-2', minutesAvant(3100), minutesAvant(2950), ''],
  ['essai-tps-6', 'Appel client', 'essai-prj-3', minutesAvant(4400), minutesAvant(4340), ''],
];
for (const [cle, label, projectId, startedAt, endedAt, invoicedAt] of TEMPS) {
  await poser('timeEntries', cle, {
    label,
    projectId,
    startedAt,
    endedAt,
    invoicedAt,
    createdAt: startedAt,
  });
}

/* ─── Routines ─────────────────────────────────────────────────────────────── */

/*
  Les cases cochées sont posées en JOURS RÉELS remontant depuis aujourd'hui :
  c'est ce qui fait qu'une série vaut douze et une autre zéro, et donc que la
  matrice montre autre chose qu'une grille uniforme. Deux routines sont
  volontairement jamais faites — le trou doit se voir, c'est tout le propos.
*/
const joursCoches = (liste) => liste.map((n) => jour(-n));
const ROUTINES = [
  ['essai-rtn-1', 'Relever la caisse', joursCoches([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])],
  ['essai-rtn-2', 'Sauvegarder les fichiers du jour', joursCoches([0, 1, 4, 6])],
  ['essai-rtn-3', 'Relire la boîte de réception', joursCoches([0, 1, 2, 3, 5, 6])],
  ['essai-rtn-4', 'Arroser l’atelier', joursCoches([5, 6])],
  ['essai-rtn-5', 'Vérifier le frigo', joursCoches([2, 4, 6])],
];
for (const [cle, label, ticks] of ROUTINES) {
  await poser('routines', cle, { label, ticks: [...ticks].sort(), createdAt: instant(-24 * 60) });
}

/* ─── Réunions ─────────────────────────────────────────────────────────────── */

/*
  La dernière réunion a des décisions ET des suites ouvertes ; une autre a
  décidé SANS rien mettre en face — c'est elle qui porte l'unique ambre de
  l'écran Réunions, et sans elle le signal ne se mesure pas.
*/
const REUNIONS = [
  {
    cle: 'essai-reu-1',
    title: 'Point de production',
    at: aujourdHui(9, 30, -2),
    attendees: 'Léa, Clara, Samir',
    agenda: 'Ordre du jour — 1. Retard de la refonte boutique. 2. Charge de la semaine 38. 3. Faut-il refuser le catalogue hiver ?',
    decisions: [
      'La livraison Brasserie du Port passe au 19 septembre, annoncée aujourd’hui.',
      'Le catalogue hiver est refusé — la charge de septembre est déjà pleine.',
      'Samir reprend la retouche des visuels à partir de jeudi.',
    ],
    actions: [
      { id: 'act-1', label: 'Écrire à Hugo pour la nouvelle date', doneAt: null },
      { id: 'act-2', label: 'Décaler les jalons du projet', doneAt: null },
      { id: 'act-3', label: 'Prévenir Nadia du refus', doneAt: instant(-30) },
      { id: 'act-4', label: 'Bloquer deux jours de retouche jeudi', doneAt: instant(-26) },
    ],
  },
  {
    cle: 'essai-reu-2',
    title: 'Revue commerciale',
    at: aujourdHui(14, 0, -7),
    attendees: 'Léa, Clara',
    agenda: 'Ordre du jour — 1. Devis en attente. 2. Relances de septembre.',
    decisions: [
      'On relance Hugo Marchand une dernière fois avant de clore le devis.',
      'Les tarifs 2027 sont gelés jusqu’en novembre.',
    ],
    /* Aucune suite : c'est le cas que l'ambre existe pour montrer. */
    actions: [],
  },
  {
    cle: 'essai-reu-3',
    title: 'Cadrage Brasserie du Port',
    at: aujourdHui(11, 0, -10),
    attendees: 'Léa, Hugo Marchand',
    agenda: 'Ordre du jour — 1. Périmètre. 2. Budget. 3. Jalons.',
    decisions: ['Le périmètre est arrêté sur douze jardinières et l’entretien mensuel.'],
    actions: [{ id: 'act-5', label: 'Envoyer le devis détaillé', doneAt: instant(-200) }],
  },
];
for (const r of REUNIONS) {
  await poser('meetings', r.cle, {
    title: r.title,
    at: r.at.slice(0, 16),
    attendees: r.attendees,
    agenda: r.agenda,
    decisions: r.decisions,
    actions: r.actions,
    byEmail: EMAIL,
    createdAt: r.at,
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

/*
  DEUX RAPPORTS TIRÉS D'AILLEURS : sans `links`, la bande de provenance de
  l'écran Rapports n'existe pas, et c'est justement l'objet dominant de cet
  écran — et son unique ambre. Le troisième reste manuel, pour que l'absence de
  bande se voie aussi.
*/
await poser('reports', 'essai-rap-2', {
  type: 'client',
  title: 'Fin de la vitrine d’été — Brasserie du Port',
  body: [
    'La vitrine a été posée le 24 juillet, avec une semaine d’avance sur la date annoncée. Les trois panneaux ont été refaits une fois : le premier tirage rendait mal sous la lumière du soir, ce que le client avait signalé au cadrage.',
    '',
    'Ce qu’il faut retenir pour la prochaine : demander une photo de la vitrine à 19 h avant d’imprimer. Le devis suivant, la refonte de la boutique, en tient compte.',
  ].join('\n'),
  links: [
    { kind: 'client', id: '102', label: 'Hugo Marchand' },
    { kind: 'task', id: 'essai-tac-1', label: 'Livrer la vitrine d’été' },
  ],
  authorEmail: EMAIL,
  createdAt: instant(-24 * 2),
});
await poser('reports', 'essai-rap-3', {
  type: 'task',
  title: 'Installation Studio Nord',
  body: 'Pose faite en deux heures, sans reprise. Le local est accessible par l’arrière, ce qui change tout pour le déchargement — à noter pour les prochaines livraisons.',
  links: [{ kind: 'task', id: 'essai-tac-2', label: 'Installer chez Studio Nord' }],
  authorEmail: EMAIL,
  createdAt: instant(-24 * 21),
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
