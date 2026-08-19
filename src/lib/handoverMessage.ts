/**
 * LE MESSAGE À ENVOYER À UNE NOUVELLE CLIENTE (BLOC F)
 * ════════════════════════════════════════════════════
 *
 * L'écran de remise porte deux liens depuis le chantier précédent, et pourtant :
 * « je ne comprends toujours pas concrètement comment envoyer un desktop à un
 * client ». Le diagnostic est net — montrer deux liens n'est pas dire quoi en
 * faire. Aaron devait composer lui-même un courriel expliquant lequel sert à
 * quoi, dans quel ordre, et ce qui est urgent.
 *
 * Ce module rend ce courriel tout fait. Même parti pris que le message du lien
 * d'appel (voir callInvite.ts), qui a résolu exactement le même problème :
 *
 *   · chaque adresse est SEULE SUR SA LIGNE, pour que les messageries la
 *     détectent comme un lien cliquable — et un lien cliquable évite tout
 *     collage manuel, donc toute erreur de collage ;
 *   · l'ORDRE des gestes est écrit, parce que « installer » et « se connecter »
 *     ne sont pas interchangeables ;
 *   · ce qui PÉRIME est signalé là où ça se lit, pas en note de bas de page.
 *
 * Le texte tutoie l'usage, pas la cliente : Aaron l'enverra tel quel ou le
 * retouchera, et dans les deux cas il n'a plus rien à inventer.
 */

export interface HandoverParts {
  orgName: string;
  /** L'adresse du compte, telle qu'elle a été saisie. */
  email: string;
  /** Mot de passe temporaire, ou jeton d'activation. */
  secret: string;
  kind: 'password' | 'invitation';
  /** ISO — présent seulement pour un lien d'activation. */
  expiresAt?: string;
  /** L'installeur, quand une version est publiée. */
  download?: { url: string; version: string; byteSize: number } | null;
  /**
   * L'adresse de l'application web, telle que le SERVEUR la connaît.
   *
   * Jamais composée ici : une application installée charge ses pages en
   * `file://` et ne peut rien deviner de son adresse publique. Elle arrive
   * d'amn-api (`appUrl`, voir routes/admin.js), et vaut `null` tant que
   * APP_BUSINESS_PUBLIC_URL n'est pas configurée.
   *
   * C'est bien l'adresse de l'application BUSINESS, pas celle de la nôtre :
   * les deux étaient une seule variable, et le message envoyé à une cliente
   * portait donc l'adresse de l'application interne.
   */
  webUrl?: string | null;
}

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export function handoverMessage(parts: HandoverParts): string {
  const lines: string[] = [];

  /*
    LA NUMÉROTATION SUIT CE QUI EXISTE, ET RIEN D'AUTRE.

    Trois sections possibles — installer, se connecter, le téléphone — mais
    l'installeur n'existe que si une version est publiée, et l'adresse web que
    si le serveur en connaît une. Un compteur plutôt que des numéros écrits en
    dur : un message qui saute de « 1) » à « 3) » se lit comme un message dont
    on a perdu un morceau, et c'est exactement l'impression à ne pas donner à
    quelqu'un qui ouvre le produit pour la première fois.
  */
  const sections = (parts.download ? 1 : 0) + 1 + (parts.webUrl ? 1 : 0);
  let n = 0;
  const titre = (texte: string) => (sections > 1 ? `${++n}) ${texte}` : texte);

  lines.push(`Bonjour,`);
  lines.push('');
  lines.push(
    `Votre espace de travail ${parts.orgName} est prêt. Voici tout ce qu'il vous faut pour démarrer.`,
  );
  lines.push('');

  // 1. L'installation d'abord : c'est le geste le plus long, et il peut se faire
  //    pendant qu'on lit la suite.
  if (parts.download) {
    lines.push(titre(`INSTALLER L'APPLICATION (${megabytes(parts.download.byteSize)})`));
    lines.push('');
    lines.push(parts.download.url);
    lines.push('');
    lines.push(
      "Cliquez sur ce lien pour télécharger l'installateur Windows, puis ouvrez le fichier téléchargé.",
    );
    lines.push('');
  }

  /*
    L'ADRESSE WEB — la moitié du produit qui manquait à ce message.

    Il ne portait que l'installeur Windows. Une cliente qui le reçoit sur son
    téléphone, loin de son ordinateur, n'avait donc rien à ouvrir — alors que
    l'application web existe et fonctionne, et que la console affirmait même
    « la cliente pourra travailler depuis la version web » sans jamais donner
    l'adresse. Une promesse sans son moyen.

    Sa PLACE dépend de ce qu'il y a d'autre. Avec un installeur, elle vient
    après la connexion : c'est un complément, on ne détourne pas quelqu'un de
    l'application complète. Sans installeur, c'est le seul chemin qui existe,
    donc elle passe en premier — proposer un mot de passe avant de dire où
    l'utiliser est un ordre qu'on ne suit pas.
  */
  const blocWeb = () => {
    lines.push(
      titre(parts.download ? 'SUR VOTRE TÉLÉPHONE' : "OUVRIR L'APPLICATION"),
    );
    lines.push('');
    lines.push(parts.webUrl as string);
    lines.push('');
    lines.push(
      parts.download
        ? "Ouvrez cette adresse depuis votre téléphone, avec les mêmes identifiants. Choisissez ensuite « Ajouter à l'écran d'accueil » dans le menu de votre navigateur : vous aurez une icône, comme une vraie application."
        : "Ouvrez cette adresse dans votre navigateur, sur ordinateur comme sur téléphone. Sur téléphone, choisissez « Ajouter à l'écran d'accueil » dans le menu du navigateur : vous aurez une icône, comme une vraie application.",
    );
    lines.push('');
    lines.push(
      "C'est le même espace de travail des deux côtés — ce que vous écrivez ici apparaît là-bas.",
    );
    lines.push('');
  };

  if (parts.webUrl && !parts.download) blocWeb();

  lines.push(titre('VOUS CONNECTER'));
  lines.push('');
  lines.push(`Identifiant : ${parts.email}`);

  if (parts.kind === 'password') {
    lines.push(`Mot de passe provisoire : ${parts.secret}`);
    lines.push('');
    lines.push(
      'Changez-le dès votre première connexion, dans Paramètres. Ce mot de passe ne périme pas, mais il a été transmis par message : ne le gardez pas.',
    );
  } else {
    lines.push('');
    lines.push("Choisissez votre mot de passe avec ce lien d'activation :");
    lines.push('');
    lines.push(parts.secret);
    lines.push('');
    const when = parts.expiresAt
      ? ` Il est valable jusqu'au ${new Date(parts.expiresAt).toLocaleDateString('fr-FR')}`
      : ' Il est valable quelques jours';
    lines.push(`${when.trim()} et ne fonctionne qu'une seule fois.`);
  }
  lines.push('');

  if (parts.webUrl && parts.download) blocWeb();

  lines.push(
    "Une fois connecté, tout est en place : vos modules sont déjà activés, il n'y a rien à configurer.",
  );
  lines.push('');
  lines.push('Bonne prise en main,');

  return lines.join('\n');
}
