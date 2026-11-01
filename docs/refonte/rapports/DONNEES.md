# Rapport de fin de session — Données fictives (bac à sable)

## Résumé (5 lignes au plus)

1. 25 jeux de données entièrement inventés, en français, pour Ma journée, Contacts et L'argent, plus l'équipe et l'entreprise d'exemple.
2. Quatre volumes (vide, peu, normal, beaucoup), reproductibles à la graine, datés du vendredi 30 octobre 2026 à 10 h 15 (le jour des maquettes), sans jamais lire l'horloge.
3. Les jeux se recoupent : facture payée → paiement → mouvement bancaire, client « Impayé » parce qu'une facture est échue, série tirée des tâches faites, statut d'un projet tiré de ses tâches.
4. Les types sont des sur-ensembles de ceux du dépôt (vérifié à la compilation). Rien n'est branché : aucun fichier existant n'est modifié.
5. `scripts/check-donnees.ts` : 55 contrôles, dont les mêmes invariants sur 12 graines et 4 dates. Reste : les lots Écrire, Échanger, Créer, Outils, La Garde et les chargeurs vers l'API.

## Branche et sha

- Branche : `claude/refonte-donnees-fictives`
- Dernier commit de code : `c14ae41`
- Partie de : `claude/refonte-vivante` @ `f059f32`

## Fichiers touchés

Sortie de `git diff --name-status origin/claude/refonte-vivante...HEAD` (avant ce rapport) :

```
A	scripts/check-donnees.ts
A	src/refonte/donnees/LISEZ-MOI.md
A	src/refonte/donnees/argent.ts
A	src/refonte/donnees/compat.ts
A	src/refonte/donnees/contacts.ts
A	src/refonte/donnees/derives.ts
A	src/refonte/donnees/equipe.ts
A	src/refonte/donnees/fond.ts
A	src/refonte/donnees/index.ts
A	src/refonte/donnees/ma-journee.ts
A	src/refonte/donnees/monde.ts
A	src/refonte/donnees/outils.ts
A	src/refonte/donnees/types.ts
```

Fichiers **sensibles** ou **hors zone** touchés, avec la raison :

| Fichier | Changement (ajout seulement ?) | Pourquoi |
|---|---|---|
| `scripts/check-donnees.ts` | nouveau fichier, rien d'existant modifié | le contrôle des jeux, sur le modèle des autres `scripts/check-*.ts` ; hors des zones listées dans `STATUT.md` |

Aucun fichier sensible n'est modifié (ni `package.json`, ni `editions.yml`, ni `index.css`). Le contrôle n'est donc **pas encore** câblé en `npm run check:donnees` : voir « Points à trancher ».

## Gardes

| Garde | Résultat |
|---|---|
| `typecheck` | vert |
| `typecheck:business` | vert |
| `lint` | vert |
| `check:accueils` | vert |
| `check:socle` | vert |
| `check:moments` | vert |
| `check:langue`, `check:accent`, `check:naming`, `check:modules` | vert |
| `check-donnees` (le contrôle de cette session, 55 contrôles) | vert |

## Les jeux

