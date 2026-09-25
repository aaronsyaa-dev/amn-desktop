import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AMBRE } from '../jetons';
import { useSupervisor } from '../donnees/useSupervisor';
import { Carte, Chargement, EnTete, Invitation } from '../ui/kit';
import { enLettresF } from '../format';

/**
 * SUPERVISOR · LA CARTE DU PARC (cahier 15, `51c` · 01).
 *
 * Où sont les clientes : la géographie du parc, par ville, pour organiser
 * les passages sur place. La ville vient du dossier interne de chaque
 * cliente ; la carte ne place que les villes qu'elle connaît, et liste les
 * autres plutôt que de les poser au hasard.
 *
 * L'ambre : la ville de la cliente qui attend le plus un humain (l'ambre de
 * l'horizon) — c'est là que le prochain passage a le plus de sens.
 */

/** Longitude, latitude des villes qu'on sait placer. */
const VILLES: Record<string, [number, number]> = {
  paris: [2.35, 48.86], lyon: [4.84, 45.76], villeurbanne: [4.88, 45.77], marseille: [5.37, 43.3], lille: [3.06, 50.63], bordeaux: [-0.58, 44.84],
  toulouse: [1.44, 43.6], nantes: [-1.55, 47.22], strasbourg: [7.75, 48.58], nice: [7.26, 43.7], rennes: [-1.68, 48.11], montpellier: [3.88, 43.61],
  grenoble: [5.72, 45.19], dijon: [5.04, 47.32], annecy: [6.13, 45.9], 'saint-etienne': [4.39, 45.44], 'clermont-ferrand': [3.09, 45.78], tours: [0.69, 47.39],
  orleans: [1.91, 47.9], rouen: [1.1, 49.44], reims: [4.03, 49.26], metz: [6.18, 49.12], nancy: [6.18, 48.69], caen: [-0.37, 49.18], brest: [-4.49, 48.39],
  'le mans': [0.2, 48.0], angers: [-0.55, 47.47], limoges: [1.26, 45.83], poitiers: [0.34, 46.58], perpignan: [2.9, 42.7], toulon: [5.93, 43.12],
  'aix-en-provence': [5.45, 43.53], avignon: [4.81, 43.95], besancon: [6.02, 47.24], mulhouse: [7.34, 47.75], pau: [-0.37, 43.3], bayonne: [-1.47, 43.49],
  'la rochelle': [-1.15, 46.16], amiens: [2.3, 49.89], 'le havre': [0.11, 49.49], chambery: [5.92, 45.57], valence: [4.89, 44.93], nimes: [4.36, 43.84],
  caluire: [4.85, 45.8], bron: [4.91, 45.74], venissieux: [4.89, 45.7], ecully: [4.78, 45.77], vienne: [4.87, 45.52], macon: [4.83, 46.31],
};
/** La France, en quelques points (longitude, latitude) : un contour, pas une carte d'état-major. */
const CONTOUR: [number, number][] = [
  [-4.8, 48.4], [-3.3, 48.85], [-1.8, 48.65], [-1.25, 49.7], [0.1, 49.5], [1.55, 50.2], [1.65, 50.9], [2.55, 51.08], [4.2, 49.95], [5.8, 49.5], [8.2, 48.97],
  [7.6, 47.6], [6.9, 47.0], [6.1, 46.2], [7.0, 45.9], [6.9, 44.9], [7.7, 44.1], [7.4, 43.75], [6.2, 43.1], [4.8, 43.4], [3.2, 43.2], [3.15, 42.45],
  [1.7, 42.5], [-0.7, 42.8], [-1.8, 43.35], [-1.25, 44.6], [-1.2, 46.2], [-2.2, 47.25], [-4.4, 47.8],
];
const W = 1000;
const H = 940;
const x = (lon: number) => ((lon + 5.2) / 14.8) * W;
const y = (lat: number) => ((51.3 - lat) / 10.0) * H;

/** Les communes de la métropole se lisent avec leur ville : à cette échelle, un passage à Villeurbanne est un passage à Lyon. */
const METROPOLES: Record<string, string> = { villeurbanne: 'lyon', caluire: 'lyon', bron: 'lyon', venissieux: 'lyon', ecully: 'lyon' };
const cle = (ville: string) => {
  const k = brut(ville);
  return METROPOLES[k] ?? k;
};
const brut = (ville: string) =>
  ville
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+\d+\s*(e|er|eme|ᵉ)?$/u, '')
    .replace(/\s*ᵉ$/u, '')
    .trim();

