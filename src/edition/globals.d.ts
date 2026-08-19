/**
 * Constante injectée par Vite (`define`) dans les trois bundles — renderer,
 * process main, preload. Littérale, donc éliminable à la compilation : une
 * branche `if (!IS_BUSINESS)` disparaît du bundle Business au lieu d'y rester
 * en code mort.
 */
declare const __AMN_EDITION__: 'internal' | 'business';

/**
 * Version du produit, injectée depuis `package.json` à la construction.
 *
 * Unique source de vérité, sur les trois plateformes : Electron, web et PWA
 * affichent donc forcément le même numéro, et il est forcément celui du tag.
 */
declare const __AMN_VERSION__: string;

/**
 * Vrai quand un jeton opérateur PARTAGÉ a été figé dans ce build (voir
 * vite.main.config.ts). Faux dans toute édition Business, par construction.
 *
 * Sert à deux choses : une ligne de diagnostic honnête au démarrage, et un
 * marqueur relisible dans l'artefact empaqueté — voir ARTIFACT_REQUIRED /
 * ARTIFACT_FORBIDDEN dans scripts/business-bundle-rules.mjs.
 */
declare const __AMN_TOKEN_BAKED__: boolean;
