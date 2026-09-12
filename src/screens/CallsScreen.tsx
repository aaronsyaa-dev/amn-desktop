import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Link2, Phone, PhoneMissed } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
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
 *
 * ## Ce qui domine : qui est joignable MAINTENANT
 *
 * On n'ouvre pas cet écran pour consulter un annuaire — le Trombinoscope est
 * là pour ça. On l'ouvre pour appeler quelqu'un, et la seule chose qui décide
 * si c'est possible est sa présence à la seconde où l'on regarde.
 *
 * L'écran mélangeait pourtant joignables et absents dans une même grille, avec
 * pour seule différence une pastille de dix pixels. Sur huit personnes dont
 * deux connectées, il fallait inspecter huit cartes pour trouver les deux
 * seules qu'on pouvait appeler.
 *
 * Les joignables passent donc en tête, en portraits, seuls. Les autres
 * descendent en registre avec leur dernière trace — un absent ne se choisit
 * pas, il se constate.
 *
 * Quand personne n'est là, l'écran le dit en grand plutôt que d'afficher huit
 * boutons éteints : « personne » est une réponse, et c'est celle qui évite
 * d'attendre pour rien.
 *
 * ## L'ambre : l'appel manqué
 *
 * Pas la présence. Être joignable est un ÉTAT — il change tout seul, et
 * n'appelle aucune décision. Un appel manqué, lui, est une dette : quelqu'un a
 * cherché à me joindre et personne d'autre que moi ne peut rappeler.
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

  /* La pluralisation vit dans les composants (voir src/i18n/index.ts) : « 1
     personne(s) joignable(s) » ne se lit correctement dans aucune des deux
     langues, donc trois phrases écrites plutôt qu'un gabarit à parenthèses. */
  const sousTitre = !configured
    ? t('appels.indisponible')
    : joignables.length === 0
      ? t('appels.personne')
      : joignables.length === 1
        ? t('appels.joignableUne')
        : t('appels.joignables', { n: joignables.length });

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('collectif.surtitre', { module: t('appels.titre') })}
          title={t('appels.titre')}
          description={sousTitre}
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

      {/*
        LES APPELS MANQUÉS — l'unique ambre.

        Voir l'en-tête : la présence est un état, l'appel manqué est une dette.
        Le groupe fait compter la plaque et ses lignes pour un seul objet.
      */}
      {missed.length > 0 && (
        <motion.section variants={staggerItem} className="panel p-4" data-signal-groupe="manques">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <p className="signal-plate inline-flex items-center gap-2 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider">
              <PhoneMissed size={12} strokeWidth={2.5} /> {t('appels.manques')} · {missed.length}
            </p>
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

      {/*
        LES JOIGNABLES — l'objet dominant, seuls et en grand.

        Séparés des absents, et non mêlés à eux derrière une pastille : c'est
        la seule liste dont chaque entrée est ACTIONNABLE à la seconde. Un
        portrait de 44 px se vise et se clique ; une carte de rangée mélangée
        se cherche.
      */}
      <motion.section variants={staggerItem} className="panel-raised p-5">
        <p className="eyebrow mb-4">{t('appels.joignablesMaintenant')}</p>

        {joignables.length === 0 ? (
          /* « Personne » est une réponse, et c'est celle qui évite d'attendre
             pour rien. Elle se dit donc en grand, pas en gris. */
          <div>
            <p className="text-[21px] font-semibold leading-snug text-text-primary sm:text-[25px]">
              {t('appels.personneEnGrand')}
            </p>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-text-secondary">
              {autres.length === 0 ? t('appels.vide.texte') : t('appels.personneRaison')}
            </p>
          </div>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {joignables.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => void call(m.email)}
                  disabled={!callsAvailable || phase !== 'idle'}
                  aria-label={t('equipe.appeler', { nom: profileFor(m.email).name })}
                  className="input-focus flex min-h-[76px] w-[188px] items-center gap-3 border border-border bg-surface px-3.5 text-left transition-colors hover:border-border-strong hover:bg-surface-hover disabled:opacity-40"
                >
                  <span className="relative flex-shrink-0">
                    <UserAvatar email={m.email} size={44} />
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-success" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] text-text-primary">{profileFor(m.email).name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-text-secondary">
                      <Phone size={11} strokeWidth={2} /> {t('appels.appeler')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </motion.section>

      {/*
        LE RESTE DE L'ÉQUIPE — un registre, pas des boutons éteints.

        Un absent ne se choisit pas, il se constate : la ligne dit quand il
        était là pour la dernière fois, et n'offre aucun geste qui échouerait.
      */}
      {autres.length > joignables.length && (
        <motion.section variants={staggerItem} className="panel">
          <p className="eyebrow border-b border-border px-4 py-2.5">{t('appels.pasLa')}</p>
          <ul className="flex flex-col">
            {autres
              .filter((m) => !onlineEmails.has(m.email))
              .map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
                >
                  <span className="flex-shrink-0 opacity-45 grayscale">
                    <UserAvatar email={m.email} size={26} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">
                    {profileFor(m.email).name}
                  </span>
                  <span className="flex-shrink-0 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    {m.lastSeenAt ? t('equipe.connecteIlYa', { quand: relativeTime(m.lastSeenAt) }) : t('equipe.jamaisConnecte')}
                  </span>
                </li>
              ))}
          </ul>
        </motion.section>
      )}

      {prets && autres.length === 0 && (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('appels.vide.titre')} action={{ label: t('trombi.vide.action'), onClick: () => navigate('/membres') }}>
            {t('appels.vide.texte')}
          </FirstRun>
        </motion.div>
      )}

      {lien && <CallLinkPanel onClose={() => setLien(false)} />}
    </motion.section>
  );
}
