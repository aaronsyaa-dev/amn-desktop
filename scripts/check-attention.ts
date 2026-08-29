/**
 * Contrôle du moteur des points d'attention.
 *
 * Ce module a une propriété désagréable : il se trompe SILENCIEUSEMENT. Un
 * seuil décalé d'un jour ne casse rien, n'affiche aucune erreur, et se traduit
 * juste par une facture qu'on relance une semaine trop tard ou un certificat
 * qu'on renouvelle après l'expiration. Personne ne relie jamais l'incident au
 * bug.
 *
 * Chaque seuil est donc rejoué SUR SES DEUX BORDS : la veille du
 * déclenchement, où rien ne doit sortir, et le jour même, où l'alerte doit
 * apparaître avec le bon chiffre et la bonne gravité.
 *
 * Le script tourne sous `TZ=Europe/Paris`, et ce n'est pas cosmétique : la
 * machine de build est en UTC, où l'heure ne change jamais. Les assertions sur
 * les nuits de changement d'heure y passeraient quoi qu'on écrive dans
 * `daysBetween` — vérifié en remplaçant l'arithmétique UTC par de l'heure
 * locale : le contrôle restait vert. Il faut donc l'exécuter dans un fuseau qui
 * a réellement un changement d'heure, celui où tourne le produit.
 *
 *   npm run check:attention
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));

async function loadFromSrc<T>(entry: string): Promise<T> {
  const built = await esbuild.build({
    entryPoints: [path.join(here, '..', entry)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    target: 'node22',
    charset: 'utf8',
  });
  return (await import(
    `data:text/javascript;charset=utf-8;base64,${Buffer.from(built.outputFiles[0].text, 'utf8').toString('base64')}`
  )) as T;
}

/**
 * Le contrat public du moteur, réécrit ici plutôt que déduit.
 *
 * `scripts/` est hors du `tsconfig` de l'application, donc rien ne relierait
 * ce contrôle aux types de `src/` : les décrire fait de ce fichier une seconde
 * lecture de la signature, et un export renommé s'y voit au lieu de tomber en
 * « undefined is not a function ».
 */
type Severity = 'critical' | 'warning' | 'info';
interface Item {
  key: string;
  kind: string;
  severity: Severity;
  title: string;
  evidence: string;
  action: string;
  to: string;
  amountCents?: number;
  weight: number;
}
interface Thresholds {
  invoiceDueSoonDays: number;
  invoiceSeriousDays: number;
  taskStaleDays: number;
  taskForgottenDays: number;
  clientSilentDays: number;
  certificateWarnDays: number;
  certificateCriticalDays: number;
}
interface Invoice {
  id: string; number: string; status: string; issuedAt: string; dueAt: string;
  clientName: string; totalCents: number;
}
interface Task { id: string; title: string; status: string; createdAt: string; updatedAt: string }
interface Client {
  id: number; label: string; status: string; createdAt: string; updatedAt: string; traces: string[];
}
interface Certificate {
  host: string; daysLeft: number | null; error: string | null; lastCheckedAt: string | null;
}
interface Incident {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'new' | 'acknowledged' | 'resolved';
  firstSeenAt: string;
}
interface Input {
  invoices?: Invoice[]; tasks?: Task[]; clients?: Client[]; certificates?: Certificate[];
  incidents?: Incident[];
}
interface AttentionModule {
  DEFAULT_THRESHOLDS: Thresholds;
  attentionCounts(items: Item[]): Record<Severity, number>;
  attentionItems(input: Input, options?: { now?: Date; thresholds?: Partial<Thresholds> }): Item[];
  dayOf(timestamp: string): string | null;
  daysBetween(from: string, to: string): number | null;
  today(now?: Date): string;
}

const {
  DEFAULT_THRESHOLDS,
  attentionCounts,
  attentionItems,
  daysBetween,
  dayOf,
  today,
} = await loadFromSrc<AttentionModule>('src/lib/attention.ts');

