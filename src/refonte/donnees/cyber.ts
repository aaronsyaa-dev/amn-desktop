/**
 * LES JEUX « CYBER » — outils des familles (CY02 à CY11), accords et missions
 * (CY12, CY14), constats, documents (CY13), veille (CY05), conformité (CY09),
 * sensibilisation (CY10), parc (CY03).
 *
 * Interface seulement, et pilotage seulement (05-CYBER-MODELE-COMMUN §1) :
 *   · des NOMS GÉNÉRIQUES d'outils et de fonctions — aucun outil réel ;
 *   · des accords avec périmètre, créneau, dates et condition d'arrêt ;
 *   · des constats réduits à un titre et à une gravité : jamais de détail technique ;
 *   · des compteurs agrégés par équipe ou par client : jamais de nom de personne,
 *     de mot de passe, ni de contenu de fuite ;
 *   · des identifiants de substitution `FICT-AAAA-NNNN`, jamais un vrai.
 * Un outil « Accord requis » est bloqué sans accord valide : `outilDisponible`.
 */

import { cle, cycle, fabriquer, hasardDe, nomClient, salaries } from './commun';
import { ajouterJours, compter, ecartJours, slug, type Jour } from './outils';
import type { Contexte, FicheClient, Membre } from './types';
import type {
  AccordCyber, AlerteVeille, CampagneSensibilisation, ConstatCyber, DocumentCyber, DossierConformite, EtatAccord, FamilleCyber, Fuite,
  LogicielClient, MissionCyber, OutilCyber, ParcSecurite, PhaseMission,
} from './types-suite';

/* ---------------------------------- Accords ---------------------------------- */

/** Valide, Expire bientôt (30 jours ou moins), Expiré, En attente (pas encore signé). */
export function etatAccord(a: Pick<AccordCyber, 'signe' | 'debutLe' | 'finLe'>, aujourdhui: Jour): EtatAccord {
  if (!a.signe) return 'En attente';
  if (a.finLe < aujourdhui) return 'Expiré';
  if (ecartJours(aujourdhui, a.finLe) <= 30) return 'Expire bientôt';
  return 'Valide';
}

/** Un outil « Accord requis » ne se lance qu'avec au moins un accord valide ou qui expire bientôt (jamais un expiré). */
export function outilDisponible(outil: Pick<OutilCyber, 'accord'>, accords: readonly AccordCyber[], aujourdhui: Jour): boolean {
  if (outil.accord !== 'Accord requis') return true;
  return accords.some((a) => ['Valide', 'Expire bientôt'].includes(etatAccord(a, aujourdhui)));
}

export function genererAccords(ctx: Contexte, clients: readonly FicheClient[]): AccordCyber[] {
  const h = hasardDe(ctx.graine, 'accords');
  const n = clients.length ? Math.min(compter(ctx.volumes.accords, [0, 2, 8, 24]), clients.length) : 0;
  const etats = cycle(h, ['Valide', 'Valide', 'Expire bientôt', 'En attente', 'Expiré', 'Valide'] as const, n);
  return h.echantillon(clients, n).map((c, i) => {
    const etat = etats[i];
    const domaine = (() => { try { return c.siteWeb ? new URL(c.siteWeb).hostname.replace(/^www\./, '') : `${slug(nomClient(c))}.exemple.test`; } catch { return `${slug(nomClient(c))}.exemple.test`; } })();
    const duree = h.choix([60, 90, 180]);
    const fin = etat === 'Expiré' ? ajouterJours(ctx.aujourdhui, -h.entier(3, 60)) : etat === 'Expire bientôt' ? ajouterJours(ctx.aujourdhui, h.entier(3, 28)) : ajouterJours(ctx.aujourdhui, h.entier(40, 200));
    return {
      id: cle('ac', i + 1),
      clientId: c.id,
      perimetre: { domaines: [domaine, `app.${domaine}`], locaux: h.chance(0.4) ? [`Locaux de ${c.ville}`] : [] },
      creneau: h.chance(0.7) ? '19 h – 7 h' : null,
      debutLe: etat === 'En attente' ? ajouterJours(ctx.aujourdhui, h.entier(2, 15)) : ajouterJours(fin, -duree),
      finLe: etat === 'En attente' ? ajouterJours(ctx.aujourdhui, h.entier(40, 100)) : fin,
      fichierId: null,
      signe: etat !== 'En attente',
      conditionArret: 'Arrêt immédiat à la demande du client.',
    };
  });
}

