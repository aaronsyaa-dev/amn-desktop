import { defineConfig, loadEnv } from 'vite';
import { builtinModules } from 'node:module';

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
  const define: Record<string, string> = {};
  if (env.AMN_API_URL) define['process.env.AMN_API_URL'] = JSON.stringify(env.AMN_API_URL);
  if (env.AMN_API_OPERATOR_TOKEN) {
    define['process.env.AMN_API_OPERATOR_TOKEN'] = JSON.stringify(env.AMN_API_OPERATOR_TOKEN);
  }

  return {
    define,
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
