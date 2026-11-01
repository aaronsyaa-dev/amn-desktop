import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { NAV_SECTIONS, type NavItem } from '../../../data/navigation';
import { isModuleEnabled, isModuleLocked } from '../../../data/spaces';
import { useLangue } from '../../../i18n';
import { traduireSocle } from '../../../socle/i18n';
import { useAssistant } from '../../../assistant/AssistantContext';
import { useNavAlleges } from '../../../state/useNavAlleges';
import { useNavFavorites } from '../../../state/useNavFavorites';
import { useModulesOuverts } from '../../../state/useModulesOuverts';
import { useRegards, moduleDuChemin } from '../../../state/RegardsContext';
import { useProfilesOptionnel } from '../../../state/ProfilesContext';
import { CATALOGUE } from '../../../bureaux/catalogue';
import { useDonneesCoquille, ROUTE_CYBER } from '../../coquille/donnees';
import { usePageCoquille } from '../../coquille/page';
import { motsPagesSysteme, pageSysteme } from '../../coquille/pagesSysteme';
import { useToucheModificatrice } from '../../coquille/touche';
import { ROUTE_TOUS_LES_MODULES } from '../../navigation/moment';
import { aDecouvrir, choisirEpingles, dernieresOuvertures, momentDOuverture, recents as derniersOuverts, type ModuleRepertoire } from './logique';
import { correspondancesDe, enPuce, epingleEnPuce, lireRepertoire } from './repertoire';
import { VueTousLesModules } from './VueTousLesModules';
import { useMots } from './i18n';

/**
 * TOUS LES MODULES (D02, v3) — LA PAGE BRANCHÉE.
 * ═══════════════════════════════════════════════
 *
 * Une vraie page de l'application (route `/tous-les-modules`, inchangée : le bouton carré de la barre latérale,
 * « + N autres » avec `?famille=`, le bouton de l'Accueil, le rail du moment, les vues d'ensemble et ⌘K y mènent
 * toujours). Elle ne se pose plus en surimpression : la coquille l'entoure (fil « Espace / Tous les modules »,
 * aucune famille dépliée, bouton « Tous les modules » allumé) et sa barre Ajmani porte le texte de la page.
 *
 * Les sources, toutes existantes :
 *   · le registre (`src/refonte/modules/`) et le catalogue des vues : familles, modules, niveaux, noms, icônes ;
 *   · les compteurs de la coquille (`useDonneesCoquille`) : la même définition que la barre latérale ;
 *   · la présence des collègues (`useRegards`) ;
 *   · les épingles (`useNavFavorites`, les favoris de la barre latérale) ;
 *   · le journal des ouvertures du poste (`useModulesOuverts`) : Récents, À découvrir et « x sur N ».
 * Ce qui n'a pas de source n'est pas affiché (aucun chiffre inventé) : voir le compte rendu D02.
 */
export function PageTousLesModules(): React.ReactElement {
  const { langue } = useLangue();
  const { tm } = useMots();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const assistant = useAssistant();
  const { alleges } = useNavAlleges();
  const { favorites, toggleFavorite, isFavorite } = useNavFavorites();
  const journal = useModulesOuverts();
  const { autres } = useRegards();
  const profils = useProfilesOptionnel();
  const donnees = useDonneesCoquille(location.pathname, null);
  const touche = useToucheModificatrice();

  const page = pageSysteme(ROUTE_TOUS_LES_MODULES, motsPagesSysteme(langue));
  usePageCoquille(page ? { ...page, ajmani: tm('ajmani') } : null);

  /* Toutes les vues du catalogue, activées ou non : un module non activé reste listé. */
  const catalogue = useMemo(() => {
    const m = new Map<string, NavItem>();
    for (const s of NAV_SECTIONS) for (const i of s.items) m.set(i.key, i);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alleges]);

  const nomDe = useCallback((email: string) => profils?.profileFor(email)?.name?.trim() || email.split('@')[0], [profils]);
  const presents = useMemo(() => {
    const m = new Map<string, string[]>();
    const routes = [...catalogue.values()].map((i) => i.to).filter((t) => t !== '/');
    for (const r of autres) {
      if (r.parti) continue;
      const chemin = moduleDuChemin(r.module);
      const cible = chemin === '/' ? '/' : routes.filter((t) => chemin === t || chemin.startsWith(`${t}/`)).sort((a, b) => b.length - a.length)[0];
      if (!cible) continue;
      m.set(cible, [...(m.get(cible) ?? []), nomDe(r.email)]);
    }
    return m;
  }, [autres, catalogue, nomDe]);

  const familles = useMemo(
    () =>
      lireRepertoire({
        langue,
        catalogue,
        compteurs: donnees.compteurs,
        presents,
        estActive: isModuleEnabled,
        estVerrouille: isModuleLocked,
        nomGarde: traduireSocle(langue, 'coquille.garde.court'),
      }),
    [langue, catalogue, donnees.compteurs, presents],
  );
  const tous = useMemo(() => familles.flatMap((f) => f.modules), [familles]);

  /* Le journal se relit à chaque montage : la page s'ouvre après la navigation qui l'a noté. */
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setMaintenant(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const ouvertures = useMemo(() => dernieresOuvertures(tous, journal), [tous, journal]);

  const epingles = useMemo(
    () => choisirEpingles(favorites, (cle) => epingleEnPuce(cle, familles, catalogue)),
    [favorites, familles, catalogue],
  );
  const recents = useMemo(
    () => derniersOuverts(tous, ouvertures, 4).map(({ module, le }) => ({ module: enPuce(module, familles, catalogue), moment: momentDOuverture(le, maintenant) })),
    [tous, ouvertures, familles, catalogue, maintenant],
  );
  const decouvrir = useMemo(() => aDecouvrir(tous, ouvertures, 3).map((m) => enPuce(m, familles, catalogue)), [tous, ouvertures, familles, catalogue]);

  const correspondre = useCallback((q: string) => correspondancesDe(q, catalogue, langue), [catalogue, langue]);
  const ouvrir = useCallback((vers: string) => navigate(vers), [navigate]);
  const basculerEpingle = useCallback(
    (m: ModuleRepertoire): boolean => {
      const deja = m.cles.find((c) => isFavorite(c));
      toggleFavorite(deja ?? m.cles[0]);
      return !deja;
    },
    [isFavorite, toggleFavorite],
  );
  const demanderAjmani = useCallback(
    (q: string) => {
      assistant.sendMessage(q);
      assistant.open('chat');
    },
    [assistant],
  );

  return (
    <VueTousLesModules
      familles={familles}
      correspondre={correspondre}
      epingles={epingles}
      recents={recents}
      decouvrir={decouvrir}
      ouverts={ouvertures.size}
      cyber={{ vers: ROUTE_CYBER, espaces: CATALOGUE.cyber.onglets.length }}
      touche={touche}
      onOuvrir={ouvrir}
      onBasculerEpingle={basculerEpingle}
      onDemanderAjmani={demanderAjmani}
      familleActive={params.get('famille') ?? undefined}
    />
  );
}

export default PageTousLesModules;
