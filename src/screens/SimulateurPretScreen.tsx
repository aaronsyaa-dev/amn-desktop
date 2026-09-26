import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  Bloc,
  BoutonSecondaire,
  Calmes,
  CarteCalme,
  CarteReleves,
  Dominante,
  Ecran50,
  LigneRegistre,
  PiedDominante,
  donnees,
} from '../components/cinquante-kit';
import { SaisieModule, depuisCents, versCents, versIso, versJour, versNombre } from '../components/SaisieModule';
import { uid, useCollection, useSync } from '../state/SyncContext';
import { formatCentsCompact } from '../lib/money';
import { enLettres } from '../lib/cinquante/lettres';
import { type DemandePret, type EnregistrementTresorerie, PRET, durees, mensualiteSupportable } from '../lib/cinquante/finance';
import { useLangue } from '../i18n';

/**
 * SIMULATEUR DE PRÊT — même prêt, trois durées (`36c`).
 *
 * Trois colonnes. Chacune porte le MÊME bloc de capital (180 px pour le
 * capital) et, posée dessus, sa coiffe d'intérêts à la même échelle. Sous
 * chaque colonne, la mensualité mesurée contre la mensualité supportable,
 * marquée d'un trait blanc au même endroit dans les trois.
 *
 * Le seuil n'est PAS saisi : il est lu dans Trésorerie prévue (l'excédent
 * mensuel moyen relevé). Sans prévision, il n'y a pas de seuil, pas d'ambre,
 * et l'écran le dit.
 */

const MOIS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const pourcent = (x: number) => `${(x * 100).toFixed(1).replace('.', ',').replace(/,0$/, '')} %`;

