# Les Signes Vitaux — journal de la refonte

*Le brief : l'application n'est pas un tableau de bord, c'est un organisme. La
donnée est vraie et prouvée par mutation ; elle était montrée comme morte. Ce
document tient les plans par famille d'écran (écrits AVANT le code), les notes
de la boucle visuelle, et ce qui a cédé quand deux exigences se sont opposées.*

---

## Le point de sauvegarde

`git tag design-avant-signes-vitaux` → **`3dcfa5b01ff79eeb836d199b2b56267f196192f5`**

Le tag existe en local. **Le remote a refusé le push du tag** (HTTP 403 — les
identifiants de cette session ne peuvent pousser que la branche de travail,
politique de l'environnement, pas un choix). Le commit visé est déjà sur le
remote, donc le retour en une commande reste vrai :

    git reset --hard 3dcfa5b        # ou, depuis ta machine :
    git tag design-avant-signes-vitaux 3dcfa5b && git push origin design-avant-signes-vitaux

## Ce qui existait déjà — l'audit avant le premier trait

L'ADN annoncé par le brief est réellement en place, et une partie du chantier
est de le POUSSER, pas de le poser :

| Loi du brief | État trouvé |
|---|---|
| Space Grotesk + JetBrains Mono | En place (`@fontsource`, 400–700) |
| Quasi-noirs étagés | En place : `#0a0a0a` fond, `#131313` surface, `#171717` raised — l'élévation par la lumière (`elev-1/2/3` = ombre + arête haute éclairée) |
| Off-white, jamais de blanc pur | `#f2f2f0`, rampe relevée par la règle de confort du 29/08 |
| Rouge = monopole du critique | Tenu, avec `danger-fill`/`danger-ink` dérivés pour la lisibilité |
| Mouvement qui explique | Vocabulaire déclaré et commenté : `live-dot` (« ce flux est vivant »), `just-changed` (« cette ligne vient de changer »), `amn-sweep` (« une ronde passe ») ; entrées 300 ms, sorties 150 ms, `EASE` partagé |
| `prefers-reduced-motion` | Respecté sur chaque animation déclarée |
| Compteur qui compte | `AnimatedCounter` : rAF, repart de la valeur précédente, `aria-hidden` sur les chiffres intermédiaires |

Décision assumée : **le fond reste `#0a0a0a`**, pas le `#121212` suggéré. Aaron
a déjà tranché une fois contre un fond remonté (« retour aux valeurs d'origine »,
commenté dans `index.css`) ; le brief donne le principe (étagement par la
lumière) et ce principe est satisfait. Re-changer le sol de toute l'application
sur un « ~ » serait exactement le genre de re-litige que le dépôt s'interdit.

## Ce qui manquait — le vrai chantier

1. **Aucune échelle typo déclarée** — les tailles sont au cas par cas.
2. **Un nombre n'a pas de mémoire.** `ScreenHeader.stats` et `SoloPulse`
   affichent des valeurs nues : pas de courbe, pas de delta, pas d'historique.
3. **Pas de Relève / Majordome** — l'ouverture après des heures ne raconte rien.
4. **Le battement** — `live-dot` bat à 2,4 s fixe, décorrélé de l'état du parc.
5. **Les états vides** disent le constat, rarement la motivation.

---

## Fondation (famille 0) — le plan, avant le code

### Tokens ajoutés

Échelle typographique, 6 tailles, ratio ≈ 1,31 depuis 36 px :

    --text-v1: 36px   (le SEUL chiffre-héros d'un écran)
    --text-v2: 27px   (titre d'écran)
    --text-v3: 21px   (chiffre de relevé, titre de carte forte)
    --text-v4: 16px   (corps confortable)
    --text-v5: 12px   (méta, libellés)
    --text-v6: 10px   (eyebrow — plancher absolu, jamais en dessous)

`font-variant-numeric: tabular-nums` posé sur `body` : tout chiffre de
l'application devient tabulaire d'un coup, ce qui interdit par construction le
compteur qui tremble. Space Grotesk porte la fonctionnalité ; là où elle ne
jouerait pas, c'est un no-op, jamais une régression.

### LiveMetric — la colonne vertébrale

UN composant, trois états de vie. **Règle d'honnêteté : pas de série, pas de
courbe.** La courbe fantôme n'est dessinée que si l'appelant fournit une série
calculée sur de vraies dates ; sinon le nombre s'affiche seul, comme avant.
Aucune courbe simulée, nulle part, jamais.

- **Repos** : le nombre (tabulaire) + mini-courbe fantôme 7 jours + delta.
- **Événement** : la valeur change → `AnimatedCounter` compte depuis
  l'ancienne valeur + une impulsion `just-changed` sur le bloc.
- **Interaction** : survol/focus → la courbe s'élève (opacité + échelle,
  jamais width/height), les valeurs jour par jour deviennent lisibles.

La série vit dans un module PUR (`src/lib/serieVitale.ts`), exercé par
`scripts/check-vitaux.ts` avec mutations — même discipline que `notesLiens`.
Deux formes, parce que les métriques ont deux natures :

- **flux** (rendez-vous, incidents, commandes) : combien par jour, 7 jours ;
- **stock** (clients, tâches ouvertes ce jour-là n'est PAS reconstituable —
  on ne stocke pas l'historique des statuts) : le CUMUL par date de création,
  qui est la seule lecture honnête d'un stock sans historique d'états.

Le delta dit ce que la courbe dit : flux → « n cette semaine », stock →
« +n en 7 jours ». Jamais un pourcentage inventé sur une base de zéro.

### Autocritique du plan (passe 2)

« Est-ce que n'importe quel outil produirait ça ? » — une sparkline à côté d'un
chiffre, oui, c'est le réflexe générique. Ce qui ne l'est pas, et qui est gardé
comme différence : (1) la règle pas-de-série-pas-de-courbe — les outils
génériques simulent, ici l'absence de courbe est une information ; (2) la
distinction flux/stock au niveau du TYPE, pas du réglage ; (3) le survol qui
ouvre la mémoire du chiffre sur place au lieu d'un tooltip générique ; (4) la
courbe est FANTÔME (sous le chiffre, dans la matière du fond) et non un
graphique posé à côté — le chiffre reste le sujet. Changé après critique : le
delta n'est plus fléché ↑↓ (réflexe dashboard) mais écrit en toutes lettres
(« deux de plus »), conforme à la grammaire §8.

---

## Famille 1 — le web d'abord : connexion + accueil cliente

### Écran de connexion — plan

Concept : le sas d'un organisme. Au repos, l'écran est IMMOBILE et c'est
voulu — on est dehors, rien ne doit prétendre vivre. La carte est un
instrument (repères d'angle, élévation, bandeau `panel-head`), pas un
formulaire. Élément signature : **le sceau** — le point d'état du bandeau dit
la vérité réseau (`navigator.onLine`, nommé au survol), et à la réussite il
s'ouvre en anneau qui balaie vers l'extérieur : le sas s'ouvre. Un seul effet,
causé par le geste, transform/opacity, rien en mouvement réduit.

Registres : « Console d'accès » côté interne, « Votre espace » côté cliente —
une fleuriste n'entre pas dans une console. La ligne de lieu est ancrée au
bord bas de la fenêtre et porte la version réelle : le vide n'est premium que
s'il a une architecture (marque / porte / lieu), et la version est le détail
que vérifie précisément un acheteur de sécurité.

Autocritique : « carte centrée sur fond noir » est la forme la plus générique
qui soit — ce qui l'en sort est le bandeau-instrument à état réel, le sceau,
et la ligne de lieu versionnée. Retiré après critique : le balayage lumineux
d'amorçage au montage (deuxième effet — il y en avait un de trop).

Boucle visuelle (1440 px et 390 px) :
  it.1 — distinctif 3, hiérarchie 4, vivant 2, conforme 5, honnête 5.
         La composition flottait ; le point d'état décoratif mentait.
  it.2 — distinctif 4, hiérarchie 4, vivant 4*, conforme 5, honnête 5.
         (*l'immobilité au repos est le choix ; l'anneau vérifié en vrai par
         sonde : il joue pendant la sortie, et l'arrivée aboutit.)
         `check:mouvement` vert après changements.


### Accueil cliente — plan et notes

Concept : le matin d'une commerçante. La page gagne un RÉCIT — salutation,
relève, bande du jour, pouls, points d'attention, travail — au lieu de blocs
de même poids. Élément signature : **le Majordome**, la relève de poste au ton
de la maison. Deux lignes et un verdict, composés par la grammaire
déterministe de `releve.ts` (14 contrôles, 3 mutations éprouvées) : trois
lignes max dont le verdict FERME toujours, petits nombres en lettres, jamais
d'exclamation, se tait sous quatre heures d'absence.

Écart assumé avec le brief : le Majordome vit DANS la page, pas en voile
immersif skippable. Un voile qui intercepte le premier clic de la journée est
ce qu'on reproche aux applications qui se regardent travailler, et il
piégerait le focus avant le contenu. La version plein-noir reste pour la
Salle de contrôle, où l'on ne travaille pas pendant qu'elle parle.

Ce que la sonde a tué, deux fois : (1) le remontage derrière la garde d'auth
relisait le repère que le premier montage venait de poser ; (2) corrigé par un
cache de module, le DOUBLE DÉMARRAGE de la PWA (le service worker prend la
page et la recharge) recommençait la même mort — « absence : 0,3 s », silence
à chaque déploiement. Le premier démarrage d'un onglet épingle maintenant SA
lecture en sessionStorage ; les redémarrages du même onglet la relisent. C'est
la forme de défaut la plus récidiviste du dépôt : ce qui est observé est bien
enregistré, c'est le réveil qui ne survit pas.

Boucle visuelle (1440/390) : it.1 — les chiffres vivent (courbes réelles),
mais la page n'a pas de centre : distinctif 3, vivant 3. it.2 (Majordome) —
distinctif 4, hiérarchie 4, vivant 4, conforme 5, honnête 5. Sonde de bout en
bout : fermeture du poste, battement antidaté hors application, réouverture
dans un onglet neuf → « Depuis le 27 août · trois factures créées · cinq
tâches ajoutées · Tout va bien. »
