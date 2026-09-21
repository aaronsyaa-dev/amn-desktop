import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useHaloSignal } from '../EtatEcran';
import { SILENCE_JOURS } from '../SupervisionBand';
import { useParcInsights } from '../../state/parcInsights';
import { computeTrend } from '../../lib/trend';
import { relativeTime } from '../../lib/time';
import { useLangue } from '../../i18n';
import type { ParcOrgInsight } from '../../shared/api';

/**
 * VUE D'ENSEMBLE — l'axe du silence.
 *
 * Les espaces clients sont posés sur UN SEUL AXE : la date de dernière
 * écriture de chacun, de « en ce moment » à « plus de trente jours ». Une
 * liste triée donnerait le même ORDRE ; l'axe donne les DISTANCES — trois
 * espaces collés à gauche, un vide de dix jours, puis la traîne.
 *
 * Les espaces qui n'ont JAMAIS rien produit n'ont pas de date : les poser sur
 * l'axe serait un mensonge, ils vont dans une case à part, hors axe.
 *
 * L'AMBRE, unique : l'organisation la plus silencieuse — celle-là seule, son
 * point, sa tige et son étiquette. En lister trois ferait un rapport là où il
 * faut une chose à savoir.
 *
 * CE QUE MESURE CET AXE, ET RIEN D'AUTRE. Le produit ne connaît pas de
 * « prochaine casse » ni de cycle de vie à quatre états : `ParcOrgInsight`
 * tient dans `{ status, connections, lastActivityAt, records7d, previous7d }`.
 * La seule grandeur continue disponible est `maintenant − lastActivityAt`, et
 * c'est celle de l'axe. Le seuil est celui de la bande de supervision, importé
 * d'elle : deux constantes voisines finiraient par annoncer deux chiffres
 * différents de la même chose.
 */

/** La règle va de zéro à trente jours. Toute abscisse en découle. */
const AXE_JOURS = 30;
const AXE_H = 206;
/** Une étiquette au-dessus de la ligne, la suivante en dessous : neuf noms sur une seule rangée se recouvriraient. */
const TIGE_HAUTE = 44;
const TIGE_BASSE = 38;
const JOUR_MS = 86_400_000;

const joursDeSilence = (iso: string, now: number) => Math.max(0, (now - Date.parse(iso)) / JOUR_MS);
/** L'abscisse d'un silence : linéaire, bornée à la largeur de la règle. */
const pct = (jours: number) => (Math.min(jours, AXE_JOURS) / AXE_JOURS) * 100;

