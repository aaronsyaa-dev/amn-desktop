import { ROUTE_TOUS_LES_MODULES } from '../navigation/moment';
import { ROUTE_DEMARRAGE, ROUTE_METIER, ROUTE_NOTIFICATIONS } from '../systeme/routes';
import type { Langue } from '../../i18n';
import { traduireSocle } from '../../socle/i18n';
import type { PageCoquille } from './page';

/**
 * LES PAGES SYSTÈME, HORS REGISTRE — ce qu'elles disent d'elles à la coquille (pur : `check:socle-coquille`).
 *
 * Elles n'ont pas d'entrée de barre latérale. Les images v3 les rangent ainsi : Notifications et Démarrage dans
 * « Ma journée », l'Accueil allumé (H40, H42) ; Votre métier sous Démarrage (H47 : « Ma journée / Démarrage /
 * Votre métier ») ; Tous les modules sous « Espace », sans famille dépliée, son bouton carré allumé (D02).
 */
export interface MotsPagesSysteme {
  notifications: string;
  demarrage: string;
  metier: string;
  /** « Espace » : la section des sept familles, première miette d'une page qui n'est d'aucune famille. */
  espace: string;
  tousLesModules: string;
}

export function pageSysteme(pathname: string, mots: MotsPagesSysteme): PageCoquille | null {
  const chemin = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  if (chemin === ROUTE_NOTIFICATIONS) return { famille: 'jour', sousPage: 'home', miettes: [{ libelle: mots.notifications }] };
  if (chemin === ROUTE_DEMARRAGE) return { famille: 'jour', sousPage: 'home', miettes: [{ libelle: mots.demarrage }] };
  if (chemin === ROUTE_METIER) return { famille: 'jour', sousPage: 'home', miettes: [{ libelle: mots.demarrage, vers: ROUTE_DEMARRAGE }, { libelle: mots.metier }] };
  if (chemin === ROUTE_TOUS_LES_MODULES) return { famille: null, miettes: [{ libelle: mots.espace }, { libelle: mots.tousLesModules }], tousLesModules: true };
  return null;
}

/** Les mots des pages système, dans la langue de l'application. */
export function motsPagesSysteme(langue: Langue): MotsPagesSysteme {
  return {
    notifications: traduireSocle(langue, 'coquille.page.notifications'),
    demarrage: traduireSocle(langue, 'coquille.page.demarrage'),
    metier: traduireSocle(langue, 'coquille.page.metier'),
    espace: traduireSocle(langue, 'coquille.section.espace'),
    tousLesModules: traduireSocle(langue, 'coquille.tous.court'),
  };
}

/** Le nom d'une page système, pour dire où est un collègue (« Notifications »), ou `null`. */
export function libellePageSysteme(chemin: string, langue: Langue): string | null {
  const page = pageSysteme(chemin, motsPagesSysteme(langue));
  return page?.miettes[page.miettes.length - 1]?.libelle ?? null;
}
