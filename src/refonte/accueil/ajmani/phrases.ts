import type { Registre } from './registre';

/**
 * CE QUE DIT AJMANI — la bibliothèque, par situation et par registre.
 * ═══════════════════════════════════════════════════════════════════
 *
 * Règles de la fiche de style, que `npm run check:ajmani` fait respecter :
 *
 *   · 12 mots au plus par phrase, une idée par phrase, deux phrases au plus ;
 *   · plusieurs variantes pour chaque situation, dans chaque registre écrit,
 *     en français ET en anglais (l'anglais est le schéma, le français est
 *     typé contre lui : une situation oubliée ne compile pas) ;
 *   · jamais de morale ni de culpabilisation : il est de ton côté ;
 *   · toujours sérieux face à une alerte, une facture très en retard ou un
 *     problème de sécurité — ces situations n'ont QUE le registre sérieux.
 *
 * Chaque situation porte au moins le registre sérieux : c'est le repli
 * quand le registre demandé n'est pas écrit. Les paramètres s'écrivent
 * `{nom}` et sont remplacés tels quels (jamais un montant, jamais un secret :
 * un prénom, un nombre, un nom de module).
 */

export type Variantes = { serieux: readonly string[]; chill?: readonly string[]; taquin?: readonly string[] };

const EN = {
  'matin.rdv': {
    serieux: ['{n} appointments today. The first is with {nom}.', '{n} appointments on the agenda. {nom} comes first.'],
    chill: ['{n} appointments today. Shall we start with {nom}?', '{n} meetings today. {nom} opens the show.', 'Busy-ish day: {n} appointments. First up, {nom}.'],
    taquin: ['{n} appointments today. {nom} first, coffee second.', '{n} meetings. I’ll hold the fort, you hold the calendar.'],
  },
  'matin.rdv1': {
    serieux: ['One appointment today, with {nom}.', 'Your only appointment today is with {nom}.'],
    chill: ['Just one appointment today: {nom}. Nice and calm.', 'One meeting today, with {nom}. Plenty of room.'],
    taquin: ['One appointment today. {nom} gets your full attention.', 'Only {nom} today. Lucky them.'],
  },
  'matin.libre': {
    serieux: ['No appointments today. Here is what matters.', 'Your agenda is clear today. Three things to look at.'],
    chill: ['No appointments today. Good day to move things forward.', 'Clear agenda today. Let’s pick three things.'],
    taquin: ['Nobody booked you today. Suspicious, but convenient.', 'Empty agenda. I promise I didn’t cancel anything.'],
  },
  'calme.module': {
    serieux: ['A calm day. {module} might deserve a look.', 'Nothing urgent. Maybe a moment for {module}?'],
    chill: ['Calm day. Want to drop by {module}?', 'All quiet. How about opening {module}?'],
    taquin: ['So quiet I can hear the fans. {module}, maybe?', 'I think {module} misses you. Just passing it on.'],
  },
  'calme.rien': {
    serieux: ['Nothing needs you right now.', 'Everything is in order for now.'],
    chill: ['All quiet. Enjoy it.', 'Nothing pressing. The day is yours.'],
    taquin: ['Nothing to do. I’ll pretend to be busy.', 'All calm. I’m polishing my screen.'],
  },
  'alerte.site': {
    serieux: ['A site is no longer responding. I’ll open the case.', 'A site is down. The details are below.'],
  },
  'alerte.facture': {
    serieux: ['An invoice is {jours} days late. Reminders are ready.', 'A payment is {jours} days overdue. Let’s handle it now.'],
  },
  'alerte.securite': {
    serieux: ['A security issue needs your attention. Details below.', 'Something suspicious happened. Let’s check it together.'],
  },
  'alerte.autre': {
    serieux: ['Something needs your decision. Details below.', 'One item needs you now. I’ve put it first.'],
  },
  relance: {
    serieux: ['{nom} has been waiting for a reminder for {jours} days.', 'An invoice for {nom} is {jours} days past due.'],
    chill: ['{nom} could use a little reminder. {jours} days already.', 'A gentle nudge to {nom}, maybe? It’s been {jours} days.'],
    taquin: ['{jours} days since you last chased {nom}. Just saying.', '{nom} still owes you. I’m not saying anything, but.'],
  },
  'soir.recap': {
    serieux: ['Day done: {faits} things finished. {restants} left for tomorrow.', '{faits} things done today. {restants} carry over.'],
    chill: ['Nice day: {faits} things done. {restants} can wait.', '{faits} done today. Tomorrow picks up {restants}.'],
    taquin: ['{faits} things done. I’d clap if my arms were longer.', '{faits} done, {restants} left. Tomorrow-you will handle it.'],
  },
  'soir.leger': {
    serieux: ['Quiet day. Nothing was left hanging.', 'The day is closing. Nothing urgent remains.'],
    chill: ['Quiet day. Time to switch off.', 'Calm day overall. See you tomorrow.'],
    taquin: ['Quiet day. I’ll keep an eye out tonight.', 'Not much today. Tomorrow will make up for it.'],
  },
  tard: {
    serieux: ['It’s late. Everything else can wait until tomorrow.', 'It’s late. I’ll keep watch.'],
    chill: ['It’s late. The rest can wait.', 'Late already. Go get some rest.'],
    taquin: ['It’s late. Even my antenna is drooping.', 'Late again. I’m yawning in pixels.'],
  },
  'neuf.bienvenue': {
    serieux: ['Hello, I’m Ajmani. Let’s set up your space.', 'Welcome. Three steps to get started.'],
    chill: ['Hi, I’m Ajmani. Shall we set things up?', 'Welcome aboard. Three small steps and we’re good.'],
    taquin: ['Hi, I’m Ajmani. Yes, my head is a TV.', 'New here? Me too, sort of.'],
  },
  'fete.facture': {
    serieux: ['Invoice paid. Good news.', 'Payment received. One less thing to chase.'],
    chill: ['Invoice paid. Nice day.', 'Money in. That’s a good one.'],
    taquin: ['Invoice paid. I’ll do a little dance.', 'Paid! Told you they would.'],
  },
  'fete.client': {
    serieux: ['New client added. Welcome to them.', 'A new client joins. Their file is ready.'],
    chill: ['New client. Welcome aboard.', 'One more client. Nice.'],
    taquin: ['New client! The family grows.', 'A new client. I’ll be on my best behaviour.'],
  },
  clic: {
    serieux: ['Yes? I’m opening the conversation.', 'I’m here. Ask me anything.'],
    chill: ['Hey. What can I do for you?', 'Here I am. Let’s talk.'],
    taquin: ['You rang? I’m all screen.', 'Poke received. What’s up?'],
  },
  'astuce.panneau': {
    serieux: ['Ctrl+J or ⌘J opens our conversation, anywhere.', 'Press ⌘J to talk to me from any screen.'],
    chill: ['Tip: ⌘J opens our chat from anywhere.', 'Need me? ⌘J, wherever you are.'],
    taquin: ['⌘J and I appear. Like magic, but cheaper.', 'Psst, ⌘J. I’ll be right there.'],
  },
  'astuce.voix': {
    serieux: ['Hold F9 to speak to me instead of typing.', 'Hold F9, speak, release. I’ll take it from there.'],
    chill: ['Tired of typing? Hold F9 and just talk.', 'Hold F9 to talk. Hands free, almost.'],
    taquin: ['Hold F9 and talk. I promise to listen.', 'F9 held down means I’m all ears. Well, antenna.'],
  },
  'astuce.fil': {
    serieux: ['You can tick, hide or add lines to the day’s list.', 'The day’s list is yours. Edit it freely.'],
    chill: ['The day’s list is editable. Add your own lines.', 'Tick things off the list. It feels good.'],
    taquin: ['Ticking things off is allowed. Encouraged, even.', 'Add a line to the list. I won’t judge.'],
  },
  'astuce.registre': {
    serieux: ['You can set my tone in Settings.', 'Too chatty? My tone is in Settings.'],
    chill: ['You can change my tone in Settings.', 'Serious, chill or cheeky: your call, in Settings.'],
    taquin: ['Too cheeky? Settings can calm me down.', 'My tone has a knob. It’s in Settings.'],
  },
} as const satisfies Record<string, Variantes>;