const failures: string[] = [];
function check(name: string, run: () => void) {
  try {
    run();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push(name);
    console.error(`  ÉCHEC ${name}`);
    console.error(`         ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
  }
}

/* --------------------------------- Fixtures -------------------------------- */

/** Midi, pour qu'aucun test ne dépende de l'heure à laquelle il tourne. */
const NOW = new Date('2026-06-15T12:00:00Z');
const at = (isoDay: string) => `${isoDay}T09:00:00.000Z`;

/** `2026-06-15` moins n jours. */
function daysAgo(n: number): string {
  const d = new Date(Date.UTC(2026, 5, 15) - n * 86_400_000);
  return d.toISOString().slice(0, 10);
}
const inDays = (n: number) => daysAgo(-n);

const invoice = (o: Partial<Invoice> = {}): Invoice => ({
  id: o.id ?? 'inv-1',
  number: o.number ?? '2026-0001',
  status: o.status ?? 'issued',
  issuedAt: o.issuedAt ?? daysAgo(40),
  dueAt: o.dueAt ?? daysAgo(1),
  clientName: o.clientName ?? 'Durand Conseil',
  totalCents: o.totalCents ?? 120000,
});

const task = (o: Partial<Task> = {}): Task => ({
  id: o.id ?? 't1',
  title: o.title ?? 'Migrer le serveur',
  status: o.status ?? 'todo',
  createdAt: at(o.createdAt ?? daysAgo(30)),
  updatedAt: at(o.updatedAt ?? daysAgo(30)),
});

const client = (o: Partial<Client> = {}): Client => ({
  id: o.id ?? 1,
  label: o.label ?? 'Durand Conseil',
  status: o.status ?? 'active',
  createdAt: at(o.createdAt ?? daysAgo(400)),
  updatedAt: at(o.updatedAt ?? daysAgo(400)),
  traces: (o.traces ?? []).map((d) => at(d)),
});

const cert = (o: Partial<Certificate> = {}): Certificate => ({
  host: o.host ?? 'exemple.fr',
  daysLeft: o.daysLeft === undefined ? 30 : o.daysLeft,
  error: o.error ?? null,
  lastCheckedAt: o.lastCheckedAt ?? at(daysAgo(1)),
});

const run = (input: Input, thresholds?: Partial<Thresholds>) =>
  attentionItems(input, { now: NOW, thresholds });
const kinds = (items: Item[]) => items.map((i) => i.kind);

/* -------------------------------- Le calendrier ---------------------------- */

check('dayOf tolère un jour nu comme un horodatage complet', () => {
  assert.equal(dayOf('2026-06-15'), '2026-06-15');
  assert.equal(dayOf('2026-06-15T23:59:59.999Z'), '2026-06-15');
  assert.equal(dayOf(''), null);
  assert.equal(dayOf('bientôt'), null);
  assert.equal(dayOf(undefined as unknown as string), null);
});

check('daysBetween traverse un changement d’heure sans se décaler', () => {
  // Dernier dimanche de mars 2026 : passage à l'heure d'été en France.
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
  // Et l'automne.
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2);
  // Une année bissextile.
  assert.equal(daysBetween('2024-02-28', '2024-03-01'), 2);
  assert.equal(daysBetween('2025-02-28', '2025-03-01'), 1);
  assert.equal(daysBetween('2026-06-15', '2026-06-15'), 0);
  assert.equal(daysBetween('2026-06-16', '2026-06-15'), -1);
  assert.equal(daysBetween('n’importe quoi', '2026-06-15'), null);
});

check('today rend un jour ISO', () => {
  assert.match(today(NOW), /^\d{4}-\d{2}-\d{2}$/);
});

/* --------------------------------- Factures -------------------------------- */

check('facture : rien tant que l’échéance est loin, alerte le jour où elle passe', () => {
  const t = DEFAULT_THRESHOLDS;
  // Juste avant la fenêtre de rappel : silence.
  assert.deepEqual(kinds(run({ invoices: [invoice({ dueAt: inDays(t.invoiceDueSoonDays + 1) })] })), []);
  // Premier jour de la fenêtre.
  const soon = run({ invoices: [invoice({ dueAt: inDays(t.invoiceDueSoonDays) })] });
  assert.deepEqual(kinds(soon), ['invoice-due-soon']);
  assert.equal(soon[0].severity, 'info');
  assert.equal(soon[0].evidence, 'échéance dans 7 jours');
  // Le jour même.
  const dday = run({ invoices: [invoice({ dueAt: daysAgo(0) })] });
  assert.equal(dday[0].kind, 'invoice-due-soon');
  assert.equal(dday[0].evidence, "échéance aujourd'hui");
  // Le lendemain : elle bascule en retard.
  const late = run({ invoices: [invoice({ dueAt: daysAgo(1) })] });
  assert.equal(late[0].kind, 'invoice-overdue');
  assert.equal(late[0].severity, 'warning');
  assert.equal(late[0].evidence, 'échue depuis 1 jour');
});

check('facture : le retard devient critique au seuil, pas avant', () => {
  const t = DEFAULT_THRESHOLDS;
  const before = run({ invoices: [invoice({ dueAt: daysAgo(t.invoiceSeriousDays - 1) })] });
  assert.equal(before[0].severity, 'warning');
  const atSeuil = run({ invoices: [invoice({ dueAt: daysAgo(t.invoiceSeriousDays) })] });
  assert.equal(atSeuil[0].severity, 'critical');
  assert.equal(atSeuil[0].evidence, 'échue depuis 30 jours');
  assert.equal(atSeuil[0].amountCents, 120000);
  assert.equal(atSeuil[0].to, '/facturation');
});

check('facture : seule une émise peut être en retard', () => {
  for (const status of ['draft', 'paid', 'cancelled']) {
    assert.deepEqual(
      kinds(run({ invoices: [invoice({ status, dueAt: daysAgo(120) })] })),
      [],
      `statut ${status}`,
    );
  }
});

check('facture : une échéance illisible ne produit rien plutôt qu’une alerte fausse', () => {
  assert.deepEqual(kinds(run({ invoices: [invoice({ dueAt: '' })] })), []);
  assert.deepEqual(kinds(run({ invoices: [invoice({ dueAt: 'à réception' })] })), []);
});

/* ---------------------------------- Tâches --------------------------------- */

check('tâche : les DEUX conditions, ancienne ET intouchée', () => {
  const t = DEFAULT_THRESHOLDS;
  // Ancienne mais reprise hier : on travaille dessus, donc silence.
  assert.deepEqual(
    kinds(run({ tasks: [task({ createdAt: daysAgo(200), updatedAt: daysAgo(1) })] })),
    [],
    'une tâche active ne doit pas remonter',
  );
  // Intouchée mais créée avant-hier : elle n'est pas encore en souffrance.
  assert.deepEqual(kinds(run({ tasks: [task({ createdAt: daysAgo(2), updatedAt: daysAgo(2) })] })), []);
  // La veille du seuil : rien.
  const veille = t.taskStaleDays - 1;
  assert.deepEqual(
    kinds(run({ tasks: [task({ createdAt: daysAgo(veille), updatedAt: daysAgo(veille) })] })),
    [],
  );
  // Le jour du seuil : alerte.
  const jour = t.taskStaleDays;
  const items = run({ tasks: [task({ createdAt: daysAgo(jour), updatedAt: daysAgo(jour) })] });
  assert.deepEqual(kinds(items), ['task-stale']);
  assert.equal(items[0].severity, 'info');
  assert.equal(items[0].evidence, 'ouverte depuis 21 jours, intouchée depuis 21 jours');
});

check('tâche : oubliée au-delà du second seuil', () => {
  const t = DEFAULT_THRESHOLDS;
  const before = run({ tasks: [task({ createdAt: daysAgo(200), updatedAt: daysAgo(t.taskForgottenDays - 1) })] });
  assert.equal(before[0].severity, 'info');
  const after = run({ tasks: [task({ createdAt: daysAgo(200), updatedAt: daysAgo(t.taskForgottenDays) })] });
  assert.equal(after[0].severity, 'warning');
  assert.ok(after[0].action.includes('fermer'));
});

check('tâche : une tâche faite ne remonte jamais', () => {
  assert.deepEqual(
    kinds(run({ tasks: [task({ status: 'done', createdAt: daysAgo(999), updatedAt: daysAgo(999) })] })),
    [],
  );
});

check('tâche : un titre vide ne produit pas « «  » n’avance plus »', () => {
  const items = run({ tasks: [task({ title: '', createdAt: daysAgo(90), updatedAt: daysAgo(90) })] });
  assert.ok(items[0].title.includes('Tâche sans titre'), items[0].title);
});

/* ---------------------------------- Clients -------------------------------- */

check('client : seul un client ACTIF peut être silencieux', () => {
  for (const status of ['prospect', 'paused']) {
    assert.deepEqual(kinds(run({ clients: [client({ status })] })), [], `statut ${status}`);
  }
  assert.deepEqual(kinds(run({ clients: [client({ status: 'active' })] })), ['client-silent']);
});

check('client : la trace la plus RÉCENTE fait foi, d’où qu’elle vienne', () => {
  const t = DEFAULT_THRESHOLDS;
  // Fiche ancienne, mais un rendez-vous la semaine dernière : rien à signaler.
  assert.deepEqual(
    kinds(run({ clients: [client({ createdAt: daysAgo(800), updatedAt: daysAgo(800), traces: [daysAgo(7)] })] })),
    [],
  );
  // La veille du seuil.
  assert.deepEqual(
    kinds(run({ clients: [client({ traces: [daysAgo(t.clientSilentDays - 1)] })] })),
    [],
  );
  // Le jour du seuil.
  const items = run({ clients: [client({ traces: [daysAgo(t.clientSilentDays)] })] });
  assert.deepEqual(kinds(items), ['client-silent']);
  assert.equal(items[0].evidence, 'dernier échange il y a 60 jours');
  assert.equal(items[0].severity, 'info');
});

check('client : une fiche créée hier n’est pas un client perdu', () => {
  assert.deepEqual(
    kinds(run({ clients: [client({ createdAt: daysAgo(1), updatedAt: daysAgo(1) })] })),
    [],
    'la création compte comme une trace',
  );
  // Le cas qui rend `createdAt` VRAIMENT porteur : une fiche sans date de
  // modification exploitable. Sans elle, la création est la seule trace —
  // et c'est elle qui doit décider, dans les deux sens.
  assert.deepEqual(
    kinds(run({ clients: [client({ createdAt: daysAgo(1), updatedAt: 'jamais' })] })),
    [],
    'créée hier, jamais modifiée : rien à signaler',
  );
  const old = run({ clients: [client({ createdAt: daysAgo(400), updatedAt: 'jamais' })] });
  assert.deepEqual(kinds(old), ['client-silent'], 'créée il y a plus d’un an et jamais touchée');
  assert.equal(old[0].evidence, 'dernier échange il y a 400 jours');
});

check('client : le silence prolongé passe en avertissement', () => {
  const t = DEFAULT_THRESHOLDS;
  const items = run({ clients: [client({ traces: [daysAgo(t.clientSilentDays * 2)] })] });
  assert.equal(items[0].severity, 'warning');
});

check('client : des traces illisibles ne font pas croire à un silence', () => {
  const items = run({
    clients: [{ id: 9, label: 'X', status: 'active', createdAt: '', updatedAt: '', traces: ['jamais'] }],
  });
  assert.deepEqual(kinds(items), [], 'aucune date exploitable → aucune affirmation');
});

/* -------------------------------- Certificats ------------------------------ */

check('certificat : les trois paliers, chacun sur son bord', () => {
  const t = DEFAULT_THRESHOLDS;
  // Au-delà de la fenêtre d'avertissement : silence.
  assert.deepEqual(kinds(run({ certificates: [cert({ daysLeft: t.certificateWarnDays + 1 })] })), []);
  // Avertissement.
  const warn = run({ certificates: [cert({ daysLeft: t.certificateWarnDays })] });
  assert.equal(warn[0].kind, 'certificate-expiring');
  assert.equal(warn[0].severity, 'warning');
  assert.equal(warn[0].evidence, 'expire dans 21 jours');
  // Encore avertissement juste au-dessus du seuil critique.
  assert.equal(run({ certificates: [cert({ daysLeft: t.certificateCriticalDays + 1 })] })[0].severity, 'warning');
  // Critique.
  const crit = run({ certificates: [cert({ daysLeft: t.certificateCriticalDays })] });
  assert.equal(crit[0].severity, 'critical');
  assert.equal(crit[0].evidence, 'dans 7 jours');
});

check('certificat : expiré aujourd’hui et expiré depuis', () => {
  const zero = run({ certificates: [cert({ daysLeft: 0 })] });
  assert.equal(zero[0].kind, 'certificate-expired');
  assert.equal(zero[0].severity, 'critical');
  assert.equal(zero[0].evidence, "expire aujourd'hui");

  const past = run({ certificates: [cert({ daysLeft: -3 })] });
  assert.equal(past[0].kind, 'certificate-expired');
  assert.equal(past[0].evidence, 'expiré depuis 3 jours');
  assert.ok(past[0].title.includes('EXPIRÉ'));
});

check('certificat : jamais vérifié ne veut PAS dire valide', () => {
  const items = run({ certificates: [cert({ daysLeft: null, lastCheckedAt: null })] });
  assert.deepEqual(kinds(items), [], 'aucune affirmation sur ce qu’on ignore');
});

check('certificat : une vérification en échec se dit, elle ne se tait pas', () => {
  const items = run({ certificates: [cert({ daysLeft: null, error: 'ETIMEDOUT' })] });
  assert.deepEqual(kinds(items), ['certificate-unknown']);
  assert.equal(items[0].severity, 'warning');
  assert.equal(items[0].evidence, 'ETIMEDOUT');
});

check('certificat : une erreur l’emporte sur un nombre de jours resté en cache', () => {
  // Le cas piège : le dernier relevé disait « 40 jours », la vérification
  // d'aujourd'hui échoue. Afficher « 40 jours, tout va bien » serait faux.
  const items = run({ certificates: [cert({ daysLeft: 40, error: 'ECONNREFUSED' })] });
  assert.deepEqual(kinds(items), ['certificate-unknown']);
});

/* ------------------------------- L'assemblage ------------------------------ */

check('le tri met le critique devant, puis le plus ancien', () => {
  const items = run({
    invoices: [
      invoice({ id: 'a', number: 'A', dueAt: daysAgo(2) }), // warning, 2 j
      invoice({ id: 'b', number: 'B', dueAt: daysAgo(90) }), // critical, 90 j
      invoice({ id: 'c', number: 'C', dueAt: daysAgo(40) }), // critical, 40 j
      invoice({ id: 'd', number: 'D', dueAt: inDays(3) }), // info
    ],
  });
  assert.deepEqual(
    items.map((i) => i.title.match(/Facture (\w)/)?.[1] ?? '?'),
    ['B', 'C', 'A', 'D'],
  );
});

check('le tri est stable : deux poids égaux se départagent par la clé', () => {
  const input = {
    invoices: [
      invoice({ id: 'zzz', number: 'Z', dueAt: daysAgo(10) }),
      invoice({ id: 'aaa', number: 'A', dueAt: daysAgo(10) }),
    ],
  };
  const first = run(input).map((i) => i.key);
  const second = run({ invoices: [...input.invoices].reverse() }).map((i) => i.key);
  assert.deepEqual(first, second, 'l’ordre d’entrée ne doit pas changer l’ordre de sortie');
});

check('les clés sont uniques et stables', () => {
  const items = run({
    invoices: [invoice({ id: 'i1' }), invoice({ id: 'i2', dueAt: inDays(2) })],
    tasks: [task({ id: 't1', createdAt: daysAgo(90), updatedAt: daysAgo(90) })],
    clients: [client({ id: 1 })],
    certificates: [cert({ daysLeft: 3 })],
  });
  const keys = items.map((i) => i.key);
  assert.equal(new Set(keys).size, keys.length, JSON.stringify(keys));
  assert.deepEqual(run({}).length, 0);
});

check('chaque élément porte son chiffre — jamais un adjectif seul', () => {
  const items = run({
    invoices: [invoice({ dueAt: daysAgo(45) })],
    tasks: [task({ createdAt: daysAgo(90), updatedAt: daysAgo(90) })],
    clients: [client({ traces: [daysAgo(120)] })],
    certificates: [cert({ daysLeft: 4 })],
  });
  assert.equal(items.length, 4);
  for (const entry of items) {
    assert.ok(entry.evidence.length > 0, `${entry.kind} sans preuve`);
    assert.ok(/\d/.test(entry.evidence), `${entry.kind} : « ${entry.evidence} » ne contient aucun chiffre`);
    assert.ok(entry.to.startsWith('/'), `${entry.kind} sans destination`);
    assert.ok(entry.title.length > 0);
  }
});

check('des seuils personnalisés sont réellement pris en compte', () => {
  const input = { invoices: [invoice({ dueAt: inDays(20) })] };
  assert.deepEqual(kinds(run(input)), [], 'hors fenêtre par défaut');
  assert.deepEqual(kinds(run(input, { invoiceDueSoonDays: 30 })), ['invoice-due-soon']);
});

check('attentionCounts compte par gravité', () => {
  const items = run({
    invoices: [invoice({ dueAt: daysAgo(60) }), invoice({ id: 'i2', dueAt: daysAgo(3) })],
    certificates: [cert({ daysLeft: 2 })],
    tasks: [task({ createdAt: daysAgo(25), updatedAt: daysAgo(25) })],
  });
  assert.deepEqual(attentionCounts(items), { critical: 2, warning: 1, info: 1 });
  assert.deepEqual(attentionCounts([]), { critical: 0, warning: 0, info: 0 });
});

check('une entrée vide ou absente ne fait rien exploser', () => {
  assert.deepEqual(run({}), []);
  assert.deepEqual(run({ invoices: [], tasks: [], clients: [], certificates: [] }), []);
});

/* --------------------------------------------------------------------------- */

check('un incident critique non pris remonte IMMEDIATEMENT', () => {
  /*
    Il n'y a pas de delai raisonnable pour « une attaque est en cours et
    personne n'a regarde ». Un seuil, meme court, ferait que la premiere heure
    d'une intrusion ne se voit nulle part.
  */
  const items = attentionItems(
    {
      incidents: [
        { id: 'i1', title: 'Campagne (2 techniques) — 203.0.113.9', severity: 'critical', status: 'new', firstSeenAt: new Date().toISOString() },
      ],
    },
    { now: new Date() },
  );
  assert.equal(items.length, 1, 'le critique doit remonter sans attendre');
  assert.equal(items[0].kind, 'incident-critical');
  assert.equal(items[0].severity, 'critical');
  assert.equal(items[0].to, '/supervision');
  assert.ok(items[0].evidence.length > 0, 'un point d’attention porte toujours son chiffre');
});

check('un incident PRIS EN CHARGE ne remonte pas, meme critique', () => {
  /*
    Quelqu'un s'est annonce. Le rappeler a l'accueil ferait douter de la prise
    en charge et transformerait le panneau en second journal.
  */
  const vieux = new Date(Date.now() - 72 * 3_600_000).toISOString();
  for (const status of ['acknowledged', 'resolved'] as const) {
    const items = attentionItems(
      { incidents: [{ id: 'i2', title: 'X', severity: 'critical', status, firstSeenAt: vieux }] },
      { now: new Date() },
    );
    assert.equal(items.length, 0, `un incident « ${status} » ne doit pas remonter`);
  }
});

check('un incident non critique attend le seuil avant de remonter', () => {
  const now = new Date();
  const ilYA = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
  const avec = (h: number) =>
    attentionItems(
      { incidents: [{ id: 'i3', title: 'Robot identifie', severity: 'warning', status: 'new', firstSeenAt: ilYA(h) }] },
      { now },
    );
  // Les deux bords du seuil, comme pour tous les autres seuils de ce moteur.
  assert.equal(avec(3.9).length, 0, 'avant le seuil : rien');
  assert.equal(avec(4.1).length, 1, 'apres le seuil : un point d’attention');
  assert.equal(avec(4.1)[0].kind, 'incident-stale');
  assert.equal(avec(4.1)[0].severity, 'warning', 'ce n’est pas critique, et ne doit pas le devenir');
});

check('une date d’incident illisible ne fabrique pas une attente absurde', () => {
  /*
    Une horloge de traceur de travers, un champ vide venu d'une version
    anterieure : la soustraction rendrait NaN, et « en attente depuis NaN
    jours » finirait a l'ecran.
  */
  for (const date of ['', 'pas-une-date', '0000-00-00']) {
    const items = attentionItems(
      { incidents: [{ id: 'i4', title: 'X', severity: 'critical', status: 'new', firstSeenAt: date }] },
      { now: new Date() },
    );
    assert.equal(items.length, 1);
    assert.ok(!/NaN|Infinity|undefined/.test(items[0].evidence), `evidence illisible : ${items[0].evidence}`);
  }
});

check('le critique passe DEVANT tout le reste', () => {
  /*
    Le tri par poids doit placer une attaque en cours au-dessus d'une facture
    en retard. Sans cela le panneau serait exact et inutile.
  */
  const items = attentionItems(
    {
      invoices: [invoice({ dueAt: daysAgo(90) })],
      incidents: [{ id: 'i5', title: 'Force brute', severity: 'critical', status: 'new', firstSeenAt: NOW.toISOString() }],
    },
    { now: NOW },
  );
  assert.ok(items.length >= 2, 'les deux sources doivent produire quelque chose');
  assert.equal(items[0].kind, 'incident-critical', `en tete : ${items[0].kind}`);
});

/* ═══════════ La salutation d'accueil n'a pas le droit d'affirmer ═══════════ */

interface SalutationModule {
  homeWelcome(name: string, now?: Date, serein?: boolean): string;
  GREETINGS_NEUTRES: Record<string, string[]>;
  GREETINGS_SEREINES: Record<string, string[]>;
}
const S = await loadFromSrc<SalutationModule>('src/lib/homeGreetings.ts');

/** Les mots par lesquels une phrase AFFIRME que tout va bien. */
const AFFIRMATIONS = [/calme/i, /tranquille/i, /en ordre/i, /dégagée?/i, /rien ne presse/i, /bouclée/i];

check('SALUTATION : sans certificat de calme, elle n’affirme RIEN', () => {
  /*
    LE DÉFAUT QUE CE CONTRÔLE FERME, vu sur une capture réelle :

        La nuit est calme, Aaron.
        12 sites hors ligne — à regarder
        21 points d'attention

    La première phrase que lit l'opérateur contredisait tout ce qui la suivait.
    Dans un produit de cybersécurité, un accueil qui rassure pendant que le
    parc brûle est pire qu'un accueil muet : il apprend à ne plus le croire, et
    le jour où il dit vrai personne ne l'écoute.

    Le paramètre `serein` vaut FAUX par défaut, exprès : un appelant qui
    l'oublie obtient une salutation neutre, jamais une fausse réassurance.
  */
  for (const [creneau, phrases] of Object.entries(S.GREETINGS_NEUTRES)) {
    for (const phrase of phrases) {
      for (const mot of AFFIRMATIONS) {
        assert.ok(
          !mot.test(phrase),
          `« ${phrase} » (${creneau}) affirme le calme alors qu’elle est rangée dans les NEUTRES`,
        );
      }
    }
  }

  // Et à toute heure, l'appel sans certificat ne peut rien produire d'autre.
  for (let h = 0; h < 24; h += 1) {
    const quand = new Date(2026, 7, 29, h, 30);
    const dite = S.homeWelcome('Aaron', quand);
    for (const mot of AFFIRMATIONS) {
      assert.ok(!mot.test(dite), `à ${h} h, sans certificat : « ${dite} »`);
    }
    assert.ok(dite.includes('Aaron'), `le prénom doit rester : « ${dite} »`);
  }
});

check('SALUTATION : le défaut du paramètre penche du bon côté', () => {
  /*
    La garantie qui compte à long terme : un troisième écran d'accueil, écrit
    dans six mois, qui appellerait `homeWelcome(nom, now)` sans réfléchir doit
    obtenir une phrase neutre. C'est ce qui distingue un défaut sûr d'un piège.
  */
  const quand = new Date(2026, 7, 29, 2, 0);
  const sansRien = S.homeWelcome('Aaron', quand);
  const explicitementFaux = S.homeWelcome('Aaron', quand, false);
  assert.equal(sansRien, explicitementFaux, 'omettre le paramètre doit valoir « pas serein »');
});

check('SALUTATION : quand c’est vraiment calme, elle a le droit de le dire', () => {
  /*
    Le TÉMOIN. Sans lui, les deux contrôles ci-dessus passeraient aussi bien si
    les variantes sereines avaient été supprimées — et l'accueil deviendrait
    plat tous les jours de l'année, ce qui n'était pas le but.
  */
  let trouvee = false;
  for (let h = 0; h < 24; h += 1) {
    const dite = S.homeWelcome('Aaron', new Date(2026, 7, 29, h, 30), true);
    if (AFFIRMATIONS.some((m) => m.test(dite))) trouvee = true;
  }
  assert.ok(trouvee, 'aucune variante sereine n’affirme quoi que ce soit — la famille est vide ?');

  // Et chaque créneau en a au moins une, sinon certaines heures perdraient
  // silencieusement la nuance.
  for (const [creneau, phrases] of Object.entries(S.GREETINGS_SEREINES)) {
    assert.ok(phrases.length > 0, `créneau sans variante sereine : ${creneau}`);
  }
});

if (failures.length > 0) {
  console.error(`\n${failures.length} contrôle(s) en échec :`);
  for (const name of failures) console.error(`  - ${name}`);
  process.exit(1);
}
console.log('\nPoints d’attention : tous les contrôles passent.');
