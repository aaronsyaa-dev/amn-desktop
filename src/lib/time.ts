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
