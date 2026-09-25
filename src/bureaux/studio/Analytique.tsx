import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AMBRE } from '../jetons';
import type { Piece } from '../donnees/studio';
import type { PieceStudio } from '../donnees/types';
import { Carte, Invitation } from '../ui/kit';
import { jourCourt } from '../format';
import { jjmm, TetePiece, useEcrirePiece, usePieceCourante } from './commun';

/**
 * STUDIO · L'ANALYTIQUE, ET SON FANTÔME (cahier 14, `48c`).
 *
 * Chaque mesure se lit contre la même période d'avant : la courbe des visites
 * de la semaine, et en pointillé celle de la semaine précédente ; sous elle,
 * six relevés avec leur valeur d'avant et l'écart. On ne demande pas « c'est
 * bien ? », on voit si c'est mieux.
 *
 * L'ambre : le seul relevé qui s'est NETTEMENT dégradé (au-delà de son seuil,
 * le plus loin au-delà s'il y en a plusieurs), et sa cause écrite à l'encre
 * dessous — avec la mise en ligne qui l'a précédée.
 *
 * Les relevés sont hebdomadaires et portés par la pièce (`mesures`) ; tant
 * qu'aucun compteur n'est relié au site, ils se notent à la main.
 */

type Mesure = NonNullable<PieceStudio['mesures']>[number];
type Cle = 'visites' | 'conversions' | 'taux' | 'p75' | 'dispo' | 'erreurs';

const nf = (n: number, d = 0) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const taux = (m: Mesure) => (m.visites ? (m.conversions / m.visites) * 100 : 0);

const RELEVES: { cle: Cle; nom: string; lire: (m: Mesure) => number; ecrire: (v: number) => string; pire: 'haut' | 'bas'; ecart: (a: number, b: number) => string; degrade: (avant: number, apres: number) => number; titre: string; phrase: string }[] = [
  { cle: 'visites', nom: 'Visites', lire: (m) => m.visites, ecrire: (v) => nf(v), pire: 'bas', ecart: pourcent, degrade: (a, b) => (a ? (a - b) / a / 0.2 : 0), titre: 'Pourquoi les visites ont baissé', phrase: 'nettement moins de visites' },
  { cle: 'conversions', nom: 'Conversions', lire: (m) => m.conversions, ecrire: (v) => nf(v), pire: 'bas', ecart: pourcent, degrade: (a, b) => (a - b >= 3 && a ? (a - b) / a / 0.2 : 0), titre: 'Pourquoi les conversions ont baissé', phrase: 'moins de conversions' },
  { cle: 'taux', nom: 'Taux', lire: taux, ecrire: (v) => `${nf(v, 1)} %`, pire: 'bas', ecart: (a, b) => (nf(a, 1) === nf(b, 1) ? '=' : `${b > a ? '+' : '−'}${nf(Math.abs(b - a), 1)} pt`), degrade: (a, b) => (a ? (a - b) / a / 0.2 : 0), titre: 'Pourquoi le taux a baissé', phrase: 'on convertit moins bien' },
  { cle: 'p75', nom: 'Chargement p75', lire: (m) => m.p75, ecrire: (v) => `${nf(v, 1)} s`, pire: 'haut', ecart: pourcent, degrade: (a, b) => (a ? (b - a) / a / 0.2 : 0), titre: 'Pourquoi le chargement a ralenti', phrase: 'le site charge plus lentement' },
  { cle: 'dispo', nom: 'Disponibilité', lire: (m) => m.dispo, ecrire: (v) => `${nf(v, 2)} %`, pire: 'bas', ecart: (a, b) => (nf(a, 2) === nf(b, 2) ? '=' : `${b > a ? '+' : '−'}${nf(Math.abs(b - a), 2)}`), degrade: (a, b) => (a - b) / 0.1, titre: 'Pourquoi le site a été moins disponible', phrase: 'le site a été moins disponible' },
  { cle: 'erreurs', nom: 'Erreurs 5xx', lire: (m) => m.erreurs, ecrire: (v) => nf(v), pire: 'haut', ecart: (a, b) => (a === b ? '=' : `${b > a ? '+' : '−'}${Math.abs(b - a)}`), degrade: (a, b) => (b - a >= 5 && b >= 2 * Math.max(1, a) ? (b - a) / 5 : 0), titre: 'Pourquoi les erreurs ont monté', phrase: 'le site renvoie plus d’erreurs' },
];

