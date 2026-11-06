/**
 * LE MONDE — tous les jeux, construits dans l'ordre où ils dépendent les uns
 * des autres, pour qu'ils se recoupent.
 *
 *   équipe → clients → prospects, fournisseurs → devis → factures → paiements
 *   → projets → tâches → événements → tickets, notes, rappels, habitudes
 *   → abonnements, contrats, dépenses → comptes, mouvements, enveloppes
 *   → avis → (santé des clients) → interlocuteurs → relances, fidélité
 *
 * Chaque jeu a son propre hasard (`graineDe(graine, nom)`) : changer le volume
 * d'un jeu ne déplace pas les tirages des autres.
 */

import { genererAbonnements, genererComptes, genererContrats, genererDepenses, genererDevis, genererEnveloppes, genererFactures, genererMouvements, genererPaiements } from './argent';
import { genererAide, genererAutomatisations, genererConnecteurs, genererCorbeille, genererModelesMetier, genererNotifications, genererOperations, genererRaccourcis, genererSauvegardes, genererSecrets, genererSites, genererTrackers, genererUsagesCalculs } from './boite-outils';
import { genererBulletins, genererCreneaux, genererDefis, genererEcheances, genererPartenaires, genererPrestations, netMensuelMoyen } from './complements';
import { genererAccords, genererAlertesVeille, genererCampagnes, genererConstats, genererDocumentsCyber, genererDossiersConformite, genererFuites, genererLogiciels, genererMissions, genererOutilsCyber, genererParcSecurite } from './cyber';
import { genererAnnonces, genererAppels, genererCanaux, genererConversations, genererCourriels, genererPartages, genererReponsesAuto, genererReunions, genererSalles, genererSondages } from './echanger';
import { genererArchives, genererConnaissances, genererFichiers, genererJournal, genererModeles, genererPages, genererSignatures, genererTextes } from './ecrire';
import { genererActifs, genererAlertes, genererCriteres, genererEvenementsSecurite, genererIncidents, genererJournalAcces, genererOffres, genererOrganisations, genererRondes, genererVulnerabilites, poserEtats } from './garde';
import { genererArticles, genererChantiers, genererCommandes, genererControles, genererDossiersPhotos, genererEquipements, genererEtapesTournee, genererMarque, genererModelesControle, genererPagesPubliques, genererProduits, genererRessources, genererReservations, genererVehicules, genererVideos } from './creer';
import {
  finaliserClients, genererAchats, genererAvis, genererClients, genererFournisseurs, genererInterlocuteurs, genererProspects,
} from './contacts';
import { genererFidelite, genererRelances } from './derives';
import { genererEntreprise, genererEquipe } from './equipe';
import {
  finaliserProjets, genererEvenements, genererHabitudes, genererNotes, genererProjets, genererRappels, genererTaches, genererTickets,
} from './ma-journee';
import { ajouterJours, GRAINE_REFERENCE, jourDe, MAINTENANT_REFERENCE, VOLUMES, type Volume } from './outils';
import { NOMS_DES_JEUX, type Contexte, type Monde, type NomDuJeu } from './types';

export interface OptionsMonde {
  /** Défaut : `GRAINE_REFERENCE`. */
  graine?: number;
  /** « Maintenant » en ms. Défaut : `MAINTENANT_REFERENCE` (vendredi 30 octobre 2026, 10 h 15). */
  maintenant?: number;
  /** Volume de tous les jeux. Défaut : `normal`. */
  volume?: Volume;
  /** Volume particulier de certains jeux (prime sur `volume`). */
  volumes?: Partial<Record<NomDuJeu, Volume>>;
}

export function creerContexte(options: OptionsMonde = {}): Contexte {
  const maintenant = options.maintenant ?? MAINTENANT_REFERENCE;
  const base = options.volume ?? 'normal';
  const volumes = Object.fromEntries(NOMS_DES_JEUX.map((nom) => [nom, options.volumes?.[nom] ?? base])) as Record<NomDuJeu, Volume>;
  for (const v of Object.values(volumes)) if (!VOLUMES.includes(v)) throw new Error(`Volume inconnu : ${String(v)}`);
  return { graine: options.graine ?? GRAINE_REFERENCE, maintenant, aujourdhui: jourDe(maintenant), volumes };
}

