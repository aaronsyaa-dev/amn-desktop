import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Bloc, Calmes, CarteCalme, CarteReleves, Dominante, Ecran50, LigneRegistre, PiedDominante } from '../components/cinquante-kit';
import { useCollection } from '../state/SyncContext';
import { formatCentsCompact } from '../lib/money';

/** Un montant converti se lit à l'euro près : le centime d'un taux du jour ne veut rien dire. */
const aLEuro = (c: number) => formatCentsCompact(Math.round(c / 100) * 100);
/** La devise nommée dans une phrase. */
const DEVISE: Record<string, string> = { GBP: 'la livre', USD: 'le dollar', CHF: 'le franc suisse', CAD: 'le dollar canadien', JPY: 'le yen' };
import { enLettres } from '../lib/cinquante/lettres';
import { type EnregistrementDevises, type FactureDevise, PETITE_BULLE_PX, bulles } from '../lib/cinquante/finance';
import { useLangue } from '../i18n';

/**
 * MULTI-DEVISES — les bulles (`36g`).
 *
 * Une bulle par devise dont la SURFACE est proportionnelle à ce qui est dû au
 * taux du jour (diamètre `60 × √(montant / 1000)`), et autour un anneau dont
 * l'épaisseur est le coût d'une variation de 1 % du taux. Une petite bulle
 * porte son libellé dessous. La conversion vient d'un taux DATÉ, affiché.
 *
 * L'ambre : l'anneau de la devise qui a le plus baissé depuis l'émission.
 */

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const pctSigne = (x: number) => `${x < 0 ? '−' : '+'} ${Math.abs(x).toFixed(1).replace('.', ',')} %`;
const eurosSigne = (c: number) => `${c < 0 ? '−' : '+'} ${aLEuro(Math.abs(c))}`;
const unites = (m: number, devise: string) => `${Math.round(m / 100).toLocaleString('fr-FR')} ${devise}`;
const taux = (x: number) => x.toFixed(3).replace('.', ',');

