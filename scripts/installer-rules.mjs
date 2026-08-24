/**
 * CE QUI PART VRAIMENT CHEZ UNE CLIENTE : L'INSTALLEUR, PAS LE DOSSIER CONSTRUIT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ## Le trou que ce module bouche
 *
 * Un premier garde-fou (`postPackage`, voir package-rules.mjs) vérifie le
 * dossier produit par l'empaqueteur. Il a fait son travail — et il n'a rien
 * empêché, parce que ce dossier n'est PAS ce qu'on livre.
 *
 * L'enchaînement réel d'`electron-forge publish` est :
 *
 *     package  →  postPackage  →  makers (Squirrel)  →  postMake  →  publication
 *                 ↑ on vérifiait ici          ↑ l'installeur naît ici
 *
 * Entre les deux, `electron-winstaller` recopie tout le dossier dans un paquet
 * NuGet (`.nupkg`) que Squirrel embarque dans le `Setup.exe` et redéploie à
 * l'installation. C'est CE paquet qui devient `app-1.2.37` sur la machine de la
 * cliente. Un fichier perdu à cette étape — écriture concurrente, verrou,
 * antivirus qui met `icudtl.dat` en quarantaine pendant la compression (faux
 * positif connu, et les runners GitHub ont Defender actif) — donne un
 * installeur qui s'installe proprement et une application qui ne démarre pas.
 *
 * Vérifier le dossier construit puis publier l'installeur revient donc à
 * contrôler la valise et à expédier le carton.
 *
 * ## Lire un `.nupkg` sans rien installer
 *
 * Un `.nupkg` est une archive ZIP. Node n'en décompresse pas nativement, mais
 * nous n'avons pas besoin de décompresser : le SOMMAIRE d'un ZIP (son « central
 * directory ») porte déjà le nom et la taille décompressée de chaque entrée.
 * On le lit à la main — quelques dizaines d'octets d'en-têtes — plutôt que
 * d'ajouter une dépendance à la chaîne de publication, qui est exactement
 * l'endroit où l'on veut le moins de pièces mobiles.
 */

import fs from 'node:fs';
import path from 'node:path';

const EOCD = 0x06054b50; // fin du sommaire
const EOCD64_LOCATOR = 0x07064b50;
const ENTREE = 0x02014b50; // une entrée du sommaire

/**
 * Rend `[{ nom, taille }]` pour toutes les entrées de l'archive.
 *
 * `taille` est la taille DÉCOMPRESSÉE, la seule qui se compare à un fichier sur
 * disque. Une entrée présente mais vide est un fichier perdu tout autant qu'une
 * entrée absente — d'où la taille et pas seulement le nom.
 */
