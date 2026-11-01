/**
 * LES JEUX « CRÉER ET PRODUIRE » — stock (H15), catalogue (MR05), commandes
 * (MR07, MR08), chantiers (H16), photos de chantier (MR10), marque (H17),
 * vidéos (MR01), pages publiques (MR02), tournées (MR03), matériel (MR04),
 * réservations (MR06), flotte (MR09), qualité (MR11).
 *
 * Les liens tiennent : la quantité d'un produit en stock est celle de son
 * article (somme des mouvements) ; une commande en tournée a ses étapes de
 * tournée ; un écart de qualité pointe un contrôle qui existe. Les plaques
 * d'immatriculation sont invalides par construction.
 */

import { ARTICLES_ACHAT, PRESTATIONS } from './fond';
import { cle, cycle, fabriquer, hasardDe, heure, nomClient, quand, salaries } from './commun';
import { ajouterJours, centimes, compter, estOuvre, lundiDe, type Jour } from './outils';
import type { Contexte, FicheClient, Fournisseur, Membre } from './types';
import type {
  ArticleStock, Chantier, Commande, Controle, DossierPhoto, EcartQualite, EtapeTournee, Equipement, Marque, ModeleControle, MouvementStock,
  PagePublique, Produit, Reservation, Ressource, Vehicule, Video,
} from './types-suite';

/* ----------------------------------- Stock ----------------------------------- */

export function genererArticles(ctx: Contexte, fournisseurs: readonly Fournisseur[]): ArticleStock[] {
  const h = hasardDe(ctx.graine, 'articles');
  const n = compter(ctx.volumes.articles, [0, 6, 30, 300]);
  const emplacements = ['Entrepôt', 'Atelier', 'Véhicule 1', 'Réserve du bureau'];
  const liste = fabriquer(n, (i): ArticleStock => {
    const [nom, prix] = ARTICLES_ACHAT[(i - 1) % ARTICLES_ACHAT.length];
    const variante = i > ARTICLES_ACHAT.length ? ` (${Math.ceil(i / ARTICLES_ACHAT.length)})` : '';
    const seuil = h.pondere([[5, 3], [10, 4], [20, 2]] as const);
    // Un cinquième des articles passe sous le seuil : H15 doit avoir de quoi alerter.
    const bas = i % 5 === 3;
    const reception = Math.round(seuil * h.choix([3, 4, 6]));
    const mouvements: MouvementStock[] = [{ id: `${cle('ar', i)}-m1`, le: ajouterJours(ctx.aujourdhui, -h.entier(120, 300)), delta: reception, motif: 'Réception' }];
    let reste = reception;
    const ventes = h.entier(3, 7);
    for (let k = 0; k < ventes; k += 1) {
      const delta = Math.min(reste, Math.round((reception / ventes) * h.choix([0.4, 0.7, 1])));
      if (delta <= 0) continue;
      reste -= delta;
      mouvements.push({ id: `${cle('ar', i)}-m${k + 2}`, le: ajouterJours(ctx.aujourdhui, -h.entier(1, 110)), delta: -delta, motif: h.choix(['Vente', 'Vente', 'Perte'] as const) });
    }
    // Pour « bas » : on retire jusqu'à passer sous le seuil ; sinon on réapprovisionne si on est déjà trop bas.
    if (bas && reste >= seuil) mouvements.push({ id: `${cle('ar', i)}-mi`, le: ajouterJours(ctx.aujourdhui, -h.entier(1, 20)), delta: -(reste - Math.max(0, seuil - h.entier(1, 3))), motif: 'Inventaire' });
    if (!bas && reste < seuil) mouvements.push({ id: `${cle('ar', i)}-mr`, le: ajouterJours(ctx.aujourdhui, -h.entier(1, 20)), delta: seuil * 2 - reste, motif: 'Réception' });
    return {
      id: cle('ar', i),
      nom: `${nom}${variante}`,
      sku: `ART-${String(1000 + i)}`,
      fournisseurId: fournisseurs.length ? h.choix(fournisseurs).id : null,
      seuilAlerte: seuil,
      prixAchatCents: centimes(prix * h.choix([0.95, 1, 1.05])),
      emplacement: h.choix(emplacements),
      mouvements: mouvements.sort((a, b) => a.le.localeCompare(b.le)),
    };
  });
  return liste;
}

