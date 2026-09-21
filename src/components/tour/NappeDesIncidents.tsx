import React, { useEffect, useMemo, useState } from 'react';
import { useHaloSignal } from '../EtatEcran';
import { bridge } from '../../lib/bridge';
import { useOrgContext } from '../../state/OrgContextContext';
import type { Incident } from '../../shared/api';

/**
 * PARC · SUPERVISION — la nappe.
 *
 * Trente jours d'incidents OUVERTS en trois aires empilées qui coulent de
 * gauche à droite. Un compteur dit « 204 ouverts » ; la nappe dit QUAND ça a
 * gonflé, CE QUI a gonflé, et que ça n'est pas redescendu.
 *
 * La couche critique est posée EN BAS, CONTRE L'AXE, pour qu'elle ne soit
 * jamais déformée par les couches au-dessus : c'est la seule qu'on lit à sa
 * vraie hauteur.
 *
 * LES TROIS GRAVITÉS SONT CELLES DE LA FILE DU PARC — `critical` /
 * `warning` / `info`, rendues « Critiques / Avertissements / Informations ».
 * PAS celle de la Garde (normale / haute / critique), qui est une autre
 * échelle sur d'autres objets, ni celle du Scanner, qui en a cinq. Le rouge
 * reste réservé au critique dans les trois.
 *
 * L'AMBRE, unique : le renflement de la couche critique, et l'étiquette qui le
 * date et le nomme. Sans marche, pas d'ambre : une nappe plate n'a rien à
 * signaler.
 *
 * CE QUE LA NAPPE PEUT DIRE, ET SUR QUOI. Le serveur ne compte pas les
 * incidents ouverts JOUR PAR JOUR : `IncidentMetrics` rend des totaux sur la
 * fenêtre, `SocSummary` un instantané. La série se reconstruit donc ici, à
 * partir de `firstSeenAt` et `resolvedAt` de chaque incident — « ouvert le
 * jour J » veut dire né avant la fin de J et pas encore résolu à ce
 * moment-là. C'est exact sur les incidents chargés, et l'écran DIT sur
 * combien il l'a calculé : une nappe muette sur son assiette serait une
 * nappe qu'on croit sur parole.
 */

/** La fenêtre de la nappe : trente jours, et rien d'autre ne décide des abscisses. */
const NAPPE_JOURS = 30;
const NAPPE_H = 168;
const JOUR_MS = 86_400_000;

type Couche = 'critical' | 'warning' | 'info';
/* L'ordre d'empilement : le critique contre l'axe, les autres par-dessus. */
const COUCHES: { cle: Couche; nom: string; encre: string }[] = [
  { cle: 'critical', nom: 'Critiques', encre: 'var(--color-danger-fill)' },
  { cle: 'warning', nom: 'Avertissements', encre: '#4a4a48' },
  { cle: 'info', nom: 'Informations', encre: '#2b2b2b' },
];

const minuitLocal = (decalageJours = 0) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime() + decalageJours * JOUR_MS;
};

