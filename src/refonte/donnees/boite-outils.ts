/**
 * LES JEUX « OUTILS ET RÉGLAGES » — corbeille (H22), aide (H23), coffre-fort
 * (H24), sites et trackers (MO02), sauvegardes (MO03), import et export (MO04),
 * raccourcis (MO05), automatisations (H20, CY11), connecteurs (H21),
 * notifications (H40), modèles de métier (H47, L04), usage des calculs (MO01).
 *
 * Surfaces sensibles : rien ici n'est un secret. Un secret n'a qu'un nom et des
 * dates ; un connecteur n'a pas de clé ; une sauvegarde n'a ni chemin ni
 * identifiant de stockage, seulement le nom que l'administrateur a donné à son
 * emplacement. Les sites sont en `.exemple.test`.
 */

import { ageRecent, cle, cycle, empreinteCourte, fabriquer, hasardDe, nomClient, quand, salaries } from './commun';
import { moi } from './equipe';
import { ajouterJours, compter, debutDeMois, estOuvre } from './outils';
import type { Contexte, Devis, Evenement, Facture, FicheClient, Membre } from './types';
import type {
  ArticleAide, ArticleStock, Automatisation, Connecteur, CopieSauvegarde, ElementSupprime, ModeleMetier, Notification, OperationImportExport, Raccourci,
  SecretMasque, Site, Tracker, UsageCalcul,
} from './types-suite';
import { quantiteEnStock } from './creer';

/* ---------------------------------- Corbeille ---------------------------------- */

const SUPPRIMES: readonly (readonly [ElementSupprime['type'], string, string, string])[] = [
  ['Page', 'Ancienne procédure d’accueil', 'Pages', 'Équipe'], ['Fichier', 'Devis brouillon (copie).pdf', 'Documents', 'Devis/2026'], ['Tâche', 'Relancer le fournisseur', 'Tâches', 'Mes tâches'],
  ['Note', 'Idées en vrac', 'Notes', 'Personnel'], ['Fiche client', 'Doublon : client ajouté deux fois', 'Clients', 'Tous les clients'], ['Devis', 'Devis erroné', 'Devis', 'Brouillons'],
];

export function genererCorbeille(ctx: Contexte, equipe: readonly Membre[]): ElementSupprime[] {
  const h = hasardDe(ctx.graine, 'corbeille');
  const n = compter(ctx.volumes.corbeille, [0, 3, 12, 80]);
  const gens = salaries(equipe);
  return fabriquer(n, (i) => {
    const [type, nom, module, emplacement] = SUPPRIMES[(i - 1) % SUPPRIMES.length];
    // Conservation de 30 jours : rien ici n'est plus ancien, la purge de nuit l'aurait emporté.
    return { id: cle('co', i), type, nom: i > SUPPRIMES.length ? `${nom} (${i})` : nom, supprimeParEmail: h.choix(gens).email, supprimeAt: new Date(ctx.maintenant - h.entier(1, 28 * 24 * 60) * 60_000).toISOString(), module, emplacement, conservationJours: 30 };
  }).sort((a, b) => b.supprimeAt.localeCompare(a.supprimeAt));
}

/* ------------------------------------- Aide ------------------------------------- */

const AIDE: readonly (readonly [string, ArticleAide['categorie'], number])[] = [
  ['Créer votre première facture', 'Facturation', 3], ['Inviter un collègue', 'Équipe', 2], ['Importer vos clients depuis un tableur', 'Clients', 4],
  ['Activer la double validation', 'Sécurité', 2], ['Installer l’application sur votre téléphone', 'Mobile', 3], ['Comprendre le tableau de bord', 'Démarrer', 3],
  ['Relancer une facture en retard', 'Facturation', 2], ['Lier un rendez-vous à un client', 'Clients', 2], ['Choisir votre métier', 'Démarrer', 2],
  ['Partager un fichier avec un client', 'Clients', 3], ['Restaurer une sauvegarde', 'Sécurité', 4], ['Utiliser Ajmani', 'Démarrer', 3],
  ['Exporter vos données', 'Sécurité', 3], ['Gérer les droits d’accès', 'Équipe', 4], ['Prendre une photo de reçu', 'Mobile', 2], ['Préparer la TVA du mois', 'Facturation', 5],
];

