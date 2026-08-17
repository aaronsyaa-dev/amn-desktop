/**
 * L'ADRESSE PUBLIQUE DE L'APPLICATION — celle qu'on peut envoyer à quelqu'un
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ## Le défaut trouvé (BLOC E)
 *
 * Le lien d'appel se fabriquait avec `window.location.origin`. Dans un
 * navigateur, ça donne `https://…` et tout va bien. **Dans l'application
 * installée, non** : le processus principal charge le renderer avec
 * `mainWindow.loadFile(...)` (voir src/main.ts), donc `origin` vaut `file://`
 * et le lien produit ressemble à :
 *
 *     file:///C:/Users/…/resources/app/.vite/renderer/main_window/index.html#/appel?token=…
 *
 * C'est un chemin sur la machine d'Aaron. Collé dans un courriel, il n'ouvre
 * rien chez le prospect — et collé dans une barre d'adresse, il n'ouvre rien non
 * plus ailleurs que chez lui. Ça explique aussi, rétrospectivement, pourquoi ce
 * lien avait déjà fini dans une barre de recherche Google : il ne ressemblait
 * pas à une adresse.
 *
 * Ce n'est donc pas une régression des chantiers récents : c'est une différence
 * entre l'endroit où c'était testé (le navigateur) et l'endroit où c'est utilisé
 * (l'application installée).
 *
 * ## Pourquoi l'application ne peut pas le deviner
 *
 * L'adresse publique du build web n'est écrite nulle part dans le code : c'est
 * un fait de déploiement. Le poste installé ne l'a jamais vue. La seule issue
 * honnête est de la lui donner à la compilation — et, faute de quoi, de REFUSER
 * de fabriquer un lien plutôt que d'en fabriquer un faux.
 *
 * Un lien faux est pire qu'une absence de lien : Aaron l'envoie, le prospect ne
 * peut rien en faire, et personne ne sait pourquoi.
 */

/** L'adresse publique du build web, donnée à la compilation. */
const CONFIGURED = (import.meta.env.VITE_AMN_WEB_URL || '').replace(/\/$/, '');

/**
 * L'origine utilisable pour un lien qu'on DONNE, ou `null`.
 *
 * `null` veut dire : « je ne connais aucune adresse publique ». L'appelant doit
 * alors expliquer, pas inventer.
 */
export function publicOrigin(): string | null {
  if (CONFIGURED) return CONFIGURED;
  try {
    const { origin, protocol, pathname } = window.location;
    // `file:` et `app:` désignent la machine de qui regarde. Tout le reste
    // (http, https) est une adresse que quelqu'un d'autre peut ouvrir.
    if (protocol !== 'http:' && protocol !== 'https:') return null;
    // Le chemin est conservé : le build web peut vivre dans un sous-dossier.
    return `${origin}${pathname.replace(/index\.html$/, '')}`.replace(/\/$/, '');
  } catch {
    return null;
  }
}

/** Vrai quand l'application sait fabriquer un lien envoyable. */
export function canBuildPublicLink(): boolean {
  return publicOrigin() !== null;
}

/**
 * Ce qu'il manque, dit à qui peut le corriger. Affiché à l'écran plutôt que
 * caché dans un journal : c'est Aaron qui construit ses builds.
 */
export const PUBLIC_URL_MISSING =
  'Cette application installée ne connaît pas l’adresse publique du site. Un lien fabriqué ici ' +
  'pointerait vers un fichier local, que personne d’autre ne peut ouvrir. Reconstruisez le poste ' +
  'avec VITE_AMN_WEB_URL=https://… (l’adresse de la version web), ou émettez le lien depuis la ' +
  'version web.';
