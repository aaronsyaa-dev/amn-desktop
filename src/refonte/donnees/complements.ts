/**
 * LES ÉCRANS QUI MANQUAIENT AUX LOTS DÉJÀ FAITS — TVA et impôts (MA08), paie
 * (MA11), tarifs et remises (MA12), partenaires (MC05), planning de l'équipe
 * (MJ03), défis d'équipe (L07).
 *
 * Les chiffres viennent du reste du monde : la TVA à reverser d'un mois est la
 * TVA des factures émises moins celle des dépenses du même mois ; les
 * cotisations découlent de la masse salariale ; les ventes d'une prestation sont
 * les lignes de facture de ce nom.
 */

import { PRESTATIONS } from './fond';
import { totauxDeFacture } from './argent';
import { cle, cycle, finDeMois, hasardDe, heure, moisAvant, nomClient, salaries } from './commun';
import { ajouterJours, centimes, compter, ecartJours, estOuvre, jourSemaine, lundiDe, type Jour } from './outils';
import type { Contexte, Depense, Facture, FicheClient, Fournisseur, Membre } from './types';
import type { Bulletin, Creneau, Defi, EcheanceFiscale, Partenaire, Prestation } from './types-suite';

/* -------------------------------- Paie (MA11) -------------------------------- */

const SALAIRES_PAR_FONCTION: Record<string, number> = {
  Dirigeante: 3400, Commercial: 2350, Comptable: 2600, 'Chargée de production': 2200, Technicien: 2250,
};

export function genererBulletins(ctx: Contexte, equipe: readonly Membre[]): Bulletin[] {
  const h = hasardDe(ctx.graine, 'bulletins');
  const mois = compter(ctx.volumes.bulletins, [0, 1, 3, 12]);
  const liste: Bulletin[] = [];
  let k = 0;
  for (let m = mois - 1; m >= 0; m -= 1) {
    const moisCle = moisAvant(ctx.aujourdhui, m);
    const paieLe = finDeMois(`${moisCle}-01`);
    for (const p of salaries(equipe)) {
      k += 1;
      const base = SALAIRES_PAR_FONCTION[p.fonction] ?? h.entier(1800, 2800);
      const temps = p.heuresSemaine < 35;
      const contrat: Bulletin['contrat'] = temps ? 'Temps partiel' : p.fonction === 'Stagiaire' ? 'Apprentissage' : 'CDI';
      const heures = Math.round((p.heuresSemaine * 52) / 12 * 100) / 100;
      // Le mois en cours n'est pas encore payé : un bulletin à valider, d'autres prêts. Les mois passés sont payés.
      const courant = m === 0;
      const etat: Bulletin['etat'] = !courant ? 'Payé' : paieLe < ctx.aujourdhui ? 'Payé' : h.pondere([['À valider', 3], ['Prêt', 6], ['À préparer', 1]] as const);
      liste.push({
        id: cle('bu', k),
        membreEmail: p.email,
        mois: moisCle,
        contrat,
        netCents: centimes(Math.round((base * (temps ? p.heuresSemaine / 35 : 1) * h.choix([0.99, 1, 1, 1.01])) / 10) * 10),
        heures,
        etat,
        paieLe,
        piece: etat === 'À préparer' || etat === 'À valider' ? null : `bulletin-${moisCle}-${p.id}.pdf`,
      });
    }
  }
  return liste.sort((a, b) => b.mois.localeCompare(a.mois) || a.membreEmail.localeCompare(b.membreEmail));
}

/** La masse salariale nette moyenne d'un mois, pour que les prélèvements bancaires « Salaires » s'y recoupent. */
export function netMensuelMoyen(bulletins: readonly Bulletin[]): number | null {
  const parMois = new Map<string, number>();
  for (const b of bulletins) parMois.set(b.mois, (parMois.get(b.mois) ?? 0) + b.netCents);
  const v = [...parMois.values()];
  return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null;
}

/* ------------------------ TVA et impôts (MA08) ------------------------ */

