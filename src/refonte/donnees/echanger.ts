/**
 * LES JEUX « ÉCHANGER » — messagerie d'équipe (G07), canaux (MX04), annonces
 * (H14), courriel (MX01), salles et appels (H13), réunions (MX02), partages de
 * fichiers (MX03), sondages (MX05), réponses automatiques (MX06).
 *
 * Les non-lus d'une conversation sont ceux de ses messages : le compteur et les
 * messages marqués non lus se recoupent. Aucun message ne porte de secret, de
 * pièce jointe réelle ni d'adresse hors `.exemple.test`.
 */

import { totauxDeFacture } from './argent';
import { ageRecent, apercu, cle, cycle, fabriquer, hasardDe, nomClient, quand, salaries } from './commun';
import { ajouterJours, compter, type Hasard } from './outils';
import { moi } from './equipe';
import type { Contexte, Evenement, Facture, FicheClient, Interlocuteur, Membre } from './types';
import type {
  Annonce, Appel, Canal, Conversation, Courriel, Fichier, MessageEquipe, Partage, ReponseAuto, Reunion, Salle, Sondage,
} from './types-suite';

const hhmm = (h: Hasard): string => `${String(h.entier(8, 18)).padStart(2, '0')}:${String(h.entier(0, 59)).padStart(2, '0')}`;

/* ---------------------- Conversations et messages (G07) ---------------------- */

const PAROLES_EQUIPE = [
  'Bonjour à tous, le point de 9 h 30 est avancé à 9 h.', 'Le devis est parti, je vous dis dès qu’il y a une réponse.', 'Qui peut relire la page d’accueil avant midi ?',
  'Facture réglée, merci pour la relance.', 'Je suis chez un client jusqu’à 15 h, joignable par message.', 'Pensez à justifier vos dépenses avant le 5.',
  'La sauvegarde de cette nuit s’est bien passée.', 'Bonne idée, on en parle lundi.', 'J’ai mis à jour le planning de la semaine prochaine.',
  'Merci ! Je m’en occupe cet après-midi.', 'Un client demande un rendez-vous jeudi, qui est disponible ?', 'Le compte rendu est dans les pages.',
];
const PAROLES_CLIENT = [
  'Bonjour, pouvez-vous me renvoyer le devis au format PDF ?', 'Merci pour votre retour rapide.', 'Nous avons bien reçu la facture, règlement prévu cette semaine.',
  'Serait-il possible de déplacer notre rendez-vous à jeudi ?', 'Parfait, nous validons la maquette.', 'Pouvez-vous ajouter une page « Tarifs » ?',
  'Bonjour, le site ne s’affiche plus correctement sur mon téléphone.', 'Merci, tout fonctionne de nouveau.',
];
const PAROLES_ANNONCES = ['Bienvenue dans l’espace des annonces de l’équipe.', 'Rappel : la clôture du mois a lieu vendredi.', 'Nouvelle procédure de sauvegarde disponible dans les pages.'];
const EMOJIS = ['👍', '👀', '✅', '🔥', '❗'] as const;

