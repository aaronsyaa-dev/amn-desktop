#!/usr/bin/env node
/**
 * LA SIGNATURE DE CODE — quatre règles, parce qu'une seule ne suffit pas
 * ══════════════════════════════════════════════════════════════════════
 *
 * Le danger de la signature de code n'est pas qu'elle échoue : c'est qu'elle
 * n'ait PAS lieu sans que rien ne le dise.
 *
 * Vérifié en lisant app-builder-lib 26.15.3, pas la documentation : dans
 * `windowsSignToolManager.js`, quand `getCscLink('WIN_CSC_LINK')` (qui retombe
 * sur `CSC_LINK`) rend une chaîne vide, la fonction rend `null` — et
 * l'empaquetage se poursuit, sans signature et sans erreur. Un secret renommé
 * dans les réglages GitHub suffirait donc à publier un binaire nu sous une CI
 * verte, et personne ne le saurait avant qu'une cliente voie l'avertissement
 * SmartScreen.
 *
 * Les quatre règles :
 *
 *   1. `forceCodeSigning` est CALCULÉ depuis l'environnement, jamais figé —
 *      faux tant qu'aucun certificat n'existe (l'état d'aujourd'hui), vrai dès
 *      qu'il y en a un, ce qui fait lever `_sign` si la signature manque ;
 *   2. un serveur d'horodatage RFC 3161 est déclaré — sans lui, la signature
 *      meurt avec le certificat, y compris sur les installeurs déjà chez les
 *      clientes ;
 *   3. le workflow passe les DEUX variables lues par app-builder-lib
 *      (`CSC_LINK`, `CSC_KEY_PASSWORD`) à l'étape d'empaquetage — et pas à une
 *      autre, où elles ne serviraient à rien ;
 *   4. le workflow INTERROGE les artefacts produits
 *      (`Get-AuthenticodeSignature`) au lieu de faire confiance à la
 *      configuration, et refuse une signature non horodatée.
 *
 *   node scripts/check-signing.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/release.yml'), 'utf-8');
const configSrc = fs.readFileSync(path.join(ROOT, 'electron-builder.config.mjs'), 'utf-8');

/** La configuration telle qu'electron-builder la verra, avec ou sans certificat. */
async function configAvec(certificat) {
  const avant = process.env.CSC_LINK;
  if (certificat) process.env.CSC_LINK = 'base64-de-test';
  else delete process.env.CSC_LINK;
  const mod = await import(
    `${path.join(ROOT, 'electron-builder.config.mjs')}?cert=${certificat ? 'oui' : 'non'}`
  );
  if (avant === undefined) delete process.env.CSC_LINK;
  else process.env.CSC_LINK = avant;
  return mod.default;
}

/* ─── 1. forceCodeSigning suit le certificat, dans les deux sens ─────────── */

const sans = await configAvec(false);
const avec = await configAvec(true);

if (sans.forceCodeSigning !== false) {
  failures.push(
    "Sans certificat, `forceCodeSigning` doit valoir false : sinon plus aucune " +
      "construction n'est possible tant qu'Aaron n'a pas acheté son certificat, " +
      "y compris les constructions locales.",
  );
}
if (avec.forceCodeSigning !== true) {
  failures.push(
    "Avec un certificat fourni (CSC_LINK), `forceCodeSigning` doit valoir true. " +
      "Sans cela, app-builder-lib rend `null` sur un certificat illisible et " +
      "poursuit SANS SIGNER : la CI resterait verte et publierait un binaire nu.",
  );
}
if (!/CERTIFICAT_FOURNI/.test(configSrc)) {
  failures.push(
    "`forceCodeSigning` semble écrit en dur plutôt que calculé depuis " +
      "l'environnement. Les deux états — avec et sans certificat — doivent " +
      "rester atteignables depuis le même fichier.",
  );
}

/* ─── 2. L'horodatage est déclaré ────────────────────────────────────────── */

const st = avec.win?.signtoolOptions;
if (!st?.rfc3161TimeStampServer) {
  failures.push(
    "Aucun serveur d'horodatage RFC 3161 déclaré (`win.signtoolOptions." +
      "rfc3161TimeStampServer`). Une signature non horodatée cesse d'être valide " +
      "le jour où le certificat expire — pour TOUS les artefacts déjà distribués, " +
      "pas seulement les prochains.",
  );
} else if (!/^https?:\/\//.test(st.rfc3161TimeStampServer)) {
  failures.push(`Serveur d'horodatage invalide : « ${st.rfc3161TimeStampServer} ».`);
}
if (!st?.signingHashAlgorithms?.includes('sha256')) {
  failures.push(
    "SHA-256 n'est pas déclaré dans `signingHashAlgorithms` : Windows refuse " +
      "aujourd'hui les signatures SHA-1.",
  );
}

/* ─── 3. Le workflow passe les deux variables, à la bonne étape ──────────── */