export function SimulateurPretScreen() {
  const { t, langue } = useLangue();
  const { upsert, remove } = useSync();
  const prets = useCollection<DemandePret>('loanSimulations');
  const tresorerie = useCollection<EnregistrementTresorerie>('cashForecast');
  const [maintenant] = useState(() => new Date());
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const pret = [...prets].sort((a, b) => b.debut.localeCompare(a.debut))[0] ?? null;
  const supportable = useMemo(() => mensualiteSupportable(tresorerie, maintenant), [tresorerie, maintenant]);
  const d = pret ? durees(pret, supportable) : null;
  const vide = !pret;
  const court = d?.lignes[0] ?? null;

  const fin = (ans: number) => {
    const x = new Date(pret?.debut ?? maintenant.toISOString());
    x.setFullYear(x.getFullYear() + ans);
    return `${MOIS[x.getMonth()]} ${x.getFullYear()}`;
  };

  const demander = async () => {
    if (!pret || !d?.ambre) return;
    await upsert('loanSimulations', pret.id, { ...donnees(pret), demandeLe: new Date().toISOString(), dureeDemandeeAns: d.ambre.ans });
  };

  const description = !pret
    ? t('m50.loanSim.descriptionVide')
    : t('m50.loanSim.description', { capital: formatCentsCompact(pret.capitalCents), n: L(pret.dureesAns.length) });

  const enregistrer = async (v: Record<string, string>, id?: string) => {
    const avant = id ? prets.find((p) => p.id === id) : undefined;
    const fiche: DemandePret = {
      kind: 'pret',
      objet: v.objet.trim(),
      capitalCents: versCents(v.capital) ?? 0,
      tauxAnnuel: (versNombre(v.taux) ?? 0) / 100,
      dureesAns: [...new Set(v.durees.split(/[^0-9]+/).map(Number).filter((n) => n > 0 && n <= 40))].sort((a, b) => a - b),
      debut: v.debut ? versIso(v.debut) : new Date().toISOString(),
      ...(avant?.demandeLe ? { demandeLe: avant.demandeLe, dureeDemandeeAns: avant.dureeDemandeeAns } : {}),
    };
    await upsert('loanSimulations', id ?? uid(), { ...fiche });
  };

  return (
    <Ecran50 vide={vide} premierJour={prets.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.finance'), module: t('m50.loanSim.titre') })}
          title={t('m50.loanSim.titre')}
          description={description}
          phraseVide={t('m50.loanSim.phraseVide')}
        />
      </Bloc>

      <SaisieModule
        ajouter="Simuler un prêt"
        ouvertParDefaut={vide}
        note="Une simulation : rien n’est envoyé à une banque"
        champs={[
          { cle: 'objet', intitule: 'Objet du prêt', type: 'texte', requis: true, aide: 'Ce que le prêt finance : « camion frigorifique », « travaux de la boutique ».' },
          { cle: 'capital', intitule: 'Montant emprunté', type: 'montant', requis: true },
          { cle: 'taux', intitule: 'Taux annuel', type: 'pourcent', requis: true, aide: 'Le taux proposé par la banque, par exemple 4,2.' },
          { cle: 'durees', intitule: 'Durées à comparer', type: 'texte', requis: true, defaut: '5, 7, 10', suffixe: 'ans', aide: 'Deux à quatre durées en années, séparées par des virgules.' },
          { cle: 'debut', intitule: 'Premier remboursement', type: 'date' },
        ]}
        enregistrer={enregistrer}
        elements={[...prets]
          .sort((a, b) => b.debut.localeCompare(a.debut))
          .map((p) => ({
            id: p.id,
            libelle: p.objet || 'Prêt sans objet',
            detail: `${formatCentsCompact(p.capitalCents)} · ${pourcent(p.tauxAnnuel)} · ${p.dureesAns.join(', ')} ans`,
            valeurs: { objet: p.objet, capital: depuisCents(p.capitalCents), taux: String(+(p.tauxAnnuel * 100).toFixed(3)).replace('.', ','), durees: p.dureesAns.join(', '), debut: versJour(p.debut) },
          }))}
        supprimer={(id) => remove('loanSimulations', id)}
      />

      <Dominante
        surtitre={pret ? `Le même prêt, ${L(pret.dureesAns.length)} durées` : 'Le même prêt, plusieurs durées'}
        note={pret ? 'Bloc = capital · coiffe = intérêts · trait = mensualité supportable' : undefined}
      >
        {!pret || !d ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Un emprunt s’affichera ici sur plusieurs durées côte à côte : le même capital, la coiffe d’intérêts qui
            grossit avec le temps, et la mensualité mesurée contre ce que la trésorerie peut porter.
          </p>
        ) : (
          <>
            <div className="flex items-end gap-4 sm:gap-10 sm:px-5">
              {d.lignes.map((l) => {
                const ambre = d.ambre?.ans === l.ans;
                const trop = supportable !== null && l.mensualiteCents > supportable;
                return (
                  <div key={l.ans} className="flex min-w-0 flex-1 flex-col items-center">
                    <span
                      data-signal-groupe={ambre ? 'duree' : undefined}
                      className={`tnum whitespace-nowrap font-mono text-[11px] sm:text-[12px] ${ambre ? 'font-bold text-signal' : 'font-medium text-text-secondary'}`}
                    >
                      + {formatCentsCompact(l.interetsCents)}
                      <span className="max-sm:hidden"> d’intérêts</span>
                    </span>
                    <div className="mt-2.5 flex w-full max-w-[124px] flex-col">
                      <span
                        data-signal-groupe={ambre ? 'duree' : undefined}
                        className={ambre ? 'bg-signal shadow-[0_0_28px_-7px_var(--color-signal-glow)]' : 'bg-text-muted'}
                        style={{ height: l.coiffePx }}
                      />
                      <span
                        className="flex items-center justify-center border-t border-elevated bg-[#2b2b2b] font-mono text-[11px] font-medium text-text-muted"
                        style={{ height: PRET.capitalPx }}
                      >
                        {formatCentsCompact(pret.capitalCents)}
                      </span>
                    </div>
                    <span className="mt-3 text-[15px] font-bold text-text-primary">{l.ans} ans</span>
                    <div className="relative mt-3.5 h-2 w-full bg-[#191919]">
                      <span
                        className={`block h-2 ${trop ? 'bg-text-body' : 'bg-[#4a4a48]'}`}
                        style={{ width: `${Math.min(100, (l.mensualiteCents / d.echelle) * 100)}%` }}
                      />
                      {supportable !== null && (
                        <span className="absolute -bottom-1 -top-1 w-0.5 bg-text-primary" style={{ left: `${(supportable / d.echelle) * 100}%` }} />
                      )}
                    </div>
                    <span
                      data-signal-groupe={ambre ? 'duree' : undefined}
                      className={`tnum mt-[7px] text-center font-mono text-[11.5px] sm:text-[12.5px] ${ambre ? 'font-bold text-signal' : 'font-medium text-text-secondary'}`}
                    >
                      {formatCentsCompact(l.mensualiteCents)} / mois{trop ? ' · trop lourd' : ''}
                    </span>
                  </div>
                );
              })}
            </div>

            <PiedDominante action={d.ambre ? <BoutonSecondaire onClick={() => void demander()}>Demander {d.ambre.ans} ans</BoutonSecondaire> : undefined}>
              {supportable === null
                ? 'Aucune prévision de trésorerie : la mensualité supportable ne peut pas être lue, et aucune durée n’est désignée.'
                : pret.demandeLe && pret.dureeDemandeeAns
                  ? `Le prêt sur ${pret.dureeDemandeeAns} ans est demandé.`
                  : d.ambre && court
                    ? d.ambre.ans === court.ans
                      ? `Sur ${court.ans} ans, la mensualité de ${formatCentsCompact(court.mensualiteCents)} reste sous les ${formatCentsCompact(supportable)} que la trésorerie peut porter : c’est la durée la plus courte, donc la moins chère.`
                      : `Sur ${d.ambre.ans} ans, la mensualité de ${formatCentsCompact(d.ambre.mensualiteCents)} reste sous les ${formatCentsCompact(supportable)} que la trésorerie peut porter, pour ${formatCentsCompact(d.ambre.interetsCents - court.interetsCents)} d’intérêts de plus qu’en ${court.ans} ans. Sur ${court.ans} ans, elle dépasse ce seuil de ${formatCentsCompact(court.mensualiteCents - supportable)} par mois.`
                    : `Aucune durée ne passe sous les ${formatCentsCompact(supportable)} par mois que la trésorerie peut porter.`}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre={pret ? `Les ${L(pret.dureesAns.length)} durées` : 'Les durées'} note={pret ? 'Coût total · fin' : undefined}>
          {!pret || !d ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun prêt simulé.</p>
          ) : (
            d.lignes.map((l, i) => (
              <LigneRegistre key={l.ans} colonnes="minmax(0,1fr) auto auto" derniere={i === d.lignes.length - 1}>
                <span className="text-[13.5px] text-text-primary">{l.ans} ans</span>
                <span className="tnum font-mono text-[11.5px] text-text-secondary">{formatCentsCompact(pret.capitalCents + l.interetsCents)}</span>
                <span className="text-right font-mono text-[11.5px] text-text-secondary">{fin(l.ans)}</span>
              </LigneRegistre>
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Le prêt"
          releves={[
            { label: 'Capital', valeur: pret ? formatCentsCompact(pret.capitalCents) : '—' },
            { label: 'Taux', valeur: pret ? pourcent(pret.tauxAnnuel) : '—' },
            { label: 'Supportable', valeur: supportable === null ? 'non lu' : `${formatCentsCompact(supportable)} / mois` },
          ]}
        >
          Le seuil supportable vient de Trésorerie prévue, et se recalcule quand la prévision change.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