export function NappeDesIncidents() {
  const { organizations } = useOrgContext();
  const [tous, setTous] = useState<Incident[] | null>(null);
  const [horsSuspendue, setHorsSuspendue] = useState(false);

  useEffect(() => {
    let vivant = true;
    void bridge().remote.listIncidents({ status: 'all' }).then((liste) => { if (vivant) setTous(liste); }).catch(() => { if (vivant) setTous([]); });
    return () => { vivant = false; };
  }, []);

  /* Les organisations suspendues : leurs incidents ne se ferment plus, et c'est la situation, pas le parc. */
  const suspendues = useMemo(() => new Set(organizations.filter((o) => o.status === 'suspended').map((o) => o.id)), [organizations]);

  const lecture = useMemo(() => {
    if (!tous) return null;
    const retenus = tous.filter((i) => !horsSuspendue || !suspendues.has((i as Incident & { orgId?: string }).orgId ?? ''));
    /* Un jour de la nappe se lit à sa FIN : « ouvert le 12 » veut dire ouvert au soir du 12. */
    const jours = Array.from({ length: NAPPE_JOURS }, (_, i) => minuitLocal(-(NAPPE_JOURS - 1 - i) + 1));
    const series: Record<Couche, number[]> = { critical: [], warning: [], info: [] };
    for (const fin of jours) {
      const compte: Record<Couche, number> = { critical: 0, warning: 0, info: 0 };
      for (const inc of retenus) {
        const ne = Date.parse(inc.firstSeenAt);
        if (!Number.isFinite(ne) || ne > fin) continue;
        const clos = inc.resolvedAt ? Date.parse(inc.resolvedAt) : null;
        if (clos !== null && clos <= fin) continue;
        const cle = (inc.severity === 'critical' ? 'critical' : inc.severity === 'warning' ? 'warning' : 'info') as Couche;
        compte[cle] += 1;
      }
      for (const c of COUCHES) series[c.cle].push(compte[c.cle]);
    }
    const totaux = jours.map((_, i) => COUCHES.reduce((n, c) => n + series[c.cle][i], 0));
    const max = Math.max(1, ...totaux);
    /*
      LA MARCHE : le jour où la couche critique a le plus gonflé d'un coup.
      C'est ce que l'ambre désigne — pas le maximum, qui ne dit rien de quand.
    */
    let marche = { jour: -1, saut: 0 };
    for (let i = 1; i < series.critical.length; i += 1) {
      const saut = series.critical[i] - series.critical[i - 1];
      if (saut > marche.saut) marche = { jour: i, saut };
    }
    return { jours, series, totaux, max, marche: marche.jour >= 0 ? marche : null, n: retenus.length };
  }, [tous, horsSuspendue, suspendues]);

  const halo = useHaloSignal(Boolean(lecture?.marche));
  if (!lecture) return null;
  const { jours, series, max, marche, n } = lecture;
  if (n === 0) return null;

  const x = (i: number) => (i / Math.max(1, NAPPE_JOURS - 1)) * 1000;
  /* Une aire empilée se dessine sur la SOMME des couches en dessous d'elle. */
  const cumul = (i: number, jusqua: number) => COUCHES.slice(0, jusqua + 1).reduce((s, c) => s + series[c.cle][i], 0);
  const y = (v: number) => NAPPE_H - (v / max) * NAPPE_H;
  const aire = (rang: number) => {
    const haut = jours.map((_, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(cumul(i, rang)).toFixed(1)}`).join(' ');
    const bas = rang === 0
      ? ` L${x(NAPPE_JOURS - 1).toFixed(1)} ${NAPPE_H} L0 ${NAPPE_H} Z`
      : ` ${jours.map((_, i) => `L${x(NAPPE_JOURS - 1 - i).toFixed(1)} ${y(cumul(NAPPE_JOURS - 1 - i, rang - 1)).toFixed(1)}`).join(' ')} Z`;
    return haut + bas;
  };
  const jourCourt = (ms: number) => new Date(ms - JOUR_MS).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const ouvertsAujourdhui = COUCHES.reduce((s, c) => s + series[c.cle][NAPPE_JOURS - 1], 0);

  return (
    <article className="border border-border-raised bg-elevated px-6 py-[30px] sm:px-8" data-nappe={n}>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">Trente jours d’incidents ouverts</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">Le critique contre l’axe · à sa vraie hauteur</span>
      </div>

      <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3">
        <div className="relative font-mono text-[9.5px] text-text-muted" style={{ height: NAPPE_H }}>
          {[...new Set([max, Math.round(max / 2), 0])].map((v) => (
            <span key={v} className="absolute right-0 tabular-nums" style={{ bottom: (v / max) * NAPPE_H - 5 }}>{v}</span>
          ))}
        </div>
        <div>
          <div className="relative overflow-hidden border border-border-raised bg-sunken" style={{ height: NAPPE_H }}>
            <svg viewBox={`0 0 1000 ${NAPPE_H}`} preserveAspectRatio="none" className="absolute inset-0 block h-full w-full" aria-hidden>
              {/* De la plus haute à la plus basse : le critique se dessine en dernier, donc devant. */}
              {[2, 1, 0].map((rang) => (
                <path key={COUCHES[rang].cle} d={aire(rang)} fill={COUCHES[rang].encre} />
              ))}
            </svg>
            {marche && (
              <span
                data-signal-groupe="marche-critique"
                className={`absolute inset-y-0 w-0.5 bg-signal ${halo}`}
                style={{ left: `${(marche.jour / Math.max(1, NAPPE_JOURS - 1)) * 100}%` }}
              />
            )}
            <span className="absolute left-3.5 top-3 flex flex-col gap-1.5">
              {COUCHES.map((c) => (
                <span key={c.cle} className="flex items-center gap-[7px]">
                  <span aria-hidden className="h-[3px] w-3.5" style={{ background: c.encre }} />
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.06em] text-text-muted">{c.nom} · {series[c.cle][NAPPE_JOURS - 1]}</span>
                </span>
              ))}
            </span>
          </div>
          <div className="relative mt-2.5 h-3.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-text-muted">
            <span className="absolute left-0">{jourCourt(jours[0])}</span>
            <span className="absolute left-1/2 -translate-x-1/2">{jourCourt(jours[Math.floor(NAPPE_JOURS / 2)])}</span>
            <span className="absolute right-0">aujourd’hui</span>
          </div>
        </div>
      </div>

      {marche && (
        <div className="mt-6 flex flex-wrap items-stretch gap-[18px]">
          <div data-signal-groupe="marche-critique" className={`signal-plate flex flex-none flex-col justify-center px-5 py-[15px] ${halo}`}>
            <span data-signal-groupe="marche-critique" className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] opacity-80">
              {jourCourt(jours[marche.jour])} · la marche
            </span>
            <span data-signal-groupe="marche-critique" className="mt-[7px] font-mono text-[23px] font-bold tabular-nums tracking-[-0.03em]">
              + {marche.saut} critiques
            </span>
          </div>
          <div className="flex min-w-[16rem] flex-1 flex-col justify-center gap-2.5">
            <p className="text-[13.5px] leading-relaxed text-text-secondary [text-wrap:pretty]">
              Une marche dans la nappe n’est pas forcément une dégradation du parc : quand plus personne ne ferme les incidents d’une organisation, la courbe accuse le parc à la place de la situation.
            </p>
            <button
              type="button"
              onClick={() => setHorsSuspendue((v) => !v)}
              aria-pressed={horsSuspendue}
              className={`flex h-[30px] w-fit items-center border px-[13px] text-[12.5px] font-semibold ${horsSuspendue ? 'border-border-strong bg-surface-hover text-text-primary' : 'border-border-strong text-text-body hover:bg-surface-hover'}`}
            >
              {horsSuspendue ? 'Rétablir les organisations suspendues' : 'Lire le parc hors organisation suspendue'}
            </button>
          </div>
        </div>
      )}

      <p className="mt-4 border-t border-border-raised pt-4 text-[12.5px] leading-relaxed text-text-muted [text-wrap:pretty]">
        {ouvertsAujourdhui} incident{ouvertsAujourdhui > 1 ? 's' : ''} ouvert{ouvertsAujourdhui > 1 ? 's' : ''} au dernier point de la nappe, reconstruite sur {n} incident{n > 1 ? 's' : ''} chargés — le serveur ne compte pas les ouverts jour par jour, la série se rebâtit ici à partir des dates de naissance et de clôture.
      </p>
    </article>
  );
}
