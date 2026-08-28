/**
 * Contrôle du module Événements.
 *
 * Trois familles de défauts, et aucune ne fait de bruit.
 *
 * **Un compte à rebours faux.** « J-3 » affiché pour un événement qui a lieu
 * demain ne plante pas : il se lit, et on s'organise dessus. Le piège classique
 * est la division d'un écart en millisecondes par 86 400 000, qui compte zéro
 * jour entre 23 h 50 aujourd'hui et 00 h 10 demain — et qui perd un jour à
 * chaque changement d'heure.
 *
 * **Un seuil de rentabilité inatteignable présenté comme atteignable.** Quand
 * la recette nette par billet est nulle ou négative, chaque entrée vendue COÛTE
 * de l'argent : le seuil que le moteur de calcul rend alors est un grand nombre
 * fini, volontairement. Le comparer à la jauge sans garde donnerait « il reste
 * 8 entrées à vendre » sur un événement qui perd de l'argent à chaque billet.
 *
 * **Un ordre de liste qui enterre ce qui presse.** Un tri chronologique pur met
 * un concert d'il y a trois ans avant celui de la semaine prochaine.
 *
 *   npm run check:evenements
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

interface EvenementData {
  nom: string;
  date: string;
  horaire?: string;
  lieu?: string;
  capacite: number;
  billetsVendus: number;
  prixBilletCents: number;
  commissionBilletterie: number;
  coutLieuCents: number;
  coutPrestatairesCents: number;
  coutCommunicationCents: number;
  coutParEntreeCents: number;
  annule?: boolean;
  notes?: string;
}

interface Economie {
  coutsFixesCents: number;
  recetteNetteBilletCents: number;
  seuilEntrees: number | null;
  margeSalleCombleCents: number;
  resultatActuelCents: number;
  entreesAvantEquilibre: number;
  atteignable: boolean;
  remplissage: number;
  erreurs: { key: string; message: string }[];
}

interface Moteur {
  JOURS_IMMINENT: number;
  jourCourant(maintenant?: Date): string;
  joursAvant(date: string, maintenant?: Date): number | null;
  etatEvenement(e: EvenementData, maintenant?: Date): string;
  economieEvenement(e: EvenementData): Economie;
  trierEvenements<T extends EvenementData>(liste: T[], maintenant?: Date): T[];
  normaliserEvenement(id: string, raw: unknown): EvenementData & { id: string };
  evenementNeuf(): EvenementData;
  ETAT_LABELS: Record<string, string>;
}

const M = await loadFromSrc<Moteur>('src/state/eventEngine.ts');

const failures: string[] = [];
function check(name: string, run: () => void) {
  try {
    run();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push(name);
    console.error(`  ÉCHEC ${name}`);
    console.error(`         ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
  }
}

/** Un événement complet, à partir duquel on ne change que ce qu'on éprouve. */
function evenement(patch: Partial<EvenementData> = {}): EvenementData {
  return { ...M.evenementNeuf(), nom: 'Essai', date: '2026-09-15', ...patch };
}

console.log('Module Événements — la date, l’argent, et l’ordre de la liste\n');

/* ============================ Le compte à rebours ========================== */

check('JOURS : le passage de minuit compte un jour, pas zéro', () => {
  /*
    LE DÉFAUT QUE CE CONTRÔLE FERME.

    `(cible - maintenant) / 86400000` vaut 0,014 entre 23 h 50 aujourd'hui et
    00 h 10 demain : arrondi, zéro jour — « c'est aujourd'hui », alors que
    l'événement est demain pour tout le monde. À 00 h 10, le même calcul
    donnerait bien 1. Le compte à rebours changerait donc de valeur en
    traversant minuit sans qu'aucune date ne bouge.
  */
  const veille = new Date('2026-09-14T23:50:00');
  const lendemain = new Date('2026-09-15T00:10:00');
  assert.equal(M.joursAvant('2026-09-15', veille), 1, 'la veille à 23 h 50, c’est J-1');
  assert.equal(M.joursAvant('2026-09-15', lendemain), 0, 'le jour même à 00 h 10, c’est J-0');
  assert.equal(M.joursAvant('2026-09-16', lendemain), 1);
});

