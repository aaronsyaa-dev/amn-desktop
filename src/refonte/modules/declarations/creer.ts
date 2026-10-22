import { declarerFamille, vue } from '../declarer';

/**
 * CRÉER ET PRODUIRE — vidéo, visuels, publication, événements.
 *
 * Décision validée : les Événements vivent ici. Regroupés : Vidéo (Montage,
 * Production) ; Visuels et marque ; Ma page publique (Mini-page, Portfolio).
 */

export default declarerFamille({
  id: 'creer',
  ordre: 6,
  teinte: 'creer',
  nom: { fr: 'Créer et produire', en: 'Create and produce' },
  actions: {
    video: { fr: 'Vidéo et son', en: 'Video and audio' },
    visuels: { fr: 'Images et visuels', en: 'Images and visuals' },
    publier: { fr: 'Publier', en: 'Publish' },
    evenements: { fr: 'Événements', en: 'Events' },
  },
  modules: [
    {
      nom: { fr: 'Vidéo', en: 'Video' },
      action: 'video',
      niveau: 'courant',
      vues: [
        vue('video', '/montage-video', ['monter une vidéo', 'couper une vidéo'], ['vidéo', 'montage', 'clip', 'reel']),
        vue('videoProductions', '/productions-video', ['suivre une vidéo', 'planifier un tournage'], ['vidéo', 'production', 'tournage']),
      ],
    },
    { action: 'video', niveau: 'avance', vues: [vue('podcast', '/podcast', ['publier un épisode', 'découper un épisode'], ['podcast', 'audio', 'épisode'])] },
    {
      nom: { fr: 'Visuels et marque', en: 'Visuals and brand' },
      action: 'visuels',
      niveau: 'courant',
      vues: [
        vue('adVisuals', '/visuels-pub', ['créer un visuel', 'décliner une publicité'], ['visuel', 'pub', 'publicité', 'bannière', 'format']),
        vue('brand', '/identite-visuelle', ['décliner mon logo', 'préparer ma charte'], ['logo', 'charte', 'identité', 'marque']),
      ],
    },
    { action: 'visuels', niveau: 'avance', vues: [vue('productShots', '/images-produits', ['photographier un produit', 'changer le décor d’une photo'], ['photo', 'produit', 'packshot'])] },
    { action: 'publier', niveau: 'courant', vues: [vue('postPlanner', '/planificateur', ['programmer un post', 'planifier les réseaux sociaux'], ['post', 'réseaux sociaux', 'instagram', 'linkedin', 'publication'])] },
    {
      nom: { fr: 'Ma page publique', en: 'My public page' },
      action: 'publier',
      niveau: 'courant',
      vues: [
        vue('minisite', '/mini-page', ['publier ma page', 'mettre à jour ma vitrine'], ['site', 'vitrine', 'page publique', 'web']),
        vue('portfolio', '/portfolio', ['montrer mes réalisations', 'ajouter une réalisation'], ['portfolio', 'réalisations', 'photos', 'book']),
      ],
    },
    { action: 'evenements', niveau: 'courant', vues: [vue('evenements', '/evenements', ['organiser un événement', 'vendre des entrées', 'calculer le seuil de rentabilité'], ['événement', 'jauge', 'soirée', 'atelier'])] },
  ],
});