export function genererAide(ctx: Contexte): ArticleAide[] {
  const n = compter(ctx.volumes.aide, [0, 6, 16, 40]);
  return fabriquer(n, (i) => {
    const [titre, categorie, minutes] = AIDE[(i - 1) % AIDE.length];
    return { id: cle('ai', i), titre: i > AIDE.length ? `${titre} (${i})` : titre, categorie, minutesLecture: minutes, contenu: `Ce guide explique, étape par étape, comment « ${titre.toLowerCase()} ». Comptez ${minutes} minutes.` };
  });
}

/* ----------------------------------- Coffre-fort ----------------------------------- */

const SECRETS: readonly (readonly [string, SecretMasque['type']])[] = [
  ['Passerelle de paiement', 'Connecteur'], ['Serveur de sauvegarde', 'Serveur'], ['Registre de noms de domaine', 'Mot de passe'], ['Archive chiffrée des contrats', 'Document chiffré'],
  ['Messagerie du bureau', 'Connecteur'], ['Accès à la banque en lecture', 'Connecteur'], ['Serveur du site vitrine', 'Serveur'], ['Compte de l’expert-comptable', 'Mot de passe'],
];

export function genererSecrets(ctx: Contexte, equipe: readonly Membre[]): SecretMasque[] {
  const h = hasardDe(ctx.graine, 'secrets');
  const n = compter(ctx.volumes.secrets, [0, 3, 8, 30]);
  const resp = salaries(equipe).filter((m) => m.role === 'Administrateur' || m.fonction === 'Technicien');
  return fabriquer(n, (i) => {
    const [nom, type] = SECRETS[(i - 1) % SECRETS.length];
    return {
      id: cle('se', i),
      nom: i > SECRETS.length ? `${nom} (${i})` : nom,
      type,
      responsableEmail: h.choix(resp.length ? resp : salaries(equipe)).email,
      renouveleLe: ajouterJours(ctx.aujourdhui, -h.entier(10, 400)),
      dernierUsageAt: h.chance(0.85) ? new Date(ctx.maintenant - h.entier(10, 20_000) * 60_000).toISOString() : null,
      // La valeur n'existe pas ici : elle reste côté serveur, chiffrée.
      valeur: '••••••••' as const,
    };
  });
}

/* ------------------------------- Sites et trackers ------------------------------- */

export function genererSites(ctx: Contexte, clients: readonly FicheClient[]): Site[] {
  const h = hasardDe(ctx.graine, 'sites');
  const n = compter(ctx.volumes.sites, [0, 2, 6, 24]);
  const liste: Site[] = [];
  const propres: readonly (readonly [string, string, Site['type']])[] = [['www.maison-vallon.exemple.test', 'Site principal', 'équipe'], ['portfolio.maison-vallon.exemple.test', 'Portfolio', 'portfolio']];
  for (const [adresse, libelle, type] of propres) if (liste.length < n) liste.push({ id: cle('si', liste.length + 1), adresse: `https://${adresse}`, libelle, type, clientId: null, frequenceControleMin: 5, tracker: type === 'équipe', etat: 'En ligne', disponibilite30j: 99.99, surveillanceActive: true });
  for (const c of h.melanger(clients)) {
    if (liste.length >= n) break;
    if (!c.siteWeb) continue;
    liste.push({ id: cle('si', liste.length + 1), adresse: c.siteWeb, libelle: `Site de ${nomClient(c)}`, type: 'client', clientId: c.id, frequenceControleMin: h.choix([1, 5, 5, 15]), tracker: h.chance(0.5), etat: 'En ligne', disponibilite30j: Math.round((99.2 + h.reel() * 0.8) * 100) / 100, surveillanceActive: h.chance(0.95) });
  }
  // CY04 et CY07 comptent les sites dégradés ou hors ligne : il y en a, dès que le volume le permet.
  const clientsSites = liste.filter((s) => s.type === 'client');
  if (clientsSites.length >= 3) {
    clientsSites[0].etat = 'Dégradé';
    clientsSites[0].disponibilite30j = 99.1;
  }
  if (clientsSites.length >= 6) {
    clientsSites[1].etat = 'Hors ligne';
    clientsSites[1].disponibilite30j = 98.4;
  }
  return liste;
}

