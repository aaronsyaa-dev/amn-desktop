/**
 * LE PARRAINAGE PAR CODE — fusion « Programme de parrainage traçable par
 * code » → Parrainage (`23c`), chantier des cinquante.
 *
 * Chaque parrain a UN code, dérivé de son nom et stable : le même nom donne
 * toujours le même code, sans table à tenir. Un filleul qui arrive avec un
 * code retrouve son parrain par ce code, même si le nom a été écrit
 * autrement ce jour-là.
 */

const sansAccents = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Une empreinte courte et stable (FNV-1a), en base 36. */
function empreinte(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).toUpperCase().slice(-3).padStart(3, '0');
}

/** « Camille Roux » → « CAMILLE-4QK » : le prénom, puis trois signes qui distinguent les homonymes. */
export function codeParrain(nom: string): string {
  const cle = sansAccents(nom).replace(/\s+/g, ' ');
  const prenom = (cle.split(' ')[0] ?? '').replace(/[^a-z]/g, '').slice(0, 8).toUpperCase() || 'PARRAIN';
  return `${prenom}-${empreinte(cle)}`;
}

export interface LienParrainage {
  referrer: string;
  status: 'invite' | 'venu' | 'recompense';
  primeCents?: number;
}

/**
 * La prime DUE à un parrain : les filleuls venus, pas encore récompensés.
 * La prime d'un lien est figée le jour où le filleul vient — changer le
 * barème ensuite ne réécrit pas ce qui a été promis.
 */
export function primeDue(liens: LienParrainage[], parrain: string): number {
  const cle = sansAccents(parrain);
  return liens.filter((l) => sansAccents(l.referrer) === cle && l.status === 'venu').reduce((s, l) => s + (l.primeCents ?? 0), 0);
}
