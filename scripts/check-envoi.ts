/**
 * Contrôle de la FILE D'ENVOI — ce qui n'est pas parti doit repartir.
 *
 * MESURÉ AU NAVIGATEUR avant correctif, l'API répondant 503 à toute écriture :
 * cinq soumissions sur cinq — rendez-vous, tâche, client, facture, rapport —
 * sans le moindre mot, et deux fois la fenêtre s'est FERMÉE, ce que tout le
 * monde lit comme « c'est enregistré ». Les écritures sont optimistes, donc la
 * donnée restait sur l'appareil ; rien ne la renvoyait jamais.
 *
 * Les règles vivent dans un module sans React (`src/lib/fileEnvoi.ts`) parce
 * qu'elles sont des propriétés d'EXÉCUTION : « un refus ne boucle pas », « le
 * dernier geste gagne », « la file ne grandit pas sans fin ». Aucun contrôle
 * statique ne les voit, et lire le code ne les démontre pas.
 *
 *   npm run check:envoi
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));

async function loadFromSrc<T>(entry: string): Promise<T> {
  const built = await esbuild.build({
    entryPoints: [path.join(here, '..', entry)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    target: 'node22',
    charset: 'utf8',
  });
  return (await import(
    `data:text/javascript;charset=utf-8;base64,${Buffer.from(built.outputFiles[0].text, 'utf8').toString('base64')}`
  )) as T;
}

type Geste = 'ecriture' | 'suppression';
interface Entree {
  collection: string;
  id: string;
  geste: Geste;
  donnees?: Record<string, unknown>;
  pose: string;
  essais: number;
  dernierEssai?: string;
}
interface Abandon {
  entree: Entree;
  motif: 'refus' | 'trop-d-essais' | 'file-pleine';
  detail?: string;
}
type Resultat = { file: Entree[]; abandons: Abandon[] };

const {
  poser,
  appliquer,
  pretALEnvoi,
  vautLaPeine,
  attenteAvantEssai,
  resume,
  motsAbandon,
  motsPurge,
  FILE_MAX,
  ESSAIS_MAX,
  ATTENTE_MAX_MS,
} = await loadFromSrc<{
  poser: (file: readonly Entree[], e: Entree) => Resultat;
  appliquer: (
    file: readonly Entree[],
    e: Entree,
    v: { parti: boolean; statut?: number; detail?: string },
    maintenant?: string,
  ) => Resultat;
  pretALEnvoi: (e: Entree, maintenant: number) => boolean;
  vautLaPeine: (statut?: number) => boolean;
  attenteAvantEssai: (essais: number) => number;
  resume: (file: readonly Entree[]) => string | null;
  motsAbandon: (a: Abandon) => string;
  motsPurge: (perdues: number) => string | null;
  FILE_MAX: number;
  ESSAIS_MAX: number;
  ATTENTE_MAX_MS: number;
}>('src/lib/fileEnvoi.ts');

let vus = 0;
const dit = (nom: string, fn: () => void) => {
  fn();
  vus += 1;
  console.log(`  ✓ ${nom}`);
};

let horloge = 0;
const ecriture = (collection: string, id: string, donnees: Record<string, unknown> = {}): Entree => {
  horloge += 1;
  return { collection, id, geste: 'ecriture', donnees, pose: `t${horloge}`, essais: 0 };
};
const suppression = (collection: string, id: string): Entree => {
  horloge += 1;
  return { collection, id, geste: 'suppression', pose: `t${horloge}`, essais: 0 };
};

console.log('\nContrôle de la file d’envoi\n');

/* ─── Règle 1 : une seule entrée par enregistrement ────────────────────────── */

dit('deux gestes sur des enregistrements différents s’empilent', () => {
  let r: Resultat = { file: [], abandons: [] };
  r = poser(r.file, ecriture('invoices', 'a'));
  r = poser(r.file, ecriture('invoices', 'b'));
  assert.equal(r.file.length, 2);
  assert.deepEqual(r.file.map((e) => e.id), ['a', 'b']);
});

dit('LA RÈGLE : trois modifications du même enregistrement n’en envoient qu’une', () => {
  let r: Resultat = { file: [], abandons: [] };
  r = poser(r.file, ecriture('invoices', 'a', { montant: 1 }));
  r = poser(r.file, ecriture('invoices', 'a', { montant: 2 }));
  r = poser(r.file, ecriture('invoices', 'a', { montant: 3 }));
  assert.equal(r.file.length, 1, 'trois PUT rejoueraient deux états périmés');
  assert.deepEqual(r.file[0].donnees, { montant: 3 }, 'et c’est la DERNIÈRE valeur qui part');
});

