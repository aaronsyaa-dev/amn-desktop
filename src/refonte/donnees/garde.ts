/**
 * LES JEUX « LA GARDE » — organisations surveillées (H30, H31, N02, N03), actifs,
 * alertes (MG01), incidents (H32), vulnérabilités, rondes (H33), événements de
 * sécurité (MG02), journal d'accès (H35), maturité (H34), offres (MG03).
 *
 * L'ÉTAT d'une organisation (« Sain », « À surveiller », « Critique ») n'est pas
 * tiré au hasard : c'est le plus grave de trois critères (N02, 6.1) — la bande
 * de son score, la gravité de ses alertes ouvertes, le retard de sa dernière
 * ronde. Les jeux fabriquent d'abord ces trois critères, puis `etatOrganisation`
 * en tire l'état ; un écran qui refait le calcul retrouve la même valeur.
 *
 * Rien d'exploitable : ni vraie adresse, ni vrai identifiant de faille
 * (`FICT-AAAA-NNNN`), ni détail technique. Des noms en `.exemple.test`, des
 * titres génériques, des compteurs.
 */

import { cle, cycle, fabriquer, hasardDe, nomClient, salaries } from './commun';
import { moi } from './equipe';
import { ajouterJours, compter, slug } from './outils';
import type { Contexte, FicheClient, Interlocuteur, Membre } from './types';
import type {
  ActifSurveille, AlerteGarde, CritereMaturite, DomaineMaturite, EntreeJournalAcces, EtatGarde, EvenementSecurite, GraviteAlerte, IncidentGarde,
  OffreCyber, OrganisationGarde, RondeGarde, Site, TypeRonde, Vulnerabilite,
} from './types-suite';

const MIN = 60_000;
const H = 3_600_000;

/* ------------------------- L'état d'une organisation (N02, 6.1) ------------------------- */

const RANG: Record<EtatGarde, number> = { Sain: 0, 'À surveiller': 1, Critique: 2 };
const pire = (a: EtatGarde, b: EtatGarde): EtatGarde => (RANG[a] >= RANG[b] ? a : b);

/**
 * L'état d'une organisation : le plus grave de (1) la bande du score — 70 et plus
 * « Sain », 45 à 69 « À surveiller », moins de 45 « Critique » —, (2) les alertes
 * ouvertes — une Critique « Critique », une Moyenne « À surveiller », des Faibles
 * seules « Sain » —, (3) la ronde — plus de 2 intervalles « À surveiller », plus
 * de 24 h « Critique ». Proposition de la fiche N02, à confirmer dans le code.
 */
export function etatOrganisation(
  score: number,
  alertesOuvertes: readonly GraviteAlerte[],
  derniereRondeAt: string,
  intervalleRondeH: number,
  maintenant: number,
): EtatGarde {
  let etat: EtatGarde = score >= 70 ? 'Sain' : score >= 45 ? 'À surveiller' : 'Critique';
  if (alertesOuvertes.includes('Critique')) etat = pire(etat, 'Critique');
  else if (alertesOuvertes.includes('Moyenne')) etat = pire(etat, 'À surveiller');
  const retardH = (maintenant - Date.parse(derniereRondeAt)) / H;
  if (retardH > 24) etat = pire(etat, 'Critique');
  else if (retardH > 2 * intervalleRondeH) etat = pire(etat, 'À surveiller');
  return etat;
}

/* ------------------------------- Organisations ------------------------------- */

interface Plan { cible: EtatGarde; via: 'score' | 'alerte' | 'ronde' }