/** La quantité d'un article : la somme de ses mouvements (jamais éditée directement). */
export const quantiteEnStock = (a: Pick<ArticleStock, 'mouvements'>): number => a.mouvements.reduce((s, m) => s + m.delta, 0);

/* ---------------------------------- Catalogue ---------------------------------- */

export function genererProduits(ctx: Contexte, equipe: readonly Membre[], articles: readonly ArticleStock[]): Produit[] {
  const h = hasardDe(ctx.graine, 'produits');
  const n = compter(ctx.volumes.produits, [0, 5, 16, 120]);
  const gens = salaries(equipe);
  const liste: Produit[] = [];
  const stockables = articles.slice(0, Math.round(n * 0.5));
  stockables.forEach((a, i) => {
    liste.push({
      id: cle('pd', liste.length + 1),
      nom: a.nom,
      description: 'Article en stock.',
      prixCents: Math.round(a.prixAchatCents * h.choix([1.4, 1.6, 1.9])),
      type: 'produit en stock',
      quantite: quantiteEnStock(a),
      niveauCible: a.seuilAlerte * 3,
      seuilAlerte: a.seuilAlerte,
      responsableEmail: h.choix(gens).email,
      fournisseurId: a.fournisseurId,
      articleId: a.id,
      etat: i === 9 ? 'archivé' : 'actif',
    });
  });
  const sources = PRESTATIONS.filter(() => true);
  while (liste.length < n) {
    const [nom, prix, rec] = sources[liste.length % sources.length];
    liste.push({
      id: cle('pd', liste.length + 1),
      nom: liste.length >= sources.length + stockables.length ? `${nom} (${liste.length})` : nom,
      description: rec ? 'Abonnement facturé chaque mois.' : 'Prestation sur devis.',
      prixCents: centimes(prix),
      type: rec ? 'abonnement' : 'service',
      quantite: null,
      niveauCible: null,
      seuilAlerte: null,
      responsableEmail: h.choix(gens).email,
      fournisseurId: null,
      articleId: null,
      etat: 'actif',
    });
  }
  return liste.slice(0, n);
}

/* ---------------------------------- Commandes ---------------------------------- */

export function genererCommandes(ctx: Contexte, equipe: readonly Membre[], clients: readonly FicheClient[], produits: readonly Produit[]): Commande[] {
  const h = hasardDe(ctx.graine, 'commandes');
  const n = clients.length && produits.length ? compter(ctx.volumes.commandes, [0, 4, 14, 150]) : 0;
  const gens = salaries(equipe);
  const etats = cycle(h, ['À préparer', 'En préparation', 'Prête', 'Remise', 'Remise', 'Remise'] as const, n);
  return fabriquer(n, (i) => {
    const c = h.choix(clients);
    const nb = h.entier(1, 3);
    const lignes = h.echantillon(produits.filter((p) => p.etat === 'actif'), nb).map((p) => ({ produitId: p.id, libelle: p.nom, quantite: p.type === 'produit en stock' ? h.entier(1, 4) : 1, prixCents: p.prixCents }));
    const preparation = etats[i - 1];
    const age = preparation === 'Remise' ? h.entier(2, 90) : h.entier(0, 6);
    const creeLe = ajouterJours(ctx.aujourdhui, -age);
    const prevue = ajouterJours(creeLe, h.entier(1, 6));
    const remise = h.pondere([['Retrait', 4], ['Colis', 3], ['Tournée', 3]] as const);
    const etapesLibelles = ['Préparer les articles', 'Contrôler la commande', 'Emballer', 'Remettre au client'];
    const faites = preparation === 'À préparer' ? 0 : preparation === 'En préparation' ? 2 : preparation === 'Prête' ? 3 : 4;
    return {
      id: cle('cm', i),
      numero: `#${1000 + i}`,
      clientId: c.id,
      clientNom: nomClient(c),
      lignes,
      remise,
      creeLe,
      prevueLe: prevue,
      responsableEmail: h.choix(gens).email,
      urgente: preparation !== 'Remise' && h.chance(0.12),
      etapes: etapesLibelles.map((libelle, k) => ({ libelle, fait: k < faites })),
      preuveRemise: preparation === 'Remise',
      paiement: preparation === 'Remise' ? 'Payé' : h.pondere([['Payé', 6], ['À payer', 4]] as const),
      preparation,
    };
  }).sort((a, b) => b.numero.localeCompare(a.numero));
}

