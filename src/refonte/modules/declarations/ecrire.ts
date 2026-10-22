import { declarerFamille, vue } from '../declarer';

/**
 * ÉCRIRE — noter, rédiger, ranger, faire signer.
 *
 * Le Journal est un module à deux types : Pro (l’ancien Journal de bord) et
 * Perso (l’ancien Journal perso), chacun avec sa route et ses données.
 * Regroupés aussi : Notes et pages ; Rédaction et traduction ; Documents
 * (Classeur, Médias) ; Signatures (sur place, à distance).
 */

export default declarerFamille({
  id: 'ecrire',
  ordre: 3,
  teinte: 'ecrire',
  nom: { fr: 'Écrire', en: 'Write' },
  actions: {
    noter: { fr: 'Noter', en: 'Take notes' },
    rediger: { fr: 'Rédiger', en: 'Write' },
    documents: { fr: 'Ranger les documents', en: 'File documents' },
    signer: { fr: 'Faire signer', en: 'Get it signed' },
  },
  modules: [
    {
      nom: { fr: 'Notes et pages', en: 'Notes and pages' },
      action: 'noter',
      niveau: 'essentiel',
      vues: [
        vue('notes', '/notes', ['prendre une note', 'écrire une note'], ['note', 'bloc-notes', 'idée', 'mémo', 'carnet'], {
          en: { verbes: ['take a note', 'write a note'], motsCles: ['note', 'notepad', 'idea', 'memo'] },
        }),
        vue('pages', '/pages', ['créer une page partagée', 'rédiger une fiche'], ['page', 'fiche', 'wiki', 'support'], {
          en: { verbes: ['create a shared page', 'write a sheet'], motsCles: ['page', 'sheet', 'wiki', 'handbook'] },
        }),
      ],
    },
    {
      nom: { fr: 'Journal', en: 'Journal' },
      action: 'noter',
      niveau: 'courant',
      vues: [
        vue('logbook', '/journal-de-bord', ['noter ce qui s’est passé', 'relire l’historique'], ['journal', 'historique', 'événement'], {
          etiquette: { fr: 'Pro', en: 'Work' },
          en: { verbes: ['note what happened', 'reread the history'], motsCles: ['journal', 'log', 'history', 'event', 'logbook'] },
        }),
        vue('diary', '/personnel/journal', ['écrire dans mon journal'], ['journal', 'intime', 'perso', 'carnet intime', 'écrire ma journée'], {
          etiquette: { fr: 'Perso', en: 'Personal' },
          en: { verbes: ['write in my journal'], motsCles: ['journal', 'diary', 'private', 'personal'] },
        }),
      ],
    },
    {
      action: 'noter',
      niveau: 'courant',
      vues: [
        vue('decisions', '/decisions', ['noter une décision', 'retrouver un arbitrage'], ['décision', 'arbitrage', 'journal'], {
          en: { verbes: ['note a decision', 'find a ruling'], motsCles: ['decision', 'ruling', 'log'] },
        }),
      ],
    },
    {
      action: 'rediger',
      niveau: 'courant',
      vues: [
        vue('reports', '/reports', ['écrire un rapport', 'livrer un rapport à un client'], ['rapport', 'livrable', 'pdf'], {
          en: { verbes: ['write a report', 'deliver a report to a customer'], motsCles: ['report', 'deliverable', 'pdf'] },
        }),
      ],
    },
    {
      nom: { fr: 'Rédaction et traduction', en: 'Writing and translation' },
      action: 'rediger',
      niveau: 'courant',
      vues: [
        vue('writing', '/outils/redaction', ['corriger un texte', 'rédiger avec l’assistant', 'reformuler un texte'], ['rédaction', 'correction', 'orthographe', 'texte', 'grammaire', 'reformuler'], {
          en: { verbes: ['fix a text', 'write with the assistant'], motsCles: ['writing', 'proofreading', 'spelling', 'grammar', 'text', 'rewrite'] },
        }),
        vue('translation', '/outils/traduction', ['traduire un texte', 'traduire en anglais'], ['traduction', 'anglais', 'langue', 'traducteur'], {
          en: { verbes: ['translate a text', 'translate into English'], motsCles: ['translation', 'translate', 'english', 'language'] },
        }),
      ],
    },
    {
      action: 'rediger',
      niveau: 'courant',
      vues: [
        vue('templates', '/outils/modeles', ['utiliser un modèle de texte', 'créer un modèle'], ['modèle', 'gabarit', 'texte type', 'réponse type', 'canevas'], {
          en: { verbes: ['use a text template', 'create a template'], motsCles: ['template', 'boilerplate', 'canned reply'] },
        }),
      ],
    },
    {
      action: 'rediger',
      niveau: 'avance',
      vues: [
        vue('sharedEditor', '/editeur-partage', ['écrire à plusieurs', 'proposer une modification'], ['éditeur', 'document partagé', 'relecture'], {
          en: { verbes: ['write together', 'suggest an edit'], motsCles: ['editor', 'shared document', 'review', 'co-writing'] },
        }),
      ],
    },
    {
      nom: { fr: 'Documents', en: 'Documents' },
      action: 'documents',
      niveau: 'courant',
      vues: [
        vue('binder', '/classeur', ['ranger un document', 'retrouver une version signée', 'archiver un document'], ['classeur', 'document', 'version', 'archive', 'contrat signé', 'pdf'], {
          en: { verbes: ['file a document', 'find a signed version'], motsCles: ['binder', 'document', 'version', 'archive', 'folder'] },
        }),
        vue('media', '/media', ['ranger des photos', 'retrouver une image'], ['média', 'photo', 'image', 'bibliothèque', 'galerie', 'fichiers'], {
          en: { verbes: ['file photos', 'find an image'], motsCles: ['media', 'photo', 'image', 'library', 'gallery', 'files'] },
        }),
      ],
    },
    {
      action: 'documents',
      niveau: 'courant',
      vues: [
        vue('knowledge', '/knowledge', ['chercher dans la base interne', 'documenter une procédure interne'], ['connaissances', 'base', 'documentation', 'wiki'], {
          en: { verbes: ['search the internal knowledge base', 'document an internal procedure'], motsCles: ['knowledge', 'base', 'documentation', 'wiki'] },
        }),
      ],
    },
    {
      nom: { fr: 'Signatures', en: 'Signatures' },
      action: 'signer',
      niveau: 'courant',
      vues: [
        vue('esign', '/signature', ['faire signer un devis', 'signer sur l’écran', 'faire signer un bon'], ['signature', 'signer', 'tablette'], {
          en: { verbes: ['have a quote signed', 'sign on screen', 'have a slip signed'], motsCles: ['signature', 'sign', 'tablet', 'on-site'] },
        }),
        vue('remoteSign', '/signature-a-distance', ['faire signer à distance', 'envoyer un document à signer'], ['signature électronique', 'signer', 'distance'], {
          en: { verbes: ['have it signed remotely', 'send a document to sign'], motsCles: ['e-signature', 'sign', 'remote', 'electronic signature'] },
        }),
      ],
    },
    {
      action: 'signer',
      niveau: 'avance',
      vues: [
        vue('clauses', '/clausier', ['rédiger un contrat', 'assembler des clauses'], ['clause', 'clausier', 'contrat type'], {
          en: { verbes: ['draft a contract', 'assemble clauses'], motsCles: ['clause', 'clause library', 'contract template'] },
        }),
      ],
    },
  ],
});
