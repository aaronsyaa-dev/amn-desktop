/**
 * LES JEUX « ÉCRIRE ET RETENIR » — pages (H10), fichiers (H11), demandes de
 * signature (H12), modèles (ME03), journal (ME01), rédactions (ME02), archives
 * (ME04), base de connaissances (ME05).
 *
 * Aucun fichier n'a de contenu : seulement ses métadonnées. Le statut de
 * signature d'un fichier est déduit de sa demande de signature, pas tiré à
 * part : les deux écrans (H11 et H12) disent la même chose.
 */

import { apercu, ageRecent, cle, cycle, empreinteCourte, fabriquer, hasardDe, nomClient, quandPasse, salaries } from './commun';
import { ajouterJours, compter, ecartJours, estOuvre, type Jour } from './outils';
import { moi } from './equipe';
import type { Contexte, Devis, Facture, FicheClient, Interlocuteur, Membre } from './types';
import type {
  Bloc, DemandeSignature, ElementArchive, EntreeConnaissance, EntreeJournal, Fichier, EtatSignature, ModeleDocument, Page, TexteRedige,
} from './types-suite';


/* -------------------------------- Fichiers -------------------------------- */

const MODELES_FICHIERS: readonly { type: Fichier['typeMetier']; ext: string; dossier: string; octets: [number, number]; nom: (c: string, an: string, n: number) => string }[] = [
  { type: 'Contrat', ext: 'pdf', dossier: 'Contrats', octets: [90e3, 420e3], nom: (c, an) => `Contrat de prestation — ${c} (${an})` },
  { type: 'Rapport', ext: 'pdf', dossier: 'Rapports', octets: [200e3, 1.4e6], nom: (c, an) => `Rapport d’activité — ${c} (${an})` },
  { type: 'Présentation', ext: 'pptx', dossier: 'Présentations', octets: [1.2e6, 8e6], nom: (c) => `Présentation de l’offre — ${c}` },
  { type: 'Tableur', ext: 'xlsx', dossier: 'Suivi', octets: [30e3, 380e3], nom: (c) => `Suivi des livrables — ${c}` },
  { type: 'Photo', ext: 'jpg', dossier: 'Photos', octets: [1.5e6, 6e6], nom: (c, _a, n) => `Photo ${c} ${String(n).padStart(3, '0')}` },
  { type: 'Autre', ext: 'docx', dossier: 'Documents', octets: [20e3, 240e3], nom: (c) => `Cahier des charges — ${c}` },
];

