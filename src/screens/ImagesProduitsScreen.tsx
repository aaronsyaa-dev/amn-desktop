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
import { useCollection, useSync } from '../state/SyncContext';
import { enLettres } from '../lib/cinquante/lettres';
import {
  type EnregistrementImages,
  type ProduitReference,
  type SceneProduit,
  TOURNETTE,
  type ZoneFixe,
  alteration,
  positionScene,
} from '../lib/cinquante/marketing';
import type { Id } from '../lib/cinquante/guichet';
import { useLangue } from '../i18n';

/**
 * IMAGES PRODUITS — la tournette (`35f`).
 *
 * La photo de référence au centre, huit mises en scène autour d'elle à 45°
 * d'intervalle, chacune reliée au centre par un rayon. Positions :
 * `50 % + 38 % · cos θ` en largeur, `200 + 148 · sin θ` en hauteur, dans un
 * conteneur de 400 px — et les rayons dans un `viewBox` 1000 × 400 de même
 * proportion. Le verdict « altérée » vient de la comparaison des zones fixes
 * (étiquette, forme, bouchon), jamais d'un jugement de qualité.
 */

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const ZONE_NOM: Record<ZoneFixe, string> = { etiquette: 'étiquette', forme: 'forme', bouchon: 'bouchon' };
const ZONE_PHRASE: Record<ZoneFixe, string> = {
  etiquette: 'l’étiquette a été réécrite',
  forme: 'la forme du produit a changé',
  bouchon: 'le bouchon a changé',
};
type Scene = Id<SceneProduit> & { updatedAt: string };

function verdict(s: Scene, alt: ReturnType<typeof alteration>) {
  if (s.verdict === 'ecartee') return 'écartée';
  if (alt) return s.regenerationDemandeeLe ? 'régénération demandée' : `${ZONE_NOM[alt.zone]} altérée`;
  if (s.verdict === 'a-revoir') return `à revoir${s.motif ? ` · ${s.motif}` : ''}`;
  if (s.verdict === 'a-trier') return 'à trier';
  return 'gardée';
}