export type Situation = keyof typeof EN;
export const SITUATIONS = Object.keys(EN) as Situation[];

const FR: Record<Situation, Variantes> = {
  'matin.rdv': {
    serieux: ['{n} rendez-vous aujourd’hui. Le premier est avec {nom}.', '{n} rendez-vous au programme. {nom} ouvre la journée.'],
    chill: ['{n} rendez-vous aujourd’hui. On commence par {nom} ?', '{n} rendez-vous aujourd’hui. {nom} passe en premier.', 'Journée remplie : {n} rendez-vous. D’abord {nom}.'],
    taquin: ['{n} rendez-vous aujourd’hui. {nom} d’abord, le café ensuite.', '{n} rendez-vous. Je garde le fort, tu gardes l’agenda.'],
  },
  'matin.rdv1': {
    serieux: ['Un rendez-vous aujourd’hui, avec {nom}.', 'Ton seul rendez-vous du jour est avec {nom}.'],
    chill: ['Un seul rendez-vous aujourd’hui : {nom}. Tranquille.', 'Un rendez-vous aujourd’hui, avec {nom}. De la marge.'],
    taquin: ['Un rendez-vous aujourd’hui. {nom} aura toute ton attention.', 'Seulement {nom} aujourd’hui. Veinard.'],
  },
  'matin.libre': {
    serieux: ['Aucun rendez-vous aujourd’hui. Voici ce qui compte.', 'Agenda libre aujourd’hui. Trois choses à regarder.'],
    chill: ['Pas de rendez-vous aujourd’hui. Bon jour pour avancer.', 'Agenda libre. On choisit trois choses ?'],
    taquin: ['Personne ne t’a réservé aujourd’hui. Louche, mais pratique.', 'Agenda vide. Promis, je n’ai rien annulé.'],
  },
  'calme.module': {
    serieux: ['Journée calme. {module} mérite peut-être un coup d’œil.', 'Rien d’urgent. Un moment pour {module} ?'],
    chill: ['Journée calme. On passe par {module} ?', 'Tout est calme. Et si on ouvrait {module} ?'],
    taquin: ['Si calme que j’entends les ventilateurs. {module}, peut-être ?', 'Je crois que {module} s’ennuie de toi. Je transmets.'],
  },
  'calme.rien': {
    serieux: ['Rien ne te réclame pour l’instant.', 'Tout est en ordre pour le moment.'],
    chill: ['Tout est calme. Profite.', 'Rien de pressé. La journée est à toi.'],
    taquin: ['Rien à faire. Je vais faire semblant d’être occupé.', 'Tout est calme. Je fais briller mon écran.'],
  },
  'alerte.site': {
    serieux: ['Un site ne répond plus. Je t’ouvre le dossier.', 'Un site est tombé. Le détail est juste en dessous.'],
  },
  'alerte.facture': {
    serieux: ['Une facture a {jours} jours de retard. Les relances sont prêtes.', 'Un paiement a {jours} jours de retard. On s’en occupe maintenant.'],
  },
  'alerte.securite': {
    serieux: ['Un problème de sécurité demande ton attention. Détail ci-dessous.', 'Quelque chose de suspect est arrivé. On regarde ensemble.'],
  },
  'alerte.autre': {
    serieux: ['Une décision t’attend. Le détail est ci-dessous.', 'Un point a besoin de toi. Je l’ai mis en tête.'],
  },
  relance: {
    serieux: ['{nom} attend une relance depuis {jours} jours.', 'Une facture de {nom} a {jours} jours de retard.'],
    chill: ['{nom} mériterait une petite relance. Déjà {jours} jours.', 'Un petit mot à {nom}, peut-être ? Ça fait {jours} jours.'],
    taquin: ['Ça fait {jours} jours que tu n’as pas relancé {nom}. Je dis ça, je dis rien.', '{nom} te doit toujours. Je ne dis rien, mais bon.'],
  },
  'soir.recap': {
    serieux: ['Journée bouclée : {faits} choses faites. {restants} pour demain.', '{faits} choses faites aujourd’hui. {restants} passent à demain.'],
    chill: ['Belle journée : {faits} choses faites. {restants} peuvent attendre.', '{faits} choses faites. Demain reprend les {restants} autres.'],
    taquin: ['{faits} choses faites. J’applaudirais si j’avais des bras plus longs.', '{faits} faites, {restants} restantes. Le toi de demain gérera.'],
  },
  'soir.leger': {
    serieux: ['Journée calme. Rien n’est resté en suspens.', 'La journée se termine. Rien d’urgent ne reste.'],
    chill: ['Journée tranquille. Tu peux décrocher.', 'Journée calme dans l’ensemble. À demain.'],
    taquin: ['Journée calme. Je surveille cette nuit.', 'Pas grand-chose aujourd’hui. Demain se rattrapera.'],
  },
  tard: {
    serieux: ['Il est tard. Le reste peut attendre demain.', 'Il est tard. Je garde un œil sur tout.'],
    chill: ['Il est tard. Le reste attendra.', 'Déjà tard. Va te reposer.'],
    taquin: ['Il est tard. Même mon antenne fatigue.', 'Encore tard. Je bâille en pixels.'],
  },
  'neuf.bienvenue': {
    serieux: ['Bonjour, je suis Ajmani. On installe ton espace.', 'Bienvenue. Trois étapes pour bien démarrer.'],
    chill: ['Salut, moi c’est Ajmani. On installe ton coin ?', 'Bienvenue à bord. Trois petites étapes et c’est parti.'],
    taquin: ['Salut, moi c’est Ajmani. Oui, ma tête est une télé.', 'Nouveau ici ? Moi aussi, un peu.'],
  },
  'fete.facture': {
    serieux: ['Facture encaissée. Bonne nouvelle.', 'Paiement reçu. Une relance de moins.'],
    chill: ['Facture encaissée. Belle journée.', 'L’argent est arrivé. Ça fait plaisir.'],
    taquin: ['Facture encaissée. Je fais une petite danse.', 'Payée ! Je te l’avais dit.'],
  },
  'fete.client': {
    serieux: ['Nouveau client enregistré. Sa fiche est prête.', 'Un nouveau client arrive. Bienvenue à lui.'],
    chill: ['Nouveau client. Bienvenue à bord.', 'Un client de plus. Joli.'],
    taquin: ['Nouveau client ! La famille s’agrandit.', 'Un nouveau client. Je vais bien me tenir.'],
  },
  clic: {
    serieux: ['Oui ? J’ouvre la conversation.', 'Je suis là. Pose-moi ta question.'],
    chill: ['Salut. Je peux t’aider ?', 'Me voilà. On discute ?'],
    taquin: ['Tu m’as appelé ? Je suis tout écran.', 'Bien reçu le petit coup. Quoi de neuf ?'],
  },
  'astuce.panneau': {
    serieux: ['Ctrl+J ou ⌘J ouvre notre conversation, partout.', 'Appuie sur ⌘J pour me parler depuis n’importe quel écran.'],
    chill: ['Astuce : ⌘J ouvre notre discussion, où que tu sois.', 'Besoin de moi ? ⌘J, de n’importe où.'],
    taquin: ['⌘J et j’apparais. Comme par magie, en moins cher.', 'Psst, ⌘J. J’arrive tout de suite.'],
  },
  'astuce.voix': {
    serieux: ['Maintiens F9 pour me parler au lieu d’écrire.', 'Maintiens F9, parle, relâche. Je m’occupe du reste.'],
    chill: ['Marre de taper ? Maintiens F9 et parle.', 'Maintiens F9 pour parler. Presque les mains libres.'],
    taquin: ['Maintiens F9 et parle. Promis, j’écoute.', 'F9 enfoncé, je suis tout ouïe. Enfin, tout antenne.'],
  },
  'astuce.fil': {
    serieux: ['Tu peux cocher, masquer ou ajouter des lignes au fil.', 'Le fil du jour est à toi. Modifie-le librement.'],
    chill: ['Le fil du jour se modifie. Ajoute tes propres lignes.', 'Coche ce qui est fait. Ça fait du bien.'],
    taquin: ['Cocher est autorisé. Encouragé, même.', 'Ajoute une ligne au fil. Je ne juge pas.'],
  },
  'astuce.registre': {
    serieux: ['Tu peux régler mon ton dans les Réglages.', 'Trop bavard ? Mon ton se règle dans les Réglages.'],
    chill: ['Mon ton se change dans les Réglages.', 'Sérieux, chill ou taquin : à toi de voir, dans les Réglages.'],
    taquin: ['Trop taquin ? Les Réglages peuvent me calmer.', 'Mon ton a un bouton. Il est dans les Réglages.'],
  },
};

