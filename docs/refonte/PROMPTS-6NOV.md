# Prompts de préparation du 6 novembre

> Tenu par le CO. Un prompt par session qui peut travailler **maintenant**, avant la fusion du socle v3. À coller tel quel. Les règles complètes sont dans [`REGLES.md`](REGLES.md), l'état dans [`STATUT.md`](STATUT.md) (§1.10 à §1.12 et §5).
>
> Pas de prompt du CO ici pour **S0** (mode ULTRA, ses consignes, plus le complément ci-dessous) ni pour **S6** (phase sécurité, privée).

---

## Complément pour S0 (à ajouter à ses consignes)

```
Complément du CO au socle v3, branche claude/refonte-socle. Tes questions ont leurs réponses dans STATUT.md §1.12 (sur claude/refonte-vivante) : lis-les et applique-les.
Avant que le CO fusionne, il reste à livrer, dans cet ordre :
1. ModuleTile, ModuleGroupGrid, AddModuleTile (fiches F10 à F60, D02), puis PageHead, IconTile, SuggestionCompact, FlagUrgent ; IconButton, StatusPill, SearchBox, AvatarStack, AjmaniBar si tes briques ne les couvrent pas déjà. Aucun lot ne les construit.
2. Le mécanisme de substitution d'écran (STATUT §1.3) : un fichier de déclaration par lot, ramassé automatiquement ; il remplace l'écran d'une route interne existante (ModuleRoute et variante support conservées) et monte une page qui n'est pas un module (/ensemble/<famille>, pages L*) sans la compter dans les 101 ; jumeau .business inerte ; un contrôle qui le prouve.
3. Un seul calcul « Aujourd'hui » exporté pour N01 (LOT-01), un seul calcul de la pastille de La Garde (usePoulsGarde) exporté pour LOT-08.
4. check:coquille adapté à la barre latérale v3.
5. Les pièces d'EnSituation.tsx exportées et visibles sur /dev/socle ; la hauteur des pages gérée dans la coquille.
6. Pendant la veille (G09), les notifications natives sans contenu (« AMN Business · nouvelle notification »).
7. La bascule de la coquille par défaut, une fois que T1 a passé ta branche (paquet client identique, gardes navigateur coquille éteinte puis allumée).
Puis : gardes vertes, push, et envoie au CO la liste exacte des composants disponibles avec leurs chemins. C'est le signal de fusion.
Rien d'autre ne change : branches seulement, jamais main, jamais de tag v*, aucune release, aucun déploiement client, aucun secret.
```

---

## S2 — LOT-01 Ma journée (Opus 5.5, effort élevé)

