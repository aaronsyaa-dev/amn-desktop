/**
 * Ce qu'un bundle Business ne doit pas contenir, et ce qu'il doit contenir.
 *
 * Extrait dans son propre module parce que deux contrôles s'en servent, et que
 * deux copies de cette liste finiraient par diverger — précisément le jour où
 * l'une des deux servirait à valider un déploiement chez une cliente :
 *
 *   - `check-business-bundle.mjs` relit un dossier `dist/` local ;
 *   - `check-deployed-bundle.mjs` relit ce qu'une URL SERT RÉELLEMENT.
 */

/**
 * Ce qui ne doit apparaître nulle part.
 *
 * Chaque entrée porte sa raison : sans elle, le prochain à voir passer le
 * script devant une fausse alerte ne saura pas s'il peut retirer la ligne.
 * `pattern` est cherché tel quel, sans respect de la casse.
 */
export const FORBIDDEN = [
  // --- Identité et comptes d'AMN DevSec ---
  { pattern: 'amn-devsec.com', why: 'nos adresses email' },
  { pattern: 'AMN DevSec', why: 'notre raison sociale' },
  { pattern: 'aaron@', why: 'compte opérateur' },
  { pattern: 'mohamed@', why: 'compte opérateur' },
  { pattern: 'AmnQG-2026', why: 'mot de passe de départ des comptes locaux' },
  { pattern: '$2b$10$', why: 'empreinte bcrypt d’un compte de démonstration' },

  // --- Produits de cybersécurité ---
  // Sensible à la casse : `react.memo_cache_sentinel`, dans React, n'est pas
  // notre produit. Le contrôle porte sur le nom propre, pas sur le mot.
  { pattern: 'Sentinel', why: 'catalogue Tracker', caseSensitive: true },
  { pattern: 'trackerCatalog', why: 'catalogue Tracker' },
  { pattern: 'security-monitor', why: 'le tracker installé chez nos clients' },
  { pattern: 'AMN Suite', why: 'palier du catalogue Tracker' },
  { pattern: 'SSL Monitor', why: 'produit exclusif' },
  { pattern: 'Comply', why: 'produit exclusif (RGPD)' },
  { pattern: 'Ajmani', why: 'assistant local, exclusif' },

  // --- Routes et canaux qui n'existent pas chez une cliente ---
  { pattern: '/v1/admin/', why: 'console inter-organisations' },
  { pattern: 'support-session', why: 'contexte client — n’existe que chez nous' },
  { pattern: '/v1/comply', why: 'route produit' },
  { pattern: '/v1/scans', why: 'route produit' },

  // --- Données de démonstration qui sont les nôtres ---
  { pattern: 'G20 Corvetto', why: 'client de démonstration' },
  { pattern: 'Atlas Retail', why: 'client de démonstration' },

  // --- Jetons ---
  { pattern: 'VITE_AMN_API_WEB_TOKEN', why: 'un build cliente n’embarque aucun jeton' },
  { pattern: 'VITE_AMN_API_OPERATOR_TOKEN', why: 'un build cliente n’embarque aucun jeton' },
];

/**
 * Ce qui DOIT s'y trouver.
 *
 * Le contrôle d'absence, seul, est trop facile à satisfaire : un build raté,
 * ou le mauvais dossier passé en argument, passerait au vert. Ces deux marqueurs
 * confirment qu'on a bien relu une édition Business construite.
 */
export const REQUIRED = [
  { pattern: 'AMN Business', why: 'le nom produit de l’édition livrée' },
  { pattern: 'Agenda', why: 'le calendrier, module quotidien de l’édition Business' },
  { pattern: 'Coffre-fort', why: 'un module de l’édition Business' },
];
