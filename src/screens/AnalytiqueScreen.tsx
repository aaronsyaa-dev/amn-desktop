import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Bloc, Calmes, CarteCalme, CarteReleves, Dominante, Ecran50, LigneRegistre, PiedDominante } from '../components/cinquante-kit';
import { SaisieModule, depuisCents, versCents, versIso, versJour, versLignes, versNombre } from '../components/SaisieModule';
import { uid, useCollection, useSync } from '../state/SyncContext';
import { formatCentsCompact } from '../lib/money';
import { enLettres } from '../lib/cinquante/lettres';
import { PENTE, type ProjetClos, etiquettes, trimestreDe, yMarge } from '../lib/cinquante/finance';
import { useLangue } from '../i18n';

/**
 * ANALYTIQUE — la pente (`36d`).
 *
 * À gauche la marge prévue au devis, à droite la marge réelle du projet clos,
 * un trait par projet. Les deux axes ont EXACTEMENT la même échelle
 * (−10 % → 50 %) : `y = 300 − (marge + 10) × 5` dans un `viewBox` de 320, et
 * les étiquettes posées au même pourcentage. Deux étiquettes d'un même côté
 * à moins de 14 px : la seconde se décale, et un filet la relie à son trait.
 *
 * L'ambre : le trait qui plonge le plus, ses deux étiquettes et son nom.
 */

const H = PENTE.viewBoxH;