export const BIBLIOTHEQUE: Record<'fr' | 'en', Record<Situation, Variantes>> = { en: EN, fr: FR };

/** Les situations où il est TOUJOURS sérieux, quel que soit le réglage. */
export const SITUATIONS_SERIEUSES: readonly Situation[] = ['alerte.site', 'alerte.facture', 'alerte.securite', 'alerte.autre'];

/** Les astuces : soumises à la limite du jour, chacune avec « ne plus me montrer ça ». */
export const ASTUCES = ['astuce.panneau', 'astuce.voix', 'astuce.fil', 'astuce.registre'] as const satisfies readonly Situation[];
export type Astuce = (typeof ASTUCES)[number];

/** Un mot = un groupe de caractères qui contient une lettre, un chiffre ou un paramètre. */
export function compterMots(phrase: string): number {
  return phrase.split(/\s+/).filter((m) => /[\p{L}\p{N}{]/u.test(m)).length;
}

/** Les phrases d'une réplique : coupées après . ! ? … (le « ? » français précédé d'une espace compris). */
export function phrasesDe(replique: string): string[] {
  return replique
    .split(/(?<=[.!?…])\s+(?=\S)/u)
    .map((p) => p.trim())
    .filter((p) => compterMots(p) > 0);
}

/** Remplace `{x}` par sa valeur ; un paramètre manquant reste visible pour être attrapé par les contrôles. */
export function remplir(modele: string, params: Record<string, string | number> = {}): string {
  return modele.replace(/\{(\w+)\}/g, (tout, cle: string) => (cle in params ? String(params[cle]) : tout));
}

/**
 * Le registre qui s'applique : le réglage est un plafond, la situation peut
 * imposer le sérieux. Si le registre n'est pas écrit pour la situation, on
 * descend d'un cran (taquin → chill → sérieux).
 */
export function registreEffectif(reglage: Registre, situation: Situation, variantes: Variantes): Registre {
  if (SITUATIONS_SERIEUSES.includes(situation)) return 'serieux';
  const ordre: Registre[] = reglage === 'taquin' ? ['taquin', 'chill', 'serieux'] : reglage === 'chill' ? ['chill', 'serieux'] : ['serieux'];
  return ordre.find((r) => (variantes[r]?.length ?? 0) > 0) ?? 'serieux';
}
