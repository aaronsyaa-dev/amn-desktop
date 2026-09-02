import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Phone, Search } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { UserAvatar } from '../components/UserAvatar';
import { FirstRun } from '../components/EmptyState';
import { useMembers } from '../state/useMembers';
import { useProfiles } from '../state/ProfilesContext';
import { useSync } from '../state/SyncContext';
import { useCall } from '../state/CallContext';
import { useAuth } from '../auth/AuthContext';
import { roleLabel } from '../lib/roleLabels';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

/**
 * LE TROMBINOSCOPE — les visages, les rôles, et qui est là.
 *
 * Pour qui : une équipe de trois à vingt-cinq personnes qui ne se croise pas
 * tous les jours (AllStore : téléphone et desktop, deux villes). Ce que ça
 * règle : « c'est qui, déjà, et est-ce qu'il est là ? » — répondu en un
 * écran, sans ouvrir la messagerie. Rien n'est saisi ici : les visages
 * viennent des profils, les rôles des comptes, la présence de la liaison, la
 * dernière connexion du journal. Un écran qui lit, et qui ne ment jamais.
 */
export function DirectoryScreen() {
  const { t } = useLangue();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { membres, prets } = useMembers();
  const { profileFor } = useProfiles();
  const { onlineEmails, configured } = useSync();
  const { call, callsAvailable, phase } = useCall();
  const [recherche, setRecherche] = useState('');

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return membres
      .map((m) => ({ ...m, nom: profileFor(m.email).name }))
      .filter((m) => !q || `${m.nom} ${m.email} ${roleLabel(m.role, null)}`.toLowerCase().includes(q))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [membres, recherche, profileFor]);
  const enLigne = membres.filter((m) => m.email === user?.email || onlineEmails.has(m.email)).length;

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('collectif.surtitre', { module: t('trombi.titre') })}
          title={t('trombi.titre')}
          description={t('trombi.description')}
          stats={[
            { label: t('trombi.stat.membres'), value: membres.length },
            { label: t('trombi.stat.enLigne'), value: enLigne, emphasis: enLigne > 1 },
          ]}
        />
      </motion.div>

      {prets && membres.length <= 1 ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('trombi.vide.titre')} action={{ label: t('trombi.vide.action'), onClick: () => navigate('/membres') }}>
            {t('trombi.vide.texte')}
          </FirstRun>
        </motion.div>
      ) : (
        <>
          <motion.div variants={staggerItem}>
            <label className="input-focus flex min-h-11 max-w-md items-center gap-2 rounded-lg border border-border bg-surface px-3">
              <Search size={15} className="flex-shrink-0 text-text-muted" />
              <input
                type="search"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder={t('trombi.rechercher')}
                aria-label={t('trombi.rechercher')}
                className="min-w-0 flex-1 bg-transparent py-2 text-sm text-text-primary outline-none placeholder:text-text-muted"
              />
            </label>
          </motion.div>
          <motion.div variants={staggerItem} className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(14rem,1fr))]">
            {visibles.map((m) => {
              const moi = m.email === user?.email;
              const online = moi || onlineEmails.has(m.email);
              const profil = profileFor(m.email);
              const ligne = moi
                ? profil.presenceText || t('equipe.enLigne')
                : !configured
                  ? t('equipe.presenceIndisponible')
                  : online
                    ? profil.presenceText || t('equipe.enLigne')
                    : m.lastSeenAt
                      ? t('equipe.connecteIlYa', { quand: relativeTime(m.lastSeenAt) })
                      : t('equipe.jamaisConnecte');
              return (
                <article key={m.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center gap-3">
                    <span className="relative flex-shrink-0">
                      <UserAvatar email={m.email} size={48} />
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface ${online ? 'bg-success' : 'bg-text-muted'}`} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {m.nom}
                        {moi && <span className="text-text-muted"> {t('equipe.vous')}</span>}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{roleLabel(m.role, null)}</p>
                    </div>
                  </div>
                  <p className="truncate text-xs text-text-secondary" title={m.email}>{m.email}</p>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <span className="text-xs text-text-secondary">{ligne}</span>
                    {!moi && online && configured && (
                      <button
                        type="button"
                        onClick={() => void call(m.email)}
                        disabled={!callsAvailable || phase !== 'idle'}
                        aria-label={t('equipe.appeler', { nom: m.nom })}
                        title={t('equipe.appeler', { nom: m.nom })}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-40"
                      >
                        <Phone size={15} strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </motion.div>
        </>
      )}
    </motion.section>
  );
}
