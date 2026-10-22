/**
 * CONTRAT POSTE ↔ API — chaque chemin `/v1/...` que le poste appelle existe-t-il
 * côté amn-api ?
 *
 * Analyse statique, sans rien exécuter : on lit les sources du poste (lecture
 * seule), on en tire les chemins littéraux, et on les compare à l'inventaire
 * des routes de l'application montée. Un chemin sans route est un écran qui
 * échoue en silence chez la cliente (404 avalé par un `catch`).
 *
 * Limite : les chemins composés par concaténation dynamique complexe échappent
 * à l'analyse ; on ne prétend donc pas à l'exhaustivité, seulement à ne rien
 * inventer : chaque écart rendu ici est vérifiable à la ligne citée.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ouvrirBaseNeuve } from '../lib/harness.mjs';
import { inventaireRoutes } from '../lib/routes.mjs';

const RACINE = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

function fichiers(dir, sortie = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['node_modules', '__tests__'].includes(e.name)) fichiers(p, sortie); }
    else if (/\.(ts|tsx)$/.test(e.name) && !/assistant\/mockData/.test(p)) sortie.push(p);
  }
  return sortie;
}

export async function contratPosteApi() {
  const { db } = await ouvrirBaseNeuve('contrat.db');
  const routes = await inventaireRoutes(db);
  await db.close();
  const motif = routes.map((r) => ({ r, re: new RegExp(`^${r.chemin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:[A-Za-z]+/g, '[^/]+')}$`), statique: r.chemin }));
  const statiques = new Set(routes.map((r) => r.chemin));

  const trouves = new Map(); // chemin normalisé → premier endroit
  const extraire = (ligne) => {
    const sorties = [];
    for (const m of ligne.matchAll(/[`'"](\/v1\/[A-Za-z0-9_\-/.:]*)/g)) {
      let chemin = m[1];
      let reste = ligne.slice(m.index + 1 + m[1].length);
      // Un `${...}` collé à un « / » est un segment variable ; collé à un mot, c'est un suffixe (chaîne de requête) : on s'arrête.
      while (reste.startsWith('${') && chemin.endsWith('/')) {
        const fin = reste.indexOf('}');
        if (fin < 0) break;
        chemin += ':p';
        reste = reste.slice(fin + 1);
        const suite = reste.match(/^[A-Za-z0-9_\-/.]*/)[0];
        chemin += suite;
        reste = reste.slice(suite.length);
      }
      if (chemin.endsWith('/') && chemin !== '/v1/') chemin = chemin.slice(0, -1);
      // Un préfixe de montage complété dynamiquement (`/v1/garde${chemin}`) n'est pas un appel de route.
      if (reste.startsWith('${') && routes.some((r) => r.chemin.startsWith(`${chemin}/`)) && !routes.some((r) => r.chemin === chemin)) continue;
      sorties.push(chemin);
    }
    return sorties;
  };
  for (const f of fichiers(path.join(RACINE, 'src'))) {
    if (/src\/main\/whisper\.ts$/.test(f)) continue; // serveur de transcription local, compatible OpenAI : ce n'est pas amn-api
    let dansBloc = false;
    fs.readFileSync(f, 'utf8').split('\n').forEach((ligne, i) => {
      // Commentaires : lignes `//`, et blocs `/* … */` suivis ligne à ligne (le texte d'un bloc cite souvent des chemins).
      if (dansBloc) { if (ligne.includes('*/')) dansBloc = false; return; }
      if (/^\s*\/\*/.test(ligne)) { dansBloc = !ligne.includes('*/'); return; }
      if (/^\s*(\*|\/\/)/.test(ligne)) return;
      for (const p of extraire(ligne)) if (!trouves.has(p)) trouves.set(p, `${path.relative(RACINE, f)}:${i + 1}`);
    });
  }

  const sansRoute = [];
  for (const [p, ou] of trouves) {
    const candidat = p.replace(/:p/g, 'x');
    const ok = motif.some(({ re }) => re.test(candidat));
    // Un segment statique commençant par « _ » (ex. _activity) ne doit pas être avalé par un paramètre (:collection).
    const segmentsReserves = p.split('/').filter((s) => s.startsWith('_'));
    const avale = segmentsReserves.length > 0 && !statiques.has(p) && !routes.some((r) => r.chemin === p);
    if (!ok || avale) sansRoute.push(`${p}  (${ou})`);
  }
  return {
    nom: `Contrat poste ↔ API (${trouves.size} chemins /v1 relevés dans le poste)`,
    resultat: sansRoute.length === 0 ? 'tient' : 'casse',
    preuve: sansRoute.length === 0 ? 'tous les chemins appelés par le poste ont une route côté amn-api' : `${sansRoute.length} chemin(s) appelé(s) par le poste sans route côté amn-api : ${sansRoute.join(' ; ')}`,
    mesures: { cheminsAppeles: trouves.size, cheminsSansRoute: sansRoute.length },
  };
}

export const scenariosContrat = [contratPosteApi];
