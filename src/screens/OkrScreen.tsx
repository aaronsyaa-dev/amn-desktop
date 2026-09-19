import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';
import { EcranVide } from '../components/EtatEcran';

interface KeyResult {
  id: string;
  label: string;
  target: number;
  current: number;
  unit: string;
  /**
   * LA VALEUR DE DÉPART — absente sur les résultats écrits avant ce champ.
   *
   * Le système de design (`16c`) donne la position du curseur par
   * `pct = (val − min) / (cible − min)`, et cette formule ne se réduit à
   * `val / cible` que si le départ est zéro. Or la moitié des résultats clés
   * réels ne partent pas de zéro : « ramener le délai de réponse de 12 j à
   * 5 j » descend, et sans départ l'écran dessinerait un curseur à 240 % de
   * sa cible.
   *
   * Absent = zéro, ce qui redonne exactement l'ancien comportement.
   */
  start?: number;
}
interface OkrData {
  objective: string;
  season: string;
  keyResults: KeyResult[];
  createdAt: string;
}

const nombre = (s: string) => Number(String(s ?? '').trim().replace(',', '.')) || 0;

/**
 * LA POSITION DU CURSEUR — la formule du paquet, écrite une fois.
 *
 * `pct = (val − min) / (cible − min)`. Elle vaut dans les deux sens : quand la
 * cible est SOUS le départ (réduire un délai), le dénominateur est négatif et
 * le quotient reste positif dès que la valeur descend. Aucun cas particulier à
 * écrire, aucun `Math.abs` — la soustraction s'en charge.
 *
 * Bornée à [0, 1] : un résultat dépassé pousse le curseur au bout de la règle
 * et pas au-delà, sinon il sortirait de la carte.
 */
function positionCurseur(kr: KeyResult): number {
  const min = kr.start ?? 0;
  const etendue = kr.target - min;
  if (etendue === 0) return kr.current >= kr.target ? 1 : 0;
  return Math.max(0, Math.min(1, (kr.current - min) / etendue));
}

const avancementObjectif = (o: OkrData) =>
  o.keyResults.length ? o.keyResults.reduce((n, kr) => n + positionCurseur(kr), 0) / o.keyResults.length : 0;

/**
 * L'ALLURE — où l'on DEVRAIT en être à cette date du trimestre.
 *
 * Elle se déduit du jour dans le trimestre civil en cours, pas d'un champ
 * saisi : la saison est un texte libre (« T3 », « automne »), et personne ne
 * tiendra à jour deux dates par objectif. Le trimestre civil est la seule
 * période que tout le monde partage et que personne n'a à saisir.
 *
 * Renvoie une fraction dans [0, 1] : 0 le premier jour du trimestre, 1 le
 * dernier.
 */
function allureDuTrimestre(maintenant: Date): { fraction: number; joursRestants: number; libelle: string } {
  const trimestre = Math.floor(maintenant.getMonth() / 3);
  const debut = new Date(maintenant.getFullYear(), trimestre * 3, 1);
  const fin = new Date(maintenant.getFullYear(), trimestre * 3 + 3, 1);
  const etendue = fin.getTime() - debut.getTime();
  const ecoule = maintenant.getTime() - debut.getTime();
  return {
    fraction: Math.max(0, Math.min(1, ecoule / etendue)),
    joursRestants: Math.max(0, Math.ceil((fin.getTime() - maintenant.getTime()) / 86_400_000)),
    libelle: `T${trimestre + 1} ${maintenant.getFullYear()}`,
  };
}

