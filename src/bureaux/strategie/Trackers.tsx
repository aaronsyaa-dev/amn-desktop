import React, { useMemo, useState } from 'react';
import { useCollection } from '../../state/SyncContext';
import { AMBRE } from '../jetons';
import { useReleves, jourDe } from '../donnees/releves';
import type { PieceStudio } from '../donnees/types';
import { Carte, EnTete } from '../ui/kit';
import { enLettres, signe } from '../format';

/**
 * LES TRACKERS DE L'ÉQUIPE, AU NIVEAU DES BUREAUX (cahier 15, `51b`).
 *
 * Temps, objectifs, habitudes, projets : quatre trackers, chacun avec sa
 * courbe de huit semaines et, en pointillé, les mêmes semaines de la période
 * de comparaison (le trimestre précédent, ou l'an dernier). Le chiffre dit où
 * l'on est, l'écart dit si c'est mieux. On compare une période à la
 * précédente, ou à la même l'an dernier — jamais à une moyenne.
 *
 * Chaque tracker lit une donnée réelle, qui garde son historique :
 *   · Temps — les heures pointées par l'équipe (`timeEntries`) ;
 *   · Objectifs — les objectifs atteints (`objectives`), relevés chaque jour
 *     dans `parcReleves` pour en garder la trace semaine après semaine ;
 *   · Habitudes — la relève de la Garde lue avant 9 h, les jours de semaine
 *     (`suivis`, `releve-lue:<jour>`) ;
 *   · Projets — les retours de clientes traités sous 48 h (`studioPieces`).
 * Là où l'historique ne remonte pas assez loin, la courbe s'interrompt : on
 * ne comble pas un trou par une valeur inventée.
 *
 * L'ambre : le seul tracker en retard sur sa comparaison (le plus en retard,
 * s'il y en a plusieurs).
 */

type Periode = 'semaine' | 'mois' | 'trimestre';
type Comparaison = 'precedente' | 'an-dernier';
const SEMAINE = 7 * 86_400_000;