/** Les organisations surveillées sont des clients : même nom, même secteur. */
export function genererOrganisations(ctx: Contexte, clients: readonly FicheClient[], sites: readonly Site[]): { organisations: OrganisationGarde[]; plans: Map<string, Plan> } {
  const h = hasardDe(ctx.graine, 'organisations');
  const n = Math.min(compter(ctx.volumes.organisations, [0, 3, 8, 24]), clients.length);
  const avecSite = new Set(sites.map((s) => s.clientId).filter((x): x is number => x !== null));
  // On préfère les clients qui ont un site : leur domaine devient un actif surveillé.
  const choisis = [...h.melanger(clients.filter((c) => avecSite.has(c.id))), ...h.melanger(clients.filter((c) => !avecSite.has(c.id)))].slice(0, n);
  // Les trois premières organisations montrent les trois états (une critique par alerte, une à surveiller par alerte, une saine) ; le reste est mélangé.
  const premieres = [['Critique', 'alerte'], ['À surveiller', 'alerte'], ['Sain', 'score']] as const;
  const suite = cycle(h, [['Sain', 'score'], ['Sain', 'score'], ['À surveiller', 'score'], ['Sain', 'score'], ['Critique', 'ronde'], ['À surveiller', 'ronde'], ['Critique', 'score'], ['Sain', 'score']] as const, Math.max(0, n - 3));
  const cibles: readonly (readonly [EtatGarde, 'score' | 'alerte' | 'ronde'])[] = [...premieres, ...suite].slice(0, n);
  const plans = new Map<string, Plan>();
  const organisations = choisis.map((c, i): OrganisationGarde => {
    const [cible, via] = cibles[i];
    const id = cle('og', i + 1);
    plans.set(id, { cible, via });
    const intervalle = h.choix([1, 2, 4, 6]);
    // Score selon la cible, sauf quand l'état vient d'une alerte ou d'une ronde : le score peut alors rester bon (Menna : 71 mais rouge).
    const score = cible === 'Sain' ? h.entier(74, 96) : cible === 'À surveiller' ? (via === 'score' ? h.entier(46, 68) : h.entier(70, 88)) : via === 'score' ? h.entier(20, 44) : h.entier(66, 80);
    // Dernière ronde : à jour, sauf si c'est elle la cause de l'état.
    const retard = cible === 'Critique' && via === 'ronde' ? h.entier(26, 40) * H : cible === 'À surveiller' && via === 'ronde' ? (2 * intervalle + h.entier(1, 3)) * H : h.entier(5, Math.max(6, Math.round(intervalle * 50))) * MIN;
    return {
      id,
      clientId: c.id,
      nom: nomClient(c),
      lettre: nomClient(c)[0].toUpperCase(),
      secteur: c.secteur,
      score,
      scoreDebutMois: Math.max(10, Math.min(100, score + h.entier(-6, 6))),
      derniereRondeAt: new Date(ctx.maintenant - retard).toISOString(),
      intervalleRondeH: intervalle,
      protegeDepuis: ajouterJours(ctx.aujourdhui, -h.entier(20, 700)),
      etat: 'Sain',
    };
  });
  return { organisations, plans };
}

/* ----------------------------------- Actifs ----------------------------------- */

function hoteDe(c: FicheClient | undefined, org: OrganisationGarde): string {
  try {
    if (c?.siteWeb) return new URL(c.siteWeb).hostname.replace(/^www\./, '');
  } catch { /* adresse invalide : on fabrique un nom */ }
  return `${slug(org.nom)}.exemple.test`;
}

export function genererActifs(ctx: Contexte, organisations: readonly OrganisationGarde[], clients: readonly FicheClient[]): ActifSurveille[] {
  const h = hasardDe(ctx.graine, 'actifs');
  const total = organisations.length ? compter(ctx.volumes.actifs, [0, 12, 80, 500]) : 0;
  const liste: ActifSurveille[] = [];
  const parOrg = organisations.length ? Math.max(1, Math.round(total / organisations.length)) : 0;
  for (const org of organisations) {
    const hote = hoteDe(clients.find((c) => c.id === org.clientId), org);
    const modeles: readonly (readonly [ActifSurveille['type'], string])[] = [
      ['Domaine', hote], ['Messagerie', `mail.${hote}`], ['Sous-domaine', `app.${hote}`], ['Accès distant', `acces.${hote}`], ['Serveur', `srv-01.${hote}`],
      ['Sous-domaine', `boutique.${hote}`], ['Serveur', `srv-02.${hote}`], ['Sous-domaine', `aide.${hote}`],
    ];
    for (let k = 0; k < parOrg; k += 1) {
      const [type, nom] = k < modeles.length ? modeles[k] : [h.choix(['Sous-domaine', 'Serveur'] as const), `${k}.${hote}`] as const;
      liste.push({
        id: cle('ac', liste.length + 1, 5),
        organisationId: org.id,
        type,
        nom,
        principal: k < 5,
        expireDansJours: type === 'Domaine' ? h.pondere([[h.entier(5, 29), 1], [h.entier(60, 400), 4]] as const) : null,
        certificatJours: type === 'Sous-domaine' || type === 'Accès distant' ? h.pondere([[h.entier(3, 13), 1], [h.entier(20, 85), 5]] as const) : null,
        messagerieOk: type === 'Messagerie' ? h.chance(0.8) : null,
        patchEnRetard: type === 'Serveur' ? h.chance(0.25) : null,
      });
    }
  }
  return liste;
}

