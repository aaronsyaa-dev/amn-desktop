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
        vue('notes', '/notes', ['prendre une note', 'écrire une note'], ['note', 'bloc-notes', 'idée', 'mémo']),
        vue('pages', '/pages', ['créer une page partagée', 'rédiger une fiche'], ['page', 'fiche', 'wiki', 'support']),
      ],
    },
    {
      nom: { fr: 'Journal', en: 'Journal' },
      action: 'noter',
      niveau: 'courant',
      vues: [
        vue('logbook', '/journal-de-bord', ['noter ce qui s’est passé', 'relire l’historique'], ['journal', 'historique', 'événement'], { etiquette: { fr: 'Pro', en: 'Work' } }),
        vue('diary', '/personnel/journal', ['écrire dans mon journal'], ['journal', 'intime', 'perso'], { etiquette: { fr: 'Perso', en: 'Personal' } }),
      ],
    },
    { action: 'noter', niveau: 'courant', vues: [vue('decisions', '/decisions', ['noter une décision', 'retrouver un arbitrage'], ['décision', 'arbitrage', 'journal'])] },
    { action: 'rediger', niveau: 'courant', vues: [vue('reports', '/reports', ['écrire un rapport', 'livrer un rapport à un client'], ['rapport', 'livrable', 'pdf'])] },
    {
      nom: { fr: 'Rédaction et traduction', en: 'Writing and translation' },
      action: 'rediger',
      niveau: 'courant',
      vues: [
        vue('writing', '/outils/redaction', ['corriger un texte', 'rédiger avec l’assistant'], ['rédaction', 'correction', 'orthographe', 'texte']),
        vue('translation', '/outils/traduction', ['traduire un texte'], ['traduction', 'anglais', 'langue']),
      ],
    },
    { action: 'rediger', niveau: 'courant', vues: [vue('templates', '/outils/modeles', ['utiliser un modèle de texte', 'créer un modèle'], ['modèle', 'gabarit', 'texte type'])] },
    { action: 'rediger', niveau: 'avance', vues: [vue('sharedEditor', '/editeur-partage', ['écrire à plusieurs', 'proposer une modification'], ['éditeur', 'document partagé', 'relecture'])] },
    {
      nom: { fr: 'Documents', en: 'Documents' },
      action: 'documents',
      niveau: 'courant',
      vues: [
        vue('binder', '/classeur', ['ranger un document', 'retrouver une version signée'], ['classeur', 'document', 'version', 'archive']),
        vue('media', '/media', ['ranger des photos', 'retrouver une image'], ['média', 'photo', 'image', 'bibliothèque']),
      ],
    },
    { action: 'documents', niveau: 'courant', vues: [vue('knowledge', '/knowledge', ['chercher dans la base interne', 'documenter une procédure interne'], ['connaissances', 'base', 'documentation', 'wiki'])] },
    {
      nom: { fr: 'Signatures', en: 'Signatures' },
      action: 'signer',
      niveau: 'courant',
      vues: [
        vue('esign', '/signature', ['faire signer un devis', 'signer sur l’écran', 'faire signer un bon'], ['signature', 'signer', 'tablette']),
        vue('remoteSign', '/signature-a-distance', ['faire signer à distance', 'envoyer un document à signer'], ['signature électronique', 'signer', 'distance']),
      ],
    },
    { action: 'signer', niveau: 'avance', vues: [vue('clauses', '/clausier', ['rédiger un contrat', 'assembler des clauses'], ['clause', 'clausier', 'contrat type'])] },
  ],
});
