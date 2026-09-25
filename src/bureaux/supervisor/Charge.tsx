import React, { useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useCollection, useSync } from '../../state/SyncContext';
import { AMBRE } from '../jetons';
import { useSupervisor } from '../donnees/useSupervisor';
import { useSourceBureaux } from '../donnees/source';
import { useReleves, jourDe } from '../donnees/releves';
import type { ExerciceCrise, Hameconnage, ProspectStrategie } from '../donnees/types';
import { Carte, Chargement, EnTete } from '../ui/kit';
import { jourMois } from '../format';

/**
 * SUPERVISOR · LA PRÉVISION DE CHARGE (cahier 15, `51c` · 02).
 *
 * La charge de l'équipe sur quatre semaines, à partir de ce qui est prévu :
 * les arrivées (organisations créées depuis moins de deux semaines, devis qui
 * se jouent), les renouvellements (le contrat au dossier), les incidents (la
 * moyenne des huit dernières semaines, relevée chaque jour), les demandes
 * ouvertes et les exercices planifiés. Chaque chose pèse un temps écrit à
 * l'écran — rien n'est pondéré en cachette.
 *
 * L'ambre : la première semaine qui dépasse ce que l'équipe peut donner. La
 * capacité se règle ici (`suivis`, `charge:capacite`).
 */

const POIDS = { arrivee: 4, devis: 2, renouvellement: 1, incident: 1.5, demande: 0.5, exercice: 2 } as const;
type Nature = keyof typeof POIDS;
const NOMS: Record<Nature, string> = { arrivee: 'Arrivées', devis: 'Devis qui se jouent', renouvellement: 'Renouvellements', incident: 'Incidents attendus', demande: 'Demandes ouvertes', exercice: 'Exercices' };
const TONS: Record<Nature, string> = { arrivee: '#e4e4e1', devis: '#a3a3a0', renouvellement: '#8a8a87', incident: '#6b6b68', demande: '#4d4d4b', exercice: '#3a3a38' };
const SEMAINE = 7 * 86_400_000;