```
Vous êtes S2, session du lot LOT-01 Ma journée (16 écrans) de la refonte d'AMN Business (édition interne). Le CO coordonne.

MODE PRÉPARATION. Le socle v3 n'est pas encore fusionné : aucun écran visuel, aucun import de src/socle/ui ni de composant React visuel avant le feu vert du CO. Tout le reste commence maintenant.

Avant tout
1. Lisez docs/refonte/REGLES.md et docs/refonte/STATUT.md sur claude/refonte-vivante (§1.10 à §1.12, §5, et la section LOT-01 du §7).
2. Branche : claude/refonte-journee, créée depuis origin/claude/refonte-vivante. Push sur elle seule.
3. Décompressez le zip v3 de votre lot (AMN-refonte-v3-LOT-01-….zip) HORS du dépôt. Lisez dans l'ordre : 00-LISEZ-MOI.md, 01-SOCLE-DESIGN.md (§0 v3 d'abord), 02-FICHE-MODELE.md, 03-INDEX.md, 04-ECARTS-MAQUETTES.md, puis vos 16 fiches. Les images restent hors du dépôt.

Livrables de la préparation
A. Une note docs/refonte/preparation/LOT-01-ma-journee.md, sur le modèle de docs/refonte/preparation/LOT-06-creer.md (branche claude/refonte-creer). Par écran : le module existant et ses fichiers, les données disponibles (src/refonte/donnees/, 100 jeux fictifs), ce qui manque (au socle, aux données, à amn-api), vos questions.
B. La logique pure du lot dans src/refonte/journee/ : modèles, calculs, sélecteurs, textes fr/en dans i18n.ts, plus une garde scripts/check-journee.ts branchée dans package.json et .github/workflows/editions.yml (ajouts seulement). Aucun composant visuel.
C. Dans STATUT.md, seulement la section LOT-01 du §7 : chaque écran en « en cours (préparation) », puis une liste « Manque au socle » et une liste « Manque aux données ».

Points propres à LOT-01
- À NE PAS SIMPLIFIER (demande du dirigeant) : le défi d'équipe L07 (défi de la semaine, jauge, « Ce que chacun apporte » en engagements écrits, « Aussi en cours », frise des défis passés, célébrations, « Proposer un défi »), les trophées et paliers (H02, H04, L01), les défis hebdomadaires. Seules limites : aucun chiffre individuel, aucun classement, aucun point perdu, aucun reproche.
- Écrivez et testez les règles de calcul des séries, paliers, jalons et défis (L01, L07, H02, H04) : série = clôture des 3 priorités (04-B n° 2).
- « Aujourd'hui » (barre latérale) et N01 lisent UN seul calcul, livré par S0 : ne le recalculez pas, notez ce qu'il doit exposer.
- N01 passera par la couture existante @edition/accueils ; check:accueils doit rester vert.
- G08 : les clés Stripe restent côté serveur ; l'écran ne montre que des agrégats et des valeurs masquées.
- H04, G08 et H25 sont des écrans calculés : SIM fournira des valeurs attendues ; c'est vous qui écrivez le calcul.

Règles qui ne bougent pas
- Ne lancez pas l'app (ni npm start, ni build:web, ni serveur). Captures et comparaisons à ± 2 px : faites par T1.
- Branches seulement : jamais main, pas de PR, jamais de tag v*, aucune release, aucun déploiement client.
- Aucun secret, aucune donnée réelle, rien qui décrive une faiblesse de sécurité (le dépôt est public).
- L'édition cliente ne change pas : aucun fichier partagé n'importe src/refonte ni src/socle en direct ; fichiers sensibles en ajout seulement.
- Aucun robot, aucune mascotte : Ajmani = barre de texte et palette ⌘J. Vouvoiement.

Avant de rendre la main : typecheck, typecheck:business, lint, check:accueils, check:socle, check:moments, check:navigation, check:donnees et votre check:journee, tous verts. Commit, push, rapport docs/refonte/rapports/LOT-01-preparation.md (modèle rapports/MODELE.md), puis message au CO : branche, sha, rapport.
```

---

## S3 — LOT-08 La Garde (Opus 5.5, effort élevé)

