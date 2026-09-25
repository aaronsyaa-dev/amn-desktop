import React, { useState } from 'react';
import { stripMeta, uid, useCollection, useSync } from '../../state/SyncContext';
import { AMBRE } from '../jetons';
import { Carte, EnTete, Invitation } from '../ui/kit';
import { enLettres } from '../format';
import { champ } from './commun';

/**
 * STRATÉGIE · LES OBJECTIFS — où l'on est contre où l'on devrait être.
 *
 * Le paquet nomme l'onglet sans le dessiner. Il lit la collection
 * `objectives`, celle du module Objectifs du poste : les mêmes objectifs,
 * pas une seconde liste. Chacun est un curseur d'allure : la barre dit où
 * l'on est, le trait dit où l'on devrait être à ce jour de la période.
 *
 * L'ambre : l'objectif le plus en retard sur son allure — et seulement s'il
 * l'est nettement (plus d'un dixième de la cible). En avance ou à l'heure,
 * un objectif n'attend personne.
 */

interface Objectif {
  label: string;
  unit: string;
  targetValue: number;
  currentValue: number;
  periodLabel: string;
  /** La période, quand on la connaît (AAAA-MM-JJ) ; sinon on la lit dans `periodLabel`. */
  debut?: string;
  fin?: string;
}
type Obj = Objectif & { id: string; updatedAt: string };

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** La période d'un objectif : ses bornes, ou ce que dit son libellé (« septembre 2026 », « T3 2026 », « 2026 »), ou le mois courant. */
function periode(o: Objectif): { debut: number; fin: number } {
  if (o.debut && o.fin) return { debut: Date.parse(`${o.debut}T00:00:00`), fin: Date.parse(`${o.fin}T23:59:59`) };
  const libelle = o.periodLabel ?? '';
  const m = new RegExp(`(${MOIS.join('|')})\\s+(\\d{4})`, 'i').exec(libelle);
  if (m) {
    const annee = Number(m[2]);
    const mois = MOIS.indexOf(m[1].toLowerCase());
    return { debut: new Date(annee, mois, 1).getTime(), fin: new Date(annee, mois + 1, 0, 23, 59, 59).getTime() };
  }
  const t = /\bT([1-4])\s+(\d{4})/i.exec(libelle);
  if (t) {
    const annee = Number(t[2]);
    const premier = (Number(t[1]) - 1) * 3;
    return { debut: new Date(annee, premier, 1).getTime(), fin: new Date(annee, premier + 3, 0, 23, 59, 59).getTime() };
  }
  const a = /^\s*(\d{4})\s*$/.exec(libelle);
  if (a) return { debut: new Date(Number(a[1]), 0, 1).getTime(), fin: new Date(Number(a[1]), 11, 31, 23, 59, 59).getTime() };
  const d = new Date();
  return { debut: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), fin: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime() };
}

/** « 1 client », « 2 clients » ; « rendez-vous », « mois » ne bougent pas. */
const unite = (v: number, u: string) => (Math.abs(v) <= 1 && /s$/.test(u) && !/(vous|ois|is|ours)$/.test(u) ? u.slice(0, -1) : u);
const nf = (v: number, u: string) => (u === '€' ? `${v.toLocaleString('fr-FR')} €` : `${v.toLocaleString('fr-FR')} ${unite(v, u)}`);

