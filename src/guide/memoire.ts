/**
 * CE QUE LE GUIDE RETIENT — sur ce poste, par compte.
 *
 * Deux souvenirs seulement : « la visite générale a été vue (ou passée) » et
 * « la question du profil a été posée ». Le profil lui-même vit sur le profil
 * synchronisé du compte, pas ici : il suit la personne d'un poste à l'autre.
 * Tout se comporte correctement si le stockage est refusé : le guide se
 * propose de nouveau, ce qui coûte un clic.
 */
const CLE = (quoi: string, email: string) => `amn.guide.${quoi}.${email || 'anonyme'}`;

export function guideVu(quoi: 'general' | 'profil', email: string): boolean {
  try {
    return window.localStorage.getItem(CLE(quoi, email)) === 'vu';
  } catch {
    return false;
  }
}

export function marquerGuide(quoi: 'general' | 'profil', email: string, vu = true): void {
  try {
    if (vu) window.localStorage.setItem(CLE(quoi, email), 'vu');
    else window.localStorage.removeItem(CLE(quoi, email));
  } catch {
    /* stockage refusé : le guide se reproposera */
  }
}

export const EVENEMENT_GUIDE = 'amn:guide';
export const signalerGuide = () => window.dispatchEvent(new Event(EVENEMENT_GUIDE));
