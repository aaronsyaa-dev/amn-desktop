import { declarerFamille, vue } from '../declarer';

/**
 * ÉCHANGER — discuter, se réunir, annoncer, accueillir le public, et la RH.
 *
 * Décisions validées : la RH (Recrutement, Procédures, Formation,
 * Habilitations, Bulletins de paie) vit ici ; Équipe (l’ancien onglet du
 * bureau Supervisor) est une vue de la Messagerie. Regroupés aussi : Appels et salles.
 */

export default declarerFamille({
  id: 'echanger',
  ordre: 5,
  teinte: 'echanger',
  nom: { fr: 'Échanger', en: 'Talk' },
  actions: {
    discuter: { fr: 'Discuter', en: 'Chat' },
    reunir: { fr: 'Se réunir et appeler', en: 'Meet and call' },
    annoncer: { fr: 'Annoncer à tous', en: 'Tell everyone' },
    public: { fr: 'Accueillir le public', en: 'Welcome the public' },
    rh: { fr: 'Équipe et RH', en: 'Team and HR' },
  },
  modules: [
    {
      nom: { fr: 'Messagerie', en: 'Messaging' },
      action: 'discuter',
      niveau: 'essentiel',
      vues: [
        vue('dm', '/messages-prives', ['envoyer un message', 'écrire à un collègue'], ['message', 'privé', 'discussion', 'chat']),
        vue('groups', '/groupes', ['créer un groupe', 'discuter à plusieurs'], ['groupe', 'fil', 'canal']),
        vue('team', '/team', ['écrire à l’équipe', 'voir qui est en ligne'], ['équipe', 'messagerie', 'présence', 'canal'], { etiquette: { fr: 'Équipe', en: 'Team' } }),
      ],
    },
    { action: 'discuter', niveau: 'courant', vues: [vue('hall', '/hall', ['échanger avec d’autres entreprises'], ['hall', 'entreprises', 'réseau', 'communauté'])] },
    { action: 'reunir', niveau: 'courant', vues: [vue('meetings', '/reunions', ['préparer une réunion', 'noter les décisions d’une réunion', 'écrire un ordre du jour'], ['réunion', 'compte rendu', 'ordre du jour'])] },
    {
      nom: { fr: 'Appels et salles', en: 'Calls and rooms' },
      action: 'reunir',
      niveau: 'essentiel',
      vues: [
        vue('calls', '/appels', ['appeler un collègue', 'lancer un appel vidéo', 'inviter un visiteur'], ['appel', 'visio', 'vidéo', 'téléphone']),
        vue('rooms', '/salles', ['réserver une salle', 'voir qui est dans une salle'], ['salle', 'pièce', 'réservation']),
      ],
    },
    { action: 'annoncer', niveau: 'courant', vues: [vue('announcements', '/annonces', ['faire une annonce', 'prévenir toute l’équipe'], ['annonce', 'information', 'tous'])] },
    { action: 'annoncer', niveau: 'courant', vues: [vue('polls', '/sondages', ['lancer un sondage', 'faire voter l’équipe'], ['sondage', 'vote', 'question'])] },
    { action: 'annoncer', niveau: 'courant', vues: [vue('newsletter', '/lettre', ['envoyer une newsletter', 'écrire à tous mes clients'], ['newsletter', 'lettre', 'emailing', 'mail groupé'])] },
    { action: 'public', niveau: 'courant', vues: [vue('forms', '/formulaires', ['créer un formulaire', 'poser une question au public', 'lire les réponses'], ['formulaire', 'questionnaire', 'inscription'])] },
    { action: 'public', niveau: 'avance', vues: [vue('chatbot', '/chatbot', ['répondre aux questions des visiteurs', 'voir les questions sans réponse'], ['chatbot', 'bot', 'faq', 'questions'])] },
    { action: 'public', niveau: 'avance', vues: [vue('switchboard', '/standard', ['voir les appels reçus', 'relire ce que l’assistant a promis'], ['standard', 'téléphone', 'appel entrant'])] },
    { action: 'rh', niveau: 'courant', vues: [vue('recruitment', '/recrutement', ['recruter quelqu’un', 'publier une offre'], ['recrutement', 'embauche', 'candidat', 'offre'])] },
    { action: 'rh', niveau: 'courant', vues: [vue('procedures', '/procedures', ['écrire une procédure', 'afficher une procédure'], ['procédure', 'mode opératoire', 'consigne'])] },
    { action: 'rh', niveau: 'courant', vues: [vue('training', '/formation', ['suivre une formation', 'voir ce qui est su'], ['formation', 'compétence', 'apprendre'])] },
    { action: 'rh', niveau: 'avance', vues: [vue('certifications', '/habilitations', ['vérifier une habilitation', 'voir les habilitations qui expirent'], ['habilitation', 'certification', 'autorisation'])] },
    { action: 'rh', niveau: 'courant', vues: [vue('payslips', '/bulletins', ['faire une fiche de paie', 'calculer un salaire'], ['paie', 'salaire', 'bulletin', 'fiche de paie'])] },
  ],
});
