import { t } from '../i18n';
import { IS_BUSINESS } from '../edition/edition';
import type { Etape, Parcours } from './types';

/**
 * LES PARCOURS — écrits une fois, joués par `GuideOverlay`.
 *
 * Le tuto général présente les grandes zones de la coquille, depuis
 * l'Accueil. Le tuto d'un module est GÉNÉRIQUE : il lit l'écran courant (son
 * titre, ses relevés, son geste principal, son objet dominant) plutôt que
 * d'entretenir cent trente-neuf scénarios qui mentiraient au premier bouton
 * renommé. Les cibles sont les ancrages `data-guide` de la coquille et les
 * marques que les écrans portent déjà (`data-screen-actions`).
 */
/**
 * `sansBienvenue` : après la présentation de première connexion (cahier 43f),
 * qui a déjà dit « Bienvenue, {prénom} » — la visite ne le redit pas.
 */
export function parcoursGeneral(prenom: string, { sansBienvenue = false }: { sansBienvenue?: boolean } = {}): Parcours {
  const etapes: Etape[] = [
    ...(sansBienvenue ? [] : [{ cible: null, titre: t('guide.general.bienvenue.titre', { nom: prenom }), texte: t('guide.general.bienvenue.texte') } as Etape]),
    { cible: 'main h1', titre: t('guide.general.accueil.titre'), texte: t('guide.general.accueil.texte'), cote: 'bas' },
    { cible: '[data-guide="epingles"]', cibleMobile: '[data-guide="barre-pouce"]', titre: t('guide.general.epingles.titre'), texte: IS_BUSINESS ? t('guide.general.epingles.texte') : t('guide.general.epingles.texte') },
    { cible: '[data-rail]', cibleMobile: '[data-guide="modules"]', titre: t('guide.general.rail.titre'), texte: t('guide.general.rail.texte') },
    ...(IS_BUSINESS
      ? []
      : [{ cible: '[data-guide="supervision"]', cibleMobile: '[data-guide="modules"]', titre: t('guide.general.supervision.titre'), texte: t('guide.general.supervision.texte') } as Etape]),
    { cible: '[data-guide="recherche"]', cibleMobile: '[data-guide="modules"]', titre: t('guide.general.recherche.titre'), texte: t('guide.general.recherche.texte') },
    { cible: '[data-guide="lien"]', titre: t('guide.general.lien.titre'), texte: t('guide.general.lien.texte') },
    { cible: '[data-guide="aide"]', titre: t('guide.general.aide.titre'), texte: t('guide.general.aide.texte') },
    { cible: null, titre: t('guide.general.fin.titre'), texte: t('guide.general.fin.texte') },
  ];
  return { id: 'general', route: '/', etapes };
}

export function parcoursModule(cle: string, nom: string, quoi: string): Parcours {
  const etapes: Etape[] = [
    { cible: 'main [data-guide="titre"], main h1', titre: nom, texte: quoi, cote: 'bas' },
    { cible: 'main [data-guide="releves"]', titre: t('guide.module.releves.titre'), texte: t('guide.module.releves.texte'), cote: 'bas' },
    { cible: 'main [data-screen-actions] button, main [data-screen-actions] a', titre: t('guide.module.action.titre'), texte: t('guide.module.action.texte') },
    { cible: 'main [data-guide="dominante"], main .panel-raised, main section, main .panel', titre: t('guide.module.contenu.titre'), texte: t('guide.module.contenu.texte'), cote: 'haut' },
    { cible: '[data-guide="aide"]', titre: t('guide.module.aide.titre'), texte: t('guide.module.aide.texte') },
  ];
  return { id: `module:${cle}`, etapes };
}