dit('le remplacement garde la POSITION d’origine, pas la fin de file', () => {
  /*
    L'ordre de création porte du sens : un devis créé après son client doit
    partir après lui. Repousser l'entrée modifiée en fin de file inverserait
    les deux, et le serveur recevrait le devis avant le client qu'il cite.
  */
  let r: Resultat = { file: [], abandons: [] };
  r = poser(r.file, ecriture('clients', 'c1'));
  r = poser(r.file, ecriture('quotes', 'd1'));
  r = poser(r.file, ecriture('clients', 'c1', { nom: 'corrigé' }));
  assert.deepEqual(r.file.map((e) => e.id), ['c1', 'd1'], 'le client reste devant son devis');
});

dit('une nouvelle valeur remet le compteur d’essais à zéro', () => {
  // Ce qu'on envoie n'est plus la même chose : les échecs de l'ancienne valeur
  // ne condamnent pas la nouvelle.
  const r = poser([{ ...ecriture('tasks', 'x'), essais: 7 }], ecriture('tasks', 'x', { titre: 'neuf' }));
  assert.equal(r.file[0].essais, 0);
});

/* ─── Règle 2 : le dernier geste gagne, même en changeant de nature ────────── */

dit('LA RÈGLE : créer puis supprimer ne laisse QUE la suppression', () => {
  let r: Resultat = { file: [], abandons: [] };
  r = poser(r.file, ecriture('tasks', 'x'));
  r = poser(r.file, suppression('tasks', 'x'));
  assert.equal(r.file.length, 1, 'rejouer les deux ferait dépendre le résultat de l’ordre d’arrivée');
  assert.equal(r.file[0].geste, 'suppression');
});

dit('et supprimer puis recréer ne laisse que la création', () => {
  let r: Resultat = { file: [], abandons: [] };
  r = poser(r.file, suppression('tasks', 'x'));
  r = poser(r.file, ecriture('tasks', 'x', { titre: 'de retour' }));
  assert.equal(r.file.length, 1);
  assert.equal(r.file[0].geste, 'ecriture');
  assert.deepEqual(r.file[0].donnees, { titre: 'de retour' });
});

/* ─── Règle 3 : tout ne se réessaie pas ────────────────────────────────────── */

dit('LA RÈGLE : une requête sans réponse se réessaie', () => {
  // Réseau coupé, serveur éteint : la demande n'a jamais été lue.
  assert.equal(vautLaPeine(undefined), true);
});

dit('un serveur qui dit « plus tard » se réessaie', () => {
  for (const s of [408, 425, 429, 500, 502, 503, 504, 507, 509]) {
    assert.equal(vautLaPeine(s), true, `${s} annonce une indisponibilité passagère`);
  }
});

dit('LA RÈGLE : un REFUS ne se réessaie jamais', () => {
  /*
    Le serveur a lu la demande et l'a rejetée. La rejouer martèle l'API sans
    jamais aboutir — et masque le seul cas où la donnée est vraiment perdue.
    401 compris : c'est la reconnexion qui règle une session expirée, pas la
    file, qui bouclerait sur un jeton mort.
  */
  for (const s of [400, 401, 403, 404, 409, 410, 413, 422]) {
    assert.equal(vautLaPeine(s), false, `${s} est une décision, pas une panne`);
  }
});

dit('un envoi accepté sort de la file, sans bruit', () => {
  const e = ecriture('tasks', 'x');
  const r = appliquer(poser([], e).file, e, { parti: true });
  assert.equal(r.file.length, 0);
  assert.equal(r.abandons.length, 0);
});

dit('UN REFUS SORT DE LA FILE ET SE SIGNALE', () => {
  const e = ecriture('invoices', 'f1');
  const r = appliquer(poser([], e).file, e, { parti: false, statut: 422, detail: 'montant invalide' });
  assert.equal(r.file.length, 0, 'sinon elle boucle indéfiniment');
  assert.equal(r.abandons.length, 1, 'et sans le dire, la donnée est perdue en silence');
  assert.equal(r.abandons[0].motif, 'refus');
  assert.match(motsAbandon(r.abandons[0]), /montant invalide/);
  assert.match(motsAbandon(r.abandons[0]), /nulle part ailleurs/);
});

dit('un « plus tard » LAISSE l’entrée en place et compte l’essai', () => {
  const e = ecriture('invoices', 'f1');
  const r = appliquer(poser([], e).file, e, { parti: false, statut: 503 });
  assert.equal(r.file.length, 1, 'c’est tout l’intérêt de la file');
  assert.equal(r.file[0].essais, 1);
  assert.equal(r.abandons.length, 0);
});

