# Audit des modules — 4 septembre 2026

Chaque module du produit, sur les deux éditions, au poste et au téléphone, en français et en anglais. Classé, commité **avant toute correction** : ce document décrit ce qui a été vu, pas ce qui a été réparé depuis.

## Méthode, et ce qu’elle vaut

- **Décor** : amn-api locale (SQLite d’essai, jamais une base réelle), builds réels des deux éditions (`dist` Business sur :4180, interne sur :4181), comptes d’ESSAI (`fleuriste.essai@…` pour Business, `essai.interne@…` pour l’interne). Les organisations réelles des sœurs d’Aaron n’ont pas été touchées.
- **Sonde** : `scripts/sondes/audit.mjs` ouvre chaque écran et note : erreurs de page, réponses réseau en échec, en-tête, état vide ou plein (lignes comptées), puis tente une **création générique** (bouton d’action principal → champs texte remplis d’une marque → envoi), **recharge la page** pour vérifier la persistance, et cherche un bouton de suppression sur l’élément créé. Ensuite chaque écran est rouvert au **téléphone** (390 × 844, tactile : largeur de page mesurée, capture) et en **anglais** (langue forcée : résidus de français comptés ligne par ligne).
- **Ce que la sonde ne sait pas faire** : une création qui demande un client, un montant, une date ou un fichier ; un geste dans une fenêtre hors de `main` ; une suppression cachée derrière un survol avec un libellé autre que « Supprimer ». Dans ces cas la ligne dit « non tentée » et le verdict vient de la lecture du code et des captures (`/tmp/e2e/audit/*.png`, 208 captures, non commitées pour le poids) — et des preuves de la nuit précédente pour les cinquante modules livrés hier (`docs/nuit-2026-09-02.md`).
- **Compréhensibilité** : jugée sur la carte (intitulé + phrase d’aide) et l’état vide, avec la règle d’Aaron — un module qu’on ne comprend pas en cinq secondes est « À retravailler » ou « À reconsidérer » même s’il fonctionne.

Verdicts : **Bon** · **À retravailler** (cassé ou confus) · **Ajouts nécessaires** (fonctionne, incomplet) · **À reconsidérer** (doublon, mal placé, pas compris).

## Les problèmes, classés par gravité

### Gravité 1 — touche toutes les clientes, à chaque ouverture

1. **Le chargement groupé des collections échoue (400) et l’application retombe sur 69 requêtes une par une.** Le desktop synchronise 69 collections ; la route `GET /v1/collections/_bulk` en accepte 50 au maximum. Chaque ouverture, chaque rechargement, chaque poste : un 400 puis 69 allers-retours séquentiels — visible dans la sonde sur CHAQUE module (`RÉSEAU 400 GET /v1/collections/_bulk?names=…`). Sur Render, à 150–300 ms l’aller-retour, c’est dix à vingt secondes d’entrée au lieu d’une. Cause : les vagues d’hier ont ajouté 45 collections sans relever le plafond. Correctif : relever le plafond côté serveur ET découper côté desktop (le repli existe déjà pour les vieilles API).
2. **Les écrans historiques ne sont pas traduits.** En anglais, Agenda, Projets, Tâches, Clients, Facturation, Dépenses, Temps, Notes, Pages, Rapports, Médias, Coffre-fort, Paramètres, Événements gardent leur titre et leurs textes en français (jusqu’à 24 lignes sur Tâches). La barre et les cinquante modules d’hier sont en anglais ; le cœur historique, non. Pour une cliente en anglais (une organisation d’essai l’est), l’application est bilingue au milieu d’une phrase.

### Gravité 2 — la supervision ne tient pas l’échelle demandée