export function StrategieObjectifs() {
  const brutes = useCollection<Objectif>('objectives') as Obj[];
  const { upsert, remove } = useSync();
  const [nouvel, setNouvel] = useState<{ label: string; unit: string; cible: string } | null>(null);
  const maintenant = Date.now();
  const objectifs = brutes
    .map((o) => {
      const { debut, fin } = periode(o);
      const ecoule = Math.min(1, Math.max(0, (maintenant - debut) / Math.max(1, fin - debut)));
      const attendu = o.targetValue * ecoule;
      const retard = o.targetValue ? (attendu - o.currentValue) / o.targetValue : 0;
      return { o, ecoule, attendu, retard, atteint: o.currentValue >= o.targetValue };
    })
    .sort((a, b) => a.o.label.localeCompare(b.o.label));
  const enRetard = objectifs.filter((x) => !x.atteint && x.retard > 0.1).sort((a, b) => b.retard - a.retard);
  const ambre = enRetard[0] ?? null;
  const atteints = objectifs.filter((x) => x.atteint).length;

  const titre = objectifs.length === 0
    ? 'Aucun objectif posé.'
    : ambre
      ? enRetard.length > 1
        ? `${enLettres(enRetard.length, true)} objectifs sont en retard sur leur allure.`
        : `« ${ambre.o.label} » est en retard sur son allure.`
      : `${atteints ? `${enLettres(atteints, true)} atteint${atteints > 1 ? 's' : ''}, ` : ''}${atteints ? 'les autres tiennent' : `Les ${enLettres(objectifs.length)} objectifs tiennent`} leur allure.`;

  return (
    <>
      <EnTete
        surtitre="Stratégie · Objectifs"
        titre={titre}
        actions={
          <button type="button" className="bx-btn2" onClick={() => setNouvel({ label: '', unit: 'clients', cible: '' })}>
            Poser un objectif
          </button>
        }
      />
      {nouvel && (
        <Carte pad="p-5" className="mb-[18px]" titre="Un objectif du mois" droite="le même que dans le module Objectifs du poste">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const cible = Number(nouvel.cible.replace(',', '.'));
              if (!nouvel.label.trim() || !(cible > 0)) return;
              void upsert('objectives', `obj-${uid()}`, { label: nouvel.label.trim(), unit: nouvel.unit.trim() || 'unités', targetValue: cible, currentValue: 0, periodLabel: new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) });
              setNouvel(null);
            }}
          >
            <input autoFocus value={nouvel.label} onChange={(e) => setNouvel({ ...nouvel, label: e.target.value })} placeholder="« Nouveaux clients visés »" aria-label="L’objectif" className={`${champ} h-9 min-w-0 flex-1`} />
            <input value={nouvel.cible} onChange={(e) => setNouvel({ ...nouvel, cible: e.target.value })} inputMode="decimal" placeholder="cible" aria-label="La cible" className={`${champ} h-9 w-[100px] font-mono`} />
            <input value={nouvel.unit} onChange={(e) => setNouvel({ ...nouvel, unit: e.target.value })} placeholder="unité" aria-label="L’unité" className={`${champ} h-9 w-[110px]`} />
            <button type="submit" className="bx-btn">
              Poser
            </button>
            <button type="button" className="bx-btn2" onClick={() => setNouvel(null)}>
              Annuler
            </button>
          </form>
        </Carte>
      )}
      {objectifs.length === 0 ? (
        <Invitation titre="Pas d’objectif pour la période." texte="Un objectif, c’est une cible et une période : l’écran dit alors, chaque jour, si l’on est en avance ou en retard sur l’allure." />
      ) : (
        <Carte dominante pad="p-6" titre={`Les objectifs · ${objectifs.length}`} droite="barre = où l’on est · trait = où l’on devrait être aujourd’hui">
          {objectifs.map(({ o, ecoule, attendu, retard, atteint }) => {
            const estAmbre = ambre?.o.id === o.id;
            const part = Math.min(1, o.targetValue ? o.currentValue / o.targetValue : 0);
            return (
              <div key={o.id} className="border-b border-[#222226] py-5" data-signal-groupe={estAmbre ? 'objectif-ambre' : undefined}>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span className="text-[15px] font-semibold text-[#f7f7f5]">{o.label}</span>
                  <span className="font-mono text-[12px] tabular-nums text-[#e4e4e1]">
                    <Valeur o={o} onChanger={(v) => void upsert('objectives', o.id, { ...stripMeta(o), currentValue: v })} /> <span className="text-[#9a9a97]">/ {nf(o.targetValue, o.unit)}</span>
                  </span>
                </div>
                <div className="relative mt-3 h-[10px] bg-[#1f1f23]">
                  <span className="absolute inset-y-0 left-0" style={{ width: `${part * 100}%`, background: estAmbre ? AMBRE : '#8a8a8f' }} />
                  <span aria-hidden className="absolute -bottom-1.5 -top-1.5 w-[2px] bg-[#f7f7f5]" style={{ left: `calc(${ecoule * 100}% - 1px)` }} />
                </div>
                <div className="mt-2 flex flex-wrap justify-between gap-3 font-mono text-[10.5px] text-[#a3a3a0]">
                  <span style={estAmbre ? { color: AMBRE } : undefined}>
                    {atteint ? 'atteint' : retard > 0.1 ? `en retard : ${nf(Math.round(attendu - o.currentValue), o.unit)} derrière l’allure` : retard > 0 ? 'à l’heure, de peu' : 'en avance sur l’allure'}
                  </span>
                  <span>
                    {o.periodLabel ? `${o.periodLabel} · ` : ''}
                    {Math.round(ecoule * 100)} % écoulé
                    <button type="button" className="ml-3 text-[#9a9a97] underline decoration-[#4a4a48] underline-offset-2 hover:text-[#f7f7f5]" onClick={() => void remove('objectives', o.id)}>
                      retirer
                    </button>
                  </span>
                </div>
              </div>
            );
          })}
        </Carte>
      )}
    </>
  );
}

function Valeur({ o, onChanger }: { o: Obj; onChanger: (v: number) => void }) {
  const [edition, setEdition] = useState<string | null>(null);
  if (edition !== null) {
    return (
      <input
        autoFocus
        value={edition}
        onChange={(e) => setEdition(e.target.value)}
        onBlur={() => {
          const v = Number(edition.replace(',', '.'));
          if (Number.isFinite(v) && v >= 0 && v !== o.currentValue) onChanger(v);
          setEdition(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setEdition(null);
        }}
        inputMode="decimal"
        aria-label={`Où en est « ${o.label} »`}
        className="h-7 w-[90px] border border-[#3a3a40] bg-transparent px-1.5 text-right font-mono text-[12px] text-[#f7f7f5] outline-none"
      />
    );
  }
  return (
    <button type="button" onClick={() => setEdition(String(o.currentValue))} className="underline decoration-[#4a4a48] underline-offset-4 hover:decoration-[#f7f7f5]" title="Mettre à jour">
      {nf(o.currentValue, o.unit)}
    </button>
  );
}
