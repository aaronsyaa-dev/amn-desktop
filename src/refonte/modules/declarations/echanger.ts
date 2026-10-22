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
        vue('dm', '/messages-prives', ['envoyer un message', 'écrire à un collègue'], ['message', 'privé', 'discussion', 'chat'], {
          en: { verbes: ['send a message', 'write to a colleague'], motsCles: ['message', 'direct', 'private', 'chat', 'dm'] },
        }),
        vue('groups', '/groupes', ['créer un groupe', 'discuter à plusieurs'], ['groupe', 'fil', 'canal'], {
          en: { verbes: ['create a group', 'chat with several people'], motsCles: ['group', 'thread', 'channel'] },
        }),
        vue('team', '/team', ['écrire à l’équipe', 'voir qui est en ligne'], ['équipe', 'messagerie', 'présence', 'canal'], {
          etiquette: { fr: 'Équipe', en: 'Team' },
          en: { verbes: ['write to the team', 'see who is online'], motsCles: ['team', 'messaging', 'presence', 'channel', 'online'] },
        }),
      ],
    },
    {
      action: 'discuter',
      niveau: 'courant',
      vues: [
        vue('hall', '/hall', ['échanger avec d’autres entreprises'], ['hall', 'entreprises', 'réseau', 'communauté'], {
          en: { verbes: ['talk with other businesses'], motsCles: ['hall', 'businesses', 'network', 'community'] },
        }),
      ],
    },
    {
      action: 'reunir',
      niveau: 'courant',
      vues: [
        vue('meetings', '/reunions', ['préparer une réunion', 'noter les décisions d’une réunion', 'écrire un ordre du jour'], ['réunion', 'compte rendu', 'ordre du jour'], {
          en: { verbes: ['prepare a meeting', 'note the decisions of a meeting', 'write an agenda'], motsCles: ['meeting', 'minutes', 'agenda'] },
        }),
      ],
    },
    {
      nom: { fr: 'Appels et salles', en: 'Calls and rooms' },
      action: 'reunir',
      niveau: 'essentiel',
      vues: [
        vue('calls', '/appels', ['appeler un collègue', 'lancer un appel vidéo', 'inviter un visiteur'], ['appel', 'visio', 'vidéo', 'téléphone', 'visioconférence', 'zoom', 'meet'], {
          en: { verbes: ['call a colleague', 'start a video call', 'invite a guest'], motsCles: ['call', 'video call', 'video', 'phone', 'conference'] },
        }),
        vue('rooms', '/salles', ['réserver une salle', 'voir qui est dans une salle'], ['salle', 'pièce', 'réservation'], {
          en: { verbes: ['book a room', 'see who is in a room'], motsCles: ['room', 'booking', 'reservation'] },
        }),
      ],
    },
    {
      action: 'annoncer',
      niveau: 'courant',
      vues: [
        vue('announcements', '/annonces', ['faire une annonce', 'prévenir toute l’équipe'], ['annonce', 'information', 'tous'], {
          en: { verbes: ['make an announcement', 'tell the whole team'], motsCles: ['announcement', 'news', 'everyone', 'broadcast'] },
        }),
      ],
    },
    {
      action: 'annoncer',
      niveau: 'courant',
      vues: [
        vue('polls', '/sondages', ['lancer un sondage', 'faire voter l’équipe'], ['sondage', 'vote', 'question'], {
          en: { verbes: ['run a poll', 'have the team vote'], motsCles: ['poll', 'vote', 'survey', 'question'] },
        }),
      ],
    },
    {
      action: 'annoncer',
      niveau: 'courant',
      vues: [
        vue('newsletter', '/lettre', ['envoyer une newsletter', 'écrire à tous mes clients'], ['newsletter', 'lettre', 'emailing', 'mail groupé', 'mailing', 'campagne'], {
          en: { verbes: ['send a newsletter', 'write to all my customers'], motsCles: ['newsletter', 'email campaign', 'mailing', 'bulk mail'] },
        }),
      ],
    },
    {
      action: 'public',
      niveau: 'courant',
      vues: [
        vue('forms', '/formulaires', ['créer un formulaire', 'poser une question au public', 'lire les réponses'], ['formulaire', 'questionnaire', 'inscription'], {
          en: { verbes: ['create a form', 'ask the public a question', 'read the answers'], motsCles: ['form', 'questionnaire', 'sign-up', 'survey'] },
        }),
      ],
    },
    {
      action: 'public',
      niveau: 'avance',
      vues: [
        vue('chatbot', '/chatbot', ['répondre aux questions des visiteurs', 'voir les questions sans réponse'], ['chatbot', 'bot', 'faq', 'questions'], {
          en: { verbes: ['answer visitors’ questions', 'see unanswered questions'], motsCles: ['chatbot', 'bot', 'faq', 'questions'] },
        }),
      ],
    },
    {
      action: 'public',
      niveau: 'avance',
      vues: [
        vue('switchboard', '/standard', ['voir les appels reçus', 'relire ce que l’assistant a promis'], ['standard', 'téléphone', 'appel entrant', 'répondeur', 'messagerie vocale', 'accueil téléphonique'], {
          en: { verbes: ['see incoming calls', 'reread what the assistant promised'], motsCles: ['switchboard', 'phone', 'incoming call', 'voicemail', 'receptionist'] },
        }),
      ],
    },
    {
      action: 'rh',
      niveau: 'courant',
      vues: [
        vue('recruitment', '/recrutement', ['recruter quelqu’un', 'publier une offre'], ['recrutement', 'embauche', 'candidat', 'offre'], {
          en: { verbes: ['hire someone', 'post a job offer'], motsCles: ['recruitment', 'hiring', 'candidate', 'job offer', 'job ad'] },
        }),
      ],
    },
    {
      action: 'rh',
      niveau: 'courant',
      vues: [
        vue('procedures', '/procedures', ['écrire une procédure', 'afficher une procédure'], ['procédure', 'mode opératoire', 'consigne'], {
          en: { verbes: ['write a procedure', 'show a procedure'], motsCles: ['procedure', 'how-to', 'instruction', 'sop'] },
        }),
      ],
    },
    {
      action: 'rh',
      niveau: 'courant',
      vues: [
        vue('training', '/formation', ['suivre une formation', 'voir ce qui est su'], ['formation', 'compétence', 'apprendre'], {
          en: { verbes: ['follow a training', 'see what is known'], motsCles: ['training', 'skills', 'learning', 'course'] },
        }),
      ],
    },
    {
      action: 'rh',
      niveau: 'avance',
      vues: [
        vue('certifications', '/habilitations', ['vérifier une habilitation', 'voir les habilitations qui expirent'], ['habilitation', 'certification', 'autorisation'], {
          en: { verbes: ['check a certification', 'see which certifications expire'], motsCles: ['certification', 'accreditation', 'authorization', 'license'] },
        }),
      ],
    },
    {
      action: 'rh',
      niveau: 'courant',
      vues: [
        vue('payslips', '/bulletins', ['faire une fiche de paie', 'calculer un salaire'], ['paie', 'salaire', 'bulletin', 'fiche de paie', 'paye'], {
          en: { verbes: ['make a payslip', 'work out a salary'], motsCles: ['payroll', 'salary', 'payslip', 'wage'] },
        }),
      ],
    },
  ],
});