/* ----------------------------------- Alertes ----------------------------------- */

const TITRES_ALERTE: Record<GraviteAlerte, readonly (readonly [string, string])[]> = {
  Critique: [['Site injoignable depuis plus de 10 minutes', 'Aucune réponse aux contrôles automatiques.'], ['Certificat expiré', 'Le certificat d’un sous-domaine n’est plus valide.'], ['Sauvegarde échouée trois nuits de suite', 'Aucune copie valide depuis trois jours.']],
  Moyenne: [['Certificat à renouveler sous 14 jours', 'Le renouvellement doit être planifié.'], ['Mises à jour de sécurité en attente', 'Des correctifs sont disponibles sur un serveur.'], ['Messagerie : configuration à vérifier', 'Les protections d’envoi sont incomplètes.']],
  Faible: [['Nom de domaine à renouveler dans 60 jours', 'Pensez à prévoir le renouvellement.'], ['Nouveau sous-domaine détecté', 'Un sous-domaine inconnu apparaît dans la surveillance.'], ['Performance en baisse sur une page', 'Le temps de chargement a augmenté cette semaine.']],
};

export function genererAlertes(
  ctx: Contexte,
  equipe: readonly Membre[],
  organisations: readonly OrganisationGarde[],
  plans: ReadonlyMap<string, Plan>,
): AlerteGarde[] {
  const h = hasardDe(ctx.graine, 'alertes');
  const cible = organisations.length ? compter(ctx.volumes.alertes, [0, 4, 14, 80]) : 0;
  const gens = salaries(equipe);
  const liste: AlerteGarde[] = [];
  const ajouter = (org: OrganisationGarde, gravite: GraviteAlerte, etat: 'Ouverte' | 'Acquittée', age: number, extra: Partial<AlerteGarde> = {}): void => {
    const [titre, detail] = h.choix(TITRES_ALERTE[gravite]);
    const detectee = ctx.maintenant - age;
    const acquittee = etat === 'Acquittée' ? Math.min(ctx.maintenant - 60_000, detectee + h.entier(2, 45) * MIN) : null;
    liste.push({
      id: cle('al', liste.length + 1, 5), titre, detail, gravite, organisationId: org.id, detecteeAt: new Date(detectee).toISOString(), etat,
      acquitteeAt: acquittee ? new Date(acquittee).toISOString() : null, assigneeEmail: etat === 'Acquittée' || h.chance(0.3) ? h.choix(gens).email : null,
      sourdineJusquAt: null, fausseAlerte: etat === 'Acquittée' && h.chance(0.18), ...extra,
    });
  };
  // 1. Les alertes qui FONT l'état (ou le tolèrent) : les organisations « Sain » n'ont que des Faibles.
  for (const org of organisations) {
    const plan = plans.get(org.id);
    if (!plan) continue;
    if (plan.cible === 'Critique' && plan.via === 'alerte') ajouter(org, 'Critique', 'Ouverte', h.entier(4, 90) * MIN);
    else if (plan.cible === 'À surveiller' && plan.via === 'alerte') ajouter(org, 'Moyenne', 'Ouverte', h.entier(20, 600) * MIN);
    else if (h.chance(0.4)) ajouter(org, 'Faible', 'Ouverte', h.entier(1, 40) * H);
  }
  // 2. Le reste du volume : des alertes déjà acquittées, surtout récentes ; un tiers « aujourd'hui » (KPI « Traitées aujourd'hui »).
  let k = 0;
  while (liste.length < cible && k < cible * 4) {
    k += 1;
    const org = h.choix(organisations);
    const gravite = h.pondere([['Faible', 5], ['Moyenne', 3], ['Critique', 1]] as const);
    const aujourdhui = h.chance(0.4);
    const age = aujourdhui ? h.entier(40, Math.max(41, Math.round((ctx.maintenant % 86_400_000) / MIN))) * MIN : (h.entier(1, 6) * 24 + h.entier(0, 20)) * H;
    ajouter(org, gravite, 'Acquittée', age);
  }
  // Une alerte mise en sourdine, pour que l'onglet « Ouvertes » l'écarte (MG01).
  const ouverte = liste.find((a) => a.etat === 'Ouverte' && a.gravite === 'Faible');
  if (ouverte) ouverte.sourdineJusquAt = new Date(ctx.maintenant + 24 * H).toISOString();
  return liste.sort((a, b) => ({ Critique: 0, Moyenne: 1, Faible: 2 })[a.gravite] - ({ Critique: 0, Moyenne: 1, Faible: 2 })[b.gravite] || b.detecteeAt.localeCompare(a.detecteeAt));
}

