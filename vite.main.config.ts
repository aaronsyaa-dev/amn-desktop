import { defineConfig, loadEnv } from 'vite';
import { builtinModules } from 'node:module';
import { editionAliases, editionDefine, resolveEdition } from './vite.edition';

// https://vitejs.dev/config
// The main process must not bundle native modules (better-sqlite3) or Electron;
// they are resolved at runtime from node_modules (unpacked via the
// auto-unpack-natives plugin). Node built-ins stay external too.
export default defineConfig(({ mode }) => {
  // Bake the central-API config into the MAIN bundle at build time.
  //
  // Why: `src/main/remoteConfig.ts` reads process.env.AMN_API_URL /
  // AMN_API_OPERATOR_TOKEN. In dev that comes from a local `.env` (loaded by
  // dotenv). But a PACKAGED app has no `.env` on disk and no such OS env vars,
  // so at runtime those reads were empty → the app fell back to "LOCAL" mode
  // and the sync WebSocket never connected. Inlining the values here fixes that:
  // CI (GitHub Actions) provides them as env/secrets, `loadEnv` also reads a
  // local `.env` for dev, and we replace the `process.env.*` references with the
  // literal strings at build time.
  //
  // We only define a key when a build-time value EXISTS; otherwise the original
  // `process.env.*` read is left in place so a runtime OS env var can still
  // configure a dev/self-built binary.
  //
  // SECURITY NOTE: the operator token ends up in the main bundle (inside
  // app.asar, extractable). That's an accepted trade-off for this 2-operator
  // internal tool — the token is already shared between both operators (see
  // amn-api/src/ws/hub.js). Tighten to per-user tokens before any wider use.
  const env = loadEnv(mode, process.cwd(), '');
  const edition = resolveEdition(env);
  const define: Record<string, string> = { ...editionDefine(edition) };
  if (env.AMN_API_URL) define['process.env.AMN_API_URL'] = JSON.stringify(env.AMN_API_URL);
  /*
    LE JETON OPÉRATEUR N'ENTRE JAMAIS DANS UN BUILD BUSINESS (BLOC O)
    ─────────────────────────────────────────────────────────────────
    Le renderer était déjà protégé : `bridge.ts` écrit `IS_BUSINESS ? '' : …`,
    une constante remplacée à la compilation, donc Rollup supprime la branche et
    les lectures d'environnement avec elle. Le processus PRINCIPAL, lui, ne
    l'était pas — et c'est lui qui parle à amn-api dans l'application installée.

    Conséquence observée en conditions de test : une édition Business
    construite sur une machine dont le `.env` porte AMN_API_OPERATOR_TOKEN
    embarquait ce jeton, et l'application se synchronisait sur l'espace d'AMN
    DevSec AVANT même que la cliente se connecte — nos fiches clients
    s'affichaient chez elle. Ce n'est pas une fuite théorique : elle a eu lieu
    sur une base d'essai.

    La machine d'Aaron a forcément ce jeton dans son `.env` : c'est la même
    machine qui fait tourner l'édition interne. Le build Business ne peut donc
    pas se reposer sur « ne pas le mettre » — il doit refuser de le prendre.

    `scripts/publish-release.mjs` vérifie l'autre bout : il exige que la LECTURE
    `process.env.AMN_API_OPERATOR_TOKEN` soit encore présente dans l'artefact.
    Sa disparition signifierait qu'une valeur a été figée à sa place.
  */
  const bakeToken = Boolean(env.AMN_API_OPERATOR_TOKEN) && edition !== 'business';
  if (bakeToken) {
    define['process.env.AMN_API_OPERATOR_TOKEN'] = JSON.stringify(env.AMN_API_OPERATOR_TOKEN);
  }
  /*
    Le fait EST inscrit dans le bundle, pas seulement respecté.

    Première tentative, abandonnée : vérifier dans l'artefact que la lecture
    `process.env.AMN_API_OPERATOR_TOKEN` était toujours là. Elle l'est de toute
    façon — un message d'erreur du processus principal cite ce nom en toutes
    lettres. Le contrôle passait au vert sur un build qui embarquait bel et
    bien le jeton ; mesuré, pas supposé.

    Une constante littérale, elle, ne peut pas être satisfaite par accident :
    `remoteConfig.ts` la replie en UNE chaîne unique, et c'est cette chaîne que
    `scripts/publish-release.mjs` cherche dans l'asar.
  */
  define['__AMN_TOKEN_BAKED__'] = JSON.stringify(bakeToken);

  return {
    define,
    // Le process main a lui aussi sa couture d'édition : `@edition/mainExclusive`
    // porte les appels amn-api et les canaux IPC des produits exclusifs, et
    // n'est tout simplement pas construit dans l'édition Business.
    resolve: { alias: editionAliases(edition) },
    build: {
      rollupOptions: {
        external: [
          'electron',
          'better-sqlite3',
          'bcryptjs',
          'dotenv',
          'dotenv/config',
          'ws',
          ...builtinModules,
          ...builtinModules.map((m) => `node:${m}`),
        ],
      },
    },
  };
});
