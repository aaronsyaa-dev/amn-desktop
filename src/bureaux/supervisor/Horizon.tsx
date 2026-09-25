import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AMBRE, ROUGE } from '../jetons';
import { CAUSES, HORIZON, LIBELLE_CAUSE, POIDS, horizon as calculer, type Cause, type OrgPoints } from '../donnees/parc';
import { UserAvatar } from '../../components/UserAvatar';
import { enLettres } from '../format';

/**
 * L'HORIZON — cahier 11 `45a`, cahier 12 `46a`.
 *
 * Une tour par organisation, triées par ce qui demande un humain ; la hauteur
 * d'une tour est le POIDS de ses points ouverts, empilée de ses causes. Au
 * plus dix tours ; dessous, le plateau (les autres organisations avec des
 * points, à la même échelle) et la ligne d'horizon (celles sans rien). Tout
 * est compté, tout est cliquable : survol = nom, poids, raison ; clic = le
 * dossier.
 *
 * L'ambre : la tour de la plus lourde des organisations sans personne. Le
 * rouge : le seul segment critique, dans sa tour — un autre critique sur le
 * même écran est écrit à l'encre.
 */

/** Les gris des causes : l'ambre et le rouge sont pris, les causes se lisent en valeurs. */
export const TEINTE_CAUSE: Record<Cause, string> = {
  critique: '#d9d9d6',
  incident: '#6b6b68',
  jeton: '#a3a3a0',
  arrivee: '#4a4a48',
  demande: '#8a8a87',
  alerte: '#333333',
};

export const libelleSuivi = (o: OrgPoints) => (o.suivi.type === 'humain' ? 'SUIVI' : o.suivi.type === 'garde' ? 'LA GARDE' : o.suivi.type === 'personne' ? 'PERSONNE' : '—');

