/**
 * LES SOURCES RÉELLES DES NOTIFICATIONS (H40) — de quoi les dériver, rien d'inventé.
 * ═════════════════════════════════════════════════════════════════════════════════
 *
 * Il n'existe ni page ni magasin de notifications dans l'application : la seule liste proche est celle des points
 * d'attention (`useAttention`, recalculée à chaque fois, sans date). Ce fichier traduit, sans React et sans
 * réseau, quatre sources vers le modèle de `modele.ts` :
 *
 *   1. les POINTS D'ATTENTION  (`AttentionItem`)  — clé stable, gravité, route ; la date est « la première fois vue »
 *      (le magasin la pose) ;
 *   2. les MESSAGES PRIVÉS non lus — un par correspondant, type « mention » ;
 *   3. les RENDEZ-VOUS qui commencent dans l'heure (collection `appointments`) — le bus n'émet pas encore
 *      `rdv.proche`, et un type entier de la matrice resterait sans ligne ;
 *   4. les MOMENTS du bus (`src/socle/moments.ts`) qui valent une notification.
 *
 * Ce que ces sources ne disent pas : le STOCK sous le seuil (aucune source), le DEVIS signé (`devis.accepte` existe au
 * catalogue mais rien ne l'émet), les MENTIONS dans un fil d'équipe (seuls les messages privés sont lus). Les types
 * correspondants sont prévus au modèle et se rempliront le jour où un émetteur existera.
 *
 * Sécurité : le texte d'une alerte de sécurité est TOUJOURS le nôtre, court, sans adresse, sans nom de site ni
 * identifiant de compte (les titres du moteur d'attention en contiennent : on ne les reprend pas). Même l'identifiant
 * stocké est un empreinte, jamais le nom d'hôte.
 */
import type { AttentionKind, AttentionSeverity } from '../../../lib/attention';
import type { Famille } from '../../../socle/familles';
import type { Moment } from '../../../socle/moments';
import { iconeDe, heureHorloge, type NotificationBrute, type NotificationSource, type TypeNotification } from './modele';
import type { Traduire } from './i18n';

/** Une empreinte courte et stable (FNV-1a, 32 bits) : de quoi nommer sans révéler. */
export function empreinte(texte: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i += 1) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

const REGLE_VIDE = (s: string): string => s.replace(/\s+/g, ' ').trim();

/* ── 1. Les points d'attention ───────────────────────────────────────────── */

/** Ce que ce fichier lit d'un `AttentionItem` : la forme minimale, pour ne dépendre que de ce qui sert. */
export interface PointDAttention {
  key: string;
  kind: AttentionKind;
  severity: AttentionSeverity;
  title: string;
  evidence: string;
  to: string;
}

type Nature = 'ticket' | 'paiement' | 'securite' | 'rendez-vous' | 'activite';

interface FicheKind {
  nature: Nature;
  famille: Famille;
  module: string | null;
}

/** Pour chaque genre de point d'attention : sa nature, la famille de son module d'origine, ce module. */
export const FICHES_ATTENTION: Readonly<Record<AttentionKind, FicheKind>> = {
  'project-late': { nature: 'ticket', famille: 'jour', module: 'projects' },
  'project-validation': { nature: 'ticket', famille: 'jour', module: 'projects' },
  'task-stale': { nature: 'ticket', famille: 'jour', module: 'tasks' },
  'leave-pending': { nature: 'activite', famille: 'echanger', module: 'leaves' },
  'booking-conflict': { nature: 'rendez-vous', famille: 'jour', module: 'agenda' },
  'vehicle-due': { nature: 'activite', famille: 'creer', module: null },
  'invoice-overdue': { nature: 'paiement', famille: 'argent', module: 'invoices' },
  'invoice-due-soon': { nature: 'paiement', famille: 'argent', module: 'invoices' },
  'client-silent': { nature: 'activite', famille: 'contacts', module: 'clients' },
  'certificate-expired': { nature: 'securite', famille: 'outils', module: null },
  'certificate-expiring': { nature: 'securite', famille: 'outils', module: null },
  'certificate-unknown': { nature: 'securite', famille: 'outils', module: null },
  'incident-critical': { nature: 'securite', famille: 'outils', module: null },
  'incident-stale': { nature: 'securite', famille: 'outils', module: null },
  'scan-regression': { nature: 'securite', famille: 'outils', module: null },
};

