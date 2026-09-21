import React, { useMemo } from 'react';
import { useHaloSignal } from '../EtatEcran';
import { useRemoteSites } from '../../state/RemoteSitesContext';
import { useTrackers } from '../../state/useTrackers';
import { TRACKER_MODULES, moduleByKey, type TrackerModule } from '../../data/trackerModules';

/**
 * PARC · TRACKERS — l'escalier des paliers.
 *
 * LA DÉPENDANCE EST LA GÉOMÉTRIE. Un site ne peut pas porter Sentinel+ ni la
 * Suite sans porter Sentinel : les marches hautes sont donc des SOUS-ENSEMBLES
 * de la marche basse, dessinées calées sur le même bord gauche, au-dessus
 * d'elle. L'escalier s'effile vers le haut, et l'on voit sans flèche ni note où
 * le parc s'arrête de monter.
 *
 * La largeur d'une marche est le nombre de sites qui y sont montés, rapporté au
 * parc entier. Une marche large est un palier atteint ; une marche étroite est
 * un palier vendu et pas déployé.
 *
 * L'AMBRE, unique : la marche où le parc ne monte presque pas — son titre, son
 * compte, son détail. Trois nœuds dans une marche. Un parc sans site, ou un
 * parc monté partout au même niveau, n'a pas de marche qui s'arrête : pas
 * d'ambre.
 *
 * ────────────────────────────────────────────────────────────────────────
 * TROIS MARCHES, ET PAS UN ESCALIER DROIT
 *
 * La direction décrit « quatre marches qui montent », dont Comply, et une
 * chaîne où « on ne peut pas être sur une marche sans être passé par la
 * précédente ». `src/data/trackerModules.ts` dit deux choses différentes, et
 * c'est lui qui fait foi :
 *
 *   · Il y a TROIS modules — Sentinel, Sentinel+, Suite. Comply n'est pas un
 *     module de tracker installable sur un site : c'est un produit interne
 *     (`31b`), avec son propre écran. Dessiner une quatrième marche aurait
 *     montré un déploiement qui n'existe nulle part.
 *   · `suite.requires` vaut `['sentinel']`, PAS `['sentinel-plus']`. Un site
 *     peut donc porter la Suite sans jamais avoir porté Sentinel+. Un escalier
 *     droit aurait affirmé un passage obligé que le produit ne demande pas.
 *
 * D'où un étage qui porte DEUX marches côte à côte : elles reposent l'une et
 * l'autre sur Sentinel, et aucune ne repose sur l'autre. La forme dit la vraie
 * règle de dépendance, celle que `installModule` applique en tirant les
 * `requires` et que `removeModule` applique à l'envers.
 *
 * LE COMPTE SE PREND SUR LA VUE RÉSOLUE (`modulesForSite`), jamais sur les
 * lignes locales : un site dont le palier vit sur amn-api et dont ce poste n'a
 * pas la ligne s'afficherait sinon à zéro alors qu'il remonte des événements.
 *
 * LE PALIER EST PAR SITE, PAS PAR ORGANISATION. La direction met en pied « le
 * palier atteint par organisation ». `RemoteSite` ne porte pas d'organisation —
 * ni `listSites`, ni `OrgPulse`, ni `ParcOrganization` ne relie un site à sa
 * cliente côté poste. Grouper ici demanderait d'inventer ce rattachement. Le
 * pied rend donc le palier à la granularité que le produit porte vraiment : le
 * site. Le jour où amn-api rendra l'organisation d'un site, le regroupement
 * viendra sans changer l'instrument.
 */

/** La hauteur d'une marche, et l'écart entre deux étages. Rien d'autre ne décide de la géométrie. */
const MARCHE_H = 46;
const ETAGE_ECART = 10;
/** La largeur minimale d'une marche montée par au moins un site : sinon un palier à un site serait invisible. */
const MARCHE_MIN_PCT = 4;

/** L'étage d'un module : la longueur de sa chaîne de dépendances. Sentinel 0, les deux autres 1. */
function etageDe(mod: TrackerModule): number {
  let max = 0;
  for (const cle of mod.requires) {
    const parent = moduleByKey(cle);
    if (parent) max = Math.max(max, etageDe(parent) + 1);
  }
  return max;
}