export function genererTrackers(ctx: Contexte, sites: readonly Site[]): Tracker[] {
  const h = hasardDe(ctx.graine, 'trackers');
  const n = compter(ctx.volumes.trackers, [0, 1, 4, 16]);
  const candidats = sites.filter((s) => s.tracker);
  const a = candidats.slice(0, n);
  const etats = cycle(h, ['Actif', 'Actif', 'Aucune donnée depuis 24 h', 'À installer'] as const, a.length);
  return a.map((s, i) => {
    const etat = etats[i];
    return {
      id: cle('tr', i + 1),
      siteId: s.id,
      nom: `Compteur de ${s.libelle.replace('Site de ', '').replace('Site principal', 'visites du site principal')}`,
      visites7j: etat === 'Actif' ? h.entier(40, 4200) : 0,
      derniereVisiteAt: etat === 'Actif' ? new Date(ctx.maintenant - h.entier(1, 90) * 60_000).toISOString() : etat === 'Aucune donnée depuis 24 h' ? new Date(ctx.maintenant - h.entier(26, 90) * 3_600_000).toISOString() : null,
      etat,
    };
  });
}

/* --------------------------------- Sauvegardes --------------------------------- */

export function genererSauvegardes(ctx: Contexte): CopieSauvegarde[] {
  const h = hasardDe(ctx.graine, 'sauvegardes');
  const n = compter(ctx.volumes.sauvegardes, [0, 3, 10, 60]);
  const liste = fabriquer(n, (i): CopieSauvegarde => {
    const jour = ajouterJours(ctx.aujourdhui, -(i - 1));
    const declencheur = i % 7 === 0 ? 'Hebdomadaire' : i === 4 ? 'Manuelle' : i === 6 ? 'Avant import' : 'Automatique';
    const echouee = n >= 10 && i === 5;
    return {
      id: cle('sv', i),
      at: i === 1 ? quand(jour, '03:10') : quand(jour, '03:10'),
      declencheur,
      contenu: declencheur === 'Avant import' ? ['Clients', 'Factures'] : 'Tout',
      tailleOctets: Math.round(h.entier(180, 260) * 1e6 * (1 + (n - i) * 0.002)),
      emplacements: ['Cloud chiffré', 'Disque du bureau'],
      etat: echouee ? 'Échouée' : 'Réussie',
      empreinteCourte: empreinteCourte(h),
    };
  });
  return liste.filter((c) => Date.parse(c.at) <= ctx.maintenant);
}

/* ------------------------------ Import et export ------------------------------ */

