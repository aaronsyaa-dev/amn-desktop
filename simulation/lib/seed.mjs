/**
 * LA POPULATION SYNTHÉTIQUE — 400 personnes, reproductible à la graine.
 *
 * Écrit directement dans une base SQLite neuve, par les mêmes méthodes de la
 * couche données que l'API (`src/db/sqlite.js` d'amn-api). Donc aucune donnée
 * réelle, aucun secret : des entreprises fictives, des comptes `@exemple.test`,
 * des mots de passe tous identiques et connus (`SIM_MDP`). Jamais la prod.
 *
 * Profils variés : dirigeant (owner), comptable/commercial (admin/member),
 * technicien (member). Formules et effectifs variés. Quelques organisations
 * sont posées en situation d'attention (siège de trop, site muet) pour donner
 * du grain à moudre à la Garde — jamais du critique gratuit.
 */
import crypto from 'node:crypto';
import { prng } from './prng.mjs';

export const SIM_MDP = 'Sim-2026-BacASable';

const PRENOMS = ['Camille', 'Hugo', 'Nadia', 'Léa', 'Mohamed', 'Inès', 'Lucas', 'Fatou', 'Théo', 'Sarah', 'Yanis', 'Jade', 'Riyad', 'Chloé', 'Amine', 'Manon', 'Noah', 'Aya', 'Gabriel', 'Lina', 'Aaron', 'Zoé', 'Rayan', 'Emma'];
const NOMS = ['Renaud', 'Marchand', 'Bensalah', 'Dubois', 'Nguyen', 'Lefèvre', 'Garcia', 'Traoré', 'Moreau', 'Rossi', 'Haddad', 'Girard', 'Costa', 'Fontaine', 'Benali', 'Leroy', 'Marin', 'Diallo', 'Perez', 'Faure'];
const ENTREPRISES = [
  { nom: 'Le Jardin d’Élise', plan: 'business_standard' },
  { nom: 'Boulangerie Ferrand', plan: 'business_standard' },
  { nom: 'Atelier Corvetto', plan: 'business_premium' },
  { nom: 'Garage Vittel', plan: 'solo' },
  { nom: 'Cabinet Aurore', plan: 'equipe' },
  { nom: 'Transports Belland', plan: 'business' },
  { nom: 'Fleurs & Cie', plan: 'solo' },
  { nom: 'Studio Lumen', plan: 'business_standard' },
  { nom: 'Épicerie du Coin', plan: 'solo' },
  { nom: 'Menuiserie Royale', plan: 'business_premium' },
  { nom: 'Clinique Vétérinaire des Tilleuls', plan: 'business_standard' },
  { nom: 'Conseil & Audit Delmas', plan: 'equipe' },
];
const PROFILS = [
  { profil: 'dirigeant', role: 'owner' },
  { profil: 'comptable', role: 'admin' },
  { profil: 'commercial', role: 'member' },
  { profil: 'technicien', role: 'member' },
];
const SEATS = { solo: 1, equipe: 5, business: 10, business_standard: 5, business_premium: 10, internal: 25 };

const motClé = (nom) =>
  nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/**
 * @param {object} db   une base amn-api déjà `init()`
 * @param {number} graine
 * @param {number} nombrePersonnes
 * @returns {Promise<{orgs:Array, users:Array, sites:Array}>} l'annuaire de la population
 */
export async function peupler(db, { graine = 424242, nombrePersonnes = 400 } = {}) {
  const r = prng(graine);
  const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
  const { hashPassword } = await importPassword();
  const { formulaModules } = await importTenancy();
  const hash = await hashPassword(SIM_MDP); // un seul hash, réutilisé : peupler 400 scrypt prendrait des minutes pour rien.

  const orgs = [];
  const sites = [];
  for (let i = 0; i < ENTREPRISES.length; i += 1) {
    const e = ENTREPRISES[i];
    const org = await db.createOrganization({ name: e.nom, plan: e.plan, status: 'active' });
    // Une organisation sur six a un siège de trop : la Garde des Comptes doit le noter, sans alarmer.
    const seats = SEATS[e.plan] + (i % 6 === 0 ? 1 : 0);
    await db.updateOrganization(org.id, { modules: formulaModules(e.plan), modulesAdded: [], modulesRemoved: [], seats });
    const site = await db.createSite({ orgId: org.id, name: `${motClé(e.nom)}.exemple.test`, apiKeyHash: sha(`sim-cle-${org.id}`) });
    // Une organisation sur quatre a un site qu'on laissera muet (panne volontaire côté scénario).
    const muet = i % 4 === 0;
    await db.upsertSiteState(org.id, site.id, {
      status: 'online',
      lastSeenAt: new Date(Date.now() - (muet ? 0 : r.entier(5, 120) * 1000)).toISOString(),
      updatedAt: new Date().toISOString(),
      activeVisitors: r.entier(0, 20),
    });
    orgs.push({ ...org, plan: e.plan, seats, siteId: site.id, siteName: site.name, apiKeyClair: `sim-cle-${org.id}` });
    sites.push({ orgId: org.id, id: site.id, name: site.name, muet });
  }

  // Réparti les 400 personnes sur les organisations ; chaque org a un dirigeant, le reste varié.
  const users = [];
  const parOrg = Math.floor(nombrePersonnes / orgs.length);
  let reste = nombrePersonnes - parOrg * orgs.length;
  let n = 0;
  for (const org of orgs) {
    const combien = parOrg + (reste > 0 ? (reste -= 1, 1) : 0);
    for (let k = 0; k < combien; k += 1) {
      const profilDef = k === 0 ? PROFILS[0] : r.choix(PROFILS);
      const prenom = r.choix(PRENOMS);
      const nom = r.choix(NOMS);
      const email = `sim${String(n).padStart(3, '0')}.${motClé(prenom)}@exemple.test`;
      const user = await db.createUser({ orgId: org.id, email, passwordHash: hash, role: profilDef.role, status: 'active' });
      users.push({ id: user.id, email, orgId: org.id, orgName: org.name, role: profilDef.role, profil: profilDef.profil });
      n += 1;
    }
  }
  return { orgs, users, sites };
}

// L'emplacement d'amn-api est configurable (AMN_API_DIR) ; par défaut, le dépôt voisin.
async function importPassword() {
  const { default: path } = await import('node:path');
  const dir = process.env.AMN_API_DIR || path.resolve('/home/user/amn-api');
  return import(path.join(dir, 'src/lib/password.js'));
}
async function importTenancy() {
  const { default: path } = await import('node:path');
  const dir = process.env.AMN_API_DIR || path.resolve('/home/user/amn-api');
  return import(path.join(dir, 'src/db/tenancy.js'));
}
