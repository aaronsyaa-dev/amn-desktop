import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  Bloc,
  BoutonSecondaire,
  Calmes,
  CarteCalme,
  Dominante,
  ENCRE_SURTITRE_PLAQUE,
  Ecran50,
  PiedDominante,
  donnees,
} from '../components/cinquante-kit';
import { useCollection, useSync } from '../state/SyncContext';
import { enLettres } from '../lib/cinquante/lettres';
import {
  type AppelStandard,
  type EnregistrementStandard,
  FIL_VIEWBOX,
  type Id,
  type MandatStandard,
  appelAMontrer,
  dureeLisible,
  jourLocal,
  minuteSeconde,
  promesses,
} from '../lib/cinquante/guichet';
import { useLangue } from '../i18n';
import { NOM_DU_CHEF } from '@edition/ajmani';

/*
  LE NOM DE L'ASSISTANT PASSE PAR LA COUTURE D'ÉDITION, JAMAIS EN LITTÉRAL.

  Le paquet de design nomme ce module « l'assistant vocal Ajmani ». Mais ce nom
  est sur la liste des traces interdites dans le bundle client (`check:business`,
  motif cherché sans casse) : l'écrire ici ferait échouer le build de l'édition
  cliente — ou, pire, le livrerait. `@edition/ajmani` vaut « Ajmani » dans
  l'édition interne et « l'assistant » chez les clientes ; ce fichier ne
  contient donc aucun nom propre, et l'élision se calcule (« d'Ajmani » /
  « de l'assistant »).
*/
const LUI = NOM_DU_CHEF;
const LUI_MAJ = LUI.charAt(0).toUpperCase() + LUI.slice(1);
const DE_LUI = /^[aeiouyàâéèêh]/i.test(LUI) ? `d’${LUI}` : `de ${LUI}`;
const PAR_LUI = `par ${LUI}`;

/**
 * STANDARD — les promesses (`34f`).
 *
 * L'appel choisi sur deux pistes de 30 px, l'appelant en haut et Ajmani en
 * bas, chaque tour de parole à `seconde / durée × 100 %`. Une épingle traverse
 * les pistes à la seconde où Ajmani s'est engagé, un fil descend jusqu'à la
 * carte qui cite la phrase exacte avec son verdict.
 *
 * TOUT partage la grille `92px minmax(0,1fr)` — l'axe des minutes, les pistes,
 * le calque des épingles, le SVG des fils et la rangée des cartes : c'est le
 * piège 3 bis du README, une gouttière oubliée décale le repère. Et les cartes
 * sont posées SANS gouttière (`gap:0`, `padding:0 6px`) pour que leurs
 * centres tombent exactement à (2i + 1) / 2n, là où finissent les fils.
 */

/* `92px minmax(0,1fr)` (GRILLE_STANDARD) dès `sm` ; sur un téléphone, la
   colonne des noms se resserre à 64 px et le repère reste commun à tous. */
