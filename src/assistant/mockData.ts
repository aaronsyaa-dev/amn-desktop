import type { RemoteEvent, WatchItem } from '../shared/api';
import type { DerivedSite } from '../state/RemoteSitesContext';
import { countRecentAlerts } from '../lib/eventStats';
import { remoteEventDetail, remoteEventLabel } from '../lib/remoteEventDisplay';
import type { DailySummary, Insight, ReportBlock, Suggestion } from './types';

type EventsMap = Record<string, RemoteEvent[]>;

function alertsFor(eventsBySite: EventsMap, siteId: string): RemoteEvent[] {
  return (eventsBySite[siteId] ?? []).filter((e) => e.type === 'security_alert');
}

/**
 * Free-text "daily brief" for the home QG: what happened since last visit and
 * what to focus on today. Grounded in real site state + event history (loaded
 * via RemoteSitesContext). Written to read like a short human/AI briefing
 * (used with a typewriter reveal in the UI).
 */
export function getDailyBrief(sites: DerivedSite[], eventsBySite: EventsMap): string {
  if (sites.length === 0) {
    return 'Aucun site enregistré pour l’instant. Enregistrez votre premier site depuis l’onglet Sites, puis installez le tracker pour commencer à recevoir des données en temps réel.';
  }

  const offline = sites.filter((s) => s.status === 'offline');
  const criticalCount = sites.reduce(
    (n, s) => n + alertsFor(eventsBySite, s.id).filter((e) => e.severity === 'critical').length,
    0,
  );
  const neverSeen = sites.filter((s) => s.status === 'unknown');
  const withRecentAlerts = sites
    .map((s) => ({ site: s, count: countRecentAlerts(eventsBySite[s.id] ?? []) }))
    .filter((x) => x.count === 0 && x.site.status === 'online');

  const parts: string[] = [];
  parts.push(
    criticalCount > 0
      ? `Depuis votre dernière visite, ${criticalCount} incident(s) critique(s) ont été détectés sur votre parc.`
      : `Aucun incident critique n’a été détecté sur votre parc depuis votre dernière visite.`,
  );
  if (offline.length > 0) {
    parts.push(`${offline.map((s) => s.name).join(', ')} nécessite une intervention immédiate.`);
  }
  if (neverSeen.length > 0) {
    parts.push(
      `${neverSeen.map((s) => s.name).join(', ')} n’a encore reçu aucun signal — vérifiez l’installation du tracker.`,
    );
  }
  if (withRecentAlerts.length > 0) {
    parts.push(
      `Côté positif, ${withRecentAlerts.map((x) => x.site.name).join(', ')} tourne sans la moindre alerte récente.`,
    );
  }
  const focus = offline.map((s) => `rétablir ${s.name}`);
  parts.push(
    focus.length > 0
      ? `Aujourd’hui, concentrez-vous sur : ${focus.join(' et ')}.`
      : `Aucune urgence aujourd’hui — bonne occasion pour traiter la dette de sécurité de fond.`,
  );
  return parts.join(' ');
}

/**
 * Automatic insights — surfaced even when nothing is wrong, so there is always
 * something worthwhile to read. Mixes positive signals with gentle nudges.
 */
export function getInsights(sites: DerivedSite[], eventsBySite: EventsMap): Insight[] {
  if (sites.length === 0) return [];

  const insights: Insight[] = [];

  const clean = sites.filter(
    (s) => s.status === 'online' && countRecentAlerts(eventsBySite[s.id] ?? []) === 0,
  );
  if (clean.length > 0) {
    insights.push({
      id: 'insight-clean',
      tone: 'positive',
      title: `${clean.length} site(s) sans la moindre alerte sur 24h`,
      body: `${clean.map((s) => s.name).join(', ')} tournent sans incident de sécurité récent. Votre supervision porte ses fruits.`,
    });
  }

  const busiest = [...sites].sort(
    (a, b) => (b.state?.activeVisitors ?? 0) - (a.state?.activeVisitors ?? 0),
  )[0];
  if (busiest && (busiest.state?.activeVisitors ?? 0) > 0) {
    insights.push({
      id: 'insight-traffic',
      tone: 'neutral',
      title: `${busiest.name} concentre le plus de visiteurs actifs`,
      body: `${busiest.state?.activeVisitors} visiteur(s) actif(s) en ce moment — le plus fréquenté de votre parc.`,
      siteId: busiest.id,
    });
  }

  const totalAlerts = sites.reduce(
    (n, s) => n + (eventsBySite[s.id]?.filter((e) => e.type === 'security_alert').length ?? 0),
    0,
  );
  if (totalAlerts > 0) {
    insights.push({
      id: 'insight-security',
      tone: 'neutral',
      title: `${totalAlerts} événement(s) de sécurité dans l’historique chargé`,
      body: 'Force brute, injections et autres tentatives interceptées par vos trackers, tous sites confondus.',
    });
  }

  return insights.slice(0, 3);
}

