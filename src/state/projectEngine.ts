import type { NavItem } from '../data/navigation';

/**
 * Le moteur de configuration des Projets — et, à travers lui, la première
 * brique du générateur de desktops métier.
 *
 * ## Pourquoi un module autonome plutôt qu'une greffe sur Clients et Tâches
 *
 * Le diagnostic (A.1) a donné trois constats :
 *
 *   1. **La couche de stockage est DÉJÀ sans schéma.** `shared_records` ne
 *      connaît qu'une colonne `data` en JSON ; les interfaces TypeScript sont
 *      le seul schéma qui existe. Des champs par organisation ne demandent donc
 *      aucune migration de base — c'est le fait qui rend tout le reste
 *      possible, et il vaut la peine d'être dit avant tout le reste.
 *   2. **Clients et Tâches ont des formulaires écrits à la main**, chacun avec
 *      ses règles (score de santé, devis liés, colonnes, commentaires,
 *      étiquettes). Les convertir en rendu générique voudrait dire réécrire
 *      deux écrans qui fonctionnent et qui portent déjà des données clientes
 *      réelles — beaucoup de risque, pour un gain faible : leurs champs de
 *      base (nom, société, email, statut) sont les mêmes chez tout le monde.
 *   3. **Ce qui varie d'un métier à l'autre n'est pas la fiche client, c'est
 *      la façon de suivre le TRAVAIL** : les statuts, les entités qu'on
 *      distingue, ce qu'on veut voir en priorité.
 *
 * D'où le choix : le moteur vit dans un module neuf, conçu dès le départ
 * autour d'une configuration, et Clients/Tâches n'y touchent pas. Ils s'y
 * RATTACHENT par un simple identifiant de projet.
 *
 * ## Ce qui est configurable, et ce qui ne l'est délibérément pas
 *
 * Configurable, parce que ça change vraiment d'un métier à l'autre :
 *   - les **statuts** du pipeline et leur ordre ;
 *   - les **structures** (entités, marques, pôles) — liste ouverte ;
 *   - quels **champs optionnels** sont affichés, et sous quel intitulé ;
 *   - jusqu'à trois **champs libres** de texte, avec leur intitulé.
 *
 * PAS configurable, et c'est un choix assumé : la création de champs de type
 * arbitraire (nombres, dates, listes liées, formules). Ça demanderait un
 * constructeur de formulaires, de la validation, des migrations, et une
 * refonte de tout écran qui voudrait les lire. C'est exactement le « système
 * extraordinaire utilisé deux semaines ». Trois champs texte libres couvrent
 * le besoin réel — « numéro de dossier », « interlocuteur » — pour un coût
 * proche de zéro et sans rien fragiliser.
 */

/* ------------------------------- Le contenu ------------------------------- */

export interface ProjectStatus {
  key: string;
  label: string;
  /** Un statut terminal ne compte plus comme « en cours » nulle part. */
  done?: boolean;
}

/** Un champ optionnel du moteur : on l'active, et on peut le renommer. */
export type OptionalFieldKey = 'client' | 'structure' | 'priority' | 'nextAction' | 'deadline' | 'link';

export interface OptionalFieldConfig {
  enabled: boolean;
  /** Intitulé affiché. Vide = celui du catalogue. */
  label?: string;
}

export interface ExtraField {
  key: string;
  label: string;
}

export interface ProjectConfig {
  /** Le profil métier appliqué, pour information — le réglage fait foi. */
  profileId: string;
  statuses: ProjectStatus[];
  /** Liste ouverte, éditée par l'organisation. Vide = le champ ne sert pas. */
  structures: string[];
  fields: Record<OptionalFieldKey, OptionalFieldConfig>;
  /** Trois au maximum — voir la note en tête de fichier. */
  extraFields: ExtraField[];
}

export const MAX_EXTRA_FIELDS = 3;

/** Intitulés par défaut, quand la configuration n'en impose pas. */
export const FIELD_LABELS: Record<OptionalFieldKey, string> = {
  client: 'Client',
  structure: 'Structure',
  priority: 'Priorité',
  nextAction: 'Prochaine action',
  deadline: 'Échéance',
  link: 'Lien externe',
};

export const FIELD_ORDER: OptionalFieldKey[] = [
  'structure',
  'client',
  'nextAction',
  'deadline',
  'priority',
  'link',
];

export function fieldLabel(config: ProjectConfig, key: OptionalFieldKey): string {
  return config.fields[key]?.label?.trim() || FIELD_LABELS[key];
}

export function fieldEnabled(config: ProjectConfig, key: OptionalFieldKey): boolean {
  return config.fields[key]?.enabled !== false;
}

/* ------------------------------- Les profils ------------------------------ */

/**
 * Un profil métier n'est QUE un préréglage du moteur.
 *
 * C'est le test de généricité, et il est volontairement sévère : si ajouter un
 * métier demandait une ligne de code ailleurs que dans ce tableau, le moteur
 * n'en serait pas un — ce serait un module Projets déguisé. Les deux profils
 * ci-dessous sont donc de simples données, et le second n'a coûté aucun code.
 */
export interface BusinessProfile {
  id: string;
  label: string;
  /** Une phrase, affichée au moment de choisir. */
  hint: string;
  config: Omit<ProjectConfig, 'profileId'>;
}

