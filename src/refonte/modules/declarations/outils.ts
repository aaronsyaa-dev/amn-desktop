import { declarerFamille, vue } from '../declarer';

/**
 * OUTILS — petits outils, automatisation, terrain, stock, conformité, réglages.
 *
 * Le terrain et le stock restent ici, comme proposé par S1. Regroupés : Calculs
 * (Calculateurs, Calculatrice, Convertisseurs) ; Chantiers (Montage,
 * Interventions) ; Tournées et itinéraires ; Matériel et flotte ; Stock et prévision.
 */

export default declarerFamille({
  id: 'outils',
  ordre: 7,
  teinte: 'outils',
  nom: { fr: 'Outils', en: 'Tools' },
  actions: {
    pratique: { fr: 'Petits outils', en: 'Handy tools' },
    automatiser: { fr: 'Automatiser et importer', en: 'Automate and import' },
    terrain: { fr: 'Sur le terrain', en: 'In the field' },
    stock: { fr: 'Stock et achats', en: 'Stock and purchasing' },
    conformite: { fr: 'Conformité', en: 'Compliance' },
    reglages: { fr: 'Réglages et compte', en: 'Settings and account' },
  },
  modules: [
    { action: 'pratique', niveau: 'courant', vues: [vue('qr', '/outils/qr', ['créer un QR code'], ['qr', 'qr code', 'code'])] },
    {
      nom: { fr: 'Calculs', en: 'Calculations' },
      action: 'pratique',
      niveau: 'courant',
      vues: [
        vue('calculators', '/calculateurs', ['calculer un prix', 'calculer une marge', 'répartir un montant'], ['calculateur', 'prix', 'marge', 'tarif']),
        vue('calcPro', '/outils/calculatrice', ['faire un calcul', 'relire un calcul'], ['calculatrice', 'calcul', 'ruban']),
        vue('converters', '/outils/convertisseurs', ['convertir une unité', 'calculer la TVA', 'convertir une devise'], ['convertisseur', 'unité', 'tva', 'devise']),
      ],
    },
    { action: 'automatiser', niveau: 'courant', vues: [vue('automations', '/outils/automatisations', ['automatiser une tâche', 'créer une règle automatique'], ['automatisation', 'règle', 'si alors', 'workflow'])] },
    { action: 'automatiser', niveau: 'avance', vues: [vue('dataPort', '/outils/donnees', ['importer des données', 'exporter mes données'], ['import', 'export', 'csv', 'excel', 'données'])] },
    {
      nom: { fr: 'Chantiers', en: 'Job sites' },
      action: 'terrain',
      niveau: 'courant',
      vues: [
        vue('assembly', '/montage', ['suivre un chantier', 'cocher une étape de montage'], ['montage', 'chantier', 'étape', 'pose']),
        vue('interventions', '/interventions', ['faire un compte rendu d’intervention', 'photographier avant et après'], ['intervention', 'déplacement', 'compte rendu', 'photo']),
      ],
    },
    { action: 'terrain', niveau: 'courant', vues: [vue('checklists', '/controles', ['faire un contrôle qualité', 'cocher une check-list'], ['contrôle', 'qualité', 'check-list', 'liste'])] },
    {
      nom: { fr: 'Tournées et itinéraires', en: 'Rounds and routes' },
      action: 'terrain',
      niveau: 'courant',
      vues: [
        vue('rounds', '/tournees', ['préparer une tournée', 'livrer'], ['tournée', 'livraison', 'arrêt']),
        vue('itineraries', '/itineraires', ['optimiser un itinéraire', 'préparer les arrêts de demain'], ['itinéraire', 'trajet', 'route', 'carte']),
      ],
    },
    {
      nom: { fr: 'Matériel et flotte', en: 'Equipment and fleet' },
      action: 'terrain',
      niveau: 'courant',
      vues: [
        vue('equipment', '/materiel', ['réserver du matériel', 'voir qui a le matériel'], ['matériel', 'outil', 'réservation', 'prêt']),
        vue('fleet', '/flotte', ['suivre un véhicule', 'noter le kilométrage'], ['flotte', 'véhicule', 'voiture', 'camion', 'kilométrage']),
      ],
    },
    {
      nom: { fr: 'Stock et prévision', en: 'Stock and forecast' },
      action: 'stock',
      niveau: 'courant',
      vues: [
        vue('stock', '/stock', ['vérifier le stock', 'ajouter du stock'], ['stock', 'inventaire', 'rupture', 'article']),
        vue('stockForecast', '/prevision-stock', ['savoir quand commander', 'prévoir une rupture'], ['prévision', 'stock', 'réassort', 'commande']),
      ],
    },
    { action: 'stock', niveau: 'avance', vues: [vue('bom', '/nomenclatures', ['calculer un coût de revient', 'décrire la composition d’un produit'], ['nomenclature', 'composition', 'coût de revient', 'recette'])] },
    { action: 'conformite', niveau: 'avance', vues: [vue('gdpr', '/rgpd', ['répondre à une demande RGPD', 'tenir le registre des données'], ['rgpd', 'données personnelles', 'cnil', 'effacement'])] },
    { action: 'conformite', niveau: 'avance', vues: [vue('csr', '/impact-rse', ['calculer mon empreinte carbone'], ['rse', 'carbone', 'empreinte', 'environnement'])] },
    { action: 'conformite', niveau: 'avance', vues: [vue('kyc', '/verification-identite', ['vérifier une identité', 'contrôler un dossier'], ['kyc', 'identité', 'vérification', 'pièce d’identité'])] },
    { action: 'reglages', niveau: 'essentiel', vues: [vue('settings', '/settings', ['changer mes réglages', 'modifier mon profil', 'changer la langue'], ['paramètres', 'réglages', 'profil', 'notifications', 'langue'])] },
    { action: 'reglages', niveau: 'courant', vues: [vue('members', '/membres', ['inviter un membre', 'ajouter une personne'], ['membre', 'invitation', 'place', 'utilisateur'])] },
    { action: 'reglages', niveau: 'courant', vues: [vue('assistance', '/assistance', ['demander de l’aide', 'contacter le support'], ['assistance', 'aide', 'support', 'prestataire'])] },
    { action: 'reglages', niveau: 'courant', vues: [vue('library', '/bibliotheque', ['alléger un module', 'voir les modules par section'], ['bibliothèque', 'modules', 'catalogue'])] },
    { action: 'reglages', niveau: 'courant', vues: [vue('vault', '/vault', ['ranger un mot de passe', 'retrouver un accès'], ['coffre', 'mot de passe', 'clé', 'accès'])] },
    { action: 'reglages', niveau: 'avance', vues: [vue('extensions', '/extensions', ['installer une extension', 'voir ce qu’une extension demande'], ['extension', 'plugin', 'permission'])] },
  ],
});
