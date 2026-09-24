/**
 * verite:garde — ce que la Garde a RÉELLEMENT fait, et pour qui.
 *
 * Né de la question d'Harun (24 septembre 2026) : l'Atelier promettait
 * « 20 gardes affectées, 4 863 passages par jour » et, à l'usage, rien ne se
 * voyait. Ce relevé ne lit que les traces écrites par la Garde elle-même
 * (rondes et journal, via l'API d'administration) et répond à trois
 * questions, chiffres à l'appui :
 *
 *   1. La Garde tourne-t-elle ? (battement, uptime, rondes sur la période)
 *   2. Ses rondes TRAVAILLENT-elles ? (éléments lus, réglés, remontés, par
 *      garde — une ronde qui ne lit rien est un passage, pas un travail)
 *   3. POUR QUI ? (lignes de journal par organisation : AMN DevSec d'un
 *      côté, chaque cliente de l'autre)
 *
 *   AMN_API_URL=https://… AMN_OPERATEUR=<jeton opérateur ou de session du fondateur> node scripts/verite-garde.mjs [heures=24]
 *
 * Lecture seule. Rien n'est écrit, rien n'est déclenché.
 */
const API = (process.env.AMN_API_URL ?? 'http://127.0.0.1:8791').replace(/\/$/, '');
const JETON = process.env.AMN_OPERATEUR ?? '';
const HEURES = Number(process.argv[2] ?? 24);
if (!JETON) {
  console.log('Usage : AMN_API_URL=… AMN_OPERATEUR=… node scripts/verite-garde.mjs [heures]');
  process.exit(1);
}
const lire = async (chemin) => {
  const r = await fetch(`${API}${chemin}`, { headers: { Authorization: `Bearer ${JETON}` } });
  if (!r.ok) throw new Error(`${chemin} → ${r.status}`);
  return r.json();
};
const depuis = new Date(Date.now() - HEURES * 3_600_000).toISOString();
const sante = await lire('/v1/health');
const salle = await lire('/v1/garde/salle');
const orgs = (await lire('/v1/admin/organizations')).organizations ?? [];
const nomOrg = new Map(orgs.map((o) => [o.id, o.name]));

console.log(`\nLA GARDE, EN VÉRITÉ — ${new Date().toISOString()} — ${API}, dernières ${HEURES} h\n`);
const b = sante.garde;
console.log(`Battement : ${b?.actif ? 'actif' : 'ARRÊTÉ'} · dernier il y a ${Math.round((b?.depuisMs ?? 0) / 1000)} s · ${b?.agents ?? 0} gardes · ${b?.enRetard ?? 0} en retard · serveur démarré il y a ${Math.round(sante.uptimeSeconds / 60)} min`);
if (b?.interruption) console.log(`Dernière interruption : ${b.interruption.de} → ${b.interruption.a} (${Math.round(b.interruption.dureeMs / 60000)} min)`);

const passagesPromis = salle.agents.filter((a) => a.actif && a.everyMs > 0).reduce((n, a) => n + Math.round(86_400_000 / a.everyMs), 0);
let rondes = 0, lus = 0, regles = 0, remontes = 0, vides = 0;
const parAgent = [];
for (const a of salle.agents) {
  const rs = (await lire(`/v1/garde/rondes?agent=${encodeURIComponent(a.key)}&since=${encodeURIComponent(depuis)}&limit=500`)).rondes ?? [];
  const s = rs.reduce((acc, r) => ({ n: acc.n + 1, lus: acc.lus + (r.lus ?? 0), regles: acc.regles + (r.regles ?? 0), remontes: acc.remontes + (r.remontes ?? 0), vides: acc.vides + ((r.lus ?? 0) === 0 ? 1 : 0), err: acc.err + (r.erreur ? 1 : 0) }), { n: 0, lus: 0, regles: 0, remontes: 0, vides: 0, err: 0 });
  parAgent.push({ key: a.key, ...s, plein: rs.length === 500 });
  rondes += s.n; lus += s.lus; regles += s.regles; remontes += s.remontes; vides += s.vides;
}
console.log(`\nPassages promis par l'Atelier : ${passagesPromis.toLocaleString('fr-FR')} par jour (fréquences des gardes, toutes organisations confondues)`);
console.log(`Rondes réellement tenues : ${rondes.toLocaleString('fr-FR')} en ${HEURES} h (plafond de 500 relevées par garde)`);
console.log(`  dont À VIDE (rien lu) : ${vides.toLocaleString('fr-FR')} (${rondes ? Math.round((vides / rondes) * 100) : 0} %)`);
console.log(`  éléments lus ${lus.toLocaleString('fr-FR')} · réglés seuls ${regles} · remontés à un humain ${remontes}\n`);
console.log('garde'.padEnd(26) + 'rondes'.padStart(7) + 'à vide'.padStart(8) + 'lus'.padStart(8) + 'réglés'.padStart(8) + 'remontés'.padStart(10));
for (const a of parAgent.sort((x, y) => y.lus - x.lus)) console.log(a.key.padEnd(26) + String(a.n).padStart(7) + String(a.vides).padStart(8) + String(a.lus).padStart(8) + String(a.regles).padStart(8) + String(a.remontes).padStart(10) + (a.plein ? '  (≥ 500)' : ''));

const journal = (await lire(`/v1/garde/journal?since=${encodeURIComponent(depuis)}&limit=1000`)).journal ?? [];
const parOrg = new Map();
for (const e of journal) {
  const k = e.orgId ?? '—';
  const o = parOrg.get(k) ?? { n: 0, maj: 0, actions: new Map() };
  o.n += 1;
  if (e.action === 'remontee-maj') o.maj += 1;
  o.actions.set(`${e.agent}:${e.action}`, (o.actions.get(`${e.agent}:${e.action}`) ?? 0) + 1);
  parOrg.set(k, o);
}
console.log(`\nJournal : ${journal.length}${journal.length === 1000 ? '+ (plafond)' : ''} lignes en ${HEURES} h — POUR QUI :`);
for (const [k, o] of [...parOrg.entries()].sort((x, y) => y[1].n - x[1].n)) {
  console.log(`  ${String(o.n).padStart(5)}  ${(nomOrg.get(k) ?? (k === '—' ? '(aucune organisation)' : k)).padEnd(30)} dont ${o.maj} simples mises à jour · ${[...o.actions.entries()].slice(0, 4).map(([a, n]) => `${a}×${n}`).join(', ')}`);
}
const clientes = orgs.filter((o) => o.plan !== 'internal');
const sansRien = clientes.filter((o) => !parOrg.has(o.id));
console.log(`\nClientes sans AUCUNE ligne de journal en ${HEURES} h : ${sansRien.length} sur ${clientes.length}${sansRien.length ? ' — ' + sansRien.slice(0, 8).map((o) => o.name).join(', ') : ''}`);