export function ImagesProduitsScreen() {
  const { t, langue } = useLangue();
  const { upsert } = useSync();
  const tout = useCollection<EnregistrementImages>('productShots');
  const [maintenant] = useState(() => new Date());
  const [choisi, setChoisi] = useState<string | null>(null);
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const produits = useMemo(
    () => tout.filter((e): e is Id<ProduitReference> & { updatedAt: string } => e.kind === 'produit').sort((a, b) => a.ordre - b.ordre),
    [tout],
  );
  const scenes = useMemo(() => tout.filter((e): e is Scene => e.kind === 'scene'), [tout]);
  const alterationDe = (s: Scene) => {
    const p = produits.find((x) => x.id === s.produitId);
    return p ? alteration(p, s) : null;
  };
  /* L'ambre : la scène qui a altéré le produit, tant qu'elle n'est ni écartée ni en régénération. */
  const estAmbre = (s: Scene) => s.verdict !== 'ecartee' && !s.regenerationDemandeeLe && alterationDe(s) !== null;
  const produit =
    produits.find((p) => p.id === choisi) ??
    produits.find((p) => scenes.some((s) => s.produitId === p.id && estAmbre(s))) ??
    produits[0] ??
    null;
  const siennes = produit ? scenes.filter((s) => s.produitId === produit.id).sort((a, b) => a.numero - b.numero).slice(0, 8) : [];
  const ambre = siennes.find(estAmbre) ?? null;
  const altAmbre = ambre ? alterationDe(ambre) : null;
  const vide = produits.length === 0;

  const duMois = (iso?: string) => !!iso && new Date(iso).getMonth() === maintenant.getMonth() && new Date(iso).getFullYear() === maintenant.getFullYear();
  const genereesMois = scenes.filter((s) => duMois(s.genereeLe));
  const altereesMois = genereesMois.filter((s) => alterationDe(s) !== null);
  const zonesAlterees = new Set(altereesMois.map((s) => alterationDe(s)?.zone));

  const regenerer = async () => {
    if (!ambre) return;
    await upsert('productShots', ambre.id, { ...donnees(ambre), regenerationDemandeeLe: new Date().toISOString() });
  };

  const description = !produit
    ? t('m50.productShots.descriptionVide')
    : ambre && altAmbre
      ? t(`m50.productShots.description.${altAmbre.zone}` as const, { n: L(siennes.length), avant: altAmbre.avant, apres: altAmbre.apres })
      : t('m50.productShots.descriptionFidele', { n: L(siennes.length) });

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.marketing'), module: t('m50.productShots.titre') })}
          title={t('m50.productShots.titre')}
          description={description}
          phraseVide={t('m50.productShots.phraseVide')}
        />
      </Bloc>

      <Dominante
        surtitre={produit ? `La tournette · une photo, ${L(siennes.length)} décors` : 'La tournette'}
        note={produit ? 'Le produit reste fixe, seul le décor change' : undefined}
      >
        {!produit ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            La photo de référence d’un produit sera posée au centre, ses mises en scène autour d’elle. Une image qui
            modifie le produit lui-même — l’étiquette, la forme, le bouchon — ne pourra pas être publiée.
          </p>
        ) : (
          <>
            {/* La couronne, dès la tablette. */}
            <div className="relative max-sm:hidden" style={{ height: TOURNETTE.hauteur }}>
              <svg viewBox="0 0 1000 400" preserveAspectRatio="none" className="absolute inset-0 h-[400px] w-full" aria-hidden>
                {siennes.map((s, i) => {
                  const p = positionScene(i, siennes.length);
                  const a = s.id === ambre?.id;
                  return (
                    <line
                      key={s.id}
                      data-signal-groupe={a ? 'alteree' : undefined}
                      x1={500}
                      y1={200}
                      x2={p.xVb.toFixed(1)}
                      y2={p.y.toFixed(1)}
                      stroke={a ? 'var(--color-signal)' : '#2b2b2b'}
                      strokeWidth={a ? 2.4 : 1.4}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </svg>
              <div className="absolute left-1/2 top-[200px] flex h-[150px] w-[150px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 border-[#4a4a48] bg-[#1c1c1c] text-center">
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-text-muted">Photo de référence</span>
                <span className="mt-1.5 px-3 text-[13.5px] font-semibold text-text-primary">{produit.nom}</span>
              </div>
              {siennes.map((s, i) => {
                const p = positionScene(i, siennes.length);
                const a = s.id === ambre?.id;
                const alt = alterationDe(s);
                return (
                  <div
                    key={s.id}
                    data-signal-groupe={a ? 'alteree' : undefined}
                    className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col bg-border-row px-[7px] py-1.5 ${
                      a ? 'border-2 border-signal shadow-[0_0_28px_-7px_var(--color-signal-glow)]' : 'border border-[#2b2b2b]'
                    }`}
                    style={{ left: `${p.xPct}%`, top: p.y, width: TOURNETTE.vignetteL, height: TOURNETTE.vignetteH }}
                  >
                    <span className="flex flex-1 items-center justify-center bg-border font-mono text-[8px] uppercase tracking-[0.1em] text-[#4a4a48]">
                      Scène {s.numero}
                    </span>
                    <span className="mt-[5px] truncate text-[11.5px] font-semibold text-text-primary">{s.decor}</span>
                    <span className={`truncate font-mono text-[9px] uppercase tracking-[0.03em] ${a ? 'font-bold text-signal' : 'text-text-muted'}`}>
                      {verdict(s, alt)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Sur un téléphone, la couronne devient une liste : la référence d'abord, puis les scènes. */}
            <div className="sm:hidden">
              <p className="text-[13.5px] font-semibold text-text-primary">
                <span className="mr-2 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-text-muted">Référence</span>
                {produit.nom}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {siennes.map((s) => {
                  const a = s.id === ambre?.id;
                  return (
                    <div
                      key={s.id}
                      data-signal-groupe={a ? 'alteree' : undefined}
                      className={`bg-border-row px-2.5 py-2 ${a ? 'border-2 border-signal' : 'border border-[#2b2b2b]'}`}
                    >
                      <span className="block font-mono text-[8px] uppercase tracking-[0.1em] text-text-muted">Scène {s.numero}</span>
                      <span className="mt-1 block text-[12px] font-semibold text-text-primary">{s.decor}</span>
                      <span className={`block font-mono text-[9px] uppercase tracking-[0.06em] ${a ? 'font-bold text-signal' : 'text-text-muted'}`}>
                        {verdict(s, alterationDe(s))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <PiedDominante
              action={ambre ? <BoutonSecondaire onClick={() => void regenerer()}>Régénérer cette scène</BoutonSecondaire> : undefined}
            >
              {ambre && altAmbre
                ? `Sur la scène « ${ambre.decor} », ${ZONE_PHRASE[altAmbre.zone]} : « ${altAmbre.avant} » est devenu « ${altAmbre.apres} ». Une image qui change le produit n’est pas publiable, même si elle est belle.`
                : siennes.some((s) => s.regenerationDemandeeLe)
                  ? 'La régénération est demandée : la nouvelle scène sera comparée à la photo de référence avant d’être gardée.'
                  : 'Aucune mise en scène ne touche au produit : l’étiquette, la forme et le bouchon sont ceux de la photo de référence.'}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Le catalogue" note={produits.length ? 'Scènes gardées' : undefined}>
          {produits.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun produit photographié.</p>
          ) : (
            produits.map((p, i) => {
              const sc = scenes.filter((s) => s.produitId === p.id);
              const gardees = sc.filter((s) => s.verdict === 'gardee' && !alterationDe(s)).length;
              return (
                <button key={p.id} type="button" onClick={() => setChoisi(p.id)} className={`block w-full text-left ${p.id === produit?.id ? 'bg-surface-hover/40' : ''}`}>
                  <LigneRegistre colonnes="minmax(0,1fr) 64px" derniere={i === produits.length - 1}>
                    <span className="min-w-0 text-[13.5px] text-text-primary">{p.nom}</span>
                    <span className="tnum text-right font-mono text-[11.5px] text-text-secondary">
                      {gardees} / {sc.length}
                    </span>
                  </LigneRegistre>
                </button>
              );
            })
          )}
        </CarteCalme>
        <CarteReleves
          surtitre={MOIS[maintenant.getMonth()].replace(/^./, (c) => c.toUpperCase())}
          releves={[
            { label: 'Images générées', valeur: genereesMois.length },
            { label: 'Publiées', valeur: scenes.filter((s) => duMois(s.publieeLe)).length },
            { label: 'Altérées', valeur: altereesMois.length },
          ]}
        >
          {altereesMois.length === 0
            ? 'Aucune image générée ce mois-ci n’a touché au produit.'
            : zonesAlterees.size === 1
              ? `${altereesMois.length === 1 ? 'L’image altérée du mois touchait' : `Les ${L(altereesMois.length)} images altérées du mois touchaient ${altereesMois.length === 2 ? 'toutes deux' : 'toutes'}`} ${
                  [...zonesAlterees][0] === 'etiquette' ? 'l’étiquette' : [...zonesAlterees][0] === 'forme' ? 'la forme' : 'le bouchon'
                }.`
              : `Les ${L(altereesMois.length)} images altérées du mois touchaient plusieurs zones fixes.`}
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