dit('après ESSAIS_MAX échecs, elle sort et se signale', () => {
  let file = poser([], ecriture('invoices', 'f1')).file;
  for (let i = 0; i < ESSAIS_MAX; i += 1) {
    const r = appliquer(file, file[0], { parti: false, statut: 503 });
    file = r.file;
    if (i < ESSAIS_MAX - 1) {
      assert.equal(file.length, 1, `essai ${i + 1} : elle doit rester`);
    } else {
      assert.equal(file.length, 0);
      assert.equal(r.abandons[0].motif, 'trop-d-essais');
      assert.match(motsAbandon(r.abandons[0]), new RegExp(String(ESSAIS_MAX)));
    }
  }
});

/* ─── Le verdict d’un envoi périmé ─────────────────────────────────────────── */

dit('LA RÈGLE : un verdict qui arrive APRÈS un geste plus récent est ignoré', () => {
  /*
    Le cas qui perd des données : on crée, l'envoi part, on supprime pendant
    qu'il vole, puis la réponse « accepté » arrive. Retirer l'entrée ferait
    disparaître la SUPPRESSION de la file — elle ne partirait jamais, et
    l'enregistrement resterait vivant sur le serveur après avoir été supprimé
    partout ailleurs.
  */
  const creation = ecriture('tasks', 'x');
  let file = poser([], creation).file;
  const effacement = suppression('tasks', 'x');
  file = poser(file, effacement).file;

  const r = appliquer(file, creation, { parti: true });
  assert.equal(r.file.length, 1, 'la suppression doit survivre au verdict de la création');
  assert.equal(r.file[0].geste, 'suppression');
});

dit('un verdict sur une entrée disparue ne fait rien', () => {
  // La file est vidée à la déconnexion ; un envoi en vol peut répondre après.
  const e = ecriture('tasks', 'x');
  const r = appliquer([], e, { parti: false, statut: 503 });
  assert.equal(r.file.length, 0);
  assert.equal(r.abandons.length, 0);
});

/* ─── Règle 4 : bornée ─────────────────────────────────────────────────────── */

dit(`LA RÈGLE : la file s’arrête à ${FILE_MAX}, et la plus ancienne part`, () => {
  let file: Entree[] = [];
  let abandons: Abandon[] = [];
  for (let i = 0; i < FILE_MAX + 3; i += 1) {
    const r = poser(file, ecriture('tasks', `t${i}`));
    file = r.file;
    abandons = abandons.concat(r.abandons);
  }
  assert.equal(file.length, FILE_MAX, 'sinon le stockage se remplit et TOUT échoue');
  assert.equal(abandons.length, 3);
  assert.equal(abandons[0].entree.id, 't0', 'c’est la plus ancienne qui part');
  assert.equal(file[0].id, 't3');
  assert.match(motsAbandon(abandons[0]), new RegExp(String(FILE_MAX)));
});

dit('remplacer une entrée ne fait PAS déborder une file pleine', () => {
  let file: Entree[] = [];
  for (let i = 0; i < FILE_MAX; i += 1) file = poser(file, ecriture('tasks', `t${i}`)).file;
  const r = poser(file, ecriture('tasks', 't5', { titre: 'corrigé' }));
  assert.equal(r.file.length, FILE_MAX);
  assert.equal(r.abandons.length, 0, 'aucune donnée ne doit être perdue pour une simple correction');
});

/* ─── L’attente entre deux essais ──────────────────────────────────────────── */

dit('LA RÈGLE : l’attente double, pour ne pas achever une API en difficulté', () => {
  assert.equal(attenteAvantEssai(0), 0);
  assert.equal(attenteAvantEssai(1), 2000);
  assert.equal(attenteAvantEssai(2), 4000);
  assert.equal(attenteAvantEssai(3), 8000);
  assert.ok(attenteAvantEssai(4) > attenteAvantEssai(3), 'sans doublement, chaque poste martèle');
});

dit('et elle est PLAFONNÉE, sinon le dixième essai arrive dans huit heures', () => {
  assert.equal(attenteAvantEssai(ESSAIS_MAX), ATTENTE_MAX_MS);
  assert.equal(attenteAvantEssai(50), ATTENTE_MAX_MS);
});

/* ─── L’attente court depuis le DERNIER ESSAI ──────────────────────────────── */

dit('une entrée jamais essayée part tout de suite', () => {
  assert.equal(pretALEnvoi(ecriture('tasks', 'x'), Date.now()), true);
});