export function construireMonde(options: OptionsMonde = {}): Monde {
  const ctx = creerContexte(options);
  const equipe = genererEquipe(ctx);
  const entreprise = genererEntreprise(equipe);
  const clients = genererClients(ctx, equipe);
  const prospects = genererProspects(ctx, equipe);
  const fournisseurs = genererFournisseurs(ctx);
  const achats = genererAchats(ctx, fournisseurs);

  const devis = genererDevis(ctx, clients);
  const factures = genererFactures(ctx, clients, devis, entreprise.identite.paymentTermDays);
  const paiements = genererPaiements(ctx, factures);

  const { projets, cibles } = genererProjets(ctx, equipe, clients);
  const taches = genererTaches(ctx, equipe, clients, projets, cibles);
  finaliserProjets(projets, taches, ctx.aujourdhui);
  const evenements = genererEvenements(ctx, equipe, clients, factures);
  const tickets = genererTickets(ctx, equipe, clients);
  const notes = genererNotes(ctx, equipe, clients, projets, taches);
  const rappels = genererRappels(ctx, equipe, clients, factures);
  const habitudes = genererHabitudes(ctx, equipe);

  const abonnements = genererAbonnements(ctx, clients);
  const contrats = genererContrats(ctx, clients);
  const depenses = genererDepenses(ctx, equipe);
  const bulletins = genererBulletins(ctx, equipe);
  const comptes = genererComptes(ctx);
  const mouvements = genererMouvements(ctx, comptes, paiements, depenses, abonnements, factures, netMensuelMoyen(bulletins));
  const enveloppes = genererEnveloppes(ctx, equipe, depenses);
  // Le budget mensuel global est la somme des enveloppes (MA06), pas un nombre posé à côté.
  if (enveloppes.length) entreprise.reglages.budgetMensuelDepensesCents = enveloppes.reduce((s, e) => s + e.prevuCents, 0);

  const avis = genererAvis(ctx, clients);
  finaliserClients(clients, { factures, devis, avis, evenements }, ctx.aujourdhui, ctx.maintenant);
  const interlocuteurs = genererInterlocuteurs(ctx, clients, fournisseurs, prospects);
  const relances = genererRelances(ctx, entreprise.reglages, clients, factures, devis, evenements, prospects);
  const fidelite = genererFidelite(ctx, clients, factures);

  /* ----------------------------- La suite ----------------------------- */

  // Compléments des lots déjà faits.
  const echeancesFiscales = genererEcheances(ctx, factures, depenses, bulletins);
  const prestations = genererPrestations(ctx, equipe, factures);
  const partenaires = genererPartenaires(ctx, equipe, fournisseurs);
  const creneaux = genererCreneaux(ctx, equipe, clients);
  const depuis30 = ajouterJours(ctx.aujourdhui, -30);
  const notes30 = avis.filter((a) => a.date >= depuis30).map((a) => a.noteSur5);
  const defis = genererDefis(ctx, equipe, factures, notes30.length >= 3 ? Math.round((notes30.reduce((s, x) => s + x, 0) / notes30.length) * 10) / 10 : null);

  // Écrire.
  const fichiers = genererFichiers(ctx, equipe, clients, devis, factures);
  const signatures = genererSignatures(ctx, equipe, clients, interlocuteurs, fichiers);
  const pages = genererPages(ctx, equipe, clients);
  const modeles = genererModeles(ctx, equipe);
  const journal = genererJournal(ctx, equipe, clients);
  const textes = genererTextes(ctx, equipe, interlocuteurs, factures);
  const archives = genererArchives(ctx, equipe, fichiers, factures);
  const connaissances = genererConnaissances(ctx, equipe);

  // Échanger.
  const { conversations, messages } = genererConversations(ctx, equipe, clients, factures);
  const canaux = genererCanaux(ctx, equipe);
  const annonces = genererAnnonces(ctx, equipe);
  const courriels = genererCourriels(ctx, equipe, clients, interlocuteurs, factures);
  const salles = genererSalles(ctx, equipe);
  const appels = genererAppels(ctx, equipe, salles);
  const reunions = genererReunions(ctx, equipe, evenements);
  const partages = genererPartages(ctx, equipe, fichiers, interlocuteurs);
  const sondages = genererSondages(ctx, equipe);
  const reponsesAuto = genererReponsesAuto(ctx);

  // Créer.
  const articles = genererArticles(ctx, fournisseurs);
  const produits = genererProduits(ctx, equipe, articles);
  const commandes = genererCommandes(ctx, equipe, clients, produits);
  const chantiers = genererChantiers(ctx, equipe, clients);
  const dossiersPhotos = genererDossiersPhotos(ctx, equipe, chantiers, clients);
  const marque = genererMarque(ctx);
  const videos = genererVideos(ctx, equipe);
  const pagesPubliques = genererPagesPubliques(ctx, equipe);
  const etapesTournee = genererEtapesTournee(ctx, equipe, clients, commandes);
  const equipements = genererEquipements(ctx, equipe);
  const ressources = genererRessources(ctx);
  const reservations = genererReservations(ctx, equipe, clients, ressources);
  const vehicules = genererVehicules(ctx, equipe);
  const modelesControle = genererModelesControle(ctx);
  const { controles, ecarts } = genererControles(ctx, equipe, modelesControle, chantiers);

  // Outils.
  const corbeille = genererCorbeille(ctx, equipe);
  const aide = genererAide(ctx);
  const secrets = genererSecrets(ctx, equipe);
  const sites = genererSites(ctx, clients);
  const trackers = genererTrackers(ctx, sites);
  const sauvegardes = genererSauvegardes(ctx);
  const operations = genererOperations(ctx, equipe, sauvegardes);
  const raccourcis = genererRaccourcis(ctx);
  const automatisations = genererAutomatisations(ctx, equipe);
  const connecteurs = genererConnecteurs(ctx);
  const notifications = genererNotifications(ctx, equipe, factures, devis, evenements, articles, clients);
  const modelesMetier = genererModelesMetier(ctx);
  const usagesCalculs = genererUsagesCalculs(ctx);

  // La Garde : l'état de chaque organisation se déduit de son score, de ses alertes ouvertes et de sa dernière ronde.
  const { organisations, plans } = genererOrganisations(ctx, clients, sites);
  const actifs = genererActifs(ctx, organisations, clients);
  const alertes = genererAlertes(ctx, equipe, organisations, plans);
  poserEtats(organisations, alertes, ctx.maintenant);
  const incidents = genererIncidents(ctx, equipe, organisations, alertes);
  const vulnerabilites = genererVulnerabilites(ctx, organisations, actifs);
  const rondes = genererRondes(ctx, organisations);
  const evenementsSecurite = genererEvenementsSecurite(ctx, organisations);
  const journalAcces = genererJournalAcces(ctx, equipe, interlocuteurs, factures, secrets.map((x) => x.nom));
  const criteresMaturite = genererCriteres(ctx);
  const offresCyber = genererOffres(ctx, equipe, organisations);

  // Cyber : des outils, des accords, des missions ; rien d'offensif, que du pilotage.
  const outilsCyber = genererOutilsCyber(ctx);
  const accords = genererAccords(ctx, clients);
  const missions = genererMissions(ctx, equipe, clients, accords);
  const constats = genererConstats(ctx, missions);
  const documentsCyber = genererDocumentsCyber(ctx, equipe, missions, accords, clients);
  const logicielsClients = genererLogiciels(ctx, clients);
  const alertesVeille = genererAlertesVeille(ctx, logicielsClients);
  const fuites = genererFuites(ctx, clients);
  const dossiersConformite = genererDossiersConformite(ctx, clients);
  const campagnes = genererCampagnes(ctx, clients);
  const parcSecurite = genererParcSecurite(ctx, clients);

  return {
    contexte: ctx, entreprise, equipe, taches, evenements, projets, tickets, notes, rappels, habitudes, clients, interlocuteurs, prospects,
    fournisseurs, achats, avis, relances, fidelite, devis, factures, paiements, depenses, abonnements, contrats, comptes, mouvements, enveloppes,
    echeancesFiscales, bulletins, prestations, partenaires, creneaux, defis,
    pages, fichiers, signatures, modeles, journal, textes, archives, connaissances,
    conversations, messages, canaux, annonces, courriels, salles, appels, reunions, partages, sondages, reponsesAuto,
    articles, produits, commandes, chantiers, dossiersPhotos, marque, videos, pagesPubliques, etapesTournee, equipements, ressources, reservations,
    vehicules, modelesControle, controles, ecarts,
    corbeille, aide, secrets, sites, trackers, sauvegardes, operations, raccourcis, automatisations, connecteurs, notifications, modelesMetier, usagesCalculs,
    organisations, actifs, alertes, incidents, vulnerabilites, rondes, evenementsSecurite, journalAcces, criteresMaturite, offresCyber,
    outilsCyber, accords, missions, constats, documentsCyber, logicielsClients, alertesVeille, fuites, dossiersConformite, campagnes, parcSecurite,
  };
}
