import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScreenHeader } from '../../components/ScreenHeader';
import { EtatPoint, dureeCourte } from '../../components/garde/GardeUi';
import { useHaloSignal } from '../../components/EtatEcran';
import { garde } from '../../lib/garde';
import { useLangue, type CleTraduction } from '../../i18n';
import type { GardeAgent, GardeCalendrierItem, GardeSalle } from '../../shared/garde';

/**
 * LE CALENDRIER — la portée.
 *
 * Les vingt gardes sont vingt lignes d'une portée, et chaque ronde est un cran
 * sur sa ligne. Comme les périodes vont d'une minute à vingt-quatre heures, la
 * page se lit comme une partition — lignes quasi continues en haut, notes
 * isolées en bas — et la DENSITÉ d'une ligne EST sa période, sans qu'aucun
 * chiffre soit nécessaire.
 *
 * L'AMBRE, unique : la barre de la Relève et son étiquette. Deux nœuds — le
 * seul moment de la journée où la Garde rend compte à un humain.
 *
 * TROIS EXIGENCES DE GÉOMÉTRIE, toutes apprises par un défaut réel.
 *
 * 1. Le repère qui traverse toutes les rangées se pose dans un CALQUE QUI
 *    RÉPÈTE LA GRILLE — mêmes `grid-template-columns`, même `gap`, cellules
 *    vides comprises — jamais avec un `calc()` écrit à la main. Une grille
 *    `150px 1fr 88px` avec `gap:14px` a DEUX gouttières : la piste vaut
 *    `100% − 266px`, pas `100% − 252px`, et la gouttière oubliée décale le
 *    repère d'environ 4 px — assez pour qu'il ne tombe plus sur l'heure qu'il
 *    annote.
 * 2. Une ronde quotidienne est une MARQUE POSITIONNÉE À SON HEURE RÉELLE,
 *    jamais un arrêt de `linear-gradient` à 0, qui la collerait au bord et
 *    affirmerait en silence qu'elle passe à minuit.
 * 3. Une piste censée porter des crans utilise `repeating-linear-gradient` —
 *    `linear-gradient` ne pose qu'une marque, au ras du bord, et la ligne se
 *    lirait vide.
 */

const PERIODES = [60_000, 5 * 60_000, 15 * 60_000, 3_600_000, 6 * 3_600_000, 24 * 3_600_000];
const CLE_PERIODE: Record<number, CleTraduction> = {
  60000: 'garde.calendrier.periodes.1min',
  300000: 'garde.calendrier.periodes.5min',
  900000: 'garde.calendrier.periodes.15min',
  3600000: 'garde.calendrier.periodes.1h',
  21600000: 'garde.calendrier.periodes.6h',
  86400000: 'garde.calendrier.periodes.24h',
};

const JOUR_MS = 86_400_000;
/** Au-delà, une garde ne trace plus une piste : elle pose une ou deux marques, à leur heure réelle. C'est le seuil que le serveur emploie déjà pour développer le calendrier (`capitaine.js`). */
const SEUIL_CRAN = 12 * 3_600_000;
/** La grille de la portée, répétée à l'identique par le calque de la Relève. DEUX gouttières. */
const GRILLE = '150px minmax(0,1fr) 88px';
const GOUTTIERE = 14;
const LIGNE_H = 16;

/** Une position sur la portée : une heure du jour en pourcentage de vingt-quatre heures. */
const pct = (ms: number) => (ms / JOUR_MS) * 100;
/** Minuit LOCAL — `Date.now() % 86 400 000` donne minuit UTC, et décalerait toute la portée du fuseau. */
const minuitLocal = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