export function genererConversations(
  ctx: Contexte,
  equipe: readonly Membre[],
  clients: readonly FicheClient[],
  factures: readonly Facture[],
): { conversations: Conversation[]; messages: MessageEquipe[] } {
  const h = hasardDe(ctx.graine, 'conversations');
  const nConv = compter(ctx.volumes.conversations, [0, 3, 8, 30]);
  const totalMessages = compter(ctx.volumes.messages, [0, 12, 120, 1500]);
  if (nConv === 0 || totalMessages === 0) return { conversations: [], messages: [] };
  const m = moi(equipe);
  const gens = salaries(equipe);
  const autres = gens.filter((g) => g.email !== m.email);
  const types = cycle(h, ['équipe', 'personne', 'client', 'personne', 'client', 'annonces'] as const, nConv);
  // Chaque type apparaît dès que le volume le permet : l'équipe d'abord, puis une personne, puis un client.
  types.splice(0, Math.min(3, nConv), ...(['équipe', 'personne', 'client'] as const).slice(0, Math.min(3, nConv)));
  const conversations: Conversation[] = [];
  const messages: MessageEquipe[] = [];
  let idMessage = 0;
  types.forEach((type, i) => {
    const c = type === 'client' && clients.length ? h.choix(clients) : null;
    const pair = type === 'personne' && autres.length ? h.choix(autres) : null;
    const membres = type === 'équipe' || type === 'annonces' ? gens.map((g) => g.email) : type === 'personne' ? [m.email, pair?.email ?? m.email] : [m.email, ...h.echantillon(gens.filter((g) => g.email !== m.email), 1).map((g) => g.email)];
    const nom = type === 'équipe' ? 'Équipe' : type === 'annonces' ? 'Annonces' : type === 'personne' ? pair?.nomComplet ?? 'Message à moi-même' : c ? nomClient(c) : 'Client';
    const nb = Math.max(2, Math.round((totalMessages / nConv) * h.choix([0.5, 0.8, 1, 1.4, 1.8])));
    const pool = type === 'client' ? PAROLES_CLIENT : type === 'annonces' ? PAROLES_ANNONCES : PAROLES_EQUIPE;
    const parties: MessageEquipe[] = [];
    // Les plus récents sont les plus nombreux ; la conversation se termine "à l'instant" pour les premières de la liste.
    let t = ctx.maintenant - (i === 0 ? h.entier(3, 40) * 60_000 : h.entier(1, 1 + i * 20) * 3_600_000);
    for (let k = 0; k < nb; k += 1) {
      const ecrivains = type === 'client' ? [m.email, c?.email ?? 'client@exemple.test'] : membres;
      const email = h.choix(ecrivains);
      const interne = equipe.find((g) => g.email === email);
      let corps = h.choix(pool);
      if (type !== 'client' && factures.length && h.chance(0.12)) corps = `Je relance la facture ${h.choix(factures.filter((f) => f.number)).number}${factures.length ? '' : ''}.`;
      idMessage += 1;
      parties.push({
        id: idMessage,
        authorEmail: email,
        authorName: interne?.nomComplet ?? c?.name ?? 'Client',
        body: corps,
        createdAt: new Date(t).toISOString(),
        attachments: [],
        replyToId: null,
        reactions: h.chance(0.12) ? [{ emoji: h.choix(EMOJIS), authorEmail: h.choix(membres) }] : [],
        pinned: false,
        conversationId: cle('cv', i + 1),
        lu: true,
      });
      t -= h.entier(2, 90) * 60_000 * (type === 'annonces' ? 40 : 1);
    }
    parties.reverse();
    parties.forEach((msg, k) => { if (k > 0 && h.chance(0.08)) msg.replyToId = parties[k - 1].id; });
    // Non lus : les derniers messages d'autres personnes, au plus trois, dans environ une conversation sur trois.
    const nonLus = i === 0 || h.chance(0.35) ? h.entier(1, 3) : 0;
    let restant = nonLus;
    for (let k = parties.length - 1; k >= 0 && restant > 0; k -= 1) {
      if (parties[k].authorEmail !== m.email) { parties[k].lu = false; restant -= 1; }
    }
    const dernier = parties[parties.length - 1];
    conversations.push({
      id: cle('cv', i + 1),
      type,
      nom,
      membres,
      clientId: c?.id ?? null,
      dernierMessageAt: dernier.createdAt,
      apercu: `${dernier.authorEmail === m.email ? 'Vous' : dernier.authorName.split(' ')[0]} : ${apercu(dernier.body, 60)}`,
      nonLus: parties.filter((x) => !x.lu).length,
    });
    messages.push(...parties);
  });
  // Un message épinglé par conversation d'équipe, pour montrer la fonction.
  const epingle = messages.find((x) => x.conversationId === conversations[0].id);
  if (epingle) epingle.pinned = true;
  return {
    conversations: conversations.sort((a, b) => b.dernierMessageAt.localeCompare(a.dernierMessageAt)),
    messages: messages.sort((a, b) => a.id - b.id),
  };
}

/* ---------------------------------- Canaux ---------------------------------- */

