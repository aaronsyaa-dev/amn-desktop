#!/usr/bin/env node
/**
 * PEUPLER LES QUARANTE-CINQ MODULES DU CHANTIER DES CINQUANTE
 * ════════════════════════════════════════════════════════════
 *
 * Même raison d'être que `seed-essai.mjs` : un écran vide ne prouve rien. Les
 * garde-fous navigateur (`check:signal`, `check:contraste`, `check:largeur`…)
 * mesurent ce qu'ils voient, et quarante-cinq écrans vides ne leur montreraient
 * que des états vides.
 *
 * Les données reprennent celles des cahiers 6, 7 et 8 — les onze paniers laissés
 * à l'étape Livraison, les quatorze billets, le trou de 2 280 € du pont — parce
 * que ces recoupements sont justement ce qui permet de vérifier qu'un module
 * calcule, et ne recopie pas : les moteurs de `src/lib/cinquante/` doivent
 * retrouver ces chiffres À PARTIR des enregistrements, pas les afficher.
 *
 * Les dates sont RELATIVES à l'exécution : un billet vendu « il y a trois jours »
 * le reste, et l'écran garde sa forme quel que soit le jour où on le rejoue.
 *
 * Données INVENTÉES, jamais réelles : le script refuse tout compte hors
 * `@exemple.test`. Identifiants stables (`c50-…`) : le rejouer remplace.
 *
 *   AMN_API=http://127.0.0.1:8791 AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… node scripts/seed-cinquante.mjs [famille…]
 */

const API = (process.env.AMN_API ?? 'http://127.0.0.1:4171').replace(/\/$/, '');
const EMAIL = process.env.AMN_E2E_EMAIL ?? '';
const MOT_DE_PASSE = process.env.AMN_E2E_PASSWORD ?? '';
if (!EMAIL || !MOT_DE_PASSE) {
  console.error('Il faut AMN_E2E_EMAIL et AMN_E2E_PASSWORD.');
  process.exit(1);
}
if (!/@exemple\.test$/i.test(EMAIL)) {
  console.error(`Refusé : ${EMAIL} n'est pas un compte d'essai (@exemple.test). Ce script écrit des données inventées.`);
  process.exit(1);
}

const login = await fetch(`${API}/v1/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: MOT_DE_PASSE }),
});
if (!login.ok) {
  console.error(`Connexion refusée : ${login.status} ${await login.text()}`);
  process.exit(1);
}
const { token, user: compte } = await login.json();

const MAINTENANT = new Date();
const JOUR = 86_400_000;
/** Un instant, `jours` avant maintenant (négatif = dans le futur), à l'heure donnée. */
const le = (jours, h = 10, m = 0) => {
  const d = new Date(MAINTENANT.getTime() - jours * JOUR);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const jour = (jours) => le(jours).slice(0, 10);
const eur = (e) => Math.round(e * 100);

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let ecrits = 0;
async function poser(collection, id, data) {
  for (let essai = 0; essai < 6; essai += 1) {
    const res = await fetch(`${API}/v1/collections/${collection}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ data }),
    });
    if (res.ok) {
      ecrits += 1;
      if (ecrits % 25 === 0) await dormir(120);
      return;
    }
    if (res.status === 429) {
      await dormir(500 * 2 ** essai);
      continue;
    }
    console.error(`  ✗ ${collection}/${id} → ${res.status} ${(await res.text()).slice(0, 160)}`);
    return;
  }
}

/* ════════════════════════════════════════════════════════════════ GUICHET ══ */

async function guichet() {
  // ── 34a Boutique ──────────────────────────────────────────────────────────
  const P = {
    kit: { produit: 'Kit microfibres', prixCents: eur(9.9) },
    deg: { produit: 'Dégraissant 5 L', prixCents: eur(13.9) },
    bon: { produit: 'Bon « Vitres 2 h »', prixCents: eur(96) },
    det: { produit: 'Détartrant', prixCents: eur(7.5) },
    spr: { produit: 'Spray inox', prixCents: eur(5.9) },
  };
  const a = (p, n = 1) => ({ ...p, quantite: n });
  // Onze paniers laissés à la Livraison — là où les frais de port apparaissent.
  const livraison = [
    [a(P.kit, 2), a(P.deg, 1), a(P.det, 1)], [a(P.kit, 3), a(P.deg, 1), a(P.spr, 1)], [a(P.kit, 2), a(P.deg, 1)],
    [a(P.kit, 4), a(P.deg, 1)], [a(P.kit, 2), a(P.deg, 2)], [a(P.kit, 3), a(P.det, 1)], [a(P.deg, 3), a(P.det, 1)],
    [a(P.kit, 2), a(P.spr, 1)], [a(P.kit, 1), a(P.det, 1)], [a(P.deg, 1)], [a(P.kit, 1), a(P.spr, 1)],
  ];
  const panier = [[a(P.kit, 1), a(P.spr, 1)], [a(P.kit, 3), a(P.deg, 2)], [a(P.det, 1), a(P.kit, 1)]];
  const paiement = [[a(P.bon, 1)], [a(P.kit, 2), a(P.deg, 1)]];
  let n = 0;
  const cart = async (etape, articles, jours, adresse = false) => {
    n += 1;
    await poser('shopCarts', `c50-panier-${n}`, {
      kind: 'panier', ouvertLe: le(jours, 9 + (n % 9)), etape, articles, adresse,
      arreteLe: le(jours, 9 + (n % 9), 20 + (n % 30)),
    });
  };
  for (const [i, x] of panier.entries()) await cart('panier', x, 20 - i * 5, i === 1);
  for (const [i, x] of livraison.entries()) await cart('livraison', x, 27 - i * 2, i % 4 === 0);
  for (const [i, x] of paiement.entries()) await cart('paiement', x, 9 - i * 4, i === 0);
  const paye = [[a(P.kit, 2), a(P.deg, 2)], [a(P.bon, 1)], [a(P.kit, 3), a(P.deg, 1)], [a(P.deg, 2), a(P.det, 2)]];
  for (let i = 0; i < 22; i += 1) await cart('paye', paye[i % 4], 29 - i, true);
  for (let j = 0; j < 30; j += 1) await poser('shopCarts', `c50-visites-${j}`, { kind: 'visites', jour: jour(j), nombre: 12 + ((j * 7) % 5) });
  await poser('shopCarts', 'c50-reglage', { kind: 'reglage', fraisPortCents: eur(6.9) });

  // ── 34b Billetterie ───────────────────────────────────────────────────────
  await poser('ticketSales', 'c50-atelier', {
    kind: 'evenement', titre: 'Atelier « Détacher sans abîmer »', date: le(-16, 14), jauge: 20,
    tarifs: [{ nom: 'Tarif lancement', prixCents: eur(18), quota: 10 }, { nom: 'Tarif normal', prixCents: eur(25), quota: 10 }],
    ouvertureLe: le(8, 9),
  });
  const ventes = [3, 2, 1, 2, 1, 2, 1, 1, 1];
  const profils = ['client', 'client', 'prospect', 'client', 'client', 'inconnu', 'client', 'prospect', 'client', 'client', 'prospect', 'client', 'inconnu', 'client'];
  const noms = ['Camille Renaud', 'Hugo Marchand', 'Inès Moreau', 'Nadia Bouvier', 'Élodie Vasseur', 'Paul Gérard', 'Sarah Lemaire', 'Yanis Roux', 'Claire Fabre', 'Louis Martin', 'Emma Petit', 'Jules Caron', 'Zoé Laurent', 'Noah Girard'];
  let b = 0;
  for (const [j, k] of ventes.entries()) {
    for (let x = 0; x < k; x += 1) {
      const lancement = b < 10;
      const prix = lancement ? eur(18) : eur(25);
      await poser('ticketSales', `c50-billet-${b}`, {
        kind: 'billet', evenementId: 'c50-atelier', tarif: lancement ? 'Tarif lancement' : 'Tarif normal',
        acheteur: noms[b], profil: profils[b], venduLe: le(8 - j, 10 + x), montantCents: prix, fraisCents: Math.round(prix * 0.02),
      });
      b += 1;
    }
  }

  // ── 34c Dons ──────────────────────────────────────────────────────────────
  await poser('donations', 'c50-camionnette', {
    kind: 'campagne', titre: 'Une camionnette électrique', objectifCents: eur(6000), seuilCents: eur(5000), clotureLe: le(-9, 23, 59),
    paliers: [
      { desCents: 0, contrepartie: 'Un merci sur la page' },
      { desCents: eur(25), contrepartie: 'Un bon « Vitres 1 h »' },
      { desCents: eur(50), contrepartie: 'Un bon « Vitres 2 h »' },
      { desCents: eur(100), contrepartie: 'Une remise en état de canapé' },
      { desCents: eur(250), contrepartie: 'Un entretien trimestriel' },
    ],
  });
  // 41 contributions, 3 720 € au total : 4 sous 25 €, 9 dès 25, 13 dès 50, 12 dès 100, 3 dès 250.
  const montants = [10, 15, 20, 15, ...Array(9).fill(30), ...Array(13).fill(50), ...Array(12).fill(120), 330, 300, 390];
  const ecart = 3720 - montants.reduce((s, x) => s + x, 0);
  montants[montants.length - 1] += ecart;
  // Le rythme des sept derniers jours ≈ 190 € par jour : les 29 plus petites
  // contributions (≈ 1 340 €) sont arrivées cette semaine, les 12 plus grosses
  // au lancement. À ce rythme, le tablier passe le seuil mais n'atteint pas
  // l'autre rive avant la clôture — c'est la situation du cahier.
  montants.sort((x, y) => x - y);
  let recent = 0;
  for (const [i, m] of montants.entries()) {
    const jours = i < 29 ? Math.floor(i / 4.2) : 30 - (i - 29) * 2;
    if (jours < 7) recent += m;
    await poser('donations', `c50-don-${i}`, { kind: 'contribution', campagneId: 'c50-camionnette', nom: `Contributeur ${i + 1}`, montantCents: eur(m), recuLe: le(jours, 8 + (i % 12)) });
  }
  console.log(`  dons des sept derniers jours : ${recent} € (${Math.round(recent / 7)} € par jour)`);

  // ── 34d Acompte en ligne ─────────────────────────────────────────────────
  const devis = [
    { id: 'vermeil', client: 'Atelier Vermeil', montantCents: eur(2400), envoyeLe: le(12), note: 'rendez-vous à 16:30' },
    { id: 'lang', client: 'Bureau Lang', montantCents: eur(520), envoyeLe: le(2) },
    { id: 'aubier', client: 'Résidence Aubier', montantCents: eur(1240), envoyeLe: le(9), signeLe: le(6, 11) },
    { id: 'sereine', client: 'Villa Sereine', montantCents: eur(1580), envoyeLe: le(5), signeLe: le(3, 15) },
    { id: 'halles', client: 'Les Halles', montantCents: eur(600), envoyeLe: le(2), signeLe: le(1, 17) },
    { id: 'nord', client: 'Studio Nord', montantCents: eur(1800), envoyeLe: le(15), signeLe: le(12, 9), acompteRecuLe: le(12, 9, 40), planifieLe: le(-3, 8) },
    { id: 'dune', client: 'Le Comptoir Dune', montantCents: eur(780), envoyeLe: le(10), signeLe: le(8, 14), acompteRecuLe: le(7, 10), planifieLe: le(-6, 8) },
  ];
  for (const d of devis) await poser('depositQuotes', `c50-devis-${d.id}`, { tauxAcompte: 0.3, ...d, id: undefined });
  // L'historique de 90 jours : 61 % dans l'heure, 21 % sous 48 h, 11 % plus tard, 7 % jamais.
  const delais = [...Array(17).fill(0.5), ...Array(6).fill(20), ...Array(3).fill(90), null, null];
  for (const [i, h] of delais.entries()) {
    const signe = le(20 + i * 2, 10);
    await poser('depositQuotes', `c50-devis-h${i}`, {
      client: `Client ${i + 1}`, montantCents: eur(400 + (i % 7) * 150), tauxAcompte: 0.3, envoyeLe: le(22 + i * 2), signeLe: signe,
      ...(h === null ? { annuleLe: le(12 + i * 2) } : { acompteRecuLe: new Date(new Date(signe).getTime() + h * 3_600_000).toISOString() }),
    });
  }

  // ── 34e Chatbot ───────────────────────────────────────────────────────────
  const debutMois = new Date(MAINTENANT.getFullYear(), MAINTENANT.getMonth(), 1, 9).getTime();
  const etendue = Math.max(1, MAINTENANT.getTime() - debutMois);
  const demandes = (n, issue) => Array.from({ length: n }, (_, i) => ({ le: new Date(debutMois + (etendue * (i + 0.5)) / (n + 1)).toISOString(), issue }));
  const Q = [
    ['tarifs', 'Quel est votre tarif horaire ?', 22, '40 € de l’heure, déplacement compris dans la métropole.'],
    ['tarifs', 'Le devis est-il gratuit ?', 14, 'Oui, toujours.'],
    ['tarifs', 'Y a-t-il des frais de déplacement ?', 9, 'Non dans la métropole ; au-delà, 0,50 € du kilomètre.'],
    ['tarifs', 'Prix pour un 3 pièces ?', 5, null],
    ['prestations', 'Faites-vous les vitres ?', 18, 'Oui, intérieur et extérieur jusqu’au deuxième étage.'],
    ['prestations', 'Remise en état après travaux ?', 11, 'Oui, sur devis.'],
    ['prestations', 'Vous nettoyez les tapis ?', 14, null],
    ['prestations', 'Et les canapés en cuir ?', 4, null],
    ['zone', 'Intervenez-vous à Villeurbanne ?', 16, 'Oui.'],
    ['zone', 'Travaillez-vous le samedi ?', 12, 'Le samedi matin, sur rendez-vous.'],
    ['zone', 'Et à Vienne ?', 3, null],
    ['rendezvous', 'Comment prendre rendez-vous ?', 20, 'Par la page de prise de rendez-vous, ou en appelant.'],
    ['rendezvous', 'Puis-je décaler ?', 8, 'Oui, jusqu’à la veille.'],
    ['rendezvous', 'Délai pour un premier passage ?', 6, null],
    ['paiement', 'Acceptez-vous la carte ?', 13, 'Oui.'],
    ['paiement', 'Faut-il un acompte ?', 8, 'Trente pour cent à la signature.'],
    ['paiement', 'Payez-vous en plusieurs fois ?', 5, null],
  ];
  // Les 37 demandes restées sans réponse se partagent entre un humain (22) et rien (15).
  let humains = 22;
  for (const [i, [sujet, texte, fois, reponse]] of Q.entries()) {
    const liste = reponse
      ? demandes(fois, 'faq')
      : demandes(fois, 'humain').map((d, k) => {
          if (humains > 0 && k < Math.ceil(fois * 0.6)) { humains -= 1; return d; }
          return { ...d, issue: 'sans-suite' };
        });
    await poser('chatbotQuestions', `c50-q-${i}`, { kind: 'question', sujet, texte, ...(reponse ? { reponse } : {}), demandes: liste });
  }
  await poser('chatbotQuestions', 'c50-chatbot-reglage', { kind: 'reglage', faqMiseAJourLe: new Date(MAINTENANT.getFullYear(), 5, 12, 10).toISOString() });

  // ── 34f Standard ──────────────────────────────────────────────────────────
  await poser('switchboardCalls', 'c50-mandat', {
    kind: 'mandat',
    peut: ['proposer un créneau libre', 'prendre un message', 'promettre un rappel'],
    nePeutPas: ['annoncer un prix', 'accepter un devis', 'promettre une date ferme'],
  });
  const avant = (minutes) => new Date(MAINTENANT.getTime() - minutes * 60_000).toISOString();
  const simple = [
    [429, 'Résidence Aubier', 125, '1 rappel promis', [{ seconde: 60, citation: 'Léa vous rappelle dans la matinée.', dansLeMandat: true, note: 'Ajouté à ses priorités du jour.' }]],
    [406, 'Chez Mano', 72, 'message pris', []],
    [358, 'numéro inconnu', 40, 'raccroché', []],
    [220, 'Les Halles', 190, '1 créneau proposé', [{ seconde: 88, citation: 'Jeudi 14 heures est libre, je vous le garde.', dansLeMandat: true, note: 'Créneau lu dans RDV en ligne, réservé pour 48 h.' }]],
    [55, 'Bureau Lang', 110, 'passé à Léa', []],
    [19, 'prospect', 150, 'passé à Léa', []],
  ];
  for (const [i, [min, appelant, duree, issue, eng]] of simple.entries()) {
    const d = duree;
    await poser('switchboardCalls', `c50-appel-${i}`, {
      kind: 'appel', debutLe: avant(min), dureeS: d, appelant, issue, engagements: eng,
      tours: [
        { qui: 'appelant', debutS: 0, finS: Math.round(d * 0.2) }, { qui: 'assistant', debutS: Math.round(d * 0.2), finS: Math.round(d * 0.5) },
        { qui: 'appelant', debutS: Math.round(d * 0.5), finS: Math.round(d * 0.7) }, { qui: 'assistant', debutS: Math.round(d * 0.7), finS: d },
      ],
    });
  }
  await poser('switchboardCalls', 'c50-appel-aubry', {
    kind: 'appel', debutLe: avant(112), dureeS: 278, appelant: 'M. Aubry, Villa Sereine', issue: '3 engagements, 1 hors mandat',
    tours: [
      ['appelant', 0, 14], ['assistant', 14, 31], ['appelant', 31, 48], ['assistant', 48, 71], ['appelant', 71, 96], ['assistant', 96, 128],
      ['appelant', 128, 139], ['assistant', 139, 160], ['appelant', 160, 190], ['assistant', 190, 214], ['appelant', 214, 226],
      ['assistant', 226, 250], ['appelant', 250, 262], ['assistant', 262, 278],
    ].map(([qui, debutS, finS]) => ({ qui, debutS, finS })),
    engagements: [
      { seconde: 52, citation: 'Je peux vous proposer mardi 23 au matin.', dansLeMandat: true, note: 'Créneau lu dans RDV en ligne, réservé pour 48 h.' },
      { seconde: 145, citation: 'Léa vous rappelle avant 18 heures.', dansLeMandat: true, note: 'Ajouté à ses priorités du jour.' },
      { seconde: 232, citation: 'Comptez 120 € pour le canapé.', dansLeMandat: false, note: 'Aucun prix n’est annoncé au téléphone.' },
    ],
    explication: 'Ce montant ne sort d’aucune grille : une remise en état de canapé se facture au temps passé, soit 144 € HT pour trois heures. M. Aubry attend 120 €.',
  });
}