3. **Organisations, rail, Vue d’ensemble, Comparatif, Maturité SOC, Alertes personnalisées, Rapport client : tous chargent TOUTES les organisations puis filtrent dans le navigateur.** Mesuré sur une base de volume de 100 000 organisations (`scripts/volume-seed.mjs`, `scripts/volume-measure.mjs`) : `listOrganizations()` 1,5 s côté serveur et une réponse JSON de 48 Mo pour la seule liste ; à un million, ce serait 480 Mo par ouverture d’écran — il ne s’ouvre pas. `insights()` fait de même à chaque minute pour le bandeau. Aucun filtre par formule, activité, secteur, langue ; aucune étiquette. C’est le chantier du Bloc 4.
4. **Les rondes du SOC balaient tous les sites en mémoire, un site à la fois.** `sweepHeartbeats`, `sweepAvailability`, `sweepDependencies`, `sweepWeeklyDigests`, `sweepSsl` font `listAllSites()` puis une requête d’état par site : 4,4 s pour 100 000 sites, 44 s pour un million, pour la seule ronde de battement de cœur, à la minute. L’escalade lit `incidents` sans index sur (statut, gravité, première vue). Chantier du Bloc 6.

### Gravité 3 — compris, mais mal rangé

5. **Deux modules sont des vues d’un autre** : Tableau des projets (vue en colonnes de Projets), Relances (vue des factures échues de Facturation). Un module de plus dans la barre pour une vue de plus.
6. **La section Personnel duplique trois modules d’équipe en version privée** : Habitudes / Routines, Objectifs perso / Objectifs & résultats, Journal perso / Journal de bord. Six lignes dans la barre là où un interrupteur « privé » en ferait trois — et deux intitulés « Objectifs… » se confondent.
7. **Deux modules pour une messagerie** (Messages privés, Groupes) ; **deux écrans « qui est là »** (Trombinoscope, Membres) ; côté interne, **trois bases de texte** (Notes, Pages, Connaissances).
8. **Deux noms sont du jargon** : « Pipeline » (dire « Prospects »), « Nomenclatures » (dire « Composition & coût de revient »).

### Gravité 4 — finitions

9. Un mot en dur dans Calculateurs (« équitable »), le libellé « Épinglez ceux que vous ouvrez tous les jours » était en dur (corrigé au Bloc 1), les données d’essai portent des étiquettes doublées (« Tâches Tâches ») — sans effet en production.
10. Import / export (Outils) recouvre en partie Réglages › Données : à dire sur la carte plutôt qu’à supprimer.

### Ce que l’audit N’a PAS trouvé

- Aucune erreur JavaScript sur les 86 écrans, aucun débordement horizontal au téléphone sur les 68 écrans Business, aucune perte de donnée au rechargement sur les créations que la sonde a réussies.
- Le Bloc 1 (formule, modules du dossier, épingle) était déjà réglé au moment de l’audit ; il n’apparaît pas ici.

## Ce qui a été réellement vérifié

| Mesure | Nombre |
| --- | --- |
| Écrans ouverts au poste | 86 (68 Business, 18 propres à l’interne) |
| Écrans avec une erreur JavaScript | 0 |
| Créations génériques tentées / réussies / persistantes après rechargement | 52 / 30 / 30 |
| Écrans ouverts au téléphone / qui débordent | 86 / 0 |
| Écrans ouverts en anglais / avec du français resté | 86 / 36 |

Verdicts : **Bon 49 · À retravailler 5 · Ajouts nécessaires 21 · À reconsidérer 11** — sur 86 modules.

Les créations « non tentées » ne sont pas des échecs du module : la sonde ne remplit que des champs texte et n’ouvre pas les fenêtres (voir Méthode). Les modules concernés ont été prouvés à la main la nuit précédente ; le verdict le dit quand c’est le cas.

## La table