/** L'état définitif, posé une fois les alertes connues. */
export function poserEtats(organisations: OrganisationGarde[], alertes: readonly AlerteGarde[], maintenant: number): void {
  for (const org of organisations) {
    const ouvertes = alertes.filter((a) => a.organisationId === org.id && a.etat === 'Ouverte' && !a.sourdineJusquAt).map((a) => a.gravite);
    org.etat = etatOrganisation(org.score, ouvertes, org.derniereRondeAt, org.intervalleRondeH, maintenant);
  }
}

/* ---------------------------------- Incidents ---------------------------------- */

const ETAPES: readonly IncidentGarde['etape'][] = ['En traitement', 'Détecté', 'Pris en charge', 'Résolu', 'Clôturé', 'Clôturé'];

export function genererIncidents(ctx: Contexte, equipe: readonly Membre[], organisations: readonly OrganisationGarde[], alertes: readonly AlerteGarde[]): IncidentGarde[] {
  const h = hasardDe(ctx.graine, 'incidents');
  const n = organisations.length ? compter(ctx.volumes.incidents, [0, 1, 4, 20]) : 0;
  const gens = salaries(equipe);
  const etapes = cycle(h, ETAPES, n);
  const liste = fabriquer(n, (i): IncidentGarde => {
    const etape = i === 1 ? 'En traitement' : etapes[i - 1];
    const liee = alertes.filter((a) => a.gravite !== 'Faible')[i - 1];
    const org = liee ? organisations.find((o) => o.id === liee.organisationId) ?? h.choix(organisations) : h.choix(organisations);
    const gravite: GraviteAlerte = liee?.gravite ?? h.pondere([['Moyenne', 4], ['Critique', 2], ['Faible', 1]] as const);
    const ouvert = etape === 'En traitement' || etape === 'Détecté' || etape === 'Pris en charge' ? ctx.maintenant - h.entier(40, 800) * MIN : ctx.maintenant - h.entier(2, 80) * 24 * H;
    const ferme = etape === 'Clôturé' ? ouvert + h.entier(3, 60) * H : null;
    const plan = ['Isoler le service concerné', 'Changer les accès partagés', 'Vérifier les sauvegardes', 'Informer le client', 'Rédiger le compte rendu'];
    const faites = etape === 'Détecté' ? 0 : etape === 'Pris en charge' ? 0 : etape === 'En traitement' ? 2 : etape === 'Résolu' ? 4 : 5;
    const responsable = etape === 'Détecté' ? null : h.choix(gens);
    return {
      id: `INC-${String(412 - (i - 1) * 7).padStart(4, '0')}`,
      organisationId: org.id,
      titre: liee ? liee.titre : h.choix(['Accès inhabituel à un compte', 'Service indisponible', 'Message suspect signalé']),
      gravite,
      etape,
      responsableEmail: responsable?.email ?? null,
      ouvertAt: new Date(ouvert).toISOString(),
      clotureAt: ferme ? new Date(ferme).toISOString() : null,
      plan: plan.map((libelle, k) => ({ libelle, fait: k < faites })),
      chronologie: [
        { at: new Date(ouvert).toISOString(), texte: 'Incident détecté par la surveillance.', parEmail: null },
        ...(responsable ? [{ at: new Date(ouvert + 12 * MIN).toISOString(), texte: 'Prise en charge.', parEmail: responsable.email }] : []),
        ...(faites >= 2 ? [{ at: new Date(ouvert + 55 * MIN).toISOString(), texte: 'Premières mesures de protection appliquées.', parEmail: responsable?.email ?? null }] : []),
      ].filter((e) => Date.parse(e.at) <= ctx.maintenant),
      clientInforme: faites >= 4,
      donneesPersonnelles: h.choix(['non', 'non', 'inconnu', 'oui'] as const),
    };
  });
  return liste;
}