export function genererFichiers(ctx: Contexte, equipe: readonly Membre[], clients: readonly FicheClient[], devis: readonly Devis[], factures: readonly Facture[]): Fichier[] {
  const h = hasardDe(ctx.graine, 'fichiers');
  const n = compter(ctx.volumes.fichiers, [0, 8, 40, 400]);
  const gens = salaries(equipe);
  const liste: Fichier[] = [];
  const ajouter = (p: Omit<Fichier, 'id' | 'proprietaireEmail' | 'partages' | 'lienExterne' | 'versions' | 'archive' | 'signature'>): void => {
    const proprio = h.choix(gens);
    const autres = h.echantillon(gens.filter((g) => g.email !== proprio.email), h.entier(0, 2));
    const jours = h.pondere([[7, 2], [30, 5], [90, 1]] as const);
    liste.push({
      ...p,
      id: cle('fi', liste.length + 1),
      proprietaireEmail: proprio.email,
      partages: [{ email: proprio.email, droit: 'Propriétaire' }, ...autres.map((a) => ({ email: a.email, droit: h.choix(['Modification', 'Lecture seule'] as const) }))],
      lienExterne: h.chance(0.15) ? (() => { const creeLe = ajouterJours(ctx.aujourdhui, -h.entier(0, 40)); return { jours, creeLe, expireLe: ajouterJours(creeLe, jours) }; })() : null,
      versions: h.pondere([[1, 6], [2, 3], [3, 1]] as const),
      archive: false,
      signature: null,
    });
  };
  // Un fichier par devis envoyé ou accepté et par facture émise : les liens se retrouvent.
  for (const d of devis.filter((x) => x.status === 'accepted' || x.status === 'sent').slice(0, Math.round(n * 0.25))) {
    ajouter({ nom: `Devis ${d.numero}`, extension: 'pdf', tailleOctets: h.entier(60e3, 180e3), typeMetier: 'Devis', modifieAt: d.updatedAt, dossier: `Devis/${d.createdAt.slice(0, 4)}`, clientId: d.clientId });
  }
  for (const f of factures.filter((x) => x.status === 'issued' || x.status === 'paid').slice(0, Math.round(n * 0.25))) {
    ajouter({ nom: `Facture ${f.number}`, extension: 'pdf', tailleOctets: h.entier(40e3, 140e3), typeMetier: 'Facture', modifieAt: quandPasse(ctx.maintenant, f.issuedAt, '10:00'), dossier: `Factures/${f.issuedAt.slice(0, 4)}`, clientId: f.clientId });
  }
  let nPhoto = 0;
  while (liste.length < n) {
    const m = h.choix(MODELES_FICHIERS);
    const c = clients.length ? h.choix(clients) : null;
    const an = String(Number(ctx.aujourdhui.slice(0, 4)) - h.entier(0, 1));
    nPhoto += 1;
    ajouter({ nom: m.nom(c ? nomClient(c) : 'la maison', an, nPhoto), extension: m.ext, tailleOctets: h.entier(m.octets[0], m.octets[1]), typeMetier: m.type, modifieAt: quandPasse(ctx.maintenant, ajouterJours(ctx.aujourdhui, -ageRecent(h, 300)), `${String(h.entier(8, 18)).padStart(2, '0')}:${String(h.entier(0, 59)).padStart(2, '0')}`), dossier: `${m.dossier}/${an}`, clientId: c?.id ?? null });
  }
  return liste.slice(0, n).sort((a, b) => b.modifieAt.localeCompare(a.modifieAt));
}

/* ---------------------------- Demandes de signature ---------------------------- */

const ORDRE_ETATS: readonly EtatSignature[] = ['Signée', 'Envoyée', 'Ouverte', 'Partiellement signée', 'À envoyer', 'Signée', 'Refusée', 'Expirée', 'Signée', 'Envoyée'];

