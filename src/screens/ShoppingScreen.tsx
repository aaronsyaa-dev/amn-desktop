import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { EcranVide, useHaloSignal } from '../components/EtatEcran';
import { usePersonalStore } from '../state/usePersonalStore';
import { formatCents } from '../lib/money';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface ArticleDeCourse {
  id: string;
  label: string;
  /** Le rayon, tel que la personne l'écrit — jamais une catégorie imposée. */
  rayon: string;
  prixCents: number;
  pris: boolean;
}
interface ListeDeCourses {
  id: string;
  articles: ArticleDeCourse[];
  createdAt: string;
  /** Rempli quand la liste est soldée : elle sert alors de mémoire des prix. */
  soldeeLe: string;
}

/*
  ══════════════════════════════════════════════════════════════════════
  LE TICKET DE CAISSE — et les deux règles qui le distinguent d'une liste
  ══════════════════════════════════════════════════════════════════════

  1. CE QUI EST PRIS SE RAYE SANS DISPARAÎTRE. Case cochée, texte barré, encre
     atténuée — et la ligne GARDE SA PLACE et son prix dans le sous-total
     « déjà pris ». Une liste qui efface ce qu'on prend rétrécit à mesure
     qu'on avance, et on ne peut plus vérifier qu'on a bien pris la bonne
     chose. Un ticket, lui, se relit entier à la caisse.

  2. LES PRIX VIENNENT DE LA DERNIÈRE LISTE SOLDÉE, jamais d'un catalogue.
     C'est une mémoire, pas une base de données de produits : le prix proposé
     est celui qu'on a payé la dernière fois, dans ce magasin-là. Un catalogue
     aurait été faux dès la première promotion, et aurait demandé une
     maintenance que personne ne ferait.

  Le papier est le même que celui de la Calculatrice pro (`--color-papier`),
  et pour la même raison : ce n'est pas une carte, c'est une impression.
*/
const TICKET_LIGNE_H = 24;
const DENT_L = 12;
const DENT_H = 7;
const PAPIER = 'var(--color-papier)';
const ENCRE_PAPIER = 'var(--color-papier-encre)';
const ENCRE_PALE = 'var(--color-papier-pale)';
const GRILLE = 'var(--color-papier-grille)';
/** Les articles qui reviennent — six, pas plus : au-delà ce n'est plus une habitude. */
const HABITUES = 6;

/**
 * LES COURSES — une liste qu'on lit dans un magasin.
 *
 * Pour qui : soi, pas l'entreprise. Ce que ça règle : la liste écrite sur un
 * bout de papier qu'on oublie, et le total qu'on découvre à la caisse.
 *
 * ## Ce qui domine : un ticket, et pas une liste à cases
 *
 * Ce module était une PAGE — le même moteur de blocs que les Pages de
 * l'entreprise, avec un bloc « liste à cocher ». Ça marchait, et ça ne
 * ressemblait à rien : sur fond sombre, une liste à cases ressemble à toutes
 * les autres listes du produit, et on la cherche du regard dans un rayon.
 *
 * Un ticket de caisse ne ressemble qu'à lui-même. Il se repère d'un coup
 * d'œil, il se lit à bout de bras, et il porte un total — ce qu'une page ne
 * pouvait pas faire, faute de prix.
 *
 * ## Où ça vit, et pourquoi pas sur le serveur
 *
 * ARBITRAGE. La liste précédente se synchronisait, ce qui était pratique
 * (l'écrire au bureau, la lire au magasin) et faux : la synchronisation est
 * celle de l'ORGANISATION, donc une liste de courses y était lisible par qui
 * administre l'espace. La famille Personnel promet l'inverse — « jamais
 * partagés, quelle que soit la formule ». On tient la promesse, et on en paie
 * le prix : la liste ne suit pas sur le téléphone, et l'écran le dit.
 *
 * ## L'ambre : le reste à prendre
 *
 * La plaque en pied de ticket, son libellé et son montant. Trois nœuds. Elle
 * disparaît quand tout est pris : un ticket soldé ne demande plus rien.
 */