/** Le lundi 00:00 de la semaine de `t`. */
function lundi(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/** Début et fin de la période courante, et de celle qu'on lui compare. */
function bornes(periode: Periode, comparaison: Comparaison, maintenant: number) {
  const d = new Date(maintenant);
  let debut: Date;
  if (periode === 'semaine') debut = new Date(lundi(maintenant));
  else if (periode === 'mois') debut = new Date(d.getFullYear(), d.getMonth(), 1);
  else debut = new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
  const fin = maintenant;
  const recule = (x: Date) => {
    const y = new Date(x);
    if (comparaison === 'an-dernier') y.setFullYear(y.getFullYear() - 1);
    else if (periode === 'semaine') y.setDate(y.getDate() - 7);
    else if (periode === 'mois') y.setMonth(y.getMonth() - 1);
    else y.setMonth(y.getMonth() - 3);
    return y;
  };
  // La période d'avant est prise à la même avancée : lundi → jeudi contre lundi → jeudi.
  const avantDebut = recule(debut).getTime();
  const avantFin = avantDebut + (fin - debut.getTime());
  return { debut: debut.getTime(), fin, avantDebut, avantFin };
}

interface Tracker {
  cle: 'temps' | 'objectifs' | 'habitudes' | 'projets';
  famille: string;
  titre: string;
  /** Huit semaines, la dernière = la semaine en cours ; `null` = pas de donnée. */
  serie: (number | null)[];
  fantome: (number | null)[];
  valeur: string;
  ecart: string | null;
  /** L'écart rapporté à la valeur d'avant (négatif = en retard) ; `null` = rien à comparer. */
  relatif: number | null;
}

export function StrategieTrackers() {
  const temps = useCollection<{ startedAt: string; endedAt: string }>('timeEntries');
  const objectifs = useCollection<{ label: string; currentValue: number; targetValue: number; unit: string; periodLabel: string }>('objectives');
  const suivis = useCollection<{ at?: string }>('suivis');
  const pieces = useCollection<PieceStudio>('studioPieces');
  const releves = useReleves();
  const [periode, setPeriode] = useState<Periode>('trimestre');
  const [comparaison, setComparaison] = useState<Comparaison>('precedente');
  const maintenant = Date.now();

  const trackers = useMemo<Tracker[]>(() => {
    const b = bornes(periode, comparaison, maintenant);
    const decalage = comparaison === 'an-dernier' ? 52 * SEMAINE : 13 * SEMAINE;
    const semaines = Array.from({ length: 8 }, (_, i) => lundi(maintenant) - (7 - i) * SEMAINE);

    /* ── Temps : les heures pointées ── */
    const heuresEntre = (a: number, z: number) =>
      temps.reduce((s, t) => {
        const deb = Date.parse(t.startedAt);
        const fin = t.endedAt ? Date.parse(t.endedAt) : maintenant;
        if (!(deb >= a && deb < z)) return s;
        return s + Math.max(0, fin - deb) / 3_600_000;
      }, 0);
    const avecTemps = temps.length > 0;
    const plusAncien = temps.reduce((m, t) => Math.min(m, Date.parse(t.startedAt)), Infinity);
    const tempsSerie = (decal: number) => semaines.map((s) => (avecTemps && s - decal + SEMAINE > plusAncien ? Math.round(heuresEntre(s - decal, s - decal + SEMAINE)) : null));
    const hNow = heuresEntre(b.debut, b.fin);
    // On ne compare qu'à une période entièrement couverte par l'historique.
    const hAvant = b.avantDebut >= plusAncien - 7 * 86_400_000 ? heuresEntre(b.avantDebut, b.avantFin) : null;

    /* ── Objectifs : atteints, relevés chaque jour ── */
    const atteintsLe = (t: number): { atteints: number; total: number } | null => {
      for (let j = 0; j < 7; j += 1) {
        const r = releves.get(jourDe(t - j * 86_400_000));
        if (r?.equipe?.objectifs) return r.equipe.objectifs;
      }
      return null;
    };
    const atteintsMaintenant = objectifs.filter((o) => o.currentValue >= o.targetValue).length;
    const objAvant = atteintsLe(b.avantFin);
    const objSerie = (decal: number) => semaines.map((s, i) => (decal === 0 && i === 7 ? atteintsMaintenant : atteintsLe(s - decal + SEMAINE - 1)?.atteints ?? null));

    /* ── Habitudes : relève lue avant 9 h, jours de semaine ── */
    const lues = new Map(suivis.filter((s) => s.id.startsWith('releve-lue:') && s.at).map((s) => [s.id.slice(11), new Date(s.at!).getHours() < 9]));
    const joursOuvres = (a: number, z: number) => {
      let n = 0;
      let ok = 0;
      for (let t = a; t < z; t += 86_400_000) {
        const d = new Date(t);
        if (d.getDay() === 0 || d.getDay() === 6) continue;
        n += 1;
        if (lues.get(jourDe(t))) ok += 1;
      }
      return { n, ok };
    };
    const premiereLecture = [...lues.keys()].sort()[0] ?? null;
    const habSerie = (decal: number) => semaines.map((s) => (premiereLecture && jourDe(s - decal + SEMAINE) > premiereLecture ? joursOuvres(s - decal, Math.min(s - decal + SEMAINE, maintenant)).ok : null));
    const habNow = joursOuvres(b.debut, b.fin);
    const habAvant = premiereLecture && jourDe(b.avantDebut) >= premiereLecture ? joursOuvres(b.avantDebut, b.avantFin) : null;

    /* ── Projets : retours traités sous 48 h ── */
    const retours = pieces.flatMap((p) => p.retours ?? []);
    const sous48 = (a: number, z: number): number | null => {
      const ici = retours.filter((r) => {
        const t = Date.parse(r.at);
        return t >= a && t < z && (r.traiteLe || maintenant - t > 48 * 3_600_000);
      });
      if (!ici.length) return null;
      const bons = ici.filter((r) => r.traiteLe && Date.parse(r.traiteLe) - Date.parse(r.at) <= 48 * 3_600_000).length;
      return Math.round((bons / ici.length) * 100);
    };
    const projSerie = (decal: number) => semaines.map((s) => sous48(s - decal, s - decal + SEMAINE));
    const projNow = sous48(b.debut, b.fin);
    const projAvant = sous48(b.avantDebut, b.avantFin);

    const rel = (a: number | null, z: number | null) => (a === null || z === null ? null : z === 0 ? (a > 0 ? 1 : 0) : (a - z) / z);
    const nomAvant = comparaison === 'an-dernier' ? 'l’an dernier' : periode === 'semaine' ? 'la semaine d’avant' : periode === 'mois' ? 'le mois d’avant' : 'le trimestre d’avant';
    return [
      {
        cle: 'temps',
        famille: 'Temps',
        titre: 'Heures de l’équipe',
        serie: tempsSerie(0),
        fantome: tempsSerie(decalage),
        valeur: `${Math.round(hNow)} h`,
        ecart: hAvant === null ? null : hAvant ? `${signe(Math.round(((hNow - hAvant) / hAvant) * 100))} % sur ${nomAvant}` : null,
        relatif: rel(hNow, hAvant),
      },
      {
        cle: 'objectifs',
        famille: 'Objectifs',
        titre: 'Objectifs atteints',
        serie: objSerie(0),
        fantome: objSerie(decalage),
        valeur: objectifs.length ? `${atteintsMaintenant} / ${objectifs.length}` : '—',
        ecart: objAvant ? `${signe(atteintsMaintenant - objAvant.atteints)} sur ${nomAvant}` : null,
        relatif: objAvant ? rel(atteintsMaintenant, objAvant.atteints) : null,
      },
      {
        cle: 'habitudes',
        famille: 'Habitudes',
        titre: 'Relève lue avant 9 h',
        serie: habSerie(0),
        fantome: habSerie(decalage),
        valeur: premiereLecture ? `${habNow.ok} / ${habNow.n} j` : '—',
        ecart: habAvant && habAvant.n ? `${signe(habNow.ok - habAvant.ok)} j sur ${nomAvant}` : null,
        relatif: habAvant && habAvant.n && habNow.n ? rel(habNow.ok / habNow.n, habAvant.ok / habAvant.n) : null,
      },
      {
        cle: 'projets',
        famille: 'Projets',
        titre: 'Retours traités sous 48 h',
        serie: projSerie(0),
        fantome: projSerie(decalage),
        valeur: projNow === null ? '—' : `${projNow} %`,
        ecart: projNow !== null && projAvant !== null ? `${signe(projNow - projAvant)} pts sur ${nomAvant}` : null,
        relatif: rel(projNow, projAvant),
      },
    ];
  }, [temps, objectifs, suivis, pieces, releves, periode, comparaison, maintenant]);

  const enRetard = trackers.filter((t) => t.relatif !== null && t.relatif < -0.02).sort((a, b) => (a.relatif ?? 0) - (b.relatif ?? 0));
  const ambre = enRetard[0] ?? null;
  const manquent = objectifs.filter((o) => o.currentValue < o.targetValue);
  const titre = ambre
    ? enRetard.length === 1
      ? `Tout avance, sauf ${ambre.cle === 'temps' ? 'le temps de l’équipe' : ambre.cle === 'objectifs' ? 'les objectifs' : ambre.cle === 'habitudes' ? 'la lecture de la relève' : 'les retours traités à temps'}.`
      : `${enLettres(enRetard.length, true)} trackers reculent, ${ambre.famille.toLowerCase()} d’abord.`
    : trackers.some((t) => t.relatif !== null)
      ? 'Les quatre trackers tiennent ou avancent.'
      : 'Les trackers commencent leur historique.';

  return (
    <>
      <EnTete surtitre="Stratégie · Objectifs · Trackers" titre={titre} />
      <section className="bx-dom p-6">
        <div className="mb-[22px] flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#a3a3a0]">Les quatre trackers de l’équipe · 8 semaines</span>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-[#9a9a97]">plein = ces semaines · pointillé = {comparaison === 'an-dernier' ? 'les mêmes l’an dernier' : 'le trimestre d’avant, à la même semaine'}</span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {trackers.map((t) => (
            <TrackerCarte key={t.cle} t={t} ambre={ambre?.cle === t.cle} />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(['semaine', 'mois', 'trimestre'] as Periode[]).map((p) => (
            <button key={p} type="button" aria-pressed={periode === p} onClick={() => setPeriode(p)} className="h-8 border px-3 text-[12.5px] font-semibold" style={{ borderColor: periode === p ? '#8a8a8f' : '#28282c', color: periode === p ? '#f7f7f5' : '#a3a3a0' }}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
          <button type="button" aria-pressed={comparaison === 'an-dernier'} onClick={() => setComparaison(comparaison === 'an-dernier' ? 'precedente' : 'an-dernier')} className="h-8 border px-3 text-[12.5px] font-semibold" style={{ borderColor: '#28282c', color: '#e4e4e1' }}>
            Comparer à : {comparaison === 'an-dernier' ? 'même période l’an dernier' : 'la période précédente'}
          </button>
        </div>
      </section>
      <div className="mt-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-2">
        <Carte titre="Objectifs · ce qui manque" droite={objectifs.length ? `${manquent.length} sur ${objectifs.length}` : ''}>
          {objectifs.length === 0 ? (
            <p className="text-[13px] text-[#a3a3a0]">Aucun objectif posé : ils se posent dans l’onglet Objectifs.</p>
          ) : manquent.length === 0 ? (
            <p className="text-[13px] text-[#a3a3a0]">Tous les objectifs sont atteints.</p>
          ) : (
            manquent.slice(0, 6).map((o) => (
              <div key={o.id} className="grid grid-cols-[70px_minmax(0,1fr)] items-baseline gap-3.5 border-b border-[#222226] py-3">
                <span className="font-mono text-[10.5px] uppercase text-[#9a9a97]">{o.periodLabel.split(' ')[0]}</span>
                <span className="text-[13px] text-[#e4e4e1]">
                  {o.label} · {o.currentValue.toLocaleString('fr-FR')} sur {o.targetValue.toLocaleString('fr-FR')} {o.unit === '€' ? '€' : o.unit}
                </span>
              </div>
            ))
          )}
        </Carte>
        <Carte titre="L’historique">
          <p className="text-[13.5px] leading-relaxed text-[#e4e4e1]">Chaque tracker garde toutes ses semaines ; on compare une période à la précédente, ou à la même l’an dernier, jamais à une moyenne qui mélange tout.</p>
          <p className="mt-3 text-[12.5px] leading-relaxed text-[#a3a3a0]">Heures : le module Temps. Objectifs : relevés chaque jour. Relève : la première ouverture de la Garde, un jour de semaine. Retours : Studio, traités sous 48 h.</p>
        </Carte>
      </div>
    </>
  );
}

function TrackerCarte({ t, ambre }: { t: Tracker; ambre: boolean }) {
  const valeurs = [...t.serie, ...t.fantome].filter((v): v is number => v !== null);
  const max = Math.max(1, ...valeurs) * 1.15;
  const chemin = (s: (number | null)[]) => {
    let d = '';
    let leve = true;
    s.forEach((v, i) => {
      if (v === null) {
        leve = true;
        return;
      }
      d += `${leve ? 'M' : 'L'}${(i / 7) * 100} ${38 - (v / max) * 34} `;
      leve = false;
    });
    return d.trim();
  };
  return (
    <div className="px-4 pb-4 pt-4" style={{ border: `1px solid ${ambre ? AMBRE : '#28282c'}`, background: ambre ? 'rgba(208,154,74,.07)' : '#141416' }} data-signal-groupe={ambre ? 'tracker-ambre' : undefined}>
      <span className="block font-mono text-[9.5px] uppercase tracking-[0.14em]" style={{ color: ambre ? AMBRE : '#9a9a97' }}>
        {t.famille}
      </span>
      <span className="mt-1.5 block text-[14px] font-semibold text-[#f7f7f5]">{t.titre}</span>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="mt-4 block h-[52px] w-full" role="img" aria-label={`${t.titre}, huit semaines : ${t.serie.map((v) => (v === null ? 'rien' : v)).join(', ')}`}>
        <path d={chemin(t.fantome)} fill="none" stroke="#6b6b70" strokeWidth={1.2} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        <path d={chemin(t.serie)} fill="none" stroke={ambre ? AMBRE : '#e4e4e1'} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="mt-4 block whitespace-nowrap font-mono text-[20px] font-semibold tabular-nums text-[#f7f7f5]">{t.valeur}</span>
      <span className="mt-1 block font-mono text-[10.5px] tabular-nums" style={{ color: ambre ? AMBRE : '#a3a3a0' }}>
        {t.ecart ?? 'rien à comparer'}
      </span>
    </div>
  );
}
