import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowUp, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { UserAvatar } from '../components/UserAvatar';
import { useAuth } from '../auth/AuthContext';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useProfiles } from '../state/ProfilesContext';
import { useMembers } from '../state/useMembers';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';
import { useNavigate } from 'react-router-dom';

interface DmData {
  from: string;
  to: string;
  body: string;
  createdAt: string;
}

/** La clé d'une conversation à deux : la même dans les deux sens. */
const cle = (a: string, b: string) => [a, b].sort().join('|');

/**
 * LES MESSAGES PRIVÉS — écrire à une personne, sans le groupe.
 *
 * Pour qui : Mohamed et Riyad, qui se parlaient dans le fil d'équipe pour
 * des choses qui ne regardaient qu'eux deux. Ce que ça règle : une
 * conversation à deux, à côté du fil, avec la présence et la dernière
 * connexion sous les yeux.
 *
 * Une limite dite en clair, parce qu'elle décide de l'usage : la
 * synchronisation est celle de l'ORGANISATION. Ces messages restent hors du
 * fil et hors de l'écran des autres, mais ils vivent dans les données de
 * l'organisation, comme une fiche client — pas dans un coffre chiffré entre
 * deux personnes. Pour un secret, il y a le Coffre-fort.
 */
export function DirectMessagesScreen() {
  const { t } = useLangue();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { upsert, remove, onlineEmails } = useSync();
  const { profileFor } = useProfiles();
  const { membres, prets } = useMembers();
  const brutes = useCollection<DmData>('dms');
  const [avec, setAvec] = useState<string | null>(null);
  const [texte, setTexte] = useState('');
  const fin = useRef<HTMLDivElement | null>(null);
  const moi = user?.email ?? '';

  const autres = useMemo(() => membres.filter((m) => m.email !== moi), [membres, moi]);
  const miens = useMemo(() => brutes.filter((m) => m.from === moi || m.to === moi), [brutes, moi]);
  const dernierPar = useMemo(() => {
    const map = new Map<string, DmData & { id: string }>();
    for (const m of miens) {
      const autre = m.from === moi ? m.to : m.from;
      const prev = map.get(autre);
      if (!prev || prev.createdAt < m.createdAt) map.set(autre, m);
    }
    return map;
  }, [miens, moi]);
  const fil = useMemo(
    () => (avec ? miens.filter((m) => cle(m.from, m.to) === cle(moi, avec)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : []),
    [miens, avec, moi],
  );
  const contacts = useMemo(
    () =>
      [...autres].sort((a, b) => {
        const da = dernierPar.get(a.email)?.createdAt ?? '';
        const db = dernierPar.get(b.email)?.createdAt ?? '';
        return db.localeCompare(da) || profileFor(a.email).name.localeCompare(profileFor(b.email).name, 'fr');
      }),
    [autres, dernierPar, profileFor],
  );

  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'end' });
  }, [fil.length, avec]);

  const envoyer = async () => {
    const corps = texte.trim();
    if (!corps || !avec || !moi) return;
    setTexte('');
    await upsert('dms', uid('dm'), { from: moi, to: avec, body: corps, createdAt: new Date().toISOString() });
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('collectif.surtitre', { module: t('dm.titre') })}
          title={t('dm.titre')}
          description={t('dm.description')}
          stats={[
            { label: t('dm.stat.conversations'), value: dernierPar.size },
            { label: t('dm.stat.enLigne'), value: autres.filter((m) => onlineEmails.has(m.email)).length },
          ]}
        />
      </motion.div>

      {prets && autres.length === 0 ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('dm.vide.titre')} action={{ label: t('dm.vide.action'), onClick: () => navigate('/membres') }}>
            {t('dm.vide.texte')}
          </FirstRun>
        </motion.div>
      ) : (
        <motion.div variants={staggerItem} className="grid min-h-[60vh] gap-3 md:grid-cols-[17rem_1fr]">
          <ul className={`flex flex-col gap-px overflow-hidden rounded-xl border border-border bg-border ${avec ? 'hidden md:flex' : ''}`}>
            {contacts.map((m) => {
              const dernier = dernierPar.get(m.email);
              const online = onlineEmails.has(m.email);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setAvec(m.email)}
                    aria-current={avec === m.email ? 'true' : undefined}
                    className={`flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${avec === m.email ? 'bg-accent-muted' : 'bg-surface hover:bg-surface-hover'}`}
                  >
                    <span className="relative flex-shrink-0">
                      <UserAvatar email={m.email} size={32} />
                      <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${online ? 'bg-success' : 'bg-text-muted'}`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-text-primary">{profileFor(m.email).name}</span>
                      <span className="block truncate text-xs text-text-muted">
                        {dernier ? `${dernier.from === moi ? t('dm.vous') : ''}${dernier.body}` : t('dm.aucunMessage')}
                      </span>
                    </span>
                    {dernier && <span className="flex-shrink-0 font-mono text-[10px] uppercase text-text-muted">{relativeTime(dernier.createdAt)}</span>}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className={`flex min-h-0 flex-col rounded-xl border border-border bg-surface ${avec ? '' : 'hidden md:flex'}`}>
            {!avec ? (
              <p className="m-auto p-6 text-sm text-text-secondary">{t('dm.choisir')}</p>
            ) : (
              <>
                <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <button type="button" onClick={() => setAvec(null)} aria-label={t('dm.retour')} className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-hover md:hidden">
                    <ArrowLeft size={16} />
                  </button>
                  <UserAvatar email={avec} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{profileFor(avec).name}</p>
                    <p className="text-xs text-text-muted">{onlineEmails.has(avec) ? t('equipe.enLigne') : avec}</p>
                  </div>
                </header>
                <div className="flex min-h-[40vh] flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
                  {fil.length === 0 && <p className="m-auto text-sm text-text-muted">{t('dm.premier', { nom: profileFor(avec).name })}</p>}
                  {fil.map((m) => {
                    const mien = m.from === moi;
                    return (
                      <div key={m.id} className={`group flex max-w-[80%] flex-col ${mien ? 'self-end items-end' : 'self-start items-start'}`}>
                        <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed [overflow-wrap:anywhere] ${mien ? 'bg-accent-muted text-text-primary' : 'bg-bg text-text-primary'}`}>{m.body}</div>
                        <span className="mt-0.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                          {relativeTime(m.createdAt)}
                          {mien && (
                            <button type="button" onClick={() => void remove('dms', m.id)} aria-label={t('dm.supprimer')} title={t('dm.supprimer')} className="opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100">
                              <Trash2 size={11} />
                            </button>
                          )}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={fin} />
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void envoyer();
                  }}
                  className="flex items-center gap-2 border-t border-border p-2"
                >
                  <input
                    value={texte}
                    onChange={(e) => setTexte(e.target.value)}
                    placeholder={t('dm.ecrire', { nom: profileFor(avec).name })}
                    aria-label={t('dm.ecrire', { nom: profileFor(avec).name })}
                    className="input-focus min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 text-sm text-text-primary outline-none"
                  />
                  <button type="submit" disabled={!texte.trim()} aria-label={t('dm.envoyer')} className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-bg disabled:opacity-40">
                    <ArrowUp size={16} strokeWidth={2.5} />
                  </button>
                </form>
              </>
            )}
          </div>
        </motion.div>
      )}
    </motion.section>
  );
}