const GRILLE = 'grid grid-cols-[64px_minmax(0,1fr)] gap-2.5 sm:grid-cols-[92px_minmax(0,1fr)] sm:gap-3.5';
const heure = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function Promesses({ appel }: { appel: AppelStandard }) {
  const p = promesses(appel);
  return (
    <div>
      <div>
        {/* L'axe des minutes */}
        <div className={`${GRILLE} mb-2`}>
          <span />
          <span className="relative h-[13px] font-mono text-[9.5px] tracking-[0.08em] text-text-muted">
            <span className="absolute left-0">0:00</span>
            {/* Une graduation trop proche de la durée finale la chevaucherait :
                elle se retire, d'abord sur téléphone, puis partout. */}
            {p.graduations.filter((g) => 100 - g.gauchePct >= 7).map((g) => (
              <span key={g.minute} className={`absolute -translate-x-1/2 ${100 - g.gauchePct < 16 ? 'max-sm:hidden' : ''}`} style={{ left: `${g.gauchePct}%` }}>
                {g.minute}:00
              </span>
            ))}
            <span className="absolute right-0">{minuteSeconde(appel.dureeS)}</span>
          </span>
        </div>

        <div className="relative">
          {(['appelant', 'assistant'] as const).map((qui, i) => (
            <div key={qui} className={`${GRILLE} items-center ${i === 0 ? 'mb-1.5' : ''}`}>
              <span className={`font-mono text-[9px] font-bold uppercase tracking-[0.06em] sm:tracking-[0.14em] ${qui === 'assistant' ? 'text-text-secondary' : 'text-text-muted'}`}>
                {qui === 'assistant' ? LUI : 'L’appelant'}
              </span>
              <span className="relative h-[30px] overflow-hidden border border-border bg-sunken">
                {p.tours.filter((t) => t.qui === qui).map((t) => (
                  <span
                    key={t.debutS}
                    className={`absolute inset-y-0 shadow-[inset_-1px_0_0_var(--color-sunken)] ${qui === 'assistant' ? 'bg-[#4a4a48]' : 'bg-[#2e2e2e]'}`}
                    style={{ left: `${t.gauchePct}%`, width: `${t.largeurPct}%` }}
                  />
                ))}
              </span>
            </div>
          ))}
          {/* Le calque des épingles : la MÊME grille, cellule vide comprise. */}
          <div className={`pointer-events-none absolute inset-0 ${GRILLE}`}>
            <span />
            <span className="relative">
              {p.epingles.map((e) => (
                <React.Fragment key={e.seconde}>
                  <span
                    data-signal-groupe={e.ambre ? 'hors-mandat' : undefined}
                    className={`absolute -top-2 bottom-0 w-0.5 -translate-x-1/2 ${e.ambre ? 'bg-signal shadow-[0_0_14px_rgba(208,154,74,.9)]' : 'bg-text-body'}`}
                    style={{ left: `${e.gauchePct}%` }}
                  />
                  <span
                    data-signal-groupe={e.ambre ? 'hors-mandat' : undefined}
                    className={`absolute -top-3 h-[9px] w-[9px] -translate-x-1/2 rounded-full ${e.ambre ? 'bg-signal' : 'bg-text-body'}`}
                    style={{ left: `${e.gauchePct}%` }}
                  />
                </React.Fragment>
              ))}
            </span>
          </div>
        </div>

        {/* Les fils : de l'épingle au centre de sa carte, dans un SVG qui porte viewBox et 100 %.
            Sur un téléphone les cartes s'empilent : un fil n'aurait plus de
            centre où tomber, il se retire — l'horodatage de la carte relie. */}
        <div className={`${GRILLE} max-sm:hidden`}>
          <span />
          <svg viewBox={`0 0 ${FIL_VIEWBOX.largeur} ${FIL_VIEWBOX.hauteur}`} preserveAspectRatio="none" className="block h-11 w-full" aria-hidden>
            {p.fils.map((f, i) => (
              <path
                key={i}
                data-signal-groupe={f.ambre ? 'hors-mandat' : undefined}
                d={`M${f.de.toFixed(1)} 0 L${f.vers.toFixed(1)} ${FIL_VIEWBOX.hauteur}`}
                fill="none"
                stroke={f.ambre ? 'var(--color-signal)' : '#4a4a48'}
                strokeWidth={f.ambre ? 2.4 : 1.5}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        </div>

        {/* Les cartes, sans gouttière : leurs centres tombent à (2i + 1) / 2n. */}
        <div className={`${GRILLE} max-sm:mt-4`}>
          <span className="max-sm:hidden" />
          <div
            className="grid items-stretch gap-2 max-sm:col-span-2 sm:gap-0 sm:[grid-template-columns:repeat(var(--cartes),minmax(0,1fr))]"
            style={{ '--cartes': Math.max(1, p.epingles.length) } as React.CSSProperties}
          >
            {p.epingles.map((e) => (
              <div key={e.seconde} className="flex sm:px-1.5">
                <div
                  data-signal-groupe={e.ambre ? 'hors-mandat' : undefined}
                  className={`flex-1 border px-[15px] py-3.5 ${e.ambre ? 'border-signal bg-signal shadow-[0_0_30px_-7px_var(--color-signal-glow)]' : 'border-[#2b2b2b] bg-[#151515]'}`}
                >
                  <span className={`block text-[14px] font-semibold leading-[1.35] [text-wrap:pretty] ${e.ambre ? 'text-signal-ink' : 'text-text-primary'}`}>
                    « {e.citation} »
                  </span>
                  <span className={`tnum mt-[9px] block font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] ${e.ambre ? ENCRE_SURTITRE_PLAQUE : 'text-text-muted'}`}>
                    {minuteSeconde(e.seconde)} · {e.dansLeMandat ? 'dans le mandat' : 'hors mandat'}
                  </span>
                  <span className={`mt-1 block text-[12px] leading-[1.45] [text-wrap:pretty] ${e.ambre ? ENCRE_SURTITRE_PLAQUE : 'text-text-secondary'}`}>
                    {e.note}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StandardScreen() {
  const { t, langue } = useLangue();
  const { upsert } = useSync();
  const tout = useCollection<EnregistrementStandard>('switchboardCalls');
  const [maintenant] = useState(() => new Date());

  const appels = useMemo(
    () => tout.filter((e): e is Id<AppelStandard> & { updatedAt: string } => e.kind === 'appel'),
    [tout],
  );
  const duJour = appels.filter((a) => jourLocal(a.debutLe) === jourLocal(maintenant)).sort((a, b) => a.debutLe.localeCompare(b.debutLe));
  const appel = useMemo(() => appelAMontrer(duJour.length ? duJour : appels), [duJour, appels]);
  const mandat = tout.find((e): e is MandatStandard & { id: string; updatedAt: string } => e.kind === 'mandat');
  const vide = appels.length === 0;
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const engagements = duJour.flatMap((a) => a.engagements);
  const hors = engagements.filter((e) => !e.dansLeMandat).length;
  const aRappeler = appel?.engagements.find((e) => !e.dansLeMandat && !e.rappeleLe) ?? null;

  const rappeler = async () => {
    if (!appel || !aRappeler) return;
    const brut = appels.find((a) => a.id === appel.id);
    if (!brut) return;
    const le = new Date().toISOString();
    await upsert('switchboardCalls', brut.id, {
      ...donnees(brut),
      engagements: brut.engagements.map((e) => (e === aRappeler || (e.seconde === aRappeler.seconde && e.citation === aRappeler.citation) ? { ...e, rappeleLe: le } : e)),
    });
  };

  const description = vide
    ? t('m50.switchboard.descriptionVide', { assistant: PAR_LUI })
    : hors > 0
      ? t('m50.switchboard.description', { assistant: LUI_MAJ, appels: L(duJour.length), engagements: L(engagements.length), tenus: L(engagements.length - hors, true), hors: L(hors) })
      : t('m50.switchboard.descriptionSansHors', { assistant: LUI_MAJ, appels: L(duJour.length), engagements: L(engagements.length) });

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.guichet'), module: t('m50.switchboard.titre') })}
          title={t('m50.switchboard.titre')}
          description={description}
          phraseVide={t('m50.switchboard.phraseVide')}
        />
      </Bloc>

      {!appel ? (
        <Dominante surtitre="Les promesses">
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            {`Chaque appel pris ${PAR_LUI} s’affichera ici sur deux pistes, et chaque engagement pris en votre nom y sera épinglé à la seconde exacte où il a été dit.`}
          </p>
        </Dominante>
      ) : (
        <Dominante
          surtitre={`Appel de ${heure(appel.debutLe)} · ${appel.appelant} · ${dureeLisible(appel.dureeS)}`}
          note={`Épingle = un engagement pris ${PAR_LUI}`}
        >
          <Promesses appel={appel} />
          {aRappeler ? (
            <PiedDominante action={<BoutonSecondaire onClick={() => void rappeler()}>Rappeler {appel.appelant.split(',')[0]}</BoutonSecondaire>}>
              {appel.explication ?? `« ${aRappeler.citation} » dépasse le mandat ${DE_LUI}. Un engagement hors mandat n’est jamais annulé en silence : la personne est rappelée.`}
            </PiedDominante>
          ) : (
            <PiedDominante>
              {appel.engagements.some((e) => !e.dansLeMandat)
                ? 'L’engagement hors mandat de cet appel a été repris : la personne a été rappelée.'
                : `Tous les engagements de cet appel restent dans le mandat ${DE_LUI}.`}
            </PiedDominante>
          )}
        </Dominante>
      )}

      <Calmes>
        <CarteCalme surtitre="Les appels d’aujourd’hui" note={duJour.length ? `Pris ${PAR_LUI}` : undefined}>
          {duJour.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun appel aujourd’hui.</p>
          ) : (
            duJour.map((a, i) => (
              <div key={a.id} className={`grid grid-cols-[48px_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1 py-2.5 sm:grid-cols-[48px_minmax(0,1fr)_70px_minmax(0,1.1fr)] ${i < duJour.length - 1 ? 'border-b border-border-row' : ''}`}>
                <span className="tnum font-mono text-[12px] text-text-secondary">{heure(a.debutLe)}</span>
                <span className="text-[13px] leading-[1.35] text-text-primary">{a.appelant}</span>
                <span className="tnum font-mono text-[11.5px] text-text-muted">{dureeLisible(a.dureeS)}</span>
                <span className="col-start-2 col-end-4 text-[12.5px] leading-[1.4] text-text-secondary sm:col-start-auto sm:col-end-auto">{a.issue}</span>
              </div>
            ))
          )}
        </CarteCalme>
        <section className="panel flex min-w-0 flex-col px-5 pb-[18px] pt-5">
          <span className="eyebrow text-text-secondary">Son mandat</span>
          {([['Il peut', mandat?.peut ?? []], ['Il ne peut pas', mandat?.nePeutPas ?? []]] as const).map(([titre, liste]) => (
            <div key={titre} className="mt-[18px]">
              <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">{titre}</span>
              <ul className="mt-2 flex flex-col gap-1">
                {liste.length === 0 && <li className="text-[13px] text-text-secondary">—</li>}
                {liste.map((x) => (
                  <li key={x} className="text-[13px] leading-[1.45] text-text-body">{x}</li>
                ))}
              </ul>
            </div>
          ))}
          <p className="mt-auto pt-[18px] text-[13px] leading-[1.55] text-text-secondary">
            Un engagement hors mandat n’est jamais annulé en silence : la personne est rappelée.
          </p>
        </section>
      </Calmes>
    </Ecran50>
  );
}
