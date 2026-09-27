import { langueActive } from '../i18n';

/**
 * LES NOMS ET LES DESCRIPTIONS DES ÉCRANS DE STUDIO ET DE STRATÉGIE — en langage courant, FR et EN.
 *
 * Constat : « Liège », « Enquête », « Recette visuelle », « Budget de performance », « Croquis »,
 * « Attribution »… parlaient à qui avait écrit les cahiers, pas à qui découvre l'écran. Chaque écran
 * a maintenant un nom qui dit ce qu'on y fait, et une phrase qui dit à quoi il sert — la même
 * discipline que les modules du Poste de travail.
 *
 * Une seule table, lue par la navigation des bureaux, les sous-onglets, la palette (Ctrl/⌘ E),
 * les onglets d'un site du Studio et la bannière de première ouverture. Les noms français sont
 * aussi ceux du catalogue (`catalogue.ts`) : ils doivent rester identiques.
 */
export interface Libelle {
  fr: string;
  en: string;
  descFr: string;
  descEn: string;
}

export const LIBELLES: Record<string, Libelle> = {
  /* ── Studio ── */
  '/studio': {
    fr: 'Tous les sites',
    en: 'All sites',
    descFr:
      'Chaque site ou application d’une cliente, avec sa maquette en ligne. Un clic sur la maquette ouvre le vrai site ; le nom ouvre son espace de travail.',
    descEn: 'Every client website or app, with its live mock-up. Click the mock-up to open the real site; click the name to open its workspace.',
  },
  '/studio/clientes': {
    fr: 'Sites par cliente',
    en: 'Sites by client',
    descFr: 'Les sites rangés par fiche client. Reliez chaque site à sa cliente de l’onglet Clients, ou ajoutez-lui un site.',
    descEn: 'Sites grouped by client record. Link each site to its client from the Clients tab, or add a site for them.',
  },
  '/studio/performance': {
    fr: 'Poids des pages',
    en: 'Page weight',
    descFr:
      'Le poids de chaque page face à une limite fixée par site. Une page trop lourde est lente à charger : elle bloque la mise en ligne tant qu’elle dépasse.',
    descEn: 'Each page’s weight against a limit set per site. A page that is too heavy loads slowly and blocks going live until it is back under the limit.',
  },
  '/studio/recette': {
    fr: 'Avant / après',
    en: 'Before / after',
    descFr: 'Deux captures d’une même page, avant et après une modification, et ce qui a changé. Quelqu’un valide que le résultat est bon.',
    descEn: 'Two screenshots of the same page, before and after a change, and what moved. Someone signs off that the result is right.',
  },
  '/studio/accessibilite': {
    fr: 'Accessibilité',
    en: 'Accessibility',
    descFr: 'Ce qui empêche certaines personnes d’utiliser un site (texte trop pâle, image sans description, navigation impossible au clavier), site par site.',
    descEn: 'What stops some people from using a site (text too faint, images without a description, no keyboard navigation), site by site.',
  },
  'piece:croquis': {
    fr: 'Maquettes et idées',
    en: 'Mock-ups & ideas',
    descFr: 'Les maquettes du site — une image, ou le lien d’un déploiement en ligne. Un clic sur une maquette y épingle une idée numérotée.',
    descEn: 'The site’s mock-ups — an image, or a live deployment link. Click a mock-up to pin a numbered idea on it.',
  },
  'piece:prompts': {
    fr: 'Textes pour l’IA',
    en: 'AI prompts',
    descFr: 'Les consignes données à l’IA pour ce site, version après version, avec le résultat retenu. On ne perd jamais une version qui a marché.',
    descEn: 'The instructions given to the AI for this site, version after version, with the result kept. A version that worked is never lost.',
  },
  'piece:notes': {
    fr: 'Notes',
    en: 'Notes',
    descFr: 'Ce qu’il faut savoir avant de toucher au site : préférences de la cliente, accès, fournisseurs.',
    descEn: 'What to know before touching the site: the client’s preferences, access details, suppliers.',
  },
  'piece:analytique': {
    fr: 'Statistiques',
    en: 'Statistics',
    descFr: 'Les visites et les chiffres du site, semaine après semaine, comparés à la semaine d’avant.',
    descEn: 'The site’s visits and figures, week by week, compared with the week before.',
  },
  'piece:livraison': {
    fr: 'Mise en ligne',
    en: 'Going live',
    descFr: 'La liste à cocher avant chaque mise en ligne, et l’historique des versions publiées.',
    descEn: 'The checklist before each release, and the history of published versions.',
  },
  'piece:retours': {
    fr: 'Retours de la cliente',
    en: 'Client feedback',
    descFr: 'Les demandes de la cliente, épinglées sur la page qu’elles concernent, à traiter une par une.',
    descEn: 'The client’s requests, pinned on the page they concern, to handle one by one.',
  },
  /* ── Stratégie ── */
  '/strategie': {
    fr: 'Vue d’ensemble',
    en: 'Overview',
    descFr: 'Les campagnes en cours, les publications de la semaine et les prospects, sur un seul tableau.',
    descEn: 'Current campaigns, this week’s posts and prospects, on a single board.',
  },
  '/strategie/campagnes': {
    fr: 'Campagnes',
    en: 'Campaigns',
    descFr: 'Chaque action marketing, de l’idée aux résultats : idée, scénario, production, publiée, terminée.',
    descEn: 'Each marketing action, from idea to results: idea, script, production, published, done.',
  },
  '/strategie/temoignages': {
    fr: 'Témoignages clients',
    en: 'Client testimonials',
    descFr: 'Ce que les clientes disent de vous, mot pour mot, et si elles ont accepté qu’on le publie.',
    descEn: 'What clients say about you, word for word, and whether they agreed to have it published.',
  },
  '/strategie/storyboards': {
    fr: 'Découpage vidéo',
    en: 'Video storyboards',
    descFr: 'Une vidéo découpée en plans : la durée de chacun, ce qu’on y voit, et son image.',
    descEn: 'A video broken into shots: each shot’s length, what it shows, and its picture.',
  },
  '/strategie/calendrier': {
    fr: 'Calendrier des publications',
    en: 'Posting calendar',
    descFr: 'Ce qui sort sur LinkedIn, Instagram, Facebook et dans la lettre d’information, jour par jour, et les semaines sans rien.',
    descEn: 'What goes out on LinkedIn, Instagram, Facebook and in the newsletter, day by day, and the weeks with nothing.',
  },
  '/strategie/pipeline': {
    fr: 'Suivi des prospects',
    en: 'Prospect tracking',
    descFr:
      'Les clientes possibles, étape par étape — premier contact, intérêt confirmé, devis envoyé, gagnée ou perdue — et la prochaine chose à faire pour chacune.',
    descEn: 'Potential clients, step by step — first contact, confirmed interest, quote sent, won or lost — and the next thing to do for each.',
  },
  '/strategie/attribution': {
    fr: 'D’où viennent les clientes',
    en: 'Where clients come from',
    descFr: 'Pour chaque cliente gagnée : une campagne, une recommandation, une recherche en ligne… et ce que chaque origine a rapporté.',
    descEn: 'For each client won: a campaign, a referral, an online search… and how much each source brought in.',
  },
  '/strategie/enquete': {
    fr: 'Questions de marché',
    en: 'Market questions',
    descFr: 'Une question qu’on se pose sur le marché, les indices pour et contre, et la réponse quand on en sait assez.',
    descEn: 'A question about the market, the evidence for and against, and the answer once you know enough.',
  },
  '/strategie/objectifs': {
    fr: 'Objectifs chiffrés',
    en: 'Targets',
    descFr: 'Une cible et une période (« 5 nouvelles clientes en octobre ») : l’écran dit chaque jour si l’on est en avance ou en retard.',
    descEn: 'A target and a period (“5 new clients in October”): the screen tells you every day whether you are ahead or behind.',
  },
  '/strategie/trackers': {
    fr: 'Tendances de l’équipe',
    en: 'Team trends',
    descFr: 'Quatre indicateurs de l’équipe (heures, objectifs, lecture du matin, retours traités à temps), comparés à la période d’avant.',
    descEn: 'Four team indicators (hours, targets, morning read-out, feedback handled on time), compared with the previous period.',
  },
  '/strategie/liege': {
    fr: 'Tableau d’idées',
    en: 'Idea board',
    descFr: 'Les notes en vrac à garder sous les yeux : une idée pas encore mûre, une phrase entendue, un chiffre à vérifier.',
    descEn: 'Loose notes to keep in view: an idea not yet ripe, something overheard, a figure to check.',
  },
};

/** Le nom d'un écran dans la langue active ; `repli` pour les écrans hors table. */
export function nomEcran(route: string, repli: string): string {
  const l = LIBELLES[route];
  if (!l) return repli;
  return langueActive() === 'en' ? l.en : l.fr;
}

/** La phrase qui dit à quoi sert l'écran, dans la langue active ; `null` hors table. */
export function descriptionEcran(route: string): string | null {
  const l = LIBELLES[route];
  if (!l) return null;
  return langueActive() === 'en' ? l.descEn : l.descFr;
}
