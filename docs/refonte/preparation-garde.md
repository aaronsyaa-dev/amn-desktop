# LOT-08 La Garde : note de préparation

> Phase de préparation, lecture seule : aucun code de l'app n'est modifié.
> Branche `claude/refonte-garde`, partie de `claude/refonte-vivante` @ `f059f32`.
> Fiches lues : `lots/LOT-08-garde/*.md` du zip (12 écrans), plus `01-SOCLE-DESIGN.md` et `04-ECARTS-MAQUETTES.md`.
> Les chemins sont relatifs à `src/`. « S3 » = ce qui est déjà dans `refonte/garde/` (fusionné).

## 1. Où on en est

- **Aucun des 12 écrans n'a de code dédié.** Les identifiants F70, N02… ne figurent nulle part dans le dépôt. Chaque écran se construit à partir de modules existants, listés plus bas.
- **Le socle du zip (LOT-00) n'est pas là.** `socle/ui` ne contient que `Bouton`, `Carte`, `Modale`, `Saisie` (S0). Il manque `Sidebar`, `Header`, `Kpi`, `Table`, `Tabs`, `Progress`, `Ring`, `Donut`, `Check`, `Suggestion`, `AjmaniBar`, `Empty`, `FamilyHub`, ainsi que les jetons noir et gris du zip (`#0C0C0D`, `#161617`…). S0 pose un graphite chaud, S2 a activé un fond noir (`refonte/accueil/ambiance.css`). La construction attend LOT-00, comme prévu.
- **Le registre des modules existe** (S5) : famille `garde`, 8e, `refonte/modules/declarations/garde.ts:16-80`. Un écran neuf se déclare par `vue(…, { nouveau })` (`refonte/modules/declarer.ts:119`) ; catalogue et routes se génèrent seuls.

## 2. Écran par écran

Légende : **Existe** = module trouvé · **Données** · **Manque / diffère** · **Questions**.