export function genererSignatures(
  ctx: Contexte,
  equipe: readonly Membre[],
  clients: readonly FicheClient[],
  interlocuteurs: readonly Interlocuteur[],
  fichiers: Fichier[],
): DemandeSignature[] {
  const h = hasardDe(ctx.graine, 'signatures');
  const n = Math.min(compter(ctx.volumes.signatures, [0, 3, 10, 60]), fichiers.length);
  const candidats = fichiers.filter((f) => f.typeMetier === 'Contrat' || f.typeMetier === 'Devis' || f.typeMetier === 'Autre');
  const dirigeant = moi(equipe);
  const etats = cycle(h, ORDRE_ETATS, n);
  const liste: DemandeSignature[] = [];
  h.melanger(candidats.length >= n ? candidats : fichiers).slice(0, n).forEach((f, i) => {
    const c = clients.find((x) => x.id === f.clientId) ?? null;
    const contact = interlocuteurs.find((x) => x.organisationType === 'client' && x.organisationId === String(f.clientId));
    const externe = { nom: contact?.nomComplet ?? c?.name ?? 'Signataire externe', email: contact?.email ?? c?.email ?? `signataire@exemple.test` };
    const etat = etats[i];
    const nbSignataires = etat === 'Partiellement signée' ? 2 : h.chance(0.3) ? 2 : 1;
    const envoye = etat === 'À envoyer' ? null : ajouterJours(ctx.aujourdhui, -(etat === 'Expirée' ? h.entier(18, 40) : etat === 'Signée' ? h.entier(3, 40) : h.entier(1, 9)));
    const echeance = envoye ? ajouterJours(envoye, 14) : null;
    const signataires = [
      { ...externe, ordre: 1 },
      ...(nbSignataires === 2 ? [{ nom: dirigeant.nomComplet, email: dirigeant.email, ordre: 2 }] : []),
    ].map((s, k) => {
      let statut: DemandeSignature['signataires'][number]['statut'] = 'En attente';
      if (etat === 'Signée') statut = 'Signé';
      else if (etat === 'Partiellement signée') statut = k === 0 ? 'Signé' : 'Ouvert';
      else if (etat === 'Ouverte') statut = k === 0 ? 'Ouvert' : 'En attente';
      else if (etat === 'Refusée') statut = k === 0 ? 'Refusé' : 'En attente';
      return { ...s, statut, signeAt: statut === 'Signé' && envoye ? quandPasse(ctx.maintenant, ajouterJours(envoye, h.entier(0, 2)), '11:30') : null };
    });
    liste.push({
      id: cle('sg', i + 1),
      fichierId: f.id,
      titre: f.nom.replace(/\.[a-z]+$/, ''),
      clientId: f.clientId,
      montantCents: f.typeMetier === 'Devis' ? h.entier(8, 90) * 10_000 : null,
      signataires,
      envoyeAt: envoye ? quandPasse(ctx.maintenant, envoye, '09:30') : null,
      echeanceLe: echeance,
      relances: etat === 'Envoyée' || etat === 'Ouverte' ? h.entier(0, 2) : 0,
      etat,
      empreinteCourte: empreinteCourte(h),
    });
    f.signature = etat === 'Signée' ? 'Signé' : etat === 'Envoyée' || etat === 'Ouverte' || etat === 'Partiellement signée' ? 'En attente de signature' : null;
  });
  return liste;
}

/* ---------------------------------- Pages ---------------------------------- */

const CORPS_PAGES: readonly { titre: string; icone: string; espace: Page['espace']; blocs: Bloc[] }[] = [
  { titre: 'Procédure de sauvegarde', icone: 'shield', espace: 'Équipe', blocs: [{ type: 'titre', texte: 'Avant de commencer' }, { type: 'tache', texte: 'Vérifier l’espace disponible', fait: true }, { type: 'tache', texte: 'Lancer la sauvegarde', fait: true }, { type: 'tache', texte: 'Noter la date dans le journal', fait: false }] },
  { titre: 'Point d’équipe du lundi', icone: 'users', espace: 'Équipe', blocs: [{ type: 'titre', texte: 'Ordre du jour' }, { type: 'liste', texte: 'Factures en retard\nCharge de la semaine\nQuestions ouvertes' }, { type: 'texte', texte: 'Compte rendu à envoyer avant midi.' }] },
  { titre: 'Idées de contenus', icone: 'pen', espace: 'Personnel', blocs: [{ type: 'texte', texte: 'Trois articles à écrire ce mois-ci : un cas client, un guide pratique, une actualité.' }, { type: 'tache', texte: 'Choisir le sujet du cas client', fait: false }] },
  { titre: 'Modèle de compte rendu', icone: 'file', espace: 'Modèles', blocs: [{ type: 'titre', texte: 'Participants' }, { type: 'titre', texte: 'Décisions' }, { type: 'titre', texte: 'Actions' }] },
  { titre: 'Charte rédactionnelle', icone: 'book', espace: 'Équipe', blocs: [{ type: 'citation', texte: 'Simple, précis, vouvoiement partout.' }, { type: 'liste', texte: 'Phrases courtes\nPas de jargon\nUn exemple par idée' }] },
  { titre: 'Accueillir un nouveau client', icone: 'check', espace: 'Équipe', blocs: [{ type: 'tache', texte: 'Créer la fiche client', fait: true }, { type: 'tache', texte: 'Envoyer le courriel de bienvenue', fait: true }, { type: 'tache', texte: 'Planifier le premier rendez-vous', fait: false }] },
];

