/**
 * EMPAQUETAGE ET PUBLICATION — electron-builder + NSIS
 * ═══════════════════════════════════════════════════
 *
 * ## Pourquoi cette chaîne remplace Squirrel.Windows
 *
 * Quatre versions publiées d'affilée (v1.2.35 → v1.2.38) ne démarraient pas
 * une fois installées, avec l'erreur ICU « Invalid file descriptor to ICU data
 * received ». L'autopsie des artefacts RÉELLEMENT publiés a établi que :
 *
 *   · chaque fichier du moteur Electron y était identique à l'octet près à la
 *     release officielle electron-v43.2.0-win32-x64 (CRC + taille, sur les
 *     19 fichiers, `icudtl.dat` compris) ;
 *   · entre la v1.2.33 (qui fonctionnait) et les versions cassées, seuls
 *     62 octets différaient dans l'exe — les chaînes de version et le hash
 *     d'intégrité asar, le re-tamponnage normal de chaque release.
 *
 * L'artefact était donc SAIN. La défaillance vivait dans le seul maillon
 * qu'aucun contrôle d'artefact ne peut voir : la mécanique d'installation et
 * de lancement de Squirrel.Windows (extraction par `Update.exe`, stub de
 * lancement, binaires non signés que les antivirus adorent mettre en
 * quarantaine). NSIS installe des fichiers ordinaires, sans exécutable
 * résident ni stub — et `electron-updater` fait les mises à jour différentielles
 * par-dessus.
 *
 * La CI ne se contente plus d'être verte : elle INSTALLE l'artefact final sur
 * un runner Windows et exige que l'exécutable démarre réellement
 * (`--smoke-test`, voir release.yml) avant toute publication.
 *
 * ## Les deux éditions
 *
 * Même couture que partout (vite.edition.ts) : AMN_EDITION=business bascule
 * l'identité complète. Les deux applications ont un appId, un nom de produit
 * et un exécutable distincts — donc un dossier de données distinct, et deux
 * installations qui coexistent sur la machine d'Aaron sans se toucher.
 *
 * L'édition CLIENTE (cible `business`) n'a PAS de bloc `publish` : son canal de mise à jour est
 * le registre amn-api (voir src/main/updater.ts, Bloc O), jamais les Releases
 * GitHub de ce dépôt — c'est la séparation stricte des deux chaînes, et elle
 * est structurelle ici, pas documentaire.
 */

const IS_BUSINESS = process.env.AMN_EDITION === 'business';

const config = {
  /*
    LES NOMS ONT ÉTÉ ÉCHANGÉS (BLOC 1).

    La cible `business` est celle livrée aux CLIENTES : elle s'appelle
    désormais « AMN Desktop ». La cible `internal`, celle d'Aaron et Mohamed,
    s'appelle « AMN Business ». Les identifiants de cible n'ont pas suivi —
    voir `src/edition/edition.ts` pour la raison.
  */
  appId: IS_BUSINESS ? 'com.amndevsec.desktop' : 'com.amndevsec.business',
  productName: IS_BUSINESS ? 'AMN Desktop' : 'AMN Business',

  /*
    LE DOSSIER D'INSTALLATION, ET UN DÉFAUT QUE LE RENOMMAGE A RÉVÉLÉ.

    Avec `oneClick: true` + `perMachine: false`, NSIS ne nomme PAS le dossier
    d'après `productName` : il le nomme d'après le champ `name` de
    package.json (voir `getWindowsInstallationDirName`, app-builder-lib). Or ce
    champ est UNIQUE pour les deux éditions, puisqu'elles partagent un dépôt.

    Mesuré avant de toucher à quoi que ce soit : les deux éditions
    s'installaient dans `%LOCALAPPDATA%\Programs\amn-desktop`. Installer l'une
    écrasait l'autre — alors que le commentaire de ce fichier affirmait qu'elles
    « coexistent sans se toucher ». C'était vrai du dossier de DONNÉES
    (`app.setName`), faux du dossier d'installation.

    `extraMetadata.name` réécrit ce champ à la construction, par édition. Les
    deux applications ont donc enfin un dossier chacune. Le renommage seul
    n'aurait fait qu'échanger laquelle écrase l'autre.
  */
  extraMetadata: {
    name: IS_BUSINESS ? 'amn-desktop' : 'amn-business',
  },
  directories: {
    output: 'dist-app',
    buildResources: 'images',
  },
  /*
    Ce qui entre dans l'asar : les trois bundles Vite, le manifeste, les
    icônes lues au runtime (fenêtre + tray). Les node_modules de production
    (dependencies de package.json) sont résolus et inclus automatiquement par
    electron-builder — c'est sa résolution, pas une liste recopiée à la main,
    donc elle ne peut pas diverger du package.json.
  */
  files: ['.vite/**/*', 'package.json', 'images/**/*'],
  asar: true,
  /*
    Hors de l'asar : les modules natifs. Un `.node` ne se charge pas depuis une
    archive. koffi rejoint better-sqlite3 — la chaîne précédente l'omettait
    entièrement, ce qui privait l'app installée de la prise de contrôle à
    distance sans que personne le voie (l'appel est paresseux et gardé).
  */
  asarUnpack: ['**/node_modules/better-sqlite3/**', '**/node_modules/koffi/**'],
  // better-sqlite3 v13 et koffi livrent des prébuilds N-API portables : aucune
  // recompilation nécessaire, sur aucune machine de build. (Équivalent du
  // rebuildConfig `onlyModules: []` de l'ancienne chaîne.)
  npmRebuild: false,
  // Les fuses (RunAsNode coupé, etc.) sont posées ici — voir le script.
  afterPack: './scripts/eb-after-pack.mjs',
  win: {
    icon: 'images/icon.ico',
    target: [{ target: 'nsis', arch: ['x64'] }],
  },
  nsis: {
    /*
      Un seul clic, pas d'assistant : l'installeur s'exécute, l'application
      s'ouvre. C'est le niveau de friction promis à une cliente non technique
      (Bloc O) — et c'est aussi le flux d'`electron-updater` : télécharger,
      lancer, c'est réinstallé.
    */
    oneClick: true,
    perMachine: false,
    deleteAppDataOnUninstall: false,
    artifactName: '${productName}-Setup-${version}.${ext}',
  },
  linux: {
    // Cible `dir` uniquement : le paquet Linux ne se distribue pas, il sert
    // aux vérifications réelles (smoke test, contrôle du moteur) dans un
    // environnement où l'on peut lancer l'exécutable.
    target: [{ target: 'dir', arch: ['x64'] }],
    executableName: IS_BUSINESS ? 'amn-desktop' : 'amn-business',
    icon: 'images/icon.png',
  },
  /*
    `null`, et non `[]` — mesuré, pas supposé : avec un tableau vide,
    electron-builder déduit le dépôt du remote git et écrit quand même
    `app-update.yml` (owner/repo/github) dans les ressources d'un build
    Business. `null` coupe la déduction. Et parce qu'une valeur de config ne
    prouve rien, le hook afterPack REFUSE tout build Business qui contiendrait
    ce fichier — voir scripts/eb-after-pack.mjs.
  */
  publish: IS_BUSINESS
    ? null
    : [{ provider: 'github', owner: 'aaronsyaa-dev', repo: 'amn-desktop' }],
};

export default config;
