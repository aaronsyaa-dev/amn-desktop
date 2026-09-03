/* Génère la table de docs/audit-modules-2026-09-04.md depuis /tmp/e2e/audit/rapport.json
   et les verdicts posés à la main dans /tmp/e2e/audit/verdicts.json ({ "edition:key": { verdict, detail } }).
   Le verdict automatique n'est qu'un plancher : une erreur de page, un débordement au téléphone ou une
   exception valent « À retravailler » ; des résidus de français en anglais valent « Ajouts nécessaires ». */
import fs from 'node:fs';
const rapport = JSON.parse(fs.readFileSync('/tmp/e2e/audit/rapport.json', 'utf8'));
const verdicts = fs.existsSync('/tmp/e2e/audit/verdicts.json') ? JSON.parse(fs.readFileSync('/tmp/e2e/audit/verdicts.json', 'utf8')) : {};
const SECTIONS = {
  business: { home: 'Pilotage', agenda: 'Pilotage', projects: 'Pilotage', tasks: 'Pilotage', okr: 'Pilotage', weekly: 'Pilotage', meetings: 'Pilotage', priorities: 'Pilotage', routines: 'Pilotage', logbook: 'Pilotage', forms: 'Pilotage', minisite: 'Pilotage', newsletter: 'Pilotage', esign: 'Pilotage', portfolio: 'Pilotage',
    clients: 'Clients & revenus', invoices: 'Clients & revenus', orders: 'Clients & revenus', evenements: 'Clients & revenus', pipeline: 'Clients & revenus', reminders: 'Clients & revenus', subscriptions: 'Clients & revenus', contracts: 'Clients & revenus', reviews: 'Clients & revenus', loyalty: 'Clients & revenus', referrals: 'Clients & revenus', booking: 'Clients & revenus', cashCount: 'Clients & revenus',
    time: 'Production', expenses: 'Production', calculators: 'Production', board: 'Production', stock: 'Production', suppliers: 'Production', shifts: 'Production', checklists: 'Production', assembly: 'Production', aftersales: 'Production', bom: 'Production', rounds: 'Production', equipment: 'Production',
    notes: 'Documents', pages: 'Documents', reports: 'Documents', media: 'Documents',
    dm: 'Collectif', groups: 'Collectif', announcements: 'Collectif', polls: 'Collectif', leaves: 'Collectif', directory: 'Collectif', calls: 'Collectif',
    qr: 'Outils', converters: 'Outils', templates: 'Outils', automations: 'Outils', dataPort: 'Outils',
    budget: 'Personnel', courses: 'Personnel', habits: 'Personnel', personalGoals: 'Personnel', diary: 'Personnel', pomodoro: 'Personnel',
    settings: 'Système', members: 'Système', assistance: 'Système', discover: 'Système', vault: 'Système' },
  interne: { team: 'Livrables', decisions: 'Livrables', knowledge: 'Livrables', library: 'Livrables', tour: 'Tour de contrôle', orgs: 'Tour de contrôle', access: 'Tour de contrôle', generator: 'Tour de contrôle', supervision: 'Parc', sites: 'Parc', tracker: 'Parc', socMaturity: 'Parc', orgCompare: 'Parc', customAlerts: 'Parc', clientReport: 'Parc', scanner: 'Produits', comply: 'Produits', ssl: 'Produits' },
};
const ordre = { 'À retravailler': 0, 'À reconsidérer': 1, 'Ajouts nécessaires': 2, 'Bon': 3 };
const lignes = [];
const comptes = { 'Bon': 0, 'À retravailler': 0, 'Ajouts nécessaires': 0, 'À reconsidérer': 0 };
for (const l of rapport) {
  const faits = [];
  if (l.exception) faits.push(`exception : ${l.exception}`);
  if (l.erreurs?.length) faits.push(`erreur de page : ${l.erreurs[0]}`);
  if (l.tel?.deborde) faits.push(`déborde au téléphone (${l.tel.largeur} px)`);
  if (l.tel?.erreurs?.length) faits.push(`erreur au téléphone : ${l.tel.erreurs[0]}`);
  if (l.cree !== undefined) faits.push(`création ${l.cree ? 'ok' : 'non tentée/échouée'}${l.cree ? `, rechargement ${l.persiste ? 'ok' : 'PERDU'}, suppression ${l.supprime ? 'ok' : 'non trouvée'}` : ''}${l.note ? ` (${l.note})` : ''}`);
  else faits.push(`ouverture ok${l.vide ? ', état vide' : `, ${l.lignes} lignes`}`);
  if (l.en?.residus) faits.push(`anglais : ${l.en.residus} ligne(s) restée(s) en français`);
  let auto = 'Bon';
  if (l.exception || l.erreurs?.length || l.tel?.deborde || l.tel?.erreurs?.length || (l.cree && !l.persiste)) auto = 'À retravailler';
  else if (l.en?.residus) auto = 'Ajouts nécessaires';
  const manuel = verdicts[`${l.edition}:${l.key}`] ?? {};
  const verdict = manuel.verdict ?? auto;
  const detail = [manuel.detail, faits.join(' ; ')].filter(Boolean).join(' — ');
  comptes[verdict] += 1;
  lignes.push({ ...l, verdict, detail, section: SECTIONS[l.edition]?.[l.key] ?? '—' });
}
const edition = (e) => (e === 'business' ? 'Business + interne' : 'Interne seule');
let md = '| Module | Section | Édition | Verdict | Détail |\n| --- | --- | --- | --- | --- |\n';
for (const l of lignes) md += `| ${l.label} (\`${l.key}\`) | ${l.section} | ${edition(l.edition)} | **${l.verdict}** | ${l.detail.replace(/\|/g, '/')} |\n`;
fs.writeFileSync('/tmp/e2e/audit/table.md', md);
console.log(JSON.stringify(comptes), lignes.length, 'lignes');
console.log(lignes.filter((l) => l.verdict !== 'Bon').map((l) => `${l.verdict} — ${l.edition}:${l.key} — ${l.detail.slice(0, 120)}`).join('\n'));