/* ══════════════════════════════════════════════════════════════ MARKETING ══ */

async function marketing() {
  // ── 35a Montage vidéo ─────────────────────────────────────────────────────
  const plan = (nom, dureeS, garde = false) => (garde ? { nom, dureeS, garde } : { nom, dureeS });
  await poser('videoEdits', 'c50-vid-hiver', {
    kind: 'montage', titre: 'Vitres d’hiver', format: 'reel', etat: 'en-cours', creeLe: le(3),
    plans: [plan('Plan large', 6), plan('Avant', 5, true), plan('Le geste', 9), plan('Détail', 4), plan('Après', 8, true), plan('Logo', 6)],
  });
  await poser('videoEdits', 'c50-vid-atelier', { kind: 'montage', titre: 'Atelier du 4 octobre', format: 'story', etat: 'a-monter', creeLe: le(1), plans: [] });
  const publies = [
    ['bertaux', 'Avant / après Bertaux', 'reel', [14, 15], 12, 1500],
    ['kit', 'Le kit microfibres', 'story', [6, 8], 20, 980],
    ['terrasse', 'La terrasse Vallon', 'reel', [12, 18], 60, 1100],
    ['pivoines', 'Les pivoines de mai', 'reel', [14, 15], 110, 1380],
    ['camion', 'Le camion en tournée', 'reel', [20, 16], 150, 1240],
    ['devis', 'Un devis en 3 minutes', 'reel', [15, 15], 200, 1240],
  ];
  for (const [id, titre, format, d, jours, vues] of publies) {
    await poser('videoEdits', `c50-vid-${id}`, {
      kind: 'montage', titre, format, etat: 'publie', creeLe: le(jours + 2), publieLe: le(jours), vues,
      plans: d.map((x, i) => plan(`Plan ${i + 1}`, x)),
    });
  }

  // ── 35b Visuels pub ───────────────────────────────────────────────────────
  const R = (x, y, l, h) => ({ x, y, l, h });
  const formats = [
    { cle: 'story', nom: 'Story', largeurPx: 1080, hauteurPx: 1920, titre: R(192, 320, 627, 211), produit: R(192, 1100, 365, 365) },
    { cle: 'feed', nom: 'Feed 4:5', largeurPx: 1080, hauteurPx: 1350, titre: R(96, 96, 800, 211), produit: R(96, 889, 365, 365) },
    { cle: 'carre', nom: 'Carré', largeurPx: 1080, hauteurPx: 1080, titre: R(96, 96, 800, 211), produit: R(96, 619, 365, 365) },
    { cle: 'banniere', nom: 'Bannière', largeurPx: 1200, hauteurPx: 628, titre: R(102, 102, 1111, 154), produit: R(102, 315, 410, 211) },
  ];
  await poser('adVisuals', 'c50-vis-hiver', { kind: 'campagne', nom: 'Hiver', titre: 'Vitres nettes, tout l’hiver', formats, creeLe: le(4), visuels: 4 });
  const sage = formats.map((f) => (f.cle === 'banniere' ? { ...f, titre: R(102, 102, 1000, 154) } : f));
  for (const [i, nom] of ['Printemps', 'Fête des mères', 'Rentrée', 'Terrasses'].entries()) {
    await poser('adVisuals', `c50-vis-${i}`, { kind: 'campagne', nom, titre: nom, formats: sage, creeLe: le(40 + i * 45), visuels: 4 });
  }

  // ── 35c Planificateur ─────────────────────────────────────────────────────
  const courbe = (pic, largeur, haut, bas) =>
    Array.from({ length: 24 }, (_, h) => {
      const d = Math.min(Math.abs(h - pic), 24 - Math.abs(h - pic));
      return Math.round((bas + (haut - bas) * Math.exp(-(d * d) / (2 * largeur * largeur))) * 10) / 10;
    });
  const insta = courbe(13, 4, 21, 3);
  const reseaux = [
    ['instagram', 'Instagram', insta, 0],
    ['facebook', 'Facebook', courbe(19, 3.5, 17, 2), 1],
    ['google', 'Google Business', courbe(9, 3, 15, 1), 2],
  ];
  for (const [id, nom, audience, ordre] of reseaux) await poser('scheduledPosts', `c50-res-${id}`, { kind: 'reseau', nom, audience, ordre });
  const lundi = new Date(MAINTENANT.getFullYear(), MAINTENANT.getMonth(), MAINTENANT.getDate() - ((MAINTENANT.getDay() + 6) % 7));
  const dansLaSemaine = (j, h, m) => new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + j, h, m).toISOString();
  const aDemain = (h, m) => {
    const d = new Date(MAINTENANT.getFullYear(), MAINTENANT.getMonth(), MAINTENANT.getDate() + 1, h, m);
    return d.toISOString();
  };
  await poser('scheduledPosts', 'c50-post-1', { kind: 'post', reseau: 'Instagram', le: dansLaSemaine(0, 12, 30), sujet: 'Avant / après Bertaux' });
  await poser('scheduledPosts', 'c50-post-2', { kind: 'post', reseau: 'Instagram', le: dansLaSemaine(2, 19, 0), sujet: 'Le kit microfibres' });
  /* Le post du creux : jeudi 06:00, ou demain si jeudi est déjà passé. */
  const jeudi = new Date(dansLaSemaine(3, 6, 0));
  await poser('scheduledPosts', 'c50-post-3', { kind: 'post', reseau: 'Instagram', le: jeudi > MAINTENANT ? jeudi.toISOString() : aDemain(6, 0), sujet: 'Vitres d’hiver' });
  await poser('scheduledPosts', 'c50-post-4', { kind: 'post', reseau: 'Facebook', le: dansLaSemaine(3, 18, 30), sujet: 'Atelier du 4 octobre' });
  const heures = [13, 13, 12, 19, 13, 18, 13, 20, 12, 13, 19];
  const portees = [1320, 1180, 760, 640, 1090, 520, 980, 410, 700, 1040, 820];
  for (let i = 0; i < 11; i += 1) {
    const d = new Date(MAINTENANT.getFullYear(), MAINTENANT.getMonth(), Math.max(1, MAINTENANT.getDate() - 1 - i * 2), heures[i], 0);
    await poser('scheduledPosts', `c50-post-pub-${i}`, {
      kind: 'post', reseau: i % 4 === 3 ? 'Facebook' : 'Instagram', le: d.toISOString(), publieLe: d.toISOString(), sujet: `Publication ${i + 1}`, portee: portees[i],
    });
  }
  const aout = new Date(MAINTENANT.getFullYear(), MAINTENANT.getMonth() - 1, 20, 9, 0).toISOString();
  await poser('scheduledPosts', 'c50-post-gb', { kind: 'post', reseau: 'Google Business', le: aout, publieLe: aout, sujet: 'Horaires d’été', portee: 210 });

  // ── 35d Podcast ───────────────────────────────────────────────────────────
  const DUREE = 1450;
  const chap = [0, 319, 740, 1131];
  let graine = 7;
  const hasard = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
  const amplitudes = Array.from({ length: DUREE }, (_, s) => {
    if (chap.slice(1).some((c) => s >= c - 7 && s < c + 6)) return 0.02; // les silences de chapitre
    return Math.round((0.45 + 0.5 * hasard()) * 100) / 100;
  });
  const hesitations = Array.from({ length: 31 }, (_, i) => ({
    s: Math.round(40 + i * 45.3 + (i % 3) * 4),
    dureeS: Math.round((0.8 + ((i * 7) % 6) / 10) * 10) / 10,
    genre: ['euh', 'reprise', 'faux-depart'][i % 3],
  }));
  await poser('podcastEpisodes', 'c50-pod-7', {
    kind: 'episode', numero: 7, titre: 'L’hiver des vitres', dureeS: DUREE, amplitudes,
    chapitres: [{ titre: 'Intro', debutS: 0 }, { titre: 'Le chantier Bertaux', debutS: 319 }, { titre: 'Les produits', debutS: 740 }, { titre: 'Vos questions', debutS: 1131 }],
    hesitations, coupe: { debutS: 870, finS: 908, motif: 'Digression' },
  });
  for (const [n, titre, dureeS, ecoutes, jours] of [[6, 'Nettoyer sans abîmer', 1300, 412, 14], [5, 'Le vrai prix d’un devis', 1570, 388, 28], [4, 'Un jour de tournée', 1190, 301, 42]]) {
    await poser('podcastEpisodes', `c50-pod-${n}`, { kind: 'episode', numero: n, titre, dureeS, amplitudes: [], chapitres: [], hesitations: [], coupe: null, publieLe: le(jours), ecoutes });
  }
  await poser('podcastEpisodes', 'c50-pod-reglage', { kind: 'podcast', abonnes: 186, ecouteMoyenneS: 1020, jusquAuBoutPct: 44 });

  // ── 35e Identité visuelle ─────────────────────────────────────────────────
  await poser('brandKit', 'c50-logo', {
    kind: 'logo', monogramme: 'LM', mention: 'NETTOYAGE', ratioMonogramme: 0.42, ratioMention: 0.085,
    couleurs: ['#0a0a0a', '#f7f7f5', '#8a8a87'], polices: ['Space Grotesk', 'JetBrains Mono'], declinaisons: ['complète', 'réduite', 'monochrome', 'négatif'],
  });
  const usages = [
    ['Enseigne', 220, '3 m', 'l’enseigne'], ['Camion', 96, '60 cm'], ['Avatar', 64, '64 px'],
    ['Signature mail', 40, '40 px'], ['Onglet', 24, '24 px'], ['Favicon', 16, '16 px', 'le favicon'],
  ];
  for (const [i, [nom, taillePx, reel, avecArticle]] of usages.entries()) {
    await poser('brandKit', `c50-usage-${i}`, { kind: 'usage', nom, taillePx, reel, ...(avecArticle ? { avecArticle } : {}), declinaison: 'complete', ordre: i });
  }

  // ── 35f Images produits ───────────────────────────────────────────────────
  const produits = [
    ['deg', 'Dégraissant 5 L', { etiquette: '5 L', forme: 'bidon', bouchon: 'rouge' }],
    ['kit', 'Kit microfibres', { etiquette: 'KIT 6', forme: 'sachet', bouchon: 'sans' }],
    ['det', 'Détartrant', { etiquette: '1 L', forme: 'flacon', bouchon: 'bleu' }],
  ];
  for (const [i, [id, nom, reference]] of produits.entries()) await poser('productShots', `c50-prod-${id}`, { kind: 'produit', nom, reference, ordre: i });
  const decors = ['Fond blanc', 'Plan de travail', 'Atelier', 'Cuisine pro', 'Étagère', 'Extérieur', 'Main', 'Camion'];
  const deg = produits[0][2];
  const verdicts = ['gardee', 'gardee', 'gardee', 'gardee', 'a-revoir', 'ecartee', 'gardee', 'ecartee'];
  for (let i = 0; i < 8; i += 1) {
    await poser('productShots', `c50-sc-deg-${i + 1}`, {
      kind: 'scene', produitId: 'c50-prod-deg', numero: i + 1, decor: decors[i], verdict: verdicts[i], genereeLe: le(2 + i),
      zones: i === 3 ? { ...deg, etiquette: '3 L' } : { ...deg }, ...(i === 4 ? { motif: 'reflet' } : {}),
      ...(verdicts[i] === 'gardee' && i < 3 ? { publieeLe: le(1 + i) } : {}),
    });
  }
  for (const [pid, ref, gardees] of [['kit', produits[1][2], 6], ['det', produits[2][2], 3]]) {
    for (let i = 0; i < 8; i += 1) {
      const altere = pid === 'det' && i === 7;
      await poser('productShots', `c50-sc-${pid}-${i + 1}`, {
        kind: 'scene', produitId: `c50-prod-${pid}`, numero: i + 1, decor: decors[i], genereeLe: le(3 + i),
        verdict: altere ? 'ecartee' : i < gardees ? 'gardee' : 'ecartee',
        zones: altere ? { ...ref, etiquette: '2 L' } : { ...ref },
        ...(i < gardees && i < 5 ? { publieeLe: le(2 + i) } : {}),
      });
    }
  }

  // ── 35g Sentiment ─────────────────────────────────────────────────────────
  const phrases = [
    ['heure', 'Le travail est bien, mais on ne sait jamais quand ils arrivent.', 'negative'],
    ['soigne', 'Travail soigné, on voit la différence.', 'positive'],
    ['contact', 'Très bon contact au téléphone.', 'positive'],
    ['cher', 'Un peu cher pour une petite surface.', 'negative'],
    ['rapide', 'Intervention rapide.', 'positive'],
    ['produits', 'Les produits sentent bon.', 'positive'],
    ['devis', 'Le devis est clair.', 'positive'],
    ['facture', 'La facture est arrivée par mail.', 'neutre'],
    ['creneau', 'Pas de créneau le samedi.', 'negative'],
    ['horaires', 'Quels sont vos horaires ?', 'neutre'],
    ['zone', 'Vous venez à Villeurbanne ?', 'neutre'],
  ];
  for (const [id, phrase, polarite] of phrases) await poser('sentimentTexts', `c50-ph-${id}`, { kind: 'phrase', phrase, polarite });
  const variantesHeure = [
    ['Travail parfait, mais jamais à l’heure annoncée.', 'avis', 42], ['On attend sans savoir s’ils viennent.', 'nps', 20],
    ['Pouvez-vous me prévenir avant de passer ?', 'message', 14], ['Deux fois décalé sans prévenir.', 'avis', 16],
    ['Bien, mais l’heure est une loterie.', 'nps', 26], ['À quelle heure arrivez-vous ?', 'chatbot', 9],
    ['On ne sait jamais quand ils arrivent.', 'nps', 30], ['Le travail est bien fait.', 'nps', 33],
    ['Je ne sais pas quand ils arrivent demain.', 'message', 35], ['Ils arrivent quand ils veulent.', 'avis', 50],
    ['Le matin ou l’après-midi, on ne sait jamais.', 'nps', 55], ['Quand arrivez-vous exactement ?', 'chatbot', 60],
    ['Travail bien, horaire flou.', 'nps', 64], ['Ils arrivent en retard, mais le travail est bien.', 'message', 70],
  ];
  const sources = { nps: 92, chatbot: 61, message: 37, avis: 24 };
  const restes = { ...sources };
  let n = 0;
  const texte = async (t, source, jours, phraseId) => {
    restes[source] -= 1;
    await poser('sentimentTexts', `c50-tx-${n++}`, { kind: 'texte', source, texte: t, le: le(jours, 9 + (n % 9)), phraseId });
  };
  for (const [t, source, jours] of variantesHeure) await texte(t, source, jours, 'c50-ph-heure');
  const lots = [['soigne', 22], ['contact', 9], ['cher', 6], ['rapide', 5], ['produits', 4], ['devis', 4], ['facture', 3], ['creneau', 3], ['horaires', 3], ['zone', 3]];
  const phraseDe = Object.fromEntries(phrases.map(([id, p]) => [id, p]));
  for (const [id, k] of lots) {
    for (let i = 0; i < k; i += 1) {
      const source = Object.entries(restes).sort((a, b) => b[1] - a[1])[0][0];
      await texte(phraseDe[id], source, 3 + ((i * 7 + k) % 80), `c50-ph-${id}`);
    }
  }
  while (Object.values(restes).some((v) => v > 0)) {
    const source = Object.entries(restes).find(([, v]) => v > 0)[0];
    await texte('Merci.', source, 2 + (n % 85), null);
  }

  // ── 35h Veille ────────────────────────────────────────────────────────────
  for (const [id, nom, initiale] of [['n', 'Net’Express', 'N'], ['p', 'ProClean', 'P'], ['l', 'Lyon Services', 'L']]) {
    await poser('competitorPrices', `c50-conc-${id}`, { kind: 'concurrent', nom, initiale });
  }
  const prestations = [
    ['vitres', 'Vitres 2 h', 96, 70, 130], ['canape', 'Remise en état canapé', 144, 100, 200],
    ['bureau', 'Entretien bureau 100 m²', 95, 60, 140], ['chantier', 'Fin de chantier 50 m²', 210, 150, 300], ['vapeur', 'Nettoyage vapeur', 65, 40, 100],
  ];
  for (const [i, [id, nom, vous, bas, haut]] of prestations.entries()) {
    await poser('competitorPrices', `c50-prest-${id}`, { kind: 'prestation', nom, votrePrixCents: eur(vous), marcheBasCents: eur(bas), marcheHautCents: eur(haut), ordre: i });
  }
  const releves = [
    ['n', 'vitres', 85, 48], ['n', 'vitres', 89, 20], ['p', 'vitres', 105, 5], ['l', 'vitres', 92, 5],
    ['n', 'canape', 129, 5], ['p', 'canape', 135, 12], ['p', 'canape', 120, 5], ['l', 'canape', 160, 5],
    ['n', 'bureau', 82, 5], ['p', 'bureau', 110, 5], ['l', 'bureau', 99, 5],
    ['n', 'chantier', 190, 5], ['p', 'chantier', 260, 5], ['l', 'chantier', 250, 40], ['l', 'chantier', 230, 12],
    ['n', 'vapeur', 55, 5], ['l', 'vapeur', 72, 5],
  ];
  for (const [i, [c, pr, prix, jours]] of releves.entries()) {
    await poser('competitorPrices', `c50-rel-${i}`, { kind: 'releve', concurrentId: `c50-conc-${c}`, prestationId: `c50-prest-${pr}`, prixCents: eur(prix), le: le(jours, 8) });
  }

  // ── 35i NPS ───────────────────────────────────────────────────────────────
  let k = 0;
  const rep = async (note, jours, motif) =>
    poser('npsResponses', `c50-nps-${k++}`, { kind: 'reponse', note, le: le(jours, 16), client: `Client ${k}`, ...(motif ? { motif } : {}) });
  for (let i = 0; i < 24; i += 1) await rep(i % 3 ? 10 : 9, 2 + ((i * 11) % 85), i < 17 ? 'Travail soigné' : 'Réactivité au téléphone');
  for (let i = 0; i < 11; i += 1) await rep(i % 2 ? 8 : 7, 3 + ((i * 13) % 80), i < 4 ? 'Prix' : undefined);
  for (let i = 0; i < 7; i += 1) await rep(i % 2 ? 4 : 6, 4 + ((i * 17) % 80), 'Heure d’arrivée incertaine');
  /* Le trimestre civil précédent : 14 promoteurs, 10 passifs, 5 détracteurs → + 31. */
  const tp = Math.floor(MAINTENANT.getMonth() / 3);
  const debutTp = new Date(tp === 0 ? MAINTENANT.getFullYear() - 1 : MAINTENANT.getFullYear(), ((tp + 3) % 4) * 3, 2, 16);
  const dansTp = (i) => new Date(debutTp.getTime() + (i % 60) * JOUR).toISOString();
  for (let i = 0; i < 29; i += 1) {
    await poser('npsResponses', `c50-nps-t-${i}`, { kind: 'reponse', note: i < 14 ? 10 : i < 24 ? 8 : 5, le: dansTp(i * 2), client: `Client T${i}` });
  }
  for (let i = 0; i < 120; i += 1) await poser('npsResponses', `c50-nps-env-${i}`, { kind: 'envoi', le: le(1 + (i % 88), 17) });
  await poser('npsResponses', 'c50-nps-reglage', { kind: 'reglage', delaiEnvoiH: 2 });
}

