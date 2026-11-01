/**
 * LE FONDS DE NOMS — tout est inventé.
 *
 * Prénoms et noms de famille courants, assemblés au hasard : un nom complet
 * qui ressemble à celui d'une vraie personne est une coïncidence, jamais une
 * source. Les entreprises sont fabriquées « type + mot » (aucune marque, aucune
 * raison sociale vérifiée). Les villes sont de vraies communes (information
 * publique), les rues sont génériques et les numéros de rue sans rapport avec
 * une adresse réelle. Les sociétés « amies » ne portent jamais un nom de
 * fournisseur ou de banque réel.
 */

export const PRENOMS = [
  'Camille', 'Hugo', 'Nadia', 'Léa', 'Inès', 'Lucas', 'Fatou', 'Théo', 'Sarah', 'Yanis', 'Jade', 'Chloé', 'Amine', 'Manon',
  'Noah', 'Aya', 'Gabriel', 'Lina', 'Zoé', 'Rayan', 'Emma', 'Louis', 'Alice', 'Jules', 'Clara', 'Maël', 'Salomé', 'Nolan',
  'Anaïs', 'Karim', 'Océane', 'Mathis', 'Élise', 'Samir', 'Margaux', 'Tom', 'Awa', 'Basile', 'Constance', 'Idriss',
  'Juliette', 'Malo', 'Nora', 'Olivier', 'Pauline', 'Quentin', 'Rose', 'Sacha', 'Thaïs', 'Valentin', 'Wendy', 'Yasmine',
  'Adèle', 'Bastien', 'Cécile', 'Damien', 'Eva', 'Florian', 'Gaëlle', 'Hakim', 'Irène', 'Joachim', 'Katia', 'Léon',
] as const;

export const NOMS = [
  'Roux', 'Marchand', 'Bensalah', 'Dubois', 'Nguyen', 'Lefèvre', 'Garcia', 'Traoré', 'Moreau', 'Rossi', 'Haddad', 'Girard',
  'Costa', 'Fontaine', 'Benali', 'Leroy', 'Marin', 'Diallo', 'Perez', 'Faure', 'Mercier', 'Blanc', 'Guerin', 'Boyer',
  'Garnier', 'Chevalier', 'François', 'Lambert', 'Fournier', 'Morel', 'Rolland', 'Vidal', 'Lopes', 'Barbier', 'Arnaud',
  'Martins', 'Colin', 'Bailly', 'Collet', 'Poirier', 'Renard', 'Schmitt', 'Hamon', 'Gillet', 'Leclerc', 'Pons', 'Maillard',
  'Humbert', 'Dufour', 'Besson', 'Carpentier', 'Meunier', 'Lemaire', 'Perrin', 'Brunet', 'Navarro', 'Couturier', 'Aubry',
  'Delorme', 'Guillot', 'Klein', 'Laurent', 'Masson', 'Noel', 'Olivier', 'Pelletier', 'Rey', 'Sanchez', 'Tessier', 'Weber',
  'Yilmaz', 'Zimmer', 'Baron', 'Charpentier', 'Diaz', 'Esteve', 'Ferreira', 'Gomez', 'Henry', 'Imbert', 'Jacob', 'Lacroix',
] as const;

/** [commune, code postal] — vraies communes, aucune adresse réelle derrière. */
export const VILLES: readonly (readonly [string, string])[] = [
  ['Lyon', '69003'], ['Nantes', '44000'], ['Bordeaux', '33000'], ['Lille', '59000'], ['Toulouse', '31000'], ['Rennes', '35000'],
  ['Strasbourg', '67000'], ['Montpellier', '34000'], ['Grenoble', '38000'], ['Dijon', '21000'], ['Angers', '49000'],
  ['Tours', '37000'], ['Clermont-Ferrand', '63000'], ['Metz', '57000'], ['Rouen', '76000'], ['Nîmes', '30000'],
  ['Annecy', '74000'], ['Perpignan', '66000'], ['Limoges', '87000'], ['Caen', '14000'], ['Orléans', '45000'],
];

export const RUES = [
  'rue des Tilleuls', 'avenue de la Gare', 'place du Marché', 'rue du Moulin', 'boulevard des Lilas', 'impasse des Acacias',
  'rue de la République', 'chemin des Vignes', 'quai des Forges', 'rue Pasteur-Nord', 'allée des Peupliers', 'rue du Lavoir',
];