export function genererPages(ctx: Contexte, equipe: readonly Membre[], clients: readonly FicheClient[]): Page[] {
  const h = hasardDe(ctx.graine, 'pages');
  const n = compter(ctx.volumes.pages, [0, 6, 24, 150]);
  const gens = salaries(equipe);
  const m = moi(equipe);
  const liste: Page[] = [];
  const ajouter = (p: Pick<Page, 'title' | 'icone' | 'espace' | 'blocs'> & Partial<Pick<Page, 'clientId' | 'parentId'>>): void => {
    const auteur = p.espace === 'Personnel' ? m : h.choix(gens);
    const contributeurs = p.espace === 'Personnel' ? [] : h.echantillon(gens.filter((g) => g.email !== auteur.email), h.entier(0, 2)).map((x) => x.email);
    liste.push({
      id: cle('pg', liste.length + 1),
      title: p.title,
      icone: p.icone,
      parentId: p.parentId ?? null,
      espace: p.espace,
      clientId: p.clientId ?? null,
      blocs: p.blocs,
      statut: h.pondere([['En cours', 5], ['Terminée', 3], ['Brouillon', 2]] as const),
      auteurEmail: auteur.email,
      contributeurs,
      modifieAt: quandPasse(ctx.maintenant, ajouterJours(ctx.aujourdhui, -ageRecent(h, 120)), `${String(h.entier(8, 18)).padStart(2, '0')}:${String(h.entier(0, 59)).padStart(2, '0')}`),
      modifieParEmail: h.choix([auteur.email, ...contributeurs]),
      favorisDe: h.chance(0.2) ? [m.email] : [],
      commentaires: h.chance(0.3) ? h.entier(1, 6) : 0,
      versions: h.entier(1, 12),
      supprimeeLe: null,
    });
  };
  // Les pages « dossier » d'abord (Clients, Équipe), puis les pages enfants.
  const racines: Record<string, string> = {};
  for (const [titre, espace] of [['Clients', 'Clients'], ['Équipe', 'Équipe']] as const) {
    if (liste.length < n) { ajouter({ title: titre, icone: 'folder', espace, blocs: [{ type: 'texte', texte: `Pages du dossier « ${titre} ».` }] }); racines[espace] = liste[liste.length - 1].id; }
  }
  while (liste.length < n) {
    const i = liste.length;
    if (clients.length && h.chance(0.45)) {
      const c = h.choix(clients);
      ajouter({ title: `Suivi ${nomClient(c)}`, icone: 'user', espace: 'Clients', clientId: c.id, parentId: racines.Clients ?? null, blocs: [{ type: 'titre', texte: 'Contexte' }, { type: 'texte', texte: `${nomClient(c)} (${c.secteur}). Responsable : ${c.responsableEmail.split('@')[0].replace('.', ' ')}.` }, { type: 'tache', texte: 'Faire le point sur la prochaine facture', fait: h.chance(0.5) }, { type: 'tache', texte: 'Proposer une offre de maintenance', fait: h.chance(0.3) }] });
    } else {
      const base = CORPS_PAGES[i % CORPS_PAGES.length];
      ajouter({ title: i < CORPS_PAGES.length ? base.titre : `${base.titre} (${i})`, icone: base.icone, espace: base.espace, parentId: base.espace === 'Équipe' ? racines['Équipe'] ?? null : null, blocs: base.blocs });
    }
  }
  return liste.sort((a, b) => b.modifieAt.localeCompare(a.modifieAt));
}

/* --------------------------------- Modèles --------------------------------- */

