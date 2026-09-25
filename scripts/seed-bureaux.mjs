#!/usr/bin/env node
/**
 * LE JEU DE DÉMONSTRATION DES BUREAUX DE SUPERVISION (cahiers 11 à 16).
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Écrit, dans le tenant d'AMN DevSec d'un amn-api de DÉMONSTRATION, de quoi
 * remplir les cinq bureaux : les contrôles de posture et l'inventaire de
 * Cyber, les relevés quotidiens (tendances, courbes), les pièces de Studio,
 * les campagnes, le calendrier et le mur de Stratégie, les dossiers, groupes
 * et automatisations de Supervisor.
 *
 * Les données se RECOUPENT d'un bureau à l'autre, comme le demande le paquet
 * (`BUREAUX.md` §6) : Le Jardin d'Élise n'est suivie par personne et a perdu
 * des points en une semaine ; Boulangerie Keller a laissé un retour que
 * Mohamed doit traiter ; Maison Oré attend l'appel de Riyad. Les noms sont
 * pris parmi les organisations qui existent déjà sur le serveur ; à défaut,
 * les premières venues.
 *
 * Identifiants fixes (`bx-…`) : relancer le script remet le jeu en état,
 * sans doublon. Refuse tout compte qui n'est pas un compte d'essai.
 *
 *   AMN_API=http://127.0.0.1:8791 AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… node scripts/seed-bureaux.mjs
 */

const API = (process.env.AMN_API ?? 'http://127.0.0.1:8791').replace(/\/$/, '');
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

const login = await fetch(`${API}/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: MOT_DE_PASSE }) });
if (!login.ok) {
  console.error(`Connexion refusée : ${login.status} ${await login.text()}`);
  process.exit(1);
}
const { token } = await login.json();
const H = { 'content-type': 'application/json', authorization: `Bearer ${token}` };

const JOUR = 86_400_000;
const MAINTENANT = Date.now();
const le = (jours, h = 10, m = 0) => {
  const d = new Date(MAINTENANT - jours * JOUR);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const jour = (jours) => {
  const d = new Date(MAINTENANT - jours * JOUR);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let ecrits = 0;
async function poser(collection, id, data) {
  for (let essai = 0; essai < 6; essai += 1) {
    const res = await fetch(`${API}/v1/collections/${collection}/${encodeURIComponent(id)}`, { method: 'PUT', headers: H, body: JSON.stringify({ data }) });
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

/* ── Les organisations du serveur ─────────────────────────────────────── */
const r = await fetch(`${API}/v1/admin/organizations`, { headers: H });
if (!r.ok) {
  console.error(`Liste des organisations refusée : ${r.status}. Le compte doit être un compte interne d'AMN DevSec.`);
  process.exit(1);
}
const { organizations } = await r.json();
const clientes = organizations.filter((o) => o.name !== 'AMN DevSec');
const devsec = organizations.find((o) => o.name === 'AMN DevSec');
const pris = new Set();
/** L'organisation de ce nom si elle existe, sinon la première pas encore employée. */
const org = (nom) => {
  const o = clientes.find((x) => x.name === nom && !pris.has(x.id)) ?? clientes.find((x) => !pris.has(x.id));
  if (o) pris.add(o.id);
  return o ?? devsec;
};
const JARDIN = org('Le Jardin d’Élise');
const SYRA = org('Syraagensy');
const ARNOUX = org('Cabinet Arnoux');
const VERMEIL = org('Atelier Vermeil');
const NORD = org('Studio Nord');
const KELLER = org('Boulangerie Keller');
const BERTAUX = org('Maison Bertaux');
const HALLES = org('Les Halles');
const MARCHETTI = org('Plomberie Marchetti');
const VERNET = org('Groupe Vernet');
const PARC = [JARDIN, SYRA, ARNOUX, VERMEIL, NORD, KELLER, BERTAUX, HALLES, MARCHETTI, VERNET].filter(Boolean);
console.log(`Parc de démonstration : ${PARC.map((o) => o.name).join(', ')}.`);

const EQUIPE = { harun: EMAIL, mohamed: 'second@exemple.test', riyad: EMAIL };

/* ── Cyber : les contrôles de posture ─────────────────────────────────── */
const C = (etat, source = 'releve', note) => ({ etat, source, at: le(1, 3, 12), ...(note ? { note } : {}) });
const posture = {
  [JARDIN.id]: { certificats: C('partiel', 'releve', 'jardin-elise.fr expire samedi'), courriel: C('non_conforme', 'releve', 'SPF absent sur le domaine'), mfa: C('non_conforme', 'desktop', 'deux comptes sans double authentification'), sauvegardes: C('conforme'), mises_a_jour: C('partiel', 'desktop'), exposition: C('conforme'), fuites: C('conforme'), journalisation: C('conforme', 'declare') },
  [SYRA.id]: { certificats: C('conforme'), courriel: C('conforme'), mfa: C('partiel', 'desktop'), sauvegardes: C('conforme', 'declare'), mises_a_jour: C('conforme', 'desktop'), exposition: C('conforme'), fuites: C('conforme'), journalisation: C('partiel', 'declare') },
  [ARNOUX.id]: { certificats: C('conforme'), courriel: C('partiel'), mfa: C('non_conforme', 'desktop', 'aucun compte en double authentification'), sauvegardes: C('conforme', 'declare'), mises_a_jour: C('partiel', 'desktop'), exposition: C('conforme'), fuites: C('non_conforme', 'releve', 'deux adresses dans une fuite publique'), journalisation: C('conforme', 'declare') },
  [VERMEIL.id]: { certificats: C('conforme'), courriel: C('conforme'), mfa: C('conforme', 'desktop'), sauvegardes: C('conforme', 'declare'), mises_a_jour: C('conforme', 'desktop'), exposition: C('conforme'), fuites: C('conforme'), journalisation: C('partiel', 'declare') },
  [NORD.id]: { certificats: C('conforme'), courriel: C('non_conforme', 'releve', 'DMARC absent'), mfa: C('partiel', 'desktop'), sauvegardes: C('partiel', 'declare'), mises_a_jour: C('conforme', 'desktop'), exposition: C('conforme'), fuites: C('conforme'), journalisation: C('conforme', 'declare') },
  [KELLER.id]: { certificats: C('conforme'), courriel: C('conforme'), mfa: C('non_conforme', 'desktop'), sauvegardes: C('conforme', 'declare'), mises_a_jour: C('conforme', 'desktop'), exposition: C('partiel', 'releve', 'port d’administration ouvert'), fuites: C('conforme'), journalisation: C('conforme', 'declare') },
  [BERTAUX.id]: { certificats: C('conforme'), courriel: C('conforme'), mfa: C('conforme', 'desktop'), sauvegardes: C('conforme', 'declare'), mises_a_jour: C('partiel', 'desktop'), exposition: C('conforme'), fuites: C('conforme'), journalisation: C('conforme', 'declare') },
  [HALLES.id]: { certificats: C('conforme'), courriel: C('partiel'), mfa: C('non_conforme', 'desktop'), sauvegardes: C('conforme', 'declare'), mises_a_jour: C('conforme', 'desktop'), exposition: C('conforme'), fuites: C('conforme'), journalisation: C('conforme', 'declare') },
  [devsec.id]: { certificats: C('conforme'), courriel: C('conforme'), mfa: C('partiel', 'desktop'), sauvegardes: C('conforme', 'declare'), mises_a_jour: C('non_conforme', 'desktop'), exposition: C('conforme'), fuites: C('partiel'), journalisation: C('conforme', 'declare') },
};
if (MARCHETTI) posture[MARCHETTI.id] = { certificats: C('conforme'), courriel: C('conforme'), mfa: C('conforme', 'desktop'), sauvegardes: C('conforme', 'declare'), mises_a_jour: C('conforme', 'desktop'), exposition: C('conforme'), fuites: C('conforme'), journalisation: C('conforme', 'declare') };
for (const [id, controles] of Object.entries(posture)) await poser('postureControles', id, { controles });

