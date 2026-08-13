/**
 * Le message qui accompagne un lien d'appel.
 *
 * ## Le problème, constaté en usage réel
 *
 * Aaron a collé un lien d'appel dans la barre de recherche Google au lieu de
 * la barre d'adresse. Le lien fonctionnait ; rien n'aidait à comprendre qu'il
 * fallait l'ouvrir directement.
 *
 * Ce n'est pas une inattention isolée : les deux barres se ressemblent, la
 * barre de recherche est celle qu'on utilise cent fois par jour, et un lien
 * reçu dans un message se colle par réflexe dans la première case venue. Le
 * destinataire, lui, ne verra JAMAIS l'écran qui a servi à créer le lien — donc
 * un avertissement affiché dans l'application ne le protège pas.
 *
 * ## D'où ce module
 *
 * L'instruction doit voyager AVEC le lien. Ce que l'opérateur copie n'est donc
 * pas une adresse nue mais un message prêt à envoyer, qui porte l'adresse, la
 * consigne d'ouverture et la durée de validité. C'est le seul endroit où la
 * consigne atteint réellement la personne qui va se tromper.
 *
 * ## Pourquoi le jeton reste dans le fragment (`#`)
 *
 * Un fragment d'URL n'est jamais transmis au serveur : il ne se retrouve donc
 * ni dans les journaux d'accès, ni dans un en-tête `Referer`. C'est ce qui
 * garde le jeton hors de portée de toute la chaîne HTTP, et cela ne se négocie
 * pas contre un peu de confort de collage.
 */

/** Une durée lisible à partir d'une date d'expiration : « 30 minutes », « 2 heures ». */
export function validityLabel(expiresAt: string, now: number = Date.now()): string {
  const ms = Date.parse(expiresAt) - now;
  if (!Number.isFinite(ms) || ms <= 0) return 'quelques instants';
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  const hours = Math.round(minutes / 60);
  return `${hours} heure${hours > 1 ? 's' : ''}`;
}

/**
 * Le message prêt à envoyer.
 *
 * L'adresse est seule sur sa ligne : c'est ce qui permet aux messageries de la
 * détecter comme un lien cliquable, et un lien cliquable est le chemin qui
 * évite complètement le collage manuel.
 */
export function callInvitationMessage(url: string, expiresAt: string, now: number = Date.now()): string {
  return [
    'Voici le lien pour notre appel :',
    '',
    url,
    '',
    'À ouvrir directement : cliquez dessus, ou collez-le dans la barre d’adresse de votre navigateur — pas dans une barre de recherche.',
    `Il expire dans ${validityLabel(expiresAt, now)} et ne fonctionne qu’une seule fois.`,
  ].join('\n');
}