export function genererOperations(ctx: Contexte, equipe: readonly Membre[], sauvegardes: readonly CopieSauvegarde[]): OperationImportExport[] {
  const h = hasardDe(ctx.graine, 'operations');
  const n = compter(ctx.volumes.operations, [0, 2, 8, 30]);
  const gens = salaries(equipe);
  const modeles: readonly (readonly [string, OperationImportExport['type'], string])[] = [
    ['Import des clients', 'Import', 'Tableur (.csv)'], ['Export des factures du trimestre', 'Export', 'PDF (.zip)'], ['Import des produits', 'Import', 'Tableur (.csv)'],
    ['Export comptable du mois', 'Export', 'Écritures (.csv)'], ['Export des clients', 'Export', 'Tableur (.csv)'], ['Import des dépenses', 'Import', 'Tableur (.csv)'],
  ];
  return fabriquer(n, (i) => {
    const [nom, type, format] = modeles[(i - 1) % modeles.length];
    const lignes = h.entier(12, 640);
    const erreurs = type === 'Import' && h.chance(0.3) ? h.entier(1, 6) : 0;
    const ignorees = type === 'Import' ? h.entier(0, 8) : 0;
    const fusionnees = type === 'Import' ? h.entier(0, 12) : 0;
    const avantImport = type === 'Import' ? sauvegardes.find((s) => s.declencheur === 'Avant import') : undefined;
    return {
      id: cle('op', i),
      nom,
      type,
      format,
      lignes,
      auteurEmail: h.choix(gens).email,
      at: new Date(ctx.maintenant - (i - 1) * h.entier(1, 5) * 86_400_000 - h.entier(5, 600) * 60_000).toISOString(),
      etat: erreurs > 0 ? 'Terminée avec erreurs' : 'Terminée',
      compteurs: type === 'Import' ? { creees: Math.max(0, lignes - fusionnees - ignorees - erreurs), fusionnees, ignorees, erreurs } : { creees: 0, fusionnees: 0, ignorees: 0, erreurs: 0 },
      copieId: avantImport?.id ?? null,
    };
  });
}

/* --------------------------------- Raccourcis --------------------------------- */

const RACCOURCIS: readonly (readonly [string, string, string | null, string, 'fourni' | 'personnel', number])[] = [
  ['nouvelle-facture', 'Nouvelle facture', '⌘ ⇧ F', 'partout', 'fourni', 20], ['nouveau-client', 'Nouveau client', '⌘ ⇧ C', 'partout', 'fourni', 12],
  ['nouvelle-tache', 'Nouvelle tâche', '⌘ ⇧ T', 'partout', 'fourni', 8], ['rechercher', 'Rechercher', '⌘ K', 'partout', 'fourni', 6],
  ['ajmani', 'Demander à Ajmani', '⌘ J', 'partout', 'fourni', 10], ['nouveau-devis', 'Nouveau devis', '⌘ ⇧ D', 'Argent', 'personnel', 18],
  ['ouvrir-calendrier', 'Ouvrir le calendrier', 'G puis C', 'partout', 'fourni', 5], ['envoyer-relance', 'Envoyer la relance', null, 'Contacts', 'personnel', 14],
  ['marquer-fait', 'Marquer comme fait', 'E', 'Ma journée', 'fourni', 4], ['archiver', 'Archiver', '⌘ ⌫', 'partout', 'fourni', 3],
];

export function genererRaccourcis(ctx: Contexte): Raccourci[] {
  const h = hasardDe(ctx.graine, 'raccourcis');
  const n = compter(ctx.volumes.raccourcis, [0, 4, 16, 40]);
  return fabriquer(n, (i) => {
    const [action, libelle, touches, portee, origine, gain] = RACCOURCIS[(i - 1) % RACCOURCIS.length];
    const variante = i > RACCOURCIS.length;
    return { id: cle('rc', i), action: variante ? `${action}-${i}` : action, libelle: variante ? `${libelle} (${i})` : libelle, touches: variante ? null : touches, portee, origine, actif: !(i % 9 === 0), usages: h.entier(0, 240), epingle: i <= 3, barreRapide: i <= 5, gainSecondes: gain };
  });
}

/* ------------------------------ Automatisations ------------------------------ */