export function listerZip(fichier) {
  const buf = fs.readFileSync(fichier);

  // Le sommaire se trouve à la fin, précédé d'un commentaire de longueur
  // variable : on remonte jusqu'à la signature.
  let eocd = -1;
  const debutRecherche = Math.max(0, buf.length - 66_000);
  for (let i = buf.length - 22; i >= debutRecherche; i -= 1) {
    if (buf.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error('archive illisible : fin de sommaire introuvable');

  let nombre = buf.readUInt16LE(eocd + 10);
  let debut = buf.readUInt32LE(eocd + 16);

  // ZIP64 : au-delà de 65 535 entrées ou 4 Gio, les vraies valeurs sont
  // ailleurs. Un paquet Electron dépasse rarement, mais un contrôle de sécurité
  // qui se trompe silencieusement sur un gros paquet ne vaut rien.
  if (nombre === 0xffff || debut === 0xffffffff) {
    for (let i = eocd - 20; i >= 0; i -= 1) {
      if (buf.readUInt32LE(i) === EOCD64_LOCATOR) {
        const eocd64 = Number(buf.readBigUInt64LE(i + 8));
        nombre = Number(buf.readBigUInt64LE(eocd64 + 32));
        debut = Number(buf.readBigUInt64LE(eocd64 + 48));
        break;
      }
    }
  }

  const entrees = [];
  let p = debut;
  for (let n = 0; n < nombre && p + 46 <= buf.length; n += 1) {
    if (buf.readUInt32LE(p) !== ENTREE) break;
    const tailleDecompressee = buf.readUInt32LE(p + 24);
    const lgNom = buf.readUInt16LE(p + 28);
    const lgExtra = buf.readUInt16LE(p + 30);
    const lgComment = buf.readUInt16LE(p + 32);
    const nom = buf.toString('utf8', p + 46, p + 46 + lgNom);
    entrees.push({ nom, taille: tailleDecompressee });
    p += 46 + lgNom + lgExtra + lgComment;
  }
  return entrees;
}

/**
 * Les fichiers sans lesquels l'application installée ne démarre pas.
 *
 * `icudtl.dat` est en tête parce que c'est celui qui a réellement cassé trois
 * livraisons de suite ; les autres tuent le démarrage tout aussi sûrement.
 */
const CRITIQUES_WIN = [
  'icudtl.dat',
  'v8_context_snapshot.bin',
  'resources.pak',
  'chrome_100_percent.pak',
  'chrome_200_percent.pak',
  'ffmpeg.dll',
  'libEGL.dll',
  'libGLESv2.dll',
  'd3dcompiler_47.dll',
  'vk_swiftshader.dll',
  'resources/app.asar',
];

const TAILLE_MINIMALE = { 'icudtl.dat': 1_000_000, 'resources.pak': 100_000 };

/**
 * Audite l'installeur Squirrel : le `.nupkg` contient-il de quoi démarrer ?
 *
 * `dossierPaquet`, quand il est fourni, sert de référence de TAILLE : le même
 * fichier doit peser pareil dans l'archive et sur le disque. C'est ce qui
 * distingue « le fichier est là » de « le fichier est entier ».
 */
export function auditInstaller(nupkg, dossierPaquet = null) {
  const problemes = [];
  let entrees;
  try {
    entrees = listerZip(nupkg);
  } catch (err) {
    return { problemes: [`${path.basename(nupkg)} — ${err.message}`], entrees: 0 };
  }

  if (entrees.length === 0) return { problemes: [`${path.basename(nupkg)} — archive vide`], entrees: 0 };

  /*
    Squirrel range l'application sous `lib/net45/`. On compare sur la fin du
    chemin plutôt que sur le préfixe exact : celui-ci a changé au fil des
    versions d'electron-winstaller, et un contrôle qui se tait parce qu'un
    préfixe a bougé est un contrôle qui ne protège plus.
  */
  const trouver = (relatif) => {
    const cible = relatif.replace(/\\/g, '/').toLowerCase();
    return entrees.find((e) => e.nom.replace(/\\/g, '/').toLowerCase().endsWith(`/${cible}`));
  };

  for (const critique of CRITIQUES_WIN) {
    const entree = trouver(critique);
    if (!entree) {
      problemes.push(`${critique} — ABSENT de l'installeur (l'application ne démarrera pas)`);
      continue;
    }
    const minimum = TAILLE_MINIMALE[critique];
    if (minimum && entree.taille < minimum) {
      problemes.push(`${critique} — ${entree.taille} octets dans l'installeur, sous le minimum de ${minimum}`);
      continue;
    }
    if (dossierPaquet) {
      const surDisque = path.join(dossierPaquet, critique);
      if (fs.existsSync(surDisque)) {
        const attendu = fs.statSync(surDisque).size;
        if (entree.taille !== attendu) {
          problemes.push(
            `${critique} — ${entree.taille} octets dans l'installeur au lieu de ${attendu} dans le paquet construit`,
          );
        }
      }
    }
  }

  return { problemes, entrees: entrees.length };
}

export const REMEDE_INSTALLEUR =
  'L’installeur est incomplet alors que le dossier construit, lui, était sain : la perte\n' +
  'a eu lieu pendant la fabrication du .nupkg. Sur un runner GitHub comme en local, la\n' +
  'cause la plus fréquente est un antivirus qui met un fichier en quarantaine pendant la\n' +
  'compression (`icudtl.dat` en est une cible connue). Relancez la construction ; si le\n' +
  'problème persiste, désactivez la protection en temps réel sur le dossier de build.';
