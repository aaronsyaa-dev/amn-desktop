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

/*
  LE MESSAGE D'ARRIVÉE, RÉÉCRIT (U4, 24 septembre 2026).

  L'ancien message ressemblait à un ticket de support : trois sections
  numérotées en capitales, l'identifiant ET le mot de passe collés en clair,
  des consignes de sécurité à lire avant d'avoir vu le produit. Le principe
  change :

    · un lien, un geste. Le lien d'activation (mode par défaut) fait choisir
      son mot de passe à la cliente ; le message ne contient AUCUN secret
      réutilisable — un lien à usage unique qui périme n'en est pas un ;
    · en mode « mot de passe provisoire », le mot de passe ne figure PLUS dans
      le message : il se transmet à part (téléphone, SMS), l'Atelier le montre
      seul avec son propre bouton de copie ;
    · court : on donne envie d'ouvrir, la présentation du produit se fait
      DANS le produit, à la première connexion (guide/Presentation.tsx) ;
    · un objet de courriel, parce qu'un courriel sans objet finit en
      indésirables.
*/
export function handoverSubject(parts: Pick<HandoverParts, 'orgName'>): string {
  return `Votre espace ${parts.orgName} est prêt`;
}

export function handoverMessage(parts: HandoverParts): string {
  const l: string[] = [];
  l.push('Bonjour,');
  l.push('');
  if (parts.kind === 'invitation') {
    l.push(`Votre espace ${parts.orgName} vous attend. Un clic pour choisir votre mot de passe et entrer :`);
    l.push('');
    l.push(parts.secret);
    l.push('');
    const date = parts.expiresAt ? new Date(parts.expiresAt) : null;
    const jusqua = date ? ` jusqu’au ${date.getDate() === 1 ? '1er' : date.getDate()} ${date.toLocaleDateString('fr-FR', { month: 'long' })}` : '';
    l.push(`Ce lien vous est personnel, fonctionne une seule fois et reste valable${jusqua}.`);
  } else {
    l.push(`Votre espace ${parts.orgName} vous attend.`);
    l.push('');
    l.push(`Votre identifiant : ${parts.email}`);
    l.push('Votre mot de passe provisoire vous est communiqué à part. Remplacez-le par le vôtre dans Paramètres dès votre première connexion.');
  }
  if (parts.webUrl) {
    l.push('');
    l.push(parts.kind === 'invitation' ? 'Ensuite, votre espace s’ouvre ici, sur ordinateur comme sur téléphone :' : 'Votre espace s’ouvre ici, sur ordinateur comme sur téléphone :');
    l.push('');
    l.push(parts.webUrl);
  }
  if (parts.download) {
    l.push('');
    l.push(`Vous préférez l’application pour Windows (${megabytes(parts.download.byteSize)}) :`);
    l.push('');
    l.push(parts.download.url);
  }
  l.push('');
  l.push('À la première ouverture, votre espace se présente en deux minutes. Tout y est déjà en place.');
  l.push('');
  l.push('À tout de suite,');
  return l.join('\n');
}
