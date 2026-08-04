/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * amn-api URL + operator token for the BROWSER FALLBACK ONLY (headless
   * dev/test outside Electron). These get inlined into the client bundle by
   * Vite — never the production path. In Electron, the same credentials live
   * server-side in the main process (AMN_API_URL / AMN_API_OPERATOR_TOKEN in
   * the root .env) and never reach the renderer. See docs/ARCHITECTURE.md.
   */
  readonly VITE_AMN_API_URL?: string;
  readonly VITE_AMN_API_OPERATOR_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