/** Le trimestre civil d'une date, sous forme comparable. */
function cleTrimestre(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-T${Math.floor(d.getMonth() / 3) + 1}`;
}

/**
 * OBJECTIFS & RÉSULTATS — LES CURSEURS D'ALLURE (système de design, `16c`)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Chaque résultat clé est une règle horizontale de sa valeur de départ à sa
 * cible, avec DEUX repères : un curseur plein là où l'on en est, et un trait
 * fin là où l'on devrait en être à cette date du trimestre, légendé
 * « ALLURE ». Le retard n'est pas un pourcentage — c'est la distance entre
 * deux marques, et elle se voit sans être lue.
 *
 * LA RÈGLE QUE LE PAQUET APPELLE « le défaut le plus grave que cet écran
 * puisse avoir » : ne jamais poser ces deux pourcentages à la main. Ici, la
 * position du curseur vient de `positionCurseur()` — la formule exacte du
 * paquet — et le repère d'allure de `allureDuTrimestre()`. Un chiffre imprimé
 * ne peut donc pas contredire son curseur : les deux lisent la même source.
 *
 * L'AMBRE : le curseur du résultat le plus en retard sur son allure, sa course
 * remplie et son chiffre à droite. Trois nœuds sur une seule ligne. Si aucun
 * résultat n'est en retard, l'écran n'a pas d'ambre — le trait d'allure, lui,
 * reste toujours en gris de remplissage, quoi qu'il arrive.
 */
export function OkrScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const brutes = useCollection<OkrData>('okrs');
  const [ouvert, setOuvert] = useState(false);
  const [objective, setObjective] = useState('');
  const [season, setSeason] = useState('');
  const [lignes, setLignes] = useState('');

  const maintenant = useMemo(() => new Date(), []);
  const allure = useMemo(() => allureDuTrimestre(maintenant), [maintenant]);
  const trimestreCourant = useMemo(() => cleTrimestre(maintenant.toISOString()), [maintenant]);

  const objectifs = useMemo(
    () => [...brutes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [brutes],
  );

  /* Les résultats du trimestre en cours, à plat : c'est sur eux que porte
     l'instrument. Un objectif d'un trimestre passé n'a plus d'allure à tenir. */
  const resultatsCourants = useMemo(
    () =>
      objectifs
        .filter((o) => cleTrimestre(o.createdAt) === trimestreCourant)
        .flatMap((o) => o.keyResults.map((kr) => ({ kr, objectif: o })))
        .slice(0, 5),
    [objectifs, trimestreCourant],
  );

  /*
    LE PLUS EN RETARD — l'unique ambre, et il se CALCULE.

    Le retard d'un résultat est la distance entre son curseur et l'allure.
    Positive, elle veut dire « en avance » ; négative, « en retard ». Le plus
    en retard est le minimum, et il ne porte l'ambre que s'il est réellement
    négatif : un écran où tout le monde est en avance n'a rien à signaler.
  */
  const enRetard = useMemo(() => {
    let pire: { id: string; ecart: number } | null = null;
    for (const { kr } of resultatsCourants) {
      const ecart = positionCurseur(kr) - allure.fraction;
      if (ecart < 0 && (pire === null || ecart < pire.ecart)) pire = { id: kr.id, ecart };
    }
    return pire;
  }, [resultatsCourants, allure.fraction]);

  /* Les trimestres précédents, en colonnes de cinq cases : une case par
     résultat atteint. Trois colonnes, parce qu'au-delà on ne compare plus. */
  const trimestresPasses = useMemo(() => {
    const parTrimestre = new Map<string, { atteints: number; total: number }>();
    for (const o of objectifs) {
      const cle = cleTrimestre(o.createdAt);
      const courant = parTrimestre.get(cle) ?? { atteints: 0, total: 0 };
      for (const kr of o.keyResults) {
        courant.total += 1;
        if (positionCurseur(kr) >= 1) courant.atteints += 1;
      }
      parTrimestre.set(cle, courant);
    }
    return [...parTrimestre.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 4)
      .reverse()
      .map(([cle, v]) => ({ cle, ...v, courant: cle === trimestreCourant }));
  }, [objectifs, trimestreCourant]);

  const moyenne = objectifs.length
    ? Math.round((objectifs.reduce((n, o) => n + avancementObjectif(o), 0) / objectifs.length) * 100)
    : null;
  const atteints = objectifs.reduce(
    (n, o) => n + o.keyResults.filter((kr) => positionCurseur(kr) >= 1).length,
    0,
  );

  const ajouter = async () => {
    const krs = lignes
      .split('\n')
      .map((l) => l.split(',').map((p) => p.trim()))
      .filter(([label]) => label)
      .map(([label, target, unit, start]) => ({
        id: uid('kr'),
        label,
        target: nombre(target ?? '0'),
        current: nombre(start ?? '0'),
        unit: unit ?? '',
        start: nombre(start ?? '0'),
      }));
    if (!objective.trim() || krs.length === 0) return;
    await upsert('okrs', uid('okr'), {
      objective: objective.trim(),
      season: season.trim() || allure.libelle,
      keyResults: krs,
      createdAt: new Date().toISOString(),
    });
    setObjective('');
    setSeason('');
    setLignes('');
    setOuvert(false);
  };

  const saisir = (o: OkrData & { id: string }, kr: KeyResult, valeur: string) =>
    upsert('okrs', o.id, {
      ...o,
      keyResults: o.keyResults.map((k) => (k.id === kr.id ? { ...k, current: nombre(valeur) } : k)),
    });

  const vide = objectifs.length === 0 && !ouvert;

  return (
    <EcranVide quand={vide} premierJour={vide}>
      <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-6">
        <motion.div variants={staggerItem}>
          <ScreenHeader
            eyebrow={t('pilotage.surtitre', { module: t('okr.titre') })}
            title={t('okr.titre')}
            description={t('okr.description')}
            phraseVide="Trois objectifs, des résultats chiffrés, une saison : les curseurs se poseront tout seuls."
            stats={[
              { label: t('okr.stat.objectifs'), value: objectifs.length },
              { label: t('okr.stat.avancement'), value: moyenne === null ? '—' : `${moyenne} %` },
              { label: t('okr.stat.atteints'), value: atteints, emphasis: atteints > 0 },
            ]}
            actions={
              <button
                type="button"
                onClick={() => setOuvert((v) => !v)}
                className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
              >
                <Plus size={16} strokeWidth={2} /> {t('okr.ajouter')}
              </button>
            }
          />
        </motion.div>

        {ouvert && (
          <motion.form
            variants={staggerItem}
            onSubmit={(e) => {
              e.preventDefault();
              void ajouter();
            }}
            className="grid gap-3 border border-border bg-surface p-4 sm:grid-cols-2"
          >
            <input
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder={t('okr.champObjectif')}
              aria-label={t('okr.champObjectif')}
              autoFocus
              className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none"
            />
            <input
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder={allure.libelle}
              aria-label={t('okr.champSaison')}
              className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none"
            />
            <textarea
              value={lignes}
              onChange={(e) => setLignes(e.target.value)}
              rows={3}
              placeholder={`Ce qu’on mesure, cible, unité, départ
Délai de réponse, 5, h, 12`}
              aria-label={t('okr.champResultats')}
              className="input-focus border border-border bg-bg px-3 py-2 font-mono text-sm text-text-primary outline-none sm:col-span-2"
            />
            <p className="font-mono text-[10px] leading-relaxed tracking-[0.1em] text-text-muted sm:col-span-2">
              UNE LIGNE PAR RÉSULTAT · LE DÉPART EST FACULTATIF, ET PEUT ÊTRE PLUS GRAND QUE LA CIBLE
            </p>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={!objective.trim() || !lignes.trim()}
                className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40"
              >
                {t('okr.enregistrer')}
              </button>
              <button
                type="button"
                onClick={() => setOuvert(false)}
                className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
              >
                {t('chrome.fermer')}
              </button>
            </div>
          </motion.form>
        )}

        {vide ? (
          <motion.div variants={staggerItem}>
            <FirstRun title={t('okr.vide.titre')} action={{ label: t('okr.vide.action'), onClick: () => setOuvert(true) }}>
              {t('okr.vide.texte')}
            </FirstRun>
          </motion.div>
        ) : (
          <>
            {/* ── L'OBJET DOMINANT : les curseurs d'allure ────────────────── */}
            {resultatsCourants.length > 0 && (
              <motion.section
                variants={staggerItem}
                className="panel-raised panel-raised-wide px-[30px] pb-[26px] pt-[30px]"
              >
                <div className="mb-[26px] flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                  <span className="eyebrow text-text-secondary">Où l’on en est · {allure.libelle}</span>
                  <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
                    {Math.round(allure.fraction * 100)} % DU TRIMESTRE ÉCOULÉ
                  </span>
                </div>

                <ul className="flex flex-col gap-[22px]">
                  {resultatsCourants.map(({ kr, objectif }) => {
                    const pct = positionCurseur(kr);
                    const ambre = enRetard?.id === kr.id;
                    return (
                      <li key={kr.id} className="grid grid-cols-[1fr] gap-2 sm:grid-cols-[190px_1fr_120px] sm:items-center sm:gap-5">
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-semibold text-text-primary" title={kr.label}>
                            {kr.label}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-[9.5px] tracking-[0.1em] text-text-muted">
                            {objectif.objective}
                          </span>
                        </span>

                        {/* LA RÈGLE. 30 px de haut : le curseur de 15 px est
                            centré à mi-hauteur, comme dans la maquette. */}
                        <span className="relative h-[30px] min-w-0">
                          <span className="absolute inset-x-0 top-[13px] h-1 bg-border" aria-hidden />
                          {/* La course remplie — elle appartient au curseur,
                              donc elle prend l'ambre avec lui. */}
                          <span
                            data-signal-groupe={ambre ? 'resultat-en-retard' : undefined}
                            className={`absolute left-0 top-[13px] h-1 ${ambre ? 'bg-signal' : 'bg-[#2b2b2b]'}`}
                            style={{ width: `${pct * 100}%` }}
                            aria-hidden
                          />
                          {/* LE TRAIT D'ALLURE — toujours en gris de
                              remplissage, jamais en ambre : il ne demande
                              aucune décision, il dit seulement la date. */}
                          <span
                            className="absolute bottom-1 top-1 w-px bg-text-muted"
                            style={{ left: `${allure.fraction * 100}%` }}
                            aria-hidden
                          />
                          <span
                            className="absolute -top-[2px] -translate-x-1/2 font-mono text-[8.5px] tracking-[0.08em] text-text-muted"
                            style={{ left: `${allure.fraction * 100}%` }}
                          >
                            ALLURE
                          </span>
                          <span
                            data-signal-groupe={ambre ? 'resultat-en-retard' : undefined}
                            className={`absolute top-[15px] h-[15px] w-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-elevated ${
                              ambre ? 'bg-signal shadow-[0_0_22px_-2px_var(--color-signal-glow)]' : 'bg-text-body'
                            }`}
                            style={{ left: `${pct * 100}%` }}
                            aria-hidden
                          />
                        </span>

                        <label className="flex items-baseline justify-end gap-1.5">
                          <span className="sr-only">{t('okr.champActuel', { label: kr.label })}</span>
                          <input
                            defaultValue={kr.current || ''}
                            onBlur={(e) => void saisir(objectif as OkrData & { id: string }, kr, e.target.value)}
                            inputMode="decimal"
                            placeholder="0"
                            data-signal-groupe={ambre ? 'resultat-en-retard' : undefined}
                            className={`input-focus tnum w-14 border-none bg-transparent text-right font-mono text-[19px] font-bold tracking-[-0.03em] outline-none ${
                              ambre ? 'text-signal' : 'text-text-primary'
                            }`}
                          />
                          <span className="tnum flex-none font-mono text-[11px] text-text-muted">
                            / {kr.target}
                            {kr.unit ? ` ${kr.unit}` : ''}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </motion.section>
            )}

            {/* ── AUTOUR : les trimestres passés, et ce qu'il reste ───────── */}
            <motion.div variants={staggerItem} className="grid gap-[18px] lg:grid-cols-[1fr_340px]">
              <section className="panel min-w-0 px-[22px] pb-[18px] pt-5">
                <div className="mb-[18px] flex items-baseline justify-between">
                  <span className="eyebrow text-text-secondary">Les saisons</span>
                  <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">RÉSULTATS ATTEINTS</span>
                </div>
                {trimestresPasses.length > 0 ? (
                  <div className="flex items-end gap-7">
                    {trimestresPasses.map((tr) => (
                      <span key={tr.cle} className="flex flex-col items-center gap-2.5">
                        <span className="flex flex-col-reverse gap-1">
                          {Array.from({ length: 5 }, (_, i) => (
                            <span
                              key={i}
                              className={`h-3.5 w-3.5 border ${
                                i < tr.atteints
                                  ? tr.courant
                                    ? 'border-text-primary bg-text-primary'
                                    : 'border-border-strong bg-border-strong'
                                  : 'border-border'
                              }`}
                            />
                          ))}
                        </span>
                        <span
                          className={`font-mono text-[9.5px] tracking-[0.1em] ${
                            tr.courant ? 'text-text-primary' : 'text-text-muted'
                          }`}
                        >
                          {tr.cle.slice(5)}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="py-3 text-[13.5px] leading-[1.7] text-text-secondary">
                    Une saison se remplit case par case, à mesure que les résultats tombent.
                  </p>
                )}
              </section>

              <section className="panel flex flex-col px-5 pb-[18px] pt-5">
                <span className="eyebrow mb-5 text-text-secondary">Avant la clôture</span>
                <span className="tnum block font-mono text-[40px] font-bold leading-[.92] tracking-[-0.04em] text-text-primary">
                  {allure.joursRestants}
                  <span className="ml-1 text-[21px] font-semibold text-text-secondary">j</span>
                </span>
                <span className="mt-2.5 block text-[13.5px] leading-[1.55] text-text-secondary">
                  {enRetard
                    ? `Un résultat est à ${Math.round(Math.abs(enRetard.ecart) * 100)} points sous son allure : c’est celui qui bascule ou non.`
                    : 'Tout est au-dessus de son allure. Rien à rattraper.'}
                </span>
              </section>
            </motion.div>

            {/* ── LE MUR DES OBJECTIFS ────────────────────────────────────── */}
            <motion.div
              variants={staggerItem}
              className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(20rem,1fr))]"
            >
              {objectifs.map((o) => {
                const pct = Math.round(avancementObjectif(o) * 100);
                return (
                  <article key={o.id} className="group flex flex-col gap-3 border border-border bg-surface p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight text-text-primary">{o.objective}</p>
                        {o.season && (
                          <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{o.season}</p>
                        )}
                      </div>
                      <span className="tnum shrink-0 font-mono text-[17px] font-semibold text-text-secondary">
                        {pct} %
                      </span>
                    </div>
                    <ul className="flex flex-col gap-1.5">
                      {o.keyResults.map((kr) => (
                        <li key={kr.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                          <span className="min-w-0 truncate text-text-secondary">{kr.label}</span>
                          <span className="tnum flex-none font-mono text-text-primary">
                            {kr.current} / {kr.target}
                            {kr.unit ? ` ${kr.unit}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => void remove('okrs', o.id)}
                      aria-label={t('okr.supprimer')}
                      title={t('okr.supprimer')}
                      className="min-h-11 self-end px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </article>
                );
              })}
            </motion.div>
          </>
        )}
      </motion.section>
    </EcranVide>
  );
}
