import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { EcranVide, useHaloSignal } from '../components/EtatEcran';
import { usePersonalStore } from '../state/usePersonalStore';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface Entree {
  day: string;
  text: string;
  mood: number;
  updatedAt: string;
}
const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const HUMEURS = [1, 2, 3, 4, 5];

/*
  ══════════════════════════════════════════════════════════════════════
  LA MARÉE — et la règle qui tient tout le module
  ══════════════════════════════════════════════════════════════════════

  C'EST LE SEUL INSTRUMENT DU PRODUIT DONT LA LECTURE N'APPELLE AUCUNE
  DÉCISION. Pas de conseil, pas de corrélation, pas de tendance annoncée, pas
  de moyenne mise en avant comme une note. On regarde une forme : des creux,
  des reprises, une ligne d'eau. C'est tout ce qu'on en fait.

  Cette règle a une conséquence de code, et c'est pourquoi elle est écrite
  ici : chaque fois qu'on voudra ajouter un chiffre à cet écran — « votre
  humeur moyenne : 3,4 » — il faudra relire cette ligne. Un journal intime qui
  vous note est un journal qu'on cesse de tenir.

  `MAREE_H` est la hauteur de la bande. La surface est tracée en `<svg>` avec
  un `viewBox` en PIXELS et `preserveAspectRatio="none"` : une unité de vue
  vaut donc un pixel en hauteur, et l'ordonnée de la ligne d'eau se calcule
  avec la même expression que celle des points. Sans cela, le pointillé de la
  moyenne flotterait à côté de la courbe qu'il est censé couper.
*/
const MAREE_H = 170;
const MAREE_JOURS = 30;
const MAREE_MARGE = 14;
/** Le trait d'un jour écrit, sous la courbe. */
const TRAIT_H = 12;

/**
 * LE JOURNAL PERSO — quelques lignes par jour, pour soi.
 *
 * Pour qui : une personne qui veut garder trace de ses journées sans que ça
 * regarde l'équipe. Le Journal de bord est celui de l'organisation ; celui-ci
 * ne quitte pas ce poste.
 *
 * ## Ce qui domine : une marée, pas une note
 *
 * L'écran affichait « humeur moyenne : 3,4 » en relevé d'en-tête, à côté
 * d'une « série » de jours écrits d'affilée. Les deux étaient des notes
 * déguisées, et la série était pire : elle transformait un journal intime en
 * devoir. Les deux sont retirées.
 *
 * Reste la forme du mois : une surface qui monte et descend autour de sa
 * ligne d'eau. On y voit un creux et une reprise sans qu'aucun chiffre le
 * dise — et surtout sans qu'on ait à en conclure quoi que ce soit.
 *
 * ## L'ambre : le point du jour
 *
 * Le point d'aujourd'hui sur la courbe et son étiquette. Deux nœuds. Il ne
 * demande rien non plus : il dit « vous êtes ici ».
 */
