import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { PublisherGithub } from '@electron-forge/publisher-github';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
// Module JS partagé avec `npm run check:package` : une seule liste de règles.
import { auditPackage, REMEDE } from './scripts/package-rules.mjs';
import { auditInstaller, REMEDE_INSTALLEUR } from './scripts/installer-rules.mjs';

// Full closure of the packaged app's runtime (main + preload) dependencies.
// Only these node_modules ship in the app; everything else (the whole build
// toolchain) is left out. See the `ignore` note in packagerConfig below.
const RUNTIME_MODULES = new Set<string>([
  'better-sqlite3',
  'node-addon-api',
  'bcryptjs',
  'ws',
  'dotenv',
  'electron-squirrel-startup',
  'update-electron-app',
  'github-url-to-object',
  'is-url',
  'ms',
]);

/**
 * Édition construite — même variable que les configs Vite (voir vite.edition.ts).
 *
 * Elle ne change pas seulement ce qui est compilé : elle change l'identité de
 * l'application packagée. Le nom distinct donne un dossier `userData` distinct,
 * donc deux installations qui ne partagent ni base locale, ni session, ni
 * préférences — indispensable pour qu'Aaron puisse faire tourner les deux
 * éditions sur sa machine et tester réellement ce que voit sa cliente.
 */
const IS_BUSINESS = process.env.AMN_EDITION === 'business';
const APP_NAME = IS_BUSINESS ? 'AMN Business' : 'AMN Desktop';