export function MultiDevisesScreen() {
  const { t, langue } = useLangue();
  const tout = useCollection<EnregistrementDevises>('fxRates');
  const [maintenant] = useState(() => new Date());
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const b = useMemo(() => bulles(tout), [tout]);
  const factures = tout.filter((e): e is FactureDevise & { id: string; updatedAt: string } => e.kind === 'facture' && !e.encaisseeLe);
  const vide = b.devises.length === 0;
  const a = b.ambre;
  const factureAmbre = a ? [...a.factures].sort((x, y) => x.tauxEmission * x.montant - y.tauxEmission * y.montant).pop() ?? null : null;
  const joursAvant = factureAmbre ? Math.round((new Date(factureAmbre.echeance).getTime() - maintenant.getTime()) / 86_400_000) : 0;
  const tauxLe = b.tauxLe ? new Date(b.tauxLe) : null;

  const description = vide
    ? t('m50.currencies.descriptionVide')
    : t('m50.currencies.description', { clients: L(new Set(factures.map((f) => f.client)).size, true), total: aLEuro(b.totalCents) });

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.finance'), module: t('m50.currencies.titre') })}
          title={t('m50.currencies.titre')}
          description={description}
          phraseVide={t('m50.currencies.phraseVide')}
        />
      </Bloc>

      <Dominante
        surtitre={tauxLe ? `Ce qui vous est dû en devise · au taux du ${tauxLe.getDate()} ${MOIS[tauxLe.getMonth()]}` : 'Ce qui vous est dû en devise'}
        note={vide ? undefined : 'Surface = montant en € · anneau = coût d’une variation de 1 %'}
      >
        {vide ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Chaque devise dans laquelle un client vous doit de l’argent sera une bulle, à la surface de ce qu’elle vaut au
            taux du jour, cerclée d’un anneau d’autant plus épais qu’une variation du taux vous coûterait cher.
          </p>
        ) : (
          <>
            <div className="flex min-h-[340px] flex-wrap items-center justify-around gap-x-6 gap-y-8 border border-border bg-sunken px-4 py-8">
              {b.devises.map((d) => {
                const ambre = d.devise === a?.devise;
                const petite = d.diametre < PETITE_BULLE_PX;
                return (
                  <div key={d.devise} className="flex flex-col items-center gap-2">
                    <span
                      data-signal-groupe={ambre ? 'devise-en-baisse' : undefined}
                      className={`box-content flex flex-col items-center justify-center rounded-full text-center ${
                        ambre ? 'border-signal bg-[#1c1408] shadow-[0_0_28px_-7px_var(--color-signal-glow)]' : 'border-[#2b2b2b] bg-[#1a1a1a]'
                      }`}
                      style={{ width: d.diametre, height: d.diametre, borderWidth: d.anneau, borderStyle: 'solid' }}
                    >
                      <span className={`font-mono font-bold text-text-primary ${petite ? 'text-[11px]' : 'text-[15px]'}`}>{d.devise}</span>
                      {!petite && <span className="tnum mt-[3px] font-mono text-[11px] font-medium text-text-secondary">{aLEuro(d.eurJourCents)}</span>}
                    </span>
                    <span
                      data-signal-groupe={ambre ? 'devise-en-baisse' : undefined}
                      className={`tnum whitespace-nowrap font-mono text-[10.5px] ${ambre ? 'font-bold text-signal' : 'font-medium text-text-muted'}`}
                    >
                      {unites(d.montant, d.devise)}
                      {petite ? ` · ${aLEuro(d.eurJourCents)}` : ''} · {pctSigne(d.variationPct)}
                      {ambre ? ` · ${eurosSigne(d.latentCents)}` : ''}
                    </span>
                  </div>
                );
              })}
            </div>

            <PiedDominante>
              {a && factureAmbre
                ? `${(DEVISE[a.devise] ?? `le ${a.devise}`).replace(/^./, (x) => x.toUpperCase())} a perdu ${Math.abs(a.variationPct).toFixed(1).replace('.', ',')} % depuis l’émission de la facture de ${factureAmbre.client}, le ${new Date(factureAmbre.emiseLe).getDate()} ${MOIS[new Date(factureAmbre.emiseLe).getMonth()]} : ${aLEuro(Math.abs(a.latentCents))} de moins à l’encaissement. ${
                    joursAvant >= 0 ? `Elle est due dans ${L(joursAvant)} jour${joursAvant > 1 ? 's' : ''}.` : `Elle est échue depuis ${L(-joursAvant)} jour${joursAvant < -1 ? 's' : ''}.`
                  }`
                : 'Aucune devise n’a baissé depuis l’émission de ses factures.'}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Les factures en devise" note={factures.length ? 'Émission → aujourd’hui' : undefined}>
          {factures.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucune facture en devise en attente.</p>
          ) : (
            factures.map((f, i) => {
              const tj = b.devises.find((d) => d.devise === f.devise)?.taux;
              return (
                <LigneRegistre key={f.id} colonnes="minmax(0,1fr) auto auto" derniere={i === factures.length - 1}>
                  <span className="min-w-0 text-[13.5px] text-text-primary">
                    {f.client}
                    <span className="text-text-muted"> · {f.ville}</span>
                  </span>
                  <span className="tnum font-mono text-[11.5px] text-text-secondary">{unites(f.montant, f.devise)}</span>
                  <span className="tnum text-right font-mono text-[11.5px] text-text-secondary">
                    {taux(f.tauxEmission)} → {tj ? taux(tj.eur) : '—'}
                  </span>
                </LigneRegistre>
              );
            })
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="L’exposition"
          releves={[
            { label: 'Total dû', valeur: aLEuro(b.totalCents) },
            { label: 'Change latent', valeur: eurosSigne(b.latentCents) },
            { label: 'La plus exposée', valeur: b.plusExposee?.devise ?? '—' },
          ]}
        >
          Une facture se convertit définitivement au taux du jour de son encaissement.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
