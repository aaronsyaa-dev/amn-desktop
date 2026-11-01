#!/usr/bin/env node
/**
 * LES DONNÉES QUE LES MAQUETTES SUPPOSENT — pour que la comparaison mesure l'écran, pas l'absence de données.
 *
 * Les palettes ⌘K (H41) et ⌘J (G05) ne montrent « menna » ou la relance de la facture F-2041 que si ces
 * fiches existent. Sans elles, la capture affiche un état vide et la comparaison ne dit rien de la mise en
 * page. Ce script ajoute, au jeu d'essai de `scripts/seed-essai.mjs`, une poignée de fiches nommées comme
 * dans les maquettes du lot 00 : tout est inventé, rien ne vient d'une organisation réelle.
 *
 * Il refuse tout compte hors `@exemple.test` et tout hôte hors de cette machine, comme le reste de la chaîne.
 *
 *   AMN_E2E_EMAIL=essai.interne@exemple.test AMN_E2E_PASSWORD=… \
 *     node scripts/qualite/fidelite/graines-maquettes.mjs [--api http://127.0.0.1:4171]
 */
const i = process.argv.indexOf('--api');
const API = (i >= 0 ? process.argv[i + 1] : process.env.AMN_API ?? 'http://127.0.0.1:4171').replace(/\/$/, '');
const EMAIL = process.env.AMN_E2E_EMAIL ?? '';
const MDP = process.env.AMN_E2E_PASSWORD ?? '';

if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(API)) {
  console.error(`REFUS : l'API doit être sur cette machine (127.0.0.1 ou localhost), pas ${API}`);
  process.exit(1);
}
if (!/@exemple\.test$/i.test(EMAIL) || !MDP) {
  console.error('REFUS : il faut AMN_E2E_EMAIL (en @exemple.test) et AMN_E2E_PASSWORD — jamais de compte réel.');
  process.exit(1);
}

const login = await fetch(`${API}/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: MDP }) }).then((r) => r.json());
if (!login?.token) {
  console.error('Connexion refusée :', JSON.stringify(login).slice(0, 160));
  process.exit(1);
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let ecrits = 0;
async function poser(collection, id, data) {
  for (let essai = 0; essai < 4; essai += 1) {
    const r = await fetch(`${API}/v1/collections/${collection}/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` }, body: JSON.stringify({ data }) });
    if (r.ok) { ecrits += 1; return; }
    if (r.status !== 429) { console.error(`  ✗ ${collection}/${id} → ${r.status}`); return; }
    await dormir(2000 * 2 ** essai);
  }
}
const instant = (jours) => new Date(Date.UTC(2026, 9, 30, 9, 0) + jours * 86_400_000).toISOString();
const jour = (iso) => iso.slice(0, 10);

// Des fiches clientes, nommées comme les maquettes.
const CLIENTS = [
  ['9101', 'menna', 'Menna Conseil', 'Conseil et services'],
  ['9102', 'dupont', 'Atelier Dupont', 'Chantiers'],
  ['9103', 'leo', 'Boulangerie Léo', 'Commerce'],
  ['9104', 'medina', 'Medina', 'Conseil et services'],
];
// La clé de la fiche EST le numéro du client : c'est ce que la facture lui renvoie (`clientId`).
for (const [cle, court, company, notes] of CLIENTS) {
  await poser('clients', cle, { name: company, company, status: 'active', email: `contact@${court}.exemple.test`, phone: '', notes, imageDataUrl: '', linkedSiteIds: [], createdAt: instant(-60), events: [] });
}

// La facture de la maquette G05 : F-2041, 890 €, en retard de 12 jours au 20 octobre 2026.
await poser('invoices', 'maq-fac-2041', {
  number: 'F-2041',
  clientId: 9102,
  billTo: { name: 'Atelier Dupont', company: 'Atelier Dupont', email: 'contact@dupont.exemple.test', address: '', vatNumber: '' },
  issuedAt: '2026-09-08',
  dueAt: '2026-10-08',
  lines: [{ id: 'l1', label: 'Intervention de maintenance', quantity: 1, unitPriceCents: 89_000, vatRate: 0 }],
  status: 'issued',
  paidAt: '',
  paymentMethod: '',
  cancelReason: '',
  notes: '',
  quoteId: null,
});

// Les tâches et le document que la recherche « menna » retrouve (H41).
for (const [cle, title, status, priorite] of [
  ['maq-tac-1', 'Valider le tableau de bord de Menna', 'doing', 'high'],
  ['maq-tac-2', 'Relancer la facture F-2041', 'todo', 'high'],
  ['maq-tac-3', 'Envoyer le devis à la Boulangerie Léo', 'todo', 'normal'],
  ['maq-tac-4', 'Répondre à Medina sur les accès', 'todo', 'normal'],
]) {
  await poser('tasks', cle, { title, detail: '', status, priority: priorite, assigneeEmail: EMAIL, createdAt: instant(-3) });
}
await poser('knowledge', 'maq-doc-menna', { title: 'Contrat de maintenance Menna', body: 'Contrat de maintenance annuel, reconduit tacitement. Exemple fictif.', createdAt: instant(-40) });

console.log(`${ecrits} fiche(s) ajoutée(s) pour ${EMAIL} (clients, facture F-2041, tâches, document).`);
