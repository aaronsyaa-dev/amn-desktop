import React, { useMemo } from 'react';
import { useHaloSignal } from '../EtatEcran';
import { useRemoteSites } from '../../state/RemoteSitesContext';
import { OFFLINE_AFTER_MS, DEGRADED_ALERT_WINDOW_MS } from '../../lib/siteStatus';
import type { DerivedSite } from '../../state/RemoteSitesContext';

/**
 * PARC · SITES — le nuage en bande.
 *
 * UNE SEULE DIMENSION : le temps écoulé depuis le dernier battement. C'est la
 * grandeur dont le produit DÉRIVE l'état d'un site — `deriveSiteStatus(state,
 * now)`, recalculé toutes les quinze secondes « puisque hors ligne est
 * fonction du temps écoulé, pas seulement de la dernière poussée ».
 *
 * L'état cesse d'être une étiquette collée au site : il devient une POSITION
 * par rapport à un trait. Un tableau trié donnerait le même ordre mais pas la
 * même chose : ici on voit l'AMAS — les sites collés à gauche — et donc que
 * les traînards sont une anomalie et non une pente.
 *
 * Passé le seuil, un site SORT DE L'AXE : au-delà, la durée exacte du silence
 * n'apprend plus rien, et étirer l'axe écraserait tous les autres. Ne jamais
 * placer un site hors ligne à l'extrémité droite — c'est la faute que la case
 * hors échelle existe pour éviter.
 *
 * L'AMBRE, unique : la case hors échelle et ses sites muets. Case vide, pas
 * d'ambre.
 *
 * ────────────────────────────────────────────────────────────────────────
 * CE QUE LE PRODUIT MESURE VRAIMENT, ET QUI N'EST PAS CE QU'ON CROYAIT
 *
 * La direction décrit « LES DEUX SEUILS qui font passer un site d'`online` à
 * `degraded` puis à `offline` », tracés tous deux sur l'axe. `siteStatus.ts`
 * dit autre chose, et c'est lui qui fait foi :
 *
 *   · `OFFLINE_AFTER_MS` = 90 s — le SEUL seuil de délai. Au-delà, hors ligne.
 *   · `degraded` n'est pas un délai : c'est une ALERTE RÉCENTE sur un site qui
 *     répond encore (`DEGRADED_ALERT_WINDOW_MS`). Un site dégradé se trouve
 *     donc n'importe où À GAUCHE du seuil, pas entre deux traits.
 *
 * Tracer un second seuil sur l'axe aurait donc dessiné une règle qui n'existe
 * pas. La dégradation se lit ici comme ce qu'elle est : une MARQUE portée par
 * le point, un anneau, sur un site par ailleurs vivant.
 *
 * UNE SEULE LOI D'ÉCHELLE, ET TOUT EN DÉCOULE. L'axe est linéaire de zéro à
 * quatre fois le seuil ; la position d'un point, celle du trait et celle de
 * chaque graduation sortent toutes de là. Aucun pourcentage n'est posé à la
 * main — et le jour où le seuil bouge dans `siteStatus.ts`, l'axe bouge avec
 * lui au lieu de mentir sur sa légende.
 */

/** L'axe couvre quatre fois le seuil : le trait tombe au quart, et l'amas garde de la place. */
const AXE_MS = 4 * OFFLINE_AFTER_MS;
const BANDE_H = 150;
/** La nuée est verticale : l'axe reste horizontal, et deux sites au même instant ne se cachent pas. */
const DISPERSION = 0.78;

const pct = (ms: number) => Math.min(100, (ms / AXE_MS) * 100);

/**
 * L'ordonnée d'un point, déterministe : deux lectures successives ne doivent
 * pas faire sauter la nuée. Elle sort de l'identifiant du site, pas du hasard.
 */
function ordonnee(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 1000;
  return ((h / 1000) * DISPERSION + (1 - DISPERSION) / 2) * 100;
}

const silence = (s: DerivedSite, now: number) => (s.state?.lastSeenAt ? now - Date.parse(s.state.lastSeenAt) : null);