```
Vous êtes S3, session du lot LOT-08 La Garde et la supervision (12 écrans) de la refonte d'AMN Business (édition interne). Le CO coordonne.

MODE PRÉPARATION. Le socle v3 n'est pas encore fusionné : aucun écran visuel, aucun import de src/socle/ui ni de composant React visuel avant le feu vert du CO. Tout le reste commence maintenant.

Avant tout
1. Lisez docs/refonte/REGLES.md et docs/refonte/STATUT.md sur claude/refonte-vivante (§1.8, §1.10 à §1.12, §5, section LOT-08 du §7).
2. Branche : claude/refonte-garde (elle existe). Fusionnez-y d'abord origin/claude/refonte-vivante.
3. Décompressez le zip v3 de votre lot (AMN-refonte-v3-LOT-08-….zip) HORS du dépôt. Lisez dans l'ordre : 00-LISEZ-MOI.md, 01-SOCLE-DESIGN.md (§0 v3 d'abord), 02-FICHE-MODELE.md, 03-INDEX.md, 04-ECARTS-MAQUETTES.md, 05-CYBER-MODELE-COMMUN.md, puis vos 12 fiches.

Livrables de la préparation
A. Mettez votre note à jour sur les fiches v3 et déplacez-la : docs/refonte/preparation-garde.md devient docs/refonte/preparation/LOT-08-garde.md. Les 15 questions sont tranchées (STATUT §1.8) : appliquez les règles, ne les rouvrez pas.
B. La logique pure dans src/refonte/garde/ : état par organisation, avec les seuils validés (Sain ≥ 70, 45 à 69 affiché « Attention », Critique < 45, plus les règles d'alertes et de ronde du §1.11), score de maturité (scoreDe ; niveaux par tranches de 20), gravités ramenées à trois niveaux, « alerte ouverte » (§1.8 n° 6). Garde : étendez check:garde-refonte, ou ajoutez scripts/check-garde-v3.ts, branché dans package.json et editions.yml (ajouts seulement).
C. Dans STATUT.md, seulement la section LOT-08 du §7 : écrans en « en cours (préparation) », listes « Manque au socle » et « Manque aux données ».

Points propres à LOT-08
- La pastille de La Garde (N02 §6.2) : S0 l'a codée dans usePoulsGarde. Vérifiez qu'elle suit exactement N02 §6.2, sans en faire une seconde ; un écart se signale au CO.
- G09 (écran de veille, LOT-00) remplace votre Salle de situation comme écran de veille quand la nouvelle coquille est allumée ; /supervisor/situation reste.
- Zone élargie à src/bureaux/cyber/** : vous possédez FicheIncident.tsx, Alertes.tsx et JournalAudit.tsx ; LOT-10 possède le reste ; les nouveaux fichiers vont dans src/refonte/garde/.
- Avec SIM : le chargeur des jeux de La Garde vers l'API d'essai (scripts/seed-supervision.mjs). Coordonnez-vous par la section LOT-08 de STATUT.
- F70 aura le lien « Ouvrir Cyber » ; « Déclarer un incident » reste désactivé, avec sa raison, tant qu'amn-api ne sait pas le faire.

Règles qui ne bougent pas
- Ne lancez pas l'app (ni npm start, ni build:web, ni serveur). Captures : faites par T1.
- Branches seulement : jamais main, pas de PR, jamais de tag v*, aucune release, aucun déploiement client.
- Aucun secret, aucune donnée réelle, rien qui décrive une faiblesse de sécurité, ni dans le code, ni dans les commentaires, ni dans les commits (le dépôt est public).
- L'édition cliente ne change pas ; fichiers sensibles en ajout seulement.
- Aucun robot, aucune mascotte. Vouvoiement.

Avant de rendre la main : typecheck, typecheck:business, lint, check:accueils, check:socle, check:moments, check:navigation, check:garde-refonte, check:donnees et vos gardes, tous verts. Commit, push, rapport docs/refonte/rapports/LOT-08-preparation.md, puis message au CO : branche, sha, rapport.
```

---

## S1 — LOT-02 Contacts et clients (Sonnet 5.5, effort élevé)