/**
 * Le type d'un point d'attention. Un ticket (tâche, projet) n'est « Tickets urgents » que lorsqu'il est critique ;
 * moins grave, c'est de l'activité de l'équipe — la ligne « Tickets urgents » ne doit pas porter une tâche oubliée.
 */
export function typeDePoint(kind: AttentionKind, severity: AttentionSeverity): TypeNotification {
  const { nature } = FICHES_ATTENTION[kind];
  if (nature === 'ticket') return severity === 'critical' ? 'urgent' : 'activite';
  return nature;
}

/** L'élément visé par la clé du moteur (`invoice-overdue:<id>`, `task-stale:<id>`, `client-silent:<id>`) : le deep-link. */
export function versDePoint(point: Pick<PointDAttention, 'key' | 'kind' | 'to'>): { route: string; state?: Record<string, string | number> } {
  const cible = point.key.slice(point.key.indexOf(':') + 1);
  if (!cible || point.key.indexOf(':') < 0) return { route: point.to };
  switch (point.kind) {
    case 'invoice-overdue':
    case 'invoice-due-soon':
      return { route: '/facturation', state: { openInvoiceId: cible } };
    case 'task-stale':
      return { route: '/tasks', state: { openTaskId: cible } };
    case 'client-silent': {
      const id = Number(cible);
      return Number.isFinite(id) ? { route: '/clients', state: { focusClientId: id } } : { route: point.to };
    }
    default:
      return { route: point.to };
  }
}

function texteSecurite(kind: AttentionKind, t: Traduire): { titre: string; detail: string } {
  const detail = t('att.securite.detail');
  if (kind.startsWith('certificate')) return { titre: t('att.securite.certificat'), detail };
  if (kind === 'incident-critical') return { titre: t('att.securite.incident'), detail };
  if (kind === 'incident-stale') return { titre: t('att.securite.incident.attente'), detail };
  return { titre: t('att.securite.balayage'), detail };
}

export function attentionVersNotifications(points: readonly PointDAttention[], t: Traduire): NotificationSource[] {
  const vus = new Set<string>();
  const out: NotificationSource[] = [];
  for (const p of points) {
    const fiche = FICHES_ATTENTION[p.kind];
    if (!fiche) continue;
    const securite = fiche.nature === 'securite';
    // La clé d'une alerte de sécurité porte un nom d'hôte ou un identifiant : on n'en garde que l'empreinte.
    const id = securite ? `att:${p.kind}:${empreinte(p.key)}` : `att:${p.key}`;
    if (vus.has(id)) continue;
    vus.add(id);
    const type = typeDePoint(p.kind, p.severity);
    const { titre, detail } = securite ? texteSecurite(p.kind, t) : { titre: p.title, detail: p.evidence };
    out.push({
      id,
      type,
      titre,
      detail,
      vers: securite ? { route: p.to } : versDePoint(p),
      urgente: p.severity === 'critical',
      famille: fiche.famille,
      icone: iconeDe(type),
      module: fiche.module,
    });
  }
  return out;
}

/* ── 2. Les messages privés non lus ──────────────────────────────────────── */

export interface MessagesDunCorrespondant {
  /** L'adresse du correspondant : sert au lien, jamais stockée (l'identifiant est une empreinte). */
  email: string;
  nom: string;
  nombre: number;
  /** Le début du plus récent, pour la ligne de détail. */
  apercu: string;
  /** ISO du plus récent. */
  date: string;
}

const APERCU_MAX = 90;