const ALL_FIELDS_ON: Record<OptionalFieldKey, OptionalFieldConfig> = {
  client: { enabled: true },
  structure: { enabled: true },
  priority: { enabled: true },
  nextAction: { enabled: true },
  deadline: { enabled: true },
  link: { enabled: true },
};

export const BUSINESS_PROFILES: BusinessProfile[] = [
  {
    id: 'agence-creative',
    label: 'Agence créative multi-structures',
    hint: 'Plusieurs entités, des clients à plusieurs projets, des projets à plusieurs opérations.',
    config: {
      // Le pipeline d'une agence : une idée mûrit, se produit, attend une
      // validation cliente — l'étape qui manque partout et où tout s'enlise —
      // puis se termine et s'archive.
      statuses: [
        { key: 'idee', label: 'Idée' },
        { key: 'en-cours', label: 'En cours' },
        { key: 'validation', label: 'Attente validation' },
        { key: 'termine', label: 'Terminé', done: true },
        { key: 'archive', label: 'Archivé', done: true },
      ],
      structures: [],
      fields: ALL_FIELDS_ON,
      extraFields: [],
    },
  },
  {
    id: 'freelance-solo',
    label: 'Freelance solo',
    hint: 'Une seule structure, des missions courtes, pas de validation interne.',
    config: {
      statuses: [
        { key: 'a-faire', label: 'À faire' },
        { key: 'en-cours', label: 'En cours' },
        { key: 'livre', label: 'Livré', done: true },
      ],
      structures: [],
      fields: {
        ...ALL_FIELDS_ON,
        // Une seule entité : la colonne « Structure » n'aurait qu'une valeur,
        // donc elle n'apprend rien et prend de la place sur chaque écran.
        structure: { enabled: false },
        // Pas de chaîne de validation : la priorité suffit à trier.
        priority: { enabled: true },
      },
      extraFields: [],
    },
  },
];

export const DEFAULT_PROFILE_ID = 'agence-creative';

export function profileById(id: string): BusinessProfile | undefined {
  return BUSINESS_PROFILES.find((p) => p.id === id);
}

export function configFromProfile(id: string): ProjectConfig {
  const profile = profileById(id) ?? BUSINESS_PROFILES[0];
  return { profileId: profile.id, ...structuredClone(profile.config) };
}

/** Le réglage d'une organisation qui n'a rien choisi. */
export function defaultConfig(): ProjectConfig {
  return configFromProfile(DEFAULT_PROFILE_ID);
}

/**
 * Remet une configuration lue en base dans un état utilisable.
 *
 * Une configuration est de la donnée éditable : elle peut arriver amputée
 * (version antérieure), vidée par une fausse manœuvre, ou incohérente. Un
 * projet sans statut valide n'est affichable nulle part, donc on répare plutôt
 * que d'afficher un écran vide sans explication.
 */
export function normalizeConfig(raw: Partial<ProjectConfig> | undefined): ProjectConfig {
  const base = defaultConfig();
  if (!raw) return base;

  const statuses = Array.isArray(raw.statuses)
    ? raw.statuses
        .filter((s): s is ProjectStatus => Boolean(s && typeof s.key === 'string' && s.key))
        .map((s) => ({ key: s.key, label: String(s.label ?? s.key), done: Boolean(s.done) }))
    : [];

  return {
    profileId: typeof raw.profileId === 'string' ? raw.profileId : base.profileId,
    // Zéro statut rendrait tout projet inaffichable : on retombe sur le profil.
    statuses: statuses.length > 0 ? statuses : base.statuses,
    structures: Array.isArray(raw.structures) ? raw.structures.map(String).filter(Boolean) : [],
    fields: { ...base.fields, ...(raw.fields ?? {}) },
    extraFields: Array.isArray(raw.extraFields)
      ? raw.extraFields
          .filter((f): f is ExtraField => Boolean(f && typeof f.key === 'string' && f.key))
          .slice(0, MAX_EXTRA_FIELDS)
          .map((f) => ({ key: f.key, label: String(f.label ?? f.key) }))
      : [],
  };
}

/* ------------------------------- Un projet -------------------------------- */

export type ProjectPriority = 'low' | 'normal' | 'high';

export interface ProjectData {
  title: string;
  /** Clé d'un statut de la configuration. */
  status: string;
  structure: string;
  /** `Client.id` numérique, ou 0 si aucun. */
  clientId: number;
  priority: ProjectPriority;
  nextAction: string;
  /** Jour ISO, ou chaîne vide. */
  deadline: string;
  link: string;
  notes: string;
  /** Valeurs des champs libres, indexées par leur clé. */
  extra: Record<string, string>;
  createdAt: string;
}

export type Project = ProjectData & { id: string; updatedAt: string };

/** Le statut d'un projet est-il terminal, d'après la configuration courante ? */
export function isDone(config: ProjectConfig, project: Project): boolean {
  return config.statuses.find((s) => s.key === project.status)?.done === true;
}

export function statusLabel(config: ProjectConfig, key: string): string {
  return config.statuses.find((s) => s.key === key)?.label ?? key;
}

/**
 * Les entrées de navigation que le moteur ajoute. Déclaré ici pour qu'un
 * futur profil puisse en activer d'autres sans toucher au catalogue.
 */
export type ProjectNavItem = NavItem;