/* ---------------------------------- Outils ---------------------------------- */

type ModeleOutil = readonly [string, string, OutilCyber['type'], OutilCyber['accord'], OutilCyber['action']];
const CATALOGUE: Record<Exclude<FamilleCyber, 'Automatisation'>, readonly ModeleOutil[]> = {
  'Red Team': [
    ['Cartographie du périmètre', 'Liste ce qui est dans le périmètre de la mission.', 'Intégré', 'Accord requis', 'Lancer'], ['Revue des configurations', 'Compare une configuration à une liste de bonnes pratiques.', 'Intégré', 'Accord requis', 'Lancer'],
    ['Contrôle des accès exposés', 'Vérifie ce qui est accessible depuis l’extérieur.', 'Connecté', 'Accord requis', 'Vérifier'], ['Simulation de scénario', 'Prépare un scénario d’exercice validé par le client.', 'Intégré', 'Accord requis', 'Préparer'],
    ['Suivi des constats', 'Rassemble les constats d’une mission.', 'Intégré', 'Interne', 'Ouvrir'], ['Préparation du rapport', 'Assemble le rapport de mission.', 'Intégré', 'Interne', 'Préparer'],
  ],
  'Blue Team': [
    ['Inventaire des postes', 'Liste les postes suivis et leur état.', 'Intégré', 'Interne', 'Ouvrir'], ['Suivi des correctifs', 'Compte les correctifs en attente.', 'Intégré', 'Interne', 'Vérifier'],
    ['Vérification des sauvegardes', 'Contrôle que les sauvegardes se restaurent.', 'Intégré', 'Interne', 'Vérifier'], ['Contrôle des accès', 'Repère les comptes sans seconde validation.', 'Intégré', 'Interne', 'Vérifier'],
    ['Durcissement des configurations', 'Applique une liste de réglages recommandés.', 'Intégré', 'Accord requis', 'Appliquer'], ['Journal des modifications', 'Garde la trace des changements faits.', 'Intégré', 'Interne', 'Lire'],
  ],
  SOC: [
    ['Alertes en direct', 'Affiche les alertes à mesure qu’elles arrivent.', 'Intégré', 'Interne', 'Ouvrir'], ['Rondes automatiques', 'Planifie et suit les rondes de contrôle.', 'Intégré', 'Interne', 'Ouvrir'],
    ['Tableau de bord des sites', 'Résume la disponibilité des sites suivis.', 'Intégré', 'Interne', 'Ouvrir'], ['Corrélation d’événements', 'Relie des événements venant de plusieurs sources.', 'Connecté', 'Interne', 'Lire'],
    ['Astreinte', 'Qui est joignable cette nuit.', 'Intégré', 'Interne', 'Ouvrir'], ['Registre des incidents', 'Liste les incidents en cours et passés.', 'Intégré', 'Interne', 'Ouvrir'],
  ],
  Veille: [
    ['Digest du matin', 'Résume les nouveautés qui vous concernent.', 'Intégré', 'Interne', 'Lire'], ['Failles publiées', 'Suit les failles rendues publiques.', 'Intégré', 'Passif', 'Lire'],
    ['Logiciels de vos clients', 'Inventaire des logiciels suivis par client.', 'Intégré', 'Passif', 'Ouvrir'], ['Surveillance des fuites', 'Signale les fuites qui touchent un client.', 'Connecté', 'Passif', 'Vérifier'],
    ['Flux d’actualités', 'Rassemble les sources d’actualité suivies.', 'Intégré', 'Passif', 'Lire'], ['Bulletins des éditeurs', 'Suit les annonces des éditeurs.', 'Intégré', 'Passif', 'Lire'],
  ],
  OSINT: [
    ['Registres publics de l’organisation', 'Lit les registres officiels de l’organisation.', 'Intégré', 'Passif', 'Lancer'], ['Noms de domaine de l’organisation', 'Liste les noms de domaine déclarés.', 'Intégré', 'Passif', 'Lancer'],
    ['Présence publique de l’organisation', 'Recense ce que l’organisation publie.', 'Connecté', 'Passif', 'Lancer'], ['Annuaire des mandataires', 'Mandataires inscrits aux registres publics.', 'Intégré', 'Passif', 'Lire'],
    ['Archives publiques du site', 'Anciennes versions publiques d’un site.', 'Connecté', 'Passif', 'Lire'], ['Rapport de recherche', 'Assemble les résultats d’une mission.', 'Intégré', 'Passif', 'Préparer'],
  ],
  'Sites et vie privée': [
    ['En-têtes de sécurité', 'Lit ce qu’un site annonce à ses visiteurs.', 'Intégré', 'Passif', 'Vérifier'], ['Bandeau de consentement', 'Contrôle l’affichage du consentement.', 'Intégré', 'Passif', 'Vérifier'],
    ['Cookies déposés', 'Liste les cookies déposés avant tout choix.', 'Intégré', 'Passif', 'Vérifier'], ['Politique de confidentialité', 'Vérifie la présence et la date de la page.', 'Intégré', 'Passif', 'Vérifier'],
    ['Certificat et chiffrement', 'Contrôle la validité du certificat.', 'Intégré', 'Passif', 'Vérifier'], ['Disponibilité', 'Suit le temps de disponibilité.', 'Intégré', 'Passif', 'Ouvrir'],
  ],
  'Réponse à incident': [
    ['Fiche d’incident', 'Ouvre ou complète la fiche d’un incident.', 'Intégré', 'Interne', 'Ouvrir'], ['Chronologie', 'Tient la chronologie des faits.', 'Intégré', 'Interne', 'Ouvrir'],
    ['Notification à la CNIL', 'Prépare le modèle de notification.', 'Intégré', 'Interne', 'Préparer'], ['Rapport post-incident', 'Rédige le compte rendu final.', 'Intégré', 'Interne', 'Préparer'],
    ['Isolation d’un service', 'Coupe un service sur demande du client.', 'Intégré', 'Accord requis', 'Appliquer'], ['Collecte de preuves', 'Conserve les éléments utiles à l’enquête.', 'Intégré', 'Accord requis', 'Lancer'],
  ],
  Conformité: [
    ['Registre des traitements', 'Liste les traitements de données du client.', 'Intégré', 'Interne', 'Ouvrir'], ['Checklist RGPD', 'Points essentiels à vérifier.', 'Intégré', 'Interne', 'Ouvrir'],
    ['Durées de conservation', 'Définit combien de temps garder chaque donnée.', 'Intégré', 'Interne', 'Ouvrir'], ['Droits des personnes', 'Suit les demandes d’accès et d’effacement.', 'Intégré', 'Interne', 'Ouvrir'],
    ['Sous-traitants', 'Liste les sous-traitants et leurs contrats.', 'Intégré', 'Interne', 'Ouvrir'], ['Rapport de conformité', 'Assemble le rapport pour un client.', 'Intégré', 'Interne', 'Préparer'],
  ],
  Sensibilisation: [
    ['Simulation de phishing', 'Envoie un faux message d’entraînement à une équipe.', 'Intégré', 'Accord requis', 'Préparer'], ['Bouton de signalement', 'Permet de signaler un message suspect.', 'Connecté', 'Accord requis', 'Appliquer'],
    ['Quiz et modules', 'Quiz courts et modules de formation.', 'Intégré', 'Interne', 'Ouvrir'], ['Scores par équipe', 'Résultats agrégés par équipe.', 'Intégré', 'Interne', 'Lire'],
    ['Affiches et consignes', 'Supports à afficher dans les locaux.', 'Intégré', 'Interne', 'Ouvrir'], ['Calendrier de campagnes', 'Planifie les campagnes de l’année.', 'Intégré', 'Interne', 'Ouvrir'],
  ],
};

