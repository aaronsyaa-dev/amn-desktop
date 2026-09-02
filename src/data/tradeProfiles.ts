import {
  Briefcase,
  HardHat,
  PartyPopper,
  ShoppingBag,
  Users,
} from 'lucide-react';
import type React from 'react';

/**
 * LES PROFILS MÉTIER DU GÉNÉRATEUR (BLOC C)
 * ═════════════════════════════════════════
 *
 * De la CONFIGURATION, pas du code — comme les calculateurs, et pour la même
 * raison : le jour où une cliente d'un métier nouveau arrive, on ajoute une
 * entrée dans cette liste, on ne touche pas au générateur.
 *
 * Ce que porte un profil, c'est un POINT DE DÉPART argumenté, jamais un
 * verrou : chaque valeur qu'il propose reste modifiable écran suivant. La
 * différence entre « cocher des cases » et « configurer un espace de travail
 * sur mesure » commence exactement là — on ne part pas d'une page blanche où
 * tout se vaut, on part d'un métier qui a déjà des réponses, et on l'ajuste.
 *
 * Le CALCULATEUR est le lien avec le moteur déjà construit
 * (src/state/calcProfiles.ts) : un profil métier désigne le calcul que ce
 * métier fait tous les jours. Une boutique fixe des prix, un événementiel
 * cherche son point d'équilibre — ce ne sont pas les mêmes gens.
 *
 * L'ACCENT est une PROPOSITION, et le mot est important : la couleur est celle
 * de la cliente, pas la nôtre. Le générateur en propose une cohérente avec son
 * métier pour qu'elle n'ouvre pas une application grise, et elle en change
 * quand elle veut depuis ses propres paramètres. Rien ici ne la fixe.
 */

export interface TradeProfile {
  id: string;
  label: string;
  /** Une phrase : à qui ce profil s'adresse, en clair. */
  pitch: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  /** Les modules ouverts au départ. `home` et `settings` le sont toujours. */
  modules: string[];
  /** Le calculateur que ce métier fait tous les jours (voir calcProfiles.ts). */
  calcProfileId: string;
  /** Accent PROPOSÉ. La cliente en change quand elle veut. */
  suggestedAccent: string;
  /** Nombre de sièges typique — point de départ du curseur. */
  seats: number;
  /** Ce que ce profil met en avant, pour l'aperçu. Trois au plus. */
  highlights: string[];
}

export const TRADE_PROFILES: TradeProfile[] = [
  {
    id: 'boutique',
    label: 'Boutique en ligne',
    pitch:
      'Vend des produits sur un site. Les commandes arrivent seules, les prix se calculent au centime.',
    icon: ShoppingBag,
    // Commandes ET calculateurs : c'est le seul profil où les deux sont
    // quotidiens. Ni temps ni projets — on ne facture pas à l'heure ce qu'on
    // vend à l'unité.
    modules: ['clients', 'invoices', 'orders', 'calculators', 'expenses', 'media', 'tasks'],
    calcProfileId: 'ecommerce-prix-client',
    suggestedAccent: 'ambre',
    seats: 2,
    highlights: ['Commandes du site', 'Prix et marges', 'Stock de visuels'],
  },
  {
    id: 'services',
    label: 'Prestataire de services',
    pitch:
      'Facture du temps et des livrables. Le suivi des heures et des projets porte tout le reste.',
    icon: Briefcase,
    modules: ['clients', 'invoices', 'projects', 'tasks', 'time', 'expenses', 'reports', 'agenda'],
    calcProfileId: 'startup-repartition',
    suggestedAccent: 'azur',
    seats: 3,
    highlights: ['Temps facturable', 'Projets et jalons', 'Comptes-rendus'],
  },
  {
    id: 'evenementiel',
    label: 'Événementiel',
    pitch:
      'Monte des événements. Chaque date est un budget à l’équilibre, et un calendrier qui ne pardonne pas.',
    icon: PartyPopper,
    // « evenements » EN TÊTE, et non ajouté au bout : c'est le module qui
    // porte le métier. Une organisation événementielle qui recevrait tout le
    // reste sans lui aurait un agenda et des dépenses, mais nulle part où
    // lire le nombre d'entrées avant l'équilibre — c'est-à-dire nulle part où
    // décider.
    modules: [
      'evenements',
      'agenda',
      'clients',
      'invoices',
      'projects',
      'expenses',
      'calculators',
      'media',
      'tasks',
    ],
    calcProfileId: 'evenementiel-rentabilite',
    suggestedAccent: 'corail',
    seats: 4,
    highlights: ['Point d’équilibre', 'Calendrier des dates', 'Dépenses par événement'],
  },
  {
    id: 'artisan',
    label: 'Artisan · chantier',
    pitch:
      'Travaille sur site. Les devis, les frais et les photos de chantier comptent plus que les rapports.',
    icon: HardHat,
    // Médias plutôt que Rapports : une photo de chantier est la preuve, pas le
    // compte-rendu. Et Temps, parce qu'un chantier se chiffre en journées.
    modules: ['clients', 'invoices', 'projects', 'expenses', 'time', 'media', 'agenda', 'tasks'],
    calcProfileId: 'startup-repartition',
    suggestedAccent: 'sable',
    seats: 3,
    highlights: ['Devis et factures', 'Frais avec reçus', 'Photos de chantier'],
  },
  {
    id: 'collectif',
    label: 'Collectif · association',
    pitch:
      'Plusieurs personnes, une caisse commune. Ce qui compte est de savoir qui a avancé quoi.',
    icon: Users,
    modules: ['agenda', 'tasks', 'expenses', 'calculators', 'notes', 'media', 'reports'],
    calcProfileId: 'groupe-cagnotte',
    suggestedAccent: 'emeraude',
    seats: 6,
    highlights: ['Cagnotte partagée', 'Qui a avancé quoi', 'Agenda commun'],
  },
];

