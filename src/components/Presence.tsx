import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useLangue } from '../i18n';
import { useMembers } from '../state/useMembers';
import { useSync } from '../state/SyncContext';
import { useProfiles } from '../state/ProfilesContext';
import { UserAvatar } from './UserAvatar';
import { isModuleEnabled } from '../data/spaces';

/**
 * LA PRÉSENCE — « on s'y sent seul » (retour Syraagensy).
 *
 * Une ligne sur l'Accueil : qui de l'équipe est là maintenant (la présence
 * réelle de la socket, `onlineEmails`), et sinon qui est passé récemment.
 * Quand l'organisation n'a qu'une personne, la ligne ne ment pas — elle
 * ouvre trois portes : inviter quelqu'un, le Hall (les autres organisations
 * volontaires), écrire à AMN DevSec. Aucune donnée d'une autre organisation
 * n'apparaît ici : le Hall ne livre qu'un NOMBRE d'organisations, et seulement
 * quand on l'ouvre.
 */
export function Presence() {
  const { t } = useLangue();
  const { user } = useAuth();
  const { membres, prets } = useMembers();
  const { onlineEmails } = useSync();
  const { profileFor } = useProfiles();

  const autres = useMemo(() => membres.filter((m) => m.email !== user?.email && m.status === 'active'), [membres, user?.email]);
  const invites = useMemo(() => membres.filter((m) => m.email !== user?.email && m.status === 'invited').length, [membres, user?.email]);
  const enLigne = useMemo(() => autres.filter((m) => onlineEmails.has(m.email)), [autres, onlineEmails]);
  if (!prets || !user) return null;

  const prenom = (email: string) => profileFor(email).name?.split(' ')[0] || email.split('@')[0];
  const lien = 'underline decoration-border-strong underline-offset-2 hover:text-text-primary';

  if (autres.length === 0) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-text-secondary" data-presence="seule">
        <span>{invites > 0 ? t('presence.invites', { n: String(invites) }) : t('presence.seule')}</span>
        {isModuleEnabled('members') && <Link to="/membres" className={lien}>{t('presence.inviter')}</Link>}
        {isModuleEnabled('hall') && (
          <>
            <span aria-hidden>·</span>
            <Link to="/hall" className={lien}>{t('presence.hall')}</Link>
          </>
        )}
        {isModuleEnabled('assistance') && (
          <>
            <span aria-hidden>·</span>
            <Link to="/assistance" className={lien}>{t('presence.amn')}</Link>
          </>
        )}
      </p>
    );
  }

  const montres = (enLigne.length > 0 ? enLigne : autres).slice(0, 6);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-text-secondary" data-presence={enLigne.length > 0 ? 'ensemble' : 'personne'}>
      <span className="flex -space-x-1.5">
        {montres.map((m) => (
          <span key={m.email} className="relative inline-flex rounded-full ring-2 ring-bg" title={prenom(m.email)}>
            <UserAvatar email={m.email} size={22} />
            {onlineEmails.has(m.email) && <span aria-hidden className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-success ring-2 ring-bg" />}
          </span>
        ))}
      </span>
      <span>
        {enLigne.length === 0
          ? t('presence.personne', { n: String(autres.length) })
          : enLigne.length === 1
            ? t('presence.une', { nom: prenom(enLigne[0].email) })
            : t('presence.plusieurs', { noms: enLigne.slice(0, 3).map((m) => prenom(m.email)).join(', '), n: String(enLigne.length) })}
      </span>
    </div>
  );
}