dit('LE PIÈGE : l’attente court depuis le dernier essai, PAS depuis le geste', () => {
  /*
    Une modification écrite il y a une heure et qui vient d'échouer serait « en
    retard » si on comptait depuis `pose`, et repartirait aussitôt : le
    doublement n'aurait aucun effet, et un serveur en difficulté recevrait de
    chaque poste ouvert une requête par seconde.
  */
  const t0 = Date.parse('2026-08-29T10:00:00.000Z');
  const vieille: Entree = {
    ...ecriture('tasks', 'x'),
    pose: new Date(t0 - 3600_000).toISOString(), // le geste, il y a une heure
    essais: 1,
    dernierEssai: new Date(t0).toISOString(), // l'échec, à l'instant
  };
  assert.equal(pretALEnvoi(vieille, t0 + 1000), false, 'une seconde après l’échec : trop tôt');
  assert.equal(pretALEnvoi(vieille, t0 + 2000), true, 'deux secondes après : c’est l’heure');
});

dit('et `appliquer` POSE bien ce dernier essai', () => {
  // Sans cet horodatage, `pretALEnvoi` retomberait sur son garde-fou « pas de
  // date, on essaie » et la file repartirait en boucle serrée.
  const e = ecriture('tasks', 'x');
  const r = appliquer(poser([], e).file, e, { parti: false, statut: 503 }, '2026-08-29T10:00:00.000Z');
  assert.equal(r.file[0].dernierEssai, '2026-08-29T10:00:00.000Z');
});

dit('une date abîmée ne bloque pas l’entrée pour toujours', () => {
  const e = { ...ecriture('tasks', 'x'), essais: 3, dernierEssai: 'n’importe quoi' };
  assert.equal(pretALEnvoi(e, Date.now()), true, 'un essai de trop vaut mieux qu’un blocage définitif');
});

/* ─── Ce que la file DIT ───────────────────────────────────────────────────── */

dit('une file vide ne dit rien', () => {
  // Un indicateur permanent apprend à être ignoré.
  assert.equal(resume([]), null);
});

dit('LE DÉFAUT MESURÉ ÉTAIT LE SILENCE : une file pleine se voit', () => {
  const un = resume(poser([], ecriture('tasks', 'x')).file);
  assert.ok(un && /1 modification/.test(un), un ?? '(rien)');
  assert.ok(un && !/modifications/.test(un), 'au singulier');

  let file = poser([], ecriture('tasks', 'x')).file;
  file = poser(file, ecriture('tasks', 'y')).file;
  assert.match(resume(file) ?? '', /2 modifications/);
});

dit('et une file BLOQUÉE dit que le serveur ne répond pas', () => {
  const e = ecriture('tasks', 'x');
  const file = appliquer(poser([], e).file, e, { parti: false, statut: 503 }).file;
  assert.match(resume(file) ?? '', /ne répond pas/);
});

dit('les trois abandons ont chacun leurs mots, et aucun n’est vide', () => {
  const e = ecriture('tasks', 'x');
  for (const motif of ['refus', 'trop-d-essais', 'file-pleine'] as const) {
    const m = motsAbandon({ entree: e, motif });
    assert.ok(m.length > 30, `${motif} : ${m}`);
  }
  // Une suppression et une modification ne se racontent pas pareil.
  assert.match(motsAbandon({ entree: suppression('tasks', 'x'), motif: 'refus' }), /suppression/i);
});

/* ─── Refermer un espace client emporte sa file ────────────────────────────── */

dit('une purge sans rien en attente ne dit rien', () => {
  // Le cas de très loin le plus courant. Un mot ici serait du bruit à chaque
  // sortie de dossier.
  assert.equal(motsPurge(0), null);
  assert.equal(motsPurge(-1), null);
});

dit('LA RÈGLE : ce qui part avec le miroir doit être DIT', () => {
  /*
    La file d'un contexte client vit sous le même préfixe que son miroir, donc
    la purge l'emporte — et c'est voulu, les données d'une cliente n'ont pas à
    rester sur le disque de l'opérateur. Mais l'effacer sans un mot rejouerait
    le défaut que la file répare, au pire moment : une session de support qui
    EXPIRE toute seule, sans que personne n'ait décidé de partir.
  */
  const un = motsPurge(1);
  assert.ok(un && /1 modification/.test(un), un ?? '(rien)');
  assert.ok(un && !/modifications/.test(un), 'au singulier');
  assert.match(un ?? '', /perdue/);

  const trois = motsPurge(3);
  assert.match(trois ?? '', /3 modifications/);
  assert.match(trois ?? '', /perdues/);
});

console.log(`\nOK — ${vus} contrôles.\n`);
