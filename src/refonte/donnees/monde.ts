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
import {
  finaliserClients, genererAchats, genererAvis, genererClients, genererFournisseurs, genererInterlocuteurs, genererProspects,
} from './contacts';
import { genererFidelite, genererRelances } from './derives';
import { genererEntreprise, genererEquipe } from './equipe';
import {
  finaliserProjets, genererEvenements, genererHabitudes, genererNotes, genererProjets, genererRappels, genererTaches, genererTickets,
} from './ma-journee';
import { GRAINE_REFERENCE, jourDe, MAINTENANT_REFERENCE, VOLUMES, type Volume } from './outils';
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
  const comptes = genererComptes(ctx);
  const mouvements = genererMouvements(ctx, comptes, paiements, depenses, abonnements, factures);
  const enveloppes = genererEnveloppes(ctx, equipe, depenses);
  // Le budget mensuel global est la somme des enveloppes (MA06), pas un nombre posé à côté.
  if (enveloppes.length) entreprise.reglages.budgetMensuelDepensesCents = enveloppes.reduce((s, e) => s + e.prevuCents, 0);

  const avis = genererAvis(ctx, clients);
  finaliserClients(clients, { factures, devis, avis, evenements }, ctx.aujourdhui, ctx.maintenant);
  const interlocuteurs = genererInterlocuteurs(ctx, clients, fournisseurs, prospects);
  const relances = genererRelances(ctx, entreprise.reglages, clients, factures, devis, evenements, prospects);
  const fidelite = genererFidelite(ctx, clients, factures);

  return {
    contexte: ctx, entreprise, equipe, taches, evenements, projets, tickets, notes, rappels, habitudes, clients, interlocuteurs, prospects,
    fournisseurs, achats, avis, relances, fidelite, devis, factures, paiements, depenses, abonnements, contrats, comptes, mouvements, enveloppes,
  };
}
