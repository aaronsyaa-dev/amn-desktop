import React, { useMemo, useRef, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  Bloc,
  BoutonPrimaire,
  BoutonSecondaire,
  Calmes,
  CarteCalme,
  CarteReleves,
  Dominante,
  Ecran50,
  LigneRegistre,
  PiedDominante,
} from '../components/cinquante-kit';
import { useCollection, useSync } from '../state/SyncContext';
import { formatCentsCompact } from '../lib/money';
import { enLettres } from '../lib/cinquante/lettres';
import {
  CONSOLE,
  type CleHypothese,
  type EnregistrementScenarios,
  type Hypothese,
  type ModeleBudget,
  type ScenarioBudget,
  type Valeurs,
  poids,
  resultat,
  topCurseur,
} from '../lib/cinquante/finance';
import type { Id } from '../lib/cinquante/guichet';
import { useLangue } from '../i18n';

/**
 * SCÉNARIOS — la console (`36b`).
 *
 * Chaque hypothèse est un potentiomètre vertical : piste de 200 px graduée en
 * quarts, curseur de 40 × 18 px posé à `100 − (v − min) / (max − min) × 100 %`.
 * Un scénario est une position ENREGISTRÉE de tous les potentiomètres ; il ne
 * se modifie pas — on en enregistre un nouveau. Chaque potentiomètre est un
 * vrai curseur (clavier, souris, doigt) : bouger la console est un essai, que
 * « Enregistrer ce scénario » fixe en un scénario nouveau.
 *
 * L'ambre : le curseur de l'hypothèse qui pèse le plus dans l'écart entre le
 * scénario prudent et l'ambitieux, calculé une hypothèse à la fois.
 */

const MOIS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const signe = (n: number) => (n > 0 ? `+ ${n}` : n < 0 ? `− ${Math.abs(n)}` : '0');
function lire(h: Hypothese, v: number, exercice: number) {
  if (h.unite === 'pct') return `${signe(v)} %`;
  if (h.unite === 'jours') return `${v} j`;
  return v >= 13 ? String(exercice + 1) : MOIS[Math.max(1, v) - 1];
}
function lireCourt(h: Hypothese, v: number, exercice: number) {
  if (h.unite === 'pct') return `${h.nom.toLowerCase()} ${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} %`;
  if (h.unite === 'jours') return `${h.nom.toLowerCase()} ${v} j`;
  return `${h.nom.toLowerCase()} ${lire(h, v, exercice)}`;
}

function Potentiometre({
  h,
  valeur,
  exercice,
  ambre,
  poidsPct,
  onChange,
  refInput,
}: {
  h: Hypothese;
  valeur: number;
  exercice: number;
  ambre: boolean;
  poidsPct: number;
  onChange: (v: number) => void;
  refInput?: React.Ref<HTMLInputElement>;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-3">
      <span
        data-signal-groupe={ambre ? 'plus-lourde' : undefined}
        className={`tnum whitespace-nowrap font-mono text-[13px] ${ambre ? 'font-bold text-signal' : 'font-semibold text-text-primary'}`}
      >
        {lire(h, valeur, exercice)}
      </span>
      <span className="relative w-11" style={{ height: CONSOLE.piste }}>
        <span className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 border border-border-raised bg-sunken" />
        {[0, 25, 50, 75, 100].map((q) => (
          <span key={q} className="absolute inset-x-1 h-px bg-border-raised" style={{ top: `${q}%` }} />
        ))}
        <span
          data-signal-groupe={ambre ? 'plus-lourde' : undefined}
          className={`pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 border ${
            ambre ? 'border-signal bg-signal shadow-[0_0_28px_-7px_var(--color-signal-glow)]' : 'border-[#4a4a48] bg-border-strong shadow-[inset_0_1px_0_rgba(255,255,255,.12)]'
          }`}
          style={{ top: `${topCurseur(h, valeur)}%`, width: CONSOLE.curseurL, height: CONSOLE.curseurH }}
        >
          <span className={`absolute inset-x-1.5 top-2 h-0.5 ${ambre ? 'bg-signal-ink' : 'bg-text-muted'}`} />
        </span>
        {/* Le vrai curseur, invisible par-dessus la piste : clavier, souris, doigt. */}
        <input
          ref={refInput}
          type="range"
          min={h.min}
          max={h.max}
          step={h.pas}
          value={valeur}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={`${h.nom} : ${lire(h, valeur, exercice)}`}
          className="absolute inset-0 h-full w-full cursor-ns-resize opacity-0 [direction:rtl] [writing-mode:vertical-lr]"
        />
      </span>
      <span className="whitespace-nowrap text-center text-[12.5px] font-semibold text-text-body">{h.nom}</span>
      <span className="h-[11px]">
        {ambre && (
          <span data-signal-groupe="plus-lourde" className="whitespace-nowrap font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-signal">
            Pèse {poidsPct} % de l’écart
          </span>
        )}
      </span>
    </div>
  );
}

