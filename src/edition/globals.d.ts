/**
 * Constante injectée par Vite (`define`) dans les trois bundles — renderer,
 * process main, preload. Littérale, donc éliminable à la compilation : une
 * branche `if (!IS_BUSINESS)` disparaît du bundle Business au lieu d'y rester
 * en code mort.
 */
declare const __AMN_EDITION__: 'internal' | 'business';