export function AxeDuSilence({ sitesMuets }: { sitesMuets: number }) {
  const { t, langue } = useLangue();
  const { data, loading, stale } = useParcInsights();
  const now = Date.now();

  const lecture = useMemo(() => {
    if (!data) return null;
    const avecDate = data.orgs.filter((o): o is ParcOrgInsight & { lastActivityAt: string } => o.lastActivityAt !== null);
    const jamais = data.orgs.filter((o) => o.lastActivityAt === null);
    /* Du plus récent au plus ancien : l'ordre de lecture de l'axe, de gauche à droite. */
    const surAxe = [...avecDate].sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt));
    const laPlusSilencieuse = surAxe.at(-1) ?? null;
    /* L'ambre ne s'allume que passé le seuil : la plus silencieuse d'un parc entièrement actif n'a rien à signaler. */
    const ambre = laPlusSilencieuse && joursDeSilence(laPlusSilencieuse.lastActivityAt, now) >= SILENCE_JOURS ? laPlusSilencieuse : null;
    return { surAxe, jamais, ambre };
  }, [data, now]);

  const halo = useHaloSignal(Boolean(lecture?.ambre));
  const fenetre = data?.windowDays ?? 7;
  const tendance = data ? computeTrend(data.totals.records7d, data.totals.previous7d) : null;

  if (loading && !data) return <p className="font-mono text-xs text-text-muted">{t('tour.silence.sansReleve')}</p>;
  if (!data || !lecture) return null;

  const { surAxe, jamais, ambre } = lecture;
  /* Les deux fenêtres se lisent l'une contre l'autre : une seule échelle, sinon la comparaison ne veut rien dire. */
  const maxFenetre = Math.max(1, data.totals.records7d, data.totals.previous7d);

  return (
    <div className="flex flex-col gap-[18px]">
      {/* ═══ L'OBJET DOMINANT : l'axe ═══ */}
      <article className="border border-border-raised bg-elevated px-6 py-[34px] sm:px-8" data-axe-silence={surAxe.length}>
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('tour.silence.titre')}</h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{t('tour.silence.seuilLegende', { n: SILENCE_JOURS })}</span>
        </div>
        {stale && <p className="mb-4 font-mono text-[11px] text-text-muted">{t('tour.silence.perime')}</p>}

        <div className="flex flex-col items-stretch gap-4 lg:flex-row">
          <div className="min-w-0 flex-1">
            <div className="relative" style={{ height: AXE_H }}>
              <span className="absolute inset-x-0 top-1/2 h-px bg-border-strong" aria-hidden />
              {/* Le repère de seuil, à son abscisse réelle. */}
              <span className="absolute w-px bg-[#2a1d0a]" style={{ left: `${pct(SILENCE_JOURS)}%`, top: `calc(50% - ${TIGE_HAUTE / 2}px)`, height: TIGE_HAUTE }} aria-hidden />
              <span className="absolute -translate-x-1/2 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.1em] text-text-muted" style={{ left: `${pct(SILENCE_JOURS)}%`, top: `calc(50% + 26px)` }}>
                {t('tour.silence.seuilRepere', { n: SILENCE_JOURS })}
              </span>

              {surAxe.map((o, i) => {
                const jours = joursDeSilence(o.lastActivityAt, now);
                const dessus = i % 2 === 0;
                const estAmbre = ambre?.id === o.id;
                const groupe = estAmbre ? 'la-plus-silencieuse' : undefined;
                return (
                  <span
                    key={o.id}
                    data-signal-groupe={groupe}
                    data-org={o.id}
                    className={`absolute flex -translate-x-1/2 items-center ${dessus ? 'top-0 flex-col' : 'bottom-0 flex-col-reverse'}`}
                    style={{ left: `${pct(jours)}%` }}
                  >
                    <span
                      data-signal-groupe={groupe}
                      className={`whitespace-nowrap ${estAmbre ? `bg-signal px-2.5 py-[7px] text-signal-ink ${halo}` : 'border border-border-sheet bg-surface-hover px-[9px] py-[5px]'}`}
                    >
                      <span data-signal-groupe={groupe} className={`block font-semibold ${estAmbre ? 'text-[13px]' : 'text-[11.5px] text-text-body'}`}>{o.name}</span>
                      <span data-signal-groupe={groupe} className={`mt-0.5 block font-mono text-[9px] uppercase tracking-[0.06em] ${estAmbre ? 'opacity-80' : 'text-text-muted'}`}>
                        {jours >= AXE_JOURS ? t('tour.silence.plusDe', { n: AXE_JOURS }) : relativeTime(o.lastActivityAt)}
                      </span>
                    </span>
                    <span data-signal-groupe={groupe} className={`w-px ${estAmbre ? 'bg-signal' : 'bg-border-strong'}`} style={{ height: dessus ? TIGE_HAUTE : TIGE_BASSE }} aria-hidden />
                    <span
                      data-signal-groupe={groupe}
                      aria-hidden
                      className={`rounded-full ${estAmbre ? 'bg-signal' : 'bg-[#4a4a48]'}`}
                      style={{ width: estAmbre ? 11 : 8, height: estAmbre ? 11 : 8, marginBottom: dessus ? -5 : undefined, marginTop: dessus ? undefined : -5, boxShadow: estAmbre ? '0 0 22px -2px var(--color-signal-glow)' : undefined }}
                    />
                  </span>
                );
              })}
            </div>
            {/* La rangée de graduations partage l'échelle de l'axe : chaque repère à son abscisse, jamais réparti à intervalles égaux. */}
            <div className="relative mt-1.5 h-3.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-text-muted">
              <span className="absolute left-0">{t('tour.silence.enCeMoment')}</span>
              <span className="absolute -translate-x-1/2" style={{ left: `${pct(7)}%` }}>{t('tour.silence.jours', { n: 7 })}</span>
              <span className="absolute -translate-x-1/2" style={{ left: `${pct(SILENCE_JOURS)}%` }}>{t('tour.silence.jours', { n: SILENCE_JOURS })}</span>
              <span className="absolute right-0">{t('tour.silence.jours', { n: AXE_JOURS })}</span>
            </div>
          </div>

          {/* HORS AXE — ceux qui n'ont pas de date. Une case à part, jamais un point à zéro. */}
          {jamais.length > 0 && (
            <div className="flex w-full flex-none flex-col border border-dashed border-[#2e2e2e] bg-sunken px-4 py-[15px] lg:w-[214px]">
              <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-text-muted">{t('tour.silence.horsAxe')}</span>
              <span className="mt-2 font-mono text-[34px] font-bold leading-[0.9] tabular-nums tracking-[-0.04em] text-text-body">{jamais.length}</span>
              <span className="mt-1.5 text-[12px] leading-snug text-text-secondary">{t(jamais.length === 1 ? 'tour.silence.jamaisProduitUn' : 'tour.silence.jamaisProduit')}</span>
              <span className="mt-auto flex flex-col gap-[5px] border-t border-border pt-3.5">
                {jamais.slice(0, 4).map((o) => <span key={o.id} className="text-[12.5px] text-text-body">{o.name}</span>)}
              </span>
            </div>
          )}
        </div>

        <div className="mt-[22px] flex flex-wrap items-center gap-5 border-t border-border-raised pt-5">
          <p className="min-w-[16rem] flex-1 text-[13.5px] leading-relaxed text-text-secondary [text-wrap:pretty]">
            {ambre
              ? <>
                  {t('tour.silence.laPlusSilencieuse', { org: ambre.name, duree: relativeTime(ambre.lastActivityAt).replace(/^il y a /, '') })}
                  {ambre.status === 'suspended' && <> {t('tour.silence.suspendue')}</>}
                </>
              : t('tour.silence.aucunSilence', { n: SILENCE_JOURS })}
          </p>
          {ambre && (
            <Link to={`/tour/organisations?org=${encodeURIComponent(ambre.id)}`} className="flex h-[30px] flex-none items-center border border-border-strong px-3.5 text-[12.5px] font-semibold text-text-body hover:bg-surface-hover">
              {t('tour.silence.ouvrirDossier')}
            </Link>
          )}
        </div>
      </article>

      <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 border border-border bg-surface px-[22px] py-5" aria-label={t('tour.silence.produit')}>
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('tour.silence.produit')}</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{t('tour.silence.produitLegende', { n: fenetre })}</span>
          </div>
          {/*
            UN GRAND ZÉRO NE SE POSE PAS. « 0 écritures » en quarante pixels se
            lit comme un reproche ; la phrase dit la même chose sans accuser, et
            c'est la règle du module — quand il n'y a rien de vrai à dire, on
            n'affiche rien plutôt qu'un zéro qu'on apprend à ne plus lire.
          */}
          <div className="flex flex-wrap items-end gap-[18px]">
            {data.totals.records7d > 0 ? (
              <>
                <span className="font-mono text-[40px] font-bold leading-[0.9] tabular-nums tracking-[-0.045em] text-text-primary">
                  {data.totals.records7d.toLocaleString(langue === 'fr' ? 'fr-FR' : 'en-GB')}
                </span>
                <span className="pb-[5px]">
                  <span className="block text-[13.5px] leading-snug text-text-secondary">{t('tour.silence.ecrituresChez')}</span>
                  {tendance && <span className="mt-[3px] block font-mono text-[12.5px] font-semibold text-text-body">{tendance.sentence}</span>}
                </span>
              </>
            ) : (
              <p className="max-w-[34ch] text-[13.5px] leading-relaxed text-text-secondary [text-wrap:pretty]">
                {t('tour.silence.rienEcrit', { n: fenetre })}
                {' '}
                {data.totals.previous7d > 0
                  ? t('tour.silence.plusRien', { n: fenetre, avant: data.totals.previous7d })
                  : t('tour.silence.rienNonPlusAvant', { n: fenetre })}
              </p>
            )}
            {/*
              DEUX BARRES, PAS SEPT. `ParcInsights` rend deux TOTAUX —
              `records7d` et `previous7d` — et aucune série quotidienne : sept
              barres seraient sept jours inventés. Les deux fenêtres se lisent
              donc l'une contre l'autre, sur la même échelle.
            */}
            <span className={`ml-auto flex items-end gap-2.5 ${data.totals.records7d + data.totals.previous7d === 0 ? 'hidden' : ''}`} style={{ height: 61 }} role="img" aria-label={tendance?.sentence ?? ''}>
              {([['precedente', data.totals.previous7d, '#3a3a3a'], ['courante', data.totals.records7d, 'var(--color-text-body)']] as const).map(([cle, valeur, encre]) => (
                <span key={cle} className="flex flex-col items-center gap-1.5">
                  <span style={{ width: 22, height: Math.max(2, (valeur / maxFenetre) * 56), background: encre }} />
                  <span className="font-mono text-[8.5px] uppercase tracking-[0.06em] text-text-muted">{t(cle === 'precedente' ? 'tour.silence.fenetrePrecedente' : 'tour.silence.fenetreCourante')}</span>
                </span>
              ))}
            </span>
          </div>
          <p className="mt-4 border-t border-border pt-3.5 text-[13px] leading-relaxed text-text-secondary [text-wrap:pretty]">{t('tour.silence.releveDuServeur', { n: fenetre })}</p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted [text-wrap:pretty]">{t('tour.silence.deuxBarres')}</p>
        </section>

        <section className="flex flex-col border border-border bg-surface px-5 py-5" aria-label={t('tour.silence.enCeMoment')}>
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('tour.silence.enCeMoment')}</h2>
          <div className="mt-[18px] flex flex-col gap-4">
            {([
              [t('tour.silence.espacesOuverts'), data.totals.connectedOrgs],
              [t('tour.silence.sitesMuets'), sitesMuets],
              [t('tour.silence.silencieuses', { n: SILENCE_JOURS }), surAxe.filter((o) => joursDeSilence(o.lastActivityAt, now) >= SILENCE_JOURS).length],
            ] as const).map(([label, valeur]) => (
              <span key={label}>
                <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">{label}</span>
                <span className="mt-1.5 block font-mono text-[19px] font-semibold tabular-nums tracking-tight text-text-primary">{valeur}</span>
              </span>
            ))}
          </div>
          <p className="mt-auto pt-[18px] text-[13px] leading-relaxed text-text-secondary [text-wrap:pretty]">{t('tour.silence.rienDeVrai')}</p>
        </section>
      </div>
    </div>
  );
}