export function genererOutilsCyber(ctx: Contexte): OutilCyber[] {
  const h = hasardDe(ctx.graine, 'outilsCyber');
  const n = compter(ctx.volumes.outilsCyber, [0, 9, 54, 54]);
  const familles = Object.keys(CATALOGUE) as Exclude<FamilleCyber, 'Automatisation'>[];
  // Rang par rang : un outil de chaque famille d'abord, donc « peu » (9) en montre une de chaque.
  const entrelaces = Array.from({ length: 6 }, (_, k) => familles.map((f) => ({ f, m: CATALOGUE[f][k] }))).flat();
  return entrelaces.slice(0, n).map(({ f, m }, i) => ({
    id: cle('oc', i + 1),
    famille: f,
    nom: m[0],
    description: m[1],
    type: m[2],
    accord: m[3],
    dernierUsageAt: h.chance(0.82) ? new Date(ctx.maintenant - h.entier(1, 60 * 24 * 40) * 60_000).toISOString() : null,
    action: m[4],
    actif: h.chance(0.7),
  })).sort((a, b) => a.famille.localeCompare(b.famille) || a.id.localeCompare(b.id));
}

/* ---------------------------------- Missions ---------------------------------- */

const TYPES_MISSION: readonly (readonly [string, Exclude<FamilleCyber, 'Automatisation'>])[] = [
  ['Audit de sécurité', 'Red Team'], ['Veille mensuelle', 'Veille'], ['Sensibilisation des équipes', 'Sensibilisation'], ['Évaluation de configuration', 'Blue Team'],
  ['Suivi de conformité', 'Conformité'], ['Réponse à un incident', 'Réponse à incident'], ['Recherche sur l’organisation', 'OSINT'], ['Supervision', 'SOC'],
];
const PHASES: readonly PhaseMission[] = ['Accord', 'Reconnaissance', 'Tests', 'Constats', 'Rapport'];