export function GardeCalendrierScreen() {
  const { t, langue } = useLangue();
  const [items, setItems] = useState<GardeCalendrierItem[]>([]);
  const [salle, setSalle] = useState<GardeSalle | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([garde.calendrier(7), garde.salle()]);
      setItems(c);
      setSalle(s);
      setErreur(null);
    } catch (err) { setErreur(err instanceof Error ? err.message : String(err)); }
  }, []);
  useEffect(() => { void charger(); }, [charger]);

  const agents = useMemo(() => salle?.agents ?? [], [salle]);
  const nomEquipe = useMemo(() => new Map((salle?.equipes ?? []).map((e) => [e.key, e.nom])), [salle]);
  const heureTour = salle?.reglages.heureTour ?? 8;
  const halo = useHaloSignal(Boolean(salle));

  /* La partition : les lignes denses en haut, les notes isolées en bas. Le tri EST la lecture. */
  const portee = useMemo(() => [...agents].sort((a, b) => a.everyMs - b.everyMs || a.nom.localeCompare(b.nom, 'fr')), [agents]);

  /*
    LES MARQUES D'UNE GARDE LENTE. On part de sa prochaine ronde et on remonte
    de sa période jusqu'à sortir du jour, puis on redescend : les marques
    tombent aux heures où elle passe VRAIMENT, pas à zéro.
  */
  const marquesDuJour = (a: GardeAgent): number[] => {
    if (!a.actif || !a.prochaineRondeAt) return [];
    const debut = minuitLocal();
    const prochaine = Date.parse(a.prochaineRondeAt);
    if (!Number.isFinite(prochaine) || a.everyMs <= 0) return [];
    const marques: number[] = [];
    // On recale la première occurrence dans la journée, sans boucler sur l'infini.
    const decalage = ((prochaine - debut) % a.everyMs + a.everyMs) % a.everyMs;
    for (let t0 = decalage; t0 < JOUR_MS; t0 += a.everyMs) marques.push(t0);
    return marques;
  };

  const densite = (a: GardeAgent): string => {
    if (!a.actif) return t('garde.calendrier.enPauseLigne');
    if (a.everyMs >= SEUIL_CRAN) {
      const heures = marquesDuJour(a).map((ms) => new Date(minuitLocal() + ms).toLocaleTimeString(langue === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' }));
      return `${dureeCourte(a.everyMs, t)} · ${heures.join(' ') || '—'}`;
    }
    const mot = a.everyMs <= 5 * 60_000 ? 'garde.calendrier.quasiContinue' : a.everyMs <= 3_600_000 ? 'garde.calendrier.reguliere' : 'garde.calendrier.rare';
    return `${dureeCourte(a.everyMs, t)} · ${t(mot as CleTraduction)}`;
  };

  /* Les sept prochains jours, comptés par nature. Un item du Capitaine est une Relève ; un item sans période est une fin de grâce ; le reste est une ronde. */
  const jours = useMemo(() => {
    const m = new Map<string, { rondes: number; releves: number; graces: number }>();
    for (const i of items) {
      const j = new Date(i.at).toDateString();
      const c = m.get(j) ?? { rondes: 0, releves: 0, graces: 0 };
      if (i.agent === 'capitaine') c.releves += 1; else if (i.periode === null) c.graces += 1; else c.rondes += 1;
      m.set(j, c);
    }
    return [...m.entries()];
  }, [items]);
  const libelleJour = (d: string) => {
    const aujourdhui = new Date().toDateString();
    const demain = new Date(Date.now() + JOUR_MS).toDateString();
    return d === aujourdhui ? t('garde.calendrier.aujourdhui') : d === demain ? t('garde.calendrier.demain') : new Date(d).toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  };
  const regler = async (key: string, patch: Partial<Pick<GardeAgent, 'actif' | 'everyMs'>>) => { await garde.majAgent(key, patch); await charger(); };
  const heureReleve = `${String(heureTour).padStart(2, '0')}:00`;

  return (
    <section className="flex flex-col gap-5">
      <ScreenHeader eyebrow={t('garde.surtitre')} title={t('garde.calendrier.titre')} description={t('garde.calendrier.description')} />
      {erreur && <p role="alert" className="border border-warning/40 bg-warning-muted px-3 py-2 text-xs text-text-primary">{t('garde.erreur', { message: erreur })}</p>}

      {/* ═══ L'OBJET DOMINANT : la portée ═══ */}
      <article className="border border-border-raised bg-elevated px-6 py-[30px] sm:px-8">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.calendrier.portee')}</h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{t('garde.calendrier.porteeLegende')}</span>
        </div>

        {portee.length === 0 ? (
          <p className="text-[13.5px] leading-relaxed text-text-secondary">{t('garde.calendrier.videPortee')}</p>
        ) : (
          <>
            <div className="relative mt-8 overflow-x-auto">
              <div className="flex min-w-[560px] flex-col">
                {portee.map((a) => {
                  const cran = a.everyMs >= SEUIL_CRAN;
                  const pas = pct(a.everyMs);
                  return (
                    <div key={a.key} className="grid items-center py-1.5" style={{ gridTemplateColumns: GRILLE, gap: GOUTTIERE }} data-garde={a.key} data-periode={a.everyMs}>
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] text-text-body">{a.nom}</span>
                        <span className="block truncate font-mono text-[9px] uppercase tracking-[0.1em] text-text-muted">{nomEquipe.get(a.equipe) ?? a.equipe}</span>
                      </span>
                      {/* La piste. Les crans d'une garde rapide sont une RÉPÉTITION — `repeating-linear-gradient`, jamais `linear-gradient`, qui ne poserait qu'une marque au ras du bord. */}
                      <span
                        className="relative block border-y border-[#1a1a1a] bg-sunken"
                        style={{
                          height: LIGNE_H,
                          backgroundImage: !a.actif || cran ? undefined : `repeating-linear-gradient(90deg, #4a4a48 0 1px, transparent 1px ${pas.toFixed(4)}%)`,
                        }}
                      >
                        {/* Une ronde quotidienne est une marque posée à son heure réelle. */}
                        {a.actif && cran && marquesDuJour(a).map((ms) => (
                          <span key={ms} className="absolute inset-y-0 w-px bg-[#4a4a48]" style={{ left: `${pct(ms).toFixed(2)}%` }} />
                        ))}
                      </span>
                      <span className="text-right font-mono text-[10px] tabular-nums text-text-muted">{densite(a)}</span>
                    </div>
                  );
                })}
              </div>

              {/* LE CALQUE DE LA RELÈVE : la même grille, les mêmes gouttières, cellules vides comprises. */}
              <div className="pointer-events-none absolute inset-0 grid min-w-[560px]" style={{ gridTemplateColumns: GRILLE, gap: GOUTTIERE }} data-signal-groupe="releve">
                <span />
                <span className="relative" data-signal-groupe="releve">
                  <span data-signal-groupe="releve" className={`absolute -top-1.5 -bottom-1.5 w-0.5 bg-signal ${halo}`} style={{ left: `${pct(heureTour * 3_600_000).toFixed(2)}%` }} />
                  <span data-signal-groupe="releve" className="signal-plate absolute -translate-x-1/2 whitespace-nowrap px-[9px] py-1 font-mono text-[10px] font-bold uppercase tracking-[0.06em]" style={{ left: `${pct(heureTour * 3_600_000).toFixed(2)}%`, top: -30 }}>
                    {t('garde.calendrier.releveEtiquette', { heure: heureReleve })}
                  </span>
                </span>
                <span />
              </div>
            </div>

            {/* La rangée de graduations partage la grille de ce qu'elle gradue — sinon « 12 » ne tomberait pas sur midi. */}
            <div className="mt-3.5 grid min-w-[560px]" style={{ gridTemplateColumns: GRILLE, gap: GOUTTIERE }}>
              <span />
              <span className="relative block h-3.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-text-muted">
                {[0, 6, 12, 18, 24].map((h) => (
                  <span key={h} className="absolute tabular-nums" style={{ left: `${pct(h * 3_600_000)}%`, transform: h === 0 ? 'none' : h === 24 ? 'translateX(-100%)' : 'translateX(-50%)' }}>
                    {String(h).padStart(2, '0')}
                  </span>
                ))}
              </span>
              <span />
            </div>

            <div className="mt-[22px] flex flex-wrap items-center gap-5 border-t border-border-raised pt-5">
              <p className="min-w-[16rem] flex-1 text-[13.5px] leading-relaxed text-text-secondary [text-wrap:pretty]">{t('garde.calendrier.piedPhrase')}</p>
              <Link to="/garde/commune" className="flex h-[30px] flex-none items-center border border-border-strong px-3.5 text-[12.5px] font-semibold text-text-body hover:bg-surface-hover">{t('garde.calendrier.lireReleve')}</Link>
            </div>
          </>
        )}
      </article>

      <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 border border-border bg-surface px-[22px] py-5" aria-label={t('garde.calendrier.septJours')}>
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.calendrier.septJours')}</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{t('garde.calendrier.septLegende')}</span>
          </div>
          <ul>
            {jours.map(([jour, c]) => (
              <li key={jour} className="grid grid-cols-[150px_minmax(0,1fr)] items-baseline gap-4 border-b border-border-row py-[11px] last:border-b-0">
                <span className="text-[13px] font-semibold text-text-primary">{libelleJour(jour)}</span>
                {/* Un compte à zéro ne s'écrit pas : une journée sans fin de grâce n'a pas à annoncer « 0 fin de grâce ». */}
                <span className="font-mono text-[12px] tabular-nums text-text-secondary">
                  {[c.rondes > 0 ? t('garde.calendrier.nRondes', { n: c.rondes }) : null, c.releves > 0 ? t('garde.calendrier.nReleves', { n: c.releves }) : null, c.graces > 0 ? t('garde.calendrier.nGraces', { n: c.graces }) : null].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3.5 text-[13px] leading-relaxed text-text-secondary [text-wrap:pretty]">{t('garde.calendrier.dejaDecide')}</p>
        </section>

        <section className="flex flex-col border border-border bg-surface px-5 py-5" aria-label={t('garde.calendrier.reglerUneGarde')}>
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.calendrier.reglerUneGarde')}</h2>
          <div className="mt-4 flex flex-col gap-[13px]">
            {([['garde.calendrier.periodesOffertes', 'garde.calendrier.periodesOffertesValeur'], ['garde.calendrier.miseEnPause', 'garde.calendrier.miseEnPauseValeur'], ['garde.calendrier.auJournal', 'garde.calendrier.auJournalValeur']] as const).map(([label, valeur]) => (
              <span key={label}>
                <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">{t(label)}</span>
                <span className="mt-1.5 block font-mono text-[19px] font-semibold tabular-nums tracking-tight text-text-primary">{t(valeur)}</span>
              </span>
            ))}
          </div>
          <p className="mt-auto pt-[18px] text-[13px] leading-relaxed text-text-secondary [text-wrap:pretty]">{t('garde.calendrier.pausePhrase')}</p>
        </section>
      </div>

      {/* Le réglage lui-même : un geste à part, derrière une ligne — jamais étalé sous la portée. */}
      <details className="border border-border bg-surface">
        <summary className="cursor-pointer px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.calendrier.horaires')}</summary>
        <ul className="flex flex-col divide-y divide-border border-t border-border px-4">
          {agents.map((a) => (
            <li key={a.key} className="flex flex-wrap items-center gap-2 py-2">
              <EtatPoint etat={a.etat} actif={a.actif} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">{a.nom} <span className="text-[11px] text-text-muted">· {nomEquipe.get(a.equipe) ?? a.equipe}</span></span>
              <label className="flex items-center gap-1 text-[11px] text-text-muted">
                {t('garde.calendrier.periode')}
                <select value={a.everyMs} onChange={(e) => void regler(a.key, { everyMs: Number(e.target.value) })} aria-label={`${t('garde.calendrier.periode')} ${a.nom}`} className="input-focus bg-bg px-1 py-0.5 text-[11px] text-text-primary outline-none">
                  {[...new Set([...PERIODES, a.everyMs])].sort((x, y) => x - y).map((p) => <option key={p} value={p}>{CLE_PERIODE[p] ? t(CLE_PERIODE[p]) : dureeCourte(p, t)}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => void regler(a.key, { actif: !a.actif })} className="min-h-11 border border-border px-2 text-[11px] text-text-secondary hover:border-border-strong hover:text-text-primary md:min-h-0 md:py-0.5">{a.actif ? t('garde.calendrier.mettreEnPause') : t('garde.calendrier.reprendre')}</button>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
