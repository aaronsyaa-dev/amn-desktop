import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useMembers } from '../state/useMembers';
import { ACTIONS, DECLENCHEURS, useAutomationsParRegle, type Action, type AutomationData, type Declencheur } from '../state/useAutomations';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

/**
 * LES AUTOMATISATIONS — si ceci arrive, alors cela se fait.
 *
 * Pour qui : une boutique qui oublie de rappeler, de relancer, de créer la
 * fiche. Ce que ça règle : des règles simples sur ce qui existe déjà — une
 * réponse de formulaire, une facture échue, une demande SAV ouverte, un
 * prospect gagné, un article sous le seuil — et une tâche ou une ligne de
 * journal qui se crée toute seule, une fois, quel que soit le nombre de
 * postes ouverts (voir `useAutomations`). Cinq déclencheurs, deux actions :
 * assez pour ne rien oublier, pas assez pour devenir une usine.
 */
export function AutomationsScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const { membres } = useMembers();
  const regles = useCollection<AutomationData>('automations');
  const tasks = useCollection<{ title: string }>('tasks');
  const logbook = useCollection<{ text: string }>('logbook');
  const [ouvert, setOuvert] = useState(false);
  const [trigger, setTrigger] = useState<Declencheur>('formAnswer');
  const [action, setAction] = useState<Action>('task');
  const [assignee, setAssignee] = useState('');

  const triees = useMemo(() => [...regles].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [regles]);

  const actives = triees.filter((r) => r.enabled).length;
  const produits = useMemo(() => [...tasks, ...logbook].filter((x) => x.id.startsWith('auto-')).length, [tasks, logbook]);
  const declencheur = (d: Declencheur) => t(`automatisations.si.${d}` as Parameters<typeof t>[0]);
  /* Les libellés que le moteur emploie pour nommer ce qu'il produirait. Ce sont
     les mêmes que ceux d'`AutomationsRunner` : l'écran ne doit pas inventer une
     seconde façon de dire la même chose. */
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
    UNE SEULE RÈGLE PORTE L'AMBRE, et c'est un correctif du 12 septembre.

    La plaque « N en attente » se posait sur CHAQUE règle suspendue ayant des
    éléments en attente. Tant que le bac à sable n'en avait qu'une, la garde
    passait ; en semant la famille « plans », une deuxième est apparue et
    `check:signal` a refusé l'écran — deux plaques ambre, donc aucun signal.

    La règle qui la porte est celle qui a le PLUS d'éléments en attente : c'est
    celle dont la reprise change le plus de choses. Les autres gardent leur
    compte, en encre neutre : l'information reste, l'appel à décider est unique.
  */
  const laPlusEnAttente = useMemo(() => {
    let gagnante: string | null = null;
    let meilleur = 0;
    for (const r of triees) {
      const n = (parRegle.get(r.id)?.enAttente.length ?? 0);
      if (n > meilleur) {
        meilleur = n;
        gagnante = r.id;
      }
    }
    return gagnante;
  }, [triees, parRegle]);
  const resultat = (a: Action) => t(`automatisations.alors.${a}` as Parameters<typeof t>[0]);

  const creer = async () => {
    await upsert('automations', uid('rule'), { trigger, action, enabled: true, assigneeEmail: assignee, createdAt: new Date().toISOString() });
    setOuvert(false);
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('outils.surtitre', { module: t('automatisations.titre') })}
          title={t('automatisations.titre')}
          description={t('automatisations.description')}
          stats={[
            { label: t('automatisations.stat.regles'), value: triees.length },
            { label: t('automatisations.stat.actives'), value: actives },
            { label: t('automatisations.stat.produits'), value: produits, emphasis: produits > 0 },
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

      {triees.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('automatisations.vide.titre')} action={{ label: t('automatisations.vide.action'), onClick: () => setOuvert(true) }}>{t('automatisations.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        /*
          LA PHRASE — l'objet dominant de l'écran Automatisations.

          Une règle était une ligne grise avec une icône, deux boutons et un
          texte de 14 px où « si » et « alors » avaient la même couleur que le
          reste. Or une règle EST une phrase : « si une facture est échue, alors
          créer une tâche ». C'est ce qu'on vient lire, et c'est ce qu'il faut
          pouvoir relire d'un coup d'œil pour vérifier qu'on n'a pas écrit une
          bêtise. Elle passe donc à 21 px, avec « SI » et « ALORS » en surtitre
          — les mots de liaison s'effacent, les termes ressortent.

          L'AMBRE est celui que la table nomme, « 2 en attente », et il ne peut
          apparaître que sur une règle SUSPENDUE — voir `useAutomationsParRegle`
          pour le pourquoi : une règle active n'attend rien. Et sur UNE SEULE
          règle, la plus en attente : voir `laPlusEnAttente`.
        */
        <motion.ul variants={staggerItem} className="flex flex-col gap-3">
          {triees.map((r) => {
            const compte = parRegle.get(r.id) ?? { produits: 0, enAttente: [] };
            const attend = compte.enAttente.length > 0;
            /* Seule la plus en attente est ambre — voir `laPlusEnAttente`. */
            const signale = attend && r.id === laPlusEnAttente;
            return (
              <li
                key={r.id}
                data-signal-groupe={signale ? `attente-${r.id}` : undefined}
                className={`group border ${
                  signale ? 'border-signal-line bg-signal-muted' : r.enabled ? 'panel' : 'border-dashed border-border'
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
                  <p className={`min-w-0 flex-1 text-[18px] leading-[1.4] sm:text-[21px] ${r.enabled ? 'text-text-primary' : 'text-text-muted'}`}>
                    <span className="eyebrow mr-2.5">{t('automatisations.si')}</span>
                    {declencheur(r.trigger)}
                    <span className="eyebrow mx-2.5">{t('automatisations.alors')}</span>
                    {resultat(r.action)}
                  </p>

                  {attend ? (
                    <span
                      className={`flex-shrink-0 px-2.5 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.2em] ${
                        signale ? 'signal-plate' : 'border border-border-strong text-text-secondary'
                      }`}
                    >
                      {t('automatisations.nEnAttente', { n: compte.enAttente.length })}
                    </span>
                  ) : (
                    <span className="eyebrow flex-shrink-0">
                      {r.enabled
                        ? t('automatisations.nProduites', { n: compte.produits })
                        : t('automatisations.desactivee')}
                    </span>
                  )}

                  {/*
                    L'INTERRUPTEUR DIT SON ÉTAT PAR SA FORME, pas par un mot qui
                    change. « Suspendre » / « Reprendre » obligeait à lire le
                    bouton pour savoir dans quel état on est — un bouton nomme
                    ce qu'il FERA, donc il dit l'inverse de l'état courant.
                  */}
                  <button
                    type="button"
                    onClick={() => void upsert('automations', r.id, { ...r, enabled: !r.enabled })}
                    role="switch"
                    aria-checked={r.enabled}
                    aria-label={r.enabled ? t('automatisations.suspendre') : t('automatisations.reprendre')}
                    className={`relative flex h-7 w-12 flex-shrink-0 items-center border transition-colors ${
                      r.enabled ? 'border-text-primary bg-text-primary' : 'border-border-strong bg-transparent'
                    }`}
                  >
                    <span
                      className={`absolute h-5 w-5 transition-all ${
                        r.enabled ? 'left-[26px] bg-bg' : 'left-[2px] bg-border-strong'
                      }`}
                    />
                  </button>

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

                {/* Ce que la règle produirait si on la reprenait — nommé, pas
                    compté : « 2 en attente » ne dit pas lesquelles. */}
                {attend && (
                  <div className={`border-t px-5 py-4 ${signale ? 'border-signal-line/40' : 'border-border'}`}>
                    <ul className="flex flex-col gap-2">
                      {compte.enAttente.slice(0, 3).map((source) => (
                        <li key={source.id} className="flex flex-wrap items-baseline gap-x-3">
                          <span className="eyebrow flex-shrink-0">{t('automatisations.aProduire')}</span>
                          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-text-primary">
                            {source.titre}
                          </span>
                        </li>
                      ))}
                      {compte.enAttente.length > 3 && (
                        <li className="eyebrow">+ {compte.enAttente.length - 3}</li>
                      )}
                    </ul>
                    <p className="eyebrow mt-3.5 leading-[1.7]">
                      {r.action === 'task' && r.assigneeEmail
                        ? t('automatisations.assigneesA', { qui: r.assigneeEmail.split('@')[0] })
                        : t('automatisations.unEnregistrementParSource')}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </motion.ul>
      )}

      <motion.p variants={staggerItem} className="text-xs text-text-muted">{t('automatisations.note')}</motion.p>
    </motion.section>
  );
}