/* ════════════════════════════════════════════════════════════════ FINANCE ══ */

async function finance() {
  const dansJours = (j, h = 10) => le(-j, h);
  const date = (mois, jourDuMois) => {
    const d = new Date(MAINTENANT.getFullYear(), mois, jourDuMois, 10);
    if (d < MAINTENANT) d.setFullYear(d.getFullYear() + 1);
    return d.toISOString();
  };

  // ── 36a Trésorerie prévue ─────────────────────────────────────────────────
  await poser('cashForecast', 'c50-tr-solde', { kind: 'solde', soldeCents: eur(18400), le: le(0, 8) });
  /* 52 semaines relevées : des encaissements irréguliers (σ ≈ 3 300 €), un excédent moyen de 480 € par mois. */
  for (let i = 0; i < 52; i += 1) {
    const entrees = i % 2 ? 8000 : 1400;
    await poser('cashForecast', `c50-tr-h${i}`, { kind: 'historique', debut: le(7 * (52 - i)), entreesCents: eur(entrees), sortiesCents: eur(4700 - 110.77) });
  }
  const deltas = [-1500, 900, -2600, -1100, 1500, -2700, -1100, -1400, -600, 1400, -2100, -900];
  for (const [k, d] of deltas.entries()) {
    const j = k * 7 + 3;
    const certaine = 2600;
    const probable = 1233;
    const variable = 800;
    const fixe = certaine + probable - variable - d;
    await poser('cashForecast', `c50-tr-c${k}`, { kind: 'flux', libelle: 'Factures échues', le: dansJours(j), montantCents: eur(certaine), nature: 'certaine' });
    await poser('cashForecast', `c50-tr-p${k}`, { kind: 'flux', libelle: 'Devis signés', le: dansJours(j), montantCents: eur(probable), nature: 'probable' });
    await poser('cashForecast', `c50-tr-v${k}`, { kind: 'flux', libelle: 'Produits et carburant', le: dansJours(j), montantCents: -eur(variable), nature: 'sortie-variable' });
    if (k === 8) {
      await poser('cashForecast', `c50-tr-f${k}a`, { kind: 'flux', libelle: 'Échéance de TVA', le: dansJours(j), montantCents: -eur(3120), nature: 'sortie-fixe' });
      await poser('cashForecast', `c50-tr-f${k}b`, { kind: 'flux', libelle: 'Deux salaires', le: dansJours(j), montantCents: -eur(fixe - 3120), nature: 'sortie-fixe' });
    } else {
      await poser('cashForecast', `c50-tr-f${k}`, { kind: 'flux', libelle: 'Charges fixes', le: dansJours(j), montantCents: -eur(fixe), nature: 'sortie-fixe' });
    }
  }

  // ── 36b Scénarios ─────────────────────────────────────────────────────────
  const annee = MAINTENANT.getFullYear() + 1;
  await poser('budgetScenarios', 'c50-sc-modele', {
    kind: 'modele', exercice: annee, caBaseCents: eur(180000), tauxVariable: 0.3, chargesFixesCents: eur(71500),
    salaireMensuelCents: eur(3000), camionnetteMensuelleCents: eur(3800), coutJourDelaiCents: eur(106),
    hypotheses: [
      { cle: 'prix', nom: 'Prix', min: -5, max: 10, pas: 1, unite: 'pct', enPhrase: 'la hausse des prix' },
      { cle: 'volume', nom: 'Volume', min: -20, max: 10, pas: 1, unite: 'pct', enPhrase: 'le volume de chantiers' },
      { cle: 'embauche', nom: 'Embauche', min: 1, max: 13, pas: 1, unite: 'mois', enPhrase: 'la date d’embauche' },
      { cle: 'camionnette', nom: 'Camionnette', min: 1, max: 13, pas: 1, unite: 'mois', enPhrase: 'la date d’achat de la camionnette' },
      { cle: 'delai', nom: 'Délai client', min: 20, max: 60, pas: 1, unite: 'jours', enPhrase: 'le délai client' },
    ],
  });
  const sc = [
    ['prudent', 'Prudent', { prix: 2, volume: -3, embauche: 3, camionnette: 9, delai: 45 }],
    ['central', 'Central', { prix: 3, volume: -1, embauche: 3, camionnette: 11, delai: 42 }],
    ['ambitieux', 'Ambitieux', { prix: 4, volume: 1, embauche: 3, camionnette: 13, delai: 38 }],
  ];
  for (const [i, [id, nom, valeurs]] of sc.entries()) await poser('budgetScenarios', `c50-sc-${id}`, { kind: 'scenario', nom, valeurs, enregistreLe: le(20 - i), ordre: i });

  // ── 36c Simulateur de prêt ────────────────────────────────────────────────
  await poser('loanSimulations', 'c50-pret-camion', { kind: 'pret', objet: 'Camionnette électrique', capitalCents: eur(24000), tauxAnnuel: 0.042, dureesAns: [3, 5, 7], debut: le(0) });

  // ── 36d Analytique ────────────────────────────────────────────────────────
  const projets = [
    ['aubier', 'Résidence Aubier', 40, 6, 8, 'dix-huit heures pointées au lieu de huit, pour un premier passage mal évalué', [
      { poste: 'Main-d’œuvre', prevuCents: eur(384), reelCents: eur(864), detailPrevu: '8 h · 384 €', detailReel: '18 h · 864 €' },
      { poste: 'Produits', prevuCents: eur(42), reelCents: eur(61) },
      { poste: 'Déplacements', prevuCents: eur(36), reelCents: eur(72), detailPrevu: '2 · 36 €', detailReel: '4 · 72 €' },
    ]],
    ['bertaux', 'Maison Bertaux', 34, 38, 15], ['nord', 'Studio Nord', 29, 27, 22], ['dune', 'Le Comptoir Dune', 24, 18, 30],
    ['halles', 'Les Halles', 19, 23, 40], ['mano', 'Chez Mano', 14, 12, 50],
  ];
  for (const [id, nom, margePrevue, margeReelle, jours, cause, postes] of projets) {
    await poser('projectMargins', `c50-pm-${id}`, { kind: 'projet', nom, closLe: le(jours), margePrevue, margeReelle, postes: postes ?? [], ...(cause ? { cause } : {}) });
  }

  // ── 36e Rapprochement ─────────────────────────────────────────────────────
  const paires = [
    [11, 'VIR STUDIO NORD', 540, 'Acompte Studio Nord'], [10, 'CB DUPRE PRO', -148.6, 'BC-2026-014'], [10, 'VIR COMPTOIR DUNE', 234, 'Acompte Comptoir Dune'],
    [9, 'PRLV EDF', -86.2, 'Énergie'], [8, 'CB STATION', -62.4, 'Carburant'], [7, 'VIR BERTAUX', 960, 'F-2026-032'],
    [7, 'PRLV ASSURANCE', -118, 'Assurance pro'], [6, 'CB AMAZON', -23.9, 'Fournitures'], [6, 'VIR LE COMPTOIR', 2275, 'F-2026-031'],
  ];
  for (const [i, [j, lib, m, ecr]] of paires.entries()) {
    await poser('bankLines', `c50-bk-${i}`, { kind: 'banque', le: le(j, 9), libelle: lib, montantCents: eur(m) });
    await poser('bankLines', `c50-ec-${i}`, { kind: 'ecriture', le: le(j, 9), libelle: ecr, montantCents: eur(m) });
  }
  await poser('bankLines', 'c50-bk-urssaf', { kind: 'banque', le: le(5, 9), libelle: 'PRLV URSSAF', montantCents: -eur(1862) });
  await poser('bankLines', 'c50-bk-boul', { kind: 'banque', le: le(5, 9), libelle: 'CB BOULANGERIE', montantCents: -eur(14.2) });
  await poser('bankLines', 'c50-ec-samir', { kind: 'ecriture', le: le(5, 9), libelle: 'Note de frais Samir', montantCents: -eur(38.5) });
  for (const [id, libelle, cible, tol, frais, motif] of [
    ['vir', 'VIR + nom de client', 'facture ouverte', 0, false, 'VIR'],
    ['dupre', 'CB DUPRE PRO', 'bon de commande', 0, false, 'CB DUPRE PRO'],
    ['frais', 'FRAIS BANCAIRES', 'frais', 50, true, 'FRAIS BANCAIRES'],
  ]) {
    await poser('bankLines', `c50-rg-${id}`, { kind: 'regle', libelle, cible, toleranceCents: tol, fraisBancaires: frais, motif });
  }

  // ── 36f Prévision fiscale ─────────────────────────────────────────────────
  await poser('taxDeadlines', 'c50-fi-solde', { kind: 'solde', soldeCents: eur(18400), le: le(0, 8) });
  const finTrimestre = new Date(MAINTENANT.getFullYear(), Math.floor(MAINTENANT.getMonth() / 3) * 3 + 3, 0, 18).toISOString();
  const tvaLe = new Date(MAINTENANT.getFullYear(), Math.floor(MAINTENANT.getMonth() / 3) * 3 + 3, 24, 10).toISOString();
  await poser('taxDeadlines', 'c50-fi-tva', {
    kind: 'echeance', impot: 'TVA du trimestre', court: 'TVA trim.', echeance: tvaLe, montantCents: 0,
    tva: { collecteeCents: eur(4000), deductibleCents: eur(880), projeteeCents: eur(3850), clotureLe: finTrimestre },
  });
  await poser('taxDeadlines', 'c50-fi-is', { kind: 'echeance', impot: 'Acompte IS', court: 'Acompte IS', echeance: date(11, 15), montantCents: eur(1480) });
  await poser('taxDeadlines', 'c50-fi-cfe', { kind: 'echeance', impot: 'CFE', court: 'CFE', echeance: date(11, 15), montantCents: eur(390) });
  await poser('taxDeadlines', 'c50-fi-tva2', { kind: 'echeance', impot: 'TVA du trimestre suivant', court: 'TVA', echeance: new Date(new Date(tvaLe).getFullYear(), new Date(tvaLe).getMonth() + 3, 24, 10).toISOString(), montantCents: eur(3400), estimation: true });

  // ── 36g Multi-devises ─────────────────────────────────────────────────────
  for (const [devise, eurv] of [['CHF', 0.941], ['GBP', 1.173], ['USD', 0.919], ['CAD', 0.675]]) {
    await poser('fxRates', `c50-fx-${devise}`, { kind: 'taux', devise, eur: eurv, le: le(2, 9) });
  }
  const fxf = [
    ['weber', 'Atelier Weber', 'Bâle', 'CHF', 4200, 0.93, 30, -20], ['clean', 'The Clean Room', 'Londres', 'GBP', 1900, 1.198, 52, -8],
    ['harbor', 'Harbor Studio', 'Boston', 'USD', 2600, 0.916, 25, -15], ['tremblay', 'Maison Tremblay', 'Québec', 'CAD', 800, 0.677, 18, -30],
  ];
  for (const [id, client, ville, devise, m, t, emis, ech] of fxf) {
    await poser('fxRates', `c50-fxf-${id}`, { kind: 'facture', client, ville, devise, montant: m * 100, tauxEmission: t, emiseLe: le(emis), echeance: le(ech) });
  }

  // ── 36h Notes de frais ────────────────────────────────────────────────────
  const dTicket = new Date(le(5, 7, 52));
  const jjmm = `${String(dTicket.getDate()).padStart(2, '0')}/${String(dTicket.getMonth() + 1).padStart(2, '0')}/${dTicket.getFullYear()}`;
  await poser('expenseClaims', 'c50-nf-samir', {
    kind: 'note', personne: 'Samir', le: dTicket.toISOString(), montantCents: eur(62.4), statut: 'a-verifier',
    ticket: [
      { texte: 'STATION TOTAL · VILLEURBANNE', zone: 1, style: 'fort' }, { texte: '127 COURS ÉMILE-ZOLA', style: 'petit' },
      { texte: `${jjmm} · 07:52`, zone: 2 }, { texte: '', style: 'filet' }, { texte: 'GAZOLE · 34,10 L', droite: '62,40' }, { texte: '', style: 'filet' },
      { texte: 'TOTAL TTC', droite: '62,40 €', zone: 3, style: 'fort' }, { texte: 'DONT TVA 20 %', droite: '10,40', zone: 4 },
      { texte: 'CB **** 4471 · MERCI', style: 'petit' },
    ],
    champs: [
      { zone: 1, champ: 'Commerçant', valeur: 'Station Total', confiance: 0.97 },
      { zone: 2, champ: 'Date', valeur: `${dTicket.getDate()} ${['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][dTicket.getMonth()]} ${dTicket.getFullYear()}`, confiance: 0.99 },
      { zone: 3, champ: 'Montant TTC', valeur: '62,40 €', confiance: 0.98 },
      { zone: 4, champ: 'TVA', valeur: '20 % · 10,40 €', confiance: 0.58, note: 'La ligne de TVA est pliée sur la photo. Le 20 % est probable pour du gazole professionnel, mais pas certain.' },
    ],
  });
  const autres = [
    ['samir2', 'Samir', 12, 38.5, 'a-verifier'], ['samir3', 'Samir', 3, 25.1, 'a-verifier'],
    ['lea1', 'Léa', 18, 64.2, 'remboursee'], ['lea2', 'Léa', 14, 32.4, 'remboursee'], ['lea3', 'Léa', 9, 41, 'validee'], ['lea4', 'Léa', 6, 52.7, 'validee'], ['lea5', 'Léa', 2, 24, 'a-verifier'],
    ['karim', 'Karim', 4, 38.5, 'validee'],
  ];
  for (const [id, personne, j, m, statut] of autres) {
    await poser('expenseClaims', `c50-nf-${id}`, {
      kind: 'note', personne, le: le(j), montantCents: eur(m), statut, ticket: [{ texte: 'TICKET', zone: 1 }],
      champs: [{ zone: 1, champ: 'Montant TTC', valeur: `${m.toFixed(2).replace('.', ',')} €`, confiance: 0.96 }],
      ...(statut !== 'a-verifier' ? { valideeLe: le(j - 1) } : {}), ...(statut === 'remboursee' ? { rembourseeLe: le(Math.max(0, j - 8)) } : {}),
    });
  }

  // ── 36i Factures entrantes ────────────────────────────────────────────────
  const sur = { fournisseur: 0.98, montant: 0.97, echeance: 0.96 };
  const fe = [
    ['dupre1', 'Dupré Pro', 148.6, 2, 'BC-2026-014'], ['echaf', 'Échafaudages Rhône', 240, 4], ['orange', 'Orange Pro', 86.2, 5],
    ['kangoo', 'Leasing Kangoo', 389, 12], ['morel', 'Cabinet Morel', 180, 12], ['assur', 'Assurance pro', 118, 10], ['bouygues', 'Bouygues', 49.99, 11],
    ['dupre2', 'Dupré Pro', 412, 42], ['vapeur', 'Maintenance vapeur', 96, 58], ['flash', 'Imprimerie Flash', 74, 55], ['caisse', 'Logiciel caisse', 39, 44], ['stock', 'Location stockage', 88, 48],
  ];
  for (const [id, fournisseur, m, ech, reference] of fe) {
    await poser('incomingInvoices', `c50-fe-${id}`, {
      kind: 'facture', fournisseur, montantCents: eur(m), echeance: dansJours(ech), confiance: sur, recueLe: le(6), fournisseurConnu: true, ...(reference ? { reference } : {}),
    });
  }
  await poser('incomingInvoices', 'c50-fe-brun', { kind: 'facture', fournisseur: 'Imprimerie Brun', montantCents: null, echeance: dansJours(20), confiance: { fournisseur: 0.95, montant: 0.2, echeance: 0.9 }, recueLe: le(2), fournisseurConnu: true, motif: 'montant illisible sur la photo' });
  await poser('incomingInvoices', 'c50-fe-nt', { kind: 'facture', fournisseur: 'SAS NT-Lyon', montantCents: eur(212), echeance: dansJours(9), confiance: { fournisseur: 0.62, montant: 0.95, echeance: 0.93 }, recueLe: le(1), fournisseurConnu: false, motif: 'fournisseur inconnu' });
  for (const [i, [f, m, j]] of [['Dupré Pro', 1279.4, 40], ['Leasing Kangoo', 778, 50], ['Cabinet Morel', 360, 45], ['Échafaudages Rhône', 240, 60]].entries()) {
    await poser('incomingInvoices', `c50-fe-paye-${i}`, { kind: 'facture', fournisseur: f, montantCents: eur(m), echeance: le(j - 26), confiance: sur, recueLe: le(j), payeeLe: le(j - 26), fournisseurConnu: true });
  }
}

