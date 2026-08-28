/**
 * Édition du build — le seul interrupteur de tout ce dossier.
 *
 * Deux éditions, un seul dépôt :
 *
 *   - `internal` — AMN Business, ce que font tourner Aaron et Mohamed. Tous les
 *     modules, y compris les produits de cybersécurité (Trackers, Scanner,
 *     Comply, SSL Monitor) et les modules d'équipe (Équipe, Décisions,
 *     Connaissances).
 *   - `business` — AMN Desktop, livré aux organisations clientes. Les modules
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
 * Nom produit affiché — la source unique, lue par tous les écrans.
 *
 * ATTENTION à la lecture : la CIBLE de build s'appelle toujours `internal` et
 * `business`, mais les NOMS COMMERCIAUX ont été échangés. L'édition interne
 * (celle d'Aaron et Mohamed) s'appelle désormais « AMN Business » ; celle
 * livrée aux clientes s'appelle « AMN Desktop ».
 *
 * Les identifiants de cible n'ont pas été renommés avec eux, et c'est
 * délibéré : ils apparaissent dans les alias Vite (`@edition/*`), les noms de
 * fichiers (`*.business.tsx`), `AMN_EDITION`, et une centaine de commentaires.
 * Les renommer aurait mêlé un changement de marque à un changement de
 * structure, dans le même diff, sans qu'aucun contrôle ne puisse distinguer
 * les deux. Le nom commercial vit ici ; la cible reste ce qu'elle était.
 *
 * Le nom du binaire, lui, est fixé par `electron-builder.config.mjs`.
 */
export const EDITION_PRODUCT_NAME = IS_BUSINESS ? 'AMN Desktop' : 'AMN Business';

/**
 * Le nom de l'application CLIENTE — le même pour tout le monde.
 *
 * Sert aux rares textes qui envoient quelqu'un vers l'application des
 * clientes : le refus de connexion, quand un compte client se présente sur un
 * build interne. Ce message était écrit en dur et nommait « AMN Business »,
 * c'est-à-dire l'édition INTERNE, à l'utilisatrice cliente qu'il fallait
 * envoyer vers « AMN Desktop ». Le seul message dont le rôle est d'orienter
 * envoyait au mauvais endroit — l'échange des noms commerciaux rend l'erreur
 * facile à écrire de mémoire.
 *
 * Une constante fixe, et non « le nom de l'autre édition » : celle-ci
 * vaudrait « AMN Business » dans le paquet d'une cliente, où le message ne
 * s'affiche jamais (le refus est gardé par `!IS_BUSINESS`). On y ferait donc
 * entrer le nom de notre produit interne pour rien — et `check:business` le
 * refuse désormais.
 *
 * Dans l'édition cliente, cette constante vaut exactement
 * `EDITION_PRODUCT_NAME` : aucune chaîne supplémentaire n'entre dans son
 * paquet.
 */
export const CLIENT_PRODUCT_NAME = 'AMN Desktop';

/**
 * La version de ce build.
 *
 * À préférer TOUJOURS à `CURRENT_VERSION` du changelog, qui n'est que le titre
 * de la dernière note de version rédigée — deux choses différentes, dont l'une
 * dérive dès qu'on publie sans écrire de note.
 */
export const APP_VERSION: string = __AMN_VERSION__;