export function genererEcheances(ctx: Contexte, factures: readonly Facture[], depenses: readonly Depense[], bulletins: readonly Bulletin[]): EcheanceFiscale[] {
  const h = hasardDe(ctx.graine, 'echeances');
  const n = compter(ctx.volumes.echeancesFiscales, [0, 3, 9, 24]);
  if (n === 0) return [];
  const candidates: Omit<EcheanceFiscale, 'id' | 'preparation' | 'paiement' | 'payeLe' | 'pieces'>[] = [];
  const [a0, m0] = ctx.aujourdhui.split('-').map(Number);
  const mois = (decalage: number): { a: number; m: number } => {
    const t = a0 * 12 + (m0 - 1) + decalage;
    return { a: Math.floor(t / 12), m: (t % 12) + 1 };
  };
  const j = (a: number, m: number, d: number): Jour => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const tvaDuMois = (moisCle: string): number => {
    const col = factures.filter((f) => f.status !== 'draft' && f.status !== 'cancelled' && f.issuedAt.startsWith(moisCle)).reduce((s, f) => s + totauxDeFacture(f).tvaCents, 0);
    const ded = depenses.filter((d) => d.spentAt.startsWith(moisCle)).reduce((s, d) => s + d.tvaCents, 0);
    return col - ded;
  };
  const salairesDuMois = (moisCle: string): number => bulletins.filter((b) => b.mois === moisCle).reduce((s, b) => s + b.netCents, 0);
  for (let d = -6; d <= 6; d += 1) {
    const { a, m } = mois(d);
    const precedent = mois(d - 1);
    const clePrec = `${precedent.a}-${String(precedent.m).padStart(2, '0')}`;
    candidates.push({ intitule: `TVA de ${nomDuMois(precedent.m)}`, famille: 'TVA', mode: 'Déclaration en ligne', echeanceLe: j(a, m, 20), montantCents: tvaDuMois(clePrec) });
    const cotis = Math.round(salairesDuMois(clePrec) * 0.46);
    candidates.push({ intitule: 'Cotisations sociales', famille: 'Cotisations', mode: 'Prélèvement automatique', echeanceLe: j(a, m, 5), montantCents: cotis > 0 ? cotis : null });
    if (m === 12) candidates.push({ intitule: 'Cotisation foncière des entreprises', famille: 'Taxe', mode: 'Déclaration en ligne', echeanceLe: j(a, 12, 15), montantCents: centimes(h.entier(6, 14) * 100) });
    if ([3, 6, 9, 12].includes(m)) candidates.push({ intitule: 'Acompte d’impôt sur les sociétés', famille: 'Impôt sur les sociétés', mode: 'Prélèvement automatique', echeanceLe: j(a, m, 15), montantCents: centimes(h.entier(8, 25) * 100) });
    if (m === 5) candidates.push({ intitule: 'Dépôt des comptes annuels', famille: 'Bilan', mode: 'Avec l’expert-comptable', echeanceLe: j(a, 5, 31), montantCents: null });
  }
  // On garde les plus proches d'aujourd'hui, dans le passé comme dans le futur.
  const proches = candidates.sort((x, y) => Math.abs(ecartJours(ctx.aujourdhui, x.echeanceLe)) - Math.abs(ecartJours(ctx.aujourdhui, y.echeanceLe))).slice(0, n);
  // Un impayé garanti : la plus récente échéance passée reste « à payer » (MA08 montre « En retard »).
  const passees = proches.filter((e) => e.echeanceLe < ctx.aujourdhui).sort((x, y) => y.echeanceLe.localeCompare(x.echeanceLe));
  const enRetard = passees.find((e) => e.montantCents !== null && e.montantCents > 0 && ecartJours(e.echeanceLe, ctx.aujourdhui) <= 30);
  return proches
    .sort((x, y) => x.echeanceLe.localeCompare(y.echeanceLe))
    .map((e, i) => {
      const passee = e.echeanceLe < ctx.aujourdhui;
      const payee = passee && e !== enRetard;
      return {
        ...e,
        id: cle('ec', i + 1),
        preparation: payee ? 'Prête' : ecartJours(ctx.aujourdhui, e.echeanceLe) <= 10 ? h.choix(['En préparation', 'Prête'] as const) : 'À préparer',
        paiement: payee ? 'Payée' : 'À payer',
        payeLe: payee ? ajouterJours(e.echeanceLe, -h.entier(0, 3)) : null,
        pieces: h.entier(0, 4),
      };
    });
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const nomDuMois = (m: number): string => MOIS[m - 1];

/* ---------------------------- Tarifs et remises (MA12) ---------------------------- */

const PRECISIONS: Record<string, string> = {
  'Site vitrine, 5 pages': 'Conception, intégration et mise en ligne',
  'Boutique en ligne, mise en place': 'Catalogue, paiement et livraison',
  'Maintenance mensuelle': 'Mises à jour et sauvegardes',
  'Audit de sécurité': 'Rapport et plan de correction',
  'Supervision annuelle': 'Surveillance et rapport mensuel',
  'Identité visuelle': 'Logo, couleurs et charte',
  'Séance photo produits': 'Une demi-journée de prises de vue',
  'Formation d’équipe, une journée': 'Jusqu’à huit personnes',
  'Pack réseaux sociaux': 'Douze publications par mois',
  'Refonte d’un logo': 'Trois pistes et une déclinaison',
  'Rédaction de contenus': 'Cinq pages rédigées',
  'Hébergement et sauvegardes': 'Site hébergé et copié chaque nuit',
  'Assistance prioritaire': 'Réponse sous quatre heures ouvrées',
  'Campagne de courriels': 'Conception et envoi à la liste',
};

export function genererPrestations(ctx: Contexte, equipe: readonly Membre[], factures: readonly Facture[]): Prestation[] {
  const h = hasardDe(ctx.graine, 'prestations');
  const n = compter(ctx.volumes.prestations, [0, 4, 10, 14]);
  const resp = salaries(equipe);
  const moisCourant = ctx.aujourdhui.slice(0, 7);
  return PRESTATIONS.slice(0, n).map(([nom, prix, rec], i) => {
    const marge = h.choix([0.68, 0.62, 0.55, 0.5, 0.46, 0.75, 0.66]);
    const cout = nom === 'Pack réseaux sociaux' && h.chance(0.3) ? null : centimes(Math.round((prix * (1 - marge)) / 5) * 5);
    const ventes = factures
      .filter((f) => f.status !== 'draft' && f.status !== 'cancelled' && f.issuedAt.startsWith(moisCourant))
      .flatMap((f) => f.lines)
      .filter((l) => l.label === nom)
      .reduce((s, l) => s + l.quantity, 0);
    const ancien = Math.round(centimes(prix) * h.choix([0.9, 0.95]));
    return {
      id: cle('pr', i + 1),
      nom,
      precision: PRECISIONS[nom] ?? '',
      unite: rec === 'mois' ? 'mois' : nom.includes('Formation') ? 'demi-journée' : nom.includes('Assistance') ? 'mois' : 'forfait',
      prixCents: centimes(prix),
      coutCents: cout,
      etat: i === 11 && n > 11 ? 'archivée' : 'active',
      ventesMois: ventes,
      historique: h.chance(0.6) ? [{ le: ajouterJours(ctx.aujourdhui, -h.entier(60, 300)), parEmail: h.choix(resp).email, ancienCents: ancien, nouveauCents: centimes(prix), motif: h.choix(['Hausse des coûts', 'Alignement sur le marché', 'Nouvelle offre']) }] : [],
    };
  });
}

/* ---------------------------- Partenaires (MC05) ---------------------------- */

const PARTENAIRES_AJOUTES: readonly (readonly [string, string, string, Partenaire['categorie']])[] = [
  ['Studio Graphique Hautefeuille', 'Mise en page et illustrations.', 'palette', 'Prestataire'],
  ['Réseau des entrepreneurs de Lyon', 'Rencontres mensuelles et recommandations.', 'users', 'Réseau'],
  ['Cabinet Comptable Delmas', 'Expert-comptable de l’entreprise.', 'calculator', 'Prestataire'],
  ['Cercle des commerçants du centre', 'Apporte des clients locaux.', 'store', 'Apporteur d’affaires'],
  ['Agence de traduction Garance', 'Traductions des contenus clients.', 'languages', 'Prestataire'],
  ['Photographe Mirabel', 'Séances photo pour les clients.', 'camera', 'Prestataire'],
];

export function genererPartenaires(ctx: Contexte, equipe: readonly Membre[], fournisseurs: readonly Fournisseur[]): Partenaire[] {
  const h = hasardDe(ctx.graine, 'partenaires');
  const n = compter(ctx.volumes.partenaires, [0, 3, 8, 20]);
  const resp = salaries(equipe);
  const sources: { nom: string; description: string; icone: string; categorie: Partenaire['categorie']; fournisseurId: string | null }[] = [
    ...PARTENAIRES_AJOUTES.map(([nom, description, icone, categorie]) => ({ nom, description, icone, categorie, fournisseurId: null })),
    ...fournisseurs.map((f) => ({ nom: f.nom, description: `Fournisseur : ${f.categorie.toLowerCase()}.`, icone: 'truck', categorie: 'Fournisseur' as const, fournisseurId: f.id })),
  ];
  return h.melanger(sources).slice(0, n).map((s, i) => {
    const rythme = h.pondere([[1, 4], [2, 3], [4, 2], [null, 2]] as const);
    const attendus = (rythme ?? 1) * 3;
    return {
      id: cle('pa', i + 1),
      nom: s.nom,
      nomCourt: s.nom.split(' ')[0],
      description: s.description,
      icone: s.icone,
      categorie: s.categorie,
      referents: h.echantillon(resp, h.entier(1, Math.min(2, resp.length))).map((m) => m.email),
      statut: h.chance(0.12) ? 'En pause' : 'Actif',
      // Quelques contrats arrivent à échéance : l'état « À renouveler » est automatique à 30 jours (MC05).
      finContratLe: i % 3 === 0 ? ajouterJours(ctx.aujourdhui, h.entier(-5, 55)) : h.chance(0.4) ? ajouterJours(ctx.aujourdhui, h.entier(90, 400)) : null,
      rythmeEchangesParMois: rythme,
      echanges90j: Math.max(0, Math.round(attendus * h.choix([0.3, 0.6, 0.9, 1, 1.2, 1.5]))),
      fournisseurId: s.fournisseurId,
    };
  });
}

/* ------------------------ Planning de l'équipe (MJ03) ------------------------ */

const TYPES_CRENEAUX: readonly (readonly [string, Creneau['categorie'], number])[] = [
  ['Atelier contenus', 'Ma journée', 3], ['Livraison', 'Ma journée', 2], ['Rendez-vous client', 'Clients', 1], ['Chantier chez un client', 'Clients', 4],
  ['Facturation', 'Argent', 2], ['Revue des devis', 'Argent', 1], ['Formation interne', 'Ma journée', 3], ['Permanence téléphone', 'Autre', 2],
];

export function genererCreneaux(ctx: Contexte, equipe: readonly Membre[], clients: readonly FicheClient[]): Creneau[] {
  const h = hasardDe(ctx.graine, 'creneaux');
  const semaines = compter(ctx.volumes.creneaux, [0, 1, 2, 4]);
  if (semaines === 0) return [];
  const gens = salaries(equipe);
  const parSemaine = Math.round(5 * gens.length);
  const liste: Creneau[] = [];
  let k = 0;
  // Dès la semaine en cours : la grille de MJ03 va du lundi au vendredi.
  for (let s = 0; s < semaines; s += 1) {
    const lundi = ajouterJours(lundiDe(ctx.aujourdhui), s * 7);
    for (let i = 0; i < parSemaine; i += 1) {
      k += 1;
      const jour = ajouterJours(lundi, h.entier(0, 4));
      const [titre, categorie, duree] = h.choix(TYPES_CRENEAUX);
      const debut = h.choix([8, 9, 9, 10, 11, 13, 14, 15]);
      const fin = Math.min(18, debut + duree);
      const toute = h.chance(0.08);
      const enConge = (m: Membre) => m.congesJours.includes(jour);
      const personnes = toute ? [] : h.echantillon(gens.filter((m) => !enConge(m)), h.entier(1, Math.min(3, gens.length)));
      if (!toute && personnes.length === 0) continue;
      const c = categorie === 'Clients' && clients.length ? h.choix(clients) : null;
      liste.push({
        id: cle('cr', k, 5),
        title: c && titre !== 'Permanence téléphone' ? `${titre} — ${nomClient(c)}` : titre,
        jour,
        debut: heure(debut, h.choix([0, 0, 30])),
        fin: heure(fin, 0),
        personnes: personnes.map((m) => m.email),
        touteLEquipe: toute,
        categorie,
        lien: c ? { type: 'client', id: String(c.id) } : { type: null, id: null },
        repetition: titre === 'Permanence téléphone' ? 'chaque semaine' : null,
        auteurEmail: h.choix(gens).email,
      });
    }
  }
  return liste.filter((c) => estOuvre(c.jour)).sort((a, b) => a.jour.localeCompare(b.jour) || a.debut.localeCompare(b.debut));
}

/** Pour les écrans : jour de la semaine (1 à 5) d'un créneau. */
export const jourDuCreneau = (c: Pick<Creneau, 'jour'>): number => jourSemaine(c.jour);

/* ------------------------ Défis d'équipe (L07) ------------------------ */

/** Nombre de jours consécutifs, jusqu'à aujourd'hui, sans facture en retard de plus de 3 jours (règle proposée par L07). */
export function joursSansImpaye(factures: readonly Facture[], aujourdhui: Jour): number {
  let jours = 0;
  for (let d = 0; d < 365; d += 1) {
    const jour = ajouterJours(aujourdhui, -d);
    const impaye = factures.some((f) => (f.status === 'issued' || f.status === 'paid') && ajouterJours(f.dueAt, 3) <= jour && (f.paidAt === '' || f.paidAt > jour));
    if (impaye) break;
    jours += 1;
  }
  return jours;
}

export function genererDefis(ctx: Contexte, equipe: readonly Membre[], factures: readonly Facture[], noteMoyenne30j: number | null): Defi[] {
  const h = hasardDe(ctx.graine, 'defis');
  const n = compter(ctx.volumes.defis, [0, 1, 4, 8]);
  const gens = salaries(equipe);
  const modeles: Omit<Defi, 'id' | 'participants' | 'creeParEmail' | 'etat'>[] = [
    { titre: 'Zéro impayé pendant 30 jours', sousLigne: 'Aucune facture en retard de plus de 3 jours.', type: 'Compteur de jours', source: { module: 'Facturation', indicateur: 'Factures en retard' }, debutLe: ajouterJours(ctx.aujourdhui, -12), finLe: null, cible: 30, valeurActuelle: joursSansImpaye(factures, ctx.aujourdhui) },
    { titre: 'Boîte à zéro de l’équipe', sousLigne: 'Chaque message client reçoit une réponse en moins de 4 h.', type: 'Taux de tenue', source: { module: 'Messagerie', indicateur: 'Réponses dans les temps' }, debutLe: lundiDe(ctx.aujourdhui), finLe: ajouterJours(lundiDe(ctx.aujourdhui), 6), cible: 90, valeurActuelle: h.entier(78, 96) },
    { titre: 'Tickets urgents traités en moins de 1 h', sousLigne: 'Du lundi au dimanche.', type: 'Taux de tenue', source: { module: 'Missions et tickets', indicateur: 'Urgents traités à temps' }, debutLe: lundiDe(ctx.aujourdhui), finLe: ajouterJours(lundiDe(ctx.aujourdhui), 6), cible: 85, valeurActuelle: h.entier(70, 98) },
    { titre: 'Note moyenne à 4,5 ou plus', sousLigne: 'Moyenne des avis des 30 derniers jours.', type: 'Seuil', source: { module: 'Retours clients', indicateur: 'Note moyenne' }, debutLe: ajouterJours(ctx.aujourdhui, -30), finLe: null, cible: 4.5, valeurActuelle: noteMoyenne30j ?? 0 },
  ];
  const tous = cycle(h, modeles, n);
  return tous.map((d, i) => ({
    ...d,
    id: cle('df', i + 1),
    participants: h.echantillon(gens, h.entier(2, Math.max(2, gens.length))).map((m) => m.email),
    creeParEmail: gens[0].email,
    etat: d.type === 'Seuil' ? (d.valeurActuelle >= d.cible ? 'Tenu' : 'En cours') : d.type === 'Compteur de jours' && d.valeurActuelle >= d.cible ? 'Tenu' : 'En cours',
  }));
}