check('JOURS : un changement d’heure ne fait pas disparaître un jour', () => {
  /*
    En Europe, la nuit du dernier dimanche de mars ne dure que 23 heures. Un
    écart calculé en millisecondes réels donne alors 6,96 jours pour sept jours
    de calendrier — arrondi vers le bas, six. Le compte à rebours sauterait
    d'un jour une fois par an, au pire moment : le printemps est la saison des
    festivals.
  */
  const avant = new Date('2026-03-25T10:00:00');
  assert.equal(M.joursAvant('2026-04-01', avant), 7, 'sept jours de calendrier, changement d’heure compris');
  // Et à l'automne, la nuit de 25 heures ne doit pas en ajouter un.
  const octobre = new Date('2026-10-22T10:00:00');
  assert.equal(M.joursAvant('2026-10-29', octobre), 7);
});

check('JOURS : une date passée est négative, une date absente est nulle', () => {
  const maintenant = new Date('2026-09-15T09:00:00');
  assert.equal(M.joursAvant('2026-09-14', maintenant), -1);
  assert.equal(M.joursAvant('2026-08-15', maintenant), -31);
  assert.equal(M.joursAvant('', maintenant), null, 'une date vide n’est pas « aujourd’hui »');
  assert.equal(M.joursAvant('demain', maintenant), null);
  assert.equal(M.joursAvant('2026-13-45', maintenant), null, 'une date impossible ne doit pas se calculer');
});

check('ÉTAT : déduit de la date, jamais saisi — sauf l’annulation', () => {
  /*
    Un statut choisi à la main se désynchronise du calendrier : l'événement
    passé reste « à venir » jusqu'à ce que quelqu'un pense à le changer, et
    personne n'y pense. Seule l'annulation est une décision, donc un drapeau.
  */
  const maintenant = new Date('2026-09-01T10:00:00');
  assert.equal(M.etatEvenement(evenement({ date: '2026-08-30' }), maintenant), 'passe');
  assert.equal(M.etatEvenement(evenement({ date: '2026-09-01' }), maintenant), 'imminent', 'le jour même est imminent');
  assert.equal(M.etatEvenement(evenement({ date: '2026-09-15' }), maintenant), 'imminent');
  assert.equal(M.etatEvenement(evenement({ date: '2026-09-16' }), maintenant), 'a-venir', 'J-15 dépasse la fenêtre');
  assert.equal(M.etatEvenement(evenement({ date: '' }), maintenant), 'sans-date');

  // L'annulation passe avant tout : un événement annulé la semaine dernière ne
  // se lit pas « passé », il se lit « annulé ».
  assert.equal(M.etatEvenement(evenement({ date: '2026-08-30', annule: true }), maintenant), 'annule');
  assert.equal(M.etatEvenement(evenement({ date: '2026-12-01', annule: true }), maintenant), 'annule');

  // Chaque état a un libellé : un état sans mot s'affiche vide.
  for (const etat of ['annule', 'passe', 'imminent', 'a-venir', 'sans-date']) {
    assert.ok(M.ETAT_LABELS[etat], `état sans libellé : ${etat}`);
  }
});

/* =============================== L'économie =============================== */

check('ÉCONOMIE : le cas connu, recalculé à la main', () => {
  const e = evenement({
    coutLieuCents: 120000,
    coutPrestatairesCents: 50000,
    coutCommunicationCents: 30000,
    coutParEntreeCents: 150,
    prixBilletCents: 2500,
    commissionBilletterie: 5,
    capacite: 200,
    billetsVendus: 0,
  });
  const eco = M.economieEvenement(e);
  assert.deepEqual(eco.erreurs, []);
  assert.equal(eco.coutsFixesCents, 200000, '120 000 + 50 000 + 30 000');
  // 2 500 − 5 % − 150 = 2 500 − 125 − 150 = 2 225
  assert.equal(eco.recetteNetteBilletCents, 2225);
  // 200 000 / 2 225 = 89,88 → 90 entrées, l'entier SUPÉRIEUR
  assert.equal(eco.seuilEntrees, 90);
  assert.equal(eco.margeSalleCombleCents, 2225 * 200 - 200000);
  assert.equal(eco.atteignable, true, '90 entrées tiennent dans 200 places');
});

