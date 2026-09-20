/**
 * LES DONNÉES D'ESSAI DE LA FAMILLE « PERSONNEL ».
 *
 * Ces six écrans ne lisent aucune collection synchronisée : leurs données
 * vivent dans `localStorage`, par compte, sur le poste (`usePersonalStore`).
 * Le semoir du bac à sable, qui parle à l'API, ne peut donc rien y mettre —
 * et sans elles, toute garde qui ouvre ces écrans les mesure VIDES et conclut
 * à tort qu'ils sont en règle.
 *
 * Ce fichier est donc la source unique du jeu d'essai personnel : la garde
 * `check:signal` l'injecte avant de mesurer, et la campagne de captures s'en
 * sert pour rendre les mêmes écrans. Rien ici n'est écrit dans le produit.
 */
export function coffrePersonnel(maintenant = Date.now()) {
  const JOUR = 86_400_000;
  const jourDe = (d) => new Date(d).toISOString().slice(0, 10);
  const ilYA = (n) => new Date(maintenant - n * JOUR).toISOString();

  /* ── HABITUDES ───────────────────────────────────────────────────────────
     Cinq habitudes, trois tenues aujourd'hui : la balance penche du côté des
     tenues, d'un cran (3 − 2 = 1). La dernière cochée est fraîche : c'est
     l'unique ambre de l'écran. */
  const habitudes = [
    /* Marcher : tenue presque tous les jours depuis quatre mois. C'est elle
       que l'intention en cours compte — le cairn y lit ses pierres. */
    { id: 'hab-1', label: 'Marcher vingt minutes', createdAt: ilYA(150),
      ticks: Array.from({ length: 150 }, (_, i) => i).filter((i) => i % 7 !== 6).map((i) => jourDe(maintenant - i * JOUR)) },
    { id: 'hab-2', label: 'Relire les devis en attente', createdAt: ilYA(90),
      ticks: [0, 1, 3, 4, 6, 8, 11, 14].map((n) => jourDe(maintenant - n * JOUR)) },
    { id: 'hab-3', label: 'Ranger l’atelier le soir', createdAt: ilYA(60),
      ticks: [0, 2, 5, 9].map((n) => jourDe(maintenant - n * JOUR)), lastTickAt: new Date(maintenant - 30_000).toISOString() },
    { id: 'hab-4', label: 'Pas d’écran après 22 h', createdAt: ilYA(40),
      ticks: [1, 2, 4, 7, 12].map((n) => jourDe(maintenant - n * JOUR)) },
    { id: 'hab-5', label: 'Appeler un client content', createdAt: ilYA(25),
      ticks: [3, 10, 17].map((n) => jourDe(maintenant - n * JOUR)) },
  ];

  /* ── POMODORO ────────────────────────────────────────────────────────────
     Deux mois de séances, plus denses ce mois-ci : le cairn des intentions y
     lit une pierre qui grandit. */
  const seances = [];
  for (let n = 0; n < 62; n += 1) {
    const dense = n < 28;
    const combien = (n % 7 === 6 || n % 7 === 5) ? 0 : dense ? (n % 3 === 0 ? 3 : 2) : (n % 4 === 0 ? 2 : 1);
    for (let k = 0; k < combien; k += 1) {
      seances.push({
        startedAt: new Date(maintenant - n * JOUR - k * 3_600_000).toISOString(),
        minutes: 25,
        label: ['Devis Brasserie', 'Relances', 'Plan d’atelier', 'Compta'][(n + k) % 4],
      });
    }
  }

  /* ── JOURNAL ─────────────────────────────────────────────────────────────
     Trente jours d'humeur : la marée monte et redescend, elle ne fait pas une
     ligne droite. */
  const HUMEURS = [3, 3, 4, 2, 2, 3, 4, 4, 5, 4, 3, 2, 1, 2, 3, 3, 4, 5, 5, 4, 3, 3, 2, 3, 4, 4, 3, 2, 3, 4];
  const TEXTES = [
    'Journée calme, deux devis partis.',
    'Le chantier Brasserie a pris du retard, livraison décalée.',
    'Bonne nouvelle : le client de Lomme a signé.',
    'Trop d’allers-retours pour rien.',
    'Rangé l’atelier, ça respire mieux.',
    'Long appel avec Nadia, on y voit plus clair.',
  ];
  const journal = HUMEURS.map((mood, i) => ({
    day: jourDe(maintenant - (HUMEURS.length - 1 - i) * JOUR),
    /* Le creux du mois (humeur 1) n'a rien d'écrit : c'est exactement le seul
       constat que l'écran se permet, et il faut de vraies données pour le voir. */
    text: mood === 1 ? '' : TEXTES[i % TEXTES.length],
    mood,
    updatedAt: new Date(maintenant - (HUMEURS.length - 1 - i) * JOUR + 64_800_000).toISOString(),
  }));

  /* ── INTENTIONS ──────────────────────────────────────────────────────────
     Une intention close (elle reste lisible) et une en cours : le cairn
     compte dans Pomodoro, il ne déclare rien lui-même. */
  const intentions = [
    { id: 'int-1', title: 'Deux séances par jour ouvré', source: 'pomodoro', seuil: 30,
      startedAt: ilYA(150), closedAt: ilYA(64) },
    { id: 'int-2', title: 'Tenir la marche quotidienne', source: 'habitudes', seuil: 18,
      startedAt: ilYA(62), closedAt: '' },
  ];

  /* ── COURSES ─────────────────────────────────────────────────────────────
     Une liste soldée (la mémoire des prix ET l'ordre des rayons) et la liste
     du jour, à moitié faite. */
  const courses = [
    { id: 'crs-1', createdAt: ilYA(9), soldeeLe: ilYA(8), articles: [
      { id: 'a1', label: 'Café en grains', rayon: 'Épicerie', prixCents: 1290, pris: true },
      { id: 'a2', label: 'Lait', rayon: 'Frais', prixCents: 115, pris: true },
      { id: 'a3', label: 'Éponges', rayon: 'Entretien', prixCents: 340, pris: true },
      { id: 'a4', label: 'Pommes', rayon: 'Fruits et légumes', prixCents: 265, pris: true },
      { id: 'a5', label: 'Sacs poubelle', rayon: 'Entretien', prixCents: 480, pris: true },
    ] },
    { id: 'crs-2', createdAt: ilYA(0), soldeeLe: '', articles: [
      { id: 'b1', label: 'Café en grains', rayon: 'Épicerie', prixCents: 1290, pris: true },
      { id: 'b2', label: 'Pommes', rayon: 'Fruits et légumes', prixCents: 265, pris: true },
      { id: 'b3', label: 'Lait', rayon: 'Frais', prixCents: 115, pris: false },
      { id: 'b4', label: 'Éponges', rayon: 'Entretien', prixCents: 340, pris: false },
      { id: 'b5', label: 'Pain de mie', rayon: 'Épicerie', prixCents: 0, pris: false },
    ] },
  ];

  /* ── CARNET DE SANTÉ ─────────────────────────────────────────────────────
     Trois échéances tenues, une échue depuis des mois (l'ambre), deux à venir. */
  const consignes = [
    { id: 'cs-1', at: jourDe(maintenant - 420 * JOUR), label: 'Vaccin DTP' },
    { id: 'cs-2', at: jourDe(maintenant - 190 * JOUR), label: 'Contrôle dentaire' },
    { id: 'cs-3', at: jourDe(maintenant - 95 * JOUR), label: 'Visite médecine du travail' },
    { id: 'cs-4', at: jourDe(maintenant - 30 * JOUR), label: 'Prise de sang annuelle' },
  ];
  const rappels = [
    { id: 'rp-1', dueAt: jourDe(maintenant - 260 * JOUR), label: 'Contrôle de la vue', doneAt: '' },
    { id: 'rp-2', dueAt: jourDe(maintenant - 120 * JOUR), label: 'Détartrage', doneAt: jourDe(maintenant - 95 * JOUR) },
    { id: 'rp-3', dueAt: jourDe(maintenant - 40 * JOUR), label: 'Rappel vaccin', doneAt: jourDe(maintenant - 38 * JOUR) },
    { id: 'rp-4', dueAt: jourDe(maintenant + 45 * JOUR), label: 'Visite médecine du travail', doneAt: '' },
    { id: 'rp-5', dueAt: jourDe(maintenant + 130 * JOUR), label: 'Contrôle dentaire', doneAt: '' },
  ];


  return {
    habitudes,
    pomodoro: seances,
    journal,
    intentions,
    courses,
    'sante-suivi': consignes,
    'sante-rappels': rappels,
  };
}

