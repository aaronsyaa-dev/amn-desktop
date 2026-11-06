/**
 * L'ÉQUIPE ET L'ENTREPRISE D'EXEMPLE
 * ══════════════════════════════════
 *
 * Six personnes inventées autour d'une entreprise inventée (« Maison Vallon »).
 * Les six premières sont écrites à la main, pour que les captures et les tests
 * s'appuient sur des gens stables (la dirigeante est toujours « moi »). Au-delà,
 * le volume « beaucoup » complète au hasard.
 *
 * Le jeu n'est JAMAIS vide : la personne connectée existe toujours. « Vide »
 * veut dire « je travaille seule ».
 */

import { NOMS, PRENOMS } from './fond';
import { ajouterJours, compter, courriel, estOuvre, hasard, initiales, iso, telephone, type Jour } from './outils';
import type { Contexte, Entreprise, Membre, RoleMembre } from './types';

export const DOMAINE_ENTREPRISE = 'maison-vallon.exemple.test';

const FIXES: readonly Omit<Membre, 'id' | 'nomComplet' | 'initiales' | 'email' | 'derniereActiviteAt' | 'congesJours'>[] = [
  { prenom: 'Camille', nom: 'Roux', role: 'Administrateur', fonction: 'Dirigeante', specialites: ['Stratégie', 'Relation client'], statut: 'en ligne', moi: true, teinte: 0, doubleAuthentification: true, heuresSemaine: 35 },
  { prenom: 'Hugo', nom: 'Marchand', role: 'Membre', fonction: 'Commercial', specialites: ['Vente', 'Devis'], statut: 'en ligne', moi: false, teinte: 1, doubleAuthentification: true, heuresSemaine: 35 },
  { prenom: 'Nadia', nom: 'Bensalah', role: 'Administrateur', fonction: 'Comptable', specialites: ['Facturation', 'TVA', 'Paie'], statut: 'hors ligne', moi: false, teinte: 2, doubleAuthentification: true, heuresSemaine: 28 },
  { prenom: 'Léa', nom: 'Dubois', role: 'Membre', fonction: 'Chargée de production', specialites: ['Sites web', 'Contenus'], statut: 'en ligne', moi: false, teinte: 3, doubleAuthentification: false, heuresSemaine: 35 },
  { prenom: 'Yanis', nom: 'Garcia', role: 'Membre', fonction: 'Technicien', specialites: ['Sécurité', 'Maintenance'], statut: 'absent', moi: false, teinte: 4, doubleAuthentification: true, heuresSemaine: 35 },
  { prenom: 'Inès', nom: 'Traoré', role: 'Partenaire', fonction: 'Graphiste partenaire', specialites: ['Identité visuelle'], statut: 'hors ligne', moi: false, teinte: 5, doubleAuthentification: false, heuresSemaine: 14 },
];

const FONCTIONS_GENEREES: readonly (readonly [string, RoleMembre, string[]])[] = [
  ['Assistant administratif', 'Membre', ['Accueil', 'Courrier']],
  ['Chargé de clientèle', 'Membre', ['Relation client']],
  ['Développeuse', 'Membre', ['Sites web']],
  ['Stagiaire', 'Invité', ['Découverte']],
  ['Chef de projet', 'Membre', ['Planning', 'Suivi']],
  ['Rédacteur', 'Membre', ['Contenus']],
];

