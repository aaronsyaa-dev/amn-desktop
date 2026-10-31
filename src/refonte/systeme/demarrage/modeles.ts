import type { Libelle } from '../../modules/declarer';

/**
 * LES MODÈLES DE MÉTIER (H47) — huit familles, comme DONNÉES.
 * ═══════════════════════════════════════════════════════════
 *
 * Un modèle dit ce qu'une famille de métiers emporte avec elle : les modules qu'elle active (désignés par
 * l'identifiant d'ENTRÉE du registre, `src/refonte/modules/declarations/`), le vocabulaire qui change, trois
 * cartes d'aperçu pour « Votre première journée », et les libellés des étapes 2, 3 et 5 de Démarrage (H42).
 *
 * Rien ici n'est du React, rien n'est une donnée de la personne :
 *   · les cartes d'aperçu sont des EXEMPLES génériques, sans nom propre ni montant, que la page marque comme tels ;
 *   · un identifiant qui n'est pas au registre ne passe pas `check:systeme-demarrage` ;
 *   · l'ordre de `modules` compte : les six premiers se lisent dans la carte de droite, les autres comptent
 *     dans « + N autres modules disponibles à tout moment ».
 *
 * Le poste n'a pas de « modèle de métier » côté serveur : le choix est un réglage PERSONNEL (voir `metier.ts`).
 */

const L = (fr: string, en: string): Libelle => ({ fr, en });

/** Ce que la carte de droite montre : six lignes, jamais plus. */
export const MODULES_AFFICHES = 6;

/** La taille de l'équipe (« Combien êtes-vous ? »). */
export const TAILLES = ['seul', '2-5', '6-20', 'plus'] as const;
export type TailleEquipe = (typeof TAILLES)[number];
/** La valeur de la maquette. */
export const TAILLE_DEFAUT: TailleEquipe = '2-5';

export function estTaille(valeur: unknown): valeur is TailleEquipe {
  return typeof valeur === 'string' && (TAILLES as readonly string[]).includes(valeur);
}

/** Les glyphes de la grille : la page choisit l'icône lucide (ou l'étincelle) qui répond à chaque nom. */
export type IconeModele = 'camion' | 'cube' | 'utilisateurs' | 'eclair' | 'etincelle' | 'maison' | 'calendrier' | 'livre';

/** Ce que le jeu de départ de Démarrage ne sait pas mesurer lui-même se marque à la main. */
export type MesureEtape = 'quotes' | 'tasks' | 'appointments' | 'manuel';

export interface EtapeModele {
  titre: Libelle;
  sous: Libelle;
  action: Libelle;
  /** La destination du bouton (une route de l'application). */
  vers: string;
}

export interface EtapeMesuree extends EtapeModele {
  /** Ce qui rend l'étape « faite » : une collection qui n'est plus vide, ou le marquage à la main. */
  mesure: MesureEtape;
}

/** Les trois étapes qui changent avec le métier : 2 (le premier client), 3 (le premier devis ou son équivalent), 5 (les encaissements). */
export interface EtapesModele {
  client: EtapeModele;
  devis: EtapeMesuree;
  paiement: EtapeModele;
}

export interface CarteApercu {
  etiquette: Libelle;
  /** Le module dont la famille donne sa couleur au point (identifiant d'entrée du registre). */
  module: string;
  titre: Libelle;
  detail: Libelle;
}

export interface ModeleMetier {
  id: string;
  nom: Libelle;
  description: Libelle;
  icone: IconeModele;
  /** Les modules du modèle, désignés par l'identifiant d'ENTRÉE du registre, les plus importants d'abord. */
  modules: readonly string[];
  /** Les noms qui changent : « Clients » devient « Membres » pour une association. Clé : identifiant d'entrée. */
  vocabulaire?: Readonly<Record<string, Libelle>>;
  apercu: readonly [CarteApercu, CarteApercu, CarteApercu];
  etapes: EtapesModele;
}