const CANAUX: readonly (readonly [string, string, boolean, boolean])[] = [
  ['general', 'Tout ce qui concerne toute l’équipe.', true, false], ['tickets-urgents', 'Alerte immédiate sur les tickets urgents.', true, true],
  ['commercial', 'Devis, relances et prospects.', true, false], ['production', 'Sites en cours et livraisons.', true, false],
  ['compta', 'Factures, TVA et notes de frais.', false, false], ['securite', 'Sauvegardes et mises à jour.', true, false],
  ['idees', 'Propositions pour améliorer le travail.', true, false], ['accueil-clients', 'Nouvelles arrivées et rendez-vous.', true, false],
  ['direction', 'Sujets réservés à la direction.', false, false], ['stock', 'Réceptions et ruptures.', true, false],
];

export function genererCanaux(ctx: Contexte, equipe: readonly Membre[]): Canal[] {
  const h = hasardDe(ctx.graine, 'canaux');
  const n = compter(ctx.volumes.canaux, [0, 3, 8, 20]);
  const m = moi(equipe);
  const gens = salaries(equipe);
  const sources = n <= CANAUX.length ? CANAUX : [...CANAUX, ...fabriquer(n - CANAUX.length, (i) => [`projet-${i}`, `Espace du projet ${i}.`, true, false] as const)];
  return sources.slice(0, n).map(([nom, description, publique, urgents], i) => {
    const membres = publique ? gens.map((g) => g.email) : h.echantillon(gens, Math.max(2, Math.ceil(gens.length / 2))).map((g) => g.email);
    if (!publique && !membres.includes(m.email)) membres.push(m.email);
    const auteur = gens.find((g) => g.email === h.choix(membres)) ?? m;
    const dernier = ctx.maintenant - ageRecent(h, 14) * 86_400_000 - h.entier(0, 600) * 60_000;
    return {
      id: cle('ca', i + 1),
      nom,
      description,
      visibilite: publique ? ('public' as const) : ('privé' as const),
      membres,
      epinglePar: i < 2 ? [m.email] : [],
      archive: i === sources.length - 1 && n >= 10,
      alerteTicketsUrgents: urgents,
      dernierMessageAt: new Date(dernier).toISOString(),
      apercu: `${auteur.prenom} : ${h.choix(PAROLES_EQUIPE)}`,
      nonLus: i % 4 === 1 ? h.entier(1, 6) : 0,
    };
  }).sort((a, b) => Number(b.epinglePar.length > 0) - Number(a.epinglePar.length > 0) || b.dernierMessageAt.localeCompare(a.dernierMessageAt));
}

/* --------------------------------- Annonces --------------------------------- */

const ANNONCES: readonly (readonly [string, string, Annonce['categorie'], boolean])[] = [
  ['Fermeture exceptionnelle vendredi après-midi', 'Le bureau ferme à 14 h pour la journée d’équipe. Les messages urgents restent suivis.', 'Équipe', true],
  ['Nouvelle procédure de sauvegarde', 'La procédure est dans les pages. Merci de la lire avant lundi.', 'Sécurité', false],
  ['Bienvenue à notre nouveau client', 'Un nouveau client nous rejoint cette semaine. Hugo organise le premier rendez-vous.', 'Clients', false],
  ['Clôture du mois', 'Merci de justifier toutes vos dépenses avant le 5.', 'Équipe', false],
  ['Mise à jour de l’outil de facturation', 'Une nouvelle présentation des factures est disponible dès demain.', 'Outils', false],
  ['Congés de fin d’année', 'Merci de déposer vos dates avant le 15 novembre.', 'Ressources humaines', false],
];

export function genererAnnonces(ctx: Contexte, equipe: readonly Membre[]): Annonce[] {
  const h = hasardDe(ctx.graine, 'annonces');
  const n = compter(ctx.volumes.annonces, [0, 2, 6, 30]);
  const gens = salaries(equipe);
  return fabriquer(n, (i) => {
    const [titre, texte, categorie, epinglee] = i <= ANNONCES.length ? ANNONCES[i - 1] : [`${ANNONCES[i % ANNONCES.length][0]} (${i})`, ANNONCES[i % ANNONCES.length][1], ANNONCES[i % ANNONCES.length][2], false] as const;
    const auteur = h.choix(gens.filter((g) => g.role === 'Administrateur').concat(gens[0]));
    const publieeAt = ctx.maintenant - (i === 1 ? h.entier(30, 90) * 60_000 : (i - 1) * h.entier(1, 3) * 86_400_000 + h.entier(1, 6) * 3_600_000);
    // L'auteur est compté d'office parmi ceux qui ont lu (H14).
    const lecteurs = [auteur, ...h.echantillon(gens.filter((g) => g.email !== auteur.email), h.entier(0, gens.length - 1))];
    return {
      id: cle('an', i),
      auteurEmail: auteur.email,
      publieeAt: new Date(publieeAt).toISOString(),
      titre,
      texte,
      categorie,
      epinglee,
      confirmations: lecteurs.map((l, k) => ({ email: l.email, at: new Date(k === 0 ? publieeAt : publieeAt + k * h.entier(3, 90) * 60_000).toISOString() })).filter((c) => Date.parse(c.at) <= ctx.maintenant),
    };
  }).sort((a, b) => Number(b.epinglee) - Number(a.epinglee) || b.publieeAt.localeCompare(a.publieeAt));
}

