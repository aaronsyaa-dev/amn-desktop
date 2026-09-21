import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useProjects } from '../state/useProjects';
import { isDone } from '../state/projectEngine';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * LE TABLEAU DES PROJETS — les mêmes projets, vus en colonnes.
 *
 * Pour qui : quelqu'un qui préfère voir « où en est tout » d'un coup d'œil
 * plutôt que ligne par ligne. Ce que ça règle : une colonne par statut —
 * ceux que l'écran Projets a déjà définis, et que l'organisation peut
 * régler — et un projet qui passe de l'une à l'autre d'un geste. Rien n'est
 * recopié : c'est la collection Projets, avec sa configuration, lue autrement.
 *
 * ## Ce qui domine : la prochaine action, pas le projet
 *
 * Cet écran et le Pipeline étaient LE MÊME COMPOSANT : des colonnes en
 * `auto-fit`, des cartes de poids égal, un bouton fléché par carte. Mis côte à
 * côte sur deux captures, on ne les distinguait qu'au texte. C'est exactement
 * ce que ce chantier refuse.
 *
 * Ils n'ont pourtant pas la même matière. Un prospect porte un MONTANT ; un
 * projet porte une ÉCHÉANCE et surtout un champ que rien d'autre n'a dans
 * l'application : `nextAction`, « la prochaine action ». C'est la seule ligne
 * qui dit par quoi reprendre un projet qu'on rouvre trois semaines plus tard,
 * et elle s'affichait en 12 px sous le titre, tronquée.
 *
 * Elle devient le texte principal de chaque carte, et le titre du projet passe
 * en seconde ligne. Les colonnes restent — c'est la raison d'être de l'écran à
 * côté de Projets — mais on n'y lit plus des noms de projets : on y lit ce
 * qu'il y a à faire, rangé par état d'avancement.
 *
 * ## L'ambre
 *
 * Sur les projets SANS prochaine action. C'est le défaut que cet écran est le
 * seul à pouvoir voir, et c'en est un vrai : un projet sans suite écrite
 * n'avance pas, il attend qu'on se souvienne. Le retard, lui, garde le rouge
 * qu'il avait déjà — une échéance dépassée est une gravité, pas un arbitrage.
 */