const AUTOMATISATIONS: readonly (readonly [string, string, string, Automatisation['type'], string | null, number])[] = [
  ['Relance de facture à J+3', 'Envoie une relance courtoise quand une facture a trois jours de retard.', 'Facture en retard de 3 jours', 'Déclencheur', null, 4],
  ['Rapport mensuel de supervision', 'Prépare le rapport du mois pour chaque client suivi.', 'Le 1er de chaque mois, 7 h', 'Planifié', 'SOC', 25],
  ['Alerte de certificat à 14 jours', 'Prévient l’équipe quand un certificat expire bientôt.', 'Certificat à moins de 14 jours', 'Déclencheur', 'SOC', 6],
  ['Sauvegarde hebdomadaire', 'Lance et vérifie la sauvegarde complète.', 'Chaque dimanche, 3 h', 'Planifié', 'Blue Team', 3],
  ['Digest du matin', 'Résume les nouveautés suivies par la veille.', 'Chaque jour ouvré, 7 h 30', 'Planifié', 'Veille', 2],
  ['Accusé de réception d’un devis', 'Confirme au client que son devis est bien arrivé.', 'Devis envoyé', 'Déclencheur', null, 2],
  ['Création d’une tâche pour un ticket urgent', 'Ajoute une tâche à la personne d’astreinte.', 'Ticket urgent créé', 'Déclencheur', null, 3],
  ['Bilan de la semaine', 'Prépare le bilan du vendredi.', 'Chaque vendredi, 16 h', 'Planifié', null, 10],
  ['Rappel de justificatifs', 'Relance pour les dépenses à justifier.', 'Le 3 de chaque mois', 'Planifié', null, 5],
  ['Préparation d’un dossier de mission', 'Rassemble les documents d’une mission à la demande.', 'À la demande', 'Script', 'Réponse à incident', 8],
  ['Rapport de conformité trimestriel', 'Compile les points de conformité des clients suivis.', 'Chaque trimestre', 'Planifié', 'Conformité', 30],
  ['Sensibilisation : rappel d’un module', 'Invite les équipes à finir leur module.', 'Chaque lundi, 9 h', 'Planifié', 'Sensibilisation', 4],
];

export function genererAutomatisations(ctx: Contexte, equipe: readonly Membre[]): Automatisation[] {
  const h = hasardDe(ctx.graine, 'automatisations');
  const n = compter(ctx.volumes.automatisations, [0, 3, 12, 30]);
  const gens = salaries(equipe);
  // Neuf actives et trois en pause sur douze (CY11), dès que le volume le permet ; une automatisation créée naît « En pause ».
  const etats = (i: number): Automatisation['etat'] => (i % 12 === 5 || i % 12 === 9 ? 'En pause' : i % 12 === 11 ? 'Brouillon' : 'Active');
  return fabriquer(n, (i) => {
    const [nom, description, declencheur, type, famille, minutes] = AUTOMATISATIONS[(i - 1) % AUTOMATISATIONS.length];
    const etat = etats(i);
    const executions = etat === 'Active' ? h.entier(8, 300) : etat === 'En pause' ? h.entier(0, 60) : 0;
    return {
      id: cle('au', i),
      nom: i > AUTOMATISATIONS.length ? `${nom} (${i})` : nom,
      description,
      declencheur,
      type,
      etat,
      dernierPassageAt: etat === 'Brouillon' ? null : new Date(ctx.maintenant - h.entier(5, 7 * 24 * 60) * 60_000).toISOString(),
      executions,
      executionsMois: etat === 'Active' ? Math.min(executions, h.entier(2, 60)) : 0,
      tempsGagneMinParExecution: minutes,
      familleCyber: famille,
      auteurEmail: h.choix(gens).email,
    };
  });
}

/* ---------------------------------- Connecteurs ---------------------------------- */