/* ---------------------------------- Courriels ---------------------------------- */

const OBJETS = [
  'Re : devis demandé', 'Question sur la facture du mois', 'Demande de rendez-vous', 'Confirmation de votre commande', 'Photos pour le site',
  'Re : maquette de la page d’accueil', 'Facture en pièce jointe', 'Disponibilités de la semaine prochaine', 'Merci pour votre intervention', 'Rappel : rendez-vous demain',
];
const CORPS = [
  'Bonjour,\n\nPouvez-vous me confirmer la date de livraison ? Merci d’avance.\n\nCordialement', 'Bonjour,\n\nVous trouverez ci-joint le document demandé.\n\nBien cordialement',
  'Bonjour,\n\nNous serions heureux de vous rencontrer la semaine prochaine.\n\nÀ bientôt', 'Bonjour,\n\nMerci pour votre réactivité, tout est parfait de notre côté.\n\nCordialement',
];

export function genererCourriels(ctx: Contexte, equipe: readonly Membre[], clients: readonly FicheClient[], interlocuteurs: readonly Interlocuteur[], factures: readonly Facture[]): Courriel[] {
  const h = hasardDe(ctx.graine, 'courriels');
  const n = compter(ctx.volumes.courriels, [0, 8, 30, 300]);
  const m = moi(equipe);
  const contacts = interlocuteurs.filter((i) => i.organisationType === 'client');
  const liste: Courriel[] = [];
  for (let i = 1; i <= n; i += 1) {
    const dossier = i === 1 && n >= 8 ? 'brouillons' : h.pondere([['réception', 70], ['envoyés', 20], ['brouillons', 4], ['archive', 6]] as const);
    const contact = contacts.length ? h.choix(contacts) : null;
    const c = contact ? clients.find((x) => String(x.id) === contact.organisationId) ?? null : null;
    const infolettre = h.chance(0.08);
    const f = factures.length && h.chance(0.15) ? h.choix(factures.filter((x) => x.number)) : null;
    const objet = f ? `Question sur la facture ${f.number}` : h.choix(OBJETS);
    const at = ctx.maintenant - ageRecent(h, 60, 2) * 86_400_000 - h.entier(0, 900) * 60_000;
    const programme = dossier === 'brouillons' && i === 1;
    const entrant = dossier === 'réception' || dossier === 'archive';
    liste.push({
      id: cle('ml', i, 5),
      dossier,
      expediteurNom: entrant ? (infolettre ? 'La lettre du mois' : contact?.nomComplet ?? 'Contact') : m.nomComplet,
      expediteurEmail: entrant ? (infolettre ? 'lettre@lettre-du-mois.exemple.test' : contact?.email ?? 'contact@exemple.test') : m.email,
      organisation: entrant ? (infolettre ? 'La lettre du mois' : contact?.organisationNom ?? '') : 'Maison Vallon',
      destinataires: entrant ? [m.email] : [contact?.email ?? 'contact@exemple.test'],
      objet: infolettre ? 'Les nouveautés du mois' : objet,
      corps: f ? `Bonjour,\n\nPouvez-vous préciser le montant de ${(totauxDeFacture(f).ttcCents / 100).toLocaleString('fr-FR')} € ?\n\nCordialement` : h.choix(CORPS),
      at: programme ? new Date(ctx.maintenant + 86_400_000).toISOString() : new Date(at).toISOString(),
      etiquettes: c ? ['Client'] : infolettre ? ['Infolettre'] : [],
      lu: dossier === 'réception' ? h.chance(0.6) : true,
      important: h.chance(0.07),
      piecesJointes: h.chance(0.2) ? [{ nom: `document-${h.entier(1, 40)}.pdf`, tailleOctets: h.entier(40e3, 900e3) }] : [],
      clientId: c?.id ?? null,
      tacheId: null,
      envoiProgrammeAt: programme ? new Date(ctx.maintenant + 86_400_000).toISOString() : null,
    });
  }
  return liste.sort((a, b) => b.at.localeCompare(a.at));
}