| Lot | Jeux | Fiches |
|---|---|---|
| Base | `equipe` (6 personnes écrites à la main, jusqu'à 24), `entreprise` (réglages et identité de facturation invalide par construction) | MC04, H19, MJ03, réglages |
| Ma journée | `taches`, `evenements`, `projets`, `tickets`, `notes`, `rappels`, `habitudes` | H02, H01, MJ01, H03, MJ04, MJ05, MJ02, N01, L01 à L03 |
| Contacts | `clients`, `interlocuteurs`, `prospects`, `fournisseurs`, `achats`, `avis`, `relances`, `fidelite` | H05, G04, F10, T02, MC03, H06, MC01, H45, H44, MC07, MC02 |
| L'argent | `devis`, `factures`, `paiements`, `depenses`, `abonnements`, `contrats`, `comptes`, `mouvements`, `enveloppes` | H07, G03, MA04, F30, MA03, H08, MA05, MA09, MA01, MA10, MA07, MA06 |

Mode d'emploi, volumes, conventions et catalogue : `src/refonte/donnees/LISEZ-MOI.md`.

## Ce qui reste à faire (par ordre d'utilité)

1. **Câblage** : `check:donnees` dans `package.json` et `editions.yml` (fichiers sensibles : par le CO).
2. **L'argent, la suite** : TVA et impôts (MA08), paie (MA11), prestations et tarifs (MA12, le catalogue existe dans `fond.ts` mais pas comme jeu), trésorerie prévisionnelle (H09, calculable depuis `mouvements`).
3. **Contacts, la suite** : partenaires (MC05).
4. **Ma journée, la suite** : planning de l'équipe (MJ03, créneaux), défis d'équipe (L07), cockpit client (G08), bilan de la semaine (H04, calculable), configuration du tableau de bord (H25).
5. **Échanger** : messages (G07), canaux (MX04), annonces (H14), courriels (MX01), réunions (MX02), partages (MX03), sondages (MX05), règles de réponse (MX06), appels (H13).
6. **Écrire** : pages (H10), fichiers (H11), demandes de signature (H12), modèles (ME03), journal (ME01), textes (ME02), archives (ME04), base de connaissances (ME05).
7. **Créer** : stock (H15), chantiers (H16), marque (H17), vidéos (MR01), pages publiques (MR02), tournées (MR03), matériel (MR04), catalogue (MR05), réservations (MR06), commandes (MR07, MR08), véhicules (MR09), photos de chantier (MR10), contrôles qualité (MR11).
8. **Outils** : éléments supprimés (H22), aide (H23), secrets **masqués** (H24, jamais de valeur), sites et trackers (MO02), sauvegardes (MO03), import et export (MO04), raccourcis (MO05), automatisations (H20), connecteurs (H21), notifications (H40), modèles de métier (H47).
9. **La Garde** : organisations (H30, H31), alertes (MG01), incidents (H32), rondes (H33), journal de sécurité (MG02), journal d'accès (H35), maturité (H34), produits cyber (MG03). À faire avec S3, qui a déjà `src/refonte/garde` et `scripts/seed-supervision.mjs`.
10. **Un chargeur vers le bac à sable API** (comme `scripts/seed-essai.mjs`) : les jeux sont aujourd'hui des objets en mémoire, pas des enregistrements de collections.

## Points à trancher

- **Zone** : ajouter `src/refonte/donnees/**` et `scripts/check-donnees.ts` aux zones de `STATUT.md` (je ne le modifie pas).
- **Règles « à confirmer dans le code » implémentées comme propositions**, nommées dans le code : formule de la santé d'un client (H05), seuils de fidélité 500 et 1 500 points (MC02), statut d'un projet (MJ01), règle de la série (L01 : à la clôture), pondération des étapes de prospect (H06). À valider par Harun ou le CO avant que les écrans s'y fient.
- **Écarts de maquettes tranchés par défaut dans les jeux** : note de satisfaction sur 5 partout (H44, G04 disent 5 et 10) ; une seule donnée pour H06 et MC01 (`groupePipeline` fait la correspondance des étapes) ; « ouvertes », compteurs et totaux ne sont jamais ceux des images mais ceux des enregistrements, comme l'exige 04-ECARTS.
- **Équipe fictive** : les prénoms des images (qui sont ceux de l'équipe réelle) sont remplacés par des prénoms inventés, volontairement.
- **Format des enregistrements** : les clés d'enregistrement et la forme exacte des collections de l'API ne sont pas reproduites (voir « reste 10 »).

## Ce qui n'a pas été vérifié

- **Aucun écran n'a encore consommé ces jeux** : la compatibilité est vérifiée par le compilateur et par 55 contrôles, pas en situation.
- **Pas de navigateur** : rien n'a été comparé aux 127 images.
- **Lecture partielle des fiches** : la rubrique 6 d'une quarantaine de fiches (tous les écrans des lots 1, 2 et 4 prioritaires) a été lue en détail ; les autres lots ont été lus par extraction automatique de leurs entités. Les champs des lots non faits restent à relire.
- **Plages de téléphone fictives** (`01 99 00` et `06 39 98`) : confirmées par plusieurs sources secondaires (forum ARA, Access42, Wikipédia), pas par le texte de la décision de l'ARCEP lui-même.
- **Plausibilité des montants et des noms** : relue à l'œil sur un échantillon, pas validée par un comptable. Une ressemblance d'un nom complet avec une vraie personne est possible par coïncidence.
- **Chargement dans l'API** : non fait, donc non testé.