/**
 * Types d'entreprise clientes : [libellé, secteur, offres que l'entreprise d'exemple leur vend].
 * Le secteur est celui affiché dans H05 et G04.
 */
export const TYPES_ENTREPRISE: readonly (readonly [string, string])[] = [
  ['Boulangerie', 'Alimentation'], ['Garage', 'Automobile'], ['Cabinet', 'Conseil'], ['Studio', 'Création'],
  ['Clinique', 'Santé'], ['Transports', 'Transport'], ['Menuiserie', 'Bâtiment'], ['Épicerie', 'Commerce de détail'],
  ['Imprimerie', 'Artisanat'], ['Domaine', 'Agriculture'], ['Institut', 'Beauté'], ['Agence', 'Immobilier'],
  ['Brasserie', 'Restauration'], ['Atelier', 'Artisanat'], ['Maison', 'Commerce de détail'], ['École', 'Éducation'],
  ['Pharmacie', 'Santé'], ['Librairie', 'Commerce de détail'], ['Fleuriste', 'Commerce de détail'], ['Cave', 'Alimentation'],
];

export const MOTS_ENTREPRISE = [
  'des Tilleuls', 'Verdier', 'du Pont', 'Lumen', 'du Marais', 'Belvédère', 'Corvin', 'Valmont', 'des Aubépines', 'Sorel',
  'Aurore', 'Delmas', 'Beaulieu', 'Ferrand', 'Montfort', 'des Cèdres', 'Vermeil', 'Castel', 'du Levant', 'Rivière',
  'Orsay-Sud', 'des Charmes', 'Lavande', 'Brémond', 'Saint-Aubin', 'du Verger', 'Hautefeuille', 'Mirabel', 'Garance',
  'Tanguy', 'des Étangs', 'Pélissier', 'Clairval', 'Sauvage', 'Bellevue', 'Rochefort', 'du Parvis', 'Fontenelle',
];

/** Prestations vendues par l'entreprise d'exemple : [libellé, prix HT en euros, type de période si récurrent]. */
export const PRESTATIONS: readonly (readonly [string, number, null | 'mois' | 'an'])[] = [
  ['Site vitrine, 5 pages', 1800, null],
  ['Boutique en ligne, mise en place', 3200, null],
  ['Maintenance mensuelle', 120, 'mois'],
  ['Audit de sécurité', 950, null],
  ['Supervision annuelle', 1400, 'an'],
  ['Identité visuelle', 1500, null],
  ['Séance photo produits', 480, null],
  ['Formation d’équipe, une journée', 720, null],
  ['Pack réseaux sociaux', 240, 'mois'],
  ['Refonte d’un logo', 650, null],
  ['Rédaction de contenus', 380, null],
  ['Hébergement et sauvegardes', 45, 'mois'],
  ['Assistance prioritaire', 90, 'mois'],
  ['Campagne de courriels', 560, null],
];

export const ETIQUETTES_TACHES = ['facturation', 'commercial', 'site web', 'sécurité', 'administratif', 'relance', 'compta', 'production', 'équipe', 'formation'] as const;

export const ETIQUETTES_TICKETS = ['Site web', 'Sécurité', 'Facturation', 'Support', 'Production', 'Commercial'] as const;

export const THEMES_AVIS = ['Réactivité', 'Qualité du travail', 'Prix', 'Communication', 'Délais', 'Conseil'] as const;

/** Fournisseurs inventés : [nom, catégorie]. */
export const FOURNISSEURS: readonly (readonly [string, string])[] = [
  ['Papeterie Lemoine', 'Fournitures de bureau'], ['Imprimerie Chevalier', 'Impression'], ['Hébergeur Boréal', 'Hébergement'],
  ['Matériel Audio Sorel', 'Matériel audiovisuel'], ['Transports Valmont', 'Transport'], ['Assurances Delmas', 'Assurance'],
  ['Informatique Castel', 'Informatique'], ['Mobilier Hautefeuille', 'Mobilier'], ['Nettoyage Clairval', 'Entretien'],
  ['Emballages du Levant', 'Emballage'], ['Électricité Brémond', 'Bâtiment'], ['Reprographie Garance', 'Impression'],
  ['Câbles et Réseaux Mirabel', 'Informatique'], ['Boissons Fontenelle', 'Restauration'], ['Logistique Rochefort', 'Transport'],
  ['Outillage Pélissier', 'Outillage'], ['Vêtements de travail Tanguy', 'Équipement'], ['Cartouches Beaulieu', 'Fournitures de bureau'],
];

