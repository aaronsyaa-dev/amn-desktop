#!/usr/bin/env node
/**
 * Crée une organisation cliente et son compte propriétaire, en une commande.
 *
 * Enchaîne les deux appels d'amn-api qui, ensemble, donnent un compte
 * réellement utilisable :
 *   1. `POST /v1/admin/organizations` — crée l'organisation et son propriétaire
 *      à l'état « invité », et rend un jeton d'activation à usage unique ;
 *   2. `POST /v1/auth/invitations/accept` — consomme ce jeton et fixe le mot de
 *      passe, ce qui active le compte.
 *
 * Pourquoi enchaîner plutôt que transmettre le lien d'activation : le jeton
 * expire au bout de 7 jours et n'est rendu qu'UNE fois. Pour une première
 * cliente à qui Aaron remet l'accès de la main à la main, un mot de passe
 * temporaire à changer aux Paramètres est plus sûr qu'un lien qui peut périmer
 * dans une boîte mail. `--invitation-only` fait l'inverse si vous préférez.
 *
 * Usage :
 *   AMN_API_URL=https://amn-api.onrender.com \
 *   AMN_API_OPERATOR_TOKEN=<jeton opérateur> \
 *   node scripts/create-business-org.mjs --name "Atelier Machin" --email elle@exemple.fr
 *
 * Options :
 *   --name <texte>       Nom de l'organisation. C'est ce nom qui apparaît dans
 *                        l'app ET sur ses devis imprimés — mettez sa vraie
 *                        raison sociale, pas un surnom.
 *   --email <adresse>    Adresse du compte propriétaire.
 *   --password <texte>   Mot de passe temporaire. Généré si absent.
 *   --plan <plan>        business_standard (défaut) ou business_premium.
 *   --invitation-only    N'active pas le compte : affiche le jeton d'invitation
 *                        et laisse la cliente choisir son mot de passe.
 *
 * Le jeton opérateur n'est jamais affiché ni journalisé.
 */

import crypto from 'node:crypto';

/*
  Le nom de l'édition CLIENTE, lu dans sa configuration.

  Ce message disait « installer AMN Business » à une cliente : c'est le nom de
  NOTRE application interne depuis le renommage du Bloc 1. On lui demandait
  donc d'installer la mauvaise — celle qui embarque la Tour de contrôle et les
  produits de cybersécurité.
*/
process.env.AMN_EDITION = 'business';
const NOM_CLIENTE = (await import('../electron-builder.config.mjs')).default.productName;

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
}
const has = (name) => args.includes(`--${name}`);

const apiUrl = (process.env.AMN_API_URL || '').replace(/\/$/, '');
const operatorToken = process.env.AMN_API_OPERATOR_TOKEN || '';
const name = flag('name');
const email = (flag('email') || '').trim().toLowerCase();
const plan = flag('plan') || 'business_standard';
const invitationOnly = has('invitation-only');

function fail(message) {
  console.error(`\nÉchec : ${message}\n`);
  process.exit(1);
}

if (!apiUrl) fail('AMN_API_URL manquante.');
if (!operatorToken) fail('AMN_API_OPERATOR_TOKEN manquant (jeton opérateur AMN DevSec).');
if (!name) fail('--name manquant (nom de l’organisation).');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fail('--email manquant ou invalide.');

/**
 * Mot de passe temporaire lisible à voix haute et transmissible par téléphone :
 * pas de caractère ambigu (l/1/I, O/0), un séparateur, une longueur qui reste
 * au-dessus du minimum d'amn-api même après une faute de frappe.
 */
function generatePassword() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const pick = (n) =>
    Array.from({ length: n }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
  return `${pick(5)}-${pick(5)}-${pick(5)}`;
}

const password = flag('password') || generatePassword();

async function call(path, body, bearer) {
  const res = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error || `${res.status} ${res.statusText}`);
  return payload;
}

console.log(`\nCréation de l’organisation « ${name} » sur ${apiUrl}…`);

let created;
try {
  created = await call(
    '/v1/admin/organizations',
    { name, plan, ownerEmail: email },
    operatorToken,
  );
} catch (err) {
  fail(`création refusée — ${err.message}`);
}

const org = created.organization;
const invitation = created.invitation;
console.log(`  organisation créée : ${org.id} (plan ${org.plan}, statut ${org.status})`);
console.log(`  propriétaire       : ${created.owner?.email} (${created.owner?.status})`);

if (invitationOnly) {
  console.log('\n──────────────────────────────────────────────────────────────');
  console.log("  LIEN D’ACTIVATION — à transmettre, valable 7 jours, à usage unique");
  console.log(`  Organisation : ${org.name}`);
  console.log(`  Compte       : ${email}`);
  console.log(`  Jeton        : ${invitation.token}`);
  console.log(`  Expire le    : ${invitation.expiresAt}`);
  console.log('──────────────────────────────────────────────────────────────\n');
  console.log(
    'Ce jeton n’est affiché qu’une fois : il n’est pas stocké en clair côté\n' +
      'serveur et ne peut pas être retrouvé. Réémettez une invitation si perdu.\n',
  );
  process.exit(0);
}

let session;
try {
  session = await call('/v1/auth/invitations/accept', { token: invitation.token, password });
} catch (err) {
  fail(
    `activation refusée — ${err.message}\n` +
      `L’organisation « ${org.name} » existe mais son compte est resté « invité ».\n` +
      `Jeton d’invitation (usage unique, 7 jours) : ${invitation.token}`,
  );
}

// La session ouverte par l'activation n'a plus d'utilité ici : on la ferme
// plutôt que de la laisser vivre 30 jours quelque part.
await fetch(`${apiUrl}/v1/auth/logout`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${session.token}` },
}).catch(() => {});

console.log('\n──────────────────────────────────────────────────────────────');
console.log('  IDENTIFIANTS — à transmettre de vive voix, pas par email');
console.log(`  Organisation      : ${session.org.name}`);
console.log(`  Adresse           : ${session.user.email}`);
console.log(`  Mot de passe      : ${password}`);
console.log(`  Rôle              : ${session.user.role}`);
console.log('──────────────────────────────────────────────────────────────\n');
console.log(
  'À faire ensuite :\n' +
    `  1. installer ${NOM_CLIENTE} (npm run make:business) sur son poste ;\n` +
    '  2. lui faire changer ce mot de passe dans Paramètres → Sécurité ;\n' +
    '  3. vérifier la synchro : AMN_API_EMAIL / AMN_API_PASSWORD + npm run check:sync.\n',
);
