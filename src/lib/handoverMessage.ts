import { CLIENT_PRODUCT_NAME } from '../edition/edition';
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
  /** Qui invite (le champ de l'Atelier) : « Harun » → « Harun, de l’équipe AMN ». */
  invitePar?: string | null;
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

/*
  LE MESSAGE D'INVITATION = LA PARTIE TEXTE DE L'E-MAIL DE MARQUE (cahier 43a).

  « Tant qu'amn-api n'envoie pas, c'est la partie texte qui se copie à la main,
  à la place du message brut actuel » (ARRIVEE.md, Envoi). Elle est reprise mot
  pour mot de `arrivee/email/invitation.template.txt` : le même texte, que le
  courriel parte seul ou qu'on le colle soi-même. L'expiration est dite à
  l'heure exacte de Paris — le lien dure 7 × 24 h depuis l'émission.
*/
const PARIS = 'Europe/Paris';
function expirationEnToutesLettres(iso: string): string {
  const d = new Date(iso);
  const jour = Number(d.toLocaleDateString('fr-FR', { day: 'numeric', timeZone: PARIS }));
  const semaine = d.toLocaleDateString('fr-FR', { weekday: 'long', timeZone: PARIS });
  const mois = d.toLocaleDateString('fr-FR', { month: 'long', timeZone: PARIS });
  const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: PARIS });
  return `${semaine} ${jour === 1 ? '1er' : jour} ${mois} à ${heure}`;
}

function messageInvitation(parts: HandoverParts): string {
  const qui = parts.invitePar?.trim() || 'AMN';
  return [
    handoverSubject(parts),
    '',
    `${qui}, de l’équipe AMN, vous invite à activer l’espace de travail de ${parts.orgName} sur ${CLIENT_PRODUCT_NAME}.`,
    '',
    'Activer mon espace\u00a0:',
    parts.secret,
    '',
    parts.expiresAt
      ? `Ce lien est valable jusqu’au ${expirationEnToutesLettres(parts.expiresAt)}, et ne sert qu’une fois.`
      : 'Ce lien ne sert qu’une fois.',
    'Vous choisirez votre mot de passe à l’ouverture. Il n’est écrit nulle part\u00a0: ni dans ce message, ni chez nous.',
    '',
    'Vous n’attendiez pas cette invitation\u202f? Ne faites rien\u00a0: sans activation, aucun compte ne s’ouvre.',
    '',
    '—',
    `${CLIENT_PRODUCT_NAME} · envoyé à ${parts.email} à la demande de ${qui}, de l’équipe AMN`,
  ].join('\n');
}

export function handoverMessage(parts: HandoverParts): string {
  if (parts.kind === 'invitation') return messageInvitation(parts);
  const l: string[] = [];
  l.push('Bonjour,');
  l.push('');
  l.push(`Votre espace ${parts.orgName} vous attend.`);
  l.push('');
  l.push(`Votre identifiant : ${parts.email}`);
  l.push('Votre mot de passe provisoire vous est communiqué à part. Remplacez-le par le vôtre dans Paramètres dès votre première connexion.');
  if (parts.webUrl) {
    l.push('');
    l.push('Votre espace s’ouvre ici, sur ordinateur comme sur téléphone :');
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