export const ARTICLES_ACHAT = [
  ['Ramette de papier A4', 4.2], ['Câble réseau 5 m', 6.8], ['Cartouche d’encre noire', 31], ['Carton d’expédition', 1.4],
  ['Écran 24 pouces', 149], ['Clavier sans fil', 39], ['Rouleau d’étiquettes', 9.5], ['Lot de stylos', 7.8],
  ['Dossier suspendu (x25)', 14.5], ['Chargeur universel', 22], ['Casque audio', 59], ['Support d’écran', 28],
] as const;

export const CATEGORIES_DEPENSE: readonly (readonly [string, string])[] = [
  ['fournitures', 'Fournitures'], ['deplacement', 'Déplacement'], ['prestataire', 'Prestataire'], ['materiel', 'Matériel'], ['autre', 'Autre'],
];

/** [libellé, fournisseur, catégorie, montant TTC moyen en euros]. */
export const DEPENSES_TYPES: readonly (readonly [string, string, string, number])[] = [
  ['Ramettes et classeurs', 'Papeterie Lemoine', 'fournitures', 64],
  ['Billets de train, rendez-vous client', 'Rail Régional', 'deplacement', 89],
  ['Impression de cartes de visite', 'Imprimerie Chevalier', 'prestataire', 142],
  ['Écran supplémentaire', 'Informatique Castel', 'materiel', 219],
  ['Déjeuner avec un client', 'Brasserie du Parvis', 'autre', 46],
  ['Carburant, tournée', 'Station Les Étangs', 'deplacement', 72],
  ['Abonnement logiciel de comptabilité', 'Logiciels Mirabel', 'prestataire', 39],
  ['Hébergement du site', 'Hébergeur Boréal', 'prestataire', 18],
  ['Cartouches d’encre', 'Cartouches Beaulieu', 'fournitures', 58],
  ['Assurance professionnelle', 'Assurances Delmas', 'prestataire', 96],
  ['Parking, visite chez un client', 'Parc du Centre', 'deplacement', 12],
  ['Câbles et adaptateurs', 'Câbles et Réseaux Mirabel', 'materiel', 34],
];

/** Fonctions courantes pour les interlocuteurs. */
export const FONCTIONS = ['Gérant', 'Gérante', 'Responsable administratif', 'Comptable', 'Directeur', 'Directrice', 'Chargé d’achats', 'Assistante de direction', 'Responsable communication', 'Chef d’atelier', 'Propriétaire'] as const;

/** Résumé court d'un échange passé, pour l'historique d'un client. */
export const ECHANGES = [
  ['Devis envoyé', 'Proposition envoyée par courriel.'],
  ['Appel de suivi', 'Point rapide sur l’avancement.'],
  ['Facture réglée', 'Règlement reçu par virement.'],
  ['Rendez-vous sur place', 'Visite et prise de mesures.'],
  ['Demande de modification', 'Le client souhaite ajuster un point.'],
  ['Question sur la facture', 'Précisions sur une ligne de facturation.'],
  ['Renouvellement discuté', 'Reconduction du contrat évoquée.'],
  ['Retour positif', 'Le client est satisfait de la livraison.'],
] as const;

export const TEXTES_AVIS_POSITIFS = [
  'Équipe très réactive, le site a été livré dans les temps.',
  'Un accompagnement clair du début à la fin. Je recommande.',
  'Très bon rapport qualité-prix, et des explications simples.',
  'Toujours joignables, même pour une petite question.',
  'Travail soigné, mes clients m’ont déjà fait des compliments.',
  'Sérieux et disponibles. Rien à redire.',
];
export const TEXTES_AVIS_MOYENS = [
  'Bon résultat, mais quelques jours de retard sur la livraison.',
  'Le travail est bien fait ; j’aurais aimé être tenu informé plus souvent.',
  'Correct dans l’ensemble, le prix m’a semblé un peu élevé.',
];
export const TEXTES_AVIS_NEGATIFS = [
  'Délais trop longs et peu de nouvelles pendant le projet.',
  'Le résultat ne correspondait pas tout à fait à ce que nous avions convenu.',
];

export const ICONES_PROJET = ['globe', 'shield', 'camera', 'pen', 'store', 'chart', 'mail', 'wrench'] as const;