check('ÉCONOMIE : un billet vendu à perte n’est JAMAIS annoncé atteignable', () => {
  /*
    LE DÉFAUT LE PLUS DANGEREUX DE CE MODULE.

    Prix du billet inférieur au coût par entrée : chaque personne qui entre
    coûte de l'argent. Le moteur de calcul rend alors un seuil grand mais FINI
    (voir le profil `evenementiel-rentabilite`, qui préfère un nombre absurde à
    un infini). Comparé bêtement à la jauge, ce nombre peut tomber sous la
    capacité d'une grande salle — et l'écran annoncerait « il reste 8 entrées à
    vendre » sur un événement qu'aucune vente ne peut sauver.

    Le verdict est le seul de tout le module qu'on ne rattrapera pas en vendant
    mieux : il faut baisser les coûts ou monter le prix.
  */
  const perte = evenement({ prixBilletCents: 100, coutParEntreeCents: 500, commissionBilletterie: 5 });
  const eco = M.economieEvenement(perte);
  assert.ok(eco.recetteNetteBilletCents < 0, 'la perte par billet doit se voir');
  assert.equal(eco.atteignable, false, 'un événement à perte par billet ne peut pas être « atteignable »');
  /*
    ET LE SEUIL N'EXISTE PAS — trouvé en regardant l'écran.

    Le moteur de calcul rend ici un nombre grand mais fini
    (`coûts fixes / max(recette, 1)`), pour ne pas laisser un `Infinity`
    traverser tout le calcul : c'est sa garantie à lui, et elle est bonne.
    Mais ce nombre n'est pas un seuil. Sur des coûts de 2 300 €, il vaut
    230 000, et l'écran affichait « SEUIL : 230 000 » — qui se lit « il faut
    vendre 230 000 places ». Un chiffre faux avec l'autorité d'un chiffre
    juste, à côté d'un verdict pourtant correct.
  */
  assert.equal(eco.seuilEntrees, null, 'un seuil est annoncé là où il n’en existe aucun');
  assert.equal(eco.entreesAvantEquilibre, 0, 'un décompte d’entrées restantes sans seuil');

  // Et avec une salle immense, là où la comparaison naïve passerait au vert.
  const immense = M.economieEvenement({ ...perte, capacite: 1_000_000 });
  assert.equal(immense.atteignable, false, 'une grande salle ne rend pas rentable un billet vendu à perte');

  // Le cas limite exact : recette nette NULLE. Vendre n'apporte rien.
  const nulle = M.economieEvenement(evenement({ prixBilletCents: 1000, coutParEntreeCents: 950, commissionBilletterie: 5 }));
  assert.equal(nulle.recetteNetteBilletCents, 0);
  assert.equal(nulle.atteignable, false, 'une recette nette nulle ne finance jamais les coûts fixes');
  assert.equal(nulle.seuilEntrees, null, 'au cas limite exact non plus, il n’y a pas de seuil');
});

check('ÉCONOMIE : un seuil qui dépasse la jauge est refusé, même à recette positive', () => {
  // Des coûts fixes trop lourds pour la salle : la recette par billet est
  // bonne, mais il n'y a pas assez de sièges pour couvrir les frais.
  const eco = M.economieEvenement(evenement({ coutLieuCents: 5_000_000, capacite: 200 }));
  assert.ok(eco.recetteNetteBilletCents > 0);
  assert.ok(eco.seuilEntrees !== null && eco.seuilEntrees > 200, 'le seuil doit bien dépasser la jauge dans ce cas');
  // Ici le seuil EXISTE — il est juste hors d'atteinte. C'est ce qui le
  // distingue du cas précédent, et l'écran le dit autrement.
  assert.notEqual(eco.seuilEntrees, null, 'à recette positive, un seuil existe bel et bien');
  assert.equal(eco.atteignable, false);
  // La marge salle comble le dit autrement, et les deux doivent s'accorder :
  // un événement inatteignable perd de l'argent même complet.
  assert.ok(eco.margeSalleCombleCents < 0, 'inatteignable et pourtant rentable à guichets fermés ?');
});

check('ÉCONOMIE : le résultat actuel est NÉGATIF tant que le seuil n’est pas franchi', () => {
  /*
    Afficher zéro, ou s'arrêter à « il reste 37 entrées », cacherait le montant
    qu'on est en train de perdre — qui est justement ce qu'on veut savoir trois
    semaines avant, quand il est encore temps de baisser un coût.
  */
  const base = {
    coutLieuCents: 120000,
    coutPrestatairesCents: 50000,
    coutCommunicationCents: 30000,
    coutParEntreeCents: 150,
    prixBilletCents: 2500,
    commissionBilletterie: 5,
    capacite: 200,
  };
  const a = M.economieEvenement(evenement({ ...base, billetsVendus: 0 }));
  assert.equal(a.resultatActuelCents, -200000, 'sans un billet vendu, on a déjà tout dépensé');
  assert.equal(a.entreesAvantEquilibre, 90);

  const b = M.economieEvenement(evenement({ ...base, billetsVendus: 50 }));
  assert.equal(b.resultatActuelCents, 2225 * 50 - 200000);
  assert.ok(b.resultatActuelCents < 0, 'à 50 entrées sur 90, on perd encore');
  assert.equal(b.entreesAvantEquilibre, 40);

  const c = M.economieEvenement(evenement({ ...base, billetsVendus: 90 }));
  assert.ok(c.resultatActuelCents >= 0, 'au seuil, on ne perd plus');
  assert.equal(c.entreesAvantEquilibre, 0);

  // Au-delà, le compteur d'entrées restantes reste à zéro : « −12 entrées
  // avant l'équilibre » ne veut rien dire.
  const d = M.economieEvenement(evenement({ ...base, billetsVendus: 150 }));
  assert.equal(d.entreesAvantEquilibre, 0);
  assert.ok(d.resultatActuelCents > 0);
});