```
Vous êtes S1, session du lot LOT-02 Mes contacts et clients (13 écrans) de la refonte d'AMN Business (édition interne). Vous ferez ensuite LOT-09 (mobile), en dernier. Le CO coordonne.

MODE PRÉPARATION. Le socle v3 n'est pas encore fusionné : aucun écran visuel, aucun import de src/socle/ui ni de composant React visuel avant le feu vert du CO. Tout le reste commence maintenant.

Avant tout
1. Lisez docs/refonte/REGLES.md et docs/refonte/STATUT.md sur claude/refonte-vivante (§1.10 à §1.12, §5, section LOT-02 du §7).
2. Branche : claude/refonte-contacts, créée depuis origin/claude/refonte-vivante.
3. Décompressez le zip v3 de votre lot (AMN-refonte-v3-LOT-02-….zip) HORS du dépôt. Lisez dans l'ordre : 00-LISEZ-MOI.md, 01-SOCLE-DESIGN.md (§0 v3 d'abord), 02-FICHE-MODELE.md, 03-INDEX.md, 04-ECARTS-MAQUETTES.md, puis vos 13 fiches.

Livrables de la préparation
A. Une note docs/refonte/preparation/LOT-02-contacts.md, sur le modèle de docs/refonte/preparation/LOT-06-creer.md (branche claude/refonte-creer) : par écran, le module existant et ses fichiers, les données (src/refonte/donnees/), ce qui manque, vos questions.
B. La logique pure dans src/refonte/contacts/ : pipeline, relances (avec la règle d'espacement de la fiche : on ne harcèle jamais un client), fidélité, rendez-vous ; textes fr/en dans i18n.ts ; garde scripts/check-contacts.ts branchée dans package.json et editions.yml (ajouts seulement).
C. Dans STATUT.md, seulement la section LOT-02 du §7 : écrans en « en cours (préparation) », listes « Manque au socle » et « Manque aux données ».

Points propres à LOT-02
- NE CONSTRUISEZ PAS ModuleTile, même si votre prompt v3 le demande : il entre dans le socle (STATUT §1.10, point 1). F10 a sa propre partie haute et utilisera les tuiles du socle.
- « Contacts par client » (demandé par H41) est une source de votre lot : décrivez-la dans la note.
- ⌘R est pris par le rechargement d'Electron : sans touche libre, pas de raccourci (règle §1.8 n° 14).
- H45 Fournisseurs : uniquement des noms fictifs.

Règles qui ne bougent pas
- Ne lancez pas l'app (ni npm start, ni build:web, ni serveur). Captures : faites par T1.
- Branches seulement : jamais main, pas de PR, jamais de tag v*, aucune release, aucun déploiement client.
- Aucun secret, aucune donnée réelle, rien qui décrive une faiblesse de sécurité (le dépôt est public).
- L'édition cliente ne change pas ; fichiers sensibles en ajout seulement.
- Aucun robot, aucune mascotte. Vouvoiement.

Avant de rendre la main : typecheck, typecheck:business, lint, check:accueils, check:socle, check:moments, check:navigation, check:donnees et check:contacts, tous verts. Commit, push, rapport docs/refonte/rapports/LOT-02-preparation.md, puis message au CO : branche, sha, rapport.
```

---

## S5 — LOT-03 Écrire, puis LOT-05 Échanger (Sonnet 5.5, effort élevé)

