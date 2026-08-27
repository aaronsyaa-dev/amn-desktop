/**
 * LES FUSES ELECTRON, POSÉES APRÈS L'EMPAQUETAGE
 * ═════════════════════════════════════════════
 *
 * Reprises de l'ancienne chaîne (forge.config.ts) à une exception près :
 *
 *   · RunAsNode: OFF — l'exécutable ne peut pas être détourné en interpréteur
 *     Node (`ELECTRON_RUN_AS_NODE`), l'abus classique d'un binaire Electron ;
 *   · EnableCookieEncryption: ON ;
 *   · NODE_OPTIONS et --inspect: OFF ;
 *   · OnlyLoadAppFromAsar: ON — l'app ne se charge que depuis app.asar.
 *
 * L'exception : EnableEmbeddedAsarIntegrityValidation reste ÉTEINTE ici.
 * Cette fuse exige qu'un hash de l'asar soit gravé dans les ressources de
 * l'exécutable, geste que faisait le plugin Fuses de Forge. La graver à faux —
 * ou compter sur un empaqueteur qui ne le fait pas exactement comme Electron
 * l'attend — produit une application qui meurt au démarrage : très précisément
 * la panne que cette migration corrige. On ne réintroduit pas le risque pour
 * une protection marginale (elle ne défend que contre la modification locale
 * de l'asar, par quelqu'un qui a déjà la main sur la machine).
 */

import fs from 'node:fs';
import path from 'node:path';
import { flipFuses, FuseVersion, FuseV1Options } from '@electron/fuses';

export default async function afterPack(context) {
  /*
    UN BUILD BUSINESS NE CONNAÎT PAS LE FLUX GITHUB — vérifié sur l'artefact.

    `app-update.yml` est le fichier qu'electron-updater lit pour savoir OÙ
    chercher les mises à jour. Dans un build Business il ne doit pas exister :
    le canal des clientes est amn-api, et les Releases GitHub portent l'édition
    interne. Mesuré à la première construction : avec `publish: []`,
    electron-builder déduisait le dépôt du remote git et écrivait quand même le
    fichier. La config dit désormais `null` — et ce hook refuse l'artefact si
    le fichier réapparaît, parce qu'une valeur de config ne prouve rien.
  */
  if (process.env.AMN_EDITION === 'business') {
    const flux = path.join(context.appOutDir, 'resources', 'app-update.yml');
    if (fs.existsSync(flux)) {
      throw new Error(
        `build Business refusé : ${flux} existe — ce fichier brancherait une cliente sur les Releases internes.`,
      );
    }
  }

  const nom = context.packager.appInfo.productFilename;
  const executable =
    context.electronPlatformName === 'win32'
      ? path.join(context.appOutDir, `${nom}.exe`)
      : path.join(context.appOutDir, context.packager.executableName ?? nom);

  await flipFuses(executable, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  });
  // eslint-disable-next-line no-console
  console.log(`[amn] fuses posées sur ${executable}`);
}