/* ---------------------------------- Chantiers ---------------------------------- */

const OBJETS_CHANTIER = ['Aménagement de la boutique', 'Installation du matériel', 'Mise en place du réseau', 'Séance photo sur site', 'Rénovation de l’accueil', 'Pose de l’enseigne'];

export function genererChantiers(ctx: Contexte, equipe: readonly Membre[], clients: readonly FicheClient[]): Chantier[] {
  const h = hasardDe(ctx.graine, 'chantiers');
  const n = compter(ctx.volumes.chantiers, [0, 2, 6, 30]);
  const gens = salaries(equipe);
  const etats = cycle(h, ['En cours', 'En cours', 'À venir', 'En retard', 'Terminé'] as const, n);
  return fabriquer(n, (i) => {
    const c = clients.length ? h.choix(clients) : null;
    const objet = h.choix(OBJETS_CHANTIER);
    const etat = etats[i - 1];
    const duree = h.entier(3, 10) * 7;
    const debut = etat === 'À venir' ? ajouterJours(ctx.aujourdhui, h.entier(5, 40)) : etat === 'Terminé' ? ajouterJours(ctx.aujourdhui, -duree - h.entier(5, 60)) : ajouterJours(ctx.aujourdhui, -h.entier(7, duree - 7));
    const fin = etat === 'En retard' ? ajouterJours(ctx.aujourdhui, -h.entier(2, 14)) : ajouterJours(debut, duree);
    const semaines = Math.max(2, Math.round(duree / 7));
    const faites = etat === 'Terminé' ? semaines : etat === 'À venir' ? 0 : Math.max(1, Math.floor(semaines * h.choix([0.3, 0.5, 0.7])));
    const budget = centimes(h.entier(18, 140) * 100);
    return {
      id: cle('ch', i),
      nom: c ? `${nomClient(c)} — ${objet}` : objet,
      sousTitre: `${semaines} semaines · ${h.entier(2, 4)} personnes`,
      clientId: c?.id ?? null,
      debutLe: debut,
      finPrevueLe: fin,
      etapes: fabriquer(semaines, (k) => ({ nom: h.choix(['Préparation', 'Livraison du matériel', 'Installation', 'Réglages', 'Contrôle', 'Remise']), semaine: k, faite: k <= faites })),
      equipe: h.echantillon(gens, h.entier(2, Math.min(4, gens.length))).map((g) => g.email),
      budgetCents: budget,
      depenseCents: etat === 'À venir' ? 0 : Math.round(budget * (etat === 'Terminé' ? h.choix([0.9, 0.97, 1.05]) : etat === 'En retard' ? h.choix([0.85, 1.1]) : (faites / semaines) * h.choix([0.9, 1, 1.1]))),
      teinte: i % 8,
      statut: etat,
    };
  });
}

/* ------------------------------- Photos de chantier ------------------------------- */

