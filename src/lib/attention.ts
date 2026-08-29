/**
 * Points d'attention — ce que l'application a remarqué toute seule.
 *
 * ## La règle qui gouverne ce fichier
 *
 * **Aucune alerte sans le chiffre qui l'a produite.** Chaque élément porte son
 * `evidence` : « échue depuis 34 jours », « sans nouvelle depuis 78 jours »,
 * « expire dans 6 jours ». Une alerte qui dit seulement « attention, client à
 * risque » n'est pas vérifiable, donc pas croyable, donc ignorée au bout de
 * trois jours — et une alerte ignorée est pire qu'absente, parce qu'elle
 * apprend à ignorer les suivantes.
 *
 * C'est aussi pour ça que rien ici n'est estimé, pondéré au jugé ou lissé : un
 * seuil, une date, une soustraction. `npm run check:attention` rejoue chaque
 * seuil sur ses deux bords.
 *
 * ## Ce que ce moteur ne fait PAS
 *
 * Il ne devine pas. Un certificat jamais vérifié ne produit rien du tout —
 * ni « valide » ni « à surveiller » — parce que l'application n'en sait rien,
 * et qu'afficher un silence comme un feu vert est la façon la plus efficace de
 * rater une expiration.
 *
 * Il n'a pas non plus d'état : aucune alerte n'est stockée, tout est recalculé
 * à l'affichage. Une alerte écrite en base serait fausse le lendemain, et il
 * faudrait un deuxième mécanisme pour l'effacer.
 *
 * ## Aucune dépendance
 *
 * Les entrées sont des formes minimales décrites ici plutôt que les types de
 * `shared/api` : le moteur reste utilisable des deux éditions — l'édition
 * Business n'a pas de certificats et passe simplement une liste vide — et
 * testable sans monter l'application.
 */

/* --------------------------------- Domaine -------------------------------- */

export type AttentionKind =
  | 'invoice-overdue'
  | 'invoice-due-soon'
  | 'task-stale'
  | 'client-silent'
  | 'certificate-expired'
  | 'certificate-expiring'
  | 'certificate-unknown'
  | 'incident-critical'
  | 'incident-stale';

export type AttentionSeverity = 'critical' | 'warning' | 'info';

export interface AttentionItem {
  /** Stable d'un rendu à l'autre : sert de clé React et de clé de déduplication. */
  key: string;
  kind: AttentionKind;
  severity: AttentionSeverity;
  /** Ce qui s'est passé, en une ligne. */
  title: string;
  /** Le chiffre qui a déclenché l'alerte. Jamais un adjectif seul. */
  evidence: string;
  /** Ce qu'il y a à faire. Vide quand il n'y a rien d'autre qu'à regarder. */
  action: string;
  /** Où aller pour agir. */
  to: string;
  /** Montant concerné, en centimes — mis en forme par l'affichage, pas ici. */
  amountCents?: number;
  /** Tri : décroissant. Composé de la gravité et de l'ancienneté du problème. */
  weight: number;
}

/**
 * Les seuils, tous nommés et tous justifiés.
 *
 * Ils vivent ici plutôt qu'en dur dans les règles pour deux raisons : le
 * contrôle peut les rejouer sur leurs deux bords, et une organisation qui
 * facture à 60 jours n'a pas les mêmes que celle qui facture à 8.
 */
export interface AttentionThresholds {
  /** Jours avant échéance à partir desquels une facture mérite un rappel. */
  invoiceDueSoonDays: number;
  /** Retard de paiement au-delà duquel le rappel devient critique. */
  invoiceSeriousDays: number;
  /** Heures au-delà desquelles un incident non critique qui attend remonte. */
  incidentStaleHours: number;
  /** Une tâche ouverte ET intouchée depuis ce nombre de jours ressort. */
  taskStaleDays: number;
  /** Au-delà, elle n'est plus « en attente » : elle est oubliée. */
  taskForgottenDays: number;
  /** Silence radio avec un client actif au-delà duquel on le signale. */
  clientSilentDays: number;
  /** Certificat : sous ce délai, on prévient. */
  certificateWarnDays: number;
  /** Certificat : sous ce délai, le renouvellement n'est plus optionnel. */
  certificateCriticalDays: number;
}