export function messagesVersNotifications(entrees: readonly MessagesDunCorrespondant[], t: Traduire): NotificationSource[] {
  return entrees
    .filter((e) => e.nombre > 0 && e.email)
    .map((e) => {
      const texte = REGLE_VIDE(e.apercu);
      const apercu = texte.length > APERCU_MAX ? `${texte.slice(0, APERCU_MAX - 1).trimEnd()}…` : texte;
      return {
        id: `dm:${empreinte(e.email)}`,
        type: 'mention' as const,
        titre: e.nombre === 1 ? t('dm.un', { nom: e.nom }) : t('dm.n', { nom: e.nom, n: e.nombre }),
        detail: apercu ? `« ${apercu} »` : t('dm.ouvrir'),
        vers: { route: `/messages-prives?avec=${encodeURIComponent(e.email)}` },
        date: e.date,
        urgente: false,
        famille: 'echanger' as const,
        icone: iconeDe('mention'),
        module: 'dm',
      };
    });
}

/* ── 3. Les rendez-vous qui approchent ───────────────────────────────────── */

export interface RendezVousLu {
  id: string;
  title: string;
  startAt: string;
  clientName: string;
  location: string;
  status: string;
}

/** Un rendez-vous compte à partir de 60 minutes avant son début. */
export const FENETRE_RENDEZ_VOUS_MIN = 60;

const MAJUSCULE = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function rendezVousVersNotifications(rdvs: readonly RendezVousLu[], maintenant: Date, t: Traduire, locale = 'fr-FR'): NotificationSource[] {
  const out: NotificationSource[] = [];
  for (const r of rdvs) {
    if (r.status !== 'scheduled') continue;
    const debut = new Date(r.startAt);
    const ecart = debut.getTime() - maintenant.getTime();
    if (Number.isNaN(ecart) || ecart < 0 || ecart > FENETRE_RENDEZ_VOUS_MIN * 60_000) continue;
    const minutes = Math.ceil(ecart / 60_000);
    const nom = (r.clientName || r.title || '').trim();
    const titre =
      minutes <= 0
        ? t(nom ? 'rdv.maintenant' : 'rdv.sansNom.maintenant', { nom })
        : minutes === 1
          ? t(nom ? 'rdv.dans.un' : 'rdv.sansNom.dans.un', { nom })
          : t(nom ? 'rdv.dans' : 'rdv.sansNom.dans', { nom, n: minutes });
    // « 11:00, salle clients » (v3) ; le jour n'est dit que si le rendez-vous tombe demain (juste après minuit).
    const memeJour = debut.toDateString() === maintenant.toDateString();
    const jour = memeJour ? '' : `${MAJUSCULE(new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(debut))} `;
    const lieu = r.location.trim();
    out.push({
      id: `rdv:${r.id}`,
      type: 'rendez-vous',
      titre,
      detail: `${jour}${heureHorloge(debut, locale)}${lieu ? `, ${lieu}` : ''}`,
      echeance: debut.toISOString(),
      vers: { route: '/agenda' },
      urgente: false,
      famille: 'jour',
      icone: iconeDe('rendez-vous'),
      module: 'agenda',
    });
  }
  return out;
}

/* ── 4. Les moments du bus ───────────────────────────────────────────────── */

/** Les types de moments qui valent une notification ; les autres (fêtes, synchro, sauvegarde…) n'en sont pas. */
export const MOMENTS_NOTIFIANTS = [
  'facture.payee',
  'devis.accepte',
  'client.cree',
  'rdv.proche',
  'message.recu',
  'tentative.suspecte',
  'garde.escalade',
  'garde.remontee-critique',
  'site.muet',
] as const;

/**
 * Un moment du bus en notification, ou `null` s'il n'en vaut pas. Le bus ne porte que des identifiants : les textes
 * sont génériques et mènent à l'élément, où le détail se lit. La date est celle de l'émission.
 */
