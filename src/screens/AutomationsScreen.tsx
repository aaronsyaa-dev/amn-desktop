import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { EcranVide, useHaloSignal } from '../components/EtatEcran';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useMembers } from '../state/useMembers';
import { ACTIONS, DECLENCHEURS, useAutomationsParRegle, type Action, type AutomationData, type Declencheur } from '../state/useAutomations';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

/*
  ══════════════════════════════════════════════════════════════════════
  LA BASCULE ET SA TRACE — pourquoi une liste d'interrupteurs ne suffit pas
  ══════════════════════════════════════════════════════════════════════

  Une règle activée et une règle qui SERT ont exactement la même allure dans
  une liste : un interrupteur allumé. Or la moitié des règles d'un produit
  comme celui-ci sont allumées et muettes — écrites un jour pour un cas qui
  n'est jamais revenu. On ne les désactive pas, on ne les supprime pas : on
  ne sait tout simplement pas qu'elles ne font rien.

  La trace le dit sans un mot. Trente jours en abscisse, une impulsion par
  jour à la hauteur de ce que la règle a écrit ce jour-là, et une ligne plate
  de 2 px les jours sans rien. UNE RÈGLE MUETTE EST DONC UNE LIGNE
  PARFAITEMENT PLATE, sur toute la largeur — et c'est ce qu'on repère du
  premier coup d'œil, à travers dix règles.

  DEUX RÈGLES DE DESSIN qui ne se négocient pas :

  · une règle DÉSACTIVÉE a une trace entièrement plate, jamais absente. Retirer
    la trace ferait disparaître la preuve qu'elle ne tourne pas, c'est-à-dire
    exactement l'information qu'on est venu chercher ;
  · l'interrupteur éteint a le fond des actions inactives et une pastille
    `#4a4a48`. Il reste VISIBLE — un interrupteur éteint qui se fond dans le
    fond ne se distingue plus d'un interrupteur absent. Le système de design
    donne la valeur en dur (#242424) ; c'est exactement celle du jeton
    `--color-action-inactive`, et c'est le jeton qu'on emploie : une bascule
    éteinte EST une action inactive, elle n'a aucune raison de diverger.
*/
const TRACE_JOURS = 30;
const TRACE_H = 34;
const TRACE_PLAT = 2;
const BASCULE_L = 38;
const BASCULE_H = 21;
const PASTILLE = 15;

const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Les trente derniers jours, du plus ancien au plus récent. */
function fenetreDeTrente(): string[] {
  const out: string[] = [];
  const base = new Date();
  for (let i = TRACE_JOURS - 1; i >= 0; i -= 1) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
    out.push(isoJour(d));
  }
  return out;
}

interface Produit {
  id: string;
  titre: string;
  quand: string;
}

/**
 * LES AUTOMATISATIONS — si ceci arrive, alors cela se fait.
 *
 * Pour qui : une boutique qui oublie de rappeler, de relancer, de créer la
 * fiche. Des règles simples sur ce qui existe déjà — une réponse de
 * formulaire, une facture échue, une demande SAV, un prospect gagné, un
 * article sous le seuil — et une tâche ou une ligne de journal qui se crée
 * toute seule, une fois, quel que soit le nombre de postes ouverts (voir
 * `useAutomations`).
 *
 * ## Ce qui domine : la bascule ET sa trace
 *
 * L'écran montrait la RÈGLE comme une phrase (« si une facture est échue,
 * alors créer une tâche »), ce qui répondait bien à « qu'ai-je écrit ». Mais
 * une phrase ne dit pas si la règle sert, et c'est la question qui vient
 * ensuite. Voir l'en-tête des constantes.
 *
 * La trace n'a demandé aucune donnée nouvelle : le moteur écrit ses résultats
 * sous un identifiant déterministe `auto-<règle>-<source>`, et ces
 * enregistrements portent leur date. Il suffisait de les regrouper par jour.
 *
 * ## L'ambre : la règle qui PRODUIT
 *
 * Sa bascule, sa trace et son horodatage de dernier déclenchement — trois
 * nœuds, une ligne, une région. C'est un changement par rapport à la version
 * précédente, qui mettait l'ambre sur la règle suspendue la plus en attente.
 * Les deux se défendent ; la table du module `20d` tranche pour celle qui
 * produit, et elle a raison sur un point que l'autre manquait : ce qu'on
 * cherche sur cet écran, c'est laquelle de ces mécaniques porte réellement le
 * travail — pour savoir ce qu'on casse en y touchant.
 */