/* ── Les relevés quotidiens : la mémoire des tendances ────────────────── */
const VALEUR = { conforme: 1, partiel: 0.5, non_conforme: 0, critique: 0 };
const scoreDe = (c) => Math.round((100 * Object.values(c).reduce((s, x) => s + VALEUR[x.etat], 0)) / Object.values(c).length);
const derive = { [JARDIN.id]: 9, [ARNOUX.id]: 4, [NORD.id]: -2, [SYRA.id]: -3, [BERTAUX.id]: 0, [KELLER.id]: 1, [HALLES.id]: -1, [VERMEIL.id]: 0, [devsec.id]: 4 };
for (let j = 1; j <= 56; j += 1) {
  // Chaque jour du dernier mois, puis un par semaine au-delà.
  if (j > 30 && j % 7) continue;
  const orgs = {};
  for (const o of [...PARC, devsec]) {
    const c = posture[o.id];
    const base = c ? scoreDe(c) : null;
    const pente = derive[o.id] ?? 0;
    const score = base === null ? null : Math.max(0, Math.min(100, base + Math.round((pente * Math.min(j, 7)) / 7 + (j > 7 ? (j - 7) / 9 : 0) * Math.sign(pente || 1) * 0)));
    const derniere = o.lastActivityAt ? Date.parse(o.lastActivityAt) : null;
    // Le silence de ce jour-là : Syraagensy n'ouvre plus depuis trois semaines, Les Halles s'est tue dix jours le mois dernier.
    const silence = o.id === SYRA.id ? 21 - j : o.id === HALLES.id ? (j >= 12 && j <= 24 ? 24 - j : 0) : derniere ? Math.max(0, Math.floor((MAINTENANT - j * JOUR - derniere) / JOUR)) : null;
    orgs[o.id] = { poids: o.id === JARDIN.id ? 8 : 0, points: o.id === JARDIN.id && j <= 3 ? { jeton: 1, demande: 2 } : {}, score, suivi: o.id === JARDIN.id ? 'personne' : 'rien', enPanne: (o.id === ARNOUX.id && (j === 3 || j === 17)) || (o.id === KELLER.id && j === 11), silenceJ: silence === null ? null : Math.max(0, silence), actif: true };
  }
  await poser('parcReleves', jour(j), { jour: jour(j), at: le(j, 7), orgs });
}

/* ── Cyber : l'inventaire, les secrets, les playbooks, le carnet ──────── */
const actifs = [
  [JARDIN, 'domaine', 'jardin-elise.fr', 'releve', { echeance: jour(-160), echeanceType: 'domaine', renouvelleSeul: true }],
  [JARDIN, 'site', 'Boutique jardin-elise.fr', 'releve'],
  [JARDIN, 'certificat', 'jardin-elise.fr', 'releve', { echeance: jour(-2), echeanceType: 'certificat', renouvelleSeul: false }],
  [JARDIN, 'compte', 'elise@jardin-elise.fr', 'desktop', { defaut: 'sans double authentification' }],
  [JARDIN, 'compte', 'boutique@jardin-elise.fr', 'desktop', { defaut: 'sans double authentification' }],
  [JARDIN, 'compte', 'compta@jardin-elise.fr', 'desktop'],
  [JARDIN, 'poste', 'Portable de la boutique', 'desktop', { defaut: 'mises à jour en retard de 19 jours' }],
  [JARDIN, 'poste', 'Caisse', 'desktop'],
  [JARDIN, 'sauvegarde', 'Sauvegarde nuit · boutique', 'declare', { echeance: jour(-45), echeanceType: 'licence', renouvelleSeul: true }],
  [VERMEIL, 'sauvegarde', 'Licence de sauvegarde', 'declare', { echeance: jour(-7), echeanceType: 'licence', renouvelleSeul: false }],
  [ARNOUX, 'domaine', 'arnoux-avocats.fr', 'releve', { echeance: jour(-12), echeanceType: 'domaine', renouvelleSeul: false }],
  [NORD, 'domaine', 'studio-nord.fr', 'releve', { echeance: jour(-70), echeanceType: 'domaine', renouvelleSeul: true }],
  [BERTAUX, 'compte', 'Microsoft 365 · 6 licences', 'declare', { echeance: jour(-38), echeanceType: 'renouvellement', renouvelleSeul: true }],
  [HALLES, 'compte', 'Logiciel de caisse · abonnement', 'declare', { echeance: jour(-24), echeanceType: 'renouvellement', renouvelleSeul: false }],
  [KELLER, 'poste', 'Tablette de commande', 'desktop'],
];
let n = 0;
for (const [o, famille, nom, source, extra = {}] of actifs) await poser('inventaire', `bx-actif-${n++}`, { orgId: o.id, famille, nom, source, at: le(1, 3, 20), ...extra });