export function genererMissions(ctx: Contexte, equipe: readonly Membre[], clients: readonly FicheClient[], accords: readonly AccordCyber[]): MissionCyber[] {
  const h = hasardDe(ctx.graine, 'missions');
  const n = clients.length ? compter(ctx.volumes.missions, [0, 3, 10, 40]) : 0;
  const gens = salaries(equipe);
  const etats = cycle(h, ['En cours', 'En cours', 'À préparer', 'Terminée', 'En cours', 'Terminée'] as const, n);
  const signes = accords.filter((a) => a.signe);
  const enAttente = accords.filter((a) => !a.signe);
  let premiereEnCours = true;
  return fabriquer(n, (i) => {
    const etat = etats[i - 1];
    // Une mission en cours peut attendre la signature de son accord (le cas de CY12) — la première seulement ; une mission terminée a un accord signé.
    let accord: AccordCyber | null = null;
    if (etat === 'En cours' && premiereEnCours && enAttente.length) { accord = enAttente[0]; premiereEnCours = false; }
    else if (signes.length) accord = signes[(i - 1) % signes.length];
    else if (accords.length) accord = accords[(i - 1) % accords.length];
    const c = accord ? clients.find((x) => x.id === accord.clientId) ?? h.choix(clients) : h.choix(clients);
    const [type, famille] = TYPES_MISSION[(i - 1) % TYPES_MISSION.length];
    const phase: PhaseMission = etat === 'À préparer' ? 'Accord' : etat === 'Terminée' ? 'Rapport' : h.choix(['Reconnaissance', 'Tests', 'Constats'] as const);
    const mensuelle = type === 'Veille mensuelle' || type === 'Supervision';
    const debut = etat === 'À préparer' ? ajouterJours(ctx.aujourdhui, h.entier(2, 20)) : ajouterJours(ctx.aujourdhui, -h.entier(5, 60));
    return {
      id: cle('mi', i),
      nom: `${type} — ${nomClient(c)}`,
      clientId: c.id,
      type,
      famille,
      responsableEmail: h.choix(gens).email,
      accordId: accord?.id ?? null,
      phase,
      debutLe: debut,
      echeanceLe: etat === 'Terminée' ? ajouterJours(debut, h.entier(14, 40)) : ajouterJours(ctx.aujourdhui, h.entier(2, 45)),
      etat,
      mensuelle,
      ticketsIds: [],
    };
  }).sort((a, b) => a.echeanceLe.localeCompare(b.echeanceLe));
}

/** Pour les écrans : les phases dans l'ordre, et l'indice de la phase courante. */
export const PHASES_MISSION = PHASES;

