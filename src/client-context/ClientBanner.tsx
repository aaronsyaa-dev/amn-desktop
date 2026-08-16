import React from 'react';
import { LogOut, ShieldAlert } from 'lucide-react';
import { useOrgContext } from '../state/OrgContextContext';

/**
 * Le bandeau permanent d'une SESSION DE SUPPORT.
 *
 * Il reprend exactement le parti pris du bandeau de contrôle à distance, qui a
 * fait ses preuves : une barre pleine largeur en haut de l'écran, toujours là,
 * jamais une bulle qui s'estompe. Une notification qu'on peut chasser d'un
 * clic finit par ne plus être lue — et « je croyais être chez moi » est
 * exactement l'erreur qu'on ne peut pas se permettre en travaillant dans le
 * dossier d'une cliente.
 *
 * Il n'a donc PAS de bouton de fermeture. Le seul bouton qu'il porte est celui
 * qui met fin au contexte lui-même : on ne masque pas le bandeau, on sort.
 * Le contenu de l'application est décalé vers le bas par la hauteur du bandeau
 * (voir ClientContextLayout) plutôt que recouvert par lui : recouvrir aurait
 * rendu le premier élément de chaque écran inatteignable.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QU'IL N'ANNONCE PAS (BLOC D)
 *
 * Ce bandeau ne s'affiche QUE pour une session de support — un geste d'AMN
 * DevSec sur le dossier d'une cliente, d'une heure, tracé au journal d'accès.
 * Il ne s'affiche jamais pour une APPARTENANCE : un compte réellement membre
 * d'une autre organisation (Aaron chez AllStore) y travaille comme chez lui,
 * sans limite de temps et sans rien à annoncer. Les deux passent par des
 * chemins séparés — `support.enter()` d'un côté, `switchToOrganization()` de
 * l'autre, qui efface justement le jeton de support — et le garde `if
 * (!support) return null` ci-dessous est ce qui rend la confusion impossible
 * ici. Côté serveur, la même frontière est tenue par `req.auth.scope`
 * (`'support'` contre `'user'`) et vérifiée par deux tests de
 * `test/multi-org.test.js`.
 *
 * Il disait auparavant « en tant qu'administrateur AMN DevSec ». Le mot était
 * faux deux fois : il nommait un RÔLE là où il fallait nommer un MÉCANISME, et
 * ce rôle-là (`admin`, forcé par le serveur le temps de la session) n'a rien à
 * voir avec le rôle qu'une organisation donne à ses collaborateurs. Le bandeau
 * nomme désormais la session, dit qu'elle est tracée, et montre ce qu'il lui
 * reste à vivre.
 */

/** Hauteur réservée dans la mise en page. Une constante, pas une devinette. */
export const CLIENT_BANNER_HEIGHT = 40;

/**
 * Ce qu'il reste avant qu'amn-api refuse le jeton, en clair.
 *
 * Affiché parce qu'une session de support EST temporaire et que c'est la
 * moitié de ce qui la distingue d'une appartenance : sans ce compte à rebours,
 * « temporaire » est une propriété qu'on doit croire sur parole. Il tombe à la
 * minute et s'arrête à « expirée » plutôt que de passer en négatif.
 */
function remainingLabel(expiresAt: string, now: number): string {
  const ms = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return 'expirée';
  const minutes = Math.ceil(ms / 60000);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
  }
  return `${minutes} min`;
}

export function ClientBanner() {
  const { support, leaveOrganization } = useOrgContext();

  // Une minute de période : le libellé est à la minute, donc rafraîchir plus
  // vite ne changerait rien à l'écran et réveillerait React pour rien.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!support) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [support]);

  if (!support) return null;

  return (
    <div
      role="alert"
      style={{ height: CLIENT_BANNER_HEIGHT }}
      className="fixed inset-x-0 top-0 z-[240] flex items-center gap-3 border-b border-warning/50 bg-warning-muted px-3 sm:px-4"
    >
      <ShieldAlert size={14} strokeWidth={2} className="flex-shrink-0 text-warning" />
      <span className="hidden flex-shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-warning sm:inline">
        Session de support
      </span>
      <p className="min-w-0 flex-1 truncate text-xs text-text-primary">
        Vous consultez <strong className="font-semibold">{support.orgName}</strong>
        <span className="hidden sm:inline"> — accès temporaire, inscrit à son journal</span>
        {support.actorEmail && (
          <span className="hidden font-mono text-[10px] uppercase tracking-widest text-text-muted md:inline">
            {' '}
            · {support.actorEmail}
          </span>
        )}
      </p>
      <span
        className="flex-shrink-0 font-mono text-[10px] uppercase tracking-wider text-text-muted"
        title={`La session se ferme d’elle-même le ${new Date(support.expiresAt).toLocaleString('fr-FR')}`}
      >
        {remainingLabel(support.expiresAt, now)}
      </span>
      <button
        type="button"
        onClick={() => void leaveOrganization()}
        className="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-text-primary transition-colors hover:bg-surface-hover"
      >
        <LogOut size={11} strokeWidth={2} />
        Quitter
      </button>
    </div>
  );
}
