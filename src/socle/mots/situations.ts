/**
 * Les mots du groupe « situations » du socle (LOT-00, écran H43). Même schéma que `src/socle/i18n.ts` :
 * l'anglais est la base, le français est typé contre lui. Fusionnés dans `i18n.ts`.
 *
 * Les noms d'objets, de personnes et de recherches sont TOUJOURS des variables : `{objet}` (au
 * singulier, en minuscules : « client »), `{objets}` (au pluriel, sans déterminant : « clients »),
 * `{terme}`, `{proche}`, `{prenom}`, `{n}`. Aucun nom d'exemple n'est écrit ici.
 *
 * Typographie française (fiche H43, règles d'écriture) : guillemets « » avec espaces insécables
 * (U+00A0) à l'intérieur, espace insécable avant « ? » et « : », apostrophe typographique comme
 * partout dans le socle. Aucun point d'exclamation, aucun code d'erreur, vouvoiement.
 */
export const EN_SITUATIONS = {
  'etat.vide.titre': 'No {objet} yet',
  'etat.vide.texte': 'Add your first {objet} or import a file.',
  'etat.vide.texteSeul': 'Add your first {objet}.',
  'etat.vide.texteLecture': 'Nothing has been added here yet. The help explains how.',
  'etat.vide.ajouter': 'Add',
  'etat.vide.importer': 'Import',
  'etat.vide.aide': 'See the help',

  'etat.hors.titre': 'You are offline',
  'etat.hors.texte': 'Your changes are kept on this device and will be sent as soon as the network is back.',
  'etat.hors.reessayer': 'Try again',

  'etat.acces.titre': 'This page is restricted',
  'etat.acces.texte': 'Ask {prenom} for access. They get your request right away.',
  'etat.acces.demander': 'Request access',
  'etat.acces.envoye': 'Request sent',
  'etat.acces.prevenu': '{prenom} has been notified.',

  'etat.aucun.titre': 'Nothing for “{terme}”',
  'etat.aucun.proche': 'Did you mean {proche}? If not, try another word.',
  'etat.aucun.sans': 'Try another word or clear the search.',
  'etat.aucun.voir': 'See {proche}',
  'etat.aucun.effacer': 'Clear the search',

  'etat.erreur.titre': 'The {objets} could not be loaded.',
  'etat.erreur.texte': 'Nothing is lost. Try again in a moment.',
  'etat.erreur.reessayer': 'Try again',

  'chargement.legende': 'Loading your {objets}',
  'chargement.long': 'This is taking longer than usual',
  'chargement.reessayer': 'Try again',

  'dialogue.annuler': 'Cancel',

  'toast.annuler': 'Undo',
  'toast.disparait': 'Disappears in {n} s',
  'toast.erreur': 'Your change could not be saved.',
  'toast.reessayer': 'Try again',
  'toast.fermer': 'Close the notification',

  'avis.pile': 'People on this page',
  'avis.phrase': '{prenom} is also editing this page',
  'avis.fusion.avant': 'Your changes and theirs are ',
  'avis.fusion.mot': 'merged',
  'avis.fusion.apres': '. Nothing is overwritten, a copy is kept.',
  'avis.differences': 'Differences',
  'avis.garder': 'Keep both',
} as const;

export const FR_SITUATIONS: Record<keyof typeof EN_SITUATIONS, string> = {
  'etat.vide.titre': 'Aucun {objet} pour l’instant',
  'etat.vide.texte': 'Ajoutez votre premier {objet} ou importez un fichier.',
  'etat.vide.texteSeul': 'Ajoutez votre premier {objet}.',
  'etat.vide.texteLecture': 'Rien n’a encore été ajouté ici. L’aide explique comment faire.',
  'etat.vide.ajouter': 'Ajouter',
  'etat.vide.importer': 'Importer',
  'etat.vide.aide': 'Voir l’aide',

  'etat.hors.titre': 'Vous êtes hors connexion',
  'etat.hors.texte': 'Vos modifications sont gardées sur cet appareil et partiront dès le retour du réseau.',
  'etat.hors.reessayer': 'Réessayer',

  'etat.acces.titre': 'Cette page est réservée',
  'etat.acces.texte': 'Demandez l’accès à {prenom}, il reçoit votre demande tout de suite.',
  'etat.acces.demander': 'Demander l’accès',
  'etat.acces.envoye': 'Demande envoyée',
  'etat.acces.prevenu': '{prenom} a été prévenu.',

  'etat.aucun.titre': 'Rien pour «\u00A0{terme}\u00A0»',
  'etat.aucun.proche': 'Vouliez-vous dire {proche}\u00A0? Sinon, essayez un autre mot.',
  'etat.aucun.sans': 'Essayez un autre mot ou effacez la recherche.',
  'etat.aucun.voir': 'Voir {proche}',
  'etat.aucun.effacer': 'Effacer la recherche',

  'etat.erreur.titre': 'Les {objets} n’ont pas pu être chargés.',
  'etat.erreur.texte': 'Rien n’est perdu. Réessayez dans un instant.',
  'etat.erreur.reessayer': 'Réessayer',

  'chargement.legende': 'Chargement de vos {objets}',
  'chargement.long': 'C’est plus long que d’habitude',
  'chargement.reessayer': 'Réessayer',

  'dialogue.annuler': 'Annuler',

  'toast.annuler': 'Annuler',
  'toast.disparait': 'Disparaît dans {n} s',
  'toast.erreur': 'Votre modification n’a pas pu être enregistrée.',
  'toast.reessayer': 'Réessayer',
  'toast.fermer': 'Fermer la notification',

  'avis.pile': 'Personnes sur cette page',
  'avis.phrase': '{prenom} modifie aussi cette page',
  'avis.fusion.avant': 'Vos changements et les siens sont ',
  'avis.fusion.mot': 'fusionnés',
  'avis.fusion.apres': '. Rien n’est écrasé, une copie est gardée.',
  'avis.differences': 'Différences',
  'avis.garder': 'Garder les deux',
};
