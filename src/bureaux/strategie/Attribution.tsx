import React from 'react';
import { Link } from 'react-router-dom';
import { AMBRE } from '../jetons';
import { useStrategie, type Prospect } from '../donnees/strategie';
import type { ProspectStrategie } from '../donnees/types';
import { Carte, EnTete, Invitation } from '../ui/kit';
import { enLettresF } from '../format';
import { useEcrire } from './commun';

/**
 * STRATÉGIE · L'ATTRIBUTION (cahier 15, `51c` · 13).
 *
 * D'où vient chaque cliente gagnée : une campagne, un parrainage (« venue
 * par »), la recherche, le bouche à oreille, un salon. Une barre par origine,
 * à la largeur de ce qu'elle a rapporté ; dessous, les clientes gagnées une
 * à une.
 *
 * L'ambre : la cliente gagnée dont on ne sait pas d'où elle vient — la
 * seule question que l'attribution pose à un humain (« comment nous
 * avez-vous connus ? »).
 */

type Origine = { cle: string; nom: string };
function origineDe(p: Prospect, campagnes: Map<string, string>): Origine | null {
  if (p.campagneId && campagnes.has(p.campagneId)) return { cle: `campagne:${p.campagneId}`, nom: `Campagne · ${campagnes.get(p.campagneId)}` };
  if (p.venuPar) return { cle: 'parrainage', nom: 'Parrainage' };
  if (p.source === 'bouche') return { cle: 'bouche', nom: 'Bouche à oreille' };
  if (p.source === 'site') return { cle: 'site', nom: 'Recherche, site public' };
  if (p.source === 'salon') return { cle: 'salon', nom: 'Salon, marché' };
  if (p.source) return { cle: p.source, nom: p.source };
  return null;
}
const eur = (cents: number) => `${Math.round(cents / 100).toLocaleString('fr-FR')} €`;

export function StrategieAttribution() {
  const m = useStrategie();
  const ecrire = useEcrire<ProspectStrategie>('prospects');
  const campagnes = new Map(m.campagnes.map((c) => [c.id, c.titre]));
  const gagnees = m.prospects.filter((p) => p.stage === 'gagne').sort((a, b) => (b.movedAt ?? '').localeCompare(a.movedAt ?? ''));
  const inconnues = gagnees.filter((p) => !origineDe(p, campagnes));
  const ambre = inconnues[0] ?? null;
  const parOrigine = new Map<string, { nom: string; n: number; valeur: number }>();
  for (const p of gagnees) {
    const o = origineDe(p, campagnes);
    if (!o) continue;
    const e = parOrigine.get(o.cle) ?? { nom: o.nom, n: 0, valeur: 0 };
    e.n += 1;
    e.valeur += p.valueCents || 0;
    parOrigine.set(o.cle, e);
  }
  const barres = [...parOrigine.values()].sort((a, b) => b.valeur - a.valeur || b.n - a.n);
  const max = Math.max(1, ...barres.map((b) => b.valeur));
  const titre = gagnees.length === 0 ? 'Aucune cliente gagnée encore.' : ambre ? `${enLettresF(inconnues.length, true)} cliente${inconnues.length > 1 ? 's' : ''} gagnée${inconnues.length > 1 ? 's' : ''} sans origine connue.` : barres[0] ? `${barres[0].nom.replace(/^Campagne · /, 'La campagne « ').replace(/^(La campagne « .*)$/, '$1 »')} rapporte le plus.` : '';

  return (
    <>
      <EnTete surtitre="Stratégie · Pipeline · Attribution" titre={titre} />
      {gagnees.length === 0 ? (
        <Invitation titre="Rien à attribuer." texte="Chaque cliente gagnée garde d’où elle vient : une campagne, un parrainage, la recherche, le bouche à oreille. L’attribution les compte." action={<Link to="/strategie/pipeline" className="bx-btn2">Le pipeline</Link>} />
      ) : (
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_360px]">
          <Carte dominante pad="p-6" className="self-start" titre={`D’où viennent les ${gagnees.length} clientes gagnées`} droite="barre = ce qu’elles rapportent">
            {barres.map((b) => (
              <div key={b.nom} className="grid grid-cols-[210px_minmax(0,1fr)_120px] items-center gap-4 py-2.5">
                <span className="truncate text-[13px] font-semibold text-text-primary">{b.nom}</span>
                <span className="h-[12px] bg-[#1f1f23]" aria-hidden>
                  <span className="block h-full bg-[#8a8a8f]" style={{ width: `${(b.valeur / max) * 100}%` }} />
                </span>
                <span className="text-right font-mono text-[11px] tabular-nums text-text-secondary">
                  {b.n} · {eur(b.valeur)}
                </span>
              </div>
            ))}
            {inconnues.length > 0 && (
              <div className="grid grid-cols-[210px_minmax(0,1fr)_120px] items-center gap-4 py-2.5" data-signal-groupe="attribution-ambre">
                <span className="text-[13px] font-semibold" style={{ color: AMBRE }}>
                  Origine inconnue
                </span>
                <span className="h-[12px] border border-dashed" style={{ borderColor: AMBRE }} aria-hidden />
                <span className="text-right font-mono text-[11px] tabular-nums" style={{ color: AMBRE }}>
                  {inconnues.length} · à demander
                </span>
              </div>
            )}
          </Carte>
          <Carte className="self-start" titre="Les clientes gagnées" droite={gagnees.length}>
            {gagnees.map((p) => {
              const o = origineDe(p, campagnes);
              const estAmbre = ambre?.id === p.id;
              return (
                <div key={p.id} className="border-b border-[#222226] py-2.5">
                  <span className="flex items-baseline justify-between gap-3">
                    <Link to={`/strategie/pipeline/${p.id}`} className="truncate text-[13.5px] font-semibold text-text-primary hover:underline">
                      {p.company || p.name}
                    </Link>
                    <span className="font-mono text-[10.5px] tabular-nums text-text-muted">{eur(p.valueCents || 0)}</span>
                  </span>
                  {o ? (
                    <span className="mt-0.5 block text-[12px] text-text-secondary">
                      {o.nom}
                      {p.venuPar ? ` · par ${p.venuPar}` : ''}
                    </span>
                  ) : (
                    <label className="mt-1 flex items-center gap-2 text-[12px]" style={{ color: estAmbre ? AMBRE : 'var(--color-text-secondary)' }} data-signal-groupe={estAmbre ? 'attribution-ambre' : undefined}>
                      d’où vient-elle ?
                      <select value="" onChange={(e) => e.target.value && ecrire(p.id, () => (e.target.value.startsWith('campagne:') ? { campagneId: e.target.value.slice(9) } : { source: e.target.value }))} className="h-7 border border-[#28282c] bg-[#141416] px-1.5 text-[12px] text-text-body" aria-label={`L’origine de ${p.company || p.name}`}>
                        <option value="">choisir…</option>
                        <option value="bouche">Bouche à oreille</option>
                        <option value="site">Recherche, site public</option>
                        <option value="salon">Salon, marché</option>
                        {m.campagnes.map((c) => (
                          <option key={c.id} value={`campagne:${c.id}`}>
                            Campagne · {c.titre}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              );
            })}
          </Carte>
        </div>
      )}
    </>
  );
}