const CONNECTEURS: readonly (readonly [string, string, string, string[], number])[] = [
  ['Paiement en ligne', 'Encaisse les règlements par carte et rapproche les factures.', 'card', ['Lire les paiements', 'Créer un lien de paiement'], 3],
  ['Banque', 'Lit les mouvements du compte, sans jamais émettre d’ordre.', 'bank', ['Lecture seule'], 2],
  ['Agenda externe', 'Synchronise les rendez-vous avec un agenda en ligne.', 'calendar', ['Lire et écrire les rendez-vous'], 1],
  ['Courrier', 'Envoie les factures et les relances depuis l’adresse de l’entreprise.', 'mail', ['Envoyer des courriels'], 0],
  ['Stockage en ligne', 'Copie les sauvegardes chiffrées hors du bureau.', 'cloud', ['Écrire des fichiers chiffrés'], 0],
  ['Comptabilité', 'Exporte les écritures vers le logiciel de l’expert-comptable.', 'book', ['Exporter les écritures'], 1],
  ['Signature électronique', 'Envoie les contrats à signer.', 'pen', ['Créer des demandes de signature'], 0],
  ['Messagerie instantanée', 'Relaie les alertes importantes.', 'chat', ['Envoyer des alertes'], 1],
];

export function genererConnecteurs(ctx: Contexte): Connecteur[] {
  const h = hasardDe(ctx.graine, 'connecteurs');
  const n = compter(ctx.volumes.connecteurs, [0, 3, 8, 12]);
  const etats = cycle(h, ['Connecté', 'Connecté', 'Non connecté', 'À renouveler', 'Erreur', 'Connecté'] as const, n);
  return fabriquer(n, (i) => {
    const [nom, description, icone, droits, widgets] = CONNECTEURS[(i - 1) % CONNECTEURS.length];
    const etat = etats[i - 1];
    const connecte = etat !== 'Non connecté';
    return {
      id: cle('cn', i),
      nom: i > CONNECTEURS.length ? `${nom} (${i})` : nom,
      description,
      icone,
      etat,
      derniereSynchroAt: connecte ? new Date(ctx.maintenant - (etat === 'Erreur' ? h.entier(4, 30) * 3_600_000 : h.entier(1, 55) * 60_000)).toISOString() : null,
      droits: connecte ? droits : [],
      cleCreeeLe: connecte ? ajouterJours(ctx.aujourdhui, -(etat === 'À renouveler' ? h.entier(330, 360) : h.entier(10, 250))) : null,
      widgets: connecte ? widgets : 0,
    };
  });
}

/* ---------------------------------- Notifications ---------------------------------- */