/** Les trois étapes de la maquette : celles d'un artisan, et le repli quand aucun métier n'est choisi. */
export const ETAPES_PAR_DEFAUT: EtapesModele = {
  client: {
    titre: L('Ajouter votre premier client', 'Add your first client'),
    sous: L('Ou importer un fichier en 1 clic', 'Or import a file in one click'),
    action: L('Ajouter un client', 'Add a client'),
    vers: '/clients',
  },
  devis: {
    titre: L('Créer votre premier devis', 'Create your first quote'),
    sous: L('Ajmani vous guide, 2 minutes', 'Ajmani guides you, 2 minutes'),
    action: L('Créer un devis', 'Create a quote'),
    vers: '/clients',
    mesure: 'quotes',
  },
  paiement: {
    titre: L('Connecter Stripe ou votre banque', 'Connect Stripe or your bank'),
    sous: L('Pour voir vos encaissements', 'To see what you collect'),
    action: L('Connecter', 'Connect'),
    vers: '/facturation',
  },
};

/** « Passer » : le jeu général — l'accueil, ce qu'on fait, ceux qu'on sert, ce qu'on facture, ce qu'on range. */
export const JEU_GENERAL: readonly string[] = ['home', 'tasks', 'agenda', 'clients', 'invoices', 'binder', 'dm'];