const secrets = [
  [JARDIN, 'Clé API de la boutique', 'API', 170, 180],
  [ARNOUX, 'Mot de passe du compte de service', 'compte technique', 92, 90],
  [NORD, 'Jeton de déploiement', 'jeton', 20, 90],
];
n = 0;
for (const [o, nom, type, age, periode] of secrets) await poser('rotationsSecrets', `bx-secret-${n++}`, { orgId: o.id, nom, type, derniereRotation: le(age), periodeJours: periode, par: EQUIPE.harun });

const playbooks = [
  ['Compte compromis', 'Quand un compte d’une cliente se connecte d’où il ne devrait pas.', ['Fermer les sessions ouvertes', 'Réinitialiser le mot de passe', ['Si un export est suspect : bloquer les exports et prévenir la cliente', true], 'Activer la double authentification', 'Relire le journal des 7 derniers jours', 'Rédiger le compte rendu']],
  ['Site injoignable', 'Quand un site d’une cliente ne répond plus.', ['Vérifier depuis deux endroits', 'Consulter l’hébergeur', ['Si le certificat a expiré : le renouveler', true], 'Prévenir la cliente', 'Clore après 30 minutes de stabilité']],
  ['Certificat qui expire', 'Moins de 14 jours avant l’échéance d’un certificat sans renouvellement automatique.', ['Identifier qui le renouvelle', 'Renouveler', 'Vérifier la chaîne complète']],
  ['Hameçonnage signalé', 'Un courriel suspect signalé par une cliente.', ['Récupérer le courriel d’origine', 'Bloquer l’expéditeur', ['Si quelqu’un a cliqué : suivre « Compte compromis »', true], 'Rappeler la consigne à l’équipe cliente']],
  ['Sauvegarde manquée', 'Une nuit sans sauvegarde réussie.', ['Relancer la sauvegarde', 'Vérifier l’espace disponible', 'Tester une restauration']],
];
n = 0;
for (const [nom, description, etapes] of playbooks) {
  await poser('playbooks', `bx-pb-${n}`, {
    nom,
    description,
    etapes: etapes.map((e, i) => (Array.isArray(e) ? { id: `e${i}`, texte: e[0].replace(/^Si [^:]+: /, ''), si: e[0].match(/^Si [^:]+/)?.[0] ?? null } : { id: `e${i}`, texte: e, si: null })),
    creePar: EQUIPE.harun,
    at: le(120),
  });
  n += 1;
}
await poser('playbookRuns', 'bx-run-0', { playbookId: 'bx-pb-0', orgId: JARDIN.id, incidentId: null, lancePar: EQUIPE.harun, lanceLe: le(0, 9, 30), faites: {} });
await poser('playbookRuns', 'bx-run-1', { playbookId: 'bx-pb-1', orgId: ARNOUX.id, incidentId: null, lancePar: EQUIPE.harun, lanceLe: le(12, 16, 2), faites: { e0: le(12, 16, 4), e1: le(12, 16, 10), e3: le(12, 16, 20), e4: le(12, 16, 50) }, closLe: le(12, 16, 55) });

const carnet = [
  ['Le certificat de jardin-elise.fr est renouvelé à la main par leur ancien prestataire. Qui a encore l’accès ?', [['cliente', JARDIN.id, JARDIN.name], ['actif', 'bx-actif-2', 'jardin-elise.fr']], false, false, 1],
  ['Les tentatives de connexion viennent toutes du même hébergeur. Bloqué au niveau du pare-feu.', [['cliente', ARNOUX.id, ARNOUX.name]], false, false, 3],
  ['DMARC ajouté chez Studio Nord en mode surveillance. Passer en rejet dans deux semaines.', [['cliente', NORD.id, NORD.name], ['campagne', 'bx-camp-rentree', 'Rentrée cyber']], false, false, 6],
  ['La double authentification est refusée par la caissière de Boulangerie Keller : prévoir une clé physique.', [['cliente', KELLER.id, KELLER.name]], false, false, 9],
];
n = 0;
for (const [texte, liens, question, resolue, age] of carnet) await poser('carnet', `bx-note-${n++}`, { texte, liens: liens.map(([type, id, label]) => ({ type, id, label })), question, resolue, par: EQUIPE.harun, at: le(age, 11) });

