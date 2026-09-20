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

/*
  LE SCRIPT SE RALENTIT LUI-MÊME, et ce n'est pas de la politesse.

  `amn-api` limite le nombre d'écritures par fenêtre de temps — la même
  protection qui existe en production contre un client emballé. Ce script en
  pose plus de cinq cents à la vitesse du réseau local : il finissait donc par
  se faire refuser ses dernières lignes en 429, au hasard de la collection qui
  tombait à ce moment-là. Le symptôme était sournois — « 549 écrits, 1 échec »,
  sur un enregistrement différent à chaque exécution.

  Deux mesures, dans cet ordre : une respiration régulière pour rester sous la
  limite, et un RENVOI unique après attente quand elle est quand même
  atteinte. Renvoyer sans ralentir aurait juste déplacé le problème d'un cran.
*/
const RESPIRATION_TOUS_LES = 25;
const RESPIRATION_MS = 120;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let poses = 0;

async function ecrire(collection, id, data) {
  return fetch(`${API}/v1/collections/${collection}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` },
    body: JSON.stringify({ data }),
  });
}

async function poser(collection, id, data) {
  poses += 1;
  if (poses % RESPIRATION_TOUS_LES === 0) await dormir(RESPIRATION_MS);

  let res = await ecrire(collection, id, data);
  /*
    TROIS RENVOIS, DE PLUS EN PLUS PATIENTS. Une seule seconde suffit quand la
    fenêtre vient juste de se remplir ; elle ne suffit pas quand le script est
    rejoué deux fois de suite, ce qui arrive tout le temps pendant un chantier
    de design. L'attente double à chaque essai plutôt que de se répéter à
    l'identique — retenter au même rythme contre une limite de débit, c'est
    l'alimenter.
  */
  for (let essai = 0; res.status === 429 && essai < 3; essai += 1) {
    await dormir(2000 * 2 ** essai);
    res = await ecrire(collection, id, data);
  }

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

/* ─── Le répertoire élargi : cinq fiches de plus ───────────────────────────── */

/*
  POURQUOI CINQ FICHES DE PLUS.

  Trois clientes suffisaient à remplir une liste ; elles ne suffisent à aucun
  des deux INSTRUMENTS de cette famille :

    • Le nuage de Clients (`14a`) place chaque fiche selon son silence et son
      chiffre d'affaires. Avec trois points tous récents, le quadrant « beaucoup
      de valeur, beaucoup de silence » est vide — l'objet dominant ne dit alors
      rien, et on ne peut pas vérifier qu'il dit vrai.
    • Les réglettes de Devis (`13a`) comparent des attentes sur un axe commun.
      Une seule réglette n'est pas une comparaison.

  Les silences sont posés par la date du dernier échange (`events[0].date`,
  c'est ce que lit l'écran), et le chiffre d'affaires par de vraies factures
  encaissées — jamais par un champ de total, qui mentirait dès la première
  facture ajoutée à la main.
*/
const REPERTOIRE_ELARGI = [
  {
    cle: '104', num: 104, name: 'Élodie Vasseur', company: 'Villa Sereine',
    status: 'active', silence: 96,
    notes: 'Hôtel de neuf chambres. Compositions d’accueil et terrasse. Plus de nouvelles depuis le printemps.',
    // Beaucoup de valeur, beaucoup de silence : le seul point du quadrant critique.
    factures: [[2400, 'Compositions d’accueil — trimestre'], [1800, 'Terrasse d’été — installation'], [1200, 'Réassort hebdomadaire']],
  },
  {
    cle: '105', num: 105, name: 'Bertrand Perrin', company: 'Atelier Perrin',
    status: 'active', silence: 118,
    notes: 'Menuiserie d’art. Deux jardinières de façade, entretien trimestriel.',
    factures: [[740, 'Jardinières de façade'], [500, 'Entretien trimestriel']],
  },
  {
    cle: '106', num: 106, name: 'Salomé Vallon', company: 'Cabinet Vallon',
    status: 'active', silence: 103,
    notes: 'Kinésithérapie. Plantes d’intérieur pour la salle d’attente.',
    factures: [[860, 'Plantes d’intérieur — pose et suivi']],
  },
  {
    cle: '107', num: 107, name: 'Jean Estève', company: 'Boulangerie Estève',
    status: 'active', silence: 94,
    notes: 'Deux bouquets de comptoir par semaine, suspendus depuis les travaux.',
    factures: [[980, 'Bouquets de comptoir — semestre'], [500, 'Décor de vitrine — Pâques']],
  },
  {
    cle: '108', num: 108, name: 'Théo Lambert', company: '',
    status: 'active', silence: 21,
    notes: 'Fleurit son cabinet d’architecte. Suivi régulier, jamais de retard.',
    factures: [[1400, 'Décor de bureau — trimestre'], [900, 'Réassort mensuel'], [900, 'Vitrine de rentrée']],
  },
];

for (const c of REPERTOIRE_ELARGI) {
  await poser('clients', c.cle, {
    name: c.name,
    company: c.company,
    status: c.status,
    email: `${c.cle}@exemple.test`,
    phone: '',
    notes: c.notes,
    imageDataUrl: '',
    linkedSiteIds: [],
    createdAt: instant(-24 * (c.silence + 120)),
    events: [
      {
        id: 1,
        clientId: c.num,
        title: 'Dernier échange',
        detail: 'Point sur la prestation en cours.',
        date: jour(-c.silence),
      },
    ],
  });
  let n = 0;
  for (const [euros, intitule] of c.factures) {
    n += 1;
    /* Encaissées, et dans l'exercice courant : c'est ce que le nuage lit en
       ordonnée, et ce que le demi-cercle de Facturation compte en « encaissé ». */
    const recul = c.silence + n * 21;
    await poser('invoices', `essai-fac-${c.cle}-${n}`, {
      number: `2026-01${c.cle}${n}`,
      clientId: c.num,
      billTo: { name: c.company || c.name, company: c.company, email: '', address: '', vatNumber: '' },
      issuedAt: jour(-recul),
      dueAt: jour(-recul + 30),
      lines: [ligne('l1', intitule, 1, euros / 1.2)],
      status: 'paid',
      paidAt: jour(-recul + 12),
      paymentMethod: 'virement',
      cancelReason: '',
      notes: '',
      quoteId: null,
    });
  }
}

/* ─── Devis : de quoi faire tourner les réglettes ──────────────────────────── */

/*
  CE QUE CHAQUE DEVIS PROUVE SUR L'AXE DE TRENTE JOURS.

    −3 / −6 / −9 j   trois réglettes SOUS le cran : le cran sert à quelque
                     chose, on voit trois attentes encore normales.
    −12 j            une réglette qui a franchi le cran (le cas de la maquette),
                     laissée en gris clair : franchie n'est pas la même chose
                     que « la plus urgente ».
    −34 j            plus vieille que l'axe : la barre est PLEINE, le chevron
                     dit que c'est l'axe qui s'arrête, pas l'attente, et c'est
                     elle qui porte l'ambre parce que c'est la plus ancienne
                     des franchies.
    sans sentAt      un devis parti avant que le produit note le jour d'envoi :
                     il est compté à part, jamais posé à zéro jour.
*/
const DEVIS_EN_ATTENTE = [
  ['essai-dev-4', 104, 'Entretien des massifs — automne', 'Taille, paillage, remise en état des bordures.', 1850, -3],
  ['essai-dev-5', 108, 'Décor de vitrine — Noël', 'Deux compositions suspendues et un centre de comptoir.', 720, -6],
  ['essai-dev-6', 105, 'Remise en état des jardinières', 'Terre neuve, replantation, arrosage automatique.', 430, -9],
  ['essai-dev-7', 106, 'Plantes d’intérieur — salle d’attente', 'Six sujets en pot, visite d’entretien mensuelle.', 980, -34],
];
for (const [cle, clientId, title, detail, priceEuro, envoiJours] of DEVIS_EN_ATTENTE) {
  await poser('quotes', cle, {
    clientId, title, detail, priceEuro,
    status: 'sent',
    paymentStatus: 'unpaid',
    sentAt: instant(24 * envoiJours),
    createdAt: instant(24 * (envoiJours - 2)),
  });
}
await poser('quotes', 'essai-dev-8', {
  clientId: 107,
  title: 'Bouquets de comptoir — reprise',
  detail: 'Deux bouquets par semaine, reprise après travaux.',
  priceEuro: 640,
  status: 'sent',
  paymentStatus: 'unpaid',
  sentAt: '',
  createdAt: instant(-24 * 26),
});

/*
  LA BANDE DES VINGT-QUATRE DERNIERS. Le ratio « accepté sur tranché » doit
  être VRAI, donc il se compte sur ces devis-là ; il n'est pas écrit quelque
  part. Les issues alternent sans régularité — quatre acceptés puis un refusé
  partout donnerait une bande rayée, c'est-à-dire un motif, et l'œil y lirait
  une cadence qui n'existe pas.
*/
const ISSUES = ['accepted', 'accepted', 'refused', 'accepted', 'accepted', 'accepted', 'refused', 'accepted',
  'accepted', 'accepted', 'accepted', 'refused', 'accepted', 'accepted', 'accepted', 'accepted',
  'refused', 'accepted', 'accepted', 'accepted'];
const INTITULES = ['Bouquet de mariée', 'Décor de vitrine', 'Compositions de table', 'Arche florale',
  'Jardinières de balcon', 'Plantes de bureau', 'Couronne de porte', 'Centre de table',
  'Massif d’entrée', 'Terrasse ombragée'];
for (let i = 0; i < ISSUES.length; i += 1) {
  const clientId = 101 + (i % 8);
  await poser('quotes', `essai-dev-passe-${i + 1}`, {
    clientId,
    title: `${INTITULES[i % INTITULES.length]} — ${2025 + (i % 2)}`,
    detail: 'Prestation proposée, tranchée depuis.',
    priceEuro: 180 + i * 45,
    status: ISSUES[i],
    paymentStatus: ISSUES[i] === 'accepted' ? 'paid' : 'unpaid',
    sentAt: instant(-24 * (40 + i * 9)),
    createdAt: instant(-24 * (44 + i * 9)),
  });
}


/*
  DEUX FACTURES RÉCENTES, une dans chaque semaine.

  Le miroir de la Revue hebdo compare la semaine en cours à la précédente sur
  six indicateurs, dont « facturé » et « encaissé ». Sans facture émise dans
  les quatorze derniers jours, ces deux paires restent à zéro des deux côtés —
  et une colonne à zéro n'a pas l'air d'un bac à sable incomplet, elle a l'air
  d'une semaine calme. Les dates sont posées en JOURS pour que les deux
  tombent toujours de part et d'autre du lundi, quel que soit le jour du semis.
*/
const lundiDernier = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
})();
const enJours = (d) => Math.round((Date.now() - d.getTime()) / 86_400_000);
const reculCetteSemaine = Math.max(0, enJours(lundiDernier) - 1);
const reculSemainePassee = enJours(lundiDernier) + 3;