export function EscalierDesPaliers() {
  const { sites } = useRemoteSites();
  const { modulesForSite } = useTrackers();

  const lecture = useMemo(() => {
    const comptes: Record<string, number> = {};
    for (const site of sites) for (const cle of modulesForSite(site.id)) comptes[cle] = (comptes[cle] ?? 0) + 1;

    /* Les étages du bas vers le haut, chacun avec ses marches rangées de la plus large à la plus étroite. */
    const parEtage = new Map<number, TrackerModule[]>();
    for (const mod of TRACKER_MODULES) {
      const e = etageDe(mod);
      parEtage.set(e, [...(parEtage.get(e) ?? []), mod]);
    }
    const etages = [...parEtage.entries()]
      .sort((a, b) => a[0] - b[0])
      /* Dans un étage, la plus étroite EN HAUT : c'est ainsi que l'escalier s'effile au lieu de s'évaser. */
      .map(([rang, mods]) => [rang, [...mods].sort((a, b) => (comptes[a.key] ?? 0) - (comptes[b.key] ?? 0))] as const);

    /*
      LA MARCHE OÙ LE PARC S'ARRÊTE : la moins montée au-dessus du socle. Elle
      n'est l'ambre que si elle est VRAIMENT plus étroite que le socle — un parc
      monté partout au même niveau ne s'arrête nulle part.
    */
    const socle = etages[0]?.[1][0];
    const hautes = TRACKER_MODULES.filter((m) => etageDe(m) > 0);
    /*
      À ÉGALITÉ, LA PLUS HAUTE. Deux paliers également désertés ne se départagent
      pas par leur compte : on désigne alors le plus élevé de l'offre, puisque
      c'est de lui que la montée manque le plus. Sans cette règle, l'ambre
      tomberait sur l'ordre de déclaration du catalogue, qui ne veut rien dire.
    */
    const rang = (m: TrackerModule) => [comptes[m.key] ?? 0, -etageDe(m), -TRACKER_MODULES.indexOf(m)];
    const arret = hautes.length > 0
      ? hautes.reduce((bas, m) => {
        const [a, b] = [rang(m), rang(bas)];
        for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return a[i] < b[i] ? m : bas;
        return bas;
      })
      : null;
    const marche = arret && socle && (comptes[arret.key] ?? 0) < (comptes[socle.key] ?? 0) ? arret : null;

    /* Le palier atteint par site : le module le plus haut qu'il porte, à défaut rien. */
    const paliers = sites.map((s) => {
      const portes = modulesForSite(s.id);
      const mods = portes.flatMap((k) => { const m = moduleByKey(k); return m ? [m] : []; });
      const sommet = mods.length > 0 ? mods.reduce((h, m) => (etageDe(m) > etageDe(h) ? m : h)) : null;
      return { site: s, portes, sommet };
    });

    return { comptes, etages, marche, paliers, deployes: Object.values(comptes).reduce((n, v) => n + v, 0) };
  }, [sites, modulesForSite]);

  const { comptes, etages, marche, paliers, deployes } = lecture;
  const halo = useHaloSignal(marche !== null);
  /* Un parc sans site n'a pas d'escalier : ni marche, ni ambre, ni relevé à zéro. */
  if (sites.length === 0) return null;

  const largeur = (cle: string) => {
    const n = comptes[cle] ?? 0;
    if (n === 0) return 0;
    return Math.max(MARCHE_MIN_PCT, (n / sites.length) * 100);
  };

  return (
    <article className="border border-border-raised bg-elevated px-6 py-[30px] sm:px-8" data-escalier={TRACKER_MODULES.length}>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">L’escalier des paliers</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">Largeur = sites montés · {deployes} module{deployes > 1 ? 's' : ''} déployé{deployes > 1 ? 's' : ''}</span>
      </div>

      <div className="relative">
        {/*
          LA CONTREMARCHE. Le trait qui tient le bord gauche de toutes les
          marches EST la dépendance : c'est par là qu'on monte, et aucune marche
          haute ne commence ailleurs.
        */}
        <span aria-hidden className="absolute bottom-0 left-0 top-0 w-px bg-border-strong" />
        {/* Les marches commencent SUR la contremarche, décalées d'un cheveu pour qu'on la voie. */}
        <div className="flex flex-col-reverse pl-2.5" style={{ gap: ETAGE_ECART }}>
          {etages.map(([rang, mods]) => (
            <div key={rang} className="flex flex-col" style={{ gap: 4 }} data-etage={rang}>
              {mods.length > 1 && (
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-muted">
                  Deux voies au même étage — aucune ne passe par l’autre
                </span>
              )}
              {mods.map((mod) => {
                const n = comptes[mod.key] ?? 0;
                const ambre = marche?.key === mod.key;
                const groupe = ambre ? 'marche-arret' : undefined;
                return (
                  <div
                    key={mod.key}
                    className="grid grid-cols-[minmax(0,1fr)_170px] items-center gap-4 sm:grid-cols-[minmax(0,1fr)_248px]"
                    style={{ height: MARCHE_H }}
                    data-marche={mod.key}
                    data-sites={n}
                  >
                    {/*
                      LA MARCHE OCCUPE SA PROPRE ZONE, LE TEXTE LA SIENNE. Poser
                      le nom PAR-DESSUS la marche le rendait illisible dès que la
                      marche portait l'ambre — encre ambre sur fond ambre — et le
                      coupait en deux dès qu'elle était étroite. La zone de
                      gauche vaut le parc entier ; la proportion est donc intacte.
                    */}
                    <span className="relative block h-full">
                      <span
                        aria-hidden
                        data-signal-groupe={groupe}
                        className={`absolute inset-y-0 left-0 border-y border-r ${ambre ? `bg-signal border-signal ${halo}` : n > 0 ? 'border-border-strong bg-[#4a4a48]' : 'border-dashed border-border-strong bg-transparent'}`}
                        style={{ width: n > 0 ? `${largeur(mod.key)}%` : '2px' }}
                      />
                    </span>
                    <span className="flex min-w-0 flex-col justify-center">
                      <span className="flex items-baseline gap-2.5">
                        <span data-signal-groupe={groupe} className={`truncate text-[13.5px] font-semibold ${ambre ? 'text-signal' : n > 0 ? 'text-text-primary' : 'text-text-muted'}`}>
                          {mod.name}
                        </span>
                        <span data-signal-groupe={groupe} className={`font-mono text-[13px] tabular-nums ${ambre ? 'font-bold text-signal' : 'text-text-secondary'}`}>
                          {n} / {sites.length}
                        </span>
                      </span>
                      <span className={`mt-0.5 truncate text-[11.5px] ${ambre ? 'text-text-body' : 'text-text-muted'}`}>{mod.tagline}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-[22px] border-t border-border-raised pt-5 text-[13.5px] leading-relaxed text-text-secondary [text-wrap:pretty]">
        {marche
          ? <>Le parc s’arrête à <b className="font-semibold text-text-primary">{marche.name}</b> : {comptes[marche.key] ?? 0} site{(comptes[marche.key] ?? 0) > 1 ? 's' : ''} y {(comptes[marche.key] ?? 0) > 1 ? 'sont montés' : 'est monté'} sur les {sites.length} du parc. La marche existe, elle n’est presque pas gravie.</>
          : <>Aucune marche ne se rétrécit : les sites montés le sont au même niveau. L’escalier n’a rien à signaler tant que le parc monte d’un bloc.</>}
        {' '}Un module ne se retire jamais seul : retirer Sentinel retire aussi ce qui repose dessus, sans quoi on laisserait une Suite sans son socle.
      </p>

      {/* LE PIED : le palier atteint, site par site, avec ses pastilles de progression. */}
      <div className="mt-5 border-t border-border-raised pt-5">
        <span className="block font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">Le palier atteint, site par site</span>
        <ul className="mt-3.5">
          {paliers.map(({ site, portes, sommet }) => (
            <li key={site.id} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,140px)] items-center gap-3.5 border-b border-border py-[9px] last:border-b-0" data-palier={site.id}>
              <span className="truncate text-[12.5px] text-text-body" title={site.name}>{site.name}</span>
              <span className="flex items-center gap-1.5" role="img" aria-label={`${portes.length} module sur ${TRACKER_MODULES.length}`}>
                {TRACKER_MODULES.map((mod) => (
                  <span
                    key={mod.key}
                    aria-hidden
                    title={mod.name}
                    className={`h-[7px] w-[7px] rounded-full ${portes.includes(mod.key) ? 'bg-[#4a4a48]' : 'border border-border-strong bg-transparent'}`}
                  />
                ))}
              </span>
              {/* « Aucun » se dit en mots : « 0 module » laisserait croire qu'on a compté un palier qui n'existe pas. */}
              <span className={`truncate text-right font-mono text-[11px] uppercase tracking-[0.06em] ${sommet ? 'text-text-secondary' : 'text-text-muted'}`}>
                {sommet ? sommet.name : 'aucun palier'}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[12.5px] leading-relaxed text-text-muted [text-wrap:pretty]">
          Le palier enregistré sur amn-api est un REPLI, pas un plancher : un site sans choix posé ici en hérite, et un choix posé dans l’assistant l’emporte toujours — y compris pour retirer. Le compte se prend sur cette vue résolue, jamais sur les lignes de ce poste : un site dont le palier vit sur le serveur s’afficherait sinon à zéro alors qu’il remonte des événements.
        </p>
      </div>
    </article>
  );
}