export function DiaryScreen() {
  const { t, langue } = useLangue();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const [entrees, setEntrees, pret] = usePersonalStore<Entree[]>('journal', []);
  const aujourdhui = isoJour(new Date());
  const duJour = entrees.find((e) => e.day === aujourdhui) ?? null;
  const [texte, setTexte] = useState<string | null>(null);
  const [gardee, setGardee] = useState(false);
  const valeur = texte ?? duJour?.text ?? '';
  const passees = useMemo(() => entrees.filter((e) => e.day !== aujourdhui).sort((a, b) => b.day.localeCompare(a.day)), [entrees, aujourdhui]);

  /*
    LA MARÉE. Un point par jour du mois glissant ; les jours sans humeur notée
    n'interrompent pas la surface — on relie le dernier point connu, parce
    qu'une humeur ne disparaît pas les jours où on n'ouvre pas l'écran. Les
    jours ÉCRITS, eux, sont marqués séparément, sous la courbe.
  */
  const maree = useMemo(() => {
    const debut = new Date();
    const jours = Array.from({ length: MAREE_JOURS }, (_, i) => {
      const d = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() - (MAREE_JOURS - 1 - i));
      return isoJour(d);
    });
    const notes = jours.map((j) => entrees.find((e) => e.day === j && e.mood > 0)?.mood ?? null);
    const connues = notes.filter((n): n is number => n !== null);
    if (connues.length === 0) return null;
    const ligneDEau = connues.reduce((s, n) => s + n, 0) / connues.length;
    /* Le report du dernier point connu — jamais une invention : c'est la
       dernière humeur DITE, tenue jusqu'à la suivante. */
    let dernier = connues[0];
    const suite = notes.map((n) => {
      if (n !== null) dernier = n;
      return dernier;
    });
    const y = (note: number) => MAREE_MARGE + (1 - (note - 1) / 4) * (MAREE_H - MAREE_MARGE * 2);
    const x = (i: number) => (i / (MAREE_JOURS - 1)) * 100;
    return {
      jours,
      notes,
      points: suite.map((n, i) => ({ x: x(i), y: y(n), note: n, jour: jours[i], dite: notes[i] !== null })),
      ligneDEau,
      yLigneDEau: y(ligneDEau),
      creux: jours[suite.indexOf(Math.min(...suite))],
      ecrits: jours.filter((j) => (entrees.find((e) => e.day === j)?.text ?? '').trim().length > 0),
    };
  }, [entrees]);

  const pointDuJour = maree?.points[maree.points.length - 1] ?? null;
  const halo = useHaloSignal(Boolean(pointDuJour));

  /* Le creux du mois a-t-il une entrée écrite ? C'est le seul constat de
     l'écran, et il ne conseille rien. */
  const creuxSansTexte = useMemo(() => {
    if (!maree) return null;
    const entree = entrees.find((e) => e.day === maree.creux);
    return (entree?.text ?? '').trim().length === 0 ? maree.creux : null;
  }, [maree, entrees]);

  const garder = (mood?: number) => {
    const text = valeur.trim();
    const humeur = mood ?? duJour?.mood ?? 0;
    if (!text && !humeur) return;
    setEntrees((liste) => [...liste.filter((e) => e.day !== aujourdhui), { day: aujourdhui, text, mood: humeur, updatedAt: new Date().toISOString() }]);
    setGardee(true);
    window.setTimeout(() => setGardee(false), 2000);
  };
  const retirer = (day: string) => setEntrees((liste) => liste.filter((e) => e.day !== day));
  const dateLongue = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const dateCourte = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  const vide = pret && entrees.length === 0;

  return (
    <EcranVide quand={Boolean(vide)} premierJour={Boolean(vide)}>
      <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
        <motion.div variants={staggerItem}>
          <ScreenHeader
            eyebrow={t('perso.surtitre', { module: t('journalPerso.titre') })}
            title={t('journalPerso.titre')}
            description={t('journalPerso.description')}
            phraseVide={t('journalPerso.vide.phrase')}
            stats={[
              { label: t('journalPerso.stat.joursEcrits'), value: maree?.ecrits.length ?? 0 },
              { label: t('journalPerso.stat.mois'), value: entrees.filter((e) => e.day >= (maree?.jours[0] ?? '')).length },
            ]}
          />
        </motion.div>

        {vide ? (
          <motion.div variants={staggerItem}>
            <FirstRun title={t('journalPerso.vide.titre')}>{t('journalPerso.vide.texte')}</FirstRun>
          </motion.div>
        ) : (
          maree && (
            /* ═══ L'OBJET DOMINANT : la marée du mois ═══ */
            <motion.section variants={staggerItem} className={`panel-raised p-5 sm:p-6 ${halo}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="eyebrow">{t('journalPerso.laMaree')}</p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  {dateCourte(maree.jours[0])} → {dateCourte(maree.jours[maree.jours.length - 1])}
                </p>
              </div>

              <div className="relative mt-4 w-full" style={{ height: MAREE_H }}>
                <svg
                  viewBox={`0 0 100 ${MAREE_H}`}
                  preserveAspectRatio="none"
                  /* PAS de halo ici : `drop-shadow` sur un <svg> nimbe CHAQUE
                     tracé qu'il contient — la surface entière de la marée
                     s'allumait en ambre, et l'écran comptait alors une région
                     ambre grande comme la bande. Le halo reste sur le panneau,
                     l'ambre reste le point du jour. */
                  className="h-full w-full"
                  aria-label={t('journalPerso.mareeAria')}
                  role="img"
                >
                  {/* LA SURFACE — remplie, parce qu'une marée est une masse d'eau. */}
                  <path
                    d={`M0 ${MAREE_H} ${maree.points.map((p) => `L${p.x} ${p.y}`).join(' ')} L100 ${MAREE_H} Z`}
                    /* La masse d'eau doit se DÉTACHER du panneau. Le panneau
                       dominant est `--color-elevated` : remplir la marée de la
                       même valeur la rendait invisible, et il ne restait
                       qu'une ligne — l'objet dominant cessait d'être une
                       surface. `--color-surface-hover` est le premier cran
                       au-dessus. */
                    fill="var(--color-surface-hover)"
                    stroke="none"
                  />
                  <polyline
                    points={maree.points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="var(--color-border-strong)"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* LA LIGNE D'EAU — la moyenne du mois, en pointillé. Son
                      ordonnée est calculée par la MÊME fonction que les points. */}
                  <line
                    x1={0}
                    y1={maree.yLigneDEau}
                    x2={100}
                    y2={maree.yLigneDEau}
                    stroke="var(--color-border)"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>

                {/* LE POINT DU JOUR — l'ambre, posé en HTML pour rester rond
                    malgré l'étirement du viewBox. */}
                {pointDuJour && (
                  <span
                    data-signal-groupe="aujourdhui"
                    className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal"
                    style={{ left: `${pointDuJour.x}%`, top: pointDuJour.y }}
                    aria-hidden
                  />
                )}
              </div>

              {pointDuJour && (
                <p
                  data-signal-groupe="aujourdhui"
                  className="mt-1 inline-flex bg-signal px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-signal-ink"
                >
                  {t('journalPerso.aujourdhui')}
                </p>
              )}

              {/* LES JOURS ÉCRITS — une rangée de traits sous la courbe. */}
              <div className="mt-4 flex w-full items-end gap-px" style={{ height: TRAIT_H }} aria-hidden>
                {maree.jours.map((j) => (
                  <span
                    key={j}
                    className="min-w-0 flex-1"
                    style={{
                      height: maree.ecrits.includes(j) ? TRAIT_H : 2,
                      backgroundColor: maree.ecrits.includes(j) ? 'var(--color-text-body)' : 'var(--color-border)',
                    }}
                  />
                ))}
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                {t('journalPerso.ecritsSur', { n: maree.ecrits.length, total: MAREE_JOURS })}
              </p>

              {/* SOUS LA COURBE — le constat, et rien de plus. */}
              {creuxSansTexte && (
                <p className="mt-4 max-w-prose border-t border-border-strong pt-3 text-sm leading-relaxed text-text-body">
                  {t('journalPerso.creuxSansTexte', { jour: dateLongue(creuxSansTexte) })}
                </p>
              )}
            </motion.section>
          )
        )}

        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); garder(); }} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <p className="eyebrow">{dateLongue(aujourdhui)}</p>
          <textarea value={valeur} onChange={(e) => setTexte(e.target.value)} rows={5} placeholder={t('journalPerso.champ')} aria-label={t('journalPerso.champ')} className="input-focus border border-border bg-bg px-3 py-2 text-sm leading-relaxed text-text-primary outline-none" />
          <div className="flex flex-wrap items-center gap-3">
            <div role="radiogroup" aria-label={t('journalPerso.humeur')} className="flex gap-1">
              {HUMEURS.map((h) => (
                <button key={h} type="button" role="radio" aria-checked={duJour?.mood === h} aria-label={t('journalPerso.humeurNote', { n: h })} onClick={() => garder(h)} className={`min-h-11 min-w-11 border font-mono text-sm tabular-nums ${duJour?.mood === h ? 'border-border-strong bg-surface-hover text-text-primary' : 'border-border text-text-muted hover:text-text-primary'}`}>{h}</button>
              ))}
            </div>
            <button type="submit" disabled={!valeur.trim()} className="ml-auto flex min-h-11 items-center gap-2 bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-40 md:min-h-0 md:py-2">{gardee ? <Check size={14} /> : null} {gardee ? t('journalPerso.gardee') : t('journalPerso.garder')}</button>
          </div>
        </motion.form>

        {!vide && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* À GAUCHE — les trois dernières entrées, en texte intégral. */}
            <motion.section variants={staggerItem} className="flex flex-col gap-3">
              <p className="eyebrow">{t('journalPerso.precedentes')}</p>
              {passees.slice(0, 3).map((e) => (
                <article key={e.day} className="group panel p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-text-primary">
                      {dateLongue(e.day)}
                      {e.mood > 0 ? <span className="ml-2 font-mono text-[10px] uppercase tracking-wider tabular-nums text-text-muted">{t('journalPerso.humeurNote', { n: e.mood })}</span> : null}
                    </p>
                    <button type="button" onClick={() => retirer(e.day)} aria-label={t('journalPerso.supprimer')} title={t('journalPerso.supprimer')} className="px-1 text-text-muted opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"><Trash2 size={13} /></button>
                  </div>
                  {e.text && <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{e.text}</p>}
                </article>
              ))}
              {passees.length === 0 && <p className="panel px-4 py-5 text-sm text-text-muted">{t('journalPerso.aucunePrecedente')}</p>}
            </motion.section>

            {/* À DROITE — rien ne sort d'ici. */}
            <motion.aside variants={staggerItem} className="panel p-4">
              <p className="eyebrow mb-3">{t('journalPerso.rienNeSort')}</p>
              <ul className="flex flex-col gap-2">
                {[t('journalPerso.stockageLocal'), t('journalPerso.aucunExport'), t('journalPerso.aucunRapport')].map((phrase) => (
                  <li key={phrase} className="flex items-baseline gap-2 text-sm leading-relaxed text-text-secondary">
                    <span aria-hidden className="text-text-muted">—</span>
                    <span>{phrase}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-text-muted">{t('perso.local')}</p>
            </motion.aside>
          </div>
        )}
      </motion.section>
    </EcranVide>
  );
}