export const DEFAULT_THRESHOLDS: AttentionThresholds = {
  // Une semaine : le temps d'envoyer un rappel courtois avant l'échéance.
  invoiceDueSoonDays: 7,
  // Un mois de retard n'est plus un oubli, c'est un impayé.
  invoiceSeriousDays: 30,
  // Trois semaines sans y toucher : ce n'est plus « en cours ».
  taskStaleDays: 21,
  taskForgottenDays: 60,
  // Deux mois de silence avec un client ACTIF — pas un prospect.
  clientSilentDays: 60,
  // Let's Encrypt renouvelle à 30 jours ; prévenir à 21 laisse voir un
  // renouvellement automatique qui ne s'est PAS fait, sans crier avant.
  certificateWarnDays: 21,
  certificateCriticalDays: 7,
  /*
    Un incident CRITIQUE non pris en charge remonte tout de suite : il n'y a
    pas de délai acceptable pour « personne n'a encore regardé une attaque en
    cours ». Le seuil ci-dessous ne concerne donc que ce qui est MOINS grave.

    Quatre heures : assez pour qu'une alerte de nuit ne réveille pas l'écran
    d'accueil au premier café, assez court pour qu'une journée ne se termine
    pas avec un incident jamais ouvert.
  */
  incidentStaleHours: 4,
};

/* ------------------------------ Formes d'entrée ---------------------------- */

export interface AttentionInvoice {
  id: string;
  number: string;
  status: string;
  /** ISO jour ; vide tant que brouillon. */
  issuedAt: string;
  dueAt: string;
  clientName: string;
  totalCents: number;
}