/* ---------------------------------- Constats ---------------------------------- */

const CONSTATS: readonly (readonly [string, ConstatCyber['gravite']])[] = [
  ['Accès d’administration à protéger davantage', 'Critique'], ['Certificat à renouveler', 'Moyenne'], ['Mises à jour de sécurité en retard', 'Moyenne'],
  ['Page de connexion à durcir', 'Moyenne'], ['Informations à retirer d’une page publique', 'Faible'], ['Sauvegarde non testée', 'Moyenne'],
  ['Consignes de sécurité à diffuser', 'Faible'], ['Compte inutilisé à fermer', 'Faible'],
];

export function genererConstats(ctx: Contexte, missions: readonly MissionCyber[]): ConstatCyber[] {
  const h = hasardDe(ctx.graine, 'constats');
  const n = missions.length ? compter(ctx.volumes.constats, [0, 4, 20, 120]) : 0;
  return fabriquer(n, (i) => {
    const m = h.choix(missions.filter((x) => x.etat !== 'À préparer').length ? missions.filter((x) => x.etat !== 'À préparer') : missions);
    const [titre, gravite] = CONSTATS[(i - 1) % CONSTATS.length];
    return { id: cle('ct', i), missionId: m.id, gravite, titre, etat: h.chance(m.etat === 'Terminée' ? 0.7 : 0.3) ? ('corrigé' as const) : ('ouvert' as const), creeLe: ajouterJours(m.debutLe, h.entier(1, 25)) };
  }).filter((c) => c.creeLe <= ctx.aujourdhui);
}

/* --------------------------------- Documents (CY13) --------------------------------- */

export function genererDocumentsCyber(
  ctx: Contexte,
  equipe: readonly Membre[],
  missions: readonly MissionCyber[],
  accords: readonly AccordCyber[],
  clients: readonly FicheClient[],
): DocumentCyber[] {
  const h = hasardDe(ctx.graine, 'documentsCyber');
  const n = compter(ctx.volumes.documentsCyber, [0, 5, 40, 120]);
  const gens = salaries(equipe);
  const familles: FamilleCyber[] = ['Red Team', 'Blue Team', 'SOC', 'Veille', 'OSINT', 'Sites et vie privée', 'Réponse à incident', 'Conformité', 'Sensibilisation', 'Automatisation'];
  const liste: DocumentCyber[] = [];
  // Un document « Accord » par accord : même nombre, et sa signature dit celle de l'accord.
  for (const a of accords.slice(0, n)) {
    const c = clients.find((x) => x.id === a.clientId);
    const m = missions.find((x) => x.accordId === a.id) ?? null;
    liste.push({ id: cle('dc', liste.length + 1), titre: `Accord — ${c ? nomClient(c) : 'client'}`, type: 'Accord', famille: m?.famille ?? 'Red Team', missionId: m?.id ?? null, clientId: a.clientId, modifieLe: [ajouterJours(a.debutLe, -h.entier(1, 10)), ctx.aujourdhui].sort()[0], auteurEmail: h.choix(gens).email, version: h.entier(1, 3), signature: a.signe ? 'Signé' : 'À signer', relu: true, archive: false });
  }
  const types: readonly DocumentCyber['type'][] = ['Rapport', 'Procédure', 'Modèle', 'Preuve', 'Script', 'Autre'];
  while (liste.length < n) {
    const type = h.choix(types);
    const m = type === 'Procédure' || type === 'Modèle' ? null : missions.length && h.chance(0.8) ? h.choix(missions) : null;
    liste.push({
      id: cle('dc', liste.length + 1),
      titre: m ? `${type} — ${m.nom}` : `${type} : ${h.choix(['sauvegarde', 'réponse à incident', 'revue mensuelle', 'accueil d’un nouveau client', 'classement des preuves'])}`,
      type,
      famille: m?.famille ?? h.choix(familles),
      missionId: m?.id ?? null,
      clientId: m?.clientId ?? null,
      modifieLe: ajouterJours(ctx.aujourdhui, -h.entier(0, 120)),
      auteurEmail: h.choix(gens).email,
      version: h.entier(1, 6),
      signature: null,
      relu: h.chance(0.7),
      archive: h.chance(0.05),
    });
  }
  return liste.sort((a, b) => b.modifieLe.localeCompare(a.modifieLe));
}