export function ProjectBoardScreen() {
  const { t, langue } = useLangue();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const navigate = useNavigate();
  const { config, projects, updateProject } = useProjects();
  const aujourdhui = isoJour(new Date());

  const colonnes = useMemo(
    () => config.statuses.map((s) => ({ ...s, projets: projects.filter((p) => p.status === s.key) })),
    [config.statuses, projects],
  );
  const orphelins = useMemo(() => projects.filter((p) => !config.statuses.some((s) => s.key === p.status)), [config.statuses, projects]);
  const termines = projects.filter((p) => isDone(config, p)).length;
  const enRetard = projects.filter((p) => !isDone(config, p) && p.deadline && p.deadline < aujourdhui).length;
  const dateCourte = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  /*
    LES PROJETS SANS SUITE ÉCRITE.

    Les terminés n'en ont pas besoin : un projet fini n'a pas de prochaine
    action, et le signaler serait crier sur un état sain.
  */
  const sansSuite = useMemo(
    () => projects.filter((p) => !isDone(config, p) && !p.nextAction?.trim()),
    [projects, config],
  );

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('production.surtitre', { module: t('tableau.titre') })}
          title={t('tableau.titre')}
          description={t('tableau.description')}
          stats={[
            { label: t('tableau.stat.enCours'), value: projects.length - termines },
            { label: t('tableau.stat.termines'), value: termines },
            { label: t('tableau.stat.enRetard'), value: enRetard, emphasis: enRetard > 0 },
          ]}
          actions={
            <button type="button" onClick={() => navigate('/projets')} className="flex min-h-11 items-center gap-2 border border-border-strong px-4 text-sm text-text-primary hover:bg-surface-hover md:min-h-0 md:py-2">
              <ExternalLink size={14} /> {t('tableau.ouvrirProjets')}
            </button>
          }
        />
      </motion.div>

      {projects.length === 0 ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('tableau.vide.titre')} action={{ label: t('tableau.vide.action'), onClick: () => navigate('/projets') }}>{t('tableau.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <>
        {/* LA CARTE DE TÊTE — le défaut que seul cet écran peut voir. */}
        <motion.section variants={staggerItem} className="panel-raised p-5 sm:p-6" data-signal-groupe="sans-suite">
          {sansSuite.length > 0 ? (
            <>
              <p className="signal-plate mb-3 inline-flex px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider">{t('tableau.sansProchaineAction')}</p>
              <p className="text-[21px] font-semibold leading-tight text-text-primary sm:text-[27px]">
                {sansSuite.length === 1 ? t('tableau.sansProchaineActionUn') : t('tableau.sansProchaineActionN', { n: sansSuite.length })}
              </p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">{t('tableau.sansProchaineActionAide')}</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {sansSuite.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => navigate('/projets')} className="input-focus flex min-h-11 items-center gap-2 border border-border-strong px-3 text-sm text-text-primary hover:bg-surface-hover md:min-h-0 md:py-2">
                      {p.title}
                      <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">{t('tableau.definir')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className="eyebrow mb-3">{t('tableau.leMur')}</p>
              <p className="text-[21px] font-semibold leading-tight text-text-primary sm:text-[27px]">{t('tableau.toutAUneSuite')}</p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">{t('tableau.toutAUneSuiteAide')}</p>
            </>
          )}
        </motion.section>

        <motion.div variants={staggerItem} className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="eyebrow">{t('tableau.leMur')}</p>
          <p className="text-[11px] text-text-muted">{t('tableau.leMurAide')}</p>
        </motion.div>

        <motion.div variants={staggerItem} className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))]">
          {colonnes.map((col, index) => {
            const precedente = colonnes[index - 1];
            const suivante = colonnes[index + 1];
            return (
              <section key={col.key} aria-label={col.label} className={`flex min-h-[10rem] flex-col gap-2 rounded-xl border bg-surface p-3 ${col.done ? 'border-success/30' : 'border-border'}`}>
                <p className="eyebrow flex items-center justify-between">
                  <span>{col.label}</span>
                  <span className="tnum">{col.projets.length}</span>
                </p>
                {col.projets.map((p) => {
                  const retard = !col.done && p.deadline && p.deadline < aujourdhui;
                  return (
                    <article key={p.id} className="flex flex-col gap-1 rounded-lg border border-border bg-bg p-2.5">
                      {/* L'ACTION D'ABORD : c'est ce qu'on vient lire. Le nom du
                          projet la situe, il ne la remplace pas.

                          Dans une colonne TERMINÉE, l'ordre se remet à
                          l'endroit : un projet fini n'a pas de suite, et écrire
                          « sans prochaine action » sur lui serait un reproche
                          adressé à un état sain. */}
                      {col.done ? (
                        <button type="button" onClick={() => navigate('/projets')} className="-my-1 py-1 text-left text-[15px] font-medium leading-snug text-text-primary hover:underline">{p.title}</button>
                      ) : (
                        <>
                          <p className={`text-[15px] font-medium leading-snug ${p.nextAction?.trim() ? 'text-text-primary' : 'text-text-muted'}`}>
                            {p.nextAction?.trim() || t('tableau.sansProchaineAction')}
                          </p>
                          <button type="button" onClick={() => navigate('/projets')} className="-my-1 py-1 text-left text-xs text-text-secondary hover:underline">{p.title}</button>
                        </>
                      )}
                      {p.deadline && (
                        <p className={`font-mono text-[10px] uppercase tracking-wider ${retard ? 'text-danger' : 'text-text-muted'}`}>
                          {t('tableau.echeance', { date: dateCourte(p.deadline) })}{retard ? ` · ${t('tableau.enRetard')}` : ''}
                        </p>
                      )}
                      <div className="mt-1 flex gap-2">
                        {precedente && (
                          <button type="button" onClick={() => void updateProject(p.id, { status: precedente.key })} aria-label={t('tableau.deplacer', { vers: precedente.label })} title={t('tableau.deplacer', { vers: precedente.label })} className="flex min-h-11 min-w-11 items-center justify-center border border-border text-text-muted hover:text-text-primary md:min-h-0 md:min-w-0 md:px-2 md:py-1"><ArrowLeft size={12} /></button>
                        )}
                        {suivante && (
                          <button type="button" onClick={() => void updateProject(p.id, { status: suivante.key })} className="flex min-h-11 items-center gap-1 border border-border-strong px-2 text-[11px] text-text-primary hover:bg-surface-hover md:min-h-0 md:py-1">
                            {suivante.label} <ArrowRight size={11} />
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </section>
            );
          })}
          {orphelins.length > 0 && (
            <section aria-label={t('tableau.sansColonne')} className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-surface p-3">
              <p className="eyebrow">{t('tableau.sansColonne')}</p>
              {orphelins.map((p) => (
                <article key={p.id} className="flex flex-col gap-1 rounded-lg border border-border bg-bg p-2.5">
                  <p className="text-sm font-medium text-text-primary">{p.title}</p>
                  {colonnes[0] && (
                    <button type="button" onClick={() => void updateProject(p.id, { status: colonnes[0].key })} className="flex min-h-11 w-fit items-center gap-1 border border-border-strong px-2 text-[11px] text-text-primary hover:bg-surface-hover md:min-h-0 md:py-1">
                      {colonnes[0].label} <ArrowRight size={11} />
                    </button>
                  )}
                </article>
              ))}
            </section>
          )}
        </motion.div>
        </>
      )}
    </motion.section>
  );
}