/** Today at ~07:15 local — simulates a summary that "arrived this morning". */
function thisMorningISO(): string {
  const d = new Date();
  d.setHours(7, 15, 0, 0);
  return d.toISOString();
}

/**
 * Builds the "Veille du jour" section of the daily summary, covering BOTH
 * categories (Bloc 4): the top cyber headline(s) and the top tech headline(s).
 * Returns [] when no watch items are available (e.g. browser fallback).
 */
function veilleBlocks(watchItems: WatchItem[]): ReportBlock[] {
  if (watchItems.length === 0) return [];
  const byDate = [...watchItems].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const cyber = byDate.filter((i) => (i.group ?? 'security') === 'security').slice(0, 2);
  const tech = byDate.filter((i) => (i.group ?? 'security') === 'tech').slice(0, 2);
  if (cyber.length === 0 && tech.length === 0) return [];

  const blocks: ReportBlock[] = [{ type: 'heading', text: 'Veille du jour' }];
  if (cyber.length) {
    blocks.push({ type: 'paragraph', text: 'Cybersécurité :' });
    blocks.push({ type: 'list', items: cyber.map((i) => `${i.title} — ${i.source}`) });
  }
  if (tech.length) {
    blocks.push({ type: 'paragraph', text: 'Actu monde tech :' });
    blocks.push({ type: 'list', items: tech.map((i) => `${i.title} — ${i.source}`) });
  }
  return blocks;
}

export function getDailySummary(
  sites: DerivedSite[],
  eventsBySite: EventsMap,
  watchItems: WatchItem[] = [],
): DailySummary {
  const online = sites.filter((s) => s.status === 'online').length;
  const offline = sites.filter((s) => s.status === 'offline');
  const degraded = sites.filter((s) => s.status === 'degraded');

  const overnightCritical = sites.flatMap((s) =>
    alertsFor(eventsBySite, s.id)
      .filter((e) => e.severity === 'critical')
      .map((event) => ({ site: s, event })),
  );

  const attention = [...offline, ...degraded].map((s) => s.name).join(', ');

  return {
    generatedAt: thisMorningISO(),
    headline:
      sites.length === 0
        ? 'Aucun site enregistré'
        : `${online}/${sites.length} sites opérationnels · ${overnightCritical.length} incident(s) critique(s)`,
    blocks: [
      {
        type: 'paragraph',
        text:
          sites.length === 0
            ? 'Aucun site enregistré pour l’instant. Enregistrez-en un depuis l’onglet Sites pour commencer.'
            : `Bonjour. Voici votre point de situation. Sur vos ${sites.length} sites, ${online} sont pleinement opérationnels. ${
                attention ? `Points de vigilance : ${attention}.` : 'Aucun point de vigilance majeur.'
              }`,
      },
      {
        type: 'kpis',
        items: [
          { label: 'Opérationnels', value: `${online}/${sites.length}`, tone: 'success' },
          {
            label: 'Incidents critiques',
            value: String(overnightCritical.length),
            tone: overnightCritical.length > 0 ? 'danger' : 'success',
          },
        ],
      },
      { type: 'heading', text: 'À traiter en priorité' },
      {
        type: 'list',
        items:
          overnightCritical.length > 0
            ? overnightCritical
                .slice(0, 4)
                .map(
                  ({ site, event }) =>
                    `${site.name} — ${remoteEventLabel(event)} : ${remoteEventDetail(event) || 'détail non précisé'}`,
                )
            : ['Rien d’urgent pour l’instant.'],
      },
      ...veilleBlocks(watchItems),
    ],
  };
}

/** Derives proactive suggestions from the current real state of the parc. */
export function getSuggestions(sites: DerivedSite[], eventsBySite: EventsMap): Suggestion[] {
  const suggestions: Suggestion[] = [];

  sites.forEach((site) => {
    if (site.status === 'offline') {
      suggestions.push({
        id: `sugg-offline-${site.id}`,
        title: `Rétablir ${site.name}`,
        detail: 'Le site est hors ligne : vérifier l’origine et relancer le service.',
        severity: 'critical',
        siteId: site.id,
      });
    }
    if (site.status === 'unknown') {
      suggestions.push({
        id: `sugg-unknown-${site.id}`,
        title: `Vérifier l’installation du tracker sur ${site.name}`,
        detail: 'Aucun heartbeat reçu — le tracker n’est peut-être pas installé ou configuré.',
        severity: 'warning',
        siteId: site.id,
      });
    }
    const bruteForce = alertsFor(eventsBySite, site.id).find((e) =>
      e.message?.includes('Force brute'),
    );
    if (bruteForce) {
      suggestions.push({
        id: `sugg-bf-${site.id}`,
        title: `Renforcer l’authentification de ${site.name}`,
        detail: 'Attaques par force brute détectées : envisager MFA + rate-limiting.',
        severity: 'warning',
        siteId: site.id,
      });
    }
  });

  const order = { critical: 0, warning: 1, info: 2 };
  return suggestions.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 5);
}