/* -------------------------------------- Veille -------------------------------------- */

const LOGICIELS = ['Gestionnaire de contenu du site', 'Logiciel de caisse', 'Messagerie hébergée', 'Système des postes de travail', 'Extension de paiement', 'Outil de réservation'];

export function genererLogiciels(ctx: Contexte, clients: readonly FicheClient[]): LogicielClient[] {
  const h = hasardDe(ctx.graine, 'logiciels');
  const n = clients.length ? compter(ctx.volumes.logicielsClients, [0, 4, 20, 120]) : 0;
  return fabriquer(n, (i) => ({
    id: cle('lg', i), clientId: h.choix(clients).id, nom: LOGICIELS[(i - 1) % LOGICIELS.length], version: `${h.entier(2, 9)}.${h.entier(0, 9)}`,
    correctifDisponible: h.chance(0.35), concerneParVeille: false,
  }));
}

const TITRES_VEILLE: readonly (readonly [string, ConstatCyber['gravite']])[] = [
  ['Mise à jour de sécurité d’un gestionnaire de contenu', 'Critique'], ['Correctif d’une extension de paiement', 'Moyenne'], ['Faille corrigée dans un système de messagerie', 'Moyenne'],
  ['Bulletin d’un éditeur de logiciel de caisse', 'Faible'], ['Correctif d’un outil de réservation', 'Moyenne'], ['Avis sur un système de postes de travail', 'Critique'],
];

export function genererAlertesVeille(ctx: Contexte, logiciels: LogicielClient[]): AlerteVeille[] {
  const h = hasardDe(ctx.graine, 'alertesVeille');
  const n = compter(ctx.volumes.alertesVeille, [0, 3, 12, 40]);
  const liste = fabriquer(n, (i) => {
    const [titre, gravite] = TITRES_VEILLE[(i - 1) % TITRES_VEILLE.length];
    // Publiées aujourd'hui ou récemment ; une partie touche un logiciel de l'inventaire d'un client (« N vous concernent »).
    const concernes = logiciels.length && gravite !== 'Faible' && h.chance(0.4) ? h.echantillon(logiciels, h.entier(1, 2)).map((l) => l.id) : [];
    return { id: cle('av', i), idFictif: `FICT-${ctx.aujourdhui.slice(0, 4)}-${String(200 + i).padStart(4, '0')}`, titre, gravite, publieeLe: i <= Math.ceil(n / 2) ? ctx.aujourdhui : ajouterJours(ctx.aujourdhui, -h.entier(1, 20)), logicielsConcernes: concernes };
  });
  const marques = new Set(liste.flatMap((a) => a.logicielsConcernes));
  for (const l of logiciels) l.concerneParVeille = marques.has(l.id);
  return liste;
}

export function genererFuites(ctx: Contexte, clients: readonly FicheClient[]): Fuite[] {
  const h = hasardDe(ctx.graine, 'fuites');
  const n = clients.length ? compter(ctx.volumes.fuites, [0, 1, 3, 10]) : 0;
  return fabriquer(n, (i) => ({ id: cle('fu', i), clientId: h.choix(clients).id, nature: h.choix(['Adresses de messagerie', 'Domaine'] as const), detecteeLe: ajouterJours(ctx.aujourdhui, -h.entier(0, 40)), etat: i === 1 || h.chance(0.3) ? 'à traiter' : 'traitée' }));
}

/* ------------------------------- Conformité (CY09) ------------------------------- */

const POINTS_RGPD = ['Registre des traitements revu depuis moins de 12 mois', 'Politique de confidentialité publiée', 'Durées de conservation définies', 'Procédure pour les droits des personnes', 'Liste des sous-traitants à jour'];

/** Conforme = 100 % des points essentiels ; Partiel = au moins la moitié ; À traiter sinon. */
export function niveauConformite(d: Pick<DossierConformite, 'points'>): 'Conforme' | 'Partiel' | 'À traiter' {
  const taux = d.points.filter((p) => p.ok).length / Math.max(1, d.points.length);
  return taux === 1 ? 'Conforme' : taux >= 0.5 ? 'Partiel' : 'À traiter';
}

