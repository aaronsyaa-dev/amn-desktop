import { defineConfig, loadEnv } from 'vite';
import { editionAliases, editionDefine, resolveEdition } from './vite.edition';

// https://vitejs.dev/config
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const edition = resolveEdition(env);
  return {
    resolve: { alias: editionAliases(edition) },
    define: editionDefine(edition),
  };
});