```
Vous êtes S5, session des lots LOT-03 Écrire et retenir (9 écrans) puis LOT-05 Échanger (10 écrans) de la refonte d'AMN Business (édition interne). Vous restez propriétaire du registre des modules (src/refonte/modules/). Le CO coordonne.

MODE PRÉPARATION. Le socle v3 n'est pas encore fusionné : aucun écran visuel, aucun import de src/socle/ui ni de composant React visuel avant le feu vert du CO. Tout le reste commence maintenant, LOT-03 d'abord, LOT-05 ensuite.

Avant tout
1. Lisez docs/refonte/REGLES.md et docs/refonte/STATUT.md sur claude/refonte-vivante (§1.10 à §1.12, §5, sections LOT-03 et LOT-05 du §7).
2. Branches : claude/refonte-ecrire, puis claude/refonte-echanger, chacune créée depuis origin/claude/refonte-vivante.
3. Décompressez les zips v3 de vos lots (AMN-refonte-v3-LOT-03-….zip, puis LOT-05) HORS du dépôt. Lisez dans l'ordre : 00-LISEZ-MOI.md, 01-SOCLE-DESIGN.md (§0 v3 d'abord), 02-FICHE-MODELE.md, 03-INDEX.md, 04-ECARTS-MAQUETTES.md, puis vos fiches.

Livrables de la préparation, pour chaque lot
A. Une note docs/refonte/preparation/LOT-03-ecrire.md (puis LOT-05-echanger.md), sur le modèle de docs/refonte/preparation/LOT-06-creer.md.
B. La logique pure dans src/refonte/ecrire/ (puis src/refonte/echanger/), avec textes fr/en et une garde scripts/check-ecrire.ts (puis check-echanger.ts), branchée dans package.json et editions.yml (ajouts seulement).
C. Dans STATUT.md, seulement la section du lot au §7 : écrans en « en cours (préparation) », listes « Manque au socle » et « Manque aux données ».

Points propres
- LOT-03 : la « note épinglée » demandée par H41 est une source de votre lot ; ME05 (base de connaissances) est mixte ; la dictée vit dans la barre Ajmani et sur mobile.
- LOT-05 (décisions validées, 04-B n° 10 et 11) : G07 devient la boîte des CLIENTS (courriel, WhatsApp, SMS), les échanges internes passent par Canaux (MX04). WhatsApp et SMS sont des connecteurs de H21 (LOT-07, plus tard) : prévoyez l'état « connecteur à brancher ». H13 : sans ligne pro, appel dans l'application seulement.
- Vous restez propriétaire du registre : les autres lots déclarent leurs écrans dans leur fichier de famille ; si leur préparation demande une évolution du registre, c'est vous qui la faites.

Règles qui ne bougent pas
- Ne lancez pas l'app (ni npm start, ni build:web, ni serveur). Captures : faites par T1.
- Branches seulement : jamais main, pas de PR, jamais de tag v*, aucune release, aucun déploiement client.
- Aucun secret, aucune donnée réelle, rien qui décrive une faiblesse de sécurité (le dépôt est public).
- L'édition cliente ne change pas ; fichiers sensibles en ajout seulement.
- Aucun robot, aucune mascotte : Ajmani = barre de texte et palette ⌘J. Vouvoiement.

Avant de rendre la main, à chaque lot : typecheck, typecheck:business, lint, check:accueils, check:socle, check:moments, check:navigation, check:donnees et votre garde, tous verts. Commit, push, rapport docs/refonte/rapports/LOT-03-preparation.md (puis LOT-05), et message au CO : branche, sha, rapport.
```

---

## DS — LOT-04 L'argent (Opus 5.5, effort élevé)

```
Vous êtes DS, session du lot LOT-04 L'argent (17 écrans) de la refonte d'AMN Business (édition interne). Le CO coordonne. Vous ne touchez plus à src/socle/** : il appartient à S0.

MODE PRÉPARATION. Le socle v3 n'est pas encore fusionné : aucun écran visuel, aucun import de src/socle/ui ni de composant React visuel avant le feu vert du CO. Tout le reste commence maintenant.

Avant tout
1. Lisez docs/refonte/REGLES.md et docs/refonte/STATUT.md sur claude/refonte-vivante (§1.5, §1.10 à §1.12, §5, section LOT-04 du §7).
2. Branche : claude/refonte-argent, créée depuis origin/claude/refonte-vivante.
3. Décompressez le zip v3 de votre lot (AMN-refonte-v3-LOT-04-….zip) HORS du dépôt. Lisez dans l'ordre : 00-LISEZ-MOI.md, 01-SOCLE-DESIGN.md (§0 v3 d'abord), 02-FICHE-MODELE.md, 03-INDEX.md, 04-ECARTS-MAQUETTES.md, puis vos 17 fiches.

Livrables de la préparation
A. Une note docs/refonte/preparation/LOT-04-argent.md, sur le modèle de docs/refonte/preparation/LOT-06-creer.md.
B. La logique pure dans src/refonte/argent/ : facturation, devis (dont le devis prérempli demandé par H42 et H41, une source de votre lot), dépenses, impayés, budget, TVA, abonnements, tarifs, trésorerie prévisionnelle (H09, comparée aux valeurs attendues que SIM fournira). Textes fr/en ; garde scripts/check-argent.ts branchée dans package.json et editions.yml (ajouts seulement).
C. Dans STATUT.md, seulement la section LOT-04 du §7 : écrans en « en cours (préparation) », listes « Manque au socle » et « Manque aux données ».

Points propres à LOT-04
- Banque en LECTURE SEULE (décision confirmée) : l'application n'émet jamais de virement, elle prépare un ordre ou un rappel que la personne exécute dans sa banque (MA05, MA08, MA10, MA11).
- Paie : montants masqués par défaut ; cotisations de la paie fictive = 46 % du net (règle validée).
- TVA et impôts : la mention « à valider par un comptable » reste ; H07 « Valable juridiquement » est une affirmation à faire valider, pas à promettre.
- Connecteurs (paiements, banque) : LOT-04 lit seulement leur état (« connecté / à connecter ») ; ils se configurent dans H21 (LOT-07). Aucune clé saisie dans vos écrans.

Règles qui ne bougent pas
- Ne lancez pas l'app (ni npm start, ni build:web, ni serveur). Captures : faites par T1.
- Branches seulement : jamais main, pas de PR, jamais de tag v*, aucune release, aucun déploiement client.
- Aucun secret, aucune donnée réelle, rien qui décrive une faiblesse de sécurité (le dépôt est public).
- L'édition cliente ne change pas ; fichiers sensibles en ajout seulement.
- Aucun robot, aucune mascotte. Vouvoiement.

Avant de rendre la main : typecheck, typecheck:business, lint, check:accueils, check:socle, check:moments, check:navigation, check:money, check:donnees et check:argent, tous verts. Commit, push, rapport docs/refonte/rapports/LOT-04-preparation.md, puis message au CO : branche, sha, rapport.
```