/* ------------------------------ Salles et appels ------------------------------ */

const SALLES: readonly (readonly [string, string, Salle['type'], Salle['famille']])[] = [
  ['Salle de l’équipe', 'Toujours ouverte pour les échanges rapides.', 'équipe permanente', 'jour'],
  ['Salle clients', 'Invités par lien, un lien par rendez-vous.', 'invités par lien', 'contacts'],
  ['Supervision', 'Suivi des sites et alertes en direct.', 'supervision', 'outils'],
  ['Projet site vitrine', 'Revue de maquettes avec le client.', 'projet', 'creer'],
  ['Atelier contenus', 'Écriture à plusieurs.', 'projet', 'creer'],
  ['Salle de formation', 'Sessions d’une journée.', 'invités par lien', 'contacts'],
];

export function genererSalles(ctx: Contexte, equipe: readonly Membre[]): Salle[] {
  const h = hasardDe(ctx.graine, 'salles');
  const n = compter(ctx.volumes.salles, [0, 2, 4, 6]);
  const enLigne = equipe.filter((e) => e.statut === 'en ligne');
  return SALLES.slice(0, n).map(([nom, description, type, famille], i) => ({
    id: cle('sa', i + 1),
    nom,
    description,
    type,
    famille,
    connectes: i === 0 && enLigne.length > 1 ? h.echantillon(enLigne, Math.min(3, enLigne.length)).map((e) => e.email) : i === 1 ? [] : h.chance(0.3) && enLigne.length ? [h.choix(enLigne).email] : [],
  }));
}

const RESUMES = [
  ['Point rapide sur les factures en retard.', ['Relancer deux clients cette semaine'], ['Hugo prépare les relances', 'Nadia vérifie les règlements']],
  ['Validation de la maquette et du calendrier de livraison.', ['Livraison fixée au 12 novembre'], ['Léa envoie la version finale']],
  ['Revue des priorités de la semaine.', ['Le chantier du client passe en priorité'], ['Yanis planifie la mise à jour de sécurité']],
] as const;

export function genererAppels(ctx: Contexte, equipe: readonly Membre[], salles: readonly Salle[]): Appel[] {
  const h = hasardDe(ctx.graine, 'appels');
  const n = salles.length ? compter(ctx.volumes.appels, [0, 4, 10, 60]) : 0;
  const gens = salaries(equipe);
  return fabriquer(n, (i) => {
    const salle = h.choix(salles);
    const jour = ajouterJours(ctx.aujourdhui, -Math.floor((i - 1) / 2));
    const debut = i === 1 ? '09:00' : hhmm(h);
    const [resume, decisions, actions] = RESUMES[i % RESUMES.length];
    const avec = i <= 6 || h.chance(0.5);
    return {
      id: cle('ap', i),
      titre: i === 1 ? 'Stand-up de ce matin' : h.choix(['Point d’équipe', 'Revue de projet', 'Appel client', 'Atelier contenus', 'Point sécurité']),
      salleId: salle.id,
      debutAt: quand(jour, debut),
      dureeMin: h.choix([15, 20, 25, 30, 45, 60, 65]),
      participants: h.echantillon(gens, h.entier(2, Math.min(5, gens.length))).map((g) => g.email),
      resume: avec ? resume : null,
      decisions: avec ? [...decisions] : [],
      actions: avec ? [...actions] : [],
    };
  }).filter((a) => Date.parse(a.debutAt) < ctx.maintenant).sort((a, b) => b.debutAt.localeCompare(a.debutAt));
}

/* ---------------------------------- Réunions ---------------------------------- */