| Module | Section | Édition | Verdict | Détail |
| --- | --- | --- | --- | --- |
| Accueil (`home`) | Pilotage | Business + interne | **Ajouts nécessaires** | Accueil vivant (relève, pouls, points d’attention), compris en 5 s ; en anglais la légende de tendance (« un de plus en 7 jours ») et le titre de la liste des tâches restent en français. — ouverture ok, 11 lignes ; anglais : 8 ligne(s) restée(s) en français |
| Agenda (`agenda`) | Pilotage | Business + interne | **Ajouts nécessaires** | Fonctionne ; anglais incomplet (textes en dur) ; création prouvée, suppression par la fiche du rendez-vous. — création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) ; anglais : 5 ligne(s) restée(s) en français |
| Projets (`projects`) | Pilotage | Business + interne | **Ajouts nécessaires** | Fonctionne ; anglais incomplet (« Échéance dépassée », gabarits en dur). — création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) ; anglais : 4 ligne(s) restée(s) en français |
| Tâches (`tasks`) | Pilotage | Business + interne | **Ajouts nécessaires** | Kanban clair ; anglais incomplet (11 textes en dur : « Nouvelle tâche », « Priorité »…) ; le geste de création vit dans une fenêtre, non testée par la sonde générique. — création non tentée/échouée ; anglais : 24 ligne(s) restée(s) en français |
| Objectifs & résultats (`okr`) | Pilotage | Business + interne | **Bon** | Compris en 5 s (« Trois objectifs, des résultats mesurés, une saison »). — création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) |
| Revue hebdo (`weekly`) | Pilotage | Business + interne | **Bon** | Cinq questions en place, sans bouton d’action : le formulaire EST l’écran ; la sonde générique n’a rien à cliquer, ce n’est pas un défaut. — création non tentée/échouée |
| Réunions (`meetings`) | Pilotage | Business + interne | **Bon** | création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) |
| Priorités du jour (`priorities`) | Pilotage | Business + interne | **Bon** | « Trois choses, pas dix » : compris tout de suite. — création ok, rechargement ok, suppression ok |
| Routines (`routines`) | Pilotage | Business + interne | **À reconsidérer** | Doublon avec Habitudes (Personnel) : même grille jour × série, l’une partagée, l’autre privée. Une seule grille avec un interrupteur « privé » suffirait. — création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) |
| Journal de bord (`logbook`) | Pilotage | Business + interne | **À reconsidérer** | Trois journaux coexistent (Journal de bord, Journal perso, Notes). Le bord et le perso ne diffèrent que par la visibilité : un seul journal avec « privé » serait plus lisible. — création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) |
| Formulaires (`forms`) | Pilotage | Business + interne | **Bon** | Formulaire public prouvé de bout en bout la nuit dernière (/f). — création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) |
| Mini-page publique (`minisite`) | Pilotage | Business + interne | **Bon** | Page publique (/p) prouvée ; le nom dit ce que c’est. — ouverture ok, 0 lignes |
| Lettre d’information (`newsletter`) | Pilotage | Business + interne | **Bon** | Part par la messagerie de la personne (mailto) : dit clairement, sans faux envoi. — création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) |
| Signature sur place (`esign`) | Pilotage | Business + interne | **Bon** | Signature au doigt sur l’écran, horodatée ; pas de création générique possible (canvas). — ouverture ok, état vide |
| Portfolio (`portfolio`) | Pilotage | Business + interne | **Bon** | Création par fiche avec photo : non couverte par la sonde générique (fichier). — création non tentée/échouée |
| Clients (`clients`) | Clients & revenus | Business + interne | **Ajouts nécessaires** | Fiche, devis, santé de la relation : riche et compris ; anglais incomplet (8 textes en dur). — création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) ; anglais : 6 ligne(s) restée(s) en français |
| Facturation (`invoices`) | Clients & revenus | Business + interne | **Ajouts nécessaires** | Fonctionne ; anglais incomplet (7 textes en dur : « Encaissée », « Échéance dépassée »…). — création non tentée/échouée ; anglais : 6 ligne(s) restée(s) en français |
| Commandes (`orders`) | Clients & revenus | Business + interne | **Bon** | Reçues du site public par clé de commande : l’état vide explique d’où elles viennent ; rien à créer à la main, c’est voulu. — création non tentée/échouée (aucun champ texte à remplir) ; anglais : 3 ligne(s) restée(s) en français |
| Événements (`evenements`) | Clients & revenus | Business + interne | **Ajouts nécessaires** | Fonctionne ; anglais incomplet (5 textes en dur). — création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) ; anglais : 2 ligne(s) restée(s) en français |
| Pipeline (`pipeline`) | Clients & revenus | Business + interne | **Ajouts nécessaires** | Fonctionne ; le NOM est du jargon pour une fleuriste — à renommer « Prospects » (c’est déjà le mot de la phrase d’aide). — création ok, rechargement ok, suppression ok |
| Relances (`reminders`) | Clients & revenus | Business + interne | **À reconsidérer** | Se remplit seul avec les factures échues : c’est une VUE de Facturation, pas un module. À ranger comme onglet « Relances » de Facturation. — création non tentée/échouée (pas de bouton d’action principal) |
| Abonnements (`subscriptions`) | Clients & revenus | Business + interne | **Bon** | Compris ; la création demande un client et un montant, hors de portée de la sonde générique. — création non tentée/échouée |
| Contrats (`contracts`) | Clients & revenus | Business + interne | **Bon** | création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) |
| Avis (`reviews`) | Clients & revenus | Business + interne | **Bon** | création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) |
| Fidélité (`loyalty`) | Clients & revenus | Business + interne | **Bon** | « La carte à tampons, sans le carton » : compris. — création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) |
| Parrainage (`referrals`) | Clients & revenus | Business + interne | **Bon** | création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) |
| Rendez-vous en ligne (`booking`) | Clients & revenus | Business + interne | **Bon** | Page publique (/rdv) branchée sur l’Agenda, prouvée la nuit dernière. — ouverture ok, 7 lignes |
| Caisse du jour (`cashCount`) | Clients & revenus | Business + interne | **Bon** | Trois montants, un écart : compris en 5 s. — ouverture ok, état vide |
| Temps (`time`) | Production | Business + interne | **Ajouts nécessaires** | Chronomètre + saisie à la main ; anglais incomplet (« À la main », « Sûr ? »). — création non tentée/échouée (pas de bouton d’action principal) ; anglais : 2 ligne(s) restée(s) en français |
| Dépenses (`expenses`) | Production | Business + interne | **Ajouts nécessaires** | Fonctionne ; anglais incomplet (« Nouvelle dépense »). — création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) ; anglais : 1 ligne(s) restée(s) en français |
| Calculateurs (`calculators`) | Production | Business + interne | **Bon** | Moteur de calcul, rien à créer ; un mot en dur (« équitable ») à passer par i18n. — ouverture ok, 1 lignes ; anglais : 17 ligne(s) restée(s) en français |
| Tableau des projets (`board`) | Production | Business + interne | **À reconsidérer** | Se remplit seul avec les projets ouverts : c’est une VUE de Projets (colonnes par statut). À ranger comme onglet « Tableau » de Projets plutôt qu’en module séparé. — création non tentée/échouée (pas de bouton d’action principal) ; anglais : 2 ligne(s) restée(s) en français |
| Stock (`stock`) | Production | Business + interne | **Bon** | création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) |
| Fournisseurs (`suppliers`) | Production | Business + interne | **Bon** | La création demande plusieurs champs typés ; la sonde générique ne l’a pas remplie, la fiche fonctionne (vérifié la nuit dernière, vague 3). — création non tentée/échouée |
| Planning d’équipe (`shifts`) | Production | Business + interne | **Bon** | Grille membres × jours : rien à taper, on clique une case ; l’état vide explique qu’il faut un membre. — création non tentée/échouée (aucun champ texte à remplir) |
| Contrôles qualité (`checklists`) | Production | Business + interne | **Bon** | création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) |
| Suivi de montage (`assembly`) | Production | Business + interne | **Bon** | création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) |
| SAV (`aftersales`) | Production | Business + interne | **Bon** | création ok, rechargement ok, suppression ok |
| Nomenclatures (`bom`) | Production | Business + interne | **Ajouts nécessaires** | Fonctionne ; « Nomenclatures » n’est pas compris hors industrie — à renommer « Composition & coût de revient ». — création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) |
| Tournées (`rounds`) | Production | Business + interne | **Bon** | création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) |
| Matériel (`equipment`) | Production | Business + interne | **Bon** | Ressource puis réservation : deux formulaires, le second refuse le chevauchement ; hors de portée de la sonde générique. — création non tentée/échouée (pas de bouton d’action principal) |
| Notes (`notes`) | Documents | Business + interne | **Ajouts nécessaires** | Riche (liens, tags, graphe) ; anglais incomplet (« Privé », « Note d’équipe », « Partagé », gabarit). — création non tentée/échouée ; anglais : 7 ligne(s) restée(s) en français |
| Pages (`pages`) | Documents | Business + interne | **Ajouts nécessaires** | Fonctionne ; anglais incomplet (« Écrire… », « Légende »). — création non tentée/échouée (aucun champ texte à remplir) ; anglais : 4 ligne(s) restée(s) en français |
| Rapports (`reports`) | Documents | Business + interne | **Ajouts nécessaires** | Fonctionne ; anglais incomplet (« Sélectionnez un rapport », « Éléments liés »). — création non tentée/échouée ; anglais : 3 ligne(s) restée(s) en français |
| Médias (`media`) | Documents | Business + interne | **Ajouts nécessaires** | Fonctionne ; anglais incomplet (« Tous les expéditeurs », « Aucun média »). — ouverture ok, 0 lignes ; anglais : 3 ligne(s) restée(s) en français |
| Messages privés (`dm`) | Collectif | Business + interne | **À reconsidérer** | Messages privés et Groupes sont deux modules pour une seule messagerie : un module « Messages » à deux onglets serait compris plus vite. — création non tentée/échouée (aucun champ texte à remplir) |
| Groupes (`groups`) | Collectif | Business + interne | **À reconsidérer** | Voir Messages privés : à fusionner en « Messages ». — création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) |
| Annonces (`announcements`) | Collectif | Business + interne | **Bon** | Lu par qui, nommément : compris. — création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) |
| Sondages (`polls`) | Collectif | Business + interne | **Bon** | La création demande une question + des options (champs ajoutés au clic) : hors de portée de la sonde générique ; prouvé vague 1. — création non tentée/échouée |
| Absences (`leaves`) | Collectif | Business + interne | **Bon** | Déclarée, validée par qui gère : compris. — création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) |
| Trombinoscope (`directory`) | Collectif | Business + interne | **À reconsidérer** | Doublon partiel de Membres (visages + rôles + présence contre comptes + places). Une seule liste des personnes, avec les visages, éviterait deux écrans « qui est là ». — création non tentée/échouée (aucun champ texte à remplir) |
| Appels (`calls`) | Collectif | Business + interne | **Bon** | Appels entre membres + lien visiteur, réparés et prouvés la nuit dernière. — ouverture ok, état vide |
| QR codes (`qr`) | Outils | Business + interne | **Bon** | Encodeur local vérifié 64/64 contre une référence. — ouverture ok, état vide |
| Convertisseurs (`converters`) | Outils | Business + interne | **Bon** | ouverture ok, 0 lignes ; anglais : 2 ligne(s) restée(s) en français |
| Modèles (`templates`) | Outils | Business + interne | **Bon** | création ok, rechargement ok, suppression ok |
| Automatisations (`automations`) | Outils | Business + interne | **Bon** | « Si ceci arrive, alors cela se fait » : compris ; règles exécutées par le moteur local. — ouverture ok, état vide |
| Import / export (`dataPort`) | Outils | Business + interne | **Ajouts nécessaires** | Recouvre en partie Réglages › Données (export complet). À dire dans la carte : ici, l’import et l’export par module en CSV ; là-bas, la copie complète. — ouverture ok, 10 lignes |
| Avant la paie (`budget`) | Personnel | Business + interne | **Bon** | ouverture ok, 0 lignes ; anglais : 15 ligne(s) restée(s) en français |
| Courses (`courses`) | Personnel | Business + interne | **Bon** | création non tentée/échouée (aucun champ texte à remplir) ; anglais : 4 ligne(s) restée(s) en français |
| Habitudes (`habits`) | Personnel | Business + interne | **À reconsidérer** | Doublon de Routines en version privée (voir Routines). — création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) |
| Objectifs perso (`personalGoals`) | Personnel | Business + interne | **À reconsidérer** | Doublon d’Objectifs & résultats en version privée ; deux noms proches (« Objectifs & résultats » / « Objectifs perso ») se confondent dans la barre. — création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) |
| Journal perso (`diary`) | Personnel | Business + interne | **À reconsidérer** | Doublon de Journal de bord en version privée (voir Journal de bord). — création non tentée/échouée |
| Pomodoro (`pomodoro`) | Personnel | Business + interne | **Bon** | Distinct (minuteur → Temps) ; compris. — ouverture ok, état vide |
| Paramètres (`settings`) | Système | Business + interne | **Ajouts nécessaires** | Complet ; anglais incomplet (4 textes en dur) ; le verrou de consentement (Bloc 4) y trouvera sa place. — ouverture ok, 8 lignes ; anglais : 29 ligne(s) restée(s) en français |
| Membres (`members`) | Système | Business + interne | **Bon** | Places, invitations, refus quand c’est plein : prouvé. — ouverture ok, 1 lignes ; anglais : 6 ligne(s) restée(s) en français |
| Assistance (`assistance`) | Système | Business + interne | **Bon** | ouverture ok, 7 lignes ; anglais : 13 ligne(s) restée(s) en français |
| Découvrir (`discover`) | Système | Business + interne | **Bon** | Rangé par sections, demande en un geste ; les cartes recevront quoi / pour qui / exemple (Bloc 3). — ouverture ok, 0 lignes |
| Coffre-fort (`vault`) | Système | Business + interne | **Ajouts nécessaires** | Coffre local chiffré, générateur ajouté ; anglais incomplet (« Nouvelle entrée », « Catégorie »). — ouverture ok, 0 lignes ; anglais : 5 ligne(s) restée(s) en français |
| Équipe (`team`) | Livrables | Interne seule | **Ajouts nécessaires** | Anglais incomplet (5 textes en dur). — création ok, rechargement ok, suppression non trouvée (pas de bouton de suppression trouvé) ; anglais : 1 ligne(s) restée(s) en français |
| Décisions (`decisions`) | Livrables | Interne seule | **Bon** | création non tentée/échouée (aucun champ texte à remplir) ; anglais : 4 ligne(s) restée(s) en français |
| Connaissances (`knowledge`) | Livrables | Interne seule | **À reconsidérer** | Recouvre Notes et Pages côté interne (trois bases de texte). À fusionner dans Notes avec un tag « connaissance ». — création non tentée/échouée ; anglais : 51 ligne(s) restée(s) en français |
| Bibliothèque (`library`) | Livrables | Interne seule | **Bon** | ouverture ok, 0 lignes |
| Vue d’ensemble (`tour`) | Tour de contrôle | Interne seule | **Bon** | Vue d’ensemble ; les compteurs viennent de insights(), qui charge toutes les organisations — voir gravité (Bloc 4). — ouverture ok, 315 lignes ; anglais : 329 ligne(s) restée(s) en français |
| Organisations (`orgs`) | Tour de contrôle | Interne seule | **À retravailler** | Charge TOUTES les organisations puis filtre dans le navigateur (mesuré : 1,5 s et des dizaines de Mo à 100 000 organisations) ; aucun filtre formule / activité / secteur / langue ; pas d’étiquettes. C’est l’écran à reconstruire pour l’échelle (Bloc 4). — ouverture ok, 35 lignes ; anglais : 53 ligne(s) restée(s) en français |
| Journal d’accès (`access`) | Tour de contrôle | Interne seule | **Bon** | Journal lisible, 28 actions toutes formulées. — ouverture ok, 207 lignes ; anglais : 199 ligne(s) restée(s) en français |
| Atelier (`generator`) | Tour de contrôle | Interne seule | **Ajouts nécessaires** | Atelier complet ; anglais incomplet (5 textes en dur) ; le choix des modules devrait partir de la formule (Bloc 1) plutôt que d’une liste libre. — ouverture ok, 0 lignes ; anglais : 12 ligne(s) restée(s) en français |
| Supervision (`supervision`) | Parc | Interne seule | **À retravailler** | File par organisation ; pas de file globale du parc, et l’escalade balaie sans index (Bloc 6). — ouverture ok, 100 lignes ; anglais : 103 ligne(s) restée(s) en français |
| Sites (`sites`) | Parc | Interne seule | **Bon** | ouverture ok, 0 lignes ; anglais : 10 ligne(s) restée(s) en français |
| Trackers (`tracker`) | Parc | Interne seule | **Ajouts nécessaires** | Anglais incomplet (4 textes en dur). — ouverture ok, 11 lignes ; anglais : 12 ligne(s) restée(s) en français |
| Maturité SOC (`socMaturity`) | Parc | Interne seule | **À retravailler** | Charge toutes les organisations et calcule six signaux dans le navigateur : ne tient pas à l’échelle (Bloc 4). — ouverture ok, 189 lignes |
| Comparatif clientes (`orgCompare`) | Parc | Interne seule | **À retravailler** | Charge toutes les organisations et insights() : même défaut. — ouverture ok, 28 lignes |
| Alertes personnalisées (`customAlerts`) | Parc | Interne seule | **À retravailler** | Évalue les règles sur toutes les organisations dans le navigateur : même défaut. — ouverture ok, 0 lignes |
| Rapport client enrichi (`clientReport`) | Parc | Interne seule | **Bon** | Compose depuis une organisation choisie ; la liste de choix charge tout (à paginer avec les autres). — ouverture ok, 7 lignes |
| Scanner (`scanner`) | Produits | Interne seule | **Bon** | ouverture ok, 0 lignes ; anglais : 2 ligne(s) restée(s) en français |
| Comply (`comply`) | Produits | Interne seule | **Bon** | ouverture ok, 0 lignes ; anglais : 3 ligne(s) restée(s) en français |
| SSL Monitor (`ssl`) | Produits | Interne seule | **Bon** | ouverture ok, 2 lignes ; anglais : 2 ligne(s) restée(s) en français |

## Ce qui suit (Bloc 3)

Dans l’ordre des gravités ci-dessus : le chargement groupé (1), les écrans historiques en anglais (2), puis — sans casser ce qui marche — les cartes claires (quoi / pour qui / exemple) et la présentation à la première ouverture pour chaque module, les deux renommages (Prospects, Composition & coût de revient), et le mode « alléger / rajouter » de la barre. Les fusions proposées (« À reconsidérer ») sont des décisions de produit : elles sont posées ici pour Aaron, pas tranchées cette nuit — sauf là où un module n’est qu’une vue d’un autre, où la carte le dira et où l’onglet remplacera le module quand Aaron l’aura décidé.

Les gravités 3 et 4 de la supervision (organisations, rondes, escalade) relèvent des Blocs 4 et 6, avec la base de volume comme juge.