export function Horizon({ orgs, ambre, rouge, pret }: { orgs: OrgPoints[]; ambre: OrgPoints | null; rouge: OrgPoints | null; pret: boolean }) {
  const h = calculer(orgs);
  const px = h.pxParPoint;
  const navigate = useNavigate();
  const tours = h.tours ?? [];
  const serrees = tours.length > HORIZON.toursMax;
  return (
    <div>
      {h.tours === null ? (
        <div className="flex h-[264px] flex-col items-start justify-end gap-3 border-b border-[#252525] pb-6">
          <span className="font-sans text-[28px] font-bold tracking-[-0.03em] text-[#f7f7f5]">
            {h.debordement} organisations demandent un humain.
          </span>
          <span className="max-w-[60ch] text-[13.5px] text-[#a3a3a0]">Trop pour un horizon : elles sont dans la file, triées par le temps qu’il leur reste.</span>
          <Link to="/supervisor/a-traiter" className="bx-lien">
            Ouvrir la file À traiter
          </Link>
        </div>
      ) : (
        <div className="relative overflow-hidden">
          <div data-mv className="bx-balayage" aria-hidden />
          <ol className="relative grid items-start gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(tours.length, 1)}, minmax(${serrees ? 56 : 0}px, 1fr))` }} aria-label="Les tours de l’horizon">
            {tours.map((o) => (
              <Tour key={o.id} o={o} px={px} ambre={ambre?.id === o.id} rouge={rouge?.id === o.id} />
            ))}
          </ol>
        </div>
      )}
      {!pret && <span className="sr-only">Pesée en cours</span>}
      {(h.plateau.length > 0 || h.ligne.length > 0) && (
        <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-5 border-t border-[#1f1f1f] pt-6">
          {h.plateau.length > 0 && (
            <div className="min-w-0">
              {h.histogramme ? (
                <div className="flex h-[60px] items-end gap-[3px]" aria-hidden>
                  {h.histogramme.map((n, i) => (
                    <span key={i} className="w-[26px] bg-[#4a4a48]" style={{ height: Math.max(1, Math.round((n / Math.max(1, ...h.histogramme!)) * 58)) }} title={`${n} organisation${n > 1 ? 's' : ''} de poids ${i + 1}${i === 5 ? ' et plus' : ''}`} />
                  ))}
                </div>
              ) : (
                <div className="flex items-end gap-[2px]" aria-hidden>
                  {h.plateau.map((o) => (
                    <span
                      key={o.id}
                      title={`${o.nom} · poids ${o.poids} · ${o.raison}`}
                      onClick={() => navigate(`/supervisor/dossiers/${o.id}`)}
                      className="w-[5px] cursor-pointer bg-[#4a4a48] hover:bg-[#8a8a87]"
                      style={{ height: Math.max(1, Math.round(o.poids * px)) }}
                    />
                  ))}
                </div>
              )}
              <span className="mt-2 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#a3a3a0]">
                Le plateau · {h.plateau.length} organisation{h.plateau.length > 1 ? 's' : ''}, {Math.min(...h.plateau.map((o) => o.poids))} à {Math.max(...h.plateau.map((o) => o.poids))} points
              </span>
              <span className="mt-0.5 block text-[12px] text-[#9a9a97]">Même échelle que les tours · survol : nom, poids, raison</span>
            </div>
          )}
          {h.ligne.length > 0 && (
            <div className="min-w-0 flex-1">
              {h.ligne.length > HORIZON.ligneMax ? (
                <div className="h-px w-full bg-[#4a4a48]" aria-hidden />
              ) : (
                <div className="flex items-end gap-[3px]" aria-hidden>
                  {h.ligne.map((o) => (
                    <span key={o.id} title={`${o.nom} · rien d’ouvert`} onClick={() => navigate(`/supervisor/dossiers/${o.id}`)} className="h-[6px] w-px cursor-pointer bg-[#4a4a48] hover:bg-[#a3a3a0]" />
                  ))}
                </div>
              )}
              <span className="mt-2 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#a3a3a0]">
                La ligne d’horizon · {h.ligne.length} sans rien à traiter
              </span>
              <span className="mt-0.5 block text-[12px] text-[#9a9a97]">Un cran par organisation · la Garde les tient</span>
            </div>
          )}
          <Link to="/supervisor/grille" className="bx-lien ml-auto self-center">
            Tout voir dans la grille
          </Link>
        </div>
      )}
    </div>
  );
}

function Tour({ o, px, ambre, rouge }: { o: OrgPoints; px: number; ambre: boolean; rouge: boolean }) {
  const hauteur = Math.round(o.poids * px);
  // Les blocs, de bas en haut, dans l'ordre de la légende ; un bloc par point.
  const blocs: { cause: Cause; h: number }[] = [];
  for (const c of CAUSES) for (let i = 0; i < o.points[c]; i += 1) blocs.push({ cause: c, h: POIDS[c] * px });
  const qui = o.suivi.type === 'humain' ? o.suivi.email : null;
  return (
    <li className="min-w-0" data-signal-groupe={ambre ? 'horizon-ambre' : undefined}>
      <Link to={`/supervisor/dossiers/${o.id}`} className="bx-nav group block" title={`${o.nom} · poids ${o.poids} · ${o.raison}`} aria-label={`${o.nom}, poids ${o.poids} : ${o.raison}. Suivi : ${libelleSuivi(o).toLowerCase()}.`}>
        <div className="flex h-[264px] flex-col justify-end">
          <span className="mb-2 font-mono text-[11px] font-semibold tabular-nums" style={{ color: ambre ? AMBRE : '#a3a3a0' }}>
            {o.poids}
          </span>
          {o.poids === 0 ? (
            <span className="block h-px w-full bg-[#4a4a48]" />
          ) : (
            <span className="flex w-full flex-col-reverse" style={{ height: hauteur, boxShadow: ambre ? '0 0 26px -6px rgba(208,154,74,.75)' : undefined }}>
              {blocs.map((b, i) => {
                const critiqueRouge = rouge && b.cause === 'critique';
                return (
                  <span
                    key={i}
                    className="block w-full"
                    style={{
                      height: b.h,
                      background: critiqueRouge ? ROUGE.trait : ambre ? AMBRE : TEINTE_CAUSE[b.cause],
                      borderTop: i === blocs.length - 1 ? undefined : `1px solid ${ambre ? 'rgba(8,8,8,.28)' : 'rgba(11,11,11,.55)'}`,
                      boxShadow: critiqueRouge ? '0 0 22px rgba(255,66,48,.45)' : undefined,
                    }}
                  />
                );
              })}
            </span>
          )}
        </div>
        <span className="mt-3 block text-[13px] font-semibold leading-tight text-[#f7f7f5] group-hover:underline">{o.nom}</span>
        <span className="mt-1.5 line-clamp-4 block text-[12px] leading-[1.4] text-[#9a9a97]">{o.raison}</span>
        <span className="mt-2.5 flex items-center gap-2">
          {qui && <UserAvatar email={qui} size={18} />}
          <span className="font-mono text-[9.5px] font-semibold tracking-[0.14em]" style={{ color: ambre ? AMBRE : '#a3a3a0' }}>
            {libelleSuivi(o)}
          </span>
        </span>
      </Link>
    </li>
  );
}

export function Legende({ rouge = true }: { rouge?: boolean }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Les poids des causes">
      {CAUSES.map((c) => (
        <li key={c} className="flex items-center gap-1.5 font-mono text-[9.5px] tracking-[0.06em] text-[#a3a3a0]">
          <span className="h-2 w-2" style={{ background: c === 'critique' && rouge ? ROUGE.trait : TEINTE_CAUSE[c], outline: c === 'alerte' ? '1px solid #4a4a48' : undefined }} aria-hidden />
          {LIBELLE_CAUSE[c]} ×{POIDS[c]}
        </li>
      ))}
    </ul>
  );
}

/** « Neuf », « Dix », « 200 » — le compte d'organisations en tête de phrase. */
export const nombreOrgs = (n: number, maj = false) => (n <= 20 ? enLettres(n, maj) : String(n));