function lundi(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export function SupervisorCharge() {
  const m = useSupervisor();
  const src = useSourceBureaux();
  const { user } = useAuth();
  const { upsert } = useSync();
  const suivis = useCollection<{ heures?: number }>('suivis');
  const prospects = useCollection<ProspectStrategie>('prospects');
  const hame = useCollection<Hameconnage>('hameconnages');
  const crises = useCollection<ExerciceCrise>('exercicesCrise');
  const releves = useReleves();
  const [edition, setEdition] = useState<string | null>(null);
  const capacite = suivis.find((s) => s.id === 'charge:capacite')?.heures ?? 30;

  const semaines = useMemo(() => {
    const debut = lundi(m.maintenant);
    const s = Array.from({ length: 4 }, (_, i) => ({ debut: debut + i * SEMAINE, items: [] as { nature: Nature; quoi: string; heures: number }[] }));
    const dans = (t: number) => s.find((w) => t >= w.debut && t < w.debut + SEMAINE) ?? null;
    // Les arrivées : une organisation de moins de deux semaines pèse sur la semaine en cours et la suivante.
    for (const o of src.organisations) {
      const age = m.maintenant - Date.parse(o.createdAt);
      if (age < 0 || age > 14 * 86_400_000 || o.status === 'suspended' || o.plan === 'internal') continue;
      s[0].items.push({ nature: 'arrivee', quoi: `${o.name} s’installe`, heures: POIDS.arrivee * 0.75 });
      s[1].items.push({ nature: 'arrivee', quoi: `${o.name} : premier point`, heures: POIDS.arrivee * 0.25 });
    }
    // Les devis qui se jouent : une signature possible la semaine de la prochaine étape.
    for (const p of prospects) {
      if (p.stage !== 'proposition' || !p.prochaine) continue;
      const w = dans(Math.max(Date.parse(p.prochaine.at), s[0].debut));
      if (w) w.items.push({ nature: 'devis', quoi: `${p.company || p.name} : ${p.prochaine.quoi}`, heures: POIDS.devis });
    }
    // Les renouvellements : l'échéance du contrat au dossier.
    for (const [id, d] of m.dossiers) {
      if (!d.contrat?.echeance) continue;
      const w = dans(Date.parse(`${d.contrat.echeance}T12:00:00`));
      const nom = src.organisations.find((o) => o.id === id)?.name ?? 'une cliente';
      if (w) w.items.push({ nature: 'renouvellement', quoi: `${nom} : contrat à ${d.contrat.reconduction === 'tacite' ? 'reconduire' : 'confirmer'}`, heures: POIDS.renouvellement });
    }
    // Les incidents : la moyenne hebdomadaire des huit dernières semaines, telle que les relevés l'ont vue.
    let jours = 0;
    let incidents = 0;
    for (let j = 1; j <= 56; j += 1) {
      const r = releves.get(jourDe(m.maintenant - j * 86_400_000));
      if (!r) continue;
      jours += 1;
      incidents += Object.values(r.orgs).reduce((t, o) => t + (o.points?.incident ?? 0), 0);
    }
    const parSemaine = jours ? (incidents / jours) * 7 : 0;
    if (parSemaine > 0) for (const w of s) w.items.push({ nature: 'incident', quoi: `${Math.round(parSemaine * 10) / 10} incidents par semaine, en moyenne`, heures: Math.round(parSemaine * POIDS.incident * 10) / 10 });
    // Les demandes ouvertes : la semaine en cours.
    const demandes = src.supports.length + src.modulesDemandes.length;
    if (demandes) s[0].items.push({ nature: 'demande', quoi: `${demandes} demande${demandes > 1 ? 's' : ''} de clientes ouverte${demandes > 1 ? 's' : ''}`, heures: demandes * POIDS.demande });
    // Les exercices planifiés.
    for (const e of [...hame.map((h) => ({ at: h.date, quoi: h.titre })), ...crises.map((c) => ({ at: c.date, quoi: `Exercice de crise : ${c.scenario}` }))]) {
      const w = dans(Date.parse(`${e.at.slice(0, 10)}T12:00:00`));
      if (w) w.items.push({ nature: 'exercice', quoi: e.quoi, heures: POIDS.exercice });
    }
    return s.map((w) => ({ ...w, total: Math.round(w.items.reduce((t, i) => t + i.heures, 0) * 10) / 10 }));
  }, [m.maintenant, m.dossiers, src.organisations, src.supports, src.modulesDemandes, prospects, hame, crises, releves]);

  if (!m.pret) {
    return (
      <>
        <EnTete surtitre="Supervisor · Prévision de charge" titre="Les semaines se pèsent." />
        <Chargement texte="Lecture de ce qui est prévu" />
      </>
    );
  }
  const depasse = semaines.find((w) => w.total > capacite) ?? null;
  const max = Math.max(capacite * 1.2, ...semaines.map((w) => w.total), 1);
  const titre = depasse ? `${depasse.debut === semaines[0].debut ? 'Cette semaine' : `La semaine du ${jourMois(depasse.debut)}`} dépasse ce que l’équipe peut donner : ${depasse.total} h pour ${capacite}.` : 'Les quatre semaines qui viennent tiennent dans la capacité de l’équipe.';

  return (
    <>
      <EnTete surtitre="Supervisor · Équipe · Prévision de charge" titre={titre} />
      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
        <Carte dominante pad="p-6" titre="Quatre semaines · heures prévues" droite={`capacité : ${capacite} h par semaine`}>
          <div className="relative flex h-[240px] items-end gap-6 border-b border-[#2b2b2b] px-2">
            <span aria-hidden className="absolute left-0 right-0 border-t border-dashed border-[#8a8a87]" style={{ bottom: `${(capacite / max) * 100}%` }} />
            <span className="absolute right-0 font-mono text-[9.5px] text-[#a3a3a0]" style={{ bottom: `calc(${(capacite / max) * 100}% + 4px)` }}>
              {capacite} h
            </span>
            {semaines.map((w) => {
              const estAmbre = depasse?.debut === w.debut;
              return (
                <div key={w.debut} className="flex h-full min-w-0 flex-1 flex-col justify-end" data-signal-groupe={estAmbre ? 'charge-ambre' : undefined}>
                  <span className="mb-1.5 text-center font-mono text-[11px] tabular-nums" style={{ color: estAmbre ? AMBRE : '#e4e4e1' }}>
                    {w.total} h
                  </span>
                  <div className="flex flex-col-reverse" style={{ height: `${(w.total / max) * 100}%`, boxShadow: estAmbre ? `0 0 0 1.5px ${AMBRE}` : undefined }}>
                    {(Object.keys(POIDS) as Nature[]).map((n) => {
                      const h = w.items.filter((i) => i.nature === n).reduce((t, i) => t + i.heures, 0);
                      return h ? <span key={n} style={{ height: `${(h / Math.max(w.total, 0.001)) * 100}%`, background: TONS[n] }} title={`${NOMS[n]} : ${Math.round(h * 10) / 10} h`} /> : null;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-6 px-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[#9a9a97]">
            {semaines.map((w, i) => (
              <span key={w.debut} className="min-w-0 flex-1 text-center">
                {i === 0 ? 'cette semaine' : `sem. du ${jourMois(w.debut)}`}
              </span>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
            {(Object.keys(POIDS) as Nature[]).map((n) => (
              <span key={n} className="flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.08em] text-[#a3a3a0]">
                <span aria-hidden className="h-[9px] w-[9px]" style={{ background: TONS[n] }} />
                {NOMS[n]} · {POIDS[n]} h
              </span>
            ))}
          </div>
        </Carte>
        <div className="flex flex-col gap-[18px] self-start">
          <Carte titre={depasse && depasse.debut !== semaines[0].debut ? `La semaine du ${jourMois(depasse.debut)}` : 'Cette semaine'} droite={`${(depasse ?? semaines[0]).total} h`}>
            {(depasse ?? semaines[0]).items.length === 0 ? (
              <p className="text-[13px] text-[#a3a3a0]">Rien de prévu.</p>
            ) : (
              (depasse ?? semaines[0]).items
                .sort((a, b) => b.heures - a.heures)
                .slice(0, 8)
                .map((i, k) => (
                  <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b border-[#1f1f1f] py-2">
                    <span className="text-[13px] leading-snug text-[#e4e4e1]">{i.quoi}</span>
                    <span className="font-mono text-[10.5px] tabular-nums text-[#9a9a97]">{Math.round(i.heures * 10) / 10} h</span>
                  </div>
                ))
            )}
          </Carte>
          <Carte titre="La capacité de l’équipe">
            {edition === null ? (
              <p className="text-[13px] leading-relaxed text-[#a3a3a0]">
                {capacite} heures par semaine pour la supervision.{' '}
                <button type="button" className="bx-lien" onClick={() => setEdition(String(capacite))}>
                  Changer
                </button>
              </p>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = Number(edition.replace(',', '.'));
                  if (v > 0) void upsert('suivis', 'charge:capacite', { heures: Math.round(v), par: user?.email ?? '', at: new Date().toISOString() });
                  setEdition(null);
                }}
              >
                <input autoFocus value={edition} onChange={(e) => setEdition(e.target.value)} inputMode="numeric" aria-label="Heures par semaine" className="h-9 w-[100px] border border-[#2b2b2b] bg-transparent px-2.5 font-mono text-[13px] text-[#f7f7f5] outline-none focus:border-[#8a8a87]" />
                <button type="submit" className="bx-btn2">
                  Poser
                </button>
              </form>
            )}
          </Carte>
        </div>
      </div>
    </>
  );
}