const moisPasse = (() => { const d = new Date(MAINTENANT); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
for (const o of [JARDIN, SYRA, ARNOUX, VERMEIL, NORD]) {
  const c = posture[o.id];
  await poser('rapportsPosture', `bx-rapport-${o.id}-${moisPasse}`, { orgId: o.id, mois: moisPasse, score: c ? scoreDe(c) : null, courbe: [], aFaire: [], envoyeLe: `${moisPasse}-01T08:00:00.000Z`, par: EQUIPE.harun });
}
await poser('hameconnages', 'bx-hame-0', { orgId: BERTAUX.id, titre: 'Sensibilisation de l’équipe de Maison Bertaux', date: jour(-9), accordPar: 'la gérante, par courriel', cibles: 6, cliques: null, signales: null, notes: 'Exercice mené par le prestataire de sensibilisation choisi par la cliente ; AMN en suit les chiffres.', par: EQUIPE.harun });
await poser('hameconnages', 'bx-hame-1', { orgId: ARNOUX.id, titre: 'Rappel après la fuite de deux adresses', date: jour(30), accordPar: 'Maître Arnoux', cibles: 4, cliques: 1, signales: 3, par: EQUIPE.harun });
await poser('exercicesCrise', 'bx-crise-0', { orgId: HALLES.id, scenario: 'Le logiciel de caisse ne démarre plus un samedi matin.', date: jour(-3), etapes: [{ id: 'a', texte: 'Qui appelle-t-on en premier ?' }, { id: 'b', texte: 'Où est la procédure de caisse manuelle ?' }, { id: 'c', texte: 'Restaurer la dernière sauvegarde sur le poste de secours' }, { id: 'd', texte: 'Faire le point avec la gérante' }], par: EQUIPE.harun });

/* ── Supervisor : dossiers, groupes, suivis, automatisations ──────────── */
const dossiers = [
  [JARDIN, 'Lyon', 'Fleuriste', 'Commerces de la Croix-Rousse', { nom: 'Élise Martin', role: 'gérante', email: 'elise@jardin-elise.test' }],
  [SYRA, 'Lyon', 'Agence de communication', 'Agences', { nom: 'Nadia Syra', role: 'fondatrice' }],
  [ARNOUX, 'Villeurbanne', 'Cabinet d’avocats', 'Professions libérales', { nom: 'Maître Arnoux', role: 'associé' }],
  [VERMEIL, 'Lyon', 'Atelier d’encadrement', 'Commerces de la Croix-Rousse', { nom: 'Paul Vermeil', role: 'artisan' }],
  [NORD, 'Lille', 'Studio photo', 'Agences', { nom: 'Inès Nord', role: 'photographe' }],
  [KELLER, 'Lyon', 'Boulangerie', 'Commerces de la Croix-Rousse', { nom: 'Marc Keller', role: 'boulanger' }],
  [BERTAUX, 'Annecy', 'Maison d’hôtes', null, { nom: 'Claire Bertaux', role: 'gérante' }],
  [HALLES, 'Lyon', 'Épicerie fine', null, { nom: 'Sami Haddad', role: 'gérant' }],
];
for (const [o, ville, metier, groupe, contact] of dossiers) {
  const base = { ville, metier, ...(groupe ? { groupe } : {}), ...(contact ? { contact } : {}), updatedBy: EQUIPE.harun };
  if (o.id === JARDIN.id) {
    Object.assign(base, {
      notes: [
        { id: 'n1', texte: 'Ne répond qu’au téléphone, le matin avant 10 h.', par: EQUIPE.mohamed, at: le(40) },
        { id: 'n2', texte: 'Son neveu gère la boutique en ligne : c’est lui qui a les accès.', par: EQUIPE.harun, at: le(12) },
      ],
      echanges: [
        { id: 'x1', sens: 'recu', resume: 'Demande deux places de plus pour la saison.', par: 'elise@jardin-elise.test', at: le(0, 7, 10) },
        { id: 'x2', sens: 'envoye', resume: 'Rappel sur la double authentification.', par: EQUIPE.harun, at: le(9) },
      ],
      modules: {
        stock: { etat: 'pause', raison: 'l’export plantait chez elle seule', par: EQUIPE.harun, depuis: le(2) },
        invoices: { etat: 'epinglee', version: 'v3.1', raison: 'la v3.2 change l’ordre des colonnes', par: EQUIPE.mohamed, depuis: le(6) },
      },
    });
  }
  await poser('orgDossier', o.id, base);
}
for (const o of [SYRA, ARNOUX, VERMEIL, NORD, KELLER, BERTAUX, HALLES, MARCHETTI, VERNET, devsec].filter(Boolean)) {
  await poser('suivis', `org:${o.id}`, { par: o.id === SYRA.id || o.id === NORD.id ? EQUIPE.mohamed : EQUIPE.harun, at: le(o.id === devsec.id ? 0 : 5, 9, 12) });
}
await poser('suivis', `org:${JARDIN.id}`, { par: EQUIPE.harun, at: le(30), relache: true });

await poser('parcRegles', 'bx-regle-0', { nom: 'Desktop fermé 10 jours', sujet: 'organisation', condition: 'silence', duree: 10, action: 'tache_relance', pourQui: 'suivi', sauf: 'arrivee', active: false, creePar: EQUIPE.riyad, creeLe: le(1) });
await poser('parcRegles', 'bx-regle-1', { nom: 'Jeton de places demandé', sujet: 'jeton', condition: 'attend', duree: 1, action: 'prevenir', pourQui: 'suivi', sauf: 'rien', active: true, creePar: EQUIPE.harun, creeLe: le(30) });
await poser('parcRegles', 'bx-regle-2', { nom: 'Posture −5 en 7 jours', sujet: 'posture', condition: 'baisse', duree: 7, action: 'carnet', pourQui: 'suivi', sauf: 'incident', active: true, creePar: EQUIPE.harun, creeLe: le(20) });
await poser('parcRegles', 'bx-regle-3', { nom: 'Personne sur une organisation', sujet: 'organisation', condition: 'sans_personne', duree: 2, action: 'prevenir', pourQui: EQUIPE.harun, sauf: 'garde', active: true, creePar: EQUIPE.harun, creeLe: le(45) });
for (let j = 1; j <= 30; j += 1) {
  if (j % 6 === 0) await poser('parcDeclenchements', `bx-regle-0:${ARNOUX.id}:${jour(j)}`, { regleId: 'bx-regle-0', orgId: ARNOUX.id, jour: jour(j), at: le(j, 7), quoi: 'tâche de rappel créée', suite: j > 12 ? 'fait' : 'en cours' });
  if (j % 9 === 0) await poser('parcDeclenchements', `bx-regle-1:${KELLER.id}:${jour(j)}`, { regleId: 'bx-regle-1', orgId: KELLER.id, jour: jour(j), at: le(j, 7), quoi: 'prévenu', suite: j > 20 ? 'sans suite' : 'fait' });
}

/* ── Studio : les douze pièces ────────────────────────────────────────── */
const pieces = [
  [1, NORD, 'Site vitrine', 'en_ligne'],
  [2, JARDIN, 'Boutique', 'chantier'],
  [3, SYRA, 'Application', 'attente', 'valider les maquettes de l’accueil'],
  [4, HALLES, 'Site', 'en_ligne'],
  [5, ARNOUX, 'Site', 'chantier'],
  [6, KELLER, 'Commande en ligne', 'retour'],
  [7, VERMEIL, 'Portfolio', 'en_ligne'],
  [8, BERTAUX, 'Site', 'en_ligne'],
  [9, devsec, 'Site', 'en_ligne'],
  [10, JARDIN, 'Journal', 'attente', 'fournir les textes du journal'],
  [11, NORD, 'Réservation', 'chantier'],
  [12, ARNOUX, 'Espace client', 'attente', 'choisir entre deux menus'],
];
for (const [numero, o, quoi, etat, question] of pieces) {
  const p = { numero, orgId: o.id, orgNom: o.name, quoi };
  if (etat === 'en_ligne' || etat === 'retour') p.enLigneLe = le(40 + numero);
  if (etat === 'chantier') p.chantier = true;
  if (etat === 'attente') {
    p.enLigneLe = numero === 12 ? null : le(20);
    p.chantier = numero !== 3;
    p.validation = { question, ouverteLe: le(3 + numero / 3) };
  }
  if (numero === 4) p.livraison = { version: '2.4', points: [], misesEnLigne: [{ version: '2.2', at: le(19, 10), par: EQUIPE.mohamed, quoi: 'Galerie' }, { version: '2.3', at: le(3, 11), par: EQUIPE.mohamed, quoi: 'Formulaire de réservation' }] };
  if (numero === 8) p.livraison = { version: '1.4', points: [], misesEnLigne: [{ version: '1.3', at: le(2, 15), par: EQUIPE.mohamed, quoi: 'Correctif du formulaire' }] };
  if (numero === 1) p.livraison = { version: '1.3', points: [], misesEnLigne: [{ version: '1.2', at: le(1, 10), par: EQUIPE.mohamed, quoi: 'Page Tarifs' }] };
  if (numero === 9) p.livraison = { version: '1.1', points: [], misesEnLigne: [{ version: '1.0', at: le(0, 9), par: EQUIPE.mohamed, quoi: 'Première mise en ligne' }] };
  if (etat === 'retour') {
    p.retours = [
      { id: 'r1', texte: 'le créneau du samedi n’apparaît pas', page: 'Commande', at: new Date(MAINTENANT - 2 * 3_600_000).toISOString(), par: 'marc@keller.test', x: 62, y: 34 },
      { id: 'r2', texte: 'mettre la photo de la vitrine plus haut', page: 'Commande', at: new Date(MAINTENANT - 40 * 60_000).toISOString(), par: 'marc@keller.test', x: 30, y: 72 },
      { id: 'r0', texte: 'mettre le pain au levain en premier', page: 'Accueil', at: le(9), par: 'marc@keller.test', traiteLe: le(8), reponse: 'C’est fait : le levain ouvre la page.' },
    ];
    p.croquis = [
      { id: 'c1', titre: 'Maquette · page Commande', genre: 'maquette', legende: 'v3, validée le 12', rot: -1, punaises: [{ n: 1, x: 62, y: 38, texte: 'Le créneau du samedi : afficher 7 h – 12 h ou fermer la journée ?', decision: true }, { n: 2, x: 24, y: 70, texte: 'Le bouton passe sous la liste sur téléphone.' }] },
      { id: 'c2', titre: 'Croquis · le panier', genre: 'croquis', legende: 'au crayon, réunion du 3', rot: 1.1, punaises: [{ n: 3, x: 50, y: 30, texte: 'Le total reste visible en bas.' }] },
      { id: 'c3', titre: 'Capture · l’ancienne page', genre: 'capture', legende: 'avant refonte', rot: -0.6 },
      { id: 'c4', titre: 'Inspiration · boulangerie de quartier', genre: 'inspiration', legende: 'les photos en pleine largeur', rot: 0.8 },
    ];
    p.prompts = [
      { id: 'pr1', nom: 'Fiche produit', categorie: 'Produits', versions: [
        { v: 1, texte: 'Écris une fiche produit pour {produit}.', resultat: 'Un bon pain, fait avec amour.', at: le(30), par: EQUIPE.mohamed },
        { v: 2, texte: 'Écris une fiche produit de 40 mots pour {produit}, ton chaleureux, sans superlatif.', resultat: 'Pain de campagne au levain, croûte épaisse, mie ouverte. Il se garde quatre jours.', at: le(24), par: EQUIPE.mohamed },
        { v: 3, texte: 'Écris une fiche produit de 40 mots pour {produit}, ton chaleureux, sans superlatif. Termine par les allergènes, en une ligne.', resultat: 'Pain de campagne au levain, croûte épaisse, mie ouverte. Il se garde quatre jours. Allergènes : gluten.', enLigne: true, at: le(18), par: EQUIPE.mohamed },
        { v: 4, texte: 'Écris une fiche produit de 40 mots pour {produit}, ton chaleureux, sans superlatif. Termine par les allergènes et le prix au kilo.', resultat: 'Pain de campagne au levain, croûte épaisse. Allergènes : gluten. 6,80 € le kilo.', at: le(2), par: EQUIPE.mohamed },
      ] },
      { id: 'pr2', nom: 'Message de confirmation', categorie: 'Courriel', versions: [{ v: 1, texte: 'Confirme la commande {numero} pour {date}, retrait en boutique.', resultat: 'Votre commande n° 1042 vous attend samedi, dès 7 h, au comptoir.', enLigne: true, at: le(20), par: EQUIPE.mohamed }] },
      { id: 'pr3', nom: 'Textes alternatifs des photos', categorie: 'Accessibilité', versions: [
        { v: 1, texte: 'Décris cette photo.', resultat: 'trop vague', at: le(16), par: EQUIPE.mohamed },
        { v: 2, texte: 'Décris cette photo de boulangerie en 12 mots au plus, sans « image de ».', resultat: 'Pains au levain alignés sur une grille, croûte dorée, farine au bord.', enLigne: true, at: le(14), par: EQUIPE.mohamed },
      ] },
    ];
    p.notes = [{ id: 'nt1', texte: 'Le client préfère être appelé plutôt qu’écrit.', par: EQUIPE.mohamed, at: le(15) }];
    // Huit relevés, du plus récent au plus ancien : plus de visites, mais le chargement a pris 50 %.
    const semaines = [0, 7, 14, 21, 28, 35, 42, 49].map((j) => jour(j));
    const VISITES = [1482, 1361, 1402, 1290, 1335, 1254, 1301, 1188];
    const CONVERSIONS = [64, 58, 60, 55, 57, 52, 54, 49];
    const P75 = [3.3, 2.2, 2.1, 2.3, 2.2, 2.1, 2.2, 2.3];
    const DISPO = [99.94, 99.97, 99.98, 99.95, 99.99, 99.97, 99.96, 99.98];
    const ERREURS = [5, 4, 3, 4, 2, 3, 4, 3];
    const FORME = [0.13, 0.12, 0.15, 0.14, 0.15, 0.19, 0.12];
    p.mesures = semaines.map((s, i) => ({
      semaine: s,
      visites: VISITES[i],
      conversions: CONVERSIONS[i],
      p75: P75[i],
      dispo: DISPO[i],
      erreurs: ERREURS[i],
      jours: FORME.map((f, k) => Math.round(VISITES[i] * f * (1 + ((k + i) % 3) * 0.03))),
      ...(i === 0 ? { p75Mobile: 4.1, p75Bureau: 1.7, sources: [{ nom: 'Recherche', part: 44 }, { nom: 'Direct', part: 24 }, { nom: 'Instagram', part: 19 }, { nom: 'Lettre', part: 8 }, { nom: 'Autres', part: 5 }] } : {}),
    }));
    p.causes = { p75: 'Les photos de la nouvelle page Commande ne sont pas compressées : 4,2 Mo au lieu de 600 Ko.' };
    p.livraison = {
      version: '3.2',
      points: [
        { id: 'l1', texte: 'Compresser les images de la page Commande', bloquant: true, coche: false },
        { id: 'l2', texte: 'Créneau du samedi visible dans le calendrier', bloquant: true, coche: true },
        { id: 'l3', texte: 'Relire les textes avec le client', bloquant: false, coche: true },
        { id: 'l4', texte: 'Vérifier le panier sur téléphone', bloquant: false, coche: false },
      ],
      misesEnLigne: [
        { version: '2.9', at: le(61), par: EQUIPE.mohamed, quoi: 'Mentions légales' },
        { version: '3.0', at: le(40), par: EQUIPE.mohamed, quoi: 'Refonte de l’accueil' },
        { version: '3.1', at: le(5), par: EQUIPE.mohamed, quoi: 'Page Commande' },
      ],
    };
    p.budget = { plafondKo: 1500, pages: [{ page: 'Accueil', ko: 820 }, { page: 'Commande', ko: 4200 }, { page: 'Panier', ko: 640 }, { page: 'Contact', ko: 310 }] };
    p.recettes = [{ id: 'rc1', page: 'Commande', ecarts: ['Le bandeau des créneaux descend de 24 px', 'Le bouton « Commander » passe en deux lignes sur 390 px'], at: le(1), validee: false }];
    p.accessibilite = [
      { id: 'a1', critere: 'contraste', page: 'Commande', texte: 'Le prix au kilo en gris clair sur crème : 2,9:1.' },
      { id: 'a2', critere: 'alternative', page: 'Accueil', texte: 'Six photos sans texte alternatif.' },
      { id: 'a3', critere: 'clavier', page: 'Panier', texte: 'Le sélecteur de quantité ne se règle pas au clavier.', corrige: true },
    ];
  }
  await poser('studioPieces', `bx-piece-${numero}`, p);
}

/* ── Stratégie : prospects, campagnes, calendrier, mur, témoignages ───── */
const prospects = [
  ['bx-prospect-ore', 'Maison Oré', 'Nadia Oré', 'proposition', 18000, 'bouche', { secteur: 'Décoration', ville: 'Lyon 2ᵉ', role: 'gérante', telephone: '06 12 88 40 71', venuPar: 'Atelier Nord', prochaine: { quoi: 'appeler', at: le(0, 9), appel: true, detail: 'Elle a regardé la page Tarifs ce matin. Proposer un premier passage d’essai.' }, echanges: [
    { id: 'e1', type: 'envoi', texte: 'Devis envoyé · entretien mensuel de la vitrine, 180 € HT', at: le(3, 9, 10), par: EQUIPE.riyad },
    { id: 'e2', type: 'ouverture', texte: 'Devis ouvert', at: le(3, 18, 42) },
    { id: 'e3', type: 'ouverture', texte: 'Devis ouvert', at: le(1, 7, 55) },
    { id: 'e4', type: 'page', texte: 'Devis ouvert, page Tarifs consultée', at: le(0, 7, 30) },
    { id: 'e5', type: 'ouverture', texte: 'Devis ouvert', at: le(0, 7, 29) },
  ] }],
  ['bx-prospect-nord', 'Atelier Nord', 'Hugo Lambert', 'proposition', 26000, 'salon', { secteur: 'Menuiserie', ville: 'Lyon 7ᵉ', prochaine: { quoi: 'rendez-vous', at: le(-5, 10) }, echanges: [{ id: 'e1', type: 'rdv', texte: 'Rencontré au salon des artisans', at: le(12), par: EQUIPE.riyad }, { id: 'e2', type: 'envoi', texte: 'Devis envoyé · site et commande en ligne', at: le(6, 11), par: EQUIPE.riyad }] }],
  ['bx-prospect-voss', 'Galerie Voss', 'Ines Voss', 'proposition', 42000, 'site', { prochaine: { quoi: 'relancer', at: le(5, 9) }, echanges: [{ id: 'e1', type: 'envoi', texte: 'Devis envoyé', at: le(14), par: EQUIPE.riyad }, { id: 'e2', type: 'envoi', texte: 'Relance envoyée', at: le(5, 9), par: EQUIPE.riyad }] }],
  ['bx-prospect-luce', 'Café Luce', 'Paul Luce', 'proposition', 9000, 'bouche', { echanges: [{ id: 'e1', type: 'envoi', texte: 'Devis envoyé', at: le(4), par: EQUIPE.riyad }, { id: 'e2', type: 'ouverture', texte: 'Devis ouvert', at: le(3, 20) }] }],
  ['bx-prospect-lumiere', 'Lumière & Bois', 'Julie Rey', 'contact', 12000, 'site', { prochaine: { quoi: 'relancer', at: le(-1, 9) }, echanges: [{ id: 'e1', type: 'envoi', texte: 'Présentation envoyée', at: le(8), par: EQUIPE.riyad }] }],
  ['bx-prospect-sol', 'Épicerie Sol', 'Sami Sol', 'contact', 8000, 'salon', {}],
  ['bx-prospect-arnaud', 'Menuiserie Arnaud', 'Luc Arnaud', 'contact', 15000, 'bouche', {}],
  ['bx-prospect-quais', 'Librairie des Quais', 'Eva Martin', 'qualifie', 11000, 'site', { prochaine: { quoi: 'envoyer le devis', at: le(-2, 9) } }],
  ['bx-prospect-petit', 'Garage Petit', 'Marc Petit', 'qualifie', 16000, 'bouche', {}],
  ['bx-prospect-cave', 'La Cave du Parc', 'Louis Faure', 'qualifie', 31000, 'bouche', { prochaine: { quoi: 'relancer', at: le(0, 14) }, echanges: [{ id: 'e1', type: 'appel', texte: 'Premier appel : il veut une boutique de vins', at: le(10), par: EQUIPE.riyad }] }],
  ['bx-prospect-nove', 'Brasserie Nove', 'Léa Nove', 'gagne', 24000, 'bouche', { echanges: [{ id: 'e1', type: 'rdv', texte: 'Devis signé', at: le(6), par: EQUIPE.riyad }] }],
  ['bx-prospect-pressing', 'Pressing Lumière', 'Omar Haddad', 'gagne', 9500, 'site', {}],
];
for (const [id, company, name, stage, valueCents, source, extra] of prospects) {
  await poser('prospects', id, { name, company, valueCents, stage, note: '', source, createdAt: le(30), movedAt: stage === 'gagne' ? le(Math.min(3, new Date(MAINTENANT).getDate() - 1)) : le(4), campagneId: id === 'bx-prospect-ore' || id === 'bx-prospect-nord' ? 'bx-camp-automne' : null, ...extra });
}
await poser('campagnes', 'bx-camp-automne', {
  titre: 'Automne · commerces de proximité',
  etape: 'production',
  resultat: '3 visuels, 2 vidéos · sortie le ' + new Date(MAINTENANT + 7 * JOUR).getDate() + ' ' + ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][new Date(MAINTENANT + 7 * JOUR).getMonth()],
  bloquee: { raison: 'il manque le visuel du plan 4', depuis: le(2) },
  programmeeLe: le(-7, 9),
  prospects: ['bx-prospect-nord', 'bx-prospect-ore'],
  plans: [
    { id: 'p1', duree: 4, visuel: 'vitrine au petit matin', quoi: 'La rue s’éveille, les rideaux se lèvent.' },
    { id: 'p2', duree: 6, visuel: 'mains du boulanger', quoi: 'Le premier pain sort du four.' },
    { id: 'p3', duree: 5, visuel: 'fleuriste qui compose', quoi: 'Un bouquet pour quelqu’un du quartier.' },
    { id: 'p4', duree: 7, visuel: null, quoi: 'Le téléphone vibre : une commande arrive depuis le site.' },
    { id: 'p5', duree: 5, visuel: 'comptoir, sourire', quoi: 'La cliente récupère sa commande.' },
    { id: 'p6', duree: 3, visuel: 'logo AMN', quoi: 'Votre quartier, votre site.' },
  ],
  creePar: EQUIPE.riyad,
  at: le(20),
});
await poser('campagnes', 'bx-camp-temoignages', { titre: 'Témoignages clients', etape: 'publiee', resultat: '12 400 vues · diffusée depuis le ' + new Date(MAINTENANT - 14 * JOUR).getDate(), publieeLe: le(14), courbe: [800, 2100, 3900, 5600, 7400, 9100, 10800, 12400], creePar: EQUIPE.riyad, at: le(40) });
await poser('campagnes', 'bx-camp-rentree', { titre: 'Rentrée cyber', etape: 'idee', resultat: 'À scénariser avec Harun', creePar: EQUIPE.riyad, at: le(3) });
await poser('campagnes', 'bx-camp-lettre', { titre: 'Lettre de septembre', etape: 'close', rapporte: '2 rendez-vous, 1 devis signé', publieeLe: le(25), courbe: [0, 310, 420, 455], creePar: EQUIPE.riyad, at: le(35) });
await poser('campagnes', 'bx-camp-scenario', { titre: 'Portraits d’artisans', etape: 'scenario', resultat: 'trois portraits, 45 s chacun', creePar: EQUIPE.riyad, at: le(8) });
await poser('campagnes', 'bx-camp-portes', { titre: 'Portes ouvertes du printemps', etape: 'idee', creePar: EQUIPE.riyad, at: le(23) });
await poser('campagnes', 'bx-camp-rentree-passee', { titre: 'Rentrée de l’an dernier', etape: 'close', rapporte: '4 devis issus', publieeLe: le(380), creePar: EQUIPE.riyad, at: le(400) });
// Le calendrier : le mois en cours, et la publication du jour qui attend une validation.
const aujourdHui = new Date(MAINTENANT);
const quantieme = aujourdHui.getDate();
const dansLeMois = (q) => q >= 1 && q <= new Date(aujourdHui.getFullYear(), aujourdHui.getMonth() + 1, 0).getDate();
const pubs = [
  [1, 'LI', 'Rentrée : ce qui change pour les commerces', 4.2],
  [2, 'IG', 'Coulisses du tournage', 3.4],
  [3, 'FB', 'Le marché du samedi', 1.1],
  [6, 'IG', 'Portrait : Cabinet Arnoux', 2.9],
  [8, 'LI', 'Cinq questions à une fleuriste', 5.3],
  [10, 'IG', 'Le four du matin', 3.1],
  [11, 'FB', 'Témoignage : Cabinet Arnoux', 1.3],
  [13, 'IG', 'Avant, après : la vitrine', 2.6],
  [15, 'LI', 'Pourquoi un site de quartier', 4.9],
  [16, 'NL', 'Lettre de septembre', 38],
  [17, 'IG', 'Trois commerces, une rue', 3.3],
  [20, 'IG', 'La commande du samedi', 3.0],
  [22, 'LI', 'Ce que disent nos clientes', 4.6],
  [24, 'IG', 'Les mains du boulanger', 3.2],
];
n = 0;
for (const [q, canal, titre, engagement] of pubs) {
  if (!dansLeMois(q) || q >= quantieme) continue;
  await poser('publications', `bx-pub-${n++}`, { jour: jour(quantieme - q), canal, titre, etat: 'publiee', engagement, par: EQUIPE.riyad });
}
const aVenir = [
  [0, 'LI', 'Trois commerces du quartier nous racontent leur rentrée', 'a_valider', '18:00', 'Le texte est prêt, l’image attend votre accord.', 'bx-camp-automne'],
  [0, 'IG', 'Le four du matin, en vidéo', 'programmee', '12:00', null, null],
  [1, 'FB', 'Automne : le quartier se prépare', 'programmee', '09:00', null, 'bx-camp-automne'],
  [2, 'IG', 'Le marché du samedi', 'programmee', '10:00', null, null],
];
for (const [dans, canal, titre, etat, heure, note, campagneId] of aVenir) {
  if (!dansLeMois(quantieme + dans)) continue;
  await poser('publications', `bx-pub-${n++}`, { jour: jour(-dans), canal, titre, etat, heure, note, campagneId, par: EQUIPE.riyad });
}
await poser('temoignages', 'bx-temo-arnoux', { orgId: ARNOUX.id, auteur: ARNOUX.name, texte: 'On a enfin un site qui nous ressemble, et quelqu’un qui répond.', accord: 'oui', campagnes: ['bx-camp-temoignages'], at: le(30) });
await poser('temoignages', 'bx-temo-keller', { orgId: KELLER.id, auteur: KELLER.name, texte: 'Les commandes du samedi ont doublé.', accord: 'en_attente', campagnes: [], at: le(5) });
await poser('strategieMur', 'bx-chiffre-ouverture', { type: 'chiffre', valeur: '38 %', libelle: 'd’ouverture pour la lettre de septembre', campagneId: 'bx-camp-temoignages', x: 62, y: 250, rot: 1.5 });
await poser('strategieMur', 'bx-chiffre-objectifs', { type: 'chiffre', valeur: '4 / 12', libelle: 'objectifs du trimestre atteints', campagneId: 'bx-camp-rentree', x: 80, y: 238, rot: -1 });
await poser('strategieMur', 'bx-q-commande', { type: 'question', texte: 'Les commerces de quartier veulent-ils commander en ligne, ou seulement être trouvés ?', echeance: jour(0), verdict: null, x: 0, y: 0, rot: 0, par: EQUIPE.riyad, at: le(20) });
await poser('strategieMur', 'bx-i-keller', { type: 'indice', questionId: 'bx-q-commande', sens: 'pour', texte: 'Les commandes du samedi ont doublé chez Keller depuis la commande en ligne.', source: 'Boulangerie Keller, relevé de septembre', x: 0, y: 0, rot: 0, par: EQUIPE.riyad, at: le(6) });
await poser('strategieMur', 'bx-i-ore', { type: 'indice', questionId: 'bx-q-commande', sens: 'contre', texte: 'Maison Oré veut d’abord qu’on la trouve sur une carte ; la commande viendra après.', source: 'entretien, Maison Oré', x: 0, y: 0, rot: 0, par: EQUIPE.riyad, at: le(3) });
await poser('strategieMur', 'bx-i-salon', { type: 'indice', questionId: 'bx-q-commande', sens: 'neutre', texte: 'Au salon, sur 14 artisans, 9 ont demandé « combien ça coûte » avant « qu’est-ce que ça fait ».', source: 'salon des artisans', x: 0, y: 0, rot: 0, par: EQUIPE.riyad, at: le(12) });
await poser('strategieMur', 'bx-q-lettre', { type: 'question', texte: 'Une lettre par mois suffit-elle, ou faut-il passer à deux ?', echeance: jour(-20), verdict: null, x: 0, y: 0, rot: 0, par: EQUIPE.riyad, at: le(8) });
await poser('strategieMur', 'bx-i-ouverture', { type: 'indice', questionId: 'bx-q-lettre', sens: 'pour', texte: '38 % d’ouverture pour la lettre de septembre, contre 31 % en août.', source: 'Lettre de septembre', x: 0, y: 0, rot: 0, par: EQUIPE.riyad, at: le(8) });
await poser('strategieMur', 'bx-q-prix', { type: 'question', texte: 'Afficher les prix sur le site public ?', echeance: jour(30), verdict: 'Oui, une fourchette par formule : les devis ouverts trois fois sans réponse le demandaient.', x: 0, y: 0, rot: 0, par: EQUIPE.riyad, at: le(40) });
await poser('strategieMur', 'bx-note-1', { type: 'note', texte: 'Les fleuristes demandent toutes la même chose : le retrait en boutique, avec un créneau.', x: 0, y: 0, rot: -1.2, par: EQUIPE.riyad, at: le(4) });
await poser('strategieMur', 'bx-note-2', { type: 'note', texte: '« Je ne veux pas un site, je veux qu’on me trouve. » — une cliente au salon.', x: 0, y: 0, rot: 0.8, par: EQUIPE.riyad, at: le(9) });
await poser('strategieMur', 'bx-note-3', { type: 'note', texte: 'Vérifier : les avis Google comptent-ils plus que le site pour un commerce de quartier ?', x: 0, y: 0, rot: 1.4, par: EQUIPE.mohamed, at: le(2) });
{
  const periode = new Date(MAINTENANT).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  await poser('objectives', 'obj-revenue', { label: 'Chiffre d’affaires visé', unit: '€', targetValue: 6000, currentValue: Math.round((6000 * quantieme) / 30 / 100) * 100 + 400, periodLabel: periode });
  await poser('objectives', 'obj-clients', { label: 'Nouveaux clients visés', unit: 'clients', targetValue: 4, currentValue: Math.max(0, Math.floor((4 * quantieme) / 30) - 2), periodLabel: periode });
  await poser('objectives', 'bx-obj-rdv', { label: 'Rendez-vous pris', unit: 'rendez-vous', targetValue: 12, currentValue: Math.round((12 * quantieme) / 30), periodLabel: periode });
}

/* ── Cyber : la fiche d'enquête du critique ouvert, s'il y en a un ───── */
const q = await fetch(`${API}/v1/admin/incidents/queue?status=open&severity=critical&limit=5`, { headers: H });
if (q.ok) {
  const { incidents } = await q.json();
  const inc = incidents?.[0];
  if (inc) {
    const t0 = Date.parse(inc.firstSeenAt);
    const a = (min) => new Date(t0 + min * 60_000).toISOString();
    await poser('incidentsFiches', inc.id, {
      orgId: inc.orgId,
      actions: [
        { id: 'a1', at: a(18), quoi: 'Accès bloqué par pare-feu', par: EQUIPE.harun },
        { id: 'a2', at: a(95), quoi: 'Mots de passe administrateurs changés', par: EQUIPE.harun },
        { id: 'a3', at: a(210), quoi: 'Cliente prévenue par téléphone', par: EQUIPE.harun },
        { id: 'a4', at: a(360), quoi: 'Journaux exportés pour l’enquête', par: EQUIPE.harun },
      ],
      prochaine: { quoi: 'Faire tourner les clés d’API exposées, puis rouvrir l’accès par réseau privé', avant: new Date(new Date().setHours(18, 0, 0, 0)).toISOString(), par: EQUIPE.harun },
      elements: ['SITE|' + (inc.siteName ?? 'le site') + '|exposé', 'COMPTE|3 comptes administrateurs|changés', 'CLÉS|2 clés d’API|à tourner', 'JOURNAUX|journal d’accès, 7 j|exporté'],
      notes: [{ id: 'n1', texte: 'Les tentatives viennent de 3 adresses, même préfixe. Aucune n’a réussi d’après le journal.', par: EQUIPE.harun, at: a(100) }],
      cloture: [
        { id: 'c0', texte: 'Accès bloqué', fait: true },
        { id: 'c1', texte: 'Mots de passe changés', fait: true },
        { id: 'c2', texte: 'Clés d’API tournées', fait: false },
        { id: 'c3', texte: 'Rapport envoyé à la cliente', fait: false },
      ],
    });
    await poser('carnet', 'bx-note-inc', { texte: 'Les tentatives viennent de 3 adresses. Même préfixe réseau pour les trois. Qui a publié l’interface d’administration ? À demander avant de clore l’incident.', liens: [{ type: 'incident', id: inc.id, label: `INC-${inc.id.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase()}` }, { type: 'cliente', id: inc.orgId, label: inc.orgName }], question: true, resolue: false, par: EQUIPE.harun, at: le(0, 10, 48) });
  }
}

console.log(`${ecrits} enregistrements écrits.`);
