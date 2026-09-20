import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { EcranVide, useHaloSignal } from '../components/EtatEcran';
import { usePersonalStore } from '../state/usePersonalStore';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface Seance {
  startedAt: string;
  minutes: number;
}
interface Habitude {
  id: string;
  label: string;
  ticks: string[];
}
interface EntreeJournal {
  day: string;
  text: string;
}

/** Ce qui fait qu'un mois compte comme tenu. Toujours lu ailleurs, jamais déclaré. */
type Source = 'pomodoro' | 'habitudes' | 'journal';
interface Intention {
  id: string;
  title: string;
  source: Source;
  /** Le nombre de jours (ou de séances) qu'il faut dans le mois. */
  seuil: number;
  startedAt: string;
  /** Rempli quand on a changé d'intention : le cairn est clos, il reste lisible. */
  closedAt: string;
}

/*
  ════════════════════════════════════════════════════════════════════════
  LE CAIRN — l'objet qui ne peut que grandir ou s'arrêter
  ════════════════════════════════════════════════════════════════════════

  UN MOIS MANQUÉ N'ENLÈVE AUCUNE PIERRE, IL N'EN AJOUTE SIMPLEMENT PAS. C'est
  toute la différence avec le reste du produit, et avec la quasi-totalité des
  applications qui font ce module : une série casse, un pourcentage baisse, un
  cairn, non. Ce qui a été fait reste fait. On peut cesser d'y ajouter ; on ne
  peut pas le défaire.

  Les pierres sont posées DE TRAVERS — rayons de bordure asymétriques, largeurs
  décroissantes de `LARGE_BAS` à `LARGE_HAUT`. Ce n'est pas un effet : un tas
  de pierres régulier est un graphique à barres, et un graphique à barres
  appelle une comparaison. On ne compare pas un cairn.

  UNE SEULE INTENTION À LA FOIS, en dur. Changer d'intention clôt le cairn en
  cours et en ouvre un neuf ; les cairns passés restent consultables. Une
  personne qui poursuit quatre intentions n'en poursuit aucune, et le module
  refuse de l'aider à faire semblant.

  UN MOIS SE JUGE TENU PAR UNE RÈGLE LISIBLE DANS UN AUTRE MODULE, jamais
  déclaré à la main. Sans cela le cairn serait un mur d'auto-satisfaction :
  on cocherait le mois en le décidant. Ici on va compter les séances de
  Pomodoro, les jours d'une habitude ou les jours écrits au journal — trois
  sources, toutes déjà sur ce poste, aucune à saisir deux fois.
*/
const PIERRE_H = 38;
const PIERRE_ECART = 4;
const LARGE_BAS = 84;
const LARGE_HAUT = 26;

const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const moisDe = (iso: string) => iso.slice(0, 7);

/** Les rayons de travers d'une pierre — déterministes, pour qu'elle ne bouge pas. */
function deTravers(rang: number): string {
  const a = 4 + ((rang * 7) % 9);
  const b = 3 + ((rang * 11) % 8);
  const c = 5 + ((rang * 5) % 7);
  const d = 2 + ((rang * 13) % 9);
  return `${a}px ${b}px ${c}px ${d}px`;
}

interface Pierre {
  mois: string;
  rang: number;
  /** La part du seuil atteinte — sert au relevé, jamais au dessin. */
  compte: number;
  enCours: boolean;
}