/* -------------------------------- Vulnérabilités -------------------------------- */

const VULNERABILITES: readonly (readonly [string, GraviteAlerte])[] = [
  ['Mises à jour du système en retard', 'Moyenne'], ['Logiciel de gestion de site à mettre à jour', 'Moyenne'], ['Chiffrement des échanges à moderniser', 'Faible'],
  ['Accès d’administration sans seconde validation', 'Critique'], ['Compte inactif encore actif', 'Faible'], ['Page d’identification trop permissive', 'Moyenne'],
];

export function genererVulnerabilites(ctx: Contexte, organisations: readonly OrganisationGarde[], actifs: readonly ActifSurveille[]): Vulnerabilite[] {
  const h = hasardDe(ctx.graine, 'vulnerabilites');
  const n = organisations.length ? compter(ctx.volumes.vulnerabilites, [0, 2, 10, 60]) : 0;
  return fabriquer(n, (i) => {
    const org = h.choix(organisations);
    const [titre, gravite] = VULNERABILITES[(i - 1) % VULNERABILITES.length];
    const mesActifs = actifs.filter((a) => a.organisationId === org.id);
    return { id: cle('vu', i), idFictif: `FICT-${ctx.aujourdhui.slice(0, 4)}-${String(100 + i).padStart(4, '0')}`, organisationId: org.id, actifId: mesActifs.length ? h.choix(mesActifs).id : null, titre, gravite, ouverteLe: ajouterJours(ctx.aujourdhui, -h.entier(0, 120)), etat: h.chance(0.35) ? 'corrigée' : 'ouverte' };
  });
}

/* ------------------------------------- Rondes ------------------------------------- */

const RONDES: readonly (readonly [string, TypeRonde, string, number, readonly (readonly [string, 'ok' | 'attention' | 'critique'])[]])[] = [
  ['Surface externe', 'Surface externe', 'Toutes les 6 heures', 360, [['Aucun changement', 'ok'], ['2 nouvelles', 'attention']]],
  ['Certificats et domaines', 'Certificats et domaines', 'Chaque jour, 6 h', 1440, [['Vérifiés', 'ok'], ['1 bientôt expiré', 'attention']]],
  ['Vulnérabilités connues', 'Vulnérabilités connues', 'Chaque nuit', 1440, [['Rien trouvé', 'ok'], ['3 à examiner', 'attention']]],
  ['Hameçonnage simulé', 'Hameçonnage simulé', 'Chaque mois', 43200, [['2 clics sur 11', 'attention']]],
  ['Sauvegardes', 'Sauvegardes', 'Chaque nuit', 1440, [['Vérifiées', 'ok'], ['1 à revoir', 'critique']]],
  ['Fuites de données', 'Fuites de données', 'Chaque semaine', 10080, [['Rien trouvé', 'ok'], ['1 nouvelle', 'attention']]],
];

