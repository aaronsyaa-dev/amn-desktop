#!/usr/bin/env node
/**
 * PEUPLER LA SUPERVISION INTERNE — le parc, pas les modules
 * ═════════════════════════════════════════════════════════
 *
 * `seed-essai.mjs` remplit les MODULES d'une organisation (clients, devis,
 * rendez-vous…). Il ne peut rien pour l'Accueil interne, qui ne parle pas de
 * modules : il parle d'un PARC — des sites supervisés pour plusieurs clientes,
 * leur état, et les incidents ouverts dessus.
 *
 * Ces tables-là (`sites`, `site_state`, `incidents`) sont écrites par les
 * traceurs et le scanner, jamais par l'application. Aucune route ne les crée,
 * donc rien ne peut les peupler depuis le client : ce script écrit directement
 * dans la base sqlite du bac à sable.
 *
 * ## Ce qu'il écrit
 *
 * Neuf sites inventés, répartis sur trois clientes fictives, dans les trois
 * états qui comptent : en ligne, hors ligne, jamais vu. Plus trois incidents
 * ouverts de gravités différentes, dont un critique jamais pris.
 *
 * C'est la configuration qui rend l'Accueil interne MESURABLE : un parc tout
 * vert ne montre ni l'objet dominant, ni l'ambre, ni la hiérarchie — il montre
 * un état vide, et un état vide ne prouve rien d'une composition.
 *
 *   SQLITE_PATH=…/design.db node scripts/seed-supervision.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

const CHEMIN = process.env.SQLITE_PATH ?? '';
if (!CHEMIN) {
  console.error('Il faut SQLITE_PATH — le fichier sqlite du bac à sable.');
  process.exit(1);
}
if (!fs.existsSync(CHEMIN)) {
  console.error(`Base introuvable : ${CHEMIN}`);
  process.exit(1);
}

/*
  LE GARDE-FOU, ET IL N'EST PAS DÉCORATIF.

  Ce script écrit dans une base SANS PASSER PAR L'API : ni jeton, ni rôle, ni
  vérification d'organisation ne s'interposent. Pointé par distraction sur la
  base de production, il y déverserait neuf sites inventés et trois incidents
  faux — au milieu de vrais incidents, dans l'écran où l'équipe décide quoi
  traiter en premier. Un incident inventé qu'on prend pour vrai coûte une
  astreinte ; un vrai qu'on prend pour inventé coûte bien davantage.

  Deux conditions cumulatives, et aucune n'est suffisante seule :
    · le chemin contient « bac » ou « design » — un fichier de bac à sable ;
    · la base ne contient que des comptes `@exemple.test`, domaine réservé par
      la RFC 2606 précisément pour qu'il ne puisse exister nulle part ailleurs.

  La seconde est la vraie : un fichier peut être renommé, une adresse réelle
  ne peut pas devenir `.test`.
*/
const db = new DatabaseSync(CHEMIN);
const comptes = db.prepare('select email from users').all();
const etrangers = comptes.filter((u) => !/@exemple\.test$/i.test(String(u.email)));
if (etrangers.length > 0) {
  console.error('REFUS — cette base contient des comptes qui ne sont pas `@exemple.test` :');
  for (const u of etrangers.slice(0, 5)) console.error(`  · ${u.email}`);
  console.error('\nCe script écrit sans passer par l’API. Il ne s’exécute que sur un bac à sable.');
  process.exit(1);
}
if (!/bac|design/i.test(CHEMIN)) {
  console.error(`REFUS — « ${CHEMIN} » ne ressemble pas à une base de bac à sable.`);
  process.exit(1);
}

const orgs = db.prepare('select id, name, plan from organizations').all();
const interne = orgs.find((o) => o.plan === 'internal');
if (!interne) {
  console.error('REFUS — aucune organisation interne dans cette base ; rien à superviser.');
  process.exit(1);
}

const maintenant = Date.now();
const iso = (decalageHeures) => new Date(maintenant + decalageHeures * 3_600_000).toISOString();

