/**
 * PANNES VOLONTAIRES — on casse exprès, on vérifie qu'aucune donnée n'est
 * perdue et que le refus est propre (pas un plantage silencieux).
 *
 * Ces scénarios démarrent/arrêtent/tuent LEUR propre serveur, donc ils
 * reçoivent le constructeur `demarrer(opts)` plutôt qu'un serveur déjà debout.
 */
import { client, connexion, pause, stats } from '../lib/harness.mjs';
import { SIM_MDP } from '../lib/seed.mjs';

/** API coupée : les appels échouent-ils proprement, et l'état survit-il au retour ? */
export async function apiCoupee({ demarrer, chemin, users }) {
  const srv = await demarrer({ chemin });
  const u = users[0];
  const cx = await connexion(srv.base, u.email, SIM_MDP);
  const c = client(srv.base, cx.token);
  await c.put('/v1/collections/notes/panne-1', { data: { texte: 'écrit avant la coupure' } });
  await srv.arreter();
  // Pendant la coupure : les appels doivent échouer réseau, jamais rendre un faux succès.
  const pendant = await c.get('/v1/collections/notes');
  const echoueProprement = pendant.statut === 0;
  // Retour : l'écriture d'avant est-elle toujours là ?
  const srv2 = await demarrer({ chemin });
  const c2 = client(srv2.base, cx.token);
  const apres = await c2.get('/v1/collections/notes');
  await srv2.arreter();
  const retrouve = apres.json?.records?.some((r) => r.id === 'panne-1' && r.data?.texte === 'écrit avant la coupure');
  return {
    nom: 'API coupée puis redémarrée',
    resultat: echoueProprement && retrouve ? 'tient' : 'casse',
    preuve: `pendant la coupure : ${echoueProprement ? 'échec réseau propre' : `RÉPONSE INATTENDUE (${pendant.statut})`} ; après redémarrage : note ${retrouve ? 'retrouvée' : 'PERDUE'}`,
    mesures: {},
  };
}

/** Latence réseau : on empile des écritures avec une petite latence injectée côté client. */
export async function latence({ demarrer, chemin, users }) {
  const srv = await demarrer({ chemin });
  const u = users[0];
  const cx = await connexion(srv.base, u.email, SIM_MDP);
  const c = client(srv.base, cx.token);
  const durees = [];
  for (let i = 0; i < 20; i += 1) {
    await pause(30); // latence injectée entre deux appels (réseau lent côté poste)
    const w = await c.put(`/v1/collections/notes/lat-${i}`, { data: { i } });
    durees.push(w.ms);
  }
  const lus = (await c.get('/v1/collections/notes')).json?.records?.filter((r) => r.id.startsWith('lat-')).length;
  await srv.arreter();
  return {
    nom: 'Latence réseau (20 écritures espacées)',
    resultat: lus === 20 ? 'tient' : 'partiel',
    preuve: `${lus}/20 écritures persistées malgré la latence`,
    mesures: { ecriture: stats(durees) },
  };
}

/**
 * Base lente : un gros corps JSON (image en data-URL) à la limite autorisée.
 * On vérifie que la borne (12 Mo) refuse proprement au lieu de planter.
 */
export async function baseLente({ demarrer, chemin, users }) {
  const srv = await demarrer({ chemin });
  const u = users[0];
  const cx = await connexion(srv.base, u.email, SIM_MDP);
  const c = client(srv.base, cx.token);
  // ~2 Mo, accepté ; puis ~15 Mo, au-delà de la borne de 12 Mo.
  const petit = 'x'.repeat(2 * 1024 * 1024);
  const gros = 'x'.repeat(15 * 1024 * 1024);
  const wPetit = await c.put('/v1/collections/media/gros-1', { data: { blob: petit } });
  const wGros = await c.put('/v1/collections/media/gros-2', { data: { blob: gros } });
  await srv.arreter();
  const petitOk = wPetit.ok;
  const grosRefuse = wGros.statut === 413 || (wGros.statut >= 400 && wGros.statut < 500);
  return {
    nom: 'Corps volumineux (2 Mo accepté, 15 Mo au-delà de la borne 12 Mo)',
    resultat: petitOk && grosRefuse ? 'tient' : 'casse',
    preuve: `2 Mo → ${wPetit.statut} ; 15 Mo → ${wGros.statut} (${grosRefuse ? 'refusé proprement' : 'NON borné'})`,
    mesures: { ecriture2Mo: stats([wPetit.ms]) },
  };
}

/**
 * Redémarrage pendant une écriture : on tue le serveur BRUTALEMENT (SIGKILL)
 * juste après avoir lancé une écriture, puis on redémarre et on vérifie
 * l'intégrité — une écriture est soit entièrement là, soit pas du tout, jamais
 * à moitié (garantie des transactions SQLite + WAL).
 */
export async function redemarragePendantEcriture({ demarrer, chemin, users }) {
  const srv = await demarrer({ chemin });
  const u = users[0];
  const cx = await connexion(srv.base, u.email, SIM_MDP);
  const c = client(srv.base, cx.token);
  // Une écriture "repère" confirmée avant le crash.
  await c.put('/v1/collections/notes/avant-crash', { data: { texte: 'confirmée avant le crash' } });
  // Lance une écriture sans attendre sa réponse, puis tue le process aussitôt.
  const enVol = c.put('/v1/collections/notes/pendant-crash', { data: { texte: 'en vol au moment du crash' } });
  srv.tuerBrutal();
  const resultatEnVol = await enVol.catch(() => ({ statut: 0 }));
  await pause(300);
  const srv2 = await demarrer({ chemin });
  const c2 = client(srv2.base, cx.token);
  const records = (await c2.get('/v1/collections/notes')).json?.records ?? [];
  await srv2.arreter();
  const avant = records.find((r) => r.id === 'avant-crash');
  const pendant = records.find((r) => r.id === 'pendant-crash');
  const baseLisible = Boolean(avant && avant.data?.texte === 'confirmée avant le crash');
  const pasDeDemiEcriture = !pendant || pendant.data?.texte === 'en vol au moment du crash';
  return {
    nom: 'Redémarrage brutal (SIGKILL) pendant une écriture',
    resultat: baseLisible && pasDeDemiEcriture ? 'tient' : 'casse',
    preuve: `base relisible après SIGKILL : ${baseLisible ? 'oui' : 'NON'} ; écriture en vol : ${pendant ? 'persistée entière' : 'absente'} (statut HTTP ${resultatEnVol.statut}) — ${pasDeDemiEcriture ? 'aucune demi-écriture' : 'DONNÉE CORROMPUE'}`,
    mesures: {},
  };
}

export const scenariosPannes = [apiCoupee, latence, baseLente, redemarragePendantEcriture];
