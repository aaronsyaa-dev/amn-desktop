import { EDITION_PRODUCT_NAME } from '../edition/edition';

/**
 * Catalogue des offres de tracking AMN. Mock/statique pour l'instant — aucune
 * dépendance à une base de données, ce contenu ne change pas dynamiquement.
 *
 * Raisonnement des paliers (documenté ici car demandé pour discussion) :
 *
 * 1. AMN Sentinel (DISPONIBLE) — correspond exactement à `security-monitor`
 *    tel que codé : détection de force brute, rate limiting, injections
 *    basiques (regex), heartbeat de visiteurs actifs. C'est la couverture
 *    "sécurité basique" : suffisante pour repérer les attaques automatisées
 *    les plus courantes (scans, bourrage d'identifiants) sans configuration
 *    lourde. Aucune dépendance externe, gratuit, installable en 4 lignes.
 *
 * 2. AMN Sentinel+ (À VENIR) — la suite logique : là où le palier 1 détecte
 *    des seuils fixes, celui-ci ajouterait une détection par anomalie
 *    (baseline statistique de trafic plutôt qu'un seuil fixe), une
 *    réputation IP / blocage géographique (bases gratuites type GeoIP-lite),
 *    une empreinte de session pour distinguer bots et humains, et des
 *    alertes sortantes (webhook Slack/email) en plus de la remontée vers
 *    AMN Desktop. C'est la marche "détection avancée" : on garde la même
 *    philosophie (léger, pas de dépendance payante) mais on réduit les faux
 *    négatifs et on réagit plus vite qu'un simple seuil.
 *
 * 3. AMN Suite (À VENIR, verrouillé) — le palier complet : tout ce qui
 *    précède, plus des analytics business (corrélation trafic/CA, détection
 *    de fraude sur les paiements au-delà du simple statut échoué/réussi),
 *    des vérifications de disponibilité synthétiques (uptime/perf actifs,
 *    pas seulement passifs via heartbeat), un scan de dépendances
 *    vulnérables programmé, et la génération automatique de rapports
 *    d'incident (branché sur l'assistant IA déjà présent dans l'application).
 *    C'est la offre "supervision + business", pensée pour un client qui
 *    veut un véritable centre de pilotage plutôt qu'un simple capteur.
 *
 * Seul le palier 1 est marqué disponible : c'est le seul réellement codé
 * (`security-monitor`). Les paliers 2 et 3 sont affichés verrouillés pour
 * donner une vraie trajectoire produit, pas une liste arbitraire.
 */

export type TrackerAvailability = 'available' | 'coming-soon' | 'locked';

export interface TrackerOffer {
  id: string;
  tier: number;
  name: string;
  tagline: string;
  description: string;
  /** Coverage/power rating out of 5 (halves allowed, e.g. 3.5). */
  rating: number;
  features: string[];
  availability: TrackerAvailability;
  /** Copy-paste install snippet — only meaningful when availability === 'available'. */
  installSnippet?: string;
  packageHint?: string;
}

const SENTINEL_SNIPPET = `import { createTracker } from '@amn-devsec/security-monitor';

const tracker = createTracker(); // lit AMN_API_URL / AMN_API_KEY depuis .env
app.use(tracker.middleware());   // rate limiting + détection d'injection
tracker.start();                 // heartbeat + envoi vers AMN`;

export const trackerCatalog: TrackerOffer[] = [
  {
    id: 'sentinel',
    tier: 1,
    name: 'AMN Sentinel',
    tagline: 'Sécurité de base, temps réel',
    description:
      `Détection de force brute, rate limiting et injections basiques (SQL/NoSQL/XSS). Remonte vers ${EDITION_PRODUCT_NAME} en quasi temps réel, avec file d’attente durable si le site est temporairement injoignable.`,
    rating: 2,
    features: [
      'Force brute (fenêtre glissante par identifiant)',
      'Rate limiting par IP',
      'Détection d’injection par signatures',
      'Heartbeat visiteurs actifs',
      'File d’attente locale résiliente',
    ],
    availability: 'available',
    installSnippet: SENTINEL_SNIPPET,
    packageHint: '@amn-devsec/security-monitor',
  },
  {
    id: 'sentinel-plus',
    tier: 2,
    name: 'AMN Sentinel+',
    tagline: 'Détection avancée',
    description:
      'Ajoute une détection par anomalie (baseline de trafic plutôt que seuils fixes), une réputation IP, une empreinte de session anti-bot, et des alertes sortantes (webhook).',
    rating: 3.5,
    features: [
      'Détection d’anomalie statistique',
      'Réputation IP / blocage géographique',
      'Empreinte de session anti-bot',
      'Webhooks d’alerte (Slack, email)',
    ],
    availability: 'coming-soon',
  },
  {
    id: 'suite',
    tier: 3,
    name: 'AMN Suite',
    tagline: 'Sécurité + analytics business',
    description:
      'La suite complète : tout Sentinel+, plus analytics business (corrélation trafic/CA, fraude paiement), disponibilité active, scan de dépendances vulnérables, et rapports d’incident générés automatiquement par l’assistant IA.',
    rating: 5,
    features: [
      'Analytics business (CA, conversion)',
      'Détection de fraude paiement',
      'Disponibilité active (synthetic checks)',
      'Scan de dépendances vulnérables',
      'Rapports générés par l’assistant IA',
    ],
    availability: 'locked',
  },
];
