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
        vue('video', '/montage-video', ['monter une vidéo', 'couper une vidéo'], ['vidéo', 'montage', 'clip', 'reel', 'film', 'sous-titres'], {
          en: { verbes: ['edit a video', 'cut a video'], motsCles: ['video', 'editing', 'clip', 'reel', 'subtitles'] },
        }),
        vue('videoProductions', '/productions-video', ['suivre une vidéo', 'planifier un tournage'], ['vidéo', 'production', 'tournage'], {
          en: { verbes: ['track a video', 'plan a shoot'], motsCles: ['video', 'production', 'shoot', 'filming'] },
        }),
      ],
    },
    {
      action: 'video',
      niveau: 'avance',
      vues: [
        vue('podcast', '/podcast', ['publier un épisode', 'découper un épisode'], ['podcast', 'audio', 'épisode'], {
          en: { verbes: ['publish an episode', 'cut an episode'], motsCles: ['podcast', 'audio', 'episode'] },
        }),
      ],
    },
    {
      nom: { fr: 'Visuels et marque', en: 'Visuals and brand' },
      action: 'visuels',
      niveau: 'courant',
      vues: [
        vue('adVisuals', '/visuels-pub', ['créer un visuel', 'décliner une publicité'], ['visuel', 'pub', 'publicité', 'bannière', 'format', 'affiche'], {
          en: { verbes: ['create a visual', 'adapt an ad'], motsCles: ['visual', 'ad', 'advertising', 'banner', 'format', 'poster'] },
        }),
        vue('brand', '/identite-visuelle', ['décliner mon logo', 'préparer ma charte'], ['logo', 'charte', 'identité', 'marque'], {
          en: { verbes: ['resize my logo', 'prepare my brand guidelines'], motsCles: ['logo', 'brand guidelines', 'identity', 'brand'] },
        }),
      ],
    },
    {
      action: 'visuels',
      niveau: 'avance',
      vues: [
        vue('productShots', '/images-produits', ['photographier un produit', 'changer le décor d’une photo'], ['photo', 'produit', 'packshot', 'détourage'], {
          en: { verbes: ['photograph a product', 'change a photo’s background'], motsCles: ['product photo', 'packshot', 'background', 'cutout'] },
        }),
      ],
    },
    {
      action: 'publier',
      niveau: 'courant',
      vues: [
        vue('postPlanner', '/planificateur', ['programmer un post', 'planifier les réseaux sociaux'], ['post', 'réseaux sociaux', 'instagram', 'linkedin', 'publication', 'calendrier éditorial', 'facebook', 'tiktok'], {
          en: { verbes: ['schedule a post', 'plan social media'], motsCles: ['post', 'social media', 'instagram', 'linkedin', 'publication', 'content calendar'] },
        }),
      ],
    },
    {
      nom: { fr: 'Ma page publique', en: 'My public page' },
      action: 'publier',
      niveau: 'courant',
      vues: [
        vue('minisite', '/mini-page', ['publier ma page', 'mettre à jour ma vitrine'], ['site', 'vitrine', 'page publique', 'web', 'site internet'], {
          en: { verbes: ['publish my page', 'update my showcase'], motsCles: ['website', 'showcase', 'public page', 'web', 'mini-site'] },
        }),
        vue('portfolio', '/portfolio', ['montrer mes réalisations', 'ajouter une réalisation'], ['portfolio', 'réalisations', 'photos', 'book'], {
          en: { verbes: ['show my work', 'add a project to my portfolio'], motsCles: ['portfolio', 'work', 'photos', 'showcase'] },
        }),
      ],
    },
    {
      action: 'evenements',
      niveau: 'courant',
      vues: [
        vue('evenements', '/evenements', ['organiser un événement', 'vendre des entrées', 'calculer le seuil de rentabilité'], ['événement', 'jauge', 'soirée', 'atelier'], {
          en: { verbes: ['organize an event', 'sell event tickets', 'work out the break-even point'], motsCles: ['event', 'capacity', 'party', 'workshop', 'break-even'] },
        }),
      ],
    },
  ],
});