export function genererRondes(ctx: Contexte, organisations: readonly OrganisationGarde[]): RondeGarde[] {
  const h = hasardDe(ctx.graine, 'rondes');
  const n = organisations.length ? compter(ctx.volumes.rondes, [0, 3, 6, 12]) : 0;
  return fabriquer(n, (i) => {
    const [nom, type, frequence, min, resultats] = RONDES[(i - 1) % RONDES.length];
    const derniere = ctx.maintenant - h.entier(10, Math.max(11, Math.round(min * 0.8))) * MIN;
    const [libelle, ton] = h.choix(resultats);
    const perimetre = h.echantillon(organisations, Math.max(1, Math.min(organisations.length, h.entier(2, Math.max(2, organisations.length)))));
    return {
      id: cle('rd', i),
      nom: i > RONDES.length ? `${nom} (${perimetre[0].secteur})` : nom,
      type,
      perimetre: perimetre.map((o) => o.id),
      frequence,
      frequenceMin: min,
      activee: !(i === 5 && n >= 6),
      prochaineAt: new Date(derniere + min * MIN).toISOString(),
      derniereAt: new Date(derniere).toISOString(),
      dernierResultat: { libelle, ton },
    };
  });
}

/* ---------------------- Événements de sécurité et journal d'accès ---------------------- */

const EVENEMENTS: readonly (readonly [string, string, EvenementSecurite['source'], EvenementSecurite['resultat']])[] = [
  ['Tentatives de connexion refusées', 'Plusieurs essais depuis un lieu inhabituel.', 'Accès', 'Bloqué'], ['Ronde terminée', 'Aucun changement détecté.', 'Rondes', 'Normal'],
  ['Message suspect mis de côté', 'Un courriel a été placé en quarantaine.', 'Messagerie', 'Bloqué'], ['Sauvegarde vérifiée', 'La restauration de test a réussi.', 'Sauvegardes', 'Normal'],
  ['Connexion depuis un nouvel appareil', 'Un appareil inconnu a été autorisé.', 'Accès', 'Journalisé'], ['Règle du pare-feu appliquée', 'Un trafic inhabituel a été refusé.', 'Pare-feu', 'Bloqué'],
  ['Changement de rôle', 'Un rôle d’administrateur a été attribué.', 'Accès', 'Journalisé'],
];

export function genererEvenementsSecurite(ctx: Contexte, organisations: readonly OrganisationGarde[]): EvenementSecurite[] {
  const h = hasardDe(ctx.graine, 'evenementsSecurite');
  const n = compter(ctx.volumes.evenementsSecurite, [0, 6, 40, 400]);
  return fabriquer(n, (i) => {
    const [titre, detail, source, resultat] = h.choix(EVENEMENTS);
    return { id: cle('es', i, 5), at: new Date(ctx.maintenant - (i === 1 ? h.entier(2, 30) * MIN : (i - 1) * h.entier(5, 90) * MIN)).toISOString(), titre, detail, organisationId: organisations.length && h.chance(0.75) ? h.choix(organisations).id : null, source, resultat };
  }).sort((a, b) => b.at.localeCompare(a.at));
}