export function genererDossiersConformite(ctx: Contexte, clients: readonly FicheClient[]): DossierConformite[] {
  const h = hasardDe(ctx.graine, 'dossiersConformite');
  const n = clients.length ? Math.min(compter(ctx.volumes.dossiersConformite, [0, 2, 6, 12]), clients.length) : 0;
  const cibles = cycle(h, [5, 4, 2, 3, 5, 1] as const, n);
  return h.echantillon(clients, n).map((c, i) => ({
    id: cle('dg', i + 1), clientId: c.id, referentiel: 'RGPD' as const,
    points: POINTS_RGPD.map((libelle, k) => ({ libelle, ok: k < cibles[i] })),
    registreRevuLe: cibles[i] >= 1 ? ajouterJours(ctx.aujourdhui, -h.entier(10, 400)) : null,
  }));
}

/* --------------------------- Sensibilisation et parc --------------------------- */

const EQUIPES_CLIENT = ['Accueil', 'Administration', 'Atelier', 'Direction', 'Commercial'];

export function genererCampagnes(ctx: Contexte, clients: readonly FicheClient[]): CampagneSensibilisation[] {
  const h = hasardDe(ctx.graine, 'campagnes');
  const n = clients.length ? compter(ctx.volumes.campagnes, [0, 1, 4, 10]) : 0;
  return fabriquer(n, (i) => {
    const c = h.choix(clients);
    const type = h.pondere([['Simulation', 4], ['Quiz', 3], ['Module', 3]] as const);
    const parEquipe = h.echantillon(EQUIPES_CLIENT, h.entier(2, 4)).map((equipe) => { const envoyes = h.entier(3, 18); const cliques = type === 'Simulation' ? h.entier(0, Math.ceil(envoyes / 4)) : 0; return { equipe, envoyes, cliques, signales: type === 'Simulation' ? h.entier(0, envoyes - cliques) : 0 }; });
    const envoyes = parEquipe.reduce((s, e) => s + e.envoyes, 0);
    const cliques = parEquipe.reduce((s, e) => s + e.cliques, 0);
    const signales = parEquipe.reduce((s, e) => s + e.signales, 0);
    const etat = (['Terminée', 'En cours', 'Planifiée'] as const)[i % 3];
    return { id: cle('cs', i), clientId: c.id, titre: `${type === 'Simulation' ? 'Simulation d’hameçonnage' : type === 'Quiz' ? 'Quiz de sécurité' : 'Module : les bons réflexes'} — ${nomClient(c)}`, type, le: etat === 'Planifiée' ? ajouterJours(ctx.aujourdhui, h.entier(3, 30)) : ajouterJours(ctx.aujourdhui, -h.entier(1, 60)), etat, envoyes: etat === 'Planifiée' ? 0 : envoyes, ouverts: etat === 'Planifiée' ? 0 : Math.max(cliques, Math.round(envoyes * 0.7)), cliques: etat === 'Planifiée' ? 0 : cliques, signales: etat === 'Planifiée' ? 0 : signales, parEquipe: etat === 'Planifiée' ? [] : parEquipe };
  });
}

export function genererParcSecurite(ctx: Contexte, clients: readonly FicheClient[]): ParcSecurite[] {
  const h = hasardDe(ctx.graine, 'parcSecurite');
  const n = clients.length ? Math.min(compter(ctx.volumes.parcSecurite, [0, 2, 6, 12]), clients.length) : 0;
  return h.echantillon(clients, n).map((c, i) => {
    const postes = h.entier(3, 40);
    const enAttente = h.entier(0, 5);
    const total = h.entier(1, 3);
    return { id: cle('pc', i + 1), clientId: c.id, postes, postesAJour: Math.max(0, postes - Math.min(postes, enAttente + h.entier(0, 3))), correctifsEnAttente: enAttente, correctifsImportants: Math.min(enAttente, h.entier(0, 2)), sauvegardes: { total, verifiees: Math.max(0, total - h.entier(0, 1)) }, comptesSansDoubleValidation: h.chance(0.5) ? h.entier(1, 4) : 0 };
  });
}
