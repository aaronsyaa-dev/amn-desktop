import type { BureauKey, EspaceKey } from './jetons';

/**
 * LE CATALOGUE DES BUREAUX — ce que chaque coquille montre, et où mène chaque
 * outil (cahier 11 §4, cahier 15 §10 « les navigations finales », cahier 16).
 *
 * Une seule source pour quatre surfaces qui doivent dire la même chose : la
 * navigation de la coquille (pupitre, console, portes, dock, organigramme),
 * la palette ⌘E (« Dans {bureau} »), les touches `1` à `9` et, dans
 * l'application installée, `F1` à `F9`. Une liste recopiée dans l'une
 * d'elles finirait par diverger — c'est le défaut le plus coûteux de ce
 * projet, il s'est produit deux fois avec la barre latérale.
 *
 * Les chemins des vingt-trois modules du cahier 4 n'ont PAS bougé (`/garde`,
 * `/tour`, `/supervision`…) : les liens profonds, la mémoire d'onglet et les
 * notifications continuent d'y mener. C'est le bureau qui les recoud dans sa
 * coquille, pas un nouveau préfixe d'URL.
 */

/** Ce que compte l'onglet, lu dans les données des bureaux (voir `useBureaux`). */
export type Compteur =
  | 'aTraiter'
  | 'organisations'
  | 'automatisations'
  | 'groupes'
  | 'alertes'
  | 'incidents'
  | 'echeances'
  | 'playbooks'
  | 'scanner'
  | 'ssl'
  | 'pieces'
  | 'gardes'
  | 'avis'
  | 'chefs';

export interface Ecran {
  nom: string;
  route: string;
  /** Écrans supplémentaires recousus sous cet onglet : leur route, leur nom. */
  aussi?: { nom: string; route: string; motifs?: string[] }[];
  /** Préfixes qui appartiennent à l'onglet sans être listés (fiches, sous-routes). */
  motifs?: string[];
  compteur?: Compteur;
}

export interface Outil {
  /** 1 à 9 ; `null` = par la palette seulement (Produits de Cyber). */
  chiffre: number | null;
  nom: string;
  route: string;
  compteur?: Compteur;
  /** Le groupe de la console (« PRODUITS »), le cas échéant. */
  groupe?: string;
}

export interface Bureau {
  key: BureauKey;
  /** La navigation de la coquille, dans son ordre. */
  onglets: Ecran[];
  /** Les outils numérotés, et ceux qu'on n'atteint que par la palette. */
  outils: Outil[];
}

const SUPERVISOR: Bureau = {
  key: 'supervisor',
  onglets: [
    {
      nom: 'Mur de situation',
      route: '/supervisor',
      aussi: [
        { nom: 'La grille', route: '/supervisor/grille' },
        { nom: 'Vue d’ensemble', route: '/tour' },
        { nom: 'Carte du parc', route: '/supervisor/carte' },
      ],
    },
    { nom: 'À traiter', route: '/supervisor/a-traiter', compteur: 'aTraiter' },
    {
      nom: 'Dossiers clients',
      route: '/tour/organisations',
      compteur: 'organisations',
      motifs: ['/supervisor/dossiers', '/supervisor/bug'],
      aussi: [
        { nom: 'Atelier', route: '/tour/generateur' },
        { nom: 'Santé des places', route: '/supervisor/places' },
        { nom: 'Renouvellements du parc', route: '/supervisor/renouvellements' },
      ],
    },
    { nom: 'Chercheur de modules', route: '/supervisor/chercheur' },
    { nom: 'Automatisations', route: '/supervisor/automatisations', compteur: 'automatisations' },
    { nom: 'Groupes', route: '/supervisor/groupes', compteur: 'groupes' },
    {
      nom: 'Équipe',
      route: '/team',
      aussi: [
        { nom: 'Décisions', route: '/decisions' },
        { nom: 'Connaissances', route: '/knowledge' },
        { nom: 'Trackers de l’équipe', route: '/supervisor/trackers' },
        { nom: 'Prévision de charge', route: '/supervisor/charge' },
      ],
    },
  ],
  outils: [],
};