export function tradeProfileById(id: string): TradeProfile | undefined {
  return TRADE_PROFILES.find((p) => p.id === id);
}

/**
 * Les modules qu'on peut ouvrir ou fermer, avec leur nom d'écran.
 *
 * DOIT rester d'accord avec `ORG_MODULES` d'amn-api : c'est le serveur qui
 * arbitre, et proposer ici un module qu'il refuse produirait une organisation
 * dont la configuration ne correspond à rien. `npm run check:modules` tient
 * cet accord.
 */
export const CONFIGURABLE_MODULES: Array<{ key: string; label: string; hint: string }> = [
  { key: 'agenda', label: 'Agenda', hint: 'Rendez-vous et disponibilités' },
  { key: 'clients', label: 'Clients', hint: 'Fiches et devis' },
  { key: 'invoices', label: 'Facturation', hint: 'Factures et encaissements' },
  { key: 'projects', label: 'Projets', hint: 'Ce qui avance, et ce qui bloque' },
  { key: 'tasks', label: 'Tâches', hint: 'Ce qu’il reste à faire' },
  { key: 'expenses', label: 'Dépenses', hint: 'Frais et justificatifs' },
  { key: 'time', label: 'Temps', hint: 'Chronomètre et temps passé' },
  { key: 'calculators', label: 'Calculateurs', hint: 'Prix, marges, répartition' },
  { key: 'orders', label: 'Commandes', hint: 'Reçues du site public' },
  { key: 'evenements', label: 'Événements', hint: 'Dates, jauge, seuil de rentabilité' },
  { key: 'notes', label: 'Notes', hint: 'Bloc-notes' },
  { key: 'pages', label: 'Pages', hint: 'Fiches et supports partagés' },
  { key: 'media', label: 'Médias', hint: 'Photos et fichiers' },
  { key: 'reports', label: 'Rapports', hint: 'Comptes-rendus' },
  { key: 'vault', label: 'Coffre-fort', hint: 'Mots de passe et accès' },
  { key: 'dm', label: 'Messages privés', hint: 'Écrire à une personne, sans le groupe' },
  { key: 'groups', label: 'Groupes', hint: 'Des fils à plusieurs, par sujet ou par équipe' },
  { key: 'announcements', label: 'Annonces', hint: 'Ce que tout le monde doit avoir lu' },
  { key: 'polls', label: 'Sondages', hint: 'Une question, un vote par personne' },
  { key: 'leaves', label: 'Absences', hint: 'Congés, maladie, télétravail — qui est là' },
  { key: 'directory', label: 'Trombinoscope', hint: 'Les visages, les rôles, qui est là' },
  { key: 'calls', label: 'Appels', hint: 'Appeler un membre, inviter un visiteur par lien' },
  { key: 'pipeline', label: 'Pipeline', hint: 'Les prospects, de contact à gagné' },
  { key: 'reminders', label: 'Relances', hint: 'Les factures échues, et le mot à envoyer' },
  { key: 'subscriptions', label: 'Abonnements', hint: 'Ce qui revient chaque mois, facturé en un geste' },
  { key: 'contracts', label: 'Contrats', hint: 'Ce qui est signé, jusqu’à quand, pour combien' },
  { key: 'reviews', label: 'Avis', hint: 'Ce que les clientes disent, gardé ensemble' },
  { key: 'loyalty', label: 'Fidélité', hint: 'La carte à tampons, sans le carton' },
  { key: 'referrals', label: 'Parrainage', hint: 'Qui a amené qui, et ce qu’on lui doit' },
  { key: 'booking', label: 'Rendez-vous en ligne', hint: 'Une page publique branchée sur l’Agenda' },
];
