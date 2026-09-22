import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useActivity } from '../state/ActivityContext';
import { Logo, LogoMark } from '../components/Logo';
import { sectionsForSpace } from '../data/spaces';
import { useNavFavorites } from '../state/useNavFavorites';
import { useFermetureEchap } from '../lib/useFermetureEchap';
import { useLangue, libelleNav, libelleSection } from '../i18n';
import { useNavAlleges } from '../state/useNavAlleges';
import { UserAvatar } from '../components/UserAvatar';
import { BarreRail, type FamilleRail } from '../components/rail/BarreRail';
import { CLE_CHOIX, deplierAuDemarrage, lireChoix } from '../lib/barreLaterale';
import { cheminLePlusPrecis } from '../lib/cheminCourant';

/**
 * Barre latérale de l'édition Business — LE RAIL (Direction B).
 *
 * Ce fichier ne dessine plus la colonne : il la NOURRIT. Toute la géométrie —
 * rail de 52 px, panneau de 184, tuiles de 38, formule `27n + 8` — vit dans
 * `components/rail/BarreRail.tsx`, partagée avec la barre interne et celle du
 * contexte de support. C'est le point de la refonte : trois barres écrites à la
 * main, c'étaient trois géométries qui divergeaient, et le paquet de design le
 * nomme comme le défaut le plus coûteux du projet.
 *
 * Ce qui reste ici est ce qui ne peut PAS être partagé sans faire fuiter une
 * édition dans l'autre :
 *
 *   - le catalogue, lu dans `sectionsForSpace` — résolu à la compilation vers
 *     `modules.business.ts`, donc une cliente ne reçoit que ses modules ;
 *   - l'identité (logo, compte, organisation) et la déconnexion ;
 *   - l'absence de palette de commandes : `CommandPalette` importe
 *     `RemoteSitesContext`, `SitePanelContext` et la Garde. La brancher ici
 *     ramènerait tout le parc d'AMN DevSec dans le bundle livré. ⌘K amène donc
 *     au champ de la coquille, qui filtre les modules sur place.
 *
 * ## Ce que la refonte change pour une cliente
 *
 * Avant : les huit familles repliées, à ouvrir une par une. Le compte y était,
 * mais pas le contenu — savoir qu'il y a 14 modules dans « Production » ne dit
 * pas lesquels. Maintenant : les huit familles sont des tuiles permanentes, et
 * celle du module courant est ouverte EN ENTIER dans le panneau. On voit où on
 * est et ce qu'il y a à côté, sans un clic.
 *
 * ## L'ambre a quitté cette barre
 *
 * Le filet de 3 px sur la ligne courante était ambre. Il ne l'est plus : la
 * règle « un seul objet ambre par écran » ne survit pas à une colonne qui en
 * porte un en permanence, sur les 71 écrans à la fois. Le marqueur est en encre
 * claire, et `check:coquille` refuse tout nœud ambre dans la colonne.
 */
export function BusinessSidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  // Les modules allégés par la personne : s'abonner, pour que la barre suive le geste sans rechargement.
  useNavAlleges();
  useFermetureEchap(mobileOpen, () => onClose?.());
  const { t } = useLangue();

  const [deplie, setDeplie] = useState(() => {
    if (typeof window === 'undefined') return false;
    let choix: boolean | null = null;
    try {
      choix = lireChoix(window.localStorage.getItem(CLE_CHOIX));
    } catch {
      /* stockage refusé (navigation privée) : la largeur décidera */
    }
    return deplierAuDemarrage(window.innerWidth, choix);
  });
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user, org } = useAuth();
  const { unseen } = useActivity();
  const { favorites, isFavorite, toggleFavorite } = useNavFavorites();

  const sections = sectionsForSpace('workspace');

  /*
    Les familles du rail : le catalogue tel quel, avec son code de deux
    lettres. Rien n'est redéclaré — un module ajouté au catalogue apparaît dans
    sa tuile sans qu'on y pense, et le compte de la tuile suit.
  */
  const familles: FamilleRail[] = useMemo(
    () =>
      sections.map((section) => ({
        key: section.key,
        label: libelleSection(section.label),
        code: section.code,
        items: section.items,
      })),
    [sections],
  );

  const cheminCourant = useMemo(
    () => cheminLePlusPrecis(location.pathname, sections.flatMap((s) => s.items)),
    [location.pathname, sections],
  );

  /* Les épinglés, dans l'ordre où la personne les a posés — et jamais un module
     qu'elle a allégé ou que son organisation n'a pas. */
  const parCle = useMemo(() => {
    const map = new Map(sections.flatMap((s) => s.items).map((i) => [i.key, i]));
    return map;
  }, [sections]);
  const epingles = useMemo(
    () => favorites.map((k) => parCle.get(k)).filter((i): i is NonNullable<typeof i> => Boolean(i)),
    [favorites, parCle],
  );

  const basculer = () => {
    setDeplie((v) => {
      try {
        window.localStorage.setItem(CLE_CHOIX, String(!v));
      } catch {
        /* stockage refusé : le choix ne vaut que pour cette session */
      }
      return !v;
    });
  };

  const expanded = deplie || mobileOpen;

  return (
    <BarreRail
      familles={familles}
      epingles={epingles}
      cheminCourant={cheminCourant}
      compteurs={unseen}
      deplie={deplie}
      mobileOpen={mobileOpen}
      onClose={onClose}
      onNavigate={onClose}
      libelle={libelleNav}
      estEpingle={isFavorite}
      onEpingler={toggleFavorite}
      enTete={
        <div className="flex h-14 flex-none items-center justify-between border-b border-[#1c1c1c] px-3.5">
          {expanded ? <Logo height={20} /> : <LogoMark size={20} />}
        </div>
      }
      pied={
        <div className="flex flex-none flex-col border-t border-[#1c1c1c] bg-[#0a0a0a]">
          {expanded && user && (
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <UserAvatar email={user.email} size={28} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13px] text-text-primary">{user.email}</span>
                {org?.name && (
                  <span className="block truncate font-mono text-[10px] text-text-muted">
                    {org.name}
                  </span>
                )}
              </span>
            </div>
          )}
          <div className="flex flex-col gap-0.5 p-2">
            <button
              type="button"
              onClick={basculer}
              aria-label={deplie ? t('chrome.replierBarre') : t('chrome.deplierBarre')}
              className="hidden items-center gap-2.5 px-2.5 py-2 text-[13px] text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary md:flex"
            >
              {deplie ? (
                <ChevronsLeft size={16} strokeWidth={2.1} />
              ) : (
                <ChevronsRight size={16} strokeWidth={2.1} />
              )}
              {expanded && <span>{t('chrome.replier')}</span>}
            </button>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
              aria-label={t('chrome.seDeconnecter')}
              title={!expanded ? t('chrome.seDeconnecter') : undefined}
              className="flex min-h-11 items-center gap-2.5 px-2.5 py-2 text-[13px] text-text-muted transition-colors hover:bg-surface-hover hover:text-danger md:min-h-0"
            >
              <LogOut size={16} strokeWidth={2.1} />
              {expanded && <span>{t('chrome.seDeconnecter')}</span>}
            </button>
          </div>
        </div>
      }
    />
  );
}