export interface AttentionTask {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttentionClient {
  id: number;
  label: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  /** Toute date qui prouve un contact : événement de fiche, rendez-vous, facture… */
  traces: string[];
}

export interface AttentionCertificate {
  host: string;
  /** Jours restants ; `null` = jamais vérifié, ce qui n'est PAS « valide ». */
  daysLeft: number | null;
  error: string | null;
  lastCheckedAt: string | null;
}

export interface AttentionInput {
  invoices: AttentionInvoice[];
  tasks: AttentionTask[];
  clients: AttentionClient[];
  certificates: AttentionCertificate[];
  incidents: AttentionIncident[];
}

/**
 * Un incident de supervision ENCORE OUVERT.
 *
 * Volontairement réduit à quatre champs : le moteur n'a pas à connaître la
 * corrélation, les acteurs ni les alertes. Il répond à une seule question —
 * est-ce que ça attend depuis trop longtemps.
 */
export interface AttentionIncident {
  id: string;
  title: string;
  /**
   * Le site touché.
   *
   * Sans lui, trois pannes sur trois sites donnaient trois cartes identiques
   * au mot près. Le panneau d'attention sert à décider PAR QUOI COMMENCER : un
   * titre qui ne distingue pas deux lignes ne permet aucune décision.
   */
  siteName?: string | null;
  severity: 'critical' | 'warning' | 'info';
  status: 'new' | 'acknowledged' | 'resolved';
  /** Première alerte de l'incident, en ISO. C'est de là que court l'attente. */
  firstSeenAt: string;
}

/* -------------------------------- Le calendrier ---------------------------- */

const DAY_MS = 86_400_000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Le jour civil d'un horodatage, en `AAAA-MM-JJ`, ou `null` s'il est illisible.
 *
 * On ne garde QUE le jour : un « il y a 20,9 jours » qui bascule à 21 en
 * milieu d'après-midi ferait apparaître et disparaître des alertes au fil de
 * la journée, ce qui donne l'impression d'un outil instable.
 */
export function dayOf(timestamp: string): string | null {
  const match = ISO_DAY.exec(String(timestamp ?? ''));
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/**
 * Nombre de jours de `from` à `to`, positif si `to` est après.
 *
 * Passe par `Date.UTC` volontairement : une soustraction d'heures locales
 * donne 23 ou 25 heures les nuits de changement d'heure, donc un « il y a
 * 21 jours » qui vaut parfois 20 selon la saison.
 */
export function daysBetween(from: string, to: string): number | null {
  const a = dayOf(from);
  const b = dayOf(to);
  if (!a || !b) return null;
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS);
}

/** Le jour civil courant, dans le fuseau de la machine. `en-CA` est déjà l'ISO. */
export function today(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

/* --------------------------------- Les règles ------------------------------ */

/** Poids de base par gravité, pour que le critique passe toujours devant. */
const SEVERITY_WEIGHT: Record<AttentionSeverity, number> = {
  critical: 10_000,
  warning: 5_000,
  info: 1_000,
};

function item(
  base: Omit<AttentionItem, 'weight'>,
  /** L'ancienneté du problème, en jours : à gravité égale, le plus vieux passe devant. */
  age: number,
  /**
   * L'EXCEPTION À LA RÈGLE DE L'ANCIENNETÉ, et il n'y en a qu'une.
   *
   * « À gravité égale, le plus vieux passe devant » est la bonne règle pour
   * des dettes : une facture impayée depuis trois mois est plus urgente qu'une
   * facture impayée depuis un mois. Elle est FAUSSE pour ce qui est en train de
   * se produire.
   *
   * Mesuré en écrivant le contrôle : une facture en retard de 90 jours passait
   * devant une intrusion détectée à l'instant, parce que les deux sont
   * « critiques » et que la facture est plus vieille. Les deux étaient bien
   * affichées, mais dans le mauvais ordre — et sur un panneau qu'on parcourt
   * en trois secondes, l'ordre EST le message.
   *
   * Une facture attend depuis trois mois : une heure de plus ne change rien.
   * Une attaque en cours, si.
   */
  urgenceVive = false,
): AttentionItem {
  const poids = SEVERITY_WEIGHT[base.severity] + Math.min(age, 999);
  return { ...base, weight: urgenceVive ? poids + 10_000 : poids };
}

function invoiceItems(
  invoices: AttentionInvoice[],
  day: string,
  t: AttentionThresholds,
): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const invoice of invoices) {
    // Seule une facture ÉMISE et non encaissée peut être en retard. Un
    // brouillon n'a pas d'échéance, une annulée n'en a plus, une payée non plus.
    if (invoice.status !== 'issued') continue;
    const late = daysBetween(invoice.dueAt, day);
    if (late === null) continue;

    const who = invoice.clientName || 'client sans nom';
    if (late > 0) {
      const serious = late >= t.invoiceSeriousDays;
      out.push(
        item(
          {
            key: `invoice-overdue:${invoice.id}`,
            kind: 'invoice-overdue',
            severity: serious ? 'critical' : 'warning',
            title: `Facture ${invoice.number} impayée — ${who}`,
            evidence: `échue depuis ${plural(late, 'jour')}`,
            action: serious ? 'Relancer ou mettre en demeure' : 'Relancer',
            to: '/facturation',
            amountCents: invoice.totalCents,
          },
          late,
        ),
      );
    } else if (-late <= t.invoiceDueSoonDays) {
      const inDays = -late;
      out.push(
        item(
          {
            key: `invoice-due-soon:${invoice.id}`,
            kind: 'invoice-due-soon',
            severity: 'info',
            title: `Facture ${invoice.number} à échoir — ${who}`,
            evidence:
              inDays === 0 ? "échéance aujourd'hui" : `échéance dans ${plural(inDays, 'jour')}`,
            action: 'Un rappel maintenant évite la relance après',
            to: '/facturation',
            amountCents: invoice.totalCents,
          },
          t.invoiceDueSoonDays - inDays,
        ),
      );
    }
  }
  return out;
}

function taskItems(tasks: AttentionTask[], day: string, t: AttentionThresholds): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const task of tasks) {
    if (task.status === 'done') continue;
    const openFor = daysBetween(task.createdAt, day);
    const untouched = daysBetween(task.updatedAt || task.createdAt, day);
    if (openFor === null || untouched === null) continue;
    // Les DEUX conditions, pas l'une ou l'autre. Une tâche ancienne mais
    // modifiée hier est une tâche sur laquelle on travaille : la signaler
    // apprendrait à ignorer la liste.
    if (openFor < t.taskStaleDays || untouched < t.taskStaleDays) continue;

    const forgotten = untouched >= t.taskForgottenDays;
    out.push(
      item(
        {
          key: `task-stale:${task.id}`,
          kind: 'task-stale',
          severity: forgotten ? 'warning' : 'info',
          title: `« ${task.title || 'Tâche sans titre'} » n'avance plus`,
          evidence: `ouverte depuis ${plural(openFor, 'jour')}, intouchée depuis ${plural(untouched, 'jour')}`,
          action: forgotten ? 'La faire, la déléguer ou la fermer' : 'Reprendre ou replanifier',
          to: '/tasks',
        },
        untouched,
      ),
    );
  }
  return out;
}

