import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Link2, Phone, PhoneMissed } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { EmptyState, FirstRun } from '../components/EmptyState';
import { UserAvatar } from '../components/UserAvatar';
import { CallLinkPanel } from '../components/call/CallLinkPanel';
import { useAuth } from '../auth/AuthContext';
import { useSync } from '../state/SyncContext';
import { useCall } from '../state/CallContext';
import { useProfiles } from '../state/ProfilesContext';
import { useMembers } from '../state/useMembers';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

/**
 * LES APPELS — appeler un membre, inviter un visiteur par lien.
 *
 * Pour qui : une équipe sur deux villes (AllStore), et une cliente qui veut
 * parler à quelqu'un qui n'a pas de compte — un fournisseur, une cliente à
 * elle. Ce que ça règle : l'appel vivait dans la barre de présence, et le
 * lien d'appel dans un panneau de la Tour, sans écran à eux. Ici les deux :
 * qui est joignable maintenant, les appels manqués, et le lien à usage
 * unique qui ouvre une conversation avec un visiteur — sur les moteurs
 * existants (CallContext, liens d'appel amn-api), rien de nouveau dessous.
 */
export function CallsScreen() {
  const { t } = useLangue();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { onlineEmails, configured } = useSync();
  const { call, callsAvailable, phase, missed, clearMissed } = useCall();
  const { profileFor } = useProfiles();
  const { membres, prets } = useMembers();
  const [lien, setLien] = useState(false);
  const moi = user?.email ?? '';
  const autres = membres.filter((m) => m.email !== moi);
  const joignables = autres.filter((m) => onlineEmails.has(m.email));

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('collectif.surtitre', { module: t('appels.titre') })}
          title={t('appels.titre')}
          description={!configured ? t('appels.indisponible') : joignables.length > 0 ? t('appels.joignables', { n: joignables.length }) : t('appels.personne')}
          stats={[
            { label: t('appels.stat.joignables'), value: joignables.length, emphasis: joignables.length > 0 },
            { label: t('appels.stat.manques'), value: missed.length, emphasis: missed.length > 0 },
          ]}
          actions={
            <button type="button" onClick={() => setLien(true)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Link2 size={16} strokeWidth={2} /> {t('appels.inviter')}
            </button>
          }
        />
      </motion.div>

      {missed.length > 0 && (
        <motion.section variants={staggerItem} className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="eyebrow flex items-center gap-2"><PhoneMissed size={12} /> {t('appels.manques')} · {missed.length}</p>
            <button type="button" onClick={clearMissed} className="text-xs text-text-muted hover:text-text-primary">{t('appels.effacer')}</button>
          </div>
          <ul className="flex flex-col gap-px bg-border">
            {missed.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 bg-surface px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-text-primary"><UserAvatar email={m.fromEmail} size={24} /> {profileFor(m.fromEmail).name}</span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-[10px] uppercase text-text-muted">{relativeTime(m.at)}</span>
                  {onlineEmails.has(m.fromEmail) && (
                    <button type="button" onClick={() => void call(m.fromEmail)} disabled={!callsAvailable || phase !== 'idle'} className="flex min-h-11 items-center gap-1.5 border border-border-strong px-3 text-xs text-text-primary md:min-h-0 md:py-1.5"><Phone size={12} /> {t('appels.rappeler')}</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      <motion.section variants={staggerItem}>
        <p className="eyebrow mb-2">{t('appels.membres')}</p>
        {prets && autres.length === 0 ? (
          <FirstRun title={t('appels.vide.titre')} action={{ label: t('trombi.vide.action'), onClick: () => navigate('/membres') }}>{t('appels.vide.texte')}</FirstRun>
        ) : autres.length === 0 ? null : (
          <ul className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))]">
            {autres.map((m) => {
              const online = onlineEmails.has(m.email);
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="relative flex-shrink-0">
                      <UserAvatar email={m.email} size={36} />
                      <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${online ? 'bg-success' : 'bg-text-muted'}`} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-text-primary">{profileFor(m.email).name}</span>
                      <span className="block text-xs text-text-muted">{online ? t('equipe.enLigne') : m.lastSeenAt ? t('equipe.connecteIlYa', { quand: relativeTime(m.lastSeenAt) }) : t('equipe.jamaisConnecte')}</span>
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void call(m.email)}
                    disabled={!online || !callsAvailable || phase !== 'idle'}
                    aria-label={t('equipe.appeler', { nom: profileFor(m.email).name })}
                    title={online ? t('equipe.appeler', { nom: profileFor(m.email).name }) : t('appels.horsLigne')}
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-border text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-30"
                  >
                    <Phone size={16} strokeWidth={1.75} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {autres.length > 0 && joignables.length === 0 && <EmptyState quiet>{t('appels.personneMaintenant')}</EmptyState>}
      </motion.section>

      {lien && <CallLinkPanel onClose={() => setLien(false)} />}
    </motion.section>
  );
}