export function genererJournalAcces(
  ctx: Contexte,
  equipe: readonly Membre[],
  interlocuteurs: readonly Interlocuteur[],
  factures: readonly { number: string }[],
  secretsNoms: readonly string[],
): EntreeJournalAcces[] {
  const h = hasardDe(ctx.graine, 'journalAcces');
  const n = compter(ctx.volumes.journalAcces, [0, 8, 60, 600]);
  const gens = salaries(equipe);
  const m = moi(equipe);
  const clients = interlocuteurs.filter((i) => i.organisationType === 'client');
  const liste = fabriquer(n, (i): EntreeJournalAcces => {
    const tirage = h.reel();
    const acteurClient = tirage < 0.25 && clients.length ? h.choix(clients) : null;
    const inconnu = tirage > 0.96;
    const membre = h.choix(gens);
    const numero = factures.filter((f) => f.number).length ? h.choix(factures.filter((f) => f.number)).number : 'F-2026-0001';
    const actions: readonly (readonly [string, EntreeJournalAcces['resultat']])[] = acteurClient
      ? [[`A consulté la facture ${numero}`, 'Autorisé'], ['A téléchargé le devis', 'Autorisé']]
      : [[`A ouvert la facture ${numero}`, 'Autorisé'], ['A consulté la fiche d’un client', 'Autorisé'], ['A exporté la liste des clients', 'Autorisé'], [`A modifié le rôle de ${h.choix(gens).prenom}`, 'À revoir'], [`A révélé le secret « ${secretsNoms.length ? h.choix(secretsNoms) : 'Passerelle de paiement'} »`, 'À revoir'], ['A envoyé une relance', 'Autorisé']];
    const [action, resultatBase] = inconnu ? (['A tenté de se connecter', 'Refusé'] as const) : h.choix(actions);
    const resultat = i % 31 === 0 && !inconnu ? 'Refusé' : resultatBase;
    const age = (i === 1 ? h.entier(2, 40) : (i - 1) * h.entier(1, 25)) * MIN;
    const revu = resultat === 'À revoir' && h.chance(0.4);
    return {
      id: cle('ja', i, 5),
      at: new Date(ctx.maintenant - age).toISOString(),
      acteur: inconnu ? { type: 'inconnu', nom: 'Inconnu' } : acteurClient ? { type: 'client', nom: acteurClient.nomComplet } : { type: 'équipe', nom: membre.nomComplet },
      action,
      lieu: inconnu ? 'Étranger' : h.pondere([['Lyon', 6], ['Serveur', 2], ['Nantes', 1], ['Paris', 1]] as const),
      resultat,
      revuParEmail: revu ? m.email : null,
    };
  });
  return liste;
}

/* --------------------------------- Maturité (H34) --------------------------------- */

const CRITERES: Record<DomaineMaturite, readonly (readonly [string, number, number, 'détecté' | 'déclaré'])[]> = {
  Gouvernance: [['Politique de sécurité rédigée', 6, 90, 'déclaré'], ['Rôles et responsabilités définis', 4, 45, 'déclaré'], ['Revue annuelle des risques', 3, 120, 'déclaré']],
  Protection: [['Seconde validation active pour tous les comptes', 6, 30, 'détecté'], ['Mises à jour appliquées sous 30 jours', 5, 60, 'détecté'], ['Accès limités au nécessaire', 4, 60, 'déclaré']],
  Détection: [['Rondes automatiques actives', 5, 20, 'détecté'], ['Alertes relues chaque jour', 4, 15, 'détecté'], ['Journal d’accès conservé un an', 3, 40, 'détecté']],
  Réponse: [['Plan de réponse à incident rédigé', 5, 120, 'déclaré'], ['Contacts d’urgence à jour', 3, 20, 'déclaré'], ['Exercice annuel réalisé', 4, 180, 'déclaré']],
  Récupération: [['Restauration testée chaque trimestre', 6, 60, 'détecté'], ['Copie hors du bureau', 4, 30, 'détecté'], ['Durée de reprise définie', 3, 45, 'déclaré']],
  Sensibilisation: [['Module annuel suivi par l’équipe', 4, 60, 'déclaré'], ['Simulation d’hameçonnage réalisée', 4, 90, 'détecté'], ['Consignes affichées', 2, 15, 'déclaré']],
};

export function genererCriteres(ctx: Contexte): CritereMaturite[] {
  const h = hasardDe(ctx.graine, 'criteres');
  const n = compter(ctx.volumes.criteresMaturite, [0, 6, 18, 30]);
  const tous = (Object.keys(CRITERES) as DomaineMaturite[]).flatMap((domaine) => CRITERES[domaine].map(([libelle, points, dureeMin, source]) => ({ domaine, libelle, points, dureeMin, source })));
  // On garde les n premiers en alternant les domaines : chaque domaine est représenté dès que n >= 6.
  const entrelaces = Array.from({ length: 3 }, (_, k) => (Object.keys(CRITERES) as DomaineMaturite[]).map((d) => tous.filter((c) => c.domaine === d)[k])).flat();
  return entrelaces.slice(0, n).map((c, i) => ({ id: cle('cm', i + 1), ...c, rempli: h.chance(c.source === 'détecté' ? 0.72 : 0.55) }));
}