function clientItems(
  clients: AttentionClient[],
  day: string,
  t: AttentionThresholds,
): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const client of clients) {
    // Un prospect qu'on n'a pas rappelé n'est pas la même chose qu'un client
    // qui s'éteint, et un client en pause est silencieux par construction.
    if (client.status !== 'active') continue;

    // La création compte comme une trace : une fiche ouverte hier et encore
    // vide n'est pas un client perdu.
    const candidates = [client.createdAt, client.updatedAt, ...client.traces]
      .map((d) => dayOf(d))
      .filter((d): d is string => d !== null);
    if (candidates.length === 0) continue;
    const last = candidates.reduce((a, b) => (a > b ? a : b));

    const silent = daysBetween(last, day);
    if (silent === null || silent < t.clientSilentDays) continue;

    out.push(
      item(
        {
          key: `client-silent:${client.id}`,
          kind: 'client-silent',
          severity: silent >= t.clientSilentDays * 2 ? 'warning' : 'info',
          title: `${client.label} — plus de nouvelles`,
          evidence: `dernier échange il y a ${plural(silent, 'jour')}`,
          action: 'Un message suffit souvent à relancer la relation',
          to: '/clients',
        },
        silent,
      ),
    );
  }
  return out;
}

function certificateItems(
  certificates: AttentionCertificate[],
  t: AttentionThresholds,
): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const cert of certificates) {
    if (cert.error) {
      // On ne SAIT pas. C'est une information en soi, et elle ne doit surtout
      // pas se confondre avec « tout va bien ».
      out.push(
        item(
          {
            key: `certificate-unknown:${cert.host}`,
            kind: 'certificate-unknown',
            severity: 'warning',
            title: `Certificat de ${cert.host} — vérification impossible`,
            evidence: cert.error,
            action: 'Le site répond-il encore en HTTPS ?',
            to: '/ssl',
          },
          0,
        ),
      );
      continue;
    }
    // Jamais vérifié : rien n'est affiché. Un silence présenté comme un feu
    // vert est exactement ce qui fait rater une expiration. Le `typeof` écarte
    // `null`, `Number.isFinite` écarte `NaN` — les deux mènent ici au même
    // refus d'affirmer quoi que ce soit.
    if (typeof cert.daysLeft !== 'number' || !Number.isFinite(cert.daysLeft)) continue;

    const left = Math.trunc(cert.daysLeft);
    if (left <= 0) {
      out.push(
        item(
          {
            key: `certificate-expired:${cert.host}`,
            kind: 'certificate-expired',
            severity: 'critical',
            title: `Certificat de ${cert.host} EXPIRÉ`,
            evidence: left === 0 ? "expire aujourd'hui" : `expiré depuis ${plural(-left, 'jour')}`,
            action: 'Le site affiche un avertissement de sécurité aux visiteurs',
            to: '/ssl',
          },
          -left,
        ),
      );
    } else if (left <= t.certificateCriticalDays) {
      out.push(
        item(
          {
            key: `certificate-expiring:${cert.host}`,
            kind: 'certificate-expiring',
            severity: 'critical',
            title: `Certificat de ${cert.host} expire bientôt`,
            evidence: `dans ${plural(left, 'jour')}`,
            action: 'Renouveler maintenant',
            to: '/ssl',
          },
          t.certificateWarnDays - left,
        ),
      );
    } else if (left <= t.certificateWarnDays) {
      out.push(
        item(
          {
            key: `certificate-expiring:${cert.host}`,
            kind: 'certificate-expiring',
            severity: 'warning',
            title: `Certificat de ${cert.host} à renouveler`,
            evidence: `expire dans ${plural(left, 'jour')}`,
            action: 'Vérifier que le renouvellement automatique fonctionne',
            to: '/ssl',
          },
          t.certificateWarnDays - left,
        ),
      );
    }
  }
  return out;
}

/* ------------------------------- L'assemblage ------------------------------ */

/**
 * Tout ce qui mérite un regard, du plus urgent au moins urgent.
 *
 * `now` est un paramètre et non `new Date()` en dur : c'est ce qui rend chaque
 * seuil rejouable sur ses deux bords par le contrôle.
 */