export function genererDossiersPhotos(ctx: Contexte, equipe: readonly Membre[], chantiers: readonly Chantier[], clients: readonly FicheClient[]): DossierPhoto[] {
  const h = hasardDe(ctx.graine, 'dossiersPhotos');
  const n = compter(ctx.volumes.dossiersPhotos, [0, 2, 5, 24]);
  const gens = salaries(equipe);
  return fabriquer(n, (i) => {
    const ch = chantiers.length && i <= chantiers.length ? chantiers[i - 1] : null;
    const c = ch ? clients.find((x) => x.id === ch.clientId) ?? null : clients.length ? h.choix(clients) : null;
    const demarre = ch ? ch.statut !== 'À venir' : h.chance(0.8);
    const nb = demarre ? h.entier(4, 30) : 0;
    return {
      id: cle('dp', i),
      titre: ch ? ch.nom : c ? `Photos — ${nomClient(c)}` : 'Photos',
      description: demarre ? 'Photos prises à chaque étape.' : 'Dossier prêt pour le début du chantier.',
      chantierId: ch?.id ?? null,
      clientId: c?.id ?? null,
      responsables: h.echantillon(gens, h.entier(1, Math.min(2, gens.length))).map((g) => g.email),
      // Des repères : jamais d'image.
      photos: fabriquer(nb, (k) => ({ id: `${cle('dp', i)}-p${k}`, phase: h.pondere([['Avant', 2], ['Pendant', 5], ['Après', 2]] as const), le: ajouterJours(ctx.aujourdhui, -h.entier(0, 40)), lieu: h.choix(['Entrée', 'Atelier', 'Façade', 'Salle principale', 'Local technique']), auteurEmail: h.choix(gens).email })),
      demarre,
      debutPrevuLe: ch?.debutLe ?? ajouterJours(ctx.aujourdhui, h.entier(-30, 20)),
    };
  });
}

/* ------------------------------------ Marque ------------------------------------ */

export function genererMarque(ctx: Contexte): Marque[] {
  if (ctx.volumes.marque === 'vide') return [];
  return [{
    id: 'mq-1',
    nom: 'Maison Vallon',
    logos: [{ variante: 'fond noir', format: 'SVG' }, { variante: 'fond noir', format: 'PNG' }, { variante: 'fond clair', format: 'SVG' }, { variante: 'fond clair', format: 'PNG' }],
    palette: [
      { nom: 'Vert sapin', hex: '#1F3A34' }, { nom: 'Sable', hex: '#E8DFCB' }, { nom: 'Terre cuite', hex: '#B5593C' },
      { nom: 'Ciel', hex: '#8FB3C7' }, { nom: 'Encre', hex: '#16191C' }, { nom: 'Craie', hex: '#F6F3EC' },
    ],
    typographie: { famille: 'Source Sans', graisses: [400, 500, 600, 700] },
    modelesVisuels: [
      { nom: 'Publication carrée', format: 'Carré', largeur: 1080, hauteur: 1080 },
      { nom: 'Histoire', format: 'Vertical', largeur: 1080, hauteur: 1920 },
      { nom: 'Bannière', format: 'Horizontal', largeur: 1500, hauteur: 500 },
      { nom: 'Carte de visite', format: 'Paysage', largeur: 1012, hauteur: 637 },
    ],
  }];
}

/* ------------------------------ Vidéos et pages publiques ------------------------------ */

const TITRES_VIDEOS = ['Présentation de l’entreprise', 'Visite de l’atelier', 'Témoignage client', 'Tutoriel : prendre rendez-vous', 'Coulisses d’un chantier', 'Les nouveautés du mois'];

export function genererVideos(ctx: Contexte, equipe: readonly Membre[]): Video[] {
  const h = hasardDe(ctx.graine, 'videos');
  const n = compter(ctx.volumes.videos, [0, 2, 6, 20]);
  const gens = salaries(equipe);
  const etapes = cycle(h, ['Idée', 'Tournage', 'Montage', 'Relecture', 'Publiée'] as const, n);
  return fabriquer(n, (i) => {
    const etape = etapes[i - 1];
    return {
      id: cle('vd', i),
      titre: i <= TITRES_VIDEOS.length ? TITRES_VIDEOS[i - 1] : `${TITRES_VIDEOS[i % TITRES_VIDEOS.length]} (${i})`,
      description: 'Vidéo courte pour le site et les réseaux.',
      etape,
      avancement: { Idée: 5, Tournage: 30, Montage: 60, Relecture: 85, Publiée: 100 }[etape],
      responsables: h.echantillon(gens, h.entier(1, 2)).map((g) => g.email),
      prevueLe: etape === 'Publiée' ? ajouterJours(ctx.aujourdhui, -h.entier(3, 60)) : ajouterJours(ctx.aujourdhui, h.entier(2, 40)),
      dureeSec: h.choix([45, 60, 90, 120, 180]),
      format: h.chance(0.7) ? 'horizontal' : 'vertical',
      fichiers: etape === 'Idée' ? [] : etape === 'Tournage' ? ['rushes.zip'] : ['montage.mp4', 'sous-titres.srt'],
      lienPublication: etape === 'Publiée' ? `https://video.maison-vallon.exemple.test/v/${i}` : null,
      vues: etape === 'Publiée' ? h.entier(40, 2400) : 0,
    };
  });
}