export function genererReunions(ctx: Contexte, equipe: readonly Membre[], evenements: readonly Evenement[]): Reunion[] {
  const h = hasardDe(ctx.graine, 'reunions');
  const n = compter(ctx.volumes.reunions, [0, 3, 10, 60]);
  const gens = salaries(equipe);
  const candidats = evenements.filter((e) => !e.systeme && (e.type === 'réunion' || e.type === 'bilan' || e.type === 'rendez-vous client'));
  return h.echantillon(candidats, n).map((e, i) => {
    const passee = Date.parse(e.endAt) <= ctx.maintenant;
    const [resume, decisions, actions] = RESUMES[i % RESUMES.length];
    return {
      id: cle('re', i + 1),
      titre: e.title,
      debutAt: e.startAt,
      dureeMin: e.durationMin,
      lieu: e.type === 'rendez-vous client' ? (e.mode === 'visio' ? ('Visio' as const) : ('Salle clients' as const)) : e.location === 'Visio' ? ('Visio' as const) : ('Équipe' as const),
      organisateurEmail: h.choix(e.participants.length ? e.participants : gens.map((g) => g.email)),
      inscrits: e.type === 'rendez-vous client' ? h.entier(1, 4) : 0,
      preparation: passee ? [] : [{ libelle: 'Relire le dossier du client', fait: h.chance(0.5) }, { libelle: 'Préparer le devis', fait: h.chance(0.3) }],
      compteRendu: passee && h.chance(0.7) ? { resume, decisions: [...decisions], actions: [...actions] } : null,
      evenementId: e.id,
    };
  }).sort((a, b) => a.debutAt.localeCompare(b.debutAt));
}

/* --------------------------------- Partages --------------------------------- */

export function genererPartages(ctx: Contexte, equipe: readonly Membre[], fichiers: readonly Fichier[], interlocuteurs: readonly Interlocuteur[]): Partage[] {
  const h = hasardDe(ctx.graine, 'partages');
  const n = fichiers.length ? compter(ctx.volumes.partages, [0, 3, 10, 60]) : 0;
  void equipe;
  const clientsContacts = interlocuteurs.filter((i) => i.organisationType === 'client');
  return fabriquer(n, (i) => {
    const f = h.choix(fichiers);
    const interne = h.chance(0.15) || clientsContacts.length === 0;
    const cree = ctx.maintenant - ageRecent(h, 45) * 86_400_000 - h.entier(0, 800) * 60_000;
    // Une part des liens expire dans les trois jours (« Expirent bientôt », MX03).
    const duree = i <= 2 ? h.entier(1, 3) : h.pondere([[7, 3], [14, 2], [30, 3], [null, 1]] as const);
    const expire = interne ? null : duree === null ? null : cree + duree * 86_400_000;
    const revoque = expire !== null && expire < ctx.maintenant ? false : h.chance(0.04);
    return {
      id: cle('pt', i),
      fichierId: f.id,
      nom: f.nom,
      tailleOctets: f.tailleOctets,
      note: h.choix(['Version 2', 'Confidentiel', 'Pour signature', 'Interne', 'Pour relecture']),
      destinataire: interne ? 'Équipe' : h.choix(clientsContacts).email,
      creeAt: new Date(cree).toISOString(),
      expireAt: expire ? new Date(expire).toISOString() : null,
      protection: interne ? 'aucune' : h.pondere([['mot de passe', 3], ['code par courriel', 4], ['aucune', 1]] as const),
      droits: h.chance(0.7) ? ('télécharger' as const) : ('consulter' as const),
      vu: interne ? 'Ouvert' : h.pondere([['Non ouvert', 3], ['Ouvert', 4], ['Téléchargé', 3]] as const),
      revoque,
    };
  }).sort((a, b) => b.creeAt.localeCompare(a.creeAt));
}

/* --------------------------------- Sondages --------------------------------- */

const SONDAGES: readonly (readonly [string, Sondage['type'], readonly string[], string])[] = [
  ['Quel jour pour le déjeuner d’équipe ?', 'date', ['Mardi 10 novembre', 'Jeudi 12 novembre', 'Vendredi 13 novembre'], 'calendar'],
  ['Quel outil pour les notes de réunion ?', 'choix', ['Pages', 'Journal', 'Fichiers partagés'], 'pen'],
  ['Satisfaction sur la semaine', 'note', ['1', '2', '3', '4', '5'], 'star'],
  ['Idée de cadeau client de fin d’année', 'choix', ['Calendrier', 'Carnet', 'Carte de vœux'], 'gift'],
  ['Horaires d’été', 'choix', ['8 h – 16 h', '9 h – 17 h', 'Inchangés'], 'sun'],
];

