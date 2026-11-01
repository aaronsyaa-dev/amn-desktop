# Refonte vivante — statut

> Tenu par le CO, mis à jour à chaque « point ». Les sessions ne modifient pas
> ce fichier. Règles : [`REGLES.md`](REGLES.md).

- Branche d'intégration : `claude/refonte-vivante` (base `main` @ `630ef45`). Dernier code : `c88814c` (S2 fusionnée, plus un correctif du CO).
- Dernière mise à jour : 2026-10-22 (point 3 : S5 et S2 fusionnées, niveau de F1 aligné, règle de sécurité)
- Gardes locales, lancées après chaque fusion : `typecheck`, `typecheck:business`, `lint` et les 44 `check:*` sans navigateur de `editions.yml`.
  - Après S5 : toutes vertes.
  - Après S2 : `check:clavier` échouait sur `Lancement.tsx`, et donc déjà sur la branche de S2. Corrigé par le CO (`c88814c`), puis toutes vertes.
- CI `editions.yml` sur `f0b8f12` : builds et garde-fous au vert. « Garde-fous croisés » échoue (secret `AMN_API_TOKEN` refusé), ce qui ne dépend pas du code. Celle du point 3 sera relue au prochain point.

## ⚠ Le dépôt est public

`aaronsyaa-dev/amn-desktop` est **public** (vérifié au point 3). Règle de Harun : **rien qui décrive une faille de sécurité n'est poussé**. `docs/securite/**` reste local ou dans un dépôt privé : il est ajouté à `.gitignore`, et la règle est dans [`REGLES.md`](REGLES.md).

Contrôle du point 3 :

- aucune branche `claude/refonte-*` ne contient `docs/securite/` ni `src/securite/` ;
- S6 n'a rien poussé.

En revanche, des documents déjà publiés sur `main` décrivent des mécanismes de détection, et au moins un contournement corrigé : `docs/nuit-2026-08-28.md:111`, `docs/nuit-2026-09-01.md`, `docs/audit-soc.md`, `docs/casser-2026-09-04.md`. Je n'y ai pas touché, car les retirer ne les efface pas de l'historique. **À trancher par Harun** : faire relire ces fichiers par S6, et/ou passer le dépôt en privé.

## Sessions