const PAGES_PUBLIQUES = ['Accueil', 'Nos services', 'À propos', 'Contact', 'Tarifs', 'Actualités', 'Mentions légales', 'Prendre rendez-vous', 'Foire aux questions', 'Réalisations', 'Recrutement', 'Plan du site'];

export function genererPagesPubliques(ctx: Contexte, equipe: readonly Membre[]): PagePublique[] {
  const h = hasardDe(ctx.graine, 'pagesPubliques');
  const n = compter(ctx.volumes.pagesPubliques, [0, 2, 5, 12]);
  const gens = salaries(equipe);
  const statuts = cycle(h, ['Publiée', 'Publiée', 'Modifications non publiées', 'Brouillon'] as const, n);
  return fabriquer(n, (i) => {
    const statut = statuts[i - 1];
    const travail = h.entier(2, 9);
    return {
      id: cle('pu', i),
      titre: PAGES_PUBLIQUES[(i - 1) % PAGES_PUBLIQUES.length],
      description: 'Page visible sur le site de l’entreprise.',
      versionEnLigne: statut === 'Brouillon' ? null : statut === 'Publiée' ? travail : travail - 1,
      versionTravail: travail,
      responsableEmail: h.choix(gens).email,
      statut,
      visites7j: statut === 'Brouillon' ? 0 : h.entier(12, 900),
    };
  });
}

/* ---------------------------------- Tournées ---------------------------------- */

export function genererEtapesTournee(ctx: Contexte, equipe: readonly Membre[], clients: readonly FicheClient[], commandes: readonly Commande[]): EtapeTournee[] {
  const h = hasardDe(ctx.graine, 'etapesTournee');
  const n = clients.length ? compter(ctx.volumes.etapesTournee, [0, 4, 12, 60]) : 0;
  const conducteurs = salaries(equipe).filter((m) => m.fonction !== 'Dirigeante');
  const aLivrer = commandes.filter((c) => c.remise === 'Tournée' && c.preparation !== 'Remise');
  const liste: EtapeTournee[] = [];
  const jours: Jour[] = [];
  for (let d = 0; jours.length < Math.max(1, Math.ceil(n / 6)); d += 1) {
    const j = ajouterJours(ctx.aujourdhui, d);
    if (estOuvre(j)) jours.push(j);
  }
  jours.forEach((jour, jd) => {
    const par = Math.ceil(n / jours.length);
    let heureCourante = 8 * 60 + h.entier(0, 3) * 15;
    for (let k = 0; k < par && liste.length < n; k += 1) {
      const c = h.choix(clients);
      const commande = aLivrer.length && h.chance(0.4) ? h.choix(aLivrer) : null;
      const duree = h.choix([20, 30, 45, 60]);
      const arrivee = heureCourante;
      heureCourante += duree + h.entier(10, 30);
      const arriveeMs = Date.parse(quand(jour, heure(Math.floor(arrivee / 60), arrivee % 60)));
      const etat: EtapeTournee['etat'] = jd > 0 ? 'À faire' : arriveeMs + duree * 60_000 <= ctx.maintenant ? 'Fait' : arriveeMs <= ctx.maintenant ? 'En route' : 'À faire';
      liste.push({
        id: cle('et', liste.length + 1),
        jour,
        ordre: k + 1,
        clientId: c.id,
        lieu: nomClient(c),
        adresse: c.adresse,
        arriveePrevue: heure(Math.floor(arrivee / 60), arrivee % 60),
        dureeMin: duree,
        etat,
        heureFixee: h.chance(0.3),
        conducteurEmail: h.choix(conducteurs.length ? conducteurs : salaries(equipe)).email,
        commandeId: commande?.id ?? null,
      });
    }
  });
  return liste;
}