await poser('invoices', 'essai-fac-recente-1', {
  number: '2026-0047',
  clientId: 102,
  billTo: {
    name: 'Brasserie du Port',
    company: 'Brasserie du Port',
    email: 'contact@brasserie-du-port.exemple.test',
    address: '4 quai des Docks\n34200 Sète',
    vatNumber: '',
  },
  issuedAt: jour(-reculCetteSemaine),
  dueAt: jour(30 - reculCetteSemaine),
  lines: [ligne('l1', 'Compositions de table — septembre', 8, 62)],
  status: 'issued',
  paidAt: '',
  paymentMethod: '',
  cancelReason: '',
  notes: '',
  quoteId: null,
});
await poser('invoices', 'essai-fac-recente-2', {
  number: '2026-0046',
  clientId: 101,
  billTo: {
    name: 'Camille Renaud',
    company: 'Le Jardin d’Élise',
    email: 'camille@jardin-elise.exemple.test',
    address: '12 rue des Lilas\n34000 Montpellier',
    vatNumber: '',
  },
  issuedAt: jour(-reculSemainePassee),
  dueAt: jour(30 - reculSemainePassee),
  lines: [ligne('l1', 'Bouquet de saison — livraison hebdomadaire', 14, 45)],
  status: 'issued',
  paidAt: jour(-reculCetteSemaine),
  paymentMethod: 'Virement',
  cancelReason: '',
  notes: '',
  quoteId: null,
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

/*
  LES QUATRE PALIERS DE RELANCE, un par facture.

  `src/lib/relances.ts` gradue le ton sur le retard : rappel jusqu'à 7 jours,
  ferme au-delà, mise en demeure passé 21, dernier avis passé 45. Une seule
  facture échue ne montrait qu'un palier, et un écran de relances qui n'a qu'un
  ton ne prouve rien de la gradation — ni le défaut d'avant (quatre lettres de
  gravités différentes, toutes de la même taille), ni sa correction.

  Les montants montent avec le retard, ce qui est l'ordre habituel des choses :
  on laisse plus longtemps filer une grosse facture qu'un petit solde.
*/
/*
  DEUX CORRECTIONS, ET ELLES COMPTENT.

  1. LES NOMS SUIVENT ENFIN LEUR `clientId`. Ces factures portaient « Studio
     Nord », « Maison Bertaux », « Léa Fontaine » sur les identifiants 104,
     105 et 106 — qui sont Villa Sereine, Atelier Perrin et Cabinet Vallon.
     Personne ne levait d'erreur sur une référence qui pointe ailleurs, mais
     le nuage de Clients (`14a`) additionnait ces montants au chiffre
     d'affaires de fiches qui ne les avaient jamais facturés. Villa Sereine y
     pesait 6 000 € au lieu de 5 400.

  2. LE RETARD LE PLUS LONG PASSE DE 61 À 40 JOURS. L'échelle d'escalade
     (`14d`) doit montrer sa marche du haut VIDE, avec « personne » en filet
     pointillé : c'est elle qui donne son sens aux trois autres. À 61 jours,
     la créance montait au dernier avis et la marche n'était jamais vide. À
     40 elle reste en mise en demeure — ce qui garde la montée de ton
     (relancée « ferme » il y a un mois) tout en laissant le haut libre.
*/
const ECHUES = [
  { cle: 'essai-fac-4', numero: '2026-0044', clientId: 102, nom: 'Hugo Marchand', societe: 'Brasserie du Port',
    email: 'h.marchand@brasserie-port.exemple.test', adresse: '4 quai des Docks\n34200 Sète',
    retard: 4, libelle: 'Reportage photo — demi-journée', quantite: 1, prix: 500 },
  { cle: 'essai-fac-5', numero: '2026-0039', clientId: 107, nom: 'Jean Estève', societe: 'Boulangerie Estève',
    email: '107@exemple.test', adresse: '17 boulevard du Jeu de Paume\n34000 Montpellier',
    retard: 12, libelle: 'Composition florale — vitrine de rentrée', quantite: 4, prix: 185 },
  { cle: 'essai-fac-7', numero: '2026-0031', clientId: 105, nom: 'Bertrand Perrin', societe: 'Atelier Perrin',
    email: '105@exemple.test', adresse: '3 rue des Ébénistes\n34000 Montpellier',
    retard: 30, libelle: 'Jardinières de façade — solde', quantite: 1, prix: 620 },
  { cle: 'essai-fac-6', numero: '2026-0027', clientId: 106, nom: 'Salomé Vallon', societe: 'Cabinet Vallon',
    email: '106@exemple.test', adresse: '9 rue de la Loge\n34000 Montpellier',
    retard: 40, libelle: 'Aménagement de la cour — solde', quantite: 1, prix: 2400 },
];
for (const f of ECHUES) {
  await poser('invoices', f.cle, {
    number: f.numero,
    clientId: f.clientId,
    billTo: { name: f.nom, company: f.societe, email: f.email, address: f.adresse, vatNumber: '' },
    issuedAt: jour(-f.retard - 30),
    dueAt: jour(-f.retard),
    lines: [ligne('l1', f.libelle, f.quantite, f.prix)],
    status: 'issued',
    paidAt: '',
    paymentMethod: '',
    cancelReason: '',
    notes: '',
    quoteId: null,
  });
}

/*
  UNE RELANCE DÉJÀ ENVOYÉE, à un palier plus doux que celui d'aujourd'hui.

  C'est le seul moyen de faire exister « le ton doit monter » : la facture la
  plus ancienne a été relancée en ferme il y a un mois, elle est passée en
  dernier avis depuis. Sans cette trace, la branche ne s'affiche jamais et ne se
  vérifie pas sur capture.
*/
await poser('paymentReminders', 'essai-rel-1', {
  invoiceId: 'essai-fac-6',
  sentAt: instant(-24 * 31),
  byEmail: EMAIL,
  note: '',
  palier: 'ferme',
});

/*
  LE SAV — des demandes d'âges très différents, dont une qui traîne.

  L'écran de SAV dit de lui-même que ce qui compte est l'ÂGE. Le bac à sable
  n'avait aucun ticket : la capture du 12 septembre rendait trois colonnes
  vides, et un écran vide ne prouve rien d'une composition. Les âges vont donc
  de deux heures à cinq semaines, avec une seule ouverte très vieille — celle
  que personne n'a prise, et qui doit dominer l'écran.
*/
/*
  LES ÂGES SONT CHOISIS POUR LE SABLIER (`24d`), pas au hasard.

  L'engagement est de 48 h. Une série d'âges tous supérieurs à deux jours
  donnerait cinq sabliers identiques, entièrement écoulés — c'est-à-dire un
  objet qui ne classe plus rien, alors que classer sans trier est toute sa
  raison d'être. Les cinq demandes non réglées couvrent donc l'échelle :

    2 h   → sablier presque plein   (4 % consommés)
    12 h  → un quart passé
    26 h  → un peu plus de la moitié
    41 h  → presque écoulé
    34 j  → écoulé, et largement dépassé — c'est lui qui porte l'ambre

  Le dernier prouve aussi la règle du rouge : une demande dépassée garde son
  sablier et ne devient PAS rouge, le rouge restant aux ruptures de stock.

  LES MOTIFS nourrissent les barres des douze derniers mois. Ils se répètent à
  dessein — un motif par demande donnerait autant de barres que de demandes,
  ce qui n'est pas une distribution mais une liste. Un ticket reste sans
  motif : le champ est facultatif, et l'écran doit savoir le dire.
*/
const TICKETS = [
  { cle: 'essai-sav-1', client: 'Brasserie du Port', sujet: 'Store de terrasse qui ne remonte plus', motif: 'Pose à reprendre',
    note: 'Appelé deux fois, sans retour de notre part.', etat: 'ouvert', ouvertIlYaH: 24 * 34, pris: '', resoluIlYaH: null },
  { cle: 'essai-sav-2', client: 'Maison Bertaux', sujet: 'Jardinière fendue à la livraison', motif: 'Article abîmé',
    note: 'Photo reçue, remplacement à commander.', etat: 'enCours', ouvertIlYaH: 41, pris: EMAIL, resoluIlYaH: null },
  { cle: 'essai-sav-3', client: 'Studio Nord', sujet: 'Deux plantes livrées au lieu de quatre', motif: 'Erreur de quantité',
    note: '', etat: 'ouvert', ouvertIlYaH: 26, pris: '', resoluIlYaH: null },
  { cle: 'essai-sav-4', client: 'Le Jardin d’Élise', sujet: 'Facture en double sur la commande de juin', motif: 'Question de facture',
    note: 'Avoir à établir.', etat: 'enCours', ouvertIlYaH: 12, pris: 'nadia@exemple.test', resoluIlYaH: null },
  { cle: 'essai-sav-5', client: 'Atelier Fontaine', sujet: 'Demande de devis pour rallonger l’arrosage', motif: '',
    note: '', etat: 'ouvert', ouvertIlYaH: 2, pris: '', resoluIlYaH: null },

  /* Les réglées — dont trois DANS l'engagement et trois au-delà, pour que
     « délai moyen tenu » et « dépassements » disent chacun quelque chose. */
  { cle: 'essai-sav-6', client: 'Brasserie du Port', sujet: 'Éclairage de vitrine intermittent', motif: 'Pose à reprendre',
    note: '', etat: 'resolu', ouvertIlYaH: 24 * 12, pris: EMAIL, resoluIlYaH: 24 * 12 - 30 },
  { cle: 'essai-sav-7', client: 'Maison Bertaux', sujet: 'Changement d’horaire de livraison', motif: 'Livraison en retard',
    note: '', etat: 'resolu', ouvertIlYaH: 24 * 6, pris: 'hugo@exemple.test', resoluIlYaH: 24 * 6 - 20 },
  { cle: 'essai-sav-8', client: 'Studio Nord', sujet: 'Mousse sur la terrasse après la pluie', motif: 'Pose à reprendre',
    note: '', etat: 'resolu', ouvertIlYaH: 24 * 20, pris: EMAIL, resoluIlYaH: 24 * 20 - 96 },
  { cle: 'essai-sav-9', client: 'Villa Sereine', sujet: 'Livraison arrivée après la fermeture', motif: 'Livraison en retard',
    note: '', etat: 'resolu', ouvertIlYaH: 24 * 48, pris: EMAIL, resoluIlYaH: 24 * 48 - 40 },
  { cle: 'essai-sav-10', client: 'Cabinet Vallon', sujet: 'Bac reçu ébréché', motif: 'Article abîmé',
    note: '', etat: 'resolu', ouvertIlYaH: 24 * 95, pris: 'nadia@exemple.test', resoluIlYaH: 24 * 95 - 24 },
  { cle: 'essai-sav-11', client: 'Le Jardin d’Élise', sujet: 'Créneau de livraison non tenu', motif: 'Livraison en retard',
    note: '', etat: 'resolu', ouvertIlYaH: 24 * 140, pris: EMAIL, resoluIlYaH: 24 * 140 - 18 },
  { cle: 'essai-sav-12', client: 'Studio Nord', sujet: 'Trois bacs au lieu de cinq', motif: 'Erreur de quantité',
    note: '', etat: 'resolu', ouvertIlYaH: 24 * 190, pris: 'hugo@exemple.test', resoluIlYaH: 24 * 190 - 60 },
  { cle: 'essai-sav-13', client: 'Brasserie du Port', sujet: 'Commande livrée la veille du besoin', motif: 'Livraison en retard',
    note: '', etat: 'resolu', ouvertIlYaH: 24 * 250, pris: EMAIL, resoluIlYaH: 24 * 250 - 12 },
  { cle: 'essai-sav-14', client: 'Maison Bertaux', sujet: 'Composition abîmée au transport', motif: 'Article abîmé',
    note: '', etat: 'resolu', ouvertIlYaH: 24 * 300, pris: EMAIL, resoluIlYaH: 24 * 300 - 36 },
  { cle: 'essai-sav-15', client: 'Atelier Fontaine', sujet: 'Remise non appliquée', motif: 'Question de facture',
    note: '', etat: 'resolu', ouvertIlYaH: 24 * 330, pris: 'nadia@exemple.test', resoluIlYaH: 24 * 330 - 26 },
];
for (const tk of TICKETS) {
  await poser('tickets', tk.cle, {
    client: tk.client,
    subject: tk.sujet,
    reason: tk.motif,
    note: tk.note,
    status: tk.etat,
    openedAt: instant(-tk.ouvertIlYaH),
    takenBy: tk.pris,
    resolvedAt: tk.resoluIlYaH === null ? null : instant(-tk.resoluIlYaH),
  });
}

/*
  LES RENDEZ-VOUS EN LIGNE — la page publique, ouverte et pourvue.

  L'écran de réglage montre désormais l'APERÇU du visiteur : sans config
  semée, il rend une page fermée, sans titre et sans créneau — l'état d'un
  compte neuf, pas celui qu'on veut juger. Fenêtres de matin en semaine, plus
  le samedi matin, et une durée de 30 minutes : de quoi remplir quinze jours
  de créneaux réels.
*/
await poser('bookingConfig', 'config', {
  enabled: true,
  title: 'Prendre rendez-vous à l’atelier',
  intro: 'Trente minutes pour voir votre projet ensemble : plans, végétaux, budget. Venez avec des photos si vous en avez.',
  durationMin: 30,
  location: 'Atelier — 14 rue des Aiguières, Montpellier',
  availability: {
    mon: [{ from: '09:00', to: '12:00' }],
    tue: [{ from: '09:00', to: '12:00' }],
    wed: [{ from: '14:00', to: '17:00' }],
    thu: [{ from: '09:00', to: '12:00' }],
    fri: [{ from: '09:00', to: '11:00' }],
    sat: [{ from: '10:00', to: '12:00' }],
  },
});

/* ─── Abonnements ──────────────────────────────────────────────────────────── */

/*
  Deux échéances DÉPASSÉES à dessein : ce sont elles qui forment la file, et
  l'unique ambre de l'écran Abonnements est la plaque « 2 à facturer ». Un bac à
  sable où tout est à jour ne permet pas de la mesurer. Un abonnement suspendu
  aussi, pour que le registre montre ses deux états.
*/
/*
  QUATRE FORFAITS, TREIZE ABONNÉS.

  La colonne du module `13b` empile des FORFAITS, pas des abonnements : trois
  clients sur la même maintenance forment une seule part de trois fois le
  montant. Six abonnements tous différents, comme ici avant, donnaient six
  parts d'un client chacune — c'est-à-dire un second registre, pas une offre.

  Le mélange est choisi pour que la phrase de `MODULES.md` soit vérifiable :

    Maintenance du site          240 € × 3 =   720 €/mois
    Hébergement et sauvegardes   180 € × 5 =   900 €/mois
    Forfait retouches             90 € × 4 =   360 €/mois
    Supervision annuelle       2 640 €/an  =   220 €/mois
                                             ─────────────
                                               2 200 €/mois

  Les deux plus lourds font 1 620 € sur 2 200, soit 73,6 % — « deux forfaits
  sur quatre font les trois quarts ». Et les treize abonnés donnent au ruban
  exactement les crans de la colonne.

  Deux échéances sont DÉPASSÉES à dessein : elles forment la file, et l'unique
  ambre de l'écran est la plaque « 2 à facturer ». Un abonnement suspendu
  aussi, pour que le registre montre ses deux états.
*/
const CLIENTS_ABO = ['Camille Renaud', 'Hugo Marchand', 'Nadia Bouvier', 'Élodie Vasseur',
  'Théo Lambert', 'Bertrand Perrin', 'Salomé Vallon', 'Jean Estève'];
const ABOS = [];
/* Maintenance du site — trois clients, dont un en retard (la file). */
[[-10, true], [6, true], [17, true]].forEach(([dansJours, active], i) => {
  ABOS.push([`essai-abo-maint-${i + 1}`, 'Maintenance du site', CLIENTS_ABO[i], 24000, 'monthly', dansJours, active]);
});
/* Hébergement et sauvegardes — cinq clients, dont un en retard. */
[[-4, true], [3, true], [11, true], [22, true], [28, true]].forEach(([dansJours, active], i) => {
  ABOS.push([`essai-abo-heb-${i + 1}`, 'Hébergement et sauvegardes', CLIENTS_ABO[i], 18000, 'monthly', dansJours, active]);
});
/* Forfait retouches — quatre clients, tous à jour. */
[[2, true], [9, true], [15, true], [25, true]].forEach(([dansJours, active], i) => {
  ABOS.push([`essai-abo-ret-${i + 1}`, 'Forfait retouches', CLIENTS_ABO[i + 3], 9000, 'monthly', dansJours, active]);
});
/* Supervision annuelle — un seul client, échéance lointaine : la part existe
   dans la colonne (ramenée au mois) sans cran dans le ruban, ce qui est
   exactement ce qu'un annuel doit montrer. */
ABOS.push(['essai-abo-annuel', 'Supervision annuelle', CLIENTS_ABO[1], 264000, 'yearly', 113, true]);
/* Un suspendu : le registre doit montrer ses deux états, et la colonne ne
   doit PAS le compter — un abonnement suspendu ne rapporte rien. */
ABOS.push(['essai-abo-suspendu', 'Lettre mensuelle', CLIENTS_ABO[2], 9000, 'monthly', 20, false]);
/*
  LE MÉNAGE DES CLÉS D'HIER — même raison que pour les fiches clientes : les
  six abonnements précédents portaient `essai-abo-1..6`. Rejouer le script ne
  les remplace pas, il ajoute les nouveaux à côté, et la colonne compterait
  dix-neuf abonnés pour treize.
*/
for (const ancienne of ['essai-abo-1', 'essai-abo-2', 'essai-abo-3', 'essai-abo-4', 'essai-abo-5', 'essai-abo-6']) {
  await fetch(`${API}/v1/collections/subscriptions/${ancienne}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${login.token}` },
  }).catch(() => undefined);
}

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

/* ─── Événements ───────────────────────────────────────────────────────────── */

/*
  TRENTE PLACES, VINGT-TROIS PRISES — les chiffres de la maquette, et ils ne
  sont pas décoratifs.

  Les cases d'inscription de `23e` sont AU NOMBRE EXACT DE PLACES : trente
  cases dont vingt-trois pleines. Une jauge de 200 donnerait deux cents petits
  carrés illisibles, une jauge de 4 ne prouverait rien. Trente est la taille à
  laquelle la règle se vérifie — on voit les sept restantes sans les compter.

  L'événement porte sa date, son horaire et son lieu : l'affiche a besoin des
  trois, et un jeu d'essai qui en oublierait un montrerait surtout la phrase
  « avant d'imprimer ». Un second événement les laisse justement incomplets,
  pour que cette phrase se vérifie aussi.

  Deux événements passés donnent au pied de l'affiche de quoi comparer.
*/
/*
  LES COÛTS SONT EN EUROS — ils étaient en centimes et multipliés par cent.

  Le même défaut que sur les encaissements : 42000 voulait dire 420 €, et
  `coutLieu * 100` en faisait 42 000 €. L'affiche annonçait alors un résultat
  de − 46 762 € et la liste « rentable, jamais ». Le chiffre était absurde, et
  c'est ce qui l'a fait voir : un instrument qui rend un résultat impossible
  dit qu'on l'a mal nourri.

  Les coûts sont maintenant choisis pour que le seuil TIENNE DANS LA JAUGE —
  sinon le module ne montre que son cas dégradé (« rentable, jamais »), qui est
  bien traité mais n'est pas le cas courant :

    Portes ouvertes   18 € × 0,95 − 4 € = 13,10 € nets par entrée
                      340 € de coûts fixes → seuil 26 entrées sur 30 places
                      23 vendues → il en reste 3 à vendre pour l'équilibre,
                      et 7 places libres. L'affiche a donc quelque chose à
                      dire, et les deux chiffres ne disent pas la même chose.
*/
const EVENEMENTS = [
  ['essai-evt-1', 'Portes ouvertes de l’atelier', 22, '10 h → 17 h',
    'Atelier — 14 rue des Aiguières', 30, 23, 18, 5, 150, 120, 70, 400],
  ['essai-evt-2', 'Atelier couronnes de l’Avent', 74, '',
    '', 16, 0, 45, 5, 0, 0, 0, 900],
  ['essai-evt-3', 'Marché de printemps', -46, '9 h → 18 h',
    'Place de la Comédie', 40, 38, 12, 5, 120, 70, 40, 300],
  ['essai-evt-4', 'Soirée dégustation', -118, '19 h → 22 h',
    'Cave Tramontane', 24, 17, 35, 5, 150, 90, 60, 800],
];
for (const [cle, nom, dansJours, horaire, lieu, capacite, billetsVendus,
             prixBillet, commission, coutLieu, coutPrestataires, coutCommunication,
             coutParEntree] of EVENEMENTS) {
  await poser('evenements', cle, {
    nom,
    date: jour(dansJours),
    horaire,
    lieu,
    capacite,
    billetsVendus,
    prixBilletCents: prixBillet * 100,
    commissionBilletterie: commission,
    coutLieuCents: coutLieu * 100,
    coutPrestatairesCents: coutPrestataires * 100,
    coutCommunicationCents: coutCommunication * 100,
    coutParEntreeCents: coutParEntree,
    annule: false,
    notes: '',
  });
}

/* ─── Contrats ─────────────────────────────────────────────────────────────── */

/*
  SEPT CONTRATS, CHOISIS POUR EXERCER LES TROIS RÈGLES DE LA FRISE (`14b`) :

    · une fin dans ONZE JOURS — la barre la plus courte, celle qui porte
      l'ambre et dont le nom se pose APRÈS son cap faute de place dedans ;
    · deux TACITES — leur barre court jusqu'au bord en fondu, sans cap ni
      date, et porte « tacite · sans échéance » à l'intérieur. Leur donner un
      cap à douze mois inventerait une échéance que personne ne doit préparer ;
    · une fin AU-DELÀ des douze mois — bornée au bord, chevron : c'est l'axe
      qui s'arrête, pas le contrat ;
    · trois fins réparties dans l'année, dont deux assez longues pour porter
      leur nom dedans.

  Le contrat le plus proche est au nom d'Hugo Marchand, qui porte aussi des
  abonnements : la carte « ce qui se décide » peut alors montrer ce qui tombe
  avec lui — par rapprochement de nom, faute de lien dans le modèle, et
  l'écran le dit.
*/
const CONTRATS = [
  ['essai-ctr-1', 'Maintenance et supervision', 'Hugo Marchand', -300, 11, 480000, false],
  ['essai-ctr-2', 'Entretien des extérieurs', 'Élodie Vasseur', -120, 74, 264000, false],
  ['essai-ctr-3', 'Fleurissement hebdomadaire', 'Camille Renaud', -400, 196, 720000, false],
  ['essai-ctr-4', 'Décoration saisonnière', 'Théo Lambert', -60, 311, 156000, false],
  ['essai-ctr-5', 'Abonnement bouquets', 'Nadia Bouvier', -220, 30, 96000, true],
  ['essai-ctr-6', 'Prestation de conseil', 'Salomé Vallon', -90, 30, 42000, true],
  ['essai-ctr-7', 'Contrat-cadre pluriannuel', 'Jean Estève', -500, 520, 1140000, false],
];
for (const [cle, title, party, debutJours, finJours, amountCents, autoRenew] of CONTRATS) {
  await poser('contracts', cle, {
    title,
    party,
    startsAt: jour(debutJours),
    endsAt: jour(finJours),
    amountCents,
    status: 'active',
    autoRenew,
    note: '',
    createdAt: instant(24 * debutJours),
  });
}

/* ─── Encaissements du mois, par moyen de règlement ────────────────────────── */

/*
  `Invoice.paymentMethod` est un champ LIBRE, et l'écran Caisse le regroupe par
  mot-clé après normalisation. Le jeu d'essai écrit donc les libellés tels
  qu'on les tape vraiment — « CB », « Espèces », « Virement SEPA » — et un
  quatrième qui n'entre dans aucune classe, pour que la ligne « autre » du
  regroupement soit visible et dite plutôt que silencieuse.
*/
/*
  LES MONTANTS SONT EN EUROS, PAS EN CENTIMES.

  Ils étaient écrits en centimes (24000, 8600, …) et passés à `ligne()`, qui
  attend des EUROS : un encaissement de 240 € devenait 24 000 €. Le défaut ne
  se voyait pas sur l'écran Caisse, où les quatre lignes sont juste « grandes »
  — il s'est vu sur le NUAGE de Clients (`14a`), où tous les disques se sont
  retrouvés plafonnés en haut de l'axe des 12 k€, flèche comprise. Un
  instrument qui borne dit qu'il borne, et c'est comme ça qu'on l'attrape.
*/
const ENCAISSEMENTS = [
  ['essai-enc-1', 101, 'Le Jardin d’Élise', 'CB', 240, -3],
  ['essai-enc-2', 103, 'Nadia Bouvier', 'Espèces', 86, -5],
  ['essai-enc-3', 108, 'Théo Lambert', 'Virement SEPA', 460, -8],
  ['essai-enc-4', 102, 'Brasserie du Port', 'Chèque', 120, -11],
  ['essai-enc-5', 104, 'Villa Sereine', 'Carte bleue', 310, -14],
];
for (const [cle, clientId, nom, moyen, euros, recul] of ENCAISSEMENTS) {
  await poser('invoices', cle, {
    number: `2026-02${cle.slice(-1)}0`,
    clientId,
    billTo: { name: nom, company: nom, email: '', address: '', vatNumber: '' },
    issuedAt: jour(recul - 5),
    dueAt: jour(recul + 25),
    lines: [ligne('l1', 'Prestation réglée sur place', 1, euros / 1.2)],
    status: 'paid',
    paidAt: jour(recul),
    paymentMethod: moyen,
    cancelReason: '',
    notes: '',
    quoteId: null,
  });
}

/* ─── Caisse du jour ───────────────────────────────────────────────────────── */