check('ÉCONOMIE : le remplissage ne divise jamais par zéro', () => {
  // Une jauge à zéro est une saisie que rien n'interdit — un événement dont on
  // n'a pas encore la salle.
  const eco = M.economieEvenement(evenement({ capacite: 0, billetsVendus: 0 }));
  assert.equal(eco.remplissage, 0);
  assert.ok(Number.isFinite(eco.remplissage), 'un remplissage NaN s’afficherait « NaN % »');
  assert.equal(eco.atteignable, false, 'sans salle, aucun seuil n’est atteignable');
});

check('ÉCONOMIE : l’arithmétique est celle du moteur de calcul, pas une copie', () => {
  /*
    La garantie qui compte à long terme. Si quelqu'un réécrit un jour le calcul
    dans ce module, les deux arithmétiques divergeront en silence, chacune
    restant cohérente avec elle-même. On vérifie donc que le module rend
    EXACTEMENT ce que rend le profil, sur des cas variés.
  */
  const cas: Partial<EvenementData>[] = [
    {},
    { coutLieuCents: 0, coutPrestatairesCents: 0, coutCommunicationCents: 0 },
    { prixBilletCents: 999, commissionBilletterie: 12.5, coutParEntreeCents: 37 },
    { capacite: 1, prixBilletCents: 1_000_000 },
    { commissionBilletterie: 100 },
  ];
  for (const patch of cas) {
    const e = evenement(patch);
    const eco = M.economieEvenement(e);
    // Recalculé à la main, exactement comme le profil le déclare.
    const fixes = e.coutLieuCents + e.coutPrestatairesCents + e.coutCommunicationCents;
    const recette =
      e.prixBilletCents - (e.prixBilletCents * e.commissionBilletterie) / 100 - e.coutParEntreeCents;
    assert.equal(eco.coutsFixesCents, fixes, JSON.stringify(patch));
    assert.equal(eco.recetteNetteBilletCents, Math.round(recette), JSON.stringify(patch));
    const attendu = Math.round(recette) > 0 ? Math.ceil(fixes / Math.round(recette)) : null;
    assert.equal(eco.seuilEntrees, attendu, JSON.stringify(patch));
  }
});

/* ================================== Le tri ================================= */

check('TRI : ce qui demande une décision d’abord, l’histoire ensuite', () => {
  const maintenant = new Date('2026-09-01T10:00:00');
  const liste = [
    evenement({ nom: 'vieux', date: '2023-05-01' }),
    evenement({ nom: 'annulé', date: '2026-09-05', annule: true }),
    evenement({ nom: 'lointain', date: '2027-01-15' }),
    evenement({ nom: 'sans date', date: '' }),
    evenement({ nom: 'imminent', date: '2026-09-03' }),
    evenement({ nom: 'récent passé', date: '2026-08-28' }),
    evenement({ nom: 'demain', date: '2026-09-02' }),
  ];
  const ordre = M.trierEvenements(liste, maintenant).map((e) => e.nom);
  assert.deepEqual(ordre, [
    'demain',
    'imminent',
    'lointain',
    'sans date',
    'récent passé',
    'vieux',
    'annulé',
  ], ordre.join(' · '));
});

check('TRI : les passés se lisent du plus RÉCENT au plus ancien', () => {
  // C'est du dernier événement qu'on tire le bilan, pas du premier de
  // l'histoire. Un tri croissant enterrerait le seul qui serve.
  const maintenant = new Date('2026-09-01T10:00:00');
  const ordre = M.trierEvenements(
    [
      evenement({ nom: 'a', date: '2020-01-01' }),
      evenement({ nom: 'b', date: '2026-08-31' }),
      evenement({ nom: 'c', date: '2024-06-15' }),
    ],
    maintenant,
  ).map((e) => e.nom);
  assert.deepEqual(ordre, ['b', 'c', 'a']);
});

