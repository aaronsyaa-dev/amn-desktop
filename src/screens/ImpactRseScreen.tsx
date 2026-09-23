import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Bloc, Calmes, CarteCalme, CarteReleves, Dominante, Ecran50, LigneRegistre, PiedDominante } from '../components/cinquante-kit';
import { useCollection } from '../state/SyncContext';
import { enLettres } from '../lib/cinquante/lettres';
import { CUBES_PAR_RANGEE, type EnregistrementRse, KG_PAR_CUBE, cubesDe, empilement } from '../lib/cinquante/juridique';
import { useLangue } from '../i18n';

/**
 * IMPACT RSE — les cubes (`38d`).
 *
 * L'empreinte de l'année en cubes de 100 kg de CO₂e, empilés par source,
 * cinq par rangée, de bas en haut. Un cube se compte à l'œil ; le total
 * affiché EST la somme des cubes. Les cubes de l'année précédente qui ont
 * disparu restent en pointillé ; ceux apparus cette année sont marqués — en
 * ambre seulement dans la source qui a le plus grossi.
 */

const CUBE = 18;
const ECART = 3;
const tonnes = (cubes: number) => `${((cubes * KG_PAR_CUBE) / 1000).toFixed(1).replace('.', ',')} t`;

export function ImpactRseScreen() {
  const { t, langue } = useLangue();
  const tout = useCollection<EnregistrementRse>('carbonSources');
  const [maintenant] = useState(() => new Date());
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const annees = [...new Set(tout.filter((e) => e.kind === 'source').map((e) => (e as { annee: number }).annee))].sort();
  const annee = annees.includes(maintenant.getFullYear()) ? maintenant.getFullYear() : annees[annees.length - 1] ?? maintenant.getFullYear();
  const e = useMemo(() => empilement(tout, annee), [tout, annee]);
  const vide = e.colonnes.length === 0;
  const h = e.hausse;
  const hauteur = e.rangees * CUBE + (e.rangees - 1) * ECART;
  const largeur = CUBES_PAR_RANGEE * CUBE + (CUBES_PAR_RANGEE - 1) * ECART;
  const seulesHausses = e.colonnes.filter((c) => c.apparus > 0).length;

  const description = vide
    ? t('m50.csr.descriptionVide')
    : h
      ? t(seulesHausses === 1 ? 'm50.csr.description' : 'm50.csr.descriptionPlusieurs', { total: tonnes(e.totalCubes), source: h.source.nom.toLowerCase() })
      : t('m50.csr.descriptionSansHausse', { total: tonnes(e.totalCubes) });

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.juridique'), module: t('m50.csr.titre') })}
          title={t('m50.csr.titre')}
          description={description}
          phraseVide={t('m50.csr.phraseVide')}
        />
      </Bloc>

      <Dominante surtitre={`L’empreinte de ${annee} · un cube = ${KG_PAR_CUBE} kg CO₂e`} note={vide ? undefined : `Pointillé = cube disparu depuis ${annee - 1}`}>
        {vide ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Les postes d’émission de l’année s’empileront ici en cubes de cent kilos de CO₂, par source : on comptera
            l’empreinte à l’œil, et on verra d’où vient ce qui a bougé.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-center gap-x-14 gap-y-8">
              {e.colonnes.map((c) => {
                const estH = h?.source.nom === c.source.nom;
                const gardes = Math.min(c.cubes, c.avant);
                const cubes = [
                  ...Array.from({ length: gardes }, () => 'garde' as const),
                  ...Array.from({ length: c.apparus }, () => 'apparu' as const),
                  ...Array.from({ length: c.disparus }, () => 'disparu' as const),
                ];
                return (
                  <div key={c.source.nom} className="flex flex-none flex-col items-center gap-3">
                    <div className="flex flex-wrap-reverse content-start gap-[3px]" style={{ width: largeur, height: hauteur }} aria-hidden>
                      {cubes.map((k, i) => (
                        <span
                          key={i}
                          data-signal-groupe={k === 'apparu' && estH ? 'hausse' : undefined}
                          className={
                            k === 'garde'
                              ? 'bg-[#4a4a48] shadow-[inset_0_3px_0_rgba(255,255,255,.14)]'
                              : k === 'disparu'
                                ? 'border border-dashed border-[#4a4a48]'
                                : estH
                                  ? 'border-2 border-signal bg-[rgba(208,154,74,.18)] shadow-[0_0_10px_-2px_rgba(208,154,74,.7)]'
                                  : 'border border-text-muted bg-[rgba(255,255,255,.06)]'
                          }
                          style={{ width: CUBE, height: CUBE }}
                        />
                      ))}
                    </div>
                    <span className="text-center">
                      <span className="block whitespace-nowrap text-[13px] font-semibold text-text-primary">{c.source.nom}</span>
                      <span
                        data-signal-groupe={estH ? 'hausse' : undefined}
                        className={`tnum mt-[3px] block whitespace-nowrap font-mono text-[10.5px] ${estH ? 'font-bold text-signal' : 'text-text-muted'}`}
                      >
                        {tonnes(c.cubes)} · {c.apparus ? `+ ${c.apparus} cube${c.apparus > 1 ? 's' : ''}` : c.disparus ? `− ${c.disparus}` : 'stable'}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>

            <PiedDominante>
              {h
                ? `${h.source.nom} : ${L(h.apparus)} cube${h.apparus > 1 ? 's' : ''} de plus qu’en ${annee - 1}, soit ${tonnes(h.apparus)} de CO₂e. ${
                    seulesHausses === 1 ? 'C’est la seule source qui a grossi.' : 'C’est la source qui a le plus grossi.'
                  }`
                : `Aucune source n’a grossi depuis ${annee - 1}.`}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Les postes d’émission" note={vide ? undefined : 'Volume · facteur'}>
          {vide ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun poste d’émission relevé.</p>
          ) : (
            e.colonnes.map((c, i) => (
              <LigneRegistre key={c.source.nom} colonnes="minmax(0,1fr) auto auto" derniere={i === e.colonnes.length - 1}>
                <span className="min-w-0 text-[13.5px] text-text-primary" title={`${c.source.facteurKg} kg CO₂e / ${c.source.unite} · ${c.source.referenceFacteur}`}>
                  {c.source.poste}
                </span>
                <span className="tnum font-mono text-[11.5px] text-text-muted">
                  {c.source.volume.toLocaleString('fr-FR')} {c.source.unite}
                </span>
                <span className="tnum text-right font-mono text-[11.5px] text-text-secondary">{tonnes(cubesDe(c.source))}</span>
              </LigneRegistre>
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Le bilan"
          releves={[
            { label: 'Total', valeur: `${tonnes(e.totalCubes)} CO₂e` },
            { label: 'Variation', valeur: e.variationCubes === null ? '—' : `${e.variationCubes >= 0 ? '+' : '−'} ${tonnes(Math.abs(e.variationCubes))}` },
            { label: 'Par intervention', valeur: e.parInterventionKg === null ? '—' : `${e.parInterventionKg} kg` },
          ]}
        >
          Les facteurs d’émission sont ceux de la base publique de référence, cités poste par poste.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
