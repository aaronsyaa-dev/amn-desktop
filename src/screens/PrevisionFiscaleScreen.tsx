import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Bloc, Calmes, CarteCalme, CarteReleves, Dominante, Ecran50, LigneRegistre, PiedDominante } from '../components/cinquante-kit';
import { useCollection } from '../state/SyncContext';
import { formatCentsCompact } from '../lib/money';
import { enLettres } from '../lib/cinquante/lettres';
import { type EcheanceFiscale, type EnregistrementFiscal, filigrane, montantEcheance, semaineIso } from '../lib/cinquante/finance';
import { useLangue } from '../i18n';

/**
 * PRÉVISION FISCALE — le filigrane (`36f`).
 *
 * Le solde est une barre pleine de toute la largeur ; dans sa partie droite,
 * la part due au fisc en filigrane — hachurée, contour seul — découpée en un
 * segment par échéance à venir, chacun à sa largeur exacte (montant / solde).
 * La somme des segments est EXACTEMENT la part fiscale ; la part libre est
 * `solde − part fiscale`. La TVA en cours se calcule à la date du jour
 * (collectée − déductible) et son segment montre la part déjà acquise.
 *
 * Le seul rouge de l'écran : une échéance passée sans paiement.
 */

const MOIS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const dateCourte = (iso: string) => `${new Date(iso).getDate()} ${MOIS[new Date(iso).getMonth()]}`;
const HACHURE_AMBRE = 'repeating-linear-gradient(135deg,rgba(208,154,74,.4) 0 2px,transparent 2px 7px)';
const HACHURE_GRISE = 'repeating-linear-gradient(135deg,rgba(255,255,255,.07) 0 2px,transparent 2px 7px)';

