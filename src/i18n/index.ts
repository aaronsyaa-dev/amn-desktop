import { useEffect, useState } from 'react';
import { en, type CleTraduction, type Dictionnaire } from './en';
import { fr } from './fr';
import { ESPACES_EN, NAV_EN, SECTIONS_EN } from '@edition/navLexique';

export type { CleTraduction, Dictionnaire };

/**
 * LA LANGUE — un magasin de module, pas une bibliothèque
 * ═════════════════════════════════════════════════════
 *
 * Deux langues aujourd'hui, l'architecture pour beaucoup : l'ANGLAIS est la
 * langue de base (le schéma — chaque clé y existe, et une langue future
 * incomplète y retombe), le FRANÇAIS est complet par construction (typé
 * contre le schéma : une clé oubliée ne compile pas).
 *
 * ## Qui décide de la langue affichée
 *
 *   1. le choix de la PERSONNE sur ce poste (Réglages → Langue) ;
 *   2. sinon, la langue de l'ORGANISATION (choisie à l'atelier, portée par
 *      l'identité de session) ;
 *   3. sinon, le français — le produit existant ne perd rien.
 *
 * ## Pourquoi pas i18next
 *
 * Zéro dépendance nouvelle, des clés TYPÉES (une faute de frappe ne compile
 * pas), et un magasin de module comme `poulsDuParc` : les composants
 * s'abonnent, `changerLangue` re-rend tout. La pluralisation reste dans les
 * composants ou dans `releve.ts` — chaque langue y a sa GRAMMAIRE, jamais un
 * gabarit traduit mot à mot.
 */

export type Langue = 'fr' | 'en';
export const LANGUES: readonly Langue[] = ['fr', 'en'];

const CLE_CHOIX = 'amn.langue.utilisateur';

const DICTIONNAIRES: Record<Langue, Dictionnaire> = { en, fr };

let langueOrganisation: Langue | null = null;
let choixUtilisateur: Langue | null = lireChoix();
const abonnes = new Set<() => void>();

function lireChoix(): Langue | null {
  try {
    const brut = window.localStorage.getItem(CLE_CHOIX);
    return brut === 'fr' || brut === 'en' ? brut : null;
  } catch {
    return null;
  }
}

function prevenir() {
  for (const a of abonnes) a();
}

export function langueActive(): Langue {
  return choixUtilisateur ?? langueOrganisation ?? 'fr';
}

/** Le choix de la personne, sur ce poste. `null` = suivre l'organisation. */
export function changerLangue(langue: Langue | null): void {
  choixUtilisateur = langue;
  try {
    if (langue) window.localStorage.setItem(CLE_CHOIX, langue);
    else window.localStorage.removeItem(CLE_CHOIX);
  } catch {
    /* stockage indisponible : le choix vaudra pour cette session seulement */
  }
  prevenir();
}

export function choixDeLUtilisateur(): Langue | null {
  return choixUtilisateur;
}

/** Posée par le contexte d'authentification quand l'organisation est connue. */
export function poserLangueOrganisation(langue: string | null | undefined): void {
  const propre = langue === 'fr' || langue === 'en' ? langue : null;
  if (propre === langueOrganisation) return;
  langueOrganisation = propre;
  prevenir();
}

export function langueDeLOrganisation(): Langue | null {
  return langueOrganisation;
}

/** Traduit une clé, avec interpolation `{nom}`. */
export function t(cle: CleTraduction, valeurs?: Record<string, string | number>): string {
  const langue = langueActive();
  // L'anglais est la BASE : une langue future incomplète y retombe, jamais
  // sur un trou. Le français est complet par type — le repli n'y joue pas.
  const brut = DICTIONNAIRES[langue][cle] ?? en[cle];
  if (!valeurs) return brut;
  return brut.replace(/\{(\w+)\}/g, (tout, nom: string) =>
    nom in valeurs ? String(valeurs[nom]) : tout,
  );
}

/* ── La navigation : le catalogue français, traduit au rendu ─────────────────
 *
 * Les catalogues de modules restent la SOURCE française (les gardes de
 * check-modules lisent leurs littéraux) ; l'anglais vit dans `nav.en.ts`,
 * par clé de module, et se résout ICI, au moment d'afficher. Une entrée
 * absente retombe sur le français — visible, honnête.
 */

export type SurfaceNav = 'interne' | 'business' | 'support';

export function libelleNav(item: { key: string; label: string }): string {
  if (langueActive() !== 'en') return item.label;
  return NAV_EN[item.key]?.label ?? item.label;
}

export function indiceNav(
  item: { key: string; hint: string },
  surface: SurfaceNav = 'interne',
): string {
  if (langueActive() !== 'en') return item.hint;
  const entree = NAV_EN[item.key];
  if (!entree) return item.hint;
  const specifique =
    surface === 'business' ? entree.hintBusiness : surface === 'support' ? entree.hintSupport : undefined;
  return specifique ?? entree.hint ?? item.hint;
}

export function libelleSection(label: string): string {
  if (langueActive() !== 'en') return label;
  return SECTIONS_EN[label] ?? label;
}

export function libelleEspace(space: { key: string; label: string; hint: string }): {
  label: string;
  hint: string;
} {
  if (langueActive() !== 'en') return { label: space.label, hint: space.hint };
  return ESPACES_EN[space.key] ?? { label: space.label, hint: space.hint };
}

/** L'abonnement React : re-rend le composant quand la langue change. */
export function useLangue(): { langue: Langue; t: typeof t } {
  const [, forcer] = useState(0);
  useEffect(() => {
    const abonne = () => forcer((n) => n + 1);
    abonnes.add(abonne);
    return () => {
      abonnes.delete(abonne);
    };
  }, []);
  return { langue: langueActive(), t };
}
