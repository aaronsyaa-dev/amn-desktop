import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { EcranVide, useHaloSignal } from '../components/EtatEcran';
import { usePersonalStore } from '../state/usePersonalStore';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

/** Une ligne consignée : une date et une mention COURTE. Rien de médical. */
interface Consigne {
  id: string;
  at: string;
  label: string;
}
/** Une échéance : une date à venir et ce qu'elle est. */
interface Rappel {
  id: string;
  dueAt: string;
  label: string;
  doneAt: string;
}

/*
  ══════════════════════════════════════════════════════════════════════
  LE CARNET OUVERT — et la règle qui décide de ce que ce module REFUSE
  ══════════════════════════════════════════════════════════════════════

  LE CARNET NE NOTIFIE PAS. Il montre l'échu quand on l'ouvre, et c'est tout
  ce qu'il fait. Une notification de santé est une intrusion : elle arrive
  quand elle veut, devant qui se trouve là, et elle transforme un pense-bête
  en inquiétude. Celui qui ouvre ce carnet a décidé de s'en occuper.

  AUCUNE DONNÉE MÉDICALE DÉTAILLÉE N'EST STOCKÉE. Pas de compte rendu, pas
  d'ordonnance, pas de pièce jointe, pas de mesure continue. Une date et une
  mention courte — « vaccin DTP », « contrôle dentaire ». La raison est
  simple : ces données-là vivraient en clair dans le stockage local d'un poste
  de travail, et aucune promesse ne rendrait cela acceptable. Un carnet
  d'échéances est utile et sans danger ; un dossier médical ne l'est pas.

  LA PLIURE (`PLIURE_PX`) est un dégradé au bord INTÉRIEUR de chaque page. Ce
  n'est pas un ornement : c'est ce qui fait lire deux pages en vis-à-vis
  plutôt que deux cartes côte à côte, donc ce qui dit « on consigne et on
  relit » avant qu'aucun texte ne le dise.
*/
const PLIURE_PX = 26;
const JOUR_MS = 86_400_000;

const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Depuis combien de temps une échéance est passée, en mois entamés. */
function depuisEnMois(dueAt: string): number {
  const ecart = Date.now() - Date.parse(`${dueAt}T00:00:00`);
  return Math.max(1, Math.round(ecart / (30 * JOUR_MS)));
}

/**
 * LE CARNET DE SANTÉ — un pense-bête d'échéances, pas un dossier.
 *
 * Pour qui : soi. Ce que ça règle : le rappel de vaccin qu'on retrouve sur un
 * bout de papier trois ans après, et le contrôle qu'on a laissé passer sans
 * s'en rendre compte.
 *
 * Ce module n'existait pas : `MODULES.md` le décrit en `25e`, le produit ne
 * l'avait pas. Il a été construit plutôt qu'écarté, avec ce que la famille
 * Personnel impose — rien ne sort du poste, rien n'entre dans un rapport.
 *
 * ## Ce qui domine : deux pages en vis-à-vis
 *
 * Un carnet de santé n'est pas un tableau de bord. On y consigne et on y
 * relit, sans que rien soit noté ni comparé. Le format le dit avant tout
 * texte : le suivi à gauche, les échéances à droite, une pliure au milieu.
 *
 * ## L'ambre : le rappel échu
 *
 * Sa bande pleine largeur de page, sa date, son libellé et sa mention
 * « échu ». Quatre nœuds sur une ligne, une région. C'est la seule chose de
 * cet écran qui demande quelque chose — et elle ne le demande qu'ici, jamais
 * par une notification.
 */
