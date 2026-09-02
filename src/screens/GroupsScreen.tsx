import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowUp, Plus, Trash2, UsersRound } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { UserAvatar } from '../components/UserAvatar';
import { useAuth } from '../auth/AuthContext';
import { isAdminRole } from '../auth/roles';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useProfiles } from '../state/ProfilesContext';
import { useMembers } from '../state/useMembers';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface GroupData {
  name: string;
  members: string[];
  createdBy: string;
  createdAt: string;
}
interface GroupMessageData {
  groupId: string;
  authorEmail: string;
  body: string;
  createdAt: string;
}

/**
 * LES GROUPES — des fils à plusieurs, par sujet ou par équipe.
 *
 * Pour qui : une organisation de dix personnes où « la boutique », « les
 * livraisons » et « le bureau » n'ont pas les mêmes conversations. Ce que
 * ça règle : le fil unique qui mélange tout. Un groupe est une liste de
 * personnes et un nom ; son fil ne s'affiche qu'à ses membres. Celle qui
 * crée le groupe le compose ; un admin peut le dissoudre.
 */
export function GroupsScreen() {
  const { t } = useLangue();
  const { user, role } = useAuth();
  const { upsert, remove } = useSync();
  const { profileFor } = useProfiles();
  const { membres } = useMembers();
  const groupes = useCollection<GroupData>('groups');
  const messages = useCollection<GroupMessageData>('groupMessages');
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [creation, setCreation] = useState(false);
  const [nom, setNom] = useState('');
  const [choisis, setChoisis] = useState<string[]>([]);
  const [texte, setTexte] = useState('');
  const fin = useRef<HTMLDivElement | null>(null);
  const moi = user?.email ?? '';
  const admin = isAdminRole(role);

  const miens = useMemo(
    () => groupes.filter((g) => admin || (g.members ?? []).includes(moi)).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [groupes, moi, admin],
  );
  const groupe = miens.find((g) => g.id === ouvert) ?? null;
  const fil = useMemo(
    () => (groupe ? messages.filter((m) => m.groupId === groupe.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : []),
    [messages, groupe],
  );
  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'end' });
  }, [fil.length, ouvert]);

  const creer = async () => {
    if (!nom.trim() || !moi) return;
    const id = uid('grp');
    await upsert('groups', id, { name: nom.trim(), members: [...new Set([moi, ...choisis])], createdBy: moi, createdAt: new Date().toISOString() });
    setNom('');
    setChoisis([]);
    setCreation(false);
    setOuvert(id);
  };
  const envoyer = async () => {
    const corps = texte.trim();
    if (!corps || !groupe || !moi) return;
    setTexte('');
    await upsert('groupMessages', uid('gm'), { groupId: groupe.id, authorEmail: moi, body: corps, createdAt: new Date().toISOString() });
  };
  const dissoudre = async (g: GroupData & { id: string }) => {
    for (const m of messages.filter((x) => x.groupId === g.id)) await remove('groupMessages', m.id);
    await remove('groups', g.id);
    setOuvert(null);
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('collectif.surtitre', { module: t('groupes.titre') })}
          title={t('groupes.titre')}
          description={t('groupes.description')}
          stats={[
            { label: t('groupes.stat.groupes'), value: miens.length },
            { label: t('groupes.stat.messages'), value: messages.filter((m) => miens.some((g) => g.id === m.groupId)).length },
          ]}
          actions={
            <button type="button" onClick={() => setCreation((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('groupes.nouveau')}
            </button>
          }
        />
      </motion.div>

      {creation && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void creer(); }} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder={t('groupes.champNom')} aria-label={t('groupes.champNom')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <p className="eyebrow">{t('groupes.membres')}</p>
          <div className="flex flex-wrap gap-2">
            {membres.filter((m) => m.email !== moi).map((m) => {
              const on = choisis.includes(m.email);
              return (
                <button key={m.id} type="button" aria-pressed={on} onClick={() => setChoisis((prev) => (on ? prev.filter((e) => e !== m.email) : [...prev, m.email]))} className={`flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm md:min-h-0 md:py-1.5 ${on ? 'border-accent text-text-primary' : 'border-border text-text-secondary'}`}>
                  <UserAvatar email={m.email} size={20} /> {profileFor(m.email).name}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={!nom.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('groupes.creer')}</button>
            <button type="button" onClick={() => setCreation(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {miens.length === 0 && !creation ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('groupes.vide.titre')} action={{ label: t('groupes.vide.action'), onClick: () => setCreation(true) }}>{t('groupes.vide.texte')}</FirstRun>
        </motion.div>
      ) : miens.length > 0 ? (
        <motion.div variants={staggerItem} className="grid min-h-[60vh] gap-3 md:grid-cols-[17rem_1fr]">
          <ul className={`flex flex-col gap-px overflow-hidden rounded-xl border border-border bg-border ${ouvert ? 'hidden md:flex' : ''}`}>
            {miens.map((g) => (
              <li key={g.id}>
                <button type="button" onClick={() => setOuvert(g.id)} aria-current={ouvert === g.id ? 'true' : undefined} className={`flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left ${ouvert === g.id ? 'bg-accent-muted' : 'bg-surface hover:bg-surface-hover'}`}>
                  <UsersRound size={18} className="flex-shrink-0 text-text-secondary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-text-primary">{g.name}</span>
                    <span className="block truncate text-xs text-text-muted">{t('groupes.nMembres', { n: (g.members ?? []).length })}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className={`flex min-h-0 flex-col rounded-xl border border-border bg-surface ${ouvert ? '' : 'hidden md:flex'}`}>
            {!groupe ? (
              <p className="m-auto p-6 text-sm text-text-secondary">{t('groupes.choisir')}</p>
            ) : (
              <>
                <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <button type="button" onClick={() => setOuvert(null)} aria-label={t('dm.retour')} className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-hover md:hidden"><ArrowLeft size={16} /></button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">{groupe.name}</p>
                    <p className="truncate text-xs text-text-muted">{(groupe.members ?? []).map((e) => profileFor(e).name).join(', ')}</p>
                  </div>
                  <div className="flex -space-x-1.5">{(groupe.members ?? []).slice(0, 5).map((e) => <UserAvatar key={e} email={e} size={22} />)}</div>
                  {(groupe.createdBy === moi || admin) && (
                    <button type="button" onClick={() => void dissoudre(groupe)} aria-label={t('groupes.dissoudre')} title={t('groupes.dissoudre')} className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:text-danger"><Trash2 size={14} /></button>
                  )}
                </header>
                <div className="flex min-h-[40vh] flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
                  {fil.length === 0 && <p className="m-auto text-sm text-text-muted">{t('groupes.premier')}</p>}
                  {fil.map((m) => {
                    const mien = m.authorEmail === moi;
                    return (
                      <div key={m.id} className={`group flex max-w-[80%] gap-2 ${mien ? 'self-end flex-row-reverse' : 'self-start'}`}>
                        {!mien && <UserAvatar email={m.authorEmail} size={24} />}
                        <div className={`flex flex-col ${mien ? 'items-end' : 'items-start'}`}>
                          {!mien && <span className="text-[11px] text-text-muted">{profileFor(m.authorEmail).name}</span>}
                          <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed [overflow-wrap:anywhere] ${mien ? 'bg-accent-muted' : 'bg-bg'} text-text-primary`}>{m.body}</div>
                          <span className="mt-0.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                            {relativeTime(m.createdAt)}
                            {(mien || admin) && (
                              <button type="button" onClick={() => void remove('groupMessages', m.id)} aria-label={t('dm.supprimer')} title={t('dm.supprimer')} className="opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100"><Trash2 size={11} /></button>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={fin} />
                </div>
                <form onSubmit={(e) => { e.preventDefault(); void envoyer(); }} className="flex items-center gap-2 border-t border-border p-2">
                  <input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={t('groupes.ecrire', { nom: groupe.name })} aria-label={t('groupes.ecrire', { nom: groupe.name })} className="input-focus min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
                  <button type="submit" disabled={!texte.trim()} aria-label={t('dm.envoyer')} className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-bg disabled:opacity-40"><ArrowUp size={16} strokeWidth={2.5} /></button>
                </form>
              </>
            )}
          </div>
        </motion.div>
      ) : null}
    </motion.section>
  );
}
