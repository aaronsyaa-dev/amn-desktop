import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Bloc, Calmes, CarteCalme, CarteReleves, Dominante, Ecran50, LigneBarre, PiedDominante } from '../components/cinquante-kit';
import { SaisieModule, Saisies, depuisCents, versCents, versIso, versJour } from '../components/SaisieModule';
import { uid, useCollection, useSync } from '../state/SyncContext';
import { formatCentsCompact } from '../lib/money';
import { enLettres } from '../lib/cinquante/lettres';
import { CONE, type EnregistrementTresorerie, type FluxPrevu, type NatureFlux, type SoldeTresorerie, compositionCone, cone, yCone } from '../lib/cinquante/finance';
import { useLangue } from '../i18n';

/**
 * TRÉSORERIE PRÉVUE — le cône (`36a`).
 *
 * La projection sur douze semaines tracée en cône : la ligne centrale, et
 * l'éventail qui s'élargit de σ × √k (σ : l'écart type réel des encaissements
 * hebdomadaires des douze derniers mois). Échelle commune 0 → 24 000 €, zéro
 * toujours visible. Le point ambre se pose à la première semaine où
 * `central − écart < 0`, en pourcentage du MÊME conteneur que le SVG.
 */

const { l: VBL, h: VBH } = CONE.viewBox;