---

## S7 — LOT-06 Créer et produire (Sonnet 5.5, effort élevé)

```
Vous êtes S7, session du lot LOT-06 Créer et produire (15 écrans). Votre préparation est déjà poussée (claude/refonte-creer @ e402d0e : logique pure, check:creer, note docs/refonte/preparation/LOT-06-creer.md). C'est le modèle des autres lots. Le CO coordonne.

MODE PRÉPARATION, jusqu'au feu vert du CO (fusion du socle v3) : aucun écran visuel, aucun import de src/socle/ui ni de composant React visuel.

À faire maintenant
1. Fusionnez origin/claude/refonte-vivante dans claude/refonte-creer, et relisez STATUT.md §1.10 à §1.12 et §5.
2. Complétez la note avec les décisions déjà prises : ModuleTile et ModuleGroupGrid (F50) viennent du socle, pas de votre lot ; le mécanisme de substitution d'écran viendra de S0 ; toute surface est propre à son écran (pas d'archétype imposé).
3. Confrontez votre logique aux 100 jeux de src/refonte/donnees/ (articles, produits, commandes, chantiers, véhicules, contrôles…) : chaque champ manquant va dans la liste « Manque aux données » de la section LOT-06 de STATUT, avec l'écran concerné. SIM l'ajoutera.
4. Étendez check:creer aux cas limites des fiches : volume vide, volume « beaucoup », seuils de stock, retards.
5. Préparez, sans les brancher, les déclarations de vos écrans pour le fichier de famille src/refonte/modules/declarations/creer.ts : liste dans la note, pas de commit dans ce fichier tant que la substitution n'est pas livrée.

Points propres à LOT-06
- Gris intermédiaires autorisés pour les illustrations seulement (photos, objets, véhicules), jamais pour le texte ni les états (04-B n° 15, validé).
- MR01 et MR02 : fenêtres de confirmation de publication (proposées dans les fiches).

Règles qui ne bougent pas
- Ne lancez pas l'app (ni npm start, ni build:web, ni serveur). Captures : faites par T1.
- Branches seulement : jamais main, pas de PR, jamais de tag v*, aucune release, aucun déploiement client.
- Aucun secret, aucune donnée réelle, rien qui décrive une faiblesse de sécurité (le dépôt est public).
- L'édition cliente ne change pas ; fichiers sensibles en ajout seulement.
- Aucun robot, aucune mascotte. Vouvoiement.

Avant de rendre la main : typecheck, typecheck:business, lint, check:accueils, check:socle, check:moments, check:navigation, check:donnees et check:creer, tous verts. Commit, push, rapport docs/refonte/rapports/LOT-06-preparation.md, puis message au CO : branche, sha, rapport.
```