const MODELES_DOC: readonly (readonly [string, string, ModeleDocument['type'], string])[] = [
  ['Devis standard', 'Une page, trois lignes, conditions de règlement.', 'devis', 'euro'],
  ['Facture standard', 'Mentions légales et délai de 30 jours.', 'document', 'receipt'],
  ['Compte rendu de réunion', 'Participants, décisions, actions.', 'page', 'users'],
  ['Contrat de prestation', 'Objet, durée, prix, résiliation.', 'demande de signature', 'file'],
  ['Bon de commande', 'Articles, quantités, date de livraison.', 'bon', 'box'],
  ['Relance de facture', 'Courtoise, avec le numéro de facture.', 'texte', 'mail'],
  ['Courriel de bienvenue', 'Accueil d’un nouveau client.', 'texte', 'mail'],
  ['Fiche de poste', 'Missions, profil, conditions.', 'document', 'user'],
  ['Procédure interne', 'Étapes numérotées à cocher.', 'page', 'list'],
  ['Cahier des charges', 'Besoin, périmètre, livrables.', 'document', 'file'],
  ['Devis maintenance', 'Abonnement mensuel, durée, préavis.', 'devis', 'euro'],
  ['Annonce à l’équipe', 'Titre court, trois lignes.', 'texte', 'megaphone'],
  ['Attestation de passage', 'Visite sur place chez un client.', 'document', 'check'],
  ['Demande d’avis', 'Message court après une livraison.', 'texte', 'star'],
  ['Compte rendu de chantier', 'Avancement, photos, points ouverts.', 'page', 'wrench'],
  ['Accord de confidentialité', 'Engagement réciproque, deux ans.', 'demande de signature', 'lock'],
  ['Planning de la semaine', 'Grille du lundi au vendredi.', 'page', 'calendar'],
  ['Note de frais', 'Justificatif et catégorie.', 'document', 'receipt'],
  ['Bon de livraison', 'Signature du client à la remise.', 'bon', 'truck'],
  ['Proposition commerciale', 'Contexte, offre, tarifs, planning.', 'document', 'file'],
  ['Avenant de contrat', 'Modification d’une clause.', 'demande de signature', 'file'],
  ['Check-list de lancement', 'Avant la mise en ligne.', 'page', 'check'],
  ['Mail de relance de devis', 'Cinq jours après l’envoi.', 'texte', 'mail'],
  ['Politique de confidentialité', 'Page pour le site du client.', 'document', 'shield'],
];

export function genererModeles(ctx: Contexte, equipe: readonly Membre[]): ModeleDocument[] {
  const h = hasardDe(ctx.graine, 'modeles');
  const n = compter(ctx.volumes.modeles, [0, 4, 24, 40]);
  const gens = salaries(equipe);
  const sources = n <= MODELES_DOC.length ? MODELES_DOC : [...MODELES_DOC, ...MODELES_DOC.map(([nom, d, t, i]) => [`${nom} (variante)`, d, t, i] as const)];
  return sources.slice(0, n).map(([nom, description, type, icone], i) => {
    const creations = h.entier(0, 40);
    const usages = h.pondere([[0, 1.5], [Math.round(creations * 0.9), 3], [Math.round(creations * 0.5), 3], [Math.round(creations * 0.2), 2]] as const);
    return {
      id: cle('mo', i + 1),
      nom,
      description,
      type,
      icone,
      auteurEmail: h.choix(gens).email,
      origine: h.pondere([['créé', 6], ['galerie', 3], ['importé', 1]] as const),
      usagesMois: Math.min(usages, creations),
      creationsDuTypeMois: creations,
      utilisateurs30j: usages > 0 ? h.echantillon(gens, h.entier(1, Math.min(4, gens.length))).map((g) => g.email) : [],
      archive: false,
    };
  });
}

/* --------------------------------- Journal --------------------------------- */

const REFLEXIONS: readonly (readonly [string, string[]])[] = [
  ['Belle journée : deux factures réglées et un devis accepté. J’ai pris le temps de préparer demain.', ['Réussite']],
  ['Le rendez-vous s’est mieux passé que prévu. À retenir : toujours envoyer le compte rendu le jour même.', ['À retenir']],
  ['Journée dense. Beaucoup de petites demandes, peu de temps pour avancer sur le fond.', []],
  ['J’ai relancé les trois factures en retard. Deux réponses avant midi.', ['Réussite']],
  ['Difficile de se concentrer cet après-midi. Je bloquerai deux heures sans messages demain matin.', ['À retenir']],
  ['Bon échange avec un client : il veut ajouter une page à son site.', ['Réussite']],
  ['Journée calme, j’ai rangé les dossiers et mis à jour le planning.', []],
  ['Une erreur de numérotation dans un devis, corrigée avant l’envoi. À vérifier systématiquement.', ['À retenir']],
  ['Réunion d’équipe utile : tout le monde sait ce qui est prioritaire cette semaine.', []],
  ['Fatigue en fin de semaine. Bilan fait, on repart lundi.', []],
];

