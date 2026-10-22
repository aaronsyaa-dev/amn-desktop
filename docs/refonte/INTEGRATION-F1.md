# Intégrer un module de l'Atelier (F1)

> **Proposition du CO, à valider par Harun.** Tant qu'elle n'est pas validée,
> aucun module de F1 n'est fusionné dans `claude/refonte-vivante`.

L'Atelier (F1) crée et teste des modules en continu dans `src/ateliers/**`,
sans rien brancher. Un module ne rejoint l'application que par cette procédure,
**un module à la fois**, et seulement s'il a été **choisi par Harun**.

## Les étapes

1. **F1 propose.** Le module passe de `docs/atelier/BACKLOG.md` à
   `docs/atelier/PRET.md`, avec :
   - son nom ;
   - sa famille (une des 7) ;
   - ce qu'il fait, en deux lignes ;
   - le sha de sa branche `claude/refonte-atelier-*` ;
   - son rapport, d'après `docs/refonte/rapports/MODELE.md`.
2. **Harun choisit.** Le choix est écrit dans `PRET.md`, avec la date. Sans
   choix écrit, rien ne bouge.
3. **F1 branche.** Sur sa branche, partie de la **dernière**
   `claude/refonte-vivante` :
   - une ligne dans le registre de S5 (un module = un fichier) ;
   - une route dans `src/edition/appRoot.internal.tsx`.

   Rien d'autre hors de `src/ateliers/**`.
4. **T1 teste.** T1 lance ses tests et les gardes navigateur sur ce sha, et
   consigne le résultat dans `docs/qualite/SANTE.md`.
5. **Le CO relit** et coche la liste de contrôle ci-dessous, dans le rapport de
   fusion.
6. **Harun valide** la liste cochée.
7. **Le CO fusionne** :
   - un commit de fusion par module (`--no-ff`), pour qu'un `git revert -m 1`
     suffise à le retirer ;
   - puis la CI de `claude/refonte-vivante` doit passer ;
   - puis `STATUT.md` est mis à jour.

## Liste de contrôle

Une case non cochée = pas de fusion. Une case « non vérifiable » est écrite
comme telle, jamais cochée par défaut.

### Choix et périmètre

- [ ] Le module est dans `PRET.md`, choisi par Harun (date écrite).
- [ ] La branche part de la dernière `claude/refonte-vivante` (`git merge-base`
      égal à sa tête).
- [ ] Les fichiers touchés sont dans `src/ateliers/**` et `docs/atelier/**`, plus
      les branchements de l'étape 3 seulement. Toute autre ligne est justifiée
      dans le rapport.
- [ ] Aucune nouvelle dépendance dans `package.json` / `package-lock.json`, sauf
      accord écrit du CO.

### Gardes vertes

- [ ] `typecheck`, `typecheck:business` et `lint` passent.
- [ ] Toutes les gardes `check:*` de `editions.yml` passent sans navigateur
      (`check:socle`, `check:moments`, `check:navigation`,
      `check:garde-refonte`, etc.).
- [ ] La garde propre au module, s'il en a une, passe et est ajoutée à
      `editions.yml`.
- [ ] La CI GitHub de la branche est verte, ou rouge uniquement pour une cause
      connue extérieure au code (aujourd'hui : le secret `AMN_API_TOKEN`).

### Tests de T1

- [ ] `docs/qualite/SANTE.md` contient une entrée pour **ce sha**.
- [ ] Les gardes navigateur (`check:isolation`, `check:mouvement`,
      `check:contraste`, `check:coquille`) ne sont pas pires qu'avant :
      comparaison avec le dernier relevé de `refonte-vivante`.
- [ ] `check:signal` et `check:mobile`, qui échouent déjà sur `main` : pas
      d'échec nouveau.
- [ ] Les tests propres au module (`tests/**`) passent.

### L'édition cliente ne bouge pas

- [ ] Aucun fichier partagé n'importe `src/ateliers/**`, `src/refonte/**` ou
      `src/socle/**` en direct. Le code interne passe par une couture
      `@edition/*`, dont le jumeau `.business` ne fait rien.
- [ ] Aucun fichier `*.business.*` n'est modifié, hors le jumeau vide d'une
      nouvelle couture.
- [ ] Les textes sont dans un `i18n.ts` du module, pas dans
      `src/i18n/fr.ts` / `en.ts`.
- [ ] « Build business + contrôle de fuite » est vert en CI (`check:business`
      sur le vrai paquet client).

### Design noir et gris

- [ ] Le fond, les surfaces et le texte utilisent les jetons du socle (noir et
      gris). Aucune couleur écrite en dur.
- [ ] La couleur n'apparaît qu'en **petits points** : famille (`data-famille`)
      ou accent d'équipe. Pas de fonds ni de grands aplats colorés.
- [ ] L'ambre est réservé à la décision à prendre (une par écran), le rouge au
      critique.
- [ ] Aucun personnage, aucune mascotte, aucun robot. Ajmani n'existe que comme
      barre de texte ⌘J.
- [ ] Les briques du socle sont utilisées (`Bouton`, `Carte`, `Modale`,
      `Saisie`) plutôt que de nouvelles.
- [ ] Le réglage Mouvement est respecté : rien ne bouge en « aucun », pas de
      boucle en « réduit ».
- [ ] Le rendu a été vu par T1 ou par Harun, capture jointe. Sinon :
      « non vérifié ».

### Aucun secret, aucune donnée réelle

- [ ] Aucune clé, aucun jeton, aucun mot de passe, aucune URL privée dans le
      diff. Contrôle : relecture du diff, plus un scan de secrets (outil de
      S6 ou scan GitHub).
- [ ] Aucune donnée réelle (Syraagensy, NWSY, clientes) : jeux d'essai fictifs
      seulement.
- [ ] Aucun appel réseau nouveau, sauf s'il est décrit et accepté dans le
      rapport.
- [ ] Les moments émis ne portent que des identifiants (règle du bus).

## Retrait

Si un module fusionné pose problème : `git revert -m 1 <commit de fusion>` sur
`claude/refonte-vivante`, puis le module repasse dans `BACKLOG.md`.