export function genererNotifications(
  ctx: Contexte,
  equipe: readonly Membre[],
  factures: readonly Facture[],
  devis: readonly Devis[],
  evenements: readonly Evenement[],
  articles: readonly ArticleStock[],
  clients: readonly FicheClient[],
): Notification[] {
  const h = hasardDe(ctx.graine, 'notifications');
  const n = compter(ctx.volumes.notifications, [0, 5, 30, 300]);
  const m = moi(equipe);
  const retard = factures.filter((f) => f.status === 'issued' && f.dueAt < ctx.aujourdhui);
  const sousSeuil = articles.filter((a) => quantiteEnStock(a) < a.seuilAlerte);
  const acceptes = devis.filter((d) => d.status === 'accepted');
  const aVenir = evenements.filter((e) => !e.systeme && Date.parse(e.startAt) > ctx.maintenant && Date.parse(e.startAt) < ctx.maintenant + 86_400_000);
  const sources: (() => Pick<Notification, 'type' | 'titre' | 'detail' | 'module' | 'urgente'>)[] = [
    () => { const f = retard.length ? h.choix(retard) : null; return { type: 'paiement', titre: f ? `Facture ${f.number} en retard` : 'Un règlement est arrivé', detail: f ? `${f.clientNom} n’a pas encore réglé.` : 'Un virement vient d’être rapproché.', module: 'Facturation', urgente: false }; },
    () => ({ type: 'mention', titre: `${h.choix(equipe).prenom} vous a mentionné`, detail: 'Dans la conversation « Équipe ».', module: 'Messagerie', urgente: false }),
    () => { const e = aVenir.length ? h.choix(aVenir) : null; return { type: 'rendez-vous', titre: e ? `Rendez-vous demain : ${e.title}` : 'Rendez-vous dans 30 minutes', detail: e ? e.clientName : 'Préparez le dossier du client.', module: 'Calendrier', urgente: false }; },
    () => { const d = acceptes.length ? h.choix(acceptes) : null; return { type: 'devis', titre: d ? `Devis ${d.numero} accepté` : 'Un devis a été accepté', detail: d ? d.clientNom : 'Vous pouvez le transformer en facture.', module: 'Devis', urgente: false }; },
    () => { const a = sousSeuil.length ? h.choix(sousSeuil) : null; return { type: 'stock', titre: a ? `Stock bas : ${a.nom}` : 'Un article passe sous le seuil', detail: a ? `Seuil d’alerte : ${a.seuilAlerte}.` : 'Pensez à commander.', module: 'Stock', urgente: false }; },
    () => ({ type: 'sécurité', titre: 'Sauvegarde terminée', detail: 'La copie de cette nuit est vérifiée.', module: 'Sauvegardes', urgente: false }),
    () => ({ type: 'client', titre: `${clients.length ? nomClient(h.choix(clients)) : 'Un client'} vous a écrit`, detail: 'Nouveau message dans sa conversation.', module: 'Messagerie', urgente: false }),
    () => ({ type: 'urgent', titre: 'Ticket urgent : le site d’un client ne s’affiche plus', detail: 'À traiter en priorité.', module: 'Missions et tickets', urgente: true }),
  ];
  const types = cycle(h, sources, n);
  return types.map((s, i) => {
    const base = s();
    const age = i < 4 ? h.entier(5, 240) : ageRecent(h, 25) * 1440 + h.entier(0, 1400);
    const at = ctx.maintenant - age * 60_000;
    const lue = i < 3 ? false : h.chance(0.6);
    return { id: cle('nt', i + 1, 5), ...base, at: new Date(at).toISOString(), lue, reporteJusquAt: !lue && h.chance(0.05) ? new Date(ctx.maintenant + 2 * 3_600_000).toISOString() : null, pourEmail: m.email };
  }).sort((a, b) => b.at.localeCompare(a.at));
}

/* --------------------------------- Modèles de métier --------------------------------- */

