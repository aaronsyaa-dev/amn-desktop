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
    {
      action: 'pratique',
      niveau: 'courant',
      vues: [
        vue('qr', '/outils/qr', ['créer un QR code'], ['qr', 'qr code', 'code'], {
          en: { verbes: ['create a QR code'], motsCles: ['qr', 'qr code', 'code'] },
        }),
      ],
    },
    {
      nom: { fr: 'Calculs', en: 'Calculations' },
      action: 'pratique',
      niveau: 'courant',
      vues: [
        vue('calculators', '/calculateurs', ['calculer un prix', 'calculer une marge', 'répartir un montant'], ['calculateur', 'prix', 'marge', 'tarif'], {
          en: { verbes: ['work out a price', 'work out a margin', 'split an amount'], motsCles: ['calculator', 'price', 'margin', 'rate', 'pricing'] },
        }),
        vue('calcPro', '/outils/calculatrice', ['faire un calcul', 'relire un calcul'], ['calculatrice', 'calcul', 'ruban'], {
          en: { verbes: ['do a calculation', 'reread a calculation'], motsCles: ['calculator', 'calculation', 'tape'] },
        }),
        vue('converters', '/outils/convertisseurs', ['convertir une unité', 'calculer la TVA', 'convertir une devise'], ['convertisseur', 'unité', 'tva', 'devise'], {
          en: { verbes: ['convert a unit', 'work out VAT', 'convert a currency'], motsCles: ['converter', 'unit', 'vat', 'currency'] },
        }),
      ],
    },
    {
      action: 'automatiser',
      niveau: 'courant',
      vues: [
        vue('automations', '/outils/automatisations', ['automatiser une tâche', 'créer une règle automatique'], ['automatisation', 'règle', 'si alors', 'workflow'], {
          en: { verbes: ['automate a task', 'create an automatic rule'], motsCles: ['automation', 'rule', 'if then', 'workflow'] },
        }),
      ],
    },
    {
      action: 'automatiser',
      niveau: 'avance',
      vues: [
        vue('dataPort', '/outils/donnees', ['importer des données', 'exporter mes données', 'sauvegarder mes données'], ['import', 'export', 'csv', 'excel', 'données', 'sauvegarde', 'backup'], {
          en: { verbes: ['import data', 'export my data', 'back up my data'], motsCles: ['import', 'export', 'csv', 'excel', 'data', 'backup'] },
        }),
      ],
    },
    {
      nom: { fr: 'Chantiers', en: 'Job sites' },
      action: 'terrain',
      niveau: 'courant',
      vues: [
        vue('assembly', '/montage', ['suivre un chantier', 'cocher une étape de montage'], ['montage', 'chantier', 'étape', 'pose'], {
          en: { verbes: ['follow a job site', 'tick off an assembly step'], motsCles: ['assembly', 'job site', 'step', 'installation'] },
        }),
        vue('interventions', '/interventions', ['faire un compte rendu d’intervention', 'photographier avant et après'], ['intervention', 'déplacement', 'compte rendu', 'photo'], {
          en: { verbes: ['write an intervention report', 'photograph before and after'], motsCles: ['intervention', 'call-out', 'report', 'photo', 'field service'] },
        }),
      ],
    },
    {
      action: 'terrain',
      niveau: 'courant',
      vues: [
        vue('checklists', '/controles', ['faire un contrôle qualité', 'cocher une check-list'], ['contrôle', 'qualité', 'check-list', 'liste'], {
          en: { verbes: ['do a quality check', 'tick off a checklist'], motsCles: ['inspection', 'quality', 'checklist', 'control'] },
        }),
      ],
    },
    {
      nom: { fr: 'Tournées et itinéraires', en: 'Rounds and routes' },
      action: 'terrain',
      niveau: 'courant',
      vues: [
        vue('rounds', '/tournees', ['préparer une tournée', 'livrer'], ['tournée', 'livraison', 'arrêt'], {
          en: { verbes: ['prepare a delivery round', 'deliver'], motsCles: ['round', 'delivery', 'stop', 'route'] },
        }),
        vue('itineraries', '/itineraires', ['optimiser un itinéraire', 'préparer les arrêts de demain'], ['itinéraire', 'trajet', 'route', 'carte'], {
          en: { verbes: ['optimize a route', 'prepare tomorrow’s stops'], motsCles: ['route', 'itinerary', 'trip', 'map', 'directions'] },
        }),
      ],
    },
    {
      nom: { fr: 'Matériel et flotte', en: 'Equipment and fleet' },
      action: 'terrain',
      niveau: 'courant',
      vues: [
        vue('equipment', '/materiel', ['réserver du matériel', 'voir qui a le matériel'], ['matériel', 'outil', 'réservation', 'prêt'], {
          en: { verbes: ['book equipment', 'see who has the equipment'], motsCles: ['equipment', 'tools', 'booking', 'loan'] },
        }),
        vue('fleet', '/flotte', ['suivre un véhicule', 'noter le kilométrage'], ['flotte', 'véhicule', 'voiture', 'camion', 'kilométrage'], {
          en: { verbes: ['track a vehicle', 'log the mileage'], motsCles: ['fleet', 'vehicle', 'car', 'van', 'mileage'] },
        }),
      ],
    },
    {
      nom: { fr: 'Stock et prévision', en: 'Stock and forecast' },
      action: 'stock',
      niveau: 'courant',
      vues: [
        vue('stock', '/stock', ['vérifier le stock', 'ajouter du stock'], ['stock', 'inventaire', 'rupture', 'article', 'entrepôt'], {
          en: { verbes: ['check stock', 'add stock'], motsCles: ['stock', 'inventory', 'out of stock', 'item', 'warehouse'] },
        }),
        vue('stockForecast', '/prevision-stock', ['savoir quand commander', 'prévoir une rupture'], ['prévision', 'stock', 'réassort', 'commande'], {
          en: { verbes: ['know when to reorder', 'predict a stock-out'], motsCles: ['forecast', 'stock', 'restock', 'reorder'] },
        }),
      ],
    },
    {
      action: 'stock',
      niveau: 'avance',
      vues: [
        vue('bom', '/nomenclatures', ['calculer un coût de revient', 'décrire la composition d’un produit'], ['nomenclature', 'composition', 'coût de revient', 'recette', 'bom', 'prix de revient'], {
          en: { verbes: ['work out a cost price', 'describe a product’s composition'], motsCles: ['bill of materials', 'composition', 'cost price', 'recipe'] },
        }),
      ],
    },
    {
      action: 'conformite',
      niveau: 'avance',
      vues: [
        vue('gdpr', '/rgpd', ['répondre à une demande RGPD', 'tenir le registre des données'], ['rgpd', 'données personnelles', 'cnil', 'effacement'], {
          en: { verbes: ['answer a GDPR request', 'keep the data register'], motsCles: ['gdpr', 'personal data', 'privacy', 'erasure'] },
        }),
      ],
    },
    {
      action: 'conformite',
      niveau: 'avance',
      vues: [
        vue('csr', '/impact-rse', ['calculer mon empreinte carbone'], ['rse', 'carbone', 'empreinte', 'environnement', 'bilan carbone', 'co2'], {
          en: { verbes: ['work out my carbon footprint'], motsCles: ['csr', 'carbon', 'footprint', 'environment', 'co2'] },
        }),
      ],
    },
    {
      action: 'conformite',
      niveau: 'avance',
      vues: [
        vue('kyc', '/verification-identite', ['vérifier une identité', 'contrôler un dossier'], ['kyc', 'identité', 'vérification', 'pièce d’identité'], {
          en: { verbes: ['verify an identity', 'check a file'], motsCles: ['kyc', 'identity', 'verification', 'id document'] },
        }),
      ],
    },
    {
      action: 'reglages',
      niveau: 'essentiel',
      vues: [
        vue('settings', '/settings', ['changer mes réglages', 'modifier mon profil', 'changer la langue', 'changer le thème', 'réduire les animations', 'régler les notifications'], ['paramètres', 'réglages', 'profil', 'notifications', 'langue', 'thème', 'animations', 'mouvement'], {
          en: { verbes: ['change my settings', 'edit my profile', 'change the language', 'change the theme', 'reduce motion'], motsCles: ['settings', 'preferences', 'profile', 'notifications', 'language', 'theme', 'motion'] },
        }),
      ],
    },
    {
      action: 'reglages',
      niveau: 'courant',
      vues: [
        vue('members', '/membres', ['inviter un membre', 'ajouter une personne', 'retirer un membre', 'changer un rôle'], ['membre', 'invitation', 'place', 'utilisateur', 'rôle'], {
          en: { verbes: ['invite a member', 'add a person', 'remove a member', 'change a role'], motsCles: ['member', 'invitation', 'seat', 'user', 'role'] },
        }),
      ],
    },
    {
      action: 'reglages',
      niveau: 'courant',
      vues: [
        vue('assistance', '/assistance', ['demander de l’aide', 'contacter le support', 'signaler un problème'], ['assistance', 'aide', 'support', 'prestataire', 'bug', 'contact', 'problème'], {
          en: { verbes: ['ask for help', 'contact support', 'report a problem'], motsCles: ['support', 'help', 'bug', 'contact', 'issue'] },
        }),
      ],
    },
    {
      action: 'reglages',
      niveau: 'courant',
      vues: [
        vue('library', '/bibliotheque', ['alléger un module', 'voir les modules par section'], ['bibliothèque', 'modules', 'catalogue'], {
          en: { verbes: ['hide a module', 'see modules by section'], motsCles: ['library', 'modules', 'catalogue', 'catalog'] },
        }),
      ],
    },
    {
      action: 'reglages',
      niveau: 'courant',
      vues: [
        vue('vault', '/vault', ['ranger un mot de passe', 'retrouver un accès'], ['coffre', 'mot de passe', 'clé', 'accès'], {
          en: { verbes: ['store a password', 'find an access'], motsCles: ['vault', 'password', 'key', 'credentials', 'access'] },
        }),
      ],
    },
    {
      action: 'reglages',
      niveau: 'avance',
      vues: [
        vue('extensions', '/extensions', ['installer une extension', 'voir ce qu’une extension demande'], ['extension', 'plugin', 'permission'], {
          en: { verbes: ['install an extension', 'see what an extension asks for'], motsCles: ['extension', 'plugin', 'add-on', 'permission'] },
        }),
      ],
    },
  ],
});
