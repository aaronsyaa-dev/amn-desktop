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

const FAMILLES = { guichet };
const demandees = process.argv.slice(2);
for (const [nom, f] of Object.entries(FAMILLES)) {
  if (demandees.length && !demandees.includes(nom)) continue;
  process.stdout.write(`${nom}… `);
  await f();
  console.log('ok');
}
console.log(`${ecrits} enregistrement(s) écrit(s).`);