export function AnalytiqueScreen() {
  const { t, langue } = useLangue();
  const tous = useCollection<ProjetClos>('projectMargins');
  const { upsert, remove } = useSync();
  const [maintenant] = useState(() => new Date());
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const trim = trimestreDe(maintenant);
  const projets = useMemo(
    () => tous.filter((p) => new Date(p.closLe) >= trim.debut && new Date(p.closLe) < trim.fin).sort((a, b) => b.margePrevue - a.margePrevue),
    [tous, trim.debut, trim.fin],
  );
  const vide = projets.length === 0;
  /*
    SAISIE — un projet clos : la marge prévue au devis, la marge réelle, et
    si on veut, poste par poste ce qui était prévu et ce qui a été dépensé
    (« Main-d’œuvre : 384 → 864 »). Seuls les projets clos ce trimestre
    s'affichent sur la pente.
  */
  const lirePostes = (texte: string) =>
    versLignes(texte)
      .map((l) => {
        const m = l.match(/^(.+?)\s*:\s*(\d+(?:[.,]\d+)?)\s*€?\s*(?:→|->|>)\s*(\d+(?:[.,]\d+)?)\s*€?\s*$/);
        return m ? { poste: m[1].trim(), prevuCents: versCents(m[2]) ?? 0, reelCents: versCents(m[3]) ?? 0 } : null;
      })
      .filter((x): x is { poste: string; prevuCents: number; reelCents: number } => x !== null);
  const enregistrer = async (v: Record<string, string>, id?: string) => {
    await upsert('projectMargins', id ?? uid(), {
      kind: 'projet',
      nom: v.nom.trim(),
      closLe: versIso(v.clos),
      margePrevue: versNombre(v.prevue) ?? 0,
      margeReelle: versNombre(v.reelle) ?? 0,
      postes: lirePostes(v.postes),
      ...(v.cause.trim() ? { cause: v.cause.trim() } : {}),
    });
  };
  const plongeon = [...projets].sort((a, b) => a.margeReelle - a.margePrevue - (b.margeReelle - b.margePrevue))[0] ?? null;
  const ambre = plongeon && plongeon.margeReelle < plongeon.margePrevue ? plongeon : null;
  const aPlat = projets.filter((p) => Math.abs(p.margeReelle - p.margePrevue) <= 6).length;
  const gauche = etiquettes(projets.map((p) => ({ id: p.id, y: yMarge(p.margePrevue) })));
  const droite = etiquettes(projets.map((p) => ({ id: p.id, y: yMarge(p.margeReelle) })));
  const moy = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);
  const prevue = moy(projets.map((p) => p.margePrevue));
  const reelle = moy(projets.map((p) => p.margeReelle));

  const description = vide
    ? t('m50.analytics.descriptionVide')
    : ambre
      ? t('m50.analytics.description', { plat: L(aPlat, true) })
      : t('m50.analytics.descriptionSansPlongeon');

  const couleur = (p: ProjetClos) => (p.margeReelle >= p.margePrevue ? '#4a4a48' : 'var(--color-text-muted)');

  return (
    <Ecran50 vide={vide} premierJour={tous.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.finance'), module: t('m50.analytics.titre') })}
          title={t('m50.analytics.titre')}
          description={description}
          phraseVide={t('m50.analytics.phraseVide')}
        />
      </Bloc>

      <SaisieModule
        ajouter="Clore un projet"
        ouvertParDefaut={tous.length === 0}
        surtitreListe="Les projets clos"
        champs={[
          { cle: 'nom', intitule: 'Projet', type: 'texte', requis: true },
          { cle: 'clos', intitule: 'Clos le', type: 'date', requis: true, defaut: versJour(maintenant.toISOString()) },
          { cle: 'prevue', intitule: 'Marge prévue', type: 'pourcent', requis: true, aide: 'Celle du devis.' },
          { cle: 'reelle', intitule: 'Marge réelle', type: 'pourcent', requis: true, aide: 'Celle constatée une fois tout payé.' },
          { cle: 'postes', intitule: 'Poste par poste', type: 'lignes', aide: 'Facultatif, un par ligne, prévu → réel : « Main-d’œuvre : 384 → 864 ».' },
          { cle: 'cause', intitule: 'Ce qui a fait l’écart', type: 'texte', large: true },
        ]}
        enregistrer={enregistrer}
        elements={[...tous]
          .sort((a, b) => b.closLe.localeCompare(a.closLe))
          .slice(0, 80)
          .map((p) => ({
            id: p.id,
            libelle: p.nom,
            detail: `clos le ${versJour(p.closLe)} · ${p.margePrevue} % prévus, ${p.margeReelle} % réels`,
            valeurs: {
              nom: p.nom,
              clos: versJour(p.closLe),
              prevue: String(p.margePrevue).replace('.', ','),
              reelle: String(p.margeReelle).replace('.', ','),
              postes: p.postes.map((x) => `${x.poste} : ${depuisCents(x.prevuCents)} → ${depuisCents(x.reelCents)}`).join('\n'),
              cause: p.cause ?? '',
            },
          }))}
        supprimer={(id) => remove('projectMargins', id)}
      />

      <Dominante surtitre="De la marge prévue à la marge réelle" note={vide ? undefined : 'Même échelle à gauche et à droite · −10 % → 50 %'}>
        {vide ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Chaque projet clos ce trimestre tracera ici un trait, de la marge prévue au devis à la marge réellement faite :
            à plat, le devis était juste ; qui plonge, il a coûté de l’argent.
          </p>
        ) : (
          <>
            <div className="relative" style={{ height: H }}>
              <svg viewBox={`0 0 1000 ${H}`} preserveAspectRatio="none" className="absolute inset-0 w-full" style={{ height: H }} aria-hidden>
                <line x1={PENTE.xGauche} y1={0} x2={PENTE.xGauche} y2={300} stroke="#2b2b2b" vectorEffect="non-scaling-stroke" />
                <line x1={PENTE.xDroite} y1={0} x2={PENTE.xDroite} y2={300} stroke="#2b2b2b" vectorEffect="non-scaling-stroke" />
                <line x1={PENTE.xGauche} y1={yMarge(0)} x2={PENTE.xDroite} y2={yMarge(0)} stroke="var(--color-border-raised)" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
                {projets.map((p) => (
                  <React.Fragment key={p.id}>
                    {/* Les filets des étiquettes décalées. */}
                    {gauche.get(p.id)?.decale && (
                      <line x1={PENTE.xGauche} y1={yMarge(p.margePrevue)} x2={PENTE.xGauche - 14} y2={gauche.get(p.id)?.y} stroke="#2b2b2b" vectorEffect="non-scaling-stroke" />
                    )}
                    {droite.get(p.id)?.decale && (
                      <line x1={PENTE.xDroite} y1={yMarge(p.margeReelle)} x2={PENTE.xDroite + 14} y2={droite.get(p.id)?.y} stroke="#2b2b2b" vectorEffect="non-scaling-stroke" />
                    )}
                  </React.Fragment>
                ))}
                {projets
                  .filter((p) => p.id !== ambre?.id)
                  .map((p) => (
                    <line key={p.id} x1={PENTE.xGauche} y1={yMarge(p.margePrevue)} x2={PENTE.xDroite} y2={yMarge(p.margeReelle)} stroke={couleur(p)} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
                  ))}
                {ambre && (
                  <line
                    data-signal-groupe="plongeon"
                    x1={PENTE.xGauche}
                    y1={yMarge(ambre.margePrevue)}
                    x2={PENTE.xDroite}
                    y2={yMarge(ambre.margeReelle)}
                    stroke="var(--color-signal)"
                    strokeWidth={3}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>
              {projets.map((p) => {
                const a = p.id === ambre?.id;
                const encre = a ? 'text-signal' : 'text-text-secondary';
                const chiffre = a ? 'font-bold text-signal' : 'font-semibold text-text-primary';
                return (
                  <React.Fragment key={p.id}>
                    <span
                      data-signal-groupe={a ? 'plongeon' : undefined}
                      className="absolute right-[78%] flex -translate-y-1/2 flex-row-reverse items-baseline gap-2 whitespace-nowrap px-2.5"
                      style={{ top: `${((gauche.get(p.id)?.y ?? 0) / H) * 100}%` }}
                    >
                      <span className={`tnum font-mono text-[13px] ${chiffre}`}>{p.margePrevue} %</span>
                      <span className={`text-[12px] max-md:hidden ${encre}`}>{p.nom}</span>
                    </span>
                    <span
                      data-signal-groupe={a ? 'plongeon' : undefined}
                      className="absolute left-[78%] flex -translate-y-1/2 items-baseline gap-2 whitespace-nowrap px-2.5"
                      style={{ top: `${((droite.get(p.id)?.y ?? 0) / H) * 100}%` }}
                    >
                      <span className={`tnum font-mono text-[13px] ${chiffre}`}>{p.margeReelle} %</span>
                      <span className={`text-[12px] max-md:hidden ${encre}`}>{p.nom}</span>
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
            <div className="relative mt-1 h-4 font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">
              <span className="absolute -translate-x-1/2" style={{ left: `${PENTE.xGauche / 10}%` }}>Au devis</span>
              <span className="absolute -translate-x-1/2" style={{ left: `${PENTE.xDroite / 10}%` }}>Réel</span>
            </div>

            <PiedDominante>
              {ambre
                ? `${ambre.nom} était prévu à ${ambre.margePrevue} % de marge au devis. Il finit à ${ambre.margeReelle} %${ambre.cause ? ` : ${ambre.cause}` : ''}.`
                : 'Aucun projet du trimestre ne finit sous la marge prévue.'}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre={ambre ? `${ambre.nom} · ce qui a mangé la marge` : 'Ce qui a mangé la marge'} note={ambre ? 'Prévu → réel' : undefined}>
          {!ambre ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun projet ne plonge ce trimestre.</p>
          ) : (
            ambre.postes.map((po, i) => (
              <LigneRegistre key={po.poste} colonnes="minmax(0,1fr) auto auto" derniere={i === ambre.postes.length - 1}>
                <span className="text-[13.5px] text-text-primary">{po.poste}</span>
                <span className="tnum font-mono text-[11.5px] text-text-muted">{po.detailPrevu ?? formatCentsCompact(po.prevuCents)}</span>
                <span className="tnum text-right font-mono text-[11.5px] text-text-body">{po.detailReel ?? formatCentsCompact(po.reelCents)}</span>
              </LigneRegistre>
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Le trimestre"
          releves={[
            { label: 'Marge prévue', valeur: `${prevue} %` },
            { label: 'Marge réelle', valeur: `${reelle} %` },
            { label: 'Écart moyen', valeur: `${reelle - prevue > 0 ? '+' : reelle - prevue < 0 ? '−' : ''} ${Math.abs(reelle - prevue)} pts` },
          ]}
        >
          {`${L(projets.length, true)} projet${projets.length > 1 ? 's' : ''} clos ce trimestre, dont ${L(projets.filter((p) => p.margeReelle < p.margePrevue).length)} sous la marge prévue.`}
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
