import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  Bloc,
  BoutonSecondaire,
  Calmes,
  CarteCalme,
  CarteReleves,
  Dominante,
  ENCRE_SURTITRE_PLAQUE,
  Ecran50,
  LigneRegistre,
  PiedDominante,
  donnees,
} from '../components/cinquante-kit';
import { useCollection, useSync } from '../state/SyncContext';
import { enLettres } from '../lib/cinquante/lettres';
import {
  ECHELLE_BOBINE_S,
  FORMATS_VIDEO,
  type MontageVideo,
  PELLICULE,
  bobine,
  coupeSuggeree,
  dureeMontage,
  statsVideos,
} from '../lib/cinquante/marketing';
import { useLangue } from '../i18n';

/**
 * MONTAGE VIDÉO — la bobine (`35a`).
 *
 * Une pellicule perforée de 96 px (deux bandes de 14 px), un plan par
 * segment, largeur = durée sur une échelle FIXE de 45 s pour tous les
 * montages. Sous elle, la règle des formats porte ses crans (Story 15 s,
 * Reel 30 s). La zone ambre commence exactement au cran du format visé et
 * s'arrête exactement à la fin du film ; les plans restent gris.
 *
 * « Appliquer les coupes » réécrit réellement la durée des plans : le film
 * tient alors dans son format, à la seconde près, et l'ambre disparaît.
 */

const ETAT: Record<MontageVideo['etat'], string> = { 'a-monter': 'à monter', 'en-cours': 'en cours', publie: 'publié' };
const etatLigne = (m: MontageVideo) =>
  m.etat === 'en-cours' ? (dureeMontage(m) > FORMATS_VIDEO[m.format].maxS ? 'à couper' : 'prêt') : ETAT[m.etat];