/* ----------------------------- Matériel (MR04) et flotte (MR09) ----------------------------- */

const EQUIPEMENTS = ['Ordinateur portable', 'Appareil photo', 'Perceuse à colonne', 'Imprimante grand format', 'Vidéoprojecteur', 'Escabeau', 'Niveau laser', 'Enceinte de salle', 'Routeur de chantier', 'Caisse à outils', 'Tablette de relevé', 'Micro cravate'];

export function genererEquipements(ctx: Contexte, equipe: readonly Membre[]): Equipement[] {
  const h = hasardDe(ctx.graine, 'equipements');
  const n = compter(ctx.volumes.equipements, [0, 4, 14, 80]);
  const gens = salaries(equipe);
  return fabriquer(n, (i) => {
    const nom = EQUIPEMENTS[(i - 1) % EQUIPEMENTS.length];
    const periodicite = h.choix([6, 12, 12, 24]);
    const dernier = ajouterJours(ctx.aujourdhui, -h.entier(0, periodicite * 30));
    const etat = h.pondere([['Bon', 8], ['À vérifier', 2], ['En panne', 1]] as const);
    return {
      id: cle('eq', i),
      nom: i > EQUIPEMENTS.length ? `${nom} (${i})` : nom,
      serie: `N° ${String(h.entier(1000, 9999))}-${h.choix(['A', 'B', 'C'])}`,
      categorie: h.choix(['Informatique', 'Image et son', 'Outillage', 'Mesure']),
      etat,
      affectation: h.chance(0.6) ? { type: 'personne', libelle: h.choix(gens).nomComplet } : { type: 'lieu', libelle: h.choix(['Atelier', 'Salle clients', 'Réserve', 'Véhicule 1']) },
      prochainEntretienLe: ajouterJours(dernier, periodicite * 30),
      periodiciteMois: periodicite,
      valeurCents: centimes(h.entier(40, 2400)),
      achatLe: ajouterJours(ctx.aujourdhui, -h.entier(90, 1500)),
      statut: i === n && n >= 14 ? 'Au rebut' : 'En service',
    };
  });
}

const MODELES_VEHICULES = ['Utilitaire compact', 'Fourgon aménagé', 'Citadine électrique', 'Break', 'Camionnette plateau', 'Utilitaire 12 m³', 'Berline de service', 'Petit fourgon'];

export function genererVehicules(ctx: Contexte, equipe: readonly Membre[]): Vehicule[] {
  const h = hasardDe(ctx.graine, 'vehicules');
  const n = compter(ctx.volumes.vehicules, [0, 1, 3, 8]);
  const gens = salaries(equipe);
  // Format SIV : deux lettres, trois chiffres, deux lettres ; les lettres I, O et U n'y sont jamais utilisées : une plaque qui en contient n'existe pas.
  const plaque = (): string => `${h.choix(['I', 'O', 'U'])}${h.choix(['I', 'O', 'U'])}-${String(h.entier(100, 999))}-${h.choix(['I', 'O', 'U'])}${h.choix(['I', 'O', 'U'])}`;
  return fabriquer(n, (i) => {
    const km = h.entier(12_000, 160_000);
    const enKm = h.chance(0.5);
    return {
      id: cle('ve', i),
      modele: MODELES_VEHICULES[(i - 1) % MODELES_VEHICULES.length],
      plaque: plaque(),
      kilometrage: km,
      conducteurEmail: h.choix(gens).email,
      etat: h.pondere([['Disponible', 6], ['En tournée', 3], ['À l’atelier', 1]] as const),
      prochainEntretien: enKm ? { km: Math.ceil((km + 1000) / 5000) * 5000, le: null } : { km: null, le: ajouterJours(ctx.aujourdhui, h.entier(-10, 200)) },
      assuranceLe: ajouterJours(ctx.aujourdhui, h.entier(-5, 330)),
      controleTechniqueLe: ajouterJours(ctx.aujourdhui, h.entier(-20, 600)),
    };
  });
}

