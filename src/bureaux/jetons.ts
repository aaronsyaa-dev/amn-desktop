/**
 * LES JETONS DES BUREAUX — cahier 11, `44a`.
 *
 * Entrer en supervision, c'est changer de pièce. Les cinq bureaux partagent
 * une seule chose visible, la barre haute ; le reste leur appartient : le
 * palier de noirs, la forme de navigation, le rythme de grille, la tête, un
 * détail d'ambiance. Les écarts de noir sont volontairement faibles (deux à
 * quatre unités par canal) : on sent le changement de pièce sans y voir un
 * thème. `#000` n'est jamais employé — il reste réservé à la veille.
 *
 * Ce fichier est la table du paquet (`_tools/bureaux.js`, objet `B`), et la
 * seule : la barre, les coquilles, les sas et la palette la lisent ici.
 * Les ENCRES, elles, ne sont pas celles des maquettes à la lettre : le
 * produit a relevé son plancher de texte à `#9a9a97` pour tenir WCAG AA
 * (`check:contraste`). Les gris que les maquettes écrivent en texte
 * (`#6b6b68`, `#4a4a48`) restent ici des gris de remplissage, jamais du texte.
 */

export type BureauKey = 'supervisor' | 'cyber' | 'studio' | 'strategie' | 'garde';
export type EspaceKey = 'poste' | BureauKey;

export interface Palier {
  fond: string;
  surf: string;
  rel: string;
  filet: string;
  barre: string;
}

export interface Espace extends Palier {
  key: EspaceKey;
  nom: string;
  role: string;
  /** Qui y travaille — la ligne de la palette. */
  qui: string;
  /** Le raccourci : `G` puis ce chiffre. */
  chiffre: number;
  /** Où mène l'entrée dans l'espace. */
  accueil: string;
}

/** Les six espaces, dans l'ordre des raccourcis `G 0` à `G 5`. */
export const ESPACES: Espace[] = [
  { key: 'poste', nom: 'Poste de travail', role: 'Les modules du quotidien', qui: '—', chiffre: 0, accueil: '/', fond: 'var(--color-bg)', surf: 'var(--color-elevated)', rel: '#181818', filet: '#1c1c1c', barre: '#0c0c0c' },
  { key: 'supervisor', nom: 'Supervisor', role: 'La tour de contrôle', qui: 'Toute l’équipe', chiffre: 1, accueil: '/supervisor', fond: 'var(--color-sunken)', surf: 'var(--color-elevated)', rel: '#1a1a1a', filet: '#252525', barre: '#0e0e0e' },
  { key: 'cyber', nom: 'Cyber', role: 'Le centre de sécurité', qui: 'Harun', chiffre: 2, accueil: '/cyber', fond: '#090a0a', surf: '#0f1111', rel: '#161919', filet: '#212525', barre: '#0b0c0c' },
  { key: 'studio', nom: 'Studio', role: 'Le bureau web', qui: 'Mohamed', chiffre: 3, accueil: '/studio', fond: '#0d0c0b', surf: '#141312', rel: '#1c1b19', filet: '#2a2826', barre: '#100f0e' },
  { key: 'strategie', nom: 'Stratégie', role: 'La salle de stratégie', qui: 'Riyad', chiffre: 4, accueil: '/strategie', fond: '#0c0c0d', surf: '#141416', rel: '#1b1b1e', filet: '#28282c', barre: '#0f0f11' },
  { key: 'garde', nom: 'La Garde', role: 'Les agents automatiques', qui: 'Le Capitaine', chiffre: 5, accueil: '/garde/organigramme', fond: '#080808', surf: '#101010', rel: '#171717', filet: '#202020', barre: '#0a0a0a' },
];

export const BUREAUX: BureauKey[] = ['supervisor', 'cyber', 'studio', 'strategie', 'garde'];

export function espace(key: EspaceKey): Espace {
  return ESPACES.find((e) => e.key === key) ?? ESPACES[0];
}

/** Les encres partagées. `sourdine` est le plancher de texte du produit. */
export const ENCRE = {
  titre: 'var(--color-text-primary)',
  corps: 'var(--color-text-body)',
  second: 'var(--color-text-secondary)',
  sourdine: 'var(--color-text-muted)',
  /** Gris de remplissage — barres, segments, jauges. Jamais du texte. */
  remplissage: ['#2b2b2b', 'var(--color-border-strong)', '#4a4a48'],
} as const;

export const AMBRE = 'var(--color-signal)';
/** Le rouge critique : trait, texte, fond, bordure. Un endroit par écran. */
export const ROUGE = { trait: 'var(--color-danger)', texte: 'var(--color-danger-ink)', fond: '#140908', bordure: '#3a1815' } as const;

/**
 * Les glyphes (24 × 24, trait 1,9) — tracés exacts du paquet (`G`).
 * poste = quatre carrés ; Supervisor = cible à trois anneaux ; Cyber =
 * hexagone et trait ; Studio = porte et poignée ; Stratégie = deux punaises
 * reliées ; La Garde = organigramme à trois branches.
 */
export const GLYPHES: Record<EspaceKey, { d: string[]; plein?: { cx: number; cy: number; r: number }[]; rects?: [number, number, number, number][]; cercles?: [number, number, number][] }> = {
  poste: { d: [], rects: [[3, 3, 7, 7], [14, 3, 7, 7], [3, 14, 7, 7], [14, 14, 7, 7]] },
  supervisor: { d: [], cercles: [[12, 12, 9], [12, 12, 4.5]], plein: [{ cx: 12, cy: 12, r: 1.3 }] },
  cyber: { d: ['M12 2.5 20.5 7.25v9.5L12 21.5 3.5 16.75v-9.5z', 'M12 8v5'] },
  studio: { d: [], rects: [[5, 2.5, 14, 19]], plein: [{ cx: 15.5, cy: 12.5, r: 1.1 }] },
  strategie: { d: ['M7.6 8.6 16.4 15.4'], cercles: [[6, 7, 2.2], [18, 17, 2.2]], plein: [{ cx: 18, cy: 6, r: 1.4 }] },
  garde: { d: ['M12 7v4.5M5.25 16v-4.5h13.5V16M12 11.5V16'], rects: [[9, 2.5, 6, 4.5], [2.5, 16, 5.5, 5], [9.25, 16, 5.5, 5], [16, 16, 5.5, 5]] },
};

/** Les délais du Mouvement — cahier 11, §2 et §3. */
export const MOUVEMENT = {
  /** Sas complet, les deux variantes. */
  sasComplet: 600,
  /** Retour au poste, première fois dans la session. */
  retourComplet: 360,
  /** Entrées suivantes, et retours suivants. */
  sasCourt: 200,
  /** Mouvement réduit, ou Ambiance coupée : fondu enchaîné. */
  fondu: 160,
  /** Après `G`, la touche suivante est attendue ce temps-là. */
  attenteG: 1200,
  /** La session se termine après quatre heures sans activité. */
  finDeSession: 4 * 3_600_000,
} as const;

/** « ⌘ » sur macOS, « Ctrl » ailleurs — la maquette écrit ⌘, l'interface dit la vérité. */
export function touchePrincipale(): '⌘' | 'Ctrl' {
  if (typeof navigator === 'undefined') return 'Ctrl';
  return /mac/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';
}
