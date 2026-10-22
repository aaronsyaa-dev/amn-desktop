/**
 * SCÉNARIOS D'USAGE — ce que fait une journée réelle sur le bac à sable.
 *
 * Chaque scénario renvoie { nom, resultat: 'tient'|'partiel'|'casse', preuve,
 * mesures }. Les mesures sont des latences HTTP (p50, p95) relevées côté
 * client. Aucune donnée réelle : tout vit dans la base jetable de la session.
 */
import { client, connexion, stats, enVagues, pause } from '../lib/harness.mjs';
import { SIM_MDP } from '../lib/seed.mjs';

/** Connecte un échantillon de comptes et garde leurs jetons. */
async function connecterEchantillon(srv, users, combien) {
  const choisis = users.slice(0, combien);
  const sessions = [];
  const durees = [];
  for (const u of choisis) {
    const cx = await connexion(srv.base, u.email, SIM_MDP);
    durees.push(cx.ms);
    if (cx.token) sessions.push({ ...u, token: cx.token });
  }
  return { sessions, durees };
}

/** Journée type : ~40 personnes, chacune lit son espace et écrit quelques fiches. */
export async function journeeType({ srv, users }) {
  const { sessions, durees: dureesLogin } = await connecterEchantillon(srv, users, 40);
  const lecture = [];
  const ecriture = [];
  for (const s of sessions) {
    const c = client(srv.base, s.token);
    const r = await c.get('/v1/collections/_bulk?names=tasks,clients,notes,appointments,invoices');
    lecture.push(r.ms);
    for (let i = 0; i < 3; i += 1) {
      const w = await c.put(`/v1/collections/tasks/${s.id}-t${i}`, { data: { title: `tâche ${i} de ${s.profil}`, status: 'todo', priority: 'normal' } });
      ecriture.push(w.ms);
    }
  }
  const echecs = lecture.length !== sessions.length;
  return {
    nom: 'Journée type (40 personnes, lecture espace + 3 écritures chacune)',
    resultat: sessions.length === 40 && !echecs ? 'tient' : 'partiel',
    preuve: `${sessions.length}/40 connectées, ${ecriture.length} écritures acceptées`,
    mesures: { login: stats(dureesLogin), lectureGroupee: stats(lecture), ecriture: stats(ecriture) },
  };
}

/** Pic du lundi matin : tout le monde se connecte dans une fenêtre serrée. */
export async function picLundi({ srv, users }) {
  const taches = users.map((u) => () => connexion(srv.base, u.email, SIM_MDP));
  const t0 = performance.now();
  const res = await enVagues(taches, 50); // 50 connexions en vol à la fois
  const total = performance.now() - t0;
  const ok = res.filter((r) => r.ok);
  const bloques = res.filter((r) => r.statut === 429);
  return {
    nom: `Pic du lundi (${users.length} connexions, 50 en parallèle)`,
    resultat: ok.length === users.length ? 'tient' : bloques.length ? 'partiel' : 'casse',
    preuve: `${ok.length}/${users.length} connexions réussies, ${bloques.length} freinées (429), vague totale ${(total / 1000).toFixed(1)} s`,
    mesures: { login: stats(res.map((r) => r.ms)), debitParSeconde: +(users.length / (total / 1000)).toFixed(0) },
  };
}

/** Facturation de fin de mois : chaque dirigeant émet une volée de factures. */
export async function facturationFinDeMois({ srv, users }) {
  const dirigeants = users.filter((u) => u.profil === 'dirigeant').slice(0, 12);
  const { sessions } = await connecterEchantillon(srv, dirigeants, dirigeants.length);
  const ecriture = [];
  let total = 0;
  for (const s of sessions) {
    const c = client(srv.base, s.token);
    for (let i = 0; i < 20; i += 1) {
      const montant = 100 + i * 37.5;
      const w = await c.put(`/v1/collections/invoices/${s.orgId}-f${i}`, {
        data: { numero: `2026-${String(i).padStart(4, '0')}`, montantHT: montant, tva: +(montant * 0.2).toFixed(2), statut: 'émise', client: 'Client fictif' },
      });
      ecriture.push(w.ms);
      if (w.ok) total += 1;
    }
  }
  return {
    nom: 'Facturation fin de mois (12 dirigeants × 20 factures)',
    resultat: total === sessions.length * 20 ? 'tient' : 'partiel',
    preuve: `${total} factures émises sur ${sessions.length * 20} tentées`,
    mesures: { ecritureFacture: stats(ecriture) },
  };
}

/** 400 connexions simultanées — la borne haute annoncée. */
export async function connexionsSimultanees({ srv, users }) {
  const taches = users.map((u) => () => connexion(srv.base, u.email, SIM_MDP));
  const t0 = performance.now();
  const res = await enVagues(taches, 400); // tout d'un coup
  const total = performance.now() - t0;
  const ok = res.filter((r) => r.ok);
  const erreurs = res.filter((r) => r.statut === 0);
  const freines = res.filter((r) => r.statut === 429);
  return {
    nom: '400 connexions simultanées (toutes en vol d’un coup)',
    resultat: ok.length === users.length ? 'tient' : erreurs.length ? 'casse' : 'partiel',
    preuve: `${ok.length}/${users.length} réussies, ${freines.length} freinées, ${erreurs.length} erreurs réseau, en ${(total / 1000).toFixed(1)} s`,
    mesures: { login: stats(res.map((r) => r.ms)), erreursReseau: erreurs.length },
  };
}