/* ------------------------------ Réservations (MR06) ------------------------------ */

const RESSOURCES: readonly (readonly [string, Ressource['type'], string])[] = [
  ['Salle clients', 'salle', 'Salle clients et atelier'], ['Atelier', 'salle', 'Salle clients et atelier'], ['Vidéoprojecteur', 'matériel', 'Matériel'],
  ['Utilitaire compact', 'véhicule', 'Véhicules'], ['Appareil photo', 'matériel', 'Matériel'], ['Salle de réunion', 'salle', 'Salles'],
];

export function genererRessources(ctx: Contexte): Ressource[] {
  const n = compter(ctx.volumes.ressources, [0, 3, 6, 12]);
  return fabriquer(n, (i) => {
    const [nom, type, groupe] = RESSOURCES[(i - 1) % RESSOURCES.length];
    return { id: cle('rs', i), nom: i > RESSOURCES.length ? `${nom} ${Math.ceil(i / RESSOURCES.length)}` : nom, type, groupe, regles: { dureeMaxMin: type === 'salle' ? 240 : 480, annulationGratuiteH: 24, rappelMin: 30 }, ouverture: { jours: [1, 2, 3, 4, 5], debut: '08:00', fin: '18:00' } };
  });
}

export function genererReservations(ctx: Contexte, equipe: readonly Membre[], clients: readonly FicheClient[], ressources: readonly Ressource[]): Reservation[] {
  const h = hasardDe(ctx.graine, 'reservations');
  const n = ressources.length ? compter(ctx.volumes.reservations, [0, 4, 16, 120]) : 0;
  const gens = salaries(equipe);
  const liste: Reservation[] = [];
  const occupe = new Map<string, number[][]>();
  const libre = (rid: string, a: number, b: number): boolean => !(occupe.get(rid) ?? []).some(([x, y]) => a < y && b > x);
  let essais = 0;
  while (liste.length < n && essais < n * 30) {
    essais += 1;
    const r = h.choix(ressources);
    let jour = ajouterJours(lundiDe(ctx.aujourdhui), h.entier(0, 20));
    while (!estOuvre(jour)) jour = ajouterJours(jour, 1);
    const debutH = h.entier(8, 16);
    const duree = h.choix([60, 90, 120, 180]);
    const a = Date.parse(quand(jour, heure(debutH, h.choix([0, 30]))));
    const b = a + Math.min(duree, r.regles.dureeMaxMin) * 60_000;
    if (!libre(r.id, a, b)) continue;
    occupe.set(r.id, [...(occupe.get(r.id) ?? []), [a, b]]);
    const c = clients.length && r.type === 'salle' && h.chance(0.4) ? h.choix(clients) : null;
    liste.push({
      id: cle('rv', liste.length + 1),
      ressourceId: r.id,
      usage: c ? `Rendez-vous ${nomClient(c)}` : h.choix(['Atelier contenus', 'Revue de projet', 'Formation', 'Séance photo', 'Livraison']),
      debutAt: new Date(a).toISOString(),
      finAt: new Date(b).toISOString(),
      reserveParEmail: h.choix(gens).email,
      clientId: c?.id ?? null,
      motif: h.choix(['', 'Préparation à prévoir', 'Clés à retirer à l’accueil']),
      statut: h.pondere([['confirmée', 8], ['en attente', 2], ['annulée', 1]] as const),
    });
  }
  return liste.sort((x, y) => x.debutAt.localeCompare(y.debutAt));
}

/* ------------------------------- Qualité (MR11) ------------------------------- */