/*
  LE PARC. Trois clientes, neuf sites, trois états.

  Les noms sont ceux de commerces inventés — le domaine `.test` les rend
  invérifiables par construction, donc personne ne peut les prendre pour de
  vrais clients en relisant une capture.

  `vuIlYaHeures` à `null` veut dire JAMAIS VU : le traceur est posé, la clé
  existe, et rien n'est jamais arrivé. C'est l'état que l'accueil ne comptait
  nulle part, et celui qui compte le plus — un site qu'on croit surveiller.
*/
/*
  « En ligne » se DATE, il ne se déclare pas.

  Le serveur repasse hors ligne tout site silencieux depuis plus de cinq
  minutes (`HEARTBEAT_GRACE_MS`), et il a raison : c'est l'absence de signal
  qui définit l'état, pas une colonne qu'on écrit. Un premier jet posait les
  sites « en ligne » à six, douze et dix-huit minutes — les trois sont repassés
  hors ligne avant la capture, et l'accueil annonçait six pannes pour deux.

  Les sites vivants sont donc datés de MAINTENANT, et il faut relancer ce
  script juste avant de mesurer. C'est la contrainte du sujet, pas un défaut du
  script : un parc de supervision n'a pas d'état hors du temps.
*/
const SITES = [
  ['sup-1', 'atelier-bertaux.test', 'Maison Bertaux', 'online', 0, 14],
  ['sup-2', 'boutique-bertaux.test', 'Maison Bertaux', 'online', 0, 3],
  ['sup-3', 'reservation-bertaux.test', 'Maison Bertaux', 'offline', -31, 0],
  ['sup-4', 'brasserie-du-port.test', 'Brasserie du Port', 'offline', -52, 0],
  ['sup-5', 'carte-brasserie.test', 'Brasserie du Port', 'online', 0, 6],
  ['sup-6', 'studio-nord.test', 'Studio Nord', 'online', 0, 2],
  ['sup-7', 'galerie-studio-nord.test', 'Studio Nord', 'unknown', null, 0],
  ['sup-8', 'devis-studio-nord.test', 'Studio Nord', 'unknown', null, 0],
  ['sup-9', 'archives-bertaux.test', 'Maison Bertaux', 'unknown', null, 0],
];

let ecrits = 0;
for (const [id, url, nom, status, vuIlYaHeures, visiteurs] of SITES) {
  db.prepare(
    'insert or replace into sites (id,name,api_key_hash,created_at,tier,url,org_id) values (?,?,?,?,?,?,?)',
  ).run(id, nom, `hash-${id}`, iso(-24 * 90), 'sentinel', `https://${url}`, interne.id);
  db.prepare(
    'insert or replace into site_state (site_id,status,active_visitors,last_seen_at,updated_at,org_id) values (?,?,?,?,?,?)',
  ).run(id, status, visiteurs, vuIlYaHeures === null ? null : iso(vuIlYaHeures), iso(0), interne.id);
  ecrits += 2;
}

/*
  LES INCIDENTS. Trois gravités, et un critique JAMAIS PRIS.

  C'est la seule configuration qui distingue « il se passe des choses » de
  « quelque chose attend quelqu'un » : un incident critique dont
  `acknowledged_at` est nul, ouvert depuis des heures, n'est pas un état du
  parc — c'est une décision que personne n'a prise.
*/
const INCIDENTS = [
  ['sup-inc-1', 'sup-4', '203.0.113.44', 'critical', 'new', -7, 38, null],
  ['sup-inc-2', 'sup-1', '198.51.100.9', 'warning', 'acknowledged', -19, 12, -16],
  ['sup-inc-3', 'sup-5', '203.0.113.7', 'info', 'new', -2, 3, null],
];
for (const [id, siteId, acteur, severity, status, vuIlYaHeures, alertes, prisIlYaHeures] of INCIDENTS) {
  db.prepare(
    'insert or replace into incidents (id,org_id,site_id,actor,actor_kind,status,severity,kinds,alert_count,first_seen_at,last_seen_at,acknowledged_at,created_at) ' +
      'values (?,?,?,?,?,?,?,?,?,?,?,?,?)',
  ).run(
    id,
    interne.id,
    siteId,
    acteur,
    'ip',
    status,
    severity,
    JSON.stringify(['rate_limit', 'probe']),
    alertes,
    iso(vuIlYaHeures),
    iso(vuIlYaHeures + 0.5),
    prisIlYaHeures === null ? null : iso(prisIlYaHeures),
    iso(vuIlYaHeures),
  );
  ecrits += 1;
}