| Session | Branche | État | Dernier sha | Rapport | Points à trancher |
|---|---|---|---|---|---|
| 00 Lancement sûr | aucune (lecture seule) | inconnu, aucun rapport reçu | — | — | — |
| S0 Socle | `claude/refonte-s0-socle` | **fusionnée** | `b7453e3` | [`docs/refonte-socle.md`](../refonte-socle.md) | Constat T1 C-001 : le CSS du socle part dans le paquet client (inerte aujourd'hui, mais le paquet n'est plus identique). Correctif proposé par T1 : sortir le bloc de `index.css`. |
| S1 Navigation | `claude/refonte-s1-navigation` | **fusionnée** | `e788af8` | [`rapports/S1.md`](rapports/S1.md) | `/tour` et `/supervisor` ; étape « rail » du guide ; `check:coquille` à adapter ; tiroir mobile ; recherche dans les contenus. La 8e famille est réglée par S5. |
| S2 Accueil (recadrée) | `claude/refonte-s2-accueil` | **fusionnée** | `a537dbe` | [`rapports/S2.md`](rapports/S2.md), relecture T1 `docs/qualite/relectures/S2-a537dbe.md` (branche T1) | Voir « S2 : décisions restantes » plus bas. |
| S3 Supervisor et Garde | `claude/refonte-s3-supervisor` | **fusionnée** | `e7f4f25` | [`rapports/S3.md`](rapports/S3.md) | Format de `journal.ressource` côté serveur ; alertes app fermée (travail amn-api). Emplacement Ajmani de `ResumeDeNuit` à retirer. |
| S4 Robots métiers | — | **annulée** (décision de Harun) | — | — | — |
| S5 Modules et registre extensible | `claude/refonte-s5-modules` | **fusionnée** | `69cd802` | [`rapports/S5.md`](rapports/S5.md) | 8 regroupements à contenu choisi par S5 ; 16 essentiels ; Contrats et abonnements dans Écrire ; teinte propre de la Garde (socle) ; noms de familles du socle (« Créer » ou « Créer et produire ») ; `/garde/ajmani` encore au catalogue ; sous-vues en onglets (couture `AppLayout`) ; libellés anglais d'un écran neuf |
| S6 Sécurité et SOC | `claude/refonte-sec-*` (code seulement) | **en cours**, rien de poussé (normal). **Ne pas fusionner sans décision de Harun.** | — | `docs/securite/phase1.md`, **local ou privé uniquement** | Couvre aussi le diagnostic de la Garde. |
| F1 Atelier de modules | `claude/refonte-atelier-f1` | **prête, non fusionnée** : rien n'est branché tant que Harun n'a pas choisi | `59056ad` (alignement CO sur `274381f`) | carnet `docs/atelier/PRET.md` (13 prêts, 1 en cours) | **Le vérificateur de F1 casse sur `refonte-vivante`** : il lit encore le registre de S1, désormais `src/refonte/modules/` (fusion d'essai sans conflit, mais tous les manifestes en échec). F1 doit le reprendre avant toute intégration. F1 doit d'abord récupérer `59056ad`. |
| T1 Qualité et tests | `claude/refonte-qualite-t1` | **en cours**, non fusionnée (pas demandé à ce point) | `d026fe5` | `docs/qualite/README.md`, constat C-001, relecture S2, proposition de CI | Zone élargie par T1 à `scripts/qualite/**` (hors zone notée, sans risque). `SANTE.md` pas encore écrit. |
| SIM | ? | rapport reçu par Harun, **inconnu du CO** : aucune branche ni fichier à ce nom | — | — | Quelle session, quelle zone ? |
| G0 Garde diagnostic | — | **retirée** (S6 couvre le diagnostic) | — | — | — |

États possibles : à lancer · en cours · prête (rapport poussé) · relue · fusionnée · bloquée · annulée.

**Relances automatiques : aucune.** Ni tâche programmée ni relance de nuit, tant que Harun n'a pas validé le plafond proposé (une relance par nuit et par piste).

## Niveau d'un module (aligné au point 3)

Le registre de S5 fait foi : `niveau` vaut `essentiel`, `courant` ou `avance`, affichés « Essentiel », « Courant », « Avancé » (« Essential », « Everyday », « Advanced »). F1 est corrigé en ce sens (`59056ad`) :

- `expert` devient `avance` dans le manifeste, le dictionnaire commun, les 3 modules concernés (amortissements, situations, vigilance), `PRET.md` et les fiches ;
- les 14 aperçus sont régénérés ;
- vérifications : `verifier.mjs` (128 propriétés), `tsc` des deux éditions et `eslint` de `src/ateliers` passent.

## S2 : décisions restantes (relecture T1, aucune bloquante techniquement)

- **M1. Ajmani reste une voix à la première personne** : « Hi, I'm Ajmani… », un préfixe « Ajmani · » et une section « Le ton d'Ajmani » dans les Réglages. La direction dit « simple barre de texte ». À garder, ou neutraliser ?
- **M2. Les réactions aux moments restent** : toasts sobres. STATUT les sortait du périmètre. À garder ou retirer ?
- **M3. Deux `emit` dans des fichiers partagés** (`useClients.ts`, `useInvoices.ts`) : ils passent par la couture `@edition/socle`, le jumeau client est inerte et les types existent. **Accord du CO donné.** Ils tombent si M2 est retiré.
- **M4. L'écran de lancement interne** remplace `SplashScreen` dans `App.tsx` (via `@edition/vivant`, client inchangé). STATUT le sortait du périmètre. À garder, ou revenir à `SplashScreen` ?
- **Mineurs, à confier à une session S2 ou à T1** :
  - « Aujourd'hui » liste les tâches de toute l'équipe, sans filtre ni plafond ;
  - le message change au chargement ;
  - focus et `aria` ;
  - couleurs en dur (`#0c0c0d`, `#8a8a8e`) ;
  - `tache.terminee` réémis à chaque recochage.

## Zones

| Session | Zone |
|---|---|
| S1 | terminée. Ses fichiers de navigation sont repris par S5. |
| S2 | `src/refonte/accueil/**`, `src/accueils/interne/**`, `src/edition/accueils.internal.tsx`, couture `@edition/vivant` |
| S3 | `src/bureaux/**`, `src/screens/garde/**`, `src/components/garde/**`, `src/refonte/garde/**` |
| S5 | `src/refonte/modules/**`, `src/refonte/navigation/**`, `src/edition/modules.internal.ts`, `check:navigation` |
| S6 | `src/securite/**` (code, sans description de faille), `docs/securite/**` **hors dépôt public**. Tickets proposés en privé. |
| F1 | `src/ateliers/**` et `docs/atelier/**`. Branchement (registre de S5 et route) seulement à l'intégration d'un module choisi. |
| T1 | `tests/**`, `scripts/qualite/**`, `docs/qualite/**`. Aucun constat de sécurité dans `docs/qualite/` (ils vont à S6, en privé). |

## Ordre de fusion

Fait : S0, S3, S1, S5, S2.

1. **T1, en continu**, dès que Harun le demande. Sa zone ne recouvre personne.
2. **F1, un module à la fois**, selon [`INTEGRATION-F1.md`](INTEGRATION-F1.md) (validation par Harun attendue). Avant tout module : F1 reprend son vérificateur sur le registre de S5.
3. **S6** : à part, sur décision de Harun seulement, et sans aucun document de faille.

## Direction design (validée par Harun, 2026-10-22)

- **Noir et gris**, structure très rangée. **Ludique premium** : une journée avec des cases à cocher, une progression, l'équipe en ligne.
- **Aucun personnage ni robot.** Ajmani = une barre de texte ⌘J.
- **Couleurs** : les 7 familles, les 8 accents d'équipe et le rail restent, en petits points de couleur.
- **Fond noir et gris** : activé par S2 (`src/refonte/accueil/ambiance.css`, `:root[data-ambiance='noir']`, interne seulement), sur tous les écrans internes.
- La barre ⌘J de S2 ouvre l'assistant existant : aucun nouveau raccourci, et le client est inchangé.

## Gardes qui ne tournent nulle part

`check:isolation`, `check:mouvement`, `check:contraste`, `check:signal`, `check:mobile` et `check:coquille` demandent un build servi et un navigateur.

- T1 dispose maintenant d'un bac à sable pour les lancer (`scripts/qualite/gardes-bac-a-sable.mjs`, sur sa branche) et propose de les ajouter à la CI (`docs/qualite/proposition-ci.md`).
- `check:coquille` échouera côté interne depuis S1.
- `check:encres` (hors CI) échoue depuis S3 : copies de jetons dans `src/refonte/garde/equipes.ts`.

## Bus de moments

- Types de la Garde (point 1) : `garde.escalade` (critique), `site.muet` (decision), `garde.remontee-critique` (critique). Rien ne les émet encore.
- Émis depuis S2 : `client.cree` et `facture.payee` par `@edition/socle` ; `tache.terminee` par l'Accueil.

## Isolement des éditions

- Contrôlé par lecture des sources : `check:navigation`, `check:garde-refonte`, `check:accueils`, `check:ajmani`.
- Contrôlé sur le vrai paquet client : « Build business + contrôle de fuite » en CI, et `comparer-paquet-client.mjs` chez T1.
- À terme : un seul contrôle fondé sur le graphe d'imports depuis la racine cliente.

## Journal des fusions

| Date | Branche | sha | Résultat |
|---|---|---|---|
| 2026-10-20 | `claude/refonte-s0-socle` | `b7453e3` → `9a6ffe7` | sans conflit ; gardes locales et CI de build au vert |
| 2026-10-22 | `claude/refonte-s3-supervisor` | `e7f4f25` → `596239e` | sans conflit |
| 2026-10-22 | `claude/refonte-s1-navigation` | `e788af8` → `c5f4707` | conflit additif dans `editions.yml`, les deux étapes gardées ; commit `CommandPalette.tsx` hors zone accepté par Harun |
| 2026-10-22 | (CO) | `c808dae` | 3 types de moments ; `check:navigation` corrigé pour S3 |
| 2026-10-22 | point 2 | — | rien de prêt : aucune fusion |
| 2026-10-22 | `claude/refonte-s5-modules` | `69cd802` → `25c1d0d` | sans conflit ; gardes vertes |
| 2026-10-22 | `claude/refonte-s2-accueil` | `a537dbe` → `408a3f5` | sans conflit ; `check:clavier` rouge (déjà sur la branche S2) |
| 2026-10-22 | (CO) | `c88814c` | `Lancement.tsx` : `useFermetureEchap` ; toutes les gardes vertes |
| 2026-10-22 | (CO, branche F1) | `274381f` → `59056ad` | niveau `expert` → `avance` (demande de Harun) |

## LOT-00 Système et démarrage

Branche `claude/refonte-socle` (partie de `claude/refonte-design-socle`). Détail : [`rapports/LOT-00.md`](rapports/LOT-00.md).

**Aucune capture ni comparaison à l'image ±2 px** : l'application n'a pas été lancée (consigne). Chaque écran est vérifié par les gardes sans navigateur et par rendu serveur ; la colonne « Capture » reste « non capturé ».

| Écran | Route / entrée | État | Capture | Écarts |
|---|---|---|---|---|
| H40 Notifications | `/notifications`, cloche de l'en-tête | fait | non capturé | Seul le canal « App » a des émetteurs ; mail et mobile : filtres seulement |
| H41 Recherche ⌘K | ⌘K, champ de la barre latérale | fait | non capturé | « Écrire à X » ouvre `mailto:` ; pas de ⌘↵ (fenêtre unique Electron) |
| H42 Démarrage | `/demarrage` ; une fois, à la toute première connexion | fait | non capturé | Étapes 5 et 6 (paiement, appareil mobile) manuelles : aucune donnée de connecteur |
| H47 Choisir son métier | `/demarrage/metier` | fait | non capturé | Réglage personnel (pas de réglage d'organisation) ; « Passer » ne masque aucun module |
| H43 États et messages | `/dev/etats` (développement) + briques `situations` | fait | non capturé | Page de référence interne, hors production |
| D02 Tous les modules | « Tous les modules (101) » de la barre latérale | fait | non capturé | Comptes par famille issus du registre (14/7/11/13/15/7/19/15 depuis S5), pas de la maquette (12/14/9/18/10/16/14/8) ; totaux 101 et niveaux 16/62/23 conformes |
| G06 Connexion | `/login` | fait | non capturé | « Demandez un accès » affiche un texte (aucun flux de demande) ; « 12 organisations » est une constante de présentation à valider ; la phrase sur le journal de la Garde est à vérifier (H35) |
| G05 Ajmani ⌘J | ⌘J, barre Ajmani | fait | non capturé | Prépare un brouillon de relance N1, n'envoie rien ; « Décrire » passe à l'assistant existant |

**8 écrans sur 8 construits.**

### Écarts et réserves (à lire par le CO)

- La nouvelle coquille reste **éteinte par défaut** (drapeau `amn.coquille`) : l'allumer est une décision CO/Harun.
- Les pages « Vue d'ensemble » de famille (`/ensemble/:famille`) sont génériques jusqu'aux lots F10–F60.
- Raccourci « N · Créer, partout » non repris (n'existe pas). « Un appel de 15 minutes » mène à `/assistance`. « Créer un devis pour X » ouvre la page client de X.
- `check:coquille`, `check:signal`, `check:mobile`, `check:contraste`, `check:focus`, `check:cibles`, `check:etiquettes`, `check:mouvement`, `check:xss`, `check:isolation`, `check:business` demandent un navigateur ou un build servi : **non lancés**.
- Gardes en échec avant et après le lot, sans lien avec lui : `check:encres` (`src/refonte/garde/equipes.ts`), `check:migration`, `check:xss`, `check:visite`, `check:support` (environnement).

### Reprise de S5 (2026-11-01)

- Fusionnés sur `claude/refonte-socle` : les 4 commits de S5 absents de la branche (`669eeab`, `1d580d1`, `25768fa`, `b82e50f`).
- Un seul conflit, dans `src/socle/i18n.ts` (lignes voisines) : `famille.creer` = « Créer et produire » / « Create and produce » (S5, identique des deux côtés) ; `famille.outils` = « Outils et réglages » / « Tools and settings » (LOT-00, conforme à `01-SOCLE-DESIGN.md` et au registre) au lieu de « Outils ».
- Effet sur D02 : Contrats et abonnements passent d'Écrire à Argent (Écrire 11, Argent 13). Total 101 et niveaux 16/62/23 inchangés.
- Point ouvert : `/garde/ajmani` (S5) ouvre l'assistant existant, pas la palette ⌘J du LOT-00 (G05) quand la nouvelle coquille est allumée. À aligner au basculement de la coquille.
- Gardes après fusion : identiques à la base ; `check:socle-*` et `check:systeme-*` verts.

### Questions pour le CO

1. Allume-t-on la nouvelle coquille par défaut ? Avec quel jalon ?
2. Valider la phrase « Connexion protégée… journal de la Garde » et la constante « 12 organisations » (G06).
3. Faut-il un réglage d'organisation pour le métier (H47) ?
4. Brancher des émetteurs « mail » et « mobile » pour les notifications (H40) ?

### Composants disponibles pour les autres lots

Tout s'importe depuis `src/socle/ui` (`index.ts`) ; internes seulement, jamais depuis un fichier partagé.

| Groupe | Dossier | Contenu |
|---|---|---|
| Base | `src/socle/ui/*.tsx` | `Bouton` (`raccourci`), `Carte`, `Modale`, `Saisie`, `TuileKpi`, `BarreProgression`, `AnneauProgression`, `Etiquette`, `PastilleEtat`, `Avatar`, `PileAvatars`, `Raccourci`, `CaseACocher`, `LigneTache`, `LigneActivite`, `EtapeFranchie`, `EtatVide`, `Squelette` |
| Contrôles | `controles/` | `Interrupteur`, `BoutonIcone`, `Selecteur`, `BoiteRecherche`, `Onglets`, `Segmente`, `SuggestionAjmani`, `Tag`, `SousCarte`, `CarteCases`, `CarteAnneau`, `CarteSerie`, `CarteJalon` |
| Situations | `situations/` | `EtatChargement`, `SqueletteLignes`, `DialogueConfirmation`, `FournisseurToasts` + `useToastsSocle`, `AvisCollaboration` |
| Graphiques | `graphiques/` | `Courbe`, `MiniCourbe`, `Barres`, `Donut`, `Anneau`, formats (`formaterNombre`, `formaterEuro`, `formaterPourcent`) |
| Archétypes | `archetypes/` | `Page`, `RangeeKpi`, `ColonneDroite`, `Kanban`, `GrilleCartes`, `Scinde`, `Semaine`, `LigneTemps`, tableau triable (`trierLignes`…) |
| Coquille | `src/socle/coquille/` | `BarreLaterale`, `EnTete`, `BarreAjmani`, `Coquille` |
| Système | `src/refonte/systeme/` | notifications, recherche, Ajmani, modules, connexion, démarrage, H43, démo (`/dev/socle`) |

Chaque écran a ses mots fr/en (`definirMots`) et sa garde : `check:socle-controles|graphiques|situations|archetypes|coquille`, `check:systeme-modules|notifications|recherche|ajmani|demo|demarrage`.