/* ═════════════════════════════════════════════════════════════════════ RH ══ */

async function rh() {
  const isoJ = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const lundi = new Date(MAINTENANT.getFullYear(), MAINTENANT.getMonth(), MAINTENANT.getDate() - ((MAINTENANT.getDay() + 6) % 7));
  const jourDe = (semaine, j) => isoJ(new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + semaine * 7 + j - 1));

  // ── 37a Recrutement : le Planning (collection de Planning d'équipe) ────────
  /* Quatre semaines passées : l'équipe tient 8 h → 12 h et 13 h → 17 h tous les jours. */
  const equipe = ['lea@exemple.test', 'samir@exemple.test', 'nour@exemple.test'];
  for (let s = -4; s <= -1; s += 1) {
    for (let j = 1; j <= 5; j += 1) {
      await poser('shifts', `shift-${equipe[0]}-${jourDe(s, j)}`, { email: equipe[0], day: jourDe(s, j), kind: 'matin' });
      await poser('shifts', `shift-${equipe[1]}-${jourDe(s, j)}`, { email: equipe[1], day: jourDe(s, j), kind: 'apresmidi' });
    }
  }
  /* Cette semaine : les matins sont tenus ; mardi, mercredi et jeudi après-midi, personne. */
  for (let j = 1; j <= 5; j += 1) await poser('shifts', `shift-${equipe[0]}-${jourDe(0, j)}`, { email: equipe[0], day: jourDe(0, j), kind: 'matin' });
  for (const j of [1, 5]) await poser('shifts', `shift-${equipe[1]}-${jourDe(0, j)}`, { email: equipe[1], day: jourDe(0, j), kind: 'apresmidi' });
  await poser('candidates', 'c50-rec-poste', { kind: 'poste', intitule: 'Agent d’entretien, 20 h', publieLe: le(19), refusees: 4, refuseesDepuis: le(40), refuseesApresMidi: true });
  const apm = (jours, heures) => jours.flatMap((j) => heures.map((h) => `${j}-${h}`));
  const candidats = [
    ['yanis', 'Yanis Ferrand', 'entretien', true, [...apm([2, 3, 4], [13, 14, 15, 16]).filter((k) => k !== '2-14' && k !== '4-13'), ...apm([1], [8, 9])]],
    ['clara', 'Clara Mendès', 'entretien', true, [...apm([2, 3], [13, 14, 15]), ...apm([5], [9, 10, 11])]],
    ['tom', 'Tom Rivière', 'entretien', true, [...apm([4], [13, 14, 15, 16]), ...apm([1, 2], [8, 9, 10])]],
    ...Array.from({ length: 20 }, (_, i) => [`c${i}`, `Candidature ${i + 1}`, i < 3 ? 'entretien' : 'recu', false, []]),
  ];
  for (const [id, nom, etape, finaliste, dispo] of candidats) await poser('candidates', `c50-rec-${id}`, { kind: 'candidat', nom, etape, finaliste, dispo });

  // ── 37b Procédures : le réel qu'elles citent (Stock, Matériel) ─────────────
  await poser('stockItems', 'c50-stock-detartrant', { name: 'Détartrant pro', unit: 'L', quantity: 6, minQuantity: 2, createdAt: le(90), movedAt: le(10) });
  await poser('stockItems', 'c50-stock-degraissant', { name: 'Dégraissant 5 L', unit: 'bidon', quantity: 4, minQuantity: 1, createdAt: le(90), movedAt: le(5) });
  await poser('resources', 'c50-res-vapeur', { name: 'Nettoyeur vapeur', kind: 'matériel', createdAt: le(200) });
  const procs = [
    ['vapeur', 'Détartrer le nettoyeur vapeur', 'Matériel', 180, 'Léa', [
      { texte: 'Débrancher et laisser refroidir 30 minutes.', cite: { type: 'materiel', nom: 'Nettoyeur vapeur' } },
      { texte: 'Vider la cuve au-dessus de l’évier.' },
      { texte: 'Verser 200 mL de détartrant Lyn dilué à 10 %.', cite: { type: 'stock', nom: 'Détartrant Lyn' } },
      { texte: 'Chauffer 10 minutes sans vapeur, puis vider.' },
      { texte: 'Rincer deux fois à l’eau claire.' },
    ], 'Jamais de vinaigre : il attaque les joints de la chaudière.'],
    ['chantier', 'Fermer un chantier', 'Chantier', 60, 'Samir', [{ texte: 'Photographier chaque pièce.' }, { texte: 'Faire signer le bon d’intervention.' }]],
    ['intervention', 'Ouvrir une intervention', 'Chantier', 21, 'Léa', [{ texte: 'Relire la fiche du client.' }, { texte: 'Charger le dégraissant.', cite: { type: 'stock', nom: 'Dégraissant 5 L' } }]],
    ['stocker', 'Stocker les produits', 'Atelier', 330, 'Nour', [{ texte: 'Ranger les acides en bas.' }, { texte: 'Étiqueter chaque flacon entamé.' }]],
  ];
  for (const [i, [id, titre, categorie, jours, par, etapes, securite]] of procs.entries()) {
    await poser('procedures', `c50-proc-${id}`, { kind: 'procedure', titre, categorie, etapes, ...(securite ? { securite } : {}), version: 3 - (i % 2), relueLe: le(jours), relueePar: par });
  }
  for (let i = 0; i < 8; i += 1) {
    await poser('procedures', `c50-proc-x${i}`, { kind: 'procedure', titre: ['Nettoyer une vitre haute', 'Traiter une tache de vin', 'Entretenir la camionnette', 'Accueillir un nouveau', 'Remplir un devis', 'Préparer une tournée', 'Trier les déchets', 'Ranger l’atelier'][i], categorie: 'Atelier', etapes: [{ texte: 'Suivre la fiche.' }], version: 1, relueLe: le(30 + i * 25), relueePar: 'Léa' });
  }

  // ── 37c Formation ─────────────────────────────────────────────────────────
  await poser('trainings', 'c50-form-chimie', { kind: 'formation', nom: 'Produits chimiques et dilutions', tauDefautSem: 20 });
  await poser('trainings', 'c50-form-gestes', { kind: 'formation', nom: 'Gestes et postures', tauDefautSem: 30 });
  await poser('trainings', 'c50-form-hauteur', { kind: 'formation', nom: 'Travail en hauteur', tauDefautSem: 30 });
  const debut = 70; // la formation a eu lieu il y a dix semaines
  const quiz = [
    ['ines', 'Inès', [[debut, 100, 'initial'], [debut - 35, 76, 'rappel']]],
    ['samir', 'Samir', [[debut, 100, 'initial'], [debut - 42, 72, 'rappel']]],
    ['lea', 'Léa', [[debut - 7, 100, 'initial'], [debut - 49, 70, 'rappel']]],
    ['nour', 'Nour', [[debut, 100, 'initial'], [debut - 21, 83, 'rappel']]],
    ['karim', 'Karim', [[debut, 100, 'initial']]],
  ];
  for (const [id, personne, qs] of quiz) {
    for (const [k, [j, score, type]] of qs.entries()) {
      await poser('trainings', `c50-quiz-${id}-${k}`, { kind: 'quiz', formationId: 'c50-form-chimie', personne, le: le(j, 9), score, type });
    }
  }
  for (const [i, p] of ['Inès', 'Samir', 'Léa', 'Nour', 'Karim'].entries()) {
    await poser('trainings', `c50-quiz-g-${i}`, { kind: 'quiz', formationId: 'c50-form-gestes', personne: p, le: le(30, 9), score: 100, type: 'initial' });
  }
  for (const [i, p] of ['Samir', 'Karim'].entries()) {
    await poser('trainings', `c50-quiz-h-${i}`, { kind: 'quiz', formationId: 'c50-form-hauteur', personne: p, le: le(20, 9), score: 100, type: 'initial' });
  }

  // ── 37d Habilitations ─────────────────────────────────────────────────────
  const an = (n, m, j = 15) => new Date(MAINTENANT.getFullYear() + n, m, j, 12).toISOString();
  const personnes = [
    ['lea', 'Léa', [['H0B0', an(2, 5)], ['SST', an(1, 2)]]],
    ['samir', 'Samir', [['Travail en hauteur', le(-7, 12)], ['CACES R486', an(3, 11, 31)], ['H0B0', le(40, 12)]]],
    ['nour', 'Nour', [['SST', an(1, 11, 31)]]],
    ['karim', 'Karim', [['H0B0', an(1, 11, 31)], ['Travail en hauteur', an(2, 11, 31)]]],
    ['ines', 'Inès', [['SST', le(70, 12)]]],
  ];
  for (const [id, nom, cles] of personnes) {
    await poser('certifications', `c50-hab-${id}`, { kind: 'personne', nom, cles: cles.map(([habilitation, echeance]) => ({ habilitation, echeance })) });
  }
  await poser('certifications', 'c50-hab-ex-vitrage', { kind: 'exigence', motif: 'vitrages', habilitation: 'Travail en hauteur' });
  await poser('certifications', 'c50-hab-ex-elec', { kind: 'exigence', motif: 'tableau électrique', habilitation: 'H0B0' });
  await poser('certifications', 'c50-hab-ch-bertaux', { kind: 'chantier', nom: 'Maison Bertaux · tableau électrique', le: le(-1, 9), exige: ['H0B0'], affectes: ['Karim'] });
  await poser('certifications', 'c50-hab-ch-aubier', { kind: 'chantier', nom: 'Résidence Aubier', le: le(-3, 9), exige: [], affectes: ['Nour'] });
  await poser('interventions', 'c50-int-halles', {
    title: 'Vitrages à 6 m', clientName: 'Les Halles', address: 'Lyon', at: le(-9, 8),
    volets: { avant: { photo: '', note: '' }, pendant: { photo: '', note: '' }, apres: { photo: '', note: '' } },
    consommations: [], closedAt: '', reportedAt: '', createdAt: le(3),
  });

  // ── 37e Bulletins de paie ─────────────────────────────────────────────────
  const mois = `${MAINTENANT.getFullYear()}-${String(MAINTENANT.getMonth() + 1).padStart(2, '0')}`;
  const bulletins = [
    ['lea', 'Léa Marchand', 3620, 1055, 570, 105],
    ['samir', 'Samir Benali', 2980, 868, 468, 114, { coutCents: eur(164), netCents: eur(86) }],
    ['nour', 'Nour Haddad', 2610, 760, 410, 80],
    ['karim', 'Karim Diallo', 1330, 387, 207, 56],
    ['ines', 'Inès Rocher', 1300, 380, 205, 55],
  ];
  for (const [id, personne, cout, pat, sal, pas, heuresSup] of bulletins) {
    await poser('payslips', `c50-bul-${id}-${mois}`, {
      kind: 'bulletin', personne, mois, coutEmployeurCents: eur(cout), patronalesCents: eur(pat), salarialesCents: eur(sal), pasCents: eur(pas),
      netCents: eur(cout - pat - sal - pas), ...(heuresSup ? { heuresSup } : {}),
    });
  }
  const finMois = new Date(MAINTENANT.getFullYear(), MAINTENANT.getMonth() + 1, 0, 9).toISOString();
  await poser('payslips', `c50-paie-${mois}`, { kind: 'paie', mois, virementLe: finMois });
}