export function ShoppingScreen() {
  const { t } = useLangue();
  const [listes, setListes, pret] = usePersonalStore<ListeDeCourses[]>('courses', []);
  const [label, setLabel] = useState('');
  const [rayon, setRayon] = useState('');
  const [prix, setPrix] = useState('');

  const enCours = listes.find((l) => !l.soldeeLe) ?? null;
  const soldees = useMemo(() => listes.filter((l) => l.soldeeLe).sort((a, b) => b.soldeeLe.localeCompare(a.soldeeLe)), [listes]);
  const articles = enCours?.articles ?? [];

  const restant = articles.filter((a) => !a.pris).reduce((n, a) => n + a.prixCents, 0);
  /* Les articles encore à prendre dont on ne connaît PAS le prix. Le total
     ambre les compte pour zéro — il faut donc le dire, sinon le ticket
     annonce une somme plus basse que ce qui sera payé en caisse. */
  const sansPrix = articles.filter((a) => !a.pris && a.prixCents === 0).length;
  const dejaPris = articles.filter((a) => a.pris).reduce((n, a) => n + a.prixCents, 0);
  const halo = useHaloSignal(restant > 0);

  /* LA MÉMOIRE DES PRIX — la dernière liste soldée, et elle seule. */
  const memoire = useMemo(() => {
    const derniere = soldees[0];
    const par = new Map<string, number>();
    for (const a of derniere?.articles ?? []) par.set(a.label.toLowerCase(), a.prixCents);
    return par;
  }, [soldees]);

  /* LES HABITUÉS — les articles qui reviennent le plus souvent dans les
     listes soldées. Comptés, jamais déclarés « favoris » à la main. */
  const habitues = useMemo(() => {
    const par = new Map<string, { label: string; n: number; prixCents: number }>();
    for (const l of soldees) {
      for (const a of l.articles) {
        const cle = a.label.toLowerCase();
        const vu = par.get(cle);
        par.set(cle, { label: a.label, n: (vu?.n ?? 0) + 1, prixCents: a.prixCents });
      }
    }
    return [...par.values()].sort((a, b) => b.n - a.n).slice(0, HABITUES);
  }, [soldees]);

  /* LE RANGEMENT PAR RAYON, dans l'ordre du magasin habituel : l'ordre
     d'apparition des rayons dans la dernière liste soldée. C'est le seul
     « ordre du magasin » qui ne soit pas inventé. */
  const parRayon = useMemo(() => {
    const ordre: string[] = [];
    for (const a of soldees[0]?.articles ?? []) if (a.rayon && !ordre.includes(a.rayon)) ordre.push(a.rayon);
    const groupes = new Map<string, ArticleDeCourse[]>();
    for (const a of articles) {
      const cle = a.rayon || t('courses.sansRayon');
      groupes.set(cle, [...(groupes.get(cle) ?? []), a]);
    }
    return [...groupes.entries()].sort((a, b) => {
      const ia = ordre.indexOf(a[0]);
      const ib = ordre.indexOf(b[0]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [articles, soldees, t]);

  const ecrire = (suite: ArticleDeCourse[]) => {
    if (enCours) {
      setListes((liste) => liste.map((l) => (l.id === enCours.id ? { ...l, articles: suite } : l)));
      return;
    }
    setListes((liste) => [...liste, { id: `lst-${Date.now().toString(36)}`, articles: suite, createdAt: new Date().toISOString(), soldeeLe: '' }]);
  };

  const ajouter = (depuis?: { label: string; prixCents: number }) => {
    const nom = (depuis?.label ?? label).trim();
    if (!nom) return;
    const connu = memoire.get(nom.toLowerCase());
    const centimes = depuis ? depuis.prixCents : prix.trim() ? Math.round(Number(prix.replace(',', '.')) * 100) || 0 : (connu ?? 0);
    ecrire([
      ...articles,
      { id: `art-${Date.now().toString(36)}-${articles.length}`, label: nom, rayon: rayon.trim(), prixCents: centimes, pris: false },
    ]);
    setLabel('');
    setPrix('');
  };
  const basculer = (a: ArticleDeCourse) => ecrire(articles.map((x) => (x.id === a.id ? { ...x, pris: !x.pris } : x)));
  const retirer = (a: ArticleDeCourse) => ecrire(articles.filter((x) => x.id !== a.id));
  const solder = () => {
    if (!enCours) return;
    setListes((liste) => liste.map((l) => (l.id === enCours.id ? { ...l, soldeeLe: new Date().toISOString() } : l)));
  };

  const vide = pret && listes.length === 0;

  return (
    <EcranVide quand={Boolean(vide)} premierJour={Boolean(vide)}>
      <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
        <motion.div variants={staggerItem}>
          <ScreenHeader
            eyebrow={t('perso.surtitre', { module: t('courses.titre') })}
            title={t('courses.titre')}
            description={t('courses.description')}
            phraseVide={t('courses.vide.phrase')}
            stats={[
              { label: t('courses.stat.aPrendre'), value: articles.filter((a) => !a.pris).length },
              { label: t('courses.stat.listes'), value: listes.length },
            ]}
          />
        </motion.div>

        {vide ? (
          <motion.div variants={staggerItem}>
            <FirstRun title={t('courses.vide.titre')} action={{ label: t('courses.vide.action'), onClick: () => ajouter({ label: t('courses.exemple'), prixCents: 0 }) }}>
              {t('courses.vide.texte')}
            </FirstRun>
          </motion.div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
            {/* ═══ L'OBJET DOMINANT : le ticket ═══ */}
            <motion.section variants={staggerItem} className={`panel-raised p-5 sm:p-6 ${halo}`}>
              <p className="eyebrow mb-4">{t('courses.leTicket')}</p>

              <div className="px-4 py-4 font-mono" style={{ backgroundColor: PAPIER, color: ENCRE_PAPIER }}>
                <p className="text-center text-[13px] font-bold uppercase tracking-[0.2em]">{t('courses.enTeteTicket')}</p>
                <p className="mt-1 text-center text-[11px]" style={{ color: ENCRE_PALE }}>
                  {new Date(enCours?.createdAt ?? Date.now()).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>

                <ul className="mt-4 flex flex-col">
                  {articles.length === 0 && (
                    <li className="py-6 text-center text-[12px] uppercase tracking-wider" style={{ color: ENCRE_PALE }}>
                      {t('courses.ticketVierge')}
                    </li>
                  )}
                  {articles.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center gap-3 text-[13px] tabular-nums"
                      style={{ minHeight: TICKET_LIGNE_H, borderBottom: `1px dotted ${GRILLE}` }}
                    >
                      <input
                        type="checkbox"
                        checked={a.pris}
                        onChange={() => basculer(a)}
                        aria-label={a.label}
                        className="h-4 w-4 flex-shrink-0 accent-black"
                      />
                      {/* RAYÉ, PAS EFFACÉ — la ligne garde sa place et son prix. */}
                      <span
                        className={`min-w-0 flex-1 truncate ${a.pris ? 'line-through' : ''}`}
                        style={{ color: a.pris ? ENCRE_PALE : ENCRE_PAPIER }}
                      >
                        {a.label}
                      </span>
                      {/* UN PRIX INCONNU N'EST PAS UN PRIX DE ZÉRO. Un article
                          jamais acheté n'a pas de mémoire de prix : le ticket
                          écrit un tiret, pas « 0,00 € ». Écrire zéro ferait
                          croire qu'il est gratuit, et fausserait la lecture du
                          reste à prendre juste en dessous. */}
                      <span className="w-20 flex-shrink-0 text-right" style={{ color: a.prixCents === 0 || a.pris ? ENCRE_PALE : ENCRE_PAPIER }}>
                        {a.prixCents === 0 ? '—' : formatCents(a.prixCents)}
                      </span>
                      <button
                        type="button"
                        onClick={() => retirer(a)}
                        aria-label={t('courses.retirer')}
                        title={t('courses.retirer')}
                        className="flex-shrink-0 opacity-40 transition-opacity hover:opacity-100"
                        style={{ color: ENCRE_PALE }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </li>
                  ))}
                </ul>

                {articles.length > 0 && (
                  <p className="mt-3 flex items-baseline justify-between gap-4 text-[12px] tabular-nums" style={{ color: ENCRE_PALE }}>
                    <span>{t('courses.dejaPris')}</span>
                    <span className="w-20 text-right">{formatCents(dejaPris)}</span>
                  </p>
                )}

                {/* LE RESTE À PRENDRE — la plaque ambre, pleine largeur. */}
                {restant > 0 && (
                  <div
                    data-signal-groupe="reste-a-prendre"
                    className="-mx-4 mt-3 flex items-baseline justify-between gap-4 bg-signal px-4 py-2.5 text-signal-ink"
                  >
                    <span data-signal-groupe="reste-a-prendre" className="text-[11px] font-bold uppercase tracking-[0.2em]">
                      {t('courses.resteAPrendre')}
                    </span>
                    <span data-signal-groupe="reste-a-prendre" className="text-[23px] font-semibold tabular-nums leading-none">
                      {formatCents(restant)}
                    </span>
                  </div>
                )}
                {restant > 0 && sansPrix > 0 && (
                  <p className="mt-2 text-[11px] leading-snug" style={{ color: ENCRE_PALE }}>
                    {t('courses.sansPrix', { n: sansPrix })}
                  </p>
                )}
              </div>

              {/* LE BORD DÉCHIRÉ. */}
              <svg viewBox={`0 0 ${DENT_L * 40} ${DENT_H}`} preserveAspectRatio="none" className="block w-full" style={{ height: DENT_H }} aria-hidden>
                <path
                  d={`M0 0 ${Array.from({ length: 40 }, (_, i) => `L${i * DENT_L + DENT_L / 2} ${DENT_H} L${(i + 1) * DENT_L} 0`).join(' ')} Z`}
                  fill={PAPIER}
                />
              </svg>

              {/* LA SAISIE — sous le ticket, jamais dedans. */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  ajouter();
                }}
                className="mt-5 flex flex-wrap gap-2 border-t border-border-strong pt-4"
              >
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('courses.champArticle')} aria-label={t('courses.champArticle')} className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
                <input value={rayon} onChange={(e) => setRayon(e.target.value)} placeholder={t('courses.champRayon')} aria-label={t('courses.champRayon')} className="input-focus min-h-11 w-32 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
                <input value={prix} onChange={(e) => setPrix(e.target.value)} inputMode="decimal" placeholder={t('courses.champPrix')} aria-label={t('courses.champPrix')} className="input-focus min-h-11 w-24 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
                <button type="submit" disabled={!label.trim()} aria-label={t('courses.ajouter')} className="flex h-11 w-11 items-center justify-center bg-accent text-bg disabled:opacity-40">
                  <Plus size={16} strokeWidth={2.5} />
                </button>
              </form>
              <p className="mt-2 text-xs leading-relaxed text-text-muted">{t('courses.prixDeLaDerniere')}</p>
              {articles.length > 0 && restant === 0 && (
                <button type="button" onClick={solder} className="mt-3 bg-accent px-4 py-2 text-sm font-semibold text-bg">{t('courses.solder')}</button>
              )}
            </motion.section>

            {/* À DROITE — le rangement par rayon, dans l'ordre du magasin. */}
            <motion.aside variants={staggerItem} className="panel p-4">
              <p className="eyebrow mb-3">{t('courses.parRayon')}</p>
              {parRayon.length === 0 ? (
                <p className="text-sm text-text-muted">{t('courses.aucunRayon')}</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {parRayon.map(([nom, liste]) => (
                    <li key={nom}>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{nom}</p>
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {liste.map((a) => (
                          <li key={a.id} className={`truncate text-sm ${a.pris ? 'text-text-muted line-through' : 'text-text-secondary'}`}>
                            {a.label}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-text-muted">{t('courses.ordreDuMagasin')}</p>
            </motion.aside>
          </div>
        )}

        {/* EN PIED — les habitués, et les relevés de la liste. */}
        {!vide && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
            <motion.section variants={staggerItem} className="panel p-4">
              <p className="eyebrow mb-3">{t('courses.lesHabitues')}</p>
              {habitues.length === 0 ? (
                <p className="text-sm text-text-muted">{t('courses.pasEncoreDHabitues')}</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {habitues.map((h) => (
                    <li key={h.label}>
                      <button
                        type="button"
                        onClick={() => ajouter({ label: h.label, prixCents: h.prixCents })}
                        className="input-focus flex min-h-11 items-center gap-2 border border-border px-3 text-sm text-text-secondary hover:border-border-strong hover:text-text-primary md:min-h-0 md:py-2"
                      >
                        <Plus size={12} /> {h.label}
                        <span className="font-mono text-[10px] tabular-nums text-text-muted">{t('courses.nFois', { n: h.n })}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </motion.section>

            <motion.aside variants={staggerItem} className="panel p-4">
              <p className="eyebrow mb-3">{t('courses.leReleve')}</p>
              <dl className="flex flex-col gap-3">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('courses.dejaPris')}</dt>
                  <dd className="text-[19px] font-semibold tabular-nums leading-tight text-text-primary">{formatCents(dejaPris)}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('courses.listesSoldees')}</dt>
                  <dd className="text-[19px] font-semibold tabular-nums leading-tight text-text-primary">{soldees.length}</dd>
                </div>
              </dl>
              <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-text-muted">{t('perso.local')}</p>
            </motion.aside>
          </div>
        )}
      </motion.section>
    </EcranVide>
  );
}
