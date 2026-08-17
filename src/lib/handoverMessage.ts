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
}

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export function handoverMessage(parts: HandoverParts): string {
  const lines: string[] = [];

  lines.push(`Bonjour,`);
  lines.push('');
  lines.push(
    `Votre espace de travail ${parts.orgName} est prêt. Voici tout ce qu'il vous faut pour démarrer.`,
  );
  lines.push('');

  // 1. L'installation d'abord : c'est le geste le plus long, et il peut se faire
  //    pendant qu'on lit la suite.
  if (parts.download) {
    lines.push(`1) INSTALLER L'APPLICATION (${megabytes(parts.download.byteSize)})`);
    lines.push('');
    lines.push(parts.download.url);
    lines.push('');
    lines.push(
      "Cliquez sur ce lien pour télécharger l'installateur Windows, puis ouvrez le fichier téléchargé.",
    );
    lines.push('');
    lines.push('2) VOUS CONNECTER');
  } else {
    lines.push('POUR VOUS CONNECTER');
  }

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
  lines.push(
    "Une fois connecté, tout est en place : vos modules sont déjà activés, il n'y a rien à configurer.",
  );
  lines.push('');
  lines.push('Bonne prise en main,');

  return lines.join('\n');
}
