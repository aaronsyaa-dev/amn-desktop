import type { DerivedSite } from '../state/RemoteSitesContext';
import { moduleByKey } from '../data/trackerModules';

/**
 * A transparent security-posture score for a site, combining how much tracker
 * coverage is installed with how healthy the site currently is. Higher is
 * better. The formula is intentionally simple and explainable — every point is
 * traceable to a reason, so the comparator never shows a mysterious number.
 */
export interface PostureScore {
  score: number; // 0–100
  coverage: number; // 0–1 (share of max module coverage)
  reasons: string[];
  tone: 'good' | 'watch' | 'risk';
}

const MAX_COVERAGE = 1 + 2 + 3; // sentinel + sentinel-plus + suite tier weights
const RECENT_ALERT_MS = 24 * 60 * 60 * 1000;

export function postureScore(site: DerivedSite, installedKeys: string[]): PostureScore {
  const reasons: string[] = [];

  // Coverage: sum of installed module tier weights over the maximum.
  const coverageWeight = installedKeys.reduce((sum, key) => sum + (moduleByKey(key)?.tier ?? 0), 0);
  const coverage = coverageWeight / MAX_COVERAGE;
  if (installedKeys.length === 0) reasons.push('Aucun module installé');
  else if (coverage >= 1) reasons.push('Couverture complète');
  else reasons.push(`${installedKeys.length} module(s) actif(s)`);

  // Health from the derived site status.
  let health = 0.5;
  if (site.status === 'online') health = 1;
  else if (site.status === 'degraded') {
    health = 0.5;
    reasons.push('État dégradé');
  } else if (site.status === 'offline') {
    health = 0;
    reasons.push('Hors ligne');
  } else {
    health = 0.4;
    reasons.push('État inconnu');
  }

  // Recent incident penalty (real signal: last alert timestamp).
  let penalty = 0;
  const lastAlert = site.state?.lastAlertAt ? new Date(site.state.lastAlertAt).getTime() : null;
  if (lastAlert && Date.now() - lastAlert < RECENT_ALERT_MS) {
    penalty = 15;
    reasons.push('Alerte récente (24 h)');
  }

  const raw = 100 * (0.6 * coverage + 0.4 * health) - penalty;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  const tone: PostureScore['tone'] = score >= 70 ? 'good' : score >= 40 ? 'watch' : 'risk';
  return { score, coverage, reasons, tone };
}