export function momentVersNotification(moment: Pick<Moment, 'type' | 'quand'> & { charge: unknown }, t: Traduire): NotificationBrute | null {
  const date = new Date(moment.quand).toISOString();
  const base = (type: TypeNotification, famille: Famille, module: string | null) => ({ type, famille, module, icone: iconeDe(type), date });
  const id = `ev:${moment.type}:${empreinte(JSON.stringify(moment.charge ?? null))}:${moment.quand.toString(36)}`;
  const charge = (moment.charge ?? {}) as Record<string, unknown>;
  switch (moment.type) {
    case 'facture.payee': {
      const facture = String(charge.factureId ?? '');
      return { id, ...base('paiement', 'argent', 'invoices'), titre: t('evt.facture.titre'), detail: t('evt.facture.detail'), vers: facture ? { route: '/facturation', state: { openInvoiceId: facture } } : { route: '/facturation' }, urgente: false };
    }
    case 'devis.accepte':
      return { id, ...base('devis', 'argent', 'invoices'), titre: t('evt.devis.titre'), detail: t('evt.devis.detail'), vers: { route: '/facturation/devis' }, urgente: false };
    case 'client.cree': {
      const client = Number(charge.clientId);
      return { id, ...base('client', 'contacts', 'clients'), titre: t('evt.client.titre'), detail: t('evt.client.detail'), vers: Number.isFinite(client) && charge.clientId !== '' ? { route: '/clients', state: { focusClientId: client } } : { route: '/clients' }, urgente: false };
    }
    case 'rdv.proche': {
      const minutes = Math.max(1, Math.round(Number(charge.dansMinutes) || 1));
      return {
        // Même identifiant que la source des rendez-vous : une seule ligne quand les deux le disent.
        id: `rdv:${String(charge.rdvId ?? id)}`,
        ...base('rendez-vous', 'jour', 'agenda'),
        titre: minutes === 1 ? t('evt.rdv.titre.un') : t('evt.rdv.titre', { n: minutes }),
        detail: t('evt.rdv.detail'),
        vers: { route: '/agenda' },
        echeance: new Date(moment.quand + minutes * 60_000).toISOString(),
        urgente: false,
      };
    }
    case 'message.recu': {
      const fil = String(charge.conversationId ?? '');
      return { id, ...base('mention', 'echanger', 'dm'), titre: t('evt.message.titre'), detail: t('evt.message.detail'), vers: { route: fil.includes('@') ? `/messages-prives?avec=${encodeURIComponent(fil)}` : '/messages-prives' }, urgente: false };
    }
    case 'tentative.suspecte':
      return {
        id,
        ...base('securite', 'outils', null),
        titre: charge.origine === 'connexion' ? t('evt.tentative.connexion') : t('evt.tentative.autre'),
        detail: t('evt.securite.detail'),
        vers: { route: '/supervision' },
        // La maquette la montre sans le drapeau « Urgent » : La Garde l'a déjà gérée.
        urgente: false,
      };
    case 'garde.escalade':
      return { id, ...base('securite', 'outils', null), titre: t('evt.escalade'), detail: t('evt.securite.detail'), vers: { route: '/garde' }, urgente: true };
    case 'garde.remontee-critique':
      return { id, ...base('securite', 'outils', null), titre: t('evt.remontee'), detail: t('evt.securite.detail'), vers: { route: '/garde' }, urgente: true };
    case 'site.muet':
      return { id, ...base('securite', 'outils', null), titre: t('evt.siteMuet'), detail: t('evt.securite.detail'), vers: { route: '/supervision' }, urgente: false };
    default:
      return null;
  }
}

/**
 * Réunit les sources en une liste sans doublon d'identifiant. Les sources dérivées (attention, messages, rendez-vous) passent
 * avant les événements : elles se recalculent et disent donc le vrai état du moment.
 */
export function reunir(...listes: ReadonlyArray<readonly NotificationSource[]>): NotificationSource[] {
  const vus = new Set<string>();
  const out: NotificationSource[] = [];
  for (const liste of listes) {
    for (const n of liste) {
      if (vus.has(n.id)) continue;
      vus.add(n.id);
      out.push(n);
    }
  }
  return out;
}
