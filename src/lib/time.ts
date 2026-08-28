/** Formats an ISO timestamp as a short French relative time, e.g. "il y a 2 h". */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const diffMs = now - new Date(iso).getTime();
  const sec = Math.round(diffMs / 1000);

  if (sec < 45) return "à l'instant";
  const min = Math.round(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `il y a ${weeks} sem`;
  const months = Math.round(days / 30);
  return `il y a ${months} mois`;
}

/**
 * L'INVERSE DE `relativeTime` — pour un instant À VENIR.
 *
 * `relativeTime` ne sait dire que le passé : sur une date future son écart est
 * négatif, donc plus petit que 45 secondes, donc elle répond « à l'instant ».
 * C'est ce qui s'affichait sur l'écran de sécurité d'une cliente, où chaque
 * session porte sa date d'expiration : « expire à l'instant », sur tous ses
 * appareils, y compris celui qu'elle avait sous les doigts. Une phrase à la
 * fois fausse et inquiétante, au seul endroit où elle vient justement se
 * rassurer.
 *
 * Deux fonctions plutôt qu'une qui devine : le passé et le futur ne se disent
 * pas avec les mêmes mots en français, et une seule fonction « intelligente »
 * finirait par écrire « dans -3 j ».
 */
export function futureTime(iso: string, now: number = Date.now()): string {
  const diffMs = new Date(iso).getTime() - now;
  if (!Number.isFinite(diffMs)) return '';
  // Déjà passé : on ne dit pas « dans 0 min », on dit que c'est fini.
  if (diffMs <= 0) return 'expirée';

  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return 'dans moins d’une minute';
  const min = Math.round(sec / 60);
  if (min < 60) return `dans ${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `dans ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `dans ${days} j`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `dans ${weeks} sem`;
  const months = Math.round(days / 30);
  return `dans ${months} mois`;
}

/** Compact currency for euros: 12 480 → "12,5 k€", 1 184 000 → "1,18 M€". */
export function compactEuro(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('fr-FR', {
      maximumFractionDigits: 2,
    })} M€`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toLocaleString('fr-FR', {
      maximumFractionDigits: 1,
    })} k€`;
  }
  return `${value.toLocaleString('fr-FR')} €`;
}

/** Full-precision euro formatting, e.g. "12 480 €". */
export function euro(value: number): string {
  return `${value.toLocaleString('fr-FR')} €`;
}

/**
 * Date + heure, format français court.
 *
 * Vivait en double : une copie locale dans SiteControlScreen, et le besoin est
 * revenu avec le bureau de supervision. Deux copies d'un formateur de date
 * finissent toujours par diverger d'un champ — et deux écrans qui datent la
 * même alerte différemment font douter des deux.
 */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
