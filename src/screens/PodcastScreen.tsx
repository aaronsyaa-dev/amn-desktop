import React, { useMemo } from 'react';
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
  type EnregistrementPodcast,
  type EpisodePodcast,
  ONDE,
  type ReglagePodcast,
  economiePodcast,
  onde,
  pctSeconde,
} from '../lib/cinquante/marketing';
import type { Id } from '../lib/cinquante/guichet';
import { useLangue } from '../i18n';

/**
 * PODCAST — l'onde et ses coupes (`35d`).
 *
 * La forme d'onde ENTIÈRE de l'épisode : 240 barres sur 120 px, centrées sur
 * l'axe, chacune l'amplitude moyenne de sa tranche (durée / 240), normalisée
 * sur l'épisode. Les titres de chapitre au-dessus de leur coupe ; sous l'onde,
 * un cran par hésitation à sa seconde exacte. La coupe suggérée est une bande
 * hachurée ambre avec sa plaque. Toutes les positions sont des secondes
 * rapportées à la durée totale.
 *
 * « Une coupe suggérée ne supprime rien : elle se valide, puis le montage se
 * refait. » Le bouton VALIDE (date de validation écrite) — il ne coupe pas.
 */

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const dureeLongue = (s: number) => {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m === 0 ? `${r} s` : r === 0 ? `${m} min` : `${m} min ${String(r).padStart(2, '0')}`;
};
const dureeCourte = (s: number) => {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m === 0 ? `de ${r} s` : `${m === 1 ? 'd’1' : `de ${m}`} min ${String(r).padStart(2, '0')}`;
};