const METIERS: readonly (readonly [string, string, string[], string, string[]])[] = [
  ['Artisan du bâtiment', 'Devis · chantiers · stock', ['devis', 'chantiers', 'stock'], 'wrench', ['Clients', 'Devis', 'Facturation', 'Chantiers', 'Photos de chantier', 'Stock', 'Agenda', 'Dépenses']],
  ['Commerce de détail', 'Caisse · stock · fidélité', ['stock', 'commandes', 'fidélité'], 'store', ['Clients', 'Catalogue', 'Stock', 'Commandes', 'Boutique en ligne', 'Fidélité', 'Facturation']],
  ['Restauration', 'Réservations · stock · équipe', ['réservations', 'stock', 'planning'], 'utensils', ['Réservations', 'Stock', 'Planning de l’équipe', 'Fournisseurs', 'Dépenses', 'Qualité']],
  ['Agence créative', 'Projets · devis · temps', ['projets', 'devis', 'temps'], 'pen', ['Clients', 'Projets', 'Devis', 'Facturation', 'Vidéo', 'Visuels et marque', 'Planning de l’équipe']],
  ['Cabinet de conseil', 'Clients · missions · facturation', ['clients', 'missions', 'factures'], 'briefcase', ['Clients', 'Prospects', 'Missions et tickets', 'Devis', 'Facturation', 'Documents', 'Signatures']],
  ['Profession de santé', 'Rendez-vous · dossiers · rappels', ['rendez-vous', 'dossiers', 'rappels'], 'heart', ['Rendez-vous clients', 'Fiches contacts', 'Rappels', 'Documents', 'Facturation']],
  ['Transport et livraison', 'Tournées · flotte · commandes', ['tournées', 'flotte', 'commandes'], 'truck', ['Tournées', 'Flotte de véhicules', 'Commandes', 'Clients', 'Matériel']],
  ['Association', 'Membres · événements · budget', ['membres', 'événements', 'budget'], 'users', ['Contacts', 'Événements', 'Budget', 'Annonces', 'Sondages']],
  ['Agence immobilière', 'Prospects · rendez-vous · contrats', ['prospects', 'rendez-vous', 'contrats'], 'home', ['Prospects', 'Pipeline commercial', 'Rendez-vous clients', 'Contrats', 'Documents', 'Signatures']],
  ['Coiffure et beauté', 'Rendez-vous · stock · fidélité', ['rendez-vous', 'stock', 'fidélité'], 'scissors', ['Rendez-vous clients', 'Stock', 'Fidélité', 'Paiements en ligne', 'Réservations']],
  ['Formation', 'Sessions · inscriptions · signatures', ['sessions', 'inscriptions', 'signatures'], 'book', ['Réservations', 'Clients', 'Signatures', 'Documents', 'Retours clients']],
  ['Garage', 'Réparations · stock · devis', ['devis', 'stock', 'clients'], 'car', ['Clients', 'Devis', 'Stock', 'Flotte de véhicules', 'Facturation', 'Matériel']],
  ['Photographe', 'Séances · galeries · devis', ['séances', 'galeries', 'devis'], 'camera', ['Clients', 'Devis', 'Photos de chantier', 'Visuels et marque', 'Page publique']],
  ['Boulangerie', 'Commandes · stock · tournées', ['commandes', 'stock', 'tournées'], 'bread', ['Commandes', 'Stock', 'Catalogue', 'Tournées', 'Fournisseurs']],
];

export function genererModelesMetier(ctx: Contexte): ModeleMetier[] {
  const n = compter(ctx.volumes.modelesMetier, [0, 4, 14, 24]);
  const sources = n <= METIERS.length ? METIERS : [...METIERS, ...METIERS.map(([nom, d, k, i, mods]) => [`${nom} indépendant`, d, k, i, mods] as const)];
  return sources.slice(0, n).map(([nom, description, motsCles, icone, modules], i) => ({ id: cle('mm', i + 1), nom, description, motsCles, icone, famille: i % 3 === 0 ? 'Services' : i % 3 === 1 ? 'Commerce' : 'Artisanat', modules }));
}

/* ------------------------------- Usage des calculs ------------------------------- */

const CALCULS = ['Marge', 'TVA', 'Remise', 'Prix de revient', 'Seuil de rentabilité', 'Acompte', 'Taux horaire', 'Convertisseur d’unités', 'Pénalités de retard', 'Prix TTC vers HT', 'Rendement', 'Délai de paiement', 'Coût d’un déplacement', 'Surface à peindre', 'Quantité de papier', 'Budget de campagne'];

export function genererUsagesCalculs(ctx: Contexte): UsageCalcul[] {
  const h = hasardDe(ctx.graine, 'usagesCalculs');
  const n = compter(ctx.volumes.usagesCalculs, [0, 3, 8, 16]);
  // Jours ouvrés écoulés du mois en cours, aujourd'hui compris.
  let ouvres = 0;
  for (let j = debutDeMois(ctx.aujourdhui); j <= ctx.aujourdhui; j = ajouterJours(j, 1)) if (estOuvre(j)) ouvres += 1;
  return fabriquer(n, (i) => {
    const jours = h.entier(1, Math.max(1, ouvres));
    return { id: cle('uc', i), calcul: CALCULS[(i - 1) % CALCULS.length], utilisationsMois: jours + h.entier(0, jours * 3), joursUtilises: jours, joursOuvresEcoules: ouvres };
  }).sort((a, b) => b.utilisationsMois - a.utilisationsMois);
}