export const NIVEAUX_MATURITE: readonly (readonly [number, string, number])[] = [[1, 'Initial', 0], [2, 'Structuré', 40], [3, 'Maîtrisé', 75], [4, 'Piloté', 87], [5, 'Optimisé', 95]];

/** Score d'un jeu de critères : points obtenus ÷ points possibles (proposition de H34 : pas une moyenne simple des domaines). */
export function scoreMaturite(criteres: readonly CritereMaturite[]): number {
  const possibles = criteres.reduce((s, c) => s + c.points, 0);
  return possibles === 0 ? 0 : Math.round((criteres.filter((c) => c.rempli).reduce((s, c) => s + c.points, 0) / possibles) * 100);
}

export function niveauMaturite(score: number): { niveau: number; nom: string } {
  const [niveau, nom] = [...NIVEAUX_MATURITE].reverse().find(([, , seuil]) => score >= seuil) ?? NIVEAUX_MATURITE[0];
  return { niveau, nom };
}

/* ------------------------------ Offres de sécurité (MG03) ------------------------------ */

const OFFRES: readonly (readonly [string, string, string, number, string, OffreCyber['positionnement']])[] = [
  ['Supervision continue', 'Supervision', 'Surveillance des sites et alertes, rapport mensuel.', 240, '/ mois', 'Offre phare'],
  ['Audit de sécurité', 'Audit', 'État des lieux et plan de correction.', 950, 'l’audit', 'Ponctuel'],
  ['Atelier de sensibilisation', 'Atelier', 'Une demi-journée avec l’équipe du client.', 480, 'l’atelier', 'Atelier'],
  ['Sauvegarde chiffrée', 'Sauvegarde', 'Copie quotidienne et test de restauration.', 90, '/ mois', 'Complément'],
  ['Veille et alertes', 'Veille', 'Suivi des failles qui touchent les logiciels du client.', 120, '/ mois', 'Complément'],
  ['Plan de réponse à incident', 'Plan', 'Rédaction et exercice annuel.', 1400, 'le plan', 'Premium'],
  ['Conformité RGPD', 'RGPD', 'Registre, politique et suivi.', 180, '/ mois', 'Nouveau'],
  ['Accompagnement dirigeant', 'Conseil', 'Un point mensuel avec la direction.', 300, '/ mois', 'Premium'],
];

export function genererOffres(ctx: Contexte, equipe: readonly Membre[], organisations: readonly OrganisationGarde[]): OffreCyber[] {
  const h = hasardDe(ctx.graine, 'offresCyber');
  const n = compter(ctx.volumes.offresCyber, [0, 2, 6, 8]);
  const resp = salaries(equipe);
  const clientsIds = organisations.map((o) => o.clientId).filter((x): x is number => x !== null);
  return fabriquer(n, (i) => {
    const [nom, court, description, prix, unite, positionnement] = OFFRES[(i - 1) % OFFRES.length];
    return {
      id: cle('of', i),
      nom,
      nomCourt: court,
      description,
      icone: 'shield',
      prixCents: prix * 100,
      unite,
      responsables: h.echantillon(resp, h.entier(1, 2)).map((m) => m.email),
      positionnement,
      creeLe: positionnement === 'Nouveau' ? ajouterJours(ctx.aujourdhui, -h.entier(5, 50)) : ajouterJours(ctx.aujourdhui, -h.entier(100, 700)),
      activations: clientsIds.map((clientId) => ({ clientId, statut: h.pondere([['Actif', 5], ['Proposé', 2], ['Pas encore proposé', 3]] as const) })),
    };
  });
}