/*
  On isole l'étape d'empaquetage plutôt que de chercher les noms n'importe où
  dans le fichier : `CSC_LINK` posée sur l'étape de lint ne signerait rien, et
  une recherche globale du nom ne verrait pas la différence.
*/
const etapes = workflow.split(/\n      - name: /);
const empaquetage = etapes.find((e) => /electron-builder --config/.test(e));
if (!empaquetage) {
  failures.push("Étape d'empaquetage introuvable dans release.yml.");
} else {
  for (const nom of ['CSC_LINK', 'CSC_KEY_PASSWORD']) {
    if (!new RegExp(`${nom}:\\s*\\$\\{\\{\\s*secrets\\.`).test(empaquetage)) {
      failures.push(
        `L'étape d'empaquetage ne reçoit pas « ${nom} » depuis les secrets. ` +
          `C'est l'un des deux noms qu'app-builder-lib lit ; sans lui, la ` +
          `construction ne signe rien et ne le dit pas.`,
      );
    }
  }
}

const etatSignature = etapes.find((e) => /^État de la signature/.test(e));
if (!etatSignature) {
  failures.push(
    "Aucune étape ne contrôle l'état des secrets AVANT l'empaquetage. Une " +
      "configuration à moitié faite (certificat sans mot de passe, ou l'inverse) " +
      "doit arrêter la publication, pas la laisser produire un binaire nu.",
  );
} else if (!/exit 1/.test(etatSignature)) {
  failures.push("L'étape d'état de la signature n'échoue jamais : elle ne garde rien.");
}

/* ─── 4. Le workflow interroge les artefacts ─────────────────────────────── */

const verif = etapes.find((e) => /Get-AuthenticodeSignature/.test(e));
if (!verif) {
  failures.push(
    "Rien ne vérifie la signature des artefacts PRODUITS " +
      "(`Get-AuthenticodeSignature`). C'est le même principe que le smoke test : " +
      "la configuration ne prouve pas le résultat.",
  );
} else {
  /*
    On exige le GARDE, pas la mention. Le premier jet cherchait
    « TimeStamperCertificate » n'importe où dans l'étape — et une mutation qui
    remplaçait la condition par `if ($false)` passait quand même, puisque le nom
    survivait dans la ligne d'affichage juste en dessous. Le motif ci-dessous
    demande la condition ET la sortie en erreur qui la suit.
  */
  if (!/if \(-not \$sig\.TimeStamperCertificate\)[\s\S]{0,300}?exit 1/.test(verif)) {
    failures.push(
      "L'horodatage n'est pas GARDÉ : la vérification doit refuser " +
        "(`exit 1`) un artefact dont `$sig.TimeStamperCertificate` est absent. " +
        "Une signature valide mais non horodatée passerait — et expirerait avec " +
        "le certificat, y compris chez les clientes déjà servies.",
    );
  }
  if (!/if \(\$sig\.Status -ne 'Valid'\)[\s\S]{0,200}?exit 1/.test(verif)) {
    failures.push(
      "Le statut de la signature n'est pas GARDÉ : un artefact non signé ou " +
        "signé de travers doit arrêter la publication.",
    );
  }
  if (!/Setup/.test(verif)) {
    failures.push(
      "La vérification ne couvre pas l'INSTALLEUR. C'est pourtant le seul " +
        "fichier qu'une cliente télécharge et sur lequel SmartScreen se prononce.",
    );
  }
}

/* ─── La documentation existe, avec ce qu'Aaron doit faire lui-même ──────── */

const docPath = path.join(ROOT, 'docs/SIGNATURE-CODE.md');
if (!fs.existsSync(docPath)) {
  failures.push("docs/SIGNATURE-CODE.md est absent : la marche à suivre n'est écrite nulle part.");
} else {
  const doc = fs.readFileSync(docPath, 'utf-8');
  for (const attendu of ['WINDOWS_CERT_PFX_BASE64', 'WINDOWS_CERT_PASSWORD']) {
    if (!doc.includes(attendu)) {
      failures.push(
        `docs/SIGNATURE-CODE.md ne nomme pas le secret « ${attendu} ». Un nom ` +
          `approximatif dans les réglages GitHub produit un build non signé en silence.`,
      );
    }
  }
}

/* ─────────────────────────────── verdict ───────────────────────────────── */

if (failures.length > 0) {
  console.error('\nSignature de code : incohérences trouvées.\n');
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}

console.log(
  '\nSignature de code : la chaîne est cohérente.\n' +
    `  sans certificat → forceCodeSigning=${sans.forceCodeSigning} (construction non signée, annoncée)\n` +
    `  avec certificat → forceCodeSigning=${avec.forceCodeSigning}, horodatage ${st.rfc3161TimeStampServer}\n` +
    '  le workflow refuse une configuration à moitié faite, et interroge les artefacts produits.',
);
