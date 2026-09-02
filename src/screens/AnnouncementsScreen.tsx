import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Megaphone, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { UserAvatar } from '../components/UserAvatar';
import { FirstRun } from '../components/EmptyState';
import { useAuth } from '../auth/AuthContext';
import { isAdminRole } from '../auth/roles';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useProfiles } from '../state/ProfilesContext';
import { useMembers } from '../state/useMembers';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface AnnouncementData {
  title: string;
  body: string;
  authorEmail: string;
  createdAt: string;
  readBy: string[];
}

/**
 * LES ANNONCES — ce que tout le monde doit avoir lu.
 *
 * Pour qui : la personne qui gère et qui, aujourd'hui, redit trois fois la
 * même chose dans le fil parce que le fil défile. Ce que ça règle : une
 * annonce reste en haut jusqu'à ce que chacun l'ait lue, et l'auteure voit
 * QUI l'a lue — pas un « vu » anonyme, des noms. Rien d'autre : ni
 * commentaires (c'est le fil), ni pièces jointes (c'est Médias).
 */
export function AnnouncementsScreen() {
  const { t } = useLangue();
  const { user, role } = useAuth();
  const { upsert, remove } = useSync();
  const { profileFor } = useProfiles();
  const { membres } = useMembers();
  const brutes = useCollection<AnnouncementData>('announcements');
  const [titre, setTitre] = useState('');
  const [corps, setCorps] = useState('');
  const [ouverte, setOuverte] = useState(false);

  const moi = user?.email ?? '';
  const annonces = useMemo(() => [...brutes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [brutes]);
  const nonLues = annonces.filter((a) => !(a.readBy ?? []).includes(moi) && a.authorEmail !== moi);

  const publier = async () => {
    if (!titre.trim() || !moi) return;
    await upsert('announcements', uid('ann'), {
      title: titre.trim(),
      body: corps.trim(),
      authorEmail: moi,
      createdAt: new Date().toISOString(),
      readBy: [moi],
    });
    setTitre('');
    setCorps('');
    setOuverte(false);
  };
  const lire = (a: AnnouncementData & { id: string }) =>
    upsert('announcements', a.id, { ...a, readBy: [...new Set([...(a.readBy ?? []), moi])] });

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('collectif.surtitre', { module: t('annonces.titre') })}
          title={t('annonces.titre')}
          description={t('annonces.description')}
          stats={[
            { label: t('annonces.stat.nonLues'), value: nonLues.length, emphasis: nonLues.length > 0 },
            { label: t('annonces.stat.total'), value: annonces.length },
          ]}
          actions={
            <button type="button" onClick={() => setOuverte((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Megaphone size={16} strokeWidth={2} />
              {t('annonces.publier')}
            </button>
          }
        />
      </motion.div>

      {ouverte && (
        <motion.form
          variants={staggerItem}
          onSubmit={(e) => {
            e.preventDefault();
            void publier();
          }}
          className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
        >
          <input
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder={t('annonces.champTitre')}
            aria-label={t('annonces.champTitre')}
            className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none"
            autoFocus
          />
          <textarea
            value={corps}
            onChange={(e) => setCorps(e.target.value)}
            placeholder={t('annonces.champCorps')}
            aria-label={t('annonces.champCorps')}
            rows={4}
            className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={!titre.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">
              {t('annonces.envoyer')}
            </button>
            <button type="button" onClick={() => setOuverte(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
              {t('chrome.fermer')}
            </button>
          </div>
        </motion.form>
      )}

      {annonces.length === 0 && !ouverte ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('annonces.vide.titre')} action={{ label: t('annonces.vide.action'), onClick: () => setOuverte(true) }}>
            {t('annonces.vide.texte')}
          </FirstRun>
        </motion.div>
      ) : (
        <motion.ul variants={staggerItem} className="flex flex-col gap-3">
          {annonces.map((a) => {
            const lus = a.readBy ?? [];
            const lue = lus.includes(moi);
            const peutSupprimer = a.authorEmail === moi || isAdminRole(role);
            return (
              <li key={a.id} className={`rounded-xl border bg-surface p-4 ${lue ? 'border-border' : 'border-border-strong'}`}>
                <div className="flex items-start gap-3">
                  <UserAvatar email={a.authorEmail} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug text-text-primary [overflow-wrap:anywhere]">{a.title}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {profileFor(a.authorEmail).name} · {relativeTime(a.createdAt)}
                    </p>
                    {a.body && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{a.body}</p>}
                    <p className="mt-3 text-xs text-text-muted" title={lus.map((e) => profileFor(e).name).join(', ')}>
                      {t('annonces.luPar', { n: lus.length, total: Math.max(membres.length, lus.length) })}
                      {lus.length > 0 && <span> · {lus.map((e) => profileFor(e).name).join(', ')}</span>}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 flex-col gap-1.5">
                    {!lue && (
                      <button type="button" onClick={() => void lire(a)} className="flex min-h-11 items-center gap-1.5 border border-border-strong px-3 text-xs text-text-primary hover:bg-surface-hover md:min-h-0 md:py-1.5">
                        <Check size={13} /> {t('annonces.marquerLu')}
                      </button>
                    )}
                    {peutSupprimer && (
                      <button type="button" onClick={() => void remove('announcements', a.id)} aria-label={t('annonces.supprimer')} title={t('annonces.supprimer')} className="flex min-h-11 items-center justify-center border border-border px-3 text-text-muted hover:text-danger md:min-h-0 md:py-1.5">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </motion.ul>
      )}
    </motion.section>
  );
}
