import type { Famille } from '../../socle/familles';

/**
 * LE REGISTRE DES MODULES — édition interne, refonte S1 (navigation).
 * ═══════════════════════════════════════════════════════════════════
 *
 * Une ligne par module du catalogue interne (`src/edition/modules.internal.ts`,
 * 142 modules). Le catalogue reste la source des écrans, des icônes et des
 * libellés ; ce registre ajoute ce qu'il n'a pas :
 *
 *   · la FAMILLE de la refonte (`jour`, `contacts`, `ecrire`, `argent`,
 *     `echanger`, `creer`, `outils`), qui colore le module partout ;
 *   · l'ACTION, un sous-rangement dans la famille (« Facturer », « Sur le
 *     terrain »…), qui range la vue « Tous les modules » ;
 *   · les VERBES (« envoyer une facture ») et les MOTS-CLÉS, que la recherche
 *     par intention (⌘K) compare à ce qu'on tape.
 *
 * Rien n'est supprimé ni déplacé : les routes et les sections du catalogue
 * n'ont pas bougé. `npm run check:navigation` refuse un module absent d'ici,
 * une route qui diffère du catalogue, une ligne sans verbe.
 *
 * LE LIBELLÉ i18n. Il n'est pas recopié : l'identifiant EST la clé de
 * traduction du module. `libelleNav(item)` le résout (français : le catalogue ;
 * anglais : `src/i18n/nav.en.ts` ou `src/edition/navLexique.internal.ts`).
 *
 * `aValider` marque une famille proposée sans certitude ; le dernier argument
 * de `m()` dit pourquoi. Ce sont des propositions, à trancher.
 *
 * Les verbes et mots-clés sont en français seulement : l'anglais tombe sur le
 * libellé traduit du module.
 */

/** Les actions de chaque famille, dans l'ordre où la vue « Tous les modules » les montre. */
export const ACTIONS = {
  jour: ['organiser', 'suivre', 'equipe', 'perso'],
  contacts: ['clients', 'prospecter', 'ecouter', 'fideliser', 'partenaires'],
  ecrire: ['noter', 'rediger', 'documents', 'signer'],
  argent: ['facturer', 'vendre', 'depenser', 'prevoir', 'comptabilite'],
  echanger: ['discuter', 'reunir', 'annoncer', 'public'],
  creer: ['video', 'visuels', 'publier'],
  outils: ['pratique', 'automatiser', 'terrain', 'stock', 'conformite', 'reglages', 'deleguer', 'superviser', 'securiser'],
} as const satisfies Record<Famille, readonly string[]>;

export type ActionDe<F extends Famille> = (typeof ACTIONS)[F][number];
export type CleAction = { [F in Famille]: `${F}.${ActionDe<F>}` }[Famille];

export interface ModuleRegistre {
  /** La clé du module dans le catalogue — et sa clé de traduction. */
  id: string;
  /** La route, identique au catalogue (vérifié). */
  route: string;
  famille: Famille;
  /** `famille.action` : le sous-rangement de la vue « Tous les modules ». */
  action: CleAction;
  /** Ce qu'on veut faire, à l'infinitif : « envoyer une facture ». */
  verbes: readonly string[];
  /** Ce qu'on pourrait taper d'autre : synonymes, objets, sigles. */
  motsCles: readonly string[];
  /** Famille proposée sans certitude. */
  aValider?: true;
  /** Pourquoi on hésite (présent si `aValider`). */
  pourquoi?: string;
}

function m<F extends Famille>(
  id: string,
  route: string,
  famille: F,
  action: ActionDe<F>,
  verbes: string[],
  motsCles: string[],
  pourquoi?: string,
): ModuleRegistre {
  return {
    id,
    route,
    famille,
    action: `${famille}.${action}` as CleAction,
    verbes,
    motsCles,
    ...(pourquoi ? { aValider: true as const, pourquoi } : {}),
  };
}

const TERRAIN = 'Aucune des sept familles ne dit « production / terrain » : rangé dans Outils faute de mieux.';
const GARDE = 'La Garde (agents automatiques) n’est pas un travail du quotidien : Outils faute d’une famille « supervision ».';
const SUPERVISION = 'Supervision du parc des clientes : Outils faute d’une famille « supervision ».';
const CYBER = 'Métier de cybersécurité d’AMN : Outils faute d’une famille « supervision ».';