/** Les clés telles que `usePersonalStore` les écrit, pour un compte donné. */
export function clesPersonnelles(email, maintenant = Date.now()) {
  const coffre = coffrePersonnel(maintenant);
  return Object.fromEntries(Object.entries(coffre).map(([nom, v]) => [`amn.perso.${nom}.${email}`, v]));
}

/*
  LE COFFRE-FORT D'ESSAI.

  Le Coffre-fort ne passe pas non plus par l'API : dans un navigateur il vit
  dans `localStorage` sous `amn.vault.entries` (voir src/lib/bridge.ts), et
  sans lui la porte fermée annonce « 0 secret » — un relevé à zéro sur un
  écran qu'on prétend juger. Les mots de passe ci-dessous sont FICTIFS et
  n'ouvrent rien : ce sont des chaînes de mesure, pas des identifiants.
*/
export const CLE_COFFRE = 'amn.vault.entries';

export function coffreFort(maintenant = Date.now()) {
  const JOUR = 86_400_000;
  const q = (n) => new Date(maintenant - n * JOUR).toISOString();
  const e = (id, label, username, category, n) => ({
    id,
    label,
    username,
    password: `essai-${id}-non-valide`,
    url: '',
    notes: '',
    category,
    createdAt: q(n),
    updatedAt: q(Math.max(0, n - 3)),
  });
  return [
    e('cf-1', 'Compte grossiste', 'atelier@exemple.test', 'accounts', 210),
    e('cf-2', 'Banque en ligne', 'atelier@exemple.test', 'accounts', 180),
    e('cf-3', 'Serveur de sauvegarde', 'sauvegarde', 'servers', 150),
    e('cf-4', 'Routeur de l’atelier', 'admin', 'servers', 120),
    e('cf-5', 'Clé du service d’envoi', 'api', 'api', 95),
    e('cf-6', 'Clé de la carte en ligne', 'api', 'api', 60),
    e('cf-7', 'Wi-Fi de l’atelier', '', 'other', 40),
  ];
}