export function PodcastScreen() {
  const { t, langue } = useLangue();
  const { upsert } = useSync();
  const tout = useCollection<EnregistrementPodcast>('podcastEpisodes');
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const episodes = useMemo(
    () => tout.filter((e): e is Id<EpisodePodcast> & { updatedAt: string } => e.kind === 'episode').sort((a, b) => b.numero - a.numero),
    [tout],
  );
  const reglage = tout.find((e): e is Id<ReglagePodcast> & { updatedAt: string } => e.kind === 'podcast') ?? null;
  /* L'épisode sur la table : le plus récent qui n'est pas encore publié, sinon le dernier. */
  const ep = episodes.find((e) => !e.publieLe) ?? episodes[0] ?? null;
  const publies = episodes.filter((e) => e.publieLe);
  const vide = episodes.length === 0;
  const barres = useMemo(() => (ep ? onde(ep) : []), [ep]);
  const eco = ep ? economiePodcast(ep) : null;
  const coupeActive = ep?.coupe && !ep.coupesValideesLe ? ep.coupe : null;

  const valider = async () => {
    if (!ep) return;
    await upsert('podcastEpisodes', ep.id, { ...donnees(ep), coupesValideesLe: new Date().toISOString() });
  };

  const description = !ep
    ? t('m50.podcast.descriptionVide')
    : coupeActive
      ? t('m50.podcast.description', { coupe: L(coupeActive.finS - coupeActive.debutS) })
      : t('m50.podcast.descriptionSansCoupe');

  const graduations = ep ? [6, 12, 18, 24, 30, 36, 42, 48, 54].map((m) => m * 60).filter((s) => s < ep.dureeS - 60) : [];

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.marketing'), module: t('m50.podcast.titre') })}
          title={t('m50.podcast.titre')}
          description={description}
          phraseVide={t('m50.podcast.phraseVide')}
        />
      </Bloc>

      <Dominante
        surtitre={ep ? `L’épisode ${ep.numero} · « ${ep.titre} »` : 'L’épisode'}
        note={ep ? 'Chapitres au-dessus · hésitations en crans dessous' : undefined}
      >
        {!ep ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Chaque épisode tiendra ici sur une seule ligne : l’onde entière, ses chapitres au-dessus, un cran sous chaque
            hésitation. Une digression se repérera avant même d’être écoutée.
          </p>
        ) : (
          <>
            <div className="relative h-[18px] max-sm:hidden">
              {ep.chapitres.map((c) => (
                <span
                  key={c.debutS}
                  className="absolute top-0 whitespace-nowrap font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-text-secondary"
                  style={{ left: `${pctSeconde(c.debutS, ep.dureeS)}%` }}
                >
                  {c.titre}
                </span>
              ))}
            </div>
            <div className="relative mt-1.5 h-[30px]">
              {coupeActive && (
                <span
                  data-signal-groupe="coupe"
                  className="absolute top-0 flex h-[26px] items-center gap-2 whitespace-nowrap bg-signal px-2.5 shadow-[0_0_28px_-7px_var(--color-signal-glow)] [--plaque:5rem] sm:[--plaque:10rem]"
                  style={{ left: `min(${pctSeconde(coupeActive.debutS, ep.dureeS)}%, calc(100% - var(--plaque)))` }}
                >
                  <span className="tnum font-mono text-[13px] font-bold text-signal-ink">− {coupeActive.finS - coupeActive.debutS} s</span>
                  <span className={`font-mono text-[9px] font-bold uppercase tracking-[0.12em] max-sm:hidden ${ENCRE_SURTITRE_PLAQUE}`}>
                    {coupeActive.motif}
                  </span>
                </span>
              )}
            </div>
            <div className="relative mt-1.5 flex items-center gap-px border border-border-raised bg-sunken px-px" style={{ height: ONDE.hauteur }}>
              {barres.map((h, i) => (
                <span key={i} className="flex-1 bg-[#4a4a48]" style={{ height: `${Math.max(2, h).toFixed(0)}%` }} />
              ))}
              {ep.chapitres.slice(1).map((c) => (
                <span key={c.debutS} className="absolute -bottom-1.5 -top-1.5 w-px bg-text-muted" style={{ left: `${pctSeconde(c.debutS, ep.dureeS)}%` }} />
              ))}
              {coupeActive && (
                <span
                  data-signal-groupe="coupe"
                  className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,rgba(208,154,74,.55)_0_2px,rgba(208,154,74,.12)_2px_6px)] shadow-[inset_0_0_14px_-3px_rgba(208,154,74,.85)]"
                  style={{
                    left: `${pctSeconde(coupeActive.debutS, ep.dureeS)}%`,
                    width: `${pctSeconde(coupeActive.finS, ep.dureeS) - pctSeconde(coupeActive.debutS, ep.dureeS)}%`,
                  }}
                />
              )}
            </div>
            <div className="relative mt-2 h-4">
              {ep.hesitations.map((h) => (
                <span key={h.s} className="absolute top-0 h-2.5 w-0.5 bg-text-muted" style={{ left: `${pctSeconde(h.s, ep.dureeS)}%` }} title={`${mmss(h.s)} · ${h.genre}`} />
              ))}
            </div>
            <div className="relative mt-0.5 h-[13px] font-mono text-[9.5px] tracking-[0.08em] text-text-muted">
              <span className="absolute left-0">0:00</span>
              {graduations.map((s) => (
                <span key={s} className="absolute -translate-x-1/2 max-sm:hidden" style={{ left: `${pctSeconde(s, ep.dureeS)}%` }}>
                  {mmss(s)}
                </span>
              ))}
              <span className="absolute right-0">{mmss(ep.dureeS)}</span>
            </div>
            {/* Sur un téléphone, les chapitres passent sous l'onde, dans l'ordre. */}
            <p className="mt-2 font-mono text-[10px] uppercase leading-[1.6] tracking-[0.08em] text-text-muted sm:hidden">
              {ep.chapitres.map((c) => `${mmss(c.debutS)} ${c.titre}`).join(' · ')}
            </p>

            <PiedDominante
              action={coupeActive ? <BoutonSecondaire onClick={() => void valider()}>Appliquer les coupes</BoutonSecondaire> : undefined}
            >
              {coupeActive && eco
                ? `Retirer la ${coupeActive.motif.toLowerCase()} et les ${ep.hesitations.length} hésitations raccourcit l’épisode ${dureeCourte(eco.totalS)}, sans toucher au propos.`
                : ep.coupesValideesLe
                  ? `Les coupes sont validées : le montage de l’épisode ${ep.numero} se refait sans elles.`
                  : `${L(ep.hesitations.length, true)} hésitations relevées, aucune digression à couper.`}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Les épisodes" note={publies.length ? 'Durée · écoutes' : undefined}>
          {publies.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun épisode publié pour l’instant.</p>
          ) : (
            publies.map((e, i) => (
              <LigneRegistre key={e.id} colonnes="minmax(0,1fr) 72px 88px" derniere={i === publies.length - 1}>
                <span className="min-w-0 text-[13.5px] leading-snug text-text-primary">{e.numero} · {e.titre}</span>
                <span className="tnum font-mono text-[11.5px] text-text-secondary">{dureeLongue(e.dureeS)}</span>
                <span className="tnum text-right font-mono text-[11.5px] text-text-secondary">
                  {i === 0 ? `${e.ecoutes ?? 0} écoutes` : e.ecoutes ?? 0}
                </span>
              </LigneRegistre>
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Le podcast"
          releves={[
            { label: 'Abonnés', valeur: reglage?.abonnes ?? '—' },
            { label: 'Écoute moyenne', valeur: reglage ? `${Math.round(reglage.ecouteMoyenneS / 60)} min` : '—' },
            { label: 'Jusqu’au bout', valeur: reglage ? `${reglage.jusquAuBoutPct} %` : '—' },
          ]}
        >
          {(() => {
            const courts = publies.filter((e) => e.dureeS < 22 * 60);
            const longs = publies.filter((e) => e.dureeS >= 22 * 60);
            if (!courts.length || !longs.length) return 'Chaque épisode publié compte ses écoutes ici.';
            const moy = (xs: typeof publies) => xs.reduce((s, e) => s + (e.ecoutes ?? 0), 0) / xs.length;
            return moy(courts) >= moy(longs)
              ? 'Les épisodes de moins de 22 minutes sont les plus écoutés.'
              : 'Les épisodes de plus de 22 minutes sont les plus écoutés.';
          })()}
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
