import React from 'react';
import { useSync } from '../state/SyncContext';
import { useLangue, type CleTraduction } from '../i18n';
import { useReprise } from '../lib/reprise';

/**
 * LE BANDEAU D'ÉTAT — le bas de l'écran, sur tous les écrans (REFONTE).
 *
 * C'est la pièce qui fait qu'on reconnaît l'application avant d'avoir lu quoi
 * que ce soit : une bande fine, monospace, toujours au même endroit, qui dit
 * en permanence où l'on est, si le lien tient, et quelle heure il est. Un
 * poste de commandement a toujours cette ligne-là ; un site web n'en a jamais.
 *
 * TOUT CE QU'IL AFFICHE EST RÉEL. L'organisation vient du contexte actif, le
 * lien vient de l'état réel de la connexion temps réel, l'horloge est
 * l'horloge. Il n'y a rien ici qu'on puisse « mettre à jour plus tard » : un
 * indicateur figé sur un bandeau permanent est pire que pas d'indicateur, parce
 * qu'on finit par lui faire confiance.
 *
 * LA MÊME PIÈCE DANS LES DEUX ÉDITIONS. Elle ne connaît aucun nom d'édition,
 * aucune marque, aucun écran : tout ce qu'elle montre lui est passé par sa
 * coquille. C'est ce qui rend la parité structurelle au lieu de dépendre d'une
 * relecture — voir `scripts/check-business-bundle.mjs`, qui refuserait le
 * moindre marqueur interne compilé dans le build client.
 *
 * Masqué sous `md` : sur téléphone, le bas de l'écran appartient à la barre du
 * pouce, et deux bandes empilées mangeraient un tiers de la hauteur utile.
 */

/**
 * Ce que le lien temps réel raconte, en une pastille et un mot. Les libellés
 * sont des CLÉS de dictionnaire (la casse capitale vient de la classe
 * `uppercase` du bandeau, pas du texte).
 */
const LINK: Record<
  'online' | 'connecting' | 'offline' | 'unconfigured',
  { dot: string; live: boolean; label: CleTraduction; title: CleTraduction }
> = {
  online: { dot: 'bg-success', live: true, label: 'chrome.lienActif', title: 'rail.lienActifTitre' },
  connecting: { dot: 'bg-warning', live: true, label: 'rail.connexion', title: 'rail.connexionTitre' },
  offline: { dot: 'bg-danger', live: false, label: 'rail.horsLigne', title: 'rail.horsLigneTitre' },
  unconfigured: { dot: 'bg-text-muted', live: false, label: 'rail.local', title: 'rail.localTitre' },
};

export function StatusRail({
  /** L'organisation dont on lit les données EN CE MOMENT. */
  orgName,
  /** Le contexte, en deux mots : « poste de travail », « support », … */
  context,
  /** Ce que la coquille veut ajouter à droite de l'horloge. */
  children,
}: {
  orgName: string;
  context?: string;
  children?: React.ReactNode;
}) {
  const { connectionStatus } = useSync();
  const { langue, t } = useLangue();
  const reprise = useReprise();
  // Une lecture attend un serveur qui redémarre : le bandeau le dit, en
  // français, avant tout état de la liaison — c'est l'attente qu'on vit.
  const link: (typeof LINK)[keyof typeof LINK] = reprise
    ? { dot: 'bg-warning', live: true, label: 'rail.reprise', title: 'rail.repriseTitre' }
    : LINK[connectionStatus];

  // L'horloge bat à la seconde. C'est le seul endroit de l'application où une
  // seconde compte : ailleurs, un rafraîchissement par seconde serait du bruit.
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const hhmmss = now.toLocaleTimeString(locale, { hour12: false });
  const date = now.toLocaleDateString(locale, { day: '2-digit', month: 'short' });

  return (
    <footer className="hidden h-7 flex-shrink-0 items-center gap-4 border-t border-border bg-raised px-4 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted md:flex">
      <span className="min-w-0 truncate text-text-secondary" title={orgName}>
        {orgName}
      </span>

      {context && (
        <>
          <span className="h-3 w-px flex-shrink-0 bg-border" aria-hidden />
          <span className="flex-shrink-0 truncate">{context}</span>
        </>
      )}

      <span className="h-3 w-px flex-shrink-0 bg-border" aria-hidden />

      <span className="flex flex-shrink-0 items-center gap-1.5" title={t(link.title)}>
        {/*
          Le point ne bat QUE quand quelque chose est réellement en cours : lien
          ouvert, ou connexion en train de s'établir. Hors ligne, il reste fixe —
          un point qui continuerait de battre dirait « ça vit » au moment précis
          où rien ne vit, ce qui est le seul mensonge qu'une animation peut
          commettre.
        */}
        <span
          className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${link.dot} ${link.live ? 'live-dot' : ''}`}
        />
        {t(link.label)}
      </span>

      <div className="ml-auto flex flex-shrink-0 items-center gap-4">
        {children}
        <span className="tnum tabular-nums text-text-secondary" aria-label={t('rail.heureLocale')}>
          {date} · {hhmmss}
        </span>
      </div>
    </footer>
  );
}
