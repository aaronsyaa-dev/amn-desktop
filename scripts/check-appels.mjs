#!/usr/bin/env node
/**
 * LES DEUX CHEMINS D'APPEL NE DOIVENT PAS DIVERGER.
 * ═════════════════════════════════════════════════
 *
 * Il y a deux façons d'ouvrir une voie audio dans ce produit :
 *
 *   · `state/CallContext.tsx`   — entre deux comptes de l'organisation ;
 *   · `screens/GuestCallScreen.tsx` — un visiteur invité par lien, qui est
 *     presque toujours sur un TÉLÉPHONE.
 *
 * Elles ont été écrites séparément, et elles avaient divergé sur trois points
 * — les trois qui décident si un appel aboutit ou fait attendre dans le vide :
 *
 *   1. LA LISTE ICE. Deux copies des mêmes STUN publics. Ajouter un relais
 *      TURN à l'une sans l'autre aurait donné un produit où l'appel entre
 *      collègues passe et l'appel avec un visiteur non — c'est-à-dire que le
 *      correctif aurait manqué le cas qu'il visait.
 *   2. LE DÉLAI DE CONNEXION. `CallContext` coupait après vingt secondes sans
 *      voie audio ; le visiteur, lui, n'avait rien. ICE peut rester en
 *      `checking` indéfiniment sans jamais passer par `failed` : l'écran du
 *      téléphone restait sur « Connexion… » pour toujours. C'est ce figement
 *      qu'on décrit, à raison, comme un plantage.
 *   3. LA RETOMBÉE DE LA VOIE. `disconnected` et `closed` étaient traités d'un
 *      côté, ignorés de l'autre.
 *
 * Ce contrôle refuse que l'un des trois reparte de travers. Il lit les
 * sources : ces trois propriétés sont visibles à la lecture, et un contrôle
 * qui demanderait deux téléphones sur deux réseaux ne tournerait jamais.
 *
 *   node scripts/check-appels.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8');

/** Les fichiers qui ouvrent une voie audio, et le nom qu'on leur donne. */
const CHEMINS = [
  ['src/state/CallContext.tsx', 'l’appel entre deux comptes'],
  ['src/screens/GuestCallScreen.tsx', 'l’appel d’un visiteur invité par lien'],
];

const fautes = [];

/*
  On repère les fichiers qui créent une connexion pair-à-pair PARTOUT dans
  `src`, pas seulement dans les deux connus : un troisième chemin d'appel
  écrit un jour ailleurs doit entrer dans ce contrôle sans qu'on y pense.
*/
const trouves = [];
(function parcourir(dossier) {
  for (const e of fs.readdirSync(path.join(RACINE, dossier), { withFileTypes: true })) {
    const rel = path.join(dossier, e.name);
    if (e.isDirectory()) parcourir(rel);
    else if (/\.tsx?$/.test(e.name) && lire(rel).includes('new RTCPeerConnection(')) trouves.push(rel);
  }
})('src');

const connus = new Set(CHEMINS.map(([f]) => f));
for (const f of trouves) {
  if (!connus.has(f.split(path.sep).join('/'))) {
    fautes.push(
      `${f} ouvre une connexion pair-à-pair et n'est pas déclaré dans ce contrôle. ` +
        `Ajoutez-le à CHEMINS : un troisième chemin d'appel qui échappe aux trois règles ` +
        `est exactement la divergence que ce fichier existe pour empêcher.`,
    );
  }
}

for (const [fichier, quoi] of CHEMINS) {
  let src;
  try {
    src = lire(fichier);
  } catch {
    fautes.push(`${fichier} est introuvable — le lecteur est cassé, ou ${quoi} a déménagé.`);
    continue;
  }

  /* 1 · la liste ICE vient de la source unique, jamais d'un littéral. */
  if (!src.includes('serveursIce()')) {
    fautes.push(
      `${fichier} (${quoi}) n'appelle pas \`serveursIce()\` : sa liste ICE est écrite sur ` +
        `place. Un relais TURN ajouté ailleurs ne lui profiterait pas.`,
    );
  }
  if (/iceServers:\s*\[/.test(src) || /stun:[a-z0-9.]/i.test(src)) {
    fautes.push(
      `${fichier} (${quoi}) porte une liste ICE littérale. Elle doit vivre dans ` +
        `src/lib/serveursIce.ts, une seule fois.`,
    );
  }

  /* 2 · un délai de connexion, sinon l'écran fige. */
  const aUnDelai = /CONNECT_TIMEOUT_MS|DELAI_CONNEXION_MS/.test(src);
  if (!aUnDelai) {
    fautes.push(
      `${fichier} (${quoi}) n'a pas de délai de connexion. ICE peut rester en \`checking\` ` +
        `sans jamais passer par \`failed\` : l'écran reste sur « Connexion… » indéfiniment.`,
    );
  }

  /* 3 · les trois états de fin sont traités. */
  for (const etat of ['failed', 'disconnected', 'closed']) {
    if (!src.includes(`'${etat}'`)) {
      fautes.push(
        `${fichier} (${quoi}) ne traite pas l'état \`${etat}\` de la connexion : une voie ` +
          `qui retombe y laisse l'écran sur une phase qui n'avancera plus.`,
      );
    }
  }

  /* 4 · l'échec doit se DIRE, et dire laquelle des deux situations c'est. */
  if (!src.includes('phraseEchecConnexion()')) {
    fautes.push(
      `${fichier} (${quoi}) écrit sa propre phrase d'échec de connexion. Sans relais, ` +
        `« votre réseau la bloque peut-être » accuse la personne d'un défaut qui est le ` +
        `nôtre — voir phraseEchecConnexion() dans src/lib/serveursIce.ts.`,
    );
  }
}

if (fautes.length > 0) {
  console.error('\nAppels : les deux chemins ont divergé.\n');
  for (const f of fautes) console.error(`  ✗ ${f}`);
  console.error(
    '\nUn appel qui fait attendre dans le vide est pire qu’un appel qui refuse :\n' +
      'la personne recommence, et recommence.\n',
  );
  process.exit(1);
}

const { VITE_AMN_TURN_URL } = process.env;
console.log(
  `\nAppels : les ${CHEMINS.length} chemins partagent leur liste ICE, leur délai de connexion\n` +
    `et leurs trois états de fin.`,
);
if (!VITE_AMN_TURN_URL) {
  console.log(
    '\n  note  aucun relais TURN configuré (VITE_AMN_TURN_URL). Deux pairs derrière un NAT\n' +
      '        ordinaire s’atteignent ; un téléphone en données mobiles et un poste en wifi,\n' +
      '        non — le CGNAT d’un opérateur est un NAT symétrique. Voir src/lib/serveursIce.ts.',
  );
}
