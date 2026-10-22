/**
 * ÉCRASEMENT CONCURRENT, EN PROFONDEUR.
 *
 * Le premier passage (usage.mjs) a montré le dernier-gagne sur deux comptes.
 * Ici on chiffre l'ampleur, et on cherche les cas voisins : une fiche
 * supprimée qui ressuscite, un curseur de synchro qui saute des fiches, un lot
 * d'événements rejoué deux fois.
 */
import { client, connexion, pause, stats } from '../lib/harness.mjs';
import { SIM_MDP } from '../lib/seed.mjs';

async function ouvrirSessions(srv, users, orgId, combien) {
  const membres = users.filter((u) => u.orgId === orgId).slice(0, combien);
  const sessions = [];
  for (const u of membres) {
    const cx = await connexion(srv.base, u.email, SIM_MDP);
    if (cx.token) sessions.push({ ...u, c: client(srv.base, cx.token) });
  }
  return sessions;
}

const lire = async (c, collection, id) => (await c.get(`/v1/collections/${collection}`)).json?.records?.find((r) => r.id === id);

/**
 * Huit personnes modifient chacune SON champ de la même fiche, quinze tours de
 * suite, en lecture-puis-écriture de la fiche entière (comme le poste).
 * Mesure : combien de champs portent encore la dernière valeur de leur auteur.
 */
export async function ecrasementMultiChamps({ srv, users }) {
  const orgId = users[0].orgId;
  const S = await ouvrirSessions(srv, users, orgId, 8);
  const id = 'multi-champs';
  const depart = Object.fromEntries(S.map((_, i) => [`f${i}`, 0]));
  await S[0].c.put(`/v1/collections/projects/${id}`, { data: depart });
  const TOURS = 15;
  for (let tour = 1; tour <= TOURS; tour += 1) {
    await Promise.all(S.map(async (s, i) => {
      const fiche = await lire(s.c, 'projects', id); // chaque poste lit l'état courant…
      await s.c.put(`/v1/collections/projects/${id}`, { data: { ...fiche.data, [`f${i}`]: tour } }); // …puis réécrit la fiche entière.
    }));
  }
  const final = (await lire(S[0].c, 'projects', id)).data;
  const perdus = S.filter((_, i) => final[`f${i}`] !== TOURS).length;
  const modifs = S.length * TOURS;
  return {
    nom: `Écrasement multi-champs (${S.length} personnes × ${TOURS} tours, un champ chacune)`,
    resultat: perdus === 0 ? 'tient' : 'casse',
    preuve: `${perdus}/${S.length} champs ont perdu la dernière modification de leur auteur (état final ${JSON.stringify(final)})`,
    mesures: { champsPerdus: perdus, champsTotal: S.length, modificationsEmises: modifs },
  };
}

/**
 * Une fiche supprimée par A est réécrite par B (poste resté hors ligne) :
 * elle ressuscite, sans que A en soit informé. L'inverse (supprimer après une
 * modification) est un choix, pas un défaut.
 */
export async function resurrectionApresSuppression({ srv, users }) {
  const orgId = users[0].orgId;
  const [A, B] = await ouvrirSessions(srv, users, orgId, 2);
  const id = 'a-supprimer';
  await A.c.put(`/v1/collections/clients/${id}`, { data: { name: 'Client à supprimer', note: 'v1' } });
  const lueParB = await lire(B.c, 'clients', id); // B charge la fiche puis perd le réseau
  await A.c.del(`/v1/collections/clients/${id}`);
  const apresSuppression = await lire(A.c, 'clients', id);
  await B.c.put(`/v1/collections/clients/${id}`, { data: { ...lueParB.data, note: 'v2 écrite hors ligne' } }); // sa file rejoue
  const final = await lire(A.c, 'clients', id);
  const ressuscite = apresSuppression?.deleted === true && final?.deleted === false;
  return {
    nom: 'Suppression puis réécriture périmée (fiche qui ressuscite)',
    resultat: ressuscite ? 'casse' : 'tient',
    preuve: ressuscite
      ? 'la fiche supprimée par A redevient vivante après le rejeu de B (deleted: true → false), sans signal à A'
      : 'la suppression tient',
    mesures: {},
  };
}