/* ══════════════════════════════════════════════════════════════ JURIDIQUE ══ */

async function juridique() {
  // ── La fiche client réelle que lisent le Clausier et le RGPD ──────────────
  await poser('clients', 'c50-client-aubry', {
    name: 'M. Aubry', company: '', status: 'active', email: 'aubry@exemple.test', phone: '06 00 00 00 00',
    notes: 'Villa Sereine', imageDataUrl: '', linkedSiteIds: [], createdAt: le(420), updatedAt: le(3), events: [],
  });

  // ── 38a Clausier ──────────────────────────────────────────────────────────
  const clauses = [
    [1, 'Objet', 'Remise en état d’un canapé et entretien des vitrages, au domicile du client.', {}, null, null],
    [2, 'Prix', '144 € HT pour trois heures, déplacement compris.', {}, null, null],
    [3, 'Reconduction', 'Le contrat se reconduit tacitement d’année en année.', { duree: 'annuelle' }, null, 'prestation ponctuelle'],
    [4, 'Acompte', '30 % à la signature, payable en ligne ; le solde à la fin de l’intervention.', { paiement: 'acompte 30 %' }, null, 'paiement à la fin'],
    [5, 'Sous-traitance', 'Le prestataire peut confier tout ou partie de l’intervention à un sous-traitant agréé.', { soustraitance: 'oui' }, null, 'aucune'],
    [6, 'Responsabilité', 'Le prestataire est assuré pour les dommages causés lors de l’intervention.', {}, null, null],
    [9, 'Droit de rétractation', 'Le client dispose de quatorze jours pour se rétracter, sans avoir à se justifier.', { client: 'particulier' }, { client: 'particulier' }, 'client professionnel'],
    [10, 'Litiges', 'Tribunal compétent : Lyon.', {}, null, null],
  ];
  for (const [numero, titre, texte, siReponses, obligatoireSi, raisonRepli] of clauses) {
    await poser('clauseContracts', `c50-cl-${numero}`, {
      kind: 'clause', numero, titre, texte, source: 'Code de la consommation', siReponses,
      ...(obligatoireSi ? { obligatoireSi } : {}), ...(raisonRepli ? { raisonRepli } : {}), majLe: le(100),
    });
  }
  const reponses = { client: 'professionnel', duree: 'ponctuelle', lieu: 'chez le client', paiement: 'acompte 30 %', soustraitance: 'non' };
  await poser('clauseContracts', 'c50-ct-aubry', { kind: 'contrat', titre: 'Contrat de prestation de nettoyage', client: 'M. Aubry', reponses, genereLe: le(0, 9) });
  for (let i = 0; i < 6; i += 1) {
    await poser('clauseContracts', `c50-ct-${i}`, { kind: 'contrat', titre: 'Contrat de prestation', client: `Client ${i + 1}`, reponses: { ...reponses, duree: i % 3 ? 'ponctuelle' : 'annuelle' }, genereLe: le(10 + i * 9) });
  }

  // ── 38b Signature à distance ──────────────────────────────────────────────
  await poser('signatureCircuits', 'c50-sig-villa', {
    kind: 'circuit', document: 'Entretien annuel · Villa Sereine', client: 'M. Aubry', envoyeLe: le(12, 9),
    signataires: [
      { role: 'Prestataire', nom: 'Léa Marchand', signeLe: le(11, 10) },
      { role: 'Client', nom: 'M. Aubry', signeLe: le(4, 18) },
      { role: 'Co-signataire', nom: 'Mme Aubry', ouvertures: 2 },
      { role: 'Copie certifiée', nom: 'Cabinet Morel' },
    ],
    debutContratLe: new Date(MAINTENANT.getFullYear(), MAINTENANT.getMonth() + 1, 1, 9).toISOString(),
  });
  await poser('signatureCircuits', 'c50-sig-nord', {
    kind: 'circuit', document: 'Avenant · Studio Nord', client: 'Studio Nord', envoyeLe: le(1, 9),
    signataires: [{ role: 'Prestataire', nom: 'Léa Marchand', signeLe: le(1, 10) }, { role: 'Client', nom: 'Studio Nord' }],
  });
  for (let i = 0; i < 9; i += 1) {
    await poser('signatureCircuits', `c50-sig-f${i}`, {
      kind: 'circuit', document: `Devis signé ${i + 1}`, client: 'x', envoyeLe: le(3 + i * 2, 9),
      signataires: [{ role: 'Prestataire', nom: 'Léa Marchand', signeLe: le(3 + i * 2, 11) }, { role: 'Client', nom: `Client ${i + 1}`, signeLe: le(Math.max(0, 2 + i * 2 - (i % 2)), 16) }],
    });
  }

  // ── 38c RGPD : le registre, et ce que le Standard garde de M. Aubry ───────
  const traitements = [
    ['clients', 'Fiches clients', 'Clients', 'contrat', null, 'relation + 3 ans'],
    ['contracts', 'Contrats', 'Contrats', 'contrat', null, 'contrat + 5 ans'],
    ['switchboardCalls', 'Enregistrements d’appel', 'Standard', 'intérêt légitime', 30, '30 j'],
    ['npsResponses', 'Sondages de satisfaction', 'NPS', 'intérêt légitime', 1095, '3 ans'],
    ['depositQuotes', 'Devis et acomptes', 'Acompte en ligne', 'contrat', 3650, '10 ans', true],
  ];
  for (const [collection, nom, module, baseLegale, dureeJours, dureeLibelle, lieAFacture] of traitements) {
    await poser('gdprRegister', `c50-rg-${collection}`, { kind: 'traitement', nom, module, collection, baseLegale, dureeJours, dureeLibelle, ...(lieAFacture ? { lieAFacture } : {}) });
  }
  await poser('gdprRegister', 'c50-rg-demande', { kind: 'demande', personne: 'M. Aubry', type: 'acces', le: le(1, 11) });
  await poser('gdprRegister', 'c50-rg-demande2', { kind: 'demande', personne: 'Chez Mano', type: 'acces', le: le(120, 11) });
  await poser('gdprRegister', 'c50-rg-purge', { kind: 'purge', collection: 'npsResponses', nombre: 41, le: le(60) });
  await poser('gdprRegister', 'c50-rg-revue', { kind: 'revue', le: le(190) });
  for (const [i, jours] of [94, 91].entries()) {
    await poser('switchboardCalls', `c50-std-vieux-${i}`, {
      kind: 'appel', debutLe: le(jours, 10), dureeS: 120, appelant: 'M. Aubry, Villa Sereine', issue: 'message pris', tours: [], engagements: [],
    });
  }
  await poser('contracts', 'c50-contrat-aubry', { title: 'Entretien annuel', party: 'M. Aubry', startsAt: le(-8).slice(0, 10), endsAt: le(-373).slice(0, 10), amountCents: eur(1440), status: 'draft', autoRenew: false, note: '', createdAt: le(12) });

  // ── 38d Impact RSE ────────────────────────────────────────────────────────
  const an = MAINTENANT.getFullYear();
  const sources = [
    ['vehicules', 'Véhicules', 'Gazole · 2 véhicules', 'L', 2.66, 1540, 1280, 0],
    ['achats', 'Achats de produits', 'Produits d’entretien', '€', 0.3774, 3180, 3180, 1],
    ['energie', 'Énergie des locaux', 'Électricité des locaux', 'kWh', 0.052, 17300, 19200, 2],
    ['deplacements', 'Déplacements', 'Trains et hôtels', 'déplacements', 100, 3, 4, 3],
  ];
  for (const [id, nom, poste, unite, facteurKg, v, v0, ordre] of sources) {
    const ref = 'Base Empreinte (ADEME)';
    await poser('carbonSources', `c50-rse-${id}-${an}`, { kind: 'source', nom, poste, volume: v, unite, facteurKg, referenceFacteur: ref, annee: an, ordre });
    await poser('carbonSources', `c50-rse-${id}-${an - 1}`, { kind: 'source', nom, poste, volume: v0, unite, facteurKg, referenceFacteur: ref, annee: an - 1, ordre });
  }
  await poser('carbonSources', `c50-rse-act-${an}`, { kind: 'activite', annee: an, interventions: 360 });

  // ── 38e Vérification d'identité ───────────────────────────────────────────
  await poser('kycChecks', 'c50-kyc-reglage', { kind: 'reglage', conservationAns: 5, seuilCaAnnuelCents: eur(5000) });
  const ok = (cle, nom, detail) => ({ cle, nom, ok: true, detail });
  await poser('kycChecks', 'c50-kyc-brunel', {
    kind: 'verification', client: 'SAS Brunel Immobilier', professionnel: true, demandeeLe: le(1, 10),
    controles: [
      ok('piece', 'Pièce d’identité', 'lue et valide'),
      { cle: 'selfie', nom: 'Selfie', score: 96, detail: 'correspond à 96 %' },
      { cle: 'adresse', nom: 'Adresse', dateJustificatif: le(145), detail: 'justificatif récent' },
      ok('siren', 'SIREN', 'société active'),
      ok('iban', 'IBAN', 'au nom de la société'),
    ],
  });
  for (const [i, [client, jours]] of [['Harbor Studio', 11], ['Atelier Weber', 20]].entries()) {
    await poser('kycChecks', `c50-kyc-ok-${i}`, {
      kind: 'verification', client, professionnel: true, demandeeLe: le(jours, 10), valideeLe: le(jours - 1, 10),
      controles: [ok('piece', 'Pièce d’identité', 'lue et valide'), { cle: 'selfie', nom: 'Selfie', score: 97, detail: 'correspond à 97 %' }, { cle: 'adresse', nom: 'Adresse', dateJustificatif: le(jours + 20), detail: 'justificatif récent' }, ok('siren', 'SIREN', 'société active'), ok('iban', 'IBAN', 'au nom de la société')],
    });
  }
}