export const MODELES: readonly ModeleMetier[] = [
  {
    id: 'artisan',
    nom: L('Artisan du bâtiment', 'Building trades'),
    description: L('Chantiers, devis, stock', 'Sites, quotes, stock'),
    icone: 'camion',
    modules: ['assembly', 'invoices', 'clients', 'stock', 'agenda', 'suppliers', 'esign', 'expenses', 'binder', 'tasks', 'equipment', 'checklists'],
    apercu: [
      { etiquette: L('Chantier', 'Site'), module: 'assembly', titre: L('Chantier du jour', 'Site of the day'), detail: L('Début à 8:00, 2 personnes', 'Starts at 8:00, 2 people') },
      { etiquette: L('Devis', 'Quotes'), module: 'invoices', titre: L('Devis à envoyer', 'Quotes to send'), detail: L('Prêts à partir ce matin', 'Ready to go this morning') },
      { etiquette: L('Stock', 'Stock'), module: 'stock', titre: L('Matériaux à commander', 'Materials to order'), detail: L('Commande conseillée', 'Order recommended') },
    ],
    etapes: ETAPES_PAR_DEFAUT,
  },
  {
    id: 'commerce',
    nom: L('Commerce', 'Retail'),
    description: L('Stock, fournisseurs, avis', 'Stock, suppliers, reviews'),
    icone: 'cube',
    modules: ['stock', 'suppliers', 'reviews', 'loyalty', 'shop', 'clients', 'orders', 'cashCount', 'invoices', 'expenses', 'minisite', 'newsletter'],
    apercu: [
      { etiquette: L('Stock', 'Stock'), module: 'stock', titre: L('Articles sous le seuil', 'Items below the threshold'), detail: L('Réassort conseillé', 'Restock recommended') },
      { etiquette: L('Commandes', 'Orders'), module: 'orders', titre: L('Commandes à préparer', 'Orders to prepare'), detail: L('À expédier aujourd’hui', 'To ship today') },
      { etiquette: L('Avis', 'Reviews'), module: 'reviews', titre: L('Retours clients', 'Customer feedback'), detail: L('À lire ce matin', 'To read this morning') },
    ],
    etapes: {
      ...ETAPES_PAR_DEFAUT,
      devis: {
        titre: L('Préparer votre premier devis', 'Prepare your first quote'),
        sous: L('Pour vos clients professionnels', 'For your business customers'),
        action: L('Créer un devis', 'Create a quote'),
        vers: '/clients',
        mesure: 'quotes',
      },
    },
  },
  {
    id: 'conseil',
    nom: L('Conseil et services', 'Consulting and services'),
    description: L('Clients, missions, factures', 'Clients, assignments, invoices'),
    icone: 'utilisateurs',
    modules: ['clients', 'contracts', 'projects', 'invoices', 'agenda', 'time', 'esign', 'binder', 'tasks', 'notes'],
    apercu: [
      { etiquette: L('Rendez-vous', 'Meetings'), module: 'agenda', titre: L('Rendez-vous client', 'Client meeting'), detail: L('Premier à 9:00', 'First one at 9:00') },
      { etiquette: L('Contrats', 'Contracts'), module: 'contracts', titre: L('Contrats à relire', 'Contracts to review'), detail: L('En attente de signature', 'Waiting for a signature') },
      { etiquette: L('Factures', 'Invoices'), module: 'invoices', titre: L('Factures à envoyer', 'Invoices to send'), detail: L('Relance conseillée', 'Reminder recommended') },
    ],
    etapes: ETAPES_PAR_DEFAUT,
  },
  {
    id: 'startup',
    nom: L('Start-up', 'Start-up'),
    description: L('Tickets, tableau de bord, équipe', 'Tickets, dashboard, team'),
    icone: 'eclair',
    modules: ['projects', 'tasks', 'okr', 'dm', 'meetings', 'weekly', 'extensions', 'automations', 'knowledge', 'decisions'],
    apercu: [
      { etiquette: L('Tâches', 'Tasks'), module: 'tasks', titre: L('Tâches du jour', 'Tasks of the day'), detail: L('À répartir', 'To assign') },
      { etiquette: L('Objectifs', 'Goals'), module: 'okr', titre: L('Objectif du trimestre', 'Goal of the quarter'), detail: L('Point d’étape prévu', 'Check-in planned') },
      { etiquette: L('Équipe', 'Team'), module: 'dm', titre: L('Messages de l’équipe', 'Team messages'), detail: L('À lire en arrivant', 'To read on arrival') },
    ],
    etapes: {
      ...ETAPES_PAR_DEFAUT,
      devis: {
        titre: L('Créer votre première tâche', 'Create your first task'),
        sous: L('Ce qui compte cette semaine', 'What matters this week'),
        action: L('Créer une tâche', 'Create a task'),
        vers: '/tasks',
        mesure: 'tasks',
      },
    },
  },
  {
    id: 'creation',
    nom: L('Création et agence', 'Creative and agency'),
    description: L('Projets, visuels, signatures', 'Projects, visuals, signatures'),
    icone: 'etincelle',
    modules: ['projects', 'adVisuals', 'esign', 'video', 'invoices', 'clients', 'postPlanner', 'minisite', 'binder', 'time'],
    apercu: [
      { etiquette: L('Projet', 'Project'), module: 'projects', titre: L('Projet en cours', 'Project in progress'), detail: L('Prochaine étape cette semaine', 'Next step this week') },
      { etiquette: L('Visuels', 'Visuals'), module: 'adVisuals', titre: L('Visuels à valider', 'Visuals to approve'), detail: L('En attente de retour', 'Waiting for feedback') },
      { etiquette: L('Signature', 'Signature'), module: 'esign', titre: L('Documents à signer', 'Documents to sign'), detail: L('Envoi prévu ce matin', 'Sending planned this morning') },
    ],
    etapes: ETAPES_PAR_DEFAUT,
  },
  {
    id: 'quotidien',
    nom: L('Vie de tous les jours', 'Everyday life'),
    description: L('Courses, budget, rendez-vous', 'Groceries, budget, appointments'),
    icone: 'maison',
    // Budget et Courses sont toujours ouverts : ils ferment la liste, et la page les montre sans interrupteur.
    modules: ['tasks', 'agenda', 'habits', 'binder', 'notes', 'personalGoals', 'pomodoro', 'logbook', 'budget', 'courses'],
    apercu: [
      { etiquette: L('Tâches', 'Tasks'), module: 'tasks', titre: L('Tâches du jour', 'Tasks of the day'), detail: L('Trois à faire d’abord', 'Three to do first') },
      { etiquette: L('Rendez-vous', 'Appointments'), module: 'agenda', titre: L('Rendez-vous de la semaine', 'This week’s appointments'), detail: L('Le prochain est demain', 'The next one is tomorrow') },
      { etiquette: L('Habitudes', 'Habits'), module: 'habits', titre: L('Habitudes du jour', 'Habits of the day'), detail: L('Une série à poursuivre', 'A streak to keep going') },
    ],
    etapes: {
      client: {
        titre: L('Ajouter votre premier contact', 'Add your first contact'),
        sous: L('Ou importer un fichier en 1 clic', 'Or import a file in one click'),
        action: L('Ajouter un contact', 'Add a contact'),
        vers: '/clients',
      },
      devis: {
        titre: L('Ajouter votre première tâche', 'Add your first task'),
        sous: L('Pour ne plus rien oublier', 'So nothing slips your mind'),
        action: L('Ajouter une tâche', 'Add a task'),
        vers: '/tasks',
        mesure: 'tasks',
      },
      paiement: {
        titre: L('Suivre votre budget', 'Follow your budget'),
        sous: L('Pour voir ce qu’il vous reste', 'To see what you have left'),
        action: L('Voir le budget', 'See the budget'),
        vers: '/personnel/budget',
      },
    },
  },
  {
    id: 'sante',
    nom: L('Santé et bien-être', 'Health and wellbeing'),
    description: L('Agenda, dossiers, rappels', 'Calendar, records, reminders'),
    icone: 'calendrier',
    // Droits et accès (`members`) et le Coffre-fort (`vault`) : des données sensibles, donc dans les premières lignes.
    modules: ['agenda', 'clients', 'tasks', 'binder', 'vault', 'members', 'notes', 'invoices', 'forms', 'esign'],
    vocabulaire: { clients: L('Dossiers', 'Records') },
    apercu: [
      { etiquette: L('Rendez-vous', 'Appointments'), module: 'agenda', titre: L('Rendez-vous du jour', 'Appointments of the day'), detail: L('Premier à 9:00', 'First one at 9:00') },
      { etiquette: L('Rappels', 'Reminders'), module: 'tasks', titre: L('Rappels à envoyer', 'Reminders to send'), detail: L('Prévus pour demain', 'Planned for tomorrow') },
      { etiquette: L('Coffre', 'Vault'), module: 'vault', titre: L('Documents protégés', 'Protected documents'), detail: L('Accès réservé à l’équipe', 'Access limited to the team') },
    ],
    etapes: {
      client: {
        titre: L('Ajouter votre premier dossier', 'Add your first record'),
        sous: L('Ou importer un fichier en 1 clic', 'Or import a file in one click'),
        action: L('Ajouter un dossier', 'Add a record'),
        vers: '/clients',
      },
      devis: {
        titre: L('Planifier votre premier rendez-vous', 'Plan your first appointment'),
        sous: L('Les rappels suivent ensuite', 'Reminders follow from there'),
        action: L('Planifier', 'Plan'),
        vers: '/agenda',
        mesure: 'appointments',
      },
      paiement: {
        titre: L('Connecter votre banque', 'Connect your bank'),
        sous: L('Pour voir vos encaissements', 'To see what you collect'),
        action: L('Connecter', 'Connect'),
        vers: '/facturation',
      },
    },
  },
  {
    id: 'association',
    nom: L('Association', 'Non-profit'),
    description: L('Membres, annonces, dons', 'Members, announcements, donations'),
    icone: 'livre',
    modules: ['clients', 'announcements', 'donations', 'binder', 'agenda', 'evenements', 'newsletter', 'forms', 'polls', 'dm'],
    vocabulaire: { clients: L('Membres', 'Members') },
    apercu: [
      { etiquette: L('Annonce', 'Announcement'), module: 'announcements', titre: L('Annonce à diffuser', 'Announcement to publish'), detail: L('Relue par l’équipe d’abord', 'Reviewed by the team first') },
      { etiquette: L('Dons', 'Donations'), module: 'donations', titre: L('Dons reçus', 'Donations received'), detail: L('Remerciements à envoyer', 'Thank-you notes to send') },
      { etiquette: L('Agenda', 'Calendar'), module: 'agenda', titre: L('Prochaine activité', 'Next activity'), detail: L('Rappel prévu cette semaine', 'Reminder planned this week') },
    ],
    etapes: {
      client: {
        titre: L('Ajouter votre premier membre', 'Add your first member'),
        sous: L('Ou importer un fichier en 1 clic', 'Or import a file in one click'),
        action: L('Ajouter un membre', 'Add a member'),
        vers: '/clients',
      },
      devis: {
        titre: L('Annoncer votre première activité', 'Announce your first activity'),
        sous: L('Vos membres sont prévenus', 'Your members are told'),
        action: L('Annoncer', 'Announce'),
        vers: '/annonces',
        mesure: 'manuel',
      },
      paiement: {
        titre: L('Recevoir vos premiers dons', 'Receive your first donations'),
        sous: L('Pour suivre ce qui arrive', 'To follow what comes in'),
        action: L('Voir les dons', 'See donations'),
        vers: '/dons',
      },
    },
  },
];