export function AutomationsScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const { membres } = useMembers();
  const regles = useCollection<AutomationData>('automations');
  const tasks = useCollection<{ title: string; createdAt: string }>('tasks');
  const logbook = useCollection<{ text: string; at: string }>('logbook');
  const [ouvert, setOuvert] = useState(false);
  const [trigger, setTrigger] = useState<Declencheur>('formAnswer');
  const [action, setAction] = useState<Action>('task');
  const [assignee, setAssignee] = useState('');

  const triees = useMemo(() => [...regles].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [regles]);
  const actives = triees.filter((r) => r.enabled).length;
  const declencheur = (d: Declencheur) => t(`automatisations.si.${d}` as Parameters<typeof t>[0]);
  const resultat = (a: Action) => t(`automatisations.alors.${a}` as Parameters<typeof t>[0]);
  const libelles = useMemo<Record<Declencheur, (a: string, b: string) => string>>(
    () => ({
      formAnswer: (formulaire, premiere) => t('automatisations.produit.formAnswer', { formulaire, premiere }),
      invoiceOverdue: (client, numero) => t('automatisations.produit.invoiceOverdue', { client, numero }),
      ticketOpened: (sujet, client) => t('automatisations.produit.ticketOpened', { sujet, client }),
      prospectWon: (nom, societe) => t('automatisations.produit.prospectWon', { nom, societe }),
      stockLow: (article, quantite) => t('automatisations.produit.stockLow', { article, quantite }),
    }),
    [t],
  );
  const parRegle = useAutomationsParRegle(libelles);

  /*
    CE QUE CHAQUE RÈGLE A ÉCRIT, ET QUAND. Les tâches et les lignes de journal
    nées d'une automatisation se reconnaissent à leur préfixe ; leur date est
    celle qu'elles portent déjà. Aucune donnée nouvelle, aucun journal à tenir.
  */
  const produitsParRegle = useMemo(() => {
    const par = new Map<string, Produit[]>();
    for (const r of triees) {
      const prefixe = `auto-${r.id}-`;
      const siens: Produit[] = [
        ...tasks.filter((x) => x.id.startsWith(prefixe)).map((x) => ({ id: x.id, titre: x.title, quand: x.createdAt })),
        ...logbook.filter((x) => x.id.startsWith(prefixe)).map((x) => ({ id: x.id, titre: x.text, quand: x.at })),
      ].sort((a, b) => (b.quand ?? '').localeCompare(a.quand ?? ''));
      par.set(r.id, siens);
    }
    return par;
  }, [triees, tasks, logbook]);

  const jours = useMemo(() => fenetreDeTrente(), []);
  const traces = useMemo(() => {
    const par = new Map<string, number[]>();
    let plafond = 1;
    for (const r of triees) {
      const parJour = jours.map(
        (j) => (produitsParRegle.get(r.id) ?? []).filter((p) => (p.quand ?? '').slice(0, 10) === j).length,
      );
      /* Une règle DÉSACTIVÉE garde sa trace, entièrement plate. On ne la vide
         pas : on la met à zéro, ce qui n'est pas la même chose à l'écran. */
      par.set(r.id, r.enabled ? parJour : parJour.map(() => 0));
      plafond = Math.max(plafond, ...par.get(r.id)!);
    }
    return { par, plafond };
  }, [triees, jours, produitsParRegle]);

  /* LA RÈGLE QUI PRODUIT : celle qui a le plus écrit sur les trente jours. */
  const laQuiProduit = useMemo(() => {
    let gagnante: string | null = null;
    let meilleur = 0;
    for (const r of triees) {
      const n = (traces.par.get(r.id) ?? []).reduce((s, x) => s + x, 0);
      if (n > meilleur) {
        meilleur = n;
        gagnante = r.id;
      }
    }
    return gagnante;
  }, [triees, traces]);
  const halo = useHaloSignal(Boolean(laQuiProduit));

  /*
    LA RÈGLE MUETTE DEPUIS SA CRÉATION, et ce qu'elle laisse passer.

    Une règle désactivée qui n'a JAMAIS rien produit n'est pas une curiosité
    d'écran : c'est un trou dans le produit. Les enregistrements qu'elle aurait
    dû traiter existent, ils sont comptés par `useAutomationsParRegle`, et
    personne ne les voit. La phrase le dit avec le chiffre, pas en général.
  */
  const muetteDepuisToujours = useMemo(() => {
    for (const r of triees) {
      const rien = (produitsParRegle.get(r.id) ?? []).length === 0;
      const attente = parRegle.get(r.id)?.enAttente.length ?? 0;
      if (!r.enabled && rien && attente > 0) return { regle: r, attente };
    }
    return null;
  }, [triees, produitsParRegle, parRegle]);

  const jamaisTourne = useMemo(
    () => triees.filter((r) => (produitsParRegle.get(r.id) ?? []).length === 0),
    [triees, produitsParRegle],
  );
  const ceMois = useMemo(() => {
    if (!laQuiProduit) return [];
    const debut = new Date();
    debut.setDate(debut.getDate() - 30);
    const borne = debut.toISOString();
    return (produitsParRegle.get(laQuiProduit) ?? []).filter((p) => (p.quand ?? '') >= borne);
  }, [laQuiProduit, produitsParRegle]);

  const creer = async () => {
    await upsert('automations', uid('rule'), { trigger, action, enabled: true, assigneeEmail: assignee, createdAt: new Date().toISOString() });
    setOuvert(false);
  };

  const vide = triees.length === 0 && !ouvert;
  const totalProduits = useMemo(() => [...tasks, ...logbook].filter((x) => x.id.startsWith('auto-')).length, [tasks, logbook]);

  return (
    <EcranVide quand={vide} premierJour={vide}>
      <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
        <motion.div variants={staggerItem}>
          <ScreenHeader
            eyebrow={t('outils.surtitre', { module: t('automatisations.titre') })}
            title={t('automatisations.titre')}
            description={t('automatisations.description')}
            phraseVide={t('automatisations.vide.phrase')}
            stats={[
              { label: t('automatisations.stat.regles'), value: triees.length },
              { label: t('automatisations.stat.actives'), value: actives },
              { label: t('automatisations.stat.produits'), value: totalProduits, emphasis: totalProduits > 0 },
            ]}
            actions={
              <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
                <Plus size={16} strokeWidth={2} /> {t('automatisations.ajouter')}
              </button>
            }
          />
        </motion.div>

        {ouvert && (
          <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void creer(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs text-text-muted">{t('automatisations.si')}
              <select value={trigger} onChange={(e) => setTrigger(e.target.value as Declencheur)} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none">
                {DECLENCHEURS.map((d) => <option key={d} value={d}>{declencheur(d)}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">{t('automatisations.alors')}
              <select value={action} onChange={(e) => setAction(e.target.value as Action)} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none">
                {ACTIONS.map((a) => <option key={a} value={a}>{resultat(a)}</option>)}
              </select>
            </label>
            {action === 'task' && (
              <label className="flex flex-col gap-1 text-xs text-text-muted">{t('automatisations.pour')}
                <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none">
                  <option value="">{t('automatisations.personne')}</option>
                  {membres.filter((m) => m.status === 'active').map((m) => <option key={m.id} value={m.email}>{m.email}</option>)}
                </select>
              </label>
            )}
            <div className="flex flex-wrap gap-2 sm:col-span-3">
              <button type="submit" className="bg-accent px-4 py-2 text-sm font-semibold text-bg">{t('automatisations.enregistrer')}</button>
              <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
            </div>
          </motion.form>
        )}

        {vide ? (
          <motion.div variants={staggerItem}>
            <FirstRun title={t('automatisations.vide.titre')} action={{ label: t('automatisations.vide.action'), onClick: () => setOuvert(true) }}>{t('automatisations.vide.texte')}</FirstRun>
          </motion.div>
        ) : (
          <>
            {/* ═══ L'OBJET DOMINANT : les bascules et leurs traces ═══ */}
            <motion.section variants={staggerItem} className={`panel-raised p-5 sm:p-6 ${halo}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="eyebrow">{t('automatisations.lesTraces')}</p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('automatisations.trenteJours')}</p>
              </div>

              <ul className="mt-5 flex flex-col gap-5">
                {triees.map((r) => {
                  const trace = traces.par.get(r.id) ?? [];
                  const siens = produitsParRegle.get(r.id) ?? [];
                  const ambre = r.id === laQuiProduit;
                  const dernier = siens[0];
                  return (
                    <li key={r.id} className="group flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        {/* L'INTERRUPTEUR — 38 × 21, et il dit son état par sa forme. */}
                        <button
                          type="button"
                          onClick={() => void upsert('automations', r.id, { ...r, enabled: !r.enabled })}
                          role="switch"
                          aria-checked={r.enabled}
                          aria-label={r.enabled ? t('automatisations.suspendre') : t('automatisations.reprendre')}
                          data-signal-groupe={ambre ? `produit-${r.id}` : undefined}
                          className="relative flex flex-shrink-0 items-center transition-colors"
                          style={{
                            width: BASCULE_L,
                            height: BASCULE_H,
                            backgroundColor: r.enabled ? (ambre ? 'var(--color-signal)' : 'var(--color-text-body)') : 'var(--color-action-inactive)',
                          }}
                        >
                          <span
                            className="absolute transition-all"
                            style={{
                              width: PASTILLE,
                              height: PASTILLE,
                              left: r.enabled ? BASCULE_L - PASTILLE - 3 : 3,
                              backgroundColor: r.enabled ? (ambre ? 'var(--color-signal-ink)' : 'var(--color-bg)') : '#4a4a48',
                            }}
                          />
                        </button>

                        <p className={`min-w-0 flex-1 text-[15px] leading-snug ${r.enabled ? 'text-text-primary' : 'text-text-muted'}`}>
                          <span className="eyebrow mr-2">{t('automatisations.si')}</span>
                          {declencheur(r.trigger)}
                          <span className="eyebrow mx-2">{t('automatisations.alors')}</span>
                          {resultat(r.action)}
                        </p>

                        <span
                          data-signal-groupe={ambre ? `produit-${r.id}` : undefined}
                          className={`flex-shrink-0 font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] ${
                            ambre ? 'bg-signal px-1.5 py-0.5 text-signal-ink' : 'text-text-muted'
                          }`}
                        >
                          {dernier && r.enabled
                            ? t('automatisations.dernierDeclenchement', { quand: relativeTime(dernier.quand) })
                            : r.enabled
                              ? t('automatisations.jamaisDeclenchee')
                              : t('automatisations.desactivee')}
                        </span>

                        <button
                          type="button"
                          onClick={() => void remove('automations', r.id)}
                          aria-label={t('automatisations.supprimer')}
                          title={t('automatisations.supprimer')}
                          className="flex-shrink-0 text-text-muted opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 size={13} strokeWidth={1.9} />
                        </button>
                      </div>

                      {/* LA TRACE — une impulsion par jour, une ligne plate sinon. */}
                      <div
                        data-signal-groupe={ambre ? `produit-${r.id}` : undefined}
                        className="flex w-full items-end gap-px"
                        style={{ height: TRACE_H }}
                        aria-hidden
                      >
                        {trace.map((n, i) => (
                          <span
                            key={jours[i]}
                            className="min-w-0 flex-1"
                            style={{
                              height: n === 0 ? TRACE_PLAT : Math.max(4, (n / traces.plafond) * TRACE_H),
                              backgroundColor:
                                n === 0
                                  ? 'var(--color-border)'
                                  : ambre
                                    ? 'var(--color-signal)'
                                    : 'var(--color-border-strong)',
                            }}
                          />
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* SOUS LES RÈGLES — ce qu'une règle muette laisse passer. */}
              {muetteDepuisToujours && (
                <p className="mt-6 max-w-prose border-t border-border-strong pt-4 text-sm leading-relaxed text-text-body">
                  {t('automatisations.muetteDepuisCreation', {
                    si: declencheur(muetteDepuisToujours.regle.trigger),
                    n: muetteDepuisToujours.attente,
                  })}
                </p>
              )}
            </motion.section>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* À GAUCHE — ce que la règle qui produit a écrit ce mois-ci. */}
              <motion.section variants={staggerItem} className="panel">
                <p className="eyebrow border-b border-border px-4 py-2.5">{t('automatisations.ceQuElleAProduit')}</p>
                {ceMois.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-text-muted">{t('automatisations.rienCeMois')}</p>
                ) : (
                  <ul className="flex flex-col">
                    {ceMois.slice(0, 8).map((p) => (
                      <li key={p.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border px-4 py-2.5 last:border-b-0">
                        <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{p.titre}</span>
                        <span className="flex-shrink-0 font-mono text-[10px] uppercase tracking-wider text-text-muted">{relativeTime(p.quand)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.section>

              {/* À DROITE — celles qui n'ont jamais tourné. */}
              <motion.aside variants={staggerItem} className="panel p-4">
                <p className="eyebrow mb-3">{t('automatisations.jamaisTourne')}</p>
                {jamaisTourne.length === 0 ? (
                  <p className="text-sm leading-relaxed text-text-secondary">{t('automatisations.toutesServent')}</p>
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {jamaisTourne.map((r) => (
                      <li key={r.id} className="flex flex-col gap-0.5">
                        <span className="text-sm leading-snug text-text-secondary">{declencheur(r.trigger)}</span>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                          {t('automatisations.ecriteIlYa', { quand: relativeTime(r.createdAt) })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.aside>
            </div>

            <motion.p variants={staggerItem} className="text-xs text-text-muted">{t('automatisations.note')}</motion.p>
          </>
        )}
      </motion.section>
    </EcranVide>
  );
}
