/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * amn-api URL + token for the BROWSER FALLBACK (headless dev/test outside
   * Electron, AND the deployed web/PWA build). These get inlined into the client
   * bundle by Vite. In Electron the credentials instead live server-side in the
   * main process (AMN_API_URL / AMN_API_OPERATOR_TOKEN in the root .env) and
   * never reach the renderer. See docs/ARCHITECTURE.md and docs/PWA.md.
   *
   * For the public web build, set VITE_AMN_API_WEB_TOKEN — the scoped web token
   * (syncs collections, blocked from site admin) — NOT the full operator token,
   * which the bundle would otherwise expose. The operator token remains only as
   * a local dev fallback.
   */
  readonly VITE_AMN_API_URL?: string;
  /**
   * L'adresse publique du build web (BLOC E). Sans elle, un poste INSTALLÉ ne
   * peut pas fabriquer un lien envoyable : il ne connaît que `file://`.
   * Voir src/lib/publicUrl.ts.
   */
  readonly VITE_AMN_WEB_URL?: string;
  /**
   * LE RELAIS TURN — ce qui manque pour qu'un téléphone en données mobiles
   * atteigne un poste en wifi. Voir src/lib/serveursIce.ts : sans lui, ICE
   * n'a que des STUN, et un CGNAT d'opérateur (NAT symétrique) rend leur
   * réponse inutilisable pour le pair d'en face.
   *
   * Les trois vont ensemble : une URL sans identifiants n'est pas annoncée au
   * navigateur, parce qu'un TURN non authentifié refuse chaque allocation.
   */
  readonly VITE_AMN_TURN_URL?: string;
  readonly VITE_AMN_TURN_USER?: string;
  readonly VITE_AMN_TURN_PASS?: string;
  readonly VITE_AMN_API_OPERATOR_TOKEN?: string;
  readonly VITE_AMN_API_WEB_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
