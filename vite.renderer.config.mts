import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { editionAliases, editionDefine, resolveEdition } from './vite.edition';

// https://vitejs.dev/config
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const edition = resolveEdition(env);

  return {
    plugins: [react(), tailwindcss()],
    // Les alias `@edition/*` décident, à la compilation, quels modules entrent
    // dans le bundle. Voir vite.edition.ts.
    resolve: { alias: editionAliases(edition) },
    define: editionDefine(edition),
  };
});