const MODELES_CONTROLE: readonly (readonly [string, readonly (readonly [string, 'normale' | 'critique', 'aucune' | 'facultative' | 'obligatoire'])[]])[] = [
  ['Contrôle de fin de chantier', [['Zone dégagée et propre', 'normale', 'facultative'], ['Matériel rangé', 'normale', 'aucune'], ['Installation conforme au devis', 'critique', 'obligatoire'], ['Client informé', 'normale', 'aucune']]],
  ['Contrôle à la livraison', [['Quantités conformes', 'critique', 'obligatoire'], ['Emballage intact', 'normale', 'facultative'], ['Bon de livraison signé', 'critique', 'obligatoire']]],
  ['Vérification mensuelle du matériel', [['État général', 'normale', 'facultative'], ['Entretien à jour', 'critique', 'aucune'], ['Rangement', 'normale', 'aucune']]],
  ['Contrôle d’accueil', [['Affichage à jour', 'normale', 'aucune'], ['Propreté', 'normale', 'facultative']]],
];

export function genererModelesControle(ctx: Contexte): ModeleControle[] {
  const n = compter(ctx.volumes.modelesControle, [0, 1, 4, 8]);
  return fabriquer(n, (i) => {
    const [nom, points] = MODELES_CONTROLE[(i - 1) % MODELES_CONTROLE.length];
    return { id: cle('mc', i), nom: i > MODELES_CONTROLE.length ? `${nom} (${i})` : nom, points: points.map(([libelle, criticite, preuve], k) => ({ id: `${cle('mc', i)}-p${k + 1}`, libelle, criticite, preuve })) };
  });
}

export function genererControles(ctx: Contexte, equipe: readonly Membre[], modeles: readonly ModeleControle[], chantiers: readonly Chantier[]): { controles: Controle[]; ecarts: EcartQualite[] } {
  const h = hasardDe(ctx.graine, 'controles');
  const n = modeles.length ? compter(ctx.volumes.controles, [0, 2, 8, 40]) : 0;
  const nEcarts = n ? compter(ctx.volumes.ecarts, [0, 1, 4, 20]) : 0;
  const gens = salaries(equipe);
  const controles = fabriquer(n, (i): Controle => {
    const m = h.choix(modeles);
    const ch = chantiers.length && h.chance(0.7) ? h.choix(chantiers) : null;
    const statut = h.pondere([['Terminé', 6], ['En cours', 2], ['À faire', 2]] as const);
    return {
      id: cle('co', i),
      modeleId: m.id,
      chantierId: ch?.id ?? null,
      clientId: ch?.clientId ?? null,
      responsableEmail: h.choix(gens).email,
      le: statut === 'À faire' ? ajouterJours(ctx.aujourdhui, h.entier(0, 10)) : ajouterJours(ctx.aujourdhui, -h.entier(0, 60)),
      resultats: m.points.map((p) => ({ pointId: p.id, conforme: statut === 'À faire' ? null : statut === 'En cours' && h.chance(0.4) ? null : h.chance(0.85) })),
      statut,
    };
  });
  // Un écart naît d'un point non conforme d'un contrôle : on part des contrôles qui en ont.
  const avecNonConformite = controles.filter((c) => c.resultats.some((r) => r.conforme === false));
  const ecarts = fabriquer(Math.min(nEcarts, avecNonConformite.length), (i): EcartQualite => {
    const c = avecNonConformite[(i - 1) % avecNonConformite.length];
    const modele = modeles.find((m) => m.id === c.modeleId);
    const point = modele?.points.find((p) => c.resultats.find((r) => r.pointId === p.id)?.conforme === false);
    return {
      id: cle('ec', i),
      libelle: point?.libelle ? `Non conforme : ${point.libelle.toLowerCase()}` : 'Écart constaté',
      controleId: c.id,
      chantierId: c.chantierId,
      clientId: c.clientId,
      gravite: point?.criticite === 'critique' ? 'critique' : 'mineur',
      echeanceLe: ajouterJours(c.le, h.entier(5, 21)),
      responsableEmail: h.choix(gens).email,
      etat: h.pondere([['ouvert', 5], ['corrigé', 4], ['accepté', 1]] as const),
    };
  });
  return { controles, ecarts };
}