export function modeleParId(id: string | null | undefined): ModeleMetier | null {
  return MODELES.find((m) => m.id === id) ?? null;
}

/**
 * Ce qu'un modèle montre : tous ses modules, les six premiers (les lignes de la carte de droite), et « + N autres » —
 * le total moins six, jamais écrit à la main. `disponibles` (les entrées que l'organisation a ouvertes) écarte ce qui
 * ne s'ouvrirait pas ; sans lui, tout le modèle compte. N = 0 : « Tous les modules du modèle sont affichés ».
 */
export function composition(modele: ModeleMetier, disponibles?: ReadonlySet<string> | null): { tous: readonly string[]; affiches: readonly string[]; autres: number } {
  const tous = disponibles ? modele.modules.filter((id) => disponibles.has(id)) : modele.modules;
  return { tous, affiches: tous.slice(0, MODULES_AFFICHES), autres: Math.max(0, tous.length - MODULES_AFFICHES) };
}

/** « + N autres modules » d'un modèle entier. */
export function nombreAutres(modele: ModeleMetier): number {
  return composition(modele).autres;
}

/** Les étapes 2, 3 et 5 d'un métier — ou celles de la maquette tant qu'aucun métier n'est choisi. */
export function etapesDuMetier(modele: ModeleMetier | null): EtapesModele {
  return modele?.etapes ?? ETAPES_PAR_DEFAUT;
}

/**
 * La tuile voisine d'une flèche, dans une grille de `colonnes` colonnes (← → d'une tuile, ↑ ↓ d'une rangée ; Début, Fin).
 * Bornée aux extrémités : une flèche qui sortirait de la grille laisse le choix où il est. `null` : la touche ne fait rien.
 */
export function tuileVoisine(index: number, touche: string, colonnes: number, total: number): number | null {
  if (total <= 0 || index < 0 || index >= total) return null;
  const borne = (i: number) => Math.min(total - 1, Math.max(0, i));
  switch (touche) {
    case 'ArrowRight':
      return borne(index + 1);
    case 'ArrowLeft':
      return borne(index - 1);
    case 'ArrowDown':
      return index + colonnes < total ? index + colonnes : index;
    case 'ArrowUp':
      return index - colonnes >= 0 ? index - colonnes : index;
    case 'Home':
      return 0;
    case 'End':
      return total - 1;
    default:
      return null;
  }
}