/**
 * LES OBJECTIFS PERSO — ce que vous visez, et ce qui s'empile.
 *
 * Pour qui : une personne, à côté de son travail. Les Objectifs & résultats
 * sont ceux de l'organisation, chiffrés et partagés ; ici c'est privé et sans
 * chiffre imposé. Rangé sur ce poste, comme les habitudes et le budget.
 *
 * ## Ce qui domine : un cairn
 *
 * L'écran était une liste d'objectifs avec des pas à cocher et une date
 * d'échéance. Deux choses n'allaient pas. D'abord une échéance transforme une
 * intention en dette — et le module qui promet « pas de cible » en posait
 * une. Ensuite les pas se cochaient à la main : on pouvait donc tout cocher
 * sans rien faire, ce qui rendait l'écran incapable de dire quoi que ce soit.
 *
 * Le cairn ne se coche pas : il se calcule. Voir l'en-tête des constantes pour
 * les quatre règles qui le tiennent.
 *
 * ## L'ambre : la pierre du mois en cours
 *
 * Posée mais pas encore stabilisée — deux nœuds, son fond et son mois. Elle
 * n'y est que si le mois est DÉJÀ tenu : une pierre ambre sur un mois qui
 * n'atteint pas son seuil serait une promesse.
 */
export function PersonalGoalsScreen() {
  const { t, langue } = useLangue();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const [intentions, setIntentions, pret] = usePersonalStore<Intention[]>('intentions', []);
  const [seances] = usePersonalStore<Seance[]>('pomodoro', []);
  const [habitudes] = usePersonalStore<Habitude[]>('habitudes', []);
  const [journal] = usePersonalStore<EntreeJournal[]>('journal', []);
  const [ouvert, setOuvert] = useState(false);
  const [title, setTitle] = useState('');
  const [source, setSource] = useState<Source>('pomodoro');
  const [seuil, setSeuil] = useState(8);

  const courante = intentions.find((i) => !i.closedAt) ?? null;
  const passees = intentions.filter((i) => i.closedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const moisCourant = moisDe(isoJour(new Date()));

  /** Le compte d'un mois, LU dans le module que l'intention désigne. */
  const compteDuMois = (intention: Intention, mois: string): number => {
    if (intention.source === 'pomodoro') return seances.filter((s) => moisDe(s.startedAt.slice(0, 10)) === mois).length;
    if (intention.source === 'journal') return journal.filter((e) => moisDe(e.day) === mois && (e.text ?? '').trim()).length;
    /* Habitudes : les jours cochés, toutes habitudes confondues — c'est la
       lecture la plus simple, et la seule qui reste vraie si on renomme une
       habitude ou si on en supprime une. */
    const jours = new Set(habitudes.flatMap((h) => h.ticks));
    return [...jours].filter((j) => moisDe(j) === mois).length;
  };

  /* LES MOIS DEPUIS LE DÉBUT DE L'INTENTION, et ceux qui sont tenus. */
  const cairn = useMemo<Pierre[]>(() => {
    if (!courante) return [];
    const debut = new Date(`${courante.startedAt.slice(0, 10)}T00:00:00`);
    const mois: string[] = [];
    const curseur = new Date(debut.getFullYear(), debut.getMonth(), 1);
    const fin = new Date();
    while (curseur <= fin) {
      mois.push(`${curseur.getFullYear()}-${String(curseur.getMonth() + 1).padStart(2, '0')}`);
      curseur.setMonth(curseur.getMonth() + 1);
    }
    const tenus = mois
      .map((m) => ({ mois: m, compte: compteDuMois(courante, m) }))
      .filter((m) => m.compte >= courante.seuil);
    return tenus.map((m, i) => ({ mois: m.mois, rang: i, compte: m.compte, enCours: m.mois === moisCourant }));
  }, [courante, seances, habitudes, journal, moisCourant]);

  const pierreEnCours = cairn.find((p) => p.enCours) ?? null;
  const halo = useHaloSignal(Boolean(pierreEnCours));
  const compteCeMois = courante ? compteDuMois(courante, moisCourant) : 0;

  const creer = () => {
    if (!title.trim()) return;
    const now = new Date().toISOString();
    setIntentions((liste) => [
      /* CHANGER D'INTENTION CLÔT LA PRÉCÉDENTE. Elle reste lisible en pied
         de page : un cairn abandonné est une chose qu'on a faite. */
      ...liste.map((i) => (i.closedAt ? i : { ...i, closedAt: now })),
      { id: `int-${Date.now().toString(36)}`, title: title.trim(), source, seuil, startedAt: now, closedAt: '' },
    ]);
    setTitle('');
    setOuvert(false);
  };

  const nomDuMois = (mois: string) => new Date(`${mois}-01T12:00:00`).toLocaleDateString(locale, { month: 'long' });
  const libelleSource = (s: Source, n: number) => t(`objectifsPerso.regle.${s}` as Parameters<typeof t>[0], { n });
  const vide = pret && intentions.length === 0 && !ouvert;

  return (
    <EcranVide quand={Boolean(vide)} premierJour={Boolean(vide)}>
      <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
        <motion.div variants={staggerItem}>
          <ScreenHeader
            eyebrow={t('perso.surtitre', { module: t('objectifsPerso.titre') })}
            title={t('objectifsPerso.titre')}
            description={t('objectifsPerso.description')}
            phraseVide={t('objectifsPerso.vide.phrase')}
            stats={[
              { label: t('objectifsPerso.stat.pierres'), value: cairn.length },
              { label: t('objectifsPerso.stat.cairns'), value: intentions.length },
            ]}
            actions={
              <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
                <Plus size={16} strokeWidth={2} /> {courante ? t('objectifsPerso.changer') : t('objectifsPerso.commencer')}
              </button>
            }
          />
        </motion.div>

        {ouvert && (
          <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); creer(); }} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
            {courante && <p className="text-sm leading-relaxed text-text-secondary">{t('objectifsPerso.changerAvertit', { titre: courante.title })}</p>}
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('objectifsPerso.champIntention')} aria-label={t('objectifsPerso.champIntention')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
            <p className="eyebrow">{t('objectifsPerso.commentUnMoisCompte')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <select value={source} onChange={(e) => setSource(e.target.value as Source)} aria-label={t('objectifsPerso.commentUnMoisCompte')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none">
                <option value="pomodoro">{t('objectifsPerso.source.pomodoro')}</option>
                <option value="habitudes">{t('objectifsPerso.source.habitudes')}</option>
                <option value="journal">{t('objectifsPerso.source.journal')}</option>
              </select>
              <input type="number" min={1} max={31} value={seuil} onChange={(e) => setSeuil(Math.max(1, Number(e.target.value) || 1))} aria-label={t('objectifsPerso.champSeuil')} className="input-focus min-h-11 w-24 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
              <span className="text-sm text-text-secondary">{t('objectifsPerso.parMois')}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={!title.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('objectifsPerso.enregistrer')}</button>
              <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
            </div>
          </motion.form>
        )}

        {vide ? (
          <motion.div variants={staggerItem}>
            <FirstRun title={t('objectifsPerso.vide.titre')} action={{ label: t('objectifsPerso.vide.action'), onClick: () => setOuvert(true) }}>{t('objectifsPerso.vide.texte')}</FirstRun>
          </motion.div>
        ) : (
          courante && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              {/* ═══ L'OBJET DOMINANT : le cairn ═══ */}
              <motion.section variants={staggerItem} className={`panel-raised flex flex-col items-center p-5 sm:p-6 ${halo}`}>
                <p className="eyebrow mb-5 self-start">{t('objectifsPerso.leCairn')}</p>
                {cairn.length === 0 ? (
                  <p className="max-w-prose py-8 text-center text-sm leading-relaxed text-text-secondary">{t('objectifsPerso.aucunePierre')}</p>
                ) : (
                  /* `flex-col-reverse` : la première pierre se rend EN BAS. Un
                     cairn se construit par le bas, et les largeurs décroissent
                     vers le haut — voir l'en-tête. */
                  /* `mt-auto` : le tas REPOSE sur le fond du panneau. Sans lui,
                     un cairn d'une seule pierre flottait en haut, sous un vide
                     de trois cents pixels — un tas de pierres qui lévite. */
                  <ul className="mt-auto flex w-full max-w-sm flex-col-reverse items-center" style={{ gap: PIERRE_ECART }}>
                    {cairn.map((p) => {
                      const part = cairn.length <= 1 ? 0 : p.rang / (cairn.length - 1);
                      const largeur = LARGE_BAS - part * (LARGE_BAS - LARGE_HAUT);
                      return (
                        <li
                          key={p.mois}
                          data-signal-groupe={p.enCours ? 'pierre-du-mois' : undefined}
                          className={`flex items-center justify-center ${p.enCours ? 'bg-signal text-signal-ink' : 'bg-elevated text-text-body'}`}
                          style={{
                            width: `${largeur}%`,
                            height: PIERRE_H,
                            borderRadius: deTravers(p.rang),
                            border: p.enCours ? 'none' : '1px solid var(--color-border-strong)',
                          }}
                        >
                          <span
                            data-signal-groupe={p.enCours ? 'pierre-du-mois' : undefined}
                            className="truncate px-2 font-mono text-[11px] uppercase tracking-[0.14em]"
                          >
                            {nomDuMois(p.mois)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="mt-6 max-w-prose text-center text-xs leading-relaxed text-text-muted">{t('objectifsPerso.moisManque')}</p>
              </motion.section>

              {/* À DROITE — l'intention, la règle, trois relevés. */}
              <motion.aside variants={staggerItem} className="panel p-4">
                <p className="eyebrow mb-2">{t('objectifsPerso.lIntention')}</p>
                <p className="text-[22px] font-semibold leading-tight text-text-primary">{courante.title}</p>
                <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-text-body">
                  {t('objectifsPerso.unMoisCompteQuand', { regle: libelleSource(courante.source, courante.seuil) })}
                </p>
                <dl className="mt-4 flex flex-col gap-3 border-t border-border pt-3">
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('objectifsPerso.ceMois')}</dt>
                    <dd className="text-[19px] font-semibold tabular-nums leading-tight text-text-primary">{compteCeMois} / {courante.seuil}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('objectifsPerso.stat.pierres')}</dt>
                    <dd className="text-[19px] font-semibold tabular-nums leading-tight text-text-primary">{cairn.length}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('objectifsPerso.depuis')}</dt>
                    <dd className="text-[19px] font-semibold leading-tight text-text-primary">
                      {new Date(courante.startedAt).toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-text-muted">{t('perso.local')}</p>
              </motion.aside>
            </div>
          )
        )}

        {/* EN PIED — les intentions passées, abandon compris. */}
        {passees.length > 0 && (
          <motion.section variants={staggerItem} className="panel">
            <p className="eyebrow border-b border-border px-4 py-2.5">{t('objectifsPerso.lesCairnsPasses')}</p>
            <ul className="flex flex-col">
              {passees.map((i) => {
                const debut = new Date(i.startedAt);
                const fin = new Date(i.closedAt);
                const mois = Math.max(1, Math.round((fin.getTime() - debut.getTime()) / (30 * 86_400_000)));
                const pierres = (() => {
                  let n = 0;
                  const curseur = new Date(debut.getFullYear(), debut.getMonth(), 1);
                  while (curseur <= fin) {
                    const m = `${curseur.getFullYear()}-${String(curseur.getMonth() + 1).padStart(2, '0')}`;
                    if (compteDuMois(i, m) >= i.seuil) n += 1;
                    curseur.setMonth(curseur.getMonth() + 1);
                  }
                  return n;
                })();
                return (
                  <li key={i.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border px-4 py-3 last:border-b-0">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-text-primary">{i.title}</span>
                      <span className="block font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        {libelleSource(i.source, i.seuil)}
                      </span>
                    </span>
                    <span className="flex-shrink-0 font-mono text-[11px] tabular-nums text-text-secondary">
                      {t('objectifsPerso.nMois', { n: mois })} · {t('objectifsPerso.nPierres', { n: pierres })}
                    </span>
                  </li>
                );
              })}
            </ul>
          </motion.section>
        )}
      </motion.section>
    </EcranVide>
  );
}