const CYBER: Bureau = {
  key: 'cyber',
  onglets: [
    {
      nom: 'Posture',
      route: '/cyber',
      aussi: [
        { nom: 'La matrice', route: '/cyber/posture' },
        { nom: 'Maturité SOC', route: '/maturite-soc' },
        { nom: 'Comparatif clientes', route: '/comparatif' },
        { nom: 'Surface d’attaque', route: '/cyber/surface' },
      ],
    },
    {
      nom: 'Alertes',
      route: '/cyber/alertes',
      compteur: 'alertes',
      aussi: [
        { nom: 'Alertes personnalisées', route: '/alertes-personnalisees' },
        { nom: 'Veille des vulnérabilités', route: '/cyber/vulnerabilites' },
      ],
    },
    { nom: 'Incidents', route: '/supervision', compteur: 'incidents', motifs: ['/cyber/incidents'] },
    {
      nom: 'Inventaire',
      route: '/cyber/inventaire',
      aussi: [
        { nom: 'Sites', route: '/sites' },
        { nom: 'Trackers', route: '/tracker', motifs: ['/tracker/site'] },
      ],
    },
    { nom: 'Échéances', route: '/cyber/echeances', compteur: 'echeances', aussi: [{ nom: 'Rotation des secrets', route: '/cyber/secrets' }] },
    { nom: 'Journal d’audit', route: '/cyber/journal', aussi: [{ nom: 'Journal d’accès', route: '/tour/journal' }] },
    {
      nom: 'Playbooks',
      route: '/cyber/playbooks',
      compteur: 'playbooks',
      aussi: [
        { nom: 'Exercice de crise', route: '/cyber/crise' },
        { nom: 'Exercice d’hameçonnage', route: '/cyber/hameconnage' },
      ],
    },
    { nom: 'Rapports', route: '/cyber/rapports', aussi: [{ nom: 'Rapport client enrichi', route: '/rapport-client' }] },
    { nom: 'Carnet de bord', route: '/cyber/carnet' },
  ],
  outils: [],
};

const STUDIO: Bureau = {
  key: 'studio',
  onglets: [
    {
      nom: 'Toutes les pièces',
      route: '/studio',
      compteur: 'pieces',
      motifs: ['/studio/pieces'],
      aussi: [
        { nom: 'Budget de performance', route: '/studio/performance' },
        { nom: 'Recette visuelle', route: '/studio/recette' },
        { nom: 'Accessibilité', route: '/studio/accessibilite' },
      ],
    },
  ],
  outils: [],
};

const STRATEGIE: Bureau = {
  key: 'strategie',
  onglets: [
    { nom: 'Vue d’ensemble', route: '/strategie' },
    { nom: 'Campagnes', route: '/strategie/campagnes', aussi: [{ nom: 'Banque de témoignages', route: '/strategie/temoignages' }] },
    { nom: 'Storyboards', route: '/strategie/storyboards' },
    { nom: 'Calendrier', route: '/strategie/calendrier' },
    { nom: 'Pipeline', route: '/strategie/pipeline', aussi: [{ nom: 'Attribution', route: '/strategie/attribution' }] },
    { nom: 'Enquête', route: '/strategie/enquete' },
    { nom: 'Objectifs', route: '/strategie/objectifs' },
    { nom: 'Liège', route: '/strategie/liege' },
  ],
  outils: [],
};

const GARDE: Bureau = {
  key: 'garde',
  onglets: [
    {
      nom: 'Organigramme',
      route: '/garde/organigramme',
      motifs: ['/garde/compte-rendu'],
      aussi: [{ nom: 'Cette nuit', route: '/garde/nuit' }],
    },
    { nom: 'La Salle', route: '/garde', compteur: 'gardes' },
    { nom: 'À votre avis', route: '/garde/pile', compteur: 'avis' },
    { nom: 'Ajmani', route: '/garde/ajmani' },
    { nom: 'Les bureaux', route: '/garde/bureaux', compteur: 'chefs', aussi: [{ nom: 'Simulateur de nuit', route: '/garde/simulateur' }] },
    { nom: 'Salle commune', route: '/garde/commune' },
    { nom: 'Calendrier', route: '/garde/calendrier' },
  ],
  outils: [],
};

/*
  LES OUTILS NUMÉROTÉS. Supervisor, Stratégie et la Garde numérotent leurs
  onglets ; Cyber sa console (1 Posture … 9 Carnet de bord), puis ses
  Produits sans touche ; Studio n'a qu'une porte générale — ses trois outils
  transverses prennent 2, 3 et 4.
*/
for (const b of [SUPERVISOR, STRATEGIE, GARDE, CYBER]) {
  b.outils = b.onglets.map((o, i) => ({ chiffre: i + 1, nom: o.nom, route: o.route, compteur: o.compteur }));
}
CYBER.outils.push(
  { chiffre: null, nom: 'Scanner', route: '/scanner', compteur: 'scanner', groupe: 'PRODUITS' },
  { chiffre: null, nom: 'Comply', route: '/comply', groupe: 'PRODUITS' },
  { chiffre: null, nom: 'SSL Monitor', route: '/ssl', compteur: 'ssl', groupe: 'PRODUITS' },
);
STUDIO.outils = [
  { chiffre: 1, nom: 'Toutes les pièces', route: '/studio', compteur: 'pieces' },
  { chiffre: 2, nom: 'Budget de performance', route: '/studio/performance' },
  { chiffre: 3, nom: 'Recette visuelle', route: '/studio/recette' },
  { chiffre: 4, nom: 'Accessibilité', route: '/studio/accessibilite' },
];