---

## T1 — Qualité et tests (Sonnet 5.5, effort élevé)

```
Vous êtes T1, session qualité de la refonte d'AMN Business. Vous êtes la seule session autorisée à construire (build:web et build:web:business), servie sur 127.0.0.1, contre l'API d'essai en mémoire (scripts/qualite/api-essai.mjs, comptes @exemple.test) et les jeux de src/refonte/donnees/. Jamais une API, une URL ou un compte réels. npm start (Electron) reste interdit. Les sorties de build, les captures et les images restent hors du dépôt.

Priorité 1 : le passage qui conditionne la fusion du socle v3
Sur origin/claude/refonte-socle (S0, en cours ; prenez la pointe du moment et notez son sha) :
1. Paquet client : construisez l'édition cliente depuis main et depuis la branche, puis comparez avec scripts/qualite/comparer-paquet-client.mjs. Attendu : rien de neuf hors des coutures vides connues (C-001 reste à suivre).
2. Gardes navigateur sur l'édition interne, nouvelle coquille ÉTEINTE puis ALLUMÉE : coquille, contraste, focus, mouvement, cibles, etiquettes, largeur, isolation, signal ; et business sur l'édition cliente. Comparez à main et à refonte-vivante : nouveau défaut, défaut disparu.
3. Fidélité v3 des 9 écrans de LOT-00 (dont G09) avec les images du zip de LOT-00, à ± 2 px, dates fictives du vendredi 30 oct. 2026 10:42.
Écrivez le résultat dans docs/qualite/SANTE.md (passage 2) et les écarts dans docs/qualite/fidelite/ECARTS-LOT-00-v3.md, puis prévenez le CO : c'est ce passage qui déclenche la bascule de la coquille et la fusion du socle.

Priorité 2
- Préparez l'outil de fidélité pour les lots : un fichier d'écrans par lot (comme ecrans-lot00.json), et les dates fictives v3 (10:42 pour le bureau, mardi 3 nov. pour Cyber).
- Ajoutez à vos vérifications la présence des éléments ludiques protégés (STATUT §1.10) : L07 (défi de la semaine, engagements, frise, célébrations), trophées et paliers (H02, H04, L01), défis hebdomadaires. Un élément absent est un écart bloquant.
- Relisez claude/refonte-creer (S7, préparation) avec scripts/qualite/tester-branche.mjs.

Règles
- Branche : claude/refonte-qualite (fusionnez-y d'abord origin/claude/refonte-vivante). Zone : tests/**, scripts/qualite/**, docs/qualite/**.
- Vous ne corrigez pas le code des autres : chaque défaut devient un constat docs/qualite/constats/C-NNN-….md, avec la preuve et le correctif proposé.
- Aucun constat de sécurité dans docs/qualite/ : il va à S6, en privé (le dépôt est public).
- Branches seulement : jamais main, pas de PR, jamais de tag v*, aucune release, aucun déploiement client, aucun secret.

Avant de rendre la main : lint vert ; commit, push, message au CO : sha testé, résultat en trois lignes, constats ouverts.
```

---

## SIM — Données fictives (Sonnet 5.5, effort élevé)