export function ScenariosScreen() {
  const { t, langue } = useLangue();
  const { upsert } = useSync();
  const tout = useCollection<EnregistrementScenarios>('budgetScenarios');
  const L = (n: number, maj = false) => enLettres(n, langue, maj);
  const refLourde = useRef<HTMLInputElement>(null);

  const modele = tout.find((e): e is Id<ModeleBudget> & { updatedAt: string } => e.kind === 'modele') ?? null;
  const scenarios = useMemo(
    () => tout.filter((e): e is Id<ScenarioBudget> & { updatedAt: string } => e.kind === 'scenario').sort((a, b) => a.ordre - b.ordre),
    [tout],
  );
  const [choisi, setChoisi] = useState<string | null>(null);
  const [essai, setEssai] = useState<Valeurs | null>(null);
  const vide = !modele || scenarios.length === 0;

  const resultats = modele ? scenarios.map((s) => ({ s, r: resultat(modele, s.valeurs) })) : [];
  const parResultat = [...resultats].sort((a, b) => a.r - b.r);
  const prudent = parResultat[0] ?? null;
  const ambitieux = parResultat[parResultat.length - 1] ?? null;
  const courant = scenarios.find((s) => s.id === choisi) ?? scenarios[Math.floor((scenarios.length - 1) / 2)] ?? null;
  const valeurs = essai ?? courant?.valeurs ?? null;
  const p = modele && prudent && ambitieux && prudent !== ambitieux ? poids(modele, prudent.s.valeurs, ambitieux.s.valeurs) : [];
  const lourde = p[0] && p[0].part > 0 ? p[0] : null;
  const legere = [...p].reverse().find((x) => x.part > 0) ?? null;
  const hyp = (cle: CleHypothese) => modele?.hypotheses.find((h) => h.cle === cle) ?? null;
  const ecart = prudent && ambitieux ? ambitieux.r - prudent.r : 0;
  const pct = (x: number) => Math.round(x * 100);

  const enregistrer = async () => {
    if (!valeurs || !modele) return;
    const n = scenarios.filter((s) => s.nom.startsWith('Essai')).length + 1;
    const id = `sc-${Date.now().toString(36)}`;
    await upsert('budgetScenarios', id, {
      kind: 'scenario',
      nom: `Essai ${n}`,
      valeurs,
      enregistreLe: new Date().toISOString(),
      ordre: Math.max(0, ...scenarios.map((s) => s.ordre)) + 1,
    } satisfies ScenarioBudget);
    setEssai(null);
    setChoisi(id);
  };

  const description = vide
    ? t('m50.scenarios.descriptionVide')
    : t('m50.scenarios.description', { n: L(modele?.hypotheses.length ?? 0, true), p: L(modele?.hypotheses.length ?? 0), s: L(scenarios.length) });

  const lourdeH = lourde ? hyp(lourde.cle) : null;
  const legereH = legere ? hyp(legere.cle) : null;

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.finance'), module: t('m50.scenarios.titre') })}
          title={t('m50.scenarios.titre')}
          description={description}
          phraseVide={t('m50.scenarios.phraseVide')}
        />
      </Bloc>

      <Dominante
        surtitre={courant ? `La console · ${essai ? 'essai en cours' : `scénario « ${courant.nom} »`}` : 'La console'}
        note={vide ? undefined : 'Un potentiomètre par hypothèse'}
      >
        {vide || !modele || !valeurs ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Chaque hypothèse du budget sera un potentiomètre, chaque scénario une position enregistrée de la console. Le
            résultat de l’exercice s’affichera à droite, comme l’afficheur d’une table de mixage.
          </p>
        ) : (
          <>
            <div className="mb-[22px] flex flex-wrap gap-2">
              {scenarios.map((s) => {
                const actif = !essai && s.id === courant?.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setChoisi(s.id);
                      setEssai(null);
                    }}
                    aria-pressed={actif}
                    className={`min-h-11 border px-3.5 py-2 text-[12.5px] font-semibold sm:min-h-0 ${
                      actif ? 'border-[#4a4a48] bg-[#1e1e1e] text-text-primary' : 'border-[#2b2b2b] text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {s.nom}
                  </button>
                );
              })}
            </div>
            <div className="grid items-stretch gap-6 md:grid-cols-[minmax(0,1fr)_230px] md:gap-[34px]">
              <div className="flex gap-1 overflow-hidden border border-border-raised bg-sunken px-2 py-5 sm:gap-2.5 sm:px-4">
                {modele.hypotheses.map((h) => (
                  <Potentiometre
                    key={h.cle}
                    h={h}
                    valeur={valeurs[h.cle]}
                    exercice={modele.exercice}
                    ambre={lourde?.cle === h.cle}
                    poidsPct={lourde ? pct(lourde.part) : 0}
                    onChange={(v) => setEssai({ ...valeurs, [h.cle]: v })}
                    refInput={lourde?.cle === h.cle ? refLourde : undefined}
                  />
                ))}
              </div>
              <div className="flex flex-col justify-center gap-[18px] border border-border-raised bg-sunken p-5">
                {prudent && (
                  <span>
                    <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">{prudent.s.nom}</span>
                    <span className="tnum mt-[5px] block font-mono text-[18px] font-medium tracking-[-0.03em] text-text-secondary">{formatCentsCompact(prudent.r)}</span>
                  </span>
                )}
                <span>
                  <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">{essai ? 'Essai' : courant?.nom}</span>
                  <span className="tnum mt-[5px] block font-mono text-[30px] font-bold tracking-[-0.03em] text-text-primary">
                    {formatCentsCompact(resultat(modele, valeurs))}
                  </span>
                </span>
                {ambitieux && ambitieux !== prudent && (
                  <span>
                    <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">{ambitieux.s.nom}</span>
                    <span className="tnum mt-[5px] block font-mono text-[18px] font-medium tracking-[-0.03em] text-text-secondary">{formatCentsCompact(ambitieux.r)}</span>
                  </span>
                )}
                <span className="text-[12px] leading-[1.5] text-text-muted">résultat net de l’exercice {modele.exercice}</span>
              </div>
            </div>

            <PiedDominante
              action={
                essai ? (
                  <BoutonPrimaire onClick={() => void enregistrer()}>Enregistrer ce scénario</BoutonPrimaire>
                ) : lourdeH ? (
                  <BoutonSecondaire onClick={() => refLourde.current?.focus()}>Faire varier « {lourdeH.nom} »</BoutonSecondaire>
                ) : undefined
              }
            >
              {essai
                ? 'La console a bougé : cet essai n’écrase aucun scénario. Enregistré, il deviendra un scénario de plus.'
                : lourde && lourdeH && prudent && ambitieux
                  ? `${(lourdeH.enPhrase ?? lourdeH.nom).replace(/^./, (c) => c.toUpperCase())} fait à elle seule ${pct(lourde.part)} % de l’écart entre le scénario ${prudent.s.nom.toLowerCase()} et le scénario ${ambitieux.s.nom.toLowerCase()}${
                      lourde.part > 0.5 ? ' : c’est la seule décision qui compte vraiment cette année' : ''
                    }.`
                  : 'Les scénarios enregistrés donnent le même résultat : aucune hypothèse ne fait d’écart.'}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre={`Les ${L(scenarios.length)} scénarios`} note={scenarios.length ? 'Hypothèses · résultat' : undefined}>
          {!modele || scenarios.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun scénario enregistré.</p>
          ) : (
            resultats.map(({ s, r }, i) => {
              const differentes = modele.hypotheses.filter((h) => h.cle !== 'delai');
              return (
                <LigneRegistre key={s.id} colonnes="minmax(0,90px) minmax(0,1fr) auto" derniere={i === resultats.length - 1}>
                  <span className="text-[13.5px] text-text-primary">{s.nom}</span>
                  <span className="min-w-0 font-mono text-[11px] leading-[1.5] text-text-secondary">
                    {differentes.map((h) => lireCourt(h, s.valeurs[h.cle], modele.exercice)).join(', ')}
                  </span>
                  <span className="tnum text-right font-mono text-[12px] text-text-primary">{formatCentsCompact(r)}</span>
                </LigneRegistre>
              );
            })
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="L’écart"
          releves={[
            { label: prudent && ambitieux ? `${prudent.s.nom} → ${ambitieux.s.nom}` : 'Écart', valeur: formatCentsCompact(ecart) },
            { label: 'Hypothèse la plus lourde', valeur: lourdeH ? lourdeH.nom.toLowerCase() : '—' },
            { label: 'La plus légère', valeur: legereH ? legereH.nom.toLowerCase() : '—' },
          ]}
        >
          {legere && legereH
            ? `${legereH.nom} pèse ${pct(legere.part) < 1 ? 'moins de 1' : `moins de ${Math.ceil(legere.part * 100)}`} % de l’écart : ${
                legere.part < 0.1 ? 'le faire bouger ne change presque rien au résultat' : 'son effet reste secondaire'
              }.`
            : undefined}
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