/**
 * Le curseur `since` est un `>` strict sur un horodatage à la milliseconde.
 * Six auteurs écrivent en rafale pendant qu'un lecteur avance son curseur sur
 * le plus grand `updatedAt` vu : une fiche écrite dans la même milliseconde
 * que le curseur, après la lecture, n'est jamais revue.
 *
 * Latent : le poste actuel relit les collections en entier (remoteApi.ts) et
 * n'emploie pas `since` pour elles.
 */
export async function curseurSinceSauteDesFiches({ srv, users }) {
  const orgId = users[0].orgId;
  const S = await ouvrirSessions(srv, users, orgId, 6);
  const lecteur = S[0].c;
  const vus = new Set();
  let curseur = null;
  let fini = false;
  const sonder = async () => {
    const r = await lecteur.get(`/v1/collections/notes${curseur ? `?since=${encodeURIComponent(curseur)}` : ''}`);
    for (const rec of r.json?.records ?? []) {
      vus.add(rec.id);
      if (!curseur || rec.updatedAt > curseur) curseur = rec.updatedAt;
    }
  };
  const lecteurBoucle = (async () => { while (!fini) { await sonder(); await pause(5); } })();
  const PAR_AUTEUR = 150;
  await Promise.all(S.map(async (s, i) => {
    for (let k = 0; k < PAR_AUTEUR; k += 1) await s.c.put(`/v1/collections/notes/curseur-${i}-${k}`, { data: { i, k } });
  }));
  fini = true;
  await lecteurBoucle;
  await sonder(); // une dernière relecture à curseur
  const reel = (await lecteur.get('/v1/collections/notes')).json?.records?.filter((r) => r.id.startsWith('curseur-')).length ?? 0;
  const vusCurseur = [...vus].filter((id) => id.startsWith('curseur-')).length;
  const manquantes = reel - vusCurseur;
  return {
    nom: `Curseur de synchro \`since\` (${S.length} auteurs × ${PAR_AUTEUR} fiches en rafale)`,
    resultat: manquantes === 0 ? 'tient' : 'casse',
    preuve: `${vusCurseur}/${reel} fiches vues par un lecteur à curseur (${manquantes} jamais revues) — latent : le poste relit tout et n'emploie pas \`since\``,
    mesures: { fichesManquantes: manquantes, fichesEcrites: reel },
  };
}

/**
 * Un poste dont le lot d'événements n'a pas reçu d'accusé le renvoie : sans clé
 * d'idempotence, chaque événement est stocké deux fois (et la détection les
 * compte deux fois).
 */
export async function lotEvenementsRejoue({ srv, sites, users }) {
  const s = sites[0];
  const cle = `sim-cle-${s.orgId}`;
  const c = client(srv.base, null);
  const etiquette = `lot-rejoue-${s.id}`;
  const lot = { events: Array.from({ length: 20 }, (_, i) => ({ type: 'request', severity: 'info', message: `${etiquette}:${i}`, payload: { path: `/page/${i}`, status: 200 } })) };
  const h = { headers: { 'X-API-Key': cle } };
  const r1 = await c.post('/v1/events', lot, h);
  const r2 = await c.post('/v1/events', lot, h); // « pas d'accusé reçu » → le poste renvoie
  const [membre] = await ouvrirSessions(srv, users, s.orgId, 1); // le site est celui d'une cliente : on le lit avec l'un de ses comptes
  const hist = (await membre.c.get(`/v1/sites/${s.id}/events?limit=500`)).json?.events ?? [];
  const stockes = hist.filter((e) => (e.message ?? '').startsWith(etiquette)).length;
  return {
    nom: 'Lot d’événements renvoyé après un accusé perdu (idempotence)',
    resultat: stockes === 20 ? 'tient' : 'casse',
    preuve: `20 événements émis, renvoyés une fois : ${stockes} stockés (statuts ${r1.statut}/${r2.statut})`,
    mesures: { stockes, attendus: 20 },
  };
}

export const scenariosConcurrence = [ecrasementMultiChamps, resurrectionApresSuppression, curseurSinceSauteDesFiches, lotEvenementsRejoue];