/**
 * LES INCIDENTS QUI ATTENDENT.
 *
 * Une file de supervision qu'il faut penser à ouvrir est une file qu'on ouvre
 * à neuf heures. Le point d'attention est ce qui la ramène là où les yeux vont
 * déjà — l'accueil.
 *
 * Deux règles, et la distinction entre les deux est le cœur du sujet :
 *
 *   · un incident CRITIQUE que personne n'a pris remonte immédiatement. Il n'y
 *     a pas de délai raisonnable pour « une attaque est en cours et personne
 *     n'a regardé » ;
 *   · tout autre incident ouvert remonte après quelques heures d'attente.
 *
 * Ce qui est PRIS EN CHARGE ne remonte pas, même critique. Quelqu'un s'est
 * annoncé ; le rappeler à l'accueil ferait douter de la prise en charge, et
 * transformerait le panneau en second journal — exactement ce qu'on cherche à
 * éviter.
 */
function incidentItems(
  incidents: AttentionIncident[],
  t: AttentionThresholds,
  now: Date,
): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const incident of incidents) {
    if (incident.status !== 'new') continue;

    const attenteMs = now.getTime() - Date.parse(incident.firstSeenAt);
    // Une date illisible ne doit pas fabriquer une attente de plusieurs
    // millions d'heures : on la traite comme « à l'instant ».
    const heures = Number.isFinite(attenteMs) && attenteMs > 0 ? attenteMs / 3_600_000 : 0;
    const jours = heures / 24;

    if (incident.severity === 'critical') {
      out.push(
        item(
          {
            key: `incident-critical:${incident.id}`,
            kind: 'incident-critical',
            severity: 'critical',
            /*
              Le site D'ABORD : c'est ce qui distingue deux lignes, et le titre
              d'une panne d'infrastructure est le même partout.

              Séparé par un point médian et non un tiret : le titre en contient
              déjà un (« Site injoignable — sonde et traceur muets »), et deux
              tirets dans la même phrase la rendent illisible.
            */
            title: incident.siteName ? `${incident.siteName} · ${incident.title}` : incident.title,
            evidence:
              heures < 1
                ? 'Détecté à l’instant, personne ne l’a encore pris'
                : `Non pris en charge depuis ${formatAttente(heures)}`,
            action: 'Ouvrir le bureau de supervision',
            to: '/supervision',
          },
          jours,
          // Ce qui se produit MAINTENANT passe devant ce qui traîne.
          true,
        ),
      );
      continue;
    }

    if (heures >= t.incidentStaleHours) {
      out.push(
        item(
          {
            key: `incident-stale:${incident.id}`,
            kind: 'incident-stale',
            severity: 'warning',
            title: incident.siteName ? `${incident.siteName} · ${incident.title}` : incident.title,
            evidence: `En attente depuis ${formatAttente(heures)}`,
            action: 'Ouvrir le bureau de supervision',
            to: '/supervision',
          },
          jours,
        ),
      );
    }
  }
  return out;
}

/** Une attente en heures, dite comme on la dirait à voix haute. */
function formatAttente(heures: number): string {
  if (heures < 1) return 'moins d’une heure';
  if (heures < 24) return `${Math.round(heures)} h`;
  const j = Math.round(heures / 24);
  return `${j} jour${j > 1 ? 's' : ''}`;
}

export function attentionItems(
  input: Partial<AttentionInput>,
  options: { now?: Date; thresholds?: Partial<AttentionThresholds> } = {},
): AttentionItem[] {
  const t = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
  const day = today(options.now ?? new Date());

  const items = [
    ...invoiceItems(input.invoices ?? [], day, t),
    ...taskItems(input.tasks ?? [], day, t),
    ...clientItems(input.clients ?? [], day, t),
    ...certificateItems(input.certificates ?? [], t),
    ...incidentItems(input.incidents ?? [], t, options.now ?? new Date()),
  ];

  // Tri stable : le poids décide, la clé départage. Sans le second critère,
  // deux alertes de même poids pourraient permuter d'un rendu à l'autre et la
  // liste bougerait sous le curseur.
  return items.sort((a, b) => b.weight - a.weight || a.key.localeCompare(b.key));
}

/** Combien d'éléments par gravité — pour une pastille de compteur. */
export function attentionCounts(items: AttentionItem[]): Record<AttentionSeverity, number> {
  const counts: Record<AttentionSeverity, number> = { critical: 0, warning: 0, info: 0 };
  for (const entry of items) counts[entry.severity] += 1;
  return counts;
}