export const REGISTRE: readonly ModuleRegistre[] = [
  /* ── Pilotage (PI) ── */
  m('home', '/', 'jour', 'organiser', ['voir ma journée', 'commencer la journée', 'revenir à l’accueil'], ['accueil', 'qg', 'aujourd’hui', 'début']),
  m('agenda', '/agenda', 'jour', 'organiser', ['prendre un rendez-vous', 'voir mon agenda', 'bloquer un créneau', 'planifier un rendez-vous'], ['calendrier', 'rdv', 'rendez-vous', 'disponibilités', 'date']),
  m('projects', '/projets', 'jour', 'suivre', ['créer un projet', 'suivre un projet', 'voir ce qui bloque'], ['projet', 'chantier', 'dossier', 'avancement']),
  m('tasks', '/tasks', 'jour', 'organiser', ['ajouter une tâche', 'assigner une tâche', 'cocher une tâche'], ['tâche', 'todo', 'à faire', 'liste']),
  m('okr', '/objectifs-resultats', 'jour', 'suivre', ['fixer un objectif', 'mesurer un résultat'], ['okr', 'objectif', 'saison', 'kpi']),
  m('weekly', '/revue-hebdo', 'jour', 'suivre', ['faire le bilan de la semaine', 'préparer la semaine prochaine'], ['revue', 'hebdo', 'vendredi', 'bilan', 'rétrospective']),
  m('meetings', '/reunions', 'echanger', 'reunir', ['préparer une réunion', 'noter les décisions d’une réunion', 'écrire un ordre du jour'], ['réunion', 'compte rendu', 'ordre du jour']),
  m('priorities', '/priorites', 'jour', 'organiser', ['choisir mes priorités', 'décider quoi faire aujourd’hui'], ['priorité', 'focus', 'urgent']),
  m('routines', '/routines', 'jour', 'organiser', ['cocher une routine', 'créer une routine'], ['routine', 'habitude', 'quotidien', 'récurrent']),
  m('logbook', '/journal-de-bord', 'ecrire', 'noter', ['noter ce qui s’est passé', 'relire l’historique'], ['journal', 'historique', 'événement'], 'On y écrit (Écrire) mais on y relit sa journée (Ma journée).'),
  m('forms', '/formulaires', 'echanger', 'public', ['créer un formulaire', 'poser une question au public', 'lire les réponses'], ['formulaire', 'questionnaire', 'inscription']),
  m('minisite', '/mini-page', 'creer', 'publier', ['publier ma page', 'mettre à jour ma vitrine'], ['site', 'vitrine', 'page publique', 'web']),
  m('newsletter', '/lettre', 'echanger', 'annoncer', ['envoyer une newsletter', 'écrire à tous mes clients'], ['newsletter', 'lettre', 'emailing', 'mail groupé']),
  m('esign', '/signature', 'ecrire', 'signer', ['faire signer un devis', 'signer sur l’écran', 'faire signer un bon'], ['signature', 'signer', 'tablette']),
  m('portfolio', '/portfolio', 'creer', 'publier', ['montrer mes réalisations', 'ajouter une réalisation'], ['portfolio', 'réalisations', 'photos', 'book']),
  m('dashboard', '/tableau-de-bord', 'jour', 'suivre', ['voir mes chiffres', 'choisir un cadran'], ['tableau de bord', 'indicateurs', 'kpi', 'chiffres']),

  /* ── Clients & revenus (CR) ── */
  m('clients', '/clients', 'contacts', 'clients', ['ajouter un client', 'retrouver un client', 'faire un devis', 'créer un devis'], ['client', 'cliente', 'fiche', 'devis', 'crm']),
  m('invoices', '/facturation', 'argent', 'facturer', ['envoyer une facture', 'créer une facture', 'facturer un client', 'marquer une facture payée'], ['facture', 'facturation', 'paiement', 'encaissement', 'tva']),
  m('orders', '/commandes', 'argent', 'vendre', ['voir les commandes', 'traiter une commande'], ['commande', 'vente', 'site']),
  m('evenements', '/evenements', 'argent', 'vendre', ['organiser un événement', 'vendre des entrées', 'calculer le seuil de rentabilité'], ['événement', 'jauge', 'soirée', 'atelier'], 'On y regarde un seuil et des entrées vendues (Argent), mais un événement est aussi une date à organiser (Ma journée).'),
  m('pipeline', '/pipeline', 'contacts', 'prospecter', ['ajouter un prospect', 'suivre un prospect', 'faire avancer une affaire'], ['prospect', 'lead', 'pipeline', 'opportunité', 'affaire']),
  m('reminders', '/relances', 'argent', 'facturer', ['relancer un impayé', 'relancer une facture', 'réclamer un paiement'], ['relance', 'impayé', 'retard', 'échue']),
  m('subscriptions', '/abonnements', 'argent', 'facturer', ['facturer un abonnement', 'facturer chaque mois'], ['abonnement', 'mensuel', 'récurrent']),
  m('contracts', '/contrats', 'ecrire', 'signer', ['suivre un contrat', 'voir quand un contrat se termine'], ['contrat', 'échéance', 'engagement'], 'Un contrat est un document signé (Écrire) mais aussi un engagement chiffré (Argent).'),
  m('reviews', '/avis', 'contacts', 'ecouter', ['demander un avis', 'lire les avis'], ['avis', 'note', 'étoiles', 'témoignage']),
  m('loyalty', '/fidelite', 'contacts', 'fideliser', ['tamponner une carte de fidélité', 'offrir une récompense'], ['fidélité', 'tampon', 'carte', 'récompense']),
  m('referrals', '/parrainage', 'contacts', 'fideliser', ['noter un parrainage', 'récompenser un parrain'], ['parrainage', 'parrain', 'recommandation']),
  m('booking', '/rdv-en-ligne', 'jour', 'organiser', ['laisser mes clients réserver', 'ouvrir des créneaux en ligne'], ['réservation', 'rdv en ligne', 'prise de rendez-vous'], 'Branché sur l’Agenda (Ma journée), mais c’est une page publique (Échanger).'),
  m('cashCount', '/caisse', 'argent', 'vendre', ['faire la caisse', 'compter les espèces'], ['caisse', 'espèces', 'fond de caisse', 'écart']),
  m('leadScoring', '/scoring-leads', 'contacts', 'prospecter', ['savoir quel prospect appeler', 'classer mes prospects'], ['scoring', 'score', 'lead', 'priorité']),

  /* ── Guichet (GU) ── */
  m('shop', '/boutique', 'argent', 'vendre', ['vendre en ligne', 'voir les paniers abandonnés'], ['boutique', 'e-commerce', 'panier', 'produit']),
  m('ticketing', '/billetterie', 'argent', 'vendre', ['vendre des billets', 'contrôler les entrées'], ['billet', 'billetterie', 'place', 'entrée']),
  m('donations', '/dons', 'argent', 'vendre', ['collecter des dons', 'lancer une collecte'], ['don', 'collecte', 'cagnotte']),
  m('deposits', '/acompte', 'argent', 'facturer', ['demander un acompte', 'faire payer en ligne'], ['acompte', 'paiement en ligne', 'arrhes']),
  m('chatbot', '/chatbot', 'echanger', 'public', ['répondre aux questions des visiteurs', 'voir les questions sans réponse'], ['chatbot', 'bot', 'faq', 'questions']),
  m('switchboard', '/standard', 'echanger', 'public', ['voir les appels reçus', 'relire ce que l’assistant a promis'], ['standard', 'téléphone', 'appel entrant']),

  /* ── Marketing (MK) ── */
  m('video', '/montage-video', 'creer', 'video', ['monter une vidéo', 'couper une vidéo'], ['vidéo', 'montage', 'clip', 'reel']),
  m('videoProductions', '/productions-video', 'creer', 'video', ['suivre une vidéo', 'planifier un tournage'], ['vidéo', 'production', 'tournage']),
  m('adVisuals', '/visuels-pub', 'creer', 'visuels', ['créer un visuel', 'décliner une publicité'], ['visuel', 'pub', 'publicité', 'bannière', 'format']),
  m('postPlanner', '/planificateur', 'creer', 'publier', ['programmer un post', 'planifier les réseaux sociaux'], ['post', 'réseaux sociaux', 'instagram', 'linkedin', 'publication']),
  m('podcast', '/podcast', 'creer', 'video', ['publier un épisode', 'découper un épisode'], ['podcast', 'audio', 'épisode']),
  m('brand', '/identite-visuelle', 'creer', 'visuels', ['décliner mon logo', 'préparer ma charte'], ['logo', 'charte', 'identité', 'marque']),
  m('productShots', '/images-produits', 'creer', 'visuels', ['photographier un produit', 'changer le décor d’une photo'], ['photo', 'produit', 'packshot']),
  m('sentiment', '/sentiment', 'contacts', 'ecouter', ['savoir ce que les clients disent'], ['sentiment', 'opinion', 'retours']),
  m('watch', '/veille-prix', 'argent', 'prevoir', ['comparer mes prix', 'surveiller la concurrence'], ['veille', 'prix', 'concurrence', 'marché'], 'Des prix (Argent), mais c’est une veille marketing (Créer).'),
  m('nps', '/nps', 'contacts', 'ecouter', ['mesurer la satisfaction', 'envoyer un questionnaire de satisfaction'], ['nps', 'satisfaction', 'recommandation', 'note']),

  /* ── Production (PR) ── */
  m('time', '/temps', 'jour', 'suivre', ['noter le temps passé', 'lancer le chronomètre'], ['temps', 'chrono', 'chronomètre', 'heures'], 'Le temps passé sert surtout à chiffrer (Argent) ; rangé dans Ma journée parce qu’on le note en travaillant.'),
  m('expenses', '/depenses', 'argent', 'depenser', ['ajouter une dépense', 'garder un justificatif'], ['dépense', 'frais', 'achat', 'justificatif', 'ticket']),
  m('calculators', '/calculateurs', 'argent', 'prevoir', ['calculer un prix', 'calculer une marge', 'répartir un montant'], ['calculateur', 'prix', 'marge', 'tarif']),
  m('board', '/tableau-projets', 'jour', 'suivre', ['voir les projets en colonnes', 'déplacer un projet'], ['kanban', 'tableau', 'colonnes', 'projet']),
  m('stock', '/stock', 'outils', 'stock', ['vérifier le stock', 'ajouter du stock'], ['stock', 'inventaire', 'rupture', 'article'], TERRAIN),
  m('suppliers', '/fournisseurs', 'contacts', 'partenaires', ['ajouter un fournisseur', 'retrouver un fournisseur'], ['fournisseur', 'achat', 'grossiste']),
  m('shifts', '/planning', 'jour', 'equipe', ['faire le planning', 'voir qui travaille cette semaine'], ['planning', 'horaires', 'roulement', 'équipe']),
  m('checklists', '/controles', 'outils', 'terrain', ['faire un contrôle qualité', 'cocher une check-list'], ['contrôle', 'qualité', 'check-list', 'liste'], TERRAIN),
  m('interventions', '/interventions', 'outils', 'terrain', ['faire un compte rendu d’intervention', 'photographier avant et après'], ['intervention', 'déplacement', 'compte rendu', 'photo'], TERRAIN),
  m('assembly', '/montage', 'outils', 'terrain', ['suivre un chantier', 'cocher une étape de montage'], ['montage', 'chantier', 'étape', 'pose'], TERRAIN),
  m('aftersales', '/sav', 'contacts', 'clients', ['traiter une demande de SAV', 'répondre à une réclamation'], ['sav', 'après-vente', 'réclamation', 'panne'], 'Une relation client (Contacts), mais souvent réglée sur le terrain (Outils).'),
  m('bom', '/nomenclatures', 'outils', 'stock', ['calculer un coût de revient', 'décrire la composition d’un produit'], ['nomenclature', 'composition', 'coût de revient', 'recette'], TERRAIN),
  m('rounds', '/tournees', 'outils', 'terrain', ['préparer une tournée', 'livrer'], ['tournée', 'livraison', 'arrêt'], TERRAIN),
  m('equipment', '/materiel', 'outils', 'terrain', ['réserver du matériel', 'voir qui a le matériel'], ['matériel', 'outil', 'réservation', 'prêt'], TERRAIN),
  m('itineraries', '/itineraires', 'outils', 'terrain', ['optimiser un itinéraire', 'préparer les arrêts de demain'], ['itinéraire', 'trajet', 'route', 'carte'], TERRAIN),
  m('stockForecast', '/prevision-stock', 'outils', 'stock', ['savoir quand commander', 'prévoir une rupture'], ['prévision', 'stock', 'réassort', 'commande'], TERRAIN),
  m('fleet', '/flotte', 'outils', 'terrain', ['suivre un véhicule', 'noter le kilométrage'], ['flotte', 'véhicule', 'voiture', 'camion', 'kilométrage'], TERRAIN),

  /* ── Finance (FI) ── */
  m('cashForecast', '/tresorerie', 'argent', 'prevoir', ['prévoir ma trésorerie', 'voir mon solde à venir'], ['trésorerie', 'solde', 'banque', 'prévision']),
  m('scenarios', '/scenarios', 'argent', 'prevoir', ['tester un budget', 'simuler une embauche', 'simuler une hausse de prix'], ['scénario', 'budget', 'simulation']),
  m('loanSim', '/simulateur-pret', 'argent', 'prevoir', ['simuler un prêt', 'calculer une mensualité'], ['prêt', 'crédit', 'emprunt', 'mensualité']),
  m('analytics', '/analytique', 'argent', 'prevoir', ['voir la marge d’un projet', 'comparer prévu et réel'], ['analytique', 'marge', 'rentabilité']),
  m('reconciliation', '/rapprochement', 'argent', 'comptabilite', ['pointer mon relevé bancaire', 'rapprocher la banque'], ['rapprochement', 'relevé', 'banque', 'pointage']),
  m('taxForecast', '/prevision-fiscale', 'argent', 'comptabilite', ['prévoir mes impôts', 'mettre de côté la TVA'], ['impôt', 'fiscal', 'tva', 'urssaf']),
  m('currencies', '/multi-devises', 'argent', 'comptabilite', ['suivre les montants en devises', 'mesurer le risque de change'], ['devise', 'change', 'dollar', 'taux']),
  m('expenseClaims', '/notes-de-frais', 'argent', 'depenser', ['faire une note de frais', 'scanner un ticket'], ['note de frais', 'ticket', 'remboursement']),
  m('incomingInvoices', '/factures-entrantes', 'argent', 'depenser', ['enregistrer une facture fournisseur', 'payer un fournisseur'], ['facture fournisseur', 'achat', 'échéance']),

  /* ── Collectif (CO) ── */
  m('notes', '/notes', 'ecrire', 'noter', ['prendre une note', 'écrire une note'], ['note', 'bloc-notes', 'idée', 'mémo']),
  m('pages', '/pages', 'ecrire', 'documents', ['créer une page partagée', 'rédiger une fiche'], ['page', 'fiche', 'wiki', 'support']),
  m('dm', '/messages-prives', 'echanger', 'discuter', ['envoyer un message', 'écrire à un collègue'], ['message', 'privé', 'discussion', 'chat']),
  m('groups', '/groupes', 'echanger', 'discuter', ['créer un groupe', 'discuter à plusieurs'], ['groupe', 'fil', 'canal']),
  m('announcements', '/annonces', 'echanger', 'annoncer', ['faire une annonce', 'prévenir toute l’équipe'], ['annonce', 'information', 'tous']),
  m('polls', '/sondages', 'echanger', 'annoncer', ['lancer un sondage', 'faire voter l’équipe'], ['sondage', 'vote', 'question']),
  m('leaves', '/absences', 'jour', 'equipe', ['poser un congé', 'déclarer une absence', 'voir qui est absent'], ['absence', 'congé', 'vacances', 'maladie', 'télétravail']),
  m('directory', '/trombinoscope', 'contacts', 'partenaires', ['retrouver un collègue', 'voir qui fait quoi'], ['trombinoscope', 'annuaire', 'collègue', 'équipe']),
  m('calls', '/appels', 'echanger', 'reunir', ['appeler un collègue', 'lancer un appel vidéo', 'inviter un visiteur'], ['appel', 'visio', 'vidéo', 'téléphone']),
  m('rooms', '/salles', 'echanger', 'reunir', ['réserver une salle', 'voir qui est dans une salle'], ['salle', 'pièce', 'réservation']),
  m('hall', '/hall', 'echanger', 'discuter', ['échanger avec d’autres entreprises'], ['hall', 'entreprises', 'réseau', 'communauté']),

  /* ── RH ── */
  m('recruitment', '/recrutement', 'jour', 'equipe', ['recruter quelqu’un', 'publier une offre'], ['recrutement', 'embauche', 'candidat', 'offre']),
  m('procedures', '/procedures', 'ecrire', 'documents', ['écrire une procédure', 'afficher une procédure'], ['procédure', 'mode opératoire', 'consigne']),
  m('training', '/formation', 'jour', 'equipe', ['suivre une formation', 'voir ce qui est su'], ['formation', 'compétence', 'apprendre']),
  m('certifications', '/habilitations', 'jour', 'equipe', ['vérifier une habilitation', 'voir les habilitations qui expirent'], ['habilitation', 'certification', 'autorisation']),
  m('payslips', '/bulletins', 'argent', 'comptabilite', ['faire une fiche de paie', 'calculer un salaire'], ['paie', 'salaire', 'bulletin', 'fiche de paie']),

  /* ── Livrables (LV) ── */
  m('reports', '/reports', 'ecrire', 'rediger', ['écrire un rapport', 'livrer un rapport à un client'], ['rapport', 'livrable', 'pdf']),
  m('media', '/media', 'creer', 'visuels', ['ranger des photos', 'retrouver une image'], ['média', 'photo', 'image', 'bibliothèque']),
  m('binder', '/classeur', 'ecrire', 'documents', ['ranger un document', 'retrouver une version signée'], ['classeur', 'document', 'version', 'archive']),
  m('sharedEditor', '/editeur-partage', 'ecrire', 'rediger', ['écrire à plusieurs', 'proposer une modification'], ['éditeur', 'document partagé', 'relecture']),

  /* ── Juridique (JU) ── */
  m('clauses', '/clausier', 'ecrire', 'signer', ['rédiger un contrat', 'assembler des clauses'], ['clause', 'clausier', 'contrat type']),
  m('remoteSign', '/signature-a-distance', 'ecrire', 'signer', ['faire signer à distance', 'envoyer un document à signer'], ['signature électronique', 'signer', 'distance']),
  m('gdpr', '/rgpd', 'outils', 'conformite', ['répondre à une demande RGPD', 'tenir le registre des données'], ['rgpd', 'données personnelles', 'cnil', 'effacement']),
  m('csr', '/impact-rse', 'outils', 'conformite', ['calculer mon empreinte carbone'], ['rse', 'carbone', 'empreinte', 'environnement']),
  m('kyc', '/verification-identite', 'outils', 'conformite', ['vérifier une identité', 'contrôler un dossier'], ['kyc', 'identité', 'vérification', 'pièce d’identité']),

  /* ── Outils (OU) ── */
  m('qr', '/outils/qr', 'outils', 'pratique', ['créer un QR code'], ['qr', 'qr code', 'code']),
  m('converters', '/outils/convertisseurs', 'outils', 'pratique', ['convertir une unité', 'calculer la TVA', 'convertir une devise'], ['convertisseur', 'unité', 'tva', 'devise']),
  m('templates', '/outils/modeles', 'ecrire', 'rediger', ['utiliser un modèle de texte', 'créer un modèle'], ['modèle', 'gabarit', 'texte type']),
  m('automations', '/outils/automatisations', 'outils', 'automatiser', ['automatiser une tâche', 'créer une règle automatique'], ['automatisation', 'règle', 'si alors', 'workflow']),
  m('calcPro', '/outils/calculatrice', 'outils', 'pratique', ['faire un calcul', 'relire un calcul'], ['calculatrice', 'calcul', 'ruban']),
  m('dataPort', '/outils/donnees', 'outils', 'automatiser', ['importer des données', 'exporter mes données'], ['import', 'export', 'csv', 'excel', 'données']),
  m('writing', '/outils/redaction', 'ecrire', 'rediger', ['corriger un texte', 'rédiger avec l’assistant'], ['rédaction', 'correction', 'orthographe', 'texte']),
  m('translation', '/outils/traduction', 'ecrire', 'rediger', ['traduire un texte'], ['traduction', 'anglais', 'langue']),

  /* ── Personnel (PE) ── */
  m('budget', '/personnel/budget', 'jour', 'perso', ['savoir ce qu’il me reste à dépenser'], ['budget', 'paie', 'perso', 'reste à vivre'], 'Un budget (Argent), mais personnel : rangé avec les autres modules « pour moi ».'),
  m('courses', '/personnel/courses', 'jour', 'perso', ['faire ma liste de courses'], ['courses', 'liste', 'supermarché']),
  m('habits', '/personnel/habitudes', 'jour', 'perso', ['cocher une habitude', 'suivre mes habitudes'], ['habitude', 'série', 'perso']),
  m('personalGoals', '/personnel/objectifs', 'jour', 'perso', ['fixer un objectif personnel'], ['objectif', 'perso', 'but']),
  m('diary', '/personnel/journal', 'jour', 'perso', ['écrire dans mon journal'], ['journal', 'intime', 'perso'], 'On y écrit (Écrire), mais c’est un module « pour moi », rangé avec les autres.'),
  m('pomodoro', '/personnel/pomodoro', 'jour', 'perso', ['me concentrer 25 minutes', 'lancer un pomodoro'], ['pomodoro', 'concentration', 'minuteur']),
  m('health', '/personnel/sante', 'jour', 'perso', ['noter un rendez-vous médical', 'suivre mes échéances de santé'], ['santé', 'médecin', 'vaccin']),

  /* ── Système (SY) ── */
  m('settings', '/settings', 'outils', 'reglages', ['changer mes réglages', 'modifier mon profil', 'changer la langue'], ['paramètres', 'réglages', 'profil', 'notifications', 'langue']),
  m('members', '/membres', 'outils', 'reglages', ['inviter un membre', 'ajouter une personne'], ['membre', 'invitation', 'place', 'utilisateur']),
  m('assistance', '/assistance', 'outils', 'reglages', ['demander de l’aide', 'contacter le support'], ['assistance', 'aide', 'support', 'prestataire']),
  m('library', '/bibliotheque', 'outils', 'reglages', ['alléger un module', 'voir les modules par section'], ['bibliothèque', 'modules', 'catalogue']),
  m('vault', '/vault', 'outils', 'reglages', ['ranger un mot de passe', 'retrouver un accès'], ['coffre', 'mot de passe', 'clé', 'accès']),
  m('extensions', '/extensions', 'outils', 'reglages', ['installer une extension', 'voir ce qu’une extension demande'], ['extension', 'plugin', 'permission']),

  /* ── La Garde (LG) ── */
  m('gardeOrganigramme', '/garde/organigramme', 'outils', 'deleguer', ['voir qui est en ronde', 'voir l’organigramme de la Garde'], ['garde', 'capitaine', 'chefs', 'organigramme'], GARDE),
  m('gardeSalle', '/garde', 'outils', 'deleguer', ['voir ce que fait la Garde', 'voir le mur des gardes'], ['garde', 'salle', 'mur', 'agents'], GARDE),
  m('gardeAjmani', '/garde/ajmani', 'outils', 'deleguer', ['parler à Ajmani', 'demander une proposition'], ['ajmani', 'chef d’état-major', 'assistant'], GARDE),
  m('gardePile', '/garde/pile', 'outils', 'deleguer', ['donner mon avis', 'décider ce qui attend'], ['avis', 'décision', 'attente', 'pile'], GARDE),
  m('gardeBureaux', '/garde/bureaux', 'outils', 'deleguer', ['parler à un chef de garde'], ['bureaux', 'chef', 'garde'], GARDE),
  m('gardeCommune', '/garde/commune', 'outils', 'deleguer', ['parler à toute la Garde', 'lire la relève du jour'], ['salle commune', 'relève', 'garde'], GARDE),
  m('gardeCalendrier', '/garde/calendrier', 'outils', 'deleguer', ['voir ce que la Garde fera cette semaine'], ['calendrier', 'garde', 'semaine'], GARDE),

  /* ── Supervisor (SU) ── */
  m('tour', '/tour', 'outils', 'superviser', ['voir tout le parc', 'voir le mur du SOC'], ['vue d’ensemble', 'soc', 'parc', 'tour'], SUPERVISION),
  m('orgs', '/tour/organisations', 'outils', 'superviser', ['ouvrir le dossier d’une cliente', 'voir toutes les clientes'], ['dossier', 'organisation', 'cliente'], SUPERVISION),
  m('generator', '/tour/generateur', 'outils', 'superviser', ['créer un espace client', 'préparer un poste sur mesure'], ['atelier', 'générateur', 'espace client'], SUPERVISION),
  m('team', '/team', 'echanger', 'discuter', ['écrire à l’équipe', 'voir qui est en ligne'], ['équipe', 'messagerie', 'présence', 'canal']),
  m('decisions', '/decisions', 'ecrire', 'noter', ['noter une décision', 'retrouver un arbitrage'], ['décision', 'arbitrage', 'journal']),
  m('knowledge', '/knowledge', 'ecrire', 'documents', ['chercher dans la base interne', 'documenter une procédure interne'], ['connaissances', 'base', 'documentation', 'wiki']),

  /* ── Cyber (PA) ── */
  m('supervision', '/supervision', 'outils', 'securiser', ['traiter un incident', 'voir les incidents'], ['supervision', 'incident', 'alerte', 'soc'], CYBER),
  m('sites', '/sites', 'outils', 'securiser', ['ajouter un site client', 'retrouver un site'], ['site', 'registre', 'domaine'], CYBER),
  m('tracker', '/tracker', 'outils', 'securiser', ['installer un tracker', 'voir les trackers'], ['tracker', 'sonde', 'temps réel'], CYBER),
  m('socMaturity', '/maturite-soc', 'outils', 'securiser', ['mesurer la maturité SOC d’une cliente'], ['maturité', 'soc', 'niveau'], CYBER),
  m('orgCompare', '/comparatif', 'outils', 'securiser', ['comparer les clientes'], ['comparatif', 'organisations', 'côte à côte'], CYBER),
  m('customAlerts', '/alertes-personnalisees', 'outils', 'securiser', ['créer une alerte', 'régler un seuil'], ['alerte', 'seuil', 'règle'], CYBER),
  m('clientReport', '/rapport-client', 'outils', 'securiser', ['imprimer le rapport d’une cliente'], ['rapport', 'cliente', 'imprimer', 'pdf'], CYBER),
  m('access', '/tour/journal', 'outils', 'securiser', ['voir qui est entré chez qui'], ['journal d’accès', 'audit', 'connexion'], CYBER),

  /* ── Produits (PD) ── */
  m('scanner', '/scanner', 'outils', 'securiser', ['scanner un site', 'chercher des vulnérabilités'], ['scanner', 'vulnérabilité', 'faille'], CYBER),
  m('comply', '/comply', 'outils', 'securiser', ['vérifier la conformité RGPD d’un site'], ['comply', 'conformité', 'rgpd', 'cookies'], CYBER),
  m('ssl', '/ssl', 'outils', 'securiser', ['surveiller un certificat', 'voir les certificats qui expirent'], ['ssl', 'tls', 'certificat', 'https'], CYBER),
];

const PAR_ID: ReadonlyMap<string, ModuleRegistre> = new Map(REGISTRE.map((e) => [e.id, e]));

export function entreeDuRegistre(id: string): ModuleRegistre | undefined {
  return PAR_ID.get(id);
}

/** La famille d'un module ; `outils` pour un module inconnu du registre (le contrôle l'interdit, l'écran ne plante pas). */
export function familleDe(id: string): Famille {
  return PAR_ID.get(id)?.famille ?? 'outils';
}