export function genererSondages(ctx: Contexte, equipe: readonly Membre[]): Sondage[] {
  const h = hasardDe(ctx.graine, 'sondages');
  const n = compter(ctx.volumes.sondages, [0, 2, 5, 20]);
  const gens = salaries(equipe);
  const modeles = cycle(h, SONDAGES, n);
  return modeles.map(([titre, type, options, icone], i) => {
    const invites = gens.length + h.entier(0, 3);
    const statut = (['Nouveau', 'En cours', 'En cours', 'Terminé', 'Terminé'] as const)[i % 5];
    const repondants = statut === 'Nouveau' ? 0 : statut === 'Terminé' ? Math.min(invites, Math.max(1, invites - h.entier(0, 1))) : h.entier(1, Math.max(1, invites - 1));
    const repartition = options.map(() => h.entier(0, 5));
    const total = repartition.reduce((s, x) => s + x, 0) || 1;
    const votes = repartition.map((r) => Math.round((r / total) * repondants));
    const cree = ctx.maintenant - (statut === 'Nouveau' ? h.entier(1, 5) * 3_600_000 : h.entier(1, 12) * 86_400_000);
    return {
      id: cle('so', i + 1),
      titre: i < SONDAGES.length ? titre : `${titre} (${i + 1})`,
      type,
      options: options.map((libelle, k) => ({ libelle, votes: votes[k] })),
      invites,
      repondants,
      creeAt: new Date(cree).toISOString(),
      echeanceAt: statut === 'Terminé' ? new Date(Math.min(cree + 5 * 86_400_000, ctx.maintenant - 3_600_000)).toISOString() : new Date(ctx.maintenant + h.entier(1, 9) * 86_400_000).toISOString(),
      statut,
      auteurEmail: h.choix(gens).email,
      anonyme: h.chance(0.3),
      icone,
    };
  });
}

/* ------------------------- Réponses automatiques ------------------------- */

const REGLES: readonly (readonly [string, ReponseAuto['declencheur'], ReponseAuto['reponse'], string[]])[] = [
  ['Hors horaires', { type: 'horaires', libelle: 'Après 18:00 et le week-end' }, { type: 'Texte', modele: 'Nous avons bien reçu votre message et vous répondons dès lundi matin.' }, ['Courriel', 'Messagerie']],
  ['Demande de devis', { type: 'mots-clés', libelle: 'Mots : devis, tarif, prix' }, { type: 'Formulaire', modele: 'Merci de remplir ce formulaire pour recevoir votre devis.' }, ['Courriel']],
  ['Urgence signalée', { type: 'événement', libelle: 'Drapeau urgent activé' }, { type: 'Alerte', modele: 'Prévenir la personne d’astreinte.' }, ['Application']],
  ['Congés d’été', { type: 'période', libelle: 'Du 1er au 15 août' }, { type: 'Texte', modele: 'Nous sommes en congés jusqu’au 15 août.' }, ['Courriel', 'Messagerie']],
  ['Rendez-vous manqué', { type: 'événement', libelle: 'Absent à un rendez-vous' }, { type: 'Texte', modele: 'Nous n’avons pas pu nous rencontrer, souhaitez-vous reprogrammer ?' }, ['Courriel']],
];

export function genererReponsesAuto(ctx: Contexte): ReponseAuto[] {
  const h = hasardDe(ctx.graine, 'reponsesAuto');
  const n = compter(ctx.volumes.reponsesAuto, [0, 2, 5, 10]);
  return fabriquer(n, (i) => {
    const [nom, declencheur, reponse, canaux] = REGLES[(i - 1) % REGLES.length];
    // Une règle naît éteinte (MX06) ; celles-ci ont été allumées volontairement, sauf une.
    const actif = i !== 3 && i % 5 !== 4;
    return { id: cle('ra', i), nom: i <= REGLES.length ? nom : `${nom} (${i})`, declencheur, reponse, canaux, actif, envois: actif ? h.entier(3, 180) : 0, creeLe: ajouterJours(ctx.aujourdhui, -h.entier(10, 300)) };
  });
}

