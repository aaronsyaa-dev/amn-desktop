/**
 * Édition du build — le seul interrupteur de tout ce dossier.
 *
 * Deux éditions, un seul dépôt :
 *
 *   - `internal` — AMN Desktop, ce que font tourner Aaron et Mohamed. Tous les
 *     modules, y compris les produits de cybersécurité (Trackers, Scanner,
 *     Comply, SSL Monitor) et les modules d'équipe (Équipe, Décisions,
 *     Connaissances).
 *   - `business` — AMN Business, livré aux organisations clientes. Les modules
 *     ci-dessus n'y sont pas masqués : ils n'y sont pas COMPILÉS. Les points
 *     d'entrée `@edition/*` sont réécrits par Vite vers leurs variantes
 *     `*.business.*`, donc rien de ce qu'elles n'importent pas n'entre dans le
 *     bundle livré.
 *
 * Pourquoi une cible de build et pas un simple drapeau runtime : un drapeau
 * suffit à cacher un écran, jamais à retirer son code. Le catalogue Tracker,
 * les signatures du Scanner, le référentiel RGPD de Comply resteraient lisibles
 * en clair dans l'app d'une cliente — quelques secondes de recherche de texte
 * dans l'asar. Le drapeau runtime existe quand même ci-dessous, en second
 * rempart : il décide ce qu'un build INTERNE fait quand une organisation
 * cliente s'y connecte.
 */
export type Edition = 'internal' | 'business';

export const EDITION: Edition = __AMN_EDITION__;

/** True dans le build livré aux organisations clientes. */
export const IS_BUSINESS = EDITION === 'business';

/**
 * Nom produit affiché. Le nom du binaire est fixé par forge.config.ts ; celui-ci
 * est ce que lit l'utilisatrice dans l'app.
 */
export const EDITION_PRODUCT_NAME = IS_BUSINESS ? 'AMN Business' : 'AMN Desktop';