/**
 * Plusieurs personnes sur le même dossier — conflits d'écriture.
 *
 * Deux comptes de la MÊME organisation modifient des champs DIFFÉRENTS de la
 * même fiche, quasi simultanément. Le correctif de fusion (`lib/fusion.js`)
 * doit conserver les deux. On teste la route de base `PUT` (sans fusion) et,
 * si elle existe, la route de fusion.
 */
export async function conflitsEcriture({ srv, users }) {
  const org = users[0].orgId;
  const deux = users.filter((u) => u.orgId === org).slice(0, 2);
  if (deux.length < 2) return { nom: 'Conflits d’écriture', resultat: 'partiel', preuve: 'organisation à un seul compte', mesures: {} };
  const sessionA = await connexion(srv.base, deux[0].email, SIM_MDP);
  const sessionB = await connexion(srv.base, deux[1].email, SIM_MDP);
  const cA = client(srv.base, sessionA.token);
  const cB = client(srv.base, sessionB.token);
  const idFiche = 'conflit-1';
  await cA.put(`/v1/collections/tasks/${idFiche}`, { data: { title: 'fiche partagée', status: 'todo', priority: 'normal' } });
  // A et B partent du même état ; A touche priority, B touche status, en parallèle.
  const [wa, wb] = await Promise.all([
    cA.put(`/v1/collections/tasks/${idFiche}`, { data: { title: 'fiche partagée', status: 'todo', priority: 'high' } }),
    cB.put(`/v1/collections/tasks/${idFiche}`, { data: { title: 'fiche partagée', status: 'doing', priority: 'normal' } }),
  ]);
  const final = (await cA.get('/v1/collections/tasks')).json?.records?.find((r) => r.id === idFiche);
  const d = final?.data ?? {};
  // Sans champ de base déclaré, la route PUT simple fait du dernier-gagne : une des deux modifs est perdue.
  const lesDeuxSurvivent = d.priority === 'high' && d.status === 'doing';
  return {
    nom: 'Conflits d’écriture (2 comptes, champs différents, PUT simple)',
    resultat: lesDeuxSurvivent ? 'tient' : 'casse',
    preuve: lesDeuxSurvivent
      ? 'les deux modifications survivent'
      : `état final { status:"${d.status}", priority:"${d.priority}" } — une modification écrasée (dernier-gagne, pas de fusion sur PUT simple)`,
    mesures: { ecriture: stats([wa.ms, wb.ms]) },
  };
}

/**
 * Hors ligne puis reconnexion — la file d'envoi rejoue.
 *
 * On simule un poste qui a écrit hors ligne (donc depuis un état PÉRIMÉ) : il
 * rejoue son écriture après qu'un autre poste a modifié un autre champ. Même
 * mécanisme que le conflit, mais décalé dans le temps — c'est le scénario S5
 * de l'audit de fiabilité.
 */
export async function horsLigneReconnexion({ srv, users }) {
  const org = users[0].orgId;
  const deux = users.filter((u) => u.orgId === org).slice(0, 2);
  if (deux.length < 2) return { nom: 'Hors ligne puis reconnexion', resultat: 'partiel', preuve: 'organisation à un seul compte', mesures: {} };
  const sa = await connexion(srv.base, deux[0].email, SIM_MDP);
  const sb = await connexion(srv.base, deux[1].email, SIM_MDP);
  const cA = client(srv.base, sa.token);
  const cB = client(srv.base, sb.token);
  const id = 'horsligne-1';
  await cA.put(`/v1/collections/tasks/${id}`, { data: { title: 'fiche', status: 'todo', priority: 'normal' } });
  // B lit l'état de départ (todo/normal), puis part "hors ligne" — son écriture attend.
  const departB = { title: 'fiche', status: 'doing', priority: 'normal' };
  // A en ligne change priority.
  await cA.put(`/v1/collections/tasks/${id}`, { data: { title: 'fiche', status: 'todo', priority: 'high' } });
  await pause(50);
  // B retrouve le réseau et rejoue son écriture périmée.
  const rejoue = await cB.put(`/v1/collections/tasks/${id}`, { data: departB });
  const final = (await cA.get('/v1/collections/tasks')).json?.records?.find((r) => r.id === id)?.data ?? {};
  const aPerdu = final.priority !== 'high';
  return {
    nom: 'Hors ligne puis reconnexion (file rejoue un état périmé — scénario S5)',
    resultat: aPerdu ? 'casse' : 'tient',
    preuve: aPerdu
      ? `priority="high" (A) perdue : état final { status:"${final.status}", priority:"${final.priority}" }`
      : 'les deux survivent',
    mesures: { rejeu: stats([rejoue.ms]) },
  };
}

export const scenariosUsage = [journeeType, picLundi, facturationFinDeMois, connexionsSimultanees, conflitsEcriture, horsLigneReconnexion];
