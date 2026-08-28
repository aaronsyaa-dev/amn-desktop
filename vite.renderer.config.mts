import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import { editionAliases, editionDefine, resolveEdition, type Edition } from './vite.edition';

/**
 * Identité affichée par la coquille web : titre de l'onglet et manifeste PWA.
 *
 * Ces deux fichiers sont copiés tels quels par Vite, donc « AMN DevSec » s'y
 * retrouvait en clair dans l'application d'une cliente — jusque dans le titre
 * de sa fenêtre. Ils portent maintenant des jetons, remplacés ici selon
 * l'édition construite.
 */
/*
  LES NOMS N'AVAIENT PAS SUIVI L'ÉCHANGE DU BLOC 1.

  Cette table est la QUATRIÈME liste de noms de produit du dépôt, et la seule
  que `check:naming` ne regardait pas — parce qu'elle vit à la racine et non
  dans `src/`. Elle décide pourtant de ce qu'une cliente voit le plus :

    · le nom sur son écran d'accueil après « Ajouter à l'écran d'accueil » ;
    · le titre de sa fenêtre ;
    · le titre de ses notifications push, service worker compris.

  Avant correction, l'édition CLIENTE s'annonçait « AMN Business » alors que
  l'application qu'elle vient d'installer s'appelle « AMN Desktop ». Et
  l'édition interne s'annonçait « AMN DevSec » — le nom de la BOÎTE, pas du
  produit.

  `EDITION_PRODUCT_NAME` (src/edition/edition.ts) ne peut pas être importé ici :
  ce fichier est la configuration Vite, évaluée avant tout alias d'édition. Les
  deux listes sont donc croisées par `npm run check:naming`, qui échoue si
  elles divergent d'un caractère.
*/
const IDENTITY: Record<Edition, { name: string; description: string }> = {
  internal: {
    name: 'AMN Business',
    description: 'Poste de commandement AMN — chat, tâches, clients, décisions, notes, rapports.',
  },
  business: {
    name: 'AMN Desktop',
    description: 'Votre activité au quotidien — agenda, clients, tâches, notes, documents.',
  },
};

function editionIdentityPlugin(edition: Edition) {
  const { name, description } = IDENTITY[edition];
  const substitute = (input: string) =>
    input.replace(/%AMN_PRODUCT_NAME%/g, name).replace(/%AMN_PRODUCT_DESCRIPTION%/g, description);

  return {
    name: 'amn-edition-identity',
    transformIndexHtml: (html: string) => substitute(html),
    // Les fichiers de `public/` sont copiés hors du bundle Rollup : ils ne
    // passent pas par `generateBundle` et doivent être repris sur disque une
    // fois la sortie écrite.
    writeBundle(options: { dir?: string }) {
      const outDir = options.dir;
      if (!outDir) return;
      for (const file of ['manifest.webmanifest', 'sw.js']) {
        const target = path.join(outDir, file);
        if (!fs.existsSync(target)) continue;
        fs.writeFileSync(target, substitute(fs.readFileSync(target, 'utf-8')));
      }
    },
  };
}

// https://vitejs.dev/config
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const edition = resolveEdition(env);

  return {
    plugins: [react(), tailwindcss(), editionIdentityPlugin(edition)],
    // Les alias `@edition/*` décident, à la compilation, quels modules entrent
    // dans le bundle. Voir vite.edition.ts.
    resolve: { alias: editionAliases(edition) },
    define: editionDefine(edition),
  };
});