export function TresorerieScreen() {
  const { t, langue } = useLangue();
  const tout = useCollection<EnregistrementTresorerie>('cashForecast');
  const { upsert, remove } = useSync();
  const [maintenant] = useState(() => new Date());
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const c = useMemo(() => cone(tout, maintenant), [tout, maintenant]);
  const comp = useMemo(() => compositionCone(tout, maintenant), [tout, maintenant]);
  const vide = !c;
  const x = (k: number) => (k / CONE.semaines) * VBL;
  const pts = (vals: number[]) => vals.map((v, k) => `${x(k).toFixed(1)} ${yCone(v).toFixed(1)}`);

  /* Ce qui tombe la semaine critique : les plus grosses sorties, nommées. */
  const critiqueFlux = useMemo(() => {
    if (!c || c.critique === null) return [];
    const debut = maintenant.getTime() + (c.critique - 1) * 7 * 86_400_000;
    return tout
      .filter((e): e is FluxPrevu & { id: string; updatedAt: string } => e.kind === 'flux' && e.montantCents < 0)
      .filter((f) => new Date(f.le).getTime() >= debut && new Date(f.le).getTime() < debut + 7 * 86_400_000)
      .sort((a, b) => a.montantCents - b.montantCents)
      .slice(0, 3);
  }, [c, tout, maintenant]);

  const description = !c
    ? t('m50.cashForecast.descriptionVide')
    : c.critique !== null
      ? t('m50.cashForecast.description', { semaine: String(c.semaines[c.critique]) })
      : t('m50.cashForecast.descriptionTient');

  /* SAISIE — le solde relevé (le point de départ du cône), puis ce qui est prévu d'entrer et de sortir. */
  const soldes = tout.filter((e): e is SoldeTresorerie & { id: string; updatedAt: string } => e.kind === 'solde').sort((a, b) => b.le.localeCompare(a.le));
  const flux = tout.filter((e): e is FluxPrevu & { id: string; updatedAt: string } => e.kind === 'flux').sort((a, b) => a.le.localeCompare(b.le));
  const enregistrerSolde = async (v: Record<string, string>, id?: string) => {
    await upsert('cashForecast', id ?? uid(), { kind: 'solde', soldeCents: versCents(v.solde) ?? 0, le: versIso(v.le) });
  };
  const SORTIES: NatureFlux[] = ['sortie-fixe', 'sortie-variable'];
  const enregistrerFlux = async (v: Record<string, string>, id?: string) => {
    const nature = v.nature as NatureFlux;
    const montant = Math.abs(versCents(v.montant) ?? 0);
    await upsert('cashForecast', id ?? uid(), { kind: 'flux', libelle: v.libelle.trim(), le: versIso(v.le), montantCents: SORTIES.includes(nature) ? -montant : montant, nature });
  };
  const aujourdhui = versJour(maintenant.toISOString());

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.finance'), module: t('m50.cashForecast.titre') })}
          title={t('m50.cashForecast.titre')}
          description={description}
          phraseVide={t('m50.cashForecast.phraseVide')}
        />
      </Bloc>

      <Saisies>
        <SaisieModule
          ajouter="Relever le solde du compte"
          ouvertParDefaut={soldes.length === 0}
          surtitreListe="Les soldes relevés"
          champs={[
            { cle: 'solde', intitule: 'Solde du compte', type: 'montant', requis: true, aide: 'Ce que la banque affiche ce jour-là, découvert en négatif.' },
            { cle: 'le', intitule: 'Relevé le', type: 'date', requis: true, defaut: aujourdhui },
          ]}
          enregistrer={enregistrerSolde}
          elements={soldes.map((x) => ({ id: x.id, libelle: formatCentsCompact(x.soldeCents), detail: `relevé le ${versJour(x.le)}`, valeurs: { solde: depuisCents(x.soldeCents), le: versJour(x.le) } }))}
          supprimer={(id) => remove('cashForecast', id)}
        />
        {soldes.length > 0 && (
          <SaisieModule
            ajouter="Prévoir une entrée ou une sortie"
            surtitreListe="Ce qui est prévu"
            champs={[
              { cle: 'libelle', intitule: 'Quoi', type: 'texte', requis: true, aide: '« Loyer », « Paiement Maison Bertaux », « URSSAF ».' },
              {
                cle: 'nature',
                intitule: 'Nature',
                type: 'choix',
                requis: true,
                options: [
                  { valeur: 'certaine', libelle: 'Entrée certaine' },
                  { valeur: 'probable', libelle: 'Entrée probable' },
                  { valeur: 'sortie-fixe', libelle: 'Sortie fixe' },
                  { valeur: 'sortie-variable', libelle: 'Sortie variable' },
                ],
              },
              { cle: 'montant', intitule: 'Montant', type: 'montant', requis: true },
              { cle: 'le', intitule: 'Date prévue', type: 'date', requis: true },
            ]}
            enregistrer={enregistrerFlux}
            elements={flux.map((f) => ({
              id: f.id,
              libelle: f.libelle,
              detail: `${f.montantCents < 0 ? '−' : '+'} ${formatCentsCompact(Math.abs(f.montantCents))} · ${versJour(f.le)}`,
              valeurs: { libelle: f.libelle, nature: f.nature, montant: depuisCents(Math.abs(f.montantCents)), le: versJour(f.le) },
            }))}
            supprimer={(id) => remove('cashForecast', id)}
          />
        )}
      </Saisies>

      <Dominante surtitre={`Le solde projeté · ${L(CONE.semaines)} semaines`} note={c ? 'Cône = incertitude cumulée · ligne = zéro' : undefined}>
        {!c ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Dès que le solde du compte sera relevé, sa projection sur douze semaines s’ouvrira ici en éventail : la ligne la
            plus probable, et l’incertitude qui grandit à mesure qu’on s’éloigne d’aujourd’hui.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-2 sm:grid-cols-[52px_minmax(0,1fr)] sm:gap-3">
              <div className="relative h-[260px] font-mono text-[9.5px] text-text-muted">
                {[2_000_000, 1_000_000, 0].map((v) => (
                  <span key={v} className="absolute right-0 -translate-y-1/2" style={{ top: `${(yCone(v) / VBH) * 100}%` }}>
                    {v === 0 ? '0 €' : `${v / 100_000} k`}
                  </span>
                ))}
              </div>
              <div className="min-w-0">
                <div className="relative h-[260px] overflow-hidden border border-border-raised bg-sunken">
                  <svg viewBox={`0 0 ${VBL} ${VBH}`} preserveAspectRatio="none" className="absolute inset-0 h-[260px] w-full" aria-hidden>
                    <path
                      d={`M${[...pts(c.central.map((v, k) => v + c.ecart[k])), ...pts(c.central.map((v, k) => v - c.ecart[k])).reverse()].join(' L')} Z`}
                      fill="rgba(247,247,245,.07)"
                      stroke="var(--color-border-strong)"
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                    />
                    <path d={`M${pts(c.central).join(' L')}`} fill="none" stroke="var(--color-text-body)" strokeWidth={2.4} vectorEffect="non-scaling-stroke" />
                    <path d={`M0 ${CONE.yZero} L${VBL} ${CONE.yZero}`} stroke="var(--color-text-muted)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                  </svg>
                  {c.critique !== null && (
                    <>
                      <span
                        data-signal-groupe="bas-du-cone"
                        className="absolute h-[13px] w-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal shadow-[0_0_28px_-7px_var(--color-signal-glow)]"
                        style={{ left: `${(c.critique / CONE.semaines) * 100}%`, top: `${(CONE.yZero / VBH) * 100}%` }}
                      />
                      <span
                        data-signal-groupe="bas-du-cone"
                        className="absolute whitespace-nowrap bg-signal px-[9px] py-[5px] font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-signal-ink [--plaque:4.5rem] sm:[--plaque:15rem]"
                        style={{
                          left: `clamp(0px, calc(${(c.critique / CONE.semaines) * 100}% - var(--plaque) / 2), calc(100% - var(--plaque)))`,
                          top: `calc(${(CONE.yZero / VBH) * 100}% - 40px)`,
                        }}
                      >
                        S{c.semaines[c.critique]}
                        <span className="max-sm:hidden"> · le bas du cône touche zéro</span>
                      </span>
                    </>
                  )}
                </div>
                <div className="relative mt-[9px] h-[13px] font-mono text-[9.5px] tracking-[0.08em] text-text-muted">
                  {c.semaines.map((s, k) =>
                    k % 2 === 0 ? (
                      <span
                        key={k}
                        className={`absolute ${k === 0 ? '' : k === CONE.semaines ? '-translate-x-full' : '-translate-x-1/2'} ${k % 4 === 2 ? 'max-sm:hidden' : ''}`}
                        style={{ left: `${(k / CONE.semaines) * 100}%` }}
                      >
                        S{s}
                      </span>
                    ) : null,
                  )}
                </div>
              </div>
            </div>

            <PiedDominante>
              {c.critique !== null
                ? `La semaine ${c.semaines[c.critique]}, le solde central tombe à ${formatCentsCompact(c.central[c.critique])} et le pire cas passe sous zéro${
                    critiqueFlux.length ? ` : ${critiqueFlux.map((f) => `${/^.[a-zà-ÿ]/.test(f.libelle) ? f.libelle.replace(/^./, (x) => x.toLowerCase()) : f.libelle} (${formatCentsCompact(-f.montantCents)})`).join(', ')}` : ''
                  }.`
                : `Sur douze semaines, le bas du cône reste au-dessus de zéro : le pire cas reste supportable.`}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Ce qui fait le cône" note={c ? `${CONE.semaines} semaines` : undefined}>
          {!c ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun flux prévu pour l’instant.</p>
          ) : (
            (() => {
              const lignes: Array<[string, number]> = [
                ['Entrées certaines', comp.certaines],
                ['Entrées probables', comp.probables],
                ['Sorties variables', comp.variables],
              ];
              const max = Math.max(1, ...lignes.map((l) => l[1]));
              return lignes.map(([nom, v], i) => <LigneBarre key={nom} nom={nom} part={v / max} valeur={formatCentsCompact(v)} derniere={i === 2} />);
            })()
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Le solde"
          releves={[
            { label: 'Aujourd’hui', valeur: c ? formatCentsCompact(c.soldeCents) : '—' },
            { label: `Central à ${CONE.semaines} sem.`, valeur: c ? formatCentsCompact(c.central[CONE.semaines]) : '—' },
            { label: 'Semaine critique', valeur: c && c.critique !== null ? `S${c.semaines[c.critique]}` : 'aucune' },
          ]}
        >
          Les entrées probables sont les devis signés et les factures pas encore échues.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
