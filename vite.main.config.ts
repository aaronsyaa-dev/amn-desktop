import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';

// https://vitejs.dev/config
// The main process must not bundle native modules (better-sqlite3) or Electron;
// they are resolved at runtime from node_modules (unpacked via the
// auto-unpack-natives plugin). Node built-ins stay external too.
export default defineConfig({
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
});