/*
  LA CARTE D'EXPLORATION D'ESSAI.

  Découvrir lit `amn.modules.ouverts.<email>` (voir src/state/useModulesOuverts.ts),
  un journal local au poste. Une garde qui ouvre l'écran sans lui mesure une
  carte entièrement vide — donc huit familles à « 0 / n » et trois relevés à
  zéro, ce que le système de design interdit précisément.

  Le jeu ci-dessous est celui d'un espace VÉCU : le Pilotage et l'argent sont
  fréquentés, les Outils à peine, et la famille la moins explorée est donc
  réellement la moins explorée — la recommandation s'en déduit au lieu d'être
  choisie.
*/
const VISITES = {
  quotidien: ['home', 'agenda', 'tasks', 'clients', 'invoices', 'time'],
  courant: ['projects', 'quotes', 'expenses', 'notes', 'dm', 'directory', 'stock', 'priorities', 'settings'],
  rare: ['reports', 'polls', 'leaves', 'shifts', 'pages', 'members'],
};

export function ouverturesDEssai(maintenant = Date.now()) {
  const JOUR = 86_400_000;
  const journal = {};
  VISITES.quotidien.forEach((k, i) => { journal[k] = new Date(maintenant - (i % 2) * JOUR).toISOString(); });
  VISITES.courant.forEach((k, i) => { journal[k] = new Date(maintenant - (3 + i) * JOUR).toISOString(); });
  VISITES.rare.forEach((k, i) => { journal[k] = new Date(maintenant - (40 + i * 5) * JOUR).toISOString(); });
  return journal;
}

export function cleOuvertures(email) {
  return `amn.modules.ouverts.${email}`;
}
