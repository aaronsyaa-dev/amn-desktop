/**
 * The tracker as a set of INDEPENDENT modules (paliers). Each module can be
 * installed on, or removed from, a given site without touching the others —
 * this file is the single source of truth the install wizard and the control
 * desk both read from.
 *
 * `maturity` is deliberately honest about how production-ready each module's
 * detection is, so the UI never implies a capability is battle-tested when it
 * isn't:
 *   - 'stable'      : shipped and validated (the existing security-monitor).
 *   - 'beta'        : implemented, conservative by design, needs field
 *                     validation on real traffic before being fully trusted.
 *   - 'development' : implemented as a module but not yet validated end-to-end.
 *
 * The `key` values match the module ids used by the security-monitor tracker
 * config, so a site's installed-modules set maps 1:1 to what runs on the site.
 */

export type ModuleMaturity = 'stable' | 'beta' | 'development';

export interface TrackerModule {
  /** Stable id, shared with the security-monitor config. */
  key: string;
  tier: 1 | 2 | 3;
  name: string;
  tagline: string;
  description: string;
  /** What this module detects/does, user-facing. */
  capabilities: string[];
  maturity: ModuleMaturity;
  /** Modules that must be installed first (e.g. Suite builds on Sentinel). */
  requires: string[];
}

export const TRACKER_MODULES: TrackerModule[] = [
  {
    key: 'sentinel',
    tier: 1,
    name: 'AMN Sentinel',
    tagline: 'Sécurité de base, temps réel',
    description:
      'Le socle : détection de force brute, rate limiting et injections basiques (SQL/NoSQL/XSS), avec heartbeat des visiteurs actifs et file d’attente locale résiliente si le site est momentanément injoignable.',
    capabilities: [
      'Force brute (fenêtre glissante par identifiant)',
      'Rate limiting par IP',
      'Détection d’injection par signatures',
      'Heartbeat visiteurs actifs',
      'File d’attente locale durable',
    ],
    maturity: 'stable',
    requires: [],
  },
  {
    key: 'sentinel-plus',
    tier: 2,
    name: 'AMN Sentinel+',
    tagline: 'Détection comportementale',
    description:
      'La couche comportementale : anomalie de trafic sur ligne de base glissante (pas de seuil fixe arbitraire), réputation IP sur liste publique mise en cache, et empreinte anti-bot sobre — pensés pour éviter les fausses alertes.',
    capabilities: [
      'Anomalie de trafic (baseline glissante + écart-type)',
      'Réputation IP (liste publique, cache local)',
      'Empreinte anti-bot conservatrice',
    ],
    maturity: 'beta',
    requires: ['sentinel'],
  },
  {
    key: 'suite',
    tier: 3,
    name: 'AMN Suite',
    tagline: 'Business + protection avancée',
    description:
      'Le palier complet : disponibilité active par ping indépendant du trafic, scan des dépendances Node vulnérables (base OSV), et rapport hebdomadaire généré par l’assistant à partir des données réellement remontées du site.',
    capabilities: [
      'Disponibilité active (ping périodique indépendant)',
      'Scan de dépendances vulnérables (OSV.dev)',
      'Rapport hebdomadaire par l’assistant',
    ],
    maturity: 'development',
    requires: ['sentinel'],
  },
];

export const MATURITY_META: Record<ModuleMaturity, { label: string; tone: 'stable' | 'beta' | 'dev' }> = {
  stable: { label: 'Stable', tone: 'stable' },
  beta: { label: 'Bêta', tone: 'beta' },
  development: { label: 'En développement', tone: 'dev' },
};

export function moduleByKey(key: string): TrackerModule | undefined {
  return TRACKER_MODULES.find((m) => m.key === key);
}

/** Resolves a list of module keys to modules, dropping any unknown keys. */
export function modulesByKeys(keys: string[]): TrackerModule[] {
  return keys.flatMap((k) => {
    const m = moduleByKey(k);
    return m ? [m] : [];
  });
}