/* ═══════════════════════════════════════════════════════════ LES AJOUTS ══ */

async function ajouts() {
  // ── 39a Tableau de bord — le pupitre de CE compte ─────────────────────────
  // Les cadrans lisent les modules d'origine : on ne pose ici que la
  // composition du pupitre et ses objectifs, jamais une valeur.
  const moi = (compte?.email ?? EMAIL).trim().toLowerCase();
  await poser('dashboardDials', `pupitre-${moi.replace(/[^a-z0-9]+/g, '-')}`, {
    kind: 'pupitre', utilisateur: moi, centre: 'encaisse',
    bandeau: ['devis', 'heures', 'paniers', 'nps', 'stock'], modifieLe: le(3),
    centres: [{ cle: 'encaisse', le: le(40) }, { cle: 'nps', le: le(20) }, { cle: 'encaisse', le: le(3) }],
    objectifs: { encaisse: eur(16_000), heures: 21 },
  });

  // ── 39b Scoring des leads ─────────────────────────────────────────────────
  const criteres = [
    ['entrant', 'Contact entrant (appel, formulaire)', 30],
    ['recommandation', 'Recommandation d’un client', 25],
    ['connu', 'Budget et surface connus', 20],
    ['visites', 'Visites du site', 15],
    ['zone', 'Dans la zone d’intervention', 10],
  ];
  for (const [cle, nom, poidsInitial] of criteres) await poser('leadScores', `c50-critere-${cle}`, { kind: 'critere', cle, nom, poidsInitial });
  const f = (critere, texte, force, j = 2) => ({ critere, texte, force, le: le(j, 9) });
  const leads = [
    ['montgolfier', 'SCI Montgolfier', '04 78 00 00 01', [f('entrant', 'appel entrant', 1, 0), f('connu', '4 sites à entretenir', 1, 0), f('recommandation', 'contrat annuel demandé', 0.9, 0), f('zone', 'Lyon 6e', 1)]],
    ['pauline', 'Chez Pauline', '', [f('recommandation', 'recommandée par Bertaux', 1), f('entrant', 'a demandé un rappel', 0.8), f('connu', 'surface connue', 0.6)]],
    ['arnoux', 'Cabinet Arnoux', '', [f('visites', '2 visites', 0.7), f('entrant', 'ouvre les lettres', 0.8), f('zone', 'Villeurbanne', 1), f('connu', 'surface estimée', 0.5)]],
    ['tanneurs', 'Les Tanneurs', '', [f('visites', '3 visites du site', 1), f('entrant', 'formulaire complet', 0.7), f('connu', 'budget indiqué', 0.8)]],
    ['aubier', 'Résidence Aubier', '', [f('recommandation', 'devis déjà signé', 0.7), f('entrant', 'demande récente', 0.6), f('zone', 'même quartier', 1)]],
    ['rey', 'Boulangerie Rey', '', [f('visites', '1 visite', 0.4), f('entrant', 'pas de budget', 0.6), f('zone', 'hors zone', 0.1)]],
    ['petit', 'M. Petit', '', [f('entrant', 'question au chatbot', 0.5), f('connu', 'particulier', 0.2), f('visites', 'aucun suivi', 0.1)]],
    ['lumen', 'Atelier Lumen', '', [f('visites', '2 visites', 0.6), f('entrant', 'formulaire incomplet', 0.4), f('zone', 'Caluire', 0.8)]],
    ['brotteaux', 'Syndic des Brotteaux', '', [f('connu', '12 lots connus', 0.9), f('zone', 'Lyon 6e', 1), f('visites', '1 visite', 0.3)]],
    ['vigneron', 'Maison Vigneron', '', [f('visites', '1 visite', 0.3), f('zone', 'Écully', 0.6)]],
  ];
  for (const [id, nom, telephone, faits] of leads) {
    await poser('leadScores', `c50-lead-${id}`, { kind: 'lead', nom, ...(telephone ? { telephone } : {}), ouvertLe: le(12), faits });
  }
  const clos = [
    ['olivier', 'Pharmacie Olivier', true, true], ['garnier', 'Garnier & fils', true, false], ['merle', 'Cabinet Merle', true, true], ['sauvage', 'Mme Sauvage', false, false],
  ];
  for (const [id, nom, joue, signe] of clos) {
    await poser('leadScores', `c50-lead-${id}`, {
      kind: 'lead', nom, ouvertLe: le(80), closLe: le(40), signe, ...(joue ? { joueEnPremierLe: le(70) } : {}),
      faits: [f('entrant', 'appel entrant', 1, 80), f('zone', 'dans la zone', 1, 80), f('visites', '1 visite', 0.4, 80)],
    });
  }

  // ── 39c Itinéraires ───────────────────────────────────────────────────────
  // Le plan schématique (Lyon, la Saône à l'ouest, le Rhône à l'est) et les
  // trajets « routiers » du bac à sable : la distance à vol d'oiseau, plus un
  // détour par pont à chaque traversée — le module, lui, ne lit que ces
  // trajets, jamais le tracé.
  const coursDEau = [
    { nom: 'la Saône', largeur: 34, points: [[42, 0], [42, 22], [46, 44], [44, 67], [43, 84], [44, 100]] },
    { nom: 'le Rhône', largeur: 44, points: [[62, 0], [64, 22], [61, 47], [64, 69], [65, 86], [65, 100]] },
  ];
  await poser('routePlans', 'c50-itin-reglage', { kind: 'reglage', coursDEau, consoL100: 7.5 });
  const depot = { id: 'depot', nom: 'Dépôt', xPct: 18, yPct: 62 };
  const arrets = [
    { id: 'bertaux', nom: 'Maison Bertaux', court: 'Bertaux', xPct: 30, yPct: 30, adresse: '12 rue Tronchet, Lyon 6e', creneau: { debut: '08:00', fin: '10:00' }, dureeMin: 40 },
    { id: 'studio', nom: 'Studio Nord', xPct: 52, yPct: 18, adresse: '4 quai Saint-Vincent, Lyon 1er', dureeMin: 30 },
    { id: 'halles', nom: 'Les Halles', xPct: 70, yPct: 34, adresse: '102 cours Lafayette, Lyon 3e', dureeMin: 35 },
    { id: 'aubier', nom: 'Résidence Aubier', court: 'Aubier', xPct: 82, yPct: 66, adresse: '8 rue Paul-Bert, Lyon 3e', creneau: { debut: '11:00', fin: '11:00' }, dureeMin: 45 },
    { id: 'mano', nom: 'Chez Mano', xPct: 60, yPct: 78, adresse: '31 rue de Marseille, Lyon 7e', dureeMin: 30 },
    { id: 'dune', nom: 'Le Comptoir Dune', court: 'Comptoir Dune', xPct: 40, yPct: 72, adresse: '5 place Bellecour, Lyon 2e', creneau: { debut: '15:00' }, dureeMin: 30 },
  ];
  const pts = [depot, ...arrets];
  const coupeSeg = (a, b, c, d) => {
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  };
  const trajets = [];
  for (let i = 0; i < pts.length; i += 1) {
    for (let j = i + 1; j < pts.length; j += 1) {
      const a = [pts[i].xPct * 10, pts[i].yPct * 3.6];
      const b = [pts[j].xPct * 10, pts[j].yPct * 3.6];
      let ponts = 0;
      for (const c of coursDEau) for (let k = 1; k < c.points.length; k += 1) {
        if (coupeSeg(a, b, [c.points[k - 1][0] * 10, c.points[k - 1][1] * 3.6], [c.points[k][0] * 10, c.points[k][1] * 3.6])) ponts += 1;
      }
      const km = Math.round((Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.012 + ponts * 1.6) * 10) / 10;
      trajets.push({ de: pts[i].id, a: pts[j].id, km, min: Math.round(km * 2.6 + ponts * 4) });
    }
  }
  const demainJ = new Date(MAINTENANT.getFullYear(), MAINTENANT.getMonth(), MAINTENANT.getDate() + 1);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const plan = { kind: 'plan', depart: '08:00', depot, arrets, trajets, ordreHabituel: ['halles', 'bertaux', 'aubier', 'studio', 'dune', 'mano'] };
  await poser('routePlans', 'c50-itin-demain', { ...plan, jour: iso(demainJ) });
  // Les tournées déjà envoyées ce mois-ci : leurs gains nourrissent le bilan.
  const gainsPasses = [[21.4, 44], [18.2, 39], [24.6, 52], [16.9, 35], [22.3, 47], [19.8, 41], [20.5, 43], [17.1, 36], [23.4, 50], [27.8, 83]];
  for (let k = 0; k < gainsPasses.length; k += 1) {
    const d = new Date(MAINTENANT.getFullYear(), MAINTENANT.getMonth(), 1 + k * 2);
    if (d >= MAINTENANT) break;
    await poser('routePlans', `c50-itin-passe-${k}`, { ...plan, jour: iso(d), envoyeLe: new Date(d.getTime() - JOUR).toISOString(), gains: { km: gainsPasses[k][0], min: gainsPasses[k][1] } });
  }

  // ── 39d Prévision de stock ────────────────────────────────────────────────
  // Les modules d'origine d'abord : Stock, Fournisseurs, kits, interventions.
  const articlesStock = [
    ['filtres', 'Filtres à air', 7, 'pièce'], ['microfibres', 'Microfibres', 58, 'pièce'], ['gants', 'Gants nitrile M', 64, 'paire'],
    ['detartrant', 'Détartrant pro', 13, 'bidon'], ['sacs', 'Sacs 100 L', 70, 'pièce'], ['degraissant', 'Dégraissant', 0, 'bidon'],
  ];
  for (const [id, name, quantity, unit] of articlesStock) {
    await poser('stockItems', `c50-stk-${id}`, { name, quantity, minQuantity: null, unit, note: '', createdAt: le(90), movedAt: le(2) });
  }
  const fournisseursStock = [['dupre', 'Dupré Pro', 'Filtres, pièces de climatisation', 8], ['direct', 'Nettoyage Direct', 'Microfibres, sacs', 3], ['hygiene', 'Hygiène Plus', 'Gants, produits', 4]];
  for (const [id, name, supplies, leadTimeDays] of fournisseursStock) {
    await poser('suppliers', `c50-sup-${id}`, { name, supplies, contact: '', phone: '', email: '', lastOrderAt: le(20), lastDeliveryAt: le(12), leadTimeDays, deliveries: [leadTimeDays, leadTimeDays + 1], createdAt: le(200) });
  }
  const kitsStock = [
    ['clim', 'Entretien climatisation', [['Filtres à air', 2], ['Microfibres', 3], ['Gants nitrile M', 2]]],
    ['detartrage', 'Détartrage', [['Détartrant pro', 1], ['Microfibres', 1], ['Gants nitrile M', 1]]],
    ['remise', 'Remise en état', [['Sacs 100 L', 3], ['Microfibres', 2], ['Gants nitrile M', 2]]],
  ];
  for (const [id, product, comps] of kitsStock) {
    await poser('boms', `c50-kit-${id}`, { product, components: comps.map(([label, quantity]) => ({ label, quantity, unit: 'pièce', unitCostCents: 0 })), sellPriceCents: null, createdAt: le(60) });
  }
  const volets = { avant: { photo: '', note: '' }, pendant: { photo: '', note: '' }, apres: { photo: '', note: '' } };
  const planning = [
    ...[1, 3, 5, 6, 8, 10, 13, 17, 20, 24, 27, 31, 34, 38].map((j) => ['Entretien climatisation', j]),
    ...[2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35, 38].map((j) => ['Détartrage', j]),
    ...[4, 9, 14, 19, 24, 29, 34, 39].map((j) => ['Remise en état', j]),
  ];
  const clientsPlan = ['Cabinet Arnoux', 'SCI Montgolfier', 'Les Tanneurs', 'Studio Nord', 'Chez Mano'];
  for (let k = 0; k < planning.length; k += 1) {
    const [titre, j] = planning[k];
    await poser('interventions', `c50-int-plan-${k}`, {
      title: `${titre} — ${clientsPlan[k % clientsPlan.length]}`, clientName: clientsPlan[k % clientsPlan.length], address: 'Lyon',
      at: le(-j, 9), volets, consommations: [], closedAt: '', reportedAt: '', createdAt: le(5),
    });
  }
  for (let k = 0; k < 6; k += 1) {
    await poser('interventions', `c50-int-passe-${k}`, {
      title: `${k % 2 ? 'Détartrage' : 'Entretien climatisation'} — ${clientsPlan[k % clientsPlan.length]}`, clientName: clientsPlan[k % clientsPlan.length], address: 'Lyon',
      at: le(7 + k * 8, 9), volets, consommations: [], closedAt: le(7 + k * 8, 12), reportedAt: le(7 + k * 8, 12), createdAt: le(60),
    });
  }
  const suivisStock = [['Filtres à air', 'Dupré Pro'], ['Microfibres', 'Nettoyage Direct'], ['Gants nitrile M', 'Hygiène Plus'], ['Détartrant pro', 'Hygiène Plus'], ['Sacs 100 L', 'Nettoyage Direct'], ['Dégraissant', 'Hygiène Plus']];
  for (const [article, fournisseur] of suivisStock) {
    await poser('stockForecasts', `c50-suivi-${article.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, { kind: 'suivi', article, fournisseur });
  }

  // ── 39e Flotte ────────────────────────────────────────────────────────────
  // Le kilométrage vient des tournées POINTÉES : on pose des tournées faites
  // (arrêts cochés, avec leur distance) et des tournées planifiées.
  const tournee = (id, vehiculeId, j, kms, faite) => poser('deliveryRounds', `c50-rnd-${id}`, {
    title: `Tournée ${vehiculeId.replace('c50-veh-', '')}`, day: jour(j), departAt: '08:00', createdAt: le(Math.max(j, 0) + 2), vehiculeId,
    stops: kms.map((km, k) => ({ id: `stp-${id}-${k}`, label: `Arrêt ${k + 1}`, address: 'Lyon', doneAt: faite ? le(j, 9 + k) : null, km, dureeMin: 30 })),
  });
  let kmKangoo = 0; let kmTrafic = 0; let kmVelo = 0;
  for (let j = 60; j >= 1; j -= 1) {
    const d = new Date(MAINTENANT.getTime() - j * JOUR).getDay();
    if (d === 2 || d === 4) { await tournee(`kangoo-${j}`, 'c50-veh-kangoo', j, [12.4, 8.1, 14.6, 9.9], true); kmKangoo += 45; }
    if (d === 1 || d === 3 || d === 5) { await tournee(`trafic-${j}`, 'c50-veh-trafic', j, [18.2, 11.5, 16.3], true); kmTrafic += 46; }
    if (d >= 1 && d <= 5) { await tournee(`velo-${j}`, 'c50-veh-velo', j, [2.1, 1.8, 2.6], true); kmVelo += 6.5; }
  }
  for (let j = -1; j >= -21; j -= 1) {
    const d = new Date(MAINTENANT.getTime() - j * JOUR).getDay();
    if (d === 2) await tournee(`kangoo-plan${-j}`, 'c50-veh-kangoo', j, [12.4, 8.1, 14.6], false);
  }
  const kmK = 140_000 + kmKangoo; const kmT = 88_000 + kmTrafic; const kmV = 4_000 + kmVelo;
  const cout = (le_, montantCents, nature) => ({ le: le_, montantCents, nature });
  const vehicules = [
    ['kangoo', 'Kangoo', 'GA-418-KX', 140_000, [
      { nom: 'Vidange', feminin: true, nature: 'km', intervalle: 15_000, dernierKm: Math.round(kmK - 10_800) },
      { nom: 'Contrôle technique', nature: 'jours', intervalle: 730, dernierLe: le(726) },
    ], [cout(le(200), eur(2130), 'carburant'), cout(le(120), eur(1460), 'entretien'), cout(le(240), eur(800), 'assurance'), cout(le(40), eur(240), 'carburant'), cout(le(12), eur(230), 'carburant')]],
    ['trafic', 'Trafic', 'FB-207-LM', 88_000, [
      { nom: 'Vidange', feminin: true, nature: 'km', intervalle: 15_000, dernierKm: Math.round(kmT - 3_300) },
      { nom: 'Contrôle technique', nature: 'jours', intervalle: 730, dernierLe: le(548) },
    ], [cout(le(190), eur(1880), 'carburant'), cout(le(100), eur(820), 'entretien'), cout(le(240), eur(800), 'assurance'), cout(le(35), eur(210), 'carburant'), cout(le(8), eur(210), 'carburant')]],
    ['velo', 'Vélo cargo', '', 4_000, [
      { nom: 'Révision', feminin: true, nature: 'km', intervalle: 2_500, dernierKm: Math.round(kmV - 1_200) },
    ], [cout(le(150), eur(170), 'entretien'), cout(le(240), eur(120), 'assurance'), cout(le(20), eur(20), 'entretien')]],
  ];
  for (const [id, nom, immatriculation, kmDepart, echeances, couts] of vehicules) {
    await poser('vehicles', `c50-veh-${id}`, { kind: 'vehicule', nom, immatriculation, kmDepart, departLe: le(61), echeances, couts });
  }

  // ── 39f Classeur ──────────────────────────────────────────────────────────
  const art = (a1, a2, a4, a5) => [
    { titre: 'Art. 1 · Objet', texte: `Entretien hebdomadaire des locaux, 180 m², ${a1}.` },
    { titre: 'Art. 2 · Durée', texte: a2 },
    { titre: 'Art. 4 · Prix', texte: `${a4} HT par an, payables par trimestre.` },
    { titre: 'Art. 5 · Résiliation', texte: `Préavis de ${a5}, par écrit.` },
  ];
  const duree = 'Un an à compter du 1ᵉʳ octobre, reconductible par accord écrit.';
  const contrat = [
    [1, art('le lundi matin', duree, '1 800 €', 'un mois'), 'Léa Martin', le(33)],
    [2, art('le lundi matin', duree, '1 800 €', 'deux mois'), 'Léa Martin', le(26)],
    [3, art('le mardi matin', duree, '1 800 €', 'deux mois'), 'Léa Martin', le(21)],
    [4, art('le mardi matin', duree, '1 800 €', 'deux mois'), 'Nour Haddad', le(14)],
    [5, art('le mardi matin', duree, '1 950 €', 'deux mois'), 'Nour Haddad', le(6)],
  ];
  await poser('documentVersions', 'c50-doc-studio', { kind: 'document', titre: 'Contrat d’entretien · Studio Nord', signeeVersion: 4, signeeLe: le(13), signataire: 'Studio Nord' });
  for (const [numero, paragraphes, auteur, deposeLe] of contrat) {
    await poser('documentVersions', `c50-doc-studio-v${numero}`, { kind: 'version', documentId: 'c50-doc-studio', numero, paragraphes, auteur, deposeLe, octets: 184_000 + numero * 2_100 });
  }
  await poser('documentVersions', 'c50-doc-cg', { kind: 'document', titre: 'Conditions générales', etat: 'en vigueur' });
  for (const numero of [1, 2, 3]) {
    await poser('documentVersions', `c50-doc-cg-v${numero}`, {
      kind: 'version', documentId: 'c50-doc-cg', numero, auteur: 'Léa Martin', deposeLe: le(200 - numero * 40), octets: 96_000_000,
      paragraphes: [{ titre: 'Art. 1 · Champ', texte: `Les présentes conditions s’appliquent à toute prestation${numero > 1 ? ' réalisée en France' : ''}.` }],
    });
  }
  await poser('documentVersions', 'c50-doc-pdp', { kind: 'document', titre: 'Plan de prévention · Halles', etat: 'brouillon' });
  for (const numero of [1, 2]) {
    await poser('documentVersions', `c50-doc-pdp-v${numero}`, {
      kind: 'version', documentId: 'c50-doc-pdp', numero, auteur: 'Nour Haddad', deposeLe: le(10 - numero * 3), octets: 64_000_000,
      paragraphes: [{ titre: 'Art. 1 · Risques', texte: `Travail en hauteur à ${numero === 1 ? '5' : '6'} m, nacelle obligatoire.` }],
    });
  }

  // ── 39g Éditeur partagé ───────────────────────────────────────────────────
  await poser('sharedDocs', 'c50-partage-conditions', {
    kind: 'document', titre: 'Conditions d’intervention · Studio Nord',
    paragraphes: [
      { id: 'p1', texte: 'Nous intervenons chaque mardi matin, entre 8 h et 11 h, dans les locaux du rez-de-chaussée.' },
      { id: 'p2', texte: 'Les produits utilisés sont fournis par le prestataire et conformes à la fiche de sécurité remise au client.' },
      { id: 'p3', texte: 'Toute intervention supplémentaire fait l’objet d’un devis préalable, accepté par écrit.' },
      { id: 'p4', texte: 'Le client prévient 48 heures à l’avance de toute fermeture exceptionnelle des locaux.' },
    ],
  });
  const papillon = (id, paragrapheId, auteur, note, cible, par, poseLe, statut = 'attente', reponduLe) =>
    poser('sharedDocs', `c50-papillon-${id}`, { kind: 'papillon', documentId: 'c50-partage-conditions', paragrapheId, auteur, note, ...(cible ? { cible } : {}), par, poseLe, statut, ...(reponduLe ? { reponduLe } : {}) });
  await papillon('nour', 'p1', 'Nour Haddad', '« entre 8 h et 10 h » ?', 'entre 8 h et 11 h', 'entre 8 h et 10 h', new Date(MAINTENANT.getTime() - 2 * 3_600_000).toISOString());
  await papillon('samir', 'p3', 'Samir Benali', 'ajouter « ou par message »', 'accepté par écrit', 'accepté par écrit ou par message', le(5, 9));
  await papillon('lea', 'p3', 'Léa Martin', '« accepté en ligne »', 'accepté par écrit', 'accepté en ligne', le(1, 9));
  await papillon('karim', 'p4', 'Karim Ould', '« 72 heures » ?', '48 heures', '72 heures', le(1, 16));
  for (let k = 0; k < 6; k += 1) await papillon(`ancien-${k}`, 'p2', ['Léa Martin', 'Nour Haddad', 'Samir Benali'][k % 3], 'correction', '', '', le(20 - k * 2, 10), k === 5 ? 'refusee' : 'acceptee', le(19 - k * 2, 10));
  await poser('sharedDocs', 'c50-partage-livret', { kind: 'document', titre: 'Livret d’accueil', paragraphes: [{ id: 'l1', texte: 'Bienvenue dans l’équipe.' }, { id: 'l2', texte: 'Les clés se retirent au bureau.' }] });
  for (const [id, pg] of [['l-a', 'l1'], ['l-b', 'l2']]) {
    await poser('sharedDocs', `c50-papillon-${id}`, { kind: 'papillon', documentId: 'c50-partage-livret', paragrapheId: pg, auteur: 'Léa Martin', note: 'à reformuler', par: '', poseLe: le(2, 11), statut: 'attente' });
  }
  await poser('sharedDocs', 'c50-partage-charte', { kind: 'document', titre: 'Charte de l’équipe', paragraphes: [{ id: 'c1', texte: 'On se dit bonjour.' }] });

  // ── 39h Salles ────────────────────────────────────────────────────────────
  // Relatif à l'instant du dépôt : la salle du fond est réservée depuis
  // quarante minutes, et personne n'y est entré.
  const dans = (min) => new Date(MAINTENANT.getTime() + min * 60_000).toISOString();
  await poser('roomBookings', 'c50-salles-plan', {
    kind: 'plan', colonnes: '1.3fr 1fr 1fr', rangees: [130, 110, 90], zones: ['a b d', 'c c d', 'f e d'],
    pieces: [
      { zone: 'a', nom: 'Bureau' }, { zone: 'b', nom: 'Salle de réunion', court: 'réunion' }, { zone: 'c', nom: 'Atelier' },
      { zone: 'd', nom: 'Salle du fond' }, { zone: 'e', nom: 'Stock' }, { zone: 'f', nom: 'Accueil' },
    ],
  });
  const resa = (id, piece, debut, fin, motif, pour, contact) => poser('roomBookings', `c50-resa-${id}`, { kind: 'reservation', piece, debut, fin, motif, pour, ...(contact ? { contact } : {}) });
  const pres = (id, piece, qui, arriveeLe, departLe, source = 'badge') => poser('roomBookings', `c50-pres-${id}`, { kind: 'presence', piece, qui, arriveeLe, ...(departLe ? { departLe } : {}), source });
  await resa('fond', 'Salle du fond', dans(-40), dans(20), 'l’entretien d’embauche de Yanis', 'Yanis Morel', 'yanis@exemple.test');
  await resa('bureau', 'Bureau', dans(-100), dans(140), 'dossiers clients', 'Léa Martin');
  await resa('reunion', 'Salle de réunion', dans(260), dans(320), 'Revue hebdo', 'Nour Haddad');
  await resa('atelier', 'Atelier', dans(380), dans(500), 'préparation atelier', 'Samir Benali');
  await pres('lea', 'Bureau', 'Léa Martin', dans(-95), null, 'pointage');
  await pres('samir', 'Atelier', 'Samir Benali', dans(-60), null, 'intervention');
  await pres('nour', 'Accueil', 'Nour Haddad', dans(-80), null, 'badge');
  // Le mois : des réservations tenues, et trois fantômes.
  for (let k = 1; k <= 12; k += 1) {
    const d = new Date(MAINTENANT.getFullYear(), MAINTENANT.getMonth(), Math.min(k * 2, 28), 10);
    if (d >= MAINTENANT) break;
    const piece = k % 3 ? 'Salle de réunion' : 'Salle du fond';
    const debut = d.toISOString(); const fin = new Date(d.getTime() + 3_600_000).toISOString();
    await resa(`mois-${k}`, piece, debut, fin, 'réunion', 'Nour Haddad');
    if (k % 4 !== 0) await pres(`mois-${k}`, piece, 'Nour Haddad', new Date(d.getTime() + 5 * 60_000).toISOString(), fin);
    await pres(`bureau-${k}`, 'Bureau', 'Léa Martin', new Date(d.getTime() - 2 * 3_600_000).toISOString(), new Date(d.getTime() + 6 * 3_600_000).toISOString(), 'pointage');
  }

  // ── 39i Rédaction ─────────────────────────────────────────────────────────
  const tx = (texte) => ({ type: 'texte', texte });
  const co = (retire, ajoute, raison, explication, extra = {}) => ({ type: 'correction', ...(retire ? { retire } : {}), ...(ajoute ? { ajoute } : {}), raison, explication, ...extra });
  await poser('writingDrafts', 'c50-redac-lang', {
    kind: 'brouillon', titre: 'Avis de Bureau Lang', creeLe: le(0, 8),
    source: { surtitre: 'L’avis · Bureau Lang · 1 ★', texte: 'Intervention décalée deux fois sans prévenir. Le travail était correct mais je ne peux pas organiser mes journées comme ça.', recuLe: le(1, 18) },
    morceaux: [
      tx('Bonjour, '),
      co('merci pour votre retour, même s’il n’est pas très sympa,', 'merci pour votre retour.', 'plus poli', 'retire un reproche au client'),
      tx(' Vous avez raison : deux décalages sans prévenir, ce n’est pas acceptable. '),
      co('On a eu une semaine compliquée.', '', 'plus court', 'une excuse n’explique rien'),
      tx(' Nous vous appellerons désormais la veille de chaque passage. '),
      co('', 'Le prochain passage vous est offert.', 'plus poli', 'un geste pour réparer', { valeur: 'un passage offert vaut 96 €' }),
      tx(' '),
      co('', 'Merci de votre confiance.', 'plus clair', 'une formule de fin'),
      tx(' Léa'),
    ],
  });
  await poser('writingDrafts', 'c50-redac-vermeil', {
    kind: 'brouillon', titre: 'Relance Atelier Vermeil', creeLe: le(6, 9), publieeLe: le(6, 14),
    source: { surtitre: 'Le message · Atelier Vermeil', texte: 'Pouvez-vous me renvoyer la facture ?', recuLe: le(6, 8) },
    morceaux: [tx('Bonjour, '), co('voilà', 'voici', 'plus clair', 'le bon mot', { decision: 'acceptee' }), tx(' la facture. '), co('Cdlt', 'Bien cordialement,', 'plus poli', 'pas d’abréviation', { decision: 'acceptee' }), tx(' Léa')],
  });
  await poser('writingDrafts', 'c50-redac-mano', {
    kind: 'brouillon', titre: 'Réponse à Chez Mano', creeLe: le(12, 9), publieeLe: le(12, 16),
    source: { surtitre: 'L’avis · Chez Mano · 4 ★', texte: 'Très bien, un peu cher.', recuLe: le(12, 7) },
    morceaux: [tx('Merci ! '), co('C’est le prix de la qualité.', 'Nos tarifs sont affichés en ligne.', 'plus poli', 'ne pas contredire', { decision: 'acceptee' }), tx(' '), co('', 'Remise de 10 % au prochain passage.', 'plus poli', 'un geste', { decision: 'refusee' }), tx(' '), co('', 'À bientôt.', 'plus clair', 'une formule de fin', { decision: 'refusee' })],
  });

  // ── 39j Traduction ────────────────────────────────────────────────────────
  await poser('translations', 'c50-trad-weber', {
    kind: 'document', titre: 'Devis D-2026-052 · Atelier Weber', langue: 'de', pays: 'CH', creeLe: le(1, 10),
    lignes: [
      { source: 'Entretien complet des vitrages, intérieur et extérieur', traduction: 'Vollständige Reinigung der Verglasung, innen und außen' },
      { source: 'Remise en état du canapé en tissu', traduction: 'Wiederherstellung des Stoffsofas' },
      { source: 'Déplacement Lyon – Bâle', traduction: 'Anfahrt Lyon – Basel' },
      { source: 'Acompte de 30 % à la signature, payable en ligne', traduction: 'Anzahlung von 30 % bei Unterzeichnung, online zahlbar' },
      { source: 'TVA non applicable, art. 293 B du CGI', traduction: 'MwSt. nicht anwendbar, Art. 293 B des CGI' },
    ],
  });
  for (let k = 0; k < 10; k += 1) {
    await poser('translations', `c50-trad-ancien-${k}`, {
      kind: 'document', titre: `Devis D-2026-0${30 + k}`, langue: k % 3 ? 'de' : 'en', pays: k % 3 ? 'CH' : 'GB', creeLe: le(20 + k * 7, 10),
      lignes: [{ source: 'Entretien des vitrages', traduction: k % 3 ? 'Reinigung der Verglasung' : 'Window cleaning' }],
    });
  }
  const termes = [['Remise en état', 'Wiederherstellung', 'Léa Martin'], ['Passage', 'Einsatz', 'Léa Martin'], ['Kit microfibres', 'Mikrofaser-Set', 'Nour Haddad'], ['Vitrages', 'Verglasung', 'Nour Haddad']];
  for (const [terme, traduction, validePar] of termes) {
    await poser('translations', `c50-terme-${terme.toLowerCase().replace(/[^a-z]+/g, '-')}`, { kind: 'terme', terme, traduction, langue: 'de', validePar });
  }

  // ── 39k Extensions ────────────────────────────────────────────────────────
  const passage = (moduleCle, module, donnee, sens, declareNecessaire, extra = {}) => ({ moduleCle, module, donnee, sens, declareNecessaire, ...extra });
  await poser('extensionGrants', 'c50-ext-avisplus', {
    kind: 'extension', nom: 'AvisPlus', editeur: 'éditeur tiers', usage: 'extension d’avis', statut: 'demande',
    passages: [
      passage('clients', 'Clients', 'noms et courriels', 'lecture', true),
      passage('reviews', 'Avis', 'notes et textes', 'lecture', true),
      passage('invoices', 'Facturation', 'montants des factures', 'lecture', false),
      passage('reviews', 'Avis', 'réponses publiées', 'ecriture', true),
      // Demandé, mais le poste ne le montrera jamais : le Coffre-fort est hors douane.
      passage('vault', 'Coffre-fort', 'mots de passe', 'lecture', false),
    ],
  });
  const installee = (id, nom, passages) => poser('extensionGrants', `c50-ext-${id}`, { kind: 'extension', nom, editeur: 'éditeur tiers', usage: 'extension', statut: 'installee', installeeLe: le(120), revueLe: le(35), passages });
  await installee('agenda', 'Agenda Sync', [passage('agenda', 'Agenda', 'rendez-vous', 'lecture', true, { usages30j: 212, decision: 'autorise' }), passage('agenda', 'Agenda', 'rendez-vous', 'ecriture', true, { usages30j: 40, decision: 'autorise' })]);
  await installee('compta', 'Compta Export', [passage('invoices', 'Facturation', 'factures', 'lecture', true, { usages30j: 8, decision: 'autorise' }), passage('clients', 'Clients', 'adresses', 'lecture', false, { decision: 'refuse' })]);
  await installee('meteo', 'Météo chantier', [passage('rounds', 'Tournées', 'adresses du jour', 'lecture', true, { usages30j: 30, decision: 'autorise' }), passage('clients', 'Clients', 'téléphones', 'lecture', false, { decision: 'refuse' })]);
}

/* ═════════════════════════════════════════════════════════════ LES FUSIONS ══ */

async function fusions() {
  // ── Site vitrine → Pages : six pages libres, dont quatre en ligne ─────────
  const b = (type, extra) => ({ id: `b-${Math.random().toString(36).slice(2, 8)}`, type, ...extra });
  const page = (id, title, blocks, publiee, jours) =>
    poser('pages', `c50-site-${id}`, { title, blocks, editorRoles: ['owner', 'admin'], template: 'blank', site: publiee ? { publiee: true, publieeLe: le(jours) } : { publiee: false } });
  await page('accueil', 'Accueil', [
    b('text', { text: 'Nettoyage professionnel à Lyon — devis sous 24 h' }),
    b('text', { text: 'Six clients réguliers, dont Maison Bertaux et Studio Nord.' }),
    b('checklist', { items: ['Entretien courant', 'Remise en état', 'Interventions ponctuelles', 'Vitrages en hauteur', 'Fin de chantier'].map((text, i) => ({ id: `i${i}`, text, done: false })) }),
    b('table', { columns: ['Prestation', 'Tarif'], rows: [['', '']] }),
    b('image', { url: 'https://images.exemple.test/avant-apres.jpg', caption: 'Neuf photos avant/après, chargées depuis Médias' }),
    b('text', { text: 'Demande de devis — sept champs : nom, adresse, surface, fréquence, budget, date souhaitée, message.' }),
    b('text', { text: 'Mentions, horaires, téléphone.' }),
  ], false, 21);
  await page('prestations', 'Prestations', [b('text', { text: 'Entretien courant, remise en état, interventions ponctuelles.' }), b('checklist', { items: [{ id: 'a', text: 'Bureaux', done: false }, { id: 'b', text: 'Commerces', done: false }] })], true, 100);
  await page('apropos', 'À propos', [b('text', { text: 'Une équipe de quatre personnes, à Lyon depuis 2019.' })], true, 200);
  await page('contact', 'Contact', [b('text', { text: '04 78 00 00 00 · du lundi au vendredi, 8 h – 18 h.' })], true, 100);
  await page('mentions', 'Mentions légales', [b('text', { text: 'Éditeur du site, hébergeur, SIRET.' })], true, 600);
  await page('avantapres', 'Avant / après', [b('image', { url: '', caption: '' })], false, 60);

  // ── Factures récurrentes multi-devises → Abonnements ──────────────────────
  // Deux forfaits en francs suisses et en livres, convertis au dernier taux
  // relevé dans Multi-devises (CHF, GBP), et un en dollars canadiens sans
  // taux : il sort du total, et l'écran le dit.
  const abo = (id, label, customerName, amountCents, period, currency, jours) =>
    poser('subscriptions', `c50-abo-${id}`, { label, customerName, customerEmail: '', amountCents, vatRate: 20, period, nextAt: jour(jours), active: true, createdAt: le(200), ...(currency ? { currency } : {}) });
  await abo('weber', 'Maintenance vitrages', 'Atelier Weber (Bâle)', 32_000, 'monthly', 'CHF', -9);
  await abo('london', 'Entretien bureaux', 'Harbour & Co (Londres)', 54_000, 'quarterly', 'GBP', -20);
  await abo('montreal', 'Supervision', 'Studio Lune (Montréal)', 18_000, 'monthly', 'CAD', -14);
}

const FAMILLES = { guichet, marketing, finance, rh, juridique, ajouts, fusions };
const demandees = process.argv.slice(2);
for (const [nom, f] of Object.entries(FAMILLES)) {
  if (demandees.length && !demandees.includes(nom)) continue;
  process.stdout.write(`${nom}… `);
  await f();
  console.log('ok');
}
console.log(`${ecrits} enregistrement(s) écrit(s).`);
