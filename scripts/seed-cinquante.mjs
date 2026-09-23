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
const { token } = await login.json();

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

const FAMILLES = { guichet, marketing, finance };
const demandees = process.argv.slice(2);
for (const [nom, f] of Object.entries(FAMILLES)) {
  if (demandees.length && !demandees.includes(nom)) continue;
  process.stdout.write(`${nom}… `);
  await f();
  console.log('ok');
}
console.log(`${ecrits} enregistrement(s) écrit(s).`);
