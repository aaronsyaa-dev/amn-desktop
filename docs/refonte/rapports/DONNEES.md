# Rapport de fin de session — Données fictives (bac à sable), la suite

## Résumé (5 lignes au plus)

1. 75 jeux de plus, soit **100 jeux** entièrement inventés, en français : Écrire, Échanger, Créer, Outils, La Garde, le lot Cyber (LOT-10, 14 écrans) et les écrans manquants des lots déjà faits (TVA et impôts, paie, tarifs, partenaires, planning de l'équipe, défis).
2. Même mécanique qu'avant : quatre volumes (vide, peu, normal, beaucoup), reproductibles à la graine, datés du vendredi 30 octobre 2026 à 10 h 15, sans jamais lire l'horloge.
3. Les jeux se recoupent : TVA à payer = TVA des factures − TVA des dépenses ; salaires de la banque = net des bulletins ; quantité d'un article = somme de ses mouvements ; non-lus = messages non lus ; état d'une organisation = score, alertes ouvertes, dernière ronde ; mission Cyber = état de son accord.
4. Rien de sensible : secrets **masqués**, identifiants `FICT-AAAA-NNNN`, aucune adresse réseau, aucun nom d'outil de sécurité réel, constats réduits à un titre et une gravité, campagnes réduites à des agrégats.
5. `scripts/check-donnees.ts` : 87 contrôles (55 avant), dont les invariants sur 12 graines, 4 graines « beaucoup » et 4 dates ; essayés par mutation. Reste : les chargeurs vers l'API et les écrans à brancher.

## Branche et sha

- Branche : `claude/refonte-donnees-fictives`
- Dernier commit de code : `b49278f`
- Partie de : `claude/refonte-vivante` @ `d6e25d3`

## Fichiers touchés

Sortie de `git diff --name-status origin/claude/refonte-vivante...HEAD` (avant ce rapport) :

```
M	scripts/check-donnees.ts
M	src/refonte/donnees/LISEZ-MOI.md
M	src/refonte/donnees/argent.ts
A	src/refonte/donnees/boite-outils.ts
A	src/refonte/donnees/commun.ts
A	src/refonte/donnees/complements.ts
A	src/refonte/donnees/creer.ts
A	src/refonte/donnees/cyber.ts
A	src/refonte/donnees/echanger.ts
A	src/refonte/donnees/ecrire.ts
A	src/refonte/donnees/garde.ts
M	src/refonte/donnees/index.ts
M	src/refonte/donnees/monde.ts
A	src/refonte/donnees/types-suite.ts
M	src/refonte/donnees/types.ts
```

Fichiers **sensibles** ou **hors zone** touchés : **aucun**. Tout est dans `src/refonte/donnees/**` et `scripts/check-donnees.ts`. `package.json` n'est pas touché (`check:donnees` y est déjà branché).

## Gardes

| Garde | Résultat |
|---|---|
| `typecheck` | vert |
| `typecheck:business` | vert |
| `lint` (sur `src/refonte/donnees` et `scripts/check-donnees.ts`) | vert, 0 avertissement |
| `check:accueils` | vert |
| `check:socle` | vert |
| `check:moments` | vert |
| `check:langue`, `check:accent`, `check:naming`, `check:modules` | vert |
| `check:donnees` (87 contrôles) | vert |

Le `lint` complet du dépôt n'a pas été relancé : seule ma zone l'a été.

## Les jeux ajoutés

| Lot | Jeux | Fiches |
|---|---|---|
| Écrans manquants | `echeancesFiscales` (TVA et impôts), `bulletins` (paie), `prestations` (tarifs), `partenaires`, `creneaux` (planning de l'équipe), `defis` | MA08, MA11, MA12, MC05, MJ03, L07 |
| Écrire | `fichiers`, `signatures`, `pages`, `modeles`, `journal`, `textes`, `archives`, `connaissances` | H10, H11, H12, ME01 à ME05 |
| Échanger | `conversations`, `messages`, `canaux`, `annonces`, `courriels`, `salles`, `appels`, `reunions`, `partages`, `sondages`, `reponsesAuto` | G07, MX01 à MX06, H13, H14 |
| Créer | `articles`, `produits`, `commandes`, `chantiers`, `dossiersPhotos`, `marque`, `videos`, `pagesPubliques`, `etapesTournee`, `equipements`, `ressources`, `reservations`, `vehicules`, `modelesControle`, `controles`, `ecarts` | H15 à H17, MR01 à MR11 |
| Outils | `corbeille`, `aide`, `secrets`, `sites`, `trackers`, `sauvegardes`, `operations`, `raccourcis`, `automatisations`, `connecteurs`, `notifications`, `modelesMetier`, `usagesCalculs` | H20 à H24, H40, H47, MO02 à MO05 |
| La Garde | `organisations`, `actifs`, `alertes`, `incidents`, `vulnerabilites`, `rondes`, `evenementsSecurite`, `journalAcces`, `criteresMaturite`, `offresCyber` | H30 à H35, MG01 à MG03 |
| Cyber (LOT-10) | `outilsCyber`, `accords`, `missions`, `constats`, `documentsCyber`, `logicielsClients`, `alertesVeille`, `fuites`, `dossiersConformite`, `campagnes`, `parcSecurite` | les 14 écrans du lot |

Mode d'emploi, volumes, conventions et catalogue complet : `src/refonte/donnees/LISEZ-MOI.md`.

## Ce qui reste à faire (par ordre d'utilité)

1. **Un chargeur vers le bac à sable API** (comme `scripts/seed-essai.mjs`) : les jeux sont des objets en mémoire, pas des enregistrements de collections. À faire avec S3 pour La Garde (`src/refonte/garde`, `scripts/seed-supervision.mjs`).
2. **Relecture des champs écran par écran** : un écran qui consomme un jeu trouvera peut-être un champ manquant. Ajouter le champ et un contrôle, dans la même zone.
3. **Calculables non stockés** : trésorerie prévisionnelle (H09), bilan de la semaine (H04), cockpit client (G08), configuration du tableau de bord (H25) se calculent depuis les jeux existants ; aucun jeu dédié n'a été créé.
4. **Cyber : volumes `beaucoup`** sont éprouvés par le contrôle, mais pas par un écran (listes très longues de missions et d'outils).

## Points à trancher

- **Règles « à confirmer dans le code » implémentées comme propositions**, nommées dans le code, en plus de celles du rapport précédent : bandes de l'état d'une organisation (Sain ≥ 70, À surveiller 45 à 69, Critique < 45 ; une alerte Critique ouverte rend Critique, une alerte Moyenne ouverte rend À surveiller ; ronde en retard de plus de 2 intervalles → À surveiller, de plus de 24 h → Critique) ; niveaux de maturité (score = points obtenus ÷ points possibles) ; cotisations sociales = 46 % du net ; états d'un accord Cyber (En attente, Valide, Expire bientôt, Expiré). À valider avant que les écrans s'y fient.
- **Écarts de maquettes tranchés par défaut** : comme avant, les compteurs et totaux sont ceux des enregistrements, pas ceux des images (04-ECARTS).
- **Outils Cyber** : le catalogue est volontairement **générique** (9 familles × 6 outils, sans nom d'outil réel). Si un écran réclame des noms précis, à trancher avec le CO.

## Ce qui n'a pas été vérifié

- **Aucun écran n'a encore consommé ces jeux** : compatibilité vérifiée par le compilateur et 87 contrôles, pas en situation. Pas de navigateur, rien comparé aux images.
- **Lecture des fiches des nouveaux lots** : par extraction des entités puis relecture ciblée, pas fiche par fiche en entier.
- **Plausibilité des montants et des noms** : relue à l'œil sur un échantillon, pas validée par un comptable ni par un spécialiste sécurité. Une ressemblance d'un nom complet avec une vraie personne reste possible par coïncidence.
- **Plages de téléphone fictives** (`01 99 00`, `06 39 98`) : confirmées par plusieurs sources secondaires, pas par le texte de l'ARCEP.
- **Le `lint` complet du dépôt** n'a pas été relancé (seule ma zone).
- **Chargement dans l'API** : non fait, donc non testé.