export function BandeDesSites() {
  const { sites } = useRemoteSites();
  /* Les positions se recalculent avec l'horloge du contexte : un point dérive vers la droite tant qu'aucun battement n'arrive. */
  const now = Date.now();

  const lecture = useMemo(() => {
    const avecBattement = sites.filter((s) => s.state?.lastSeenAt);
    const surAxe = avecBattement.filter((s) => (silence(s, now) ?? 0) <= AXE_MS);
    const horsEchelle = avecBattement.filter((s) => (silence(s, now) ?? 0) > AXE_MS);
    /* Jamais vus : ils n'ont pas de délai, donc pas de place sur un axe de délai. */
    const jamais = sites.filter((s) => !s.state?.lastSeenAt);
    const delais = surAxe.map((s) => silence(s, now) ?? 0).sort((a, b) => a - b);
    const mediane = delais.length > 0 ? delais[Math.floor(delais.length / 2)] : null;
    const degrades = sites.filter((s) => s.status === 'degraded');
    return { surAxe, horsEchelle, jamais, mediane, degrades };
  }, [sites, now]);

  const { surAxe, horsEchelle, jamais, mediane, degrades } = lecture;
  const halo = useHaloSignal(horsEchelle.length > 0);
  if (sites.length === 0) return null;

  /*
    UNE DURÉE S'ÉCRIT EXACTE, SURTOUT QUAND C'EST UN SEUIL. Arrondir 90 s en
    « 2 min » ferait annoncer à la légende un seuil que la dérivation n'emploie
    pas — la faute même que l'axe dérivé de `OFFLINE_AFTER_MS` existe pour
    éviter. Sous deux minutes on reste donc en secondes, et au-delà le reste se
    dit au lieu de disparaître dans l'arrondi.
  */
  const secondes = (ms: number) => {
    if (ms < 120_000) return `${Math.round(ms / 1000)} s`;
    const min = Math.floor(ms / 60_000);
    const reste = Math.round((ms % 60_000) / 1000);
    return reste === 0 ? `${min} min` : `${min} min ${reste}`;
  };

  return (
    <article className="border border-border-raised bg-elevated px-6 py-[30px] sm:px-8" data-bande-sites={sites.length}>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">Temps depuis le dernier battement</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">Hors ligne au-delà de {secondes(OFFLINE_AFTER_MS)} · état recalculé toutes les 15 s</span>
      </div>

      <div className="flex flex-col items-stretch gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="relative overflow-hidden border border-border-raised bg-sunken" style={{ height: BANDE_H }}>
            {/* Le seuil, à son abscisse réelle : un quart de l'axe, parce que l'axe vaut quatre fois le seuil. */}
            <span className="absolute inset-y-0 w-px bg-border-strong" style={{ left: `${pct(OFFLINE_AFTER_MS)}%` }} aria-hidden />
            <span className="absolute -translate-x-1/2 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.1em] text-text-muted" style={{ left: `${pct(OFFLINE_AFTER_MS)}%`, top: 6 }}>
              hors ligne
            </span>
            {surAxe.map((s) => {
              const ms = silence(s, now) ?? 0;
              const degrade = s.status === 'degraded';
              return (
                <span
                  key={s.id}
                  data-site={s.id}
                  data-etat={s.status}
                  title={`${s.name} · ${secondes(ms)}`}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${degrade ? 'border-2 border-warning bg-transparent' : 'bg-[#4a4a48]'}`}
                  style={{ left: `${pct(ms)}%`, top: `${ordonnee(s.id)}%`, width: degrade ? 11 : 8, height: degrade ? 11 : 8 }}
                />
              );
            })}
          </div>
          {/* La rangée de graduations partage l'échelle de l'axe : chaque repère à son abscisse. */}
          <div className="relative mt-2.5 h-3.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-text-muted">
            <span className="absolute left-0">à l’instant</span>
            <span className="absolute -translate-x-1/2" style={{ left: `${pct(OFFLINE_AFTER_MS)}%` }}>{secondes(OFFLINE_AFTER_MS)}</span>
            <span className="absolute -translate-x-1/2" style={{ left: `${pct(2 * OFFLINE_AFTER_MS)}%` }}>{secondes(2 * OFFLINE_AFTER_MS)}</span>
            <span className="absolute right-0">{secondes(AXE_MS)}</span>
          </div>
        </div>

        {/*
          LA CASE HORS ÉCHELLE. Passé l'axe, la durée exacte du silence n'apprend
          plus rien : un site muet depuis six minutes et un autre depuis six jours
          demandent le même geste. Les poser à l'extrémité droite laisserait croire
          qu'ils y sont mesurés.
        */}
        {(horsEchelle.length > 0 || jamais.length > 0) && (
          <div
            data-signal-groupe={horsEchelle.length > 0 ? 'hors-echelle' : undefined}
            className={`flex w-full flex-none flex-col border px-4 py-[15px] lg:w-[232px] ${horsEchelle.length > 0 ? `bg-signal text-signal-ink border-signal ${halo}` : 'border-dashed border-[#2e2e2e] bg-sunken'}`}
          >
            <span data-signal-groupe={horsEchelle.length > 0 ? 'hors-echelle' : undefined} className={`font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] ${horsEchelle.length > 0 ? 'opacity-75' : 'text-text-muted'}`}>
              Hors échelle
            </span>
            <span data-signal-groupe={horsEchelle.length > 0 ? 'hors-echelle' : undefined} className={`mt-2 font-mono text-[34px] font-bold leading-[0.9] tabular-nums tracking-[-0.04em] ${horsEchelle.length > 0 ? '' : 'text-text-body'}`}>
              {horsEchelle.length + jamais.length}
            </span>
            {/* Le chiffre additionne deux populations : la légende les nomme toutes les deux, sinon elle dément le chiffre. */}
            <span data-signal-groupe={horsEchelle.length > 0 ? 'hors-echelle' : undefined} className={`mt-1.5 text-[12px] leading-snug ${horsEchelle.length > 0 ? 'opacity-85' : 'text-text-secondary'}`}>
              {[
                horsEchelle.length > 0 ? `${horsEchelle.length} muet${horsEchelle.length > 1 ? 's' : ''} au-delà de l’axe` : null,
                jamais.length > 0 ? `${jamais.length} jamais vu${jamais.length > 1 ? 's' : ''}` : null,
              ].filter(Boolean).join(' · ')}
            </span>
            <span className={`mt-auto flex flex-col gap-[5px] border-t pt-3.5 ${horsEchelle.length > 0 ? 'border-[rgba(8,8,8,0.25)]' : 'border-border'}`}>
              {/* Les muets d'abord et en gras, les jamais vus ensuite en maigre : la légende au-dessus a déjà dit combien de chaque, un suffixe par ligne ne ferait que tronquer les noms. */}
              {[...horsEchelle, ...jamais].slice(0, 4).map((s) => (
                <span
                  key={s.id}
                  data-signal-groupe={horsEchelle.length > 0 ? 'hors-echelle' : undefined}
                  className={`truncate text-[12.5px] ${horsEchelle.length > 0 ? (s.state?.lastSeenAt ? 'font-semibold' : 'font-normal opacity-70') : 'text-text-body'}`}
                >
                  {s.name}
                </span>
              ))}
            </span>
          </div>
        )}
      </div>

      <div className="mt-[22px] grid gap-5 border-t border-border-raised pt-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <p className="text-[13.5px] leading-relaxed text-text-secondary [text-wrap:pretty]">
          {horsEchelle.length > 1
            ? <>Ces {horsEchelle.length} sites ne battent plus depuis plus de {secondes(AXE_MS)}. Au-delà de l’axe, la durée exacte du silence n’apprend plus rien : c’est le même geste à six minutes et à six jours.</>
            : horsEchelle.length === 1
              ? <>Ce site ne bat plus depuis plus de {secondes(AXE_MS)}. Au-delà de l’axe, la durée exacte du silence n’apprend plus rien : c’est le même geste à six minutes et à six jours.</>
              : <>Aucun site n’est sorti de l’axe : tous ont battu il y a moins de {secondes(AXE_MS)}. L’amas de gauche est l’information — ce qui compte est la distance au trait, pas le rang dans une liste.</>}
          {degrades.length > 0 && (degrades.length > 1
            ? <> {degrades.length} sites répondent mais portent une alerte récente : anneau creux, et à gauche du trait puisqu’ils répondent encore.</>
            : <> Un site répond mais porte une alerte récente : anneau creux, et à gauche du trait puisqu’il répond encore.</>)}
        </p>
        <div className="flex flex-col gap-3">
          <span>
            <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">Médiane de l’amas</span>
            <span className="mt-1.5 block font-mono text-[19px] font-semibold tabular-nums tracking-tight text-text-primary">{mediane === null ? '—' : secondes(mediane)}</span>
          </span>
          <span>
            <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">Fenêtre d’alerte</span>
            <span className="mt-1.5 block font-mono text-[19px] font-semibold tabular-nums tracking-tight text-text-primary">{secondes(DEGRADED_ALERT_WINDOW_MS)}</span>
          </span>
        </div>
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-text-muted [text-wrap:pretty]">
        Le produit ne mesure aucune latence : l’état d’un site tient dans son dernier battement, ses visiteurs et sa dernière alerte. La seule grandeur continue disponible est le temps écoulé depuis ce battement, et c’est celle de cet axe.
      </p>
    </article>
  );
}
