#!/usr/bin/env node
/**
 * Enregistre un installeur Business construit LOCALEMENT auprès d'amn-api.
 *
 * C'est le seul geste manuel de la chaîne de livraison, et il est manuel pour
 * une raison qu'aucun code ne lèvera : l'installeur Windows est produit par
 * Squirrel, qui exige une machine Windows. amn-api tourne sous Linux — elle ne
 * peut pas fabriquer le `.exe`, elle peut seulement en tenir le registre et en
 * distribuer l'accès.
 *
 * La chaîne complète, du début à la fin :
 *
 *   1. sur une machine Windows :  npm run make:business
 *   2. sur la même machine :      npm run publish:release
 *   3. dans l'Atelier :           créer la cliente → deux liens sortent,
 *                                 l'activation du compte ET le téléchargement.
 *
 * IL N'Y A PAS D'INSTALLEUR PAR CLIENTE, et il ne peut pas y en avoir : l'app
 * Business est la même pour toutes, elle apprend son organisation à la
 * connexion. Ce qui change d'une cliente à l'autre est son COMPTE, déjà créé
 * par l'Atelier. On publie donc UNE version, et on en émet autant de liens
 * qu'on a de clientes.
 *
 * Usage :
 *   AMN_API_URL=https://… OPERATOR_TOKEN=… node scripts/publish-release.mjs \
 *     [--file out/make/squirrel.windows/x64/AMN-Business-1.2.25-Setup.exe] \
 *     [--location https://…]   # si les octets vivent ailleurs (R2, S3…)
 *
 * Sans `--location`, l'emplacement enregistré est le chemin ABSOLU du fichier :
 * ça ne vaut que si amn-api tourne sur cette machine-là. En déploiement réel,
 * téléversez le fichier sur un stockage objet et passez son URL.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};

const apiUrl = (process.env.AMN_API_URL || '').replace(/\/$/, '');
const token = process.env.OPERATOR_TOKEN || '';

if (!apiUrl || !token) {
  console.error('AMN_API_URL et OPERATOR_TOKEN sont obligatoires.');
  process.exit(1);
}

/** Retrouve l'installeur produit par `make:business`, si on ne l'a pas nommé. */
function findInstaller() {
  const roots = [
    'out/make/squirrel.windows/x64',
    'out/make/squirrel.windows/ia32',
    'out/make',
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const found = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isFile() && /\.exe$/i.test(e.name))
      .map((e) => path.join(root, e.name));
    if (found.length > 0) return found[0];
  }
  return null;
}

const file = flag('file') ?? findInstaller();
if (!file || !fs.existsSync(file)) {
  console.error(
    'Aucun installeur trouvé. Lancez `npm run make:business` sur une machine Windows,\n' +
      'ou passez le chemin avec --file.',
  );
  process.exit(1);
}

const bytes = fs.readFileSync(file);
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
const version = JSON.parse(fs.readFileSync('package.json', 'utf-8')).version;
const location = flag('location') ?? path.resolve(file);

const res = await fetch(`${apiUrl}/v1/admin/releases`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    version,
    platform: 'win32',
    filename: path.basename(file),
    byteSize: bytes.length,
    sha256,
    location,
    notes: flag('notes') ?? '',
  }),
});

const body = await res.json().catch(() => null);
if (!res.ok) {
  console.error(`amn-api a refusé (${res.status}) :`, body?.error ?? '(pas de message)');
  process.exit(1);
}

console.log(`Version ${version} publiée.`);
console.log(`  fichier   ${path.basename(file)}  (${(bytes.length / 1024 / 1024).toFixed(1)} Mo)`);
console.log(`  empreinte ${sha256}`);
console.log(`  emplacement ${location}`);
if (!/^https?:\/\//i.test(location)) {
  console.log('');
  console.log('ATTENTION : l’emplacement est un CHEMIN LOCAL. amn-api ne pourra servir ce');
  console.log('fichier que si elle tourne sur cette machine. Pour un vrai déploiement,');
  console.log('téléversez-le sur un stockage objet et relancez avec --location <URL>.');
}
