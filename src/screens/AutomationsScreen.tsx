import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Workflow } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useMembers } from '../state/useMembers';
import { ACTIONS, DECLENCHEURS, type Action, type AutomationData, type Declencheur } from '../state/useAutomations';
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
        <motion.ul variants={staggerItem} className="flex flex-col gap-2">
          {triees.map((r) => (
            <li key={r.id} className={`group flex flex-wrap items-center gap-3 rounded-xl border bg-surface p-3 ${r.enabled ? 'border-border' : 'border-dashed border-border opacity-70'}`}>
              <Workflow size={16} className="shrink-0 text-text-muted" />
              <p className="min-w-0 flex-1 text-sm text-text-primary">
                <span className="text-text-muted">{t('automatisations.si')} </span>{declencheur(r.trigger)}<span className="text-text-muted">, {t('automatisations.alors').toLowerCase()} </span>{resultat(r.action)}
                {r.action === 'task' && r.assigneeEmail && <span className="text-text-muted"> · {r.assigneeEmail}</span>}
              </p>
              <button type="button" onClick={() => void upsert('automations', r.id, { ...r, enabled: !r.enabled })} aria-pressed={r.enabled} className="min-h-11 border border-border px-3 text-xs text-text-secondary hover:text-text-primary md:min-h-0 md:py-1">{r.enabled ? t('automatisations.suspendre') : t('automatisations.reprendre')}</button>
              <button type="button" onClick={() => void remove('automations', r.id)} aria-label={t('automatisations.supprimer')} title={t('automatisations.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
            </li>
          ))}
        </motion.ul>
      )}
      <motion.p variants={staggerItem} className="text-xs text-text-muted">{t('automatisations.note')}</motion.p>
    </motion.section>
  );
}