### F70 · Vue d'ensemble (NOUVEAU)
- **Existe** : aucun hub de famille (pas de `FamilyHub`). Pages proches : `screens/ControlTowerScreen.tsx:48` (`/tour`, déjà intitulé « Vue d'ensemble »), `bureaux/supervisor/Accueil.tsx:26`, `bureaux/cyber/Accueil.tsx:48`. Pastille d'état : `components/garde/GardeBadge.tsx:37` (via `garde.pouls()`), `state/poulsDuParc.ts:92`.
- **Données** : organisations (`useSourceBureaux().organisations`) ; alertes et critiques (`GardePouls.compte`, `usePoulsDuParc()`, `GardeAccueil.pile.compte`) ; dernière ronde (`GardeAgent.derniereRondeAt`, `garde.rondes`) ; historique des chiffres (`bureaux/donnees/releves.ts`, collection `parcReleves`, `valeurIlYA`) ; clôture (`GardeAccueil.cloture`) ; suggestion (`GardeAccueil.proposition`).
- **Manque / diffère** : le composant hub et sa route (`/garde` est déjà « La Salle », `/tour` « Vue d'ensemble ») ; un score de maturité global (voir H34) et sa variation sur 30 jours (calculable depuis `parcReleves`, avec des trous les jours sans relevé) ; « dernière ronde du parc » (un max à écrire) ; checklist « Avant de fermer ce soir » (3 cases, remise à zéro quotidienne) ; raccourcis (`A`, `⌘ ⇧ I`, `⌘ O`). Les cartes « Rondes » et « Journal de sécurité » n'ont pas de module du même nom : Rondes = `/garde/nuit` et `/garde/calendrier`, Journal de sécurité = `/cyber/journal`. `⇧ ⌘ O` est déjà pris par le sélecteur d'organisation (`components/org-rail/OrgRail.tsx:206`).
- **Questions** : voir §3, points 1, 2, 3 et 5.

### N02 · Salle de contrôle (MIXTE)
- **Existe** : `refonte/garde/SalleDeSituation.tsx` (S3 : carte SVG, résumé, fil, verdict), `components/MurDeControle.tsx` et `screens/SalleScreen.tsx` (`/salle`), `bureaux/supervisor/Grille.tsx:31` (une ligne par organisation), `Accueil.tsx` (horizon). Pastille globale : `GardeBadge`.
- **Données** : par organisation, `pointsDuParc()` (`bureaux/donnees/parc.ts:99`) → `OrgPoints` (poids, points critique/incident/jeton/arrivée/demande/alerte, suivi) ; `useCyber().orgs[].score` ; incidents, sites et certificats dans `useSourceBureaux()`. Actions : `acknowledgeIncident`, `resolveIncident`, `upsert('suivis', 'org:<id>')`, `garde.prendre`.
- **Manque / diffère** : la grille de 8 cartes à anneau de score ; un **état par organisation** Sain / À surveiller / Critique (seule la pastille du parc entier existe) ; « Menaces bloquées » et « Score moyen » ; le flux « En direct » (4 dernières lignes du journal) ; « Rondes de ce soir » cochées ; le bouton « Déclarer un incident » et le panneau `⌘ ⇧ I` (voir H32) ; « Rapport du jour » ; la suggestion « Prévenir … » (la forme existe en tâche, `Echeances.tsx:46`, pas en message). L'action « Bloquer l'adresse » proposée par Ajmani : aucun appel correspondant dans l'app, à confirmer avec amn-api.
- **Doublons** : trois « salles » (`/salle`, `/garde`, `/supervisor/situation`) ; `phaseDe`, la spirale d'or et le verdict sont écrits deux fois (`MurDeControle.tsx` et `refonte/garde/carte.ts`).
- **Questions** : points 1, 4, 6 du §3.

### N03 · Veille H24 (MIXTE)
- **Existe** : `components/IdleScreensaver.tsx:22` (veille, 4 min, monte `SalleDeSituation`), `bureaux/garde/Nuit.tsx:31` (la nuit par chef), `screens/garde/GardeSalleScreen.tsx:97` (« rondes prévues cette nuit » : `garde.calendrier(1)` coupé à 12 h, soit déjà le « 6 ce soir »), `GardeCalendrierScreen.tsx:62`, `GardeCommuneScreen.tsx:61` (absence : `garde.absence`, `garde.retour`), `refonte/garde/ResumeDeNuit.tsx`.
- **Données** : `garde.calendrier`, `salle`, `rondes`, `journal`, `reglages` (silence 22 h → 7 h, `SILENCE_DEFAUT`), `retardDeRonde` (`lib/garde.ts:93`).
- **Manque / diffère** : toute la page, c'est une synthèse ; les KPI « Sans incident majeur », « Temps de réaction », « Fausses alertes » (le classement « fausse alerte » n'existe pas côté alertes) ; le graphique 24 h ; **l'astreinte** (« Qui veille », « Mode astreinte ») : le mot n'existe pas dans le code, seule l'« absence » existe ; aucune route « Veille H24 ». Le délai de veille (4 min) est une constante côté interne.
- **Doublons** : la fenêtre de nuit est calculée 3 fois (`refonte/garde/resume.ts:68`, `Nuit.tsx:40`, `GardeSalleScreen.tsx:33`). Le réglage du silence vit dans `GardeAjmaniScreen.tsx`, que le registre dit « remplacé » par ⌘J (`declarations/garde.ts:77`) : il lui faudra un nouveau lieu.
- **Questions** : points 1, 7, 8.

### H30 · Organisations (MIXTE)
- **Existe** : `bureaux/supervisor/Grille.tsx:31` (liste dense, 9 colonnes, tri fixe par poids), `Horizon.tsx`, `Accueil.tsx`, `screens/OrganizationsScreen.tsx:50` (registre paginé côté serveur, `/tour/organisations`, tri nom / création / activité, actions groupées), `components/tour/*`.
- **Données** : `AdminOrganization`, `OrgPoints`, `useCyber().orgs` (score, tendance), `useSupervisor`.
- **Manque / diffère** : une **santé unique** (trois notions coexistent : poids, posture, maturité) ; une **dernière ronde par organisation** (`derniereRondeAt` est global ; seul `garde.journal({org})` filtre par organisation) ; un état à trois valeurs (le code n'a que `active` / `suspended`) ; le tri par colonne ; « Répartition » (donut), « Rapport global », la suggestion « priorité du jour » ; « Ajouter une organisation » avec la case d'accord de surveillance.
- **Risque de fusion** : S3 a ajouté un bloc à `bureaux/supervisor/Accueil.tsx` ; refondre ce fichier suppose de le reprendre tel quel.
- **Questions** : points 2, 3, 4.

### H31 · Fiche organisation (RE-HABILLAGE)
- **Existe** : `bureaux/supervisor/Dossier.tsx:50` (`/supervisor/dossiers/:orgId` : identité, ce qui attend, modules, demandes, incidents, personnes, notes, échanges), `components/org-rail/OrgDossierPanel.tsx:164` (seconde fiche, en modale), `components/garde/GardeChezElle.tsx:19` (8 dernières lignes du journal de la Garde pour l'organisation, absent de `Dossier.tsx`).
- **Données** : `admin.organizationDossier`, `organizationPulse`, `useCyber().orgs` (score, courbe de 8 points hebdomadaires, tendance), `src.sites` filtré par `clientOrgId`, `src.ssl`, `src.incidents`. Vulnérabilités : `bureaux/cyber/Vulnerabilites.tsx` (veille croisée avec l'inventaire).
- **Manque / diffère** : onglets Actifs / Vulnérabilités / Incidents / Rapports ; anneau de score avec « +4 ce mois-ci » (la courbe actuelle est courte et à trous) ; bouton « Lancer une ronde » **par organisation** (une ronde se lance par garde) ; « Rapport client » (`monthlyReport` n'a pas de paramètre d'organisation ; voir aussi `/rapport-client`) ; date de début de surveillance ; sites et certificats de la cliente : la donnée est là, aucun bloc ne l'affiche.
- **Doublon** : `OrgDossierPanel` et `Dossier.tsx` écrivent tous deux la collection `orgDossier` (l'un dans `body`, l'autre dans `notes[]`). Il faut une seule fiche qui fasse foi.
- **Questions** : points 3, 4.

### H32 · Incident (MIXTE)
- **Existe** : `bureaux/cyber/FicheIncident.tsx:35` (`/cyber/incidents/:id` : chronologie à deux voies, actions, checklist de clôture, « Clore »), `screens/IncidentsScreen.tsx:63` (`/supervision`, file avec acquitter / résoudre / rouvrir), `bureaux/supervisor/Bug.tsx:45` (parcours « un bug chez une cliente », 7 stations), `components/tour/ParcSocPanel.tsx` (seul affichage d'`escalationLevel`).
- **Données** : `Incident` (`shared/api.ts:1767`), `FleetIncident`, `IncidentDetail`, `acknowledgeIncident`, `resolveIncident`, `reopenIncident`, `IncidentEscalation`, collection locale `incidentsFiches`.
- **Manque / diffère** : **aucune déclaration manuelle d'un incident côté serveur** (seulement `declareMaintenance` et le parcours de bug local, dont le numéro `INC-` est fabriqué à partir de l'horloge) ; le cycle Détecté / Pris en charge / En traitement / Résolu / Clôturé (le serveur sait acquitter et résoudre) ; deux chronologies séparées (alertes serveur, actions locales) ; la prise en charge existe en trois mécanismes non synchronisés (`suivis`, `garde.prendre`, `acknowledgeIncident`) ; « Passer la main » ; le message au client proposé ; la carte « Preuves » ; « Rouvrir » n'est pas dans la fiche.
- **Lien avec S3** : `refonte/garde/alertes.ts` porte déjà `incident-critique` et `escalade` avec un champ `vers` : H32 fixe la route cible. `bureaux/cyber/**` est hors de la zone listée pour ce lot.
- **Questions** : points 5, 9.

### H33 · Rondes (RE-HABILLAGE)
- **Existe** : `screens/garde/GardeCalendrierScreen.tsx:62` (portée sur 7 jours, une ligne par garde, période réglable, pause via `majAgent`), `bureaux/garde/Nuit.tsx`, `Historique.tsx`, `Simulateur.tsx`, `components/garde/GardeUi.tsx:192` (« ronde maintenant »).
- **Données** : `garde.calendrier`, `rondes`, `agent`, `majAgent`, `ronde`, `GardeRonde` (lus, règles, remontées, durée, erreur).
- **Manque / diffère** : **ce que la fiche appelle « ronde » (type de vérification avec périmètre, six types, « Nouvelle ronde ») n'est pas ce que le code appelle ainsi** : le code a des gardes qui tournent à `everyMs`, sans périmètre choisi ni création. Pas de distinction jour / nuit dans les données (seule la fenêtre de silence). Pas de « résultat » par ronde au-delà du résumé et des compteurs. La carte « Prochaine ronde » avec anneau et « Dernières rondes » se calculent depuis `calendrier` et `rondes`. L'exercice d'hameçonnage existe dans le bureau Cyber (`bureaux/cyber/Hameconnage.tsx`).
- **Questions** : point 10.

### H34 · Maturité SOC (MIXTE)
- **Existe** : `lib/maturiteSoc.ts` (six signaux, niveau en 3 paliers : fragile / en progrès / solide), `screens/SocMaturityScreen.tsx:22` (`/maturite-soc`), `components/parc/ToileDeMaturite.tsx` (toile à 6 axes), `bureaux/donnees/cyber.ts:159` (`scoreDe` : « posture », 8 contrôles, note sur 100).
- **Manque / diffère** : **deux référentiels coexistent** et aucun ne donne « niveau de 1 à 5 + score sur 100 + six domaines (Détection, Prévention…) ». Pas de feuille de route, pas de points ni de durée par action, pas d'historique daté (la toile dit elle-même « lecture de l'instant »), pas d'export de rapport. La fiche demande un référentiel de critères avec points : à créer, au plus simple. F70 affiche 82, cet écran 62 : une seule source.
- **Questions** : point 2.

### H35 · Journal d'accès (RE-HABILLAGE)
- **Existe** : `screens/AccessLogScreen.tsx` (`/tour/journal`, par jour, filtre d'organisation), `components/tour/CouloirsDAcces.tsx`, `bureaux/cyber/JournalAudit.tsx` (accès et journal de la Garde fusionnés, export CSV signé).
- **Données** : `admin.accessLog({ orgId, limit })` → `OrgAccessEntry` (acteur, action, détail, date).
- **Manque / diffère** : **le journal actuel liste les ouvertures de dossiers clients par l'équipe, pas des connexions.** Pas de champ « d'où » (lieu, appareil), pas de résultat Autorisé / Refusé / À revoir, pas de filtre par personne ni par période, pas de pagination ni d'export sur cet écran, pas de carte « Cette semaine ». « 214 connexions » (F70) n'a pas de source.
- **Questions** : point 11.

### MG01 · Alertes (MIXTE)
- **Existe** : `bureaux/cyber/Alertes.tsx` (« le tamis » : tri par gravité, prise en charge, filtres), `bureaux/supervisor/ATraiter.tsx`, `screens/garde/GardePileScreen.tsx`, `screens/CustomAlertsScreen.tsx` (« Règles d'alerte »), `components/AttentionPanel.tsx`.
- **Données** : `AlerteCyber` (`bureaux/donnees/cyber.ts:74`), `GardeDossier` / `GardeRemontee`, `Incident`, `RemoteEvent`, `InputAlert`.
- **Manque / diffère** : **trois échelles de gravité** (critique/haute/moyenne/faible côté Cyber, critique/haute/normale côté Garde, critical/warning/info côté événements) alors que la fiche en a 3 (Critique, Moyenne, Faible) ; assignation, sourdine avec durée et marquage « fausse alerte » non trouvés ; pas de « marche à suivre » structurée par alerte (les `options` / `recommandation` de la pile et les playbooks sont les plus proches) ; KPI « Délai moyen » et « Fausses alertes », graphique « Alertes par jour », carte ludique « Avant de partir ce soir ».
- **Lien avec S3** : `refonte/garde/alertes.ts` fixe déjà le seuil « critique » et les préférences hors app : ne pas le redéfinir ici.
- **Questions** : points 3, 6.

### MG02 · Journal de sécurité (MIXTE)
- **Existe** : `bureaux/cyber/JournalAudit.tsx` (`/cyber/journal`), `bureaux/garde/Historique.tsx` (30 jours par chef), `components/tracker/SuppressionsPanel.tsx`, `refonte/garde/donnees.ts` (`useJournalGarde`).
- **Données** : `garde.journal({ action, agent, equipe, org, ressource, since, avant, resultat, limit })`, `GardeJournalEntree`, événements de sites (`getSiteEvents`).
- **Manque / diffère** : un journal **unifié** « vu et fait » (le tamis actuel fusionne deux sources, sans les événements de sites ni les incidents) ; le résultat Normal / Bloqué / Journalisé (le code a `regle` / `remonte` / `refuse` / `echec`) ; recherche texte et filtre d'organisation ; « Journal à jour » (couverture des sources) ; donut par résultat ; « Créer un rapport ». L'écran doit se brancher sur `useJournalGarde` ou `garde.journal`, pas sur un troisième accès.
- **Questions** : point 6.

### MG03 · Produits cyber (MIXTE)
- **Existe** : `screens/ScannerScreen.tsx`, `ComplyScreen.tsx`, `SslScreen.tsx` (groupe « Produits » du bureau Cyber, déjà déclaré au registre), `data/trackerModules.ts` (modules par site, tier 1 à 3).
- **Données** : `AdminOrganization.plan`, `modules`, `formula` ; `RemoteSite.tier` ; jetons `GardeJeton` avec module et formule.
- **Manque / diffère** : **la notion d'offre cyber vendue à une cliente n'existe pas.** Scanner, Comply et SSL sont des outils lancés sur une adresse, sans organisation (hors SSL, via le site). Pas de catalogue (nom, prix, unité, responsables), pas de statut d'activation par cliente, pas d'objectif, pas de revenu récurrent. « 18 clients protégés » n'existe nulle part. Tout le contenu de la fiche est donc à créer.
- **Questions** : point 12.

## 3. Questions pour le CO ou Harun

Contexte : à chaque point, la valeur par défaut des fiches est entre parenthèses.

1. **Routes et nommage.** `/garde` est déjà « La Salle » ; `/tour` est « Vue d'ensemble ». Quelle route pour le hub F70, et que devient `/tour` ? (par défaut : route neuve déclarée au registre, `/tour` inchangé.)
2. **Un seul score de maturité.** F70 et H34 lisent la même donnée, mais le code a deux calculs (`lireMaturite`, 3 paliers ; `scoreDe`, sur 100). Lequel fait foi, ou faut-il un référentiel neuf (critères avec points) ? (par défaut : référentiel simple, à créer.)
3. **Un état et un score par organisation.** Faut-il fixer la règle de N02 6.1 (le plus grave du score, des alertes ouvertes, du retard de ronde) comme source unique, alors que le code a trois notions (poids, posture, maturité) ? Et la « dernière ronde par organisation » : l'API ne la donne pas, seule `garde.journal({ org })` approche. Côté amn-api ou calcul local ?
4. **Libellés d'état.** `04-ECARTS` décide « Sain / Attention / Critique » ; la fiche N02 6.1 dit « Sain / À surveiller / Critique » ; le code dit « Calme / Attention / Critique » (`i18n/fr.ts`). Quelle table unique ?
5. **Déclarer un incident.** Aucune API serveur. Faut-il (a) la demander à amn-api, ou (b) un incident local, comme le parcours de bug (`Bug.tsx`) ? (par défaut : la solution la plus simple, notée dans `STATUT.md`.) Même question pour la prise en charge, qui existe en trois mécanismes.
6. **Unifier les gravités et les sources d'alertes.** Trois échelles de gravité, trois sources d'« alertes ouvertes » (remontées de la Garde, incidents, dossiers de la pile). Quelle définition pour « alerte ouverte » dans les KPI de F70, N02 et MG01 ? Même question pour le journal unique de MG02.
7. **Astreinte** (N03). Aucun existant. Réglage par personne (rôle, plage) : dans quelle collection, et le CO veut-il ce réglage dans ce lot ?
8. **Veille H24 et salles.** Le registre remplace l'écran Ajmani de la Garde par ⌘J, or c'est là que se règle le silence de nuit. Où va ce réglage ? Et que devient la Salle de situation de S3 (veille, `/supervisor/situation`) face à N02 ? (par défaut : N02 est la page de pilotage, la veille de S3 reste.)
9. **Périmètre Cyber.** H32 (`FicheIncident`), MG01 (`Alertes`), MG02 (`JournalAudit`) et MG03 vivent dans `bureaux/cyber/**` et `screens/`, hors des zones listées pour ce lot (S3 : `bureaux/**`, `screens/garde/**`, `components/garde/**`, `refonte/garde/**`). Le CO élargit-il la zone ? Qui possède le bureau Cyber ?
10. **Sens du mot « ronde »** (H33). La fiche décrit des contrôles programmables avec périmètre et création ; le code a des gardes à fréquence fixe. Adapte-t-on l'écran aux gardes, ou ajoute-t-on la notion de ronde programmée ?
11. **Journal d'accès** (H35). Veut-on lire les connexions des personnes (donnée absente aujourd'hui, avec lieu et résultat) ou rhabiller le journal des ouvertures de dossier ? « D'où » et « Résultat » demandent une décision avec amn-api.
12. **Produits cyber** (MG03). Où vit le catalogue (collection synchronisée ou amn-api) ? Quelle définition de « client protégé » (au moins une offre active ? parmi les clientes ayant une organisation surveillée ?) ?
13. **Couleur de famille.** La fiche donne `#D6D6DA` (icône bouclier) ; le registre déclare la teinte `outils` ; `STATUT.md` signale déjà « teinte propre de la Garde » à trancher.
14. **Raccourcis.** `⌘ ⇧ I` (déclarer un incident) : aucun menu d'application ne le prend, les outils de développement ne s'ouvrent seuls qu'en mode dev. `⇧ ⌘ O` est pris par le sélecteur d'organisation ; la fiche dit `⌘ O`. Quelle touche ?
15. **Textes.** Les fiches imposent « mot pour mot » ; l'i18n du lot ira dans `refonte/garde/i18n.ts` (fr et en), sans toucher `src/i18n`. Confirmer que l'anglais est attendu.

## 4. Ordre de construction proposé (quand LOT-00 sera fusionné)

D'abord ce qui n'a aucune question ouverte, puis le reste :

1. H31 (re-habillage, données déjà là), H35 (si point 11 : rhabillage), H33 (si point 10).
2. N02, F70 et H30 ensemble : ils partagent l'état par organisation et le score (points 2, 3, 4).
3. MG01, MG02, H32, H34, N03, MG03 : chacun attend une décision du §3.

Règles tenues pendant ce lot : interface seulement, la logique de détection, d'alerte et de journalisation n'est pas modifiée ; rien de ce qui est écrit ici ne décrit une faiblesse de sécurité.