export function genererJournal(ctx: Contexte, equipe: readonly Membre[], clients: readonly FicheClient[]): EntreeJournal[] {
  const h = hasardDe(ctx.graine, 'journal');
  const n = compter(ctx.volumes.journal, [0, 5, 40, 200]);
  const m = moi(equipe);
  const autres = salaries(equipe).filter((g) => g.email !== m.email);
  const liste: EntreeJournal[] = [];
  let jour: Jour = ctx.aujourdhui;
  // Une entrée par personne et par jour ouvré ; le « moi » a la quasi-totalité, les autres de rares entrées privées.
  while (liste.length < n) {
    if (estOuvre(jour) && (jour !== ctx.aujourdhui || true)) {
      const auteur = h.chance(0.12) && autres.length ? h.choix(autres) : m;
      const [texte, tags] = h.choix(REFLEXIONS);
      const etiquettes = [...tags];
      if (clients.length && h.chance(0.3)) etiquettes.push(nomClient(h.choix(clients)).split(' ')[0]);
      if (!liste.some((e) => e.jour === jour && e.auteurEmail === auteur.email)) {
        const debut = jour === ctx.aujourdhui ? `07:${String(h.entier(10, 59))}` : `${String(h.entier(7, 9)).padStart(2, '0')}:${String(h.entier(0, 59)).padStart(2, '0')}`;
        liste.push({ id: cle('jo', liste.length + 1), jour, commenceA: debut, texte, apercu: apercu(texte, 80), etiquettes, humeur: h.pondere([['très bien', 2], ['bien', 5], ['moyen', 3], ['difficile', 1]] as const), auteurEmail: auteur.email });
      }
    }
    jour = ajouterJours(jour, -1);
    if (ecartJours(jour, ctx.aujourdhui) > 900) break;
  }
  return liste.sort((a, b) => b.jour.localeCompare(a.jour));
}

/* --------------------------------- Rédactions --------------------------------- */

export function genererTextes(ctx: Contexte, equipe: readonly Membre[], interlocuteurs: readonly Interlocuteur[], factures: readonly Facture[]): TexteRedige[] {
  const h = hasardDe(ctx.graine, 'textes');
  const n = compter(ctx.volumes.textes, [0, 3, 12, 60]);
  const gens = salaries(equipe);
  const clientsContacts = interlocuteurs.filter((i) => i.organisationType === 'client');
  const retard = factures.filter((f) => f.status === 'issued' && f.dueAt < ctx.aujourdhui);
  const MODELES: readonly (readonly [() => string, TexteRedige['type'], string])[] = [
    [() => (retard.length ? `Relance de la facture ${h.choix(retard).number}` : 'Relance de facture'), 'e-mail', 'Bonjour, sauf erreur de notre part, ce règlement n’a pas encore été reçu.'],
    [() => 'Annonce : fermeture exceptionnelle', 'annonce', 'Le bureau sera fermé le vendredi après-midi pour une journée d’équipe.'],
    [() => 'Réponse à l’avis d’un client', 'réponse à un avis', 'Merci pour votre retour, il nous fait très plaisir.'],
    [() => 'Fiche produit : pack maintenance', 'fiche produit', 'Mises à jour, sauvegardes et assistance prioritaire pour votre site.'],
    [() => 'Conditions générales de vente', 'conditions', 'Les présentes conditions s’appliquent à toute prestation.'],
    [() => 'Proposition de rendez-vous', 'e-mail', 'Bonjour, seriez-vous disponible jeudi à 10 heures pour en discuter ?'],
    [() => 'Note d’information à l’équipe', 'autre', 'Rappel des horaires de la semaine prochaine.'],
  ];
  return fabriquer(n, (i) => {
    const [titre, type, corps] = h.choix(MODELES);
    const dest = type === 'e-mail' && clientsContacts.length ? h.choix(clientsContacts) : null;
    const etat = h.pondere([['brouillon', 3], ['à valider', 2], ['prêt', 3], ['envoyé', 4]] as const);
    const modif = ctx.maintenant - ageRecent(h, 40) * 86_400_000 - h.entier(0, 20) * 3_600_000;
    return {
      id: cle('tx', i),
      titre: titre(),
      type,
      interlocuteurId: dest?.id ?? null,
      destinataireNom: dest?.nomComplet ?? (type === 'annonce' ? 'Toute l’équipe' : ''),
      ton: h.pondere([['Courtois', 4], ['Poli et direct', 3], ['Chaleureux', 2], ['Formel', 1], ['Décontracté', 1]] as const),
      langue: 'français',
      traductions: h.chance(0.3) ? [{ langue: 'anglais', etat: h.choix(['À jour', 'À mettre à jour'] as const) }] : [],
      etat,
      relecteurEmail: etat === 'à valider' || etat === 'prêt' ? h.choix(gens).email : null,
      auteurEmail: h.choix(gens).email,
      modifieAt: new Date(modif).toISOString(),
      apercu: apercu(corps, 80),
    };
  }).sort((a, b) => b.modifieAt.localeCompare(a.modifieAt));
}