/*
  QUATORZE JOURS, DONT TROIS NON COMPTÉS.

  L'instrument de `11c` pose une règle : un jour dont la caisse n'a pas été
  comptée n'a PAS de barre, seulement son fantôme, et cette absence est
  l'information. Une série complète ne permet pas de le vérifier — d'où trois
  trous volontaires, dont un dimanche.

  La journée habituelle est la MÉDIANE des jours comptés. Les montants tournent
  donc autour de 420 € avec deux jours francs au-dessus (un samedi de marché) et
  deux au-dessous : une médiane qui ne bouge pas pour un jour exceptionnel est
  précisément ce qu'on veut dire par « habituelle ».

  Le jour courant est semé à 78 % de l'habituelle, comme la maquette : la
  colonne doit se lire aux trois quarts pleine, sous le cran des 100 %.
*/
const CAISSE_SUITE = [
  [13, 41800], [12, 38400], [11, null], [10, 45200], [9, 39600],
  [8, 62800], [7, null], [6, 42600], [5, 40100], [4, 44300],
  [3, 58200], [2, null], [1, 40900],
];
for (const [recul, especes] of CAISSE_SUITE) {
  if (especes === null) continue;
  const j = jour(-recul);
  /* Le compté s'écarte du attendu de quelques euros certains jours : un écart
     n'est pas une faute, c'est un chiffre qu'on voit — et une suite d'écarts
     tous nuls ne permet pas de vérifier que l'écran sait les montrer. */
  const ecart = recul % 4 === 0 ? -250 : recul % 5 === 0 ? 180 : 0;
  await poser('cashCounts', `caisse-${j}`, {
    day: j,
    floatCents: 15000,
    expectedCents: especes,
    countedCents: 15000 + especes + ecart,
    note: '',
    byEmail: EMAIL,
    countedAt: instant(-24 * recul),
  });
}
/* Aujourd'hui : 78 % de l'habituelle (médiane des jours ci-dessus). */
await poser('cashCounts', `caisse-${jour(0)}`, {
  day: jour(0),
  floatCents: 15000,
  expectedCents: 32900,
  countedCents: 15000 + 32900,
  note: 'Journée calme, pluie toute la matinée.',
  byEmail: EMAIL,
  countedAt: instant(-2),
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
  /*
    LES BUDGETS SONT CHOISIS POUR EXERCER LES QUATRE ÉTATS D'UN RAIL (`12b`) :

      fournitures   712,00 € sur 600,00 €  → SORT du rail de 112,00 €, et
                                             c'est le plus gros dépassement,
                                             donc le seul ambre de l'écran ;
      autre          32,00 € sur  20,00 €  → sort aussi, mais de moins : il
                                             reste en gris, et c'est le CRAN
                                             qui dit qu'il est sorti ;
      deplacement   450,00 € sur 450,00 €  → AU CRAN, à l'euro. L'écran doit
                                             écrire « au cran » et non
                                             « 100 % » — atteindre son budget
                                             n'est pas le dépasser ;
      prestataire  1840,00 € sur 2000,00 € → tient, avec de la marge.

    `materiel` n'a pas de budget : pas de rail du tout, et une phrase en pied
    de carte qui dit pourquoi. Un rail est une longueur ; sans budget, il n'y
    en a aucune.
  */
  categoryBudgets: {
    prestataire: 200000,
    fournitures: 60000,
    deplacement: 45000,
    autre: 2000,
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
  ['essai-dep-4', 'Rouleaux de kraft', 'fournitures', 62560, -8],
  ['essai-dep-5', 'Train Paris — Lille', 'deplacement', 12400, -7],
  ['essai-dep-6', 'Péage et carburant', 'deplacement', 32600, -10],
  ['essai-dep-7', 'Disque dur de sauvegarde', 'materiel', 16800, -9],
  ['essai-dep-8', 'Sécateurs professionnels', 'materiel', 9400, -12],
  ['essai-dep-9', 'Location de camionnette', 'deplacement', 24000, -34],
  ['essai-dep-10', 'Impression de cartes', 'fournitures', 21000, -38],
  ['essai-dep-11', 'Prestation photo', 'prestataire', 52000, -41],
  ['essai-dep-12', 'Vitrophanie', 'fournitures', 14500, -66],
  ['essai-dep-13', 'Honoraires comptables', 'prestataire', 39000, -70],
  ['essai-dep-14', 'Étagères d’atelier', 'materiel', 27800, -74],
  /* Le second dépassement, plus petit : il prouve que l'ambre va au PLUS GROS
     et que les autres sorties de rail se lisent quand même, par le cran. */
  ['essai-dep-15', 'Frais de port express', 'autre', 3200, -4],
  /*
    LES MOIS DU DÉBUT D'ANNÉE. Les cuves couvrent janvier au mois courant ;
    sans rien avant juin, neuf cadres dont cinq vides ne montrent pas une
    année qui se remplit, ils montrent un module qui vient d'être installé.
  */
  ['essai-dep-16', 'Salon professionnel', 'deplacement', 42000, -110],
  ['essai-dep-17', 'Refonte du logo', 'prestataire', 86000, -142],
  ['essai-dep-18', 'Papeterie de printemps', 'fournitures', 19400, -168],
  ['essai-dep-19', 'Assurance atelier', 'autre', 64000, -205],
  ['essai-dep-20', 'Outillage de taille', 'materiel', 31500, -238],
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

/* ─── Stock ────────────────────────────────────────────────────────────────── */

/*
  LE STOCK EST RAPPROCHÉ DES LIGNES DE COMMANDE PAR NOM.

  Le modèle de stock n'a pas de référence, seulement un `name` — les intitulés
  sont donc écrits ici exactement comme les lignes de commande les écrivent,
  sinon la réservation ne trouve rien et l'écran dit « hors stock suivi » pour
  des articles qui existent.

  Un article est SOUS son seuil et un autre est en RUPTURE : les deux états que
  la batterie d'anneaux de Stock (`11b`) doit savoir montrer, et de quoi faire
  manquer le bon du dessus des Commandes.
*/
const STOCK = [
  ['essai-stk-1', 'Bouquet de saison', 18, 8],
  ['essai-stk-2', 'Jardinière garnie', 1, 4],
  ['essai-stk-3', 'Composition de table', 12, 6],
  ['essai-stk-4', 'Boutonnières', 40, 24],
  ['essai-stk-5', 'Couronne de porte', 0, 3],
  ['essai-stk-6', 'Mousse florale', 26, 10],
];
for (const [cle, name, quantity, minQuantity] of STOCK) {
  await poser('stockItems', cle, {
    name,
    quantity,
    minQuantity,
    unit: 'pièce',
    note: '',
    createdAt: instant(-24 * 90),
    /* `movedAt` est ce que l'écran lit pour « derniers mouvements » — il n'y a
       pas de journal de stock, seulement cette date. Les articles bougent à
       des moments différents, sinon la carte affiche cinq fois le même jour. */
    movedAt: instant(-24 * (2 + STOCK.findIndex((x) => x[0] === cle) * 5)),
  });
}

/*
  Les commandes n'arrivent normalement PAS d'ici : elles viennent du site
  public, par la clé de réception (voir docs/COMMANDES.md dans amn-api). On les
  écrit quand même dans le bac à sable, parce qu'un écran qui n'existe qu'avec
  des commandes ne se mesure pas sans commandes.

  Une par état de la chaîne, plus deux nouvelles en attente : c'est ce qui donne
  au premier maillon quelque chose à traiter, donc à l'écran son unique ambre.
*/
/*
  SIX BONS NON TRAITÉS, ET C'EST VOULU.

  La pile de `14c` montre QUATRE épaisseurs au maximum et annonce le reste en
  texte. Avec trois bons en attente, la règle ne se vérifie pas : on voit trois
  feuilles et aucune phrase. Six bons donnent quatre feuilles et « 2 autres
  attendent derrière », qui est exactement ce que la règle demande.

  Le bon du dessus commande QUATRE jardinières garnies alors que le stock en
  porte une : la carte « ce que l'acceptation déclenche » doit alors écrire
  « il manque 3 » en rouge. C'est la seule situation de cet écran qui appelle
  un geste immédiat, et le rationnement du rouge la réserve à ça.
*/
const COMMANDES = [
  ['essai-cmd-1', '#1841', 'new', -2, 'Camille Renaud', [['Jardinière garnie', 4, 95], ['Bouquet de saison', 2, 45]]],
  ['essai-cmd-2', '#1840', 'new', -9, 'Hugo Marchand', [['Jardinière garnie', 1, 95]]],
  ['essai-cmd-3', '#1839', 'new', -28, 'Nadia Bouvier', [['Composition de table', 4, 45]]],
  ['essai-cmd-9', '#1838', 'new', -41, 'Élodie Vasseur', [['Boutonnières', 12, 18]]],
  ['essai-cmd-10', '#1836', 'new', -57, 'Théo Lambert', [['Bouquet de saison', 3, 45]]],
  ['essai-cmd-11', '#1835', 'new', -66, 'Salomé Vallon', [['Couronne de porte', 1, 140]]],
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
/*
  Les deux dernières colonnes sont l'ESTIMATION EN JOURNÉES et l'ÂGE du
  projet. Sans estimation, la courbe de brûlage n'a rien à faire descendre —
  et un instrument qu'on ne peut pas voir tourner sur de vraies données n'est
  pas vérifiable. Deux projets en portent une, pour que l'écran ait à CHOISIR
  lequel montrer (le plus proche de sa livraison) au lieu de n'en avoir qu'un.
*/
const PROJETS = [
  ['essai-prj-1', 'Refonte boutique', 'en-cours', -6, 101, 'Reprendre la mise en page des fiches produit', 'high', 0, 55],
  ['essai-prj-2', 'Identité Studio Nord', 'en-cours', 14, 0, 'Maquette 2', 'normal', 24, 30],
  ['essai-prj-3', 'Vitrine automne', 'en-cours', 28, 102, 'Valider les visuels', 'normal', 12, 20],
  ['essai-prj-4', 'Catalogue hiver', 'idee', 45, 0, 'Devis à envoyer', 'normal', 0, 55],
  ['essai-prj-5', 'Signalétique atelier', 'idee', 62, 0, '', 'low', 0, 55],
  ['essai-prj-6', 'Cartes de visite', 'termine', -30, 103, '', 'low', 0, 90],
];
for (const [cle, title, status, dansJours, clientId, nextAction, priority, budgetDays, age] of PROJETS) {
  await poser('projects', cle, {
    title,
    status,
    structure: '',
    clientId,
    priority,
    nextAction,
    deadline: jour(dansJours),
    ...(budgetDays > 0 ? { budgetDays } : {}),
    link: '',
    notes: '',
    extra: {},
    createdAt: instant(-24 * age),
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

/*
  LES REGISTRES — fournisseurs, nomenclatures, modèles.

  Trois collections vides de plus. Un registre vide ne montre ni son ordre, ni
  ce qu'on y cherche, ni le défaut qu'il est censé faire remonter.

  Les fournisseurs portent trois SILENCIEUX à dessein : le module dit en tête
  que « les fournisseurs silencieux depuis trois mois remontent », et il faut
  de quoi vérifier que c'est vrai. Les nomenclatures portent une marge
  négative — vendre à perte sans le savoir est le seul vrai défaut de ce
  module.

  LES HALTÈRES (`15d`) demandent, en plus, deux choses par fiche : un délai
  PROMIS et une suite de délais CONSTATÉS. Les six fiches couvrent exprès les
  cinq cas que la règle de dix jours doit savoir dessiner :

    · Vidal         promis 3 j, constaté 3,0 j  → les deux points se touchent
    · Poterie       promis 5 j, constaté 6,0 j  → un petit écart, en matière
    · Métal         promis 4 j, constaté 9,5 j  → le plus gros écart : l'AMBRE
    · Papeterie     rien du tout                → pas d'haltère, et c'est juste
    · Bois          promis 7 j, constaté 6,0 j  → la barre PART À GAUCHE
    · Éclairage Sud promis 8 j, constaté 13,0 j → SORT de la règle de dix jours

  Le cas « Bois » est celui qui casse une implémentation naïve : un
  fournisseur plus rapide que sa promesse donne un écart négatif, et une barre
  écrite en `width: reel − promis` disparaîtrait. Le cas « Éclairage Sud »
  est celui qui casse l'axe : son disque doit s'arrêter au bord de la règle
  sans que l'écart chiffré, lui, soit tronqué.

  `livreIlYaJours` est la date de la dernière RÉCEPTION. Quand elle est plus
  ancienne que la commande, l'écran doit compter une commande en cours : c'est
  le cas de Vidal (dans les temps) et de Bois (largement au-delà du délai
  annoncé).
*/
const FOURNISSEURS = [
  { cle: 'sup-1', nom: 'Horticulture Vidal', fournit: 'Plants, terreau, engrais', contact: 'Marc Vidal', tel: '04 67 12 34 56', email: 'commandes@horti-vidal.exemple.test', derniereIlYaJours: 2, livreIlYaJours: 9, promis: 3, constates: [3, 2, 4, 3] },
  { cle: 'sup-2', nom: 'Poterie du Lez', fournit: 'Pots, jardinières, soucoupes', contact: 'Awa Diallo', tel: '04 67 98 76 54', email: 'awa@poterie-lez.exemple.test', derniereIlYaJours: 21, livreIlYaJours: 15, promis: 5, constates: [6, 5, 7, 6] },
  { cle: 'sup-3', nom: 'Métal & Structure', fournit: 'Supports, treillis, fixations', contact: 'Yannis Roche', tel: '04 67 55 44 33', email: 'contact@metal-structure.exemple.test', derniereIlYaJours: 128, livreIlYaJours: 118, promis: 4, constates: [9, 11, 8, 10] },
  { cle: 'sup-4', nom: 'Papeterie Sainte-Anne', fournit: 'Étiquettes, rubans, emballages', contact: '', tel: '04 67 22 11 00', email: '', derniereIlYaJours: null, livreIlYaJours: null, promis: null, constates: [] },
  { cle: 'sup-5', nom: 'Bois de l’Hérault', fournit: 'Bacs sur mesure, planches', contact: 'Sophie Nguyen', tel: '04 67 77 88 99', email: 'sophie@bois-herault.exemple.test', derniereIlYaJours: 40, livreIlYaJours: 46, promis: 7, constates: [6, 7, 5] },
  { cle: 'sup-6', nom: 'Éclairage Sud', fournit: 'Guirlandes, spots de vitrine', contact: '', tel: '', email: 'devis@eclairage-sud.exemple.test', derniereIlYaJours: 95, livreIlYaJours: 82, promis: 8, constates: [12, 14] },
];
for (const f of FOURNISSEURS) {
  await poser('suppliers', `essai-${f.cle}`, {
    name: f.nom,
    supplies: f.fournit,
    contact: f.contact,
    phone: f.tel,
    email: f.email,
    lastOrderAt: f.derniereIlYaJours === null ? null : instant(-24 * f.derniereIlYaJours),
    lastDeliveryAt: f.livreIlYaJours === null ? null : instant(-24 * f.livreIlYaJours),
    leadTimeDays: f.promis,
    deliveries: f.constates,
    createdAt: instant(-24 * 200),
  });
}

const compo = (label, quantity, unit, euros, dedans) => ({
  label,
  quantity,
  unit,
  unitCostCents: Math.round(euros * 100),
  ...(dedans ? { components: dedans } : {}),
});

/*
  LES BOÎTES GIGOGNES (`25b`) DEMANDENT DE VRAIS EMBOÎTEMENTS.

  Le module tient sur trois choses qu'une liste plate ne peut pas montrer :
  l'imbrication elle-même, la règle « la quantité d'une boîte MULTIPLIE celle
  de son contenu », et la boîte de sous-ensemble bloquée par une rupture.

  Deux kits portent donc trois niveaux. « Composition de vitrine » contient un
  sous-ensemble « Bouquet monté » ×3, qui contient lui-même de la mousse
  florale et un bouquet de saison : le coût du kit ne se lit correctement que
  si les 3 se propagent à l'intérieur. Et « Jardinière de terrasse » contient
  un sous-ensemble « Habillage fleuri » dont un article — « Couronne de
  porte » — est À ZÉRO dans le stock semé plus haut : c'est cette boîte-là qui
  porte l'ambre, l'article portant la mention rouge, et c'est le kit entier
  qui devient indisponible.

  Les deux autres kits restent PLATS à dessein : une nomenclature à un seul
  niveau doit continuer de s'afficher correctement, puisque c'est ce que le
  modèle portait avant ce chantier.
*/
const NOMENCLATURES = [
  {
    cle: 'bom-1',
    produit: 'Jardinière de terrasse — 1 m',
    vente: 145,
    composants: [
      compo('Bac bois traité', 1, 'pièce', 48),
      compo('Terreau', 40, 'L', 0.45),
      compo('Habillage fleuri', 1, 'ensemble', 0, [
        compo('Plants vivaces', 6, 'pièce', 4.2),
        compo('Mousse florale', 2, 'pièce', 3.2),
      ]),
      compo('Main-d’œuvre', 1.5, 'h', 22),
    ],
  },
  {
    cle: 'bom-2',
    produit: 'Composition de vitrine — saison',
    vente: 185,
    /*
      TROIS NIVEAUX, ET LA MULTIPLICATION QUI LES TRAVERSE.

      Trois bouquets montés, chacun avec un cœur qui contient lui-même deux
      articles. Le coût ne tombe juste que si le ×3 se propage jusqu'au
      troisième niveau : 3 × (1 × (18 + 3,20) + 2 × 3) = 81,60 €. Une somme à
      plat donnerait 30,20 € — et personne ne verrait l'erreur.
    */
    composants: [
      compo('Bouquet monté', 3, 'pièce', 0, [
        compo('Cœur du bouquet', 1, 'ensemble', 0, [
          compo('Bouquet de saison', 1, 'pièce', 18),
          compo('Mousse florale', 1, 'pièce', 3.2),
        ]),
        compo('Feuillage', 2, 'brin', 3),
      ]),
      compo('Mousse et support', 1, 'pièce', 9.5),
      compo('Main-d’œuvre', 2, 'h', 22),
    ],
  },
  {
    /* La marge NÉGATIVE : le seul vrai défaut que ce module puisse montrer. */
    cle: 'bom-3',
    produit: 'Suspension macramé — petite',
    vente: 34,
    composants: [compo('Corde coton', 18, 'm', 0.9), compo('Anneau laiton', 1, 'pièce', 3.4), compo('Pot céramique', 1, 'pièce', 11), compo('Main-d’œuvre', 0.75, 'h', 22)],
  },
  {
    /* Sans prix de vente : la marge ne doit PAS s'inventer un chiffre. */
    cle: 'bom-4',
    produit: 'Arche d’événement — location',
    vente: null,
    /*
      LE SOUS-ENSEMBLE BLOQUÉ. « Couronne de porte » est à zéro dans le stock
      semé plus haut : sa boîte parente porte l'ambre, l'article porte la
      mention rouge, et le kit entier devient indisponible.

      Il est posé ICI, sur le kit SANS prix de vente, et pas sur la
      jardinière : un article à 95 € glissé dans une nomenclature à 130 €
      l'aurait fait basculer à perte, et l'écran aurait alors signalé DEUX
      défauts différents sur le même produit. Un jeu d'essai doit isoler ce
      qu'il démontre.
    */
    composants: [
      compo('Structure alu', 1, 'pièce', 240),
      compo('Décor de couronnes', 2, 'ensemble', 0, [
        compo('Couronne de porte', 1, 'pièce', 95),
        compo('Mousse florale', 3, 'pièce', 3.2),
      ]),
      compo('Montage sur place', 3, 'h', 22),
    ],
  },
];
for (const b of NOMENCLATURES) {
  await poser('boms', `essai-${b.cle}`, {
    product: b.produit,
    components: b.composants,
    sellPriceCents: b.vente === null ? null : Math.round(b.vente * 100),
    createdAt: instant(-24 * 45),
  });
}

/*
  LES EMPLOIS FONT L'ÉTAGÈRE (`18d`).

  L'épaisseur d'une tranche est le nombre d'emplois. Sans compteurs, les cinq
  modèles auraient exactement la même tranche — une étagère de livres
  identiques, où « ce qui sert est épais et se voit de loin » ne se voit plus
  du tout. Les emplois sont donc contrastés à dessein : 92 pour la
  confirmation de commande qu'on envoie chaque jour, 0 pour la fermeture
  exceptionnelle qu'on n'a jamais servie.

  Deux modèles n'ont PAS de `updatedAt` : ils n'ont jamais été retouchés
  depuis leur création, ce que le relevé d'en-tête compte et que la phrase
  sous l'étagère nomme pour le plus employé.
*/
const MODELES_DE_TEXTE = [
  { cle: 'tpl-1', emplois: 92, retoucheIlYaJours: null, titre: 'Confirmation de commande', corps: 'Bonjour {prénom},\n\nVotre commande {numéro} est confirmée. Nous la préparons pour le {date}, et nous vous prévenons dès qu’elle est prête à retirer.\n\nBelle journée.' },
  { cle: 'tpl-2', emplois: 41, retoucheIlYaJours: 62, titre: 'Réponse à un devis', corps: 'Bonjour {prénom},\n\nMerci de votre demande. Vous trouverez le devis {numéro} en pièce jointe, valable {validité}. Je reste disponible si vous souhaitez ajuster quoi que ce soit.\n\nCordialement.' },
  { cle: 'tpl-3', emplois: 28, retoucheIlYaJours: 18, titre: 'Rappel de rendez-vous', corps: 'Bonjour {prénom},\n\nPetit rappel : nous nous voyons {date} à {heure}, {lieu}. Si ça ne va plus, dites-le-moi, on décale sans problème.' },
  { cle: 'tpl-4', emplois: 9, retoucheIlYaJours: 120, titre: 'Remerciement après livraison', corps: 'Bonjour {prénom},\n\nMerci pour votre confiance. J’espère que {produit} vous plaît. Un mot si quelque chose ne va pas, on s’en occupe.' },
  { cle: 'tpl-5', emplois: 0, retoucheIlYaJours: null, titre: 'Fermeture exceptionnelle', corps: 'Bonjour,\n\nL’atelier sera fermé le {date}. Les commandes prévues ce jour-là sont décalées au {report}. Merci de votre compréhension.' },
];
for (const m of MODELES_DE_TEXTE) {
  await poser('templates', `essai-${m.cle}`, {
    title: m.titre,
    body: m.corps,
    uses: m.emplois,
    /* Un modèle jamais employé n'a pas de date d'emploi : l'absence est une
       information, un zéro daté n'en serait pas une. */
    lastUsedAt: m.emplois > 0 ? instant(-24 * 2) : '',
    /* `editedAt`, pas `updatedAt` : la couche de synchro pose le sien et
       écraserait un champ métier du même nom. */
    editedAt: m.retoucheIlYaJours === null ? '' : instant(-24 * m.retoucheIlYaJours),
    createdAt: instant(-24 * 200),
  });
}

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
  /*
    LE RENDEZ-VOUS QUI CHANGE LA DÉCISION DE L'ÉCRAN DEVIS.

    Sa carte « ce qu'il y a à décider » ne dit pas la même chose selon qu'un
    rendez-vous physique est prévu le jour même avec le client à relancer : on
    n'écrit pas un mot à quelqu'un qu'on voit dans trois heures. Ce fait est LU
    dans l'agenda — d'où ce rendez-vous chez Salomé Vallon (106), la cliente du
    devis en attente depuis trente-quatre jours.
  */
  ['essai-rdv-8', 'Visite cabinet — plantes d’intérieur', aujourdHui(16, 30), 45, 106, 'Salomé Vallon', 'Cabinet Vallon, rue Foch', 'scheduled'],
];
/*
  QUATRE RENDEZ-VOUS PRIS DEPUIS LA PAGE PUBLIQUE.

  Le plateau de créneaux (`23d`) distingue trois états, et le troisième — le
  créneau PRIS EN LIGNE, barré — n'existe que si `source: 'booking'` est posé.
  Sans eux, le plateau ne montre que du libre et du bloqué, et deux de ses
  trois états ne se vérifient pas.

  Leur motif est celui que le visiteur a tapé : c'est ce que la carte
  « prises en ligne » affiche, et c'est pour ça qu'il faut de vraies phrases
  et non des libellés internes.
*/
const RDV_EN_LIGNE = [
  ['essai-rdvl-1', 'Projet de terrasse — premier échange', aujourdHui(11, 30, 2), 'Léna Fabre'],
  ['essai-rdvl-2', 'Bouquet de mariage — essai', aujourdHui(10, 0, 3), 'Yanis Roche'],
  ['essai-rdvl-3', 'Plantes de bureau — devis', aujourdHui(15, 0, 4), 'Cabinet Ferry'],
  ['essai-rdvl-4', 'Composition de deuil', aujourdHui(9, 30, 5), 'Marc Delaunay'],
];
for (const [cle, title, startAt, clientName] of RDV_EN_LIGNE) {
  await poser('appointments', cle, {
    title,
    startAt,
    durationMin: 30,
    clientId: 0,
    clientName,
    location: 'Atelier — 14 rue des Aiguières, Montpellier',
    notes: '',
    reminderMin: 30,
    status: 'scheduled',
    source: 'booking',
    createdAt: instant(-24 * 3),
  });
}

/*
  LA CHARGE DU MOIS — ce que le mois en densité (`24b`) demande pour exister.

  Le mois en densité lit la CLARTÉ d'une case comme le nombre d'heures prises
  ce jour-là, sur quatre paliers, et les pastilles comptent les rendez-vous.
  Avec une dizaine de rendez-vous tous posés sur trois jours, trente cases
  restaient identiques et l'objet ne montrait rien : une densité sans
  variation est un damier.

  Les journées ci-dessous sont choisies pour que LES QUATRE PALIERS existent
  (moins de 2 h, 2 à 4 h, 4 à 6 h, plus de 6 h) et pour qu'il reste de VRAIS
  jours vides — un mois plein partout ne dirait pas davantage qu'un mois vide.
  Elles couvrent aussi la semaine affichée, sans quoi la semaine détachée
  n'aurait que la colonne du jour à montrer.
*/
const MOTIFS_DU_MOIS = [
  ['Livraison hebdomadaire', 102, 'Hugo Marchand', '8 quai Neuf, Sète'],
  ['Atelier composition', 103, 'Nadia Bouvier', 'Atelier'],
  ['Visite chantier', 101, 'Camille Renaud', 'Chantier'],
  ['Point client', 106, 'Salomé Vallon', 'Visio'],
  ['Réassort vitrine', 0, '', 'Boutique'],
  ['Repérage terrasse', 102, 'Hugo Marchand', 'Quai Neuf, Sète'],
];
/* [décalage en jours, [[heure, minute, durée en minutes], …]] */
const CHARGE_DU_MOIS = [
  [-20, [[10, 0, 30]]],
  [-18, [[9, 0, 60], [14, 0, 120], [16, 30, 60]]],
  [-17, [[11, 0, 30]]],
  [-16, [[8, 30, 90], [15, 0, 60]]],
  [-15, [[8, 30, 90], [11, 0, 60], [14, 0, 180], [18, 0, 60]]],
  [-13, [[9, 30, 45], [16, 0, 45]]],
  [-12, [[9, 0, 60], [13, 0, 60], [16, 0, 90]]],
  [-11, [[9, 0, 240]]],
  [-9, [[8, 30, 120], [14, 30, 120]]],
  [-8, [[17, 0, 60]]],
  [-7, [[8, 0, 90], [10, 30, 120], [14, 30, 150]]],
  [-5, [[10, 0, 60], [15, 30, 30]]],
  [-4, [[9, 0, 60], [11, 0, 90], [16, 0, 60]]],
  [-3, [[14, 0, 45]]],
  [7, [[9, 30, 120], [15, 0, 60]]],
  [8, [[10, 0, 90]]],
  [10, [[8, 30, 60], [11, 0, 60], [14, 0, 180]]],
];
let nCharge = 0;
for (const [decalage, creneaux] of CHARGE_DU_MOIS) {
  for (const [heure, minute, duree] of creneaux) {
    const [title, clientId, clientName, location] = MOTIFS_DU_MOIS[nCharge % MOTIFS_DU_MOIS.length];
    nCharge += 1;
    await poser('appointments', `essai-rdvm-${nCharge}`, {
      title,
      startAt: aujourdHui(heure, minute, decalage),
      durationMin: duree,
      clientId,
      clientName,
      location,
      notes: '',
      reminderMin: 0,
      /* Le passé est TERMINÉ, l'avenir est prévu. Laisser des rendez-vous
         vieux de trois semaines en « prévu » donnerait un relevé « à venir »
         qui compte l'histoire. */
      status: decalage < 0 ? 'done' : 'scheduled',
      createdAt: instant(-24 * 30),
    });
  }
}

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

/* ─── Médias ───────────────────────────────────────────────────────────────── */

/*
  DIX IMAGES, ET DES POIDS QUI DIFFÈRENT VRAIMENT.

  Deux objets vivent sur cet écran et ils demandent des choses opposées :

  · le FILTRE par cliente n'existe qu'avec plusieurs clientes rattachées ;
  · le PAVAGE (`18c`) montre la part de surface de chaque dossier, et il ne
    montre rien si tous les fichiers pèsent pareil. Des vignettes identiques
    donneraient un pavage qui compte les fichiers au lieu de peser les
    octets — c'est-à-dire un histogramme déguisé.

  Les images sont donc des SVG dont la CHARGE varie : `poids` ajoute des
  formes, et les octets qui vont avec. Ce ne sont pas des tailles simulées,
  c'est le vrai poids de ce qui est stocké — le produit garde ses images en
  `data:`, et c'est cette chaîne-là que le pavage mesure.

  La répartition est choisie pour qu'une cliente occupe à elle seule plus de
  la moitié de l'espace : c'est le seul cas que le module sache signaler, et
  sans lui le pavage n'a pas d'ambre. Deux images ont plus de trois mois,
  pour que la phrase « archiver libérerait N » repose sur une mesure.
*/
const vignette = (fond, trait, poids) => {
  let formes = '';
  for (let k = 0; k < poids; k += 1) {
    const x = 12 + ((k * 37) % 200);
    const y = 12 + ((k * 53) % 200);
    const r = 6 + (k % 11);
    formes +=
      `<circle cx="${x}" cy="${y}" r="${r}" fill="${trait}" opacity="0.${(k % 4) + 2}"/>` +
      `<rect x="${x}" y="${y}" width="${r * 3}" height="4" fill="${trait}" opacity="0.15"/>`;
  }
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="${fond}"/>` +
        `<circle cx="120" cy="96" r="42" fill="${trait}" opacity="0.5"/>` +
        formes +
        `<rect x="36" y="156" width="168" height="10" fill="${trait}" opacity="0.35"/>` +
        `<rect x="36" y="180" width="108" height="10" fill="${trait}" opacity="0.25"/></svg>`,
    )
  );
};
/* [clé, nom, client, nom du client, fond, trait, poids, jours dans le passé] */
const MEDIAS = [
  /* Brasserie du Port — le dossier qui mange la moitié de l'espace. */
  ['essai-med-1', 'vitrine-ete-01.jpg', 102, 'Hugo Marchand', '#2b2722', '#d0c4a8', 60, -2],
  ['essai-med-2', 'vitrine-ete-02.jpg', 102, 'Hugo Marchand', '#242a2b', '#a8c6d0', 55, -2],
  ['essai-med-3', 'panneau-avant.png', 102, 'Hugo Marchand', '#2a2426', '#d0a8b8', 48, -21],
  ['essai-med-5', 'panneau-apres.png', 102, 'Hugo Marchand', '#252a26', '#b0d0a8', 44, -20],
  ['essai-med-6', 'terrasse-montage.jpg', 102, 'Hugo Marchand', '#2a2822', '#d0c08a', 38, -18],
  /* Villa Sereine — un dossier moyen. */
  ['essai-med-7', 'villa-terrasse-01.jpg', 104, 'Élodie Vasseur', '#23262b', '#9fb4d0', 22, -40],
  ['essai-med-8', 'villa-terrasse-02.jpg', 104, 'Élodie Vasseur', '#262329', '#c0a8d0', 18, -40],
  /* Cabinet Vallon — un petit dossier, et deux images de plus de trois mois. */
  ['essai-med-9', 'plantes-bureau.jpg', 106, 'Salomé Vallon', '#222a25', '#a8d0b4', 9, -120],
  ['essai-med-10', 'bac-recu.jpg', 106, 'Salomé Vallon', '#2a2422', '#d0b0a0', 7, -150],
  /* Sans cliente : la part que personne n'a rangée. */
  ['essai-med-4', 'croquis-devanture.jpg', null, '', '#26282a', '#b8b8c0', 14, -34],
];
for (const [cle, name, clientId, clientName, fond, trait, poids, dansJours] of MEDIAS) {
  await poser('media', cle, {
    name,
    dataUrl: vignette(fond, trait, poids),
    clientId,
    clientName,
    createdAt: instant(24 * dansJours),
  });
}

/* ─── Pages ────────────────────────────────────────────────────────────────── */

/*
  Quatre pages, dont une en LECTURE SEULE : c'est ce qui rend le rail lisible
  autrement que par le nombre de blocs. Une page qu'on ne peut pas modifier ne
  se distingue d'une autre par aucun contenu — seul son statut la distingue,
  donc le statut doit être écrit.

  La première porte les trois types de blocs que la maquette montre — texte,
  liste à cocher, tableau — parce qu'un écran de blocs dont tous les blocs sont
  du texte ne prouve rien de la pile.
*/
const PAGES = [
  [
    'essai-page-1',
    'Accueil d’un nouveau client',
    ['owner', 'admin'],
    [
      {
        id: 'essai-blc-1',
        type: 'text',
        text:
          'Le premier échange décide de tout le reste. On appelle dans les 24 h, on écoute plus qu’on ne présente, et on repart avec une date.',
      },
      {
        id: 'essai-blc-2',
        type: 'checklist',
        items: [
          { id: 'essai-cch-1', text: 'Créer la fiche client', done: true },
          { id: 'essai-cch-2', text: 'Envoyer le devis sous 48 h', done: true },
          { id: 'essai-cch-3', text: 'Poser le rendez-vous de cadrage', done: false },
        ],
      },
      {
        id: 'essai-blc-3',
        type: 'table',
        columns: ['Étape', 'Délai'],
        rows: [
          ['Appel de découverte', '24 h'],
          ['Devis', '48 h'],
        ],
      },
    ],
  ],
  [
    'essai-page-2',
    'Procédure d’ouverture',
    ['owner', 'admin'],
    [
      { id: 'essai-blc-4', type: 'text', text: 'Ouvrir à 8 h 30. Rideau, caisse, lumières de vitrine.' },
      {
        id: 'essai-blc-5',
        type: 'checklist',
        items: [
          { id: 'essai-cch-4', text: 'Relever la caisse de la veille', done: false },
          { id: 'essai-cch-5', text: 'Allumer la vitrine', done: false },
        ],
      },
    ],
  ],
  [
    'essai-page-3',
    'Tarifs et remises',
    /* Personne d'autre que la propriétaire : c'est la page en lecture seule du
       rail, et celle qui donne son sens à la mention « lecture seule ». */
    ['owner'],
    /*
      UN BLOC VIDE, VOULU. La page de profil (`18a`) n'a qu'un défaut à
      montrer : le bloc qui retient la page. Sans lui, l'objet dominant ne se
      voit que dans son cas calme — et la règle « un bloc vide se dessine à une
      hauteur minimale visible, il ne disparaît pas » ne se vérifie sur rien.
    */
    [
      { id: 'essai-blc-6', type: 'text', text: 'Remise maximale : 15 %. Au-delà, l’accord se demande.' },
      { id: 'essai-blc-6b', type: 'table', columns: ['Palier', 'Remise'], rows: [] },
      { id: 'essai-blc-6c', type: 'text', text: 'Les remises exceptionnelles se notent sur la fiche du client, pas ici.' },
    ],
  ],
  [
    'essai-page-4',
    'Contacts fournisseurs',
    ['owner', 'admin', 'member'],
    [
      {
        id: 'essai-blc-7',
        type: 'table',
        columns: ['Fournisseur', 'Contact', 'Délai'],
        rows: [
          ['Papeterie Vasseur', '01 45 22 08 17', '5 j'],
          ['Tissus du Nord', 'contact@exemple.test', '10 j'],
          ['Impression Leroux', '01 45 90 33 02', '3 j'],
        ],
      },
    ],
  ],
];
for (const [cle, title, editorRoles, blocks] of PAGES) {
  await poser('pages', cle, { title, editorRoles, blocks, updatedAt: instant(-24 * 3) });
}

/* ─── Le collectif : sondages, annonces, groupes ───────────────────────────── */

/*
  Les quatre écrans du collectif ne prouvent rien à une personne seule : un
  sondage sans votants, une annonce que personne n'a lue et un groupe sans fil
  sont trois états vides déguisés en contenu. Il faut des COLLÈGUES, et ils
  existent dans le bac à sable — quatre comptes `@exemple.test` ajoutés à
  l'organisation interne.

  Les adresses sont écrites ici plutôt que lues : ce script passe par l'API et
  ne voit pas la table des comptes. Si elles changent, les sondages auront des
  votes d'inconnus — visible tout de suite à l'écran, donc sans danger.
*/
const COLLEGUES = ['nadia@exemple.test', 'hugo@exemple.test', 'ines@exemple.test', 'marc@exemple.test'];
const MOI = EMAIL;

/*
  LE PLANNING D'ÉQUIPE, LES ABSENCES, LE PIPELINE.

  Les trois collections étaient vides : `shifts`, `leaves`, `prospects`. Un
  planning vide ne montre ni couverture ni trou, une frise d'absences sans
  barre ne montre rien du tout, et un entonnoir sans euros n'est pas un
  entonnoir. Les trois écrans se composent sur ce qui s'y accumule ; sans
  données, on dessine de mémoire.

  Les dates sont calculées à partir du LUNDI DE LA SEMAINE EN COURS, comme
  l'écran : semer « le 15 septembre » donnerait une semaine juste aujourd'hui
  et fausse jeudi prochain.
*/
const lundiCourant = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};
const jourDeLaSemaine = (n) => {
  const d = lundiCourant();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/*
  LA SEMAINE DESSINÉE POUR LE PLAN DES HEURES (`15e`).

  Le besoin est de 12 h par jour ouvré. La semaine est posée pour que les six
  formes que le plan doit savoir dessiner existent toutes :

    lundi     20 h  → la pile DÉPASSE la ligne : excédent de 8 h, pas de hachure
    mardi      8 h  → un petit déficit de 4 h, hachuré en matière
    mercredi  12 h  → pile exactement à la ligne : ni hachure ni excédent
    jeudi      4 h  → le plus gros déficit, 8 h : c'est lui qui porte l'AMBRE
    vendredi  12 h  → à la ligne
    samedi     8 h  → SOUS la ligne mais hors jours ouvrés : aucune hachure
    dimanche   0 h  → rien de posé, rien à dessiner

  Le total est de 64 h, et il doit se retrouver À L'IDENTIQUE dans la somme
  des cartes de personnes (20 + 20 + 12 + 8 + 4). C'est la règle « les heures
  affichées somment exactement ce que le graphique montre », et elle se
  vérifie à la main sur ce jeu-là.

  Les repos sont posés exprès sur des jours où la personne ne travaille pas :
  un repos vaut zéro heure et ne doit produire AUCUN segment — pas même un de
  zéro pixel.
*/
const POSTES = [
  [MOI, [0, 'journee'], [1, 'matin'], [4, 'journee'], [3, 'repos']],
  [COLLEGUES[0], [0, 'journee'], [2, 'journee'], [5, 'matin'], [3, 'repos']],
  [COLLEGUES[1], [0, 'matin'], [2, 'matin'], [5, 'matin']],
  [COLLEGUES[2], [1, 'apresmidi'], [4, 'matin'], [6, 'repos']],
  [COLLEGUES[3], [3, 'matin'], [0, 'repos'], [1, 'repos']],
];
/*
  ON EFFACE LA SEMAINE AVANT DE LA POSER, et c'est un correctif, pas un zèle.

  La clé d'une case est `shift-<email>-<jour>`. Rejouer le script écrase les
  cases qu'il pose — mais il ne touche pas à celles qu'une version PRÉCÉDENTE
  avait posées sur d'autres jours. Le bac à sable gardait donc la somme de
  toutes les semaines jamais semées : 108 h là où le jeu en décrit 64, un
  mardi sans déficit, et la règle « les heures somment ce que le graphique
  montre » vérifiable sur un total que personne n'a choisi.

  Sept jours × les membres connus : on retire tout, puis on pose. Supprimer
  une case qui n'existe pas est sans effet.
*/
const MEMBRES_CONNUS = [MOI, ...COLLEGUES];
for (let n = 0; n < 7; n += 1) {
  const day = jourDeLaSemaine(n);
  for (const email of MEMBRES_CONNUS) {
    await fetch(`${API}/v1/collections/shifts/${encodeURIComponent(`shift-${email}-${day}`)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${login.token}` },
    }).catch(() => undefined);
  }
}

for (const [email, ...cases] of POSTES) {
  for (const [n, kind] of cases) {
    const day = jourDeLaSemaine(n);
    await poser('shifts', `shift-${email}-${day}`, { email, day, kind, updatedAt: instant(-24 * 2) });
  }
}

/*
  LES ABSENCES — des plages, pas des cases : c'est ce qui distingue cet écran
  du planning. Une en cours aujourd'hui, deux à venir qui se chevauchent (la
  semaine où l'équipe sera la plus mince), une à valider, une passée.
*/
const ABSENCES = [
  { cle: 'abs-1', email: COLLEGUES[0], de: -1, a: 1, kind: 'conge', note: 'Déménagement', status: 'approved' },
  { cle: 'abs-2', email: COLLEGUES[1], de: 6, a: 12, kind: 'conge', note: '', status: 'approved' },
  { cle: 'abs-3', email: COLLEGUES[2], de: 8, a: 10, kind: 'conge', note: 'Mariage de ma sœur', status: 'approved' },
  { cle: 'abs-4', email: COLLEGUES[3], de: 3, a: 3, kind: 'teletravail', note: 'Livraison à la maison', status: 'pending' },
  { cle: 'abs-5', email: COLLEGUES[0], de: 4, a: 4, kind: 'maladie', note: '', status: 'pending' },
  { cle: 'abs-6', email: COLLEGUES[1], de: -21, a: -18, kind: 'conge', note: '', status: 'approved' },
];
for (const a of ABSENCES) {
  await poser('leaves', `essai-${a.cle}`, {
    email: a.email,
    from: jour(a.de),
    to: jour(a.a),
    kind: a.kind,
    note: a.note,
    status: a.status,
    decidedBy: a.status === 'approved' ? MOI : null,
    createdAt: instant(-24 * 9),
  });
}

/*
  LE PIPELINE — VINGT-QUATRE FICHES POUR QUE L'ENTONNOIR RÉTRÉCISSE.

  L'entonnoir de `14e` déduit ses largeurs des EFFECTIFS cumulés : une bande
  compte les fiches à son stade ou au-delà. Huit fiches donnaient 7 / 6 / 3 / 1,
  c'est-à-dire un entonnoir qui ne rétrécit presque pas au milieu — et la
  question du module, « où ça se resserre le plus », n'avait pas de réponse
  lisible.

  La répartition choisie donne exactement les effectifs cumulés :

    Contact       9 + 7 + 3 + 5 = 24   → 100 %
    Qualifié          7 + 3 + 5 = 15   →  62,5 %
    Devis envoyé          3 + 5 =  8   →  33,3 %
    Gagné                     5 =  5   →  20,8 %

  Les chutes sont donc − 37,5 %, − 46,7 % et − 37,5 % : LA FUITE EST ENTRE
  QUALIFIÉ ET DEVIS ENVOYÉ, et c'est elle qui porte l'ambre. Sept qualifiés
  sans devis : c'est le chiffre que la carte de gauche doit nommer.

  LES CINQ GAGNÉS VIENNENT TOUS DU BOUCHE À OREILLE — c'est ce que la carte de
  provenance doit pouvoir dire sans qu'on l'ait écrit en dur. Le champ
  `source` existe pour ça ; deux fiches le laissent vide, pour que la ligne
  « sans provenance notée » se vérifie aussi.

  « Menuiserie Vidal » n'a toujours pas bougé depuis vingt-six jours : c'est la
  seule décision qu'un pipeline demande, et elle descend sous l'entonnoir.
*/
const PROSPECTS = [
  /* Gagnés — cinq, tous par bouche à oreille. */
  ['pro-7', 'Hôtel du Parc', 'Hôtel du Parc', 8900, 'gagne', 'Signé — à basculer en client.', -12, 'bouche'],
  ['pro-9', 'Clinique Saint-Roch', 'Clinique Saint-Roch', 5400, 'gagne', 'Recommandé par l’Hôtel du Parc.', -19, 'bouche'],
  ['pro-10', 'Éric Nadaud', 'Cabinet Nadaud', 2100, 'gagne', 'Ami d’une cliente.', -27, 'bouche'],
  ['pro-11', 'Le Comptoir', 'Le Comptoir', 3600, 'gagne', 'Vu chez un confrère.', -34, 'bouche'],
  ['pro-12', 'Pharmacie Lauze', 'Pharmacie Lauze', 1500, 'gagne', 'Bouche à oreille de quartier.', -44, 'bouche'],
  /* Devis envoyé — trois. */
  ['pro-1', 'Claire Vasseur', 'Fleurs & Co', 1800, 'proposition', 'Devis envoyé, relance prévue lundi.', -3, 'site'],
  ['pro-2', 'Menuiserie Vidal', 'Menuiserie Vidal', 6400, 'proposition', 'Attend l’accord du gérant.', -26, 'salon'],
  ['pro-13', 'Studio Rive', 'Studio Rive', 2400, 'proposition', 'Devis parti mardi.', -6, 'site'],
  /* Qualifiés sans devis — sept, la fuite. */
  ['pro-3', 'Théo Lambert', 'Café des Halles', 950, 'qualifie', 'Budget confirmé.', -5, 'bouche'],
  ['pro-4', 'Résidence Les Cèdres', 'Syndic Aurea', 12500, 'qualifie', 'Trois bâtiments, visite faite.', -9, 'salon'],
  ['pro-14', 'Maison Bertaux', 'Maison Bertaux', 3200, 'qualifie', 'Veut du saisonnier, budget à caler.', -11, 'site'],
  ['pro-15', 'Crèche Les Lutins', 'Les Lutins', 1400, 'qualifie', 'Plantes non toxiques, à vérifier.', -14, 'bouche'],
  ['pro-16', 'Atelier Saval', 'Atelier Saval', 2800, 'qualifie', 'Attend la fin des travaux.', -17, 'salon'],
  ['pro-17', 'Bistrot Nord', 'Bistrot Nord', 1900, 'qualifie', 'Terrasse d’hiver.', -21, ''],
  ['pro-18', 'Cabinet Ferry', 'Cabinet Ferry', 4100, 'qualifie', 'Deux étages, besoin chiffré.', -8, 'site'],
  /* Premiers contacts — neuf. */
  ['pro-5', 'Sophie Arnaud', '', 400, 'contact', '', -1, 'site'],
  ['pro-6', 'Garage Peyron', 'Garage Peyron', 2200, 'contact', 'Rencontré au salon.', -2, 'salon'],
  ['pro-19', 'Épicerie Fine', 'Épicerie Fine', 800, 'contact', '', -2, 'site'],
  ['pro-20', 'Mairie annexe', 'Ville', 5600, 'contact', 'Appel d’offres possible.', -4, ''],
  ['pro-21', 'Coiffure Onde', 'Coiffure Onde', 700, 'contact', '', -4, 'bouche'],
  ['pro-22', 'Librairie Sillon', 'Librairie Sillon', 1100, 'contact', 'Vitrine de Noël.', -6, 'site'],
  ['pro-23', 'Cave Tramontane', 'Cave Tramontane', 1300, 'contact', '', -7, 'salon'],
  ['pro-24', 'Institut Mira', 'Institut Mira', 2600, 'contact', 'A demandé une visite.', -9, 'bouche'],
  ['pro-25', 'Traiteur Pons', 'Traiteur Pons', 3400, 'contact', 'Événementiel, gros volumes.', -10, 'salon'],
  /* Perdus — hors entonnoir, faute d'historique d'étapes. */
  ['pro-8', 'Boulangerie Mistral', 'Boulangerie Mistral', 3100, 'perdu', 'Parti chez un concurrent moins cher.', -20, 'site'],
  ['pro-26', 'Hôtel Bellevue', 'Hôtel Bellevue', 4700, 'perdu', 'Budget annulé.', -31, 'salon'],
];
for (const [cle, name, company, euros, stage, note, ilYaJours, source] of PROSPECTS) {
  await poser('prospects', `essai-${cle}`, {
    name,
    company,
    valueCents: euros * 100,
    stage,
    note,
    source,
    createdAt: instant(-24 * (Math.abs(ilYaJours) + 14)),
    movedAt: instant(24 * ilYaJours),
  });
}


/*
  LES MESSAGES PRIVÉS — dont deux fils où la balle est dans mon camp.

  L'écran calcule la DETTE : un fil dont le dernier mot vient de l'autre est un
  fil auquel je n'ai pas répondu. Sans données, cette branche n'existe pas et
  ne se voit pas. Deux fils se terminent donc sur un message d'un collègue —
  l'un d'il y a trois jours, l'autre d'hier — et deux autres se terminent sur
  le mien, pour que la différence se lise côte à côte.
*/
const DMS = [
  ['dm-1', COLLEGUES[0], MOI, 'La cliente de la Brasserie a rappelé pour la terrasse. Tu veux que je passe demain matin ?', -24 * 3],
  ['dm-2', MOI, COLLEGUES[0], 'Oui, vas-y. Prends les mesures de la jardinière du fond au passage.', -24 * 3 + 1],
  ['dm-3', COLLEGUES[0], MOI, 'C’est fait. Il manque 40 cm par rapport au plan — je t’envoie la photo. On commande une jardinière de plus ?', -24 * 3 + 6],
  ['dm-4', COLLEGUES[1], MOI, 'Je récupère le van vendredi à 8 h, ça te va pour la livraison de Sète ?', -20],
  ['dm-5', COLLEGUES[2], MOI, 'Merci pour le coup de main hier.', -24 * 6],
  ['dm-6', MOI, COLLEGUES[2], 'Avec plaisir. On remet ça quand tu veux.', -24 * 6 + 1],
  ['dm-7', MOI, COLLEGUES[3], 'Tu as bien reçu le planning de la semaine prochaine ?', -24 * 2],
];
for (const [cle, de, vers, corps, ilYaHeures] of DMS) {
  await poser('dms', `essai-${cle}`, { from: de, to: vers, body: corps, createdAt: instant(ilYaHeures) });
}


/*
  SONDAGES — un qui attend MA voix, un déjà tranché, un clos.

  Le premier est le seul qui demande quelque chose à celui qui regarde : c'est
  lui qui doit dominer l'écran. Les deux autres existent pour que la différence
  entre « on attend votre voix » et « c'est réglé » soit visible côte à côte.
*/
const SONDAGES = [
  {
    cle: 'essai-sond-1',
    question: 'Quel jour pour la réunion de rentrée ?',
    options: ['Mardi 22, 9 h', 'Mercredi 23, 14 h', 'Jeudi 24, 9 h'],
    /* Sans ma voix : c'est ce manque qui fait l'objet dominant. */
    votes: { [COLLEGUES[0]]: 1, [COLLEGUES[1]]: 1, [COLLEGUES[2]]: 0, [COLLEGUES[3]]: 1 },
    anonymous: false,
    closedAt: null,
    ilYaHeures: -20,
  },
  {
    cle: 'essai-sond-2',
    question: 'On garde le fournisseur actuel pour les contenants ?',
    options: ['Oui, on garde', 'Non, on change'],
    votes: { [MOI]: 0, [COLLEGUES[0]]: 0, [COLLEGUES[1]]: 1, [COLLEGUES[2]]: 0 },
    anonymous: false,
    closedAt: null,
    ilYaHeures: -52,
  },
  {
    cle: 'essai-sond-3',
    question: 'Nom de la nouvelle gamme',
    options: ['Atelier', 'Maison', 'Comptoir'],
    votes: { [MOI]: 1, [COLLEGUES[0]]: 1, [COLLEGUES[1]]: 1, [COLLEGUES[2]]: 2, [COLLEGUES[3]]: 0 },
    anonymous: true,
    closedAt: instant(-24 * 6),
    ilYaHeures: -24 * 9,
  },
];
for (const s of SONDAGES) {
  await poser('polls', s.cle, {
    question: s.question,
    options: s.options,
    votes: s.votes,
    createdBy: COLLEGUES[0],
    createdAt: instant(s.ilYaHeures),
    closedAt: s.closedAt,
    anonymous: s.anonymous,
  });
}

/*
  ANNONCES — une que tout le monde n'a PAS lue.

  C'est la seule configuration qui rend l'écran lisible : une annonce lue par
  tous est une archive, une annonce lue par personne vient d'être écrite. Celle
  du milieu — trois sur cinq — est la seule qui pose une question à l'autrice,
  et c'est donc elle qui doit dominer.
*/
const ANNONCES = [
  [
    'essai-ann-1',
    'Fermeture exceptionnelle le 25 septembre',
    'L’atelier sera fermé toute la journée du jeudi 25 pour l’entretien annuel des machines. Les livraisons prévues ce jour-là sont décalées au vendredi 26. Prévenez vos clients cette semaine plutôt que la veille.',
    [COLLEGUES[0], COLLEGUES[2]],
    -30,
  ],
  [
    'essai-ann-2',
    'Nouveau code d’alarme',
    'Le code change lundi. Il vous sera donné de vive voix, jamais par message.',
    [COLLEGUES[0], COLLEGUES[1], COLLEGUES[2], COLLEGUES[3]],
    -24 * 5,
  ],
];
for (const [cle, title, body, readBy, ilYaHeures] of ANNONCES) {
  await poser('announcements', cle, {
    title,
    body,
    authorEmail: MOI,
    createdAt: instant(ilYaHeures),
    readBy: [MOI, ...readBy],
  });
}

/*
  GROUPES — trois salles, et un fil qui a vraiment un dernier mot.

  Un groupe sans message est un nom dans une liste. Ce qui se juge sur cet
  écran, c'est une CONVERSATION : il en faut une assez longue pour qu'on voie
  comment elle se lit quand elle défile.
*/
const GROUPES = [
  ['essai-grp-1', 'Boutique', [MOI, COLLEGUES[0], COLLEGUES[1]]],
  ['essai-grp-2', 'Livraisons', [MOI, COLLEGUES[1], COLLEGUES[3]]],
  ['essai-grp-3', 'Bureau', [MOI, COLLEGUES[0], COLLEGUES[2]]],
];
for (const [cle, name, members] of GROUPES) {
  await poser('groups', cle, { name, members, createdBy: MOI, createdAt: instant(-24 * 40) });
}

const MESSAGES = [
  ['essai-grpm-1', 'essai-grp-1', COLLEGUES[0], 'La vitrine est posée, il reste le bandeau du haut.', -6],
  ['essai-grpm-2', 'essai-grp-1', MOI, 'Parfait. Tu as la photo pour le dossier ?', -5.5],
  ['essai-grpm-3', 'essai-grp-1', COLLEGUES[0], 'Je la mets dans Médias ce soir.', -5.2],
  ['essai-grpm-4', 'essai-grp-1', COLLEGUES[1], 'J’ai décalé la livraison Brasserie à jeudi, ils ferment demain.', -3],
  ['essai-grpm-5', 'essai-grp-1', MOI, 'Bien vu. Je préviens la cliente.', -2.6],
  ['essai-grpm-6', 'essai-grp-1', COLLEGUES[0], 'Le nouveau bandeau arrive lundi par transporteur.', -0.6],
  ['essai-grpm-7', 'essai-grp-2', COLLEGUES[3], 'Camionnette au garage jusqu’à mercredi.', -28],
  ['essai-grpm-8', 'essai-grp-3', COLLEGUES[2], 'Les contrats de septembre sont signés, tous les trois.', -50],
];
for (const [cle, groupId, authorEmail, body, ilYaHeures] of MESSAGES) {
  await poser('groupMessages', cle, { groupId, authorEmail, body, createdAt: instant(ilYaHeures) });
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
  passage » aussi bien que montrer une trace. « Ouverture de boutique » porte
  seul une vraie série (voir PASSAGES plus bas) parce que c'est le modèle sur
  lequel la carte perforée se lit ; les autres n'ont qu'un passage, ce qui est
  le cas courant d'un contrôle occasionnel.
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

/*
  Douze passages sur « Ouverture de boutique » : c'est ce que la carte perforée
  demande pour dire quelque chose. Les points non conformes sont choisis un par
  un, jamais par un préfixe — un helper qui coche « les N premiers » ferait
  trouer toutes les colonnes au même endroit, et la carte ne dirait plus rien.
  Ici la « Terrasse installée » (6e point) rate 7 fois sur 12, les « Étiquettes
  de prix » 3 fois, le lavage du sol 1 fois, les trois autres jamais : une
  colonne trouée nettement plus que les autres, ce que le module doit désigner.
  Les deux autres modèles gardent un passage chacun, et « Réception livraison »
  n'en a aucun — la feuille doit aussi savoir dire « aucun passage ».
*/
const PASSAGES = [
  ['essai-run-1', 'essai-chk-1', aujourdHui(8, 5, -1), 'lea@exemple.test', [true, true, true, true, true, false], 'Terrasse non sortie'],
  ['essai-run-2', 'essai-chk-1', aujourdHui(8, 31, -2), 'samir@exemple.test', [true, true, true, false, true, false], 'Terrasse non sortie (pluie), étiquetage à reprendre'],
  ['essai-run-3', 'essai-chk-1', aujourdHui(7, 58, -3), 'lea@exemple.test', [true, true, true, true, true, true], ''],
  ['essai-run-4', 'essai-chk-1', aujourdHui(8, 12, -4), 'lea@exemple.test', [true, true, true, true, true, false], 'Terrasse non sortie'],
  ['essai-run-5', 'essai-chk-1', aujourdHui(8, 40, -5), 'samir@exemple.test', [true, false, true, true, true, true], 'Autolaveuse en panne'],
  ['essai-run-6', 'essai-chk-1', aujourdHui(8, 3, -7), 'lea@exemple.test', [true, true, true, true, true, false], 'Terrasse non sortie'],
  ['essai-run-7', 'essai-chk-1', aujourdHui(8, 22, -8), 'samir@exemple.test', [true, true, true, false, true, true], 'Étiquetage à reprendre'],
  ['essai-run-8', 'essai-chk-1', aujourdHui(7, 51, -9), 'lea@exemple.test', [true, true, true, true, true, true], ''],
  ['essai-run-9', 'essai-chk-1', aujourdHui(8, 9, -10), 'lea@exemple.test', [true, true, true, true, true, false], 'Terrasse non sortie'],
  ['essai-run-10', 'essai-chk-1', aujourdHui(8, 35, -11), 'samir@exemple.test', [true, true, true, false, true, false], 'Terrasse non sortie (pluie), étiquetage à reprendre'],
  ['essai-run-11', 'essai-chk-1', aujourdHui(7, 47, -12), 'lea@exemple.test', [true, true, true, true, true, true], ''],
  ['essai-run-12', 'essai-chk-1', aujourdHui(8, 18, -14), 'samir@exemple.test', [true, true, true, true, true, false], 'Terrasse non sortie'],
  ['essai-run-13', 'essai-chk-2', aujourdHui(19, 40, -1), 'lea@exemple.test', [true, true, true, true, true, true, true], ''],
  ['essai-run-14', 'essai-chk-3', aujourdHui(9, 15, 0), 'samir@exemple.test', [true, true, true, true], ''],
];
for (const [cle, checklistId, doneAt, byEmail, checked, note] of PASSAGES) {
  await poser('checkRuns', cle, { checklistId, doneAt, byEmail, checked, note });
}

/* ─── Montage ──────────────────────────────────────────────────────────────── */

/*
  TROIS CHANTIERS, ET DES PIÈCES QUI PORTENT DE VRAIS NOMS D'ARTICLES.

  L'éclaté (`25a`) lit la disponibilité d'une pièce DANS LE STOCK, quand le
  nom de l'étape correspond à un article suivi. Des étapes écrites « poser le
  socle » ne correspondraient à rien : toutes les pièces seraient « non
  suivies », et la pièce MANQUANTE — celle qui porte l'ambre et qui est le
  seul vrai défaut que l'objet sache montrer — n'existerait sur aucun jeu
  d'essai.

  Le premier chantier porte donc sept pièces dont cinq sont des articles du
  stock semé plus haut, et l'une d'elles — « Couronne de porte » — est en
  rupture. Deux pièces restent volontairement hors stock suivi : l'écran doit
  savoir dire « non suivie » plutôt que de les déclarer disponibles par
  défaut. La dernière de la pile n'est ni manquante ni posée, pour que la
  phrase « c'est la seule qui se remplace sans démonter le reste » désigne
  quelqu'un d'autre que l'ambre.
*/
const etape = (id, label, faitIlYaH = null) => ({
  id,
  label,
  doneAt: faitIlYaH === null ? null : instant(-faitIlYaH),
});

const MONTAGES = [
  {
    cle: 'essai-asm-1',
    title: 'Arche florale — mariage Durand',
    client: 'Maison Bertaux',
    majIlYaH: 3,
    steps: [
      etape('asm1-a', 'Structure d’arche', 30),
      etape('asm1-b', 'Mousse florale', 27),
      etape('asm1-c', 'Bouquet de saison', 22),
      etape('asm1-d', 'Composition de table'),
      /* EN RUPTURE DANS LE STOCK — c'est elle, l'ambre de l'écran. */
      etape('asm1-e', 'Couronne de porte'),
      etape('asm1-f', 'Boutonnières'),
      etape('asm1-g', 'Ruban de satin'),
    ],
  },
  {
    cle: 'essai-asm-2',
    title: 'Décor de salon — Studio Nord',
    client: 'Studio Nord',
    majIlYaH: 30,
    steps: [
      etape('asm2-a', 'Plateau de présentation', 120),
      etape('asm2-b', 'Composition de table', 96),
      etape('asm2-c', 'Bouquet de saison'),
      etape('asm2-d', 'Signalétique de stand'),
      etape('asm2-e', 'Éclairage d’appoint'),
    ],
  },
  {
    cle: 'essai-asm-3',
    title: 'Vitrine d’automne — Brasserie du Port',
    client: 'Brasserie du Port',
    majIlYaH: 24 * 9,
    steps: [
      etape('asm3-a', 'Fond de vitrine', 24 * 12),
      etape('asm3-b', 'Mousse florale', 24 * 11),
      etape('asm3-c', 'Jardinière garnie', 24 * 10),
      etape('asm3-d', 'Guirlande de vitrine', 24 * 9),
    ],
  },
];
for (const m of MONTAGES) {
  await poser('assemblies', m.cle, {
    title: m.title,
    client: m.client,
    steps: m.steps,
    createdAt: instant(-24 * 20),
    updatedAt: instant(-m.majIlYaH),
  });
}

/* ─── Interventions ────────────────────────────────────────────────────────── */

/*
  QUATRE FICHES, ET CHACUNE EXISTE POUR UN ÉTAT DE L'ÉCRAN.

  · une fiche dont le volet « après » manque — c'est elle qui porte l'ambre,
    et c'est le seul défaut que ce module sache signaler ;
  · une fiche complète mais encore ouverte — l'ambre doit disparaître sans
    que la fiche soit close ;
  · une fiche à peine commencée — deux volets vides sur trois, pour que la
    colonne « ce qui leur manque » ait de quoi énumérer ;
  · une fiche CLOSE — la seule façon de vérifier qu'une fiche close ne reçoit
    plus ni photo ni commentaire.

  LES IMAGES SONT SYNTHÉTIQUES, et il faut le dire. Ce sont des SVG en `data:`
  — des aplats, pas des photographies. Elles occupent l'emplacement 4/3 pour
  qu'on juge la mise en page avec quelque chose dedans ; elles ne prétendent
  pas montrer un chantier. Le produit, lui, stocke exactement de cette façon :
  une image en `data:` posée sur l'enregistrement, comme les pièces jointes
  des messages.
*/
const imageDEssai = (fond, trait, forme) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">` +
      `<rect width="400" height="300" fill="${fond}"/>` +
      `<rect x="0" y="212" width="400" height="88" fill="${trait}" opacity="0.5"/>` +
      forme +
      `</svg>`,
  );
const PHOTO_AVANT = imageDEssai(
  '#1b1d19',
  '#2a2d27',
  '<circle cx="150" cy="150" r="58" fill="#3a3f36"/><rect x="236" y="96" width="92" height="116" fill="#33372f"/>',
);
const PHOTO_PENDANT = imageDEssai(
  '#1f201b',
  '#2f322a',
  '<circle cx="196" cy="128" r="44" fill="#4a5142"/><rect x="88" y="150" width="224" height="20" fill="#3c4136"/>',
);
const PHOTO_APRES = imageDEssai(
  '#232419',
  '#35382c',
  '<circle cx="128" cy="126" r="48" fill="#5a6349"/><circle cx="236" cy="150" r="36" fill="#4d5540"/><rect x="60" y="196" width="280" height="14" fill="#41463a"/>',
);

const volet = (photo, note) => ({ photo, note });
const conso = (label, quantity, unit, euros) => ({
  id: `csm-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`,
  label,
  quantity,
  unit,
  unitCostCents: Math.round(euros * 100),
});

const INTERVENTIONS = [
  {
    cle: 'essai-itv-1',
    title: 'Habillage de vitrine — Brasserie du Port',
    clientName: 'Hugo Marchand',
    address: '8 quai Neuf, Sète',
    at: aujourdHui(9, 15, 0),
    /* LE VOLET « APRÈS » MANQUE : c'est cette fiche qui porte l'ambre. */
    volets: {
      avant: volet(PHOTO_AVANT, 'Vitrine vide, ancienne composition retirée la veille.'),
      pendant: volet(PHOTO_PENDANT, 'Pose du socle et des trois jardinières, câblage de la guirlande.'),
      apres: volet('', ''),
    },
    consommations: [
      conso('Jardinière garnie', 3, 'pièce', 42),
      conso('Mousse florale', 4, 'pièce', 3.2),
      conso('Ruban de satin', 2, 'rouleau', 6.5),
    ],
    closedAt: '',
    reportedAt: '',
  },
  {
    cle: 'essai-itv-2',
    title: 'Entretien plantes de bureau — Cabinet Vallon',
    clientName: 'Salomé Vallon',
    address: 'Cabinet Vallon, rue Foch',
    at: aujourdHui(14, 30, -1),
    /* COMPLÈTE MAIS OUVERTE : l'ambre doit avoir disparu sans clôture. */
    volets: {
      avant: volet(PHOTO_AVANT, 'Deux sujets jaunis côté fenêtre, substrat tassé.'),
      pendant: volet(PHOTO_PENDANT, 'Rempotage des deux sujets, taille des feuilles sèches.'),
      apres: volet(PHOTO_APRES, 'Les six bacs repris, arrosage réglé sur le lundi.'),
    },
    consommations: [conso('Composition de table', 2, 'pièce', 28)],
    closedAt: '',
    reportedAt: '',
  },
  {
    cle: 'essai-itv-3',
    title: 'Repérage terrasse — Maison Bertaux',
    clientName: 'Maison Bertaux',
    address: '18 rue Jean Jaurès, Nantes',
    at: aujourdHui(11, 0, -2),
    /* À PEINE COMMENCÉE : la colonne de droite doit savoir énumérer. */
    volets: {
      avant: volet(PHOTO_AVANT, ''),
      pendant: volet('', ''),
      apres: volet('', ''),
    },
    consommations: [],
    closedAt: '',
    reportedAt: '',
  },
  {
    cle: 'essai-itv-4',
    title: 'Composition de deuil — livraison sur place',
    clientName: 'Marc Delaunay',
    address: 'Chapelle Saint-Clair',
    at: aujourdHui(8, 30, -6),
    volets: {
      avant: volet(PHOTO_AVANT, 'Emplacement nu, deux supports fournis par la famille.'),
      pendant: volet(PHOTO_PENDANT, 'Montage de la couronne sur place, ajustement au support.'),
      apres: volet(PHOTO_APRES, 'Couronne posée, photo remise à la famille.'),
    },
    consommations: [conso('Couronne de porte', 1, 'pièce', 95), conso('Mousse florale', 2, 'pièce', 3.2)],
    /* LA SEULE FICHE CLOSE — et donc la seule où les volets sont verrouillés. */
    closedAt: aujourdHui(12, 10, -6),
    /* Déjà reportée : le bouton doit avoir cédé la place à la trace du report. */
    reportedAt: aujourdHui(12, 15, -6),
  },
];
for (const f of INTERVENTIONS) {
  await poser('interventions', f.cle, {
    title: f.title,
    clientName: f.clientName,
    address: f.address,
    at: f.at,
    volets: f.volets,
    consommations: f.consommations,
    closedAt: f.closedAt,
    reportedAt: f.reportedAt,
    createdAt: f.at,
  });
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
  /*
    UN CHEVAUCHEMENT VOLONTAIRE, ET IL EST RARE POUR DE BONNES RAISONS.

    L'écran REFUSE un chevauchement à la création : il ne peut donc en exister
    que par deux écritures hors ligne concurrentes, exactement comme les
    numéros de facture en double que le bac à sable porte déjà. C'est le cas
    que la carte de conflit (`15c`) sert à montrer — deux rangées qui ne
    fusionnent pas — et sans lui, la règle « les rangées ne se fusionnent
    jamais » ne se vérifie sur rien.
  */
  ['essai-rsv-5', 'essai-res-1', ...creneau(10, 30, 12, 0), 'Dépannage urgent — écrit hors ligne', 'clara@exemple.test'],
];
/*
  ON BALAIE LES RÉSERVATIONS PARASITES AVANT DE POSER LES NÔTRES.

  `check-contraste.mjs` parcourt les écrans en CLIQUANT ce qu'il trouve, y
  compris le bouton « Réserver » du formulaire de Matériel. Chaque passage du
  garde laisse donc une réservation de plus dans le bac à sable, avec une clé
  `rsv-…` que ce script ne connaît pas et n'écrase jamais. Après quelques
  passages, la grille d'occupation porte des créneaux que personne n'a voulus,
  et une capture d'écran prise ensuite montre un module qu'on n'a pas composé.

  Tout ce qui ne porte pas le préfixe `essai-` part. C'est sans risque : ce
  script n'est fait que pour un bac à sable, et il le dit en tête.
*/
const reponseRsv = await fetch(`${API}/v1/collections/resourceBookings`, {
  headers: { Authorization: `Bearer ${login.token}` },
}).catch(() => null);
if (reponseRsv?.ok) {
  const brut = await reponseRsv.json();
  const liste = Array.isArray(brut) ? brut : (brut.items ?? brut.records ?? []);
  for (const item of liste) {
    if (typeof item?.id !== 'string' || item.id.startsWith('essai-')) continue;
    await fetch(`${API}/v1/collections/resourceBookings/${encodeURIComponent(item.id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${login.token}` },
    }).catch(() => undefined);
  }
}

for (const [cle, resourceId, startAt, endAt, purpose, byEmail] of RESERVATIONS) {
  await poser('resourceBookings', cle, { resourceId, startAt, endAt, purpose, byEmail, createdAt: instant(-48) });
}

/* ─── Tournées ─────────────────────────────────────────────────────────────── */

/*
  Deux arrêts livrés, quatre restants : c'est ce qui fait exister « l'arrêt en
  cours », l'unique ambre de l'écran Tournées. Une tournée entièrement livrée
  n'en a pas — elle est là aussi, pour que les deux cas se voient.
*/
/*
  LES KILOMÈTRES FONT L'OBJET.

  Le fil de `15a` espace ses nœuds à la proportion du trajet : « les longs
  trajets se voient comme de longs vides ». Sans kilomètres, le fil retombe sur
  un pas régulier — il le dit, mais il ne prouve rien. La tournée du matin en
  porte donc, et ils sont CONTRASTÉS À DESSEIN : 0,4 km entre deux arrêts du
  centre, 9,2 km pour aller à la zone artisanale. Un jeu d'essai où tous les
  trajets feraient trois kilomètres donnerait un fil régulier, c'est-à-dire
  une liste, c'est-à-dire rien.
*/
const arret = (id, label, address, doneAt = null, km = undefined, dureeMin = undefined) =>
  ({ id, label, address, doneAt, km, dureeMin });
await poser('deliveryRounds', 'essai-trn-1', {
  title: 'Tournée du matin',
  day: jour(0),
  departAt: '08:00',
  stops: [
    arret('stp-1', 'Boulangerie Martin', '12 rue des Lilas, Nantes', aujourdHui(8, 24), 3.1, 12),
    arret('stp-2', 'Café des Halles', '3 place du Bouffay, Nantes', aujourdHui(8, 51), 0.4, 9),
    arret('stp-3', 'Fleuriste Camélia', '48 boulevard Gabriel Lauriol, Nantes', null, 2.6, 15),
    arret('stp-4', 'Épicerie du Marché', '7 rue de Bel Air, Nantes', null, 0.8, 8),
    arret('stp-5', 'Restaurant Le Cèdre', '21 rue Paul Bellamy, Nantes', null, 9.2, 20),
    arret('stp-6', 'Atelier Vermeil', '12 rue Béranger, Nantes', null, 1.5, 10),
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

/*
  LA JOURNÉE DE LA BANDE (`24a`), posée en FRACTIONS DU JOUR ÉCOULÉ.

  La bande va du premier pointage de la journée jusqu'à maintenant. Poser les
  périodes à des heures fixes — « 08 h 30 → 10 h 15 » — donnerait donc un jeu
  d'essai juste à 18 h et absurde à 9 h, où la moitié de la journée serait
  dans le futur. Les bornes sont donc des fractions de ce qui s'est déjà
  écoulé depuis minuit : la FORME de la journée est la même à toute heure,
  seules les durées changent.

  La forme est choisie pour que la bande montre tout ce qu'elle doit savoir
  montrer : deux trous (du temps NON POINTÉ, qui devient un segment hachuré et
  non un vide), un trajet et un déjeuner sans projet (jamais facturables), du
  temps rattaché à trois projets, et la période en cours au bout, qui porte
  l'ambre et le bord vif.
*/
const minuitLocal = new Date();
minuitLocal.setHours(0, 0, 0, 0);
/*
  PAS DE PLANCHER SUR L'ÉCOULÉ. Une première version bornait cette durée à une
  heure pour « avoir une journée présentable » quand le script tourne juste
  après minuit. Effet réel : à 00 h 39, la journée était projetée jusqu'à
  01 h 00, et la période en cours démarrait donc à 00 h 51 — DANS LE FUTUR.
  Le compteur affichait `00:00:00` et le segment vivant n'avait aucune
  largeur. Un jeu d'essai qui fabrique du futur ne prouve rien : la journée
  est courte quand elle est courte, et la bande le montre honnêtement.
*/
const ecouleDepuisMinuit = Math.max(1, Date.now() - minuitLocal.getTime());
const fractionDuJour = (f) =>
  new Date(minuitLocal.getTime() + Math.round(f * ecouleDepuisMinuit)).toISOString();

const TEMPS = [
  /* clé, intitulé, projet, début, fin, facturé le */
  ['essai-tps-1', 'Cadrage Brasserie du Port', 'essai-prj-1', fractionDuJour(0), fractionDuJour(0.2), ''],
  /* 0,20 → 0,26 : un trou. Rien à écrire — c'est l'écran qui le nomme. */
  ['essai-tps-2', 'Retouches vitrine', 'essai-prj-3', fractionDuJour(0.26), fractionDuJour(0.44), ''],
  ['essai-tps-3', 'Trajet atelier', '', fractionDuJour(0.44), fractionDuJour(0.5), ''],
  ['essai-tps-4', 'Déjeuner', '', fractionDuJour(0.5), fractionDuJour(0.58), ''],
  /* 0,58 → 0,62 : le second trou. */
  ['essai-tps-5', 'Intégration des gabarits', 'essai-prj-1', fractionDuJour(0.62), fractionDuJour(0.85), ''],
  /* LA PÉRIODE EN COURS — fin vide, et c'est elle qui porte l'ambre. */
  ['essai-tps-6', 'Maquettes des gabarits', 'essai-prj-1', fractionDuJour(0.85), '', ''],
  /* Les jours précédents, dont un déjà facturé : « dont N déjà facturées »
     et « à facturer » doivent chacun dire quelque chose. */
  ['essai-tps-7', 'Sélection des visuels', 'essai-prj-2', minutesAvant(3100), minutesAvant(2950), instant(-20)],
  ['essai-tps-8', 'Appel client', 'essai-prj-3', minutesAvant(4400), minutesAvant(4340), ''],
  ['essai-tps-9', 'Trajet livraison', '', minutesAvant(4320), minutesAvant(4275), ''],
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

/*
  LE TEMPS DU CHANTIER ESTIMÉ — ce qui fait descendre la courbe de brûlage.

  Une poignée de saisies ne suffit pas : la courbe se lit sur toute la vie du
  projet, et six points sur les trois derniers jours donneraient une ligne
  plate suivie d'une falaise. On sème donc une vingtaine de demi-journées et
  de journées réparties sur les trente jours du projet, avec des trous — un
  jour sans saisie EST une information, c'est un palier horizontal, et une
  répartition régulière serait un mensonge par lissage.

  Les durées sont en heures et se convertissent en journées à sept heures,
  comme l'instrument (`HEURES_PAR_JOURNEE`).
*/
const JOURNEES_CHANTIER = [
  [29, 6], [28, 7], [26, 3.5], [25, 7], [24, 7],
  [22, 5], [21, 7], [20, 4], [18, 7], [17, 6.5],
  [15, 7], [14, 3], [13, 7], [11, 7], [10, 5.5],
  [8, 7], [7, 4], [5, 7], [4, 6], [2, 3.5],
];
let nTemps = 0;
for (const [ilYaJours, heures] of JOURNEES_CHANTIER) {
  nTemps += 1;
  const debut = new Date(Date.now() - ilYaJours * 86_400_000);
  debut.setHours(9, 0, 0, 0);
  const fin = new Date(debut.getTime() + heures * 3_600_000);
  await poser('timeEntries', `essai-tps-chantier-${nTemps}`, {
    label: 'Identité Studio Nord',
    projectId: 'essai-prj-2',
    startedAt: debut.toISOString(),
    endedAt: fin.toISOString(),
    invoicedAt: '',
    createdAt: debut.toISOString(),
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
const tous28 = Array.from({ length: 28 }, (_, i) => i);

/*
  DEUX FORMES QUE L'INSTRUMENT DOIT POUVOIR RENDRE, et qu'un semis au hasard
  ne produirait jamais :

    · une série JAMAIS ROMPUE sur les vingt-huit jours — c'est elle qui porte
      l'ambre, et l'ambre récompense la continuité, pas la performance ;
    · une routine qui manque TOUJOURS LE MÊME JOUR DE SEMAINE. Le diagnostic
      de gauche existe pour ça : sept barres, une pointe le jeudi, et la
      conclusion « elle est mal posée » au lieu de « il faut se forcer ».

  Le jeudi se calcule depuis aujourd'hui plutôt que d'être écrit en dur : le
  semis tourne n'importe quel jour, et une liste figée ferait tomber la pointe
  sur un autre jour de semaine à chaque exécution.
*/
const reculsDuJeudi = tous28.filter((k) => new Date(Date.now() - k * 86_400_000).getDay() === 4);
const ROUTINES = [
  ['essai-rtn-1', 'Relever la caisse', joursCoches(tous28)],
  ['essai-rtn-2', 'Point stock', joursCoches(tous28.filter((k) => !reculsDuJeudi.includes(k)))],
  ['essai-rtn-3', 'Sauvegarder les fichiers du jour', joursCoches([0, 1, 4, 6, 8, 9, 12, 15, 16, 20, 22, 25])],
  ['essai-rtn-4', 'Relire la boîte de réception', joursCoches([0, 1, 2, 3, 5, 6, 7, 10, 13, 14, 17, 19, 21, 24, 26])],
  ['essai-rtn-5', 'Arroser l’atelier', joursCoches([5, 6, 11, 13, 18, 23, 27])],
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
    durationMin: r.durationMin ?? 60,
    decisions: r.decisions,
    actions: r.actions,
    byEmail: EMAIL,
    createdAt: r.at,
  });

/*
  UNE SEMAINE DE RÉUNIONS POUR LE PEIGNE, et elle doit contenir deux journées
  qui se ressemblent en TOTAL mais pas en FORME — c'est toute la démonstration
  de l'instrument.

    · mardi : trois heures d'affilée le matin. Il reste un après-midi entier ;
    · jeudi : trois heures aussi, mais en trois morceaux espacés. Il ne reste
      que des bouts.

  Un total de temps ne distingue pas les deux. Le peigne, si — et c'est le
  jeudi qui doit porter l'ambre, pas la journée la plus chargée.

  Les jours sont posés relativement au LUNDI DE LA SEMAINE EN COURS : semé un
  samedi, un décalage en jours ferait tomber les réunions sur la semaine
  suivante, et la bande serait vide.
*/
const lundiSemaine = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
})();
const creneau = (jourIndex, heure, minute) => {
  const d = new Date(lundiSemaine);
  d.setDate(d.getDate() + jourIndex);
  d.setHours(heure, minute, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(heure).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};
const SEMAINE_REUNIONS = [
  ['essai-reu-s1', 'Lancement de semaine', 0, 9, 0, 45, 'Léa, Clara'],
  ['essai-reu-s2', 'Atelier refonte boutique', 1, 9, 30, 180, 'Léa, Samir, Clara'],
  ['essai-reu-s3', 'Appel fournisseur', 2, 14, 0, 30, 'Léa'],
  ['essai-reu-s4', 'Revue des devis', 3, 9, 0, 60, 'Léa, Clara'],
  ['essai-reu-s5', 'Point client Fontaine', 3, 11, 30, 60, 'Léa, Samir, Clara, Nadia'],
  ['essai-reu-s6', 'Préparation de la vitrine', 3, 15, 0, 60, 'Léa, Clara'],
  ['essai-reu-s7', 'Clôture de semaine', 4, 17, 0, 45, 'Léa, Clara, Samir'],
];
for (const [cle, title, jourIndex, heure, minute, durationMin, attendees] of SEMAINE_REUNIONS) {
  const at = creneau(jourIndex, heure, minute);
  await poser('meetings', cle, {
    title,
    at,
    attendees,
    agenda: '',
    durationMin,
    decisions: [],
    actions: [],
    byEmail: EMAIL,
    createdAt: `${at}:00.000Z`,
  });
}
}

/* ─── Tâches ───────────────────────────────────────────────────────────────── */

/*
  LES TÂCHES, ET CE QU'ELLES S'ATTENDENT LES UNES AUX AUTRES.

  La cinquième colonne est `blockedBy` : la clé de la tâche qu'il faut avoir
  finie d'abord. Sans elle, l'arbre des blocages de l'écran Tâches n'a rien à
  dessiner — et un instrument qu'on ne peut pas voir tourner sur de vraies
  données n'est pas vérifiable.

  La forme semée est celle qui rend l'instrument lisible : UNE racine qui
  bloque trois choses, et deux de plus derrière l'une d'elles. C'est la thèse
  du module — une seule réponse en libère quatre.
*/
const TACHES = [
  ['essai-tac-0', 'Réponse de l’Atelier Fontaine sur le devis', 'doing', 'high', null, -24 * 12],
  ['essai-tac-1', 'Commander les pivoines pour septembre', 'todo', 'high', 'essai-tac-0', -24 * 9],
  ['essai-tac-2', 'Relancer la Brasserie du Port', 'doing', 'normal', null, -24 * 6],
  ['essai-tac-3', 'Remettre à jour la vitrine', 'todo', 'low', 'essai-tac-0', -24 * 8],
  ['essai-tac-4', 'Facture 2026-0035 — deuxième relance', 'doing', 'high', 'essai-tac-0', -24 * 7],
  ['essai-tac-5', 'Inventaire des vases', 'done', 'low', null, -24 * 6],
  ['essai-tac-6', 'Bloquer le créneau de livraison du 24', 'todo', 'normal', 'essai-tac-1', -24 * 5],
  ['essai-tac-7', 'Passer l’écriture comptable', 'todo', 'low', 'essai-tac-4', -24 * 4],
  ['essai-tac-8', 'Choisir les papiers d’emballage', 'todo', 'normal', null, -24 * 3],
  ['essai-tac-9', 'Rappeler le fleuriste de Vitry', 'todo', 'low', null, -24 * 2],
];
for (const [cle, title, status, priority, bloquePar, age] of TACHES) {
  await poser('tasks', cle, {
    title,
    detail: '',
    status,
    priority,
    assigneeEmail: EMAIL,
    ...(bloquePar ? { blockedBy: bloquePar } : {}),
    createdAt: instant(age),
  });
}

/* ─── Fidélité, avis, parrainage ───────────────────────────────────────────── */

/*
  SIX CARTES DE FIDÉLITÉ, dont UNE À NEUF TAMPONS.

  Le sujet du module est la case vide : la carte montrée en grand est celle qui
  en a le moins, et c'est son dixième emplacement qui porte l'ambre. Un semis
  où aucune carte n'atteindrait neuf ne montrerait jamais le tampon en attente
  — l'instrument s'afficherait sans rien dire.

  Les autres cartes sont réparties pour que la rangée de dix pastilles du bas
  ait quelque chose à comparer : une pleine, une à mi-parcours, deux qui
  démarrent.
*/
const CARTES_FIDELITE = [
  ['essai-fid-1', 'Camille Renaud', 9, 1, 3],
  ['essai-fid-2', 'Hugo Marchand', 10, 0, 1],
  ['essai-fid-3', 'Nadia Bouvier', 5, 2, 12],
  ['essai-fid-4', 'Théo Lambert', 3, 0, 20],
  ['essai-fid-5', 'Inès Fabre', 1, 0, 34],
  ['essai-fid-6', 'Marc Delaunay', 7, 1, 8],
];
for (const [cle, customerName, stamps, rewards, ilYaJours] of CARTES_FIDELITE) {
  await poser('loyaltyCards', cle, {
    customerName,
    stamps,
    rewards,
    lastStampAt: instant(-24 * ilYaJours),
    createdAt: instant(-24 * (ilYaJours + 90)),
  });
}

/*
  HUIT AVIS, DONT UN SEUL À UNE ÉTOILE.

  C'est la forme exacte que le peson doit démontrer : une moyenne haute tirée
  vers le bas par un seul avis sévère, et l'écran qui chiffre combien
  d'excellents il faudrait pour compenser. Un semis tout à cinq étoiles
  donnerait un ressort court et une carte qui ne dit rien.

  Les textes sont réels au sens du module : de vraies phrases qu'on écrit, pas
  des « Lorem ». Le paquet demande que les avis cités soient du texte entier,
  jamais résumé — ils le sont.
*/
const AVIS = [
  ['essai-avis-1', 'Camille R.', 5, 'Le bouquet était exactement ce que j’avais décrit au téléphone. Livré à l’heure, et la personne a pris le temps de m’expliquer comment le garder.', 'Google', true, 4],
  ['essai-avis-2', 'Hugo M.', 5, 'Trois ans qu’on prend les compositions ici pour la brasserie. Jamais un retard, jamais une fleur fanée.', 'Sur place', true, 11],
  ['essai-avis-3', 'Nadia B.', 4, 'Très joli travail pour le mariage. Un petit bémol sur le délai de réponse au premier message, mais tout le reste était parfait.', 'Instagram', true, 19],
  ['essai-avis-4', 'Théo L.', 5, 'Arrivé la veille pour une commande de dernière minute, et ils ont fait quelque chose de superbe.', 'Google', true, 26],
  ['essai-avis-5', 'Inès F.', 1, 'Commande passée pour un enterrement, arrivée avec deux heures de retard et sans le ruban demandé. Personne n’a rappelé. Pour ce jour-là, c’était vraiment le mauvais moment.', 'Google', false, 33],
  ['essai-avis-6', 'Marc D.', 5, 'Conseil de saison toujours juste. On repart avec autre chose que ce qu’on avait en tête, et c’est mieux.', 'Sur place', true, 41],
  ['essai-avis-7', 'Sophie A.', 4, 'Bon rapport qualité-prix pour l’abonnement bureau. Le mardi matin, c’est parfait.', 'Courriel', false, 52],
  ['essai-avis-8', 'Yanis K.', 5, 'Arche de mariage magnifique. Les photos ne rendent pas justice.', 'Instagram', true, 68],
];
for (const [cle, author, rating, text, source, publishable, ilYaJours] of AVIS) {
  await poser('reviews', cle, {
    author,
    text,
    rating,
    source,
    publishable,
    receivedAt: instant(-24 * ilYaJours),
  });
}

/*
  UNE LIGNÉE SUR DEUX GÉNÉRATIONS, et c'est toute la démonstration.

  Camille Renaud achète peu pour elle-même, mais sa descendance porte le plus
  gros chiffre d'affaires de l'arbre : c'est précisément ce qu'une liste de
  codes de parrainage ne dit pas. Les noms des filleuls correspondent à des
  noms de facture, sans quoi le CA de branche resterait à zéro — voir
  l'arbitrage sur le rapprochement par nom dans `ReferralsScreen.tsx`.
*/
const PARRAINAGES = [
  ['essai-par-1', 'Camille Renaud', 'Théo Lambert', 'recompense', 'Bouquet offert', 120],
  ['essai-par-2', 'Camille Renaud', 'Inès Fabre', 'recompense', 'Bouquet offert', 95],
  ['essai-par-3', 'Camille Renaud', 'Marc Delaunay', 'venu', '−10 % sur la commande', 40],
  ['essai-par-4', 'Théo Lambert', 'Sophie Aubry', 'venu', 'Bouquet offert', 30],
  ['essai-par-5', 'Théo Lambert', 'Yanis Kaddour', 'invite', 'Bouquet offert', 12],
  ['essai-par-6', 'Inès Fabre', 'Lucie Perrin', 'venu', 'Bouquet offert', 21],
  ['essai-par-7', 'Hugo Marchand', 'Paul Vasseur', 'invite', '−10 % sur la commande', 6],
];
for (const [cle, referrer, referred, status, reward, ilYaJours] of PARRAINAGES) {
  await poser('referrals', cle, {
    referrer,
    referred,
    status,
    reward,
    createdAt: instant(-24 * ilYaJours),
    updatedAt: instant(-24 * Math.max(1, ilYaJours - 5)),
  });
}

/*
  DES FACTURES AU NOM DES FILLEULS, sans quoi l'arbre de parrainage compte des
  branches à zéro. Elles sont émises et payées : ce sont de vraies
  contributions, pas des promesses.
*/
const FACTURES_FILLEULS = [
  ['essai-fac-fil-1', '2026-0051', 'Théo Lambert', 3, 420, 60],
  ['essai-fac-fil-2', '2026-0052', 'Inès Fabre', 2, 380, 48],
  ['essai-fac-fil-3', '2026-0053', 'Sophie Aubry', 6, 145, 30],
  ['essai-fac-fil-4', '2026-0054', 'Yanis Kaddour', 1, 1_240, 22],
  ['essai-fac-fil-5', '2026-0055', 'Lucie Perrin', 4, 190, 15],
  ['essai-fac-fil-6', '2026-0056', 'Marc Delaunay', 2, 260, 9],
];
for (const [cle, number, nom, quantite, prix, ilYaJours] of FACTURES_FILLEULS) {
  await poser('invoices', cle, {
    number,
    clientId: 0,
    billTo: { name: nom, company: '', email: '', address: '', vatNumber: '' },
    issuedAt: jour(-ilYaJours),
    dueAt: jour(30 - ilYaJours),
    lines: [ligne('l1', 'Compositions', quantite, prix)],
    status: 'paid',
    paidAt: jour(-Math.max(0, ilYaJours - 12)),
    paymentMethod: 'Virement',
    cancelReason: '',
    notes: '',
    quoteId: null,
  });
}

/* ─── Mini-page, portfolio, signatures, lettres ────────────────────────────── */

await poser('minisite', 'config', {
  enabled: true,
  title: 'Les Fleurs d’Élise',
  intro:
    'Bouquets de saison, compositions pour mariages et événements, abonnements pour entreprises. ' +
    'Atelier ouvert du mardi au samedi, commandes la veille pour une livraison le matin.',
  hours: 'Mardi–samedi 9 h – 19 h\nDimanche 9 h – 13 h',
  address: '18 rue des Lilas, 34000 Montpellier',
  phone: '04 67 00 00 00',
  email: 'bonjour@fleurs-elise.exemple.test',
  /* Les avis restent ÉTEINTS : il n'y a aucun avis publiable dans ce bac à
     sable, et montrer un bloc « 0 avis » sur une page publique serait pire
     que de ne pas le montrer. C'est aussi ce qui fait qu'au moins un bloc se
     dessine en filet pointillé dans la liste — la règle du paquet ne se
     vérifie pas sur une liste où tout est allumé. */
  showReviews: false,
  showPortfolio: true,
});

/*
  DIX-HUIT VUES SUR LA PLANCHE, DANS LES TROIS ÉTATS.

  La planche contact garde retenues, écartées et indécises visibles en même
  temps — c'est sa thèse. Un semis où tout serait retenu ne montrerait ni la
  croix ni l'indécision, donc ne prouverait rien.
*/
const VUES = [
  ['Mariage Loiseau — arche', 'Mariage', 'retenue'],
  ['Mariage Loiseau — table', 'Mariage', 'retenue'],
  ['Bouquet de mariée blanc', 'Mariage', 'ecartee'],
  ['Vitrine automne', 'Vitrine', 'retenue'],
  ['Vitrine printemps', 'Vitrine', null],
  ['Vitrine Noël', 'Vitrine', 'ecartee'],
  ['Composition entreprise', 'Entreprise', 'retenue'],
  ['Accueil hôtel', 'Entreprise', null],
  ['Bar à fleurs', 'Événement', 'retenue'],
  ['Couronne de l’Avent', 'Atelier', null],
  ['Atelier enfants', 'Atelier', 'ecartee'],
  ['Pivoines de juin', 'Saison', null],
  ['Dahlias d’octobre', 'Saison', null],
  ['Renoncules de février', 'Saison', 'ecartee'],
  ['Deuil — gerbe blanche', 'Deuil', null],
  ['Deuil — coussin', 'Deuil', 'ecartee'],
  ['Baptême — arche basse', 'Événement', null],
  ['Anniversaire — bouquet rond', 'Événement', null],
];
for (let i = 0; i < VUES.length; i += 1) {
  const [title, category, choix] = VUES[i];
  await poser('portfolioItems', `essai-pfl-${i + 1}`, {
    title,
    description: '',
    category,
    link: '',
    visible: choix === 'retenue',
    ...(choix ? { choix } : {}),
    createdAt: instant(-24 * (90 - i * 4)),
  });
}

/*
  DEUX BONS SIGNÉS, avec un TRACÉ.

  Le tracé stocké est normalement le PNG du canevas, écrit au moment de signer.
  Ici c'est un SVG posé en URL de données : un bac à sable ne peut pas signer au
  doigt, et un rectangle gris à la place du tracé ferait croire que l'écran ne
  sait pas l'afficher. L'empreinte, elle, est calculée par l'application sur ce
  qu'elle lit — un bon semé se vérifie donc comme un vrai, et la vérification
  dira « altéré » si quelqu'un touche au tracé.
*/
const traceSignature = (d) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 90"><path d="${d}" fill="none" stroke="#0a0a0a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  );
const BONS = [
  [
    'essai-sig-1',
    'Installation vitrine — Brasserie du Port',
    'Camille Renaud',
    -2,
    'M14 62 C30 22 40 20 46 44 C52 68 60 70 68 48 C74 30 82 30 86 52 C90 72 100 72 108 50 ' +
      'C116 28 128 26 134 46 C140 66 152 68 162 46 C172 24 186 30 190 54 C194 76 210 74 224 50 ' +
      'C236 30 250 36 262 58',
  ],
  [
    'essai-sig-2',
    'Reprise d’abonnement — Le Jardin d’Élise',
    'Hugo Marchand',
    -9,
    'M18 58 C28 30 38 28 44 50 C50 70 62 72 70 52 C78 32 92 34 98 56 C104 76 120 74 130 52 ' +
      'C140 30 156 34 164 56 C172 76 190 72 206 48 C218 30 236 38 248 60',
  ],
];
for (const [cle, title, signer, ilYaJours, d] of BONS) {
  /* `ilYaJours` est négatif comme partout ailleurs dans ce script (-2 = il y a
     deux jours), donc on ADDITIONNE : une double négation se relit mal. */
  const signedAt = new Date(Date.now() + ilYaJours * 86_400_000).toISOString();
  const imageDataUrl = traceSignature(d);
  // L'empreinte suit exactement la formule de l'écran : titre|signataire|heure|tracé.
  const { createHash } = await import('node:crypto');
  const hash = createHash('sha256').update(`${title}|${signer}|${signedAt}|${imageDataUrl}`).digest('hex');
  await poser('signatures', cle, { title, signer, signedAt, imageDataUrl, hash, byEmail: EMAIL });
}

/*
  TROIS LETTRES PARTIES, à des heures différentes et sur un carnet qui grandit.
  Les portées sont écrites telles qu'elles étaient AU MOMENT DE L'ENVOI : c'est
  ce que le module enregistre, et une portée recalculée aujourd'hui ferait
  croire que la première lettre touchait déjà tout le monde.
*/
const LETTRES = [
  ['essai-nws-1', 'Les pivoines sont là', 'Elles arrivent en bouton et s’ouvrent en trois jours.', 4, 7, 30, 41],
  ['essai-nws-2', 'Fermeture du lundi matin', 'À partir d’octobre, l’atelier ouvre le lundi à 14 h.', 18, 12, 0, 36],
  ['essai-nws-3', 'Atelier couronnes de l’Avent', 'Deux sessions de dix personnes en décembre.', 45, 18, 30, 29],
];
for (const [cle, subject, body, ilYaJours, heure, minute, recipients] of LETTRES) {
  const d = new Date(Date.now() - ilYaJours * 86_400_000);
  d.setHours(heure, minute, 0, 0);
  await poser('newsletters', cle, {
    subject,
    body,
    sentAt: d.toISOString(),
    recipients,
    byEmail: EMAIL,
    createdAt: new Date(d.getTime() - 3_600_000).toISOString(),
  });
}

/* ─── Formulaires ──────────────────────────────────────────────────────────── */

/*
  UN FORMULAIRE PUBLIÉ ET SES RÉPONSES, avec un champ que les gens SAUTENT.

  La feuille et ses marges (`17e`) montre, en face de chaque champ, combien de
  personnes l'ont rempli. Un semis où tous les champs sont remplis produirait
  sept barres pleines et aucune information — l'instrument existerait sans rien
  dire. Le champ « budget envisagé » est donc rempli par moins d'un tiers des
  gens : c'est celui qu'on hésite à écrire à un inconnu, et c'est lui qui doit
  porter l'ambre.

  Le dernier champ est volontairement BIEN rempli : le piège naturel de cet
  instrument est de désigner le dernier champ, qui est toujours le moins
  rempli. Ici il ne l'est pas, donc l'écran doit désigner le bon.
*/
const CHAMPS_DEMANDE = [
  ['f-nom', 'Votre nom', 'text', true],
  ['f-mail', 'Votre courriel', 'email', true],
  ['f-tel', 'Votre téléphone', 'phone', false],
  ['f-occasion', 'L’occasion', 'choice', true],
  ['f-date', 'La date envisagée', 'text', true],
  ['f-budget', 'Le budget envisagé', 'text', false],
  ['f-message', 'Ce que vous imaginez', 'long', false],
];
await poser('forms', 'essai-frm-1', {
  title: 'Demande de composition florale',
  intro: 'Dites-nous en quelques mots ce que vous cherchez — on revient vers vous sous 48 h.',
  thanks: 'Merci, votre demande est arrivée. On vous écrit très vite.',
  published: true,
  fields: CHAMPS_DEMANDE.map(([id, label, type, required]) => ({
    id,
    label,
    type,
    required,
    options: type === 'choice' ? ['Mariage', 'Anniversaire', 'Deuil', 'Entreprise', 'Autre'] : [],
  })),
  createdAt: instant(-24 * 60),
});
await poser('forms', 'essai-frm-2', {
  title: 'Inscription atelier couronnes',
  intro: 'Deux sessions de dix personnes en décembre.',
  thanks: 'Inscription reçue.',
  published: true,
  fields: [
    { id: 'a-nom', label: 'Votre nom', type: 'text', required: true, options: [] },
    { id: 'a-mail', label: 'Votre courriel', type: 'email', required: true, options: [] },
    { id: 'a-session', label: 'La session', type: 'choice', required: true, options: ['6 décembre', '13 décembre'] },
  ],
  createdAt: instant(-24 * 20),
});

const OCCASIONS = ['Mariage', 'Anniversaire', 'Deuil', 'Entreprise', 'Autre'];
const PRENOMS = ['Camille', 'Hugo', 'Nadia', 'Théo', 'Inès', 'Marc', 'Sophie', 'Yanis', 'Lucie', 'Pierre',
                 'Amal', 'Jules', 'Clara', 'Malik', 'Éva', 'Antoine', 'Sarah', 'Léo', 'Rim', 'Paul',
                 'Manon', 'Karim', 'Zoé', 'Bastien'];
for (let k = 0; k < PRENOMS.length; k += 1) {
  const reponses = {
    'f-nom': PRENOMS[k],
    'f-mail': `${PRENOMS[k].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}@exemple.test`,
    'f-occasion': OCCASIONS[k % OCCASIONS.length],
    'f-date': jour(10 + k * 3),
  };
  // Le téléphone : deux personnes sur trois le donnent.
  if (k % 3 !== 2) reponses['f-tel'] = `06 ${10 + k} ${20 + k} ${30 + k} ${40 + k}`;
  // Le budget : moins d'un tiers. C'est le champ que l'écran doit désigner.
  if (k % 4 === 0) reponses['f-budget'] = `${200 + k * 25} €`;
  // Le message, dernier champ, reste bien rempli : le piège est évité.
  if (k % 8 !== 7) reponses['f-message'] = 'Quelque chose de simple, dans les tons blancs et verts.';
  await poser('formAnswers', `essai-rep-${k + 1}`, {
    formId: 'essai-frm-1',
    answers: reponses,
    receivedAt: instant(-24 * (2 + k * 2)),
    source: 'page publique',
  });
}

/* ─── Journal de bord ──────────────────────────────────────────────────────── */

/*
  DES ENTRÉES DE LONGUEURS FRANCHEMENT DIFFÉRENTES, et c'est la seule chose qui
  compte pour cet instrument.

  La coupe géologique donne à chaque entrée une épaisseur PROPORTIONNELLE au
  nombre de mots. Un semis où toutes les entrées font trois lignes produirait
  une pile de strates identiques — c'est-à-dire une liste, exactement ce que
  l'instrument remplace. On sème donc de « Rien de notable. » (trois mots) à
  une mise au point de plus de cent mots.

  Les douze mois de la carte de gauche demandent aussi des entrées ANCIENNES :
  sans elles, onze barres à zéro et une seule qui dépasse.
*/
const JOURNAL = [
  [0, 'note', 'Rien de notable.'],
  [1, 'visite',
    'Passage du contrôleur sanitaire. Tout est conforme, il a relevé la température du frigo à 3 °C et vérifié les fiches de traçabilité. Prochain passage annoncé au printemps.'],
  [2, 'note', 'Livraison Pays-Bas arrivée avec deux heures de retard, rien de cassé.'],
  [4, 'panne',
    'Le frigo de réserve s’est arrêté pendant la nuit. Découvert à l’ouverture, tout le contenu était encore froid. Redémarré après avoir dégivré le condenseur — il était pris en glace. À surveiller : si ça recommence, c’est la sonde.'],
  [5, 'note', 'Nouveau fournisseur de rubans testé sur la commande Fontaine. Qualité correcte.'],
  [7, 'decision',
    'Décision prise de fermer le lundi matin à partir d’octobre. Le chiffre du lundi matin ne couvre pas la présence, et c’est le créneau où l’on prépare le mieux les commandes de la semaine. Essai sur trois mois, à revoir en janvier.'],
  [9, 'note', 'Rupture de ruban de reliure signalée.'],
  [11, 'incident',
    'Erreur de livraison sur la commande Brasserie du Port : les compositions sont parties à la mauvaise adresse. Récupérées et relivrées dans la journée, la cliente a été prévenue avant de s’en apercevoir. Cause : deux adresses homonymes dans les fiches, fusionnées depuis.'],
  [14, 'note', 'Vitrine refaite pour la rentrée.'],
  [17, 'visite', 'Rendez-vous avec le comptable. Rien à signaler sur le trimestre.'],
  [21, 'decision',
    'Mise au point du trimestre. Trois choses en sortent. D’abord, les marges sur les compositions événementielles sont en dessous de ce qu’on croyait une fois le temps de préparation compté — il faut soit remonter les prix, soit réduire la variété proposée. Ensuite, les commandes en ligne ont dépassé les commandes au comptoir pour la première fois, ce qui change la façon dont il faut tenir le stock : moins de fleurs à l’unité, plus de compositions préparées. Enfin, la question de l’embauche se repose pour le printemps, mais pas avant d’avoir vu ce que donne la fermeture du lundi.'],
  [26, 'note', 'Inventaire des vases fait. Douze manquants depuis le dernier comptage.'],
  [34, 'panne', 'Rideau métallique bloqué à mi-hauteur. Débloqué à la main, graissé.'],
  [48, 'note', 'Première commande du site sans intervention. Ça marche.'],
  [65, 'decision', 'Passage aux emballages papier pour toutes les compositions.'],
  [92, 'visite', 'Visite du bailleur pour l’état des lieux intermédiaire.'],
  [120, 'note', 'Saison des pivoines terminée. Bonne année.'],
  [160, 'incident', 'Coupure d’électricité de quatre heures. Rien perdu.'],
  [210, 'note', 'Reprise après les congés.'],
  [260, 'decision', 'Ouverture du samedi après-midi décidée pour l’été.'],
  [310, 'note', 'Premier mois avec la nouvelle caisse.'],
];
for (const [ilYa, kind, texte] of JOURNAL) {
  const d = new Date(Date.now() - ilYa * 86_400_000);
  d.setHours(9 + (ilYa % 8), 20, 0, 0);
  await poser('logbook', `essai-log-${ilYa}`, {
    text: texte,
    kind,
    byEmail: EMAIL,
    at: d.toISOString(),
  });
}

/* ─── Priorités du jour ────────────────────────────────────────────────────── */

/*
  TRENTE JOURS DE FENTES, pour que la bande du bas prouve la règle.

  L'instrument montre trois cases par jour : ce qui se lit, c'est qu'il n'y a
  JAMAIS eu de quatrième priorité. Une bande semée avec une seule barre par
  jour ne dirait pas ça. On sème donc des journées à trois, à deux, à une et à
  zéro, avec des week-ends vides — parce qu'une moyenne calculée sur les jours
  ouvrés doit pouvoir se distinguer d'une moyenne calculée sur tout.

  Aujourd'hui garde une fente non cochée en première position : c'est elle qui
  porte l'ambre, et un écran semé « tout fait » ne le montrerait pas.
*/
const slugCourriel = (e) => e.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const FENTES = [
  'Rappeler l’Atelier Fontaine',
  'Finir la vitrine',
  'Commander les pivoines',
  'Passer l’écriture comptable',
  'Relire le devis Studio Nord',
  'Ranger la réserve',
];
for (let k = 0; k < 30; k += 1) {
  const d = new Date(Date.now() - k * 86_400_000);
  const jourSemaine = d.getDay();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  /* Week-end : aucune fente posée — c'est un fait, pas un trou de données.
     AUJOURD'HUI fait exception : c'est le sujet de l'écran, et un semis qui
     tombe un samedi laisserait les trois fentes vides, donc l'instrument sans
     rien à montrer et l'ambre sans porteur. */
  if (k > 0 && (jourSemaine === 0 || jourSemaine === 6)) continue;
  // Trois, deux ou une fente selon le jour — jamais quatre.
  const combien = [3, 3, 2, 3, 1, 2, 3][k % 7];
  const items = Array.from({ length: combien }, (_, i) => {
    const fait = k === 0 ? i > 0 : (k + i) % 5 !== 0;
    return {
      id: `prio-${k}-${i}`,
      label: FENTES[(k + i) % FENTES.length],
      doneAt: fait ? new Date(d.getTime() + (10 + i * 3) * 3_600_000).toISOString() : null,
    };
  });
  await poser('dailyPriorities', `prio-${slugCourriel(EMAIL)}-${iso}`, {
    email: EMAIL,
    day: iso,
    items,
    updatedAt: d.toISOString(),
  });
}

/* ─── Objectifs & résultats ────────────────────────────────────────────────── */

/*
  CINQ RÉSULTATS CLÉS DU TRIMESTRE EN COURS, et deux saisons derrière.

  Ce qu'il faut pour que l'instrument se prouve, et pas seulement s'affiche :

    · un résultat qui part de zéro et monte (le cas ordinaire) ;
    · un résultat qui DESCEND vers sa cible — « ramener le délai de 48 h à
      12 h » — parce que c'est là que `pct = (val − min) / (cible − min)` se
      distingue d'un simple `val / cible`, qui donnerait 400 % ;
    · un résultat nettement sous son allure, pour que l'ambre ait un porteur ;
    · un résultat déjà dépassé, pour que le curseur s'arrête au bout de la
      règle au lieu d'en sortir.

  Les objectifs des saisons passées sont datés dans les trimestres précédents :
  la colonne de cases à gauche les compte par trimestre civil.
*/
const trimestreIso = (reculTrimestres, jourDuTrimestre = 20) => {
  const d = new Date();
  const t = Math.floor(d.getMonth() / 3) - reculTrimestres;
  const annee = d.getFullYear() + Math.floor(t / 4);
  const mois = ((t % 4) + 4) % 4;
  return new Date(annee, mois * 3, jourDuTrimestre, 10, 0, 0).toISOString();
};

const OBJECTIFS = [
  {
    cle: 'essai-okr-1',
    objective: 'Tenir la boutique pleine en automne',
    recul: 0,
    resultats: [
      // monte de 0 vers 40 ; à 87 % du trimestre écoulé, 31/40 est presque pile.
      ['Bouquets vendus par semaine', 40, '', 0, 31],
      // DESCEND : départ 48 h, cible 12 h, on en est à 19 h.
      ['Délai de réponse', 12, 'h', 48, 19],
      // nettement sous son allure : c'est lui qui portera l'ambre.
      ['Nouveaux clients', 25, '', 0, 9],
    ],
  },
  {
    cle: 'essai-okr-2',
    objective: 'Arrêter de travailler à perte',
    recul: 0,
    resultats: [
      ['Marge moyenne', 38, '%', 22, 34],
      // déjà dépassé : le curseur doit s'arrêter au bout de la règle.
      ['Devis envoyés', 30, '', 0, 34],
    ],
  },
  {
    cle: 'essai-okr-3',
    objective: 'Remettre la vitrine à niveau',
    recul: 1,
    resultats: [
      ['Vitrines refaites', 3, '', 0, 3],
      ['Photos publiées', 24, '', 0, 24],
      ['Avis recueillis', 10, '', 0, 6],
    ],
  },
  {
    cle: 'essai-okr-4',
    objective: 'Passer le printemps sans rupture',
    recul: 2,
    resultats: [
      ['Ruptures de stock', 0, '', 7, 1],
      ['Fournisseurs de secours', 2, '', 0, 2],
    ],
  },
];
for (const o of OBJECTIFS) {
  await poser('okrs', o.cle, {
    objective: o.objective,
    season: '',
    keyResults: o.resultats.map(([label, target, unit, start, current], i) => ({
      id: `${o.cle}-kr-${i + 1}`,
      label,
      target,
      unit,
      start,
      current,
    })),
    createdAt: trimestreIso(o.recul),
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
  /*
    TROIS LIENS, TROIS ÉTATS DU FIL DE PROVENANCE (`18b`).

    · le client 102 porte encore le nom que le rapport a retenu → fil fin ;
    · la tâche `essai-tac-6` a été RENOMMÉE depuis (« du 17 » est devenu
      « du 24 ») → le rapport annonce une chose, la source en dit une autre.
      C'est ce fil-là qui est ambre et épais : le seul épais de l'écran ;
    · la tâche `essai-tac-2` porte encore son titre → fil fin lui aussi.

    L'écart n'est pas une erreur du rapport : c'est la source qui a bougé, et
    c'est exactement ce que la règle du module veut faire voir — un compte
    rendu ne se régénère pas tout seul.
  */
  links: [
    { kind: 'client', id: '102', label: 'Hugo Marchand' },
    { kind: 'task', id: 'essai-tac-6', label: 'Bloquer le créneau de livraison du 17' },
    { kind: 'task', id: 'essai-tac-2', label: 'Relancer la Brasserie du Port' },
  ],
  authorEmail: EMAIL,
  createdAt: instant(-24 * 2),
});
await poser('reports', 'essai-rap-3', {
  type: 'task',
  title: 'Installation Studio Nord',
  body: 'Pose faite en deux heures, sans reprise. Le local est accessible par l’arrière, ce qui change tout pour le déchargement — à noter pour les prochaines livraisons.',
  /* UNE SOURCE DISPARUE : la fiche citée n'existe plus. Le rapport, lui,
     l'annoncera toujours — le fil doit savoir dessiner ce cas aussi. */
  links: [
    { kind: 'task', id: 'essai-tac-4', label: 'Facture 2026-0035 — deuxième relance' },
    { kind: 'task', id: 'essai-tac-effacee', label: 'Commander le support alu' },
  ],
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