function pourcent(a: number, b: number): string {
  if (!a) return '—';
  const p = Math.round(((b - a) / a) * 100);
  return p === 0 ? '=' : `${p > 0 ? '+' : '−'}${Math.abs(p)} %`;
}

export function StudioAnalytique() {
  const { p, absente } = usePieceCourante();
  if (!p) return <>{absente}</>;
  return <Analytique p={p} />;
}

function Analytique({ p }: { p: Piece }) {
  const ecrire = useEcrirePiece();
  const [noter, setNoter] = useState(false);
  const [cause, setCause] = useState('');
  const mesures = [...(p.mesures ?? [])].sort((a, b) => b.semaine.localeCompare(a.semaine));
  const cur = mesures[0] ?? null;
  const prev = mesures[1] ?? null;

  // Le relevé nettement dégradé : au-delà de son seuil (score ≥ 1), le plus loin au-delà.
  const degrades = cur && prev ? RELEVES.map((r) => ({ r, score: r.degrade(r.lire(prev), r.lire(cur)) })).filter((x) => x.score >= 1).sort((a, b) => b.score - a.score) : [];
  const ambre = degrades[0]?.r ?? null;
  const misesEnLigne = [...(p.livraison?.misesEnLigne ?? [])].sort((a, b) => b.at.localeCompare(a.at));
  const avantReleve = cur ? misesEnLigne.find((m) => m.at.slice(0, 10) <= cur.semaine && Date.parse(cur.semaine) - Date.parse(m.at) < 9 * 86_400_000) ?? null : null;
  const causeEcrite = ambre ? p.causes?.[ambre.cle] ?? null : null;

  const titre = (() => {
    if (!cur) return 'Aucun relevé encore.';
    if (!prev) return 'Un premier relevé, rien encore à comparer.';
    const dv = cur.visites - prev.visites;
    const sens = Math.abs(dv) < prev.visites * 0.02 ? 0 : Math.sign(dv);
    if (ambre?.cle === 'visites') return `Nettement moins de visites que la semaine d’avant.`;
    if (ambre) return `${sens > 0 ? 'Plus de visites, mais' : sens < 0 ? 'Moins de visites, et' : 'Autant de visites, mais'} ${ambre.phrase}.`;
    return `${sens > 0 ? 'Plus de visites' : sens < 0 ? 'Un peu moins de visites' : 'Autant de visites'}, et rien ne s’est dégradé.`;
  })();

  const noterReleve = (m: Mesure) => {
    ecrire(p.id, (b) => ({ mesures: [...(b.mesures ?? []).filter((x) => x.semaine !== m.semaine), m] }));
    setNoter(false);
  };

  return (
    <>
      <TetePiece
        p={p}
        onglet="analytique"
        titre={titre}
        actions={
          <button type="button" className="bx-btn2" onClick={() => setNoter(!noter)} aria-expanded={noter}>
            Noter un relevé
          </button>
        }
      />
      {noter && <FormReleve dernier={cur} onNoter={noterReleve} onAnnuler={() => setNoter(false)} />}
      {!cur ? (
        <Invitation titre="L’analytique attend son premier relevé." texte="Chaque semaine se lit contre la précédente : visites, conversions, taux, chargement, disponibilité, erreurs. Il faut deux relevés pour voir un écart." />
      ) : (
        <>
          <section className="bx-dom p-6">
            <div className="mb-[22px] flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#a3a3a0]">Les visites · 7 derniers jours</span>
              <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-[#9a9a97]">{prev ? 'trait plein = cette semaine · pointillé = la précédente' : 'trait plein = cette semaine'}</span>
            </div>
            <Courbe cur={cur} prev={prev} />
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              {RELEVES.map((r) => {
                const estAmbre = ambre?.cle === r.cle;
                const v = r.lire(cur);
                return (
                  <div key={r.cle} className="border px-4 py-4" style={{ borderColor: estAmbre ? AMBRE : '#2a2826', background: estAmbre ? 'rgba(208,154,74,.07)' : '#141312' }} data-signal-groupe={estAmbre ? 'analytique-ambre' : undefined}>
                    <span className="block font-mono text-[9.5px] uppercase tracking-[0.14em]" style={{ color: estAmbre ? AMBRE : '#9a9a97' }}>
                      {r.nom}
                    </span>
                    <span className="mt-2.5 block font-mono text-[21px] font-semibold tabular-nums tracking-[-0.02em] text-[#f7f7f5]">{r.ecrire(v)}</span>
                    <span className="mt-1.5 block font-mono text-[10.5px] tabular-nums" style={{ color: estAmbre ? AMBRE : '#a3a3a0' }}>
                      {prev ? `${r.ecart(r.lire(prev), v)} · avant ${r.ecrire(r.lire(prev))}` : 'premier relevé'}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
          <div className="mt-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-2">
            {cur.sources?.length ? (
              <Carte titre="Les sources" droite="cette semaine">
                {cur.sources.map((s) => (
                  <div key={s.nom} className="grid grid-cols-[110px_minmax(0,1fr)_44px] items-center gap-3 py-2">
                    <span className="text-[13px] font-semibold text-[#e4e4e1]">{s.nom}</span>
                    <span className="h-[6px] bg-[#1f1e1c]" aria-hidden>
                      <span className="block h-full bg-[#8a8a87]" style={{ width: `${Math.min(100, s.part)}%` }} />
                    </span>
                    <span className="text-right font-mono text-[11px] tabular-nums text-[#a3a3a0]">{s.part} %</span>
                  </div>
                ))}
              </Carte>
            ) : (
              <Carte titre="Les sources">
                <p className="text-[13px] leading-relaxed text-[#a3a3a0]">D’où viennent les visites se lira ici quand le relevé le dira (recherche, direct, réseaux, lettre).</p>
              </Carte>
            )}
            {ambre ? (
              <Carte titre={ambre.titre}>
                {avantReleve && (
                  <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-baseline gap-3.5 border-b border-[#1f1e1c] py-3">
                    <span className="font-mono text-[11px] text-[#9a9a97]">{jourCourt(avantReleve.at)}</span>
                    <span className="text-[13px] leading-[1.5] text-[#e4e4e1]">
                      {/^\d/.test(avantReleve.version) ? `v${avantReleve.version}` : avantReleve.version} mise en ligne{avantReleve.quoi ? ` : ${avantReleve.quoi}` : ''}
                    </span>
                    <span className="font-mono text-[10.5px] uppercase text-[#9a9a97]">avant</span>
                  </div>
                )}
                {causeEcrite ? (
                  <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-baseline gap-3.5 border-b border-[#1f1e1c] py-3">
                    <span className="font-mono text-[11px] text-[#9a9a97]">{ambre.cle === 'p75' ? 'P75' : ambre.nom.toUpperCase().slice(0, 6)}</span>
                    <span className="text-[13px] leading-[1.5] text-[#e4e4e1]">{causeEcrite}</span>
                    <span className="font-mono text-[10.5px] uppercase text-[#9a9a97]">cause</span>
                  </div>
                ) : (
                  <form
                    className="flex gap-2 border-b border-[#1f1e1c] py-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (cause.trim()) ecrire(p.id, (b) => ({ causes: { ...(b.causes ?? {}), [ambre.cle]: cause.trim() } }));
                      setCause('');
                    }}
                  >
                    <input value={cause} onChange={(e) => setCause(e.target.value)} placeholder="La cause n’est pas encore écrite…" aria-label="La cause" className="h-9 min-w-0 flex-1 border border-[#2a2826] bg-transparent px-2.5 text-[13px] text-[#f7f7f5] outline-none placeholder:text-[#9a9a97] focus:border-[#8a8a87]" />
                    <button type="submit" className="bx-btn2" disabled={!cause.trim()}>
                      Écrire
                    </button>
                  </form>
                )}
                {ambre.cle === 'p75' && cur.p75Mobile && cur.p75Bureau && (
                  <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-baseline gap-3.5 border-b border-[#1f1e1c] py-3">
                    <span className="font-mono text-[11px] text-[#9a9a97]">P75</span>
                    <span className="text-[13px] leading-[1.5] text-[#e4e4e1]">
                      Mobile {nf(cur.p75Mobile, 1)} s · bureau {nf(cur.p75Bureau, 1)} s
                    </span>
                    <span className="font-mono text-[10.5px] uppercase text-[#9a9a97]">détail</span>
                  </div>
                )}
                {avantReleve && (
                  <Link to={`/studio/pieces/${p.id}/livraison`} className="bx-btn2 mt-4 w-full">
                    Ouvrir la livraison du {jjmm(avantReleve.at).split('/')[0]}
                  </Link>
                )}
              </Carte>
            ) : (
              <Carte titre="Ce qui a bougé">
                <p className="text-[13px] leading-relaxed text-[#a3a3a0]">{prev ? 'Aucun relevé ne s’est nettement dégradé depuis la semaine d’avant.' : 'Le prochain relevé dira ce qui a bougé.'}</p>
              </Carte>
            )}
          </div>
        </>
      )}
    </>
  );
}

/** La courbe de la semaine, et son fantôme en pointillé. */
function Courbe({ cur, prev }: { cur: Mesure; prev: Mesure | null }) {
  const a = cur.jours?.length ? cur.jours : null;
  const b = prev?.jours?.length ? prev.jours : null;
  if (!a) return <p className="py-8 text-[13px] text-[#a3a3a0]">Le relevé de la semaine n’a pas le détail jour par jour : seuls les totaux sont comparés.</p>;
  const max = Math.max(...a, ...(b ?? [])) * 1.25 || 1;
  const W = 1000;
  const H = 200;
  const chemin = (v: number[]) => v.map((x, i) => `${i ? 'L' : 'M'}${(i / (v.length - 1)) * W} ${H - (x / max) * H}`).join(' ');
  const fin = new Date(`${cur.semaine}T12:00:00`);
  const jours = a.map((_, i) => jourCourt(new Date(fin.getTime() - (a.length - 1 - i) * 86_400_000)).split(' ')[0]);
  return (
    <div>
      <div className="border border-[#2a2826] bg-[#0b0a09]">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[200px] w-full" role="img" aria-label={`Visites jour par jour : ${a.join(', ')}${b ? ` ; la semaine d’avant : ${b.join(', ')}` : ''}`}>
          {b && <path d={chemin(b)} fill="none" stroke="#6b6b68" strokeWidth={1.4} strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />}
          <path d={chemin(a)} fill="none" stroke="#e4e4e1" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mt-2 flex justify-between font-mono text-[9.5px] tracking-[0.1em] text-[#9a9a97]">
        {jours.map((j, i) => (
          <span key={i}>{j}</span>
        ))}
      </div>
    </div>
  );
}

function FormReleve({ dernier, onNoter, onAnnuler }: { dernier: Mesure | null; onNoter: (m: Mesure) => void; onAnnuler: () => void }) {
  // Un relevé couvre les 7 jours qui finissent à sa date ; noter deux fois le même jour remplace.
  const jourJ = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const [v, setV] = useState({ visites: '', conversions: '', p75: '', dispo: '', erreurs: '' });
  const champs: [keyof typeof v, string, string][] = [
    ['visites', 'Visites', String(dernier?.visites ?? '')],
    ['conversions', 'Conversions', String(dernier?.conversions ?? '')],
    ['p75', 'Chargement p75 (s)', String(dernier?.p75 ?? '')],
    ['dispo', 'Disponibilité (%)', String(dernier?.dispo ?? '')],
    ['erreurs', 'Erreurs 5xx', String(dernier?.erreurs ?? '')],
  ];
  const nombre = (s: string) => Number(s.replace(',', '.'));
  const valide = champs.every(([k]) => v[k].trim() !== '' && Number.isFinite(nombre(v[k])));
  return (
    <Carte pad="p-5" className="mb-[18px]" titre={`Le relevé des 7 jours au ${jjmm(jourJ)}`} droite="noté deux fois le même jour, le second remplace le premier">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {champs.map(([k, l, ph]) => (
          <label key={k} className="block">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#9a9a97]">{l}</span>
            <input value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} inputMode="decimal" placeholder={ph} className="mt-1.5 h-9 w-full border border-[#2a2826] bg-transparent px-2.5 font-mono text-[13px] text-[#f7f7f5] outline-none placeholder:text-[#9a9a97] focus:border-[#8a8a87]" />
          </label>
        ))}
      </div>
      <div className="mt-3 flex gap-2.5">
        <button type="button" className="bx-btn" disabled={!valide} onClick={() => onNoter({ semaine: jourJ, visites: nombre(v.visites), conversions: nombre(v.conversions), p75: nombre(v.p75), dispo: nombre(v.dispo), erreurs: nombre(v.erreurs) })}>
          Noter
        </button>
        <button type="button" className="bx-btn2" onClick={onAnnuler}>
          Annuler
        </button>
      </div>
    </Carte>
  );
}