/*
  LES DEMANDES D'ASSISTANCE — la file de la Tour, vue du côté de la cliente.

  Même raison que le parc : `support_requests` est écrite par une route que
  seule une cliente connectée peut appeler, et la RÉPONSE par un opérateur de
  la Tour. Semer un échange complet depuis le client demanderait deux sessions
  et un jeton d'opérateur ; on écrit donc la table.

  Trois demandes, dont une répondue : c'est la seule qui prouve la composition
  de l'écran, puisque c'est la réponse qui domine.
*/
const moi = comptes.find((c) => c.email === 'design@exemple.test');
const idDeMoi = db.prepare('select id from users where email = ?').get('design@exemple.test');
const DEMANDES = [
  {
    id: 'req-design-1',
    kind: 'message',
    subject: 'Changer le logo sur les devis',
    body: 'Nous avons refait notre logo cet été. Pouvez-vous le remplacer sur les devis et les factures ? Je vous envoie le fichier dès que vous me dites où le déposer.',
    status: 'answered',
    reply: 'C’est fait — le nouveau logo est en place sur les devis, les factures et la page de rendez-vous. Déposez les prochains fichiers dans Médias, dossier « Identité » : je les reprends de là sans que vous ayez à écrire.',
    ilYaHeures: 24 * 5,
    reponduIlYaHeures: 24 * 4,
  },
  {
    id: 'req-design-2',
    kind: 'message',
    subject: 'Ajouter un champ « étage » aux fiches clients',
    body: 'Nos livreurs perdent du temps dans les immeubles sans numéro d’étage. Est-ce qu’on peut ajouter une ligne à la fiche ?',
    status: 'pending',
    reply: null,
    ilYaHeures: 30,
    reponduIlYaHeures: null,
  },
  {
    id: 'req-design-3',
    kind: 'message',
    subject: 'Sauvegarde du mois d’août',
    body: 'Simple vérification : la sauvegarde d’août est bien passée ?',
    status: 'closed',
    reply: 'Oui, sauvegarde d’août complète, vérifiée le 1er septembre. Rien à faire de votre côté.',
    ilYaHeures: 24 * 26,
    reponduIlYaHeures: 24 * 25,
  },
];
if (moi && idDeMoi) {
  for (const d of DEMANDES) {
    db.prepare(
      'insert or replace into support_requests (id,org_id,kind,subject,body,requested_by,requested_by_email,status,reply,handled_by_email,handled_at,created_at) ' +
        'values (?,?,?,?,?,?,?,?,?,?,?,?)',
    ).run(
      d.id,
      interne.id,
      d.kind,
      d.subject,
      d.body,
      idDeMoi.id,
      'design@exemple.test',
      d.status,
      d.reply,
      d.reply ? 'harun@exemple.test' : null,
      d.reponduIlYaHeures === null ? null : iso(-d.reponduIlYaHeures),
      iso(-d.ilYaHeures),
    );
    ecrits += 1;
  }
}

console.log(
  `Parc de supervision écrit dans ${CHEMIN} :\n` +
    `  · ${SITES.length} sites sur 3 clientes — ${SITES.filter((s) => s[3] === 'online').length} en ligne, ` +
    `${SITES.filter((s) => s[3] === 'offline').length} hors ligne, ${SITES.filter((s) => s[3] === 'unknown').length} jamais vus\n` +
    `  · ${INCIDENTS.length} incidents ouverts, dont ${INCIDENTS.filter((i) => i[3] === 'critical' && i[7] === null).length} critique jamais pris\n` +
    `  · ${DEMANDES.length} demandes d'assistance, dont une répondue\n` +
    `  · ${ecrits} lignes au total. Relancez les captures.`,
);