/* --------------------------------- Archives --------------------------------- */

export function genererArchives(ctx: Contexte, equipe: readonly Membre[], fichiers: readonly Fichier[], factures: readonly Facture[]): ElementArchive[] {
  const h = hasardDe(ctx.graine, 'archives');
  const n = compter(ctx.volumes.archives, [0, 6, 40, 600]);
  const gens = salaries(equipe);
  const liste: ElementArchive[] = [];
  const vieilles = factures.filter((f) => f.status === 'paid' && f.paidAt < ajouterJours(ctx.aujourdhui, -180));
  const ajouter = (type: ElementArchive['type'], nom: string, sousTitre: string, octets: number, origine: string, ans: number): void => {
    const le = ajouterJours(ctx.aujourdhui, -ageRecent(h, 700, 1.2));
    const parRegle = h.chance(0.7);
    liste.push({
      id: cle('ar', liste.length + 1),
      nom,
      sousTitre,
      type,
      tailleOctets: octets,
      archiveLe: le,
      origine,
      mode: parRegle ? 'règle' : 'à la main',
      parEmail: parRegle ? null : h.choix(gens).email,
      conserverJusquau: `${Number(le.slice(0, 4)) + ans}${le.slice(4)}`,
    });
  };
  for (const f of vieilles.slice(0, Math.round(n * 0.4))) ajouter('Facture', `Facture ${f.number}`, `${f.clientNom} · réglée`, h.entier(40e3, 130e3), `Facturation / ${f.issuedAt.slice(0, 4)}`, 10);
  for (const f of fichiers.filter((x) => x.modifieAt < quandPasse(ctx.maintenant, ajouterJours(ctx.aujourdhui, -120))).slice(0, Math.round(n * 0.3))) ajouter('Document', f.nom, f.dossier, f.tailleOctets, `Documents / ${f.dossier}`, 5);
  while (liste.length < n) ajouter('Message', `Fil « ${h.choix(['Livraison', 'Devis', 'Rendez-vous', 'Support', 'Facturation'])} »`, `${h.entier(3, 40)} messages`, h.entier(8e3, 90e3), 'Messagerie / Archivés', 3);
  return liste.slice(0, n).sort((a, b) => b.archiveLe.localeCompare(a.archiveLe));
}

/* ------------------------- Base de connaissances ------------------------- */