const cite = (s: string) => `« ${s} »`;
const liste = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} et ${xs[xs.length - 1]}`);

export function MontageVideoScreen() {
  const { t, langue } = useLangue();
  const { upsert } = useSync();
  const montages = useCollection<MontageVideo>('videoEdits');
  const [maintenant] = useState(() => new Date());
  const [choisi, setChoisi] = useState<string | null>(null);
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const tries = useMemo(() => [...montages].sort((a, b) => b.creeLe.localeCompare(a.creeLe)), [montages]);
  const courant =
    tries.find((m) => m.id === choisi) ??
    tries.find((m) => m.etat === 'en-cours' && m.plans.length > 0) ??
    tries.find((m) => m.plans.length > 0) ??
    null;
  const vide = montages.length === 0;
  const b = courant ? bobine(courant) : null;
  const coupe = courant && courant.etat !== 'publie' ? coupeSuggeree(courant) : null;
  const stats = useMemo(() => statsVideos(montages, maintenant), [montages, maintenant]);
  const format = courant ? FORMATS_VIDEO[courant.format] : null;

  const appliquer = async () => {
    if (!courant || !coupe) return;
    const plans = courant.plans.map((p, i) => {
      const c = coupe.find((x) => x.index === i);
      return c ? { ...p, dureeS: c.versS } : p;
    });
    await upsert('videoEdits', courant.id, { ...donnees(courant), plans });
  };

  const description = !courant || !b || !format
    ? t('m50.video.descriptionVide')
    : b.depasseS > 0
      ? t('m50.video.description', { plans: L(courant.plans.length, true), duree: L(b.totalS), format: format.nom, max: L(format.maxS) })
      : t('m50.video.descriptionTient', { plans: L(courant.plans.length, true), duree: L(b.totalS), format: format.nom, max: L(format.maxS) });

  const gardes = courant?.plans.filter((p) => p.garde).map((p) => cite(p.nom)) ?? [];
  const phraseCoupe = courant && coupe && format
    ? `Ramener ${liste(coupe.map((c) => `${cite(courant.plans[c.index].nom)} à ${c.versS} s`))} fait tenir le film en ${format.maxS} s pile${
        gardes.length ? `, sans toucher ${gardes.length > 1 ? 'aux plans' : 'au plan'} ${liste(gardes)}` : ''
      }.`
    : null;

  return (
    <Ecran50 vide={vide} premierJour={vide}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.marketing'), module: t('m50.video.titre') })}
          title={t('m50.video.titre')}
          description={description}
          phraseVide={t('m50.video.phraseVide')}
        />
      </Bloc>

      <Dominante
        surtitre={`La pellicule · échelle ${ECHELLE_BOBINE_S} s`}
        note={b ? 'Un plan = un segment · largeur = durée' : undefined}
      >
        {!courant || !b || !format ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Chaque montage sera posé ici sur la même pellicule de quarante-cinq secondes, un plan par segment, contre les
            crans des formats visés : on verra d’un coup s’il tient dans sa Story ou son Reel.
          </p>
        ) : (
          <>
            {/* La plaque, au-dessus de la zone qui dépasse. */}
            <div className="relative h-[30px]">
              {b.zone && (
                <span
                  data-signal-groupe="au-dela"
                  className="absolute top-0 flex h-[26px] items-center gap-2 whitespace-nowrap bg-signal px-2.5 shadow-[0_0_28px_-7px_var(--color-signal-glow)] [--plaque:5rem] sm:[--plaque:12.5rem]"
                  style={{ left: `min(${b.zone.gauchePct}%, calc(100% - var(--plaque)))` }}
                >
                  <span className="tnum font-mono text-[13px] font-bold text-signal-ink">+ {b.depasseS} s</span>
                  <span className={`font-mono text-[9px] font-bold uppercase tracking-[0.12em] max-sm:hidden ${ENCRE_SURTITRE_PLAQUE}`}>
                    au-delà du {format.nom}
                  </span>
                </span>
              )}
            </div>

            <div className="relative mt-1.5 border border-border-raised bg-sunken" style={{ height: PELLICULE.hauteur }}>
              <span className="absolute inset-x-0 top-[3px] h-2 bg-[repeating-linear-gradient(90deg,#1c1c1c_0_7px,transparent_7px_13px)]" aria-hidden />
              <span className="absolute inset-x-0 bottom-[3px] h-2 bg-[repeating-linear-gradient(90deg,#1c1c1c_0_7px,transparent_7px_13px)]" aria-hidden />
              {b.plans.map((p, i) => (
                <span
                  key={`${p.nom}-${i}`}
                  className={`absolute flex flex-col justify-end overflow-hidden border-r-2 border-[#0a0a0a] px-[7px] py-1.5 ${i % 2 ? 'bg-[#2b2b2b]' : 'bg-[#333]'}`}
                  style={{ top: PELLICULE.perforations, bottom: PELLICULE.perforations, left: `${p.gauchePct}%`, width: `${p.largeurPct}%` }}
                  title={`${p.nom} · ${p.dureeS} s`}
                >
                  <span className="truncate text-[11.5px] font-semibold text-text-body max-sm:hidden">{p.nom}</span>
                  <span className="tnum font-mono text-[9.5px] font-medium text-text-muted max-sm:hidden">{p.dureeS} s</span>
                </span>
              ))}
              {b.zone && (
                <span
                  data-signal-groupe="au-dela"
                  className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,rgba(208,154,74,.5)_0_3px,rgba(208,154,74,.1)_3px_9px)] shadow-[inset_0_0_18px_-4px_rgba(208,154,74,.8)]"
                  style={{ left: `${b.zone.gauchePct}%`, width: `${b.zone.largeurPct}%` }}
                />
              )}
            </div>
            {/* Sur un téléphone, un plan de 4 s fait 26 px : les noms passent dessous, en clair. */}
            <p className="mt-2 font-mono text-[10px] leading-[1.6] text-text-muted sm:hidden">
              {courant.plans.map((p) => `${p.nom} ${p.dureeS} s`).join(' · ')}
            </p>

            {/* La règle des formats. */}
            <div className="relative mt-1 h-10">
              {Object.values(FORMATS_VIDEO).map((f) => {
                const gauche = (f.maxS / ECHELLE_BOBINE_S) * 100;
                return (
                  <React.Fragment key={f.nom}>
                    <span className="absolute top-0 h-3.5 w-0.5 -translate-x-1/2 bg-text-muted" style={{ left: `${gauche}%` }} />
                    <span
                      className="absolute top-[18px] -translate-x-1/2 whitespace-nowrap font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] text-text-secondary"
                      style={{ left: `${gauche}%` }}
                    >
                      {f.nom} · {f.maxS} s
                    </span>
                  </React.Fragment>
                );
              })}
              <span className="absolute left-0 top-[18px] font-mono text-[9.5px] text-text-muted max-sm:hidden">0 s</span>
              <span className="absolute right-0 top-[18px] font-mono text-[9.5px] text-text-muted">{ECHELLE_BOBINE_S} s</span>
            </div>

            <PiedDominante
              action={
                coupe ? (
                  <BoutonSecondaire onClick={() => void appliquer()}>
                    {coupe.length === 1 ? 'Appliquer la coupe' : `Appliquer les ${L(coupe.length)} coupes`}
                  </BoutonSecondaire>
                ) : undefined
              }
            >
              {b.depasseS === 0
                ? `Le film dure ${b.totalS} s : il tient dans son ${format.nom} de ${format.maxS} s, sans rien couper.`
                : phraseCoupe ??
                  `Le film dépasse de ${b.depasseS} s, et aucune coupe ne le ramène à ${format.maxS} s sans toucher aux plans gardés.`}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Les montages" note={vide ? undefined : 'Durée · format visé'}>
          {tries.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun montage pour l’instant.</p>
          ) : (
            tries.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setChoisi(m.id)}
                className={`block w-full text-left ${m.id === courant?.id ? 'bg-surface-hover/40' : ''}`}
              >
                <LigneRegistre colonnes="minmax(0,1fr) 56px 64px 76px" derniere={i === tries.length - 1}>
                  <span className="min-w-0 text-[13.5px] leading-snug text-text-primary">{m.titre}</span>
                  <span className="tnum font-mono text-[11.5px] text-text-secondary">{m.plans.length ? `${dureeMontage(m)} s` : '—'}</span>
                  <span className="font-mono text-[11.5px] text-text-secondary">{FORMATS_VIDEO[m.format].nom}</span>
                  <span className="text-right font-mono text-[11.5px] text-text-secondary">{etatLigne(m)}</span>
                </LigneRegistre>
              </button>
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Cette année"
          releves={[
            { label: 'Vidéos publiées', valeur: stats.publiees },
            { label: 'Durée moyenne', valeur: stats.publiees ? `${stats.dureeMoyenneS} s` : '—' },
            { label: 'Vues médianes', valeur: stats.publiees ? stats.vuesMedianes.toLocaleString('fr-FR') : '—' },
          ]}
        >
          Au-delà de 30 s, les Reels perdent la moitié de leurs vues avant la fin.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