const config: ForgeConfig = {
  /**
   * LE MOTEUR ELECTRON EST-IL COMPLET ? — vérifié à CHAQUE empaquetage.
   *
   * Une version livrée s'est installée sans la moindre erreur puis a refusé de
   * démarrer : « Invalid file descriptor to ICU data received ». Il manquait
   * `icudtl.dat` à côté de l'exécutable — un fichier qui ne vient pas de notre
   * code, mais que l'empaqueteur recopie depuis `node_modules/electron/dist`.
   * Un `dist` incomplet (téléchargement interrompu, extraction partielle,
   * antivirus qui met `icudtl.dat` en quarantaine — c'est un faux positif
   * classique) produit donc un installeur parfaitement valide contenant une
   * application morte.
   *
   * Ni `typecheck`, ni `lint`, ni les contrôles de bundle ne peuvent voir ça :
   * ils lisent du code, et le code est irréprochable. D'où ce contrôle ici,
   * sur l'ARTEFACT, au moment où il vient d'être produit — et qui FAIT ÉCHOUER
   * la construction plutôt que d'avertir. Un avertissement défile ; c'est très
   * exactement comme ça que cet installeur est parti.
   */
  hooks: {
    /**
     * L'INSTALLEUR EST-IL COMPLET ? — vérifié APRÈS les makers, AVANT la publication.
     *
     * `postPackage` ci-dessous garde le dossier construit. Il a fait son
     * travail et n'a pourtant rien empêché : ce dossier n'est pas ce qu'on
     * livre. `electron-forge publish` enchaîne
     *
     *     package → postPackage → makers (Squirrel) → postMake → publication
     *
     * et c'est entre les deux hooks que naît le `.nupkg` que Squirrel embarque
     * dans le `Setup.exe` puis redéploie chez la cliente. Un fichier perdu là —
     * antivirus qui met `icudtl.dat` en quarantaine pendant la compression, par
     * exemple, et les runners GitHub ont Defender actif — donne un installeur
     * qui s'installe proprement et une application qui ne démarre pas.
     *
     * Ce hook-ci s'exécute dans `make` COMME dans `publish`, parce que
     * `publish` passe par `make` (vérifié dans le code d'@electron-forge/core,
     * api/publish.js : « triggering make »). Il lève une exception, donc la
     * publication n'a pas lieu : rien de cassé ne peut plus être téléversé.
     */
    async postMake(_forgeConfig, makeResults) {
      for (const resultat of makeResults) {
        const nupkgs = resultat.artifacts.filter((a: string) => a.endsWith('.nupkg'));
        if (nupkgs.length === 0) {
          // Seul Squirrel produit un .nupkg. Les autres makers (deb, rpm, zip)
          // n'ont rien à vérifier ici — mais un artefact Windows SANS .nupkg
          // serait anormal et doit se voir.
          if (resultat.platform === 'win32') {
            throw new Error(
              `\nAucun .nupkg produit pour win32 : l'installeur n'a pas été fabriqué comme attendu.\n`,
            );
          }
          continue;
        }
        for (const nupkg of nupkgs) {
          const { problemes, entrees } = auditInstaller(nupkg);
          if (problemes.length > 0) {
            const details = problemes.map((p: string) => `  ✗ ${p}`).join('\n');
            throw new Error(
              `\nInstalleur incomplet — cette application ne démarrerait pas une fois installée :\n\n` +
                `${nupkg}\n${details}\n\n${REMEDE_INSTALLEUR}\n`,
            );
          }
          console.log(`[amn] installeur vérifié : ${nupkg} (${entrees} entrées, moteur complet).`);
        }
      }
    },

    async postPackage(_forgeConfig, options) {
      for (const dossier of options.outputPaths) {
        const { problemes, nonCouvert, executable, reference } = auditPackage(dossier);
        if (nonCouvert) continue;
        if (problemes.length > 0) {
          const details = problemes.map((p: string) => `  ✗ ${p}`).join('\n');
          throw new Error(
            `\nPaquet incomplet — cette application ne démarrerait pas :\n\n${dossier}\n${details}\n\n${REMEDE}\n`,
          );
        }
        console.log(
          `[amn] paquet vérifié : moteur Electron complet${reference ? ` (Electron ${reference})` : ''}, ` +
            `application présente (${executable}).`,
        );
      }
    },
  },
  packagerConfig: {
    name: APP_NAME,
    // Nom du binaire sous Linux (Windows/macOS le dérivent de `name`).
    executableName: IS_BUSINESS ? 'amn-business' : 'amn-desktop',
    asar: true,
    // App/executable icon. electron-packager resolves the platform-specific
    // extension automatically: images/icon.ico (Windows), images/icon.icns
    // (macOS), images/icon.png (Linux). Drop the real AMN logo in as those
    // files to replace the placeholder — see README ("Branding / icônes").
    icon: './images/icon',
    // The Vite plugin, left to itself, sets `ignore` to strip EVERYTHING except
    // `/.vite` — which drops node_modules entirely and makes the packaged app
    // throw "Cannot find module 'better-sqlite3'". We provide our own `ignore`
    // (the plugin then respects it) that keeps the Vite output, the manifest,
    // and ONLY the production runtime module tree — an explicit allowlist rather
    // than relying on @electron/packager's prune (which is a no-op with a custom
    // ignore function). AutoUnpackNativesPlugin then extracts better-sqlite3's
    // .node prebuild from the asar so it loads at runtime.
    //
    // RUNTIME_MODULES is the full closure of the main/preload process deps:
    //   better-sqlite3 (+ node-addon-api)  — SQLite persistence
    //   bcryptjs                           — password hashing
    //   ws                                 — amn-api realtime transport
    //   dotenv                             — remote config
    //   electron-squirrel-startup          — Windows install/first-run
    //   update-electron-app (+ github-url-to-object, is-url, ms) — auto-update
    // If a runtime dependency (or one of its transitive deps) is ever added,
    // extend this set — a missing entry surfaces immediately as a load error.
    ignore: (file: string) => {
      if (!file) return false; // keep the root
      if (file === '/package.json') return false;
      if (file.startsWith('/.vite')) return false;
      // Ship the icon assets: the BrowserWindow + tray load images/icon.png at
      // runtime (the .exe/.ico is embedded at build time, but the window/tray
      // icons are read from disk). Without this they fall back to the default
      // Electron icon.
      if (file === '/images' || file.startsWith('/images/')) return false;
      if (file === '/node_modules') return false;
      if (file.startsWith('/node_modules/')) {
        const name = file.startsWith('/node_modules/@')
          ? file.split('/').slice(2, 4).join('/') // scoped: @scope/pkg
          : file.split('/')[2];
        return !RUNTIME_MODULES.has(name);
      }
      return true; // ignore src, out, configs, .git, everything else
    },
  },
  // better-sqlite3 v13 ships portable N-API prebuilds (prebuilds/<platform>-<arch>.node)
  // that load unchanged under Electron — Node-API is ABI-stable across Node and
  // Electron. So we skip the native rebuild entirely (onlyModules: []): no
  // compiler, no node-gyp, no Electron headers download needed on any build
  // machine. AutoUnpackNativesPlugin still extracts the .node from the asar.
  rebuildConfig: { onlyModules: [] },
  makers: [
    new MakerSquirrel({
      // Icon embedded in the installer (Setup.exe) and used for the Start-menu /
      // desktop shortcuts it creates. The app/window icon comes from
      // packagerConfig.icon; this covers the installer + shortcuts on Windows.
      setupIcon: './images/icon.ico',
    }),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  // `npm run publish` uploads the built artifacts (incl. the Squirrel RELEASES
  // file) to GitHub Releases, which is what update.electronjs.org / the
  // in-app auto-updater reads. Needs GITHUB_TOKEN in the environment.
  //
  // L'édition Business ne publie pas : les Releases de ce dépôt portent les
  // artefacts de l'édition interne, et laisser un publisher branché dessus
  // reviendrait à proposer AMN Desktop en mise à jour d'AMN Business. La
  // livraison de la première cliente est manuelle (voir docs/BUSINESS.md).
  publishers: IS_BUSINESS
    ? []
    : [
        new PublisherGithub({
          repository: { owner: 'aaronsyaa-dev', name: 'amn-desktop' },
          draft: false,
          prerelease: false,
        }),
      ],
  plugins: [
    // Native modules (better-sqlite3) ship a compiled .node binary that cannot
    // be require()'d from inside the asar archive. This plugin extracts them to
    // app.asar.unpacked so they load correctly in the packaged app — without
    // it, an installed build throws "Cannot find module 'better-sqlite3'".
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
