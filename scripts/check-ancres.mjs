/**
 * ANCRES SOUS HASHROUTER — une ancre « #section » est une route.
 *
 * L'application route par le hash (`#/membres`). Un lien `href="#membres-gestion"`
 * ne fait donc pas défiler la page : il navigue vers la route
 * « membres-gestion », inconnue, que le `path="*"` renvoie à l'Accueil. C'est
 * le bouton « Inviter » de l'écran Membres qui menait à l'Accueil.
 *
 * Règle : dans src/, un `href="#…"` commence par `#/`. Pour défiler jusqu'à
 * une section, un bouton et `scrollIntoView`.
 *
 *   npm run check:ancres
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const fautes = [];
let lus = 0;
const parcourir = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) parcourir(p);
    else if (/\.(tsx|ts)$/.test(e.name)) {
      lus++;
      fs.readFileSync(p, 'utf8').split('\n').forEach((ligne, i) => {
        for (const m of ligne.matchAll(/href=\{?["'`]#([^"'`]*)["'`]/g)) {
          if (!m[1].startsWith('/')) fautes.push(`${path.relative(path.dirname(src), p)}:${i + 1}  href="#${m[1]}"`);
        }
      });
    }
  }
};
parcourir(src);
if (fautes.length) {
  console.error(`ÉCHEC — ${fautes.length} ancre(s) qui changeraient la route (et renverraient à l'Accueil) :`);
  for (const f of fautes) console.error('  ' + f);
  console.error('Utiliser un bouton + scrollIntoView, ou un lien « #/route ».');
  process.exit(1);
}
console.log(`OK — ${lus} fichier(s) relus, aucune ancre « #section » sous HashRouter.`);