const ENTREES: readonly { type: EntreeConnaissance['type']; titre: string; blocs: Bloc[] }[] = [
  { type: 'article', titre: 'Comment préparer un devis en dix minutes', blocs: [{ type: 'texte', texte: 'Partez d’un modèle, remplacez le client et ajustez trois lignes.' }, { type: 'liste', texte: 'Vérifier le taux de TVA\nAjouter la date de validité\nRelire le total' }] },
  { type: 'procédure', titre: 'Relancer une facture en retard', blocs: [{ type: 'tache', texte: 'Vérifier que le règlement n’est pas arrivé', fait: false }, { type: 'tache', texte: 'Envoyer le modèle de relance courtoise', fait: false }, { type: 'tache', texte: 'Noter la date dans la fiche client', fait: false }] },
  { type: 'question', titre: 'Où trouver le dernier bilan ?', blocs: [{ type: 'texte', texte: 'Dans Documents, dossier « Rapports », classé par année.' }] },
  { type: 'article', titre: 'Les règles d’archivage', blocs: [{ type: 'texte', texte: 'Les factures sont conservées dix ans, les messages trois ans.' }] },
  { type: 'procédure', titre: 'Accueillir un nouveau membre de l’équipe', blocs: [{ type: 'tache', texte: 'Créer son accès', fait: false }, { type: 'tache', texte: 'Activer la double validation', fait: false }, { type: 'tache', texte: 'Lui présenter les clients en cours', fait: false }] },
  { type: 'question', titre: 'Peut-on facturer en plusieurs fois ?', blocs: [{ type: 'texte', texte: 'Oui, au-delà de 1 500 €, avec un échéancier signé par le client.' }] },
  { type: 'article', titre: 'Bien utiliser le calendrier partagé', blocs: [{ type: 'texte', texte: 'Un rendez-vous client se crée avec la fiche du client liée.' }] },
  { type: 'procédure', titre: 'Fermer un mois comptable', blocs: [{ type: 'tache', texte: 'Justifier les dépenses', fait: false }, { type: 'tache', texte: 'Rapprocher la banque', fait: false }, { type: 'tache', texte: 'Préparer la TVA', fait: false }] },
];

export function genererConnaissances(ctx: Contexte, equipe: readonly Membre[]): EntreeConnaissance[] {
  const h = hasardDe(ctx.graine, 'connaissances');
  const n = compter(ctx.volumes.connaissances, [0, 4, 16, 80]);
  const gens = salaries(equipe);
  const liste = fabriquer(n, (i) => {
    const base = cycle(h, ENTREES, n)[i - 1];
    const auteur = h.choix(gens);
    const cree = ajouterJours(ctx.aujourdhui, -h.entier(10, 400));
    const maj = h.chance(0.5) ? ajouterJours(ctx.aujourdhui, -ageRecent(h, 60)) : cree;
    return {
      id: cle('kb', i),
      type: base.type,
      titre: i <= ENTREES.length ? base.titre : `${base.titre} (${i})`,
      blocs: base.blocs,
      auteurEmail: auteur.email,
      contributeurs: h.echantillon(gens.filter((g) => g.email !== auteur.email), h.entier(0, 2)).map((g) => g.email),
      creeLe: cree,
      majLe: maj < cree ? cree : maj,
      // Une lecture = un membre autre que l'auteur, une fois par jour.
      lectures: h.echantillon(gens.filter((g) => g.email !== auteur.email), h.entier(0, 3)).map((g) => ({ email: g.email, jour: ajouterJours(ctx.aujourdhui, -h.entier(0, 6)) })),
      aLireAbsolument: h.chance(0.12),
      etat: h.chance(0.12) ? ('brouillon' as const) : ('publié' as const),
      versions: h.entier(1, 8),
      questionsLieesIds: [] as string[],
    };
  });
  const questions = liste.filter((e) => e.type === 'question');
  for (const e of liste.filter((x) => x.type !== 'question')) if (questions.length && h.chance(0.4)) e.questionsLieesIds = [h.choix(questions).id];
  return liste.sort((a, b) => b.majLe.localeCompare(a.majLe));
}