export function genererEquipe(ctx: Contexte): Membre[] {
  const h = hasard(ctx.graine ^ 0x65717);
  const total = Math.max(1, compter(ctx.volumes.equipe, [1, 2, 6, 24]));
  const maintenant = ctx.maintenant;
  const conges = (i: number): Jour[] => {
    // Quelques membres sont en congé la semaine prochaine (MJ03), jamais la personne connectée.
    if (i === 0 || i % 4 !== 3) return [];
    const lundi = ajouterJours(ctx.aujourdhui, 3);
    return [0, 1, 2].map((n) => ajouterJours(lundi, n)).filter(estOuvre);
  };
  const equipe: Membre[] = [];
  const emails = new Set<string>();
  for (let i = 0; i < total; i += 1) {
    const base = FIXES[i];
    let prenom: string;
    let nom: string;
    let reste: Pick<Membre, 'role' | 'fonction' | 'specialites' | 'statut' | 'moi' | 'teinte' | 'doubleAuthentification' | 'heuresSemaine'>;
    if (base) {
      prenom = base.prenom;
      nom = base.nom;
      reste = base;
    } else {
      do {
        prenom = h.choix(PRENOMS);
        nom = h.choix(NOMS);
      } while (emails.has(courriel(`${prenom} ${nom}`, DOMAINE_ENTREPRISE)));
      const [fonction, role, specialites] = h.choix(FONCTIONS_GENEREES);
      reste = {
        role,
        fonction,
        specialites,
        statut: h.pondere([['en ligne', 4], ['hors ligne', 4], ['absent', 1]] as const),
        moi: false,
        teinte: i % 8,
        doubleAuthentification: h.chance(0.7),
        heuresSemaine: h.pondere([[35, 6], [28, 2], [21, 1], [14, 1]] as const),
      };
    }
    const email = courriel(`${prenom} ${nom}`, DOMAINE_ENTREPRISE);
    emails.add(email);
    // La dernière activité suit le statut : en ligne = il y a quelques minutes, absent = plusieurs jours.
    const ecart = reste.statut === 'en ligne' ? h.entier(0, 12) * 60_000 : reste.statut === 'hors ligne' ? h.entier(3, 20) * 3_600_000 : h.entier(2, 6) * 86_400_000;
    equipe.push({
      id: `m-${String(i + 1).padStart(3, '0')}`,
      prenom,
      nom,
      nomComplet: `${prenom} ${nom}`,
      initiales: initiales(`${prenom} ${nom}`),
      email,
      ...reste,
      derniereActiviteAt: iso(maintenant - ecart),
      congesJours: conges(i),
    });
  }
  return equipe;
}

/** Le membre « connecté » (toujours le premier). */
export const moi = (equipe: readonly Membre[]): Membre => equipe.find((m) => m.moi) ?? equipe[0];

export function genererEntreprise(equipe: readonly Membre[]): Entreprise {
  const astreinte = equipe.find((m) => m.fonction === 'Technicien') ?? moi(equipe);
  return {
    nom: 'Maison Vallon',
    formeJuridique: 'SAS',
    secteur: 'Conseil et création numérique',
    ville: 'Lyon',
    adresse: '18 rue des Aubépines, 69003 Lyon',
    email: `contact@${DOMAINE_ENTREPRISE}`,
    telephone: telephone(hasard(1)),
    siteWeb: `https://www.${DOMAINE_ENTREPRISE}`,
    identite: {
      legalName: 'Maison Vallon SAS',
      address: '18 rue des Aubépines, 69003 Lyon',
      legalForm: 'SAS',
      // Valeurs invalides PAR CONSTRUCTION : un SIREN ne commence jamais par 000, une clé d'IBAN ne vaut jamais 00.
      siret: '000 000 000 00012',
      vatNumber: 'FR00000000000',
      rcsCity: 'Lyon',
      capital: '5 000 €',
      email: `facturation@${DOMAINE_ENTREPRISE}`,
      phone: telephone(hasard(2)),
      iban: 'FR00 0000 0000 0000 0000 0000 000',
      bic: 'EXEMFRP1',
      vatExempt: false,
      paymentTermDays: 30,
      latePenaltyRate: 12,
    },
    reglages: {
      heureFinDeJournee: '18:00',
      objectifProjetsTrimestre: 15,
      objectifSignaturesMois: 8,
      astreinteEmail: astreinte.email,
      tauxTva: [20, 10, 5.5, 0],
      delaiRelanceDevisJours: 5,
      delaiRelanceFactureJours: 3,
      delaiRelanceRendezVousJours: 1,
      delaiRelanceProspectJours: 3,
      budgetMensuelDepensesCents: 1_000_000,
    },
  };
}