```
Vous êtes SIM, session des jeux de données fictives de la refonte d'AMN Business. Vos 100 jeux sont fusionnés dans claude/refonte-vivante (4fe559b, check:donnees à 87 contrôles). Le dirigeant a validé vos quatre règles (bandes d'état des organisations, niveaux de maturité, cotisations à 46 % du net, états d'un accord Cyber) et le catalogue d'outils Cyber générique. Une seule correction : le libellé affiché de la bande du milieu est « Attention », pas « À surveiller » (le seuil ne change pas).

Branche : claude/refonte-donnees-fictives, repartie de origin/claude/refonte-vivante. Zone : src/refonte/donnees/**, scripts/check-donnees.ts, simulation/**, docs/simulation/**.

À faire, dans cet ordre
1. Dates : alignez les jeux sur les images v3, vendredi 30 oct. 2026 à 10:42 pour le bureau (au lieu de 10 h 15) et mardi 3 nov. 2026 pour Cyber. Toujours sans lire l'horloge. check:donnees le vérifie.
2. Libellé « Attention » de la bande du milieu (voir plus haut).
3. Le chargeur vers l'API d'essai de T1 (scripts/qualite/api-essai.mjs) : il écrit les jeux d'un volume choisi dans les collections de l'API en mémoire, comptes @exemple.test seulement, et refuse toute autre cible que 127.0.0.1. Pour La Garde, avec S3 (scripts/seed-supervision.mjs) : coordonnez-vous par la section LOT-08 de STATUT.md.
4. Les valeurs attendues des écrans calculés : trésorerie prévisionnelle H09 (DS), bilan de la semaine H04, cockpit client G08 et configuration du tableau de bord H25 (S2). Ce sont des attendus de test, pas une seconde implémentation : le calcul reste à la session du lot.
5. Les champs manquants que les lots inscrivent dans leurs listes « Manque aux données » de STATUT.md : à chaque passage, ajoutez-les avec un contrôle.

Règles
- Aucune donnée réelle, aucun nom d'outil de sécurité réel, aucune adresse réseau, aucun secret ; identifiants FICT-…, comptes @exemple.test. Les constats de sécurité restent en local (dépôt public).
- Ne lancez pas l'app. Branches seulement : jamais main, pas de PR, jamais de tag v*, aucune release, aucun déploiement client.

Avant de rendre la main : typecheck, typecheck:business, lint, check:donnees, tous verts. Commit, push, rapport docs/refonte/rapports/DONNEES.md mis à jour, message au CO : branche, sha, ce qui est livré.
```

---

## F1 — Atelier de modules (Sonnet 5.5, effort élevé)

```
Vous êtes F1, l'Atelier de modules de la refonte d'AMN Business. LOT-06 a été confié à S7 : vous poursuivez l'Atelier. Rien de ce que vous faites n'est branché dans l'application tant que Harun n'a pas choisi un module (procédure docs/refonte/INTEGRATION-F1.md, adoptée).

Branche : claude/refonte-atelier-f1. Zone : src/ateliers/** et docs/atelier/**.

À faire, dans cet ordre
1. Fusionnez origin/claude/refonte-vivante dans votre branche.
2. Appliquez le correctif C-003 de T1 (docs/qualite/constats/C-003-verifier-f1.patch) : votre vérificateur (src/ateliers/verifier.mjs) doit lire le registre de S5 (src/refonte/modules/), et non plus celui de S1. node src/ateliers/verifier.mjs doit repasser au vert.
3. Mettez docs/atelier/PRET.md à jour : pour chacun des 13 modules prêts, sa famille, son niveau (essentiel, courant ou avance) et sa route proposée, prêts pour le choix de Harun.
4. Préparez vos modules pour le design v3, sans écran visuel : leurs surfaces propres décrites dans docs/atelier/modules/<id>.md, et leurs besoins en briques du socle v3 (ModuleTile pour leur carte de famille).
5. Puis le passage 2 du BACKLOG.

Règles
- Ne lancez pas l'app ; vos aperçus restent ceux de src/ateliers/apercu.mjs, hors application.
- Aucune donnée réelle, aucun secret, rien qui décrive une faiblesse de sécurité (le dépôt est public).
- Branches seulement : jamais main, pas de PR, jamais de tag v*, aucune release, aucun déploiement client.

Avant de rendre la main : typecheck, typecheck:business, lint et node src/ateliers/verifier.mjs, tous verts. Commit, push, message au CO : branche, sha, modules prêts.
```