export function HealthScreen() {
  const { t, langue } = useLangue();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const [consignes, setConsignes, pretC] = usePersonalStore<Consigne[]>('sante-suivi', []);
  const [rappels, setRappels, pretR] = usePersonalStore<Rappel[]>('sante-rappels', []);
  const [mention, setMention] = useState('');
  const [quand, setQuand] = useState(isoJour(new Date()));
  const [echeance, setEcheance] = useState('');
  const [echeanceQuand, setEcheanceQuand] = useState('');

  const aujourdhui = isoJour(new Date());
  const suivi = useMemo(() => [...consignes].sort((a, b) => b.at.localeCompare(a.at)), [consignes]);
  const aVenir = useMemo(
    () => rappels.filter((r) => !r.doneAt).sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    [rappels],
  );
  /* L'ÉCHU : le plus ancien dépassé. Un seul porte l'ambre, même s'il y en a
     trois — l'ambre marque ce qu'on fait maintenant, pas une file. */
  const echu = aVenir.find((r) => r.dueAt < aujourdhui) ?? null;
  const halo = useHaloSignal(Boolean(echu));

  const consigner = () => {
    if (!mention.trim()) return;
    setConsignes((liste) => [...liste, { id: `sui-${Date.now().toString(36)}`, at: quand, label: mention.trim().slice(0, 80) }]);
    setMention('');
  };
  const poserUnRappel = () => {
    if (!echeance.trim() || !echeanceQuand) return;
    setRappels((liste) => [...liste, { id: `rap-${Date.now().toString(36)}`, dueAt: echeanceQuand, label: echeance.trim().slice(0, 80), doneAt: '' }]);
    setEcheance('');
    setEcheanceQuand('');
  };
  const fait = (r: Rappel) => {
    setRappels((liste) => liste.map((x) => (x.id === r.id ? { ...x, doneAt: new Date().toISOString() } : x)));
    /* Un rappel fait devient une ligne de suivi : c'est la seule façon dont le
       carnet se remplit tout seul, et elle est traçable. */
    setConsignes((liste) => [...liste, { id: `sui-${Date.now().toString(36)}`, at: aujourdhui, label: r.label }]);
  };
  const retirer = (r: Rappel) => setRappels((liste) => liste.filter((x) => x.id !== r.id));
  const oublier = (c: Consigne) => setConsignes((liste) => liste.filter((x) => x.id !== c.id));

  const dateLongue = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const vide = pretC && pretR && consignes.length === 0 && rappels.length === 0;

  const CONSIGNE = [t('sante.consigne.dates'), t('sante.consigne.mentions'), t('sante.consigne.echeances')];
  const REFUSE = [t('sante.refuse.comptesRendus'), t('sante.refuse.ordonnances'), t('sante.refuse.piecesJointes'), t('sante.refuse.mesures')];

  return (
    <EcranVide quand={Boolean(vide)} premierJour={Boolean(vide)}>
      <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
        <motion.div variants={staggerItem}>
          <ScreenHeader
            eyebrow={t('perso.surtitre', { module: t('sante.titre') })}
            title={t('sante.titre')}
            description={t('sante.description')}
            phraseVide={t('sante.vide.phrase')}
            stats={[
              { label: t('sante.stat.consignees'), value: consignes.length },
              { label: t('sante.stat.aVenir'), value: aVenir.length },
            ]}
          />
        </motion.div>

        {vide ? (
          <motion.div variants={staggerItem}>
            <FirstRun title={t('sante.vide.titre')} action={{ label: t('sante.vide.action'), onClick: () => setEcheanceQuand(isoJour(new Date())) }}>
              {t('sante.vide.texte')}
            </FirstRun>
          </motion.div>
        ) : (
          /* ═══ L'OBJET DOMINANT : le carnet ouvert ═══ */
          <motion.section variants={staggerItem} className={`panel-raised ${halo}`}>
            <div className="flex flex-col md:flex-row">
              {/* PAGE DE GAUCHE — le suivi. La pliure est à son bord DROIT. */}
              <div className="relative min-w-0 flex-1 p-5 sm:p-6">
                <p className="eyebrow mb-4">{t('sante.leSuivi')}</p>
                <ul className="flex flex-col">
                  {suivi.length === 0 && <li className="py-4 text-sm text-text-muted">{t('sante.rienConsigne')}</li>}
                  {suivi.map((c) => (
                    <li key={c.id} className="group flex items-baseline gap-3 border-b border-border py-2.5 last:border-b-0">
                      <span className="w-28 flex-shrink-0 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        {dateLongue(c.at)}
                      </span>
                      <span className="min-w-0 flex-1 text-sm text-text-primary">{c.label}</span>
                      <button
                        type="button"
                        onClick={() => oublier(c)}
                        aria-label={t('sante.oublier')}
                        title={t('sante.oublier')}
                        className="flex-shrink-0 text-text-muted opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 size={11} />
                      </button>
                    </li>
                  ))}
                </ul>

                <form onSubmit={(e) => { e.preventDefault(); consigner(); }} className="mt-4 flex flex-wrap gap-2 border-t border-border-strong pt-4">
                  <input type="date" value={quand} onChange={(e) => setQuand(e.target.value)} aria-label={t('sante.champDate')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
                  <input value={mention} onChange={(e) => setMention(e.target.value)} maxLength={80} placeholder={t('sante.champMention')} aria-label={t('sante.champMention')} className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
                  <button type="submit" disabled={!mention.trim()} aria-label={t('sante.consigner')} className="flex h-11 w-11 items-center justify-center bg-accent text-bg disabled:opacity-40"><Plus size={16} strokeWidth={2.5} /></button>
                </form>

                {/* EN PIED DE PAGE GAUCHE — ce qu'on consigne, ce qu'on refuse. */}
                <div className="mt-5 border-t border-border pt-4">
                  <p className="eyebrow mb-2">{t('sante.ceQuOnConsigne')}</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {CONSIGNE.map((mot) => (
                      <li key={mot} className="border border-border-strong bg-elevated px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-body">{mot}</li>
                    ))}
                    {REFUSE.map((mot) => (
                      <li key={mot} className="border border-dashed border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-muted line-through">{mot}</li>
                    ))}
                  </ul>
                </div>

                {/* LA PLIURE, au bord intérieur — invisible sur téléphone, où
                    les deux pages sont l'une sous l'autre et ne se font plus face. */}
                <span
                  className="pointer-events-none absolute inset-y-0 right-0 hidden md:block"
                  style={{ width: PLIURE_PX, background: 'linear-gradient(to right, transparent, var(--color-bg))' }}
                  aria-hidden
                />
              </div>

              {/* PAGE DE DROITE — les rappels. La pliure est à son bord GAUCHE. */}
              <div className="relative min-w-0 flex-1 border-t border-border-strong p-5 sm:p-6 md:border-l md:border-t-0">
                <span
                  className="pointer-events-none absolute inset-y-0 left-0 hidden md:block"
                  style={{ width: PLIURE_PX, background: 'linear-gradient(to left, transparent, var(--color-bg))' }}
                  aria-hidden
                />
                <p className="eyebrow mb-4">{t('sante.lesRappels')}</p>

                <ul className="flex flex-col gap-2">
                  {aVenir.length === 0 && <li className="py-4 text-sm text-text-muted">{t('sante.aucunRappel')}</li>}
                  {aVenir.map((r) => {
                    const ambre = echu?.id === r.id;
                    return (
                      <li
                        key={r.id}
                        data-signal-groupe={ambre ? 'echu' : undefined}
                        className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 ${
                          ambre ? 'bg-signal text-signal-ink' : 'border border-border bg-surface'
                        }`}
                      >
                        <span
                          data-signal-groupe={ambre ? 'echu' : undefined}
                          className={`w-28 flex-shrink-0 font-mono text-[10px] uppercase tracking-wider ${ambre ? 'font-bold' : 'text-text-muted'}`}
                        >
                          {dateLongue(r.dueAt)}
                        </span>
                        <span data-signal-groupe={ambre ? 'echu' : undefined} className={`min-w-0 flex-1 text-sm ${ambre ? 'font-semibold' : 'text-text-primary'}`}>
                          {r.label}
                        </span>
                        {ambre && (
                          <span data-signal-groupe="echu" className="flex-shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em]">
                            {t('sante.echuDepuis', { n: depuisEnMois(r.dueAt) })}
                          </span>
                        )}
                        <span className="flex flex-shrink-0 gap-1.5">
                          <button
                            type="button"
                            onClick={() => fait(r)}
                            aria-label={t('sante.marquerFait')}
                            title={t('sante.marquerFait')}
                            className={`flex h-8 w-8 items-center justify-center ${ambre ? 'border border-signal-ink' : 'border border-border-strong text-text-secondary'}`}
                          >
                            <Check size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => retirer(r)}
                            aria-label={t('sante.retirer')}
                            title={t('sante.retirer')}
                            className={`flex h-8 w-8 items-center justify-center ${ambre ? 'opacity-70' : 'border border-border text-text-muted'}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <form onSubmit={(e) => { e.preventDefault(); poserUnRappel(); }} className="mt-4 flex flex-wrap gap-2 border-t border-border-strong pt-4">
                  <input type="date" value={echeanceQuand} onChange={(e) => setEcheanceQuand(e.target.value)} aria-label={t('sante.champEcheance')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
                  <input value={echeance} onChange={(e) => setEcheance(e.target.value)} maxLength={80} placeholder={t('sante.champRappel')} aria-label={t('sante.champRappel')} className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
                  <button type="submit" disabled={!echeance.trim() || !echeanceQuand} aria-label={t('sante.poserUnRappel')} className="flex h-11 w-11 items-center justify-center bg-accent text-bg disabled:opacity-40"><Plus size={16} strokeWidth={2.5} /></button>
                </form>

                {/* EN PIED DE PAGE DROITE — stockage, chiffrement, synchronisation. */}
                <div className="mt-5 border-t border-border pt-4">
                  <p className="eyebrow mb-2">{t('sante.oCaVit')}</p>
                  <ul className="flex flex-col gap-1.5">
                    {[t('sante.stockage'), t('sante.chiffrement'), t('sante.synchronisation'), t('sante.pasDeNotification')].map((phrase) => (
                      <li key={phrase} className="flex items-baseline gap-2 text-sm leading-relaxed text-text-secondary">
                        <span aria-hidden className="text-text-muted">—</span>
                        <span>{phrase}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </motion.section>
    </EcranVide>
  );
}