export function PrevisionFiscaleScreen() {
  const { t, langue } = useLangue();
  const tout = useCollection<EnregistrementFiscal>('taxDeadlines');
  const [maintenant] = useState(() => new Date());
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const f = useMemo(() => filigrane(tout, maintenant), [tout, maintenant]);
  const vide = f.aucunSolde;
  const p = f.prochaine;
  /* Un libellé ne se pose sous son segment que s'il y tient (12 % de la barre) ; sinon, tous passent en liste. */
  const aligne = f.segments.every((s) => s.largeurPct >= 12);
  const semainesAvant = p ? Math.max(0, Math.round((new Date(p.e.echeance).getTime() - maintenant.getTime()) / (7 * 86_400_000))) : 0;
  const calendrier = useMemo(
    () =>
      tout
        .filter((e): e is EcheanceFiscale & { id: string; updatedAt: string } => e.kind === 'echeance' && !e.payeeLe)
        .filter((e) => new Date(e.echeance).getTime() < maintenant.getTime() + 366 * 86_400_000)
        .sort((a, b) => a.echeance.localeCompare(b.echeance)),
    [tout, maintenant],
  );

  const description = vide
    ? t('m50.taxForecast.descriptionVide')
    : p
      ? t('m50.taxForecast.description', {
          solde: formatCentsCompact(f.soldeCents),
          fiscal: formatCentsCompact(f.partFiscale),
          semaines: L(semainesAvant),
        })
      : t('m50.taxForecast.descriptionSansEcheance', { solde: formatCentsCompact(f.soldeCents) });

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.finance'), module: t('m50.taxForecast.titre') })}
          title={t('m50.taxForecast.titre')}
          description={description}
          phraseVide={t('m50.taxForecast.phraseVide')}
        />
      </Bloc>

      <Dominante surtitre="Le solde, et ce qui n’est pas à vous" note={vide ? undefined : 'Plein = à vous · filigrane = dû au fisc'}>
        {vide ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Le solde du compte s’affichera ici en une barre pleine, et la part qui revient au fisc y sera dessinée en
            filigrane, découpée échéance par échéance.
          </p>
        ) : (
          <>
            <div className="flex h-[84px] border border-[#333]">
              <span className="flex flex-col justify-center overflow-hidden bg-text-body px-2 sm:px-4" style={{ width: `${f.librePct}%` }}>
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-border-strong">À vous</span>
                <span className="tnum mt-1 font-mono text-[16px] font-bold tracking-[-0.03em] text-[#0a0a0a] sm:text-[22px]">{formatCentsCompact(Math.max(0, f.partLibre))}</span>
              </span>
              {f.segments.map((s) => {
                const a = s.e === p?.e;
                return (
                  <span
                    key={s.e.echeance + s.e.impot}
                    data-signal-groupe={a ? 'prochaine-echeance' : undefined}
                    className={`relative ${s.enRetard ? 'border-2 border-danger' : a ? 'border-2 border-signal shadow-[0_0_28px_-7px_var(--color-signal-glow)]' : 'border border-dashed border-text-muted'}`}
                    style={{ width: `${s.largeurPct}%`, backgroundImage: a ? HACHURE_AMBRE : HACHURE_GRISE }}
                  >
                    {s.e.tva && s.constituePct < 100 && (
                      /* La part déjà acquise de la TVA en cours : un trait au bord de ce qui est constitué. */
                      <span className={`absolute inset-y-0 w-px ${a ? 'bg-signal' : 'bg-text-muted'}`} style={{ left: `${Math.min(100, s.constituePct)}%` }} />
                    )}
                  </span>
                );
              })}
            </div>
            {/* Les libellés sous chaque segment quand ils y tiennent ; en liste sinon, et sur un téléphone. */}
            <div className={`mt-2.5 flex max-sm:hidden ${aligne ? '' : 'hidden'}`}>
              <span style={{ width: `${f.librePct}%` }} />
              {f.segments.map((s) => {
                const a = s.e === p?.e;
                const encre = s.enRetard ? 'text-danger' : a ? 'text-signal' : 'text-text-muted';
                return (
                  <span key={s.e.echeance + s.e.impot} className="min-w-0 pr-1.5" style={{ width: `${s.largeurPct}%` }} data-signal-groupe={a ? 'prochaine-echeance' : undefined}>
                    <span className={`block whitespace-nowrap font-mono text-[9px] font-bold uppercase tracking-[0.1em] ${s.enRetard ? 'text-danger' : a ? 'text-signal' : 'text-text-muted'}`}>{s.e.court}</span>
                    <span className={`tnum mt-[3px] block whitespace-nowrap font-mono text-[12px] ${a ? 'font-bold text-signal' : 'font-medium text-text-secondary'}`}>{formatCentsCompact(s.montantCents)}</span>
                    <span className={`mt-0.5 block whitespace-nowrap text-[11px] ${encre}`}>{dateCourte(s.e.echeance)}</span>
                  </span>
                );
              })}
            </div>
            <div className={`mt-3 flex flex-col gap-1.5 ${aligne ? 'sm:hidden' : ''}`}>
              {f.segments.map((s) => {
                const a = s.e === p?.e;
                return (
                  <span key={s.e.echeance + s.e.impot} data-signal-groupe={a ? 'prochaine-echeance' : undefined} className={`flex justify-between font-mono text-[11px] ${s.enRetard ? 'text-danger' : a ? 'font-bold text-signal' : 'text-text-secondary'}`}>
                    <span>{s.e.court} · {dateCourte(s.e.echeance)}</span>
                    <span className="tnum">{formatCentsCompact(s.montantCents)}</span>
                  </span>
                );
              })}
            </div>

            <PiedDominante>
              {f.segments.some((s) => s.enRetard)
                ? `Une échéance est passée sans paiement : ${f.segments.filter((s) => s.enRetard).map((s) => `${s.e.impot} du ${dateCourte(s.e.echeance)}`).join(', ')}.`
                : p
                  ? p.e.tva
                    ? `La ${p.e.impot} est constituée à ${p.constituePct} % : il reste ${L(Math.max(0, Math.round((new Date(p.e.tva.clotureLe).getTime() - maintenant.getTime()) / 86_400_000)))} jours de facturation avant la clôture. Elle se paie le ${dateCourte(p.e.echeance)}, en semaine ${semaineIso(new Date(p.e.echeance))}.`
                    : `La prochaine échéance, ${p.e.impot.toLowerCase()} de ${formatCentsCompact(p.montantCents)}, tombe le ${dateCourte(p.e.echeance)}.`
                  : 'Aucune échéance connue à venir.'}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Les douze prochains mois" note={calendrier.length ? 'Impôt · date · montant' : undefined}>
          {calendrier.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucune échéance fiscale connue.</p>
          ) : (
            calendrier.map((e, i) => (
              <LigneRegistre key={e.id} colonnes="minmax(0,1fr) auto auto" derniere={i === calendrier.length - 1}>
                <span className="text-[13.5px] text-text-primary">{e.impot}</span>
                <span className="font-mono text-[11.5px] text-text-secondary">{dateCourte(e.echeance)}</span>
                <span className="tnum text-right font-mono text-[11.5px] text-text-secondary">
                  {e.estimation ? '≈ ' : ''}
                  {formatCentsCompact(montantEcheance(e))}
                </span>
              </LigneRegistre>
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Le compte"
          releves={[
            { label: 'Solde', valeur: formatCentsCompact(f.soldeCents) },
            { label: 'Part fiscale', valeur: formatCentsCompact(f.partFiscale) },
            { label: 'Part libre', valeur: formatCentsCompact(f.partLibre) },
          ]}
        >
          {f.estimations.length
            ? 'Seules les échéances connues sont en filigrane ; les suivantes restent des estimations.'
            : 'Chaque échéance connue est en filigrane dans le solde.'}
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}