check('TRI : ne modifie pas la liste qu’on lui donne', () => {
  // Un tri en place sur un tableau venu de la synchronisation réordonnerait
  // l'état de React sans passer par un rendu — un bug qui ne se voit qu'au
  // rafraîchissement suivant.
  const maintenant = new Date('2026-09-01T10:00:00');
  const liste = [evenement({ nom: 'z', date: '2027-01-01' }), evenement({ nom: 'a', date: '2026-09-02' })];
  const avant = liste.map((e) => e.nom);
  M.trierEvenements(liste, maintenant);
  assert.deepEqual(liste.map((e) => e.nom), avant);
});

/* ============================= La normalisation ============================ */

check('LECTURE : un enregistrement de travers ne produit ni NaN ni négatif', () => {
  /*
    Il arrive de la synchronisation, donc d'une autre machine et peut-être
    d'une autre version. Une capacité `undefined` dans une division donne
    « NaN % » à l'écran : un affichage qui ne dit rien de son origine.
  */
  const e = M.normaliserEvenement('id-1', {
    nom: '   ',
    date: '15/09/2026',
    capacite: -50,
    billetsVendus: '12',
    prixBilletCents: null,
    commissionBilletterie: 500,
    coutLieuCents: 'beaucoup',
  });
  assert.equal(e.id, 'id-1');
  assert.equal(e.nom, 'Sans nom', 'un nom vide ne doit pas rendre la ligne anonyme');
  assert.equal(e.date, '', 'une date au mauvais format est traitée comme absente');
  assert.equal(e.capacite, 0, 'une jauge négative donnerait un remplissage négatif');
  assert.equal(e.billetsVendus, 12, 'un nombre en texte reste un nombre');
  assert.equal(e.prixBilletCents, 0);
  assert.equal(e.commissionBilletterie, 100, 'une commission est bornée à 100 %');
  assert.equal(e.coutLieuCents, 0);
  assert.equal(e.annule, false);

  // Et le tout doit se calculer sans erreur : c'est le but de la remise en forme.
  const eco = M.economieEvenement(e);
  for (const v of [eco.coutsFixesCents, eco.recetteNetteBilletCents, eco.remplissage]) {
    assert.ok(Number.isFinite(v), `valeur non finie après normalisation : ${v}`);
  }
});

check('LECTURE : rien du tout ne casse rien', () => {
  for (const raw of [null, undefined, {}, 'texte', 42]) {
    const e = M.normaliserEvenement('x', raw as never);
    assert.equal(typeof e.nom, 'string');
    assert.ok(Number.isFinite(e.capacite));
    assert.deepEqual(M.economieEvenement(e).erreurs, [], JSON.stringify(raw));
  }
});

check('LECTURE : un événement neuf s’ouvre sur des chiffres qui tiennent debout', () => {
  // Le premier écran que voit quelqu'un. Des valeurs par défaut incohérentes
  // apprendraient l'outil de travers.
  const neuf = M.evenementNeuf();
  const eco = M.economieEvenement(neuf);
  assert.deepEqual(eco.erreurs, []);
  assert.ok(eco.recetteNetteBilletCents > 0, 'l’exemple par défaut ne doit pas vendre à perte');
  assert.equal(eco.atteignable, true, 'l’exemple par défaut doit être rentable, sinon il apprend le contraire');
  assert.equal(neuf.date, '', 'aucune date inventée : c’est à la personne de la poser');
  assert.equal(neuf.billetsVendus, 0);
});

check('JOUR COURANT : le jour local, pas le jour UTC', () => {
  // Un `toISOString().slice(0, 10)` rendrait la veille pour tout ce qui se
  // passe après 01 h du matin en heure d'été française — donc un compte à
  // rebours décalé d'un jour une nuit sur deux.
  const soir = new Date(2026, 8, 15, 23, 30);
  assert.equal(M.jourCourant(soir), '2026-09-15');
  const matin = new Date(2026, 0, 1, 0, 30);
  assert.equal(M.jourCourant(matin), '2026-01-01');
});

if (failures.length > 0) {
  console.error(`\n${failures.length} contrôle(s) en échec :`);
  for (const n of failures) console.error(`  - ${n}`);
  process.exit(1);
}
console.log('\nModule Événements : tous les contrôles passent.');