export function SupervisorCarte() {
  const m = useSupervisor();
  const [choisie, setChoisie] = useState<string | null>(null);
  const villes = useMemo(() => {
    const r = new Map<string, { nom: string; orgs: typeof m.orgs; pos: [number, number] | null }>();
    for (const o of m.orgs) {
      const v = m.dossiers.get(o.id)?.ville?.trim();
      if (!v) continue;
      const k = cle(v);
      const e = r.get(k) ?? { nom: METROPOLES[brut(v)] ? k.charAt(0).toUpperCase() + k.slice(1) : v.replace(/\s+\d+.*$/, ''), orgs: [], pos: VILLES[k] ?? null };
      e.orgs.push(o);
      r.set(k, e);
    }
    return [...r.entries()].map(([k, v]) => ({ cle: k, ...v })).sort((a, b) => b.orgs.length - a.orgs.length);
  }, [m.orgs, m.dossiers]);
  const sansVille = m.orgs.filter((o) => !m.dossiers.get(o.id)?.ville?.trim());
  const villeAmbre = m.ambre ? villes.find((v) => v.orgs.some((o) => o.id === m.ambre!.id)) ?? null : null;
  const placees = villes.filter((v) => v.pos);
  const vue = villes.find((v) => v.cle === choisie) ?? villeAmbre ?? villes[0] ?? null;

  if (!m.pret) {
    return (
      <>
        <EnTete surtitre="Supervisor · Carte du parc" titre="Le parc se place." />
        <Chargement texte="Lecture des dossiers" />
      </>
    );
  }
  const titre = villes.length === 0 ? 'Aucune ville n’est encore au dossier.' : `${enLettresF(m.orgs.length - sansVille.length, true)} clientes dans ${enLettresF(villes.length)} ville${villes.length > 1 ? 's' : ''}${villeAmbre ? `, un passage à prévoir à ${villeAmbre.nom}` : ''}.`;

  return (
    <>
      <EnTete surtitre="Supervisor · Carte du parc" titre={titre} />
      {villes.length === 0 ? (
        <Invitation titre="La carte attend des villes." texte="La ville de chaque cliente se note dans son dossier. La carte les place d’elle-même, et regroupe les clientes d’une même ville." action={<Link to="/tour/organisations" className="bx-btn2">Ouvrir les dossiers</Link>} />
      ) : (
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
          <Carte dominante pad="p-6" titre="La géographie du parc" droite="un cercle par ville · sa taille dit le nombre de clientes">
            <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full max-w-[640px]" role="img" aria-label={`Carte : ${placees.map((v) => `${v.nom}, ${v.orgs.length}`).join(' ; ')}`}>
              <path d={`${CONTOUR.map(([lo, la], i) => `${i ? 'L' : 'M'}${x(lo)} ${y(la)}`).join(' ')} Z`} fill="#0e0e0e" stroke="#2f2f2f" strokeWidth={2} />
              {placees.map((v) => {
                const [lo, la] = v.pos!;
                const r = 9 + 7 * Math.sqrt(v.orgs.length);
                const estAmbre = villeAmbre?.cle === v.cle;
                return (
                  <g key={v.cle} onClick={() => setChoisie(v.cle)} style={{ cursor: 'pointer' }} data-signal-groupe={estAmbre ? 'carte-ambre' : undefined}>
                    <circle cx={x(lo)} cy={y(la)} r={r} fill={estAmbre ? AMBRE : vue?.cle === v.cle ? '#bdbdb9' : '#6b6b68'} opacity={estAmbre ? 1 : 0.85} />
                    <text x={x(lo) + r + 8} y={y(la) + 6} fill={estAmbre ? AMBRE : '#e4e4e1'} fontSize={22} fontFamily="Space Grotesk, sans-serif" fontWeight={600}>
                      {v.nom} · {v.orgs.length}
                    </text>
                  </g>
                );
              })}
            </svg>
          </Carte>
          <div className="flex flex-col gap-[18px] self-start">
            {vue && (
              <Carte titre={`${vue.nom} · ${vue.orgs.length} cliente${vue.orgs.length > 1 ? 's' : ''}`} droite={villeAmbre?.cle === vue.cle ? 'passage à prévoir' : ''}>
                {[...vue.orgs]
                  .sort((a, b) => b.poids - a.poids)
                  .map((o) => {
                    const estAmbre = m.ambre?.id === o.id;
                    return (
                      <Link key={o.id} to={`/supervisor/dossiers/${o.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b border-[#1f1f1f] py-2.5 hover:bg-white/[0.02]" style={estAmbre ? { boxShadow: `inset 2px 0 0 ${AMBRE}`, paddingLeft: 10 } : undefined} data-signal-groupe={estAmbre ? 'carte-ambre' : undefined}>
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-semibold text-[#f7f7f5]">{o.nom}</span>
                          <span className="block truncate text-[12px] text-[#a3a3a0]">
                            {m.dossiers.get(o.id)?.ville && brut(m.dossiers.get(o.id)!.ville!) !== vue.cle ? `${m.dossiers.get(o.id)!.ville} · ` : ''}
                            {o.poids ? o.raison : 'rien n’attend'}
                          </span>
                        </span>
                        <span className="font-mono text-[10.5px] uppercase" style={{ color: estAmbre ? AMBRE : '#9a9a97' }}>
                          {estAmbre ? 'à voir' : o.poids ? `poids ${o.poids}` : ''}
                        </span>
                      </Link>
                    );
                  })}
              </Carte>
            )}
            <Carte titre="Les villes" droite={villes.length}>
              {villes.map((v) => (
                <button key={v.cle} type="button" onClick={() => setChoisie(v.cle)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b border-[#1f1f1f] py-2 text-left" aria-pressed={vue?.cle === v.cle}>
                  <span className="text-[13px] text-[#e4e4e1]">
                    {v.nom}
                    {!v.pos && <span className="ml-2 font-mono text-[10px] text-[#9a9a97]">NON PLACÉE</span>}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-[#a3a3a0]">{v.orgs.length}</span>
                </button>
              ))}
              {sansVille.length > 0 && <p className="mt-3 text-[12.5px] text-[#a3a3a0]">{sansVille.length} cliente{sansVille.length > 1 ? 's' : ''} sans ville au dossier.</p>}
            </Carte>
          </div>
        </div>
      )}
    </>
  );
}