export const CATALOGUE: Record<BureauKey, Bureau> = {
  supervisor: SUPERVISOR,
  cyber: CYBER,
  studio: STUDIO,
  strategie: STRATEGIE,
  garde: GARDE,
};

/** Tous les écrans d'un bureau, avec l'onglet qui les porte. */
export function ecransDuBureau(b: BureauKey): { nom: string; route: string; onglet: Ecran; motifs: string[] }[] {
  return CATALOGUE[b].onglets.flatMap((o) => [
    { nom: o.nom, route: o.route, onglet: o, motifs: o.motifs ?? [] },
    ...(o.aussi ?? []).map((a) => ({ nom: a.nom, route: a.route, onglet: o, motifs: a.motifs ?? [] })),
  ]);
}

const colle = (chemin: string, route: string) => chemin === route || chemin.startsWith(`${route}/`);

/**
 * Le bureau d'un chemin, ou `null` pour le poste de travail.
 *
 * Correspondance au préfixe le plus long, pour que `/tour/journal` (Cyber)
 * ne tombe pas dans `/tour` (Supervisor), ni `/garde/pile` dans une autre
 * règle que la Garde.
 */
export function bureauDuChemin(chemin: string): BureauKey | null {
  let meilleur: { n: number; b: BureauKey } | null = null;
  for (const b of Object.keys(CATALOGUE) as BureauKey[]) {
    for (const e of ecransDuBureau(b)) {
      for (const motif of [e.route, ...e.motifs]) {
        if (colle(chemin, motif) && (!meilleur || motif.length > meilleur.n)) meilleur = { n: motif.length, b };
      }
    }
  }
  return meilleur?.b ?? null;
}

export function espaceDuChemin(chemin: string): EspaceKey {
  return bureauDuChemin(chemin) ?? 'poste';
}

/**
 * L'onglet actif d'un bureau pour un chemin : celui dont un écran ou un
 * motif colle au plus long. `null` si le chemin n'est pas du bureau.
 */
export function ongletDuChemin(b: BureauKey, chemin: string): { onglet: Ecran; ecran: { nom: string; route: string } } | null {
  let meilleur: { n: number; onglet: Ecran; ecran: { nom: string; route: string } } | null = null;
  for (const e of ecransDuBureau(b)) {
    for (const motif of [e.route, ...e.motifs]) {
      if (colle(chemin, motif) && (!meilleur || motif.length > meilleur.n)) meilleur = { n: motif.length, onglet: e.onglet, ecran: { nom: e.nom, route: e.route } };
    }
  }
  return meilleur ? { onglet: meilleur.onglet, ecran: meilleur.ecran } : null;
}

/** L'outil portant ce chiffre dans ce bureau (touches `1`–`9`, `F1`–`F9`). */
export function outilNumero(b: BureauKey, chiffre: number): Outil | null {
  return CATALOGUE[b].outils.find((o) => o.chiffre === chiffre) ?? null;
}

/**
 * Ce que la palette cherche dans un bureau : ses outils numérotés, ses
 * Produits, puis les écrans recousus sous ses onglets — et rien d'un autre
 * bureau. On ne passe pas de Notes à un moniteur de certificats : on change
 * d'abord d'espace.
 */
export function cherchablesDuBureau(b: BureauKey): { nom: string; route: string; chiffre: number | null; compteur?: Compteur; groupe?: string }[] {
  const vus = new Set<string>();
  const r: { nom: string; route: string; chiffre: number | null; compteur?: Compteur; groupe?: string }[] = [];
  for (const o of CATALOGUE[b].outils) {
    if (vus.has(o.route)) continue;
    vus.add(o.route);
    r.push({ nom: o.nom, route: o.route, chiffre: o.chiffre, compteur: o.compteur, groupe: o.groupe });
  }
  for (const e of ecransDuBureau(b)) {
    if (vus.has(e.route)) continue;
    vus.add(e.route);
    r.push({ nom: e.nom, route: e.route, chiffre: null });
  }
  return r;
}
