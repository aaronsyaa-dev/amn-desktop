/**
 * Contrôle de résilience : l'application ne doit jamais pouvoir s'enfermer.
 *
 * Trois défauts réels sont à l'origine de ce fichier. Ils n'ont l'air de rien
 * séparément, et ensemble ils ont rendu une application installée totalement
 * inutilisable, y compris après une réinstallation propre :
 *
 *   1. deux coquilles montaient la MÊME table de routes avec des piles de
 *      fournisseurs recopiées à la main. Elles ont divergé d'un fournisseur, et
 *      un écran partagé a levé « useActivity must be used within an
 *      ActivityProvider » ;
 *   2. l'écran d'erreur ne proposait que « Réessayer » et « Recharger » — deux
 *      gestes qui ramènent au même état, donc à la même erreur ;
 *   3. le contexte fautif était restauré à chaque démarrage depuis
 *      `localStorage`, qui vit dans `userData` et survit à une désinstallation.
 *
 * Chacun de ces trois points est vérifié ici, sur le CODE, parce qu'aucun ne se
 * voit à la relecture d'un écran qui marche.
 *
 *   npm run check:resilience
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (p: string) => fs.readFileSync(path.join(racine, p), 'utf-8');

/** Retire commentaires et chaînes : un contrôle satisfait par un commentaire ne contrôle rien. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

const failures: string[] = [];
function check(name: string, run: () => void) {
  try {
    run();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push(name);
    console.error(`  ÉCHEC ${name}`);
    console.error(`         ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
  }
}

console.log('Résilience — une erreur d’écran ne doit jamais enfermer l’utilisateur\n');

/*
  Les deux coquilles qui montent la table de routes Business. Si une troisième
  apparaît un jour, elle doit être ajoutée ici — et le contrôle qui suit dira
  pourquoi.
*/
const COQUILLES = ['src/business/BusinessLayout.tsx', 'src/client-context/ClientContextLayout.tsx'];

/** Fournisseurs qui ne doivent plus JAMAIS être montés à la main dans une coquille. */
const A_NE_PAS_RECOPIER = [
  'SyncProvider',
  'ProfilesProvider',
  'ActivityProvider',
  'ToastProvider',
  'UndoProvider',
  'TagProvider',
];

check('les deux coquilles Business partagent UNE seule pile de fournisseurs', () => {
  for (const fichier of COQUILLES) {
    const src = code(lire(fichier));
    assert.match(src, /<SpaceProviders[\s>]/, `${fichier} ne monte pas <SpaceProviders>`);
    for (const fournisseur of A_NE_PAS_RECOPIER) {
      assert.ok(
        !new RegExp(`<${fournisseur}[\\s>]`).test(src),
        `${fichier} remonte <${fournisseur}> à la main — c'est exactement ainsi que les deux piles ont divergé`,
      );
    }
  }
});

check('la pile partagée contient bien tous les fournisseurs attendus', () => {
  const src = code(lire('src/state/SpaceProviders.tsx'));
  for (const fournisseur of A_NE_PAS_RECOPIER) {
    assert.match(src, new RegExp(`<${fournisseur}[\\s>]`), `SpaceProviders ne monte pas ${fournisseur}`);
  }
  // ActivityProvider lit useSync : il doit vivre SOUS SyncProvider.
  assert.ok(
    src.indexOf('<SyncProvider') < src.indexOf('<ActivityProvider'),
    'ActivityProvider doit être imbriqué sous SyncProvider — il lit le magasin de synchronisation',
  );
});

check('l’écran d’erreur offre une sortie qui CHANGE l’état', () => {
  const src = lire('src/components/ErrorBoundary.tsx');
  assert.match(src, /Retour à l’accueil/, 'aucun bouton de retour à l’accueil');
  assert.match(
    code(src),
    /clearNavigationState\(\)/,
    'le bouton de retour ne désamorce pas l’état : il renverrait dans le mur qu’il doit contourner',
  );
});

check('le démarrage pose sa marque AVANT le premier rendu', () => {
  const src = code(lire('src/renderer.tsx'));
  const marque = src.indexOf('beginBoot()');
  const rendu = src.indexOf('createRoot(');
  assert.ok(marque !== -1, 'renderer.tsx n’appelle pas beginBoot()');
  assert.ok(
    marque < rendu,
    'beginBoot() doit précéder createRoot : après, le composant fautif a déjà été rendu',
  );
});

check('la marque n’est levée que par une coquille applicative, jamais à la racine', () => {
  const racineSrc = code(lire('src/renderer.tsx'));
  assert.ok(
    !/markBootHealthy/.test(racineSrc),
    'lever la marque à la racine la lèverait aussi quand l’écran d’erreur s’affiche',
  );
  const monte = ['src/components/AppLayout.tsx', 'src/business/BusinessLayout.tsx', 'src/client-context/ClientContextLayout.tsx']
    .filter((f) => /<BootHealthy\s*\/>/.test(code(lire(f))));
  assert.equal(monte.length, 3, `<BootHealthy /> manque dans : ${monte.join(', ') || 'toutes les coquilles'}`);
});

check('le module de secours vise la même clé que le contexte qu’il désamorce', () => {
  const cle = (src: string) => code(src).match(/['"]amn\.support\.token['"]/)?.[0];
  const secours = cle(lire('src/lib/safeBoot.ts'));
  const contexte = cle(lire('src/state/OrgContextContext.tsx'));
  assert.ok(secours, 'safeBoot.ts ne nomme aucune clé de contexte');
  assert.equal(
    secours,
    contexte,
    'les deux clés ont divergé : le mode de secours effacerait une entrée qui n’existe pas',
  );
});

check('une position de fenêtre hors écran ne peut pas rendre l’app invisible', () => {
  const src = code(lire('src/main.ts'));
  assert.match(src, /function boundsAreReachable/, 'aucune validation de la position retenue');
  assert.match(
    src,
    /boundsAreReachable\(b\)/,
    'loadBounds n’appelle pas la validation — la position est restaurée telle quelle',
  );
  assert.match(src, /getAllDisplays\(\)/, 'la validation ne consulte pas les écrans réellement présents');
});

if (failures.length > 0) {
  console.error(`\n${failures.length} contrôle(s) en échec :`);
  for (const name of failures) console.error(`  - ${name}`);
  process.exit(1);
}
console.log('\nRésilience : tous les contrôles passent.');
